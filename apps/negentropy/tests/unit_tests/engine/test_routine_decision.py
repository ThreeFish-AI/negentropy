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
    metrics: dict | None = None


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


def test_decide_success_blocked_by_gate_timeout_sentinel():
    """门控超时(124)不等于通过：即便评分达标也不应判成功（ISSUE-115，超时≠门控通过）。"""
    r = FakeRoutine(best_score=92)
    it = FakeIter(score=92, verdict="pass", gate_exit_code=124)
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


def test_decide_no_progress_ignores_in_window_climb():
    """回归（code review #1）：窗口内创出新高（超过「窗口之前」最优）应继续推进，
    不应因 best_score 含窗口自身导致 _is_no_progress 恒真而误判停滞终止。

    success_score_threshold=95 高于全部评分，确保不走「成功」分支、隔离 no_progress 判定。"""
    r = FakeRoutine(best_score=90, no_progress_patience=3, success_score_threshold=95)
    hist = [
        FakeIter(seq=1, score=40, verdict="progressing"),  # 窗口之前最优 = 40
        FakeIter(seq=2, score=60, verdict="progressing"),
        FakeIter(seq=3, score=75, verdict="progressing"),
        FakeIter(seq=4, score=90, verdict="progressing"),
    ]
    assert d.decide(r, hist[-1], hist).action == "continue"


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
# 上下文耗尽自愈：可自愈失败不计入连续失败（max_context_resets > 0 时）
# ---------------------------------------------------------------------------


def _ctx_fail(seq: int) -> FakeIter:
    """上下文耗尽失败迭代：exec error + metrics.context_exhausted 标记（已被 Runner 自愈）。"""
    return FakeIter(seq=seq, exec_status="error", score=40, verdict="progressing", metrics={"context_exhausted": True})


def test_decide_context_exhausted_failures_not_unrecoverable_when_self_heal_on():
    """根因回归：连续 N 次上下文耗尽失败 + 自愈开启（reset_max>0）→ 不判 unrecoverable（放行冷启动）。

    复刻 a83d9c94 死亡螺旋：seq2~5 全 exec error，原行为连续≥3 即 unrecoverable；
    自愈开启后这些"可自愈失败"透明跳过连续计数，应继续而非终止。"""
    r = FakeRoutine(best_score=50, no_progress_patience=10, success_score_threshold=99)
    hist = [_ctx_fail(i) for i in range(2, 6)]  # 4 次连续上下文耗尽失败
    assert d.decide(r, hist[-1], hist, max_context_resets=10).action == "continue"


def test_decide_context_exhausted_falls_back_unrecoverable_when_self_heal_off():
    """向后兼容：reset_max=0（默认）时不豁免，照原行为——连续≥3 仍判 unrecoverable。"""
    r = FakeRoutine(best_score=50)
    hist = [_ctx_fail(i) for i in range(2, 5)]  # 3 次
    res = d.decide(r, hist[-1], hist, max_context_resets=0)
    assert res.is_terminate and res.reason == d.REASON_UNRECOVERABLE


def test_decide_plain_errors_still_unrecoverable_with_self_heal_on():
    """回归锁：普通 exec error（无 context_exhausted 标记）即使自愈开启也照常计数 → unrecoverable。"""
    r = FakeRoutine(best_score=50)
    hist = [FakeIter(seq=i, exec_status="error", score=None) for i in range(1, 4)]  # 3 次普通 error
    res = d.decide(r, hist[-1], hist, max_context_resets=10)
    assert res.is_terminate and res.reason == d.REASON_UNRECOVERABLE


def test_decide_context_exhausted_does_not_break_count_chain():
    """语义验证：可自愈失败"透明跳过"（不计数也不中断扫描）——

    尾部 [普通error, ctx_fail, 普通error, 普通error]：ctx 跳过后普通 error 计 3 → unrecoverable。
    确认 continue 语义不会因夹一个可自愈失败而错误隔断真失败链。"""
    r = FakeRoutine(best_score=50)
    hist = [
        FakeIter(seq=1, exec_status="error"),
        _ctx_fail(2),
        FakeIter(seq=3, exec_status="error"),
        FakeIter(seq=4, exec_status="error"),
    ]
    res = d.decide(r, hist[-1], hist, max_context_resets=10)
    assert res.is_terminate and res.reason == d.REASON_UNRECOVERABLE


def _session_reset_fail(seq: int) -> FakeIter:
    """会话失效自愈迭代：exec error + metrics.session_reset 标记（Runner 已冷启动清空会话）。"""
    return FakeIter(seq=seq, exec_status="error", score=40, verdict="progressing", metrics={"session_reset": True})


def test_decide_session_reset_failures_not_unrecoverable():
    """根因回归（会话续接死亡螺旋）：连续 session_reset 失败始终豁免连续失败计数（无 reset_max 门控）。

    复刻模板 9e90c3c7 seq3-5：陈旧会话使每轮 resume 立即失败；Runner 已冷启动清空会话，
    这些"可自愈失败"应透明跳过，不被误判 unrecoverable。与 context_exhausted 不同：会话失效
    无 reset_max 上限语义（runaway 由 no_progress/max_iterations 兜底），故 reset_max=0 亦豁免。"""
    r = FakeRoutine(best_score=50, no_progress_patience=10, success_score_threshold=99)
    hist = [_session_reset_fail(i) for i in range(2, 6)]  # 4 次连续会话失效失败
    assert d.decide(r, hist[-1], hist, max_context_resets=0).action == "continue"
    assert d.decide(r, hist[-1], hist, max_context_resets=10).action == "continue"


def test_decide_success_tail_resets_failure_count():
    """成功迭代在尾部 → 连续失败计数归零（break），不受自愈逻辑影响。"""
    r = FakeRoutine(best_score=50, no_progress_patience=10, success_score_threshold=99)
    hist = [
        _ctx_fail(1),
        _ctx_fail(2),
        FakeIter(seq=3, exec_status="success", score=55, verdict="progressing"),
    ]
    assert d.decide(r, hist[-1], hist, max_context_resets=10).action == "continue"


# ---------------------------------------------------------------------------
# 运行时阈值调整：模拟 Running 状态下 API 修改 success_score_threshold 后决策变化
# ---------------------------------------------------------------------------


def test_runtime_threshold_lowering_triggers_success():
    """运行中降低阈值：score=80 < 原阈值 85 → continue；改为 75 → terminate(SUCCESS)。"""
    it = FakeIter(score=80, verdict="pass", gate_exit_code=0)

    # 原阈值 85：score 未达标 → 继续
    r = FakeRoutine(success_score_threshold=85, best_score=80)
    assert d.decide(r, it, [it]).action == "continue"

    # 模拟运行中 API 将阈值降至 75：score 达标 → 成功终止
    r2 = FakeRoutine(success_score_threshold=75, best_score=80)
    res = d.decide(r2, it, [it])
    assert res.is_terminate and res.reason == d.REASON_SUCCESS


def test_runtime_threshold_raising_prevents_premature_success():
    """运行中提高阈值：score=90 >= 原阈值 85 → 成功；改为 95 → 继续。"""
    it = FakeIter(score=90, verdict="pass", gate_exit_code=0)

    # 原阈值 85：达标 → 成功
    r = FakeRoutine(success_score_threshold=85, best_score=90)
    assert d.decide(r, it, [it]).reason == d.REASON_SUCCESS

    # 阈值提高到 95：未达标 → 继续
    r2 = FakeRoutine(success_score_threshold=95, best_score=90)
    assert d.decide(r2, it, [it]).action == "continue"


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
    # 注意：自 #770 起 routine.enabled 默认放开为 True，故此处显式构造 enabled=False 实例
    # 以验证「禁用即 no-op」路径（不可再依赖默认值为 False）。
    disabled = RoutineSettings(enabled=False)
    assert disabled.enabled is False
    monkeypatch.setattr(type(settings), "routine", property(lambda self: disabled))

    class _Task:
        payload: dict = {}

    result = await routine_inspector_handler(_Task())
    assert result.status == "ok"
    assert "disabled" in (result.output_summary or "")
