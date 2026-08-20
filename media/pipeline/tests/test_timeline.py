"""timeline.compute 与 timing.ts:computeTimeline 的同构性（黄金帧号）。"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from timeline import (  # noqa: E402
    compute,
    js_round,
    load_constants,
    total_duration_in_frames,
)

C = {
    "fps": 30,
    "sentenceGapSec": 0.32,
    "sceneGapSec": 0.9,
    "leadInSec": 0.6,
    "tailSec": 2.0,
}


def test_golden_frames():
    items = [
        {"id": "p0-01", "scene": "P0", "text": "a", "durationSec": 4.10},
        {"id": "p0-02", "scene": "P0", "text": "b", "durationSec": 1.05},
        {
            "id": "p1-01",
            "scene": "P1",
            "text": "c",
            "durationSec": 0.02,
        },  # 极短句触发 max(1,..)
        {"id": "p1-02", "scene": "P1", "text": "d", "durationSec": 3.77},
    ]
    rows = compute(items, C)
    # 黄金值 = 手推 timing.ts 公式：leadIn 0.6*30=18 起；
    # p0-01 dur = round((4.10+0.32)*30)=133；p0-02 = round((1.05+0.32+0.9)*30)=68（幕界 gap 只加一次）
    # p1-01 = max(1, round((0.02+0.32)*30))=11（截断为 10.2 → 10）；p1-02 = round((3.77+0.32)*30)=123
    assert [r["fromFrame"] for r in rows] == [18, 151, 219, 229]
    assert [r["durationInFrames"] for r in rows] == [133, 68, 10, 123]


def test_total_includes_tail():
    items = [{"id": "p0-01", "scene": "P0", "text": "a", "durationSec": 4.10}]
    assert total_duration_in_frames(items, C) == 18 + 133 + round(2.0 * 30)


def test_js_round_matches_math_round_semantics():
    """js_round = JS Math.round（.5 恒向上），非 banker's rounding——
    (0.03+0.32)*30 = 10.5 类精确 .5 落点上，内置 round() 会给 10 而 JS 给 11，
    从该句起抽帧帧号整体漂移。"""
    assert js_round(10.5) == 11  # 内置 round(10.5) == 10
    assert js_round(0.5) == 1  # 内置 round(0.5) == 0
    assert js_round(2.5) == 3  # 内置 round(2.5) == 2
    assert js_round(100.49999999999999) == 100  # 非精确 .5 时与内置一致
    # 真实形态：(0.03+0.32)*30 恰为 10.5 —— durationSec 三位小数可命中的边界类
    assert js_round((0.03 + 0.32) * 30) == 11
    assert (
        compute([{"id": "p0-01", "scene": "P0", "text": "x", "durationSec": 0.03}], C)[
            0
        ]["durationInFrames"]
        == 11
    )


def test_load_constants_missing_exits(tmp_path):
    import pytest

    with pytest.raises(SystemExit, match="timing.json 不存在"):
        load_constants(tmp_path)


def test_load_constants_missing_fields(tmp_path):
    import json

    import pytest

    p = tmp_path / "video/src/timing.json"
    p.parent.mkdir(parents=True)
    p.write_text(json.dumps({"fps": 30}), encoding="utf-8")
    with pytest.raises(SystemExit, match="缺少字段"):
        load_constants(tmp_path)
