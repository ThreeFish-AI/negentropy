"""Unit tests for PaperService."""

import io
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import UploadFile

from cognizes.api.services.paper_service import PaperService
from cognizes.agents.claude.base import BaseAgent
from tests.agents.fixtures.mocks.mock_file_operations import (
    mock_file_manager,
    patch_file_operations,
)


@pytest.mark.unit
class TestPaperService:
    """Test cases for PaperService."""

    @pytest.fixture
    def paper_service(self, temp_dir):
        """Create a PaperService instance for testing."""
        with patch("cognizes.api.services.paper_service.settings") as mock_settings:
            mock_settings.PAPERS_DIR = str(temp_dir / "papers")
            service = PaperService()
            # Replace agents with mocks
            service.workflow_agent = AsyncMock()
            service.batch_agent = AsyncMock()
            service.heartfelt_agent = AsyncMock()
            yield service

    @pytest.fixture
    def mock_upload_file(self, sample_pdf_content):
        """Create a mock upload file."""
        file = MagicMock(spec=UploadFile)
        file.filename = "test_paper.pdf"
        file.file = io.BytesIO(sample_pdf_content)
        file.content_type = "application/pdf"
        return file

    @pytest.mark.asyncio
    async def test_upload_paper_success(self, paper_service, mock_upload_file, temp_dir):
        """Test successful paper upload."""
        # Setup mocks
        papers_dir = temp_dir / "papers"
        with patch_file_operations():
            mock_file_manager.add_file(
                str(papers_dir / "source/llm-agents/test_paper.pdf"),
                mock_upload_file.file.getvalue(),
            )
            mock_file_manager.mkdir(str(papers_dir / "source/llm-agents"), parents=True, exist_ok=True)

            with patch("cognizes.api.services.paper_service.datetime") as mock_datetime:
                mock_datetime.now.return_value.strftime.return_value = "20240115_143022"

                # Mock metadata saving
                with patch.object(paper_service, "_save_metadata", new_callable=AsyncMock):
                    result = await paper_service.upload_paper(mock_upload_file, "llm-agents")

                    # Assert result
                    assert result["paper_id"] == "llm-agents_20240115_143022_test_paper.pdf"
                    assert result["filename"] == "test_paper.pdf"
                    assert result["category"] == "llm-agents"
                    assert result["size"] == len(mock_upload_file.file.getvalue())

    @pytest.mark.asyncio
    async def test_upload_paper_invalid_filename(self, paper_service):
        """Test paper upload with invalid filename."""
        mock_file = MagicMock(spec=UploadFile)
        mock_file.filename = "../../../etc/passwd"
        mock_file.file = io.BytesIO(b"fake content")

        with patch.object(paper_service, "_save_metadata", new_callable=AsyncMock):
            result = await paper_service.upload_paper(mock_file, "test")

            # Should sanitize filename
            assert "etc_passwd" in result["paper_id"]
            assert result["category"] == "test"

    @pytest.mark.asyncio
    async def test_upload_paper_file_save_error(self, paper_service, mock_upload_file):
        """Test paper upload when file save fails."""
        with patch("builtins.open", side_effect=OSError("Disk full")):
            with pytest.raises(IOError):
                await paper_service.upload_paper(mock_upload_file, "test")

    @pytest.mark.asyncio
    async def test_process_paper_full_workflow(self, paper_service, temp_dir):
        """Test paper processing with full workflow."""
        paper_id = "test_paper_123"
        workflow = "full"

        # Setup mocks
        papers_dir = temp_dir / "papers"
        source_path = papers_dir / "source/test/test_paper_123.pdf"

        with patch.object(paper_service, "_get_source_path", return_value=source_path):
            with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
                mock_get_meta.return_value = {"workflows": {}}

                with patch_file_operations():
                    mock_file_manager.add_file(str(source_path), b"PDF content")
                    # Path.exists is already mocked by patch_file_operations()

                    # Mock workflow agent
                    paper_service.workflow_agent.process.return_value = {
                        "task_id": "task_123",
                        "status": "processing",
                        "success": True,
                        "result": "Processing started",
                    }

                    result = await paper_service.process_paper(paper_id, workflow)

                    assert result["paper_id"] == paper_id
                    assert result["workflow"] == workflow
                    assert result["status"] == "completed"
                    paper_service.workflow_agent.process.assert_called_once_with(
                        {
                            "source_path": str(source_path),
                            "workflow": workflow,
                            "paper_id": paper_id,
                            "options": {},
                        }
                    )

    @pytest.mark.asyncio
    async def test_process_paper_not_found(self, paper_service, temp_dir):
        """Test processing non-existent paper."""
        paper_id = "nonexistent_paper"

        papers_dir = temp_dir / "papers"
        source_path = papers_dir / "source/test/nonexistent_paper"

        with patch.object(paper_service, "_get_source_path", return_value=source_path):
            with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
                mock_get_meta.return_value = None  # No metadata means paper doesn't exist

                with patch_file_operations():
                    # File doesn't exist
                    mock_file_manager.files = {}
                    # Path.exists is already mocked by patch_file_operations()

                    with pytest.raises(ValueError, match="Paper not found"):
                        await paper_service.process_paper(paper_id, "full")

    @pytest.mark.asyncio
    async def test_process_paper_with_options(self, paper_service, temp_dir):
        """Test paper processing with custom options."""
        paper_id = "test_paper_123"
        workflow = "translate"
        options = {"preserve_format": True, "translation_style": "academic"}

        papers_dir = temp_dir / "papers"
        source_path = papers_dir / "source/test/test_paper_123.pdf"
        with patch.object(paper_service, "_get_source_path", return_value=source_path):
            with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
                mock_get_meta.return_value = {"workflows": {}}

                with patch_file_operations():
                    mock_file_manager.add_file(str(source_path), b"PDF content")
                    # Path.exists is already mocked by patch_file_operations()

                    paper_service.workflow_agent.process.return_value = {
                        "task_id": "task_456",
                        "status": "processing",
                        "success": True,
                        "result": "Processing started with options",
                    }

                    result = await paper_service.process_paper(paper_id, workflow, options)

                    paper_service.workflow_agent.process.assert_called_once_with(
                        {
                            "source_path": str(source_path),
                            "workflow": workflow,
                            "paper_id": paper_id,
                            "options": options,
                        }
                    )
                assert result["paper_id"] == paper_id
                assert result["workflow"] == workflow
                assert result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_get_paper_status(self, paper_service):
        """Test getting paper status."""
        paper_id = "test_paper_123"
        metadata = {
            "paper_id": paper_id,
            "status": "processing",
            "workflows": {
                "extract": {"status": "completed", "progress": 100},
                "translate": {"status": "processing", "progress": 50},
            },
        }

        with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
            mock_get_meta.return_value = metadata

            result = await paper_service.get_paper_status(paper_id)

            assert result["paper_id"] == paper_id
            assert result["status"] == "processing"
            assert result["workflows"]["extract"]["status"] == "completed"
            assert result["workflows"]["translate"]["progress"] == 50

    @pytest.mark.asyncio
    async def test_get_paper_status_not_found(self, paper_service):
        """Test getting status of non-existent paper."""
        paper_id = "nonexistent"

        with patch.object(paper_service, "_load_metadata", new_callable=AsyncMock) as mock_load:
            mock_load.return_value = None

            result = await paper_service.get_paper_status(paper_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_list_papers(self, paper_service):
        """Test listing papers."""
        from tests.agents.fixtures.mocks.mock_file_operations import (
            get_mock_file_manager,
        )

        mock_file_manager = get_mock_file_manager()

        # Get the papers_dir from the paper_service
        papers_dir = str(paper_service.papers_dir)

        # Add category directories and papers relative to the actual papers_dir
        mock_file_manager.directories.add(f"{papers_dir}/source")
        mock_file_manager.directories.add(f"{papers_dir}/source/llm-agents")
        mock_file_manager.directories.add(f"{papers_dir}/source/rl")
        mock_file_manager.directories.add(f"{papers_dir}/.metadata")

        # Add paper files
        mock_file_manager.add_file(f"{papers_dir}/source/llm-agents/paper_1.pdf", b"PDF content 1")
        mock_file_manager.add_file(f"{papers_dir}/source/rl/paper_2.pdf", b"PDF content 2")
        mock_file_manager.add_file(f"{papers_dir}/source/llm-agents/paper_3.pdf", b"PDF content 3")

        # Add metadata files
        import json

        metadata1 = {
            "status": "completed",
            "upload_time": "2024-01-15T14:30:22Z",
            "updated_at": "2024-01-15T14:30:22Z",
            "filename": "paper_1.pdf",
        }
        metadata2 = {
            "status": "processing",
            "upload_time": "2024-01-15T14:30:22Z",
            "updated_at": "2024-01-15T14:30:22Z",
            "filename": "paper_2.pdf",
        }
        metadata3 = {
            "status": "uploaded",
            "upload_time": "2024-01-15T14:30:22Z",
            "updated_at": "2024-01-15T14:30:22Z",
            "filename": "paper_3.pdf",
        }

        mock_file_manager.add_text_file(f"{papers_dir}/.metadata/paper_1.json", json.dumps(metadata1))
        mock_file_manager.add_text_file(f"{papers_dir}/.metadata/paper_2.json", json.dumps(metadata2))
        mock_file_manager.add_text_file(f"{papers_dir}/.metadata/paper_3.json", json.dumps(metadata3))

        with patch.object(paper_service, "_list_papers_internal", new_callable=AsyncMock) as mock_list:
            papers_list = [
                {
                    "paper_id": "paper_1",
                    "filename": "paper_1.pdf",
                    "category": "llm-agents",
                    "status": "completed",
                    "upload_time": "2024-01-15T14:30:22Z",
                    "updated_at": "2024-01-15T14:30:22Z",
                    "size": 1000,
                },
                {
                    "paper_id": "paper_2",
                    "filename": "paper_2.pdf",
                    "category": "test",
                    "status": "processing",
                    "upload_time": "2024-01-15T14:30:22Z",
                    "updated_at": "2024-01-15T14:30:22Z",
                    "size": 2000,
                },
                {
                    "paper_id": "paper_3",
                    "filename": "paper_3.pdf",
                    "category": "llm-agents",
                    "status": "uploaded",
                    "upload_time": "2024-01-15T14:30:22Z",
                    "updated_at": "2024-01-15T14:30:22Z",
                    "size": 3000,
                },
            ]

            def mock_list_internal(category=None, status=None, limit=20, offset=0):
                filtered_papers = papers_list
                if category:
                    filtered_papers = [p for p in filtered_papers if p["category"] == category]
                if status:
                    filtered_papers = [p for p in filtered_papers if p["status"] == status]
                total = len(filtered_papers)
                filtered_papers = filtered_papers[offset : offset + limit]
                return {"papers": filtered_papers, "total": total}

            mock_list.side_effect = mock_list_internal

            with patch_file_operations(custom_file_manager=mock_file_manager):
                # Test without filter
                result = await paper_service.list_papers()
                assert len(result["papers"]) == 3

                # Test with category filter
                result = await paper_service.list_papers(category="llm-agents")
                assert len(result["papers"]) == 2
                assert all(p["category"] == "llm-agents" for p in result["papers"])

                # Test with status filter
                result = await paper_service.list_papers(status="processing")
                assert len(result["papers"]) == 1
                assert result["papers"][0]["status"] == "processing"

    @pytest.mark.asyncio
    async def test_list_papers_empty(self, paper_service):
        """Test listing papers when none exist."""
        with patch.object(paper_service, "_list_all_metadata", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = []

            with patch_file_operations():
                result = await paper_service.list_papers()
                assert result["papers"] == []

    @pytest.mark.asyncio
    async def test_delete_paper(self, paper_service, temp_dir):
        """Test deleting a paper."""
        paper_id = "test_paper_123"

        papers_dir = temp_dir / "papers"
        source_path = papers_dir / "source/test/test_paper_123.pdf"
        metadata_path = papers_dir / ".metadata/test_paper_123.json"

        with patch.object(paper_service, "_get_source_path", return_value=source_path):
            with patch.object(paper_service, "_get_metadata_path", return_value=metadata_path):
                with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
                    mock_get_meta.return_value = {
                        "paper_id": paper_id,
                        "status": "uploaded",
                    }

                    with patch_file_operations():
                        mock_file_manager.add_file(str(source_path), b"PDF content")
                        mock_file_manager.add_file(str(metadata_path), b'{"paper_id": "test"}')

                        result = await paper_service.delete_paper(paper_id)

                        assert result is True

    @pytest.mark.asyncio
    async def test_delete_paper_not_found(self, paper_service):
        """Test deleting non-existent paper."""
        paper_id = "nonexistent"

        with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
            mock_get_meta.return_value = None

            with pytest.raises(ValueError, match="Paper not found"):
                await paper_service.delete_paper(paper_id)

    @pytest.mark.asyncio
    async def test_get_paper_content(self, paper_service):
        """Test getting paper content."""
        paper_id = "test_paper_123"
        content = "Extracted PDF content..."

        with patch.object(paper_service, "_get_output_path", return_value=Path("/test/output.json")):
            with patch_file_operations():
                mock_file_manager.add_file("/test/output.json", content)

                result = await paper_service.get_paper_content(paper_id, "extracted")

                assert result == content

    @pytest.mark.asyncio
    async def test_get_paper_content_not_found(self, paper_service):
        """Test getting content for non-existent output."""
        paper_id = "test_paper_123"
        output_path = Path("/test/nonexistent_output.json")

        with patch.object(paper_service, "_get_output_path", return_value=output_path):
            with patch_file_operations():
                # Ensure file doesn't exist in mock file manager
                # Don't add the file to mock_file_manager.files
                result = await paper_service.get_paper_content(paper_id, "extracted")

                assert result is None

    @pytest.mark.asyncio
    @patch("cognizes.api.services.paper_service.datetime")
    async def test_batch_translate(self, mock_datetime, paper_service):
        """Test batch translation of papers."""
        from tests.agents.fixtures.mocks.mock_file_operations import (
            get_mock_file_manager,
        )

        # Setup mock datetime to return fixed timestamp
        mock_datetime.now.return_value.strftime.return_value = "20240115143022"

        paper_ids = ["paper_1", "paper_2", "paper_3"]

        mock_file_manager = get_mock_file_manager()
        papers_dir = str(paper_service.papers_dir)

        # Add directories and files to mock file manager
        mock_file_manager.directories.add(f"{papers_dir}/source")
        mock_file_manager.directories.add(f"{papers_dir}/source/test")
        mock_file_manager.add_file(f"{papers_dir}/source/test/paper_1.pdf", b"PDF content 1")
        mock_file_manager.add_file(f"{papers_dir}/source/test/paper_2.pdf", b"PDF content 2")
        mock_file_manager.add_file(f"{papers_dir}/source/test/paper_3.pdf", b"PDF content 3")

        # Mock _get_source_path to return paths that exist
        def mock_get_source_path(paper_id):
            return Path(f"{papers_dir}/source/test/{paper_id}.pdf")

        with patch.object(paper_service, "_get_source_path", side_effect=mock_get_source_path):
            with patch_file_operations(custom_file_manager=mock_file_manager):
                # Clear any existing calls to the mock
                paper_service.batch_agent.batch_translate.reset_mock()

                paper_service.batch_agent.batch_process.return_value = {
                    "status": "processing",
                    "message": "Batch processing started",
                }

                result = await paper_service.batch_translate(paper_ids)

                assert result["batch_id"] == "batch_translate_20240115143022"
                assert result["total_requested"] == 3
                assert result["total_valid"] == 3
                paper_service.batch_agent.batch_process.assert_called_once_with(
                    {
                        "files": ["paper_1", "paper_2", "paper_3"],
                        "workflow": "translation",
                        "options": {},
                    }
                )

    def test_sanitize_filename(self, paper_service):
        """Test filename sanitization."""
        # Test normal filename
        assert paper_service._sanitize_filename("normal.pdf") == "normal.pdf"

        # Test filename with path
        assert paper_service._sanitize_filename("path/to/file.pdf") == "path_to_file.pdf"

        # Test filename with special characters
        assert paper_service._sanitize_filename("file@#$%.pdf") == "file____.pdf"

        # Test empty filename
        assert paper_service._sanitize_filename("") == "unnamed"

    @pytest.mark.asyncio
    @patch("cognizes.api.services.paper_service.datetime")
    async def test_heartfelt_analysis(self, mock_datetime, paper_service, temp_dir):
        """Test heartfelt analysis of paper."""
        from tests.agents.fixtures.mocks.mock_file_operations import (
            get_mock_file_manager,
        )

        # Setup mock datetime to return fixed timestamp
        mock_datetime.now.return_value.strftime.return_value = "20240115143022"

        paper_id = "test_paper_123"

        mock_file_manager = get_mock_file_manager()
        papers_dir = str(paper_service.papers_dir)
        source_path = Path(f"{papers_dir}/source/test/test_paper_123.pdf")

        # Add file to mock file manager so exists() returns True
        mock_file_manager.add_file(f"{papers_dir}/source/test/test_paper_123.pdf", b"PDF content")
        mock_file_manager.directories.add(f"{papers_dir}/source")
        mock_file_manager.directories.add(f"{papers_dir}/source/test")

        with patch.object(paper_service, "_get_source_path", return_value=source_path):
            with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
                mock_get_meta.return_value = {"workflows": {}}

                with patch.object(
                    BaseAgent,
                    "call_skill",
                    return_value={
                        "success": True,
                        "data": {"analysis_id": "analysis_123", "status": "processing"},
                    },
                ):
                    with patch.object(paper_service, "_update_status", new_callable=AsyncMock):
                        with patch_file_operations(custom_file_manager=mock_file_manager):
                            # Clear any existing calls to the mock
                            paper_service.heartfelt_agent.analyze.reset_mock()

                            paper_service.heartfelt_agent.analyze.return_value = {
                                "success": True,
                                "data": {
                                    "analysis_id": "analysis_123",
                                    "status": "processing",
                                },
                            }

                            result = await paper_service.analyze_paper(paper_id)

                            assert result["analysis_id"] == "analysis_test_paper_123_20240115143022"
                            assert result["paper_id"] == paper_id
                            assert result["status"] == "completed"
                            paper_service.heartfelt_agent.analyze.assert_called_once_with({"paper_id": paper_id})

    @pytest.mark.asyncio
    async def test_get_paper_info(self, paper_service, temp_dir):
        """Test getting complete paper info."""
        from tests.agents.fixtures.mocks.mock_file_operations import (
            get_mock_file_manager,
        )

        paper_id = "test_paper_123"
        metadata = {
            "paper_id": paper_id,
            "filename": "test.pdf",
            "category": "llm-agents",
            "status": "completed",
            "upload_time": "2024-01-15T14:30:22Z",
            "workflows": {
                "extract": {"status": "completed"},
                "translate": {"status": "completed"},
                "heartfelt": {"status": "completed"},
            },
        }

        mock_file_manager = get_mock_file_manager()
        papers_dir = str(paper_service.papers_dir)
        source_path = Path(f"{papers_dir}/source/test/test.pdf")

        # Add file to mock file manager so exists() returns True
        mock_file_manager.add_file(str(source_path), b"PDF content" * 1000)  # Large content
        mock_file_manager.directories.add(f"{papers_dir}/source")
        mock_file_manager.directories.add(f"{papers_dir}/source/test")

        with patch.object(paper_service, "_get_source_path", return_value=source_path):
            with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
                mock_get_meta.return_value = metadata

                with patch_file_operations(custom_file_manager=mock_file_manager):
                    result = await paper_service.get_paper_info(paper_id)

                    assert isinstance(result, dict)
                    assert result["paper_id"] == paper_id
                    assert result["filename"] == "test.pdf"
                    assert result["size"] == 11000
                    assert result["category"] == "llm-agents"
                    assert result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_update_paper_metadata(self, paper_service):
        """Test updating paper metadata."""
        paper_id = "test_paper_123"
        updates = {
            "status": "completed",
            "workflows": {
                "extract": {"status": "completed", "progress": 100},
                "translate": {"status": "completed", "progress": 100},
            },
        }

        with patch.object(paper_service, "_load_metadata", new_callable=AsyncMock) as mock_load:
            mock_load.return_value = {
                "paper_id": paper_id,
                "status": "processing",
                "workflows": {},
            }

            with patch.object(paper_service, "_save_metadata", new_callable=AsyncMock):
                result = await paper_service.update_paper_metadata(paper_id, updates)

                assert result is True

    @pytest.mark.asyncio
    async def test_translate_paper(self, paper_service, temp_dir):
        """Test translating a paper."""
        paper_id = "test_paper_123"

        papers_dir = temp_dir / "papers"
        source_path = papers_dir / "source/test/test_paper_123.pdf"

        with patch.object(paper_service, "_get_source_path", return_value=source_path):
            with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
                mock_get_meta.return_value = {
                    "paper_id": paper_id,
                    "status": "extracted",
                    "workflows": {"extract": {"status": "completed"}},
                }

                with patch_file_operations():
                    mock_file_manager.add_file(str(source_path), b"PDF content")

                    # Mock workflow agent for translation
                    paper_service.workflow_agent.process.return_value = {
                        "success": True,
                        "task_id": "translate_task_123",
                        "result": {
                            "translated_content": "Translated paper content",
                            "target_language": "zh",
                            "translation_stats": {
                                "total_characters": 5000,
                                "translated_characters": 4800,
                            },
                        },
                    }

                    result = await paper_service.translate_paper(paper_id)

                    assert result["success"] is True
                    assert result["task_id"] == "translate_task_123"
                    assert "translated_content" in result["result"]
                    paper_service.workflow_agent.process.assert_called_once()

    @pytest.mark.asyncio
    async def test_translate_paper_not_extracted(self, paper_service):
        """Test translating a paper that hasn't been extracted."""
        paper_id = "test_paper_123"

        with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
            mock_get_meta.return_value = {
                "paper_id": paper_id,
                "status": "uploaded",
                "workflows": {},
            }

            with pytest.raises(ValueError, match="Paper must be extracted before translation"):
                await paper_service.translate_paper(paper_id)

    @pytest.mark.asyncio
    async def test_translate_paper_not_found(self, paper_service):
        """Test translating a non-existent paper."""
        paper_id = "nonexistent_paper"

        with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
            mock_get_meta.return_value = None

            with pytest.raises(ValueError, match="Paper not found"):
                await paper_service.translate_paper(paper_id)

    @pytest.mark.asyncio
    async def test_translate_paper_with_options(self, paper_service, temp_dir):
        """Test translating a paper with custom options."""
        paper_id = "test_paper_123"
        options = {
            "target_language": "zh",
            "preserve_format": True,
            "translation_style": "academic",
        }

        papers_dir = temp_dir / "papers"
        source_path = papers_dir / "source/test/test_paper_123.pdf"

        with patch.object(paper_service, "_get_source_path", return_value=source_path):
            with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
                mock_get_meta.return_value = {
                    "paper_id": paper_id,
                    "status": "extracted",
                    "workflows": {"extract": {"status": "completed"}},
                }

                with patch_file_operations():
                    mock_file_manager.add_file(str(source_path), b"PDF content")

                    paper_service.workflow_agent.process.return_value = {
                        "success": True,
                        "task_id": "translate_task_456",
                        "result": {"translated_content": "Academic translation"},
                    }

                    result = await paper_service.translate_paper(paper_id, options)

                    assert result["success"] is True
                    # Verify options were passed through
                    call_args = paper_service.workflow_agent.process.call_args[0][0]
                    assert call_args["options"] == options

    @pytest.mark.asyncio
    async def test_analyze_paper(self, paper_service, temp_dir):
        """Test analyzing a paper."""
        paper_id = "test_paper_123"

        papers_dir = temp_dir / "papers"
        source_path = papers_dir / "source/test/test_paper_123.pdf"

        with patch.object(paper_service, "_get_source_path", return_value=source_path):
            with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
                mock_get_meta.return_value = {
                    "paper_id": paper_id,
                    "status": "extracted",
                    "workflows": {"extract": {"status": "completed"}},
                }

                with patch_file_operations():
                    mock_file_manager.add_file(str(source_path), b"PDF content")

                    # Mock heartfelt agent for analysis
                    paper_service.heartfelt_agent.analyze.return_value = {
                        "success": True,
                        "analysis_id": "analysis_123",
                        "result": {
                            "summary": "Paper summary",
                            "key_insights": ["Insight 1", "Insight 2"],
                            "methodology": "Research methodology",
                            "conclusions": "Research conclusions",
                        },
                    }

                    result = await paper_service.analyze_paper(paper_id)

                    assert result["success"] is True
                    assert result["analysis_id"] == "analysis_123"
                    assert "summary" in result["result"]
                    assert "key_insights" in result["result"]
                    paper_service.heartfelt_agent.analyze.assert_called_once_with({"paper_id": paper_id})

    @pytest.mark.asyncio
    async def test_analyze_paper_not_extracted(self, paper_service):
        """Test analyzing a paper that hasn't been extracted."""
        paper_id = "test_paper_123"

        with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
            mock_get_meta.return_value = {
                "paper_id": paper_id,
                "status": "uploaded",
                "workflows": {},
            }

            with pytest.raises(ValueError, match="Paper must be extracted before analysis"):
                await paper_service.analyze_paper(paper_id)

    @pytest.mark.asyncio
    async def test_analyze_paper_not_found(self, paper_service):
        """Test analyzing a non-existent paper."""
        paper_id = "nonexistent_paper"

        with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
            mock_get_meta.return_value = None

            with pytest.raises(ValueError, match="Paper not found"):
                await paper_service.analyze_paper(paper_id)

    @pytest.mark.asyncio
    async def test_analyze_paper_with_type(self, paper_service, temp_dir):
        """Test analyzing a paper with specific analysis type."""
        paper_id = "test_paper_123"
        analysis_type = "methodology"

        papers_dir = temp_dir / "papers"
        source_path = papers_dir / "source/test/test_paper_123.pdf"

        with patch.object(paper_service, "_get_source_path", return_value=source_path):
            with patch.object(paper_service, "_get_metadata", new_callable=AsyncMock) as mock_get_meta:
                mock_get_meta.return_value = {
                    "paper_id": paper_id,
                    "status": "extracted",
                    "workflows": {"extract": {"status": "completed"}},
                }

                with patch_file_operations():
                    mock_file_manager.add_file(str(source_path), b"PDF content")

                    paper_service.heartfelt_agent.analyze.return_value = {
                        "success": True,
                        "analysis_id": "methodology_analysis_123",
                        "result": {"methodology": "Detailed methodology analysis"},
                    }

                    result = await paper_service.analyze_paper(paper_id, analysis_type)

                    assert result["success"] is True
                    assert result["analysis_id"] == "methodology_analysis_123"
                    # Verify analysis type was passed through
                    call_args = paper_service.heartfelt_agent.analyze.call_args[0][0]
                    assert call_args["analysis_type"] == analysis_type

    @pytest.mark.asyncio
    async def test_batch_translate_all_success(self, paper_service):
        """Test batch translation with all papers successful."""
        paper_ids = ["paper_1", "paper_2", "paper_3"]

        # Mock translate_paper for each paper
        async def mock_translate(paper_id, options=None):
            return {
                "success": True,
                "task_id": f"task_{paper_id}",
                "result": {"translated_content": f"Content for {paper_id}"},
            }

        with patch.object(paper_service, "translate_paper", side_effect=mock_translate):
            result = await paper_service.batch_translate(paper_ids)

            assert result["total_requested"] == 3
            assert result["total_success"] == 3
            assert result["total_failed"] == 0
            assert len(result["results"]) == 3
            assert all(r["success"] for r in result["results"])

    @pytest.mark.asyncio
    async def test_batch_translate_partial_failure(self, paper_service):
        """Test batch translation with some failures."""
        paper_ids = ["paper_1", "paper_2", "paper_3"]

        # Mock translate_paper with mixed success/failure
        async def mock_translate(paper_id, options=None):
            if paper_id == "paper_2":
                raise ValueError("Translation failed")
            return {
                "success": True,
                "task_id": f"task_{paper_id}",
                "result": {"translated_content": f"Content for {paper_id}"},
            }

        with patch.object(paper_service, "translate_paper", side_effect=mock_translate):
            result = await paper_service.batch_translate(paper_ids)

            assert result["total_requested"] == 3
            assert result["total_success"] == 2
            assert result["total_failed"] == 1
            assert len(result["results"]) == 3
            assert result["results"][0]["success"] is True
            assert result["results"][1]["success"] is False
            assert result["results"][2]["success"] is True

    @pytest.mark.asyncio
    async def test_batch_translate_empty_list(self, paper_service):
        """Test batch translation with empty paper list."""
        result = await paper_service.batch_translate([])

        assert result["total_requested"] == 0
        assert result["total_success"] == 0
        assert result["total_failed"] == 0
        assert result["results"] == []

    @pytest.mark.asyncio
    async def test_batch_translate_with_options(self, paper_service):
        """Test batch translation with custom options."""
        paper_ids = ["paper_1", "paper_2"]
        options = {"target_language": "zh", "preserve_format": True}

        # Track calls to verify options are passed
        calls = []

        async def mock_translate(paper_id, opts=None):
            calls.append((paper_id, opts))
            return {"success": True, "task_id": f"task_{paper_id}"}

        with patch.object(paper_service, "translate_paper", side_effect=mock_translate):
            result = await paper_service.batch_translate(paper_ids, options)

            assert result["total_success"] == 2
            # Verify options were passed to each call
            assert all(call[1] == options for call in calls)

    @pytest.mark.asyncio
    async def test_batch_translate_concurrent(self, paper_service):
        """Test batch translation runs concurrently."""
        import asyncio

        paper_ids = ["paper_1", "paper_2", "paper_3"]

        # Track execution order
        execution_order = []

        async def mock_translate(paper_id, options=None):
            execution_order.append(paper_id)
            # Add small delay to test concurrency
            await asyncio.sleep(0.01)
            return {"success": True, "task_id": f"task_{paper_id}"}

        with patch.object(paper_service, "translate_paper", side_effect=mock_translate):
            start_time = asyncio.get_event_loop().time()
            result = await paper_service.batch_translate(paper_ids)
            end_time = asyncio.get_event_loop().time()

            # Should complete quickly due to concurrency
            assert (end_time - start_time) < 0.05  # Much less than 3 * 0.01
            assert result["total_success"] == 3
