"""``formatter._normalize_unicode_bullets`` —— Unicode 项目符号归一化单测。

锁定 R9 D2 修复契约：PDF 教材常用 ``●​ Use Case`` 形式（实心圆 + 零宽空白）
作为子项符号。下游 react-markdown 不识别 Unicode bullet，会把整行塞进段落
导致 list 结构丢失（R9 量化签名 list_bullet_residue=877）。修复后这些
符号统一转换为标准 markdown ``- ``。
"""

from __future__ import annotations

from negentropy.perceives.markdown.formatter import MarkdownFormatter


class TestNormalizeUnicodeBullets:
    """``_normalize_unicode_bullets`` —— 把各种 Unicode bullet 转 ``-``。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_solid_circle_with_zwj(self) -> None:
        """``●​ Use Case`` (U+25CF + U+200B) → ``- Use Case``。"""
        out = self.formatter._normalize_unicode_bullets("●​ Use Case: foo bar")
        assert out == "- Use Case: foo bar"

    def test_solid_circle_no_zwj(self) -> None:
        """``● bare`` → ``- bare``。"""
        out = self.formatter._normalize_unicode_bullets("● Plain bullet")
        assert out == "- Plain bullet"

    def test_hollow_circle(self) -> None:
        """``○ second-level`` → ``- second-level``。"""
        out = self.formatter._normalize_unicode_bullets("○ Tools: API calls")
        assert out == "- Tools: API calls"

    def test_solid_square(self) -> None:
        """``■ item`` → ``- item``。"""
        out = self.formatter._normalize_unicode_bullets("■ Action item")
        assert out == "- Action item"

    def test_small_solid_square(self) -> None:
        """``▪ item`` → ``- item``。"""
        out = self.formatter._normalize_unicode_bullets("▪ Sub item")
        assert out == "- Sub item"

    def test_arrow_bullet(self) -> None:
        """``▶ step`` → ``- step``。"""
        out = self.formatter._normalize_unicode_bullets("▶ Next step")
        assert out == "- Next step"

    def test_middle_dot(self) -> None:
        """``• item`` → ``- item``。"""
        out = self.formatter._normalize_unicode_bullets("• Note")
        assert out == "- Note"

    def test_indented_bullet_preserves_indent(self) -> None:
        """嵌套层级保留缩进。"""
        out = self.formatter._normalize_unicode_bullets("    ● Nested item")
        assert out == "    - Nested item"

    def test_multiline_content(self) -> None:
        """多行 markdown 全局处理。"""
        src = "Header text\n\n● First\n● Second\n  ○ Nested\n\nNormal paragraph."
        out = self.formatter._normalize_unicode_bullets(src)
        assert (
            out == "Header text\n\n- First\n- Second\n  - Nested\n\nNormal paragraph."
        )

    def test_inline_bullet_not_promoted(self) -> None:
        """段落中部出现的 bullet 不应被误转（必须在行首）。"""
        src = "This rule: ● first, ● second."
        out = self.formatter._normalize_unicode_bullets(src)
        # bullet 不在行首，保留原状
        assert "● first" in out

    def test_bullet_requires_space_separator(self) -> None:
        """bullet 后必须有空白才识别（``●text`` 不当 list）。"""
        out = self.formatter._normalize_unicode_bullets("●text without space")
        assert out == "●text without space"

    def test_zwj_only_after_bullet(self) -> None:
        """``●​​​ X`` 多个 ZWJ 都吃掉。"""
        out = self.formatter._normalize_unicode_bullets("●​​​ Multi-zwj item")
        assert out == "- Multi-zwj item"

    def test_format_lists_full_integration(self) -> None:
        """end-to-end: ``_format_lists`` 调用链贯穿，最终归一化为 ``- ``。"""
        src = "Pre\n\n●​ Use Case: e-commerce\n●​ Tools: API\n\nPost"
        out = self.formatter._format_lists(src)
        assert "●" not in out
        assert "- Use Case: e-commerce" in out
        assert "- Tools: API" in out
