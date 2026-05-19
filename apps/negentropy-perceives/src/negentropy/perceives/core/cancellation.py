"""任务级取消作用域（Cancel Scope）与超时/取消信号传导。

为什么需要 CancelScope：
- Python `asyncio.timeout()` 只会在下一次 `await` 处抛出 `CancelledError`，
  对**同步阻塞**调用（如 Docling/MinerU/Marker 的原生推理）完全无效；
- 线程无法被强制 kill，`asyncio.to_thread()` 被取消时只是"放弃等待"，
  下层线程（或其 spawn 的子进程）仍会继续消耗 CPU/显存；
- 需要一个统一的"取消信号"承载体，既能让事件循环拿到 `CancelledError`，
  又能让同步代码、子进程轮询；同时保留"剩余截止时间"供子进程 watchdog 使用。

设计灵感：
- Trio / Anyio 的 `CancelScope`（支持 deadline、可嵌套、可延迟交付）；
- Go `context.Context`（携带 deadline 与取消信号，透传至函数全链）；
- Java `Thread.interrupt()`（协作式，由被调者在检查点主动响应）。

本模块仅提供**数据结构 + ContextVar 绑定 + async context manager**。
真正的"叫停"动作（如 kill 子进程、中断 pipeline stage 循环）由消费方在
`scope.cancelled()` / `scope.check()` 处自行决策。
"""

from __future__ import annotations

import asyncio
import contextvars
import logging
import threading
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import AsyncIterator, Literal, Optional

logger = logging.getLogger(__name__)

__all__ = [
    "CancelReason",
    "CancelScope",
    "cancel_scope_var",
    "bind_cancel_scope",
    "current_cancel_scope",
]


CancelReason = Literal["timeout", "client_cancelled", "server_cancelled"]


@dataclass
class CancelScope:
    """单次任务的取消作用域。

    同时承载三类语义：
    1. ``event`` — 供同步代码 / 线程 / 子进程通过轮询判断是否已被取消；
    2. ``deadline_monotonic`` — 绝对截止时间（monotonic），子进程 watchdog 用；
    3. ``reason`` — 首次触发取消的原因，用于可观测性与响应文案生成。

    ``mark_cancelled()`` 幂等：首次调用设定 reason 并 set event，
    后续调用只在 reason 为 None 时才覆盖，避免覆写真实取消原因。
    """

    event: threading.Event = field(default_factory=threading.Event)
    deadline_monotonic: Optional[float] = None
    reason: Optional[CancelReason] = None

    def mark_cancelled(self, reason: CancelReason) -> None:
        """标记为已取消；首次调用登记原因。"""
        if self.reason is None:
            self.reason = reason
        self.event.set()

    def remaining(self) -> Optional[float]:
        """距离 deadline 的剩余秒数；无 deadline 返回 None，已过期返回 0.0。"""
        if self.deadline_monotonic is None:
            return None
        remaining = self.deadline_monotonic - time.monotonic()
        return max(0.0, remaining)

    def deadline_passed(self) -> bool:
        """deadline 是否已过；无 deadline 返回 False。"""
        if self.deadline_monotonic is None:
            return False
        return time.monotonic() >= self.deadline_monotonic

    def cancelled(self) -> bool:
        """是否已取消（event 已 set 或 deadline 已过）。"""
        return self.event.is_set() or self.deadline_passed()

    def check(self) -> None:
        """协作式检查点：若已取消则抛 ``asyncio.CancelledError``。

        消费方应在合适的检查点（如 Pipeline Stage 之间、循环边界）调用。
        注意：不处理阻塞中的原生调用，那需要由引擎子进程被 kill 来真正止损。
        """
        if self.cancelled():
            if self.reason is None:
                # deadline 过期但 reason 未 set 的情况：补一个原因
                self.mark_cancelled("timeout")
            raise asyncio.CancelledError(f"任务已取消: reason={self.reason}")


#: 当前任务的取消作用域；由 FastMCP 中间件在请求入口处绑定。
cancel_scope_var: contextvars.ContextVar[Optional[CancelScope]] = (
    contextvars.ContextVar("negentropy_cancel_scope", default=None)
)


def current_cancel_scope() -> Optional[CancelScope]:
    """读取当前 asyncio 任务上下文中的 CancelScope（可能为 None）。"""
    return cancel_scope_var.get()


@asynccontextmanager
async def bind_cancel_scope(
    timeout: Optional[float] = None,
) -> AsyncIterator[CancelScope]:
    """绑定一个新的 ``CancelScope`` 到当前上下文，内嵌 ``asyncio.timeout``。

    捕获以下两类异常并在退出前登记 reason：
    - ``TimeoutError`` → reason="timeout"（仍抛出原异常，上层按需转换语义）；
    - ``asyncio.CancelledError`` → reason="client_cancelled"（透传原异常）。

    Args:
        timeout: 相对截止时间（秒）；传 ``None`` 表示不限时间（仅响应外层取消）。

    Yields:
        新建的 ``CancelScope`` 实例。
    """
    deadline = time.monotonic() + timeout if timeout is not None else None
    scope = CancelScope(deadline_monotonic=deadline)
    token = cancel_scope_var.set(scope)
    try:
        if timeout is None:
            try:
                yield scope
            except asyncio.CancelledError:
                scope.mark_cancelled("client_cancelled")
                raise
        else:
            try:
                async with asyncio.timeout(timeout):
                    try:
                        yield scope
                    except asyncio.CancelledError:
                        # 需区分：是否因 deadline 到期导致的 Cancel
                        if scope.deadline_passed():
                            scope.mark_cancelled("timeout")
                        else:
                            scope.mark_cancelled("client_cancelled")
                        raise
            except TimeoutError:
                # asyncio.timeout() 到点后将 CancelledError 转换为 TimeoutError
                scope.mark_cancelled("timeout")
                raise
    finally:
        cancel_scope_var.reset(token)
