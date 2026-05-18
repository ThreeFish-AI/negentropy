"""Unit tests for geometric PDF table extraction and inline placement."""

import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, patch

from negentropy.perceives.pdf.enhanced import (
    EnhancedPDFProcessor,
    ExtractedTable,
)


# ── Geometric Table Extraction Tests ─────────────────────────────────


class TestGeometricTableExtraction:
    """Tests for extract_tables_with_geometry()."""

    @pytest.fixture
    def processor(self):
        temp_dir = tempfile.mkdtemp()
        proc = EnhancedPDFProcessor(output_dir=temp_dir)
        yield proc
        proc.cleanup()
        shutil.rmtree(temp_dir, ignore_errors=True)

    def _make_mock_table(
        self,
        rows=3,
        cols=2,
        bbox=(50.0, 100.0, 500.0, 300.0),
        markdown="| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |",
        data=None,
    ):
        """Helper to build a mock PyMuPDF Table object."""
        table = Mock()
        table.row_count = rows
        table.col_count = cols
        table.bbox = bbox
        table.to_markdown.return_value = markdown
        table.header = Mock()
        table.header.cells = [(f"H{i}",) for i in range(cols)]
        table.extract.return_value = data or [
            [f"H{i}" for i in range(cols)],
            *[[f"r{r}c{c}" for c in range(cols)] for r in range(1, rows)],
        ]
        return table

    @patch("negentropy.perceives.pdf.extraction.table.fitz")
    def test_lines_strategy_finds_bordered_table(self, mock_fitz, processor):
        """Test that 'lines' strategy detects tables with visible borders."""
        mock_doc = Mock()
        mock_page = Mock()
        mock_doc.__getitem__ = Mock(return_value=mock_page)

        mock_table = self._make_mock_table()
        mock_finder = Mock()
        mock_finder.tables = [mock_table]
        mock_page.find_tables.return_value = mock_finder

        bbox_map, tables = processor.extract_tables_with_geometry(mock_doc, 0, [])

        assert len(tables) == 1
        assert tables[0].rows == 2  # Data rows excluding header
        assert tables[0].columns == 2
        assert tables[0].bbox == (50.0, 100.0, 500.0, 300.0)
        assert "| H0 | H1 |" in tables[0].markdown
        assert tables[0].bbox in bbox_map

    @patch("negentropy.perceives.pdf.extraction.table.fitz")
    def test_text_strategy_fallback_for_borderless_tables(self, mock_fitz, processor):
        """Test that 'text' strategy is used when 'lines' finds nothing."""
        mock_doc = Mock()
        mock_page = Mock()
        mock_doc.__getitem__ = Mock(return_value=mock_page)

        mock_table = self._make_mock_table(
            bbox=(60, 200, 520, 400),
            markdown="| X | Y | Z |\n|---|---|---|\n| a | b | c |",
            cols=3,
        )

        # Lines strategy returns empty, text strategy returns a table
        mock_finder_empty = Mock()
        mock_finder_empty.tables = []
        mock_finder_text = Mock()
        mock_finder_text.tables = [mock_table]

        mock_page.find_tables.side_effect = [mock_finder_empty, mock_finder_text]

        bbox_map, tables = processor.extract_tables_with_geometry(mock_doc, 0, [])

        assert len(tables) == 1
        assert mock_page.find_tables.call_count == 2
        mock_page.find_tables.assert_any_call(strategy="text")

    @patch("negentropy.perceives.pdf.extraction.table.fitz")
    def test_small_table_filtered_out(self, mock_fitz, processor):
        """Test that single-row or single-column tables are filtered."""
        mock_doc = Mock()
        mock_page = Mock()
        mock_doc.__getitem__ = Mock(return_value=mock_page)

        # 1-row table
        mock_table = self._make_mock_table(rows=1, cols=3)
        mock_finder = Mock()
        mock_finder.tables = [mock_table]
        mock_page.find_tables.return_value = mock_finder

        bbox_map, tables = processor.extract_tables_with_geometry(mock_doc, 0, [])
        assert len(tables) == 0

    @patch("negentropy.perceives.pdf.extraction.table.fitz")
    def test_empty_extract_filtered_out(self, mock_fitz, processor):
        """Test that tables producing empty extract() data are filtered."""
        mock_doc = Mock()
        mock_page = Mock()
        mock_doc.__getitem__ = Mock(return_value=mock_page)

        mock_table = self._make_mock_table(data=[])
        mock_table.extract.return_value = []
        mock_finder = Mock()
        mock_finder.tables = [mock_table]
        mock_page.find_tables.return_value = mock_finder

        bbox_map, tables = processor.extract_tables_with_geometry(mock_doc, 0, [])
        assert len(tables) == 0

    @patch("negentropy.perceives.pdf.extraction.table.fitz")
    def test_multiple_tables_on_same_page(self, mock_fitz, processor):
        """Test extraction of multiple tables from one page."""
        mock_doc = Mock()
        mock_page = Mock()
        mock_doc.__getitem__ = Mock(return_value=mock_page)

        t1 = self._make_mock_table(bbox=(50, 100, 500, 200))
        t2 = self._make_mock_table(bbox=(50, 300, 500, 450))
        mock_finder = Mock()
        mock_finder.tables = [t1, t2]
        mock_page.find_tables.return_value = mock_finder

        bbox_map, tables = processor.extract_tables_with_geometry(mock_doc, 0, [])

        assert len(tables) == 2
        assert len(bbox_map) == 2

    def test_detect_table_caption_above(self, processor):
        """Test caption detection above a table."""
        text_blocks = [
            (50, 80, 500, 95, "Table 9: Performance comparison", 1, 0),
        ]
        caption = processor._detect_table_caption(
            text_blocks, (50, 100, 500, 300), tolerance=30.0
        )
        assert caption is not None
        assert "Table 9" in caption

    def test_detect_table_caption_below(self, processor):
        """Test caption detection below a table."""
        text_blocks = [
            (50, 305, 500, 320, "Table 3: Results summary", 5, 0),
        ]
        caption = processor._detect_table_caption(
            text_blocks, (50, 100, 500, 300), tolerance=30.0
        )
        assert caption is not None
        assert "Table 3" in caption

    def test_detect_table_caption_no_match(self, processor):
        """Test that non-caption text is not mistakenly detected."""
        text_blocks = [
            (50, 80, 500, 95, "Some random paragraph text", 1, 0),
        ]
        caption = processor._detect_table_caption(
            text_blocks, (50, 100, 500, 300), tolerance=30.0
        )
        assert caption is None

    def test_detect_table_caption_too_far(self, processor):
        """Test that distant text is not detected as caption."""
        text_blocks = [
            (50, 10, 500, 25, "Table 1: Far away", 1, 0),
        ]
        caption = processor._detect_table_caption(
            text_blocks, (50, 100, 500, 300), tolerance=30.0
        )
        assert caption is None


# ── Inline Table Placement Tests ─────────────────────────────────────


class TestInlineTablePlacement:
    """Tests for inline table placement in _extract_with_pymupdf."""

    @pytest.fixture
    def pdf_processor(self):
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor()
        yield proc
        proc.cleanup()

    @pytest.mark.asyncio
    async def test_table_placed_inline_between_text(self, pdf_processor):
        """Test that tables appear at correct position between text blocks."""
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF not available")

        # Create a simple test PDF with text
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 50), "Text before the table.")
        page.insert_text((72, 350), "Text after the table.")

        tmp_path = Path(tempfile.mktemp(suffix=".pdf"))
        doc.save(str(tmp_path))
        doc.close()

        # Pre-populate table map
        table = ExtractedTable(
            id="table_0_0",
            markdown="| Constant | Value |\n|---|---|\n| X | 1 |",
            rows=2,
            columns=2,
            page_number=0,
            bbox=(50, 80, 500, 320),
        )
        pdf_processor._page_table_maps = {0: {(50, 80, 500, 320): table}}

        try:
            result = await pdf_processor._extract_with_pymupdf(
                tmp_path, include_metadata=False
            )

            assert result["success"] is True
            text = result["text"]

            assert "Text before the table." in text
            assert "| Constant | Value |" in text
            assert "Text after the table." in text

            # Verify order
            before_pos = text.index("Text before the table.")
            table_pos = text.index("| Constant | Value |")
            after_pos = text.index("Text after the table.")
            assert before_pos < table_pos < after_pos

        finally:
            if tmp_path.exists():
                tmp_path.unlink()
            pdf_processor._page_table_maps.clear()

    @pytest.mark.asyncio
    async def test_table_suppresses_overlapping_text(self, pdf_processor):
        """Test that text blocks overlapping table bbox are suppressed."""
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF not available")

        doc = fitz.open()
        page = doc.new_page()
        # This text will overlap with the table bbox
        page.insert_text((72, 120), "Cell content that should be suppressed")
        page.insert_text((72, 400), "Non-overlapping text")

        tmp_path = Path(tempfile.mktemp(suffix=".pdf"))
        doc.save(str(tmp_path))
        doc.close()

        table = ExtractedTable(
            id="table_0_0",
            markdown="| A | B |\n|---|---|\n| 1 | 2 |",
            rows=2,
            columns=2,
            page_number=0,
            bbox=(50, 80, 550, 350),
        )
        pdf_processor._page_table_maps = {0: {(50, 80, 550, 350): table}}

        try:
            result = await pdf_processor._extract_with_pymupdf(
                tmp_path, include_metadata=False
            )

            text = result["text"]
            assert "| A | B |" in text
            assert "Non-overlapping text" in text
            # Overlapping text should be suppressed
            assert "Cell content that should be suppressed" not in text

        finally:
            if tmp_path.exists():
                tmp_path.unlink()
            pdf_processor._page_table_maps.clear()


# ── Table Dedup in enhance_markdown_with_assets ──────────────────────


class TestTableDedup:
    """Test that inline tables are not duplicated in Extracted Tables section."""

    @pytest.fixture
    def processor(self):
        temp_dir = tempfile.mkdtemp()
        proc = EnhancedPDFProcessor(output_dir=temp_dir)
        yield proc
        proc.cleanup()
        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_inline_tables_not_duplicated(self, processor):
        """Tables already in markdown should not appear in Extracted Tables."""
        original = "# Doc\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nMore text."
        processor.tables = [
            ExtractedTable(
                id="t1",
                markdown="| A | B |\n|---|---|\n| 1 | 2 |",
                rows=2,
                columns=2,
                page_number=0,
            )
        ]

        result = processor.enhance_markdown_with_assets(original)
        assert "## Extracted Tables" not in result

    def test_unplaced_tables_still_appended(self, processor):
        """Tables NOT in markdown should be appended."""
        original = "# Doc\n\nSome text."
        processor.tables = [
            ExtractedTable(
                id="t1",
                markdown="| X | Y |\n|---|---|\n| a | b |",
                rows=2,
                columns=2,
                page_number=0,
            )
        ]

        result = processor.enhance_markdown_with_assets(original)
        assert "## Extracted Tables" in result
        assert "| X | Y |" in result


# ── Markdown Conversion Table Preservation ───────────────────────────


class TestMarkdownTablePreservation:
    """Test that inline tables survive the _convert_to_markdown pass."""

    @pytest.fixture
    def pdf_processor(self):
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor()
        yield proc
        proc.cleanup()

    def test_convert_to_markdown_preserves_table(self, pdf_processor):
        """Tables starting with | should not be wrapped in <p>."""
        text_with_table = (
            "<!-- Page 1 -->\n\n"
            "Intro paragraph.\n\n"
            "| Constant | Value |\n|---|---|\n| X | 1 |\n\n"
            "Conclusion."
        )
        result = pdf_processor._convert_to_markdown(text_with_table)
        assert "| Constant | Value |" in result

    def test_simple_conversion_preserves_table(self, pdf_processor):
        """Tables should be preserved in simple fallback conversion."""
        text_with_table = (
            "Intro paragraph.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nEnd text."
        )
        result = pdf_processor._simple_markdown_conversion(text_with_table)
        assert "| A | B |" in result

    def test_captioned_table_preserved(self, pdf_processor):
        """Tables with caption (** prefix) should be preserved."""
        text_with_table = (
            "Intro.\n\n"
            "**Table 9: Constants**\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n"
            "End."
        )
        result = pdf_processor._simple_markdown_conversion(text_with_table)
        assert "**Table 9: Constants**" in result
        assert "| A | B |" in result


# ── Web Fallback Table Preservation ──────────────────────────────────


class TestWebFallbackTablePreservation:
    """Test that HTML tables survive the fallback conversion path."""

    def test_fallback_preserves_table_structure(self):
        """Test that fallback_html_conversion preserves HTML tables."""
        from negentropy.perceives.markdown.html_preprocessor import (
            fallback_html_conversion,
        )

        html = """
        <html><body>
            <p>Some text before</p>
            <table>
                <tr><th>Name</th><th>Age</th></tr>
                <tr><td>Alice</td><td>30</td></tr>
                <tr><td>Bob</td><td>25</td></tr>
            </table>
            <p>Some text after</p>
        </body></html>
        """
        result = fallback_html_conversion(html)
        assert "| Name | Age |" in result
        assert "| Alice | 30 |" in result
        assert "| Bob | 25 |" in result
        assert "Some text before" in result
        assert "Some text after" in result

    def test_fallback_handles_single_row_table(self):
        """Tables with only a header row should be skipped gracefully."""
        from negentropy.perceives.markdown.html_preprocessor import (
            fallback_html_conversion,
        )

        html = """
        <html><body>
            <table><tr><th>Only Header</th></tr></table>
            <p>Content</p>
        </body></html>
        """
        result = fallback_html_conversion(html)
        assert "Content" in result

    def test_html_table_to_markdown_helper(self):
        """Test the _html_table_to_markdown helper function."""
        from bs4 import BeautifulSoup
        from negentropy.perceives.markdown.html_preprocessor import (
            _html_table_to_markdown,
        )

        html = """
        <table>
            <tr><th>Col1</th><th>Col2</th></tr>
            <tr><td>val1</td><td>val2</td></tr>
        </table>
        """
        soup = BeautifulSoup(html, "html.parser")
        table_tag = soup.find("table")
        result = _html_table_to_markdown(table_tag)

        assert result is not None
        assert "| Col1 | Col2 |" in result
        assert "| --- | --- |" in result
        assert "| val1 | val2 |" in result

    def test_html_table_pipe_escaping(self):
        """Test that pipe characters in cell content are escaped."""
        from bs4 import BeautifulSoup
        from negentropy.perceives.markdown.html_preprocessor import (
            _html_table_to_markdown,
        )

        html = """
        <table>
            <tr><th>Formula</th><th>Result</th></tr>
            <tr><td>a | b</td><td>true</td></tr>
        </table>
        """
        soup = BeautifulSoup(html, "html.parser")
        table_tag = soup.find("table")
        result = _html_table_to_markdown(table_tag)

        assert result is not None
        assert "a \\| b" in result


# ── Integration Test with Real PDF ───────────────────────────────────


PDF_PATH = Path(__file__).parent.parent.parent / "assets" / "2603.05344v3.pdf"


@pytest.mark.slow
@pytest.mark.integration
class TestRealPDFTableExtraction:
    """Integration tests using the real 2603.05344v3.pdf."""

    @pytest.fixture
    def processor(self):
        temp_dir = tempfile.mkdtemp()
        proc = EnhancedPDFProcessor(output_dir=temp_dir)
        yield proc
        proc.cleanup()
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.mark.skipif(not PDF_PATH.exists(), reason="PDF asset not available")
    def test_table9_detected_geometrically(self, processor):
        """Table 9 (page ~81) should be detected by geometric extraction."""
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF not available")

        doc = fitz.open(str(PDF_PATH))
        # Table 9 is on page 81 (0-indexed: 80)
        page_num = 80
        if page_num >= len(doc):
            pytest.skip("PDF does not have enough pages")

        page = doc[page_num]
        blocks = page.get_text("blocks")

        bbox_map, tables = processor.extract_tables_with_geometry(doc, page_num, blocks)
        doc.close()

        assert len(tables) >= 1, "Should detect at least one table on page 81"

        # Find table with 'Constant' column (Table 9)
        table9 = None
        for t in tables:
            md_lower = t.markdown.lower()
            if "constant" in md_lower or "compaction" in md_lower:
                table9 = t
                break

        assert table9 is not None, (
            f"Table 9 should contain 'Constant' or 'Compaction'. "
            f"Found tables: {[t.markdown[:100] for t in tables]}"
        )

        # Should have 3 columns: Constant, Value, Rationale
        assert table9.columns == 3, (
            f"Table 9 should have 3 columns, got {table9.columns}"
        )

    @pytest.mark.skipif(not PDF_PATH.exists(), reason="PDF asset not available")
    def test_table9_has_markdown_structure(self, processor):
        """Table 9 markdown output should have proper pipe-separated rows."""
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF not available")

        doc = fitz.open(str(PDF_PATH))
        page_num = 80
        if page_num >= len(doc):
            pytest.skip("PDF does not have enough pages")

        page = doc[page_num]
        blocks = page.get_text("blocks")

        bbox_map, tables = processor.extract_tables_with_geometry(doc, page_num, blocks)
        doc.close()

        # Find Table 9
        table9 = None
        for t in tables:
            if "constant" in t.markdown.lower():
                table9 = t
                break
        assert table9 is not None

        md = table9.markdown

        # Must have pipe-separated rows
        md_lines = [line for line in md.split("\n") if line.strip()]
        for line in md_lines:
            assert "|" in line, f"Table row missing pipe separator: {line}"

        # Must have separator row
        assert any("---" in line for line in md_lines), (
            "Table should have a separator row with ---"
        )

        # Should contain key data values
        assert "compaction" in md.lower()
        assert "50 ops" in md or "50" in md

    @pytest.mark.skipif(not PDF_PATH.exists(), reason="PDF asset not available")
    @pytest.mark.asyncio
    async def test_end_to_end_pdf_table_extraction(self):
        """End-to-end: process PDF and verify Table 9 appears inline."""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor()
        try:
            result = await proc.process_pdf(
                str(PDF_PATH),
                page_range=[80, 82],
                output_format="markdown",
            )

            assert result["success"] is True
            md = result.get("markdown", "")

            # Table 9 should appear as a proper markdown table
            assert "|" in md, "Markdown should contain table pipe separators"

            # Should not be a continuous text blob
            lines = md.split("\n")
            pipe_lines = [line for line in lines if line.strip().startswith("|")]
            assert len(pipe_lines) >= 3, (
                f"Expected at least 3 table rows, found {len(pipe_lines)}"
            )

        finally:
            proc.cleanup()

    @pytest.mark.skipif(not PDF_PATH.exists(), reason="PDF asset not available")
    def test_multiple_tables_detected_across_pages(self, processor):
        """Verify that tables across multiple pages are all detected."""
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF not available")

        doc = fitz.open(str(PDF_PATH))
        total_tables = 0

        # Scan a range of pages for tables
        for page_num in range(min(len(doc), 90)):
            page = doc[page_num]
            blocks = page.get_text("blocks")
            bbox_map, tables = processor.extract_tables_with_geometry(
                doc, page_num, blocks
            )
            total_tables += len(tables)

        doc.close()

        assert total_tables >= 1, "Should find at least one table in the PDF"
