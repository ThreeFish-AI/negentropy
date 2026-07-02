"""``tool_stats_aggregate`` handler — 每日聚合 tool_invocations → tool_stats_daily。

由统一调度引擎按 ``cron``（默认 `5 3 * * *`，每日 03:05）触发。从 ``tool_invocations``
按 (tool_ref, tool_version, DATE(created_at)) 分桶聚合成功率/p50·p95 延迟/成本/调用量，
覆盖式 upsert（``ON CONFLICT DO UPDATE SET = EXCLUDED.*``，跨日重跑幂等）。

灰度：``settings.observability.tool_telemetry_enabled=False`` 时直接 no-op。

参考文献：
[1] C. Jiang et al., "Self-Improving Agents in the Era of Experience," 2026. §3.4 聚合。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import text

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA

from . import HandlerDescriptor, HandlerResult, register_descriptor, register_handler

if TYPE_CHECKING:
    from negentropy.models.scheduled_task import ScheduledTask

logger = get_logger("negentropy.engine.schedulers.handlers.tool_stats_aggregate")

register_descriptor(
    HandlerDescriptor(
        handler_kind="tool_stats_aggregate",
        label="Tool Stats Aggregate",
        description="每日聚合 tool_invocations → tool_stats_daily（成功率/p50p95延迟/成本）",
        supported_trigger_types=("cron",),
        default_trigger_type="cron",
    )
)


@register_handler("tool_stats_aggregate")
async def tool_stats_aggregate_handler(task: ScheduledTask) -> HandlerResult:
    if not settings.observability.tool_telemetry_enabled:
        return HandlerResult(status="ok", output_summary="tool telemetry disabled")
    payload = task.payload or {}
    job_type = payload.get("job_type", "daily_aggregate")
    if job_type != "daily_aggregate":
        return HandlerResult(status="failed", error=f"unknown job_type: {job_type}")
    lookback_days = int(payload.get("lookback_days", 1))
    return await _run_daily_aggregate(lookback_days)


async def _run_daily_aggregate(lookback_days: int) -> HandlerResult:
    """聚合 ``lookback_days`` 天的 tool_invocations → tool_stats_daily（覆盖式 upsert）。

    覆盖式（= EXCLUDED.*）而非累加式：聚合窗口回看 N 天，跨日重跑幂等（覆盖上次结果），
    避免重复 tick 累加污染。percentile_cont 仅对有 latency_ms 的行算分位。
    """
    sql = text(
        f"""
        INSERT INTO {NEGENTROPY_SCHEMA}.tool_stats_daily
            (id, tool_ref, tool_version, stat_date,
             invocation_count, success_count, error_count,
             p50_latency_ms, p95_latency_ms, total_cost_usd,
             created_at, updated_at)
        SELECT gen_random_uuid(),
               tool_ref, tool_version, DATE(created_at) AS stat_date,
               COUNT(*) AS invocation_count,
               COUNT(*) FILTER (WHERE status = 'success') AS success_count,
               COUNT(*) FILTER (WHERE status = 'error') AS error_count,
               percentile_cont(0.5)  WITHIN GROUP (ORDER BY latency_ms),
               percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms),
               SUM(COALESCE(cost_usd, 0)),
               NOW(), NOW()
        FROM {NEGENTROPY_SCHEMA}.tool_invocations
        WHERE created_at >= NOW() - INTERVAL '1 day' * :lookback_days
        GROUP BY tool_ref, tool_version, DATE(created_at)
        ON CONFLICT (tool_ref, tool_version, stat_date)
        DO UPDATE SET
            invocation_count = EXCLUDED.invocation_count,
            success_count    = EXCLUDED.success_count,
            error_count      = EXCLUDED.error_count,
            p50_latency_ms   = EXCLUDED.p50_latency_ms,
            p95_latency_ms   = EXCLUDED.p95_latency_ms,
            total_cost_usd   = EXCLUDED.total_cost_usd,
            updated_at       = NOW()
        """
    )
    try:
        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(sql, {"lookback_days": lookback_days})
            rows_upserted = result.rowcount
            await db.commit()
        return HandlerResult(
            status="ok",
            output_summary=f"daily_aggregate: rows_upserted={rows_upserted}",
            metrics={"rows_upserted": rows_upserted or 0},
        )
    except Exception as exc:
        logger.exception("tool_stats_aggregate_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))
