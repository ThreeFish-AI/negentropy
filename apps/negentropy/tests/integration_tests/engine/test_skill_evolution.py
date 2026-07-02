"""Skill 进化闭环集成测试（真实 Postgres）—— PR3 SkillTemplateHandler 端到端。

驱动 propose→shadow(visible 增益门)→canary(holdout 零回归门)→promote(翻 active_version)。
SuiteRunner 的 executor + evaluator 用 fake（无 LLM/Jinja），专注 handler 门裁决 + 发布语义。
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
from negentropy.models.eval_suite import EvalSuite
from negentropy.models.evolution import EvolutionProposal
from negentropy.models.skill import Skill, SkillVersion

pytestmark = pytest.mark.asyncio

_OWNER = "itest_skill_evo_user"


# =============================================================================
# Fakes：确定性 Executor + Evaluator（绕开 LLM/Jinja）
# =============================================================================


class _FakeExecutor:
    async def execute(self, *, target_kind, target_ref, target_version, case_input):
        variables = dict(case_input.get("variables") or {})
        body = json.dumps({"version": target_version, "frozen": variables.get("frozen")})
        return CaseOutput(body=body, digest="d" * 12)


class _FakeEvaluator:
    """1.0.0 一律 70；1.1.0 visible=80 / holdout=72（候选增益、零回归）。"""

    async def judge_once(self, *, goal, acceptance_criteria, summary, **_kwargs):
        from negentropy.engine.routine.evaluator import EvaluationResult

        meta = json.loads(summary)
        version = meta.get("version")
        frozen = bool(meta.get("frozen"))
        if version == "1.0.0":
            score = 70
        elif version == "1.1.0":
            score = 72 if frozen else 80
        else:
            score = 50
        return EvaluationResult(
            ok=True,
            score=score,
            verdict="pass" if score >= 70 else "progressing",
            reflection=f"fake {version} frozen={frozen}",
            judge_prompt="(fake)",
            judge_raw="{}",
        )


@pytest.fixture
async def orch(monkeypatch):
    """开启 evolution + auto_mode；retrieval/skill proposer 关闭（测试直接插入提案，bypass spawn）。"""
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
        ),
    )
    monkeypatch.setattr(o, "settings", settings_ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.retrieval.settings", settings_ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers._shared.settings", settings_ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.skill.settings", settings_ns)
    instance = o.EvolutionOrchestrator()
    # 注入 fake-runner handler（绕开真实 LLM Judge）
    fake_runner = SuiteRunner(executors={"skill": _FakeExecutor()}, evaluator=_FakeEvaluator())
    instance._handlers["skill_template"] = SkillTemplateHandler(runner=fake_runner)
    yield instance


async def _seed_skill_and_suite(*, n_visible=5, n_frozen=5) -> tuple[str, Skill]:
    skill_name = f"skill_evo_{uuid.uuid4().hex[:8]}"
    async with db_session.AsyncSessionLocal() as db:
        skill = Skill(
            owner_id=_OWNER,
            name=skill_name,
            version="1.0.0",
            active_version="1.0.0",
            prompt_template="base template",
            is_enabled=True,
        )
        db.add(skill)
        await db.flush()
        db.add(
            SkillVersion(
                skill_id=skill.id,
                version="1.0.0",
                snapshot={"prompt_template": "base template", "required_tools": [], "resources": []},
            )
        )
        cases = []
        idx = 0
        for _ in range(n_visible):
            cases.append(
                {"input": {"task": f"t-{idx}", "variables": {"idx": idx, "frozen": False}}, "is_frozen": False}
            )
            idx += 1
        for _ in range(n_frozen):
            cases.append({"input": {"task": f"t-{idx}", "variables": {"idx": idx, "frozen": True}}, "is_frozen": True})
            idx += 1
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
        await db.commit()
    return skill_name, skill


async def _cleanup(skill_name: str, skill_id) -> None:
    async with db_session.AsyncSessionLocal() as db:
        # EvalSuite CASCADE → cases/runs/results；SkillVersion CASCADE 随 Skill
        await db.execute(delete(EvalSuite).where(EvalSuite.target_ref == skill_name))
        await db.execute(delete(EvolutionProposal).where(EvolutionProposal.target_ref == skill_name))
        await db.execute(delete(Skill).where(Skill.id == skill_id))
        await db.commit()


# ===========================================================================
# shadow（visible 增益门）→ canary（holdout 零回归门）→ promote（翻 active_version）
# ===========================================================================


async def test_skill_evolution_promote_path(orch):
    skill_name, skill = await _seed_skill_and_suite()
    proposal_id = uuid.uuid4()
    async with db_session.AsyncSessionLocal() as db:
        db.add(
            EvolutionProposal(
                id=proposal_id,
                target_kind="skill_template",
                target_ref=skill_name,
                base_version="1.0.0",
                proposed_version="1.1.0",
                payload={"prompt_template": "improved template"},
                origin="reflection",
                status="shadow_eval",
                risk_level="low",
            )
        )
        await db.commit()
    try:
        # tick 1：shadow（visible）→ 候选 80 vs 基线 70，gain 10 → hold → canary
        await orch.inspect_once()
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == proposal_id))).scalar_one()
            assert p.status == "canary"
            assert p.shadow_eval_result["candidate_mean"] == 80.0

        # tick 2：canary（holdout）→ 候选 72 vs 基线 70，零回归 → promote
        await orch.inspect_once()
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == proposal_id))).scalar_one()
            assert p.status == "promoted"
            assert p.canary_metrics["candidate_mean"] == 72.0
            # active_version 翻转到候选
            skill_row = (await db.execute(select(Skill).where(Skill.id == skill.id))).scalar_one()
            assert skill_row.active_version == "1.1.0"
            # 候选 SkillVersion 由 _ensure_candidate_version 创建（snapshot.prompt_template = 变异文）
            cand_ver = (
                await db.execute(
                    select(SkillVersion).where(SkillVersion.skill_id == skill.id, SkillVersion.version == "1.1.0")
                )
            ).scalar_one()
            assert cand_ver.snapshot["prompt_template"] == "improved template"
    finally:
        await _cleanup(skill_name, skill.id)


# ===========================================================================
# rollback 路径：候选 holdout 回退 → 不翻 active_version
# ===========================================================================


async def test_skill_evolution_rollback_path(orch, monkeypatch):
    skill_name, skill = await _seed_skill_and_suite()
    proposal_id = uuid.uuid4()
    async with db_session.AsyncSessionLocal() as db:
        db.add(
            EvolutionProposal(
                id=proposal_id,
                target_kind="skill_template",
                target_ref=skill_name,
                base_version="1.0.0",
                proposed_version="1.1.0",
                payload={"prompt_template": "improved template"},
                origin="reflection",
                status="shadow_eval",
                risk_level="low",
            )
        )
        await db.commit()
    # 替换 evaluator：候选 holdout 打 60（基线 70 → 回退 10 > delta 5）
    from negentropy.engine.eval.runner import SuiteRunner as _SR

    class _RegressEval:
        async def judge_once(self, *, goal, acceptance_criteria, summary, **_kw):
            from negentropy.engine.routine.evaluator import EvaluationResult

            meta = json.loads(summary)
            version = meta.get("version")
            frozen = bool(meta.get("frozen"))
            if version == "1.0.0":
                score = 70
            elif version == "1.1.0":
                score = 60 if frozen else 80  # visible 仍增益，holdout 回退
            else:
                score = 50
            return EvaluationResult(
                ok=True,
                score=score,
                verdict="pass" if score >= 70 else "progressing",
                reflection="r",
                judge_prompt="(fake)",
                judge_raw="{}",
            )

    orch._handlers["skill_template"]._runner = _SR(executors={"skill": _FakeExecutor()}, evaluator=_RegressEval())
    try:
        await orch.inspect_once()  # shadow visible → canary
        async with db_session.AsyncSessionLocal() as db:
            assert (
                await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == proposal_id))
            ).scalar_one().status == "canary"

        await orch.inspect_once()  # canary holdout → 回退 → rollback
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == proposal_id))).scalar_one()
            assert p.status == "rolled_back"
            skill_row = (await db.execute(select(Skill).where(Skill.id == skill.id))).scalar_one()
            assert skill_row.active_version == "1.0.0"  # 未翻
    finally:
        await _cleanup(skill_name, skill.id)
