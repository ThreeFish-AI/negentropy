"""``memory_automation`` handler — 仿生记忆自动化三作业统一入口。

将原 pg_cron 驱动的 3 个 Memory Automation 作业收敛至 Unified Scheduler：
- ``cleanup_memories``   → 调用 SQL ``cleanup_low_value_memories(threshold, min_age_days, decay_lambda)``
- ``trigger_consolidation`` → 调用 SQL ``trigger_maintenance_consolidation(lookback_interval)``
- ``reweight_relevance``    → 遍历有反馈的用户执行 Rocchio 重加权

沿用 ``agent_inspection`` 的 payload routing 模式：``task.payload.job_type`` 决定分发路径。
参数全部从 ``task.payload`` 读取（带默认值），不依赖 MemoryAutomationConfig 表。
"""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from sqlalchemy import text

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA

from . import HandlerDescriptor, HandlerResult, PayloadField, register_descriptor, register_handler

if TYPE_CHECKING:
    from negentropy.models.scheduled_task import ScheduledTask

logger = get_logger("negentropy.engine.schedulers.handlers.memory_automation")

register_descriptor(
    HandlerDescriptor(
        handler_kind="memory_automation",
        label="Memory Automation",
        description="仿生记忆自动化：遗忘清理、会话巩固、相关性重加权",
        supported_trigger_types=("cron", "interval"),
        default_trigger_type="cron",
        discriminator_field="job_type",
        payload_fields=(
            PayloadField(
                name="job_type",
                label="Job Type",
                type="enum",
                required=True,
                enum_options=("cleanup_memories", "trigger_consolidation", "reweight_relevance"),
                help_text=(
                    "作业类型：cleanup_memories=遗忘清理;"
                    " trigger_consolidation=会话巩固; reweight_relevance=相关性重加权"
                ),
            ),
            PayloadField(
                name="threshold",
                label="Threshold",
                type="number",
                default=0.1,
                help_text="低价值记忆阈值（仅 cleanup_memories）",
                applies_when=("cleanup_memories",),
            ),
            PayloadField(
                name="min_age_days",
                label="Min Age (days)",
                type="integer",
                default=7,
                help_text="最小记忆天数（仅 cleanup_memories）",
                applies_when=("cleanup_memories",),
            ),
            PayloadField(
                name="decay_lambda",
                label="Decay Lambda",
                type="number",
                default=0.1,
                help_text="艾宾浩斯衰减系数（仅 cleanup_memories）",
                applies_when=("cleanup_memories",),
            ),
            PayloadField(
                name="lookback_interval",
                label="Lookback Interval",
                type="string",
                default="1 hour",
                help_text="回溯时间窗口，如 '1 hour'（仅 trigger_consolidation）",
                applies_when=("trigger_consolidation",),
            ),
        ),
    ),
)

_INTERVAL_UNIT_MAP = {
    "second": "seconds",
    "minute": "minutes",
    "hour": "hours",
    "day": "days",
}


def _parse_interval(s: str) -> timedelta:
    """将 'N unit' 格式的 interval 字符串解析为 timedelta（如 '1 hour' → timedelta(hours=1)）。"""
    parts = s.strip().split()
    if len(parts) != 2:
        raise ValueError(f"Unsupported interval format: {s!r}")
    value = int(parts[0])
    unit = parts[1].lower().rstrip("s")
    if unit not in _INTERVAL_UNIT_MAP:
        raise ValueError(f"Unsupported interval unit: {unit!r}")
    return timedelta(**{_INTERVAL_UNIT_MAP[unit]: value})


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

    # CAST(:lookback AS interval) 而非 :lookback::interval —— 命名参数紧邻 PostgreSQL ::
    # cast 会破坏 SQLAlchemy 参数边界识别，asyncpg 报 syntax error。同口径修复参见
    # knowledge/graph/repository.py:515-519、knowledge/retrieval/repository.py:832-834。
    sql = text(f"SELECT {NEGENTROPY_SCHEMA}.trigger_maintenance_consolidation(CAST(:lookback AS interval))")
    try:
        # asyncpg 原生支持 timedelta → PostgreSQL interval 编解码，必须传 timedelta 而非 str。
        lookback_td = _parse_interval(lookback_interval)
        async with AsyncSessionLocal() as db:
            result = await db.execute(sql, {"lookback": lookback_td})
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
            status="ok",
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
