"""RoutineOrchestrator 全链路集成测试 — 真实 Postgres。

覆盖范围：
- inspect_once 的 evaluate+decide：高分 → succeeded；progressing → 继续
- inspect_once 的 dispatch：auto 模式创建并执行迭代；first 模式首迭代 pending_approval
- 预算守卫：max_iterations 触达 → failed/max_iterations
- 反思追加：评估反思写入 routine.reflections

注意：
- ClaudeCodeService.invoke 与 RoutineEvaluator.evaluate 被 mock，避免真实 LLM / CLI 调用；
- routine key 使用 UUID 后缀隔离，try/finally 清理测试数据。
"""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import delete, select

import negentropy.db.session as db_session
from negentropy.engine.claude_code.models import ClaudeCodeResult
from negentropy.engine.routine import decision as decision_mod
from negentropy.engine.routine import workspace
from negentropy.engine.routine.evaluator import EvaluationResult
from negentropy.engine.routine.orchestrator import RoutineOrchestrator
from negentropy.engine.routine.workspace import WorkspaceInfo
from negentropy.models.routine import Routine, RoutineIteration

pytestmark = pytest.mark.asyncio


def _key(prefix: str = "itest_routine") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


async def _make_routine(**overrides) -> uuid.UUID:
    defaults = dict(
        key=_key(),
        title="Integration Test",
        goal="实现功能",
        acceptance_criteria="通过验收",
        status="running",
        max_iterations=5,
        success_score_threshold=85,
        no_progress_patience=3,
        approval_mode="auto",
        iteration_count=0,
        reflections={},
        config={},
    )
    defaults.update(overrides)
    async with db_session.AsyncSessionLocal() as db:
        r = Routine(**defaults)
        db.add(r)
        await db.commit()
        return r.id


async def _cleanup(routine_id: uuid.UUID) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(Routine).where(Routine.id == routine_id))
        await db.commit()


async def _add_iteration(routine_id: uuid.UUID, **overrides) -> uuid.UUID:
    defaults = dict(routine_id=routine_id, seq=1, status="executed", exec_status="success", summary="done")
    defaults.update(overrides)
    async with db_session.AsyncSessionLocal() as db:
        it = RoutineIteration(**defaults)
        db.add(it)
        await db.commit()
        return it.id


async def test_evaluate_high_score_terminates_succeeded():
    rid = await _make_routine(iteration_count=1)
    await _add_iteration(rid, seq=1)
    try:
        orch = RoutineOrchestrator()
        with patch.object(
            orch._evaluator,
            "evaluate",
            new=AsyncMock(
                return_value=EvaluationResult(ok=True, score=92, verdict="pass", reflection="很好", gate_exit_code=None)
            ),
        ):
            count = await orch._evaluate_and_decide()
        assert count == 1
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "succeeded"
            assert r.termination_reason == "success"
            assert r.best_score == 92
            assert r.reflections.get("items") == ["很好"]
    finally:
        await _cleanup(rid)


async def test_evaluate_progressing_continues():
    rid = await _make_routine(iteration_count=1)
    await _add_iteration(rid, seq=1)
    try:
        orch = RoutineOrchestrator()
        with patch.object(
            orch._evaluator,
            "evaluate",
            new=AsyncMock(
                return_value=EvaluationResult(ok=True, score=55, verdict="progressing", reflection="继续改进")
            ),
        ):
            await orch._evaluate_and_decide()
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "running"  # 未终止
            assert r.last_score == 55
    finally:
        await _cleanup(rid)


async def _evaluate_phased(rid, *, score, verdict):
    """辅助：以 mock evaluator 跑一次评估-决策，返回评估计数。"""
    orch = RoutineOrchestrator()
    with patch.object(
        orch._evaluator,
        "evaluate",
        new=AsyncMock(return_value=EvaluationResult(ok=True, score=score, verdict=verdict, reflection="r")),
    ):
        return await orch._evaluate_and_decide()


async def test_phased_plan_advances_to_implement():
    """相位化：PLAN 迭代评估后推进到 IMPLEMENT，不因评分终止。"""
    rid = await _make_routine(config={"workflow": "phased"}, current_phase="plan", iteration_count=1)
    await _add_iteration(rid, seq=1, phase="plan")
    try:
        await _evaluate_phased(rid, score=40, verdict="progressing")
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "running"  # 计划阶段不终止
            assert r.current_phase == "implement"  # 已推进到实施
    finally:
        await _cleanup(rid)


async def test_phased_implement_success_advances_to_finalize():
    """相位化：IMPLEMENT 命中成功阈值 → 推进到 FINALIZE（不直接 succeeded）。"""
    rid = await _make_routine(config={"workflow": "phased"}, current_phase="implement", iteration_count=2)
    await _add_iteration(rid, seq=1, phase="implement")
    try:
        await _evaluate_phased(rid, score=92, verdict="pass")
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "running"  # 未直接成功
            assert r.current_phase == "finalize"  # 进入收尾
    finally:
        await _cleanup(rid)


async def test_phased_finalize_without_pr_stays_running():
    """相位化：FINALIZE 未捕获 PR 链接时不判成功，留在收尾重试。"""
    rid = await _make_routine(config={"workflow": "phased"}, current_phase="finalize", iteration_count=3)
    await _add_iteration(rid, seq=1, phase="finalize", summary="已修复 lint，但未输出链接")
    try:
        await _evaluate_phased(rid, score=92, verdict="pass")
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "running"
            assert r.pr_url is None
            assert r.current_phase == "finalize"
    finally:
        await _cleanup(rid)


async def test_phased_finalize_with_pr_succeeds():
    """相位化：FINALIZE 捕获 PR 链接 → succeeded 且回写 pr_url（交人工 Merge）。"""
    rid = await _make_routine(config={"workflow": "phased"}, current_phase="finalize", iteration_count=3)
    await _add_iteration(rid, seq=1, phase="finalize", summary="PR_URL=https://github.com/o/r/pull/77\n已创建 PR")
    try:
        await _evaluate_phased(rid, score=92, verdict="pass")
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "succeeded"
            assert r.termination_reason == "success"
            assert r.pr_url == "https://github.com/o/r/pull/77"
    finally:
        await _cleanup(rid)


async def test_dispatch_auto_launches_and_writes_back():
    # baseline_branch + cwd 满足 #829 派发守卫（无 baseline 的非模板 routine 被纵深防御终止）；
    # ensure_worktree 被 mock 回隔离句柄，避免真实 git worktree 操作。
    rid = await _make_routine(
        approval_mode="auto", iteration_count=0, baseline_branch="origin/feature/1.x.x", cwd="/repo/root"
    )
    try:
        orch = RoutineOrchestrator()
        fake = ClaudeCodeResult(status="success", summary="ok", session_id="s1", cost_usd=0.05, turn_count=2)
        info = WorkspaceInfo(path="/tmp/wt/dispatch-auto", branch="routine/dispatch-auto")
        with (
            patch(
                "negentropy.engine.claude_code.service.ClaudeCodeService.invoke",
                new=AsyncMock(return_value=fake),
            ),
            patch("negentropy.engine.routine.workspace.ensure_worktree", new=AsyncMock(return_value=info)),
        ):
            launched = await orch._dispatch_due()
            assert launched == 1
            await asyncio.sleep(1.2)  # 等待后台 runner 写回
        async with db_session.AsyncSessionLocal() as db:
            its = (await db.execute(select(RoutineIteration).where(RoutineIteration.routine_id == rid))).scalars().all()
            assert len(its) == 1
            assert its[0].status == "executed"
            assert its[0].exec_status == "success"
            r = await db.get(Routine, rid)
            assert r.iteration_count == 1
            assert r.claude_session_id == "s1"
            assert r.total_cost_usd == pytest.approx(0.05)
    finally:
        await _cleanup(rid)


async def test_dispatch_first_approval_creates_pending():
    # baseline_branch 满足 #829 派发守卫；first 模式首迭代 pending_approval 不触发 ensure_worktree。
    rid = await _make_routine(
        approval_mode="first", iteration_count=0, baseline_branch="origin/feature/1.x.x", cwd="/repo/root"
    )
    try:
        orch = RoutineOrchestrator()
        with patch(
            "negentropy.engine.claude_code.service.ClaudeCodeService.invoke",
            new=AsyncMock(),
        ) as mock_invoke:
            launched = await orch._dispatch_due()
            # first 模式首迭代待审批，不应 launch
            assert launched == 0
            mock_invoke.assert_not_called()
        async with db_session.AsyncSessionLocal() as db:
            its = (await db.execute(select(RoutineIteration).where(RoutineIteration.routine_id == rid))).scalars().all()
            assert len(its) == 1
            assert its[0].status == "pending_approval"
            assert its[0].seq == 1
    finally:
        await _cleanup(rid)


async def test_dispatch_pre_budget_terminates_at_max_iterations():
    rid = await _make_routine(max_iterations=3, iteration_count=3)
    try:
        orch = RoutineOrchestrator()
        with patch(
            "negentropy.engine.claude_code.service.ClaudeCodeService.invoke",
            new=AsyncMock(),
        ):
            await orch._dispatch_due()
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "failed"
            assert r.termination_reason == "max_iterations"
    finally:
        await _cleanup(rid)


async def test_redispatch_after_aborted_iteration_uses_next_seq():
    """回归（code review #1）：存在 aborted 迭代时再派发须用 seq=MAX+1，不复用 seq 触发唯一约束冲突。

    复现 pause→resume 流：iteration_count=0，seq=1 迭代被 abort（计数未增），
    旧逻辑 seq=iteration_count+1=1 会与已存在的 seq=1 行冲突 → IntegrityError。
    """
    rid = await _make_routine(
        approval_mode="auto", iteration_count=0, baseline_branch="origin/feature/1.x.x", cwd="/repo/root"
    )
    # 造一个已 aborted 的 seq=1 迭代（模拟 pause 中止）
    await _add_iteration(rid, seq=1, status="aborted", exec_status=None, summary=None)
    try:
        orch = RoutineOrchestrator()
        fake = ClaudeCodeResult(status="success", summary="ok", session_id="s2", cost_usd=0.01, turn_count=1)
        info = WorkspaceInfo(path="/tmp/wt/redispatch", branch="routine/redispatch")
        with (
            patch(
                "negentropy.engine.claude_code.service.ClaudeCodeService.invoke",
                new=AsyncMock(return_value=fake),
            ),
            patch("negentropy.engine.routine.workspace.ensure_worktree", new=AsyncMock(return_value=info)),
        ):
            launched = await orch._dispatch_due()  # 不应抛 IntegrityError
            assert launched == 1
            await asyncio.sleep(1.2)
        async with db_session.AsyncSessionLocal() as db:
            its = (await db.execute(select(RoutineIteration).where(RoutineIteration.routine_id == rid))).scalars().all()
            seqs = sorted(it.seq for it in its)
            assert seqs == [1, 2], f"expected seqs [1,2], got {seqs}"
            new_it = next(it for it in its if it.seq == 2)
            assert new_it.status == "executed"
    finally:
        await _cleanup(rid)


# 重启决策窗口隔离的 A/B 对照：两用例数据完全相同（seq1-5），仅 eval_floor_seq 不同（4 vs 0），
# 结果相反——证明 eval_floor_seq 确实将停滞判定收敛到「本次尝试」，而非由旧迭代评分驱动。
# 旧尝试设高基线（seq1=90）+ 多条低分（seq2-4=40），使 no_progress 的「窗口前最优」基线为 90。
async def _seed_restart_pollution_case(eval_floor_seq: int, iteration_count: int) -> uuid.UUID:
    rid = await _make_routine(
        no_progress_patience=3, eval_floor_seq=eval_floor_seq, iteration_count=iteration_count, max_iterations=50
    )
    await _add_iteration(rid, seq=1, status="evaluated", score=90, verdict="progressing")
    await _add_iteration(rid, seq=2, status="evaluated", score=40, verdict="progressing")
    await _add_iteration(rid, seq=3, status="evaluated", score=40, verdict="progressing")
    await _add_iteration(rid, seq=4, status="evaluated", score=40, verdict="progressing")
    await _add_iteration(rid, seq=5, status="executed", exec_status="success", summary="wip")
    return rid


async def test_evaluate_floor_isolates_restarted_attempt():
    """重启回归：eval_floor_seq=4 把旧 seq1-4 排除在决策窗口外，新一轮不被旧历史误判 no_progress。"""
    rid = await _seed_restart_pollution_case(eval_floor_seq=4, iteration_count=1)
    try:
        await _evaluate_phased(rid, score=40, verdict="progressing")
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "running"  # 新窗口几无历史 → 不判停滞
    finally:
        await _cleanup(rid)


async def test_evaluate_without_floor_pre_history_triggers_no_progress():
    """对照：floor=0（未隔离）时旧高基线历史使新低分迭代被 no_progress 终止——证明 floor 的必要性。"""
    rid = await _seed_restart_pollution_case(eval_floor_seq=0, iteration_count=5)
    try:
        await _evaluate_phased(rid, score=40, verdict="progressing")
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "failed"
            assert r.termination_reason == "no_progress"
    finally:
        await _cleanup(rid)


async def test_write_back_no_double_count_when_reaped_midflight():
    """回归（code review #5）：迭代在执行中被 reaper 标记 reaped 后，
    runner 的 write-back 不应把它复活为 executed、也不应重复累加 iteration_count/cost。"""
    rid = await _make_routine(approval_mode="auto", iteration_count=0)
    iid = await _add_iteration(rid, seq=1, status="in_flight", exec_status=None, summary=None)
    try:
        from negentropy.engine.routine.runner import get_runner

        runner = get_runner()
        fake = ClaudeCodeResult(status="success", summary="late", session_id="s3", cost_usd=0.99, turn_count=5)

        # 模拟：write-back 发生前，reaper 已把该迭代置为 reaped
        async with db_session.AsyncSessionLocal() as db:
            it = await db.get(RoutineIteration, iid)
            it.status = "reaped"
            await db.commit()

        # 直接调用内部 write-back（绕过 launch，确定性复现竞态）
        await runner._do_write_back(iid, rid, fake)  # noqa: SLF001

        async with db_session.AsyncSessionLocal() as db:
            it = await db.get(RoutineIteration, iid)
            assert it.status == "reaped"  # 未被复活
            r = await db.get(Routine, rid)
            assert r.iteration_count == 0  # 未被累加
            assert r.total_cost_usd == pytest.approx(0.0)  # 成本未被累加
    finally:
        await _cleanup(rid)


# ---------------------------------------------------------------------------
# 隔离 worktree（基于基线分支 + 通用 FINALIZE/PR）
# ---------------------------------------------------------------------------


async def test_worktree_implement_success_advances_to_finalize():
    """worktree routine（非 phased）：IMPLEMENT 命中成功 → 推进 FINALIZE（FINALIZE/PR 对 worktree 通用）。"""
    rid = await _make_routine(baseline_branch="origin/feature/1.x.x", current_phase="implement", iteration_count=2)
    await _add_iteration(rid, seq=1, phase="implement")
    try:
        await _evaluate_phased(rid, score=92, verdict="pass")
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "running"  # 未直接 succeeded
            assert r.current_phase == "finalize"  # 进入收尾建 PR
    finally:
        await _cleanup(rid)


async def test_worktree_finalize_with_pr_succeeds():
    """worktree routine：FINALIZE 捕获 PR 链接 → succeeded（即便非 phased）。"""
    rid = await _make_routine(baseline_branch="origin/feature/1.x.x", current_phase="finalize", iteration_count=3)
    await _add_iteration(rid, seq=1, phase="finalize", summary="PR_URL=https://github.com/o/r/pull/88\n done")
    try:
        await _evaluate_phased(rid, score=95, verdict="pass")
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "succeeded"
            assert r.termination_reason == "success"
            assert r.pr_url == "https://github.com/o/r/pull/88"
    finally:
        await _cleanup(rid)


async def test_ensure_workspace_targets_worktree_in_build_config():
    """_ensure_workspace 写回 worktree 句柄；_build_config 将 CC cwd 指向 worktree + 相位 permission。"""
    rid = await _make_routine(baseline_branch="origin/feature/1.x.x", cwd="/repo/root", current_phase="implement")
    try:
        orch = RoutineOrchestrator()
        info = WorkspaceInfo(path="/tmp/wt/demo-x", branch="routine/demo-x")
        with patch("negentropy.engine.routine.workspace.ensure_worktree", new=AsyncMock(return_value=info)):
            async with db_session.AsyncSessionLocal() as db:
                r = await db.get(Routine, rid, with_for_update=True)
                assert await orch._ensure_workspace(r) is True
                assert r.worktree_path == "/tmp/wt/demo-x"
                assert r.work_branch == "routine/demo-x"
                await db.commit()
            async with db_session.AsyncSessionLocal() as db:
                r = await db.get(Routine, rid)
                config = await orch._build_config(r)
                assert config.cwd == "/tmp/wt/demo-x"  # CC 实际 cwd = worktree
                assert config.permission_mode == "acceptEdits"  # implement 相位
    finally:
        await _cleanup(rid)


async def test_ensure_workspace_failure_terminates_unrecoverable():
    """worktree 创建失败 → _ensure_workspace False 且 routine 终止 unrecoverable。"""
    rid = await _make_routine(baseline_branch="origin/feature/1.x.x", cwd="/repo/root")
    try:
        orch = RoutineOrchestrator()
        with patch(
            "negentropy.engine.routine.workspace.ensure_worktree",
            new=AsyncMock(side_effect=workspace.WorkspaceError("boom")),
        ):
            async with db_session.AsyncSessionLocal() as db:
                r = await db.get(Routine, rid, with_for_update=True)
                assert await orch._ensure_workspace(r) is False
                assert r.status == "failed"
                assert r.termination_reason == decision_mod.REASON_UNRECOVERABLE
                await db.commit()
    finally:
        await _cleanup(rid)


async def test_reap_workspaces_cleans_succeeded_routine():
    """终态清扫：succeeded routine 的 worktree 被回收（remove_worktree 调用 + worktree_path 置空）。"""
    rid = await _make_routine(
        baseline_branch="origin/feature/1.x.x",
        cwd="/repo/root",
        status="succeeded",
        worktree_path="/tmp/wt/demo",
        work_branch="routine/demo",
    )
    try:
        orch = RoutineOrchestrator()
        with patch("negentropy.engine.routine.workspace.remove_worktree", new=AsyncMock()) as rm:
            cleaned = await orch._reap_workspaces()
            assert cleaned >= 1
            rm.assert_awaited()
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.worktree_path is None  # 句柄已清
    finally:
        await _cleanup(rid)
