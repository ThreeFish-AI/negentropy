"""ReflectionWorker — Phase 5 F2 反思生成 + 写入编排器

把 ``ReflectionGenerator`` 与 ``ReflectionDedup`` 串成一条端到端流水线：

```
log_id → 拉取 query/snippets → dedup 判定 → LLM/pattern 生成 → 写入 episodic memory
```

设计取舍：
- 写入复用 ``PostgresMemoryService.add_memory_typed``（保持初始 retention/importance + embedding 一致）；
- ``memory_type='episodic'``，``metadata.subtype='reflection'``，无 schema 变动；
- importance 在初始值上 +0.15 偏置（反思价值高于普通情景）；
- 内部抛错全部捕获，不影响主反馈写入。
"""

from __future__ import annotations

from uuid import UUID

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.engine.consolidation.reflection_generator import Reflection, ReflectionGenerator
from negentropy.engine.governance.reflection_dedup import (
    DedupVerdict,
    ReflectionDedup,
    hash_query,
)
from negentropy.logging import get_logger
from negentropy.models.internalization import Memory, MemoryRetrievalLog

logger = get_logger("negentropy.engine.consolidation.reflection_worker")

_REFLECTION_IMPORTANCE_BOOST = 0.15
_REFLECTION_TYPE = "episodic"


def _build_dedup_from_settings() -> ReflectionDedup:
    """按 ``settings.memory.reflection`` 构造 ReflectionDedup；缺省时回退到 dataclass 默认。

    将用户面向配置 ``dedup_window_days`` / ``dedup_cosine`` / ``daily_limit_per_user``
    透传到 ReflectionDedup。settings 加载失败时安静降级（旧默认行为）。
    """
    try:
        from negentropy.config import settings as global_settings

        cfg = global_settings.memory.reflection
        return ReflectionDedup(
            window_days=cfg.dedup_window_days,
            cosine_threshold=cfg.dedup_cosine,
            daily_limit=cfg.daily_limit_per_user,
        )
    except Exception as exc:
        logger.debug("reflection_dedup_settings_load_failed", error=str(exc))
        return ReflectionDedup()


class ReflectionWorker:
    """反思生成 + 落库编排。"""

    def __init__(
        self,
        *,
        generator: ReflectionGenerator | None = None,
        dedup: ReflectionDedup | None = None,
        memory_service: object | None = None,
    ) -> None:
        self._generator = generator or ReflectionGenerator()
        self._dedup = dedup or _build_dedup_from_settings()
        self._memory_service = memory_service  # PostgresMemoryService；None 时延迟解析

    async def process(
        self,
        *,
        log_id: UUID,
        outcome: str,
    ) -> dict[str, str | bool] | None:
        """处理单条 retrieval log，生成反思并落库。

        Returns:
            {"status": "skipped"|"written", "reason": str, "memory_id": str | None}；
            log 不存在或已被删除时返回 None。
        """
        record = await self._fetch_log(log_id)
        if record is None:
            logger.debug("reflection_worker_log_missing", log_id=str(log_id))
            return None

        user_id = record["user_id"]
        app_name = record["app_name"]
        query = record["query"]

        if not query:
            return {"status": "skipped", "reason": "empty_query", "memory_id": None}

        snippets = await self._fetch_snippets(record["retrieved_memory_ids"])
        query_embedding = await self._safe_embed(query)

        verdict: DedupVerdict = await self._dedup.should_skip(
            user_id=user_id,
            app_name=app_name,
            query=query,
            query_embedding=query_embedding,
        )
        if verdict.skip:
            logger.debug(
                "reflection_skipped",
                log_id=str(log_id),
                reason=verdict.reason,
                user_id=user_id,
            )
            return {"status": "skipped", "reason": verdict.reason or "unknown", "memory_id": None}

        reflection = await self._generator.generate(query=query, retrieved_snippets=snippets, outcome=outcome)
        if reflection is None:
            return {"status": "skipped", "reason": "generation_failed", "memory_id": None}

        try:
            memory_id = await self._write_reflection(
                user_id=user_id,
                app_name=app_name,
                thread_id=record["thread_id"],
                reflection=reflection,
                query=query,
                src_log_id=log_id,
                outcome=outcome,
            )
        except Exception as exc:
            logger.warning("reflection_write_failed", error=str(exc), log_id=str(log_id))
            return {"status": "skipped", "reason": "write_failed", "memory_id": None}

        logger.info(
            "reflection_written",
            log_id=str(log_id),
            memory_id=memory_id,
            user_id=user_id,
            method=reflection.method,
        )
        return {"status": "written", "reason": reflection.method, "memory_id": memory_id}

    async def _fetch_log(self, log_id: UUID) -> dict[str, object] | None:
        async with db_session.AsyncSessionLocal() as db:
            stmt = sa.select(MemoryRetrievalLog).where(MemoryRetrievalLog.id == log_id)
            result = await db.execute(stmt)
            row: MemoryRetrievalLog | None = result.scalar_one_or_none()
            if row is None:
                return None
            return {
                "user_id": row.user_id,
                "app_name": row.app_name,
                "thread_id": row.thread_id,
                "query": row.query,
                "retrieved_memory_ids": list(row.retrieved_memory_ids or []),
            }

    async def _fetch_snippets(self, memory_ids: list[UUID]) -> list[str]:
        if not memory_ids:
            return []
        async with db_session.AsyncSessionLocal() as db:
            stmt = sa.select(Memory.content).where(Memory.id.in_(memory_ids[:5]))
            result = await db.execute(stmt)
            return [r[0] for r in result.all() if r[0]]

    async def _safe_embed(self, text: str) -> list[float] | None:
        service = await self._resolve_memory_service()
        embed_fn = getattr(service, "_embedding_fn", None)
        if not embed_fn:
            return None
        try:
            return await embed_fn(text)
        except Exception as exc:
            logger.debug("reflection_query_embed_failed", error=str(exc))
            return None

    async def _resolve_memory_service(self):
        if self._memory_service is None:
            from negentropy.engine.factories.memory import get_memory_service

            self._memory_service = get_memory_service()
        return self._memory_service

    async def _write_reflection(
        self,
        *,
        user_id: str,
        app_name: str,
        thread_id: UUID | None,
        reflection: Reflection,
        query: str,
        src_log_id: UUID,
        outcome: str,
    ) -> str:
        service = await self._resolve_memory_service()

        metadata = {
            "subtype": "reflection",
            "src_log_id": str(src_log_id),
            "query_hash": hash_query(query),
            "outcome": outcome,
            "applicable_when": reflection.applicable_when,
            "anti_examples": reflection.anti_examples,
            "created_by": "reflexion_v1",
            "method": reflection.method,
            "source": "reflection_worker",
        }
        result = await service.add_memory_typed(
            user_id=user_id,
            app_name=app_name,
            thread_id=thread_id,
            content=reflection.lesson,
            memory_type=_REFLECTION_TYPE,
            metadata=metadata,
        )
        memory_id = result.get("id", "")

        # importance 偏置：在初始 importance 基础上 +0.15（不超过 1.0）
        try:
            await self._boost_importance(memory_id=memory_id)
        except Exception as exc:
            logger.debug("reflection_importance_boost_skipped", error=str(exc))

        return memory_id

    async def _boost_importance(self, *, memory_id: str) -> None:
        if not memory_id:
            return
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                sa.update(Memory)
                .where(Memory.id == memory_id)
                .values(importance_score=sa.func.least(Memory.importance_score + _REFLECTION_IMPORTANCE_BOOST, 1.0))
            )
            await db.execute(stmt)
            await db.commit()


__all__ = ["ReflectionWorker"]
