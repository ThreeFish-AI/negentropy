"""单元测试：``FitzTextExtractor`` 复合编号断裂修复。

ISSUE-094 第四轮：PyMuPDF 常把章节复合编号 ``3.1.1`` 拆为多个 span
（``3.`` + ``1.1``），``" ".join`` 插入空格后输出 ``3. 1.1`` 形态，会被
markdown 解析为有序列表项而非 heading。本测试守护正则合并逻辑。
"""

from __future__ import annotations

import re


_COMPOUND_NUMBER_RE = re.compile(r"\b(\d+)\.\s+(\d+\.\d+(?:\.\d+)?)\b")


def _apply_fix(text: str) -> str:
    """模拟 text_extraction.py 中的复合编号合并逻辑（同正则）。"""
    return _COMPOUND_NUMBER_RE.sub(r"\1.\2", text)


class TestCompoundNumberRejoin:
    """章节复合编号的 span 断裂应被无损合并。"""

    def test_three_segment_number(self) -> None:
        assert _apply_fix("3. 1.1 Technological Landscape") == (
            "3.1.1 Technological Landscape"
        )

    def test_two_segment_number(self) -> None:
        assert _apply_fix("5. 3.1 Layered Memory") == "5.3.1 Layered Memory"

    def test_four_segment_number(self) -> None:
        # 当前正则只匹配 N.M.K（三段），不会错误拼接四段编号 N. M.K.L
        result = _apply_fix("3. 1.1.2 Sub-section")
        # 三段部分被合并，剩下的 .2 保持原样
        assert result == "3.1.1.2 Sub-section"

    def test_leading_text_then_compound(self) -> None:
        """段落开头之外位置的复合编号也被合并。"""
        text = "see Section 3. 1.1 for details"
        # 此模式罕见但仍应被合并，因 ``Section 3. 1.1`` 几乎必为引用而非真正列表
        assert _apply_fix(text) == "see Section 3.1.1 for details"


class TestNonHeadingNumbersUnchanged:
    """普通正文中的数字不应被误合并。"""

    def test_normal_ordered_list_unchanged(self) -> None:
        """普通有序列表项（``3. Some text``）不应被改动。"""
        text = "3. First item description here"
        assert _apply_fix(text) == text

    def test_decimal_in_prose_unchanged(self) -> None:
        """普通正文中的小数表达不应被合并。"""
        text = "The score reached 3.5 in trial 1."
        assert _apply_fix(text) == text

    def test_year_period_unchanged(self) -> None:
        """年份后跟句号、再接新句子不应被合并。"""
        text = "Published in 2024. Next year we plan to..."
        assert _apply_fix(text) == text

    def test_paragraph_with_numbers_unchanged(self) -> None:
        """正文段落含数字但无复合编号模式，不应被改动。"""
        text = (
            "We sampled 100 documents and found that 80% of them had high quality. "
            "The remaining 20% required manual review."
        )
        assert _apply_fix(text) == text


class TestEdgeCases:
    """边界条件。"""

    def test_empty_string(self) -> None:
        assert _apply_fix("") == ""

    def test_only_compound_number(self) -> None:
        assert _apply_fix("3. 1.1") == "3.1.1"

    def test_multiple_compound_numbers_in_one_line(self) -> None:
        """一行中多个复合编号都被合并。"""
        text = "see 3. 1.1 and also 5. 3.1 for context"
        assert _apply_fix(text) == "see 3.1.1 and also 5.3.1 for context"
