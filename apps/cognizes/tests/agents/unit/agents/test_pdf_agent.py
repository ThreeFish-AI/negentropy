"""Unit tests for PDFProcessingAgent."""

from unittest.mock import AsyncMock, patch

import pytest

from cognizes.agents.claude.pdf_agent import PDFProcessingAgent


@pytest.mark.unit
class TestPDFProcessingAgent:
    """Test cases for PDFProcessingAgent."""

    @pytest.fixture
    def pdf_agent(self):
        """Create a PDFProcessingAgent instance for testing."""
        return PDFProcessingAgent()

    def test_pdf_agent_initialization(self):
        """Test PDFProcessingAgent initialization."""
        agent = PDFProcessingAgent()
        assert agent.name == "pdf_processor"
        assert agent.config == {}
        assert agent.default_options["extract_images"] is True
        assert agent.default_options["extract_tables"] is True
        assert agent.default_options["extract_formulas"] is True
        assert agent.default_options["output_format"] == "markdown"

    def test_pdf_agent_initialization_with_config(self):
        """Test PDFProcessingAgent initialization with config."""
        config = {"timeout": 60, "max_retries": 5}
        agent = PDFProcessingAgent(config)
        assert agent.name == "pdf_processor"
        assert agent.config == config

    @pytest.mark.asyncio
    async def test_process_no_file_path(self, pdf_agent):
        """Test process without file path."""
        input_data = {"options": {"extract_images": False}}

        result = await pdf_agent.process(input_data)

        assert result["success"] is False
        assert result["error"] == "No file path provided"

    @pytest.mark.asyncio
    async def test_process_file_not_found(self, pdf_agent):
        """Test process with nonexistent file."""
        input_data = {"file_path": "/nonexistent/file.pdf"}

        result = await pdf_agent.process(input_data)

        assert result["success"] is False
        assert "File not found:" in result["error"]

    @pytest.mark.asyncio
    async def test_process_success(self, pdf_agent, temp_dir):
        """Test successful PDF processing."""
        # Create a mock PDF file
        pdf_file = temp_dir / "test.pdf"
        pdf_file.write_bytes(b"%PDF-1.4\nmock pdf content")

        input_data = {"file_path": str(pdf_file)}

        # Mock the extract_content method
        mock_result = {
            "success": True,
            "data": {"content": "Extracted PDF content", "metadata": {"pages": 10}},
        }
        pdf_agent.extract_content = AsyncMock(return_value=mock_result)

        result = await pdf_agent.process(input_data)

        assert result["success"] is True
        assert result["data"] == mock_result["data"]
        pdf_agent.extract_content.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_with_custom_options(self, pdf_agent, temp_dir):
        """Test process with custom options."""
        # Create a mock PDF file
        pdf_file = temp_dir / "test.pdf"
        pdf_file.write_bytes(b"%PDF-1.4\nmock pdf content")

        input_data = {
            "file_path": str(pdf_file),
            "options": {"extract_images": False, "output_format": "json"},
        }

        # Mock the extract_content method
        pdf_agent.extract_content = AsyncMock(return_value={"success": True, "data": {}})

        await pdf_agent.process(input_data)

        # Check that options were merged correctly
        call_args = pdf_agent.extract_content.call_args[0][0]
        assert call_args["file_path"] == str(pdf_file)
        assert call_args["options"]["extract_images"] is False  # Custom option
        assert call_args["options"]["extract_tables"] is True  # Default option
        assert call_args["options"]["output_format"] == "json"  # Custom option

    @pytest.mark.asyncio
    async def test_extract_content_file_not_found(self, pdf_agent):
        """Test extract_content with nonexistent file."""
        params = {"file_path": "/nonexistent/file.pdf"}

        # Mock the pdf-reader skill to handle file not found
        with patch.object(pdf_agent, "call_skill") as mock_call_skill:
            mock_call_skill.return_value = {"success": False, "error": "File not found"}

            result = await pdf_agent.extract_content(params)

            assert result["success"] is False
            assert "File not found" in result["error"]

    # @pytest.mark.asyncio
    # async def test_extract_content_success(self, pdf_agent, temp_dir):
    #     """Test successful content extraction."""
    #     # Create a mock PDF file
    #     pdf_file = temp_dir / "test.pdf"
    #     pdf_file.write_bytes(b"%PDF-1.4\nmock pdf content")

    #     params = {
    #         "file_path": str(pdf_file),
    #         "options": {
    #             "extract_images": True,
    #             "extract_tables": True,
    #             "extract_formulas": True,
    #             "output_format": "markdown"
    #         }
    #     }

    #     # Mock the pdf-reader skill
    #     with patch.object(pdf_agent, 'call_skill') as mock_call_skill:
    #         mock_call_skill.return_value = {
    #             "success": True,
    #             "data": {
    #                 "content": "# Extracted Content\n\nThis is the PDF content.",
    #                 "metadata": {
    #                     "title": "Test PDF",
    #                     "author": "Test Author",
    #                     "pages": 10,
    #                     "word_count": 500
    #                 },
    #                 "images": [],
    #                 "tables": [],
    #                 "formulas": []
    #             }
    #         }

    #         result = await pdf_agent.extract_content(params)

    #         assert result["success"] is True
    #         assert "content" in result["data"]
    #         assert "metadata" in result["data"]
    #         assert result["data"]["metadata"]["pages"] == 10

    #         mock_call_skill.assert_called_once_with("pdf-reader", {
    #             "pdf_source": str(pdf_file),
    #             "method": "auto",
    #             "include_metadata": True,
    #             "extract_images": True,
    #             "extract_tables": True,
    #             "extract_formulas": True,
    #             "output_format": "markdown",
    #             "page_range": None
    #         })

    @pytest.mark.asyncio
    async def test_extract_content_skill_failure(self, pdf_agent, temp_dir):
        """Test content extraction when skill call fails."""
        # Create a mock PDF file
        pdf_file = temp_dir / "test.pdf"
        pdf_file.write_bytes(b"%PDF-1.4\nmock pdf content")

        params = {"file_path": str(pdf_file), "options": {"output_format": "markdown"}}

        # Mock failed skill call
        with patch.object(pdf_agent, "call_skill") as mock_call_skill:
            mock_call_skill.return_value = {
                "success": False,
                "error": "PDF processing failed",
            }

            result = await pdf_agent.extract_content(params)

            assert result["success"] is False
            assert "PDF processing failed" in result["error"]

    @pytest.mark.asyncio
    async def test_extract_content_with_partial_options(self, pdf_agent, temp_dir):
        """Test content extraction with partial options."""
        # Create a mock PDF file
        pdf_file = temp_dir / "test.pdf"
        pdf_file.write_bytes(b"%PDF-1.4\nmock pdf content")

        params = {
            "file_path": str(pdf_file),
            "options": {
                "extract_images": False,
                # Other options should use defaults
            },
        }

        # Mock the data extractor skill
        with patch.object(pdf_agent, "call_skill") as mock_call_skill:
            mock_call_skill.return_value = {"success": True, "data": {}}

            await pdf_agent.extract_content(params)

            # Check the call parameters
            call_args = mock_call_skill.call_args[0][1]
            assert call_args["extract_images"] is False
            assert call_args["extract_tables"] is True  # Default
            assert call_args["extract_formulas"] is True  # Default
            assert call_args["output_format"] == "markdown"  # Default

    @pytest.mark.asyncio
    async def test_validate_input(self, pdf_agent):
        """Test input validation."""
        # Valid input
        valid_input = {"file_path": "/path/to/file.pdf", "options": {}}
        assert await pdf_agent.validate_input(valid_input) is True

        # Invalid input (not a dict)
        assert await pdf_agent.validate_input("not a dict") is False
        assert await pdf_agent.validate_input(None) is False
        assert await pdf_agent.validate_input(123) is False

    # @pytest.mark.asyncio
    # async def test_log_processing(self, pdf_agent):
    #     """Test processing log logging."""
    #     input_data = {"file_path": "/test/file.pdf"}
    #     output_data = {"success": True, "data": {"content": "extracted"}}

    #     with patch("cognizes.agents.claude.pdf_agent.logger") as mock_logger:
    #         await pdf_agent.log_processing(input_data, output_data)

    #         mock_logger.info.assert_called_once()
    #         log_message = mock_logger.info.call_args[0][0]
    #         assert "pdf_processor processed:" in log_message
    #         assert "/test/file.pdf" in log_message
    #         assert "True" in log_message

    @pytest.mark.asyncio
    async def test_batch_call_skill(self, pdf_agent):
        """Test batch skill calls."""
        calls = [
            {"skill": "skill1", "params": {}},
            {"skill": "skill2", "params": {}},
        ]

        # Mock the skill calls
        pdf_agent.call_skill = AsyncMock(
            side_effect=[
                {"success": True, "data": "result1"},
                {"success": True, "data": "result2"},
            ]
        )

        results = await pdf_agent.batch_call_skill(calls)

        assert len(results) == 2
        assert results[0]["success"] is True
        assert results[1]["success"] is True
        assert results[0]["data"] == "result1"
        assert results[1]["data"] == "result2"

    # @pytest.mark.asyncio
    # async def test_extract_content_with_url(self, pdf_agent):
    #     """Test content extraction with URL."""
    #     params = {
    #         "file_path": "https://example.com/document.pdf",
    #         "options": {"output_format": "markdown"}
    #     }

    #     # Mock the data extractor skill
    #     with patch.object(pdf_agent, 'call_skill') as mock_call_skill:
    #         mock_call_skill.return_value = {
    #             "success": True,
    #             "data": {"content": "Extracted from URL", "metadata": {}}
    #         }

    #         result = await pdf_agent.extract_content(params)

    #         assert result["success"] is True
    #         mock_call_skill.assert_called_once_with("data-extractor", {
    #             "action": "convert_pdf_to_markdown",
    #             "pdf_source": "https://example.com/document.pdf",
    #             "extract_images": True,
    #             "extract_tables": True,
    #             "extract_formulas": True,
    #             "output_format": "markdown"
    #         })

    @pytest.mark.asyncio
    async def test_process_preserves_default_options(self, pdf_agent, temp_dir):
        """Test that process preserves default options when not overridden."""
        # Create a mock PDF file
        pdf_file = temp_dir / "test.pdf"
        pdf_file.write_bytes(b"%PDF-1.4\nmock pdf content")

        input_data = {"file_path": str(pdf_file)}

        # Mock the extract_content method
        pdf_agent.extract_content = AsyncMock(return_value={"success": True, "data": {}})

        await pdf_agent.process(input_data)

        # Check that default options were preserved
        call_args = pdf_agent.extract_content.call_args[0][0]
        options = call_args["options"]
        assert options["extract_images"] is True
        assert options["extract_tables"] is True
        assert options["extract_formulas"] is True
        assert options["output_format"] == "markdown"

    @pytest.mark.asyncio
    async def test_batch_extract_content(self, pdf_agent, temp_dir):
        """Test batch content extraction via batch_call_skill method."""
        calls = [
            {"skill": "pdf-reader", "params": {"pdf_source": "file1.pdf"}},
            {"skill": "pdf-reader", "params": {"pdf_source": "file2.pdf"}},
        ]

        # Mock the skill calls
        pdf_agent.call_skill = AsyncMock(
            side_effect=[
                {"success": True, "data": {"content": "content1", "metadata": {}}},
                {"success": True, "data": {"content": "content2", "metadata": {}}},
            ]
        )

        results = await pdf_agent.batch_call_skill(calls)

        assert len(results) == 2
        assert results[0]["success"] is True
        assert results[1]["success"] is True
        assert results[0]["data"]["content"] == "content1"
        assert results[1]["data"]["content"] == "content2"

    def test_extract_metadata(self, pdf_agent, temp_dir):
        """Test metadata extraction."""
        # Create a mock PDF file
        pdf_file = temp_dir / "test.pdf"
        pdf_file.write_bytes(b"%PDF-1.4\nmock pdf content")

        data = {
            "metadata": {
                "title": "Test PDF",
                "author": "Test Author",
                "creator": "Test Creator",
                "producer": "Test Producer",
                "creation_date": "2024-01-01",
                "modification_date": "2024-01-02",
            },
            "content": "This is test content with some words.",
            "page_count": 10,
            "images": [{"id": 1}, {"id": 2}],
            "tables": [{"id": 1}],
            "formulas": [{"id": 1}, {"id": 2}, {"id": 3}],
        }

        metadata = pdf_agent._extract_metadata(data, str(pdf_file))

        assert metadata["file_name"] == "test.pdf"
        assert metadata["file_path"] == str(pdf_file)
        assert metadata["title"] == "Test PDF"
        assert metadata["author"] == "Test Author"
        assert metadata["creator"] == "Test Creator"
        assert metadata["producer"] == "Test Producer"
        assert metadata["creation_date"] == "2024-01-01"
        assert metadata["modification_date"] == "2024-01-02"
        assert metadata["page_count"] == 10
        assert metadata["word_count"] == 7  # Count of words in content
        assert metadata["image_count"] == 2
        assert metadata["table_count"] == 1
        assert metadata["formula_count"] == 3

    def test_extract_metadata_without_pdf_metadata(self, pdf_agent, temp_dir):
        """Test metadata extraction without PDF metadata."""
        pdf_file = temp_dir / "test.pdf"
        pdf_file.write_bytes(b"%PDF-1.4\nmock pdf content")

        data = {"content": "Test content", "page_count": 5}

        metadata = pdf_agent._extract_metadata(data, str(pdf_file))

        assert metadata["file_name"] == "test.pdf"
        assert metadata.get("title", "") == ""
        assert metadata.get("author", "") == ""
        assert metadata["page_count"] == 5
        assert metadata["word_count"] == 2

    def test_process_images(self, pdf_agent):
        """Test image processing."""
        pdf_path = "/path/to/test.pdf"
        paper_id = "category_test_paper"

        images = [
            {
                "index": 0,
                "page": 1,
                "caption": "Test image",
                "format": "png",
                "size": [100, 100],
            },
            {
                "index": 1,
                "page": 2,
                "caption": "Another image",
                "format": "jpg",
                "size": [200, 150],
                "data": "base64data",
            },
        ]

        processed = pdf_agent._process_images(images, pdf_path, paper_id)

        assert len(processed) == 2

        # First image (no embedded data)
        assert processed[0]["index"] == 0
        assert processed[0]["page"] == 1
        assert processed[0]["caption"] == "Test image"
        assert processed[0]["format"] == "png"
        assert processed[0]["size"] == [100, 100]
        assert processed[0]["embedded"] is False
        assert "path" in processed[0]
        assert "filename" in processed[0]
        assert "category" in processed[0]["path"]

        # Second image (with embedded data)
        assert processed[1]["index"] == 1
        assert processed[1]["embedded"] is True
        assert processed[1]["data"] == "base64data"
        assert "path" not in processed[1]

    def test_process_images_without_paper_id(self, pdf_agent):
        """Test image processing without paper ID."""
        pdf_path = "/path/to/test.pdf"
        images = [{"index": 0, "page": 1}]

        processed = pdf_agent._process_images(images, pdf_path)

        assert processed[0]["embedded"] is False
        assert "general" in processed[0]["path"]  # Should use "general" category

    def test_count_words(self, pdf_agent):
        """Test word counting."""
        assert pdf_agent._count_words("") == 0
        assert pdf_agent._count_words(None) == 0
        assert pdf_agent._count_words("word") == 1
        assert pdf_agent._count_words("word1 word2 word3") == 3
        assert pdf_agent._count_words("This is a test sentence.") == 5
        assert pdf_agent._count_words("  multiple   spaces  between  words  ") == 4

    @pytest.mark.asyncio
    async def test_validate_pdf(self, pdf_agent, temp_dir):
        """Test PDF validation."""
        # Test non-existent file
        result = await pdf_agent.validate_pdf("/nonexistent.pdf")
        assert result["valid"] is False
        assert "File does not exist" in result["error"]

        # Test non-PDF file
        txt_file = temp_dir / "test.txt"
        txt_file.write_text("not a pdf")
        result = await pdf_agent.validate_pdf(str(txt_file))
        assert result["valid"] is False
        assert "Not a PDF file" in result["error"]

        # Test empty PDF file
        empty_pdf = temp_dir / "empty.pdf"
        empty_pdf.write_bytes(b"")
        result = await pdf_agent.validate_pdf(str(empty_pdf))
        assert result["valid"] is False
        assert "Empty file" in result["error"]

        # Test valid PDF file
        valid_pdf = temp_dir / "valid.pdf"
        valid_pdf.write_bytes(b"%PDF-1.4\nmock pdf content")
        result = await pdf_agent.validate_pdf(str(valid_pdf))
        assert result["valid"] is True

    @pytest.mark.asyncio
    async def test_extract_content_exception_handling(self, pdf_agent):
        """Test extract_content with exception handling."""
        params = {"file_path": "/test/file.pdf"}

        # Mock call_skill to raise an exception
        with patch.object(pdf_agent, "call_skill") as mock_call_skill:
            mock_call_skill.side_effect = Exception("Skill call failed")

            result = await pdf_agent.extract_content(params)

            assert result["success"] is False
            assert result["error"] == "Skill call failed"

    @pytest.mark.asyncio
    async def test_batch_extract(self, pdf_agent):
        """Test batch PDF extraction."""
        file_paths = ["/test/file1.pdf", "/test/file2.pdf"]
        options = {"extract_images": False, "output_format": "json"}

        # Mock batch_call_skill
        with patch.object(pdf_agent, "batch_call_skill") as mock_batch_call:
            mock_batch_call.return_value = [
                {"success": True, "data": {"content": "Content 1", "page_count": 5}},
                {"success": False, "error": "Processing failed"},
            ]

            result = await pdf_agent.batch_extract(file_paths, options)

            assert result["success"] is True
            assert len(result["results"]) == 2
            assert result["results"][0]["success"] is True
            assert result["results"][1]["success"] is False

            # Verify batch_call_skill was called with correct parameters
            mock_batch_call.assert_called_once()
            calls = mock_batch_call.call_args[0][0]
            assert len(calls) == 2
            assert calls[0]["skill"] == "pdf-reader"
            assert calls[0]["params"]["pdf_source"] == "/test/file1.pdf"
            assert calls[0]["params"]["extract_images"] is False
            assert calls[0]["params"]["extract_tables"] is True
            assert calls[0]["params"]["extract_formulas"] is True

    @pytest.mark.asyncio
    async def test_batch_extract_without_options(self, pdf_agent):
        """Test batch PDF extraction without options."""
        file_paths = ["/test/file1.pdf"]

        # Mock batch_call_skill
        with patch.object(pdf_agent, "batch_call_skill") as mock_batch_call:
            mock_batch_call.return_value = [{"success": True, "data": {"content": "Content 1", "page_count": 3}}]

            result = await pdf_agent.batch_extract(file_paths)

            assert result["success"] is True
            assert len(result["results"]) == 1

            # Verify default options are used
            calls = mock_batch_call.call_args[0][0]
            assert calls[0]["params"]["extract_images"] is True
            assert calls[0]["params"]["extract_tables"] is True
