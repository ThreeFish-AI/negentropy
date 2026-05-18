"""
InstructionsRepository: Procedural Memory Data Access Layer
"""

from __future__ import annotations

import json
import uuid

import asyncpg

from cognizes.core.repositories.base import BaseRepository


class InstructionsRepository(BaseRepository):
    """Procedural Memory (Instructions) Data Access Layer"""

    async def add_new_version(
        self,
        app_name: str,
        instruction_key: str,
        content: str,
        metadata: dict | None = None,
    ) -> int:
        """
        Add a new version of instruction.
        Returns the version number.
        """
        query = """
            INSERT INTO instructions
            (app_name, instruction_key, content, version, metadata)
            VALUES (
                $1, $2, $3,
                COALESCE(
                    (SELECT MAX(version) FROM instructions 
                     WHERE app_name = $1 AND instruction_key = $2), 
                    0
                ) + 1,
                $4
            )
            RETURNING version
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchval(
                query,
                app_name,
                instruction_key,
                content,
                json.dumps(metadata) if metadata else None,
            )

    async def get_latest(self, app_name: str, instruction_key: str) -> asyncpg.Record | None:
        """Get the latest version of an instruction."""
        query = """
            SELECT id, content, version, metadata, created_at
            FROM instructions
            WHERE app_name = $1 AND instruction_key = $2
            ORDER BY version DESC
            LIMIT 1
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, app_name, instruction_key)

    async def get_version(self, app_name: str, instruction_key: str, version: int) -> asyncpg.Record | None:
        """Get a specific version of an instruction."""
        query = """
            SELECT id, content, metadata, created_at
            FROM instructions
            WHERE app_name = $1 AND instruction_key = $2 AND version = $3
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, app_name, instruction_key, version)

    async def list_latest_all_keys(self, app_name: str) -> list[asyncpg.Record]:
        """List the latest version of all instructions for an app."""
        query = """
            SELECT DISTINCT ON (instruction_key)
                id, instruction_key, content, version, metadata, created_at
            FROM instructions
            WHERE app_name = $1
            ORDER BY instruction_key, version DESC
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, app_name)
