"""
PostgresMemoryService: ADK MemoryService 的 PostgreSQL 实现

继承 Google ADK BaseMemoryService，复用 Phase 2 Hippocampus 的记忆巩固能力，实现：
- Session 到 Memory 的转化 (add_session_to_memory)
- 混合检索 (search_memory) - 支持语义 + BM25 Hybrid Search
- 访问行为记录 (record_access) - 更新 access_count/last_accessed_at，驱动遗忘曲线

重构说明：
    本版本从 raw SQL 迁移到 SQLAlchemy ORM，复用：
    - `db/session.py` 中的 `AsyncSessionLocal`
    - `models/internalization.py` 中的 `Memory`
    - `perception_schema.sql` 中的 `hybrid_search()` SQL 函数

参考文献:
[1] A. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," 1885.
[2] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks,"
    *Adv. Neural Inf. Process. Syst.*, vol. 33, pp. 9459-9474, 2020.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import select, text, update

# ADK 官方类型
from google.adk.sessions import Session as ADKSession
from google.adk.memory.base_memory_service import (
    BaseMemoryService,
    SearchMemoryResponse,
    MemoryEntry,
)

# ORM 模型与会话工厂
import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.internalization import Memory

logger = get_logger("negentropy.engine.adapters.postgres.memory_service")

# 默认检索配置
_DEFAULT_SEARCH_LIMIT = 10
_DEFAULT_SEMANTIC_WEIGHT = 0.7
_DEFAULT_KEYWORD_WEIGHT = 0.3


class PostgresMemoryService(BaseMemoryService):
    """
    PostgreSQL 实现的 MemoryService

    继承 ADK BaseMemoryService，可直接与 ADK Runner 集成。

    核心职责：
    1. 将 Session 对话转化为可搜索的记忆 (复用 Phase 2 consolidate)
    2. 基于 Hybrid Search 检索相关记忆 (语义 + BM25 融合)
    """

    def __init__(self, embedding_fn: Optional[callable] = None, consolidation_worker=None):
        self._embedding_fn = embedding_fn  # 向量化函数
        self._consolidation_worker = consolidation_worker  # Phase 2 Worker

    async def add_session_to_memory(
        self,
        session: ADKSession,
    ) -> None:
        """将 Session 中的对话转化为可搜索的记忆"""
        if self._consolidation_worker:
            # 使用 Phase 2 的 consolidate 函数
            await self._consolidation_worker.consolidate(
                thread_id=session.id, user_id=session.user_id, app_name=session.app_name
            )
        else:
            # 简化实现：直接将 Events 向量化存储
            await self._simple_consolidate(session)

    async def _simple_consolidate(self, session: ADKSession) -> None:
        """简化版记忆巩固 (用于测试)"""
        # 提取所有 user 消息
        user_messages = []
        for event in session.events:
            if hasattr(event, "author") and event.author in ["user", "model", "assistant"]:
                if hasattr(event, "content") and event.content:
                    # ADK Event.content 可能是 Content 对象、dict 或 str
                    if hasattr(event.content, "parts"):
                        for part in event.content.parts:
                            if hasattr(part, "text") and part.text:
                                user_messages.append(part.text)
                    elif isinstance(event.content, dict) and "parts" in event.content:
                        for part in event.content["parts"]:
                            if isinstance(part, dict) and "text" in part:
                                user_messages.append(part["text"])
                    elif isinstance(event.content, str):
                        user_messages.append(event.content)

        if not user_messages:
            return

        # 合并为单条记忆内容
        combined_content = "\n".join(user_messages)

        # 生成向量 (如果有 embedding 函数)
        embedding = None
        if self._embedding_fn:
            embedding = await self._embedding_fn(combined_content)

        # 确保 thread_id 是 UUID 类型
        thread_id = None
        if session.id:
            try:
                thread_id = uuid.UUID(session.id)
            except ValueError:
                pass

        async with db_session.AsyncSessionLocal() as db:
            memory = Memory(
                thread_id=thread_id,
                user_id=session.user_id,
                app_name=session.app_name,
                memory_type="episodic",
                content=combined_content,
                embedding=embedding,
                metadata_={"source": "session", "event_count": len(session.events)},
            )
            db.add(memory)
            await db.commit()

    async def search_memory(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
    ) -> SearchMemoryResponse:
        """基于 Query 检索相关记忆

        检索策略（按优先级）:
        1. Hybrid Search: 语义 + BM25 融合检索（需要 embedding_fn）
        2. BM25 全文检索: 利用 search_vector GIN 索引
        3. ilike 回退: 当 search_vector 不可用时的最终回退

        检索完成后异步更新被召回记忆的 access_count 和 last_accessed_at，
        驱动艾宾浩斯遗忘曲线动态生效。<sup>[1]</sup>
        """
        # 生成查询向量
        query_embedding = None
        if self._embedding_fn:
            try:
                query_embedding = await self._embedding_fn(query)
            except Exception as exc:
                logger.warning(
                    "memory_search_embedding_failed",
                    query=query[:100],
                    error=str(exc),
                )

        memories_data: list[dict[str, Any]] = []

        if query_embedding is not None:
            # 策略 1: 尝试 DB 原生 hybrid_search()
            try:
                result = await self._hybrid_search_native(
                    app_name=app_name,
                    user_id=user_id,
                    query=query,
                    query_embedding=query_embedding,
                )
                if result is not None:
                    memories_data = result
                    await self._record_access(memories_data)
                    return self._build_search_response(memories_data)
            except Exception as exc:
                logger.warning(
                    "hybrid_search_native_failed",
                    error=str(exc),
                    fallback="vector_search",
                )

            # 策略 2: 回退到纯向量检索
            memories_data = await self._vector_search(
                app_name=app_name,
                user_id=user_id,
                query_embedding=query_embedding,
            )
            await self._record_access(memories_data)
            return self._build_search_response(memories_data)

        # 策略 3: BM25 全文检索
        try:
            memories_data = await self._keyword_search(
                app_name=app_name,
                user_id=user_id,
                query=query,
            )
            if memories_data:
                await self._record_access(memories_data)
                return self._build_search_response(memories_data)
        except Exception as exc:
            logger.warning(
                "keyword_search_failed",
                error=str(exc),
                fallback="ilike",
            )

        # 策略 4: ilike 回退
        memories_data = await self._ilike_search(
            app_name=app_name,
            user_id=user_id,
            query=query,
        )
        await self._record_access(memories_data)
        return self._build_search_response(memories_data)

    async def _hybrid_search_native(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
        query_embedding: list[float],
    ) -> list[dict[str, Any]] | None:
        """调用 DB 原生 hybrid_search() 函数

        利用 perception_schema.sql 中定义的 hybrid_search() 函数，
        在一次 SQL 调用中完成语义 + BM25 融合检索。

        注意：使用 schema 前缀 `{NEGENTROPY_SCHEMA}` 确保与 ORM 一致，
        embedding 参数通过参数化绑定避免注入风险。

        Returns:
            检索结果列表，失败返回 None
        """
        sql = text(f"""
            SELECT id, content, semantic_score, keyword_score, combined_score, metadata
            FROM {NEGENTROPY_SCHEMA}.hybrid_search(
                :user_id, :app_name, :query, :embedding::vector(1536),
                :limit, :semantic_weight, :keyword_weight
            )
        """)

        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                sql,
                {
                    "user_id": user_id,
                    "app_name": app_name,
                    "query": query,
                    "embedding": query_embedding,
                    "limit": _DEFAULT_SEARCH_LIMIT,
                    "semantic_weight": _DEFAULT_SEMANTIC_WEIGHT,
                    "keyword_weight": _DEFAULT_KEYWORD_WEIGHT,
                },
            )
            rows = result.fetchall()

        if not rows:
            return []

        logger.info(
            "hybrid_search_completed",
            user_id=user_id,
            query=query[:100],
            result_count=len(rows),
        )

        return [
            {
                "id": str(row.id),
                "content": row.content,
                "metadata": row.metadata or {},
                "relevance_score": float(row.combined_score),
            }
            for row in rows
        ]

    async def _vector_search(
        self,
        *,
        app_name: str,
        user_id: str,
        query_embedding: list[float],
    ) -> list[dict[str, Any]]:
        """纯向量相似度检索"""
        async with db_session.AsyncSessionLocal() as db:
            distance = Memory.embedding.op("<=>")(query_embedding)
            stmt = (
                select(Memory)
                .where(
                    Memory.app_name == app_name,
                    Memory.user_id == user_id,
                    Memory.embedding.is_not(None),
                )
                .order_by(distance.asc())
                .limit(_DEFAULT_SEARCH_LIMIT)
            )
            result = await db.execute(stmt)
            memories_orms = result.scalars().all()

        return [
            {
                "id": str(m.id),
                "content": m.content,
                "metadata": m.metadata_ or {},
                "relevance_score": m.retention_score,
                "created_at": m.created_at,
            }
            for m in memories_orms
        ]

    async def _keyword_search(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
    ) -> list[dict[str, Any]]:
        """BM25 全文检索

        利用 memories.search_vector GIN 索引进行高效全文搜索。
        """
        sql = text(f"""
            SELECT id, content, metadata, retention_score, created_at,
                   ts_rank_cd(search_vector, plainto_tsquery('english', :query)) AS rank_score
            FROM {NEGENTROPY_SCHEMA}.memories
            WHERE user_id = :user_id
              AND app_name = :app_name
              AND search_vector @@ plainto_tsquery('english', :query)
            ORDER BY rank_score DESC
            LIMIT :limit
        """)

        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                sql,
                {
                    "user_id": user_id,
                    "app_name": app_name,
                    "query": query,
                    "limit": _DEFAULT_SEARCH_LIMIT,
                },
            )
            rows = result.fetchall()

        return [
            {
                "id": str(row.id),
                "content": row.content,
                "metadata": row.metadata or {},
                "relevance_score": float(row.rank_score) if row.rank_score else 0.0,
                "created_at": row.created_at,
            }
            for row in rows
        ]

    async def _ilike_search(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
    ) -> list[dict[str, Any]]:
        """ilike 模糊搜索回退

        当 search_vector 不可用时的最终回退方案。
        """
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(Memory)
                .where(
                    Memory.app_name == app_name,
                    Memory.user_id == user_id,
                    Memory.content.ilike(f"%{query}%"),
                )
                .order_by(Memory.created_at.desc())
                .limit(_DEFAULT_SEARCH_LIMIT)
            )
            result = await db.execute(stmt)
            memories_orms = result.scalars().all()

        return [
            {
                "id": str(m.id),
                "content": m.content,
                "metadata": m.metadata_ or {},
                "relevance_score": m.retention_score,
                "created_at": m.created_at,
            }
            for m in memories_orms
        ]

    async def _record_access(self, memories_data: list[dict[str, Any]]) -> None:
        """记录记忆访问行为

        批量更新被召回记忆的 access_count 和 last_accessed_at，
        驱动艾宾浩斯遗忘曲线动态生效。<sup>[1]</sup>

        使用批量 UPDATE 避免 N+1 问题。
        """
        if not memories_data:
            return

        memory_ids = [m["id"] for m in memories_data if m.get("id")]
        if not memory_ids:
            return

        try:
            async with db_session.AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)
                # 批量更新 access_count 和 last_accessed_at
                stmt = (
                    update(Memory)
                    .where(Memory.id.in_(memory_ids))
                    .values(
                        access_count=Memory.access_count + 1,
                        last_accessed_at=now,
                    )
                )
                await db.execute(stmt)
                await db.commit()

            logger.debug(
                "memory_access_recorded",
                memory_count=len(memory_ids),
            )
        except Exception as exc:
            # 访问记录失败不应影响检索结果返回
            logger.warning(
                "memory_access_record_failed",
                memory_count=len(memory_ids),
                error=str(exc),
            )

    def _build_search_response(self, memories_data: list[dict[str, Any]]) -> SearchMemoryResponse:
        """构建 ADK SearchMemoryResponse"""
        memories = []
        for m in memories_data:
            content_val = {"parts": [{"text": m["content"]}]}
            created_at = m.get("created_at")
            timestamp = (
                created_at.isoformat()
                if created_at
                else datetime.now(timezone.utc).isoformat()
            )

            memories.append(
                MemoryEntry(
                    id=m["id"],
                    content=content_val,
                    author="system",
                    timestamp=timestamp,
                    relevance_score=m.get("relevance_score", 0.0),
                    custom_metadata=m.get("metadata", {}),
                )
            )

        return SearchMemoryResponse(memories=memories)

    async def list_memories(self, *, app_name: str, user_id: str, limit: int = 100) -> list[MemoryEntry]:
        """列出用户所有记忆"""
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(Memory)
                .where(Memory.app_name == app_name, Memory.user_id == user_id)
                .order_by(Memory.created_at.desc())
                .limit(limit)
            )
            result = await db.execute(stmt)
            memories_orms = result.scalars().all()

        memories = []
        for m in memories_orms:
            content_val = {"parts": [{"text": m.content}]}
            memories.append(
                MemoryEntry(
                    id=str(m.id),
                    content=content_val,
                    author="system",
                    timestamp=m.created_at.isoformat() if m.created_at else datetime.now(timezone.utc).isoformat(),
                    relevance_score=m.retention_score,
                    custom_metadata=m.metadata_ or {},
                )
            )
        return memories
