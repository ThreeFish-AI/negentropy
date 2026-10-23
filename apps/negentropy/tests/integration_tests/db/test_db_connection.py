import pytest
import sqlalchemy
from sqlalchemy import text


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
