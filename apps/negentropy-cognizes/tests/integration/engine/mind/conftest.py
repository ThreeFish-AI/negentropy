"""
Mind Integration Test Fixtures
"""

import os
import pytest
import pytest_asyncio

from cognizes.core.database import DatabaseManager


@pytest_asyncio.fixture
async def db_pool():
    """
    Database connection pool for Mind integration tests.
    Connects to local Postgres instance via DatabaseManager.
    """
    try:
        db = DatabaseManager.get_instance()
        pool = await db.get_pool()
        yield pool
        # Pool is managed by DatabaseManager
    except Exception as e:
        pytest.skip(f"Database unavailable: {e}")
