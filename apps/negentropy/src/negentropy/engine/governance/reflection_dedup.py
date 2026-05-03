"""ReflectionDedup — Phase 5 F2 反思去重判定

防止同一查询/查询簇被反复反思造成 LLM 成本失控与记忆库膨胀。

去重策略（任一命中即跳过）：
1. ``query_hash`` 精确命中：``sha1(normalize(query))[:16]`` 在窗口期内已存在反思；
2. embedding 簇命中：同 user_id 在窗口期内有反思的 query embedding cosine ≥ 阈值；
3. 单用户单日生成上限触顶。

设计取舍：
- 复用 ``Memory.metadata`` JSONB，不引入专表；
- 依赖 pgvector cosine distance 函数 ``<=>``（已启用）；
- 命中时返回 reason 便于审计与排查。

参考文献：
[1] N. Shinn et al., "Reflexion," NeurIPS 2023 — 反思过载是 verbal RL 的关键风险点。
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import Memory

logger = get_logger("negentropy.engine.governance.reflection_dedup")

_QUERY_HASH_BYTES = 16  # sha1 截 16 字节 hex


@dataclass(frozen=True)
class DedupVerdict:
    """去重判定结果。"""

    skip: bool
    reason: str | None  # "hash_hit" | "cluster_hit" | "daily_limit" | None


def normalize_query(query: str) -> str:
    """规范化 query，便于哈希精确匹配（NFKC + 小写 + 折叠空白 + trim）。"""
    if not query:
        return ""
    nf = unicodedata.normalize("NFKC", query)
    nf = nf.lower()
    nf = re.sub(r"\s+", " ", nf).strip()
    return nf


def hash_query(query: str) -> str:
    """生成稳定的 query hash（sha1 前 16 字节 hex，32 字符）。"""
    norm = normalize_query(query)
    if not norm:
        return ""
    digest = hashlib.sha1(norm.encode("utf-8")).hexdigest()
    return digest[: _QUERY_HASH_BYTES * 2]


class ReflectionDedup:
    """反思去重判定器。"""

    def __init__(
        self,
        *,
        window_days: int = 7,
        cosine_threshold: float = 0.92,
        daily_limit: int = 10,
    ) -> None:
        self._window_days = window_days
        self._cosine_threshold = cosine_threshold
        self._daily_limit = daily_limit

    async def should_skip(
        self,
        *,
        user_id: str,
        app_name: str,
        query: str,
        query_embedding: list[float] | None = None,
    ) -> DedupVerdict:
        """判定是否应跳过本次反思生成。

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            query: 检索 query
            query_embedding: 可选的 query embedding（提供时启用簇判定）

        Returns:
            DedupVerdict(skip=bool, reason=str | None)
        """
        norm_hash = hash_query(query)
        if not norm_hash:
            return DedupVerdict(skip=True, reason="empty_query")

        # 1. 单用户单日上限
        today_count = await self._count_today_reflections(user_id=user_id, app_name=app_name)
        if today_count >= self._daily_limit:
            logger.debug(
                "reflection_dedup_daily_limit",
                user_id=user_id,
                count=today_count,
                limit=self._daily_limit,
            )
            return DedupVerdict(skip=True, reason="daily_limit")

        # 2. query_hash 精确命中
        hash_hit = await self._hash_hit(user_id=user_id, app_name=app_name, query_hash=norm_hash)
        if hash_hit:
            return DedupVerdict(skip=True, reason="hash_hit")

        # 3. embedding 簇命中（仅在提供 embedding 时启用）
        if query_embedding is not None:
            cluster_hit = await self._cluster_hit(user_id=user_id, app_name=app_name, query_embedding=query_embedding)
            if cluster_hit:
                return DedupVerdict(skip=True, reason="cluster_hit")

        return DedupVerdict(skip=False, reason=None)

    async def _hash_hit(self, *, user_id: str, app_name: str, query_hash: str) -> bool:
        cutoff = datetime.now(UTC) - timedelta(days=self._window_days)
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                sa.select(sa.literal(1))
                .select_from(Memory)
                .where(
                    Memory.user_id == user_id,
                    Memory.app_name == app_name,
                    Memory.metadata_["subtype"].astext == "reflection",
                    Memory.metadata_["query_hash"].astext == query_hash,
                    Memory.created_at >= cutoff,
                )
                .limit(1)
            )
            result = await db.execute(stmt)
            return result.scalar() is not None

    async def _cluster_hit(
        self,
        *,
        user_id: str,
        app_name: str,
        query_embedding: list[float],
    ) -> bool:
        """通过 pgvector cosine distance 判定簇内是否已有反思（距离阈值 = 1 - cosine_threshold）。"""
        cutoff = datetime.now(UTC) - timedelta(days=self._window_days)
        max_distance = max(0.0, 1.0 - self._cosine_threshold)
        embedding_str = "[" + ",".join(f"{x:.7g}" for x in query_embedding) + "]"
        sql = sa.text(
            """
            SELECT 1
            FROM negentropy.memories m
            WHERE m.user_id = :user_id
              AND m.app_name = :app_name
              AND m.metadata->>'subtype' = 'reflection'
              AND m.created_at >= :cutoff
              AND m.embedding IS NOT NULL
              AND (m.embedding <=> CAST(:embedding AS vector)) <= :max_distance
            LIMIT 1
            """
        )
        try:
            async with db_session.AsyncSessionLocal() as db:
                result = await db.execute(
                    sql,
                    {
                        "user_id": user_id,
                        "app_name": app_name,
                        "cutoff": cutoff,
                        "embedding": embedding_str,
                        "max_distance": max_distance,
                    },
                )
                return result.scalar() is not None
        except Exception as exc:
            logger.debug("reflection_cluster_hit_skipped", error=str(exc))
            return False

    async def _count_today_reflections(self, *, user_id: str, app_name: str) -> int:
        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                sa.select(sa.func.count())
                .select_from(Memory)
                .where(
                    Memory.user_id == user_id,
                    Memory.app_name == app_name,
                    Memory.metadata_["subtype"].astext == "reflection",
                    Memory.created_at >= today_start,
                )
            )
            result = await db.execute(stmt)
            return result.scalar_one() or 0


__all__ = ["DedupVerdict", "ReflectionDedup", "hash_query", "normalize_query"]
