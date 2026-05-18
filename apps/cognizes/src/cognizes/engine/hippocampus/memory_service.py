"""
OpenMemoryService: ADK MemoryService 适配器

实现对标 Google ADK MemoryService 的接口契约，
使用 PostgreSQL + PGVector 作为后端存储。
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import asyncpg

from .consolidation_worker import MemoryConsolidationWorker, JobType
from .retention_manager import MemoryRetentionManager
from .context_assembler import ContextAssembler, ContextWindow


@dataclass
class SearchMemoryResult:
    """记忆检索结果"""

    memory_id: str
    content: str
    memory_type: str
    relevance_score: float
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class SearchMemoryResponse:
    """检索响应"""

    memories: list[SearchMemoryResult]
    total_count: int
    query: str


class OpenMemoryService:
    """
    OpenMemoryService: 对标 ADK MemoryService

    核心能力:
    1. add_session_to_memory(): 将 Session 转化为可检索的记忆
    2. search_memory(): 基于 Query 检索相关记忆
    3. list_memories(): 列出用户的所有记忆
    """

    def __init__(
        self,
        pool: asyncpg.Pool,
        embedding_model: str = "text-embedding-004",
        max_search_results: int = 10,
    ):
        self.pool = pool
        self.embedding_model = embedding_model
        self.max_search_results = max_search_results

        # 内部组件
        self._consolidation_worker = MemoryConsolidationWorker(pool)
        self._retention_manager = MemoryRetentionManager(pool)
        self._context_assembler = ContextAssembler(pool)

    # ========================================
    # 核心接口: add_session_to_memory
    # ========================================

    async def add_session_to_memory(
        self,
        session_id: str,
        consolidation_type: str = "full",
    ) -> dict[str, Any]:
        """
        将 Session 中的对话转化为可搜索的记忆

        Args:
            session_id: 会话 ID (对应 threads.id)
            consolidation_type: 巩固类型
                - "fast": 仅快速摘要
                - "deep": 仅深度提取
                - "full": 完整巩固

        Returns:
            巩固结果 (生成的记忆 ID 列表)
        """
        job_type = {
            "fast": JobType.FAST_REPLAY,
            "deep": JobType.DEEP_REFLECTION,
            "full": JobType.FULL_CONSOLIDATION,
        }.get(consolidation_type, JobType.FULL_CONSOLIDATION)

        job = await self._consolidation_worker.consolidate(
            thread_id=session_id,
            job_type=job_type,
        )

        return {
            "job_id": job.id,
            "status": job.status.value,
            "result": job.result,
        }

    # ========================================
    # 核心接口: search_memory
    # ========================================

    async def search_memory(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
        limit: int | None = None,
        memory_type: str | None = None,
        min_relevance: float = 0.0,
    ) -> SearchMemoryResponse:
        """
        基于 Query 检索相关记忆

        Args:
            app_name: 应用名称
            user_id: 用户 ID
            query: 查询文本
            limit: 最大返回数量
            memory_type: 过滤记忆类型 ('episodic', 'semantic', 'summary')
            min_relevance: 最小相关度阈值

        Returns:
            SearchMemoryResponse: 检索结果
        """
        import google.generativeai as genai

        limit = limit or self.max_search_results

        # 生成查询向量
        embedding_result = genai.embed_content(
            model=f"models/{self.embedding_model}",
            content=query,
            task_type="retrieval_query",
        )
        query_embedding = embedding_result["embedding"]

        # 构建查询
        conditions = ["user_id = $1", "app_name = $2", "embedding IS NOT NULL"]
        params = [user_id, app_name]
        param_idx = 3

        if memory_type:
            conditions.append(f"memory_type = ${param_idx}")
            params.append(memory_type)
            param_idx += 1

        where_clause = " AND ".join(conditions)

        sql = f"""
            SELECT
                id, content, memory_type, metadata, retention_score,
                1 - (embedding <=> ${param_idx}::vector) AS relevance
            FROM memories
            WHERE {where_clause}
              AND (1 - (embedding <=> ${param_idx}::vector)) >= ${param_idx + 1}
            ORDER BY relevance * retention_score DESC
            LIMIT ${param_idx + 2}
        """
        params.extend([query_embedding, min_relevance, limit])

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)

        # 记录访问
        memory_ids = [str(row["id"]) for row in rows]
        if memory_ids:
            await self._retention_manager.record_batch_access(memory_ids)

        # 构建响应
        memories = [
            SearchMemoryResult(
                memory_id=str(row["id"]),
                content=row["content"],
                memory_type=row["memory_type"],
                relevance_score=float(row["relevance"]),
                metadata=(
                    row["metadata"]
                    if isinstance(row["metadata"], dict)
                    else (json.loads(row["metadata"]) if isinstance(row["metadata"], str) else {})
                ),
            )
            for row in rows
        ]

        return SearchMemoryResponse(
            memories=memories,
            total_count=len(memories),
            query=query,
        )

    # ========================================
    # 辅助接口: list_memories
    # ========================================

    async def list_memories(
        self,
        *,
        app_name: str,
        user_id: str,
        memory_type: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """
        列出用户的所有记忆

        Args:
            app_name: 应用名称
            user_id: 用户 ID
            memory_type: 过滤记忆类型
            limit: 最大返回数量
            offset: 分页偏移

        Returns:
            记忆列表
        """
        conditions = ["user_id = $1", "app_name = $2"]
        params = [user_id, app_name]
        param_idx = 3

        if memory_type:
            conditions.append(f"memory_type = ${param_idx}")
            params.append(memory_type)
            param_idx += 1

        where_clause = " AND ".join(conditions)

        sql = f"""
            SELECT id, content, memory_type, metadata, retention_score, created_at
            FROM memories
            WHERE {where_clause}
            ORDER BY retention_score DESC, created_at DESC
            LIMIT ${param_idx}
            OFFSET ${param_idx + 1}
        """
        params.extend([limit, offset])

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)

        return [dict(row) for row in rows]

    # ========================================
    # 辅助接口: get_context_window
    # ========================================

    async def get_context_window(
        self,
        *,
        app_name: str,
        user_id: str,
        thread_id: str,
        query: str,
        system_prompt: str | None = None,
        max_tokens: int = 8000,
    ) -> ContextWindow:
        """
        获取组装好的上下文窗口

        Args:
            app_name: 应用名称
            user_id: 用户 ID
            thread_id: 当前会话 ID
            query: 用户查询
            system_prompt: 系统提示词
            max_tokens: 最大 Token 预算

        Returns:
            ContextWindow: 组装后的上下文
        """
        import google.generativeai as genai

        # 生成查询向量
        embedding_result = genai.embed_content(
            model=f"models/{self.embedding_model}",
            content=query,
            task_type="retrieval_query",
        )
        query_embedding = embedding_result["embedding"]

        # 重新配置 Token 预算
        self._context_assembler.max_tokens = max_tokens

        return await self._context_assembler.assemble(
            user_id=user_id,
            app_name=app_name,
            thread_id=thread_id,
            query=query,
            query_embedding=query_embedding,
            system_prompt=system_prompt,
        )

    # ========================================
    # 维护接口
    # ========================================

    async def cleanup_memories(
        self,
        threshold: float = 0.1,
        min_age_days: int = 7,
    ) -> dict[str, Any]:
        """
        清理低价值记忆

        Returns:
            清理统计信息
        """
        stats = await self._retention_manager.cleanup_low_value_memories(
            threshold=threshold,
            min_age_days=min_age_days,
        )
        return {
            "total_memories": stats.total_memories,
            "cleaned_count": stats.cleaned_count,
            "avg_retention_score": stats.avg_retention_score,
        }
