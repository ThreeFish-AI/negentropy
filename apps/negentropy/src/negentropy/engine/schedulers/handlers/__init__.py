"""Handler 注册中心 — 把 ``handler_kind`` 字符串路由到具体的执行函数。

Phase 4 内置 handler 清单：
- ``skill_invoke``          — 替代旧 ``register_skill_scheduler`` tick
- ``pipeline_watchdog``     — 替代 ``bootstrap.py`` 中的 inline ``_pipeline_watchdog_tick``
- ``session_title_inspect`` — 替代旧 ``SessionTitleInspector.start()`` 自启
- ``cache_warm``            — startup 一次性 → oneshot 任务
- ``pgvector_check``        — startup 一次性 → oneshot 任务
- ``agent_inspection``      — 24/7 自驱 Agent 巡检最小骨架
- ``memory_automation``     — 仿生记忆自动化三作业统一入口
- ``claude_code``           — Claude Code 任务执行

每个 handler 是 ``async def fn(task) -> HandlerResult``，由
``ScheduledTaskRegistry.dispatch`` 调用。

Handler Manifest（统一定义协议）：
每个 handler 通过 ``register_descriptor`` 声明其 ``HandlerDescriptor``，
包含支持触发类型、payload 字段 schema、判别式字段等信息。
Manifest 作为「能力定义」（SSOT）与 handler 实现共置，
供 UI 动态表单渲染消费。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from negentropy.models.scheduled_task import ScheduledTask


# ---------------------------------------------------------------------------
# Handler 执行结果
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Handler 注册表
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Handler Manifest — 统一定义协议
# ---------------------------------------------------------------------------

PayloadFieldType = Literal["string", "number", "integer", "boolean", "enum"]


@dataclass(frozen=True)
class PayloadField:
    """Handler payload 单个字段的 schema 描述。

    ``applies_when`` 用于判别式 handler：仅当 discriminator 字段取
    ``applies_when`` 中的值时，该字段才在 UI 表单中显示并参与校验。
    """

    name: str
    label: str
    type: PayloadFieldType
    required: bool = False
    default: Any | None = None
    enum_options: tuple[str, ...] | None = None  # type == "enum" 时必填
    help_text: str | None = None
    applies_when: tuple[str, ...] | None = None  # 判别式依赖值


@dataclass(frozen=True)
class HandlerDescriptor:
    """Handler 能力描述器，驱动 UI 动态表单渲染。

    与 handler 实现共置（SSOT）：payload 字段 schema 紧邻消费它的
    handler 代码，改 handler 时同步改 descriptor，杜绝 split-brain。
    """

    handler_kind: str
    label: str
    description: str
    supported_trigger_types: tuple[str, ...]  # 子集 of ("interval", "cron", "oneshot")
    payload_fields: tuple[PayloadField, ...] = ()
    discriminator_field: str | None = None  # 判别式 handler 的枚举字段名
    default_trigger_type: str | None = None
    supports_token_budget: bool = False


HANDLER_DESCRIPTORS: dict[str, HandlerDescriptor] = {}


def register_descriptor(d: HandlerDescriptor) -> HandlerDescriptor:
    """注册 handler 描述器到全局 ``HANDLER_DESCRIPTORS`` 表。"""
    HANDLER_DESCRIPTORS[d.handler_kind] = d
    return d


def get_descriptor(kind: str) -> HandlerDescriptor | None:
    return HANDLER_DESCRIPTORS.get(kind)


def list_descriptors() -> list[HandlerDescriptor]:
    return list(HANDLER_DESCRIPTORS.values())


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------


def _bootstrap_default_handlers() -> None:
    """显式按需 import 默认 handler 模块，触发装饰器 + 描述器注册副作用。

    本函数由 Registry 启动时 / API ``GET /scheduler/handlers`` 调用。
    幂等：Python import cache 保证重复调用零开销。
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
        "memory_automation",
        "claude_code",
    ):
        try:
            __import__(f"negentropy.engine.schedulers.handlers.{module_name}")
        except Exception as exc:
            logger.warning("scheduler_handler_import_failed", module=module_name, error=str(exc))


__all__ = [
    "HANDLER_DESCRIPTORS",
    "HANDLER_REGISTRY",
    "HandlerDescriptor",
    "HandlerFn",
    "HandlerResult",
    "PayloadField",
    "PayloadFieldType",
    "_bootstrap_default_handlers",
    "get_descriptor",
    "get_handler",
    "list_descriptors",
    "list_handlers",
    "register_descriptor",
    "register_handler",
]
