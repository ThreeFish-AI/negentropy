"""
FactsRepository: Semantic Memory Data Access Layer
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime

import asyncpg

from cognizes.core.repositories.base import BaseRepository


class FactsRepository(BaseRepository):
    """Semantic Memory (Facts) Data Access Layer"""

    async def upsert(
        self,
        user_id: str,
        app_name: str,
        fact_type: str,
        key: str,
        value: dict,
        embedding: list[float] | None = None,
        confidence: float = 1.0,
        valid_until: datetime | None = None,
        thread_id: uuid.UUID | None = None,
    ) -> uuid.UUID:
        """
        Upsert a fact record.
        Updates value, embedding, confidence, valid_until if the fact already exists.
        Returns the ID of the record.
        """
        query = """
            INSERT INTO facts
            (user_id, app_name, fact_type, key, value, embedding, confidence, valid_until, thread_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id, app_name, fact_type, key)
            DO UPDATE SET
                value = EXCLUDED.value,
                embedding = EXCLUDED.embedding,
                confidence = EXCLUDED.confidence,
                valid_until = EXCLUDED.valid_until,
                thread_id = EXCLUDED.thread_id,
                created_at = NOW()
            RETURNING id
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchval(
                query,
                user_id,
                app_name,
                fact_type,
                key,
                json.dumps(value),
                embedding,
                confidence,
                valid_until,
                thread_id,
            )

    async def get(self, user_id: str, app_name: str, fact_type: str, key: str) -> asyncpg.Record | None:
        """Get a specific fact."""
        query = """
            SELECT id, value, confidence, valid_until, created_at
            FROM facts
            WHERE user_id = $1 AND app_name = $2 AND fact_type = $3 AND key = $4
              AND (valid_until IS NULL OR valid_until > NOW())
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, user_id, app_name, fact_type, key)

    async def list(self, user_id: str, app_name: str, fact_type: str | None = None) -> list[asyncpg.Record]:
        """List all valid facts for a user, optionally filtered by type."""
        query = """
            SELECT id, fact_type, key, value, confidence, created_at
            FROM facts
            WHERE user_id = $1 AND app_name = $2
              AND (valid_until IS NULL OR valid_until > NOW())
        """
        args = [user_id, app_name]
        if fact_type:
            query += " AND fact_type = $3"
            args.append(fact_type)

        query += " ORDER BY fact_type, key"

        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def search(
        self, user_id: str, app_name: str, query_embedding: list[float], limit: int = 10
    ) -> list[asyncpg.Record]:
        """Search facts within a user's scope using vector similarity."""
        query = """
            SELECT id, fact_type, key, value, confidence,
                   1 - (embedding <=> $1) AS similarity
            FROM facts
            WHERE user_id = $2 AND app_name = $3
              AND (valid_until IS NULL OR valid_until > NOW())
            ORDER BY embedding <=> $1
            LIMIT $4
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, query_embedding, user_id, app_name, limit)

    async def delete(self, user_id: str, app_name: str, fact_type: str, key: str) -> bool:
        """Delete a fact."""
        query = """
            DELETE FROM facts
            WHERE user_id = $1 AND app_name = $2 AND fact_type = $3 AND key = $4
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute(query, user_id, app_name, fact_type, key)
            return result != "DELETE 0"
