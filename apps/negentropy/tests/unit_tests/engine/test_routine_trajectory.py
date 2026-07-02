"""trajectory 纯函数模块单元测试。

覆盖 score_trajectory / format_anchor_context / build_anchor_audit，
含 ISSUE-128 真实轨迹 72→84→62→72→42→72 的统计回归。
"""

from __future__ import annotations

from dataclasses import dataclass

from negentropy.engine.routine import trajectory as t


@dataclass
class FakeIter:
    seq: int
    score: int | None
    verdict: str | None = None
    phase: str | None = None
    reflection: str | None = None


# ---------------------------------------------------------------------------
# score_trajectory
# ---------------------------------------------------------------------------


def test_score_trajectory_empty_and_unscored():
    stats = t.score_trajectory([])
    assert stats.n_scored == 0
    assert stats.best is None
    assert stats.direction == t.DIRECTION_INSUFFICIENT

    stats2 = t.score_trajectory([FakeIter(seq=1, score=None), FakeIter(seq=2, score=None)])
    assert stats2.n_scored == 0
    assert stats2.direction == t.DIRECTION_INSUFFICIENT


def test_score_trajectory_monotonic_improving():
    history = [
        FakeIter(seq=1, score=40, verdict="progressing"),
        FakeIter(seq=2, score=60, verdict="progressing"),
        FakeIter(seq=3, score=75, verdict="progressing"),
        FakeIter(seq=4, score=90, verdict="pass"),
    ]
    stats = t.score_trajectory(history, window=5)
    assert stats.n_scored == 4
    assert stats.best == 90
    assert stats.last == 90
    assert stats.prev == 75
    assert stats.delta == 15
    assert stats.net_gain == 50
    assert stats.amplitude == 50
    assert stats.flips == 0
    assert stats.slope is not None and stats.slope > 1.0
    assert stats.direction == t.DIRECTION_IMPROVING


def test_score_trajectory_issue128_live_trajectory():
    """ISSUE-128 真实轨迹：72→84→62→72→42→72（±20 振荡，容差带救回的任务）。"""
    history = [
        FakeIter(seq=1, score=72, verdict="progressing"),
        FakeIter(seq=2, score=84, verdict="progressing"),
        FakeIter(seq=3, score=62, verdict="stalled"),
        FakeIter(seq=4, score=72, verdict="progressing"),
        FakeIter(seq=5, score=42, verdict="regressed"),
        FakeIter(seq=6, score=72, verdict="progressing"),
    ]
    stats = t.score_trajectory(history, window=6)
    assert stats.best == 84
    assert stats.last == 72
    assert stats.prev == 42
    assert stats.delta == 30
    assert stats.net_gain == 0
    assert stats.amplitude == 42
    assert stats.flips == 4
    assert stats.direction == t.DIRECTION_OSCILLATING


def test_score_trajectory_window_slicing():
    """window 仅影响窗口统计；best 仍取全量。"""
    history = [FakeIter(seq=i, score=10 * i, verdict="progressing") for i in range(1, 11)]
    stats = t.score_trajectory(history, window=3)
    # 全量 best = 100（第 10 轮），不受窗口限制
    assert stats.best == 100
    # 窗口仅尾 3：[80, 90, 100]
    assert stats.amplitude == 20
    assert stats.net_gain == 20
    assert stats.last == 100
    assert stats.prev == 90


# ---------------------------------------------------------------------------
# format_anchor_context
# ---------------------------------------------------------------------------


def test_format_anchor_context_empty_returns_blank():
    assert t.format_anchor_context([]) == ""
    assert t.format_anchor_context([FakeIter(seq=1, score=None)]) == ""


def test_format_anchor_context_contains_lines_best_prev_reflection():
    long_reflection = "上一轮建议" + "细节" * 300  # 远超 200 字截断
    history = [
        FakeIter(seq=1, score=72, verdict="progressing", phase="implement", reflection="早期建议"),
        FakeIter(seq=2, score=84, verdict="progressing", phase="implement", reflection="上一轮建议"),
        FakeIter(seq=3, score=62, verdict="stalled", phase="implement", reflection=long_reflection),
    ]
    out = t.format_anchor_context(history, window=5)
    assert "评分轨迹" in out
    assert "84" in out
    assert "本次尝试历史最优：84" in out
    assert "上一轮：84" in out  # prev_score = 倒数第二个有分迭代（seq2）
    # 上轮 reflection 截断至 200 字（含前缀片段）
    assert "上一轮给执行者的改进建议" in out
    assert "细节" in out
    # 截断生效：输出中 reflection 部分不超过 200 字原文 + 包裹
    assert out.count("细节") <= 200


def test_build_anchor_audit_shape():
    history = [
        FakeIter(seq=1, score=72, verdict="progressing", phase="plan", reflection="r1"),
        FakeIter(seq=2, score=84, verdict="progressing", phase="implement", reflection="r2"),
    ]
    audit = t.build_anchor_audit(history, window=5)
    assert audit["window"] == 5
    assert audit["n_scored"] == 2
    assert audit["trajectory"] == [[1, 72, "progressing"], [2, 84, "progressing"]]
    assert audit["best"] == 84
    assert audit["prev_score"] == 72
    assert audit["prev_verdict"] == "progressing"
    assert audit["stats"]["direction"] == t.DIRECTION_IMPROVING
    assert audit["stats"]["amplitude"] == 12
    assert audit["prev_reflection_excerpt"] == "r2"
