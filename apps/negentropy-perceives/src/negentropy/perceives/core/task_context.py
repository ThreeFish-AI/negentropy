"""任务级上下文与计时支持。

使用 `contextvars`（PEP 567）承载跨层任务身份与阶段元数据，随 asyncio 任务树自动传播。
各层（MCP 中间件 → ops → pipeline → stage）通过 `set()` / `reset()` 绑定与释放上下文，
日志 Filter 从这些 ContextVar 读取值并注入到 LogRecord 中，由 ColoredFormatter 渲染为
`[task=… pipeline=… stage=… method=…]` 前缀。

Why contextvars：
- 官方推荐的异步请求上下文方案（PEP 567），`asyncio.gather` / `create_task`
  / `loop.run_in_executor` 自动复制上下文副本，避免跨任务串扰。
- 相比显式透传 `task_id` 参数，零侵入覆盖现有所有 `logger.info(...)` 调用点。
"""

from __future__ import annotations

import contextvars
import secrets
import time
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

__all__ = [
    "task_id_var",
    "source_var",
    "pipeline_var",
    "stage_var",
    "method_var",
    "timing_var",
    "TaskTiming",
    "new_task_id",
    "bind_pipeline",
]


# ── ContextVar 定义 ───────────────────────────────────────────────────────────

#: 8 字符的任务 ID，由 MCP 中间件在 `on_call_tool` 中生成。
task_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "negentropy_task_id", default=None
)

#: 任务来源标识，形如 `parse_pdf_to_markdown/df813932`（工具名 / session 前 8 位）。
source_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "negentropy_source", default=None
)

#: 当前 pipeline 名称，目前取值为 `"pdf"` 或 `"webpage"`。
pipeline_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "negentropy_pipeline", default=None
)

#: 当前 Stage 名称（如 `preprocessing`、`layout`、`assembly`）。
stage_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "negentropy_stage", default=None
)

#: 当前 Stage 使用的引擎/方法（如 `docling`、`pymupdf`）。
method_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "negentropy_method", default=None
)


# ── 计时记录 ──────────────────────────────────────────────────────────────────


@dataclass
class TaskTiming:
    """单次任务的计时与 Stage 摘要容器。

    `stage_records` 追加元组 `(stage_name, method, elapsed_ms, success)`，
    在中间件 `finally` 段拼接为 `stage1(method,12ms,ok)→stage2(...)` 形式。
    """

    start_monotonic: float
    stage_records: List[Tuple[str, str, float, bool]] = field(default_factory=list)


timing_var: contextvars.ContextVar[Optional[TaskTiming]] = contextvars.ContextVar(
    "negentropy_timing", default=None
)


# ── 辅助 API ──────────────────────────────────────────────────────────────────


def new_task_id() -> str:
    """生成 8 字符十六进制任务 ID。

    Why `secrets.token_hex(4)`：标准库原生、无依赖、加密安全随机；8 字符对日志足够短但
    在单服务实例生命周期内几乎无碰撞。
    """

    return secrets.token_hex(4)


def bind_pipeline(name: str) -> contextvars.Token[Optional[str]]:
    """绑定 pipeline 名称到当前上下文，返回的 Token 用于 `pipeline_var.reset(token)`。"""

    return pipeline_var.set(name)


def new_timing() -> TaskTiming:
    """创建一个从当前 monotonic 时刻起算的 TaskTiming。"""

    return TaskTiming(start_monotonic=time.monotonic())
