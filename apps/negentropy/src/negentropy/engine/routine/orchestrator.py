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
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.logging import get_logger
from negentropy.models.mcp import McpServer, McpTool
from negentropy.models.routine import Routine, RoutineIteration, RoutineIterationEvent

from . import decision as decision_mod
from . import phase as phase_mod
from . import workspace
from .bus import get_bus
from .evaluator import RoutineEvaluator
from .memory_extractor import IterationMemoryExtractor, MemoryExtractionResult, compute_decay_override
from .prompt_builder import append_reflection, build_prompt
from .runner import get_runner

logger = get_logger("negentropy.engine.routine.orchestrator")

# Routine 场景默认扩展工具集。
# 全局 _DEFAULT_TOOLS（6 个基础工具）不含 WebSearch/WebFetch，
# 但 Routine goal 常见"通过互联网深入调研"等需求，默认扩展。
# per-routine config.allowed_tools 可显式覆盖此默认值。
_ROUTINE_DEFAULT_TOOLS = [
    "Bash",
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "WebFetch",
    "WebSearch",
]

# 非终态迭代状态（一个 routine 同时至多存在一个）
_NON_TERMINAL_ITER = ("pending_approval", "dispatched", "in_flight", "executed")
# 每 tick 评估/派发的 routine 批量上限，避免单 tick 过载
_BATCH_LIMIT = 10
# 「全过程」审计事件单字段截断上限（与 claude_code.service 一致），防 DB 膨胀。
_EVENT_FIELD_CAP = 16 * 1024


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _cap(value: str | None, limit: int = _EVENT_FIELD_CAP) -> str | None:
    """字符串超长则截断并加可见标记（审计事件入库前的体积保护）。

    输出长度严格 ``≤ limit``（标记预算从 head 中扣除），使 title 等可安全写入定长列。
    """
    if value is not None and len(value) > limit:
        marker = f"…[truncated {len(value) - limit} chars]"
        head = max(0, limit - len(marker))
        return value[:head] + marker
    return value


def _build_scope_system_prompt(routine: Routine) -> str:
    """构建文件系统作用域限制的 system prompt 片段（对所有 routine 类型生效）。

    system_prompt 层级的指令优先级高于用户 prompt 中的任务描述，
    使作用域限制即使当 goal 文本引用了外部绝对路径时也能生效。

    隔离保证：worktree 存储在项目父目录的 ``.negentropy-worktrees/`` 下，
    与兄弟项目同级；Claude Code 自主探索时可能误读这些不相关项目或源
    项目目录（可能在不同分支）。本函数通过 system prompt 显式限定：仅
    允许读取 worktree 目录内的文件，绝不授权访问源项目或兄弟目录。
    worktree 已包含基线分支的完整检出，无需引用源项目。
    """
    cwd = routine.cwd or ""
    wt_path = getattr(routine, "worktree_path", None) or ""
    is_wt = phase_mod.is_worktree_routine(routine)

    if is_wt and wt_path:
        baseline = getattr(routine, "baseline_branch", None) or ""
        baseline_note = f"\nBaseline branch: `{baseline}`." if baseline else ""
        return (
            "## File System Scope (文件系统作用域)\n"
            f"Working directory: `{wt_path}` (isolated worktree).{baseline_note}\n"
            "READ scope — you may ONLY read files within:\n"
            "  1. The worktree directory and its subdirectories.\n"
            "  2. Absolute paths explicitly referenced in the task goal.\n"
            "You MUST NOT read from any directory outside the worktree, including the "
            "original source project directory, sibling directories, or any other local path. "
            "The worktree contains a complete checkout of the baseline branch — there is no "
            "need to reference the source project.\n"
            "Exceptions: WebSearch, WebFetch, and MCP tools are not restricted."
        )
    elif cwd:
        return (
            "## File System Scope (文件系统作用域)\n"
            f"Project root: `{cwd}`.\n"
            "You may ONLY read files within the project root and its subdirectories. "
            "You MUST NOT read, list, or explore sibling directories or other local projects.\n"
            "Exceptions: WebSearch, WebFetch, and MCP tools are not restricted."
        )
    return ""


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
        self._memory_extractor: IterationMemoryExtractor | None = None
        # 强引用集合：防止 fire-and-forget 的 extraction task 被 GC 回收。
        self._bg_extraction_tasks: set[asyncio.Task] = set()

    async def _ensure_memory_extractor(self) -> IterationMemoryExtractor | None:
        """懒初始化记忆提取器（受 ``memory_extraction_enabled`` 门控）。"""
        if not settings.routine.memory_extraction_enabled:
            return None
        if self._memory_extractor is None:
            self._memory_extractor = IterationMemoryExtractor(
                explicit_model=settings.routine.memory_extraction_model,
            )
        return self._memory_extractor

    # ------------------------------------------------------------------
    # 主入口
    # ------------------------------------------------------------------
    async def inspect_once(self) -> dict[str, int]:
        """单次巡检：reap(孤儿迭代 + worktree) → evaluate → dispatch。返回各阶段计数（供 handler 汇报）。"""
        reaped = await self._reap_orphans()
        cleaned = await self._reap_workspaces()
        evaluated = await self._evaluate_and_decide()
        launched = await self._dispatch_due()
        return {"reaped": reaped, "cleaned": cleaned, "evaluated": evaluated, "launched": launched}

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

    async def _reap_workspaces(self) -> int:
        """按策略回收终态 routine 的隔离 worktree（集中式清理，兜底各终止路径 + 崩溃遗留）。

        策略 ``worktree_cleanup``：``never`` 不清；``on_success`` 仅清 succeeded（failed/cancelled
        保留 worktree 供调试）；``always`` 清全部终态。回收 = best-effort 删 worktree + 置空
        ``worktree_path``（``work_branch`` 保留供审计/PR head 溯源）。delete/restart 另有即时回收钩子。
        """
        policy = settings.routine.worktree_cleanup
        if policy == "never":
            return 0
        statuses = ("succeeded",) if policy == "on_success" else ("succeeded", "failed", "cancelled")
        cleaned = 0
        async with db_session.AsyncSessionLocal() as db:
            rows = (
                (
                    await db.execute(
                        select(Routine)
                        .where(Routine.status.in_(statuses), Routine.worktree_path.is_not(None))
                        .limit(_BATCH_LIMIT)
                    )
                )
                .scalars()
                .all()
            )
            for r in rows:
                with suppress(Exception):
                    await workspace.remove_worktree(r, settings.routine)
                r.worktree_path = None
                cleaned += 1
            await db.commit()
        if cleaned:
            logger.info("routine_reaped_workspaces", count=cleaned, policy=policy)
        return cleaned

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
                eval_events: list[dict] = []
                if attempts >= settings.routine.eval_failure_patience:
                    self._terminate(routine, decision_mod.REASON_UNRECOVERABLE)
                    latest.status = "evaluated"
                    latest.verdict = "unrecoverable"
                    # 仅在确实翻转 evaluated（终止）时落审计事件，避免重试期间每 tick 重复追加。
                    eval_events = await self._persist_eval_events(db, routine, latest, result)
                await db.commit()
                await self._publish_routine(routine)
                await self._publish_action_events(routine_id, latest.id, eval_events)
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

            # FINALIZE 相位：从本轮 summary 捕获 PR 链接（一次性，幂等）。
            # worktree routine 与 phased routine 均走相位机（FINALIZE/PR 对 worktree 通用）。
            phased_flow = phase_mod.is_worktree_routine(routine) or phase_mod.is_phased(routine.config)
            if phased_flow and routine.current_phase == phase_mod.PHASE_FINALIZE and not routine.pr_url:
                routine.pr_url = phase_mod.extract_pr_url(latest.summary)

            # 决策（decision.py 保持纯守卫；相位化 routine 由 orchestrator 解释 SUCCESS）。
            # 仅取「本次尝试」窗口（seq > eval_floor_seq）：重启后旧迭代不污染停滞/振荡判定。
            history = await self._evaluated_history(db, routine_id, floor=routine.eval_floor_seq)
            verdict = decision_mod.decide(
                routine, latest, history, max_context_resets=settings.routine.context_reset_max
            )
            if phased_flow:
                self._advance_phase_or_terminate(routine, verdict)
            elif verdict.is_terminate:
                self._terminate(routine, verdict.reason or decision_mod.REASON_SUCCESS)

            # 「全过程」审计：在迭代翻转 evaluated 时追加 gate / evaluation 事件（seq=MAX+1）。
            eval_events = await self._persist_eval_events(db, routine, latest, result)

            # 记忆提取所需参数（commit 后读取 DB 对象会过期，提前提取纯数据）。
            was_running_before_commit = routine.status == "running"
            routine_id_str = str(routine_id)
            routine_key = routine.key
            owner_id = routine.owner_id
            routine_goal = routine.goal
            routine_criteria = routine.acceptance_criteria
            iteration_snap = {
                "seq": latest.seq,
                "score": latest.score,
                "verdict": latest.verdict,
                "reflection": latest.reflection,
                "summary": latest.summary,
                "gate_exit_code": latest.gate_exit_code,
                "prompt": latest.prompt,
            }
            history_snap = [
                {
                    "seq": it.seq,
                    "score": it.score,
                    "verdict": it.verdict,
                    "reflection": it.reflection,
                    "status": it.status,
                    "summary": it.summary,
                }
                for it in history
            ]

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
            await self._publish_action_events(routine_id, latest.id, eval_events)

            # 记忆提取（fire-and-forget，不阻塞 inspector handler）。
            # 必须在 commit 后执行：避免 LLM 调用耗时触发 handler timeout
            # 导致 db.commit() 被取消，评估结果丢失。
            # 使用强引用集合防止 task 被 GC 回收。
            self._fire_memory_extraction(
                routine_id_str,
                routine_key,
                owner_id,
                routine_goal,
                routine_criteria,
                iteration_snap,
                history_snap,
                was_running_before_commit,
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
                    await db.commit()
                    await self._publish_routine(routine)
                    # DISPATCH 阶段终止时的记忆提取（fire-and-forget）。
                    # phased routine 的终态往往在此路径触发（max_iterations/budget 耗尽），
                    # 而非 EVALUATE 阶段的 _advance_phase_or_terminate。
                    self._fire_extraction_on_dispatch_terminate(routine)
                    continue

                # 纵深防御：非模板 routine 必须有 baseline_branch 才能派发——
                # 无隔离 worktree 的 routine 直接在项目根运行 Claude Code 是不安全的，
                # 任何变更将直接影响主工作树且无法干净回滚。此守卫与 API 层 start/restart/resume
                # 端点对齐，作为最后一道防线捕获 API 层遗漏的绕过路径。
                if not routine.is_template and not routine.baseline_branch:
                    logger.warning(
                        "routine_dispatch_skipped_no_baseline",
                        routine_id=str(routine.id),
                        key=routine.key,
                    )
                    self._terminate(routine, "unrecoverable_error")
                    await self._publish_routine(routine)
                    continue

                # seq 从实际最大值派生（非 iteration_count），避免 aborted/reaped 迭代
                # 占用的 seq 与新迭代冲突触发 uq_routine_iterations_seq。
                seq = await self._next_seq(db, routine.id)
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
                # 即将 launch 的迭代：先确保隔离 worktree 就绪（worktree routine）。失败 → 终止该
                # routine 为 unrecoverable 并跳过（不创建迭代行）；待审批迭代延后到 launch 时确保。
                if not needs_approval and not await self._ensure_workspace(routine):
                    await self._publish_routine(routine)
                    continue
                # prompt 在 ensure 之后构建，使 FINALIZE 具体命令与工作区上下文可引用 work_branch。
                # 记忆注入：从 Memory Module 检索相关经验记忆。
                memory_ctx = (
                    await self._retrieve_memory_context(routine) if settings.routine.memory_injection_enabled else None
                )
                prompt = build_prompt(
                    routine,
                    max_reflections=settings.routine.max_reflections_injected,
                    memory_context=memory_ctx,
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
                    # 快照系统中所有已启用的 MCP server/tool 元数据到 iteration.metrics（历史可追溯）
                    mcp_meta = await self._resolve_mcp_meta(db, cwd=routine.cwd)
                    if mcp_meta:
                        iteration.metrics = {**(iteration.metrics or {}), "mcp_servers": mcp_meta}
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
            dirty = False
            for it in rows:
                if slots <= 0:
                    break
                if runner.is_running(it.id):
                    continue
                routine = await db.get(Routine, it.routine_id)
                if routine is None:
                    continue
                # 确保隔离 worktree 就绪（待审批迭代在此刻才创建工作区）。失败 → 终止 routine +
                # 闭合该迭代为 aborted，跳过 launch。
                if not await self._ensure_workspace(routine):
                    it.status = "aborted"
                    it.finished_at = _utcnow()
                    dirty = True
                    await self._publish_routine(routine)
                    continue
                config = await self._build_config(routine)
                # 快照系统中所有已启用的 MCP server/tool 元数据到 iteration.metrics（历史可追溯）
                mcp_meta = await self._resolve_mcp_meta(db, cwd=routine.cwd)
                if mcp_meta:
                    it.metrics = {**(it.metrics or {}), "mcp_servers": mcp_meta}
                # 记忆注入：待审批迭代在 approve 时重建 prompt（含最新记忆上下文）。
                memory_ctx_approved = (
                    await self._retrieve_memory_context(routine) if settings.routine.memory_injection_enabled else None
                )
                prompt = it.prompt or build_prompt(routine, memory_context=memory_ctx_approved)
                launch_specs.append((it.id, routine.id, prompt, config))
                dirty = True  # _ensure_workspace 在 routine 上写入了 worktree_path/work_branch
                slots -= 1
            if dirty:
                await db.commit()

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

    def _fire_extraction_on_dispatch_terminate(self, routine: Routine) -> None:
        """DISPATCH 阶段终止时的记忆提取（fire-and-forget）。

        phased routine 的终态往往由 DISPATCH 阶段的预算/迭代守卫触发
        （max_iterations/budget 耗尽），此时 EVALUATE 阶段的提取钩子无法覆盖。
        此方法从 DB 加载已评估历史，然后发起后台提取。
        """
        if not settings.routine.memory_extraction_enabled:
            return
        if not settings.routine.memory_extraction_on_termination:
            return

        async def _bg() -> None:
            try:
                async with db_session.AsyncSessionLocal() as db:
                    history = await self._evaluated_history(db, routine.id)
                if not history:
                    return
                history_snap = [
                    {
                        "seq": it.seq,
                        "score": it.score,
                        "verdict": it.verdict,
                        "reflection": it.reflection,
                        "status": it.status,
                        "summary": it.summary,
                    }
                    for it in history
                ]
                extractor = await self._ensure_memory_extractor()
                if extractor is None:
                    return
                from types import SimpleNamespace

                routine_proxy = SimpleNamespace(
                    id=str(routine.id),
                    key=routine.key,
                    goal=routine.goal or "",
                    acceptance_criteria=routine.acceptance_criteria or "",
                    owner_id=routine.owner_id,
                )
                result = await extractor.extract_on_termination(routine_proxy, history_snap)
                if not result.memories:
                    return
                await self._write_memories_from_snap(
                    routine_id=str(routine.id),
                    routine_key=routine.key,
                    owner_id=routine.owner_id,
                    iteration_snap={
                        "seq": history[-1].seq,
                        "score": history[-1].score,
                        "verdict": history[-1].verdict,
                    },
                    result=result,
                )
                logger.info(
                    "routine_memories_extracted",
                    routine_id=str(routine.id),
                    count=len(result.memories),
                    cost_usd=result.cost_usd,
                    source="dispatch_terminate",
                )
            except Exception as exc:
                logger.warning(
                    "routine_memory_extraction_failed",
                    routine_id=str(routine.id),
                    error=str(exc),
                )

        loop = asyncio.get_running_loop()
        task = loop.create_task(_bg())
        self._bg_extraction_tasks.add(task)
        task.add_done_callback(self._bg_extraction_tasks.discard)

    @staticmethod
    def _terminate(routine: Routine, reason: str) -> None:
        routine.status = "succeeded" if reason == decision_mod.REASON_SUCCESS else "failed"
        routine.termination_reason = reason

    # ------------------------------------------------------------------
    # 记忆提取（Memory Extraction）
    # ------------------------------------------------------------------

    def _fire_memory_extraction(
        self,
        routine_id: str,
        routine_key: str | None,
        owner_id: str | None,
        routine_goal: str | None,
        routine_criteria: str | None,
        iteration_snap: dict,
        history_snap: list[dict],
        was_running_before_commit: bool,
    ) -> None:
        """Fire-and-forget 记忆提取：在 commit 后发起，不阻塞 inspector handler。

        使用 ``asyncio.create_task`` 将提取协程提交到事件循环，
        通过 ``_bg_extraction_tasks`` 强引用集合防止 task 被 GC 回收。
        提取完成后 task 自动从集合移除。
        """
        loop = asyncio.get_running_loop()
        task = loop.create_task(
            self._extract_and_store_memories_bg(
                routine_id=routine_id,
                routine_key=routine_key,
                owner_id=owner_id,
                routine_goal=routine_goal,
                routine_criteria=routine_criteria,
                iteration_snap=iteration_snap,
                history_snap=history_snap,
                was_running_before_commit=was_running_before_commit,
            )
        )
        self._bg_extraction_tasks.add(task)
        task.add_done_callback(self._bg_extraction_tasks.discard)

    async def _extract_and_store_memories_bg(
        self,
        *,
        routine_id: str,
        routine_key: str | None,
        owner_id: str | None,
        routine_goal: str | None,
        routine_criteria: str | None,
        iteration_snap: dict,
        history_snap: list[dict],
        was_running_before_commit: bool,
    ) -> None:
        """后台记忆提取协程（由 ``_fire_memory_extraction`` 调度）。

        所有输入均为纯数据（非 ORM 对象），确保在 session 关闭后安全执行。
        两条提取路径（互斥）：
        - ``memory_extraction_on_termination=True``：仅 routine 刚变终态时批量提取。
        - ``memory_extraction_on_termination=False``：每次评估后即时提取。

        所有异常均被捕获并记录为 warning。
        """
        extractor = await self._ensure_memory_extractor()
        if extractor is None:
            return

        # 最低分数门槛
        score = iteration_snap.get("score")
        if score is not None and score < settings.routine.memory_extraction_min_score:
            return

        try:
            from types import SimpleNamespace

            routine_proxy = SimpleNamespace(
                id=routine_id,
                key=routine_key,
                goal=routine_goal or "",
                acceptance_criteria=routine_criteria or "",
                owner_id=owner_id,
            )
            iter_proxy = SimpleNamespace(
                seq=iteration_snap.get("seq"),
                score=iteration_snap.get("score"),
                verdict=iteration_snap.get("verdict"),
                reflection=iteration_snap.get("reflection"),
                summary=iteration_snap.get("summary"),
                gate_exit_code=iteration_snap.get("gate_exit_code"),
            )

            if settings.routine.memory_extraction_on_termination:
                # 仅终止时提取：commit 前 routine 仍在运行则跳过
                if was_running_before_commit:
                    return
                result = await extractor.extract_on_termination(routine_proxy, history_snap)
            else:
                result = await extractor.extract(routine_proxy, iter_proxy)

            if not result.memories:
                return

            await self._write_memories_from_snap(
                routine_id=routine_id,
                routine_key=routine_key,
                owner_id=owner_id,
                iteration_snap=iteration_snap,
                result=result,
            )

            logger.info(
                "routine_memories_extracted",
                routine_id=routine_id,
                count=len(result.memories),
                cost_usd=result.cost_usd,
            )
        except Exception as exc:
            logger.warning(
                "routine_memory_extraction_failed",
                routine_id=routine_id,
                error=str(exc),
            )

    @staticmethod
    async def _write_memories_from_snap(
        *,
        routine_id: str,
        routine_key: str | None,
        owner_id: str | None,
        iteration_snap: dict,
        result: MemoryExtractionResult,
    ) -> None:
        """将提取的记忆通过 PostgresMemoryService 写入 Memory Module（纯数据参数版）。"""
        from negentropy.engine.factories.memory import get_memory_service

        mem_service = get_memory_service()
        max_memories = settings.routine.memory_extraction_max_memories_per_iter
        memories = result.memories if max_memories == 0 else result.memories[:max_memories]

        verdict = iteration_snap.get("verdict")
        for m in memories:
            decay = compute_decay_override(verdict, m.memory_type)
            metadata = {
                "source": "routine_extraction",
                "routine_id": routine_id,
                "routine_key": routine_key or "",
                "iteration_seq": iteration_snap.get("seq"),
                "iteration_score": iteration_snap.get("score"),
                "iteration_verdict": verdict,
                "decay_override": decay,
            }
            await mem_service.add_memory_typed(
                user_id=owner_id or "system",
                app_name=settings.app_name,
                thread_id=None,
                content=m.content,
                memory_type=m.memory_type,
                metadata=metadata,
            )

    # ------------------------------------------------------------------
    # 记忆注入（Memory Injection）
    # ------------------------------------------------------------------

    async def _retrieve_memory_context(self, routine: Routine) -> str | None:
        """从 Memory Module 检索与当前 routine 目标相关的经验记忆。

        返回格式化的记忆文本（用于注入 prompt），或 None。
        """
        try:
            from negentropy.engine.factories.memory import get_memory_service

            mem_service = get_memory_service()
            query = f"{routine.goal} {routine.acceptance_criteria}"
            response = await mem_service.search_memory(
                app_name=settings.app_name,
                user_id=routine.owner_id or "system",
                query=query,
                limit=5,
            )
            if not response or not response.memories:
                return None

            lines: list[str] = []
            for entry in response.memories[:5]:
                meta = entry.custom_metadata or {}
                type_label = meta.get("memory_type", "episodic") if isinstance(meta, dict) else "episodic"
                # 从 metadata_ 提取来源信息
                source = meta.get("source", "") if isinstance(meta, dict) else ""
                prefix = f"[{type_label}]"
                if source == "routine_extraction" and isinstance(meta, dict):
                    key = meta.get("routine_key", "")
                    if key:
                        prefix += f" (来自 {key})"
                content = (entry.content or "")[:200]
                lines.append(f"- {prefix} {content}")

            return "\n".join(lines) if lines else None
        except Exception as exc:
            logger.warning(
                "routine_memory_injection_failed",
                routine_id=str(routine.id),
                error=str(exc),
            )
            return None

    async def _ensure_workspace(self, routine: Routine) -> bool:
        """worktree routine：确保隔离 worktree 就绪并把 ``worktree_path``/``work_branch`` 写回
        （已锁定的）``routine`` 对象，由调用方事务提交。

        返回 ``True`` 表示可派发（非 worktree routine 恒 True）；返回 ``False`` 表示工作区创建失败
        且已 ``_terminate(unrecoverable)``——precondition（仓库/基线合法）在 create/start 已校验，
        此刻失败视为不可恢复（仓库被移除 / 基线消失），诚实终止优于静默挂起。
        """
        if not phase_mod.is_worktree_routine(routine):
            return True
        try:
            info = await workspace.ensure_worktree(routine, settings.routine)
        except workspace.WorkspaceError as exc:
            logger.warning("routine_worktree_ensure_failed", routine_id=str(routine.id), error=str(exc))
            self._terminate(routine, decision_mod.REASON_UNRECOVERABLE)
            return False
        routine.worktree_path = info.path
        routine.work_branch = info.branch
        return True

    async def _build_config(self, routine: Routine):
        """构建本次执行的 ClaudeCodeConfig：全局默认 + routine 覆盖 + session 续接。

        worktree routine：CC 实际 cwd 指向引擎备好的隔离 worktree（``worktree_path`` 由
        ``_ensure_workspace`` 在 launch 前写入）；``cwd`` 仅作 worktree 派生源（仓库根）。
        """
        from negentropy.engine.schedulers.handlers.claude_code import _load_claude_code_defaults

        config = await _load_claude_code_defaults()
        overrides = routine.config or {}
        effective_cwd = routine.worktree_path if phase_mod.is_worktree_routine(routine) else routine.cwd
        if effective_cwd:
            config.cwd = effective_cwd
        # Routine 级默认覆盖全局 CC 默认（1000 vs 500）；per-routine config 可再覆盖。
        config.max_turns = settings.routine.default_max_turns
        if overrides.get("max_turns"):
            config.max_turns = int(overrides["max_turns"])
        # per-routine 可覆盖全局 max_events_per_iter（Full View 审计事件捕获上限）。
        if overrides.get("max_events_per_iter"):
            config.max_events_per_iter = int(overrides["max_events_per_iter"])
        if overrides.get("model"):
            config.model = overrides["model"]
        # 注入作用域限制到 system_prompt（最高优先级指令层）。
        # 即使 goal 文本引用了外部绝对路径，system prompt 层的作用域限制也能防止
        # Claude Code 自主探索兄弟项目目录。
        scope_instruction = _build_scope_system_prompt(routine)
        if scope_instruction:
            if overrides.get("system_prompt"):
                config.system_prompt = scope_instruction + "\n\n" + overrides["system_prompt"]
            else:
                config.system_prompt = scope_instruction
        elif overrides.get("system_prompt"):
            config.system_prompt = overrides["system_prompt"]
        # 工具白名单优先级：per-routine config > Routine 扩展默认 > 全局默认。
        if overrides.get("allowed_tools"):
            config.allowed_tools = overrides["allowed_tools"]
        else:
            # 全局默认（6 个基础工具）不含 WebSearch/WebFetch；
            # Routine 常见"互联网调研"需求，默认扩展。
            config.allowed_tools = _ROUTINE_DEFAULT_TOOLS
        # per-routine 可显式禁止特定工具（即使 allowed_tools 包含它们）。
        if overrides.get("disallowed_tools"):
            config.disallowed_tools = overrides["disallowed_tools"]
        # per-routine 可覆盖/补充全局 mcp_config（MCP 服务器配置）。
        if overrides.get("mcp_config"):
            config.mcp_config = overrides["mcp_config"]
        # permission_mode 由相位决定（PLAN 仅规划、IMPLEMENT/FINALIZE 落盘）——对 worktree routine
        # 与 phased routine 均生效（覆盖 preset 静态值）；旧扁平 routine 沿用 preset 覆盖或全局默认。
        if phase_mod.is_worktree_routine(routine) or phase_mod.is_phased(routine.config):
            config.permission_mode = phase_mod.permission_mode_for(routine.current_phase)
        elif overrides.get("permission_mode"):
            config.permission_mode = overrides["permission_mode"]
        # Routine 级默认覆盖全局 CC 默认（3h vs 5min）；per-routine config 可再覆盖。
        config.timeout_seconds = float(settings.routine.default_iteration_timeout_seconds)
        if overrides.get("timeout_seconds"):
            config.timeout_seconds = float(overrides["timeout_seconds"])
        config.resume_session_id = routine.claude_session_id
        # 上下文压缩：注入 auto-compact 阈值，提前触发 CC 内置压缩，延长单次迭代寿命。
        if settings.routine.context_compact_enabled:
            config.compact_threshold_pct = settings.routine.context_compact_threshold_pct
        # 启用交互模式：Engine 自动应答 AskUserQuestion，使 CC 继续执行而非失败退出。
        if settings.routine.auto_answer_questions:
            config.interactive = True
            config.auto_answer_context = {
                "goal": routine.goal,
                "acceptance_criteria": routine.acceptance_criteria,
                # Plan Review 上下文：当 phase=plan 且 plan_review_enabled 时，
                # auto-answer 分支调用 PlanReviewer 而非通用 auto-answer。
                "phase": routine.current_phase or "",
                "plan_review_enabled": settings.routine.plan_review_enabled,
                "plan_review_model": settings.routine.plan_review_model,
                "plan_review_timeout": settings.routine.plan_review_timeout_seconds,
                "reflections": (
                    list(routine.reflections.get("items", [])[:5]) if isinstance(routine.reflections, dict) else []
                ),
            }
        return config

    @staticmethod
    async def _resolve_mcp_meta(db: AsyncSession, cwd: str | None = None) -> list[dict]:
        """快照系统中所有已启用的 MCP server 及其 tool 元数据。

        直接查询 ``mcp_servers`` / ``mcp_tools`` 目录表，不依赖 Claude Code 传入的
        ``mcp_config``——因为 MCP Server 可通过多种途径配置（Claude Code 用户级配置、
        项目级 .mcp.json、Negentropy 系统 MCP 目录等），仅从 ``mcp_config`` 无法
        覆盖全部来源。目录表是系统已知的 Server 全集。

        当 *cwd* 非空时，额外读取项目 ``.mcp.json`` 中的 MCP 配置并合并（按 name
        去重），确保快照覆盖 Claude Code 原生发现的所有 MCP。

        注意：仅保存公开元数据，不含 transport config 中的 env / headers 等敏感字段。
        """
        servers = (
            (await db.execute(select(McpServer).where(McpServer.is_enabled.is_(True)).order_by(McpServer.name)))
            .scalars()
            .all()
        )

        result: list[dict] = []
        db_names: set[str] = set()
        for server in servers:
            db_names.add(server.name)
            tools = (
                await db.execute(
                    select(
                        McpTool.name,
                        McpTool.display_name,
                        McpTool.title,
                        McpTool.description,
                    ).where(
                        McpTool.server_id == server.id,
                        McpTool.is_enabled.is_(True),
                    )
                )
            ).all()
            result.append(
                {
                    "name": server.name,
                    "display_name": server.display_name,
                    "description": server.description,
                    "transport_type": server.transport_type,
                    "tools": [
                        {
                            "name": t.name,
                            "display_name": t.display_name,
                            "title": t.title,
                            "description": t.description,
                        }
                        for t in tools
                    ],
                }
            )

        # 合并 .mcp.json 中独有的服务器（DB 中不存在的）
        if cwd:
            from negentropy.interface.mcp_config_resolver import derive_transport_type, read_mcp_json

            mcp_json_servers = read_mcp_json(cwd)
            for name, config in mcp_json_servers.items():
                if name not in db_names:
                    result.append(
                        {
                            "name": name,
                            "display_name": None,
                            "description": "Auto-discovered from .mcp.json",
                            "transport_type": derive_transport_type(config),
                            "tools": [],
                            "source": "mcp_json",
                        }
                    )

        return result

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

    @staticmethod
    async def _persist_eval_events(
        db: AsyncSession, routine: Routine, iteration: RoutineIteration, result
    ) -> list[dict]:
        """迭代翻转 ``evaluated`` 时追加 ``gate`` / ``evaluation`` 审计事件并落库。

        seq 由 DB 侧 ``MAX(seq)+1`` 派生（接在 execution 事件之后），**仅在 →evaluated 转换调用**
        以避免 ok=False 重试期间每 tick 重复追加；``ON CONFLICT(iteration_id,seq) DO NOTHING``
        兜底竞态。返回构造的事件 dict（含 seq）供调用方实时发布。
        """
        if not settings.routine.capture_events:
            return []
        start = (
            await db.execute(
                select(func.coalesce(func.max(RoutineIterationEvent.seq), -1) + 1).where(
                    RoutineIterationEvent.iteration_id == iteration.id
                )
            )
        ).scalar_one()
        seq = int(start)
        events: list[dict] = []
        if routine.verification_command:
            events.append(
                {
                    "seq": seq,
                    "event_type": "gate",
                    "tool_name": None,
                    "title": _cap(f"Gate: {routine.verification_command}", 255),
                    "payload": {
                        "command": _cap(routine.verification_command),
                        "exit_code": result.gate_exit_code,
                        "output": _cap(result.gate_output or ""),
                    },
                    "cost_usd": None,
                }
            )
            seq += 1
        score_suffix = f" · {result.score}" if result.score is not None else ""
        events.append(
            {
                "seq": seq,
                "event_type": "evaluation",
                "tool_name": None,
                "title": _cap(f"Judge: {result.verdict or 'eval'}{score_suffix}", 255),
                "payload": {
                    "score": result.score,
                    "verdict": result.verdict,
                    "reflection": result.reflection,
                    "prompt": _cap(result.judge_prompt or ""),
                    "raw": _cap(result.judge_raw or ""),
                    "error": result.error,
                },
                "cost_usd": None,
            }
        )
        rows = [
            {
                "iteration_id": iteration.id,
                "routine_id": routine.id,
                "seq": e["seq"],
                "event_type": e["event_type"][:24],
                "tool_name": e["tool_name"],
                # 定长列防御性收口（与 runner._persist_events 一致），即便 _cap 漏网也不致 insert 溢出。
                "title": e["title"][:255] if e["title"] else None,
                "payload": e["payload"],
                "cost_usd": e["cost_usd"],
            }
            for e in events
        ]
        stmt = (
            pg_insert(RoutineIterationEvent).values(rows).on_conflict_do_nothing(index_elements=["iteration_id", "seq"])
        )
        await db.execute(stmt)
        return events

    @staticmethod
    async def _publish_action_events(routine_id: UUID, iteration_id: UUID, events: list[dict]) -> None:
        """把 gate / evaluation 审计事件经非阻塞总线广播为 ``action`` 实时事件（best-effort）。"""
        if not events:
            return
        bus = get_bus()
        rid, iid = str(routine_id), str(iteration_id)
        for e in events:
            with suppress(Exception):
                await bus.publish({"type": "action", "routine_id": rid, "iteration_id": iid, **e})

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
