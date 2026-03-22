import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text

from negentropy.config import settings


CURRENT_HEAD = "a9d3f7b21c4e"
PREVIOUS_HEAD = "f2c3d4e5a6b7"


def _sync_database_url() -> str:
    return str(settings.database_url).replace("postgresql+asyncpg", "postgresql+psycopg")


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
    # We need to run this in a synchronous context because Alembic commands are synchronous
    # However, our env.py handles the async engine.

    # Run upgrade to head
    command.upgrade(alembic_config, "head")

    # Run downgrade to base
    command.downgrade(alembic_config, "base")

    # Run upgrade to head again to leave the DB in a usable state
    command.upgrade(alembic_config, "head")


def test_data_extractor_seeded_by_migration(alembic_config: Config):
    """Ensure the Data Extractor MCP server is seeded with the expected runtime config."""

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


def test_data_extractor_seed_skips_existing_manual_record(alembic_config: Config):
    """Ensure the seed migration does not overwrite a pre-existing data-extractor server."""

    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, PREVIOUS_HEAD)

    engine = create_engine(_sync_database_url())
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO negentropy.mcp_servers (
                        owner_id,
                        visibility,
                        name,
                        display_name,
                        description,
                        transport_type,
                        command,
                        args,
                        env,
                        url,
                        headers,
                        is_enabled,
                        auto_start,
                        config
                    )
                    VALUES (
                        'google:manual-owner',
                        'PRIVATE'::negentropy.pluginvisibility,
                        'data-extractor',
                        'Manual Override',
                        'manual record should win',
                        'http',
                        NULL,
                        '[]'::jsonb,
                        '{}'::jsonb,
                        'http://manual.example/mcp',
                        '{}'::jsonb,
                        FALSE,
                        FALSE,
                        '{}'::jsonb
                    )
                """)
            )
    finally:
        engine.dispose()

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
                        url,
                        is_enabled,
                        auto_start
                    FROM negentropy.mcp_servers
                    WHERE name = 'data-extractor'
                """)
            ).mappings().one()
    finally:
        engine.dispose()

    assert row["owner_id"] == "google:manual-owner"
    assert row["visibility"] == "PRIVATE"
    assert row["display_name"] == "Manual Override"
    assert row["description"] == "manual record should win"
    assert row["url"] == "http://manual.example/mcp"
    assert row["is_enabled"] is False
    assert row["auto_start"] is False
