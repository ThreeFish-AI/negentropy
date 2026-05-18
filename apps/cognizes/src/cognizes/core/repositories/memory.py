"""
MemoryRepository: Memory Data Access Layer
"""

from __future__ import annotations

import json
import uuid

import asyncpg

from cognizes.core.repositories.base import BaseRepository


class MemoryRepository(BaseRepository):
    """Memory Data Access Layer"""

    async def insert(
        self,
        thread_id: uuid.UUID | None,
        user_id: str,
        app_name: str,
        memory_type: str,
        content: str,
        embedding: list[float] | None,
        metadata: dict,
        retention_score: float = 1.0,
    ) -> None:
        """Insert a memory record."""
        query = """
            INSERT INTO memories
            (thread_id, user_id, app_name, memory_type, content, embedding, metadata, retention_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                query,
                thread_id,
                user_id,
                app_name,
                memory_type,
                content,
                embedding,
                json.dumps(metadata),
                retention_score,
            )

    async def search_vector(
        self, user_id: str, app_name: str, embedding: list[float], limit: int = 10
    ) -> list[asyncpg.Record]:
        """Search memory using vector similarity."""
        query = """
            SELECT id, content, metadata, created_at,
                   1 - (embedding <=> $1) AS relevance_score
            FROM memories
            WHERE user_id = $2 AND app_name = $3
            ORDER BY embedding <=> $1
            LIMIT $4
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, embedding, user_id, app_name, limit)

    async def search_fulltext(
        self, user_id: str, app_name: str, query_text: str, limit: int = 10
    ) -> list[asyncpg.Record]:
        """Search memory using full-text search."""
        query = """
            SELECT id, content, metadata, created_at,
                   ts_rank_cd(search_vector, plainto_tsquery($1)) AS relevance_score
            FROM memories
            WHERE user_id = $2 AND app_name = $3
              AND search_vector @@ plainto_tsquery($1)
            ORDER BY relevance_score DESC
            LIMIT $4
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, query_text, user_id, app_name, limit)

    async def list_recent(self, user_id: str, app_name: str, limit: int = 100) -> list[asyncpg.Record]:
        """List recent memories."""
        query = """
            SELECT id, content, memory_type, metadata, retention_score, created_at
            FROM memories
            WHERE user_id = $1 AND app_name = $2
            ORDER BY created_at DESC
            LIMIT $3
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, user_id, app_name, limit)

    async def get_context_window(
        self,
        user_id: str,
        app_name: str,
        query: str,
        query_embedding: list[float],
        max_tokens: int = 4000,
        memory_ratio: float = 0.3,
        history_ratio: float = 0.5,
    ) -> list[asyncpg.Record]:
        """
        Retrieve context window combining memories and history.

        Calls the PostgreSQL function get_context_window().
        Returns a list of records with keys: context_type, content, relevance_score, token_estimate.
        """
        query_sql = """
            SELECT * FROM get_context_window($1, $2, $3, $4, $5, $6, $7)
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(
                query_sql,
                user_id,
                app_name,
                query,
                query_embedding,
                max_tokens,
                memory_ratio,
                history_ratio,
            )
