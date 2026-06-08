import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text

from negentropy.config import settings


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
    """Ensure the migration graph stays linear — exactly one head exists."""

    script = ScriptDirectory.from_config(alembic_config)
    heads = script.get_heads()
    assert len(heads) == 1, f"Expected single Alembic head, got: {heads}"


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


def test_negentropy_perceives_seeded_by_migration(alembic_config: Config):
    """Ensure the Negentropy Perceives MCP server is present with the official preset config."""

    command.upgrade(alembic_config, "head")

    engine = create_engine(_sync_database_url())
    try:
        with engine.begin() as conn:
            row = (
                conn.execute(
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
                    WHERE name = 'negentropy-perceives'
                """)
                )
                .mappings()
                .one()
            )
    finally:
        engine.dispose()

    assert row["owner_id"] == "system:negentropy-perceives-preset"
    assert row["visibility"] == "PUBLIC"
    assert row["display_name"] == "Negentropy Perceives"
    assert row["description"] == (
        "一款商用级 MCP Server，能够从网页和 PDF 文件中精准提取包括文本、"
        "图片、表格、公式等内容，并将之转换为与源文档编排格式一致的 Markdown 文档。"
    )
    assert row["transport_type"] == "http"
    assert row["url"] == "http://localhost:2992/mcp"
    assert row["is_enabled"] is True
    assert row["auto_start"] is True


def test_negentropy_perceives_seed_is_idempotent_on_re_upgrade(alembic_config: Config):
    """Ensure the negentropy-perceives seed survives a full downgrade → re-upgrade cycle.

    合并后仅有一个迁移文件，无法升级到中间版本。
    改为验证：全量升级 → 污染数据 → 全量降级 → 全量重升级后，
    种子数据的 ON CONFLICT DO UPDATE 能正确修复被污染的记录。
    """

    # 1. 升级到 HEAD（创建种子数据）
    command.upgrade(alembic_config, "head")

    # 2. 手动污染 negentropy-perceives 记录
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
                    WHERE name = 'negentropy-perceives'
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
            row = (
                conn.execute(
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
                    WHERE name = 'negentropy-perceives'
                """)
                )
                .mappings()
                .one()
            )
    finally:
        engine.dispose()

    assert row["owner_id"] == "system:negentropy-perceives-preset"
    assert row["visibility"] == "PUBLIC"
    assert row["display_name"] == "Negentropy Perceives"
    assert row["description"] == (
        "一款商用级 MCP Server，能够从网页和 PDF 文件中精准提取包括文本、"
        "图片、表格、公式等内容，并将之转换为与源文档编排格式一致的 Markdown 文档。"
    )
    assert row["url"] == "http://localhost:2992/mcp"
    assert row["is_enabled"] is True
    assert row["auto_start"] is True


def test_playwright_browser_mcp_seeded_by_migration(alembic_config: Config):
    """迁移 0062：① mcp_servers 目录卡片（is_system）；② builtin_tools 全系统注入。"""
    import json

    command.upgrade(alembic_config, "head")

    engine = create_engine(_sync_database_url())
    try:
        with engine.begin() as conn:
            server = (
                conn.execute(
                    text("""
                    SELECT owner_id, visibility::text AS visibility, display_name,
                           transport_type, command, args, is_enabled, auto_start, is_system
                    FROM negentropy.mcp_servers
                    WHERE name = 'playwright'
                """)
                )
                .mappings()
                .one()
            )
            cfg_raw = conn.execute(
                text("""
                SELECT config FROM negentropy.builtin_tools
                WHERE name = 'claude_code' AND owner_id = 'system'
            """)
            ).scalar_one()
    finally:
        engine.dispose()

    # ① 目录卡片：stdio · npx · 系统内置
    assert server["owner_id"] == "system:playwright-browser-preset"
    assert server["visibility"] == "PUBLIC"
    assert server["display_name"] == "Playwright Browser"
    assert server["transport_type"] == "stdio"
    assert server["command"] == "npx"
    assert server["is_enabled"] is True
    assert server["auto_start"] is True
    assert server["is_system"] is True  # 0033 backfill 不覆盖新行，必须显式置 TRUE
    args = server["args"] if isinstance(server["args"], list) else json.loads(server["args"])
    assert any("@playwright/mcp@" in a for a in args)  # 版本钉死
    assert "--headless" in args and "--isolated" in args

    # ② 全系统注入：mcp_config.playwright + allowed_tools 含 mcp__playwright
    config = cfg_raw if isinstance(cfg_raw, dict) else json.loads(cfg_raw)
    assert "playwright" in (config.get("mcp_config") or {})
    assert config["mcp_config"]["playwright"]["command"] == "npx"
    assert "mcp__playwright" in (config.get("allowed_tools") or [])


def _fetch_targets(conn, corpus_name: str, route: str):
    """读取某 corpus 指定路由的 extractor targets 数组（保序）。route 仅取受控字面量。"""
    import json

    raw = conn.execute(
        text(
            f"SELECT config #> '{{extractor_routes,{route},targets}}' FROM negentropy.corpus WHERE name = :name"
        ).bindparams(name=corpus_name)
    ).scalar_one()
    return raw if isinstance(raw, list) else json.loads(raw)


def test_corpus_pdf_extractor_timeout_bump_0066(alembic_config: Config):
    """迁移 0066：纠正存量 corpus 的 file_pdf timeout_ms 旧默认值，其余值原样保留。

    覆盖（ISSUE-133 follow-up）：
      - 旧默认 300000→3600000(主)、600000→7200000(备)，且保持主备顺序；
      - 无 timeout_ms 的元素不被注入 key；用户自定义值(900000)保留；
      - url 路由(60000)不被本迁移触碰；
      - 幂等：二次执行 upgrade SQL 零变更；
      - downgrade 逆向还原旧默认值，且不回退非本迁移写入的自定义值。
    """
    import json

    from alembic.script import ScriptDirectory

    # 升级到本迁移前一版本，植入存量 corpus
    command.upgrade(alembic_config, "0065")

    cfg_old = {
        "extractor_routes": {
            "file_pdf": {
                "targets": [
                    {
                        "server_id": "s1",
                        "tool_name": "parse_pdf_to_markdown",
                        "priority": 0,
                        "enabled": True,
                        "timeout_ms": 300000,
                    },
                    {
                        "server_id": "s1",
                        "tool_name": "parse_pdfs_to_markdown",
                        "priority": 1,
                        "enabled": True,
                        "timeout_ms": 600000,
                    },
                ]
            },
            "url": {
                "targets": [
                    {
                        "server_id": "s1",
                        "tool_name": "parse_webpage_to_markdown",
                        "priority": 0,
                        "enabled": True,
                        "timeout_ms": 60000,
                    },
                ]
            },
        }
    }
    cfg_custom = {
        "extractor_routes": {
            "file_pdf": {
                "targets": [
                    {
                        "server_id": "s2",
                        "tool_name": "parse_pdf_to_markdown",
                        "priority": 0,
                        "enabled": True,
                    },  # 无 timeout_ms
                    {
                        "server_id": "s2",
                        "tool_name": "parse_pdfs_to_markdown",
                        "priority": 1,
                        "enabled": True,
                        "timeout_ms": 900000,
                    },  # 自定义
                ]
            }
        }
    }

    engine = create_engine(_sync_database_url())
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO negentropy.corpus (app_name, name, config) VALUES
                    ('app-0066', 'corpus-old-defaults', CAST(:cfg_old AS jsonb)),
                    ('app-0066', 'corpus-custom', CAST(:cfg_custom AS jsonb))
                    """
                ).bindparams(cfg_old=json.dumps(cfg_old), cfg_custom=json.dumps(cfg_custom))
            )

        # 运行本迁移（0065 → 0066/head）
        command.upgrade(alembic_config, "head")

        with engine.begin() as conn:
            old = _fetch_targets(conn, "corpus-old-defaults", "file_pdf")
            url = _fetch_targets(conn, "corpus-old-defaults", "url")
            custom = _fetch_targets(conn, "corpus-custom", "file_pdf")

        # 旧默认值被纠正，主备顺序保持
        assert [t["tool_name"] for t in old] == ["parse_pdf_to_markdown", "parse_pdfs_to_markdown"]
        assert old[0]["timeout_ms"] == 3600000
        assert old[1]["timeout_ms"] == 7200000
        # url 路由不被触碰
        assert url[0]["timeout_ms"] == 60000
        # 无 timeout_ms 的元素未被注入 key；自定义值保留
        assert "timeout_ms" not in custom[0]
        assert custom[1]["timeout_ms"] == 900000

        # 幂等：二次执行本迁移的 upgrade SQL 不产生任何变更
        mig = ScriptDirectory.from_config(alembic_config).get_revision("0066").module
        with engine.begin() as conn:
            conn.execute(text(mig._rewrite_sql(mig._UPGRADE_MAP)))
            old_again = _fetch_targets(conn, "corpus-old-defaults", "file_pdf")
        assert old_again[0]["timeout_ms"] == 3600000
        assert old_again[1]["timeout_ms"] == 7200000

        # downgrade 逆向还原旧默认值；自定义 900000 不在映射中，保持不变
        command.downgrade(alembic_config, "0065")
        with engine.begin() as conn:
            old_down = _fetch_targets(conn, "corpus-old-defaults", "file_pdf")
            custom_down = _fetch_targets(conn, "corpus-custom", "file_pdf")
        assert old_down[0]["timeout_ms"] == 300000
        assert old_down[1]["timeout_ms"] == 600000
        assert custom_down[1]["timeout_ms"] == 900000
    finally:
        engine.dispose()
