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

from datetime import UTC, datetime, timedelta
from uuid import UUID

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import MemoryRetrievalLog

logger = get_logger("negentropy.engine.adapters.postgres.retrieval_tracker")


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
            return result.rowcount > 0

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
