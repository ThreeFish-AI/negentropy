"""Routine 决策守卫 + prompt 构建 + handler 注册 单元测试。

覆盖：
- decision.pre_dispatch_check：max_iterations / max_cost / deadline 预算守卫
- decision.decide：成功 / 不可恢复 / 停滞 / 振荡 / 继续 全分支
- prompt_builder.build_prompt / append_reflection：Reflexion 注入与追加语义
- routine_inspector handler + descriptor 注册
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import pytest

from negentropy.engine.routine import decision as d
from negentropy.engine.routine.prompt_builder import append_reflection, build_prompt

# ---------------------------------------------------------------------------
# 轻量只读视图（避免依赖 ORM / DB）
# ---------------------------------------------------------------------------


@dataclass
class FakeRoutine:
    status: str = "running"
    max_iterations: int | None = None
    max_cost_usd: float | None = None
    deadline_at: datetime | None = None
    success_score_threshold: int = 85
    no_progress_patience: int = 3
    iteration_count: int = 0
    total_cost_usd: float = 0.0
    best_score: int | None = None
    goal: str = "实现功能 X"
    acceptance_criteria: str = "通过全部验收项"
    reflections: dict = field(default_factory=dict)
    claude_session_id: str | None = None


@dataclass
class FakeIter:
    seq: int = 1
    exec_status: str | None = "success"
    score: int | None = None
    verdict: str | None = None
    gate_exit_code: int | None = None


# ---------------------------------------------------------------------------
# pre_dispatch_check
# ---------------------------------------------------------------------------


def test_pre_dispatch_allows_when_under_budget():
    assert d.pre_dispatch_check(FakeRoutine(max_iterations=5, iteration_count=2)).action == "continue"


def test_pre_dispatch_max_iterations():
    res = d.pre_dispatch_check(FakeRoutine(max_iterations=3, iteration_count=3))
    assert res.is_terminate and res.reason == d.REASON_MAX_ITERATIONS


def test_pre_dispatch_max_cost():
    res = d.pre_dispatch_check(FakeRoutine(max_cost_usd=5.0, total_cost_usd=5.5))
    assert res.is_terminate and res.reason == d.REASON_MAX_COST


def test_pre_dispatch_deadline():
    res = d.pre_dispatch_check(FakeRoutine(deadline_at=datetime.now(UTC) - timedelta(hours=1)))
    assert res.is_terminate and res.reason == d.REASON_DEADLINE


def test_pre_dispatch_naive_deadline_treated_as_utc():
    # naive datetime 不应抛错（被视为 UTC）
    res = d.pre_dispatch_check(FakeRoutine(deadline_at=datetime(2000, 1, 1)))
    assert res.is_terminate and res.reason == d.REASON_DEADLINE


# ---------------------------------------------------------------------------
# decide
# ---------------------------------------------------------------------------


def test_decide_success_when_score_meets_threshold_and_gate_ok():
    r = FakeRoutine(best_score=92)
    it = FakeIter(score=92, verdict="pass", gate_exit_code=0)
    res = d.decide(r, it, [it])
    assert res.is_terminate and res.reason == d.REASON_SUCCESS


def test_decide_success_blocked_by_failing_gate():
    r = FakeRoutine(best_score=92)
    it = FakeIter(score=92, verdict="pass", gate_exit_code=1)
    assert d.decide(r, it, [it]).action == "continue"


def test_decide_unrecoverable_verdict():
    r = FakeRoutine(best_score=40)
    it = FakeIter(score=40, verdict="unrecoverable")
    res = d.decide(r, it, [it])
    assert res.is_terminate and res.reason == d.REASON_UNRECOVERABLE


def test_decide_unrecoverable_on_consecutive_exec_failures():
    r = FakeRoutine(best_score=50)
    hist = [FakeIter(seq=i, exec_status="error", score=None) for i in range(1, 4)]
    res = d.decide(r, hist[-1], hist)
    assert res.is_terminate and res.reason == d.REASON_UNRECOVERABLE


def test_decide_no_progress_plateau():
    r = FakeRoutine(best_score=70, no_progress_patience=3)
    hist = [
        FakeIter(seq=1, score=70, verdict="stalled"),
        FakeIter(seq=2, score=65, verdict="stalled"),
        FakeIter(seq=3, score=68, verdict="stalled"),
        FakeIter(seq=4, score=70, verdict="stalled"),
    ]
    res = d.decide(r, hist[-1], hist)
    assert res.is_terminate and res.reason == d.REASON_NO_PROGRESS


def test_decide_oscillation():
    r = FakeRoutine(best_score=60, no_progress_patience=10)  # patience 大以排除 no_progress 抢先
    hist = [
        FakeIter(seq=1, score=50, verdict="progressing"),
        FakeIter(seq=2, score=40, verdict="regressed"),
        FakeIter(seq=3, score=52, verdict="progressing"),
        FakeIter(seq=4, score=45, verdict="regressed"),
    ]
    res = d.decide(r, hist[-1], hist)
    assert res.is_terminate and res.reason == d.REASON_OSCILLATION


def test_decide_continue_when_progressing_with_headroom():
    r = FakeRoutine(best_score=60, no_progress_patience=3)
    hist = [
        FakeIter(seq=1, score=40, verdict="progressing"),
        FakeIter(seq=2, score=60, verdict="progressing"),
    ]
    assert d.decide(r, hist[-1], hist).action == "continue"


def test_decide_budget_checked_after_eval():
    # 评估后即时熔断：成本已超即使分数未达标也终止
    r = FakeRoutine(best_score=50, max_cost_usd=5.0, total_cost_usd=6.0)
    it = FakeIter(score=50, verdict="progressing")
    res = d.decide(r, it, [it])
    assert res.is_terminate and res.reason == d.REASON_MAX_COST


# ---------------------------------------------------------------------------
# prompt_builder
# ---------------------------------------------------------------------------


def test_build_prompt_first_run_has_goal_and_criteria():
    r = FakeRoutine()
    prompt = build_prompt(r)
    assert "实现功能 X" in prompt
    assert "通过全部验收项" in prompt
    assert "开始" in prompt  # 首次执行段
    assert "既往迭代的反馈" not in prompt  # 无反思


def test_build_prompt_resume_injects_reflections():
    r = FakeRoutine(
        claude_session_id="sess-1",
        reflections={"items": ["补充单元测试", "修复边界条件"]},
    )
    prompt = build_prompt(r)
    assert "既往迭代的反馈" in prompt
    assert "补充单元测试" in prompt
    assert "修复边界条件" in prompt
    assert "继续" in prompt  # resume 段


def test_build_prompt_caps_reflections_window():
    r = FakeRoutine(
        claude_session_id="s",
        reflections={"items": [f"r{i}" for i in range(10)]},
    )
    prompt = build_prompt(r, max_reflections=3)
    # 仅最近 3 条
    assert "r9" in prompt and "r8" in prompt and "r7" in prompt
    assert "r0" not in prompt and "r6" not in prompt


def test_append_reflection_returns_new_dict():
    before = {"items": ["a"]}
    after = append_reflection(before, "b")
    assert after == {"items": ["a", "b"]}
    assert before == {"items": ["a"]}  # 原 dict 不被原地修改


def test_append_reflection_ignores_empty():
    assert append_reflection({"items": ["a"]}, "   ") == {"items": ["a"]}


def test_append_reflection_handles_none():
    assert append_reflection(None, "first") == {"items": ["first"]}


# ---------------------------------------------------------------------------
# handler 注册
# ---------------------------------------------------------------------------


def test_routine_inspector_handler_registered():
    from negentropy.engine.schedulers.handlers import (
        _bootstrap_default_handlers,
        get_descriptor,
        get_handler,
    )

    _bootstrap_default_handlers()
    assert get_handler("routine_inspector") is not None
    desc = get_descriptor("routine_inspector")
    assert desc is not None
    assert desc.supported_trigger_types == ("interval",)


@pytest.mark.asyncio
async def test_routine_inspector_noop_when_disabled(monkeypatch):
    """enabled=False 时 handler 直接 no-op，不触发编排。"""
    from negentropy.config import settings
    from negentropy.config.routine import RoutineSettings
    from negentropy.engine.schedulers.handlers.routine_inspector import routine_inspector_handler

    # settings.routine 是 cached_property；构造一个 disabled 实例覆盖缓存值。
    # RoutineSettings frozen，但 enabled 默认即 False，直接用默认实例。
    disabled = RoutineSettings()
    assert disabled.enabled is False
    monkeypatch.setattr(type(settings), "routine", property(lambda self: disabled))

    class _Task:
        payload: dict = {}

    result = await routine_inspector_handler(_Task())
    assert result.status == "ok"
    assert "disabled" in (result.output_summary or "")
