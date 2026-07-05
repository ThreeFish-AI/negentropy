"""src/negentropy/perceives/markdown/formatter.py 散落 Unicode 数学字母块字形
（U+1D400–1D7FF）归一为 inline ``$...$`` 的单元测试。

背景见 ``formatter._normalize_unicode_math``：LaTeX 学术 PDF 经 docling/PyMuPDF
抽取后，inline 数学常被发射为「空格分隔的孤立数学斜体字形」（如 ``A 𝑡 = ⟨ 𝑀 𝜃 𝑡⟩``），
本 pass 把这类散落字形在 formatter 末段归一为 KaTeX 可渲染的 ``$...$``。
"""

from negentropy.perceives.markdown.formatter import MarkdownFormatter


class TestNormalizeUnicodeMath:
    """测试 _normalize_unicode_math 把散落数学字母字形包裹为 inline ``$...$``。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    # ------------------------------------------------------------------
    # 基础：散落字形 → inline $...$
    # ------------------------------------------------------------------

    def test_standalone_math_letter_wrapped(self) -> None:
        """孤立单字符数学字母 → $letter$，前后散文不动。"""
        md = "𝑡 denotes wall-clock time."
        out = self.formatter._normalize_unicode_math(md)
        assert out == "$t$ denotes wall-clock time."

    def test_scattered_formula_run_merged(self) -> None:
        """空格分隔的散落字形 run 合并为单个 $...$，剔除空白伪影。"""
        md = "A 𝑡 = ⟨ 𝑀 𝜃 𝑡, 𝐻 𝑡, 𝑈 𝑡, 𝐸 𝑡 ⟩."
        out = self.formatter._normalize_unicode_math(md)
        assert out == "$At=\\langle M\\theta t,Ht,Ut,Et\\rangle$."

    def test_inline_math_with_arrow_op(self) -> None:
        """数学运算符（→）纳入 run。"""
        md = "𝜃 𝑡 → 𝜃 𝑡 + 1 updates the parameters."
        out = self.formatter._normalize_unicode_math(md)
        assert out == "$\\theta t\\to\\theta t+1$ updates the parameters."

    def test_double_struck_letter_wrapped(self) -> None:
        """双线体 𝔼（U+1D53C）也要归一（在 _BLACKBOARD_MAP，非 MATH_LETTER_CHARS）。"""
        md = "The set 𝔼 [ 𝑋 ] is the expectation."
        out = self.formatter._normalize_unicode_math(md)
        assert out == "The set $\\mathbb{E}[X]$ is the expectation."

    # ------------------------------------------------------------------
    # 边界：run 断开 / 标点剥离
    # ------------------------------------------------------------------

    def test_run_breaks_at_english_word(self) -> None:
        """英文单词断开 run：𝑀 𝜃 𝑡 is → $M\\theta t$ is。"""
        md = "𝑀 𝜃 𝑡 is the base model."
        out = self.formatter._normalize_unicode_math(md)
        assert out == "$M\\theta t$ is the base model."

    def test_trailing_sentence_period_stripped(self) -> None:
        """run 结尾的句末句点剥离到 $...$ 之外。"""
        md = "vertical capability 𝐸 𝑡."
        out = self.formatter._normalize_unicode_math(md)
        assert out == "vertical capability $Et$."

    def test_number_with_trailing_comma_absorbed(self) -> None:
        """「数字 + 尾逗号」（1,）可被 run 吸附合并进公式；结尾逗号再剥离到 $...$ 外。"""
        md = "𝑡 𝑖 − 1,"
        out = self.formatter._normalize_unicode_math(md)
        # 关键：1 被并入公式（未因逗号断开 run），句末逗号剥离到数学之外
        assert out == "$ti-1$,"

    def test_math_minus_u2212_in_run(self) -> None:
        """U+2212（−）数学减号纳入 run 并映射为 ascii hyphen。"""
        md = "𝑡 𝑖 − 1 then."
        out = self.formatter._normalize_unicode_math(md)
        assert "$ti-1$" in out

    # ------------------------------------------------------------------
    # 保护：不误伤
    # ------------------------------------------------------------------

    def test_plain_english_untouched(self) -> None:
        """无数学字母块的纯英文不动。"""
        md = "Plain English sentence with no math at all."
        assert self.formatter._normalize_unicode_math(md) == md

    def test_existing_inline_math_preserved(self) -> None:
        """已有 inline $...$ split-and-skip，内部不动。"""
        md = "Cost $5 and value $\\theta$ here."
        out = self.formatter._normalize_unicode_math(md)
        # $\\theta$ 与 $5...$ 区间不被二次处理
        assert "$\\theta$" in out

    def test_heading_line_skipped(self) -> None:
        """标题行（# 起首）跳过，即使含数学字母。"""
        md = "## 3.2 𝑆 𝑡 heading"
        assert self.formatter._normalize_unicode_math(md) == md

    def test_table_row_skipped(self) -> None:
        """表格行（| 起首）跳过。"""
        md = "| col 𝑡 | col2 |"
        assert self.formatter._normalize_unicode_math(md) == md

    def test_list_item_marker_preserved(self) -> None:
        """列表项的 - 标记不被吸附。"""
        md = "- 𝑡 denotes the step index."
        out = self.formatter._normalize_unicode_math(md)
        assert out == "- $t$ denotes the step index."

    # ------------------------------------------------------------------
    # LaTeX 命令间距
    # ------------------------------------------------------------------

    def test_latex_command_space_before_ascii_letter(self) -> None:
        """\\name 命令后跟（映射后）ASCII 字母补空格，防 \\thetat 粘连。"""
        md = "𝜃 𝑡"
        out = self.formatter._normalize_unicode_math(md)
        assert out == "$\\theta t$"

    def test_latex_command_no_space_before_op(self) -> None:
        """\\name 命令后跟运算符（如 (）不补空格。"""
        md = "( 𝛼 )"
        out = self.formatter._normalize_unicode_math(md)
        assert out == "$(\\alpha)$"

    def test_set_builder_braces_escaped(self) -> None:
        """集合构造式的裸花括号转义为 ``\\{`` / ``\\}``，避免跨 $..$ 片段失衡致
        KaTeX ParseError（Expected '}'）。"""
        md = "𝜏 𝑖 = { 𝛼 | time (𝛼) ∈[ 𝑡 𝑖 − 1, 𝑡 𝑖)}."
        out = self.formatter._normalize_unicode_math(md)
        # 裸花括号被转义
        assert "\\{" in out and "\\}" in out
        # 每个 $...$ 片段内未转义花括号数为 0（平衡）
        import re as _re

        for seg in _re.findall(r"\$([^$]+)\$", out):
            assert len(_re.findall(r"(?<!\\)\{", seg)) == 0
            assert len(_re.findall(r"(?<!\\)\}", seg)) == 0

    def test_structural_braces_from_mapping_preserved(self) -> None:
        """映射命令产生的结构性花括号（如 \\mathbf{V} 来自粗体字母）不被转义。"""
        md = "𝐕"  # U+1D415 MATHEMATICAL BOLD CAPITAL V → \mathbf{V}
        out = self.formatter._normalize_unicode_math(md)
        assert "\\mathbf{V}" in out
        assert "\\mathbf\\{" not in out

    # ------------------------------------------------------------------
    # feature flag
    # ------------------------------------------------------------------

    def test_feature_flag_disables_pass(self, monkeypatch) -> None:
        """PERCEIVES_UNICODE_MATH_NORMALIZE=0 整体禁用。"""
        monkeypatch.setenv("PERCEIVES_UNICODE_MATH_NORMALIZE", "0")
        md = "𝑡 denotes time."
        assert self.formatter._normalize_unicode_math(md) == md


class TestNormalizeUnicodeMathFullPipeline:
    """测试 _normalize_unicode_math 在完整 format() 管线中与 protect/restore 协同。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_block_math_preserved_through_pipeline(self) -> None:
        """块公式 $$..$$ 经管线后仍完整，散落 inline 字形被包裹。"""
        md = (
            "Intro with 𝑡 inline.\n\n"
            "$$\n\\mathcal{A}_t = \\langle M_t \\rangle\n$$\n\n"
            "Outro with 𝜃 too."
        )
        out = self.formatter.format(md)
        # 块公式主体完整保留
        assert "\\mathcal{A}_t = \\langle M_t \\rangle" in out
        # 散落 inline 字形被包裹
        assert "$t$ inline" in out
        assert "$\\theta$ too" in out

    def test_code_block_not_touched(self) -> None:
        """fenced 代码块内的数学字母块字形不被包裹（保护语义）。"""
        md = "```\n𝑡 = 1\n```\n\nProse 𝑡 here."
        out = self.formatter.format(md)
        # 代码块内原样
        assert "𝑡 = 1" in out
        # 散文内被包裹
        assert "$t$ here" in out
