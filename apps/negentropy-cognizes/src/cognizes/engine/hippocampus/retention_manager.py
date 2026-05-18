"""
MemoryRetentionManager: 记忆保持管理器

实现艾宾浩斯遗忘曲线算法，自动管理记忆的保持与清理：
- 计算记忆保留分数
- 定期清理低价值记忆
- 记录访问历史，提升高频记忆的保留分数
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import asyncpg


@dataclass
class MemoryStats:
    """记忆统计信息"""

    total_memories: int
    high_value_count: int  # retention_score >= 0.7
    medium_value_count: int  # 0.3 <= retention_score < 0.7
    low_value_count: int  # retention_score < 0.3
    avg_retention_score: float
    cleaned_count: int


class MemoryRetentionManager:
    """
    记忆保持管理器

    职责:
    1. 计算和更新记忆的保留分数
    2. 清理低价值记忆
    3. 记录访问，提升高频记忆的权重
    """

    def __init__(
        self,
        pool: asyncpg.Pool,
        decay_rate: float = 0.1,
        cleanup_threshold: float = 0.1,
        min_age_days: int = 7,
    ):
        """
        Args:
            pool: 数据库连接池
            decay_rate: 衰减系数 λ (默认 0.1)
            cleanup_threshold: 清理阈值 (默认 0.1)
            min_age_days: 最小保留天数 (默认 7 天)
        """
        self.pool = pool
        self.decay_rate = decay_rate
        self.cleanup_threshold = cleanup_threshold
        self.min_age_days = min_age_days

    # ========================================
    # 访问记录
    # ========================================

    async def record_access(self, memory_id: str) -> None:
        """
        记录记忆被访问，增加 access_count 并更新 last_accessed_at

        Args:
            memory_id: 记忆 ID
        """
        query = """
            UPDATE memories
            SET access_count = access_count + 1,
                last_accessed_at = NOW(),
                retention_score = calculate_retention_score(access_count + 1, NOW(), $2)
            WHERE id = $1
        """
        async with self.pool.acquire() as conn:
            await conn.execute(query, uuid.UUID(memory_id), self.decay_rate)

    async def record_batch_access(self, memory_ids: list[str]) -> None:
        """批量记录访问"""
        query = """
            UPDATE memories
            SET access_count = access_count + 1,
                last_accessed_at = NOW(),
                retention_score = calculate_retention_score(access_count + 1, NOW(), $2)
            WHERE id = ANY($1::uuid[])
        """
        async with self.pool.acquire() as conn:
            uuid_list = [uuid.UUID(mid) for mid in memory_ids]
            await conn.execute(query, uuid_list, self.decay_rate)

    # ========================================
    # 保留分数计算
    # ========================================

    async def update_all_retention_scores(self) -> int:
        """
        更新所有记忆的保留分数

        Returns:
            更新的记忆数量
        """
        query = """
            UPDATE memories
            SET retention_score = calculate_retention_score(access_count, last_accessed_at, $1)
        """
        async with self.pool.acquire() as conn:
            result = await conn.execute(query, self.decay_rate)
            # 解析 UPDATE 返回的行数
            return int(result.split()[-1])

    async def get_retention_distribution(
        self,
        user_id: str | None = None,
        app_name: str | None = None,
    ) -> dict[str, int]:
        """
        获取记忆保留分数分布

        Returns:
            {"high": count, "medium": count, "low": count}
        """
        conditions = ["1=1"]
        params = []
        param_idx = 1

        if user_id:
            conditions.append(f"user_id = ${param_idx}")
            params.append(user_id)
            param_idx += 1

        if app_name:
            conditions.append(f"app_name = ${param_idx}")
            params.append(app_name)
            param_idx += 1

        where_clause = " AND ".join(conditions)

        query = f"""
            SELECT
                COUNT(*) FILTER (WHERE retention_score >= 0.7) AS high,
                COUNT(*) FILTER (WHERE retention_score >= 0.3 AND retention_score < 0.7) AS medium,
                COUNT(*) FILTER (WHERE retention_score < 0.3) AS low
            FROM memories
            WHERE {where_clause}
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            return {
                "high": row["high"],
                "medium": row["medium"],
                "low": row["low"],
            }

    # ========================================
    # 记忆清理
    # ========================================

    async def cleanup_low_value_memories(
        self,
        threshold: float | None = None,
        min_age_days: int | None = None,
        dry_run: bool = False,
    ) -> MemoryStats:
        """
        清理低价值记忆

        Args:
            threshold: 保留分数阈值 (低于此分数的记忆将被清理)
            min_age_days: 最小保留天数 (创建时间早于此天数的记忆才会被清理)
            dry_run: 如果为 True，只返回统计信息，不实际删除

        Returns:
            MemoryStats: 清理统计信息
        """
        threshold = threshold or self.cleanup_threshold
        min_age_days = min_age_days or self.min_age_days

        # 先更新所有分数
        await self.update_all_retention_scores()

        # 获取清理前统计
        distribution = await self.get_retention_distribution()

        if dry_run:
            # 只统计将被清理的数量
            query = """
                SELECT COUNT(*) FROM memories
                WHERE retention_score < $1
                  AND created_at < NOW() - INTERVAL '1 day' * $2
            """
            async with self.pool.acquire() as conn:
                count = await conn.fetchval(query, threshold, min_age_days)

            return MemoryStats(
                total_memories=sum(distribution.values()),
                high_value_count=distribution["high"],
                medium_value_count=distribution["medium"],
                low_value_count=distribution["low"],
                avg_retention_score=0,  # 需要额外计算
                cleaned_count=count,
            )

        # 实际清理
        query = """
            DELETE FROM memories
            WHERE retention_score < $1
              AND created_at < NOW() - INTERVAL '1 day' * $2
        """
        async with self.pool.acquire() as conn:
            result = await conn.execute(query, threshold, min_age_days)
            cleaned_count = int(result.split()[-1])

        # 获取清理后统计
        distribution_after = await self.get_retention_distribution()

        # 计算平均保留分数
        avg_query = "SELECT AVG(retention_score) FROM memories"
        async with self.pool.acquire() as conn:
            avg_score = await conn.fetchval(avg_query) or 0

        return MemoryStats(
            total_memories=sum(distribution_after.values()),
            high_value_count=distribution_after["high"],
            medium_value_count=distribution_after["medium"],
            low_value_count=distribution_after["low"],
            avg_retention_score=float(avg_score),
            cleaned_count=cleaned_count,
        )

    # ========================================
    # 情景分块检索
    # ========================================

    async def get_episodic_memories_by_time_slice(
        self,
        user_id: str,
        app_name: str,
        start_time: datetime,
        end_time: datetime,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        按时间切片检索情景记忆

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            start_time: 开始时间
            end_time: 结束时间
            limit: 最大返回数量

        Returns:
            记忆列表
        """
        query = """
            SELECT id, content, memory_type, metadata, retention_score, created_at
            FROM memories
            WHERE user_id = $1
              AND app_name = $2
              AND created_at >= $3
              AND created_at <= $4
            ORDER BY created_at DESC
            LIMIT $5
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, user_id, app_name, start_time, end_time, limit)
            return [dict(row) for row in rows]


# ========================================
# 定时清理任务
# ========================================


async def scheduled_cleanup_task(
    pool: asyncpg.Pool,
    interval_hours: int = 24,
    decay_rate: float = 0.1,
    cleanup_threshold: float = 0.1,
    min_age_days: int = 7,
) -> None:
    """
    后台定时清理任务

    Args:
        pool: 数据库连接池
        interval_hours: 清理间隔 (小时)
    """
    manager = MemoryRetentionManager(
        pool=pool,
        decay_rate=decay_rate,
        cleanup_threshold=cleanup_threshold,
        min_age_days=min_age_days,
    )

    while True:
        try:
            stats = await manager.cleanup_low_value_memories()
            print(
                f"Memory cleanup completed: "
                f"cleaned={stats.cleaned_count}, "
                f"remaining={stats.total_memories}, "
                f"avg_score={stats.avg_retention_score:.2f}"
            )
        except Exception as e:
            print(f"Memory cleanup failed: {e}")

        await asyncio.sleep(interval_hours * 3600)
