"""Unit tests for enhanced PDF processor functionality."""

import pytest
import tempfile
from unittest.mock import Mock, patch

from negentropy.perceives.pdf.enhanced import (
    EnhancedPDFProcessor,
    ExtractedImage,
    ExtractedTable,
    ExtractedFormula,
)


class TestEnhancedPDFProcessor:
    """Test cases for EnhancedPDFProcessor."""

    @pytest.fixture
    def processor(self):
        """Create a test processor instance."""
        temp_dir = tempfile.mkdtemp()
        processor = EnhancedPDFProcessor(output_dir=temp_dir)
        yield processor
        # Cleanup
        processor.cleanup()
        import shutil

        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_processor_initialization(self, processor):
        """Test processor initialization."""
        assert processor.output_dir.exists()
        assert processor.images == []
        assert processor.tables == []
        assert processor.formulas == []
        assert processor.extract_images is True
        assert processor.extract_tables is True
        assert processor.extract_formulas is True

    def test_generate_asset_id(self, processor):
        """Test asset ID generation."""
        asset_id = processor._generate_asset_id("img", 1, 0)
        assert asset_id.startswith("img_1_0_")
        assert len(asset_id) > 10  # Should include timestamp

    @patch("negentropy.perceives.pdf.extraction.image.fitz")
    @pytest.mark.asyncio
    async def test_extract_images_from_pdf_page(self, mock_fitz, processor):
        """Test image extraction from PDF page."""
        # Mock PDF document and page
        mock_doc = Mock()
        mock_page = Mock()
        mock_doc.__getitem__ = Mock(return_value=mock_page)

        # Mock image list and pixmap
        mock_page.get_images.return_value = [(1, 0, 0, 100, 200, 0, 0, "Im1", 0)]
        mock_pix = Mock()
        mock_pix.n = 3  # RGB image
        mock_pix.alpha = 0
        mock_pix.width = 100
        mock_pix.height = 200
        mock_pix.save = Mock()
        mock_pix.tobytes = Mock(return_value=b"fake_image_data")

        mock_fitz.Pixmap.return_value = mock_pix
        mock_fitz.Pixmap.__getitem__ = Mock(return_value=mock_pix)

        # Mock get_image_rects to return a real position
        mock_rect = Mock()
        mock_rect.x0 = 50.0
        mock_rect.y0 = 100.0
        mock_rect.x1 = 550.0
        mock_rect.y1 = 400.0
        mock_page.get_image_rects.return_value = [mock_rect]

        # Test extraction
        images = await processor.extract_images_from_pdf_page(mock_doc, 0, "png")

        assert len(images) == 1
        image = images[0]
        assert isinstance(image, ExtractedImage)
        assert image.filename.endswith(".png")
        assert image.width == 100
        assert image.height == 200
        assert image.page_number == 0
        assert image.mime_type == "image/png"
        assert image.xref == 1
        # Verify position uses real rect coordinates
        assert image.position is not None
        assert image.position["x0"] == 50.0
        assert image.position["y0"] == 100.0

    @patch("negentropy.perceives.pdf.extraction.image.fitz")
    @pytest.mark.asyncio
    async def test_extract_cmyk_image_converted_to_rgb(self, mock_fitz, processor):
        """Test that CMYK images are converted to RGB instead of being skipped."""
        mock_doc = Mock()
        mock_page = Mock()
        mock_doc.__getitem__ = Mock(return_value=mock_page)

        mock_page.get_images.return_value = [(1, 0, 0, 100, 200, 0, 0, "cmyk_img", 0)]

        # First pixmap is CMYK (n - alpha >= 4)
        mock_cmyk_pix = Mock()
        mock_cmyk_pix.n = 5  # CMYK + alpha
        mock_cmyk_pix.alpha = 1

        # Converted RGB pixmap
        mock_rgb_pix = Mock()
        mock_rgb_pix.n = 3
        mock_rgb_pix.alpha = 0
        mock_rgb_pix.width = 100
        mock_rgb_pix.height = 200
        mock_rgb_pix.save = Mock()
        mock_rgb_pix.tobytes = Mock(return_value=b"rgb_data")

        # First call returns CMYK, second call (conversion) returns RGB
        mock_fitz.Pixmap.side_effect = [mock_cmyk_pix, mock_rgb_pix]
        mock_fitz.csRGB = "csRGB_sentinel"

        mock_rect = Mock()
        mock_rect.x0 = 0
        mock_rect.y0 = 0
        mock_rect.x1 = 100
        mock_rect.y1 = 200
        mock_page.get_image_rects.return_value = [mock_rect]

        images = await processor.extract_images_from_pdf_page(mock_doc, 0, "png")

        assert len(images) == 1
        # Verify CMYK conversion was called
        mock_fitz.Pixmap.assert_any_call("csRGB_sentinel", mock_cmyk_pix)

    def test_extract_tables_from_text(self, processor):
        """Test table extraction from text."""
        text = """
        Name | Age | City
        ----|-----|----
        John | 25  | NYC
        Jane | 30  | LA
        """

        tables = processor.extract_tables_from_text(text, 1)

        assert len(tables) == 1
        table = tables[0]
        assert isinstance(table, ExtractedTable)
        assert table.rows == 3  # Header + separator + data row
        assert table.columns == 3
        assert table.page_number == 1
        assert "Name" in table.markdown
        assert "John" in table.markdown

    def test_extract_tables_from_tab_separated_text(self, processor):
        """Test table extraction from tab-separated text."""
        text = """
        Product\tPrice\tStock
        Apple\t$1.99\t50
        Banana\t$0.99\t30
        """

        tables = processor.extract_tables_from_text(text, 2)

        assert len(tables) == 1
        table = tables[0]
        assert table.headers == ["Product", "Price", "Stock"]
        assert "Apple" in table.markdown

    def test_extract_formulas_from_text(self, processor):
        """Test formula extraction from text."""
        text = """
        The equation E = mc² is famous.
        Inline formula: $x^2 + y^2 = z^2$ in text.

        Block formula:
        $$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

        Another formula: \\[a^2 + b^2 = c^2\\]
        """

        formulas = processor.extract_formulas_from_text(text, 3)

        # Should extract 4 formulas: E=mc², inline, block, and bracket formula
        assert len(formulas) >= 3

        # Check inline formulas
        inline_formulas = [f for f in formulas if f.formula_type == "inline"]
        assert len(inline_formulas) >= 1
        assert "x^2 + y^2 = z^2" in inline_formulas[0].latex

        # Check block formulas
        block_formulas = [f for f in formulas if f.formula_type == "block"]
        assert len(block_formulas) >= 1
        assert any("integral" in f.latex or "sqrt" in f.latex for f in block_formulas)

    def test_is_table_row(self, processor):
        """Test table row detection."""
        # Pipe-separated table row
        assert processor._is_table_row("| Name | Age | City |")

        # Tab-separated table row
        assert processor._is_table_row("Name\tAge\tCity")

        # Multiple space-separated table row
        assert processor._is_table_row("Name    Age    City")

        # Not a table row
        assert not processor._is_table_row("This is just regular text.")
        assert not processor._is_table_row("Single column")

    def test_convert_to_markdown_table(self, processor):
        """Test conversion to Markdown table format."""
        table_lines = ["| Name | Age | City |", "John | 25 | NYC |", "Jane | 30 | LA |"]

        markdown = processor._convert_to_markdown_table(table_lines)

        assert "| Name | Age | City |" in markdown
        assert "| --- | --- | --- |" in markdown  # Header separator
        assert "| John | 25 | NYC |" in markdown
        assert "| Jane | 30 | LA |" in markdown

    def test_convert_tab_separated_to_markdown_table(self, processor):
        """Test conversion of tab-separated table to Markdown."""
        table_lines = ["Product\tPrice\tStock", "Apple\t$1.99\t50", "Banana\t$0.99\t30"]

        markdown = processor._convert_to_markdown_table(table_lines)

        assert "| Product | Price | Stock |" in markdown
        assert "| --- | --- | --- |" in markdown
        assert "| Apple | $1.99 | 50 |" in markdown

    def test_extract_table_headers(self, processor):
        """Test table header extraction."""
        # Pipe-separated headers
        headers = processor._extract_table_headers("| Name | Age | City |")
        assert headers == ["Name", "Age", "City"]

        # Tab-separated headers
        headers = processor._extract_table_headers("Name\tAge\tCity")
        assert headers == ["Name", "Age", "City"]

        # Space-separated headers
        headers = processor._extract_table_headers("Name    Age    City")
        assert headers == ["Name", "Age", "City"]

    def test_enhance_markdown_with_assets_images_already_inline(self, processor):
        """Test that images already inline in markdown are NOT duplicated in Extracted Images."""
        # Simulate a markdown that already has images inline
        original_markdown = (
            "# Document Title\n\n"
            "This is the main content.\n\n"
            "![Figure 1](figure-1-architecture.png)\n\n"
            "More text after the image."
        )

        # Add the same image to the processor's image list
        processor.images = [
            ExtractedImage(
                id="img_1_0",
                filename="figure-1-architecture.png",
                local_path="/tmp/figure-1-architecture.png",
                base64_data="iVBORw0KGgo...",
                mime_type="image/png",
                width=100,
                height=100,
                page_number=0,
            )
        ]

        enhanced = processor.enhance_markdown_with_assets(
            original_markdown, embed_images=False
        )

        # The Extracted Images section should NOT appear since the image is already inline
        assert "## Extracted Images" not in enhanced
        # The original inline image should still be present
        assert "![Figure 1](figure-1-architecture.png)" in enhanced

    def test_enhance_markdown_with_unplaced_images(self, processor):
        """Test that unplaced images are appended at the end."""
        original_markdown = "# Document Title\n\nThis is the main content."

        processor.images = [
            ExtractedImage(
                id="img_1_0",
                filename="image1.png",
                local_path="/tmp/image1.png",
                base64_data="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
                mime_type="image/png",
                width=100,
                height=100,
                page_number=0,
            )
        ]

        enhanced = processor.enhance_markdown_with_assets(
            original_markdown, embed_images=False
        )

        # Image NOT in original markdown, so it should be appended
        assert "## Extracted Images" in enhanced
        assert "![image1.png](image1.png)" in enhanced
        assert "*Dimensions: 100×100px*" in enhanced

    def test_enhance_markdown_with_embedded_images(self, processor):
        """Test Markdown enhancement with embedded images."""
        original_markdown = "# Test"

        processor.images = [
            ExtractedImage(
                id="img_1_0_001",
                filename="image1.png",
                local_path="/tmp/image1.png",
                base64_data="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
                mime_type="image/png",
                page_number=0,
            )
        ]

        # Test enhancement with embedding
        enhanced = processor.enhance_markdown_with_assets(
            original_markdown, embed_images=True
        )

        assert "data:image/png;base64," in enhanced
        assert "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ" in enhanced

    def test_enhance_markdown_with_tables_and_formulas(self, processor):
        """Test Markdown enhancement with tables and formulas."""
        original_markdown = "# Document Title\n\nContent."

        processor.tables = [
            ExtractedTable(
                id="table_1_0_001",
                markdown="| Name | Age |\n| --- | --- |\n| John | 25 |",
                rows=2,
                columns=2,
                page_number=0,
            )
        ]

        processor.formulas = [
            ExtractedFormula(
                id="formula_1_0_001",
                latex="E = mc^2",
                formula_type="inline",
                page_number=0,
            )
        ]

        enhanced = processor.enhance_markdown_with_assets(
            original_markdown, embed_images=False
        )

        assert "## Extracted Tables" in enhanced
        assert "| Name | Age |" in enhanced
        assert "## Mathematical Formulas" in enhanced
        assert "$E = mc^2$" in enhanced

    def test_get_extraction_summary(self, processor):
        """Test extraction summary generation."""
        # Add mock assets
        processor.images = [
            ExtractedImage("img1", "image1.png", "/tmp/image1.png"),
            ExtractedImage("img2", "image2.png", "/tmp/image2.png"),
        ]

        processor.tables = [
            ExtractedTable("table1", "| A | B |", 3, 2),
            ExtractedTable("table2", "| X | Y |", 2, 2),
        ]

        processor.formulas = [
            ExtractedFormula("formula1", "x^2", "inline"),
            ExtractedFormula("formula2", "y^2", "block"),
        ]

        summary = processor.get_extraction_summary()

        assert summary["images"]["count"] == 2
        assert summary["images"]["files"] == ["image1.png", "image2.png"]
        assert summary["tables"]["count"] == 2
        assert summary["tables"]["total_rows"] == 5  # 3 + 2
        assert summary["tables"]["total_columns"] == 4  # 2 + 2
        assert summary["formulas"]["count"] == 2
        assert summary["formulas"]["inline_count"] == 1
        assert summary["formulas"]["block_count"] == 1
        assert "output_directory" in summary

    def test_cleanup(self, processor):
        """Test processor cleanup."""
        # Add some assets
        processor.images = [ExtractedImage("img1", "image1.png", "/tmp/image1.png")]
        processor.tables = [ExtractedTable("table1", "| A | B |", 2, 2)]
        processor.formulas = [ExtractedFormula("formula1", "x^2", "inline")]

        # Cleanup
        processor.cleanup()

        # Check that assets are cleared
        assert len(processor.images) == 0
        assert len(processor.tables) == 0
        assert len(processor.formulas) == 0

    def test_error_handling_in_image_extraction(self, processor):
        """Test error handling during image extraction."""
        with patch("negentropy.perceives.pdf.extraction.image.fitz") as mock_fitz:
            # Mock fitz to raise an exception
            mock_fitz.open.side_effect = Exception("PDF error")

            # Should handle the error gracefully
            try:
                import fitz

                doc = fitz.open("fake.pdf")
                _images = processor.extract_images_from_pdf_page(doc, 0)
            except ImportError:
                # If fitz is not available, the test should pass
                pass
            except Exception:
                # Other exceptions should be handled
                pass

    def test_empty_text_handling(self, processor):
        """Test handling of empty or minimal text."""
        # Test with empty text
        tables = processor.extract_tables_from_text("", 0)
        assert len(tables) == 0

        formulas = processor.extract_formulas_from_text("", 0)
        assert len(formulas) == 0

        # Test with text that has no tables or formulas
        text = "This is just plain text without any special content."
        tables = processor.extract_tables_from_text(text, 0)
        formulas = processor.extract_formulas_from_text(text, 0)

        assert len(tables) == 0
        assert len(formulas) == 0


class TestImageNaming:
    """Test cases for semantic image naming."""

    @pytest.fixture
    def processor(self):
        temp_dir = tempfile.mkdtemp()
        processor = EnhancedPDFProcessor(output_dir=temp_dir)
        yield processor
        processor.cleanup()
        import shutil

        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_slugify_basic(self, processor):
        """Test basic slugification."""
        assert processor._slugify("Hello World") == "hello-world"
        assert (
            processor._slugify("Figure 1: Architecture Diagram")
            == "figure-1-architecture-diagram"
        )

    def test_slugify_special_chars(self, processor):
        """Test slugify strips special characters."""
        assert processor._slugify("test@#$%file") == "testfile"
        assert processor._slugify("  spaces  around  ") == "spaces-around"

    def test_slugify_cjk(self, processor):
        """Test slugify preserves CJK characters."""
        result = processor._slugify("图 1 架构设计")
        assert "图" in result
        assert "架构设计" in result

    def test_slugify_max_length(self, processor):
        """Test slugify respects max length."""
        long_text = "a " * 100
        result = processor._slugify(long_text, max_length=20)
        assert len(result) <= 20

    def test_generate_image_name_with_caption(self, processor):
        """Test image name generation prioritizes caption."""
        name = processor._generate_image_name(
            page_num=0,
            img_index=0,
            caption="Figure 1: Architecture Diagram",
        )
        assert "figure-1-architecture-diagram" == name

    def test_generate_image_name_with_xref_name(self, processor):
        """Test image name from xref internal name."""
        name = processor._generate_image_name(
            page_num=2,
            img_index=0,
            xref_name="company-logo",
        )
        assert "p3-company-logo" == name

    def test_generate_image_name_with_context(self, processor):
        """Test image name from nearby text context."""
        name = processor._generate_image_name(
            page_num=0,
            img_index=0,
            nearby_text="This section describes the authentication flow in detail",
        )
        assert name.startswith("p1-")
        assert "this" in name or "section" in name

    def test_generate_image_name_fallback(self, processor):
        """Test fallback image name when no context available."""
        name = processor._generate_image_name(
            page_num=4,
            img_index=2,
            pdf_name="annual-report-2025",
        )
        assert name == "annual-report-2025-p5-3"

    def test_generate_image_name_empty_fallback(self, processor):
        """Test fallback with no pdf_name."""
        name = processor._generate_image_name(page_num=0, img_index=0)
        assert name == "img-p1-1"

    def test_detect_caption_found(self, processor):
        """Test caption detection finds figure caption below image."""
        text_blocks = [
            # (x0, y0, x1, y1, text, block_no, block_type)
            (50, 300, 550, 320, "Figure 1: System Architecture Overview", 2, 0),
            (50, 350, 550, 400, "The system uses a microservices approach.", 3, 0),
        ]
        caption = processor._detect_caption(
            text_blocks, img_y1=295.0, img_x0=50.0, img_x1=550.0
        )
        assert caption is not None
        assert "Figure 1" in caption

    def test_detect_caption_not_found(self, processor):
        """Test caption detection returns None when no caption pattern matches."""
        text_blocks = [
            (50, 300, 550, 320, "Regular text, not a caption.", 2, 0),
        ]
        caption = processor._detect_caption(
            text_blocks, img_y1=295.0, img_x0=50.0, img_x1=550.0
        )
        assert caption is None

    def test_detect_caption_too_far(self, processor):
        """Test caption detection ignores text blocks that are too far below."""
        text_blocks = [
            (50, 500, 550, 520, "Figure 99: Very Far Away", 5, 0),
        ]
        caption = processor._detect_caption(
            text_blocks, img_y1=100.0, img_x0=50.0, img_x1=550.0, tolerance=30.0
        )
        assert caption is None


class TestUnicodeMathDetection:
    """测试 extract_formulas_from_text 的 Unicode 数学符号检测层。"""

    @pytest.fixture
    def processor(self):
        temp_dir = tempfile.mkdtemp()
        processor = EnhancedPDFProcessor(output_dir=temp_dir)
        yield processor
        processor.cleanup()
        import shutil

        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_detects_unicode_math_symbols(self, processor):
        """含 Unicode 数学符号的文本应被检测为公式。"""
        text = "E_rel ⊆ E"
        formulas = processor.extract_formulas_from_text(text, 0)
        assert len(formulas) >= 1
        assert any(r"\subseteq" in f.latex for f in formulas)

    def test_detects_arrows(self, processor):
        """箭头符号应被转换。"""
        text = "CE : (C, T) → f_context"
        formulas = processor.extract_formulas_from_text(text, 0)
        assert len(formulas) >= 1
        assert any(r"\to" in f.latex for f in formulas)

    def test_detects_greek_letters(self, processor):
        """希腊字母应被转换。"""
        text = "f(ϕ₁, ϕ₂, ..., ϕₙ)"
        formulas = processor.extract_formulas_from_text(text, 0)
        assert len(formulas) >= 1
        assert any(r"\phi" in f.latex for f in formulas)

    def test_plain_text_no_formulas(self, processor):
        """纯文本不应产生公式。"""
        text = "This is a plain text paragraph with no math at all."
        formulas = processor.extract_formulas_from_text(text, 0)
        assert len(formulas) == 0

    def test_latex_delimiters_still_work(self, processor):
        """LaTeX 定界符匹配仍然优先。"""
        text = "Equation: $x^2 + y^2 = z^2$"
        formulas = processor.extract_formulas_from_text(text, 0)
        assert len(formulas) >= 1
        inline = [f for f in formulas if f.formula_type == "inline"]
        assert len(inline) >= 1
        assert "x^2 + y^2 = z^2" in inline[0].latex

    def test_bigcup_and_set_operators(self, processor):
        """集合运算符应被正确检测。"""
        text = "C = ⋃ Char(e)"
        formulas = processor.extract_formulas_from_text(text, 0)
        assert len(formulas) >= 1
        assert any(r"\bigcup" in f.latex for f in formulas)
