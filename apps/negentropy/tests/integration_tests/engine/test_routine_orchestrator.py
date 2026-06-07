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


async def _evaluate_and_drain(orch: RoutineOrchestrator) -> int:
    """触发评估并等待后台评估任务完成（评估已从心跳剥离为后台任务）。

    ``_evaluate_and_decide`` 现仅认领 executed 迭代并 spawn 后台评估任务（非阻塞）。
    集成测试需等待这些后台任务收尾后再断言终态，故 await ``orch._eval_tasks`` 全部完成。
    返回本 tick 新触发的评估数（与认领数一致）。
    """
    launched = await orch._evaluate_and_decide()  # noqa: SLF001
    tasks = list(orch._eval_tasks.values())  # noqa: SLF001
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
    return launched


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
            count = await _evaluate_and_drain(orch)
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
            await _evaluate_and_drain(orch)
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "running"  # 未终止
            assert r.last_score == 55
    finally:
        await _cleanup(rid)


async def _evaluate_phased(rid, *, score, verdict):
    """辅助：以 mock evaluator 跑一次评估-决策（含后台任务收尾），返回评估计数。"""
    orch = RoutineOrchestrator()
    with patch.object(
        orch._evaluator,
        "evaluate",
        new=AsyncMock(return_value=EvaluationResult(ok=True, score=score, verdict=verdict, reflection="r")),
    ):
        return await _evaluate_and_drain(orch)


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


async def test_plan_phase_skips_verification_gate():
    """PLAN 相位评估跳过验证门控（verification_command 置空）——方案阶段无实现，跑 pytest 既无意义又污染评分。"""
    rid = await _make_routine(
        config={"workflow": "phased"},
        current_phase="plan",
        iteration_count=1,
        verification_command="uv run pytest -q",
    )
    await _add_iteration(rid, seq=1, phase="plan")
    captured: dict = {}

    async def _capture(routine_view, iter_view):
        captured["vc"] = routine_view.verification_command
        return EvaluationResult(ok=True, score=40, verdict="progressing", reflection="r")

    try:
        orch = RoutineOrchestrator()
        with patch.object(orch._evaluator, "evaluate", new=AsyncMock(side_effect=_capture)):
            await _evaluate_and_drain(orch)
        assert captured["vc"] is None  # PLAN 相位门控被跳过
    finally:
        await _cleanup(rid)


async def test_implement_phase_runs_verification_gate():
    """IMPLEMENT 相位评估正常传入 verification_command（门控照跑），与 PLAN 跳过形成对照。"""
    rid = await _make_routine(
        config={"workflow": "phased"},
        current_phase="implement",
        iteration_count=2,
        verification_command="uv run pytest -q",
    )
    await _add_iteration(rid, seq=1, phase="implement")
    captured: dict = {}

    async def _capture(routine_view, iter_view):
        captured["vc"] = routine_view.verification_command
        return EvaluationResult(ok=True, score=55, verdict="progressing", reflection="r", gate_exit_code=0)

    try:
        orch = RoutineOrchestrator()
        with patch.object(orch._evaluator, "evaluate", new=AsyncMock(side_effect=_capture)):
            await _evaluate_and_drain(orch)
        assert captured["vc"] == "uv run pytest -q"  # IMPLEMENT 相位门控照跑
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


async def test_evaluate_slow_judge_does_not_block_heartbeat():
    """根因回归（卡在 Evaluate）：评估已从心跳剥离为后台任务。

    模拟一个耗时远超心跳 60s 超时的 Judge：``_evaluate_and_decide``（心跳认领阶段）必须近乎瞬时返回，
    迭代被认领为 ``evaluating``；后台任务完成后才翻转 ``evaluated``。证明慢 Judge 不再阻塞心跳。
    """
    import time as _time

    rid = await _make_routine(iteration_count=1)
    iid = await _add_iteration(rid, seq=1)
    try:
        orch = RoutineOrchestrator()

        async def _slow_eval(*_a, **_k):
            await asyncio.sleep(0.4)  # 代表"远超 60s"的慢调用；测试用 0.4s 验证非阻塞语义
            return EvaluationResult(ok=True, score=92, verdict="pass", reflection="ok")

        with patch.object(orch._evaluator, "evaluate", new=AsyncMock(side_effect=_slow_eval)):
            t0 = _time.monotonic()
            launched = await orch._evaluate_and_decide()  # 心跳认领阶段：应近乎瞬时
            claim_elapsed = _time.monotonic() - t0
            assert launched == 1
            assert claim_elapsed < 0.2, f"心跳认领不应阻塞在慢 Judge 上，实测 {claim_elapsed:.2f}s"

            # 认领后迭代应为 evaluating（后台任务尚未完成）
            async with db_session.AsyncSessionLocal() as db:
                it = await db.get(RoutineIteration, iid)
                assert it.status == "evaluating"

            # 等待后台评估任务收尾
            await asyncio.gather(*orch._eval_tasks.values(), return_exceptions=True)

        async with db_session.AsyncSessionLocal() as db:
            it = await db.get(RoutineIteration, iid)
            assert it.status == "evaluated"
            r = await db.get(Routine, rid)
            assert r.status == "succeeded"
            assert r.best_score == 92
    finally:
        await _cleanup(rid)


async def test_evaluate_failure_below_patience_resets_to_executed():
    """评估失败且未达容忍阈值 → 迭代回退 executed（清 lease）供下轮重评，eval_attempts 累加。

    后台化前是「留在 executed」；后台化后认领时已置 evaluating，失败路径须显式回退 executed，
    否则迭代被永久钉死在 evaluating（新版"卡死"风险），故此回归锁。
    """
    rid = await _make_routine(iteration_count=1)
    iid = await _add_iteration(rid, seq=1)
    try:
        orch = RoutineOrchestrator()
        with patch.object(
            orch._evaluator,
            "evaluate",
            new=AsyncMock(return_value=EvaluationResult(ok=False, error="LLM unavailable")),
        ):
            await _evaluate_and_drain(orch)
        async with db_session.AsyncSessionLocal() as db:
            it = await db.get(RoutineIteration, iid)
            assert it.status == "executed"  # 回退供重评（非永久 evaluating）
            assert it.lease_expires_at is None
            assert int((it.metrics or {}).get("eval_attempts", 0)) == 1
            assert it.eval_error == "LLM unavailable"
            r = await db.get(Routine, rid)
            assert r.status == "running"  # 未终止
    finally:
        await _cleanup(rid)


async def test_evaluate_failure_at_patience_terminates_unrecoverable():
    """评估失败累计达 eval_failure_patience → 迭代翻转 evaluated(unrecoverable) 且 routine 终止。"""
    from negentropy.config import settings

    rid = await _make_routine(iteration_count=1)
    # 预置 eval_attempts = patience-1，使本轮失败即触达阈值
    iid = await _add_iteration(rid, seq=1, metrics={"eval_attempts": settings.routine.eval_failure_patience - 1})
    try:
        orch = RoutineOrchestrator()
        with patch.object(
            orch._evaluator,
            "evaluate",
            new=AsyncMock(return_value=EvaluationResult(ok=False, error="LLM down")),
        ):
            await _evaluate_and_drain(orch)
        async with db_session.AsyncSessionLocal() as db:
            it = await db.get(RoutineIteration, iid)
            assert it.status == "evaluated"
            assert it.verdict == "unrecoverable"
            r = await db.get(Routine, rid)
            assert r.status == "failed"
            assert r.termination_reason == decision_mod.REASON_UNRECOVERABLE
    finally:
        await _cleanup(rid)


async def test_reap_orphan_evaluating_resets_to_executed():
    """崩溃恢复回归：lease 过期的 evaluating 孤儿迭代（本进程不再持有）→ 回退 executed 供重评。"""
    from datetime import UTC, datetime, timedelta

    rid = await _make_routine(iteration_count=1)
    expired = datetime.now(UTC) - timedelta(seconds=10)
    iid = await _add_iteration(rid, seq=1, status="evaluating", lease_expires_at=expired)
    try:
        orch = RoutineOrchestrator()  # _eval_tasks 空 → 不持有该迭代
        reaped = await orch._reap_orphans()
        assert reaped >= 1
        async with db_session.AsyncSessionLocal() as db:
            it = await db.get(RoutineIteration, iid)
            assert it.status == "executed"
            assert it.lease_expires_at is None
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
# 上下文窗口耗尽自愈（死亡螺旋根因修复）—— runner write-back 会话三态决策
# ---------------------------------------------------------------------------


async def test_write_back_context_exhausted_clears_session_for_cold_start():
    """根因 1+2 联合锁：上下文耗尽迭代写回 → 清空 routine.claude_session_id（下轮冷启动）、
    记 reflections._context_resets、给 iteration.metrics 打 context_exhausted 标记。

    复刻 a83d9c94：原实现无条件回写 session_id 把 routine 钉死在已满会话；修复后改为清空。"""
    from negentropy.engine.claude_code.service import ERROR_KIND_CONTEXT_EXHAUSTED
    from negentropy.engine.routine.runner import get_runner

    rid = await _make_routine(approval_mode="auto", iteration_count=0, claude_session_id="full-session")
    iid = await _add_iteration(rid, seq=1, status="in_flight", exec_status=None, summary=None)
    try:
        runner = get_runner()
        # exec error + error_kind=context_exhausted，CC 仍回带（已满的）session_id
        fake = ClaudeCodeResult(
            status="error",
            summary="API Error: The model has reached its context window limit.",
            session_id="full-session",
            cost_usd=0.0,
            turn_count=1,
            error="CLI exited with code 1",
            error_kind=ERROR_KIND_CONTEXT_EXHAUSTED,
        )
        await runner._do_write_back(iid, rid, fake)  # noqa: SLF001

        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.claude_session_id is None  # 污染会话被清空 → 下轮冷启动
            assert int((r.reflections or {}).get("_context_resets", 0)) == 1
            assert r.iteration_count == 1
            it = await db.get(RoutineIteration, iid)
            assert it.status == "executed"
            assert (it.metrics or {}).get("context_exhausted") is True
    finally:
        await _cleanup(rid)


async def test_write_back_success_preserves_session_resume():
    """根因 2 反向回归锁：正常成功执行 → routine.claude_session_id 正常续接（自愈逻辑不误伤）。"""
    from negentropy.engine.routine.runner import get_runner

    rid = await _make_routine(approval_mode="auto", iteration_count=0, claude_session_id="old-session")
    iid = await _add_iteration(rid, seq=1, status="in_flight", exec_status=None, summary=None)
    try:
        runner = get_runner()
        fake = ClaudeCodeResult(status="success", summary="ok", session_id="new-session", cost_usd=1.0, turn_count=10)
        await runner._do_write_back(iid, rid, fake)  # noqa: SLF001

        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.claude_session_id == "new-session"  # 正常续接
            it = await db.get(RoutineIteration, iid)
            assert (it.metrics or {}).get("context_exhausted") is None  # 未误标
    finally:
        await _cleanup(rid)


async def test_write_back_context_exhausted_at_reset_cap_keeps_session_and_marks_exhausted():
    """上限封顶（防 runaway）：已达 context_reset_max 时不再清空 session、记 _context_reset_exhausted，
    使 decision 不再豁免、落回 unrecoverable 自然路径。

    用 monkeypatch 把 context_reset_max 压到 1，构造 resets 已达上限的现场。"""
    from negentropy.config import settings
    from negentropy.config.routine import RoutineSettings
    from negentropy.engine.claude_code.service import ERROR_KIND_CONTEXT_EXHAUSTED
    from negentropy.engine.routine.runner import get_runner

    rid = await _make_routine(
        approval_mode="auto",
        iteration_count=2,
        claude_session_id="full-session",
        reflections={"_context_resets": 1},  # 已重置 1 次
    )
    iid = await _add_iteration(rid, seq=3, status="in_flight", exec_status=None, summary=None)
    capped = RoutineSettings(context_reset_max=1)  # 上限=1，已达
    import pytest as _pytest

    with _pytest.MonkeyPatch.context() as mp:
        mp.setattr(type(settings), "routine", property(lambda self: capped))
        try:
            runner = get_runner()
            fake = ClaudeCodeResult(
                status="error",
                summary="context window limit",
                session_id="full-session",
                error_kind=ERROR_KIND_CONTEXT_EXHAUSTED,
            )
            await runner._do_write_back(iid, rid, fake)  # noqa: SLF001

            async with db_session.AsyncSessionLocal() as db:
                r = await db.get(Routine, rid)
                # 达上限：不再清空（保持已满会话——但仍标记 context_exhausted 以触发 decision 判定）
                assert r.claude_session_id == "full-session"
                assert int((r.reflections or {}).get("_context_resets", 0)) == 1  # 未再 +1
                assert (r.reflections or {}).get("_context_reset_exhausted") is True
        finally:
            await _cleanup(rid)


async def test_write_back_session_not_found_clears_session_unconditionally():
    """根因回归（会话续接死亡螺旋）：``--resume`` 会话失效（session_not_found）→ 无条件清空
    routine.claude_session_id 冷启动，并给 iteration.metrics 打 session_reset 标记。

    复刻模板 9e90c3c7 seq3-5 现场：陈旧 claude_session_id 使每轮 resume 立即失败
    （0 turns/$0），原实现不自愈 → 连续 unrecoverable。修复后清空会话使下轮冷启动。"""
    from negentropy.engine.claude_code.service import ERROR_KIND_SESSION_NOT_FOUND
    from negentropy.engine.routine.runner import get_runner

    rid = await _make_routine(approval_mode="auto", iteration_count=0, claude_session_id="stale-session")
    iid = await _add_iteration(rid, seq=1, status="in_flight", exec_status=None, summary=None)
    try:
        runner = get_runner()
        fake = ClaudeCodeResult(
            status="error",
            summary="",
            session_id=None,
            cost_usd=0.0,
            turn_count=0,
            error="CLI exited with code 1; stderr: No conversation found with session ID: stale-session",
            error_kind=ERROR_KIND_SESSION_NOT_FOUND,
        )
        await runner._do_write_back(iid, rid, fake)  # noqa: SLF001

        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.claude_session_id is None  # 失效会话被清空 → 下轮冷启动
            assert r.iteration_count == 1
            it = await db.get(RoutineIteration, iid)
            assert it.status == "executed"
            assert (it.metrics or {}).get("session_reset") is True
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


# ---------------------------------------------------------------------------
# _build_config 工具白名单扩展（Routine 默认含 WebFetch/WebSearch）
# ---------------------------------------------------------------------------


async def test_build_config_uses_routine_default_tools():
    """_build_config 默认使用 Routine 扩展工具集（含 WebFetch/WebSearch），而非全局 6 工具默认。"""
    rid = await _make_routine(cwd="/tmp", config={})
    try:
        orch = RoutineOrchestrator()
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            config = await orch._build_config(r)
            # 扩展默认包含 WebFetch + WebSearch
            assert "WebFetch" in config.allowed_tools
            assert "WebSearch" in config.allowed_tools
            # 基础工具也在
            assert "Bash" in config.allowed_tools
            assert "Edit" in config.allowed_tools
    finally:
        await _cleanup(rid)


async def test_build_config_per_routine_tools_override():
    """per-routine config.allowed_tools 显式指定时覆盖默认；交互工具被强制并入（ISSUE-123）。"""
    rid = await _make_routine(cwd="/tmp", config={"allowed_tools": ["Bash", "Read"]})
    try:
        orch = RoutineOrchestrator()
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            config = await orch._build_config(r)
            # 显式覆盖的基础工具保留在前
            assert config.allowed_tools[:2] == ["Bash", "Read"]
            # auto_answer 默认开 → 交互工具被强制并入（见 test_build_config_forces_interactive_tools）
            assert "AskUserQuestion" in config.allowed_tools
            assert "ExitPlanMode" in config.allowed_tools
    finally:
        await _cleanup(rid)


async def test_build_config_forces_interactive_tools_when_auto_answer():
    """ISSUE-123：auto_answer_questions 开启时，AskUserQuestion + ExitPlanMode 必入 allowed_tools。

    根因回归锁定：二者不在白名单 → CLI 拒绝（tool_result is_error "Answer questions?"/"Exit plan mode?"）
    → Engine 经 stdin 写回的 Plan Review/auto-answer 永不送达 CC → 评审反馈闭环失效、CC 报错后单方面
    ExitPlanMode 交付。强制并入即修复反馈链路。
    """
    rid = await _make_routine(cwd="/tmp", config={"allowed_tools": ["Bash"]})
    try:
        orch = RoutineOrchestrator()
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            config = await orch._build_config(r)
            assert "AskUserQuestion" in config.allowed_tools, "交互应答须放行 AskUserQuestion"
            assert "ExitPlanMode" in config.allowed_tools, "交互应答须放行 ExitPlanMode"
            # 不重复并入（幂等）
            assert config.allowed_tools.count("AskUserQuestion") == 1
    finally:
        await _cleanup(rid)


async def test_build_config_disallowed_tools_passthrough():
    """per-routine config.disallowed_tools 正确透传到 ClaudeCodeConfig。"""
    rid = await _make_routine(cwd="/tmp", config={"disallowed_tools": ["Task"]})
    try:
        orch = RoutineOrchestrator()
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            config = await orch._build_config(r)
            assert config.disallowed_tools == ["Task"]
    finally:
        await _cleanup(rid)


async def test_build_config_mcp_config_merges_into_default():
    """per-routine config.mcp_config 与全局默认**合并而非替换**。

    迁移 0062 把系统内置 playwright 浏览器 MCP 注入 builtin_tools(claude_code) 全局默认，
    `_build_config` 读取该默认后，per-routine 自定义 server 应被合并进来，而默认的
    playwright 不应被抹除——保证"为所有 Routine 内置浏览器 MCP"的语义对自定义了
    mcp_config 的 routine 同样成立。
    """
    mcp = {"test-server": {"type": "stdio", "command": "echo"}}
    rid = await _make_routine(cwd="/tmp", config={"mcp_config": mcp})
    try:
        orch = RoutineOrchestrator()
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            config = await orch._build_config(r)
            # per-routine 具名 server 已合并
            assert config.mcp_config["test-server"] == mcp["test-server"]
            # 系统默认 playwright 浏览器 MCP 未被覆盖抹除
            assert "playwright" in config.mcp_config
    finally:
        await _cleanup(rid)


async def test_build_config_default_provisions_playwright_browser_mcp():
    """默认 Routine（未自定义 mcp_config/allowed_tools）即获得系统内置 playwright 浏览器 MCP。

    端到端验证 provisioning 链路：迁移 0062 → builtin_tools.config →
    _load_claude_code_defaults → _build_config 的 mcp_config；并验证 mcp__playwright
    已进入 allowed_tools（相位 acceptEdits 不自动放行 MCP 调用，须显式 allow）。
    """
    rid = await _make_routine(cwd="/tmp", config={})
    try:
        orch = RoutineOrchestrator()
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            config = await orch._build_config(r)
            assert "playwright" in (config.mcp_config or {})
            assert "mcp__playwright" in config.allowed_tools
    finally:
        await _cleanup(rid)
