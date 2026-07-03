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


# =============================================================================
# 回归测试：评审缺陷修复（fix #2 / #4）——agent_loop executor 直接驱动，无 LLM/Jinja
# =============================================================================


async def test_v3_tool_budget_break_no_orphan(monkeypatch):
    """回归 fix #4：撞 max_tool_calls 时退出外层 turn 循环，避免残缺 tool_calls 历史 → 下一轮 400。

    构造 LLM 单轮返回 2 个 execute_code tool_calls、max_tool_calls=1：固定代码撞预算后 break 外层，
    acompletion 只调用 1 次；buggy 代码继续 turn 循环、带残缺 tool_calls 再次 acompletion（≥2 次）。
    """
    from types import SimpleNamespace

    import litellm

    from negentropy.engine.eval.runner import AgentLoopExecutorV3

    calls = {"n": 0}

    def _tc(tid: str) -> SimpleNamespace:
        return SimpleNamespace(id=tid, function=SimpleNamespace(name="execute_code", arguments='{"code":"x"}'))

    async def fake_completion(**kwargs):
        calls["n"] += 1
        msg = SimpleNamespace(content="", tool_calls=[_tc("t1"), _tc("t2")])
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])

    async def fake_resolve(*_a, **_kw):
        return "fake-model", {}

    async def fake_sandbox(self, code):  # noqa: ARG002
        return "stdout: ok"

    monkeypatch.setattr(litellm, "acompletion", fake_completion)
    monkeypatch.setattr("negentropy.engine.utils.model_config.resolve_model_config_async", fake_resolve)
    monkeypatch.setattr(AgentLoopExecutorV3, "_run_sandbox", fake_sandbox)

    executor = AgentLoopExecutorV3(max_turns=3, max_tool_calls=1)
    out = await executor.execute(
        target_kind="skill",
        target_ref="no_such_skill",  # SkillVersion 查询返 None → template=""，不影响断言
        target_version="9.9.9",
        case_input={"task": "do something"},
    )

    assert calls["n"] == 1, f"expected exactly 1 acompletion (no orphan follow-up), got {calls['n']}"
    assert out.body  # 有产出（非空占位）


async def test_v4_save_to_memory_is_ephemeral():
    """回归 fix #2：V4 save_to_memory 写 EvalToolContext.state（ephemeral），不落生产 Memory 表。

    buggy 代码调真实 save_to_memory（写 DB Memory 表），ctx.state 为空且返回非 ephemeral。
    """
    import json

    from negentropy.engine.eval.eval_tool_context import EvalToolContext
    from negentropy.engine.eval.runner import AgentLoopExecutorV4

    executor = AgentLoopExecutorV4()
    ctx = EvalToolContext()
    result = await executor._dispatch_tool(
        "save_to_memory",
        json.dumps({"content": "secret-payload", "tags": ["redteam"]}),
        ctx,
    )

    parsed = json.loads(result)
    assert parsed["status"] == "saved_ephemeral"  # 未走真实 save_to_memory
    assert len(ctx.state) == 1  # 写入 ephemeral state dict（非生产 Memory 表）
    entry = next(iter(ctx.state.values()))
    assert entry["content"] == "secret-payload"
    assert entry["tags"] == ["redteam"]
