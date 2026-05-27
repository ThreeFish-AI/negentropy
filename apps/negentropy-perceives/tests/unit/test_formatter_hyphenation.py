"""src/negentropy/perceives/markdown/formatter.py 跨行连字符合并的单元测试。

学术论文 PDF 在 PyMuPDF 文本提取时常残留 `word-\nword` 模式；assembly 阶段
把 `\n` 折叠为空格后，产物里就出现 `word- word`（断字未合并）。本套测试
为新加入的 `_fix_hyphenation` 设定边界。
"""

from negentropy.perceives.markdown.formatter import MarkdownFormatter


class TestFormatterHyphenation:
    """测试 MarkdownFormatter 对跨行断字的合并。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_basic_hyphenation_merged(self) -> None:
        """基本英文小写跨行断字应被合并。"""
        md = "This sur- vey provides a treatment of har- ness engineer- ing."
        result = self.formatter._apply_typography_fixes(md)
        assert "survey" in result
        assert "harness" in result
        assert "engineering" in result
        assert "sur- vey" not in result

    def test_compound_with_no_space_preserved(self) -> None:
        """正常的复合词（无空格）不应被改动。"""
        md = "The state-of-the-art model achieves cost-quality-speed balance."
        result = self.formatter._apply_typography_fixes(md)
        assert "state-of-the-art" in result
        assert "cost-quality-speed" in result

    def test_uppercase_after_hyphen_preserved(self) -> None:
        """连字符后跟大写字母不合并（保留专有名词或缩写边界）。"""
        md = "We compare X- Ray imaging with Y- Combinator."
        result = self.formatter._apply_typography_fixes(md)
        assert "X- Ray" in result or "X-Ray" in result
        # 至少不应该合并成 "XRay"
        assert "XRay" not in result

    def test_digit_range_preserved(self) -> None:
        """数字范围 `20- 30` 不应被合并。"""
        md = "Pages 20- 30 and section 4- 5."
        result = self.formatter._apply_typography_fixes(md)
        assert "2030" not in result
        assert "45" not in result.replace("section 4- 5", "")

    def test_math_inline_hyphenation_preserved(self) -> None:
        """行内公式中的断字模式不应被合并（math 内部不动）。"""
        md = "Compute $a- b$ as the difference."
        result = self.formatter._apply_typography_fixes(md)
        assert "$a- b$" in result

    def test_math_block_hyphenation_preserved(self) -> None:
        """块级公式中的断字模式不应被合并。"""
        md = "Result:\n\n$$x_{i- j} + y_{k- l}$$"
        result = self.formatter._apply_typography_fixes(md)
        assert "$$x_{i- j} + y_{k- l}$$" in result

    def test_full_pipeline_merges_hyphenation(self) -> None:
        """完整 format 管线也应合并断字。"""
        md = "# Title\n\nThis sur- vey of har- ness engineer- ing is comprehensive."
        result = self.formatter.format(md)
        assert "survey" in result
        assert "harness" in result
        assert "engineering" in result

    # ---- R10-D13/D14: 软连字符 U+00AD 与反向 `word -word` 模式合并 ----

    def test_soft_hyphen_with_space_merged(self) -> None:
        """PyMuPDF 在跨行断字处保留 U+00AD，``\" \".join(spans)`` 后形成
        ``advance\\xad ment``。需识别该模式并合并为完整词。
        """
        md = "Its rapid advance­ ment has led to a frame­ work."
        result = self.formatter._apply_typography_fixes(md)
        assert "advancement" in result
        assert "framework" in result
        assert "­" not in result

    def test_isolated_soft_hyphen_stripped(self) -> None:
        """单独残留 U+00AD（无 trailing 空格 / 无 follow-up 小写）也应清除。"""
        md = "fragment­ ends here­."
        result = self.formatter._apply_typography_fixes(md)
        assert "­" not in result

    def test_reverse_pattern_space_hyphen_merged(self) -> None:
        """反向模式 ``word -word``（即 ``-`` 前空格、后无空格）也是跨行断字
        的产物，应合并。常见于 image caption / 表格标题（一种 caption 抽取路径
        把 U+00AD 转为 ASCII 连字符）。
        """
        md = (
            "Conceptual framework resolves conceptual retrofit -ting by distinguishing "
            "the prompt-driven or -chestration of funda -mentally incompatible systems."
        )
        result = self.formatter._apply_typography_fixes(md)
        assert "retrofitting" in result
        assert "orchestration" in result
        assert "fundamentally" in result
        assert "retrofit -ting" not in result

    def test_reverse_pattern_uppercase_preserved(self) -> None:
        """``word -Word``（连字符后为大写）不应合并 — 多见于专有名词或缩写边界。"""
        md = "Smith -John (2024) discussed X -Ray imaging."
        result = self.formatter._apply_typography_fixes(md)
        # 不应合并为 SmithJohn / XRay
        assert "SmithJohn" not in result
        assert "XRay" not in result

    def test_reverse_pattern_em_dash_preserved(self) -> None:
        """两侧都有空格（``a - b``）是 em-dash 风格，不应合并。"""
        md = "Section A - Section B contains the analysis."
        result = self.formatter._apply_typography_fixes(md)
        assert "Section A - Section B" in result or "A — Section" in result

    def test_reverse_pattern_compound_no_space_preserved(self) -> None:
        """正常复合词（无空格）保持不变。"""
        md = "neuro-symbolic systems combine state-of-the-art models."
        result = self.formatter._apply_typography_fixes(md)
        assert "neuro-symbolic" in result
        assert "state-of-the-art" in result

    # ---- R10-D19: word - word（两侧均空格）模式合并 ----

    def test_bothside_space_hyphen_merged(self) -> None:
        """表格 / 长正文中两侧均空格的断字 ``per - formance`` 应合并为
        ``performance``。该模式在 Springer 期刊表格内尤其常见。
        """
        md = "| feature | No per - formance metrics |\n| feature | Scalabil - ity not addressed |"
        result = self.formatter._apply_typography_fixes(md)
        assert "performance" in result
        assert "Scalability" in result
        assert "per - formance" not in result
        assert "Scalabil - ity" not in result

    def test_bothside_space_proper_noun_merged(self) -> None:
        """专有名词跨行断字 ``Mo - zolevskyi`` 也应合并。"""
        md = "(2025), Mo - zolevskyi and AlShikh (2024)"
        result = self.formatter._apply_typography_fixes(md)
        assert "Mozolevskyi" in result

    def test_bothside_space_em_dash_with_capital_preserved(self) -> None:
        """两侧均空格但右侧大写起首（em-dash 风格 ``A - B``）不应合并。"""
        md = "Section A - Section B contains the analysis."
        result = self.formatter._apply_typography_fixes(md)
        # Section B 不应被并入 Section
        assert "SectionB" not in result
        # 形如 "A - Section" 至少 A 后保留断行

    def test_bothside_space_single_letter_preserved(self) -> None:
        """单字母两侧（``a - b``）不应合并 —— 多为数学 / 公式 / 列表项。"""
        md = "Compute a - b as the simple difference."
        result = self.formatter._apply_typography_fixes(md)
        assert "ab" not in result.replace("a - b", "").replace("simple", "")
