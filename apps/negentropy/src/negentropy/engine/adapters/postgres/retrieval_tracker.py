"""
RetrievalTracker: 记忆检索效果反馈追踪服务

建立"检索→记录→反馈→调权"的闭环，量化记忆系统的有效性。
基于 Rocchio 相关性反馈和 Learning-to-Rank 范式。

评估维度对齐 LongMemEval：
- 检索精度 (Precision@K)
- 利用率 (Utilization Rate)
- 噪声率 (Noise Rate)

参考文献:
[1] J. J. Rocchio, "Relevance feedback in information retrieval,"
    in The SMART Retrieval System, Prentice-Hall, 1971, pp. 313-323.
[2] C. J. C. Burges et al., "Learning to rank using gradient descent," ICML, 2005.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import MemoryRetrievalLog

logger = get_logger("negentropy.engine.adapters.postgres.retrieval_tracker")

_REFLEXION_TRIGGER_OUTCOMES = {"irrelevant", "harmful"}

# 后台反思任务集合（fire-and-forget；测试可 await 其中元素验证完成）
_pending_reflection_tasks: set[asyncio.Task] = set()


def get_pending_reflection_tasks() -> set[asyncio.Task]:
    """返回当前未完成的反思任务集合（用于测试 / 优雅关停）。"""
    return _pending_reflection_tasks


class RetrievalTracker:
    async def log_retrieval(
        self,
        *,
        user_id: str,
        app_name: str,
        query: str,
        memory_ids: list[UUID],
        fact_ids: list[UUID] | None = None,
        thread_id: UUID | None = None,
    ) -> UUID | None:
        if not memory_ids:
            return None

        log = MemoryRetrievalLog(
            user_id=user_id,
            app_name=app_name,
            thread_id=thread_id,
            query=query,
            retrieved_memory_ids=memory_ids,
            retrieved_fact_ids=fact_ids or [],
        )
        async with db_session.AsyncSessionLocal() as db:
            db.add(log)
            await db.commit()
            await db.refresh(log)
            log_id = log.id

        logger.debug(
            "retrieval_logged",
            user_id=user_id,
            memory_count=len(memory_ids),
            query_length=len(query),
        )
        return log_id

    async def mark_referenced(self, log_id: UUID, reference_count: int = 1) -> bool:
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                sa.update(MemoryRetrievalLog)
                .where(MemoryRetrievalLog.id == log_id)
                .values(was_referenced=True, reference_count=reference_count)
            )
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount > 0

    async def record_feedback(self, log_id: UUID, outcome: str) -> bool:
        if outcome not in ("helpful", "irrelevant", "harmful"):
            raise ValueError(f"Invalid outcome: {outcome}. Must be 'helpful', 'irrelevant', or 'harmful'")

        async with db_session.AsyncSessionLocal() as db:
            stmt = sa.update(MemoryRetrievalLog).where(MemoryRetrievalLog.id == log_id).values(outcome_feedback=outcome)
            result = await db.execute(stmt)
            await db.commit()
            updated = result.rowcount > 0

        # Phase 5 F2：失败反馈触发反思生成（fire-and-forget；启用后才会走）
        if updated and outcome in _REFLEXION_TRIGGER_OUTCOMES:
            self._maybe_trigger_reflection(log_id=log_id, outcome=outcome)
        return updated

    @staticmethod
    def _maybe_trigger_reflection(*, log_id: UUID, outcome: str) -> None:
        """启用 F2 时后台触发反思生成；默认关闭。"""
        try:
            from negentropy.config import settings as global_settings

            if not global_settings.memory.reflection.enabled:
                return
        except Exception as exc:
            logger.debug("reflection_settings_load_failed", error=str(exc))
            return

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return  # 不在事件循环中，跳过

        task = loop.create_task(_run_reflection_safely(log_id=log_id, outcome=outcome))
        _pending_reflection_tasks.add(task)
        task.add_done_callback(_pending_reflection_tasks.discard)

    async def get_effectiveness_metrics(
        self,
        *,
        user_id: str,
        app_name: str,
        days: int = 30,
    ) -> dict[str, float | int]:
        since = datetime.now(UTC) - timedelta(days=days)

        async with db_session.AsyncSessionLocal() as db:
            stmt = sa.select(
                sa.func.count().label("total"),
                sa.func.sum(sa.case((MemoryRetrievalLog.was_referenced.is_(True), 1), else_=0)).label("referenced"),
                sa.func.sum(sa.case((MemoryRetrievalLog.outcome_feedback == "helpful", 1), else_=0)).label("helpful"),
                sa.func.sum(sa.case((MemoryRetrievalLog.outcome_feedback == "irrelevant", 1), else_=0)).label(
                    "irrelevant"
                ),
                sa.func.sum(sa.case((MemoryRetrievalLog.outcome_feedback.isnot(None), 1), else_=0)).label(
                    "with_feedback"
                ),
            ).where(
                MemoryRetrievalLog.user_id == user_id,
                MemoryRetrievalLog.app_name == app_name,
                MemoryRetrievalLog.created_at >= since,
            )
            result = await db.execute(stmt)
            row = result.one()

        total = row.total or 0
        if total == 0:
            return {"total_retrievals": 0, "precision_at_k": 0.0, "utilization_rate": 0.0, "noise_rate": 0.0}

        referenced = row.referenced or 0
        helpful = row.helpful or 0
        irrelevant = row.irrelevant or 0
        with_feedback = row.with_feedback or 0

        return {
            "total_retrievals": total,
            "precision_at_k": referenced / total,
            "utilization_rate": helpful / with_feedback if with_feedback > 0 else 0.0,
            "noise_rate": irrelevant / with_feedback if with_feedback > 0 else 0.0,
        }


async def _run_reflection_safely(*, log_id: UUID, outcome: str) -> None:
    """后台反思任务包装器：捕获所有异常，写日志不向上抛。"""
    try:
        from negentropy.engine.consolidation.reflection_worker import ReflectionWorker

        worker = ReflectionWorker()
        await worker.process(log_id=log_id, outcome=outcome)
    except Exception as exc:
        logger.warning("reflection_task_failed", error=str(exc), log_id=str(log_id))
