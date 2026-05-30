"""``routine_inspector`` handler — Routine 编排循环的心跳驱动。

由统一调度引擎按 ``interval`` 周期 tick，每次调用 ``RoutineOrchestrator.inspect_once()``
执行 reap → evaluate → dispatch 三阶段。本 handler 自身轻量快速（仅 DB 读写 + 后台任务
调度），真正的 Claude Code 长耗时执行交由进程内后台 Runner 异步完成，不阻塞心跳。

灰度：``settings.routine.enabled=False`` 时直接 no-op，使本心跳对调度引擎零副作用。
"""

from __future__ import annotations

from negentropy.config import settings
from negentropy.logging import get_logger

from . import HandlerDescriptor, HandlerResult, register_descriptor, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.routine_inspector")

register_descriptor(
    HandlerDescriptor(
        handler_kind="routine_inspector",
        label="Routine Inspector",
        description="巡检活跃 Routine，驱动评估-决策-调度闭环（长周期自主任务）",
        supported_trigger_types=("interval",),
        default_trigger_type="interval",
    ),
)


@register_handler("routine_inspector")
async def routine_inspector_handler(task) -> HandlerResult:
    """单次巡检 tick。返回各阶段计数摘要，写入 task_executions 供 Dashboard 观测。"""
    if not settings.routine.enabled:
        return HandlerResult(status="ok", output_summary="routine disabled")

    try:
        from negentropy.engine.routine import get_orchestrator

        result = await get_orchestrator().inspect_once()
        return HandlerResult(
            status="ok",
            output_summary=(f"reaped={result['reaped']} evaluated={result['evaluated']} launched={result['launched']}"),
            metrics=result,
        )
    except Exception as exc:
        logger.warning("routine_inspector_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))
