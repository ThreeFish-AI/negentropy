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
