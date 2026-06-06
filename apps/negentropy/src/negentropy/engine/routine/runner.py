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
import copy
import time
from contextlib import suppress
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as pg_insert

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.engine.claude_code.models import ClaudeCodeConfig
from negentropy.engine.claude_code.service import (
    ERROR_KIND_CONTEXT_EXHAUSTED,
    ERROR_KIND_SESSION_NOT_FOUND,
    ClaudeCodeService,
)
from negentropy.logging import get_logger
from negentropy.models.routine import Routine, RoutineIteration, RoutineIterationEvent

from .bus import get_bus
from .streaming_persister import StreamingEventPersister

logger = get_logger("negentropy.engine.routine.runner")


def _utcnow() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# 迭代内上下文压缩续接辅助函数
# ---------------------------------------------------------------------------

_COMPACT_RETRY_PROMPT_TEMPLATE = (
    "# 上下文续接 (Context Continuation)\n\n"
    "上一次 Claude Code 会话因上下文窗口耗尽被自动压缩重启。\n"
    "以下是压缩前的执行摘要，请据此继续推进任务。\n\n"
    "## 原始任务\n{original_prompt}\n\n"
    "## 已完成的工作摘要\n{summary}\n\n"
    "## 指令\n"
    "请从上述摘要断点继续工作，聚焦尚未完成的验收标准项。"
    "不要重复已完成的工作。所有文件变更已持久化在当前工作目录中。"
)


def _build_compact_retry_prompt(result, original_prompt: str) -> str:
    """构建上下文耗尽后的迭代内续接 prompt。

    将原始任务 prompt + CC 返回的执行摘要合成为续接 prompt，
    使新 CC 会话能在无历史上下文的情况下从断点继续工作。
    """
    summary = (result.summary or "")[:2000]
    return _COMPACT_RETRY_PROMPT_TEMPLATE.format(original_prompt=original_prompt, summary=summary)


def _reset_config_for_retry(config: ClaudeCodeConfig) -> ClaudeCodeConfig:
    """克隆配置但清空 session 续接，强制 CC 以新会话启动。

    使用 ``copy.copy`` 浅拷贝：ClaudeCodeConfig 的字段均为不可变类型或
    由调用方自行管理的容器（``allowed_tools`` 等），浅拷贝语义安全。
    """
    new = copy.copy(config)
    new.resume_session_id = None  # 强制新会话
    return new


def _with_reduced_timeout(config: ClaudeCodeConfig, remaining_seconds: float) -> ClaudeCodeConfig:
    """克隆配置并设置剩余超时时间（下限 60s 防无意义短命重试）。"""
    new = copy.copy(config)
    new.timeout_seconds = max(60.0, remaining_seconds)
    return new


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
            #    capture_events 开启时附 on_event sink：每个动作经非阻塞总线实时发布（边跑边看）。
            #    StreamingEventPersister 增量 flush：使页面 reload 后仍可见已完成的审计步骤。
            #    迭代内上下文压缩重试：当 CC context 耗尽时，不清空迭代、在同迭代内以新 session 续接，
            #    通过续接 prompt 传递已完成工作摘要，使任务在当前迭代内继续推进。
            persister: StreamingEventPersister | None = None
            if settings.routine.capture_events:
                persister = StreamingEventPersister(
                    iteration_id, routine_id, flush_interval_seconds=settings.routine.event_streaming_flush_seconds
                )
                persister.start()
            sink = (
                self._make_action_sink(iteration_id, routine_id, persister) if settings.routine.capture_events else None
            )

            compact_max_retries = (
                settings.routine.context_compact_max_retries if settings.routine.context_compact_enabled else 0
            )
            compact_retry_count = 0
            # 会话失效（session_not_found）迭代内冷启动重试：独立于上下文压缩开关，因为续接会话
            # 已彻底不存在、再 resume 永不可能成功，必须清空 session 冷启动。预算固定为 2。
            session_retry_count = 0
            session_max_retries = 2
            cumulative_cost = 0.0
            cumulative_turns = 0
            overall_deadline = time.monotonic() + config.timeout_seconds
            result = None

            try:
                while True:
                    # 重试时检查剩余时间是否足够（至少 60s，防无意义短命重试）
                    remaining = overall_deadline - time.monotonic()
                    retried = compact_retry_count > 0 or session_retry_count > 0
                    if remaining < 60 and retried:
                        logger.warning("routine_retry_timeout_exhausted", remaining_s=round(remaining, 1))
                        break

                    invoke_config = config if not retried else _with_reduced_timeout(config, remaining)
                    result = await ClaudeCodeService.invoke(prompt, invoke_config, abort_event=abort, on_event=sink)
                    cumulative_cost += result.cost_usd or 0.0
                    cumulative_turns += result.turn_count or 0

                    kind = getattr(result, "error_kind", None)
                    # 成功或非可恢复错误：直接退出循环
                    if result.status == "success" or kind not in (
                        ERROR_KIND_CONTEXT_EXHAUSTED,
                        ERROR_KIND_SESSION_NOT_FOUND,
                    ):
                        break

                    # 会话失效：清空 session 冷启动重试，沿用原始 prompt（无工作产出，无需续接摘要）。
                    if kind == ERROR_KIND_SESSION_NOT_FOUND:
                        if session_retry_count >= session_max_retries:
                            logger.warning("routine_session_reset_retries_exhausted", retries=session_retry_count)
                            break
                        session_retry_count += 1
                        logger.info(
                            "routine_session_reset_retry",
                            iteration_id=str(iteration_id),
                            retry=session_retry_count,
                            stale_session=invoke_config.resume_session_id,
                        )
                        config = _reset_config_for_retry(config)  # 清空 resume_session_id；prompt 保持原始
                        continue

                    # 上下文耗尽但重试次数已用尽：退出循环（回退到 Layer 3 跨迭代冷启动）
                    if compact_retry_count >= compact_max_retries:
                        logger.info(
                            "routine_compact_retries_exhausted",
                            retries=compact_retry_count,
                            max_retries=compact_max_retries,
                        )
                        break

                    # 上下文耗尽迭代内重试：清空 session（强制新会话）+ 构建续接 prompt
                    compact_retry_count += 1
                    logger.info(
                        "routine_compact_retry",
                        iteration_id=str(iteration_id),
                        retry=compact_retry_count,
                        max_retries=compact_max_retries,
                        previous_session=result.session_id,
                    )
                    prompt = _build_compact_retry_prompt(result, prompt)
                    config = _reset_config_for_retry(config)
            finally:
                if persister is not None:
                    await persister.finalize()

            # 累积 cost/turns 覆盖到最终 result（跨重试汇总）
            if result is not None:
                result.cost_usd = cumulative_cost
                result.turn_count = cumulative_turns

            # 3) 写回结果（abort 命中则标记 aborted，否则 executed）
            if abort.is_set():
                await self._mark_aborted(iteration_id)
                await get_bus().publish(
                    {"type": "iteration", "id": str(iteration_id), "routine_id": str(routine_id), "status": "aborted"}
                )
                return

            await self._write_back(
                iteration_id,
                routine_id,
                result,
                compact_retry_count=compact_retry_count,
                session_retry_count=session_retry_count,
            )
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

    @staticmethod
    def _make_action_sink(iteration_id: UUID, routine_id: UUID, persister: StreamingEventPersister | None = None):
        """构造「全过程」动作实时发布回调：每个归一化动作经非阻塞总线广播为 ``action`` 事件。

        best-effort：``RoutineBus.publish`` 为 ``put_nowait`` + 丢旧，绝不阻塞 CC 执行；
        异常一律 suppress（实时是增强，持久化端点才是事实源）。事件携带 ``seq``（服务定格，
        与写回持久化一致），前端据 ``(iteration_id, seq)`` 去重合并实时与历史动作。
        当 ``persister`` 非空时同步追加到缓冲，由后台定时器增量刷入 DB。
        """
        rid, iid = str(routine_id), str(iteration_id)

        async def _sink(evt: dict[str, Any]) -> None:
            with suppress(Exception):
                # ts：服务端 emit 时刻（与持久化 created_at 同为服务端时间），供前端为在途行渲染时间戳；
                # 仅注入发布载荷，不污染用于写回持久化的 result.events（其时间走 DB server_default）。
                await get_bus().publish(
                    {"type": "action", "routine_id": rid, "iteration_id": iid, "ts": _utcnow().isoformat(), **evt}
                )
            if persister is not None:
                persister.buffer(evt)

        return _sink

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

    async def _write_back(
        self,
        iteration_id: UUID,
        routine_id: UUID,
        result,
        *,
        compact_retry_count: int = 0,
        session_retry_count: int = 0,
    ) -> None:
        """原子写回执行结果 + 更新父 routine 反规范化累计。

        用 ``asyncio.shield`` 包裹，避免关停取消时丢失已完成的 Claude Code 结果。
        ``compact_retry_count`` 记录迭代内上下文压缩重试次数；``session_retry_count`` 记录会话失效
        冷启动重试次数；均写入 iteration metrics。
        """
        await asyncio.shield(
            self._do_write_back(
                iteration_id,
                routine_id,
                result,
                compact_retry_count=compact_retry_count,
                session_retry_count=session_retry_count,
            )
        )

    async def _do_write_back(
        self,
        iteration_id: UUID,
        routine_id: UUID,
        result,
        *,
        compact_retry_count: int = 0,
        session_retry_count: int = 0,
    ) -> None:
        exec_status = "success" if result.status == "success" else result.status  # success|error|timeout
        # 检查点提交所需快照（事务内捕获，commit 后在事务外执行 git I/O，不持 DB 事务）。
        checkpoint_path: str | None = None
        checkpoint_seq: int | None = None
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
                # 上下文耗尽判定（根因：原实现无条件回写 session_id，把 routine 永久钉死在已耗尽
                # 的会话，导致 resume 后每轮立即撞上下文上限的"死亡螺旋"）。提前到 routine 取用之前
                # 计算，使 routine 缺失时下方 iteration 标记块仍能安全引用。
                error_kind = getattr(result, "error_kind", None)
                is_ctx = error_kind == ERROR_KIND_CONTEXT_EXHAUSTED
                # 会话失效：迭代内冷启动重试发生过（session_retry_count>0），或最终结果仍为会话失效。
                is_session_gone = error_kind == ERROR_KIND_SESSION_NOT_FOUND or session_retry_count > 0
                # 父 routine 累计：成本累加、迭代计数 +1、会话续接。
                routine = await db.get(Routine, routine_id)
                if routine is not None:
                    routine.total_cost_usd = (routine.total_cost_usd or 0.0) + (result.cost_usd or 0.0)
                    routine.iteration_count = (routine.iteration_count or 0) + 1
                    # 检查点提交快照：worktree routine + 本轮执行成功 + 非 PLAN 相位（PLAN 只读无产物）。
                    # 引擎确定性 auto-commit，不依赖 CC 遵循 prompt（ISSUE-114）。
                    if (
                        settings.routine.checkpoint_commit_enabled
                        and exec_status == "success"
                        and getattr(routine, "worktree_path", None)
                        and getattr(routine, "current_phase", None) != "plan"
                    ):
                        checkpoint_path = routine.worktree_path
                        it_seq = await db.get(RoutineIteration, iteration_id)
                        checkpoint_seq = getattr(it_seq, "seq", None) if it_seq is not None else None
                    # 会话续接决策（优先级：会话失效 > 上下文耗尽 > 正常续接）：
                    if error_kind == ERROR_KIND_SESSION_NOT_FOUND:
                        # (0) 续接会话已彻底失效 → 无条件清空冷启动（再 resume 永不可能成功，
                        # 无 context_reset 上限语义；runaway 由 no_progress/max_iterations 守卫兜底）。
                        routine.claude_session_id = None
                    elif is_ctx:
                        resets = int((routine.reflections or {}).get("_context_resets", 0))
                        if resets < settings.routine.context_reset_max:
                            # (a) 上下文耗尽且未达上限 → 清空污染会话，使下轮在同 worktree 冷启动续干
                            # （prompt_builder 每轮全量注入 goal/criteria/reflections + worktree 上下文，
                            #  worktree 持久保留既往产出，故会话仅工作记忆而非正确性必需）。
                            routine.claude_session_id = None
                            routine.reflections = {**(routine.reflections or {}), "_context_resets": resets + 1}
                        else:
                            # (b) 达自动重置上限 → 不再清空，记标记，落回原 unrecoverable 自然路径（防 runaway）。
                            routine.reflections = {**(routine.reflections or {}), "_context_reset_exhausted": True}
                    elif result.session_id:
                        # (c) 非上述可恢复错误（含成功 / 普通 error / timeout）→ 维持原会话续接逻辑。
                        # 注：会话失效冷启动重试成功后 result.session_id 为新会话，经此分支正确续接。
                        routine.claude_session_id = result.session_id
                # 给 iteration 打可自愈标记：供 decision 将"可自愈失败"从连续失败计数剔除，避免被误判为
                # unrecoverable。同时记录迭代内重试次数（compact_retries / session_resets > 0 表示发生续接/冷启动）。
                if is_ctx or is_session_gone or compact_retry_count > 0:
                    it = await db.get(RoutineIteration, iteration_id)
                    if it is not None:
                        metrics = {**(it.metrics or {})}
                        if is_ctx:
                            metrics["context_exhausted"] = True
                        if is_session_gone:
                            metrics["session_reset"] = True
                        if compact_retry_count > 0:
                            metrics["compact_retries"] = compact_retry_count
                        if session_retry_count > 0:
                            metrics["session_retries"] = session_retry_count
                        it.metrics = metrics
            # 「全过程」动作事件持久化（reconciliation backstop）：
            # 不再受 rowcount==1 门控——即使迭代已被 reaper 标记 reaped，仍确保事件落库
            # （StreamingEventPersister 已增量刷入部分事件，此处补齐尾部 + 终态事件）。
            # ON CONFLICT DO NOTHING 使其与增量 flush 完全幂等。
            if settings.routine.capture_events and result.events:
                await self._persist_events(db, iteration_id, routine_id, result.events)
            await db.commit()

        # 检查点提交（事务外、best-effort）：成功 worktree 迭代后确定性 auto-commit，
        # 防 worktree 丢失致进度损毁 + 为 PR 留存提交历史（ISSUE-114）。异常不冒泡。
        if checkpoint_path:
            from . import workspace

            with suppress(Exception):
                await workspace.checkpoint_commit(checkpoint_path, settings.routine, seq=checkpoint_seq)

    @staticmethod
    async def _persist_events(db, iteration_id: UUID, routine_id: UUID, events: list[dict[str, Any]]) -> None:
        """批量落库执行动作事件（seq 由服务按到达顺序定格 0..N-1）。

        ``ON CONFLICT (iteration_id, seq) DO NOTHING`` 兜底 reaper / abort / 重复写回竞态，
        使任何二次写入为 no-op。字段做长度收口（防 String 列溢出）。
        """
        rows: list[dict[str, Any]] = []
        for i, evt in enumerate(events):
            title = evt.get("title")
            tool_name = evt.get("tool_name")
            rows.append(
                {
                    "iteration_id": iteration_id,
                    "routine_id": routine_id,
                    "seq": int(evt.get("seq", i)),
                    "event_type": str(evt.get("event_type") or "unknown")[:24],
                    "tool_name": str(tool_name)[:128] if tool_name is not None else None,
                    "title": str(title)[:255] if title is not None else None,
                    "payload": evt.get("payload") or {},
                    "cost_usd": evt.get("cost_usd"),
                }
            )
        if not rows:
            return
        stmt = (
            pg_insert(RoutineIterationEvent).values(rows).on_conflict_do_nothing(index_elements=["iteration_id", "seq"])
        )
        await db.execute(stmt)


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
