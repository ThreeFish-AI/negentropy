import asyncio
from urllib.parse import urlsplit, urlunsplit

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from negentropy.config import settings
from negentropy.db import deps as db_deps
from negentropy.db import session as db_session


def _derive_test_db_urls(prod_url: str) -> tuple[str, str, str]:
    """从生产 DSN 派生测试库相关 DSN：库名 ``<name>`` → ``<name>_test``。

    返回 ``(test_async_dsn, maintenance_pg_dsn, test_db_name)``。
    维护库连 ``postgres``（CREATE DATABASE 不能在目标库自身或事务内执行）。
    """
    parts = urlsplit(prod_url)
    db_name = parts.path.lstrip("/") or "negentropy"
    test_db = f"{db_name}_test"
    test_url = urlunsplit(parts._replace(path=f"/{test_db}"))
    # 维护连接用纯 postgresql:// 驱动名（asyncpg.connect 不认 +asyncpg 后缀）
    maint_scheme = parts.scheme.split("+", 1)[0]
    maint_url = urlunsplit(parts._replace(scheme=maint_scheme, path="/postgres"))
    return test_url, maint_url, test_db


async def _ensure_database(maint_url: str, test_db: str) -> None:
    """幂等创建测试库（asyncpg autocommit）。已存在则 no-op。"""
    import asyncpg

    conn = await asyncpg.connect(maint_url)
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", test_db)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{test_db}"')
    finally:
        await conn.close()


@pytest.fixture(scope="session", autouse=True)
def _isolate_test_database():
    """会话级强制隔离：所有测试在专用 ``<db>_test`` 库运行，**绝不触碰生产库**。

    根因防护（ISSUE-111）：此前 ``db_engine`` 与 ``test_migrations.reset_database`` 直接读
    ``settings.database_url``（生产 ``negentropy`` 库）——

      1. ``test_migrations`` 的 ``command.downgrade(base)`` 会**摧毁全部生产数据**
         （routines / knowledge / memory / sessions…），违反 AGENTS.md「严禁删除现有数据」；
      2. orchestrator 集成测试的 ``_dispatch_due`` / ``_evaluate_and_decide`` 扫描**全部** running
         routine，会污染真实任务（实证：测试夹具 ``WorkspaceInfo('/tmp/wt/dispatch-auto')`` 经
         ``_dispatch_due`` 写入了生产模板 routine 的 iter2，触发其后的会话死亡螺旋）。

    修复：会话开始即把 ``settings.database.url`` 改写为 ``<db>_test``。``database_url`` 是纯
    ``@property``（``str(self.database.url)``），且同进程 alembic（``env.py`` 读 ``settings.database_url``）
    与 ``_sync_database_url`` 均经此读取——单一改写点即让 ``db_engine`` / alembic / 迁移测试全部
    落到测试库。再幂等创建并 ``upgrade head`` 测试库，使非迁移类集成测试有完整 schema。
    """
    prod_url = str(settings.database_url)
    if prod_url.rstrip("/").endswith("_test"):
        # 已指向测试库（外部经 NE_DB_URL 显式设定）→ 直接放行，仅确保 schema。
        yield
        return

    from alembic import command
    from alembic.config import Config

    test_url, maint_url, test_db = _derive_test_db_urls(prod_url)
    asyncio.run(_ensure_database(maint_url, test_db))

    # DatabaseSettings 是 frozen 模型（不能改 settings.database.url）；改覆盖 Settings 类的
    # ``database_url`` 纯属性即可——alembic env.py / _sync_database_url / 本文件 db_engine 全经它
    # 读取 DSN。session 级保存/还原，绝不残留影响其它进程。
    settings_cls = type(settings)
    original_prop = settings_cls.database_url
    settings_cls.database_url = property(lambda _self, _u=test_url: _u)
    try:
        command.upgrade(Config("alembic.ini"), "head")  # env.py 读 settings.database_url → 测试库
        yield
    finally:
        settings_cls.database_url = original_prop


@pytest.fixture(scope="function")
async def db_engine():
    """
    Function-scoped database engine for tests.
    Ensures the engine is created within the correct event loop scope (function).

    绑定到 ``settings.database_url``——已被 ``_isolate_test_database`` 改写为测试库，绝不连生产库。
    """
    engine = create_async_engine(
        str(settings.database_url),
        pool_pre_ping=True,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_recycle=settings.db_pool_recycle,
        echo=settings.db_echo,
    )
    yield engine
    await engine.dispose()


@pytest.fixture(scope="function", autouse=True)
async def patch_db_globals(db_engine, monkeypatch):
    """
    Patches module-level database variables to use the test-scoped engine.
    This ensures that get_db() uses a session bound to the test engine.
    """
    # Create a new session factory bound to the test engine
    TestAsyncSessionLocal = async_sessionmaker(
        bind=db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    # Patch the global variables in db.session and db.deps
    monkeypatch.setattr(db_session, "engine", db_engine)
    monkeypatch.setattr(db_session, "AsyncSessionLocal", TestAsyncSessionLocal)

    # Also patch deps.AsyncSessionLocal because it imports it directly
    monkeypatch.setattr(db_deps, "AsyncSessionLocal", TestAsyncSessionLocal)

    yield
