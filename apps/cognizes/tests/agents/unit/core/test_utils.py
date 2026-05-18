"""Unit tests for core utils."""

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from cognizes.agents.utils import (
    ensure_directory,
    extract_text_summary,
    flatten_dict,
    format_file_size,
    generate_paper_id,
    get_category_from_path,
    get_file_hash,
    get_task_status_color,
    merge_dicts,
    retry_on_failure,
    sanitize_filename,
    validate_pdf_file,
)


@pytest.mark.unit
class TestGeneratePaperId:
    """Test cases for generate_paper_id."""

    def test_generate_paper_id_basic(self):
        """Test basic paper ID generation."""
        filename = "test_paper.pdf"
        category = "llm-agents"

        paper_id = generate_paper_id(filename, category)

        assert paper_id.startswith("llm-agents_")
        assert "test_paper" in paper_id
        assert len(paper_id.split("_")) >= 4  # category_timestamp_name_uuid

    def test_generate_paper_id_special_chars(self):
        """Test paper ID generation with special characters."""
        filename = "test paper (2024).pdf"
        category = "context-engineering"

        paper_id = generate_paper_id(filename, category)

        assert paper_id.startswith("context-engineering_")
        assert "test paper (2024)" in paper_id  # keep original name

    def test_generate_paper_id_long_filename(self):
        """Test paper ID generation with very long filename."""
        filename = "a" * 300 + ".pdf"
        category = "general"

        paper_id = generate_paper_id(filename, category)

        assert paper_id.startswith("general_")
        assert len(paper_id) < 400  # Should be reasonable length


@pytest.mark.unit
class TestSanitizeFilename:
    """Test cases for sanitize_filename."""

    def test_sanitize_filename_basic(self):
        """Test basic filename sanitization."""
        filename = "test_file.pdf"
        result = sanitize_filename(filename)
        assert result == "test_file.pdf"

    def test_sanitize_filename_special_chars(self):
        """Test sanitization with special characters."""
        filename = 'test<>:"/\\|?*file.pdf'
        result = sanitize_filename(filename)
        assert "file.pdf" in result

    def test_sanitize_filename_path(self):
        """Test sanitization removes path separators."""
        filename = "/path/to/test_file.pdf"
        result = sanitize_filename(filename)
        assert result == "test_file.pdf"

    def test_sanitize_filename_long(self):
        """Test sanitization truncates long filenames."""
        filename = "a" * 300 + ".pdf"
        result = sanitize_filename(filename)
        assert len(result) <= 255
        assert result.endswith(".pdf")


@pytest.mark.unit
class TestGetFileHash:
    """Test cases for get_file_hash."""

    def test_get_file_hash_success(self, temp_dir):
        """Test successful file hash calculation."""
        # Create a test file
        test_file = temp_dir / "test.txt"
        test_content = b"Hello, World!"
        test_file.write_bytes(test_content)

        file_hash = get_file_hash(str(test_file))

        # Verify hash is correct (MD5 of "Hello, World!")
        assert file_hash == "65a8e27d8879283831b664bd8b7f0ad4"

    def test_get_file_hash_nonexistent(self):
        """Test hash calculation with nonexistent file."""
        with pytest.raises(FileNotFoundError):
            get_file_hash("/nonexistent/file.txt")


@pytest.mark.unit
class TestFormatFileSize:
    """Test cases for format_file_size."""

    @pytest.mark.parametrize(
        "size_bytes,expected",
        [
            (0, "0.0 B"),
            (512, "512.0 B"),
            (1024, "1.0 KB"),
            (1536, "1.5 KB"),
            (1048576, "1.0 MB"),
            (1073741824, "1.0 GB"),
            (1099511627776, "1.0 TB"),
        ],
    )
    def test_format_file_size_various(self, size_bytes, expected):
        """Test file size formatting for various sizes."""
        result = format_file_size(size_bytes)
        assert result == expected


@pytest.mark.unit
class TestExtractTextSummary:
    """Test cases for extract_text_summary."""

    def test_extract_text_summary_short(self):
        """Test summary with short text."""
        text = "This is a short text."
        result = extract_text_summary(text, max_length=50)
        assert result == text

    def test_extract_text_summary_long(self):
        """Test summary with long text."""
        text = "This is a very long text. " * 20
        result = extract_text_summary(text, max_length=50)
        assert len(result) <= 53  # max_length + "..."
        # May end with "..." or with a sentence depending on content

    def test_extract_text_summary_sentence_boundary(self):
        """Test summary respects sentence boundaries."""
        text = "First sentence. Second sentence. Third sentence."
        result = extract_text_summary(text, max_length=30)
        assert "First sentence." in result
        assert "..." not in result

    def test_extract_text_summary_no_sentences(self):
        """Test summary with text lacking clear sentences."""
        text = "Onelongwordwithoutspaces" * 10
        result = extract_text_summary(text, max_length=30)
        assert len(result) <= 33  # max_length + "..."
        assert result.endswith("...")


@pytest.mark.unit
class TestValidatePdfFile:
    """Test cases for validate_pdf_file."""

    def test_validate_pdf_nonexistent(self):
        """Test validation with nonexistent file."""
        result = validate_pdf_file("/nonexistent/file.pdf")
        assert result["valid"] is False
        assert "File does not exist" in result["error"]

    def test_validate_pdf_wrong_extension(self, temp_dir):
        """Test validation with non-PDF file."""
        test_file = temp_dir / "test.txt"
        test_file.write_text("Not a PDF")

        result = validate_pdf_file(str(test_file))
        assert result["valid"] is False
        assert "Not a PDF file" in result["error"]

    @patch("cognizes.agents.utils.logger")  # Patch logger instead
    def test_validate_pdf_success(self, mock_logger, temp_dir):
        """Test successful PDF validation."""
        # Mock PDF content
        test_file = temp_dir / "test.pdf"
        test_file.write_bytes(b"%PDF-1.4\n")

        result = validate_pdf_file(str(test_file))

        assert result["valid"] is True
        assert result["error"] is None
        assert result["size"] > 0
        # pages might be 0 if pypdf2 is not available


@pytest.mark.unit
class TestGetCategoryFromPath:
    """Test cases for get_category_from_path."""

    @pytest.mark.parametrize(
        "path,expected",
        [
            ("/papers/llm-agents/gpt-paper.pdf", "llm-agents"),
            ("/data/context-engineering/rag-study.pdf", "context-engineering"),
            ("/docs/knowledge-graphs/ontology.pdf", "knowledge-graphs"),
            ("/research/multi-agent/swarm.pdf", "multi-agent"),
            ("/studies/reasoning/logic.pdf", "reasoning"),
            ("/projects/planning/strategy.pdf", "planning"),
            ("/misc/unknown/file.pdf", "general"),
        ],
    )
    def test_get_category_from_path(self, path, expected):
        """Test category detection from path."""
        result = get_category_from_path(path)
        assert result == expected

    def test_get_category_from_path_case_insensitive(self):
        """Test category detection is case insensitive."""
        result = get_category_from_path("/LLM-AGENTS/Paper.pdf")
        assert result == "llm-agents"


@pytest.mark.unit
class TestEnsureDirectory:
    """Test cases for ensure_directory."""

    def test_ensure_directory_new(self, temp_dir):
        """Test ensuring new directory."""
        new_dir = temp_dir / "new" / "nested" / "dir"

        result = ensure_directory(str(new_dir))

        assert result.exists()
        assert result.is_dir()
        assert isinstance(result, Path)

    def test_ensure_directory_existing(self, temp_dir):
        """Test ensuring existing directory."""
        existing_dir = temp_dir / "existing"
        existing_dir.mkdir()

        result = ensure_directory(str(existing_dir))

        assert result.exists()
        assert result.is_dir()


@pytest.mark.unit
class TestGetTaskStatusColor:
    """Test cases for get_task_status_color."""

    @pytest.mark.parametrize(
        "status,expected",
        [
            ("pending", "#6c757d"),
            ("processing", "#007bff"),
            ("completed", "#28a745"),
            ("failed", "#dc3545"),
            ("cancelled", "#ffc107"),
            ("unknown", "#6c757d"),
        ],
    )
    def test_get_task_status_color(self, status, expected):
        """Test status color mapping."""
        result = get_task_status_color(status)
        assert result == expected


@pytest.mark.unit
class TestMergeDicts:
    """Test cases for merge_dicts."""

    def test_merge_dicts_empty(self):
        """Test merging empty dictionaries."""
        result = merge_dicts()
        assert result == {}

    def test_merge_dicts_single(self):
        """Test merging single dictionary."""
        d1 = {"a": 1, "b": 2}
        result = merge_dicts(d1)
        assert result == d1

    def test_merge_dicts_multiple(self):
        """Test merging multiple dictionaries."""
        d1 = {"a": 1}
        d2 = {"b": 2}
        d3 = {"c": 3}

        result = merge_dicts(d1, d2, d3)

        assert result == {"a": 1, "b": 2, "c": 3}

    def test_merge_dicts_override(self):
        """Test merging dictionaries with overlapping keys."""
        d1 = {"a": 1, "b": 2}
        d2 = {"b": 3, "c": 4}

        result = merge_dicts(d1, d2)

        assert result == {"a": 1, "b": 3, "c": 4}

    def test_merge_dicts_with_none(self):
        """Test merging dictionaries with None values."""
        d1 = {"a": 1}
        d2 = None
        d3 = {"b": 2}

        result = merge_dicts(d1, d2, d3)

        assert result == {"a": 1, "b": 2}


@pytest.mark.unit
class TestFlattenDict:
    """Test cases for flatten_dict."""

    def test_flatten_dict_empty(self):
        """Test flattening empty dictionary."""
        result = flatten_dict({})
        assert result == {}

    def test_flatten_dict_flat(self):
        """Test flattening already flat dictionary."""
        d = {"a": 1, "b": 2}
        result = flatten_dict(d)
        assert result == d

    def test_flatten_dict_nested(self):
        """Test flattening nested dictionary."""
        d = {"a": 1, "b": {"c": 2, "d": {"e": 3}}}
        result = flatten_dict(d)
        assert result == {"a": 1, "b.c": 2, "b.d.e": 3}

    def test_flatten_dict_custom_separator(self):
        """Test flattening with custom separator."""
        d = {"a": {"b": 1}}
        result = flatten_dict(d, sep="_")
        assert result == {"a_b": 1}

    def test_flatten_dict_with_parent_key(self):
        """Test flattening with parent key."""
        d = {"a": {"b": 1}}
        result = flatten_dict(d, parent_key="root")
        assert result == {"root.a.b": 1}


@pytest.mark.unit
class TestRetryOnFailure:
    """Test cases for retry_on_failure decorator."""

    @pytest.mark.asyncio
    async def test_retry_success_first_attempt(self):
        """Test retry with success on first attempt."""
        mock_func = AsyncMock(return_value="success")

        @retry_on_failure(max_retries=3, delay=0.1)
        async def test_func():
            return await mock_func()

        result = await test_func()

        assert result == "success"
        assert mock_func.call_count == 1

    @pytest.mark.asyncio
    async def test_retry_success_after_retries(self):
        """Test retry with success after failures."""
        mock_func = AsyncMock(side_effect=[Exception("Fail"), Exception("Fail"), "success"])

        @retry_on_failure(max_retries=3, delay=0.01)
        async def test_func():
            return await mock_func()

        result = await test_func()

        assert result == "success"
        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_retry_exhausted(self):
        """Test retry with all attempts exhausted."""
        mock_func = AsyncMock(side_effect=Exception("Always fails"))

        @retry_on_failure(max_retries=2, delay=0.01)
        async def test_func():
            return await mock_func()

        with pytest.raises(Exception, match="Always fails"):
            await test_func()

        assert mock_func.call_count == 3  # Initial + 2 retries

    @pytest.mark.asyncio
    @patch("asyncio.sleep")
    async def test_retry_delay(self, mock_sleep):
        """Test retry delay with exponential backoff."""
        mock_func = AsyncMock(side_effect=[Exception("Fail"), Exception("Fail"), "success"])

        @retry_on_failure(max_retries=3, delay=0.1)
        async def test_func():
            return await mock_func()

        await test_func()

        # Check that sleep was called (exactly verify might be tricky with asyncio)
        assert mock_sleep.call_count == 2
