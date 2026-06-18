"""翻译校验器单测 — 代码围栏确定性回写 + 结构完整性报告。

覆盖：
1. extract_fences 抽取 ```/~~~ 围栏（含未闭合）；
2. restore_fences：数量一致内容漂移 → 按序还原；数量不一致 → 不可修复；
3. structural_report：图片 / URL 缺失 → fatal；标题数偏差 → 仅 warning。
"""

from __future__ import annotations

from negentropy.knowledge.translation.validation import (
    extract_fences,
    restore_fences,
    structural_report,
)

SOURCE = """# Title

Some prose here.

```python
def add(a, b):
    return a + b
```

More prose with ![diagram](./assets/diagram.png) and a [link](https://example.com/doc).

~~~text
verbatim block
~~~
"""


def test_extract_fences_finds_both_styles():
    fences = extract_fences(SOURCE)
    assert len(fences) == 2
    assert fences[0].startswith("```python\n")
    assert fences[0].endswith("```\n")
    assert fences[1].startswith("~~~text\n")


def test_extract_fences_unclosed_extends_to_eof():
    text = "prose\n\n```\nunclosed code"
    fences = extract_fences(text)
    assert len(fences) == 1
    assert fences[0] == "```\nunclosed code"


def test_restore_fences_repairs_drifted_content():
    source_fences = extract_fences(SOURCE)
    translated = SOURCE.replace("return a + b", "返回 a + b").replace("verbatim block", "逐字块")
    repaired, repairable = restore_fences(translated, source_fences)
    assert repairable
    assert "return a + b" in repaired
    assert "verbatim block" in repaired
    assert "返回 a + b" not in repaired
    # 围栏外的文本不受影响
    assert repaired.count("```") == 2
    assert extract_fences(repaired) == source_fences


def test_restore_fences_noop_when_identical():
    source_fences = extract_fences(SOURCE)
    repaired, repairable = restore_fences(SOURCE, source_fences)
    assert repairable
    assert repaired == SOURCE


def test_restore_fences_count_mismatch_not_repairable():
    source_fences = extract_fences(SOURCE)
    # 译文丢失了一个围栏
    translated = SOURCE.replace("~~~text\nverbatim block\n~~~\n", "")
    repaired, repairable = restore_fences(translated, source_fences)
    assert not repairable
    assert repaired == translated


def test_restore_fences_no_fences():
    repaired, repairable = restore_fences("plain text", [])
    assert repairable
    assert repaired == "plain text"


def test_structural_report_ok_for_faithful_translation():
    translated = SOURCE.replace("Some prose here.", "这里是一些散文。").replace("More prose with", "更多散文，含")
    report = structural_report(SOURCE, translated)
    assert not report["fatal"]
    assert report["images_missing"] == 0
    assert report["urls_missing"] == []


def test_structural_report_missing_image_is_fatal():
    translated = SOURCE.replace("![diagram](./assets/diagram.png)", "（图省略）")
    report = structural_report(SOURCE, translated)
    assert report["fatal"]
    assert report["images_missing"] == 1


def test_structural_report_missing_url_is_fatal():
    translated = SOURCE.replace("[link](https://example.com/doc)", "链接")
    report = structural_report(SOURCE, translated)
    assert report["fatal"]
    assert "https://example.com/doc" in report["urls_missing"]


def test_structural_report_heading_drift_is_warning_only():
    translated = SOURCE.replace("# Title", "标题（非 heading）")
    report = structural_report(SOURCE, translated)
    assert not report["fatal"]
    assert any("heading count drift" in w for w in report["warnings"])
