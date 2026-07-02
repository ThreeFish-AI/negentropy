"""evaluator 锚定（纵向评估）单元测试。

覆盖：无历史时 prompt 逐字节回退原版（向后兼容锁）/ 注入锚点 / window 覆盖 /
progress_evidence 容错 / 全无分回退 / faculty-litellm 两路同串 / acceptance cap 正交。
"""

from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace

from negentropy.engine.routine.evaluator import RoutineEvaluator

_REQUIRE_ANCHOR_MARK = "评分轨迹"
_REQUIRE_PROGRESS_EVIDENCE = "progress_evidence"


@dataclass
class _EvalRoutine:
    goal: str = "g"
    acceptance_criteria: str = "ac"
    cwd: str | None = None
    worktree_path: str | None = None
    verification_command: str | None = None
    gate_timeout_seconds: int | None = None
    acceptance_unmet_score_cap: int | None = None
    evaluator_model: str | None = None
    judge_anchor_window: int | None = None


@dataclass
class _EvalIter:
    exec_status: str | None = "success"
    summary: str = "本轮产出摘要"
    exec_error: str | None = None


def _issue128_history() -> list[SimpleNamespace]:
    return [
        SimpleNamespace(seq=1, score=72, verdict="progressing", phase="implement", reflection="建议 A"),
        SimpleNamespace(seq=2, score=84, verdict="progressing", phase="implement", reflection="建议 B"),
        SimpleNamespace(seq=3, score=62, verdict="stalled", phase="implement", reflection="建议 C"),
    ]


def _stub_judge(monkeypatch, *, capture: list[str] | None = None):
    """桩 _judge：返回含 progress_evidence 的 6 元组，可选捕获 prompt 供两路一致性断言。"""

    async def _stub(self, prompt, *, model_override=None):
        if capture is not None:
            capture.append(prompt)
        return 78, "progressing", "r", "{}", True, "上轮未达标项本轮已落实"

    monkeypatch.setattr(RoutineEvaluator, "_judge", _stub)


async def test_evaluate_without_history_prompt_unchanged(monkeypatch):
    """history=None → judge_prompt 不含锚点段、不含 progress_evidence（向后兼容锁）。"""
    _stub_judge(monkeypatch)
    ev = RoutineEvaluator()
    res = await ev.evaluate(_EvalRoutine(), _EvalIter())
    assert res.ok
    assert _REQUIRE_ANCHOR_MARK not in (res.judge_prompt or "")
    assert _REQUIRE_PROGRESS_EVIDENCE not in (res.judge_prompt or "")
    assert res.progress_evidence == "上轮未达标项本轮已落实"  # 桩仍回带，但 prompt 未要求
    assert res.anchor is None


async def test_evaluate_with_history_injects_anchor(monkeypatch):
    """注入 ISSUE-128 轨迹 → judge_prompt 含锚点段、progress_evidence 要求、轨迹分数 84。"""
    _stub_judge(monkeypatch)
    ev = RoutineEvaluator()
    res = await ev.evaluate(_EvalRoutine(), _EvalIter(), history=_issue128_history())
    assert res.ok
    assert _REQUIRE_ANCHOR_MARK in res.judge_prompt
    assert _REQUIRE_PROGRESS_EVIDENCE in res.judge_prompt
    assert "84" in res.judge_prompt  # 历史最优
    assert res.anchor is not None
    assert res.anchor["best"] == 84
    assert res.progress_evidence == "上轮未达标项本轮已落实"


async def test_evaluate_anchor_window_per_routine_override(monkeypatch):
    """window=2 时 prompt 仅含尾 2 轮轨迹行（第 2、3 轮），含第 1 轮则失败。"""
    _stub_judge(monkeypatch)
    ev = RoutineEvaluator()
    res = await ev.evaluate(_EvalRoutine(judge_anchor_window=2), _EvalIter(), history=_issue128_history())
    assert "第 2 轮" in res.judge_prompt
    assert "第 3 轮" in res.judge_prompt
    assert "第 1 轮" not in res.judge_prompt


async def test_parse_progress_evidence_present_and_missing():
    """_parse：progress_evidence 有则透传；缺失/非法类型 → None（容错锁）。"""
    _, _, _, _, pe = RoutineEvaluator._parse('{"score":70,"verdict":"progressing","progress_evidence":"进展 X"}')
    assert pe == "进展 X"
    _, _, _, _, pe_none = RoutineEvaluator._parse('{"score":70,"verdict":"progressing"}')
    assert pe_none is None
    _, _, _, _, pe_blank = RoutineEvaluator._parse('{"score":70,"verdict":"progressing","progress_evidence":""}')
    assert pe_blank is None
    _, _, _, _, pe_badtype = RoutineEvaluator._parse('{"score":70,"verdict":"progressing","progress_evidence":123}')
    assert pe_badtype is None


async def test_evaluate_history_all_unscored_falls_back_legacy(monkeypatch):
    """history 有条目但全无分 → format_anchor_context 返回空 → 回退原模板。"""
    _stub_judge(monkeypatch)
    ev = RoutineEvaluator()
    history = [SimpleNamespace(seq=1, score=None, verdict=None, phase="implement", reflection=None)]
    res = await ev.evaluate(_EvalRoutine(), _EvalIter(), history=history)
    assert res.ok
    assert _REQUIRE_ANCHOR_MARK not in res.judge_prompt
    assert res.anchor is None


async def test_anchor_prompt_identical_for_faculty_and_litellm_paths(monkeypatch):
    """faculty_bridge 与 litellm 两路接收同一 prompt 字符串（锚点注入点唯一性锁）。"""
    captured: list[str] = []
    _stub_judge(monkeypatch, capture=captured)

    # 路径 A：开 faculty_bridge，桩 run_faculty 返回空 → 降级 litellm；_judge 内两条分支共用入参 prompt
    monkeypatch.setenv("NE_ROUTINE_FACULTY_BRIDGE_ENABLED", "true")
    ev = RoutineEvaluator()
    res = await ev.evaluate(_EvalRoutine(), _EvalIter(), history=_issue128_history())
    assert res.ok
    # 桩捕获到的 prompt 与返回的 judge_prompt 必须是同一字符串
    assert captured and captured[-1] == res.judge_prompt


async def test_acceptance_cap_still_applies_with_anchor(monkeypatch):
    """锚定开启下 acceptance cap 机制仍生效（机制正交锁）。"""

    async def _stub(self, prompt, *, model_override=None):
        assert _REQUIRE_ANCHOR_MARK in prompt  # 确实走了锚定路径
        return 85, "pass", "r", "{}", False, "进展"  # acceptance_met=False

    monkeypatch.setattr(RoutineEvaluator, "_judge", _stub)
    ev = RoutineEvaluator(acceptance_unmet_score_cap=50)
    res = await ev.evaluate(_EvalRoutine(), _EvalIter(), history=_issue128_history())
    assert res.ok and res.score == 50  # 被封顶
    assert res.verdict == "progressing"  # pass 被纠正
