"""单元测试：``assembly`` 2.5.5 段 — 公式残片清理。

ISSUE-094 R8：PyMuPDF 在公式视觉区抽 text block 时，对长公式（含
``\\bigcup`` / 矩阵等多行结构）常仅抽出公式起手残片（``C = [``、
``M_l =``、``x = \\{``），与公式 stage 的 LaTeX 主体重复出现。
``_formula_text_signature`` 最小长度 20 字符无法命中这些短残片，导致
markdown 中 "残片 + 公式" 并存破坏阅读流（典型如 Context Engineering 2.0
Definition 3 后 ``C = [`` 残片单独成段，之后跟 ``$$M_s = f_{short}(...)$$``）。

仅测试 ``_FORMULA_FRAGMENT_RE`` 正则的判定边界。完整 2.5.5 元素流剔除
逻辑由 ``assembly.execute`` 集成测试覆盖。
"""

from __future__ import annotations

import re


class TestFormulaFragmentPattern:
    """``_FORMULA_FRAGMENT_RE`` —— 公式残片正则边界。"""

    pattern = re.compile(r"^\s*[A-Za-z]\w*\s*=\s*[\[\(\{]\s*$")

    def test_c_open_bracket(self) -> None:
        """``C = [`` 是典型公式残片（Context Engineering 2.0 Eq 形式）。"""
        assert self.pattern.match("C = [")

    def test_m_l_open_brace(self) -> None:
        """``M_l = \\{`` 形式（含下标）— 应命中。"""
        # 注：下标用 _ 表示，``M_l`` 是合法的 Python identifier
        assert self.pattern.match("M_l = {")

    def test_x_open_paren(self) -> None:
        """``x = (`` 短公式残片。"""
        assert self.pattern.match("x = (")

    def test_multichar_identifier(self) -> None:
        """``Var = [`` / ``CE = {`` 多字符 identifier 也接受。"""
        assert self.pattern.match("Var = [")
        assert self.pattern.match("CE = {")

    def test_with_padding(self) -> None:
        """前后含空白也接受。"""
        assert self.pattern.match("  C = [  ")

    def test_full_equation_rejected(self) -> None:
        """完整公式（含右侧表达式）NOT 残片。"""
        assert not self.pattern.match("C = [1, 2, 3]")
        assert not self.pattern.match("x = y + 1")

    def test_no_open_bracket_rejected(self) -> None:
        """``=`` 后无 open bracket NOT 残片。"""
        assert not self.pattern.match("C =")
        assert not self.pattern.match("x = 5")

    def test_no_equals_rejected(self) -> None:
        """无 ``=`` NOT 残片。"""
        assert not self.pattern.match("C [")
        assert not self.pattern.match("Definition 3")

    def test_natural_language_rejected(self) -> None:
        """自然语言段落 NOT 残片。"""
        assert not self.pattern.match(
            "Definition 3 (Context). For a given user-application interaction,"
        )

    def test_starts_with_digit_rejected(self) -> None:
        """以数字起手 NOT 残片（identifier 必须字母起手）。"""
        assert not self.pattern.match("1 = [")

    def test_multiline_rejected(self) -> None:
        """多行内容 NOT 残片。"""
        assert not self.pattern.match("C = [\nmore content")
