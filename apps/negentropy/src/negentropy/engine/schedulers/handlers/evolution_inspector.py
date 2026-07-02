"""``evolution_inspector`` handler — 自进化提案状态机的心跳驱动。

由统一调度引擎按 ``interval``（默认 300s）tick，每次调用
``EvolutionOrchestrator.inspect_once()`` 推进 propose→shadow_eval→canary→promote/rollback
状态机。本 handler 自身轻量（仅 DB 读写 + bg task 调度），proposer LLM / 指标聚合在
bg task / inspect_once 内完成，不阻塞心跳。

灰度：``settings.evolution.enabled=False`` 时直接 no-op（首部署默认关）。
"""

from __future__ import annotations

from negentropy.config import settings
from negentropy.logging import get_logger

from . import HandlerDescriptor, HandlerResult, register_descriptor, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.evolution_inspector")

register_descriptor(
    HandlerDescriptor(
        handler_kind="evolution_inspector",
        label="Evolution Inspector",
        description="GEPA 进化提案器心跳：推进提案状态机 + spawn proposer（记忆检索权重自进化）",
        supported_trigger_types=("interval",),
        default_trigger_type="interval",
    )
)


@register_handler("evolution_inspector")
async def evolution_inspector_handler(task) -> HandlerResult:
    """单次进化 tick。返回各阶段计数摘要，写入 task_executions 供 Dashboard 观测。"""
    if not settings.evolution.enabled:
        return HandlerResult(status="ok", output_summary="evolution disabled")

    try:
        from negentropy.engine.evolution import get_evolution_orchestrator

        result = await get_evolution_orchestrator().inspect_once()
        return HandlerResult(
            status="ok",
            output_summary=(f"advanced={result['advanced']} proposed={result['proposed']}"),
            metrics=result,
        )
    except Exception as exc:
        logger.warning("evolution_inspector_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))
