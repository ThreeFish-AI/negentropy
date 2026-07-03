"""AgentLoopExecutor 路由集成测试（真实 Postgres）—— 综述 §3 skill 指导真实任务行为。

验证 ``scoring_config.execution_mode="agent_loop"`` 使 SuiteRunner 走 agent_executor（单轮
skill-conditioned 生成）而非默认 SkillExecutor（judge-the-prompt）。agent_executor 注入 fake，
不调真实 LLM；通过产出 body 的可识别标记证明路由。
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import delete

import negentropy.db.session as db_session
from negentropy.engine.eval.runner import CaseOutput, SuiteRunner
from negentropy.models.eval_suite import EvalCase, EvalSuite

pytestmark = pytest.mark.asyncio
_OWNER = "itest_agent_loop_user"

_AGENT_MARK = "AGENT_GENERATED_OUTPUT"


class _FakeAgentExec:
    """模拟 AgentLoopExecutor：恒定产出带标记的 body（证明 agent 路径被选中）。"""

    async def execute(self, *, target_kind, target_ref, target_version, case_input):
        return CaseOutput(body=_AGENT_MARK, digest="a" * 12)


class _DefaultSkillExec:
    """模拟默认 SkillExecutor：产出无标记 body（若误选，Judge 给低分）。"""

    async def execute(self, *, target_kind, target_ref, target_version, case_input):
        return CaseOutput(body="(rendered prompt template)", digest="s" * 12)


class _Eval:
    async def judge_once(self, *, goal, acceptance_criteria, summary, **_kw):
        from negentropy.engine.routine.evaluator import EvaluationResult

        # 命中 agent 标记 → 高分；否则低分（证明哪个 executor 跑了）
        score = 90 if _AGENT_MARK in (summary or "") else 40
        return EvaluationResult(
            ok=True,
            score=score,
            verdict="pass" if score >= 70 else "progressing",
            reflection=summary or "",
            judge_prompt="(fake)",
            judge_raw="{}",
        )


async def _seed_suite(*, execution_mode: str | None) -> tuple[str, EvalSuite]:
    name = f"agentloop_{uuid.uuid4().hex[:8]}"
    scoring = {"pass_threshold": 70, "max_judge_calls": 50}
    if execution_mode:
        scoring["execution_mode"] = execution_mode
    async with db_session.AsyncSessionLocal() as db:
        suite = EvalSuite(
            target_kind="skill",
            target_ref=name,
            owner_id=_OWNER,
            scoring_config=scoring,
            holdout_ratio=0.0,
        )
        db.add(suite)
        await db.flush()
        for i in range(6):
            db.add(
                EvalCase(
                    suite_id=suite.id,
                    is_frozen=False,
                    input={"task": f"t-{i}", "variables": {}},
                    weight=1.0,
                    source="manual",
                )
            )
        await db.commit()
    return name, suite


async def _cleanup(name: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(EvalSuite).where(EvalSuite.target_ref == name))
        await db.commit()


async def test_execution_mode_agent_loop_uses_agent_executor():
    """execution_mode=agent_loop → SuiteRunner 用 agent_executor，产出带标记→高分。"""
    name, suite = await _seed_suite(execution_mode="agent_loop")
    try:
        runner = SuiteRunner(
            executors={"skill": _DefaultSkillExec()},  # 默认 skill executor（不应被选）
            agent_executor=_FakeAgentExec(),
            evaluator=_Eval(),
        )
        async with db_session.AsyncSessionLocal() as db:
            run = await runner.run_suite(
                db,
                suite=suite,
                target_kind="skill",
                target_ref=name,
                target_version="1.0.0",
                partition="visible",
            )
            await db.commit()
            assert run.status == "completed"
            assert run.score_mean == 90.0  # agent 标记命中 → 高分（证明走了 agent_executor）
    finally:
        await _cleanup(name)


async def test_default_mode_uses_skill_executor():
    """无 execution_mode → 默认 SkillExecutor（无 agent 标记 → 低分）。"""
    name, suite = await _seed_suite(execution_mode=None)
    try:
        runner = SuiteRunner(
            executors={"skill": _DefaultSkillExec()}, agent_executor=_FakeAgentExec(), evaluator=_Eval()
        )
        async with db_session.AsyncSessionLocal() as db:
            run = await runner.run_suite(
                db,
                suite=suite,
                target_kind="skill",
                target_ref=name,
                target_version="1.0.0",
                partition="visible",
            )
            await db.commit()
            assert run.score_mean == 40.0  # 默认 executor 无标记 → 低分
    finally:
        await _cleanup(name)


_AGENT_V2_MARK = "AGENT_V2_MULTI_TURN_OUTPUT"


async def test_execution_mode_agent_loop_v2_uses_v2_executor():
    """execution_mode=agent_loop_v2 → SuiteRunner 用 agent_v2_executor（多轮推理路径）。"""

    class _FakeV2Exec:
        async def execute(self, *, target_kind, target_ref, target_version, case_input):
            return CaseOutput(body=_AGENT_V2_MARK, digest="v" * 12, cost_usd=0.03)

    name, suite = await _seed_suite(execution_mode="agent_loop_v2")
    try:
        runner = SuiteRunner(
            executors={"skill": _DefaultSkillExec()},
            agent_executor=_FakeAgentExec(),
            agent_v2_executor=_FakeV2Exec(),
            evaluator=_Eval(),
        )
        # _Eval scores 90 when _AGENT_MARK in summary; let's make it score v2 mark too
        async with db_session.AsyncSessionLocal() as db:
            run = await runner.run_suite(
                db,
                suite=suite,
                target_kind="skill",
                target_ref=name,
                target_version="1.0.0",
                partition="visible",
            )
            await db.commit()
            # _Eval checks for _AGENT_MARK (not _AGENT_V2_MARK) → v2 executor body 未匹配 → 低分
            # 但 v2 executor 确实被调用了（证明：cost_usd=0.03 被记录进 run.cost_total）
            assert run.cost_total == round(0.03 * 6, 6)  # 6 case × 0.03（v2 executor 被路由选中）
    finally:
        await _cleanup(name)


async def test_run_cost_total_accumulates_executor_cost():
    """SI #4：executor 返回 cost_usd → SuiteRunner 累积进 run.cost_total（真实 $-cost）。"""

    class _CostExec:
        async def execute(self, *, target_kind, target_ref, target_version, case_input):
            return CaseOutput(body=_AGENT_MARK, digest="a" * 12, cost_usd=0.05)

    name, suite = await _seed_suite(execution_mode="agent_loop")
    try:
        runner = SuiteRunner(executors={"skill": _DefaultSkillExec()}, agent_executor=_CostExec(), evaluator=_Eval())
        async with db_session.AsyncSessionLocal() as db:
            run = await runner.run_suite(
                db,
                suite=suite,
                target_kind="skill",
                target_ref=name,
                target_version="1.0.0",
                partition="visible",
            )
            await db.commit()
            assert run.cost_total == round(0.05 * 6, 6)  # 6 case × 0.05
    finally:
        await _cleanup(name)
