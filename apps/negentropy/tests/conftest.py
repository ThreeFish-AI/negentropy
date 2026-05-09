import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from negentropy.config import settings
from negentropy.db import deps as db_deps
from negentropy.db import session as db_session

# Modules that use `from negentropy.db.session import AsyncSessionLocal` —
# the name binding at import time is not updated by monkeypatching db_session,
# so each must be patched individually.
from negentropy.knowledge import api as _knowledge_api
from negentropy.scripts import cleanup_orphan_knowledge as _cleanup_script
from negentropy.storage import service as _storage_service


@pytest.fixture(scope="function")
async def db_engine():
    """
    Function-scoped database engine for tests.
    Ensures the engine is created within the correct event loop scope (function).
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

    # Patch storage.service.AsyncSessionLocal — it uses `from ... import AsyncSessionLocal`
    # which binds the name at import time, so monkeypatching db_session alone is insufficient.
    for mod in (_storage_service, _cleanup_script, _knowledge_api):
        monkeypatch.setattr(mod, "AsyncSessionLocal", TestAsyncSessionLocal)

    yield
