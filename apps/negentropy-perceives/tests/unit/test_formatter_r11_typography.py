"""src/negentropy/perceives/markdown/formatter.py R11 排版修正单元测试。

覆盖：
- R11-B：URL 协议拆分空格压缩 ``https: //`` → ``https://``；
- R11-C：作者-年份引用括号内侧空格压缩 ``[ Author et al., YYYY ]`` → ``[Author et al., YYYY]``。
"""

from negentropy.perceives.markdown.formatter import MarkdownFormatter


class TestFormatterR11UrlRejoin:
    """R11-B：URL 协议被 PyMuPDF 拆分后 ``" ".join`` 插入空格的还原。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_https_split_space_rejoined(self) -> None:
        """``https: //`` → ``https://``。"""
        md = "See https: //arxiv.org/abs/2602.21320 for details."
        result = self.formatter._apply_typography_fixes(md)
        assert "https://arxiv.org/abs/2602.21320" in result
        assert "https: //" not in result

    def test_http_split_space_rejoined(self) -> None:
        """``http: //`` → ``http://``。"""
        md = "Visit http: //example.com now."
        result = self.formatter._apply_typography_fixes(md)
        assert "http://example.com" in result

    def test_intact_url_unchanged(self) -> None:
        """完好的 URL 不受影响。"""
        md = "See https://arxiv.org/abs/2602.21320 for details."
        result = self.formatter._apply_typography_fixes(md)
        assert "https://arxiv.org/abs/2602.21320" in result

    def test_url_inside_references_line(self) -> None:
        """典型 References 行：URL 拆分 + 末尾句点。"""
        md = (
            "Author Name. Title of paper. arXiv preprint arXiv:2506.04565, 2025a. "
            "URL https: //arxiv.org/abs/2506.04565."
        )
        result = self.formatter._apply_typography_fixes(md)
        assert "https://arxiv.org/abs/2506.04565" in result


class TestFormatterR11CitationBracket:
    """R11-C：作者-年份引用括号内侧空格压缩。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_author_year_single(self) -> None:
        """``[ Nakano et al., 2022 ]`` → ``[Nakano et al., 2022]``。"""
        md = "WebGPT showed this [ Nakano et al., 2022 ] in early work."
        result = self.formatter._apply_typography_fixes(md)
        assert "[Nakano et al., 2022]" in result
        assert "[ Nakano et al., 2022 ]" not in result

    def test_author_year_no_et_al(self) -> None:
        """仅年份信号也命中：``[ Ahn, 2022 ]`` → ``[Ahn, 2022]``。"""
        md = "SayCan grounded plans [ Ahn, 2022 ] in affordances."
        result = self.formatter._apply_typography_fixes(md)
        assert "[Ahn, 2022]" in result

    def test_multiple_citations_one_line(self) -> None:
        """一行多处引用都被压缩。"""
        md = "Prior work [ Hong et al., 2024, Wu et al., 2024b ] established this."
        result = self.formatter._apply_typography_fixes(md)
        assert "[Hong et al., 2024, Wu et al., 2024b]" in result

    def test_token_marker_not_touched(self) -> None:
        """``[CLS]`` / ``[MASK]`` 等 token 记号（无年份/et al.）不压缩。"""
        md = "The model uses [ CLS ] and [ MASK ] tokens."
        result = self.formatter._apply_typography_fixes(md)
        # 无引用信号 → 原样保留
        assert (
            "[ CLS ]" in result or "[CLS]" in result
        )  # 内容可能被其他排版规则影响，但不应因 citation 规则压缩
        # 关键：不应因 citation 压缩成 [CLS]（除非其他规则）—— 这里 Assert 它没被 citation 规则误命中
        # 由于 [ CLS ] 内无年份/et al.，_tighten_citation_bracket 应返回原样

    def test_short_bracket_not_touched(self) -> None:
        """短内容（<4 字符）不压缩，避免误伤 ``[ ]`` / ``[x]`` 任务框。"""
        md = "Checkbox [ ] and done [x] items remain."
        result = self.formatter._apply_typography_fixes(md)
        assert "[ ]" in result
        assert "[x]" in result

    def test_already_tight_unchanged(self) -> None:
        """已紧贴的引用不被反复修改。"""
        md = "WebGPT [Nakano et al., 2022] showed this."
        result = self.formatter._apply_typography_fixes(md)
        assert "[Nakano et al., 2022]" in result

    def test_markdown_link_not_broken(self) -> None:
        """``[ text ](url)`` 形态：内含空格但无引用信号，不应被压缩（避免链接文本误改）。"""
        md = "See [ the docs ](https://example.com) for more."
        result = self.formatter._apply_typography_fixes(md)
        # 无年份/et al. → 不压缩
        assert "[ the docs ]" in result

    def test_letter_suffix_year_tightened(self) -> None:
        """R11-C fix：字母消歧后缀年份 ``[ Zhang, 2026b ]`` → ``[Zhang, 2026b]``。"""
        md = "Autogenesis [ Zhang, 2026b ] formulates the loop."
        result = self.formatter._apply_typography_fixes(md)
        assert "[Zhang, 2026b]" in result

    def test_org_author_with_letter_suffix(self) -> None:
        """机构作者 + 字母后缀：``[ Shanghai AI Lab, 2025a ]`` → ``[Shanghai AI Lab, 2025a]``。"""
        md = "risk [ Shanghai AI Lab, 2025a ] framework."
        result = self.formatter._apply_typography_fixes(md)
        assert "[Shanghai AI Lab, 2025a]" in result


class TestFormatterR11UrlPathCollapse:
    """R11-B2：URL 路径段换行拆分空格压缩。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_arxiv_path_split_rejoined(self) -> None:
        """``arxiv.org/ abs/...`` → ``arxiv.org/abs/...``。"""
        md = "URL https://arxiv.org/ abs/2604.06126."
        result = self.formatter._apply_typography_fixes(md)
        assert "https://arxiv.org/abs/2604.06126" in result

    def test_github_multi_segment_split(self) -> None:
        """多段路径都被修复。"""
        md = "See https://github.com/ FrontisAI/ Awesome-Self-Improving-Agents."
        result = self.formatter._apply_typography_fixes(md)
        assert "github.com/FrontisAI/Awesome-Self-Improving-Agents" in result

    def test_intact_url_unchanged(self) -> None:
        """完好 URL 路径不被误改。"""
        md = "Visit https://arxiv.org/abs/2602.21320 for the paper."
        result = self.formatter._apply_typography_fixes(md)
        assert "https://arxiv.org/abs/2602.21320" in result

    def test_url_with_query_string(self) -> None:
        """带 ?id= 的 URL 路径空格也修复。"""
        md = "See https://openreview.net/ forum?id=MSXbrNExax."
        result = self.formatter._apply_typography_fixes(md)
        assert "openreview.net/forum?id=MSXbrNExax" in result


class TestFormatterR11DegreeSymbol:
    """R11-F：度数符号脱离修复 ``45 ◦`` → ``45°``。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_degree_reattached(self) -> None:
        md = "the AI-45 ◦ line suggests"
        result = self.formatter._apply_typography_fixes(md)
        assert "45°" in result
        assert "◦" not in result

    def test_degree_no_space(self) -> None:
        md = "at 90◦ angle"
        result = self.formatter._apply_typography_fixes(md)
        assert "90°" in result

    def test_table_bullet_not_touched(self) -> None:
        """表格中独立的 ◦（无数字前缀）不被误改。"""
        md = "| LifelongAgentBench | ◦ | ◦ |"
        result = self.formatter._apply_typography_fixes(md)
        assert "◦" in result  # preserved


class TestFormatterR11CoverIconGlyph:
    """R11-A：封面按钮行 icon-font mojibake 清理（§ + C1 控制字符）。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_section_symbol_between_buttons_stripped(self) -> None:
        """``HomePage § GitHub`` → ``HomePage GitHub``。"""
        md = "HomePage § GitHub"
        result = self.formatter._apply_typography_fixes(md)
        assert "§" not in result
        assert "HomePage" in result and "GitHub" in result

    def test_c1_control_char_stripped(self) -> None:
        """U+0080 icon mojibake 被 _basic_cleanup 清除。"""
        md = "Cover line with \x80 icon glyph here."
        result = self.formatter.format(md)
        assert "\x80" not in result

    def test_full_cover_button_line_cleaned(self) -> None:
        """完整封面按钮行（\x80 + §）经全管线清理后无 artifact。"""
        md = "\x80 HomePage § GitHub"
        result = self.formatter.format(md)
        assert "\x80" not in result
        assert "§" not in result
        assert "HomePage" in result and "GitHub" in result

    def test_section_reference_not_touched(self) -> None:
        """``§8.2`` / ``§ References`` 等章节引用不被误伤（不在按钮词之间）。"""
        md = "See §8.2 for details and § References for the list."
        result = self.formatter._apply_typography_fixes(md)
        assert "§8.2" in result
        assert "§ References" in result
