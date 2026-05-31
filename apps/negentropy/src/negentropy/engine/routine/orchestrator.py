"""RoutineOrchestrator — 长周期自主任务的主控制循环（Orchestrator + Evaluator）。

``inspect_once()`` 由 ``routine_inspector`` Scheduler 心跳每 tick 调用一次，执行三阶段：

  (a) REAP   — 清理崩溃遗留的孤儿在途迭代（lease 过期 + 本进程不再持有）。
  (b) EVAL   — 对已执行完毕的迭代评估 + 决策（成功/终止/继续）。
  (c) DISPATCH — 为运行中且预算未耗尽的 routine 派发下一迭代（后台 Runner 异步执行）。

设计要点：
- tick 轻量：阶段 (c) 仅创建迭代行 + 调用 ``runner.launch``（非阻塞），绝不内联等待
  Claude Code，确保心跳 handler 远低于其 60s 超时。
- 并发幂等：``FOR UPDATE SKIP LOCKED`` 抢占 routine 行 + 每 routine 单在途 +
  ``uq_routine_iterations_seq`` 唯一约束三重兜底。
- Human-in-the-Loop：``approval_mode`` 决定新迭代以 dispatched（自动）还是
  pending_approval（待审批）创建；后者不会被 launch，等待 API approve。

参考文献：
[1] Anthropic, *Building Effective AI Agents*, 2024. Evaluator-Optimizer / Orchestrator-Workers。
[2] PostgreSQL Docs, *FOR UPDATE SKIP LOCKED*. 并发 tick 幂等。
"""

from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.logging import get_logger
from negentropy.models.routine import Routine, RoutineIteration

from . import decision as decision_mod
from . import phase as phase_mod
from .bus import get_bus
from .evaluator import RoutineEvaluator
from .prompt_builder import append_reflection, build_prompt
from .runner import get_runner

logger = get_logger("negentropy.engine.routine.orchestrator")

# 非终态迭代状态（一个 routine 同时至多存在一个）
_NON_TERMINAL_ITER = ("pending_approval", "dispatched", "in_flight", "executed")
# 每 tick 评估/派发的 routine 批量上限，避免单 tick 过载
_BATCH_LIMIT = 10


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _lease_extension() -> timedelta:
    """本进程仍在执行时的 lease 顺延量（= inspector 间隔 + slack）。"""
    return timedelta(seconds=settings.routine.inspector_interval_seconds + settings.routine.lease_slack_seconds)


class RoutineOrchestrator:
    """Routine 编排器（进程内单例）。"""

    def __init__(self) -> None:
        self._evaluator = RoutineEvaluator(
            explicit_model=settings.routine.evaluator_model,
            gate_timeout_seconds=settings.routine.gate_timeout_seconds,
        )

    # ------------------------------------------------------------------
    # 主入口
    # ------------------------------------------------------------------
    async def inspect_once(self) -> dict[str, int]:
        """单次巡检：reap → evaluate → dispatch。返回各阶段计数（供 handler 汇报）。"""
        reaped = await self._reap_orphans()
        evaluated = await self._evaluate_and_decide()
        launched = await self._dispatch_due()
        return {"reaped": reaped, "evaluated": evaluated, "launched": launched}

    # ------------------------------------------------------------------
    # (a) REAP
    # ------------------------------------------------------------------
    async def _reap_orphans(self) -> int:
        """回收孤儿在途迭代：lease 过期且本进程 Runner 不再持有 → 标记 reaped。"""
        runner = get_runner()
        now = _utcnow()
        reaped = 0
        async with db_session.AsyncSessionLocal() as db:
            rows = (
                (
                    await db.execute(
                        select(RoutineIteration)
                        .where(
                            RoutineIteration.status == "in_flight",
                            RoutineIteration.lease_expires_at.is_not(None),
                            RoutineIteration.lease_expires_at < now,
                        )
                        .limit(_BATCH_LIMIT)
                        .with_for_update(skip_locked=True)
                    )
                )
                .scalars()
                .all()
            )
            for it in rows:
                if runner.is_running(it.id):
                    # 本进程仍在执行（lease 偏短）→ 顺延 lease，不回收
                    it.lease_expires_at = now + _lease_extension()
                    continue
                it.status = "reaped"
                it.finished_at = now
                it.lease_expires_at = None
                it.exec_error = it.exec_error or "reaped: lease expired (process restart or hang)"
                reaped += 1
            await db.commit()
        if reaped:
            logger.info("routine_reaped_orphans", count=reaped)
        return reaped

    # ------------------------------------------------------------------
    # (b) EVALUATE + DECIDE
    # ------------------------------------------------------------------
    async def _evaluate_and_decide(self) -> int:
        """对最新迭代处于 executed 的 routine 评估 + 决策。"""
        async with db_session.AsyncSessionLocal() as db:
            routine_ids = await self._find_routines_pending_eval(db)

        evaluated = 0
        for routine_id in routine_ids[:_BATCH_LIMIT]:
            try:
                if await self._evaluate_one(routine_id):
                    evaluated += 1
            except Exception as exc:  # 单 routine 失败不阻断整体巡检
                logger.warning("routine_evaluate_one_failed", routine_id=str(routine_id), error=str(exc))
        return evaluated

    async def _find_routines_pending_eval(self, db: AsyncSession) -> list[UUID]:
        """找出「最新迭代为 executed」的运行中 routine。"""
        # 取每个 running routine 的最大 seq 迭代，过滤 status='executed'
        subq = (
            select(
                RoutineIteration.routine_id,
                RoutineIteration.status,
                RoutineIteration.seq,
            )
            .order_by(RoutineIteration.routine_id, RoutineIteration.seq.desc())
            .distinct(RoutineIteration.routine_id)
        ).subquery()
        rows = (
            await db.execute(
                select(subq.c.routine_id)
                .join(Routine, Routine.id == subq.c.routine_id)
                .where(Routine.status == "running", subq.c.status == "executed")
            )
        ).all()
        return [r[0] for r in rows]

    async def _evaluate_one(self, routine_id: UUID) -> bool:
        """评估单个 routine 的最新 executed 迭代并据决策推进状态机。"""
        async with db_session.AsyncSessionLocal() as db:
            routine = await db.get(Routine, routine_id, with_for_update=True)
            if routine is None or routine.status != "running":
                return False
            latest = await self._latest_iteration(db, routine_id)
            if latest is None or latest.status != "executed":
                return False

            result = await self._evaluator.evaluate(routine, latest)

            if not result.ok:
                # 评估失败：记录 + 计数；超过容忍阈值终止
                attempts = int((latest.metrics or {}).get("eval_attempts", 0)) + 1
                latest.eval_error = result.error
                latest.metrics = {**(latest.metrics or {}), "eval_attempts": attempts}
                if attempts >= settings.routine.eval_failure_patience:
                    self._terminate(routine, decision_mod.REASON_UNRECOVERABLE)
                    latest.status = "evaluated"
                    latest.verdict = "unrecoverable"
                await db.commit()
                await self._publish_routine(routine)
                return False

            # 写入评估结果
            latest.score = result.score
            latest.verdict = result.verdict
            latest.reflection = result.reflection
            latest.gate_exit_code = result.gate_exit_code
            latest.status = "evaluated"

            # 更新 routine 反规范化评分 + 追加反思
            routine.last_score = result.score
            if result.score is not None:
                routine.best_score = (
                    result.score if routine.best_score is None else max(routine.best_score, result.score)
                )
            if result.reflection:
                routine.reflections = append_reflection(routine.reflections, result.reflection)

            # FINALIZE 相位：从本轮 summary 捕获 PR 链接（一次性，幂等）
            if phase_mod.is_phased(routine.config) and routine.current_phase == phase_mod.PHASE_FINALIZE:
                if not routine.pr_url:
                    routine.pr_url = phase_mod.extract_pr_url(latest.summary)

            # 决策（decision.py 保持纯守卫；相位化 routine 由 orchestrator 解释 SUCCESS）。
            # 仅取「本次尝试」窗口（seq > eval_floor_seq）：重启后旧迭代不污染停滞/振荡判定。
            history = await self._evaluated_history(db, routine_id, floor=routine.eval_floor_seq)
            verdict = decision_mod.decide(routine, latest, history)
            if phase_mod.is_phased(routine.config):
                self._advance_phase_or_terminate(routine, verdict)
            elif verdict.is_terminate:
                self._terminate(routine, verdict.reason or decision_mod.REASON_SUCCESS)

            await db.commit()
            await self._publish_routine(routine)
            await get_bus().publish(
                {
                    "type": "iteration",
                    "id": str(latest.id),
                    "routine_id": str(routine_id),
                    "status": "evaluated",
                    "phase": latest.phase,
                    "score": result.score,
                    "verdict": result.verdict,
                }
            )
            return True

    # ------------------------------------------------------------------
    # (c) DISPATCH
    # ------------------------------------------------------------------
    async def _dispatch_due(self) -> int:
        """为运行中、无在途迭代、预算未耗尽的 routine 派发下一迭代。

        同时承担「派发用户已 approve 的待执行迭代」（approval_mode 门控）。
        """
        runner = get_runner()
        launched = 0

        # 先处理已 approve 待 launch 的迭代（dispatched 但 runner 未持有）
        launched += await self._launch_approved(runner)

        if not runner.has_capacity():
            return launched

        # 先在事务内创建迭代行并提交，再 launch（commit-before-launch）：
        # 避免「runner 已启动但 commit 回滚」导致后台任务对不存在的迭代行 UPDATE 0 行、
        # 却仍消耗一次 Claude Code 执行并累加成本的 phantom-row 问题。
        launch_specs: list[tuple] = []
        async with db_session.AsyncSessionLocal() as db:
            routines = (
                (
                    await db.execute(
                        select(Routine)
                        .where(Routine.status == "running")
                        .order_by(Routine.updated_at.asc())
                        .limit(_BATCH_LIMIT)
                        .with_for_update(skip_locked=True)
                    )
                )
                .scalars()
                .all()
            )

            slots = runner.available_slots()
            for routine in routines:
                if slots <= 0:
                    break
                # 已有非终态迭代 → 跳过（每 routine 单在途）
                if await self._has_active_iteration(db, routine.id):
                    continue
                # 预算预检
                budget = decision_mod.pre_dispatch_check(routine)
                if budget.is_terminate:
                    self._terminate(routine, budget.reason or decision_mod.REASON_MAX_ITERATIONS)
                    await self._publish_routine(routine)
                    continue

                # seq 从实际最大值派生（非 iteration_count），避免 aborted/reaped 迭代
                # 占用的 seq 与新迭代冲突触发 uq_routine_iterations_seq。
                seq = await self._next_seq(db, routine.id)
                prompt = build_prompt(routine, max_reflections=settings.routine.max_reflections_injected)
                phased = phase_mod.is_phased(routine.config)
                has_prior_impl = (
                    await self._has_prior_phase_iteration(
                        db, routine.id, phase_mod.PHASE_IMPLEMENT, floor=routine.eval_floor_seq
                    )
                    if phased
                    else False
                )
                needs_approval = self._needs_approval(
                    routine.approval_mode,
                    phased=phased,
                    phase=routine.current_phase,
                    has_prior_implement=has_prior_impl,
                    seq=seq,
                )
                iteration = RoutineIteration(
                    routine_id=routine.id,
                    seq=seq,
                    status="pending_approval" if needs_approval else "dispatched",
                    phase=routine.current_phase,
                    prompt=prompt,
                    resume_session_id=routine.claude_session_id,
                )
                db.add(iteration)
                await db.flush()  # 取 iteration.id

                await self._publish_iteration_created(routine.id, iteration)

                if not needs_approval:
                    config = await self._build_config(routine)
                    launch_specs.append((iteration.id, routine.id, prompt, config))
                    slots -= 1

            await db.commit()

        # commit 成功后再 launch 后台执行
        for iteration_id, routine_id, prompt, config in launch_specs:
            runner.launch(iteration_id=iteration_id, routine_id=routine_id, prompt=prompt, config=config)
            launched += 1
        return launched

    async def _launch_approved(self, runner) -> int:
        """启动用户已 approve（dispatched 且本进程未持有）的迭代。"""
        launch_specs: list[tuple] = []
        async with db_session.AsyncSessionLocal() as db:
            rows = (
                (
                    await db.execute(
                        select(RoutineIteration)
                        .join(Routine, Routine.id == RoutineIteration.routine_id)
                        .where(
                            RoutineIteration.status == "dispatched",
                            RoutineIteration.started_at.is_(None),
                            Routine.status == "running",
                        )
                        .limit(_BATCH_LIMIT)
                        .with_for_update(skip_locked=True)
                    )
                )
                .scalars()
                .all()
            )
            slots = runner.available_slots()
            for it in rows:
                if slots <= 0:
                    break
                if runner.is_running(it.id):
                    continue
                routine = await db.get(Routine, it.routine_id)
                if routine is None:
                    continue
                config = await self._build_config(routine)
                prompt = it.prompt or build_prompt(routine)
                launch_specs.append((it.id, routine.id, prompt, config))
                slots -= 1

        for iteration_id, routine_id, prompt, config in launch_specs:
            runner.launch(iteration_id=iteration_id, routine_id=routine_id, prompt=prompt, config=config)
        return len(launch_specs)

    # ------------------------------------------------------------------
    # 辅助
    # ------------------------------------------------------------------
    @staticmethod
    def _needs_approval(
        approval_mode: str,
        *,
        phased: bool,
        phase: str,
        has_prior_implement: bool,
        seq: int,
    ) -> bool:
        """是否需人工审批后才派发执行。

        - ``every``：每轮迭代均门控。
        - ``first``：相位化工作流门控**首个 implement 迭代**（人工据已生成的 PLAN 评审后
          放行实施）；扁平工作流沿用「首轮（seq==1）」语义。
        - ``auto``：从不门控。
        """
        if approval_mode == "every":
            return True
        if approval_mode == "first":
            if phased:
                return phase == phase_mod.PHASE_IMPLEMENT and not has_prior_implement
            return seq == 1
        return False  # auto

    def _advance_phase_or_terminate(self, routine: Routine, verdict: decision_mod.Decision) -> None:
        """相位化工作流：按相位解释 decision 的 SUCCESS，否则照常终止。

        - PLAN：非成功守卫（如不可恢复）照常终止；否则（成功或继续）推进到 IMPLEMENT；
        - IMPLEMENT：SUCCESS → 推进到 FINALIZE（不终止）；其它终止守卫 → failed；
        - FINALIZE：一旦捕获 ``pr_url`` 即 succeeded（交人工 Merge）；否则非成功守卫 → failed，
          其余留在 FINALIZE 重试建 PR。
        """
        phase = routine.current_phase
        is_success = verdict.is_terminate and verdict.reason == decision_mod.REASON_SUCCESS
        if phase == phase_mod.PHASE_PLAN:
            if verdict.is_terminate and not is_success:
                self._terminate(routine, verdict.reason or decision_mod.REASON_UNRECOVERABLE)
            else:
                routine.current_phase = phase_mod.PHASE_IMPLEMENT
        elif phase == phase_mod.PHASE_FINALIZE:
            if routine.pr_url:
                self._terminate(routine, decision_mod.REASON_SUCCESS)
            elif verdict.is_terminate and not is_success:
                self._terminate(routine, verdict.reason or decision_mod.REASON_UNRECOVERABLE)
            # 否则留在 FINALIZE，下一 tick 重试建 PR
        else:  # IMPLEMENT
            if is_success:
                routine.current_phase = phase_mod.PHASE_FINALIZE
            elif verdict.is_terminate:
                self._terminate(routine, verdict.reason or decision_mod.REASON_MAX_ITERATIONS)

    @staticmethod
    def _terminate(routine: Routine, reason: str) -> None:
        routine.status = "succeeded" if reason == decision_mod.REASON_SUCCESS else "failed"
        routine.termination_reason = reason

    async def _build_config(self, routine: Routine):
        """构建本次执行的 ClaudeCodeConfig：全局默认 + routine 覆盖 + session 续接。"""
        from negentropy.engine.schedulers.handlers.claude_code import _load_claude_code_defaults

        config = await _load_claude_code_defaults()
        overrides = routine.config or {}
        if routine.cwd:
            config.cwd = routine.cwd
        if overrides.get("max_turns"):
            config.max_turns = int(overrides["max_turns"])
        if overrides.get("model"):
            config.model = overrides["model"]
        if overrides.get("system_prompt"):
            config.system_prompt = overrides["system_prompt"]
        if overrides.get("allowed_tools"):
            config.allowed_tools = overrides["allowed_tools"]
        # 相位化工作流：permission_mode 由相位决定（覆盖 preset 静态值），使 PLAN 仅规划、
        # IMPLEMENT/FINALIZE 落盘；扁平工作流沿用 preset 覆盖或全局默认。
        if phase_mod.is_phased(routine.config):
            config.permission_mode = phase_mod.permission_mode_for(routine.current_phase)
        elif overrides.get("permission_mode"):
            config.permission_mode = overrides["permission_mode"]
        if overrides.get("timeout_seconds"):
            config.timeout_seconds = float(overrides["timeout_seconds"])
        config.resume_session_id = routine.claude_session_id
        return config

    @staticmethod
    async def _next_seq(db: AsyncSession, routine_id: UUID) -> int:
        """下一个迭代 seq = 当前最大 seq + 1（含所有终态迭代，避免 seq 复用冲突）。"""
        max_seq = (
            await db.execute(
                select(func.coalesce(func.max(RoutineIteration.seq), 0)).where(
                    RoutineIteration.routine_id == routine_id
                )
            )
        ).scalar_one()
        return int(max_seq) + 1

    @staticmethod
    async def _latest_iteration(db: AsyncSession, routine_id: UUID) -> RoutineIteration | None:
        return (
            await db.execute(
                select(RoutineIteration)
                .where(RoutineIteration.routine_id == routine_id)
                .order_by(RoutineIteration.seq.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    @staticmethod
    async def _evaluated_history(db: AsyncSession, routine_id: UUID, *, floor: int = 0) -> list[RoutineIteration]:
        """本次尝试的已评估迭代历史（seq > floor）。floor=eval_floor_seq 隔离重启前的旧迭代。"""
        return list(
            (
                await db.execute(
                    select(RoutineIteration)
                    .where(
                        RoutineIteration.routine_id == routine_id,
                        RoutineIteration.status == "evaluated",
                        RoutineIteration.seq > floor,
                    )
                    .order_by(RoutineIteration.seq.asc())
                )
            )
            .scalars()
            .all()
        )

    @staticmethod
    async def _has_prior_phase_iteration(db: AsyncSession, routine_id: UUID, phase: str, *, floor: int = 0) -> bool:
        """本次尝试是否已存在指定相位的非废弃迭代（用于「首个 implement 迭代」审批判定）。

        仅看 seq > floor 的迭代：重启（eval_floor_seq 抬高）后会**重新门控**首个 implement 迭代。
        """
        row = (
            await db.execute(
                select(RoutineIteration.id)
                .where(
                    RoutineIteration.routine_id == routine_id,
                    RoutineIteration.phase == phase,
                    RoutineIteration.status.not_in(("aborted", "reaped")),
                    RoutineIteration.seq > floor,
                )
                .limit(1)
            )
        ).first()
        return row is not None

    @staticmethod
    async def _has_active_iteration(db: AsyncSession, routine_id: UUID) -> bool:
        row = (
            await db.execute(
                select(RoutineIteration.id)
                .where(
                    RoutineIteration.routine_id == routine_id,
                    RoutineIteration.status.in_(_NON_TERMINAL_ITER),
                )
                .limit(1)
            )
        ).first()
        return row is not None

    @staticmethod
    async def _publish_routine(routine: Routine) -> None:
        await get_bus().publish(
            {
                "type": "routine",
                "id": str(routine.id),
                "status": routine.status,
                "termination_reason": routine.termination_reason,
                "best_score": routine.best_score,
                "last_score": routine.last_score,
                "iteration_count": routine.iteration_count,
                "total_cost_usd": routine.total_cost_usd,
                "current_phase": routine.current_phase,
                "pr_url": routine.pr_url,
            }
        )

    @staticmethod
    async def _publish_iteration_created(routine_id: UUID, iteration: RoutineIteration) -> None:
        await get_bus().publish(
            {
                "type": "iteration",
                "id": str(iteration.id),
                "routine_id": str(routine_id),
                "status": iteration.status,
                "seq": iteration.seq,
                "phase": iteration.phase,
            }
        )

    # ------------------------------------------------------------------
    # 关停
    # ------------------------------------------------------------------
    async def aclose(self, *, timeout: float = 15.0) -> None:
        """关停：中止全部在途迭代并等待后台任务收尾。"""
        runner = get_runner()
        for iteration_id in list(runner._runners.keys()):  # noqa: SLF001
            runner.request_abort(iteration_id)
        tasks = list(runner._runners.values())  # noqa: SLF001
        if tasks:
            with suppress(Exception):
                await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=timeout)
        await get_bus().close_all_subscribers()


# 进程内单例
_GLOBAL_ORCHESTRATOR: RoutineOrchestrator | None = None


def get_orchestrator() -> RoutineOrchestrator:
    """获取进程内 RoutineOrchestrator 单例（懒创建）。"""
    global _GLOBAL_ORCHESTRATOR
    if _GLOBAL_ORCHESTRATOR is None:
        _GLOBAL_ORCHESTRATOR = RoutineOrchestrator()
    return _GLOBAL_ORCHESTRATOR


__all__ = ["RoutineOrchestrator", "get_orchestrator"]
