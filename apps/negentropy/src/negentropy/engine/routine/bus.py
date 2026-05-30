"""RoutineBus — 进程内事件 fan-out，供 ``/routines/stream`` SSE 端点消费。

复用 ``ScheduledTaskRegistry.ExecutionBus`` 的 asyncio.Queue 广播范式：每个 SSE 连接
``subscribe()`` 获得独立队列，``publish()`` 同时压入所有队列；队列满则丢弃最旧事件。

事件形态：``{"type": "routine"|"iteration", ...payload}``。
- ``routine``：routine 状态变更（status / best_score / total_cost_usd 等）。
- ``iteration``：迭代生命周期（dispatched / in_flight / executed / evaluated）。
"""

from __future__ import annotations

import asyncio
from contextlib import suppress
from typing import Any


class RoutineBus:
    """asyncio.Queue fan-out 总线（进程内单例，懒创建于运行 loop）。"""

    def __init__(self, max_buffer_per_subscriber: int = 64) -> None:
        self._subs: list[asyncio.Queue[dict[str, Any]]] = []
        self._max = max_buffer_per_subscriber
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        async with self._lock:
            q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=self._max)
            self._subs.append(q)
            return q

    async def unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            with suppress(ValueError):
                self._subs.remove(q)

    async def publish(self, event: dict[str, Any]) -> None:
        for q in list(self._subs):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                with suppress(asyncio.QueueEmpty):
                    q.get_nowait()
                with suppress(asyncio.QueueFull):
                    q.put_nowait(event)

    def publish_nowait(self, event: dict[str, Any]) -> None:
        """同步 fire-and-forget publish（供非 async 上下文 / 不便 await 时使用）。"""
        for q in list(self._subs):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                with suppress(asyncio.QueueEmpty):
                    q.get_nowait()
                with suppress(asyncio.QueueFull):
                    q.put_nowait(event)

    async def close_all_subscribers(self) -> None:
        """向所有订阅者投递关停哨兵 + 清空订阅表（SSE 端点据此收尾）。"""
        async with self._lock:
            for q in list(self._subs):
                with suppress(asyncio.QueueFull):
                    q.put_nowait({"__shutdown__": True})
            self._subs.clear()


# 进程内单例
_GLOBAL_BUS: RoutineBus | None = None


def get_bus() -> RoutineBus:
    """获取进程内 RoutineBus 单例（懒创建）。"""
    global _GLOBAL_BUS
    if _GLOBAL_BUS is None:
        _GLOBAL_BUS = RoutineBus()
    return _GLOBAL_BUS


__all__ = ["RoutineBus", "get_bus"]
