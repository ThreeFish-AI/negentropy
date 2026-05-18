"""
StateRepository: Scoped State Data Access Layer
"""

from __future__ import annotations

from typing import Any

import asyncpg

from cognizes.core.repositories.base import BaseRepository


class StateRepository(BaseRepository):
    """Scoped State Data Access Layer"""

    async def set_user_state(self, user_id: str, app_name: str, key: str, value: Any) -> None:
        """Set user-scoped state."""
        query = """
            INSERT INTO user_states (user_id, app_name, state, updated_at)
            VALUES ($1, $2, jsonb_build_object($3, $4::jsonb), NOW())
            ON CONFLICT (user_id, app_name)
            DO UPDATE SET
                state = user_states.state || jsonb_build_object($3, $4::jsonb),
                updated_at = NOW()
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(query, user_id, app_name, key, value)

    async def get_user_state(self, user_id: str, app_name: str, key: str) -> Any:
        """Get user-scoped state."""
        query = """
            SELECT state->$3 as value
            FROM user_states
            WHERE user_id = $1 AND app_name = $2
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, user_id, app_name, key)
            return row["value"] if row and row["value"] is not None else None

    async def get_all_user_state(self, user_id: str, app_name: str) -> dict:
        """Get all user-scoped state."""
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT state FROM user_states WHERE user_id = $1 AND app_name = $2",
                user_id,
                app_name,
            )
            return row["state"] if row and row["state"] else {}

    async def set_app_state(self, app_name: str, key: str, value: Any) -> None:
        """Set app-scoped state."""
        query = """
            INSERT INTO app_states (app_name, state, updated_at)
            VALUES ($1, jsonb_build_object($2, $3::jsonb), NOW())
            ON CONFLICT (app_name)
            DO UPDATE SET
                state = app_states.state || jsonb_build_object($2, $3::jsonb),
                updated_at = NOW()
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(query, app_name, key, value)

    async def get_app_state(self, app_name: str, key: str) -> Any:
        """Get app-scoped state."""
        query = """
            SELECT state->$2 as value
            FROM app_states
            WHERE app_name = $1
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, app_name, key)
            return row["value"] if row and row["value"] is not None else None

    async def get_all_app_state(self, app_name: str) -> dict:
        """Get all app-scoped state."""
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT state FROM app_states WHERE app_name = $1", app_name)
            return row["state"] if row and row["state"] else {}
