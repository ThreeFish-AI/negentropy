"""纵向复评集成测试（真实 Postgres）—— 综述 §8 #3 + §10.5 + §9.3。

驱动：已晋升 skill proposal（canary_metrics.candidate_mean=72）+ fake runner 复跑 holdout 打 60
（drift 12 > 3）→ recheck_promoted 回退 active_version 到 base_version。
"""

from __future__ import annotations

import json
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import delete, select

import negentropy.db.session as db_session
from negentropy.engine.eval.runner import CaseOutput, SuiteRunner
from negentropy.engine.evolution import orchestrator as o
from negentropy.engine.evolution.handlers import SkillTemplateHandler
from negentropy.models.eval_suite import EvalRun, EvalSuite
from negentropy.models.evolution import EvolutionProposal
from negentropy.models.skill import Skill, SkillVersion

pytestmark = pytest.mark.asyncio

_OWNER = "itest_longitudinal_user"


class _FakeExecutor:
    async def execute(self, *, target_kind, target_ref, target_version, case_input):
        variables = dict(case_input.get("variables") or {})
        body = json.dumps({"version": target_version, "frozen": variables.get("frozen")})
        return CaseOutput(body=body, digest="d" * 12)


class _DriftEval:
    """1.1.0 holdout 打 60（drift vs 晋升均值 72）。"""

    async def judge_once(self, *, goal, acceptance_criteria, summary, **_kw):
        from negentropy.engine.routine.evaluator import EvaluationResult

        meta = json.loads(summary)
        score = 60 if meta.get("version") == "1.1.0" else 70
        return EvaluationResult(
            ok=True,
            score=score,
            verdict="pass" if score >= 70 else "progressing",
            reflection="r",
            judge_prompt="(fake)",
            judge_raw="{}",
        )


@pytest.fixture
async def orch(monkeypatch):
    settings_ns = SimpleNamespace(
        app=SimpleNamespace(name="negentropy"),
        evolution=SimpleNamespace(
            enabled=True,
            auto_mode=True,
            proposer_enabled=False,
            skill_enabled=False,
            min_samples=50,
            shadow_window_seconds=3600,
            canary_window_seconds=3600,
            max_canary_seconds=21600,
            canary_bucket_ratio_pct=10.0,
            zero_hit_regression_max=0.01,
            max_proposals_per_day=8,
            max_cost_usd_daily=None,
            proposer_model=None,
            longitudinal_recheck_interval_seconds=3600,
            longitudinal_drift_max=3.0,
        ),
    )
    monkeypatch.setattr(o, "settings", settings_ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.retrieval.settings", settings_ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers._shared.settings", settings_ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.skill.settings", settings_ns)
    instance = o.EvolutionOrchestrator()
    fake_runner = SuiteRunner(executors={"skill": _FakeExecutor()}, evaluator=_DriftEval())
    instance._handlers["skill_template"] = SkillTemplateHandler(runner=fake_runner)
    yield instance


async def _seed_promoted_skill() -> tuple[str, Skill, uuid.UUID]:
    skill_name = f"longitudinal_{uuid.uuid4().hex[:8]}"
    proposal_id = uuid.uuid4()
    async with db_session.AsyncSessionLocal() as db:
        skill = Skill(
            owner_id=_OWNER,
            name=skill_name,
            version="1.1.0",
            active_version="1.1.0",
            prompt_template="t",
            is_enabled=True,
        )
        db.add(skill)
        await db.flush()
        for v, tpl in (("1.0.0", "base"), ("1.1.0", "improved")):
            db.add(
                SkillVersion(
                    skill_id=skill.id,
                    version=v,
                    snapshot={"prompt_template": tpl, "required_tools": [], "resources": []},
                )
            )
        cases = []
        for i in range(5):
            cases.append({"input": {"task": f"t-{i}", "variables": {"idx": i, "frozen": False}}, "is_frozen": False})
        for i in range(5):
            cases.append({"input": {"task": f"t-{i}", "variables": {"idx": i, "frozen": True}}, "is_frozen": True})
        from negentropy.engine.eval.seed import create_suite

        await create_suite(
            db,
            target_kind="skill",
            target_ref=skill_name,
            owner_id=_OWNER,
            cases=cases,
            scoring_config={"pass_threshold": 70, "max_judge_calls": 50},
            holdout_ratio=0.5,
        )
        # 已晋升提案：晋升时 holdout 均值 72（candidate_mean）
        db.add(
            EvolutionProposal(
                id=proposal_id,
                target_kind="skill_template",
                target_ref=skill_name,
                base_version="1.0.0",
                proposed_version="1.1.0",
                payload={"prompt_template": "improved"},
                origin="reflection",
                status="promoted",
                risk_level="low",
                canary_metrics={"candidate_mean": 72.0, "baseline_mean": 70.0},
            )
        )
        await db.commit()
    return skill_name, skill, proposal_id


async def _cleanup(skill_name: str, skill_id) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(EvalSuite).where(EvalSuite.target_ref == skill_name))
        await db.execute(delete(EvolutionProposal).where(EvolutionProposal.target_ref == skill_name))
        await db.execute(delete(Skill).where(Skill.id == skill_id))
        await db.commit()


async def test_longitudinal_recheck_reverts_active_version_on_drift(orch):
    skill_name, skill, proposal_id = await _seed_promoted_skill()
    try:
        result = await orch.recheck_promoted()
        assert result["rechecked"] == 1
        assert result["reverted"] == 1

        async with db_session.AsyncSessionLocal() as db:
            skill_row = (await db.execute(select(Skill).where(Skill.id == skill.id))).scalar_one()
            assert skill_row.active_version == "1.0.0"  # 回退到前一稳定版
            # 复评 run 落库（trigger=scheduled, partition=holdout）
            recheck_run = (
                await db.execute(
                    select(EvalRun).where(
                        EvalRun.target_ref == skill_name,
                        EvalRun.target_version == "1.1.0",
                        EvalRun.trigger == "scheduled",
                        EvalRun.partition == "holdout",
                    )
                )
            ).scalar_one()
            assert recheck_run.score_mean == 60.0
    finally:
        await _cleanup(skill_name, skill.id)


async def test_longitudinal_recheck_holds_when_stable(orch, monkeypatch):
    """复评打 72（= 晋升均值，无 drift）→ hold，active_version 不变。"""

    class _StableEval:
        async def judge_once(self, *, goal, acceptance_criteria, summary, **_kw):
            from negentropy.engine.routine.evaluator import EvaluationResult

            meta = json.loads(summary)
            score = 72 if meta.get("version") == "1.1.0" else 70
            return EvaluationResult(
                ok=True,
                score=score,
                verdict="pass",
                reflection="r",
                judge_prompt="(fake)",
                judge_raw="{}",
            )

    orch._handlers["skill_template"]._runner = SuiteRunner(
        executors={"skill": _FakeExecutor()}, evaluator=_StableEval()
    )
    skill_name, skill, _proposal_id = await _seed_promoted_skill()
    try:
        result = await orch.recheck_promoted()
        assert result["rechecked"] == 1
        assert result["reverted"] == 0
        async with db_session.AsyncSessionLocal() as db:
            skill_row = (await db.execute(select(Skill).where(Skill.id == skill.id))).scalar_one()
            assert skill_row.active_version == "1.1.0"  # 未回退
    finally:
        await _cleanup(skill_name, skill.id)
