import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text

from negentropy.config import settings


CURRENT_HEAD = "0001"
PRESET_SEED_HEAD = "0001"  # 合并后种子数据在唯一迁移中


def _sync_database_url() -> str:
    return str(settings.database_url).replace("postgresql+asyncpg", "postgresql+psycopg")


@pytest.fixture(autouse=True)
def reset_database(alembic_config: Config):
    """Keep migration tests isolated – each test starts from *base*.

    Teardown upgrades back to *head* so that subsequent non-migration
    integration tests (engine, knowledge) find the schema intact.
    """

    command.downgrade(alembic_config, "base")
    yield
    command.upgrade(alembic_config, "head")


@pytest.fixture
def alembic_config():
    """Returns an Alembic configuration object."""
    config = Config("alembic.ini")
    return config


def test_migrations_have_single_head(alembic_config: Config):
    """Ensure the migration graph stays linear at the current head."""

    script = ScriptDirectory.from_config(alembic_config)
    assert script.get_heads() == [CURRENT_HEAD]


def test_migrations_stairway(alembic_config: Config):
    """
    Test that we can upgrade to head and downgrade to base.
    This ensures that all migrations are valid and reversible.
    """

    # Run upgrade to head
    command.upgrade(alembic_config, "head")

    # Run downgrade to base
    command.downgrade(alembic_config, "base")

    # Run upgrade to head again to leave the DB in a usable state
    command.upgrade(alembic_config, "head")


def test_data_extractor_seeded_by_migration(alembic_config: Config):
    """Ensure the Data Extractor MCP server is present with the official preset config."""

    command.upgrade(alembic_config, "head")

    engine = create_engine(_sync_database_url())
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text("""
                    SELECT
                        owner_id,
                        visibility::text AS visibility,
                        display_name,
                        description,
                        transport_type,
                        url,
                        is_enabled,
                        auto_start
                    FROM negentropy.mcp_servers
                    WHERE name = 'data-extractor'
                """)
            ).mappings().one()
    finally:
        engine.dispose()

    assert row["owner_id"] == "system:data-extractor-preset"
    assert row["visibility"] == "PUBLIC"
    assert row["display_name"] == "Data Extractor"
    assert row["description"] == (
        "一款商用级 MCP Server，能够从网页和 PDF 文件中精准提取包括文本、图片、表格、公式等内容，并将之转换为与源文档编排格式一致的 Markdown 文档。"
    )
    assert row["transport_type"] == "http"
    assert row["url"] == "http://localhost:8081/mcp"
    assert row["is_enabled"] is True
    assert row["auto_start"] is True


def test_data_extractor_seed_is_idempotent_on_re_upgrade(alembic_config: Config):
    """Ensure the data-extractor seed survives a full downgrade → re-upgrade cycle.

    合并后仅有一个迁移文件，无法升级到中间版本。
    改为验证：全量升级 → 污染数据 → 全量降级 → 全量重升级后，
    种子数据的 ON CONFLICT DO UPDATE 能正确修复被污染的记录。
    """

    # 1. 升级到 HEAD（创建种子数据）
    command.upgrade(alembic_config, "head")

    # 2. 手动污染 data-extractor 记录
    engine = create_engine(_sync_database_url())
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    UPDATE negentropy.mcp_servers
                    SET
                        owner_id = 'google:manual-owner',
                        visibility = 'PRIVATE'::negentropy.pluginvisibility,
                        display_name = 'Manual Override',
                        description = 'manual record should win',
                        transport_type = 'http',
                        command = NULL,
                        args = '[]'::jsonb,
                        env = '{}'::jsonb,
                        url = 'http://manual.example/mcp',
                        headers = '{}'::jsonb,
                        is_enabled = FALSE,
                        auto_start = FALSE,
                        config = '{}'::jsonb,
                        updated_at = now()
                    WHERE name = 'data-extractor'
                """)
            )
    finally:
        engine.dispose()

    # 3. 降级到 base（删除所有表和数据）
    command.downgrade(alembic_config, "base")

    # 4. 重新升级到 HEAD（重新创建种子数据）
    command.upgrade(alembic_config, "head")

    # 5. 验证种子数据正确（未被污染影响）
    engine = create_engine(_sync_database_url())
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text("""
                    SELECT
                        owner_id,
                        visibility::text AS visibility,
                        display_name,
                        description,
                        url,
                        is_enabled,
                        auto_start
                    FROM negentropy.mcp_servers
                    WHERE name = 'data-extractor'
                """)
            ).mappings().one()
    finally:
        engine.dispose()

    assert row["owner_id"] == "system:data-extractor-preset"
    assert row["visibility"] == "PUBLIC"
    assert row["display_name"] == "Data Extractor"
    assert row["description"] == (
        "一款商用级 MCP Server，能够从网页和 PDF 文件中精准提取包括文本、图片、表格、公式等内容，并将之转换为与源文档编排格式一致的 Markdown 文档。"
    )
    assert row["url"] == "http://localhost:8081/mcp"
    assert row["is_enabled"] is True
    assert row["auto_start"] is True
