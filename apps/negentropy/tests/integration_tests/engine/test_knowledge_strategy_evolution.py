"""第五进化面集成测试（综述 §7，R7-a）—— knowledge_strategy。

KnowledgeStrategyHandler 经 SuiteRunner + decide_skill_* 双相门，promote 翻 memory_config_versions
active 指针。TargetHandler 第五面（eval 指标对齐 knowledge/graph/quality.py 综合质量分）。
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
from negentropy.engine.evolution.handlers import KnowledgeStrategyHandler
from negentropy.models.eval_suite import EvalSuite
from negentropy.models.evolution import EvolutionProposal, MemoryConfigVersion

pytestmark = pytest.mark.asyncio
_OWNER = "itest_kg_strategy_user"


class _Exec:
    async def execute(self, *, target_kind, target_ref, target_version, case_input):
        return CaseOutput(body=json.dumps({"version": target_version}), digest="d" * 12)


class _Eval:
    async def judge_once(self, *, goal, acceptance_criteria, summary, **_kw):
        from negentropy.engine.routine.evaluator import EvaluationResult

        m = json.loads(summary)
        score = 70 if m.get("version") == "0.1.0" else 80
        return EvaluationResult(
            ok=True, score=score, verdict="pass", reflection="r", judge_prompt="(fake)", judge_raw="{}"
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
            builtin_tool_enabled=False,
            knowledge_strategy_enabled=False,
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
    monkeypatch.setattr("negentropy.engine.evolution.handlers.knowledge_strategy.settings", ns)
    instance = o.EvolutionOrchestrator()
    instance._handlers["knowledge_strategy"] = KnowledgeStrategyHandler(
        runner=SuiteRunner(executors={"kg_extraction": _Exec()}, evaluator=_Eval())
    )
    yield instance


async def _seed():
    from negentropy.engine.eval.seed import create_suite

    scope = f"knowledge_strategy_{uuid.uuid4().hex[:8]}"
    pid = uuid.uuid4()
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(MemoryConfigVersion).where(MemoryConfigVersion.config_scope == scope))
        db.add(
            MemoryConfigVersion(
                config_scope=scope,
                version="0.1.0",
                snapshot={"entity_prompt": "base-entity", "relation_prompt": "base-rel", "ann_threshold": 0.85},
                origin="code_sync",
                is_active=True,
            )
        )
        db.add(
            MemoryConfigVersion(
                config_scope=scope,
                version="0.2.0",
                snapshot={"entity_prompt": "improved-entity", "relation_prompt": "improved-rel", "ann_threshold": 0.88},
                origin="evolution",
                is_active=False,
            )
        )
        cases = [
            {
                "input": {
                    "task": f"t-{i}",
                    "variables": {"idx": i, "frozen": bool(i >= 5)},
                    "sample_text": "sample doc text",
                },
                "is_frozen": bool(i >= 5),
            }
            for i in range(10)
        ]
        await create_suite(
            db,
            target_kind="kg_extraction",
            target_ref=scope,
            owner_id=_OWNER,
            cases=cases,
            scoring_config={"pass_threshold": 70, "max_judge_calls": 50},
            holdout_ratio=0.5,
        )
        db.add(
            EvolutionProposal(
                id=pid,
                target_kind="knowledge_strategy",
                target_ref=scope,
                base_version="0.1.0",
                proposed_version="0.2.0",
                payload={"entity_prompt": "improved-entity"},
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


async def test_knowledge_strategy_evolution_flips_config(orch):
    scope, pid = await _seed()
    try:
        await orch.inspect_once()  # shadow → canary
        async with db_session.AsyncSessionLocal() as db:
            row = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()
            assert row.status == "canary"

        await orch.inspect_once()  # canary → promote（翻 memory_config_versions active）
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
            assert active.version == "0.2.0"
            assert active.snapshot["entity_prompt"] == "improved-entity"
    finally:
        await _cleanup(scope)
