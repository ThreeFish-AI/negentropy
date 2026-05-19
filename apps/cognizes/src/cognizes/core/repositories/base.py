"""
BaseRepository: Abstract base class for all repositories.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import asyncpg

if TYPE_CHECKING:
    from cognizes.core.database import DatabaseManager


class BaseRepository:
    """Base class for all repositories providing common functionality."""

    def __init__(self, db: "DatabaseManager"):
        self.db = db

    async def get_pool(self) -> asyncpg.Pool:
        """Get the database connection pool."""
        return await self.db.get_pool()
