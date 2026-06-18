"""JSON 围栏鲁棒解析单测（ISSUE-127）。

锁定：剥离 ```json 围栏；裸 JSON 原样；散文夹带兜底截取；彻底失败返回 default。
"""

from __future__ import annotations

from negentropy.engine.utils.json_extract import loads_lenient, strip_code_fence


def test_strip_fence_json_labeled():
    assert strip_code_fence('```json\n{"a": 1}\n```') == '{"a": 1}'


def test_strip_fence_unlabeled():
    assert strip_code_fence('```\n{"a": 1}\n```') == '{"a": 1}'


def test_strip_fence_bare_passthrough():
    assert strip_code_fence('{"a": 1}') == '{"a": 1}'


def test_loads_lenient_fenced():
    # claude-sonnet-4-6 实测形态
    assert loads_lenient('```json\n{"score": 90, "verdict": "approve"}\n```') == {"score": 90, "verdict": "approve"}


def test_loads_lenient_bare():
    assert loads_lenient('{"ok": true}') == {"ok": True}


def test_loads_lenient_prose_wrapped():
    # 模型前后夹带散文 → 兜底截取首个 {...}
    assert loads_lenient('这是结果：\n{"n": 5}\n以上。') == {"n": 5}


def test_loads_lenient_array():
    assert loads_lenient("```json\n[1, 2, 3]\n```", default=[]) == [1, 2, 3]


def test_loads_lenient_garbage_returns_default():
    assert loads_lenient("not json at all", default={}) == {}
    assert loads_lenient(None) == {}
    assert loads_lenient("", default={"x": 1}) == {"x": 1}
