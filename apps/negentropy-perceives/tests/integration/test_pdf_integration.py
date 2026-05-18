"""Comprehensive PDF integration tests with real PDF processing scenarios."""

import pytest
import tempfile
import os
from unittest.mock import patch, MagicMock

from negentropy.perceives.pdf.processor import PDFProcessor
from tests.integration.tooling import build_pdf_tool_kwargs, select_tools


@pytest.fixture
def sample_pdf_content():
    """Mock PDF content for testing."""
    return {
        "text": "# Sample Document\n\nThis is a test PDF document.\n\n## Chapter 1\n\nContent of chapter 1 with some important information.\n\n## Chapter 2\n\nContent of chapter 2 with additional details.",
        "metadata": {
            "title": "Sample Document",
            "author": "Test Author",
            "total_pages": 3,
            "file_size_bytes": 1024,
        },
        "pages_processed": 3,
    }


@pytest.fixture
def pdf_test_tools(e2e_tools):
    """获取 PDF 相关测试工具。"""
    return select_tools(
        e2e_tools,
        "parse_pdf_to_markdown",
        "parse_pdfs_to_markdown",
    )


class TestPDFToolsIntegration:
    """Integration tests for PDF processing tools."""

    @pytest.mark.asyncio
    async def test_pdf_convert_tool_actual_execution(
        self, pdf_test_tools, pdf_processor, sample_pdf_content
    ):
        """Test actual PDF conversion tool execution with mocked PDF processing."""
        convert_tool = pdf_test_tools["parse_pdf_to_markdown"]

        # Mock the PDF processor via create_pdf_processor
        with patch(
            "negentropy.perceives.ops.pdf.create_pdf_processor"
        ) as mock_get_processor:
            mock_get_processor.return_value = pdf_processor
            # Mock the PDF processor's process_pdf method
            with patch.object(pdf_processor, "process_pdf") as mock_process:
                mock_process.return_value = {
                    "success": True,
                    **sample_pdf_content,
                    "markdown": "# Sample Document\n\nThis is a test PDF document.",
                    "source": "/test/sample.pdf",
                    "method_used": "pymupdf",
                    "output_format": "markdown",
                    "word_count": 25,
                    "character_count": 150,
                }

                # Execute the tool
                result = await convert_tool.fn(
                    pdf_source="/test/sample.pdf",
                    **build_pdf_tool_kwargs(),
                )

                # Verify successful execution
                assert result.success is True
                assert hasattr(result, "content")
                assert result.pdf_source == "/test/sample.pdf"
                assert result.method == "auto"  # The method parameter we passed
                assert result.word_count == 25

                # Verify metadata is included
                metadata = result.metadata
                assert metadata["title"] == "Sample Document"
                assert metadata["author"] == "Test Author"
                assert metadata["total_pages"] == 3

                # Verify tool was called correctly
                mock_process.assert_called_once_with(
                    pdf_source="/test/sample.pdf",
                    method="auto",
                    include_metadata=True,
                    page_range=None,
                    output_format="markdown",
                    extract_images=True,
                    extract_tables=True,
                    extract_formulas=True,
                    embed_images=False,
                    enhanced_options=None,
                )

    @pytest.mark.asyncio
    async def test_pdf_batch_tool_actual_execution(
        self, pdf_test_tools, pdf_processor, sample_pdf_content
    ):
        """Test actual PDF batch conversion tool execution."""
        batch_tool = pdf_test_tools["parse_pdfs_to_markdown"]

        # Mock batch processing with mixed results
        batch_result = {
            "success": True,
            "results": [
                {
                    "success": True,
                    **sample_pdf_content,
                    "markdown": "# Document 1\n\nContent",
                    "source": "/test/doc1.pdf",
                    "word_count": 20,
                },
                {
                    "success": True,
                    **sample_pdf_content,
                    "markdown": "# Document 2\n\nContent",
                    "source": "/test/doc2.pdf",
                    "word_count": 30,
                },
                {
                    "success": False,
                    "error": "PDF file does not exist",
                    "source": "/test/missing.pdf",
                },
            ],
            "summary": {
                "total_pdfs": 3,
                "successful": 2,
                "failed": 1,
                "total_pages_processed": 6,
                "total_words_extracted": 50,
                "method_used": "auto",
                "output_format": "markdown",
            },
        }

        with patch(
            "negentropy.perceives.ops.pdf.create_pdf_processor"
        ) as mock_get_processor:
            mock_get_processor.return_value = pdf_processor
            with patch.object(pdf_processor, "batch_process_pdfs") as mock_batch:
                mock_batch.return_value = batch_result

                # Execute batch tool
                result = await batch_tool.fn(
                    pdf_sources=[
                        "/test/doc1.pdf",
                        "/test/doc2.pdf",
                        "/test/missing.pdf",
                    ],
                    **build_pdf_tool_kwargs(),
                )

                # Verify successful batch execution
                assert result.success is True
                assert result.success is True

                # Verify batch summary
                assert result.total_pdfs == 3
                assert result.successful_count == 2
                assert result.failed_count == 1
                assert result.total_word_count == 50

                # Verify individual results
                results = result.results
                assert len(results) == 3
                assert results[0].success is True
                assert results[1].success is True
                assert results[2].success is False

    @pytest.mark.asyncio
    async def test_pdf_tools_parameter_validation_integration(self, pdf_test_tools):
        """Test parameter validation through actual tool execution."""
        convert_tool = pdf_test_tools["parse_pdf_to_markdown"]
        batch_tool = pdf_test_tools["parse_pdfs_to_markdown"]

        # Test invalid method parameter - validation happens at tool execution
        from negentropy.perceives.pdf.processor import PDFProcessor

        pdf_processor = PDFProcessor()
        with patch(
            "negentropy.perceives.ops.pdf.create_pdf_processor",
            return_value=pdf_processor,
        ):
            with patch.object(pdf_processor, "process_pdf") as mock_process:
                mock_process.return_value = {
                    "success": False,
                    "error": "Invalid method",
                }

                result = await convert_tool.fn(
                    pdf_source="/test/sample.pdf",
                    **build_pdf_tool_kwargs(method="invalid_method"),
                )
                assert result.success is False

        # Test empty PDF sources list for batch tool - should be validated by the tool
        with patch(
            "negentropy.perceives.ops.pdf.create_pdf_processor",
            return_value=pdf_processor,
        ):
            with patch.object(pdf_processor, "batch_process_pdfs") as mock_batch:
                mock_batch.return_value = {
                    "success": False,
                    "error": "PDF sources list cannot be empty",
                }

                result = await batch_tool.fn(pdf_sources=[], **build_pdf_tool_kwargs())
                assert result.success is False

    @pytest.mark.asyncio
    async def test_pdf_tools_with_page_range(
        self, pdf_test_tools, pdf_processor, sample_pdf_content
    ):
        """Test PDF tools with page range functionality."""
        convert_tool = pdf_test_tools["parse_pdf_to_markdown"]

        # Mock PDF processing with page range
        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_process,
        ):
            range_result = {
                **sample_pdf_content,
                "success": True,
                "pages_processed": 2,  # Only 2 pages instead of 3
                "source": "/test/sample.pdf",
            }
            mock_process.return_value = range_result

            # Execute with page range
            result = await convert_tool.fn(
                pdf_source="/test/sample.pdf",
                **build_pdf_tool_kwargs(method="pymupdf", page_range=[1, 3]),
            )

            assert result.success is True
            assert result.page_count == 2

            # Verify page range was passed correctly
            mock_process.assert_called_once()
            args, kwargs = mock_process.call_args
            assert kwargs["page_range"] == (1, 3)  # Server converts list to tuple

    @pytest.mark.asyncio
    async def test_pdf_tools_error_handling_integration(
        self, pdf_test_tools, pdf_processor
    ):
        """Test comprehensive error handling in PDF tools."""
        convert_tool = pdf_test_tools["parse_pdf_to_markdown"]

        # Test file not found error
        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_process,
        ):
            mock_process.return_value = {
                "success": False,
                "error": "PDF file does not exist",
                "source": "/nonexistent/file.pdf",
            }

            result = await convert_tool.fn(
                pdf_source="/nonexistent/file.pdf",
                **build_pdf_tool_kwargs(),
            )

            assert result.success is False
            # Error is now wrapped in a structured format
            assert "PDF file does not exist" in (
                result.error["message"]
                if isinstance(result.error, dict)
                else result.error
            )

        # Test URL download failure
        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_process,
        ):
            mock_process.return_value = {
                "success": False,
                "error": "Failed to download PDF from URL",
                "source": "https://invalid-url.com/document.pdf",
            }

            result = await convert_tool.fn(
                pdf_source="https://invalid-url.com/document.pdf",
                **build_pdf_tool_kwargs(),
            )

            assert result.success is False
            assert "Failed to download PDF from URL" in (
                result.error["message"]
                if isinstance(result.error, dict)
                else result.error
            )

    @pytest.mark.asyncio
    async def test_pdf_tools_with_different_output_formats(
        self, pdf_test_tools, pdf_processor, sample_pdf_content
    ):
        """Test PDF tools with different output formats."""
        convert_tool = pdf_test_tools["parse_pdf_to_markdown"]

        # Test text output format
        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_process,
        ):
            text_result = {
                **sample_pdf_content,
                "success": True,
                "output_format": "text",
                "source": "/test/sample.pdf",
                # No markdown field for text format
            }
            mock_process.return_value = text_result

            result = await convert_tool.fn(
                pdf_source="/test/sample.pdf",
                **build_pdf_tool_kwargs(output_format="text"),
            )

            assert result.success is True
            assert result.output_format == "text"
            assert (
                result.content is not None
            )  # Content should still be present for text format

        # Test markdown output format (default)
        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_process,
        ):
            markdown_result = {
                **sample_pdf_content,
                "success": True,
                "markdown": "# Sample Document\n\nContent",
                "output_format": "markdown",
                "source": "/test/sample.pdf",
            }
            mock_process.return_value = markdown_result

            result = await convert_tool.fn(
                pdf_source="/test/sample.pdf",
                **build_pdf_tool_kwargs(),
            )

            assert result.success is True
            assert result.output_format == "markdown"
            assert hasattr(result, "content") and result.content is not None

    @pytest.mark.asyncio
    async def test_pdf_processor_resource_management_integration(self):
        """Test PDF processor resource management in integration context."""
        # Create a new PDF processor instance
        test_processor = PDFProcessor()

        # Verify temp directory was created
        assert os.path.exists(test_processor.temp_dir)
        temp_dir_path = test_processor.temp_dir

        # Test cleanup
        test_processor.cleanup()

        # Verify temp directory was cleaned up
        assert not os.path.exists(temp_dir_path)

    @pytest.mark.asyncio
    async def test_pdf_tools_concurrent_execution(
        self, pdf_test_tools, pdf_processor, sample_pdf_content
    ):
        """Test concurrent execution of PDF tools."""
        convert_tool = pdf_test_tools["parse_pdf_to_markdown"]

        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_process,
        ):
            mock_process.return_value = {
                **sample_pdf_content,
                "success": True,
                "markdown": "# Concurrent Test\n\nContent",
                "source": "/test/concurrent.pdf",
            }

            # Create multiple concurrent tasks
            import asyncio

            tasks = []
            num_concurrent = 5

            for i in range(num_concurrent):
                task = convert_tool.fn(
                    pdf_source=f"/test/doc_{i}.pdf",
                    **build_pdf_tool_kwargs(),
                )
                tasks.append(task)

            # Execute all tasks concurrently
            results = await asyncio.gather(*tasks)

            # Verify all succeeded
            for result in results:
                assert result.success is True

            # Verify all calls were made
            assert mock_process.call_count == num_concurrent


class TestPDFIntegrationWithRealProcessing:
    """Integration tests with more realistic PDF processing scenarios."""

    @pytest.mark.asyncio
    async def test_pdf_integration_with_temp_files(self, pdf_test_tools):
        """Test PDF processing with actual temporary files."""
        convert_tool = pdf_test_tools["parse_pdf_to_markdown"]

        # Create a temporary file to simulate a PDF
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
            temp_file.write(b"Mock PDF content")
            temp_path = temp_file.name

        try:
            # Mock the PDF extraction methods to avoid needing real PDF libraries
            with patch(
                "negentropy.perceives.pdf.processor._import_fitz"
            ) as mock_import_fitz:
                mock_fitz = MagicMock()
                mock_import_fitz.return_value = mock_fitz
                # Mock successful PyMuPDF processing
                mock_doc = MagicMock()
                mock_doc.page_count = 1
                mock_doc.metadata = {"title": "Test Document"}

                mock_page = MagicMock()
                # Return blocks format: (x0, y0, x1, y1, text, block_no, block_type)
                mock_page.get_text.return_value = [
                    (0, 0, 500, 30, "Test content\n", 0, 0),
                ]
                mock_doc.load_page.return_value = mock_page

                mock_fitz.open.return_value = mock_doc

                # Execute the tool with a real file path
                result = await convert_tool.fn(
                    pdf_source=temp_path,
                    method="pymupdf",
                    include_metadata=True,
                    page_range=None,
                    output_format="markdown",
                    extract_images=True,
                    extract_tables=True,
                    extract_formulas=True,
                    embed_images=False,
                    enhanced_options=None,
                )

                assert result.success is True
                assert result.pdf_source == temp_path
                assert result.method == "pymupdf"

        finally:
            # Clean up temporary file
            os.unlink(temp_path)

    @pytest.mark.asyncio
    async def test_pdf_batch_integration_with_file_mix(self, pdf_test_tools):
        """Test batch PDF processing with mix of existing and non-existing files."""
        batch_tool = pdf_test_tools["parse_pdfs_to_markdown"]

        # Create one real temp file, use one non-existing file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
            temp_file.write(b"Mock PDF content")
            real_path = temp_file.name

        fake_path = "/nonexistent/fake.pdf"

        try:
            # Create PDF processor instance for mocking
            test_pdf_processor = PDFProcessor()
            # Mock the batch processing to handle the mixed scenario
            with (
                patch(
                    "negentropy.perceives.ops.pdf.create_pdf_processor",
                    return_value=test_pdf_processor,
                ),
                patch.object(test_pdf_processor, "batch_process_pdfs") as mock_batch,
            ):
                mock_batch.return_value = {
                    "success": True,
                    "results": [
                        {
                            "success": True,
                            "text": "Content from real file",
                            "source": real_path,
                            "pages_processed": 1,
                            "word_count": 10,
                        },
                        {
                            "success": False,
                            "error": "PDF file does not exist",
                            "source": fake_path,
                        },
                    ],
                    "summary": {
                        "total_pdfs": 2,
                        "successful": 1,
                        "failed": 1,
                        "total_pages_processed": 1,
                        "total_words_extracted": 10,
                        "method_used": "auto",
                        "output_format": "markdown",
                    },
                }

                result = await batch_tool.fn(
                    pdf_sources=[real_path, fake_path],
                    method="auto",
                    include_metadata=True,
                    page_range=None,
                    output_format="markdown",
                    extract_images=True,
                    extract_tables=True,
                    extract_formulas=True,
                    embed_images=False,
                    enhanced_options=None,
                )

                assert result.success is True
                assert result.successful_count == 1
                assert result.failed_count == 1

                # Verify the real file was processed successfully
                real_result = next(
                    r for r in result.results if r.pdf_source == real_path
                )
                assert real_result.success is True

                # Verify the fake file failed appropriately
                fake_result = next(
                    r for r in result.results if r.pdf_source == fake_path
                )
                assert fake_result.success is False

        finally:
            # Clean up
            os.unlink(real_path)

    @pytest.mark.asyncio
    async def test_pdf_url_download_integration_scenario(
        self, pdf_test_tools, pdf_processor
    ):
        """Test PDF processing with URL download scenario."""
        convert_tool = pdf_test_tools["parse_pdf_to_markdown"]

        # Mock URL detection and download process
        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_process,
        ):
            # Simulate successful URL download and processing
            mock_process.return_value = {
                "success": True,
                "text": "Downloaded PDF content",
                "markdown": "# Downloaded Document\n\nContent from URL",
                "source": "https://example.com/document.pdf",
                "method_used": "auto",
                "output_format": "markdown",
                "pages_processed": 2,
                "word_count": 25,
                "character_count": 150,
                "metadata": {
                    "title": "Downloaded Document",
                    "total_pages": 2,
                    "file_size_bytes": 2048,
                },
            }

            result = await convert_tool.fn(
                pdf_source="https://example.com/document.pdf",
                method="auto",
                include_metadata=True,
                page_range=None,
                output_format="markdown",
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                enhanced_options=None,
            )

            assert result.success is True
            assert result.pdf_source == "https://example.com/document.pdf"
            assert "Downloaded Document" in result.content

            # Verify URL was handled correctly
            mock_process.assert_called_once_with(
                pdf_source="https://example.com/document.pdf",
                method="auto",
                include_metadata=True,
                page_range=None,
                output_format="markdown",
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                enhanced_options=None,
            )

    @pytest.mark.asyncio
    async def test_pdf_integration_memory_usage_monitoring(
        self, pdf_test_tools, pdf_processor
    ):
        """Test PDF processing with memory usage monitoring."""
        convert_tool = pdf_test_tools["parse_pdf_to_markdown"]

        # Track objects before processing
        import gc

        gc.collect()
        initial_objects = len(gc.get_objects())

        # Perform multiple PDF processing operations
        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_process,
        ):
            mock_process.return_value = {
                "success": True,
                "text": "Test content " * 100,  # Larger content
                "markdown": "# Large Document\n\n" + "Content paragraph.\n\n" * 50,
                "source": "/test/large.pdf",
                "pages_processed": 10,
                "word_count": 500,
            }

            # Process multiple documents
            for i in range(10):
                result = await convert_tool.fn(
                    pdf_source=f"/test/doc_{i}.pdf",
                    method="auto",
                    include_metadata=True,
                    page_range=None,
                    output_format="markdown",
                    extract_images=True,
                    extract_tables=True,
                    extract_formulas=True,
                    embed_images=False,
                    enhanced_options=None,
                )
                assert result.success is True

        # Check memory usage after processing
        gc.collect()
        final_objects = len(gc.get_objects())
        object_growth = final_objects - initial_objects

        # Allow some object growth but not excessive
        assert object_growth < 2000, (
            f"Potential memory leak: {object_growth} new objects"
        )

    @pytest.mark.asyncio
    async def test_pdf_integration_with_invalid_configurations(self, pdf_test_tools):
        """Test PDF processing with various invalid configuration scenarios."""
        convert_tool = pdf_test_tools["parse_pdf_to_markdown"]
        batch_tool = pdf_test_tools["parse_pdfs_to_markdown"]

        # Test invalid method in convert tool - validation happens at execution
        from negentropy.perceives.pdf.processor import PDFProcessor

        pdf_processor = PDFProcessor()
        with patch(
            "negentropy.perceives.ops.pdf.create_pdf_processor",
            return_value=pdf_processor,
        ):
            with patch.object(pdf_processor, "process_pdf") as mock_process:
                mock_process.return_value = {
                    "success": False,
                    "error": "Invalid method",
                }

                result = await convert_tool.fn(
                    pdf_source="/test/sample.pdf",
                    method="nonexistent_method",
                    include_metadata=True,
                    page_range=None,
                    output_format="markdown",
                    extract_images=True,
                    extract_tables=True,
                    extract_formulas=True,
                    embed_images=False,
                    enhanced_options=None,
                )
                assert result.success is False

        # Test invalid page range format - validation happens at execution
        with patch(
            "negentropy.perceives.ops.pdf.create_pdf_processor",
            return_value=pdf_processor,
        ):
            with patch.object(pdf_processor, "process_pdf") as mock_process:
                mock_process.return_value = {
                    "success": False,
                    "error": "Start page must be less than end page",
                }

                result = await convert_tool.fn(
                    pdf_source="/test/sample.pdf",
                    method="auto",
                    include_metadata=True,
                    page_range=[5, 2],  # End before start
                    output_format="markdown",
                    extract_images=True,
                    extract_tables=True,
                    extract_formulas=True,
                    embed_images=False,
                    enhanced_options=None,
                )
                assert result.success is False

        # Test empty batch list - validation happens at execution
        with patch(
            "negentropy.perceives.ops.pdf.create_pdf_processor",
            return_value=pdf_processor,
        ):
            with patch.object(pdf_processor, "batch_process_pdfs") as mock_batch:
                mock_batch.return_value = {
                    "success": False,
                    "error": "PDF sources list cannot be empty",
                }

                result = await batch_tool.fn(
                    pdf_sources=[],
                    method="auto",
                    include_metadata=True,
                    page_range=None,
                    output_format="markdown",
                    extract_images=True,
                    extract_tables=True,
                    extract_formulas=True,
                    embed_images=False,
                    enhanced_options=None,
                )
                assert result.success is False
