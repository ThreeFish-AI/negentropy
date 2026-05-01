"""
AsyncScheduler: 应用层 asyncio 周期任务调度器

当 pg_cron 不可用时（如托管数据库、云环境），提供应用内调度能力。

门控策略（借鉴 Claude Code AutoDream 三重门控）：
- 时间门控：距上次执行 >= 配置的间隔
- 锁：通过 callback 自行管理（通常用 DB 行级锁或 status 字段）

参考文献:
[1] Claude Code autoDream.ts — 三重门控调度（时间 + 会话数 + PID 锁）
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.schedulers.async_scheduler")

# 默认检查间隔（秒）
_DEFAULT_POLL_INTERVAL = 60


@dataclass
class ScheduledJob:
    """调度任务定义"""

    key: str
    callback: Callable[[], Awaitable[Any]]
    interval_seconds: float
    last_run_at: float = 0.0
    running: bool = False


class AsyncScheduler:
    """应用层 asyncio 周期任务调度器

    在没有 pg_cron 的环境中提供等效的定时任务执行能力。
    """

    def __init__(self, poll_interval: float = _DEFAULT_POLL_INTERVAL) -> None:
        self._poll_interval = poll_interval
        self._jobs: dict[str, ScheduledJob] = {}
        self._task: asyncio.Task | None = None
        self._running = False
        self._inflight: set[asyncio.Task] = set()

    def register(
        self,
        *,
        key: str,
        callback: Callable[[], Awaitable[Any]],
        interval_seconds: float,
    ) -> None:
        """注册周期任务"""
        self._jobs[key] = ScheduledJob(
            key=key,
            callback=callback,
            interval_seconds=interval_seconds,
        )
        logger.info(
            "scheduler_job_registered",
            key=key,
            interval_seconds=interval_seconds,
        )

    def unregister(self, key: str) -> None:
        """移除周期任务"""
        if key in self._jobs:
            del self._jobs[key]
            logger.info("scheduler_job_unregistered", key=key)

    def start(self) -> None:
        """启动调度循环"""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("scheduler_started", jobs=list(self._jobs.keys()))

    def stop(self) -> None:
        """停止调度循环，同时取消所有在途任务"""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = None
        for t in list(self._inflight):
            t.cancel()
        self._inflight.clear()
        logger.info("scheduler_stopped")

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def registered_jobs(self) -> list[str]:
        return list(self._jobs.keys())

    async def _run_loop(self) -> None:
        """调度主循环"""
        while self._running:
            now = time.monotonic()
            for _key, job in list(self._jobs.items()):
                if job.running:
                    continue
                elapsed = now - job.last_run_at
                if elapsed >= job.interval_seconds:
                    t = asyncio.create_task(self._execute_job(job))
                    self._inflight.add(t)
                    t.add_done_callback(self._inflight.discard)
            await asyncio.sleep(self._poll_interval)

    async def _execute_job(self, job: ScheduledJob) -> None:
        """执行单个调度任务"""
        job.running = True
        prev_run_at = job.last_run_at
        job.last_run_at = time.monotonic()
        try:
            await job.callback()
            logger.debug("scheduler_job_completed", key=job.key)
        except asyncio.CancelledError:
            job.last_run_at = prev_run_at
            raise
        except Exception as exc:
            job.last_run_at = prev_run_at  # 回退，允许尽快重试
            logger.warning(
                "scheduler_job_failed",
                key=job.key,
                error=str(exc),
            )
        finally:
            job.running = False
