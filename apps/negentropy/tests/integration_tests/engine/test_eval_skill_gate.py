"""Eval 基座集成测试 — 真实 Postgres（test DB），Judge/Executor 用 fake（无 LLM/Jinja）。

覆盖单元测试触不到的 DB 路径（综述 §8 + §9.4）：
- SuiteRunner.run_suite 在 visible/holdout 分区上跑候选 vs 基线，正确聚合 + regression_count；
- decide_skill_shadow（visible held-out gain 门）/ decide_skill_canary（holdout 零回归门）双相门；
- CounterfactualAttributor 写回 candidate run 的 eval_results.attribution；
- visible_results_query 结构性排除 holdout run（防 Goodhart 不变量）。
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass

import pytest
from sqlalchemy import delete, func, select

import negentropy.db.session as db_session
from negentropy.engine.eval.attribution import CounterfactualAttributor
from negentropy.engine.eval.runner import CaseOutput, SuiteRunner, visible_results_query
from negentropy.engine.eval.seed import create_suite
from negentropy.engine.evolution.decision import decide_skill_canary, decide_skill_shadow
from negentropy.models.eval_suite import EvalResult, EvalRun, EvalSuite

pytestmark = pytest.mark.asyncio

_OWNER = "itest_eval_user"


# =============================================================================
# Fakes：确定性 Executor + Evaluator（绕开 LLM/Jinja，专注 SuiteRunner 逻辑）
# =============================================================================


class _FakeExecutor:
    """把 case.variables 与 target_version 编码进 body，供 _FakeEvaluator 解析评分。"""

    async def execute(self, *, target_kind, target_ref, target_version, case_input):
        variables = dict(case_input.get("variables") or {})
        body = json.dumps({"version": target_version, "idx": variables.get("idx"), "frozen": variables.get("frozen")})
        return CaseOutput(body=body, digest="d" * 12)


class _FakeEvaluator:
    """按 (version, frozen) 确定性打分。

    - 1.0.0（基线）：一律 70；
    - 1.1.0（候选）：visible 80、holdout ``holdout_score``（默认 72 = 不退步；传 60 = 回退）。
    """

    def __init__(self, *, candidate_holdout_score: float = 72.0) -> None:
        self._candidate_holdout_score = candidate_holdout_score

    async def judge_once(self, *, goal, acceptance_criteria, summary, **_kwargs):
        from negentropy.engine.routine.evaluator import EvaluationResult

        try:
            meta = json.loads(summary)
        except Exception:
            meta = {}
        version = meta.get("version")
        frozen = bool(meta.get("frozen"))
        if version == "1.0.0":
            score = 70.0
        elif version == "1.1.0":
            score = self._candidate_holdout_score if frozen else 80.0
        else:
            score = 50.0
        verdict = "pass" if score >= 70 else "progressing"
        return EvaluationResult(
            ok=True,
            score=int(score),
            verdict=verdict,
            reflection=f"fake reflection for {version} frozen={frozen}",
            judge_prompt="(fake prompt)",
            judge_raw='{"fake": true}',
        )


# =============================================================================
# 辅助
# =============================================================================


@dataclass
class _RunView:
    score_mean: float
    regression_count: int
    n_cases: int
    pass_rate: float = 0.0


async def _run_view(session, run: EvalRun) -> _RunView:
    n_cases = await session.scalar(select(func.count()).select_from(EvalResult).where(EvalResult.run_id == run.id))
    return _RunView(
        score_mean=float(run.score_mean or 0.0),
        regression_count=int(run.regression_count or 0),
        n_cases=int(n_cases or 0),
        pass_rate=float(run.pass_rate or 0.0),
    )


async def _seed_suite(session, *, n_visible=5, n_frozen=5) -> tuple[EvalSuite, str]:
    skill_name = f"eval_target_{uuid.uuid4().hex[:8]}"
    cases = []
    idx = 0
    for _ in range(n_visible):
        cases.append({"input": {"task": f"task-{idx}", "variables": {"idx": idx, "frozen": False}}, "is_frozen": False})
        idx += 1
    for _ in range(n_frozen):
        cases.append({"input": {"task": f"task-{idx}", "variables": {"idx": idx, "frozen": True}}, "is_frozen": True})
        idx += 1
    suite = await create_suite(
        session,
        target_kind="skill",
        target_ref=skill_name,
        owner_id=_OWNER,
        cases=cases,
        scoring_config={"pass_threshold": 70, "max_judge_calls": 50},
        holdout_ratio=0.2,
    )
    return suite, skill_name


async def _cleanup(session, suite_id: str) -> None:
    # EvalRun/EvalCase/EvalResult 经 FK CASCADE 随 suite 删除
    await session.execute(delete(EvalSuite).where(EvalSuite.id == suite_id))
    await session.commit()


# =============================================================================
# 测试：promote 路径（候选 visible 增益、holdout 零回退）
# =============================================================================


async def test_promote_path_visible_gain_and_holdout_clean():
    runner = SuiteRunner(executors={"skill": _FakeExecutor()}, evaluator=_FakeEvaluator())
    async with db_session.AsyncSessionLocal() as session:
        suite, skill_name = await _seed_suite(session)
        try:
            # 基线 visible + holdout
            base_vis = await runner.run_suite(
                session,
                suite=suite,
                target_kind="skill",
                target_ref=skill_name,
                target_version="1.0.0",
                partition="visible",
                trigger="proposal",
            )
            base_hol = await runner.run_suite(
                session,
                suite=suite,
                target_kind="skill",
                target_ref=skill_name,
                target_version="1.0.0",
                partition="holdout",
                trigger="proposal",
            )
            # 候选 visible + holdout
            cand_vis = await runner.run_suite(
                session,
                suite=suite,
                target_kind="skill",
                target_ref=skill_name,
                target_version="1.1.0",
                baseline_version="1.0.0",
                partition="visible",
                trigger="proposal",
            )
            cand_hol = await runner.run_suite(
                session,
                suite=suite,
                target_kind="skill",
                target_ref=skill_name,
                target_version="1.1.0",
                baseline_version="1.0.0",
                partition="holdout",
                trigger="proposal",
            )
            await session.commit()

            # shadow 门（visible held-out gain）：候选 80 vs 基线 70 → gain 10 → hold 放行
            dec_shadow = decide_skill_shadow(
                baseline=await _run_view(session, base_vis),
                candidate=await _run_view(session, cand_vis),
            )
            assert dec_shadow.action == "hold"
            assert cand_vis.score_mean == 80.0
            assert base_vis.score_mean == 70.0

            # canary 门（holdout 零回归）：候选 72 vs 基线 70，无回退 → promote
            dec_canary = decide_skill_canary(
                baseline=await _run_view(session, base_hol),
                candidate=await _run_view(session, cand_hol),
            )
            assert dec_canary.action == "promote"
            assert dec_canary.reason is None or dec_canary.reason == "promoted"
            assert cand_hol.regression_count == 0

            # 反事实归因：候选 visible run vs 基线 visible run → 写回 5 条 attribution
            attributor = CounterfactualAttributor(sample_cap=20)
            count = await attributor.attribute(session, candidate_run_id=cand_vis.id, baseline_run_id=base_vis.id)
            await session.commit()
            assert count == 5
            attr_rows = (
                (
                    await session.execute(
                        select(EvalResult).where(EvalResult.run_id == cand_vis.id, EvalResult.attribution.isnot(None))
                    )
                )
                .scalars()
                .all()
            )
            assert len(attr_rows) == 5
            # 候选 visible 全 +10 → positive
            assert all(r.attribution["influence_label"] == "positive" for r in attr_rows)

            # 防 Goodhart 不变量：visible_results_query 仅返 visible run 的结果（cand_vis 5 + base_vis 5 = 10）
            visible_rows = (await session.execute(visible_results_query(suite_id=suite.id))).scalars().all()
            assert len(visible_rows) == 10  # 不含 2 个 holdout run 的结果
        finally:
            await _cleanup(session, suite.id)


# =============================================================================
# 测试：rollback 路径（候选 holdout 回退）
# =============================================================================


async def test_rollback_path_on_holdout_regression():
    # candidate holdout 打 60（基线 70，回退 10 > delta 5）→ regression_count=2 → rollback
    runner = SuiteRunner(executors={"skill": _FakeExecutor()}, evaluator=_FakeEvaluator(candidate_holdout_score=60.0))
    async with db_session.AsyncSessionLocal() as session:
        suite, skill_name = await _seed_suite(session)
        try:
            base_hol = await runner.run_suite(
                session,
                suite=suite,
                target_kind="skill",
                target_ref=skill_name,
                target_version="1.0.0",
                partition="holdout",
                trigger="proposal",
            )
            cand_hol = await runner.run_suite(
                session,
                suite=suite,
                target_kind="skill",
                target_ref=skill_name,
                target_version="1.1.0",
                baseline_version="1.0.0",
                partition="holdout",
                trigger="proposal",
            )
            await session.commit()

            assert cand_hol.regression_count == 5  # 5 个 holdout case 都从 70→60 回退
            dec = decide_skill_canary(
                baseline=await _run_view(session, base_hol),
                candidate=await _run_view(session, cand_hol),
            )
            assert dec.action == "rollback"
            assert dec.reason == "rolled_back"
        finally:
            await _cleanup(session, suite.id)


# =============================================================================
# 测试：shadow 拒绝路径（visible 无增益）+ budget_exceeded
# =============================================================================


async def test_shadow_reject_when_candidate_no_gain():
    # 候选 visible 也打 70（无增益）→ reject。复用基线版本号作候选以模拟无改进。
    runner = SuiteRunner(executors={"skill": _FakeExecutor()}, evaluator=_FakeEvaluator())
    async with db_session.AsyncSessionLocal() as session:
        suite, skill_name = await _seed_suite(session)
        try:
            base_vis = await runner.run_suite(
                session,
                suite=suite,
                target_kind="skill",
                target_ref=skill_name,
                target_version="1.0.0",
                partition="visible",
                trigger="proposal",
            )
            # 候选仍是 1.0.0 版本号（fake evaluator 对 1.0.0 一律 70）→ gain 0 → reject
            cand_vis = await runner.run_suite(
                session,
                suite=suite,
                target_kind="skill",
                target_ref=skill_name,
                target_version="1.0.0",
                baseline_version="1.0.0",
                partition="visible",
                trigger="proposal",
            )
            await session.commit()
            dec = decide_skill_shadow(
                baseline=await _run_view(session, base_vis),
                candidate=await _run_view(session, cand_vis),
            )
            assert dec.action == "reject"
            assert dec.reason == "no_gain"
        finally:
            await _cleanup(session, suite.id)


async def test_run_fails_when_budget_exceeded():
    runner = SuiteRunner(executors={"skill": _FakeExecutor()}, evaluator=_FakeEvaluator())
    async with db_session.AsyncSessionLocal() as session:
        suite, skill_name = await _seed_suite(session, n_visible=8, n_frozen=2)
        try:
            # max_judge_calls 设为 5 < 10 case → 整 suite（partition=all = 10 case）超预算
            suite.scoring_config = {"pass_threshold": 70, "max_judge_calls": 5}
            run = await runner.run_suite(
                session,
                suite=suite,
                target_kind="skill",
                target_ref=skill_name,
                target_version="1.0.0",
                partition="all",
                trigger="proposal",
            )
            await session.commit()
            assert run.status == "failed"
            assert "budget_exceeded" in (run.error or "")
        finally:
            await _cleanup(session, suite.id)
