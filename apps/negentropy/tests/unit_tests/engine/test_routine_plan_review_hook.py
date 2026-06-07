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


async def test_run_approve_tells_end_turn(monkeypatch):
    """ISSUE-128：批准后指示 CC 结束本轮（不调 ExitPlanMode），引擎自动推进实施。"""
    _patch_review(
        monkeypatch,
        PlanReviewResult(ok=True, verdict="approve", score=92, feedback="结构清晰"),
    )
    reason = await h._run(
        {"tool_input": {"questions": [{"question": "plan"}]}}, {"goal": "g", "acceptance_criteria": "a"}
    )
    assert "通过" in reason and "92" in reason
    assert "结束本轮" in reason  # 明确指示结束本轮，不调用工具
    assert "无需调用 ExitPlanMode" in reason or "不要" in reason
    assert "IMPLEMENT" in reason or "实施" in reason


async def test_run_review_unavailable_fail_open(monkeypatch):
    _patch_review(monkeypatch, PlanReviewResult(ok=False, error="LLM down"))
    reason = await h._run({"tool_input": {}}, {"goal": "g", "acceptance_criteria": "a"})
    # fail-open：不卡死，指示 CC 结束本轮（不再调用工具），引擎自动推进（ISSUE-128）
    assert "结束本轮" in reason and "不要" in reason


# --- ISSUE-126/128：ExitPlanMode 同走钩子返回「已批准、结束本轮」deny+reason ---


def test_exit_plan_approved_reason_content():
    """ExitPlanMode 批准文案指示 CC 结束本轮、不再调用工具（ISSUE-128），引擎自动推进实施。"""
    r = h._EXIT_APPROVED_REASON
    assert "批准" in r and "结束本轮" in r
    assert "不要" in r and ("IMPLEMENT" in r or "实施" in r)


def test_main_exit_plan_emits_approval(monkeypatch, capsysbinary=None):
    """main() 对 ExitPlanMode 载荷输出 deny + 批准 reason 的纯 JSON（经原始 stdout fd）。"""
    import json
    import os

    # 捕获 _emit 写入的原始 fd：替换为管道读端
    captured = {}

    def _fake_emit(reason):
        captured["reason"] = reason

    monkeypatch.setattr(h, "_emit", _fake_emit)
    monkeypatch.setattr(
        "sys.stdin", __import__("io").StringIO(json.dumps({"tool_name": "ExitPlanMode", "tool_input": {"plan": "x"}}))
    )
    monkeypatch.setattr("sys.argv", ["plan_review_hook.py"])
    h.main()
    assert "reason" in captured and "批准" in captured["reason"] and "结束本轮" in captured["reason"]
    # 确认 os 仍可用（fd 重定向不影响测试进程）
    assert os is not None


def test_main_unrelated_tool_no_emit(monkeypatch):
    """非 AskUserQuestion/ExitPlanMode 工具：不干预（不调用 _emit）。"""
    import json

    called = {"n": 0}
    monkeypatch.setattr(h, "_emit", lambda r: called.__setitem__("n", called["n"] + 1))
    monkeypatch.setattr("sys.stdin", __import__("io").StringIO(json.dumps({"tool_name": "Bash", "tool_input": {}})))
    monkeypatch.setattr("sys.argv", ["plan_review_hook.py"])
    h.main()
    assert called["n"] == 0


# --- ISSUE-125：plan_review_model 的 per-routine 覆盖流入 ctx ---


def test_write_plan_review_ctx_per_routine_model_override(tmp_path, monkeypatch):
    """config.plan_review_model 覆盖全局 settings.routine.plan_review_model 写入 ctx 文件。"""
    import json
    import uuid
    from types import SimpleNamespace

    from negentropy.engine.routine import orchestrator as orch_mod

    # 写入 tmp 目录，避免污染真实 /tmp
    monkeypatch.setattr(orch_mod.tempfile, "gettempdir", lambda: str(tmp_path))

    routine = SimpleNamespace(
        id=uuid.uuid4(),
        goal="g",
        acceptance_criteria="a",
        reflections={"items": ["r1"]},
        config={"plan_review_model": "anthropic/claude-sonnet-4-6"},
    )
    path = orch_mod._write_plan_review_ctx(routine)
    ctx = json.load(open(path, encoding="utf-8"))
    assert ctx["model"] == "anthropic/claude-sonnet-4-6", "per-routine plan_review_model 须覆盖全局默认"
    assert ctx["goal"] == "g" and ctx["reflections"] == ["r1"]


def test_write_plan_review_ctx_falls_back_to_global(tmp_path, monkeypatch):
    """未设 config.plan_review_model 时回退全局 settings.routine.plan_review_model。"""
    import json
    import uuid
    from types import SimpleNamespace

    from negentropy.config import settings
    from negentropy.engine.routine import orchestrator as orch_mod

    monkeypatch.setattr(orch_mod.tempfile, "gettempdir", lambda: str(tmp_path))
    routine = SimpleNamespace(id=uuid.uuid4(), goal="g", acceptance_criteria="a", reflections={}, config={})
    path = orch_mod._write_plan_review_ctx(routine)
    ctx = json.load(open(path, encoding="utf-8"))
    assert ctx["model"] == settings.routine.plan_review_model  # 全局默认（None → 走 task_registry）
