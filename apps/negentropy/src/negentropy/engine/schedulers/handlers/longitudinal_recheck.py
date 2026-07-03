"""``longitudinal_recheck`` handler —— 已晋升进化对象的纵向复评（综述 §8 #3 + §10.5 + §9.3）。

由统一调度引擎按 cron（默认每日）tick，调用 ``EvolutionOrchestrator.recheck_promoted()``：
对有离线 eval 基座的面（skill）按 ``longitudinal_recheck_interval_seconds`` due-check，复跑 holdout
集 vs 晋升时均值，drift 超阈则回退 ``active_version``。与 ``evolution_inspector``（状态机 tick，300s）
解耦——复评重活（跑 eval = LLM Judge）独立 cadence，不阻塞状态机。

灰度：``settings.evolution.enabled=False`` 时 no-op。默认 ``enabled=False``（迁移 0085 seed）。
"""

from __future__ import annotations

from negentropy.config import settings
from negentropy.logging import get_logger

from . import HandlerDescriptor, HandlerResult, register_descriptor, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.longitudinal_recheck")

register_descriptor(
    HandlerDescriptor(
        handler_kind="longitudinal_recheck",
        label="Longitudinal Recheck",
        description="已晋升进化对象纵向复评：复跑 holdout 集 vs 晋升均值，drift 回退（综述 §8 #3）",
        supported_trigger_types=("cron",),
        default_trigger_type="cron",
    )
)


@register_handler("longitudinal_recheck")
async def longitudinal_recheck_handler(task) -> HandlerResult:
    """单次纵向复评 tick。返回 rechecked/reverted 计数写入 task_executions 供 Dashboard 观测。"""
    if not settings.evolution.enabled:
        return HandlerResult(status="ok", output_summary="evolution disabled")

    try:
        from negentropy.engine.evolution import get_evolution_orchestrator

        result = await get_evolution_orchestrator().recheck_promoted()
        return HandlerResult(
            status="ok",
            output_summary=(f"rechecked={result['rechecked']} reverted={result['reverted']}"),
            metrics=result,
        )
    except Exception as exc:
        logger.warning("longitudinal_recheck_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))
