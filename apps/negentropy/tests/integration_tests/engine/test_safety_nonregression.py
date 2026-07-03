"""SI #6 safety non-regression 集成测试（综述 §8 + §9.3）。

skill 绑定能力套件 + 安全套件（is_safety=True）：候选通过能力 holdout 门（decide_skill_canary
promote）但在安全套件上回归（decide_safety_nonregression rollback）→ 晋升被阻断（pending_approval），
active_version 不翻。
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
_OWNER = "itest_safety_user"


class _Exec:
    async def execute(self, *, target_kind, target_ref, target_version, case_input):
        v = dict(case_input.get("variables") or {})
        return CaseOutput(
            body=json.dumps({"version": target_version, "frozen": v.get("frozen"), "safety": v.get("safety")}),
            digest="d" * 12,
        )


class _Eval:
    """1.0.0→70；1.1.0 能力集 holdout→72（过 canary 门）；1.1.0 安全集→60（回归）。"""

    async def judge_once(self, *, goal, acceptance_criteria, summary, **_kw):
        from negentropy.engine.routine.evaluator import EvaluationResult

        m = json.loads(summary)
        ver, safety = m.get("version"), bool(m.get("safety"))
        if ver == "1.0.0":
            score = 70
        elif safety:
            score = 60  # 安全集回归
        else:
            score = 72  # 能力集 holdout（通过 decide_skill_canary）
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
    ns = SimpleNamespace(
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
    monkeypatch.setattr(o, "settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.retrieval.settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers._shared.settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.skill.settings", ns)
    instance = o.EvolutionOrchestrator()
    instance._handlers["skill_template"] = SkillTemplateHandler(
        runner=SuiteRunner(executors={"skill": _Exec()}, evaluator=_Eval())
    )
    yield instance


async def _seed() -> tuple[str, Skill, uuid.UUID]:
    from datetime import UTC, datetime, timedelta

    from negentropy.engine.eval.seed import create_suite

    name = f"safety_{uuid.uuid4().hex[:8]}"
    pid = uuid.uuid4()
    started = (datetime.now(UTC) - timedelta(seconds=7200)).isoformat()
    async with db_session.AsyncSessionLocal() as db:
        skill = Skill(
            owner_id=_OWNER, name=name, version="1.0.0", active_version="1.0.0", prompt_template="t", is_enabled=True
        )
        db.add(skill)
        await db.flush()
        for v in ("1.0.0", "1.1.0"):
            db.add(
                SkillVersion(
                    skill_id=skill.id, version=v, snapshot={"prompt_template": v, "required_tools": [], "resources": []}
                )
            )
        # 能力套件（is_safety=False）：5 visible + 5 frozen
        cap_cases = [
            {"input": {"task": f"c-{i}", "variables": {"idx": i, "frozen": bool(i >= 5)}}, "is_frozen": bool(i >= 5)}
            for i in range(10)
        ]
        await create_suite(
            db,
            target_kind="skill",
            target_ref=name,
            owner_id=_OWNER,
            cases=cap_cases,
            scoring_config={"pass_threshold": 70, "max_judge_calls": 50},
            holdout_ratio=0.5,
        )
        # 安全套件（is_safety=True）：5 frozen，variables.safety=True
        safety_cases = [
            {"input": {"task": f"s-{i}", "variables": {"idx": i, "frozen": True, "safety": True}}, "is_frozen": True}
            for i in range(5)
        ]
        suite = await create_suite(
            db,
            target_kind="skill",
            target_ref=name,
            owner_id=_OWNER,
            cases=safety_cases,
            scoring_config={"pass_threshold": 70, "max_judge_calls": 50},
            holdout_ratio=1.0,
        )
        suite.is_safety = True
        # 直接插 canary 提案（bypass shadow，聚焦 safety 门）
        db.add(
            EvolutionProposal(
                id=pid,
                target_kind="skill_template",
                target_ref=name,
                base_version="1.0.0",
                proposed_version="1.1.0",
                payload={"prompt_template": "improved"},
                origin="reflection",
                status="canary",
                risk_level="low",
                canary_config={"bucket_ratio": 10.0, "window_seconds": 3600, "started_at": started, "min_samples": 5},
            )
        )
        await db.commit()
    return name, skill, pid


async def _cleanup(name: str, skill_id) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(EvalSuite).where(EvalSuite.target_ref == name))
        await db.execute(delete(EvolutionProposal).where(EvolutionProposal.target_ref == name))
        await db.execute(delete(Skill).where(Skill.id == skill_id))
        await db.commit()


async def test_safety_regression_blocks_promote(orch):
    name, skill, pid = await _seed()
    try:
        await orch.inspect_once()  # canary tick：能力门过、安全门回归 → 阻断
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()
            assert p.status == "pending_approval"  # 安全回归高风险，交人审，不自动晋升
            skill_row = (await db.execute(select(Skill).where(Skill.id == skill.id))).scalar_one()
            assert skill_row.active_version == "1.0.0"  # 未翻
    finally:
        await _cleanup(name, skill.id)
