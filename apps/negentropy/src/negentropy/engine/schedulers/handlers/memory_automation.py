"""``memory_automation`` handler — 仿生记忆自动化三作业统一入口。

将原 pg_cron 驱动的 3 个 Memory Automation 作业收敛至 Unified Scheduler：
- ``cleanup_memories``   → 调用 SQL ``cleanup_low_value_memories(threshold, min_age_days, decay_lambda)``
- ``trigger_consolidation`` → 调用 SQL ``trigger_maintenance_consolidation(lookback_interval)``
- ``reweight_relevance``    → 遍历有反馈的用户执行 Rocchio 重加权

沿用 ``agent_inspection`` 的 payload routing 模式：``task.payload.job_type`` 决定分发路径。
参数全部从 ``task.payload`` 读取（带默认值），不依赖 MemoryAutomationConfig 表。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import text

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA

from . import HandlerResult, register_handler

if TYPE_CHECKING:
    from negentropy.models.scheduled_task import ScheduledTask

logger = get_logger("negentropy.engine.schedulers.handlers.memory_automation")


@register_handler("memory_automation")
async def memory_automation_handler(task: ScheduledTask) -> HandlerResult:
    payload = task.payload or {}
    job_type = payload.get("job_type")

    if job_type == "cleanup_memories":
        return await _run_cleanup(task)
    elif job_type == "trigger_consolidation":
        return await _run_consolidation(task)
    elif job_type == "reweight_relevance":
        return await _run_reweight(task)
    else:
        return HandlerResult(status="failed", error=f"unknown job_type: {job_type}")


async def _run_cleanup(task: ScheduledTask) -> HandlerResult:
    """基于艾宾浩斯遗忘曲线清理低价值记忆。"""
    payload = task.payload or {}
    threshold = payload.get("threshold", 0.1)
    min_age_days = payload.get("min_age_days", 7)
    decay_lambda = payload.get("decay_lambda", 0.1)

    sql = text(f"SELECT {NEGENTROPY_SCHEMA}.cleanup_low_value_memories(:threshold, :min_age_days, :decay_lambda)")
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                sql,
                {"threshold": threshold, "min_age_days": min_age_days, "decay_lambda": decay_lambda},
            )
            row = result.first()
            await db.commit()
        deleted = row[0] if row else None
        return HandlerResult(
            status="ok",
            output_summary=f"cleanup_memories: deleted={deleted}",
            metrics={"deleted": deleted or 0},
        )
    except Exception as exc:
        logger.exception("memory_cleanup_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))


async def _run_consolidation(task: ScheduledTask) -> HandlerResult:
    """按时间窗口批量触发会话巩固任务。"""
    payload = task.payload or {}
    lookback_interval = payload.get("lookback_interval", "1 hour")

    sql = text(f"SELECT {NEGENTROPY_SCHEMA}.trigger_maintenance_consolidation(:lookback::interval)")
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(sql, {"lookback": lookback_interval})
            row = result.first()
            await db.commit()
        count = row[0] if row else None
        return HandlerResult(
            status="ok",
            output_summary=f"trigger_consolidation: count={count}, lookback={lookback_interval}",
            metrics={"consolidated": count or 0},
        )
    except Exception as exc:
        logger.exception("memory_consolidation_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))


async def _run_reweight(task: ScheduledTask) -> HandlerResult:
    """遍历有反馈的用户执行 Rocchio 相关性重加权。"""
    import sqlalchemy as sa

    from negentropy.engine.relevance.rocchio_reweighter import reweight_memories
    from negentropy.models.internalization import MemoryRetrievalLog

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                sa.select(
                    MemoryRetrievalLog.user_id,
                    MemoryRetrievalLog.app_name,
                )
                .where(MemoryRetrievalLog.outcome_feedback.isnot(None))
                .distinct()
            )
            users = result.all()

        total_reweighted = 0
        failed_users = 0
        for row in users:
            try:
                count = await reweight_memories(user_id=row.user_id, app_name=row.app_name)
                total_reweighted += count
            except Exception:
                failed_users += 1
                logger.warning(
                    "reweight_user_failed",
                    user_id=row.user_id,
                    app_name=row.app_name,
                    exc_info=True,
                )

        return HandlerResult(
            status="ok" if failed_users == 0 else "failed",
            output_summary=(
                f"reweight_relevance: reweighted={total_reweighted}, users={len(users)}, failed_users={failed_users}"
            ),
            error=f"{failed_users} users failed" if failed_users else None,
            metrics={
                "reweighted_memories": total_reweighted,
                "users_processed": len(users) - failed_users,
                "failed_users": failed_users,
            },
        )
    except Exception as exc:
        logger.exception("memory_reweight_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))
