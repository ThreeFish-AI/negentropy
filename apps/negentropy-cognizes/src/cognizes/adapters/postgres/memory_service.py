"""
PostgresMemoryService: ADK MemoryService 的 PostgreSQL 实现

继承 Google ADK BaseMemoryService，复用 Phase 2 Hippocampus 的记忆巩固能力，实现：
- Session 到 Memory 的转化 (add_session_to_memory)
- 语义检索 (search_memory)
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Optional


# ADK 官方类型
from google.adk.sessions import Session
from google.adk.memory.base_memory_service import (
    BaseMemoryService,
    SearchMemoryResponse,
    MemoryEntry,
)


from cognizes.core.database import DatabaseManager


class PostgresMemoryService(BaseMemoryService):
    """
    PostgreSQL 实现的 MemoryService

    继承 ADK BaseMemoryService，可直接与 ADK Runner 集成。

    核心职责：
    1. 将 Session 对话转化为可搜索的记忆 (复用 Phase 2 consolidate)
    2. 基于语义相似度检索相关记忆 (复用 Phase 3 hybrid_search)
    """

    def __init__(self, db: DatabaseManager, embedding_fn: Optional[callable] = None, consolidation_worker=None):
        self.db = db
        self._embedding_fn = embedding_fn  # 向量化函数
        self._consolidation_worker = consolidation_worker  # Phase 2 Worker

    async def add_session_to_memory(
        self,
        session: Session,
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

    async def _simple_consolidate(self, session: Session) -> None:
        """简化版记忆巩固 (用于测试)"""
        # 提取所有 user 消息
        user_messages = []
        for event in session.events:
            if hasattr(event, "author") and event.author in ["user", "model", "assistant"]:
                if hasattr(event, "content") and event.content:
                    # ADK Event.content 可能是 Content 对象或其他格式
                    if hasattr(event.content, "parts"):
                        for part in event.content.parts:
                            if hasattr(part, "text") and part.text:
                                user_messages.append(part.text)
                    elif isinstance(event.content, str):
                        user_messages.append(event.content)

        if not user_messages:
            return

        # 合并为单条记忆
        combined_content = "\n".join(user_messages)

        # 生成向量 (如果有 embedding 函数)
        embedding = None
        if self._embedding_fn:
            embedding = await self._embedding_fn(combined_content)

        await self.db.memories.insert(
            thread_id=uuid.UUID(session.id) if session.id else None,
            user_id=session.user_id,
            app_name=session.app_name,
            memory_type="episodic",
            content=combined_content,
            embedding=embedding,
            metadata={"source": "session", "event_count": len(session.events)},
        )

    async def search_memory(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
    ) -> SearchMemoryResponse:
        """基于 Query 检索相关记忆"""
        # 生成查询向量
        query_embedding = None
        if self._embedding_fn:
            query_embedding = await self._embedding_fn(query)

        if query_embedding:
            rows = await self.db.memories.search_vector(user_id, app_name, query_embedding)
        else:
            rows = await self.db.memories.search_fulltext(user_id, app_name, query)

        memories = []
        for row in rows:
            try:
                # 构造符合 MemoryEntry要求的 content 字典
                content_val = row["content"]
                if isinstance(content_val, str):
                    content_val = {"parts": [{"text": content_val}]}

                memories.append(
                    MemoryEntry(
                        id=str(row["id"]),
                        content=content_val,
                        author="system",
                        timestamp=row["created_at"].isoformat(),
                        relevance_score=row.get("relevance_score", row.get("retention_score")),
                        custom_metadata=json.loads(row["metadata"]) if row["metadata"] else {},
                    )
                )
            except Exception as e:
                print(f"MemoryEntry Validation Error: {e}")
                if hasattr(e, "errors"):
                    print(f"Details: {e.errors()}")
                raise e

        return SearchMemoryResponse(memories=memories)

    async def list_memories(self, *, app_name: str, user_id: str, limit: int = 100) -> list[MemoryEntry]:
        """列出用户所有记忆 (扩展方法，非 ADK 基类要求)"""
        rows = await self.db.memories.list_recent(user_id, app_name, limit)

        # 复用相同的转换逻辑
        memories = []
        for row in rows:
            content_val = row["content"]
            if isinstance(content_val, str):
                content_val = {"parts": [{"text": content_val}]}

            memories.append(
                MemoryEntry(
                    id=str(row["id"]),
                    content=content_val,
                    author="system",
                    timestamp=row["created_at"].isoformat(),
                    relevance_score=row["retention_score"],
                    custom_metadata=json.loads(row["metadata"]) if row["metadata"] else {},
                )
            )
        return memories
