import pytest
import sqlalchemy
from sqlalchemy import text
from negentropy.db import get_db


async def test_database_connection(db_engine):
    """
    Verify real database connection.
    This test attempts to connect to the database specified in settings.
    It executes a simple 'SELECT 1' query.
    """
    try:
        async with db_engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            value = result.scalar()
            assert value == 1
    except (OSError, sqlalchemy.exc.OperationalError) as e:
        pytest.fail(f"Could not connect to database at {db_engine.url}. Error: {e}")


async def test_get_db_dependency():
    """
    Verify the get_db dependency yields a valid session.
    """
    async for session in get_db():
        assert session is not None
        # Check if session is active/valid
        result = await session.execute(text("SELECT 1"))
        assert result.scalar() == 1
        # No need to explicitly close as the generator handles it,
        # but we break to trigger the cleanup in the generator
        break
