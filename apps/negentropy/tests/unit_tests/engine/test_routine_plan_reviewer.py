"""PlanReviewer 单测 —— 锁定方案截断行为（Routine Plan Review 卡环根因修复）。

历史 bug：``_PLAN_MAX_CHARS = 8000`` 静默截断多 Phase 方案，judge 看不到尾部 → 反复误判
「Phase 缺失/不完整」→ refine 闭环结构性无法收敛。修复后：默认上限抬至 200000、可配置，且真截断
时附显式标记告知 judge 勿据未见尾部扣分。

测试经 monkeypatch ``PlanReviewer._judge`` 截获 judge prompt，不触网、不依赖 LLM。
"""

from __future__ import annotations

from negentropy.engine.routine import plan_reviewer as pr
from negentropy.engine.routine.plan_reviewer import PlanReviewer


def _capture_judge(monkeypatch) -> dict:
    """patch ``_judge`` 截获其收到的完整 judge prompt（内含拼装后的方案文本）。"""
    captured: dict = {}

    async def _fake_judge(self, prompt):
        captured["prompt"] = prompt
        # 返回合法 6 元组：(score, verdict, module_reviews, feedback, reflection, judge_raw)
        return 90, "approve", [], "ok", "rf", "{}"

    monkeypatch.setattr(PlanReviewer, "_judge", _fake_judge)
    return captured


def test_default_max_plan_chars_is_large():
    """默认上限须远大于历史 8000，避免正常方案被截断而复发卡环。"""
    assert pr._DEFAULT_PLAN_MAX_CHARS >= 100_000


async def test_review_long_plan_passed_untruncated(monkeypatch):
    """12000 字符方案（> 旧 8000、< 默认上限）完整入 prompt，尾部不丢、不附截断标记。"""
    captured = _capture_judge(monkeypatch)
    plan = "HEAD-" + ("x" * 11_990) + "-TAIL_MARKER"  # >8000 且尾部带可识别标记
    result = await PlanReviewer(max_retries=1).review(goal="g", acceptance_criteria="a", plan_text=plan)
    assert result.ok and result.verdict == "approve"
    assert "TAIL_MARKER" in captured["prompt"], "完整方案尾部须送达 judge（不再被 8000 截断）"
    assert "方案过长已被系统截断" not in captured["prompt"], "未超限不应出现截断标记"


async def test_review_over_cap_appends_truncation_marker(monkeypatch):
    """超 max_plan_chars 时：方案体被截到上限处，且附显式截断标记（judge 勿据未见尾部判缺失）。"""
    captured = _capture_judge(monkeypatch)
    plan = ("x" * 5000) + "TAIL_MARKER"  # 5010 字符，超过下方 5000 上限
    await PlanReviewer(max_retries=1).review(goal="g", acceptance_criteria="a", plan_text=plan, max_plan_chars=5000)
    assert "方案过长已被系统截断" in captured["prompt"], "真截断须附标记"
    assert "切勿因未见尾部" in captured["prompt"], "标记须明确禁止据未见尾部判缺失"
    assert "TAIL_MARKER" not in captured["prompt"], "超限尾部应被截掉"


async def test_review_empty_plan_placeholder_preserved(monkeypatch):
    """空方案仍得占位文案（回归保护），且不附截断标记。"""
    captured = _capture_judge(monkeypatch)
    await PlanReviewer(max_retries=1).review(goal="g", acceptance_criteria="a", plan_text="   ")
    assert "(Claude Code 未产出实现方案)" in captured["prompt"]
    assert "方案过长已被系统截断" not in captured["prompt"]
