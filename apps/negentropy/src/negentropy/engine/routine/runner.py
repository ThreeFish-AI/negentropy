"""Routine 后台执行器 — 进程内 asyncio.Task 注册表 + 全局并发信号量。

职责：把「长耗时的 Claude Code 调用」从 Inspector 心跳 tick 中剥离，作为后台任务运行，
使心跳 tick 始终轻量快速。每个迭代一个 asyncio.Task，受全局信号量限流；任务完成时
把执行结果原子写回 ``routine_iterations`` 并更新父 ``routines`` 的反规范化累计。

崩溃恢复：迭代携带 ``lease_expires_at``（= 执行超时 + slack）。进程崩溃后本注册表清空，
Orchestrator reaper 据 lease 过期 + 本注册表不再持有，将孤儿迭代标记 reaped 并重新派发。

单一所有者假设（重要）：进程内 ``_runners`` dict 与信号量仅在本进程可见，故 Routine
编排要求**单 engine 进程**持有（与 Scheduler Registry 同进程同 loop）。多进程部署下，
B 进程的 reaper 可能误判 A 进程仍在执行的迭代为孤儿——``is_running`` 仅反映本进程。
单进程内的并发安全由以下三重兜底保证：① Scheduler 心跳的 ``job.running`` 标志 + DB lease
使 ``inspect_once`` 不自重入；② 每 routine 单在途迭代检查；③ ``_do_write_back`` 仅在迭代
仍为 ``in_flight`` 时翻转并计数（条件 UPDATE），防止 reaped/aborted 迭代被复活或双计。
``uq_routine_iterations_seq`` + seq 取实际 MAX 为 seq 唯一性兜底。
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import update

import negentropy.db.session as db_session
from negentropy.engine.claude_code.models import ClaudeCodeConfig
from negentropy.engine.claude_code.service import ClaudeCodeService
from negentropy.logging import get_logger
from negentropy.models.routine import Routine, RoutineIteration

from .bus import get_bus

logger = get_logger("negentropy.engine.routine.runner")


def _utcnow() -> datetime:
    return datetime.now(UTC)


class RoutineRunner:
    """进程内后台执行器注册表（单例，懒创建于运行 loop）。"""

    def __init__(self, *, max_concurrent: int = 2) -> None:
        self._max_concurrent = max_concurrent
        self._semaphore: asyncio.Semaphore | None = None
        self._runners: dict[UUID, asyncio.Task] = {}
        self._aborts: dict[UUID, asyncio.Event] = {}

    def _get_semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self._max_concurrent)
        return self._semaphore

    @property
    def active_count(self) -> int:
        return len(self._runners)

    @property
    def max_concurrent(self) -> int:
        return self._max_concurrent

    def has_capacity(self) -> bool:
        return len(self._runners) < self._max_concurrent

    def available_slots(self) -> int:
        """剩余可启动名额（全局并发上限 - 当前在途）。"""
        return max(0, self._max_concurrent - len(self._runners))

    def is_running(self, iteration_id: UUID) -> bool:
        return iteration_id in self._runners

    def launch(
        self,
        *,
        iteration_id: UUID,
        routine_id: UUID,
        prompt: str,
        config: ClaudeCodeConfig,
    ) -> None:
        """非阻塞启动一次后台执行。立即返回；结果在任务完成时写回 DB。"""
        if iteration_id in self._runners:
            logger.debug("routine_runner_already_running", iteration_id=str(iteration_id))
            return

        abort = asyncio.Event()
        self._aborts[iteration_id] = abort
        task = asyncio.create_task(
            self._run(iteration_id, routine_id, prompt, config, abort),
            name=f"routine-iter-{iteration_id}",
        )
        self._runners[iteration_id] = task

        def _cleanup(_t: asyncio.Task, _iid: UUID = iteration_id) -> None:
            self._runners.pop(_iid, None)
            self._aborts.pop(_iid, None)

        task.add_done_callback(_cleanup)

    def request_abort(self, iteration_id: UUID) -> bool:
        """请求中止某个在途迭代（用户 pause/cancel）。返回是否命中本进程任务。"""
        abort = self._aborts.get(iteration_id)
        if abort is not None:
            abort.set()
            return True
        return False

    async def _run(
        self,
        iteration_id: UUID,
        routine_id: UUID,
        prompt: str,
        config: ClaudeCodeConfig,
        abort: asyncio.Event,
    ) -> None:
        async with self._get_semaphore():
            if abort.is_set():
                await self._mark_aborted(iteration_id)
                return
            # 1) 翻转 in_flight + 设置 lease
            lease = _utcnow() + timedelta(seconds=config.timeout_seconds + 60)
            await self._mark_in_flight(iteration_id, lease)
            await get_bus().publish(
                {"type": "iteration", "id": str(iteration_id), "routine_id": str(routine_id), "status": "in_flight"}
            )

            # 2) 执行 Claude Code（长耗时，受 config.timeout_seconds 约束）
            result = await ClaudeCodeService.invoke(prompt, config, abort_event=abort)

            # 3) 写回结果（abort 命中则标记 aborted，否则 executed）
            if abort.is_set():
                await self._mark_aborted(iteration_id)
                await get_bus().publish(
                    {"type": "iteration", "id": str(iteration_id), "routine_id": str(routine_id), "status": "aborted"}
                )
                return

            await self._write_back(iteration_id, routine_id, result)
            await get_bus().publish(
                {
                    "type": "iteration",
                    "id": str(iteration_id),
                    "routine_id": str(routine_id),
                    "status": "executed",
                    "exec_status": result.status,
                    "cost_usd": result.cost_usd,
                    "turn_count": result.turn_count,
                }
            )

    async def _mark_in_flight(self, iteration_id: UUID, lease: datetime) -> None:
        async with db_session.AsyncSessionLocal() as db:
            await db.execute(
                update(RoutineIteration)
                .where(RoutineIteration.id == iteration_id)
                .values(status="in_flight", started_at=_utcnow(), lease_expires_at=lease)
            )
            await db.commit()

    async def _mark_aborted(self, iteration_id: UUID) -> None:
        async with db_session.AsyncSessionLocal() as db:
            await db.execute(
                update(RoutineIteration)
                .where(RoutineIteration.id == iteration_id)
                .values(status="aborted", finished_at=_utcnow(), lease_expires_at=None)
            )
            await db.commit()

    async def _write_back(self, iteration_id: UUID, routine_id: UUID, result) -> None:
        """原子写回执行结果 + 更新父 routine 反规范化累计。

        用 ``asyncio.shield`` 包裹，避免关停取消时丢失已完成的 Claude Code 结果。
        """
        await asyncio.shield(self._do_write_back(iteration_id, routine_id, result))

    async def _do_write_back(self, iteration_id: UUID, routine_id: UUID, result) -> None:
        exec_status = "success" if result.status == "success" else result.status  # success|error|timeout
        async with db_session.AsyncSessionLocal() as db:
            # 仅当迭代仍处于 in_flight 时才翻转为 executed：若期间已被 reaper 标记 reaped
            # 或被用户 abort，rowcount=0，则不再覆盖终态、也不重复累加计数/成本（防双计）。
            res = await db.execute(
                update(RoutineIteration)
                .where(RoutineIteration.id == iteration_id, RoutineIteration.status == "in_flight")
                .values(
                    status="executed",
                    exec_status=exec_status,
                    summary=result.summary or None,
                    claude_session_id=result.session_id,
                    cost_usd=result.cost_usd or 0.0,
                    turn_count=result.turn_count or 0,
                    exec_error=result.error,
                    finished_at=_utcnow(),
                    lease_expires_at=None,
                )
            )
            if res.rowcount == 1:
                # 父 routine 累计：成本累加、迭代计数 +1、会话续接（仅成功转换时）
                routine = await db.get(Routine, routine_id)
                if routine is not None:
                    routine.total_cost_usd = (routine.total_cost_usd or 0.0) + (result.cost_usd or 0.0)
                    routine.iteration_count = (routine.iteration_count or 0) + 1
                    if result.session_id:
                        routine.claude_session_id = result.session_id
            await db.commit()


# 进程内单例
_GLOBAL_RUNNER: RoutineRunner | None = None


def get_runner(*, max_concurrent: int | None = None) -> RoutineRunner:
    """获取进程内 RoutineRunner 单例（懒创建）。

    首次创建时的并发上限优先级：显式入参 > ``settings.routine.max_concurrent_executions``。
    后续调用沿用既有实例（并发上限不可热改）。
    """
    global _GLOBAL_RUNNER
    if _GLOBAL_RUNNER is None:
        if max_concurrent is None:
            from negentropy.config import settings

            max_concurrent = settings.routine.max_concurrent_executions
        _GLOBAL_RUNNER = RoutineRunner(max_concurrent=max_concurrent)
    return _GLOBAL_RUNNER


def reset_runner() -> None:
    """测试辅助：清空单例。"""
    global _GLOBAL_RUNNER
    _GLOBAL_RUNNER = None


__all__ = ["RoutineRunner", "get_runner", "reset_runner"]
