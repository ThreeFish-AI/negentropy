"""Plan Review PreToolUse 钩子单测（ISSUE-123 同轮闭环）。

锁定：钩子从 AskUserQuestion 载荷提取方案 → 调 PlanReviewer → 输出 deny+reason；
approve/refine/评审失败 三态文案正确；非 AskUserQuestion 工具不干预。
"""

from __future__ import annotations

from negentropy.engine.routine import plan_review_hook as h
from negentropy.engine.routine.plan_reviewer import PlanReviewResult


def test_extract_plan_text_from_questions():
    ti = {"questions": [{"question": "完整方案全文 ABC", "options": ["批准方案", "需要完善"]}]}
    assert "完整方案全文 ABC" in h._extract_plan_text(ti)


def test_extract_plan_text_fallback_to_input():
    assert "raw" in h._extract_plan_text({"raw": "x"})


def _patch_review(monkeypatch, result: PlanReviewResult):
    async def _fake_review(self, *, goal, acceptance_criteria, plan_text, reflections=None):
        return result

    # PlanReviewer 在 _run 内 import；patch 类方法即可覆盖
    from negentropy.engine.routine.plan_reviewer import PlanReviewer

    monkeypatch.setattr(PlanReviewer, "review", _fake_review)


async def test_run_refine_returns_feedback(monkeypatch):
    _patch_review(
        monkeypatch,
        PlanReviewResult(ok=True, verdict="refine", score=55, feedback="补充错误处理与测试"),
    )
    reason = await h._run(
        {"tool_input": {"questions": [{"question": "plan"}]}}, {"goal": "g", "acceptance_criteria": "a"}
    )
    assert "需完善" in reason and "55" in reason and "补充错误处理与测试" in reason
    assert "AskUserQuestion" in reason  # 要求据此再次提交


async def test_run_approve_tells_exit(monkeypatch):
    _patch_review(
        monkeypatch,
        PlanReviewResult(ok=True, verdict="approve", score=92, feedback="结构清晰"),
    )
    reason = await h._run(
        {"tool_input": {"questions": [{"question": "plan"}]}}, {"goal": "g", "acceptance_criteria": "a"}
    )
    assert "通过" in reason and "92" in reason and "ExitPlanMode" in reason


async def test_run_review_unavailable_fail_open(monkeypatch):
    _patch_review(monkeypatch, PlanReviewResult(ok=False, error="LLM down"))
    reason = await h._run({"tool_input": {}}, {"goal": "g", "acceptance_criteria": "a"})
    assert "ExitPlanMode" in reason  # fail-open：不卡死，引导退出继续
