import typing as t
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from negentropy.config import settings
from negentropy.db import session as db_session
from negentropy.db import deps as db_deps


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

    yield
