from negentropy.config import settings
from negentropy.db import engine


def test_database_settings():
    """Verify that database settings are loaded correctly from config or env."""
    assert "postgresql+asyncpg" in str(settings.database_url)
    assert settings.db_pool_size > 0
    assert settings.db_max_overflow >= 0


def test_engine_configuration():
    """Verify that the engine is configured with settings."""
    # Check that the engine URL structure is correct
    # Note: Don't assert specific username/database as they vary by environment
    url = engine.url
    assert url.drivername == "postgresql+asyncpg"
    assert url.host == "localhost"
    assert url.port == 5432
    # Verify the URL has a database component set
    assert url.database
