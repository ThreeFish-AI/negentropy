"""段落分隔专项测试：验证 PDF 和 WebPage 文本提取后段落间使用 \\n\\n 分隔。

测试覆盖范围：
1. PyMuPDF block 级提取 — 验证 blocks 转换为 \\n\\n 分隔段落
2. pypdf 段落归一化 — 启发式检测段落边界
3. _convert_to_markdown HTML <p> 包装 — 段落正确包裹为 HTML 段落
4. _simple_markdown_conversion 段落分组 — 段内行合并、段间双换行
5. 页面注释保留 — <!-- Page N --> 不干扰段落结构
6. 学术 PDF 文本结构 — 标题/摘要/正文段落的模拟
7. build_html_from_text 启发式段落检测 — WebPage text-only 场景
8. 实际 PDF 集成测试 — 使用 assets 中的 PDF 文件端到端验证
9. MarkdownFormatter 段落间距归一化 — Web 页面 Markdown 转换后段落 \\n\\n 分隔
10. HTML→Markdown 端到端段落分隔 — 通过 MarkdownConverter 验证
"""

import pytest
import tempfile
from unittest.mock import Mock, patch
from pathlib import Path

from negentropy.perceives.pdf.processor import PDFProcessor
from negentropy.perceives.markdown.html_preprocessor import (
    build_html_from_text,
    _heuristic_split_paragraphs,
)
from negentropy.perceives.markdown.formatter import MarkdownFormatter


@pytest.fixture
def processor():
    """Create a PDFProcessor instance."""
    proc = PDFProcessor()
    yield proc
    proc.cleanup()


# ---------------------------------------------------------------------------
# 1. PyMuPDF block 级提取
# ---------------------------------------------------------------------------
class TestPyMuPDFBlockExtraction:
    """验证 PyMuPDF block 级提取产生正确的段落分隔。"""

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_blocks_produce_double_newlines(self, mock_import_fitz, processor):
        """多个 text blocks 应以 \\n\\n 分隔。"""
        mock_fitz = Mock()
        mock_import_fitz.return_value = mock_fitz

        mock_doc = Mock()
        mock_doc.page_count = 1
        mock_doc.metadata = {}
        mock_fitz.open.return_value = mock_doc

        # 模拟 3 个 text blocks (x0, y0, x1, y1, text, block_no, block_type)
        mock_page = Mock()
        mock_page.get_text.return_value = [
            (0, 0, 500, 30, "Abstract\n", 0, 0),
            (
                0,
                40,
                500,
                120,
                "First paragraph line one.\nFirst paragraph line two.\n",
                1,
                0,
            ),
            (
                0,
                130,
                500,
                210,
                "Second paragraph line one.\nSecond paragraph line two.\n",
                2,
                0,
            ),
        ]
        mock_doc.load_page.return_value = mock_page

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            tmp_path = Path(f.name)

        try:
            result = await processor._extract_with_pymupdf(
                tmp_path, include_metadata=False
            )
            text = result["text"]

            assert result["success"] is True
            # Blocks should be separated by \n\n
            assert "Abstract\n\n" in text
            # Intra-block line breaks should be merged into spaces
            assert "First paragraph line one. First paragraph line two." in text
            assert "Second paragraph line one. Second paragraph line two." in text
            # Paragraphs separated by \n\n
            assert "First paragraph line two.\n\nSecond paragraph" in text
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_image_blocks_excluded(self, mock_import_fitz, processor):
        """图片 blocks (block_type=1) 应被排除。"""
        mock_fitz = Mock()
        mock_import_fitz.return_value = mock_fitz

        mock_doc = Mock()
        mock_doc.page_count = 1
        mock_doc.metadata = {}
        mock_fitz.open.return_value = mock_doc

        mock_page = Mock()
        mock_page.get_text.return_value = [
            (0, 0, 500, 30, "Text block\n", 0, 0),
            (0, 40, 500, 200, "<image data>", 1, 1),  # image block
            (0, 210, 500, 300, "Another text block\n", 2, 0),
        ]
        mock_doc.load_page.return_value = mock_page

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            tmp_path = Path(f.name)

        try:
            result = await processor._extract_with_pymupdf(
                tmp_path, include_metadata=False
            )
            text = result["text"]

            assert "Text block" in text
            assert "Another text block" in text
            assert "<image data>" not in text
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_blocks_sorted_by_position(self, mock_import_fitz, processor):
        """Blocks 应按 y0, x0 排序以保证阅读顺序。"""
        mock_fitz = Mock()
        mock_import_fitz.return_value = mock_fitz

        mock_doc = Mock()
        mock_doc.page_count = 1
        mock_doc.metadata = {}
        mock_fitz.open.return_value = mock_doc

        # Blocks out of order by y0
        mock_page = Mock()
        mock_page.get_text.return_value = [
            (0, 200, 500, 250, "Third\n", 2, 0),
            (0, 0, 500, 50, "First\n", 0, 0),
            (0, 100, 500, 150, "Second\n", 1, 0),
        ]
        mock_doc.load_page.return_value = mock_page

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            tmp_path = Path(f.name)

        try:
            result = await processor._extract_with_pymupdf(
                tmp_path, include_metadata=False
            )
            text = result["text"]

            # Should be in reading order: First, Second, Third
            first_pos = text.index("First")
            second_pos = text.index("Second")
            third_pos = text.index("Third")
            assert first_pos < second_pos < third_pos
        finally:
            if tmp_path.exists():
                tmp_path.unlink()


# ---------------------------------------------------------------------------
# 2. pypdf 段落归一化
# ---------------------------------------------------------------------------
class TestNormalizeParagraphs:
    """验证 _normalize_paragraphs 启发式段落检测。"""

    def test_text_with_existing_double_newlines_unchanged(self, processor):
        """已有 \\n\\n 的文本不做额外处理。"""
        text = "Paragraph one.\n\nParagraph two."
        result = processor._normalize_paragraphs(text)
        assert result == text

    def test_sentence_ending_followed_by_uppercase(self, processor):
        """句尾标点 + 大写字母开头 → 插入段落分隔。"""
        text = "End of paragraph.\nStart of new paragraph."
        result = processor._normalize_paragraphs(text)
        assert "\n\n" in result
        assert "End of paragraph.\n\nStart of new paragraph." == result

    def test_colon_ending_followed_by_uppercase(self, processor):
        """冒号结尾 + 大写字母开头 → 插入段落分隔。"""
        text = "Section Title:\nContent starts here."
        result = processor._normalize_paragraphs(text)
        assert "\n\n" in result

    def test_no_paragraph_break_within_sentence(self, processor):
        """句中折行不应被视为段落分隔。"""
        text = "This is a long sentence that\ncontinues on the next line."
        result = processor._normalize_paragraphs(text)
        # No double-newline should be inserted (lowercase start)
        assert "\n\n" not in result

    def test_empty_text(self, processor):
        """空文本返回原文。"""
        assert processor._normalize_paragraphs("") == ""

    def test_single_line(self, processor):
        """单行文本返回原文。"""
        text = "Just one line."
        assert processor._normalize_paragraphs(text) == text


# ---------------------------------------------------------------------------
# 3. _convert_to_markdown HTML <p> 包装
# ---------------------------------------------------------------------------
class TestConvertToMarkdown:
    """验证 _convert_to_markdown 正确将段落包装为 HTML <p> 标签。"""

    def test_paragraphs_preserved_through_conversion(self, processor):
        """段落应在 Markdown 转换后保持 \\n\\n 分隔。"""
        text = (
            "First paragraph text.\n\nSecond paragraph text.\n\nThird paragraph text."
        )
        result = processor._convert_to_markdown(text)

        # Result should have paragraph separation (either from MarkItDown or fallback)
        # Count paragraphs by splitting on double newlines
        paragraphs = [p.strip() for p in result.split("\n\n") if p.strip()]
        assert len(paragraphs) >= 3

    def test_page_comments_handled(self, processor):
        """<!-- Page N --> 注释不应破坏段落结构。"""
        text = "<!-- Page 1 -->\n\nFirst paragraph.\n\nSecond paragraph."
        result = processor._convert_to_markdown(text)

        assert "First paragraph" in result
        assert "Second paragraph" in result


# ---------------------------------------------------------------------------
# 4. _simple_markdown_conversion 段落分组
# ---------------------------------------------------------------------------
class TestSimpleMarkdownConversion:
    """验证 _simple_markdown_conversion 段落分组逻辑。"""

    def test_paragraph_separation(self, processor):
        """段落间应使用 \\n\\n 分隔。"""
        text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
        result = processor._simple_markdown_conversion(text)

        parts = result.split("\n\n")
        assert len(parts) == 3
        assert "First paragraph." in parts[0]
        assert "Second paragraph." in parts[1]
        assert "Third paragraph." in parts[2]

    def test_intra_paragraph_lines_merged(self, processor):
        """段内多行应合并为单行。"""
        text = "Line one of paragraph.\nLine two of paragraph.\nLine three."
        result = processor._simple_markdown_conversion(text)

        assert "Line one of paragraph. Line two of paragraph. Line three." in result

    def test_heading_detection(self, processor):
        """大写短文本应被识别为标题。"""
        text = "ABSTRACT\n\nSome content here."
        result = processor._simple_markdown_conversion(text)

        assert "# ABSTRACT" in result
        assert "Some content here." in result
        # Heading and content separated by \n\n
        assert "# ABSTRACT\n\n" in result

    def test_page_comments_skipped(self, processor):
        """页面注释应被跳过。"""
        text = "<!-- Page 1 -->\n\nParagraph content."
        result = processor._simple_markdown_conversion(text)

        assert "<!-- Page" not in result
        assert "Paragraph content." in result

    def test_empty_paragraphs_ignored(self, processor):
        """空段落应被忽略。"""
        text = "First.\n\n\n\nSecond."
        result = processor._simple_markdown_conversion(text)

        parts = [p for p in result.split("\n\n") if p.strip()]
        assert len(parts) == 2


# ---------------------------------------------------------------------------
# 5. 学术 PDF 文本结构
# ---------------------------------------------------------------------------
class TestAcademicPDFStructure:
    """模拟学术 PDF 文本结构，验证段落分隔正确性。"""

    def test_academic_paper_structure(self, processor):
        """学术论文结构（标题/摘要/章节/正文）应正确分段。"""
        text = (
            "HIPPORAG\n\n"
            "Bernal Jiménez Gutiérrez\n\n"
            "Abstract\n\n"
            "In order to thrive in hostile environments, "
            "mammalian brains evolved to store large amounts of knowledge.\n\n"
            "1 Introduction\n\n"
            "Millions of years of evolution have led mammalian brains "
            "to develop the crucial ability to store information."
        )
        result = processor._simple_markdown_conversion(text)

        # Should have multiple paragraphs separated by \n\n
        parts = [p.strip() for p in result.split("\n\n") if p.strip()]
        assert (
            len(parts) >= 4
        )  # Title, author, abstract heading, abstract text, intro, ...

        # Verify no single-newline paragraph separations in the output
        # (all separations should be \n\n)
        for i, part in enumerate(parts):
            assert "\n" not in part or part.startswith("#"), (
                f"Paragraph {i} contains unexpected single newline: {repr(part[:80])}"
            )

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_multi_line_block_merged(self, mock_import_fitz, processor):
        """Block 内多行应合并为空格分隔的连续文本。"""
        mock_fitz = Mock()
        mock_import_fitz.return_value = mock_fitz

        mock_doc = Mock()
        mock_doc.page_count = 1
        mock_doc.metadata = {}
        mock_fitz.open.return_value = mock_doc

        # Simulate a paragraph block with multiple lines
        long_paragraph = (
            "In order to thrive in hostile and ever-changing\n"
            "natural environments, mammalian brains evolved to\n"
            "store large amounts of knowledge about the world.\n"
        )
        mock_page = Mock()
        mock_page.get_text.return_value = [
            (0, 0, 500, 30, "Abstract\n", 0, 0),
            (0, 40, 500, 120, long_paragraph, 1, 0),
        ]
        mock_doc.load_page.return_value = mock_page

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            tmp_path = Path(f.name)

        try:
            result = await processor._extract_with_pymupdf(
                tmp_path, include_metadata=False
            )
            text = result["text"]

            # Lines within the block should be merged with spaces
            assert "thrive in hostile and ever-changing natural environments" in text
            # Block separation should use \n\n
            assert "Abstract\n\n" in text
        finally:
            if tmp_path.exists():
                tmp_path.unlink()


# ---------------------------------------------------------------------------
# 6. build_html_from_text 启发式段落检测 (WebPage)
# ---------------------------------------------------------------------------
class TestBuildHtmlFromTextParagraphs:
    """验证 build_html_from_text 在缺少 \\n\\n 时使用启发式分段。"""

    def test_heuristic_split_with_sentence_endings(self):
        """句尾标点 + 大写开头应触发段落分割。"""
        text = (
            "This is the first paragraph about a topic.\n"
            "It continues on this line.\n"
            "And ends here.\n"
            "This is the second paragraph.\n"
            "It has more content."
        )
        result = _heuristic_split_paragraphs(text)

        assert len(result) >= 2
        assert "first paragraph" in result[0]

    def test_heuristic_preserves_empty_line_breaks(self):
        """空行应作为段落分隔。"""
        text = "Paragraph one.\n\nParagraph two."
        result = _heuristic_split_paragraphs(text)

        assert len(result) == 2
        assert "Paragraph one." in result[0]
        assert "Paragraph two." in result[1]

    def test_build_html_with_double_newlines(self):
        """有 \\n\\n 时正常按段落分割。"""
        text = "First paragraph.\n\nSecond paragraph."
        html = build_html_from_text(text, "Test", {})

        assert "<p>First paragraph.</p>" in html
        assert "<p>Second paragraph.</p>" in html

    def test_build_html_fallback_heuristic(self):
        """无 \\n\\n 且文本较长时，使用启发式分段。"""
        # Create long text without double newlines
        text = (
            "This is the first paragraph about a very important topic. "
            "It discusses many things in detail.\n"
            "The second paragraph starts here. "
            "It covers additional information that is relevant to the discussion.\n"
            "A third paragraph begins now. "
            "More content follows in this section of the document." + " Extra." * 20
        )
        html = build_html_from_text(text, "Test", {})

        # Should have multiple <p> tags
        p_count = html.count("<p>")
        assert p_count >= 2, f"Expected multiple paragraphs, got {p_count}"


# ---------------------------------------------------------------------------
# 7. 实际 PDF 集成测试
# ---------------------------------------------------------------------------
class TestRealPDFIntegration:
    """使用实际 PDF 文件验证端到端段落分隔。"""

    PDF_PATH = (
        Path(__file__).parent.parent.parent
        / "assets"
        / "Context Engineering 2.0 - The Context of Context Engineering.pdf"
    )

    @pytest.mark.asyncio
    async def test_pdf_paragraph_separation(self):
        """实际 PDF 提取后段落间应有 \\n\\n 分隔。"""
        if not self.PDF_PATH.exists():
            pytest.skip(f"Test PDF not found: {self.PDF_PATH}")

        processor = PDFProcessor()
        try:
            result = await processor.process_pdf(
                str(self.PDF_PATH),
                method="pymupdf",
                output_format="markdown",
                include_metadata=True,
                extract_images=False,
                extract_tables=False,
                extract_formulas=False,
            )

            assert result["success"] is True
            markdown = result["markdown"]

            # Basic quality checks
            assert len(markdown) > 1000, "Markdown output too short"

            # Count paragraphs (separated by \n\n)
            paragraphs = [p.strip() for p in markdown.split("\n\n") if p.strip()]
            assert len(paragraphs) > 20, (
                f"Expected many paragraphs, got {len(paragraphs)}. "
                f"Likely missing \\n\\n paragraph separators."
            )

            # Verify no extremely long single-line paragraphs
            # (which would indicate missing paragraph breaks)
            for i, para in enumerate(paragraphs):
                if (
                    not para.startswith("#")
                    and not para.startswith("|")
                    and not para.startswith("!")
                ):
                    assert len(para) < 3000, (
                        f"Paragraph {i} is suspiciously long ({len(para)} chars). "
                        f"May be missing internal paragraph breaks: {para[:100]}..."
                    )

            # Verify the document contains expected structural elements
            assert "Abstract" in markdown or "abstract" in markdown.lower()
            assert "Introduction" in markdown or "introduction" in markdown.lower()

        finally:
            processor.cleanup()

    @pytest.mark.asyncio
    async def test_pdf_no_single_newline_between_paragraphs(self):
        """段落间不应仅有单个 \\n 分隔（应为 \\n\\n）。"""
        if not self.PDF_PATH.exists():
            pytest.skip(f"Test PDF not found: {self.PDF_PATH}")

        processor = PDFProcessor()
        try:
            result = await processor.process_pdf(
                str(self.PDF_PATH),
                method="pymupdf",
                output_format="text",
                include_metadata=False,
                extract_images=False,
                extract_tables=False,
                extract_formulas=False,
            )

            assert result["success"] is True
            text = result["text"]

            # Split into lines and check structure
            lines = text.split("\n")
            total_lines = len(lines)
            empty_lines = sum(1 for line in lines if line.strip() == "")

            # A well-structured document should have a significant ratio of empty lines
            # (paragraph separators) to total lines
            if total_lines > 50:
                ratio = empty_lines / total_lines
                assert ratio > 0.05, (
                    f"Empty line ratio too low ({ratio:.2%}). "
                    f"Total lines: {total_lines}, empty lines: {empty_lines}. "
                    f"Paragraphs may not be properly separated with \\n\\n."
                )

        finally:
            processor.cleanup()

    @pytest.mark.asyncio
    async def test_pdf_markdown_output_quality(self):
        """验证 Markdown 输出的整体质量。"""
        if not self.PDF_PATH.exists():
            pytest.skip(f"Test PDF not found: {self.PDF_PATH}")

        processor = PDFProcessor()
        try:
            result = await processor.process_pdf(
                str(self.PDF_PATH),
                method="pymupdf",
                output_format="markdown",
                include_metadata=True,
                extract_images=False,
                extract_tables=False,
                extract_formulas=False,
            )

            assert result["success"] is True
            markdown = result["markdown"]

            # Check metadata
            assert result.get("pages_processed", 0) > 0
            assert result.get("word_count", 0) > 100

            # Verify the markdown has proper structure
            lines = markdown.split("\n")
            total_lines = len(lines)
            empty_lines = [i for i, line in enumerate(lines) if line.strip() == ""]

            assert total_lines > 50, f"Too few lines: {total_lines}"
            assert len(empty_lines) > 10, (
                f"Too few empty lines ({len(empty_lines)}). "
                f"Document likely lacks proper paragraph separation."
            )

            # Verify no consecutive non-empty lines that look like they should be
            # separate paragraphs (sentence ending + new sentence starting)
            suspicious_joins = 0
            for i in range(len(lines) - 1):
                current = lines[i].strip()
                next_line = lines[i + 1].strip()
                if (
                    current
                    and next_line
                    and current[-1] == "."
                    and next_line[0].isupper()
                    and len(current) > 50
                    and len(next_line) > 50
                ):
                    suspicious_joins += 1

            assert suspicious_joins < 5, (
                f"Found {suspicious_joins} suspicious paragraph joins "
                f"(sentences on consecutive lines that should be separate paragraphs)."
            )

        finally:
            processor.cleanup()


# ---------------------------------------------------------------------------
# 9. MarkdownFormatter 段落间距归一化 (WebPage)
# ---------------------------------------------------------------------------
class TestWebPageParagraphNormalization:
    """验证 MarkdownFormatter._normalize_paragraph_breaks 段落间距归一化逻辑。"""

    @pytest.fixture(autouse=True)
    def setup_formatter(self):
        self.formatter = MarkdownFormatter()

    def test_plain_text_paragraphs_get_double_newline(self):
        """连续纯文本行应以 \\n\\n 分隔。"""
        text = "Paragraph one.\nParagraph two."
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "Paragraph one.\n\nParagraph two."

    def test_multiple_plain_text_paragraphs(self):
        """多个连续纯文本行均应以 \\n\\n 分隔。"""
        text = "First.\nSecond.\nThird."
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "First.\n\nSecond.\n\nThird."

    def test_already_separated_paragraphs_unchanged(self):
        """已有 \\n\\n 的段落不应产生多余空行。"""
        text = "Para one.\n\nPara two."
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "Para one.\n\nPara two."

    def test_list_items_keep_single_newline(self):
        """列表项序列保持 \\n 不插入空行。"""
        text = "- Item 1\n- Item 2\n- Item 3"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "- Item 1\n- Item 2\n- Item 3"

    def test_ordered_list_items_keep_single_newline(self):
        """有序列表项序列保持 \\n。"""
        text = "1. First\n2. Second\n3. Third"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "1. First\n2. Second\n3. Third"

    def test_table_rows_keep_single_newline(self):
        """表格行序列保持 \\n。"""
        text = "| A | B |\n| --- | --- |\n| 1 | 2 |"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "| A | B |\n| --- | --- |\n| 1 | 2 |"

    def test_blockquote_lines_keep_single_newline(self):
        """引用行序列保持 \\n。"""
        text = "> Line 1\n> Line 2\n> Line 3"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "> Line 1\n> Line 2\n> Line 3"

    def test_code_block_content_untouched(self):
        """代码块内容完全不修改。"""
        text = "```\nline1\nline2\nline3\n```"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "```\nline1\nline2\nline3\n```"

    def test_tagged_code_block_untouched(self):
        """带语言标签的代码块内容不修改。"""
        text = "```python\ndef f():\n    pass\n```"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "```python\ndef f():\n    pass\n```"

    def test_transition_text_to_list(self):
        """纯文本到列表的切换应有 \\n\\n。"""
        text = "Some text.\n- Item 1\n- Item 2"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "Some text.\n\n- Item 1\n- Item 2"

    def test_transition_list_to_text(self):
        """列表到纯文本的切换应有 \\n\\n。"""
        text = "- Item 1\n- Item 2\nSome text."
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "- Item 1\n- Item 2\n\nSome text."

    def test_transition_text_to_table(self):
        """纯文本到表格的切换应有 \\n\\n。"""
        text = "Description:\n| A | B |\n| --- | --- |"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert "Description:\n\n| A | B |" in result

    def test_hr_gets_blank_lines(self):
        """HR 前后应有 \\n\\n。"""
        text = "Text above\n---\nText below"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "Text above\n\n---\n\nText below"

    def test_indented_list_continuation_preserved(self):
        """列表项缩进续行保持紧凑。"""
        text = "- Item one\n  continuation text\n- Item two"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "- Item one\n  continuation text\n- Item two"

    def test_heading_to_text_transition(self):
        """标题到文本的切换应有 \\n\\n。"""
        text = "# Title\nContent paragraph."
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "# Title\n\nContent paragraph."

    def test_text_to_heading_transition(self):
        """文本到标题的切换应有 \\n\\n。"""
        text = "Content paragraph.\n## Section"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "Content paragraph.\n\n## Section"

    def test_code_block_adjacent_text(self):
        """代码块前后与文本的分隔。"""
        text = "Text before.\n```\ncode\n```\nText after."
        result = self.formatter._normalize_paragraph_breaks(text)
        assert "Text before.\n\n```" in result
        assert "```\n\nText after." in result

    def test_empty_input(self):
        """空输入返回空字符串。"""
        assert self.formatter._normalize_paragraph_breaks("") == ""

    def test_single_line(self):
        """单行输入原样返回。"""
        assert self.formatter._normalize_paragraph_breaks("Hello") == "Hello"

    def test_codeblock_placeholder_treated_as_block(self):
        """代码块占位符视为独立块元素。"""
        text = "%%CODEBLOCK_abc123def%%\nText after."
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "%%CODEBLOCK_abc123def%%\n\nText after."

    def test_fix_spacing_disabled(self):
        """fix_spacing=False 时跳过段落归一化。"""
        formatter = MarkdownFormatter({"fix_spacing": False})
        text = "Para one.\nPara two."
        result = formatter.format(text)
        # 不应插入额外空行（归一化被跳过）
        assert "Para one.\n\nPara two." not in result

    def test_mixed_content_full_pipeline(self):
        """混合内容通过完整 format() 管线后段落正确分隔。"""
        text = (
            "# Title\n"
            "First paragraph.\n"
            "Second paragraph.\n"
            "- Item 1\n"
            "- Item 2\n"
            "Third paragraph.\n"
            "| A | B |\n"
            "| --- | --- |\n"
            "| 1 | 2 |\n"
            "Fourth paragraph."
        )
        result = self.formatter.format(text)

        # 段落间应有 \n\n
        assert "First paragraph.\n\nSecond paragraph." in result
        # 列表项保持紧凑
        assert "- Item 1\n- Item 2" in result
        # 表格行保持紧凑
        assert "| A | B |\n| --- | --- |\n| 1 | 2 |" in result

    def test_nested_blockquote_preserved(self):
        """嵌套引用行保持紧凑。"""
        text = "> > Nested line 1\n> > Nested line 2"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "> > Nested line 1\n> > Nested line 2"

    def test_transition_between_different_block_types(self):
        """不同块类型之间切换应有 \\n\\n。"""
        text = "- List item\n> Blockquote"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert result == "- List item\n\n> Blockquote"

    def test_transition_table_to_list(self):
        """表格到列表的切换应有 \\n\\n。"""
        text = "| A | B |\n| --- | --- |\n- Item"
        result = self.formatter._normalize_paragraph_breaks(text)
        assert "| --- | --- |\n\n- Item" in result


# ---------------------------------------------------------------------------
# 10. HTML→Markdown 端到端段落分隔 (WebPage)
# ---------------------------------------------------------------------------
class TestWebPageHTMLConversion:
    """验证 HTML→Markdown 端到端转换中段落正确以 \\n\\n 分隔。"""

    @pytest.fixture(autouse=True)
    def setup_converter(self):
        try:
            from negentropy.perceives.markdown.converter import MarkdownConverter

            self.converter = MarkdownConverter()
        except ImportError:
            pytest.skip("MarkItDown not available")

    def test_html_p_tags_produce_double_newline(self):
        """多个 <p> 标签应产生 \\n\\n 分隔的段落。"""
        html = (
            "<html><body><p>First paragraph.</p><p>Second paragraph.</p></body></html>"
        )
        result = self.converter.html_to_markdown(html)

        assert "First paragraph." in result
        assert "Second paragraph." in result
        # 两个段落之间应有 \n\n
        first_idx = result.index("First paragraph.")
        second_idx = result.index("Second paragraph.")
        between = result[first_idx + len("First paragraph.") : second_idx]
        assert "\n\n" in between, (
            f"Expected \\n\\n between paragraphs, got: {repr(between)}"
        )

    def test_html_mixed_elements_correct_spacing(self):
        """HTML 混合元素（标题+段落+列表）转换后间距正确。"""
        html = """
        <html><body>
            <h1>Title</h1>
            <p>First paragraph.</p>
            <p>Second paragraph.</p>
            <ul>
                <li>Item 1</li>
                <li>Item 2</li>
            </ul>
            <p>Third paragraph.</p>
        </body></html>
        """
        result = self.converter.html_to_markdown(html)

        assert "# Title" in result
        assert "First paragraph." in result
        assert "Third paragraph." in result

        # 验证段落间有 \n\n
        paragraphs = [p.strip() for p in result.split("\n\n") if p.strip()]
        assert len(paragraphs) >= 4, (
            f"Expected >=4 paragraphs, got {len(paragraphs)}: {paragraphs}"
        )

    def test_large_html_paragraph_separation(self):
        """大量 <p> 标签应全部正确分隔。"""
        html = "<html><body>"
        for i in range(20):
            html += f"<p>Paragraph {i} content.</p>"
        html += "</body></html>"

        result = self.converter.html_to_markdown(html)

        paragraphs = [p.strip() for p in result.split("\n\n") if p.strip()]
        assert len(paragraphs) >= 20, (
            f"Expected >=20 paragraphs, got {len(paragraphs)}. "
            f"Paragraphs may not be properly separated with \\n\\n."
        )

    def test_webpage_conversion_paragraph_separation(self):
        """通过 convert_webpage_to_markdown 验证段落分隔。"""
        scrape_result = {
            "url": "https://example.com",
            "title": "Test Page",
            "content": {
                "html": (
                    "<html><body>"
                    "<p>First paragraph of the article.</p>"
                    "<p>Second paragraph with more details.</p>"
                    "<p>Third paragraph concluding the article.</p>"
                    "</body></html>"
                )
            },
        }

        result = self.converter.convert_webpage_to_markdown(scrape_result)
        assert result["success"] is True
        markdown = result["markdown"]

        paragraphs = [p.strip() for p in markdown.split("\n\n") if p.strip()]
        assert len(paragraphs) >= 3, (
            f"Expected >=3 paragraphs, got {len(paragraphs)}: {paragraphs}"
        )
