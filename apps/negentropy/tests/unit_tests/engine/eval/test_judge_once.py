"""judge_once（evaluator 纯新增方法）单测——验证离线 SuiteRunner 复用路径，且不触碰 evaluate。

monkeypatch ``_judge`` 避免 LLM 调用；``_run_gate`` 路径在 verification_command 为空时不触发。
"""

from __future__ import annotations

import pytest

from negentropy.engine.routine.evaluator import RoutineEvaluator


@pytest.mark.asyncio
async def test_judge_once_returns_result_when_judge_succeeds(monkeypatch):
    ev = RoutineEvaluator()

    async def fake_judge(prompt, *, model_override=None):
        return (85, "pass", "good", "raw-json", True, None, None, None)

    monkeypatch.setattr(ev, "_judge", fake_judge)

    res = await ev.judge_once(goal="g", acceptance_criteria="c", summary="s")

    assert res.ok is True
    assert res.score == 85
    assert res.verdict == "pass"
    assert res.judge_raw == "raw-json"
    assert res.judge_prompt is not None and "g" in res.judge_prompt


@pytest.mark.asyncio
async def test_judge_once_caps_score_on_acceptance_unmet(monkeypatch):
    ev = RoutineEvaluator()

    async def fake_judge(prompt, *, model_override=None):
        return (90, "pass", "r", "raw", False, None, None, None)  # acceptance_met False

    monkeypatch.setattr(ev, "_judge", fake_judge)

    res = await ev.judge_once(goal="g", acceptance_criteria="c", summary="s", acceptance_unmet_score_cap=60)

    assert res.score == 60  # 被封顶
    assert res.verdict == "progressing"  # pass 被纠正为 progressing


@pytest.mark.asyncio
async def test_judge_once_no_cap_when_acceptance_unmet_disabled(monkeypatch):
    ev = RoutineEvaluator()

    async def fake_judge(prompt, *, model_override=None):
        return (90, "pass", "r", "raw", False, None, None, None)

    monkeypatch.setattr(ev, "_judge", fake_judge)

    res = await ev.judge_once(goal="g", acceptance_criteria="c", summary="s")  # cap 默认 None

    assert res.score == 90  # 不封顶


@pytest.mark.asyncio
async def test_judge_once_fails_soft_when_judge_raises(monkeypatch):
    ev = RoutineEvaluator()

    async def boom(prompt, *, model_override=None):
        raise RuntimeError("LLM down")

    monkeypatch.setattr(ev, "_judge", boom)

    res = await ev.judge_once(goal="g", acceptance_criteria="c", summary="s")

    assert res.ok is False
    assert res.judge_prompt is not None  # 失败路径也回带 prompt 供审计
    assert res.score is None


@pytest.mark.asyncio
async def test_judge_once_surfaces_cost_from_judge(monkeypatch):
    """SI #4：_judge 返回的 cost_usd/token_total 流入 EvaluationResult（judge 侧 $-cost）。"""
    ev = RoutineEvaluator()

    async def fake_judge(prompt, *, model_override=None):
        return (85, "pass", "good", "raw", True, None, 0.0123, 420)

    monkeypatch.setattr(ev, "_judge", fake_judge)

    res = await ev.judge_once(goal="g", acceptance_criteria="c", summary="s")

    assert res.ok is True
    assert res.cost_usd == 0.0123  # judge 侧真实 $-cost 透传
    assert res.token_total == 420
