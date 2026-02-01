"""
PostgresMemoryService: ADK MemoryService 的 PostgreSQL 实现

继承 Google ADK BaseMemoryService，复用 Phase 2 Hippocampus 的记忆巩固能力，实现：
- Session 到 Memory 的转化 (add_session_to_memory)
- 语义检索 (search_memory)

重构说明：
    本版本从 raw SQL 迁移到 SQLAlchemy ORM，复用：
    - `db/session.py` 中的 `AsyncSessionLocal`
    - `models/hippocampus.py` 中的 `Memory`
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session as ORMSession

# ADK 官方类型
from google.adk.sessions import Session as ADKSession
from google.adk.memory.base_memory_service import (
    BaseMemoryService,
    SearchMemoryResponse,
    MemoryEntry,
)

# ORM 模型与会话工厂
from negentropy.db.session import AsyncSessionLocal
from negentropy.models.hippocampus import Memory


class PostgresMemoryService(BaseMemoryService):
    """
    PostgreSQL 实现的 MemoryService

    继承 ADK BaseMemoryService，可直接与 ADK Runner 集成。

    核心职责：
    1. 将 Session 对话转化为可搜索的记忆 (复用 Phase 2 consolidate)
    2. 基于语义相似度检索相关记忆 (复用 Phase 3 hybrid_search)
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

        async with AsyncSessionLocal() as db:
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
        """基于 Query 检索相关记忆"""
        # 生成查询向量
        query_embedding = None
        if self._embedding_fn:
            query_embedding = await self._embedding_fn(query)

        async with AsyncSessionLocal() as db:
            # 构造基础查询
            stmt = select(Memory).where(
                Memory.app_name == app_name,
                Memory.user_id == user_id,
            )

            if query_embedding:
                # 向量相似度排序: <=> 是余弦距离 (Distance)，越大越不相关
                # 相关度分值我们可以简单用 (1 - 距离) 来模拟
                distance = Memory.embedding.op("<=>")(query_embedding)
                stmt = stmt.order_by(distance.asc()).limit(10)

                # 在 ORM 中获取结果和计算出的距离需要稍微复杂的处理
                # 这里我们先直接获取对象，如果需要显示分数再调整
                result = await db.execute(stmt)
                memories_orms = result.scalars().all()
            else:
                # 简单全文搜索回退 (ilike)
                stmt = stmt.where(Memory.content.ilike(f"%{query}%")).order_by(Memory.created_at.desc()).limit(10)
                result = await db.execute(stmt)
                memories_orms = result.scalars().all()

        memories = []
        for m in memories_orms:
            # 构造符合 MemoryEntry 要求的 content 格式
            content_val = {"parts": [{"text": m.content}]}

            memories.append(
                MemoryEntry(
                    id=str(m.id),
                    content=content_val,
                    author="system",
                    timestamp=m.created_at.isoformat() if m.created_at else datetime.now().isoformat(),
                    relevance_score=m.retention_score,
                    custom_metadata=m.metadata_ or {},
                )
            )

        return SearchMemoryResponse(memories=memories)

    async def list_memories(self, *, app_name: str, user_id: str, limit: int = 100) -> list[MemoryEntry]:
        """列出用户所有记忆"""
        async with AsyncSessionLocal() as db:
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
                    timestamp=m.created_at.isoformat() if m.created_at else datetime.now().isoformat(),
                    relevance_score=m.retention_score,
                    custom_metadata=m.metadata_ or {},
                )
            )
        return memories
