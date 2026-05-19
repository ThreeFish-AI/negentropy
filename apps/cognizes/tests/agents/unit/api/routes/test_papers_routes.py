"""Unit tests for papers routes."""

import io

import pytest
from fastapi.testclient import TestClient

from cognizes.api.main import app
from cognizes.api.routes.papers import get_paper_service
from tests.agents.fixtures.factories.paper_factory import (
    PaperUploadResponseFactory,
)


@pytest.mark.unit
class TestPapersRoutes:
    """Test cases for papers API routes."""

    @pytest.fixture
    def client(self, mock_paper_service):
        """Create a test client."""
        app.dependency_overrides[get_paper_service] = lambda: mock_paper_service
        return TestClient(app)

    def test_upload_paper_success(self, client, mock_paper_service, sample_pdf_content):
        """Test successful paper upload."""
        # Setup mock response
        mock_response = PaperUploadResponseFactory()
        # Convert to dict for the service - make it return an awaitable coroutine
        mock_paper_service.upload_paper.return_value = mock_response.model_dump()

        # Create test file
        file_content = io.BytesIO(sample_pdf_content)

        response = client.post(
            "/api/papers/upload",
            files={"file": ("test.pdf", file_content, "application/pdf")},
            params={"category": "llm-agents"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["paper_id"] == mock_response.paper_id
        assert data["filename"] == mock_response.filename
        assert data["category"] == mock_response.category

    def test_upload_paper_invalid_file_type(self, client):
        """Test upload with invalid file type."""
        file_content = io.BytesIO(b"Not a PDF")

        response = client.post(
            "/api/papers/upload",
            files={"file": ("test.txt", file_content, "text/plain")},
            params={"category": "test"},
        )

        assert response.status_code == 400
        assert "只支持 PDF 文件" in response.json()["detail"]

    def test_upload_paper_file_too_large(self, client):
        """Test upload with file too large."""
        # Create actual large file content (60MB)
        response = client.post(
            "/api/papers/upload",
            files={"file": ("large.pdf", b"x" * (60 * 1024 * 1024), "application/pdf")},
            params={"category": "test"},
        )

        assert response.status_code == 400
        assert "文件大小不能超过 50MB" in response.json()["detail"]

    def test_upload_paper_service_error(self, client, mock_paper_service):
        """Test upload when service raises an error."""
        mock_paper_service.upload_paper.side_effect = Exception("Service error")

        file_content = io.BytesIO(b"%PDF content")

        response = client.post(
            "/api/papers/upload",
            files={"file": ("test.pdf", file_content, "application/pdf")},
            params={"category": "test"},
        )

        assert response.status_code == 500
        assert "上传失败" in response.json()["detail"]

    def test_process_paper_success(self, client, mock_paper_service):
        """Test successful paper processing."""
        paper_id = "test_paper_123"
        workflow = "full"
        request_data = {"workflow": workflow, "options": {"extract_images": True}}

        mock_response = {"task_id": "task_456", "status": "processing"}
        mock_paper_service.process_paper.return_value = mock_response

        response = client.post(f"/api/papers/{paper_id}/process", json=request_data)

        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == "task_456"
        assert data["status"] == "processing"
        mock_paper_service.process_paper.assert_called_once_with(paper_id, workflow, options={"extract_images": True})

    def test_process_paper_not_found(self, client, mock_paper_service):
        """Test processing non-existent paper."""
        paper_id = "nonexistent"
        request_data = {"workflow": "full"}

        mock_paper_service.process_paper.side_effect = ValueError("Paper not found")

        response = client.post(f"/api/papers/{paper_id}/process", json=request_data)

        assert response.status_code == 404
        assert "Paper not found" in response.json()["detail"]

    def test_process_paper_invalid_request(self, client):
        """Test processing with invalid request data."""
        paper_id = "test_paper"
        # Invalid JSON structure
        request_data = "not a valid json"

        response = client.post(
            f"/api/papers/{paper_id}/process",
            data=request_data,
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 422  # Validation error

    def test_get_paper_status_success(self, client, mock_paper_service):
        """Test successful paper status retrieval."""
        paper_id = "test_paper_123"
        mock_status_dict = {
            "paper_id": paper_id,
            "status": "completed",
            "workflows": {
                "extract": {
                    "status": "completed",
                    "progress": 100,
                    "message": "Extraction completed",
                },
                "translate": {
                    "status": "completed",
                    "progress": 100,
                    "message": "Translation completed",
                },
                "heartfelt": {
                    "status": "pending",
                    "progress": 0,
                    "message": "Waiting to start",
                },
            },
            "upload_time": "2024-01-15T14:30:22Z",
            "updated_at": "2024-01-15T14:35:22Z",
            "category": "llm-agents",
            "filename": "test.pdf",
        }
        mock_paper_service.get_status.return_value = mock_status_dict

        response = client.get(f"/api/papers/{paper_id}/status")

        assert response.status_code == 200
        data = response.json()
        assert data["paper_id"] == paper_id
        assert data["status"] == "completed"

    def test_get_paper_status_not_found(self, client, mock_paper_service):
        """Test getting status of non-existent paper."""
        paper_id = "nonexistent"
        mock_paper_service.get_status.side_effect = ValueError("Paper not found")

        response = client.get(f"/api/papers/{paper_id}/status")

        assert response.status_code == 404
        assert "Paper not found" in response.json()["detail"]

    def test_get_paper_content_success(self, client, mock_paper_service):
        """Test successful paper content retrieval."""
        paper_id = "test_paper_123"
        content_type = "translation"
        content = "这是翻译后的内容..."

        mock_paper_service.get_content.return_value = {
            "content": content,
            "content_type": content_type,
        }

        response = client.get(f"/api/papers/{paper_id}/content", params={"content_type": content_type})

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == content

    def test_get_paper_content_invalid_type(self, client, mock_paper_service):
        """Test getting content with invalid type."""
        paper_id = "test_paper"

        response = client.get(f"/api/papers/{paper_id}/content", params={"content_type": "invalid"})

        assert response.status_code == 400
        assert "无效的内容类型" in response.json()["detail"]

    def test_get_paper_content_not_found(self, client, mock_paper_service):
        """Test getting content of non-existent paper."""
        paper_id = "nonexistent"
        mock_paper_service.get_content.side_effect = ValueError("Paper not found")

        response = client.get(f"/api/papers/{paper_id}/content", params={"content_type": "translation"})

        assert response.status_code == 404

    def test_list_papers_success(self, client, mock_paper_service):
        """Test successful paper listing."""
        papers = [
            {
                "paper_id": "paper_1",
                "filename": "test1.pdf",
                "category": "llm-agents",
                "status": "completed",
                "upload_time": "2024-01-15T14:30:22Z",
                "updated_at": "2024-01-15T14:35:22Z",
                "size": 1024000,
            },
            {
                "paper_id": "paper_2",
                "filename": "test2.pdf",
                "category": "rl",
                "status": "processing",
                "upload_time": "2024-01-15T14:31:22Z",
                "updated_at": "2024-01-15T14:36:22Z",
                "size": 2048000,
            },
        ]

        mock_paper_service.list_papers.return_value = {
            "papers": papers,
            "total": 2,
            "limit": 20,
            "offset": 0,
        }

        response = client.get("/api/papers/")

        assert response.status_code == 200
        data = response.json()
        assert len(data["papers"]) == 2
        assert data["total"] == 2

    def test_list_papers_with_filters(self, client, mock_paper_service):
        """Test listing papers with filters."""
        category = "llm-agents"
        status = "completed"
        paper = {
            "paper_id": "paper_1",
            "filename": "test1.pdf",
            "category": category,
            "status": status,
            "upload_time": "2024-01-15T14:30:22Z",
            "updated_at": "2024-01-15T14:35:22Z",
            "size": 1024000,
        }

        mock_paper_service.list_papers.return_value = {
            "papers": [paper],
            "total": 1,
            "limit": 20,
            "offset": 0,
        }

        response = client.get("/api/papers/", params={"category": category, "status": status})

        assert response.status_code == 200
        data = response.json()
        assert len(data["papers"]) == 1
        assert data["papers"][0]["category"] == category

    def test_list_papers_with_pagination(self, client, mock_paper_service):
        """Test listing papers with pagination."""
        limit = 10
        offset = 20

        mock_paper_service.list_papers.return_value = {
            "papers": [],
            "total": 50,
            "limit": limit,
            "offset": offset,
        }

        response = client.get("/api/papers/", params={"limit": limit, "offset": offset})

        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == limit
        assert data["offset"] == offset

    def test_list_papers_invalid_limit(self, client):
        """Test listing papers with invalid limit."""
        # Limit exceeds maximum
        response = client.get("/api/papers/", params={"limit": 200})

        assert response.status_code == 422  # Validation error

    def test_delete_paper_success(self, client, mock_paper_service):
        """Test successful paper deletion."""
        paper_id = "test_paper_123"
        mock_paper_service.delete_paper.return_value = True

        response = client.delete(f"/api/papers/{paper_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] is True
        assert data["paper_id"] == paper_id

    def test_delete_paper_not_found(self, client, mock_paper_service):
        """Test deleting non-existent paper."""
        paper_id = "nonexistent"
        mock_paper_service.delete_paper.side_effect = ValueError("Paper not found")

        response = client.delete(f"/api/papers/{paper_id}")

        assert response.status_code == 404
        assert "Paper not found" in response.json()["detail"]

    def test_batch_process_success(self, client, mock_paper_service):
        """Test successful batch processing."""
        paper_ids = ["paper_1", "paper_2", "paper_3"]
        workflow = "translate"

        mock_response = {
            "batch_id": "batch_123",
            "total_requested": 3,
            "total_files": 3,
            "workflow": workflow,
            "stats": {"success": 0, "failed": 0, "processing": 3},
            "results": [],
        }
        mock_paper_service.batch_process_papers.return_value = mock_response

        response = client.post("/api/papers/batch", params={"workflow": workflow}, json=paper_ids)

        assert response.status_code == 200
        data = response.json()
        assert data["batch_id"] == "batch_123"
        assert data["total_requested"] == 3
        assert data["total_files"] == 3
        assert data["workflow"] == workflow

    def test_batch_process_too_many_papers(self, client):
        """Test batch processing with too many papers."""
        # Create list with 51 papers (exceeds limit of 50)
        paper_ids = [f"paper_{i}" for i in range(51)]

        response = client.post("/api/papers/batch", json=paper_ids)

        assert response.status_code == 400
        assert "批量处理最多支持 50 个文件" in response.json()["detail"]

    def test_batch_process_error(self, client, mock_paper_service):
        """Test batch processing when service raises error."""
        paper_ids = ["paper_1", "paper_2"]
        mock_paper_service.batch_process_papers.side_effect = Exception("Service error")

        response = client.post("/api/papers/batch", json=paper_ids)

        assert response.status_code == 500
        assert "批量处理失败" in response.json()["detail"]

    def test_get_paper_report_success(self, client, mock_paper_service):
        """Test successful paper report retrieval."""
        paper_id = "test_paper_123"
        mock_report = {
            "summary": "论文摘要...",
            "insights": ["洞见1", "洞见2"],
            "recommendations": ["建议1", "建议2"],
        }
        mock_paper_service.get_paper_report.return_value = mock_report

        response = client.get(f"/api/papers/{paper_id}/report")

        assert response.status_code == 200
        data = response.json()
        assert data["summary"] == "论文摘要..."
        assert len(data["insights"]) == 2

    def test_get_paper_report_not_found(self, client, mock_paper_service):
        """Test getting report of non-existent paper."""
        paper_id = "nonexistent"
        mock_paper_service.get_paper_report.side_effect = ValueError("Paper not found")

        response = client.get(f"/api/papers/{paper_id}/report")

        assert response.status_code == 404

    def test_translate_paper_endpoint(self, client, mock_paper_service):
        """Test the translate paper endpoint."""
        paper_id = "test_paper_123"

        mock_response = {"task_id": "translate_task_123", "status": "processing"}
        mock_paper_service.translate_paper.return_value = mock_response

        response = client.post(f"/api/papers/{paper_id}/translate")

        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == "translate_task_123"

    def test_analyze_paper_endpoint(self, client, mock_paper_service):
        """Test the analyze paper endpoint."""
        paper_id = "test_paper_123"

        mock_response = {"analysis_id": "analysis_123", "status": "processing"}
        mock_paper_service.analyze_paper.return_value = mock_response

        response = client.post(f"/api/papers/{paper_id}/analyze")

        assert response.status_code == 200
        data = response.json()
        assert data["analysis_id"] == "analysis_123"

    @pytest.mark.parametrize(
        "endpoint,method",
        [
            ("/api/papers/nonexistent/status", "GET"),
            ("/api/papers/nonexistent/content", "GET"),
            ("/api/papers/nonexistent", "DELETE"),
            ("/api/papers/nonexistent/report", "GET"),
        ],
    )
    def test_paper_not_found_endpoints(self, client, mock_paper_service, endpoint, method):
        """Test various endpoints with non-existent paper."""
        mock_paper_service.get_status.side_effect = ValueError("Paper not found")
        mock_paper_service.get_content.side_effect = ValueError("Paper not found")
        mock_paper_service.delete_paper.side_effect = ValueError("Paper not found")
        mock_paper_service.get_paper_report.side_effect = ValueError("Paper not found")

        if method == "GET":
            response = client.get(endpoint)
        else:
            response = client.delete(endpoint)

        assert response.status_code == 404

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/api/papers/health")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
