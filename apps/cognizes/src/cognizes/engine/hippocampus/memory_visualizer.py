"""
Hippocampus MemoryVisualizer: 记忆系统可视化接口

职责:
1. 提供记忆巩固状态可视化
2. 实现记忆召回来源标注
3. 展示记忆健康度仪表盘数据
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional
from datetime import datetime, timedelta
from enum import Enum


class MemoryEventType(str, Enum):
    """记忆相关 AG-UI 事件类型"""

    CONSOLIDATION_PROGRESS = "memory_consolidation_progress"
    MEMORY_HIT = "memory_hit"
    DECAY_UPDATE = "memory_decay_update"
    CONTEXT_BUDGET = "memory_context_budget"


@dataclass
class ConsolidationProgress:
    """记忆巩固进度"""

    job_id: str
    status: str  # pending, running, completed, failed
    total_events: int
    processed_events: int
    extracted_facts: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    @property
    def progress_percent(self) -> float:
        if self.total_events == 0:
            return 0.0
        return (self.processed_events / self.total_events) * 100


@dataclass
class MemoryHit:
    """记忆召回命中"""

    memory_id: str
    memory_type: str  # episodic, semantic, procedural
    content_preview: str
    relevance_score: float
    source_session_id: Optional[str] = None
    created_at: Optional[datetime] = None
    retention_score: float = 1.0


@dataclass
class MemoryHealthMetrics:
    """记忆健康度指标"""

    total_memories: int
    episodic_count: int
    semantic_count: int
    procedural_count: int
    avg_retention_score: float
    low_retention_count: int  # retention_score < 0.3
    decay_rate_7d: float  # 7 天内衰减率
    top_accessed_memories: list[str]


class MemoryVisualizer:
    """记忆系统可视化器"""

    def __init__(self, pool, event_emitter=None):
        """
        Args:
            pool: asyncpg 连接池
            event_emitter: AG-UI 事件发射器 (可选)
        """
        self._pool = pool
        self._event_emitter = event_emitter

    async def emit_consolidation_progress(self, run_id: str, job_id: str) -> ConsolidationProgress:
        """
        发射记忆巩固进度事件

        Args:
            run_id: 当前运行 ID
            job_id: 巩固任务 ID

        Returns:
            巩固进度信息
        """
        async with self._pool.acquire() as conn:
            job = await conn.fetchrow(
                """
                SELECT
                    id, status,
                    (input_data->>'total_events')::int as total_events,
                    (input_data->>'processed_events')::int as processed_events,
                    (output_data->>'extracted_facts')::int as extracted_facts,
                    started_at, completed_at
                FROM consolidation_jobs
                WHERE id = $1
            """,
                job_id,
            )

            if not job:
                return None

            progress = ConsolidationProgress(
                job_id=str(job["id"]),
                status=job["status"],
                total_events=job["total_events"] or 0,
                processed_events=job["processed_events"] or 0,
                extracted_facts=job["extracted_facts"] or 0,
                start_time=job["started_at"],
                end_time=job["completed_at"],
            )

            # 发射 AG-UI 事件
            if self._event_emitter:
                await self._event_emitter.emit_activity_snapshot(
                    run_id=run_id,
                    activity_type="memory_consolidation",
                    data={
                        "jobId": progress.job_id,
                        "status": progress.status,
                        "progressPercent": progress.progress_percent,
                        "extractedFacts": progress.extracted_facts,
                    },
                )

            return progress

    async def emit_memory_hits(self, run_id: str, query: str, hits: list[dict]) -> list[MemoryHit]:
        """
        发射记忆召回命中事件

        用于在 Agent 响应中标注记忆来源

        Args:
            run_id: 当前运行 ID
            query: 搜索查询
            hits: 召回结果列表

        Returns:
            记忆命中列表
        """
        memory_hits = []

        for hit in hits:
            memory_hit = MemoryHit(
                memory_id=hit["id"],
                memory_type=hit.get("memory_type", "episodic"),
                content_preview=hit.get("content", "")[:200],
                relevance_score=hit.get("score", 0.0),
                source_session_id=hit.get("session_id"),
                created_at=hit.get("created_at"),
                retention_score=hit.get("retention_score", 1.0),
            )
            memory_hits.append(memory_hit)

        # 发射 AG-UI CUSTOM 事件
        if self._event_emitter:
            await self._event_emitter.emit_custom(
                run_id=run_id,
                event_name=MemoryEventType.MEMORY_HIT.value,
                data={
                    "query": query,
                    "hits": [
                        {
                            "memoryId": h.memory_id,
                            "memoryType": h.memory_type,
                            "preview": h.content_preview,
                            "score": h.relevance_score,
                            "retentionScore": h.retention_score,
                        }
                        for h in memory_hits
                    ],
                },
            )

        return memory_hits

    async def get_health_metrics(self, user_id: str, app_name: str) -> MemoryHealthMetrics:
        """
        获取记忆健康度指标

        用于渲染记忆健康度仪表盘

        Args:
            user_id: 用户 ID
            app_name: 应用名称

        Returns:
            记忆健康度指标
        """
        async with self._pool.acquire() as conn:
            # 基础统计
            stats = await conn.fetchrow(
                """
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE memory_type = 'episodic') as episodic,
                    COUNT(*) FILTER (WHERE memory_type = 'semantic') as semantic,
                    COUNT(*) FILTER (WHERE memory_type = 'procedural') as procedural,
                    AVG(retention_score) as avg_retention,
                    COUNT(*) FILTER (WHERE retention_score < 0.3) as low_retention
                FROM memories
                WHERE user_id = $1 AND app_name = $2
            """,
                user_id,
                app_name,
            )

            # 7 天衰减率
            decay_stats = await conn.fetchrow(
                """
                WITH old_scores AS (
                    SELECT AVG(retention_score) as avg_score
                    FROM memories
                    WHERE user_id = $1 AND app_name = $2
                      AND created_at < NOW() - INTERVAL '7 days'
                ),
                new_scores AS (
                    SELECT AVG(retention_score) as avg_score
                    FROM memories
                    WHERE user_id = $1 AND app_name = $2
                )
                SELECT
                    COALESCE(
                        (old_scores.avg_score - new_scores.avg_score) /
                        NULLIF(old_scores.avg_score, 0) * 100,
                        0
                    ) as decay_rate
                FROM old_scores, new_scores
            """,
                user_id,
                app_name,
            )

            # 最常访问的记忆
            top_accessed = await conn.fetch(
                """
                SELECT id
                FROM memories
                WHERE user_id = $1 AND app_name = $2
                ORDER BY access_count DESC, retention_score DESC
                LIMIT 5
            """,
                user_id,
                app_name,
            )

            return MemoryHealthMetrics(
                total_memories=stats["total"] or 0,
                episodic_count=stats["episodic"] or 0,
                semantic_count=stats["semantic"] or 0,
                procedural_count=stats["procedural"] or 0,
                avg_retention_score=float(stats["avg_retention"] or 0),
                low_retention_count=stats["low_retention"] or 0,
                decay_rate_7d=float(decay_stats["decay_rate"] or 0),
                top_accessed_memories=[str(r["id"]) for r in top_accessed],
            )

    async def emit_context_budget_status(self, run_id: str, budget_info: dict) -> None:
        """
        发射上下文预算状态事件

        Args:
            run_id: 当前运行 ID
            budget_info: 预算信息
        """
        if self._event_emitter:
            await self._event_emitter.emit_state_delta(
                run_id=run_id,
                delta=[
                    {
                        "op": "replace",
                        "path": "/contextBudget",
                        "value": {
                            "totalTokens": budget_info.get("total_tokens", 0),
                            "usedTokens": budget_info.get("used_tokens", 0),
                            "memoriesIncluded": budget_info.get("memories_count", 0),
                            "memoryTokens": budget_info.get("memory_tokens", 0),
                        },
                    }
                ],
            )
