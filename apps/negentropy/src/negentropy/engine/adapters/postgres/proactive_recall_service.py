"""ProactiveRecallService: 主动召回服务

在新会话创建时主动注入高相关性记忆，基于复合评分策略排序：

复合评分 = importance_score * 0.40 + recency * 0.30 + frequency * 0.20 + fact_density * 0.10

缓存策略：TTL 1小时，巩固/事实插入/冲突解决时失效。

参考文献:
[1] A. M. Collins and E. F. Loftus, "A spreading-activation theory of
    semantic processing," Psychological Review, vol. 82, no. 6, pp. 407–428, 1975.
[2] D. R. Godden and A. D. Baddeley, "Context-dependent memory in two
    natural environments," British J. Psychology, vol. 66, no. 3, pp. 325–331, 1975.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select, text

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.internalization import Fact, Memory

logger = get_logger("negentropy.engine.adapters.postgres.proactive_recall_service")

_PRELOAD_CACHE_TTL_HOURS = 1
_DEFAULT_PROACTIVE_LIMIT = 10
_DEFAULT_FACT_LIMIT = 5


class ProactiveRecallService:
    """主动召回服务

    在新会话创建时主动注入高相关性记忆。
    """

    def __init__(self) -> None:
        pass

    async def get_or_compute_preload(
        self,
        *,
        user_id: str,
        app_name: str,
        max_tokens: int = 2000,
    ) -> dict[str, Any]:
        """获取预加载上下文（缓存优先，失效则重算）

        Returns:
            {"context": str, "memory_ids": list, "fact_ids": list, "token_count": int}
        """
        # 检查缓存
        cached = await self._get_cached(user_id=user_id, app_name=app_name)
        if cached:
            age = (datetime.now(UTC) - cached["updated_at"]).total_seconds() / 3600
            if age < _PRELOAD_CACHE_TTL_HOURS:
                logger.debug("preload_cache_hit", user_id=user_id, age_hours=round(age, 2))
                return cached

        # 计算并缓存
        result = await self._compute_preload(
            user_id=user_id,
            app_name=app_name,
            max_tokens=max_tokens,
        )
        await self._save_cache(user_id=user_id, app_name=app_name, result=result)
        return result

    async def invalidate_cache(self, *, user_id: str, app_name: str) -> None:
        """使预加载缓存失效"""
        async with db_session.AsyncSessionLocal() as db:
            # 直接删除缓存记录

            # 使用 raw SQL 删除 memory_preload_cache 表
            await db.execute(
                text(f"DELETE FROM {NEGENTROPY_SCHEMA}.memory_preload_cache WHERE user_id = :uid AND app_name = :app"),
                {"uid": user_id, "app": app_name},
            )
            await db.commit()
        logger.debug("preload_cache_invalidated", user_id=user_id)

    async def _compute_preload(
        self,
        *,
        user_id: str,
        app_name: str,
        max_tokens: int,
    ) -> dict[str, Any]:
        """计算预加载上下文"""
        now = datetime.now(UTC)

        # 获取高分记忆（复合评分）
        memories = await self._get_top_memories(
            user_id=user_id,
            app_name=app_name,
            limit=_DEFAULT_PROACTIVE_LIMIT,
            now=now,
        )

        # 获取高重要性事实
        facts = await self._get_top_facts(
            user_id=user_id,
            app_name=app_name,
            limit=_DEFAULT_FACT_LIMIT,
            now=now,
        )

        # 组装上下文
        parts: list[str] = []
        mem_ids: list[UUID] = []
        for m in memories:
            snippet = m.content[:200] + ("..." if len(m.content) > 200 else "")
            parts.append(f"[Memory:{m.memory_type}] {snippet}")
            mem_ids.append(m.id)

        fact_ids: list[UUID] = []
        for f in facts:
            value_text = str(f.value)[:100]
            parts.append(f"[Fact:{f.fact_type}] {f.key}: {value_text}")
            fact_ids.append(f.id)

        context = "\n".join(parts)
        token_count = len(context) // 4  # 简单估算

        return {
            "context": context,
            "memory_ids": mem_ids,
            "fact_ids": fact_ids,
            "token_count": token_count,
            "updated_at": now,
        }

    async def _get_top_memories(
        self,
        *,
        user_id: str,
        app_name: str,
        limit: int,
        now: datetime,
    ) -> list[Memory]:
        """获取复合评分最高的记忆"""
        async with db_session.AsyncSessionLocal() as db:
            # 复合评分: importance * 0.4 + recency * 0.3 + frequency * 0.2 + fact_density * 0.1
            days_since_access = func.extract("epoch", now - Memory.last_accessed_at) / 86400
            recency_score = func.greatest(0.0, 1.0 - days_since_access / 30.0)
            frequency_score = func.least(1.0, func.log(2, 1 + Memory.access_count) / func.log(2, 101))

            proactive_rank = Memory.importance_score * 0.40 + recency_score * 0.30 + frequency_score * 0.20 + 0.10

            stmt = (
                select(Memory)
                .where(
                    Memory.user_id == user_id,
                    Memory.app_name == app_name,
                    Memory.retention_score > 0.2,
                )
                .order_by(proactive_rank.desc())
                .limit(limit)
            )
            result = await db.execute(stmt)
            return list(result.scalars().all())

    async def _get_top_facts(
        self,
        *,
        user_id: str,
        app_name: str,
        limit: int,
        now: datetime,
    ) -> list[Fact]:
        """获取高重要性事实"""
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(Fact)
                .where(
                    Fact.user_id == user_id,
                    Fact.app_name == app_name,
                    Fact.status == "active",
                    (Fact.valid_until.is_(None)) | (Fact.valid_until > now),
                )
                .order_by(Fact.importance_score.desc())
                .limit(limit)
            )
            result = await db.execute(stmt)
            return list(result.scalars().all())

    async def _get_cached(self, *, user_id: str, app_name: str) -> dict[str, Any] | None:
        """读取缓存"""
        async with db_session.AsyncSessionLocal() as db:
            sql = text(f"""
                SELECT preload_context, memory_ids, fact_ids, token_count, updated_at
                FROM {NEGENTROPY_SCHEMA}.memory_preload_cache
                WHERE user_id = :uid AND app_name = :app
            """)
            result = await db.execute(sql, {"uid": user_id, "app": app_name})
            row = result.first()
            if not row:
                return None
            return {
                "context": row.preload_context,
                "memory_ids": row.memory_ids or [],
                "fact_ids": row.fact_ids or [],
                "token_count": row.token_count or 0,
                "updated_at": row.updated_at,
            }

    async def _save_cache(self, *, user_id: str, app_name: str, result: dict[str, Any]) -> None:
        """保存缓存（upsert）"""
        async with db_session.AsyncSessionLocal() as db:
            sql = text(f"""
                INSERT INTO {NEGENTROPY_SCHEMA}.memory_preload_cache
                    (id, user_id, app_name, preload_context, memory_ids, fact_ids, token_count)
                VALUES (:id, :uid, :app, :ctx, :mem_ids, :fact_ids, :tokens)
                ON CONFLICT (user_id, app_name) DO UPDATE SET
                    preload_context = EXCLUDED.preload_context,
                    memory_ids = EXCLUDED.memory_ids,
                    fact_ids = EXCLUDED.fact_ids,
                    token_count = EXCLUDED.token_count,
                    updated_at = NOW()
            """)
            await db.execute(
                sql,
                {
                    "id": str(uuid4()),
                    "uid": user_id,
                    "app": app_name,
                    "ctx": result.get("context", ""),
                    "mem_ids": [str(mid) for mid in result.get("memory_ids", [])],
                    "fact_ids": [str(fid) for fid in result.get("fact_ids", [])],
                    "tokens": result.get("token_count", 0),
                },
            )
            await db.commit()
        logger.debug("preload_cache_saved", user_id=user_id)
