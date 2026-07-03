"""第四进化面集成测试（综述 §7，R6-a）—— builtin_tool_config。

证明 TargetHandler 抽象扩到第四面：BuiltinToolConfigHandler 经 SuiteRunner + decide_skill_* 双相门，
promote 翻 builtin_tools.active_version 指针。
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
from negentropy.engine.evolution.handlers import BuiltinToolConfigHandler
from negentropy.models.builtin_tool import BuiltinTool, BuiltinToolVersion
from negentropy.models.eval_suite import EvalSuite
from negentropy.models.evolution import EvolutionProposal

pytestmark = pytest.mark.asyncio
_OWNER = "itest_builtintool_user"


class _Exec:
    async def execute(self, *, target_kind, target_ref, target_version, case_input):
        return CaseOutput(body=json.dumps({"version": target_version}), digest="d" * 12)


class _Eval:
    async def judge_once(self, *, goal, acceptance_criteria, summary, **_kw):
        from negentropy.engine.routine.evaluator import EvaluationResult

        m = json.loads(summary)
        score = 70 if m.get("version") == "0.1.0" else (72 if json.loads(summary).get("f") else 80)
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


def _patch(monkeypatch):
    ns = _settings()
    monkeypatch.setattr(o, "settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.retrieval.settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers._shared.settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.skill.settings", ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.builtin_tool.settings", ns)


@pytest.fixture
async def orch(monkeypatch):
    _patch(monkeypatch)
    instance = o.EvolutionOrchestrator()
    instance._handlers["builtin_tool_config"] = BuiltinToolConfigHandler(
        runner=SuiteRunner(executors={"builtin_tool": _Exec()}, evaluator=_Eval())
    )
    yield instance


async def _seed():
    from negentropy.engine.eval.seed import create_suite

    name = f"tool_{uuid.uuid4().hex[:8]}"
    pid = uuid.uuid4()
    async with db_session.AsyncSessionLocal() as db:
        tool = BuiltinTool(
            owner_id=_OWNER,
            name=name,
            tool_type="search",
            version="0.1.0",
            active_version="0.1.0",
            config={"top_k": 10},
            is_enabled=True,
        )
        db.add(tool)
        await db.flush()
        for v, cfg in (("0.1.0", {"top_k": 10}), ("0.2.0", {"top_k": 20})):
            db.add(BuiltinToolVersion(tool_id=tool.id, version=v, snapshot={"config": cfg}))
        cases = [
            {"input": {"task": f"t-{i}", "variables": {"idx": i, "frozen": bool(i >= 5)}}, "is_frozen": bool(i >= 5)}
            for i in range(10)
        ]
        await create_suite(
            db,
            target_kind="builtin_tool",
            target_ref=name,
            owner_id=_OWNER,
            cases=cases,
            scoring_config={"pass_threshold": 70, "max_judge_calls": 50},
            holdout_ratio=0.5,
        )
        db.add(
            EvolutionProposal(
                id=pid,
                target_kind="builtin_tool_config",
                target_ref=name,
                base_version="0.1.0",
                proposed_version="0.2.0",
                payload={"config": {"top_k": 20}},
                origin="reflection",
                status="shadow_eval",
                risk_level="low",
            )
        )
        await db.commit()
    return name, tool, pid


async def _cleanup(name: str, tool_id) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(EvalSuite).where(EvalSuite.target_ref == name))
        await db.execute(delete(EvolutionProposal).where(EvolutionProposal.target_ref == name))
        await db.execute(delete(BuiltinTool).where(BuiltinTool.id == tool_id))
        await db.commit()


async def test_builtin_tool_evolution_flips_active_version(orch):
    name, tool, pid = await _seed()
    try:
        await orch.inspect_once()  # shadow visible → canary
        async with db_session.AsyncSessionLocal() as db:
            row = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()
            assert row.status == "canary"

        await orch.inspect_once()  # canary holdout → promote（翻 builtin_tools.active_version）
        async with db_session.AsyncSessionLocal() as db:
            p = (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()
            assert p.status == "promoted"
            tool_row = (await db.execute(select(BuiltinTool).where(BuiltinTool.id == tool.id))).scalar_one()
            assert tool_row.active_version == "0.2.0"  # active 翻转到候选
    finally:
        await _cleanup(name, tool.id)
