"""Handler 注册中心 — 把 ``handler_kind`` 字符串路由到具体的执行函数。

Phase 4 内置 6 个 handler：
- ``skill_invoke``        — 替代旧 ``register_skill_scheduler`` tick
- ``pipeline_watchdog``   — 替代 ``bootstrap.py`` 中的 inline ``_pipeline_watchdog_tick``
- ``session_title_inspect`` — 替代旧 ``SessionTitleInspector.start()`` 自启
- ``cache_warm``          — startup 一次性 → oneshot 任务
- ``pgvector_check``      — startup 一次性 → oneshot 任务
- ``agent_inspection``    — 24/7 自驱 Agent 巡检最小骨架

每个 handler 是 ``async def fn(task, ctx) -> HandlerResult``，由
``ScheduledTaskRegistry.dispatch`` 调用。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from negentropy.models.scheduled_task import ScheduledTask


@dataclass
class HandlerResult:
    """Handler 执行结果，由 Registry 写入 ``task_executions``。"""

    status: str = "ok"  # ok | failed
    output_summary: str | None = None
    error: str | None = None
    tokens_used: int | None = None
    skill_id: Any | None = None
    skill_schedule_id: Any | None = None
    memory_id: Any | None = None
    pipeline_run_id: Any | None = None
    thread_id: Any | None = None
    metrics: dict[str, Any] = field(default_factory=dict)


HandlerFn = Callable[["ScheduledTask"], Awaitable[HandlerResult]]


HANDLER_REGISTRY: dict[str, HandlerFn] = {}


def register_handler(kind: str) -> Callable[[HandlerFn], HandlerFn]:
    """Decorator：把 handler 注册到 ``HANDLER_REGISTRY``。"""

    def _wrap(fn: HandlerFn) -> HandlerFn:
        HANDLER_REGISTRY[kind] = fn
        return fn

    return _wrap


def get_handler(kind: str) -> HandlerFn | None:
    return HANDLER_REGISTRY.get(kind)


def list_handlers() -> list[str]:
    return list(HANDLER_REGISTRY.keys())


# Phase 4：导入子模块触发 register_handler 装饰器；显式列出以便静态扫描。
# 任一 handler import 失败不应让 scheduler bootstrap 整个崩掉——
# fail-soft 在 Registry 启动路径里处理。
def _bootstrap_default_handlers() -> None:
    """显式按需 import 默认 handler 模块，触发装饰器副作用注册。

    Plan 第 5.1 节列出的 6 个 handler 必须在 ``ScheduledTaskRegistry.start()``
    之前完成导入。本函数由 Registry 启动时调用一次。
    """
    from negentropy.logging import get_logger

    logger = get_logger("negentropy.engine.schedulers.handlers")

    for module_name in (
        "skill_invoke",
        "pipeline_watchdog",
        "session_title_inspect",
        "cache_warm",
        "pgvector_check",
        "agent_inspection",
        "claude_code",
    ):
        try:
            __import__(f"negentropy.engine.schedulers.handlers.{module_name}")
        except Exception as exc:
            logger.warning("scheduler_handler_import_failed", module=module_name, error=str(exc))


__all__ = [
    "HANDLER_REGISTRY",
    "HandlerFn",
    "HandlerResult",
    "_bootstrap_default_handlers",
    "get_handler",
    "list_handlers",
    "register_handler",
]
