"""src/negentropy/perceives/markdown/formatter.py 数学内容保护的单元测试。"""

from negentropy.perceives.markdown.formatter import MarkdownFormatter


class TestFormatterMathProtection:
    """测试 MarkdownFormatter 的排版修正不破坏数学内容。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_inline_math_spaces_preserved(self) -> None:
        """行内公式中的多个空格不应被压缩为单个空格。"""
        md = "Text $x  +  y = z$ more text."
        result = self.formatter._apply_typography_fixes(md)
        assert "$x  +  y = z$" in result

    def test_block_math_spaces_preserved(self) -> None:
        """块级公式中的内容不受排版修正影响。"""
        md = "Before\n\n$$x  +  y  =  z$$\n\nAfter"
        result = self.formatter._apply_typography_fixes(md)
        assert "$$x  +  y  =  z$$" in result

    def test_punctuation_fix_outside_math(self) -> None:
        """排版修正仍然对非数学文本生效。"""
        md = "Hello  world . This is  a test ."
        result = self.formatter._apply_typography_fixes(md)
        assert "Hello world." in result

    def test_mixed_math_and_text(self) -> None:
        """混合文本中数学部分被保护，文本部分被修正。"""
        md = "Given $x  \\in  S$ ,  we have  $y  =  f(x)$ ."
        result = self.formatter._apply_typography_fixes(md)
        # 数学内容保持不变
        assert "$x  \\in  S$" in result
        assert "$y  =  f(x)$" in result

    def test_backslash_bracket_notation(self) -> None:
        r"""``\[...\]`` 表示法中的内容被保护。"""
        md = r"Text \[x  +  y\] more  text"
        result = self.formatter._apply_typography_fixes(md)
        assert r"\[x  +  y\]" in result

    def test_backslash_paren_notation(self) -> None:
        r"""``\(...\)`` 表示法中的内容被保护。"""
        md = r"Text \(x  +  y\) more  text"
        result = self.formatter._apply_typography_fixes(md)
        assert r"\(x  +  y\)" in result

    def test_em_dash_conversion_outside_math(self) -> None:
        """双连字符转 em-dash 仍然工作。"""
        md = "Word--word $x--y$ end"
        result = self.formatter._apply_typography_fixes(md)
        assert "\u2014" in result  # em-dash outside math
        assert "$x--y$" in result  # preserved inside math

    def test_full_pipeline_preserves_math(self) -> None:
        """完整格式化管线不破坏数学内容。"""
        md = "# Title\n\nGiven $\\alpha \\in \\mathbb{R}$, we compute:\n\n$$f(x) = \\sum_{i=1}^{n} x_i^2$$\n\nResult follows."
        result = self.formatter.format(md)
        assert "$\\alpha \\in \\mathbb{R}$" in result
        assert "$$f(x) = \\sum_{i=1}^{n} x_i^2$$" in result
