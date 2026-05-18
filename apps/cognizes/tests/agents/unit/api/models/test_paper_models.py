"""Unit tests for paper models."""

import pytest
from pydantic import ValidationError

from cognizes.api.models.paper import (
    BatchProcessRequest,
    PaperContent,
    PaperInfo,
    PaperListResponse,
    PaperMetadata,
    PaperProcessRequest,
    PaperReport,
    PaperStatus,
    PaperUploadResponse,
)


@pytest.mark.unit
class TestPaperMetadata:
    """Test cases for PaperMetadata model."""

    def test_paper_metadata_creation(self):
        """Test PaperMetadata creation with required fields."""
        metadata = PaperMetadata(title="Test Paper", authors=["Author 1", "Author 2"], year=2024)
        assert metadata.title == "Test Paper"
        assert metadata.authors == ["Author 1", "Author 2"]
        assert metadata.year == 2024
        assert metadata.venue is None
        assert metadata.abstract is None
        assert metadata.pages is None
        assert metadata.doi is None
        assert metadata.keywords == []

    def test_paper_metadata_with_all_fields(self):
        """Test PaperMetadata creation with all fields."""
        metadata = PaperMetadata(
            title="Complete Paper",
            authors=["Author 1", "Author 2", "Author 3"],
            year=2024,
            venue="Test Conference",
            abstract="This is a test abstract",
            pages=10,
            doi="10.1234/test.paper",
            keywords=["AI", "Machine Learning", "NLP"],
        )
        assert metadata.title == "Complete Paper"
        assert len(metadata.authors) == 3
        assert metadata.venue == "Test Conference"
        assert metadata.abstract == "This is a test abstract"
        assert metadata.pages == 10
        assert metadata.doi == "10.1234/test.paper"
        assert len(metadata.keywords) == 3

    def test_paper_metadata_validation(self):
        """Test PaperMetadata validation."""
        # Test missing required fields
        with pytest.raises(ValidationError):
            PaperMetadata(title="Test")

        with pytest.raises(ValidationError):
            PaperMetadata(year=2024)

        # Test invalid year
        with pytest.raises(ValidationError):
            PaperMetadata(
                title="Test",
                authors=["Author"],
                year="invalid",  # Should be int
            )


@pytest.mark.unit
class TestPaperUploadResponse:
    """Test cases for PaperUploadResponse model."""

    def test_paper_upload_response_creation(self):
        """Test PaperUploadResponse creation."""
        response = PaperUploadResponse(
            paper_id="test_paper_123",
            filename="test.pdf",
            category="general",
            size=1024,
            upload_time="2024-01-15T14:30:00",
        )
        assert response.paper_id == "test_paper_123"
        assert response.filename == "test.pdf"
        assert response.category == "general"
        assert response.size == 1024
        assert response.upload_time == "2024-01-15T14:30:00"


@pytest.mark.unit
class TestPaperProcessRequest:
    """Test cases for PaperProcessRequest model."""

    def test_paper_process_request_default(self):
        """Test PaperProcessRequest with default values."""
        request = PaperProcessRequest()
        assert request.workflow == "full"
        assert request.options is None

    def test_paper_process_request_with_values(self):
        """Test PaperProcessRequest with custom values."""
        options = {"extract_images": True, "preserve_format": False}
        request = PaperProcessRequest(workflow="extract_only", options=options)
        assert request.workflow == "extract_only"
        assert request.options == options

    def test_paper_process_request_empty_options(self):
        """Test PaperProcessRequest with empty options."""
        request = PaperProcessRequest(workflow="translate", options={})
        assert request.workflow == "translate"
        assert request.options == {}


@pytest.mark.unit
class TestPaperStatus:
    """Test cases for PaperStatus model."""

    def test_paper_status_minimal(self):
        """Test PaperStatus with minimal required fields."""
        status = PaperStatus(paper_id="test_paper", status="processing")
        assert status.paper_id == "test_paper"
        assert status.status == "processing"
        assert status.workflows == {}
        assert status.upload_time is None
        assert status.updated_at is None
        assert status.category is None
        assert status.filename is None

    def test_paper_status_with_workflows(self):
        """Test PaperStatus with workflow states."""
        workflows = {
            "extract": {
                "status": "completed",
                "updated_at": "2024-01-15T14:35:00",
            },
            "translate": {"status": "processing", "progress": 75},
        }
        status = PaperStatus(
            paper_id="test_paper",
            status="processing",
            workflows=workflows,
            upload_time="2024-01-15T14:30:00",
            updated_at="2024-01-15T14:35:00",
            category="ai-research",
            filename="test.pdf",
        )
        assert status.workflows == workflows
        assert status.upload_time == "2024-01-15T14:30:00"
        assert status.updated_at == "2024-01-15T14:35:00"
        assert status.category == "ai-research"
        assert status.filename == "test.pdf"


@pytest.mark.unit
class TestPaperContent:
    """Test cases for PaperContent model."""

    def test_paper_content_with_text(self):
        """Test PaperContent with text content."""
        content = PaperContent(
            paper_id="test_paper",
            content_type="translation",
            format="markdown",
            content="# Paper Title\n\nThis is the content.",
            word_count=1000,
            size=2048,
        )
        assert content.paper_id == "test_paper"
        assert content.content_type == "translation"
        assert content.format == "markdown"
        assert content.word_count == 1000
        assert content.size == 2048

    def test_paper_content_with_file(self):
        """Test PaperContent with file path."""
        content = PaperContent(
            paper_id="test_paper",
            content_type="source",
            format="pdf",
            file_path="/path/to/paper.pdf",
        )
        assert content.content_type == "source"
        assert content.format == "pdf"
        assert content.file_path == "/path/to/paper.pdf"
        assert content.content is None

    def test_paper_content_with_metadata(self):
        """Test PaperContent with metadata."""
        metadata = {"extracted_at": "2024-01-15T14:30:00", "pages": 15}
        content = PaperContent(
            paper_id="test_paper",
            content_type="heartfelt",
            format="json",
            metadata=metadata,
        )
        assert content.metadata == metadata


@pytest.mark.unit
class TestPaperInfo:
    """Test cases for PaperInfo model."""

    def test_paper_info_creation(self):
        """Test PaperInfo creation."""
        metadata = PaperMetadata(title="Test Paper", authors=["Author 1"], year=2024)
        info = PaperInfo(
            paper_id="test_paper",
            filename="test.pdf",
            category="general",
            status="completed",
            upload_time="2024-01-15T14:30:00",
            size=1024,
            metadata=metadata,
        )
        assert info.paper_id == "test_paper"
        assert info.filename == "test.pdf"
        assert info.category == "general"
        assert info.status == "completed"
        assert info.upload_time == "2024-01-15T14:30:00"
        assert info.size == 1024
        assert info.metadata.title == "Test Paper"

    def test_paper_info_without_metadata(self):
        """Test PaperInfo without metadata."""
        info = PaperInfo(
            paper_id="test_paper",
            filename="test.pdf",
            category="general",
            status="uploaded",
            upload_time="2024-01-15T14:30:00",
            size=1024,
        )
        assert info.metadata is None


@pytest.mark.unit
class TestPaperListResponse:
    """Test cases for PaperListResponse model."""

    def test_paper_list_response_empty(self):
        """Test PaperListResponse with empty list."""
        response = PaperListResponse(papers=[], total=0, offset=0, limit=20)
        assert response.papers == []
        assert response.total == 0
        assert response.offset == 0
        assert response.limit == 20

    def test_paper_list_response_with_papers(self):
        """Test PaperListResponse with papers."""
        paper1 = PaperInfo(
            paper_id="paper1",
            filename="paper1.pdf",
            category="ai",
            status="completed",
            upload_time="2024-01-15T14:30:00",
            size=1024,
        )
        paper2 = PaperInfo(
            paper_id="paper2",
            filename="paper2.pdf",
            category="nlp",
            status="processing",
            upload_time="2024-01-15T14:35:00",
            size=2048,
        )
        response = PaperListResponse(papers=[paper1, paper2], total=2, offset=0, limit=20)
        assert len(response.papers) == 2
        assert response.total == 2
        assert response.papers[0].paper_id == "paper1"


@pytest.mark.unit
class TestBatchProcessRequest:
    """Test cases for BatchProcessRequest model."""

    def test_batch_process_request_creation(self):
        """Test BatchProcessRequest creation."""
        stats = {"completed": 5, "failed": 1, "total": 6}
        results = [
            {"paper_id": "paper1", "status": "completed"},
            {"paper_id": "paper2", "status": "failed", "error": "Processing error"},
        ]
        request = BatchProcessRequest(
            batch_id="batch_123",
            total_requested=10,
            total_files=6,
            workflow="full",
            stats=stats,
            results=results,
        )
        assert request.batch_id == "batch_123"
        assert request.total_requested == 10
        assert request.total_files == 6
        assert request.workflow == "full"
        assert request.stats == stats
        assert len(request.results) == 2


@pytest.mark.unit
class TestPaperReport:
    """Test cases for PaperReport model."""

    def test_paper_report_creation(self):
        """Test PaperReport creation."""
        report_content = {
            "summary": "This is a paper summary",
            "key_points": ["Point 1", "Point 2"],
            "analysis": "Detailed analysis",
        }
        report = PaperReport(paper_id="test_paper", report=report_content)
        assert report.paper_id == "test_paper"
        assert report.report == report_content
        assert report.report["summary"] == "This is a paper summary"
