"""Routine「全过程」动作事件持久化集成测试 — 真实 Postgres。

覆盖范围：
- Runner 写回：执行动作事件按 seq 0..N-1 落库（仅 rowcount==1 翻转时）；
- ON CONFLICT 幂等：重复写回不产生重复行；
- capture_events 关闭：不落事件但仍翻转状态；
- Orchestrator 评估：→evaluated 时追加 gate + evaluation 事件于 seq=MAX+1；
- 评估失败重试期间（status 停留 executed）不追加 gate/eval 事件；
- 无 verification_command 时仅追加 evaluation 事件。

ClaudeCodeService.invoke / RoutineEvaluator.evaluate 被 mock，避免真实 LLM / CLI 调用。
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import delete, select

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.engine.claude_code.models import ClaudeCodeResult
from negentropy.engine.routine.evaluator import EvaluationResult
from negentropy.engine.routine.orchestrator import RoutineOrchestrator
from negentropy.engine.routine.runner import RoutineRunner
from negentropy.models.routine import Routine, RoutineIteration, RoutineIterationEvent

pytestmark = pytest.mark.asyncio


def _routine_settings(*, capture_events: bool):
    """构造一个 capture_events 覆写的 RoutineSettings 副本（frozen 模型，需 model_copy）。"""
    return settings.routine.model_copy(update={"capture_events": capture_events})


def _key() -> str:
    return f"itest_evt_{uuid.uuid4().hex[:8]}"


async def _make_routine(**overrides) -> uuid.UUID:
    defaults = dict(
        key=_key(),
        title="Event Persist Test",
        goal="实现功能",
        acceptance_criteria="通过验收",
        status="running",
        max_iterations=5,
        success_score_threshold=85,
        no_progress_patience=3,
        approval_mode="auto",
        iteration_count=0,
        reflections={},
        config={},
    )
    defaults.update(overrides)
    async with db_session.AsyncSessionLocal() as db:
        r = Routine(**defaults)
        db.add(r)
        await db.commit()
        return r.id


async def _add_iteration(routine_id: uuid.UUID, **overrides) -> uuid.UUID:
    defaults = dict(routine_id=routine_id, seq=1, status="in_flight", phase="implement")
    defaults.update(overrides)
    async with db_session.AsyncSessionLocal() as db:
        it = RoutineIteration(**defaults)
        db.add(it)
        await db.commit()
        return it.id


async def _cleanup(routine_id: uuid.UUID) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(Routine).where(Routine.id == routine_id))
        await db.commit()


async def _evaluate_latest(orch: RoutineOrchestrator, routine_id: uuid.UUID) -> None:
    """驱动**生产评估路径**（``_claim_for_eval`` → ``_do_evaluate``）评估最新 executed 迭代。

    替代已下线的 ``_evaluate_one``：``inspect_once`` 心跳实际走「认领 executed→evaluating +
    后台 _do_evaluate 两段式写回」，测试须覆盖该真实路径而非其历史同步副本（单一事实源）。
    """
    iteration_id = await orch._claim_for_eval(routine_id)
    assert iteration_id is not None, "未能认领待评估迭代（routine 非 running 或最新迭代非 executed）"
    await orch._do_evaluate(routine_id, iteration_id)


async def _events(iteration_id: uuid.UUID) -> list[RoutineIterationEvent]:
    async with db_session.AsyncSessionLocal() as db:
        return list(
            (
                await db.execute(
                    select(RoutineIterationEvent)
                    .where(RoutineIterationEvent.iteration_id == iteration_id)
                    .order_by(RoutineIterationEvent.seq.asc())
                )
            )
            .scalars()
            .all()
        )


def _sample_events() -> list[dict]:
    return [
        {
            "seq": 0,
            "event_type": "system",
            "tool_name": None,
            "title": "init",
            "payload": {"model": "m"},
            "cost_usd": None,
        },
        {
            "seq": 1,
            "event_type": "tool_use",
            "tool_name": "Read",
            "title": "Read a.py",
            "payload": {"tool_id": "t1", "input": {"file_path": "a.py"}},
            "cost_usd": None,
        },
        {
            "seq": 2,
            "event_type": "tool_result",
            "tool_name": None,
            "title": None,
            "payload": {"tool_use_id": "t1", "output": "ok", "is_error": False},
            "cost_usd": None,
        },
        {
            "seq": 3,
            "event_type": "result",
            "tool_name": None,
            "title": "success",
            "payload": {"result": "done"},
            "cost_usd": 0.02,
        },
    ]


async def test_writeback_persists_execution_events_and_is_idempotent():
    rid = await _make_routine()
    iid = await _add_iteration(rid, status="in_flight")
    try:
        runner = RoutineRunner()
        result = ClaudeCodeResult(
            status="success", summary="done", session_id="s1", cost_usd=0.02, turn_count=3, events=_sample_events()
        )
        # capture_events 默认 True；无需 patch。
        await runner._do_write_back(iid, rid, result)
        evs = await _events(iid)
        assert [e.seq for e in evs] == [0, 1, 2, 3]
        assert [e.event_type for e in evs] == ["system", "tool_use", "tool_result", "result"]
        tu = next(e for e in evs if e.event_type == "tool_use")
        assert tu.tool_name == "Read"
        assert tu.payload["tool_id"] == "t1"

        # 二次写回：迭代已是 executed（rowcount=0），不应复制事件行
        await runner._do_write_back(iid, rid, result)
        evs2 = await _events(iid)
        assert len(evs2) == 4  # ON CONFLICT DO NOTHING + rowcount 门控双重保证
    finally:
        await _cleanup(rid)


async def test_capture_events_disabled_skips_events_but_flips_status():
    rid = await _make_routine()
    iid = await _add_iteration(rid, status="in_flight")
    try:
        runner = RoutineRunner()
        result = ClaudeCodeResult(
            status="success", summary="done", cost_usd=0.01, turn_count=1, events=_sample_events()
        )
        # 先取真实 settings.routine 的 disabled 副本，再 patch 属性（避免 property 内再读 settings.routine 递归）。
        disabled = _routine_settings(capture_events=False)
        with patch.object(type(settings), "routine", property(lambda _self: disabled)):
            await runner._do_write_back(iid, rid, result)
        assert await _events(iid) == []
        async with db_session.AsyncSessionLocal() as db:
            it = await db.get(RoutineIteration, iid)
            assert it.status == "executed"  # 状态仍翻转
    finally:
        await _cleanup(rid)


async def test_evaluate_appends_gate_and_evaluation_events_after_execution():
    rid = await _make_routine(iteration_count=1, verification_command="pytest -q")
    iid = await _add_iteration(rid, status="executed", exec_status="success", summary="done")
    try:
        # 预置 4 条执行事件（seq 0..3），模拟写回已落库
        async with db_session.AsyncSessionLocal() as db:
            for e in _sample_events():
                db.add(RoutineIterationEvent(iteration_id=iid, routine_id=rid, **e))
            await db.commit()

        orch = RoutineOrchestrator()
        eval_result = EvaluationResult(
            ok=True,
            score=90,
            verdict="pass",
            reflection="好",
            gate_exit_code=0,
            judge_prompt="JUDGE PROMPT",
            judge_raw='{"score":90}',
            gate_output="gate stdout",
        )
        # capture_events 默认 True；仅 mock evaluate 避免真实 LLM。
        with patch.object(orch._evaluator, "evaluate", new=AsyncMock(return_value=eval_result)):
            await _evaluate_latest(orch, rid)

        evs = await _events(iid)
        # 执行事件 0..3 + gate(4) + evaluation(5)
        assert [e.seq for e in evs] == [0, 1, 2, 3, 4, 5]
        gate = next(e for e in evs if e.event_type == "gate")
        ev = next(e for e in evs if e.event_type == "evaluation")
        assert gate.seq == 4 and gate.payload["exit_code"] == 0 and gate.payload["output"] == "gate stdout"
        assert ev.seq == 5 and ev.payload["score"] == 90 and ev.payload["prompt"] == "JUDGE PROMPT"
    finally:
        await _cleanup(rid)


async def test_evaluation_failure_retry_does_not_append_events():
    """评估失败（ok=False，未到耐心阈值）→ 状态停留 executed，不得追加 gate/eval 事件。"""
    rid = await _make_routine(iteration_count=1, no_progress_patience=3, verification_command="pytest -q")
    iid = await _add_iteration(rid, status="executed", exec_status="success", summary="done")
    try:
        orch = RoutineOrchestrator()
        fail = EvaluationResult(ok=False, error="LLM down", gate_exit_code=1, gate_output="boom")
        with patch.object(orch._evaluator, "evaluate", new=AsyncMock(return_value=fail)):
            await _evaluate_latest(orch, rid)
        assert await _events(iid) == []  # 重试期间零事件
        async with db_session.AsyncSessionLocal() as db:
            it = await db.get(RoutineIteration, iid)
            assert it.status == "executed"  # 仍待重试
    finally:
        await _cleanup(rid)


async def test_evaluate_long_verification_command_title_does_not_overflow():
    """超长 verification_command 不得使 gate 事件 title 溢出 String(255) 而中断评估事务。"""
    long_cmd = "pytest " + "x" * 400  # 远超 255
    rid = await _make_routine(iteration_count=1, verification_command=long_cmd)
    iid = await _add_iteration(rid, status="executed", exec_status="success", summary="done")
    try:
        orch = RoutineOrchestrator()
        eval_result = EvaluationResult(
            ok=True, score=88, verdict="pass", reflection="ok", gate_exit_code=0, judge_prompt="P", judge_raw="R"
        )
        with patch.object(orch._evaluator, "evaluate", new=AsyncMock(return_value=eval_result)):
            await _evaluate_latest(orch, rid)
        evs = await _events(iid)
        gate = next(e for e in evs if e.event_type == "gate")
        assert len(gate.title) <= 255  # 未溢出
        # 评估事务成功提交：routine 终态推进
        async with db_session.AsyncSessionLocal() as db:
            r = await db.get(Routine, rid)
            assert r.status == "succeeded"
    finally:
        await _cleanup(rid)


async def test_evaluate_without_verification_command_only_evaluation_event():
    rid = await _make_routine(iteration_count=1, verification_command=None)
    iid = await _add_iteration(rid, status="executed", exec_status="success", summary="done")
    try:
        orch = RoutineOrchestrator()
        eval_result = EvaluationResult(
            ok=True, score=50, verdict="progressing", reflection="继续", judge_prompt="P", judge_raw="R"
        )
        with patch.object(orch._evaluator, "evaluate", new=AsyncMock(return_value=eval_result)):
            await _evaluate_latest(orch, rid)
        evs = await _events(iid)
        assert [e.event_type for e in evs] == ["evaluation"]
        assert evs[0].seq == 0  # 无执行事件时从 0 起
    finally:
        await _cleanup(rid)
