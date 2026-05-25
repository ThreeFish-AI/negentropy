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

    def test_adjacent_similar_math_blocks_all_preserved(self) -> None:
        """同章节相邻的多条公式（共享大量变量与运算符令牌）必须全部保留，
        不得被 ``_deduplicate_approximate_paragraphs`` 的 Jaccard 相似度
        误判为重复段落而剔除。

        回归来源：Context Engineering 2.0 论文 5.3 节 ``M_s = f_short(...)``
        与 ``M_l = f_long(...)`` 共享 ``M``、``f``、``c``、``\\theta`` 等令牌，
        历史版本 Jaccard > 0.6 → 后者被剔；本用例锁定 math-block 豁免。
        """
        md = (
            "Definition 5.1.\n\n"
            "$$\n"
            r"M _ { s } = f _ { s h o r t } \left( c \in C : w _ { t e m p o r a l } ( c ) > \theta _ { s } \right)\tag{5}"
            "\n$$\n\n"
            "where short-term memory captures recent context.\n\n"
            "Definition 5.2.\n\n"
            "$$\n"
            r"M _ { l } = f _ { l o n g } \left( c \in C : w _ { i m p o r t a n c e } ( c ) > \theta _ { l } \wedge w _ { t e m p o r a l } ( c ) \le \theta _ { s } \right)\tag{6}"
            "\n$$\n\n"
            "where long-term memory retains important context.\n"
        )
        result = self.formatter._deduplicate_approximate_paragraphs(md)
        # 两条公式都必须保留
        assert "\\tag{5}" in result
        assert "\\tag{6}" in result
        # 文本段落（共享词汇较少）应保持不被误删
        assert "short-term memory" in result
        assert "long-term memory" in result

    def test_dedup_still_removes_duplicated_prose(self) -> None:
        """math-block 豁免不应弱化文本段落的跨引擎近似去重。"""
        md = (
            "The quick brown fox jumps over the lazy dog and runs through "
            "the verdant meadow chasing butterflies in the warm sunlight "
            "while children watch in delight from the wooden fence post.\n\n"
            "The quick brown fox jumps over the lazy dog and runs through "
            "the verdant meadow chasing butterflies in the warm sunlight "
            "while children watch in delight from the wooden fence post.\n"
        )
        result = self.formatter._deduplicate_approximate_paragraphs(md)
        # 同样的段落出现两次时，仍应去重为一次
        assert result.count("quick brown fox") == 1
