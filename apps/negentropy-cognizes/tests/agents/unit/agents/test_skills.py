"""Tests for the SkillInvoker class in agents.claude.skills module."""

import os
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from cognizes.agents.claude.skills import SkillInvoker


class TestSkillInvoker:
    """Test cases for the SkillInvoker class."""

    @pytest.fixture
    def mock_anthropic_client(self):
        """Create a mock Anthropic client."""
        mock_client = MagicMock()
        mock_client.messages = AsyncMock()
        mock_client.messages.create = AsyncMock()
        return mock_client

    @pytest.fixture
    def skill_invoker_with_api_key(self, mock_anthropic_client):
        """Create a SkillInvoker instance with API key."""
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            with patch(
                "cognizes.agents.claude.skills.anthropic.Anthropic",
                return_value=mock_anthropic_client,
            ):
                return SkillInvoker()

    @pytest.fixture
    def skill_invoker_with_api_key_and_base_url(self, mock_anthropic_client):
        """Create a SkillInvoker instance with API key and base URL."""
        with patch.dict(
            os.environ,
            {
                "ANTHROPIC_API_KEY": "test-key",
                "ANTHROPIC_BASE_URL": "https://test.api.example.com",
            },
        ):
            with patch(
                "cognizes.agents.claude.skills.anthropic.Anthropic",
                return_value=mock_anthropic_client,
            ) as mock_anthropic_class:
                return SkillInvoker(), mock_anthropic_class

    @pytest.fixture
    def skill_invoker_no_api_key(self):
        """Create a SkillInvoker instance without API key."""
        with patch.dict(os.environ, {}, clear=True):
            return SkillInvoker()

    def test_init_with_api_key(self, skill_invoker_with_api_key):
        """Test SkillInvoker initialization with API key."""
        invoker = skill_invoker_with_api_key
        assert invoker.anthropic_client is not None
        assert len(invoker.skill_registry) == 7
        assert "pdf-reader" in invoker.skill_registry
        assert "web-translator" in invoker.skill_registry
        assert "zh-translator" in invoker.skill_registry
        assert "doc-translator" in invoker.skill_registry
        assert "markdown-formatter" in invoker.skill_registry
        assert "heartfelt" in invoker.skill_registry
        assert "batch-processor" in invoker.skill_registry

    def test_init_without_api_key(self, skill_invoker_no_api_key):
        """Test SkillInvoker initialization without API key."""
        invoker = skill_invoker_no_api_key
        assert invoker.anthropic_client is None
        assert len(invoker.skill_registry) == 7

    def test_init_with_api_key_and_base_url(self, skill_invoker_with_api_key_and_base_url):
        """Test SkillInvoker initialization with API key and base URL."""
        invoker, mock_anthropic_class = skill_invoker_with_api_key_and_base_url
        assert invoker.anthropic_client is not None
        # Verify that Anthropic was called with both api_key and base_url
        mock_anthropic_class.assert_called_once_with(api_key="test-key", base_url="https://test.api.example.com")
        assert len(invoker.skill_registry) == 7

    async def test_call_skill_success(self, skill_invoker_with_api_key):
        """Test successful skill call."""
        invoker = skill_invoker_with_api_key

        # Mock the PDF handler at registry level
        mock_handler = AsyncMock()
        mock_handler.return_value = {"success": True, "data": {"content": "test data"}}

        with patch.dict(invoker.skill_registry, {"pdf-reader": mock_handler}):
            result = await invoker.call_skill("pdf-reader", {"file_path": "test.pdf"})

            assert result["success"] is True
            assert result["data"]["content"] == "test data"
            mock_handler.assert_called_once_with({"file_path": "test.pdf"})

    async def test_call_skill_unknown_skill(self, skill_invoker_no_api_key):
        """Test calling an unknown skill."""
        invoker = skill_invoker_no_api_key

        result = await invoker.call_skill("unknown-skill", {})

        assert result["success"] is False
        assert "Unknown skill: unknown-skill" in result["error"]
        assert result["error_type"] == "SkillNotFoundError"

    async def test_call_skill_exception_handling(self, skill_invoker_no_api_key):
        """Test exception handling in call_skill."""
        invoker = skill_invoker_no_api_key

        # Mock a handler that raises an exception
        mock_handler = AsyncMock()
        mock_handler.side_effect = ValueError("Test error")

        with patch.dict(invoker.skill_registry, {"pdf-reader": mock_handler}):
            result = await invoker.call_skill("pdf-reader", {})

            assert result["success"] is False
            assert "Test error" in result["error"]
            assert result["error_type"] == "ValueError"

    @pytest.mark.asyncio
    async def test_handle_pdf_reader_with_file(self, skill_invoker_no_api_key):
        """Test PDF reader skill with local file."""
        invoker = skill_invoker_no_api_key

        # Create a temporary PDF file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(b"%PDF-1.4 test content")
            tmp_path = tmp.name

        try:
            with patch("pdfplumber.open") as mock_pdf:
                mock_page = MagicMock()
                mock_page.extract_text.return_value = "Test PDF content"
                mock_pdf.return_value.__enter__.return_value.pages = [mock_page]

                result = await invoker._handle_pdf_reader(
                    {
                        "file_path": tmp_path,
                        "extract_images": False,
                        "extract_tables": False,
                        "extract_formulas": False,
                    }
                )

                assert result["success"] is True
                assert "Test PDF content" in result["data"]["content"]
                assert result["metadata"]["page_count"] == 1
        finally:
            os.unlink(tmp_path)

    @pytest.mark.asyncio
    async def test_handle_pdf_reader_no_path(self, skill_invoker_no_api_key):
        """Test PDF reader skill with no file path."""
        invoker = skill_invoker_no_api_key

        result = await invoker._handle_pdf_reader({})

        assert result["success"] is False
        assert "No file_path" in result["error"]
        assert result["error_type"] == "ValueError"

    @pytest.mark.asyncio
    async def test_handle_pdf_reader_with_url(self, skill_invoker_no_api_key):
        """Test PDF reader skill with URL."""
        invoker = skill_invoker_no_api_key

        with patch("httpx.AsyncClient") as mock_client_class:
            # Mock HTTP response
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.content = b"%PDF-1.4 test PDF content"
            mock_response.status_code = 200
            mock_response.raise_for_status.return_value = None
            mock_client.get.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            with patch("pdfplumber.open") as mock_pdf:
                mock_page = MagicMock()
                mock_page.extract_text.return_value = "Downloaded PDF content"
                mock_pdf.return_value.__enter__.return_value.pages = [mock_page]

                result = await invoker._handle_pdf_reader({"url": "https://example.com/test.pdf"})

                assert result["success"] is True
                assert "Downloaded PDF content" in result["data"]["content"]
                # mock_get.assert_called_once_with("https://example.com/test.pdf")  # This is called internally

    @pytest.mark.asyncio
    async def test_handle_pdf_reader_page_range(self, skill_invoker_no_api_key):
        """Test PDF reader skill with page range."""
        invoker = skill_invoker_no_api_key

        with patch("pdfplumber.open") as mock_pdf:
            # Create 5 mock pages
            mock_pages = [MagicMock() for _ in range(5)]
            for i, page in enumerate(mock_pages):
                page.extract_text.return_value = f"Page {i + 1} content"
            mock_pdf.return_value.__enter__.return_value.pages = mock_pages

            result = await invoker._handle_pdf_reader(
                {
                    "file_path": "test.pdf",
                    "page_range": [1, 3],  # Pages 1-3 (0-indexed: 1-2)
                }
            )

            assert result["success"] is True
            # Should only extract pages 2 and 3 (indices 1 and 2)
            assert "Page 2 content" in result["data"]["content"]
            assert "Page 3 content" in result["data"]["content"]
            assert "Page 1 content" not in result["data"]["content"]
            assert "Page 4 content" not in result["data"]["content"]

    @pytest.mark.asyncio
    async def test_handle_pdf_reader_extract_tables(self, skill_invoker_no_api_key):
        """Test PDF reader skill with table extraction."""
        invoker = skill_invoker_no_api_key

        with patch("pdfplumber.open") as mock_pdf:
            mock_page = MagicMock()
            mock_page.extract_text.return_value = "Text content"

            # Mock table extraction
            mock_table = [["Header1", "Header2"], ["Row1Col1", "Row1Col2"]]
            mock_page.extract_tables.return_value = [mock_table]

            mock_pdf.return_value.__enter__.return_value.pages = [mock_page]

            result = await invoker._handle_pdf_reader(
                {
                    "file_path": "test.pdf",
                    "extract_tables": True,
                    "extract_images": False,
                    "extract_formulas": False,
                }
            )

            assert result["success"] is True
            assert "Text content" in result["data"]["content"]
            assert (
                "| Header1  | Header2  |" in result["data"]["content"]
            )  # Note the spacing in _convert_table_to_markdown
            assert "| Row1Col1 | Row1Col2 |" in result["data"]["content"]

    @pytest.mark.asyncio
    async def test_handle_web_translator(self, skill_invoker_no_api_key):
        """Test web translator skill."""
        invoker = skill_invoker_no_api_key

        with patch("httpx.AsyncClient") as mock_client_class:
            # Mock HTTP response
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.text = """
                <html>
                    <head><title>Test Page</title></head>
                    <body>
                        <nav>Navigation</nav>
                        <main>
                            <h1>Main Content</h1>
                            <p>Article content here</p>
                        </main>
                        <footer>Footer</footer>
                    </body>
                </html>
            """
            mock_response.status_code = 200
            mock_client.get.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await invoker._handle_web_translator({"url": "https://example.com"})

            assert result["success"] is True
            assert "Main Content" in result["content"]
            assert "Article content here" in result["content"]
            # Navigation and footer should be excluded
            assert "Navigation" not in result["content"]
            assert "Footer" not in result["content"]

    @pytest.mark.asyncio
    async def test_handle_web_translator_with_markdown_conversion(self, skill_invoker_no_api_key):
        """Test web translator skill with markdown conversion."""
        invoker = skill_invoker_no_api_key

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.text = "<html><body><h1>Title</h1><p>Content</p></body></html>"
            mock_response.status_code = 200
            mock_client.get.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await invoker._handle_web_translator({"url": "https://example.com", "format": "markdown"})

            assert result["success"] is True
            assert "# Title" in result["content"]
            assert "Content" in result["content"]

    @pytest.mark.asyncio
    async def test_handle_zh_translator(self, skill_invoker_with_api_key):
        """Test Chinese translator skill."""
        invoker = skill_invoker_with_api_key

        # Mock Anthropic API response
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="中文翻译结果")]
        invoker.anthropic_client.messages.create.return_value = mock_response

        result = await invoker._handle_zh_translator({"text": "English text to translate", "target_language": "zh"})

        assert result["success"] is True
        assert result["translated_text"] == "中文翻译结果"
        invoker.anthropic_client.messages.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_zh_translator_no_api_key(self, skill_invoker_no_api_key):
        """Test Chinese translator skill without API key."""
        invoker = skill_invoker_no_api_key

        result = await invoker._handle_zh_translator({"text": "Test text", "target_language": "zh"})

        assert result["success"] is False
        assert "Anthropic API key not configured" in result["error"]

    @pytest.mark.asyncio
    async def test_handle_markdown_formatter(self, skill_invoker_no_api_key):
        """Test markdown formatter skill."""
        invoker = skill_invoker_no_api_key

        result = await invoker._handle_markdown_formatter(
            {
                "content": "# Title\n\nContent with **bold** text.",
                "options": {"extract_main_content": False},
            }
        )

        assert result["success"] is True
        assert "# Title" in result["formatted_content"]
        assert "**bold**" in result["formatted_content"]

    @pytest.mark.asyncio
    async def test_handle_heartfelt(self, skill_invoker_no_api_key):
        """Test heartfelt skill."""
        invoker = skill_invoker_no_api_key

        result = await invoker._handle_heartfelt(
            {
                "content": "This is a test document content that needs analysis.",
                "analysis_type": "summary",
            }
        )

        assert result["success"] is True
        assert "analysis" in result
        assert "insights" in result

    @pytest.mark.asyncio
    async def test_handle_batch_processor(self, skill_invoker_no_api_key):
        """Test batch processor skill."""
        invoker = skill_invoker_no_api_key

        # Mock individual skill handlers
        with patch.object(invoker, "_handle_pdf_reader") as mock_pdf:
            with patch.object(invoker, "_handle_zh_translator") as mock_translate:
                mock_pdf.return_value = {"success": True, "content": "PDF content"}
                mock_translate.return_value = {
                    "success": True,
                    "translated_text": "Translated content",
                }

                result = await invoker._handle_batch_processor(
                    {
                        "items": [
                            {"type": "pdf", "path": "file1.pdf"},
                            {"type": "pdf", "path": "file2.pdf"},
                        ],
                        "operations": ["extract", "translate"],
                    }
                )

                assert result["success"] is True
                assert len(result["results"]) == 2
                assert all("extracted" in r for r in result["results"])
                assert all("translated" in r for r in result["results"])

    @pytest.mark.asyncio
    async def test_handle_doc_translator(self, skill_invoker_with_api_key):
        """Test document translator skill."""
        invoker = skill_invoker_with_api_key

        # Mock PDF extraction and translation
        with patch.object(invoker, "_handle_pdf_reader") as mock_pdf:
            with patch.object(invoker, "_handle_zh_translator") as mock_translate:
                mock_pdf.return_value = {
                    "success": True,
                    "content": "Document content to translate",
                }
                mock_translate.return_value = {
                    "success": True,
                    "translated_text": "Translated document content",
                }

                result = await invoker._handle_doc_translator({"file_path": "document.pdf", "target_language": "zh"})

                assert result["success"] is True
                assert result["translated_content"] == "Translated document content"
                mock_pdf.assert_called_once()
                mock_translate.assert_called_once()

    def test_convert_table_to_markdown(self, skill_invoker_no_api_key):
        """Test the _convert_table_to_markdown helper method."""
        invoker = skill_invoker_no_api_key

        # Test simple table
        table_data = [
            ["Header1", "Header2", "Header3"],
            ["Row1Col1", "Row1Col2", "Row1Col3"],
            ["Row2Col1", "Row2Col2", "Row2Col3"],
        ]

        markdown = invoker._convert_table_to_markdown(table_data)

        # The actual implementation adds padding to columns
        assert "| Header1  | Header2  | Header3  |" in markdown
        assert "| Row1Col1 | Row1Col2 | Row1Col3 |" in markdown
        assert "| Row2Col1 | Row2Col2 | Row2Col3 |" in markdown
        assert "| -------- | -------- | -------- |" in markdown  # Separator row

    def test_convert_table_to_markdown_empty(self, skill_invoker_no_api_key):
        """Test _convert_table_to_markdown with empty table."""
        invoker = skill_invoker_no_api_key

        markdown = invoker._convert_table_to_markdown([])

        assert markdown == ""

    def test_convert_table_to_markdown_uneven_rows(self, skill_invoker_no_api_key):
        """Test _convert_table_to_markdown with uneven row lengths."""
        invoker = skill_invoker_no_api_key

        table_data = [
            ["Header1", "Header2"],
            ["Row1Col1", "Row1Col2", "Row1Col3"],  # Extra column
            ["Row2Col1"],  # Missing column
        ]

        markdown = invoker._convert_table_to_markdown(table_data)

        # Should handle uneven rows gracefully by padding with empty strings
        assert "| Header1  | Header2  |         |" in markdown
        assert "| Row1Col1 | Row1Col2 | Row1Col3 |" in markdown
        assert "| Row2Col1 |         |         |" in markdown

    @pytest.mark.asyncio
    async def test_error_handling_pdf_corrupted(self, skill_invoker_no_api_key):
        """Test handling of corrupted PDF files."""
        invoker = skill_invoker_no_api_key

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(b"Invalid PDF content")
            tmp_path = tmp.name

        try:
            with patch("pdfplumber.open") as mock_pdf:
                mock_pdf.side_effect = Exception("PDF parsing error")

                result = await invoker._handle_pdf_reader({"file_path": tmp_path})

                assert result["success"] is False
                assert "PDF parsing error" in result["error"]
        finally:
            os.unlink(tmp_path)

    @pytest.mark.asyncio
    async def test_error_handling_web_request_failure(self, skill_invoker_no_api_key):
        """Test handling of web request failures."""
        invoker = skill_invoker_no_api_key

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.side_effect = httpx.RequestError("Connection failed")
            mock_client_class.return_value.__aenter__.return_value = mock_client

            result = await invoker._handle_web_translator({"url": "https://example.com"})

            assert result["success"] is False
            assert "Connection failed" in result["error"]

    @pytest.mark.asyncio
    async def test_error_handling_translation_api_failure(self, skill_invoker_with_api_key):
        """Test handling of translation API failures."""
        invoker = skill_invoker_with_api_key

        # Mock API failure
        invoker.anthropic_client.messages.create.side_effect = Exception("API error")

        result = await invoker._handle_zh_translator({"text": "Test text", "target_language": "zh"})

        assert result["success"] is False
        assert "API error" in result["error"]
