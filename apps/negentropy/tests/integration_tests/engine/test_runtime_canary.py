"""Runtime canary 集成测试（综述 §9.3 受控发布，R3-b）。

① 状态机：canary 离线门通过 → runtime_canary 灰度窗口 → 窗口到期全量晋升（翻 active_version）。
② 分桶路由：runtime_canary 在途时，``resolve_skills`` 按 bucket_key 把命中桶的会话解析到候选 version。
"""

from __future__ import annotations

import json
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import delete, select

import negentropy.db.session as db_session
from negentropy.agents.skills_injector import resolve_skills
from negentropy.engine.eval.runner import CaseOutput, SuiteRunner
from negentropy.engine.evolution import orchestrator as o
from negentropy.engine.evolution.handlers import SkillTemplateHandler
from negentropy.engine.evolution.queries import invalidate_canary_cache
from negentropy.models.eval_suite import EvalSuite
from negentropy.models.evolution import EvolutionProposal
from negentropy.models.skill import Skill, SkillVersion

pytestmark = pytest.mark.asyncio
_OWNER = "itest_runtime_canary_user"


class _Exec:
    async def execute(self, *, target_kind, target_ref, target_version, case_input):
        return CaseOutput(body=json.dumps({"version": target_version}), digest="d" * 12)


class _Eval:
    async def judge_once(self, *, goal, acceptance_criteria, summary, **_kw):
        from negentropy.engine.routine.evaluator import EvaluationResult

        m = json.loads(summary)
        score = 70 if m.get("version") == "1.0.0" else 72  # 候选 holdout 72 > 基线 70 → 过 canary 门
        return EvaluationResult(
            ok=True, score=score, verdict="pass", reflection="r", judge_prompt="(fake)", judge_raw="{}"
        )


def _settings(*, runtime_canary_enabled: bool):
    return SimpleNamespace(
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
            canary_bucket_ratio_pct=50.0,
            zero_hit_regression_max=0.01,
            max_proposals_per_day=8,
            max_cost_usd_daily=None,
            proposer_model=None,
            longitudinal_recheck_interval_seconds=3600,
            longitudinal_drift_max=3.0,
            runtime_canary_enabled=runtime_canary_enabled,
            runtime_canary_window_seconds=0,
        ),
    )


async def _seed_skill_and_suite():
    from negentropy.engine.eval.seed import create_suite

    name = f"rc_{uuid.uuid4().hex[:8]}"
    async with db_session.AsyncSessionLocal() as db:
        skill = Skill(
            owner_id=_OWNER, name=name, version="1.0.0", active_version="1.0.0", prompt_template="t", is_enabled=True
        )
        db.add(skill)
        await db.flush()
        for v, tpl in (("1.0.0", "active-tpl"), ("1.1.0", "candidate-tpl")):
            db.add(
                SkillVersion(
                    skill_id=skill.id,
                    version=v,
                    snapshot={"prompt_template": tpl, "required_tools": [], "resources": []},
                )
            )
        cases = [
            {
                "input": {"task": f"t-{i}", "variables": {"idx": i, "frozen": bool(i >= 5)}},
                "is_frozen": bool(i >= 5),
            }
            for i in range(10)
        ]
        await create_suite(
            db,
            target_kind="skill",
            target_ref=name,
            owner_id=_OWNER,
            cases=cases,
            scoring_config={"pass_threshold": 70, "max_judge_calls": 50},
            holdout_ratio=0.5,
        )
        await db.commit()
    return name, skill


async def _cleanup(name: str, skill_id) -> None:
    invalidate_canary_cache(name)
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(EvalSuite).where(EvalSuite.target_ref == name))
        await db.execute(delete(EvolutionProposal).where(EvolutionProposal.target_ref == name))
        await db.execute(delete(Skill).where(Skill.id == skill_id))
        await db.commit()
    invalidate_canary_cache(name)


def _patch_settings(monkeypatch, *, runtime_canary_enabled: bool) -> None:
    """统一 patch 四处 settings 绑定（orchestrator + retrieval/_shared/skill handler）。"""
    ns = _settings(runtime_canary_enabled=runtime_canary_enabled)
    monkeypatch.setattr(o, "settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.retrieval.settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers._shared.settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.skill.settings", ns)


# ===========================================================================
# ① 状态机：canary → runtime_canary → promoted
# ===========================================================================


async def test_runtime_canary_state_machine(monkeypatch):
    from datetime import UTC, datetime, timedelta

    _patch_settings(monkeypatch, runtime_canary_enabled=True)
    instance = o.EvolutionOrchestrator()
    instance._handlers["skill_template"] = SkillTemplateHandler(
        runner=SuiteRunner(executors={"skill": _Exec()}, evaluator=_Eval())
    )
    name, skill = await _seed_skill_and_suite()
    pid = uuid.uuid4()
    started = (datetime.now(UTC) - timedelta(seconds=7200)).isoformat()
    async with db_session.AsyncSessionLocal() as db:
        db.add(
            EvolutionProposal(
                id=pid,
                target_kind="skill_template",
                target_ref=name,
                base_version="1.0.0",
                proposed_version="1.1.0",
                payload={"prompt_template": "candidate-tpl"},
                origin="reflection",
                status="canary",
                risk_level="low",
                canary_config={"bucket_ratio": 50.0, "window_seconds": 3600, "started_at": started, "min_samples": 5},
            )
        )
        await db.commit()
    try:
        # tick 1：canary 离线门通过 → runtime_canary_enabled → 进 runtime_canary（不立即晋升）
        await instance.inspect_once()
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()
            assert p.status == "runtime_canary"
            skill_row = (await db.execute(select(Skill).where(Skill.id == skill.id))).scalar_one()
            assert skill_row.active_version == "1.0.0"  # 尚未全量翻转

        # tick 2：runtime_canary 窗口到期（fixture window=0）→ 全量晋升
        await instance.inspect_once()
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()
            assert p.status == "promoted"
            skill_row = (await db.execute(select(Skill).where(Skill.id == skill.id))).scalar_one()
            assert skill_row.active_version == "1.1.0"
    finally:
        await _cleanup(name, skill.id)


async def test_runtime_canary_disabled_promotes_immediately(monkeypatch):
    """runtime_canary_enabled=False → 离线门通过即全量晋升（不进 runtime_canary，向后兼容）。"""
    _patch_settings(monkeypatch, runtime_canary_enabled=False)
    instance = o.EvolutionOrchestrator()
    instance._handlers["skill_template"] = SkillTemplateHandler(
        runner=SuiteRunner(executors={"skill": _Exec()}, evaluator=_Eval())
    )
    name, skill = await _seed_skill_and_suite()
    pid = uuid.uuid4()
    from datetime import UTC, datetime, timedelta

    started = (datetime.now(UTC) - timedelta(seconds=7200)).isoformat()
    async with db_session.AsyncSessionLocal() as db:
        db.add(
            EvolutionProposal(
                id=pid,
                target_kind="skill_template",
                target_ref=name,
                base_version="1.0.0",
                proposed_version="1.1.0",
                payload={"prompt_template": "candidate-tpl"},
                origin="reflection",
                status="canary",
                risk_level="low",
                canary_config={"bucket_ratio": 50.0, "window_seconds": 3600, "started_at": started, "min_samples": 5},
            )
        )
        await db.commit()
    try:
        await instance.inspect_once()
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()
            assert p.status == "promoted"  # 直接晋升，未进 runtime_canary
    finally:
        await _cleanup(name, skill.id)


# ===========================================================================
# ①b 窗口末复评门：runtime_canary 窗口到期复跑 holdout，drift → rollback（不全量发布）
# ===========================================================================


class _DriftEval:
    """复评时 1.1.0 holdout 打 60（drift vs 晋升均值 72）。"""

    async def judge_once(self, *, goal, acceptance_criteria, summary, **_kw):
        from negentropy.engine.routine.evaluator import EvaluationResult

        m = json.loads(summary)
        score = 60 if m.get("version") == "1.1.0" else 70
        return EvaluationResult(
            ok=True,
            score=score,
            verdict="pass" if score >= 70 else "progressing",
            reflection="r",
            judge_prompt="(fake)",
            judge_raw="{}",
        )


async def test_runtime_canary_window_end_drift_rollbacks(monkeypatch):
    """窗口末复评 drift（60 vs 晋升 72）→ rollback，不全量翻 active_version。"""
    _patch_settings(monkeypatch, runtime_canary_enabled=True)
    instance = o.EvolutionOrchestrator()
    instance._handlers["skill_template"] = SkillTemplateHandler(
        runner=SuiteRunner(executors={"skill": _Exec()}, evaluator=_DriftEval())
    )
    name, skill = await _seed_skill_and_suite()
    pid = uuid.uuid4()
    from datetime import UTC, datetime, timedelta

    started = (datetime.now(UTC) - timedelta(seconds=7200)).isoformat()  # 窗口已过
    async with db_session.AsyncSessionLocal() as db:
        db.add(
            EvolutionProposal(
                id=pid,
                target_kind="skill_template",
                target_ref=name,
                base_version="1.0.0",
                proposed_version="1.1.0",
                payload={"prompt_template": "candidate-tpl"},
                origin="reflection",
                status="runtime_canary",
                risk_level="low",
                canary_config={"bucket_ratio": 50.0, "window_seconds": 3600, "started_at": started},
                canary_metrics={"candidate_mean": 72.0, "baseline_mean": 70.0},
            )
        )
        await db.commit()
    try:
        await instance.inspect_once()  # 窗口已过 → 复评 drift → rollback
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()
            assert p.status == "rolled_back"  # drift，不晋升
            skill_row = (await db.execute(select(Skill).where(Skill.id == skill.id))).scalar_one()
            assert skill_row.active_version == "1.0.0"  # 未翻
    finally:
        await _cleanup(name, skill.id)


# ===========================================================================
# ①c 在线 error-rate 门：候选桶 expand_skill error-rate 退化 → rollback（R6-b）
# ===========================================================================


async def test_runtime_canary_online_error_rate_gate_rollbacks(monkeypatch):
    """候选桶 expand_skill error-rate 高于基线桶 → 在线门 rollback（不全量发布）。"""
    from datetime import UTC, datetime, timedelta

    from negentropy.models.tool_telemetry import ToolInvocation

    _patch_settings(monkeypatch, runtime_canary_enabled=True)
    instance = o.EvolutionOrchestrator()
    instance._handlers["skill_template"] = SkillTemplateHandler(
        runner=SuiteRunner(executors={"skill": _Exec()}, evaluator=_Eval())
    )
    name, skill = await _seed_skill_and_suite()
    pid = uuid.uuid4()
    started = datetime.now(UTC) - timedelta(seconds=3600)
    async with db_session.AsyncSessionLocal() as db:
        # 候选桶（canary_assignment=1.1.0）：15 调用，8 error（高 error-rate）
        for i in range(15):
            db.add(
                ToolInvocation(
                    caller_kind="adk_agent",
                    tool_kind="skill",
                    tool_ref="expand_skill",
                    tool_version="unversioned",
                    skill_ref=name,
                    status="error" if i < 8 else "success",
                    canary_assignment="1.1.0",
                    outcome_source="none",
                    created_at=started + timedelta(seconds=i),
                )
            )
        # 基线桶（canary_assignment=NULL）：15 调用，1 error（低 error-rate）
        for i in range(15):
            db.add(
                ToolInvocation(
                    caller_kind="adk_agent",
                    tool_kind="skill",
                    tool_ref="expand_skill",
                    tool_version="unversioned",
                    skill_ref=name,
                    status="error" if i < 1 else "success",
                    canary_assignment=None,
                    outcome_source="none",
                    created_at=started + timedelta(seconds=i),
                )
            )
        db.add(
            EvolutionProposal(
                id=pid,
                target_kind="skill_template",
                target_ref=name,
                base_version="1.0.0",
                proposed_version="1.1.0",
                payload={"prompt_template": "candidate-tpl"},
                origin="reflection",
                status="runtime_canary",
                risk_level="low",
                canary_config={"bucket_ratio": 50.0, "window_seconds": 3600, "started_at": started.isoformat()},
                canary_metrics={"candidate_mean": 72.0, "baseline_mean": 70.0},
            )
        )
        await db.commit()
    try:
        await instance.inspect_once()  # 窗口已过 → 在线门候选 error-rate 退化 → rollback
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()
            assert p.status == "rolled_back"  # 在线 error-rate 门拦截
            skill_row = (await db.execute(select(Skill).where(Skill.id == skill.id))).scalar_one()
            assert skill_row.active_version == "1.0.0"  # 未翻
    finally:
        await _cleanup(name, skill.id)
        async with db_session.AsyncSessionLocal() as db:
            from sqlalchemy import delete

            await db.execute(delete(ToolInvocation).where(ToolInvocation.skill_ref == name))
            await db.commit()


# ===========================================================================
# ② 分桶路由：resolve_skills 命中桶 → 候选 version
# ===========================================================================


async def test_runtime_canary_bucket_routing():
    """runtime_canary 在途（bucket_ratio=50）→ 约 half bucket_key 解析候选 1.1.0，half 解析 active 1.0.0。"""
    name, skill = await _seed_skill_and_suite()
    async with db_session.AsyncSessionLocal() as db:
        db.add(
            EvolutionProposal(
                target_kind="skill_template",
                target_ref=name,
                base_version="1.0.0",
                proposed_version="1.1.0",
                payload={"prompt_template": "candidate-tpl"},
                origin="reflection",
                status="runtime_canary",
                risk_level="low",
                canary_config={"bucket_ratio": 50.0, "window_seconds": 3600, "started_at": "2026-07-03T00:00:00+00:00"},
            )
        )
        await db.commit()
    invalidate_canary_cache(name)
    try:
        candidate_hits = 0
        active_hits = 0
        async with db_session.AsyncSessionLocal() as db:
            for i in range(20):
                resolved = await resolve_skills(db, [name], owner_id=_OWNER, bucket_key=f"sess-{i}")
                tpl = resolved[0].prompt_template if resolved else ""
                if tpl == "candidate-tpl":
                    candidate_hits += 1
                elif tpl == "active-tpl":
                    active_hits += 1
        assert candidate_hits > 0 and active_hits > 0  # 分桶生效：两种 version 都被解析到
        assert candidate_hits + active_hits == 20
    finally:
        await _cleanup(name, skill.id)
