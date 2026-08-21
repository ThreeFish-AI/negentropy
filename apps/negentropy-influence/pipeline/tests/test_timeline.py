"""timeline.compute 与 timing.ts:computeTimeline 的同构性（黄金帧号）。"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from timeline import (  # noqa: E402
    blend,
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


# ---------------- blend：部分 manifest 混合时间轴 ----------------


def test_blend_measured_prefix_matches_full_manifest():
    """黄金判据：已实测前缀的 fromFrame 与全量 manifest 逐帧相等。

    这是分幕复检（skills/08「长跑期间做，不要等成片」）能提前给出可靠结论的
    前提：compute() 是顺序游标，前缀帧位只取决于前面的时长，后段外推值不回
    污染前缀。若此性质破，混排时间轴上的前缀结论全部作废。
    """
    items = [
        {"id": "p0-01", "scene": "P0", "text": "一二三四五", "durationSec": 0},
        {"id": "p0-02", "scene": "P0", "text": "一二三", "durationSec": 0},
        {"id": "p1-01", "scene": "P1", "text": "一二三四五六七八", "durationSec": 0},
        {"id": "p1-02", "scene": "P1", "text": "一二", "durationSec": 0},
        {"id": "p2-01", "scene": "P2", "text": "一二三四", "durationSec": 0},
    ]
    full = {  # 全量实测（合成完的世界线），dur 值刻意与字数外推错开
        "p0-01": 2.31,
        "p0-02": 1.07,
        "p1-01": 3.89,
        "p1-02": 0.55,
        "p2-01": 1.66,
    }
    reference = compute(blend(items, full, chars_per_sec=5.0), C)
    assert [r["fromFrame"] for r in reference]  # 自身非退化

    partial = {sid: full[sid] for sid in ("p0-01", "p0-02")}  # 只合成完前 2 句
    rolled = compute(blend(items, partial, chars_per_sec=5.0), C)
    assert [r["fromFrame"] for r in rolled[:2]] == [
        r["fromFrame"] for r in reference[:2]
    ]
    # 未实测句的时长确实来自外推（len(text)/cps），不是 measured 也不是 0
    assert rolled[2]["durationSec"] == len(items[2]["text"]) / 5.0


def test_blend_is_pure_and_covers_all_ids():
    items = [
        {"id": "p0-01", "scene": "P0", "text": "四字文本"},
        {"id": "p1-01", "scene": "P1", "text": "六字文本测试"},
    ]
    snapshot = [dict(i) for i in items]
    out = blend(items, {"p1-01": 4.2}, chars_per_sec=4.0)
    assert items == snapshot, "blend 不得改写入参"
    assert [i["id"] for i in out] == ["p0-01", "p1-01"], "输出须覆盖全部句 id"
    assert out[0]["durationSec"] == 4.0 / 4.0  # 未实测：字数外推
    assert out[1]["durationSec"] == 4.2  # 已实测：原值透传
    assert out[0] is not items[0], "blend 返回新对象（浅拷贝逐项展开）"
