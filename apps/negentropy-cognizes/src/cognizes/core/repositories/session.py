"""
SessionRepository: Session Data Access Layer
"""

from __future__ import annotations

import json
import uuid

import asyncpg

from cognizes.core.repositories.base import BaseRepository


class SessionRepository(BaseRepository):
    """Session Data Access Layer"""

    async def create(self, session_id: uuid.UUID, app_name: str, user_id: str, state: dict) -> asyncpg.Record:
        """Create a new session."""
        query = """
            INSERT INTO threads (id, app_name, user_id, state)
            VALUES ($1, $2, $3, $4)
            RETURNING id, app_name, user_id, state, version, created_at, updated_at
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, session_id, app_name, user_id, json.dumps(state))

    async def get(self, session_id: uuid.UUID, app_name: str, user_id: str) -> asyncpg.Record | None:
        """Get a session by ID."""
        query = """
            SELECT id, app_name, user_id, state, version, created_at, updated_at
            FROM threads
            WHERE id = $1 AND app_name = $2 AND user_id = $3
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, session_id, app_name, user_id)

    async def list(self, app_name: str, user_id: str) -> list[asyncpg.Record]:
        """List all sessions for a user."""
        query = """
            SELECT id, app_name, user_id, state, version, created_at, updated_at
            FROM threads
            WHERE app_name = $1 AND user_id = $2
            ORDER BY updated_at DESC
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, app_name, user_id)

    async def delete(self, session_id: uuid.UUID, app_name: str, user_id: str) -> bool:
        """Delete a session."""
        query = """
            DELETE FROM threads
            WHERE id = $1 AND app_name = $2 AND user_id = $3
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute(query, session_id, app_name, user_id)
            return result == "DELETE 1"

    async def update_state(self, session_id: uuid.UUID, current_version: int, new_state: dict) -> int | None:
        """Update session state with optimistic locking."""
        query = """
            UPDATE threads
            SET state = $1, version = version + 1, updated_at = NOW()
            WHERE id = $2 AND version = $3
            RETURNING version
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchval(query, json.dumps(new_state), session_id, current_version)
