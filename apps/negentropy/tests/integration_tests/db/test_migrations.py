import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncEngine

from negentropy.models.base import Base


@pytest.fixture
def alembic_config():
    """Returns an Alembic configuration object."""
    config = Config("alembic.ini")
    return config


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
