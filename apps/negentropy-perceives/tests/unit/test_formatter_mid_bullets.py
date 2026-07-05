"""formatter._split_mid_paragraph_bullets 段落中部 Unicode bullet 拆分单测。

背景（ISSUE：段中 bullet 残留）：PDF 抽取常把原生列表 ``• A • B • C`` 压平进
单一段落，段落中部的 bullet 不被 ``_normalize_unicode_bullets`` 的行首规则覆盖。
本 pass 把 ``前文 • A • B`` 拆为 ``前文`` + ``- A`` + ``- B``。
"""

from negentropy.perceives.markdown.formatter import MarkdownFormatter


class TestSplitMidParagraphBullets:
    def setup_method(self) -> None:
        self.f = MarkdownFormatter()

    def test_multi_bullet_paragraph_split(self) -> None:
        """段落中部 ≥2 个 bullet 拆分为独立列表项，前文成独立段落。"""
        md = "Cost • interaction cost • compute cost • operational cost"
        out = self.f._split_mid_paragraph_bullets(md)
        assert out == ("Cost\n- interaction cost\n- compute cost\n- operational cost")

    def test_abbrev_dictionary_pattern_split(self) -> None:
        """缩写词典型 ``• FG: ... • BR: ...`` 拆分（前置已是列表项则保留）。"""
        md = "- FG: Forward Gain • BR: Backward Retention • IE: Improvement"
        out = self.f._split_mid_paragraph_bullets(md)
        assert out == (
            "- FG: Forward Gain\n- BR: Backward Retention\n- IE: Improvement"
        )

    def test_decorative_ellipsis_bullets_preserved(self) -> None:
        """装饰型 ``• • •``（无实义字符的 item）整行保留，不拆分。"""
        md = "SIP-Bench T₀ T₁ • • • T₂ repeated evaluation"
        assert self.f._split_mid_paragraph_bullets(md) == md

    def test_single_bullet_conservative_preserved(self) -> None:
        """单个段中 bullet 保守保留（不足以判定为列表压平）。"""
        md = "discussed in Section 7. • Finally, we study the condition."
        assert self.f._split_mid_paragraph_bullets(md) == md

    def test_table_row_skipped(self) -> None:
        """含 ``|`` 的表格行跳过。"""
        md = "| a • b | c • d • e |"
        assert self.f._split_mid_paragraph_bullets(md) == md

    def test_heading_skipped(self) -> None:
        """标题行跳过。"""
        md = "## Section • sub • sub2 heading"
        assert self.f._split_mid_paragraph_bullets(md) == md

    def test_placeholder_line_skipped(self) -> None:
        """代码 / 数学占位符行（%%）跳过。"""
        md = "%%CODEBLOCK_abc123%% • x • y"
        assert self.f._split_mid_paragraph_bullets(md) == md

    def test_no_bullet_untouched(self) -> None:
        """无 bullet 的普通段落不动。"""
        md = "A perfectly normal paragraph with no bullets at all."
        assert self.f._split_mid_paragraph_bullets(md) == md

    def test_empty_pre_all_items(self) -> None:
        """无前文（行以 bullet 空白起）时全部转列表项。"""
        # _normalize_unicode_bullets 会先转行首 bullet；这里直接测中段逻辑
        md = "intro • alpha item • beta item • gamma item"
        out = self.f._split_mid_paragraph_bullets(md)
        assert out == "intro\n- alpha item\n- beta item\n- gamma item"

    def test_multiline_mixed(self) -> None:
        """多行混合：仅命中行被拆，其余保留。"""
        md = (
            "Normal line one.\n"
            "Metrics • FG gain • BR retention • IE efficiency\n"
            "Normal line two."
        )
        out = self.f._split_mid_paragraph_bullets(md)
        assert out == (
            "Normal line one.\n"
            "Metrics\n- FG gain\n- BR retention\n- IE efficiency\n"
            "Normal line two."
        )


class TestSplitMidBulletsInPipeline:
    def setup_method(self) -> None:
        self.f = MarkdownFormatter()

    def test_full_format_splits_mid_bullets(self) -> None:
        """完整 format() 管线中段中 bullet 被拆为列表。"""
        md = "Metrics • FG gain • BR retention • IE efficiency"
        out = self.f.format(md)
        assert "- FG gain" in out
        assert "- BR retention" in out
        assert "- IE efficiency" in out

    def test_code_block_bullets_preserved_in_pipeline(self) -> None:
        """代码块内的 bullet 不被拆（保护语义）。"""
        md = "```\na • b • c\n```\n\nProse x • one • two • three"
        out = self.f.format(md)
        # 代码块内原样
        assert "a • b • c" in out
        # 散文内被拆
        assert "- one" in out
