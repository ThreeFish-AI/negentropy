"""第三进化面集成测试（综述 §7，R3-c）—— memory_pipeline_prompt。

证明 ``TargetHandler`` 抽象 + eval 基座 target-agnostic：memory_pipeline_prompt 面（非 skill）经
SuiteRunner + decide_skill_* 双相门，promote 翻 ``memory_config_versions`` active 指针。
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
from negentropy.engine.evolution.handlers import MemoryPipelinePromptHandler
from negentropy.models.eval_suite import EvalSuite
from negentropy.models.evolution import EvolutionProposal, MemoryConfigVersion

pytestmark = pytest.mark.asyncio
_OWNER = "itest_mempipe_user"


class _Exec:
    async def execute(self, *, target_kind, target_ref, target_version, case_input):
        v = dict(case_input.get("variables") or {})
        return CaseOutput(body=json.dumps({"version": target_version, "frozen": v.get("frozen")}), digest="d" * 12)


class _Eval:
    async def judge_once(self, *, goal, acceptance_criteria, summary, **_kw):
        from negentropy.engine.routine.evaluator import EvaluationResult

        m = json.loads(summary)
        ver, frozen = m.get("version"), bool(m.get("frozen"))
        if ver == "0.1.0":
            score = 70
        else:
            score = 72 if frozen else 80  # 候选 visible 增益 / holdout 零回归
        return EvaluationResult(
            ok=True,
            score=score,
            verdict="pass" if score >= 70 else "progressing",
            reflection="r",
            judge_prompt="(fake)",
            judge_raw="{}",
        )


def _settings():
    return SimpleNamespace(
        app=SimpleNamespace(name="negentropy"),
        evolution=SimpleNamespace(
            enabled=True,
            auto_mode=True,
            proposer_enabled=False,
            skill_enabled=False,
            memory_pipeline_enabled=False,
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
            runtime_canary_enabled=False,
            runtime_canary_window_seconds=3600,
        ),
    )


@pytest.fixture
async def orch(monkeypatch):
    ns = _settings()
    monkeypatch.setattr(o, "settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.retrieval.settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers._shared.settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.skill.settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.memory_pipeline.settings", ns)
    instance = o.EvolutionOrchestrator()
    instance._handlers["memory_pipeline_prompt"] = MemoryPipelinePromptHandler(
        runner=SuiteRunner(executors={"memory_pipeline_prompt": _Exec()}, evaluator=_Eval())
    )
    yield instance


async def _seed():
    from negentropy.engine.eval.seed import create_suite

    scope = f"pipeline_prompt_{uuid.uuid4().hex[:8]}"
    pid = uuid.uuid4()
    async with db_session.AsyncSessionLocal() as db:
        # 清 retrieval scope 残留 + 植入本 scope 的 active(v0.1) + candidate(v0.2) 配置
        await db.execute(delete(MemoryConfigVersion).where(MemoryConfigVersion.config_scope == scope))
        db.add(
            MemoryConfigVersion(
                config_scope=scope,
                version="0.1.0",
                snapshot={"prompt": "active-prompt"},
                origin="code_sync",
                is_active=True,
            )
        )
        db.add(
            MemoryConfigVersion(
                config_scope=scope,
                version="0.2.0",
                snapshot={"prompt": "improved-prompt"},
                origin="evolution",
                is_active=False,
            )
        )
        cases = [
            {
                "input": {"task": f"t-{i}", "variables": {"idx": i, "frozen": bool(i >= 5)}, "sample_text": "s"},
                "is_frozen": bool(i >= 5),
            }
            for i in range(10)
        ]
        await create_suite(
            db,
            target_kind="memory_pipeline_prompt",
            target_ref=scope,
            owner_id=_OWNER,
            cases=cases,
            scoring_config={"pass_threshold": 70, "max_judge_calls": 50},
            holdout_ratio=0.5,
        )
        db.add(
            EvolutionProposal(
                id=pid,
                target_kind="memory_pipeline_prompt",
                target_ref=scope,
                base_version="0.1.0",
                proposed_version="0.2.0",
                payload={"prompt": "improved-prompt"},
                origin="reflection",
                status="shadow_eval",
                risk_level="low",
            )
        )
        await db.commit()
    return scope, pid


async def _cleanup(scope: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(EvalSuite).where(EvalSuite.target_ref == scope))
        await db.execute(delete(EvolutionProposal).where(EvolutionProposal.target_ref == scope))
        await db.execute(delete(MemoryConfigVersion).where(MemoryConfigVersion.config_scope == scope))
        await db.commit()


async def test_memory_pipeline_evolution_flips_config_pointer(orch):
    scope, pid = await _seed()
    try:
        await orch.inspect_once()  # shadow visible → canary
        async with db_session.AsyncSessionLocal() as db:
            assert (
                await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))
            ).scalar_one().status == "canary"

        await orch.inspect_once()  # canary holdout → promote（翻 memory_config_versions active 指针）
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()
            assert p.status == "promoted"
            active = (
                await db.execute(
                    select(MemoryConfigVersion).where(
                        MemoryConfigVersion.config_scope == scope, MemoryConfigVersion.is_active.is_(True)
                    )
                )
            ).scalar_one()
            assert active.version == "0.2.0"  # active 翻转到候选
            assert active.snapshot["prompt"] == "improved-prompt"
    finally:
        await _cleanup(scope)
