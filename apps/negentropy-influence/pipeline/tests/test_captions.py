"""captions 的时间戳与格式（srt/vtt 字节级黄金）。"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from captions import build_cues, fmt_ts_srt, fmt_ts_vtt, render_srt, render_vtt  # noqa: E402

C = {
    "fps": 30,
    "sentenceGapSec": 0.32,
    "sceneGapSec": 0.9,
    "leadInSec": 0.6,
    "tailSec": 2.0,
}


def test_timestamp_format():
    assert fmt_ts_srt(3661.5) == "01:01:01,500"
    assert fmt_ts_vtt(3661.5) == "01:01:01.500"


def test_cue_end_excludes_gap():
    """外挂字幕 cue 终点 = 起点 + durationSec（不含句间停顿）——与烧录字幕的有意分歧。"""
    items = [
        {"id": "p0-01", "scene": "P0", "text": "甲。", "durationSec": 3.0},
        {"id": "p0-02", "scene": "P0", "text": "乙。", "durationSec": 2.0},
    ]
    cues = build_cues(items, C)
    assert cues[0][0] == 0.6 and abs(cues[0][1] - 3.6) < 1e-9  # 0.6 + 3.0，非 0.6+3.32
    assert abs(cues[1][0] - 0.6 - round((3.0 + 0.32) * 30) / 30) < 1e-9


def test_srt_golden():
    items = [{"id": "p0-01", "scene": "P0", "text": "你好。", "durationSec": 3.0}]
    srt = render_srt(build_cues(items, C))
    assert srt == "1\n00:00:00,600 --> 00:00:03,600\n你好。\n"


def test_vtt_header():
    items = [{"id": "p0-01", "scene": "P0", "text": "你好。", "durationSec": 3.0}]
    vtt = render_vtt(build_cues(items, C))
    assert vtt.startswith("WEBVTT\n\n")
    assert "00:00:00.600 --> 00:00:03.600" in vtt
