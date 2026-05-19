"""Unit tests for BatchProcessingAgent."""

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from cognizes.agents.claude.batch_agent import BatchProcessingAgent


@pytest.mark.unit
class TestBatchProcessingAgent:
    """Test cases for BatchProcessingAgent."""

    @pytest.fixture
    def batch_agent(self):
        """Create a BatchProcessingAgent instance for testing."""
        return BatchProcessingAgent()

    @pytest.fixture
    def batch_agent_with_config(self):
        """Create a BatchProcessingAgent instance with custom config."""
        config = {"papers_dir": "custom_papers", "batch_size": 5}
        return BatchProcessingAgent(config)

    def test_batch_agent_initialization(self, batch_agent):
        """Test BatchProcessingAgent initialization."""
        assert batch_agent.name == "batch_processor"
        assert batch_agent.config == {}
        assert batch_agent.papers_dir == Path("papers")
        assert batch_agent.default_options["batch_size"] == 10
        assert batch_agent.default_options["parallel_tasks"] == 3
        assert batch_agent.default_options["failed_retry"] == 2
        assert batch_agent.default_options["progress_callback"] is None

    def test_batch_agent_initialization_with_config(self, batch_agent_with_config):
        """Test BatchProcessingAgent initialization with config."""
        assert batch_agent_with_config.name == "batch_processor"
        assert batch_agent_with_config.config == {
            "papers_dir": "custom_papers",
            "batch_size": 5,
        }
        assert batch_agent_with_config.papers_dir == Path("custom_papers")

    @pytest.mark.asyncio
    async def test_process_no_files(self, batch_agent):
        """Test process without files."""
        input_data = {"workflow": "full"}

        result = await batch_agent.process(input_data)

        assert result["success"] is False
        assert result["error"] == "No files provided"

    @pytest.mark.asyncio
    async def test_process_with_files(self, batch_agent):
        """Test process with files."""
        files = ["/path/to/file1.pdf", "/path/to/file2.pdf"]
        input_data = {"files": files, "workflow": "full", "options": {"batch_size": 5}}

        # Mock batch_process method
        batch_agent.batch_process = AsyncMock(
            return_value={
                "success": True,
                "stats": {"total": 2, "successful": 2},
                "results": [],
            }
        )

        result = await batch_agent.process(input_data)

        assert result["success"] is True
        batch_agent.batch_process.assert_called_once()

        # Check call parameters
        call_args = batch_agent.batch_process.call_args[0][0]
        assert call_args["files"] == files
        assert call_args["workflow"] == "full"
        assert call_args["options"]["batch_size"] == 5

    @pytest.mark.asyncio
    async def test_process_default_workflow(self, batch_agent):
        """Test process with default workflow."""
        files = ["/path/to/file.pdf"]
        input_data = {"files": files}

        batch_agent.batch_process = AsyncMock(return_value={"success": True})

        await batch_agent.process(input_data)

        call_args = batch_agent.batch_process.call_args[0][0]
        assert call_args["workflow"] == "full"

    @pytest.mark.asyncio
    async def test_batch_process_success(self, batch_agent, tmp_path):
        """Test successful batch processing."""
        # Create temporary PDF files
        file1 = tmp_path / "file1.pdf"
        file2 = tmp_path / "file2.pdf"
        file1.write_bytes(b"PDF content 1")
        file2.write_bytes(b"PDF content 2")

        files = [str(file1), str(file2)]
        batch_agent.papers_dir = tmp_path

        # Mock methods
        batch_agent._validate_files = AsyncMock(return_value={"success": True, "files": files, "invalid": []})
        # Since batch_size=1, _process_batch will be called twice, once for each file
        batch_agent._process_batch = AsyncMock(
            side_effect=[
                [{"file_path": str(file1), "success": True}],
                [{"file_path": str(file2), "success": True}],
            ]
        )

        result = await batch_agent.batch_process({"files": files, "workflow": "extract", "options": {"batch_size": 1}})

        assert result["success"] is True
        assert result["stats"]["total"] == 2
        assert result["stats"]["successful"] == 2
        assert len(result["results"]) == 2

    @pytest.mark.asyncio
    async def test_batch_process_with_progress_callback(self, batch_agent, tmp_path):
        """Test batch processing with progress callback."""
        file = tmp_path / "file.pdf"
        file.write_bytes(b"PDF content")
        files = [str(file)]

        # Mock progress callback
        progress_callback = AsyncMock()
        batch_agent._process_batch = AsyncMock(return_value=[{"file_path": str(file), "success": True}])

        await batch_agent.batch_process(
            {
                "files": files,
                "workflow": "full",
                "options": {"batch_size": 1, "progress_callback": progress_callback},
            }
        )

        # Check progress callback was called
        progress_callback.assert_called()
        call_args = progress_callback.call_args[0][0]
        assert call_args["total"] == 1
        assert call_args["processed"] == 1
        assert call_args["progress"] == 100.0

    @pytest.mark.asyncio
    async def test_validate_files_all_valid(self, batch_agent, tmp_path):
        """Test file validation with all valid files."""
        # Create temporary PDF files
        file1 = tmp_path / "file1.pdf"
        file2 = tmp_path / "file2.pdf"
        file1.write_bytes(b"PDF content 1")
        file2.write_bytes(b"PDF content 2")

        files = [str(file1), str(file2)]
        result = await batch_agent._validate_files(files)

        assert result["success"] is True
        assert len(result["files"]) == 2
        assert len(result["invalid"]) == 0

    @pytest.mark.asyncio
    async def test_validate_files_mixed(self, batch_agent, tmp_path):
        """Test file validation with mixed valid/invalid files."""
        # Create one valid PDF
        valid_file = tmp_path / "valid.pdf"
        valid_file.write_bytes(b"PDF content")

        files = [
            str(valid_file),
            "/nonexistent/file.pdf",
            str(tmp_path / "not_pdf.txt"),
        ]
        # Write to text file
        (tmp_path / "not_pdf.txt").write_text("Not a PDF")

        result = await batch_agent._validate_files(files)

        assert result["success"] is True
        assert len(result["files"]) == 1
        assert len(result["invalid"]) == 2
        assert result["invalid"][0]["error"] == "File not found"
        assert result["invalid"][1]["error"] == "Not a PDF file"

    def test_create_batches(self, batch_agent):
        """Test batch creation."""
        files = ["file1.pdf", "file2.pdf", "file3.pdf", "file4.pdf", "file5.pdf"]

        # Test with batch size 2
        batches = batch_agent._create_batches(files, 2)
        assert len(batches) == 3
        assert len(batches[0]) == 2
        assert len(batches[1]) == 2
        assert len(batches[2]) == 1

        # Test with batch size larger than file count
        batches = batch_agent._create_batches(files, 10)
        assert len(batches) == 1
        assert len(batches[0]) == 5

    @pytest.mark.asyncio
    async def test_process_batch(self, batch_agent):
        """Test single batch processing."""
        files = ["/path/to/file1.pdf", "/path/to/file2.pdf"]
        workflow = "extract"
        options = {"parallel_tasks": 2, "failed_retry": 1}

        # Mock _process_single_file
        batch_agent._process_single_file = AsyncMock(
            side_effect=[
                {"file_path": files[0], "success": True, "result": "processed1"},
                {"file_path": files[1], "success": True, "result": "processed2"},
            ]
        )

        results = await batch_agent._process_batch(files, workflow, options)

        assert len(results) == 2
        assert results[0]["success"] is True
        assert results[1]["success"] is True

    @pytest.mark.asyncio
    async def test_process_batch_with_exception(self, batch_agent):
        """Test batch processing with exceptions."""
        files = ["/path/to/file1.pdf", "/path/to/file2.pdf"]
        workflow = "extract"
        options = {"parallel_tasks": 2, "failed_retry": 0}

        # Mock _process_single_file to raise exception for second file
        batch_agent._process_single_file = AsyncMock(
            side_effect=[
                {"file_path": files[0], "success": True},
                Exception("Processing failed"),
            ]
        )

        results = await batch_agent._process_batch(files, workflow, options)

        assert len(results) == 2
        assert results[0]["success"] is True
        assert results[1]["success"] is False
        assert "Processing failed" in results[1]["error"]

    @pytest.mark.asyncio
    async def test_process_single_file_success(self, batch_agent, tmp_path):
        """Test successful single file processing."""
        file_path = tmp_path / "test.pdf"
        file_path.write_bytes(b"PDF content")
        batch_agent.papers_dir = tmp_path

        # Mock WorkflowAgent
        with patch("cognizes.agents.claude.workflow_agent.WorkflowAgent") as mock_workflow:
            mock_agent = AsyncMock()
            mock_agent.process.return_value = {
                "success": True,
                "data": {"content": "processed content"},
            }
            mock_workflow.return_value = mock_agent

            result = await batch_agent._process_single_file(str(file_path), "extract", 1)

            assert result["success"] is True
            assert result["file_path"] == str(file_path)
            assert "paper_id" in result
            assert result["attempt"] == 1

    @pytest.mark.asyncio
    async def test_process_single_file_with_retry(self, batch_agent, tmp_path):
        """Test single file processing with retry."""
        file_path = tmp_path / "test.pdf"
        file_path.write_bytes(b"PDF content")
        batch_agent.papers_dir = tmp_path

        # Mock WorkflowAgent to fail then succeed
        with patch("cognizes.agents.claude.workflow_agent.WorkflowAgent") as mock_workflow:
            mock_agent = AsyncMock()
            mock_agent.process.side_effect = [
                {"success": False, "error": "First attempt failed"},
                {"success": True, "data": {"content": "processed content"}},
            ]
            mock_workflow.return_value = mock_agent

            result = await batch_agent._process_single_file(str(file_path), "extract", 2)

            assert result["success"] is True
            assert result["attempt"] == 2

    @pytest.mark.asyncio
    async def test_process_single_file_all_attempts_failed(self, batch_agent, tmp_path):
        """Test single file processing when all attempts fail."""
        file_path = tmp_path / "test.pdf"
        file_path.write_bytes(b"PDF content")

        # Mock WorkflowAgent to always fail
        with patch("cognizes.agents.claude.workflow_agent.WorkflowAgent") as mock_workflow:
            mock_agent = AsyncMock()
            mock_agent.process.return_value = {
                "success": False,
                "error": "Always fails",
            }
            mock_workflow.return_value = mock_agent

            result = await batch_agent._process_single_file(str(file_path), "extract", 2)

            assert result["success"] is False
            assert result["error"] == "Always fails"
            assert result["attempts"] == 3  # 2 retries + 1 initial

    @pytest.mark.asyncio
    async def test_process_single_file_exception_handling(self, batch_agent, tmp_path):
        """Test single file processing with exception."""
        file_path = tmp_path / "test.pdf"
        file_path.write_bytes(b"PDF content")

        # Mock WorkflowAgent to raise exception
        with patch("cognizes.agents.claude.workflow_agent.WorkflowAgent") as mock_workflow:
            mock_agent = AsyncMock()
            mock_agent.process.side_effect = Exception("Unexpected error")
            mock_workflow.return_value = mock_agent

            result = await batch_agent._process_single_file(str(file_path), "extract", 1)

            assert result["success"] is False
            assert "Unexpected error" in result["error"]
            assert result["attempts"] == 2

    def test_get_category_from_path_known_category(self, batch_agent):
        """Test category extraction from known category path."""
        file_path = "/path/to/llm-agents/research/paper.pdf"
        category = batch_agent._get_category_from_path(file_path)
        assert category == "llm-agents"

        file_path = "/data/context-engineering/study.pdf"
        category = batch_agent._get_category_from_path(file_path)
        assert category == "context-engineering"

    def test_get_category_from_path_unknown_category(self, batch_agent):
        """Test category extraction from unknown path."""
        file_path = "/unknown/path/paper.pdf"
        category = batch_agent._get_category_from_path(file_path)
        assert category == "general"

        file_path = "paper.pdf"
        category = batch_agent._get_category_from_path(file_path)
        assert category == "general"

    def test_get_category_from_path_case_insensitive(self, batch_agent):
        """Test category extraction with case insensitive matching."""
        file_path = "/Path/To/LlM-Agents/Paper.pdf"
        category = batch_agent._get_category_from_path(file_path)
        assert category == "llm-agents"

    def test_calculate_stats_all_successful(self, batch_agent):
        """Test stats calculation with all successful results."""
        from datetime import datetime, timedelta

        start_time = datetime.now()
        end_time = start_time + timedelta(seconds=10)

        results = [
            {"success": True, "workflow": "extract"},
            {"success": True, "workflow": "extract"},
            {"success": True, "workflow": "translate"},
        ]

        stats = batch_agent._calculate_stats(results, start_time, end_time)

        assert stats["total"] == 3
        assert stats["successful"] == 3
        assert stats["failed"] == 0
        assert stats["success_rate"] == 100.0
        assert stats["duration"] == 10.0
        assert stats["throughput"] == 0.3
        assert len(stats["workflow_stats"]) == 2
        assert stats["workflow_stats"]["extract"]["total"] == 2
        assert stats["workflow_stats"]["extract"]["successful"] == 2

    def test_calculate_stats_mixed_results(self, batch_agent):
        """Test stats calculation with mixed results."""
        from datetime import datetime, timedelta

        start_time = datetime.now()
        end_time = start_time + timedelta(seconds=5)

        results = [
            {"success": True, "workflow": "full"},
            {"success": False, "workflow": "full"},
            {"success": True, "workflow": "extract"},
        ]

        stats = batch_agent._calculate_stats(results, start_time, end_time)

        assert stats["total"] == 3
        assert stats["successful"] == 2
        assert stats["failed"] == 1
        assert stats["success_rate"] == 66.66666666666666
        assert stats["duration"] == 5.0
        assert stats["throughput"] == 0.6

    def test_calculate_stats_empty_results(self, batch_agent):
        """Test stats calculation with empty results."""
        from datetime import datetime

        start_time = datetime.now()
        end_time = datetime.now()

        results = []
        stats = batch_agent._calculate_stats(results, start_time, end_time)

        assert stats["total"] == 0
        assert stats["successful"] == 0
        assert stats["failed"] == 0
        assert stats["success_rate"] == 0
        assert stats["throughput"] == 0

    @pytest.mark.asyncio
    async def test_get_batch_status(self, batch_agent):
        """Test getting batch status."""
        batch_id = "test_batch_123"
        result = await batch_agent.get_batch_status(batch_id)

        assert result["batch_id"] == batch_id
        assert result["status"] == "not_implemented"

    @pytest.mark.asyncio
    async def test_cancel_batch(self, batch_agent):
        """Test cancelling batch."""
        batch_id = "test_batch_123"
        result = await batch_agent.cancel_batch(batch_id)

        assert result["batch_id"] == batch_id
        assert result["status"] == "cancelled"
        assert result["message"] == "not_implemented"

    @pytest.mark.asyncio
    async def test_batch_process_uses_default_options(self, batch_agent):
        """Test batch_process uses default options when none provided."""
        files = ["/path/to/file.pdf"]

        # Mock methods
        batch_agent._validate_files = AsyncMock(return_value={"success": True, "files": files, "invalid": []})
        batch_agent._process_batch = AsyncMock(return_value=[{"file_path": files[0], "success": True}])

        await batch_agent.batch_process({"files": files, "workflow": "full"})

        # Check that default options were used
        call_args, kwargs = batch_agent._process_batch.call_args
        # call_args is a tuple of (files, workflow, options)
        options_arg = call_args[2] if len(call_args) > 2 else kwargs.get("options", {})
        assert options_arg.get("batch_size", 10) == 10  # Default
        assert options_arg.get("parallel_tasks", 3) == 3  # Default
        assert options_arg.get("failed_retry", 2) == 2  # Default
