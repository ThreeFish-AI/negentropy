"""assembly.py 作者署名 / 论文元数据 / 表格标题误识别为标题的过滤测试。

学术论文 PDF 的 PyMuPDF 文本块带 ``block_type="heading"`` 时，
``builtin_assembler`` 会输出为 Markdown 标题。当作者署名行、表格 caption
被误识别为大字号 heading 时，需要在 assembly 阶段降级。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.models import TextBlock
from negentropy.perceives.pipeline.stages.pdf.assembly import (
    _byline_to_paragraph,
    _is_author_byline,
    _is_paper_metadata_heading,
    _is_table_caption,
    _table_caption_to_paragraph,
)


def _mk_heading(text: str, level: int = 4) -> TextBlock:
    return TextBlock(
        text=text,
        page_number=0,
        bbox=None,
        block_type="heading",
        heading_level=level,
        reading_order=0,
    )


class TestAuthorBylineFilter:
    """``_is_author_byline`` 应识别多种学术论文作者署名结构。"""

    def test_ascii_star_long_byline(self) -> None:
        """ASCII `*` 标记 + 超长（多作者列表）应被识别。"""
        text = (
            "Alice Smith 1,2,*, Bob Jones 3,*, Carol Lee 2,*, "
            "Dave Wong 4, Eve Park 5, Frank Chen 6"
        )
        assert _is_author_byline(_mk_heading(text))

    def test_unicode_asterisk_byline(self) -> None:
        """Unicode ∗ 标记的短作者行应被识别（既有行为保留）。"""
        text = "Alice Smith ∗, Bob Jones †"
        assert _is_author_byline(_mk_heading(text))

    def test_email_byline(self) -> None:
        """含邮箱地址的标题应被识别。"""
        text = "Alice Smith, alice@example.edu"
        assert _is_author_byline(_mk_heading(text))

    def test_regular_section_heading_not_byline(self) -> None:
        """普通章节标题不应被误判为作者署名。"""
        text = "3.2 Categories of Agent Sandboxes"
        assert not _is_author_byline(_mk_heading(text))

    def test_paragraph_block_not_byline(self) -> None:
        """非 heading 类型的 block 不会被检查。"""
        text = "Alice Smith 1,2,*, Bob Jones 3,*"
        block = TextBlock(
            text=text,
            page_number=0,
            bbox=None,
            block_type="paragraph",
            heading_level=None,
            reading_order=0,
        )
        assert not _is_author_byline(block)

    def test_short_sentence_with_star_not_byline(self) -> None:
        """普通含 `*` 的短句子不应被误判（仅 1 个 `digit,*` 也算）

        当只有 1 处 `affiliation,*` 模式时仍可能是作者，但需多 comma 才能算
        多作者；此场景按 author 判定。
        """
        # 单作者 + affiliation,*
        text = "Alice Smith 1,*"
        assert _is_author_byline(_mk_heading(text))


class TestTableCaptionFilter:
    """``_is_table_caption`` 应识别 Table N: ... 形式的 caption。"""

    def test_table_caption_heading(self) -> None:
        text = "Table 2: Comparison of agent harnesses across layers."
        assert _is_table_caption(_mk_heading(text))

    def test_appendix_table_caption(self) -> None:
        """Table S2 (附录表) caption 也应识别。"""
        text = "Table S2: Reference harness implementations and ETCLOVG coverage."
        assert _is_table_caption(_mk_heading(text))

    def test_figure_not_table(self) -> None:
        """Figure caption 不归此函数管。"""
        text = "Figure 1: A brief comparison of approaches."
        assert not _is_table_caption(_mk_heading(text))

    def test_regular_section_not_caption(self) -> None:
        text = "3.1 Definition"
        assert not _is_table_caption(_mk_heading(text))

    def test_paragraph_not_caption(self) -> None:
        text = "Table 2: foo"
        block = TextBlock(
            text=text,
            page_number=0,
            bbox=None,
            block_type="paragraph",
            heading_level=None,
            reading_order=0,
        )
        assert not _is_table_caption(block)


class TestMetadataHeadingFilter:
    """既有 ``_is_paper_metadata_heading`` 行为不应被改动破坏。"""

    def test_ccs_concepts(self) -> None:
        assert _is_paper_metadata_heading(_mk_heading("CCS Concepts"))

    def test_received_revised(self) -> None:
        text = "Received 2 March 2026; revised 4 April; accepted 5 May."
        assert _is_paper_metadata_heading(_mk_heading(text))

    def test_normal_heading(self) -> None:
        assert not _is_paper_metadata_heading(_mk_heading("Introduction"))


class TestBylineDegrade:
    """``_byline_to_paragraph`` 把作者署名 heading 降级为纯文本段落。"""

    def test_byline_stripped_of_heading_marker(self) -> None:
        block = _mk_heading("Alice Smith 1,2,*, Bob Jones 3,*")
        result = _byline_to_paragraph(block)
        assert not result.startswith("#")
        assert "Alice Smith" in result and "Bob Jones" in result

    def test_byline_with_email_preserved(self) -> None:
        block = _mk_heading("Alice Smith, alice@example.edu")
        result = _byline_to_paragraph(block)
        assert "alice@example.edu" in result


class TestTableCaptionDegrade:
    """``_table_caption_to_paragraph`` 把 Table N: caption 降级为 bold 段落。"""

    def test_caption_becomes_bold(self) -> None:
        block = _mk_heading("Table 2: Comparison of agent harnesses")
        result = _table_caption_to_paragraph(block)
        assert result.startswith("**") and result.endswith("**")
        assert not result.startswith("#")
