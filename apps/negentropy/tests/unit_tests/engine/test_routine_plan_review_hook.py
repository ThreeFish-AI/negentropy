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


def test_extract_plan_text_from_exit_plan_mode():
    """ExitPlanMode 的 tool_input={"plan": ...}（CC 原生方案提交方式）须被正确提取。"""
    ti = {"plan": "# 实现方案\n正交分解 + 改动清单 XYZ"}
    assert "正交分解 + 改动清单 XYZ" in h._extract_plan_text(ti)


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


async def test_run_unified_writes_sidecar(monkeypatch, tmp_path):
    """unified：评审结果（approve/refine/不可用）均以 JSONL 追加写入 sidecar，供 Runner 注入发言。"""
    import json

    sidecar = str(tmp_path / "iter.reviews.jsonl")
    # 1) approve
    _patch_review(
        monkeypatch,
        PlanReviewResult(ok=True, verdict="approve", score=88, feedback="ok", reflection="rf"),
    )
    reason = await h._run(
        {"tool_input": {"plan": "p"}},
        {"goal": "g", "acceptance_criteria": "a", "review_sidecar_path": sidecar},
    )
    assert "续接实施" in reason  # 统一闭环批准文案指示引擎同迭代续接实施
    # 2) refine（追加第二行）
    _patch_review(monkeypatch, PlanReviewResult(ok=True, verdict="refine", score=40, feedback="补测试"))
    await h._run(
        {"tool_input": {"plan": "p2"}},
        {"goal": "g", "acceptance_criteria": "a", "review_sidecar_path": sidecar},
    )
    lines = [json.loads(x) for x in open(sidecar, encoding="utf-8").read().splitlines() if x.strip()]
    assert len(lines) == 2
    assert lines[0]["verdict"] == "approve" and lines[0]["score"] == 88
    assert lines[1]["verdict"] == "refine" and lines[1]["score"] == 40


# --- 单 Iteration 内 Plan Review 轮次封顶（plan_review_max_refines）---


def test_count_prior_reviews(tmp_path):
    """已评轮次 = sidecar 非空行数；None/缺失文件计 0。"""
    assert h._count_prior_reviews(None) == 0
    p = str(tmp_path / "r.jsonl")
    assert h._count_prior_reviews(p) == 0  # 文件不存在
    with open(p, "w", encoding="utf-8") as f:
        f.write('{"a":1}\n\n{"b":2}\n')  # 2 非空行 + 1 空行
    assert h._count_prior_reviews(p) == 2


async def test_run_refine_budget_exhausted_force_approves(monkeypatch, tmp_path):
    """达本迭代评审轮次上限 → 强制放行：不调用 PlanReviewer，写 capped 发言，返回放行 reason。"""
    import json

    called = {"n": 0}

    async def _fake_review(self, **kw):
        called["n"] += 1
        return PlanReviewResult(ok=True, verdict="refine", score=10)

    from negentropy.engine.routine.plan_reviewer import PlanReviewer

    monkeypatch.setattr(PlanReviewer, "review", _fake_review)

    sidecar = str(tmp_path / "r.jsonl")
    with open(sidecar, "w", encoding="utf-8") as f:  # 预置 3 条已评轮次（达 max_refines=3）
        for _ in range(3):
            f.write(json.dumps({"verdict": "refine", "score": 30}) + "\n")

    reason = await h._run(
        {"tool_input": {"plan": "p4"}},
        {"goal": "g", "acceptance_criteria": "a", "review_sidecar_path": sidecar, "max_refines": 3},
    )
    assert called["n"] == 0, "达上限后不应再调用 PlanReviewer"
    assert "轮次上限" in reason and "3" in reason and "续接实施" in reason
    lines = [json.loads(x) for x in open(sidecar, encoding="utf-8").read().splitlines() if x.strip()]
    assert len(lines) == 4 and lines[-1].get("capped") is True and lines[-1]["verdict"] == "approve"


async def test_run_under_budget_still_reviews(monkeypatch, tmp_path):
    """未达上限：正常评审（PlanReviewer 被调用）。"""
    import json

    _patch_review(monkeypatch, PlanReviewResult(ok=True, verdict="refine", score=50, feedback="改"))
    sidecar = str(tmp_path / "r.jsonl")
    with open(sidecar, "w", encoding="utf-8") as f:
        f.write(json.dumps({"verdict": "refine", "score": 20}) + "\n")  # 1 < 3
    reason = await h._run(
        {"tool_input": {"plan": "p"}},
        {"goal": "g", "acceptance_criteria": "a", "review_sidecar_path": sidecar, "max_refines": 3},
    )
    assert "需完善" in reason  # 走正常 refine 评审分支
    lines = [json.loads(x) for x in open(sidecar, encoding="utf-8").read().splitlines() if x.strip()]
    assert len(lines) == 2 and lines[-1]["verdict"] == "refine"  # 追加一条真实评审，非 capped
    assert lines[-1].get("capped") is None


def test_main_exit_plan_unified_runs_review(monkeypatch, tmp_path):
    """unified（ctx.mode=unified）下，ExitPlanMode 走真实评审 _run（而非 legacy 直接批准）。"""
    import json

    ctx = {"goal": "g", "acceptance_criteria": "a", "mode": "unified", "review_sidecar_path": str(tmp_path / "r.jsonl")}
    ctx_path = tmp_path / "ctx.json"
    ctx_path.write_text(json.dumps(ctx), encoding="utf-8")

    ran = {"n": 0}

    async def _fake_run(payload, c):
        ran["n"] += 1
        assert c.get("mode") == "unified"
        return "REVIEWED"

    monkeypatch.setattr(h, "_run", _fake_run)
    captured = {}
    monkeypatch.setattr(h, "_emit", lambda r: captured.__setitem__("reason", r))
    monkeypatch.setattr(
        "sys.stdin", __import__("io").StringIO(json.dumps({"tool_name": "ExitPlanMode", "tool_input": {"plan": "x"}}))
    )
    monkeypatch.setattr("sys.argv", ["plan_review_hook.py", str(ctx_path)])
    h.main()
    assert ran["n"] == 1, "unified 下 ExitPlanMode 须走真实评审"
    assert captured.get("reason") == "REVIEWED"


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
        config={"plan_review_model": "anthropic/claude-sonnet-4-6", "plan_review_max_refines": 8},
    )
    iid = uuid.uuid4()
    path = orch_mod._write_plan_review_ctx(routine, iid, mode="unified")
    ctx = json.load(open(path, encoding="utf-8"))
    assert ctx["model"] == "anthropic/claude-sonnet-4-6", "per-routine plan_review_model 须覆盖全局默认"
    assert ctx["goal"] == "g" and ctx["reflections"] == ["r1"]
    # 新增字段：mode / iteration_id / review_sidecar_path（按 iteration_id 键）
    assert ctx["mode"] == "unified"
    assert ctx["iteration_id"] == str(iid)
    assert ctx["review_sidecar_path"] == orch_mod._review_sidecar_path(iid)
    assert path.endswith(f"{iid}.json")  # ctx 文件按 iteration_id 键
    assert ctx["max_refines"] == 8, "per-routine plan_review_max_refines 须覆盖全局默认"


def test_write_plan_review_ctx_falls_back_to_global(tmp_path, monkeypatch):
    """未设 config.plan_review_model 时回退全局 settings.routine.plan_review_model。"""
    import json
    import uuid
    from types import SimpleNamespace

    from negentropy.config import settings
    from negentropy.engine.routine import orchestrator as orch_mod

    monkeypatch.setattr(orch_mod.tempfile, "gettempdir", lambda: str(tmp_path))
    routine = SimpleNamespace(id=uuid.uuid4(), goal="g", acceptance_criteria="a", reflections={}, config={})
    path = orch_mod._write_plan_review_ctx(routine, uuid.uuid4())
    ctx = json.load(open(path, encoding="utf-8"))
    assert ctx["model"] == settings.routine.plan_review_model  # 全局默认（None → 走 task_registry）
    assert ctx["mode"] == "unified"  # 默认 mode
    assert ctx["max_refines"] == settings.routine.plan_review_max_refines  # 回退全局默认（5）
