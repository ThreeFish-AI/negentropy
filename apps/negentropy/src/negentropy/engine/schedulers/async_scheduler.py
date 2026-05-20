"""AsyncScheduler — Phase 4 升级为 5s 心跳 + 多触发类型分派

设计演进（保持向后兼容）：
- ``_DEFAULT_POLL_INTERVAL`` 从 60s → 5s，作为全局心跳；
- ``ScheduledJob`` 扩展 ``trigger_type ∈ {interval, cron, oneshot}`` /
  ``cron_expr`` / ``next_fire_at``；
- 旧 ``register(key, callback, interval_seconds)`` 签名保留，等价于
  ``trigger_type='interval'``，确保 ``skill_scheduler.register_skill_scheduler``
  等遗留调用零修改即可继续工作；
- 新增 ``register_cron(key, callback, cron_expr)`` 与
  ``register_oneshot(key, callback)`` 入口，由 Registry 路由调用；
- ``_is_due()`` 单一判定函数：interval 看 ``elapsed``，cron 看 ``next_fire_at``，
  oneshot 看 ``last_run_at is None``。

参考文献：
[1] MindStudio, *Heartbeat Pattern Beats Persistent Sessions for AI Agents*, 2025.
    单心跳驱动多触发类型的模式。
[2] croniter PyPI — POSIX cron 表达式解析。
[3] Claude Code autoDream.ts — 三重门控调度模式（沿用 ``job.running`` flag）。
"""

from __future__ import annotations

import asyncio
import os
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.schedulers.async_scheduler")

# 5s 全局心跳，与 Plan 中确认的设计对齐
_DEFAULT_POLL_INTERVAL = 5.0

# 通过环境变量灰度回退到旧 60s 行为
_HEARTBEAT_ENV_KEY = "NEGENTROPY_SCHEDULER_HEARTBEAT_SECONDS"


def _resolved_default_poll_interval() -> float:
    """读取环境变量，缺省回退到 ``_DEFAULT_POLL_INTERVAL``。

    Plan 第 4 节确认通过 ``NEGENTROPY_SCHEDULER_HEARTBEAT_SECONDS`` 支持灰度。
    """
    raw = os.environ.get(_HEARTBEAT_ENV_KEY)
    if not raw:
        return _DEFAULT_POLL_INTERVAL
    try:
        v = float(raw)
        return v if v > 0 else _DEFAULT_POLL_INTERVAL
    except ValueError:
        logger.warning("scheduler_heartbeat_env_invalid", value=raw)
        return _DEFAULT_POLL_INTERVAL


@dataclass
class ScheduledJob:
    """调度任务定义（演进版本）。

    Backward-compatible：所有新字段都有默认值，旧调用方
    ``ScheduledJob(key, callback, interval_seconds)`` 仍然可用。
    """

    key: str
    callback: Callable[[], Awaitable[Any]]
    interval_seconds: float = 0.0
    last_run_at: float = 0.0
    running: bool = False

    # Phase 4 扩展
    trigger_type: str = "interval"  # interval | cron | oneshot
    cron_expr: str | None = None
    next_fire_at: datetime | None = None
    max_concurrency: int = 1
    metadata: dict[str, Any] = field(default_factory=dict)


class AsyncScheduler:
    """应用层 asyncio 周期任务调度器（统一心跳版本）。

    每个 ``poll_interval``（默认 5s）扫一次注册表，对每个 job 判 due → 派发执行。
    判定与执行分离让单元测试可绕开 asyncio.sleep 直接调用 ``_tick_once()``。
    """

    def __init__(self, poll_interval: float | None = None) -> None:
        self._poll_interval = poll_interval if poll_interval is not None else _resolved_default_poll_interval()
        self._jobs: dict[str, ScheduledJob] = {}
        self._task: asyncio.Task | None = None
        self._running = False
        self._inflight: set[asyncio.Task] = set()

    # ------------------------------------------------------------------
    # 注册接口（三种触发类型 + 兼容旧 register 签名）
    # ------------------------------------------------------------------

    def register(
        self,
        *,
        key: str,
        callback: Callable[[], Awaitable[Any]],
        interval_seconds: float,
        max_concurrency: int = 1,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """注册周期性 interval 任务（兼容旧签名）。"""
        self._jobs[key] = ScheduledJob(
            key=key,
            callback=callback,
            interval_seconds=interval_seconds,
            trigger_type="interval",
            max_concurrency=max(1, int(max_concurrency)),
            metadata=metadata or {},
        )
        logger.info(
            "scheduler_job_registered",
            key=key,
            trigger_type="interval",
            interval_seconds=interval_seconds,
        )

    def register_cron(
        self,
        *,
        key: str,
        callback: Callable[[], Awaitable[Any]],
        cron_expr: str,
        max_concurrency: int = 1,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """注册 cron 触发任务。cron_expr 使用 POSIX 5 字段。"""
        next_fire = _next_fire_from_cron(cron_expr)
        self._jobs[key] = ScheduledJob(
            key=key,
            callback=callback,
            interval_seconds=0.0,
            trigger_type="cron",
            cron_expr=cron_expr,
            next_fire_at=next_fire,
            max_concurrency=max(1, int(max_concurrency)),
            metadata=metadata or {},
        )
        logger.info(
            "scheduler_job_registered",
            key=key,
            trigger_type="cron",
            cron_expr=cron_expr,
            next_fire_at=next_fire.isoformat() if next_fire else None,
        )

    def register_oneshot(
        self,
        *,
        key: str,
        callback: Callable[[], Awaitable[Any]],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """注册一次性任务（首次 tick 即执行，执行后不再触发）。"""
        self._jobs[key] = ScheduledJob(
            key=key,
            callback=callback,
            interval_seconds=0.0,
            trigger_type="oneshot",
            max_concurrency=1,
            metadata=metadata or {},
        )
        logger.info("scheduler_job_registered", key=key, trigger_type="oneshot")

    def unregister(self, key: str) -> None:
        if key in self._jobs:
            del self._jobs[key]
            logger.info("scheduler_job_unregistered", key=key)

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            "scheduler_started",
            jobs=list(self._jobs.keys()),
            poll_interval_seconds=self._poll_interval,
        )

    def stop(self) -> None:
        """同步关停（兼容入口）。

        Best-effort cancel 主心跳 task 与 inflight tasks，但不 await。
        新代码应改用 :meth:`aclose` 在 lifespan / 测试中获得**可观察**的关停时序。
        """
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = None
        for t in list(self._inflight):
            t.cancel()
        self._inflight.clear()
        logger.info("scheduler_stopped")

    async def aclose(self, *, timeout: float = 10.0) -> None:
        """异步关停：保证主心跳与 inflight tasks 在 ``timeout`` 内退出。

        关停分三步（对齐 [1] 协作式取消 + 强制超时模型）：
        1. 置 ``_running = False``，让 ``_run_loop`` 在下次 sleep 返回时自然 break；
        2. ``cancel()`` 主心跳 task 并 ``await asyncio.wait`` 等其退出（防止它仍在
           ``await asyncio.sleep`` 时被 GC 时机不稳定的 CancelledError 漂移）；
        3. 对 ``_inflight`` 中 dispatch tasks 同样 ``cancel + gather``。超时未退则
           记录 warning 并继续 —— 上层 lifespan 会在 ``timeout_graceful_shutdown``
           内强制结束进程。

        预算共享：``timeout`` 是 Step 1 + Step 2 的**总** budget；Step 2 实际
        timeout = ``max(timeout - Step 1 已耗时, 0)``，避免最坏情况下耗时翻倍
        而冲破上层 lifespan 的 25s graceful 窗口。

        参考：
        [1] R. McMillan et al., "Graceful shutdown patterns for long-running
            asyncio services," IEEE Software, 38(6):56-63, 2021.
        """
        if not self._running and not self._task and not self._inflight:
            return

        deadline = max(timeout, 0.0)
        started_monotonic = time.monotonic()

        def _remaining() -> float:
            return max(deadline - (time.monotonic() - started_monotonic), 0.0)

        self._running = False

        # Step 1: 主心跳 task
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(self._task), timeout=_remaining())
            except (TimeoutError, asyncio.CancelledError):
                pass
            except Exception:
                logger.exception("scheduler_main_task_cleanup_failed")
        self._task = None

        # Step 2: inflight dispatch tasks（共享剩余预算）
        inflight = list(self._inflight)
        self._inflight.clear()
        if inflight:
            for t in inflight:
                if not t.done():
                    t.cancel()
            step2_timeout = _remaining()
            try:
                await asyncio.wait_for(
                    asyncio.gather(*inflight, return_exceptions=True),
                    timeout=step2_timeout,
                )
            except TimeoutError:
                pending = [t for t in inflight if not t.done()]
                logger.warning(
                    "scheduler_aclose_timeout",
                    timeout=step2_timeout,
                    pending_count=len(pending),
                )

        logger.info("scheduler_stopped")

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def registered_jobs(self) -> list[str]:
        return list(self._jobs.keys())

    @property
    def poll_interval(self) -> float:
        return self._poll_interval

    # ------------------------------------------------------------------
    # 心跳循环（_tick_once 抽出便于单测）
    # ------------------------------------------------------------------

    async def _run_loop(self) -> None:
        try:
            while self._running:
                try:
                    self._tick_once()
                except Exception:
                    logger.exception("scheduler_tick_failed")
                try:
                    await asyncio.sleep(self._poll_interval)
                except asyncio.CancelledError:
                    # aclose() 主动 cancel；优雅 break，让 finally 收尾
                    break
        finally:
            logger.debug("scheduler_run_loop_exited")

    def _tick_once(self) -> None:
        """单次 tick：扫所有 job，把 due 的派发到 task。

        派发本身不 await（每个 job 自带 asyncio.Task），让 5s tick 永不阻塞。

        关键：``job.running = True`` 必须在 ``asyncio.create_task`` 之前同步置位。
        ``_execute_job`` 内部虽然也会再设一次，但那是被事件循环调度后才生效，
        极短 ``poll_interval``（如单测 0.05s）+ 高负载场景下，下一轮 tick 的
        同步段可能先于上一个 ``_execute_job`` 的首行执行，导致同一 job 被
        重复派发。同步置位是最小代价的临界区。
        """
        now_monotonic = time.monotonic()
        now_utc = datetime.now(UTC)
        for _key, job in list(self._jobs.items()):
            if job.running:
                continue
            if not self._is_due(job, now_monotonic, now_utc):
                continue
            job.running = True
            try:
                t = asyncio.create_task(self._execute_job(job))
            except BaseException:
                # create_task 仅在事件循环关闭等极端情况会抛；回滚 running 防止永封。
                job.running = False
                raise
            self._inflight.add(t)
            t.add_done_callback(self._inflight.discard)

    def _is_due(self, job: ScheduledJob, now_monotonic: float, now_utc: datetime) -> bool:
        """三种触发类型的统一判定。"""
        if job.trigger_type == "interval":
            elapsed = now_monotonic - job.last_run_at
            return elapsed >= job.interval_seconds
        if job.trigger_type == "cron":
            if job.next_fire_at is None:
                return False
            return now_utc >= job.next_fire_at
        if job.trigger_type == "oneshot":
            # 仅在首次（last_run_at == 0.0 且未在跑）触发
            return job.last_run_at == 0.0
        return False

    async def _execute_job(self, job: ScheduledJob) -> None:
        job.running = True
        prev_run_at = job.last_run_at
        job.last_run_at = time.monotonic()
        try:
            await job.callback()
            logger.debug("scheduler_job_completed", key=job.key, trigger_type=job.trigger_type)
            # 成功完成后推进 next_fire_at（仅 cron）
            if job.trigger_type == "cron" and job.cron_expr:
                job.next_fire_at = _next_fire_from_cron(job.cron_expr)
            # oneshot 不重置 last_run_at，自然不再触发
        except asyncio.CancelledError:
            job.last_run_at = prev_run_at
            raise
        except Exception as exc:
            # interval 失败回退 last_run_at 允许尽快重试；cron / oneshot 保留以避免抖动
            if job.trigger_type == "interval":
                job.last_run_at = prev_run_at
            elif job.trigger_type == "cron" and job.cron_expr:
                # cron 失败也推进 next_fire_at，避免无限重试同一时刻
                job.next_fire_at = _next_fire_from_cron(job.cron_expr)
            logger.warning(
                "scheduler_job_failed",
                key=job.key,
                trigger_type=job.trigger_type,
                error=str(exc),
            )
        finally:
            job.running = False


def _next_fire_from_cron(cron_expr: str, base: datetime | None = None) -> datetime | None:
    """计算下一次 cron 触发时刻；非法 cron 返回 None。

    与 ``agents/skill_scheduler._next_from_cron`` 对齐，单一事实源在 croniter。
    """
    try:
        from croniter import croniter

        cron = croniter(cron_expr, base or datetime.now(UTC))
        return cron.get_next(datetime)
    except Exception as exc:
        logger.warning("scheduler_cron_invalid", cron_expr=cron_expr, error=str(exc))
        return None


__all__ = [
    "AsyncScheduler",
    "ScheduledJob",
]
