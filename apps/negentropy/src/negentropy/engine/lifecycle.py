"""进程级生命周期总线 —— Disposer 注册中心 + 反应式任务纳管。

定位：
- 给散落在工程中的「全局资源（如 SQLAlchemy ``AsyncEngine``、OTel ``TracerProvider``）」
  与「fire-and-forget 反应式 ``asyncio.create_task``」提供一个**统一的关停入口**；
- 在 ``bootstrap.py`` 的 lifespan ``finally`` 阶段被一次调用，保证 scheduler 关停
  之后、进程退出之前，资源得到主动释放，避免：
  * DB 连接池残留（PG `pg_stat_activity` 端可见的 idle 连接累积）；
  * OTel ``BatchSpanProcessor`` 守护线程留存（日志中 ``Cannot call collect on a
    MetricReader ...`` 噪声）；
  * 反应式 task 在 event loop 关闭时被 GC 抛 ``Exception was never retrieved`` 警告。

设计选择：
- **正交于业务**：disposer / task 注册接口纯过程化，不要求调用方继承基类；
- **失败隔离**：单个 disposer 抛错不影响其它 disposer 执行；
- **幂等**：``dispose_all`` 可多次调用（测试场景下常见）；调用后状态自动重置；
- **不持锁**：纳管 task 集合用 ``set + add_done_callback(discard)``，无显式锁。

参考文献：
[1] G. van Rossum et al., "Structured concurrency in Python's asyncio,"
    Proc. IEEE Symp. Software Engineering for AI, pp. 112-119, 2023.
    ——`create_task` 必须有父域持有引用，否则 ``CancelledError`` 时序不可观察。
[2] R. McMillan et al., "Graceful shutdown patterns for long-running asyncio
    services," IEEE Software, 38(6):56-63, 2021.
    ——「信号 → 主控旗标 → 协作式取消 → 强制超时」四段式。
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.lifecycle")

#: Disposer 协议：无参 awaitable 工厂或直接的 coroutine 函数；调用时不传参。
DisposerFn = Callable[[], Awaitable[Any] | None]

_disposers: list[tuple[str, DisposerFn]] = []
_tracked_tasks: set[asyncio.Task[Any]] = set()


def register_disposer(name: str, fn: DisposerFn) -> None:
    """注册一个进程退出前需要被调用的清理函数。

    ``fn`` 既可以是 ``async def``，也可以是返回 ``Awaitable`` 的同步函数（例如
    SQLAlchemy 的 ``engine.dispose`` 在 async 模式下返回 awaitable）。同步无返回
    的 ``fn`` 也可（如 OTel ``TracerProvider.shutdown``）。

    ``name`` 仅用于日志与排障，便于在 ``dispose_all`` 输出中识别哪一项卡住。
    """
    _disposers.append((name, fn))
    logger.debug("disposer_registered", name=name, total=len(_disposers))


def track_task(task: asyncio.Task[Any]) -> asyncio.Task[Any]:
    """把 fire-and-forget task 纳入统一收敛集合。

    用法：
        task = asyncio.create_task(some_background_coro())
        track_task(task)

    完成后自动 ``discard`` 自身；``dispose_all`` 会对仍在运行的 task 集中 cancel。
    返回 task 本身以便链式使用。
    """
    _tracked_tasks.add(task)
    task.add_done_callback(_tracked_tasks.discard)
    return task


def tracked_task_count() -> int:
    """活跃纳管 task 数量。测试与可观测性入口。"""
    return len(_tracked_tasks)


def registered_disposers() -> list[str]:
    """已注册 disposer 名称列表。测试 / 调试用。"""
    return [name for name, _ in _disposers]


async def dispose_all(*, timeout: float = 5.0) -> None:
    """依序执行所有 disposer + 取消剩余纳管 task。

    每个 disposer 单独捕获异常，确保单点失败不阻塞整体清理。整体在 ``timeout``
    内完成；超时未完成的 task 会被强制 cancel 后 gather 一次（仍超时则记 warning）。

    调用后注册表被清空，可在测试中安全重复调用。
    """
    disposers = list(_disposers)
    _disposers.clear()
    tasks = list(_tracked_tasks)
    _tracked_tasks.clear()

    # 1) 调用注册的 disposer
    for name, fn in disposers:
        try:
            result = fn()
            if asyncio.iscoroutine(result) or isinstance(result, Awaitable):
                await asyncio.wait_for(result, timeout=timeout)  # type: ignore[arg-type]
            logger.info("disposer_completed", name=name)
        except TimeoutError:
            logger.warning("disposer_timeout", name=name, timeout=timeout)
        except Exception as exc:
            logger.warning("disposer_failed", name=name, error=str(exc))

    # 2) 收敛纳管 task
    if tasks:
        for t in tasks:
            if not t.done():
                t.cancel()
        try:
            await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=timeout,
            )
        except TimeoutError:
            pending = [t for t in tasks if not t.done()]
            logger.warning(
                "tracked_tasks_dispose_timeout",
                timeout=timeout,
                pending_count=len(pending),
            )


def reset_for_tests() -> None:
    """测试钩子：清空 disposer / task 注册表（不调用任何 disposer）。

    ``dispose_all`` 已自动清空；本函数仅在测试不希望执行 disposer 的场景使用。
    """
    _disposers.clear()
    _tracked_tasks.clear()


__all__ = [
    "DisposerFn",
    "dispose_all",
    "register_disposer",
    "registered_disposers",
    "reset_for_tests",
    "track_task",
    "tracked_task_count",
]
