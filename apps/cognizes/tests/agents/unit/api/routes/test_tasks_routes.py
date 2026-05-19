"""Unit tests for tasks routes."""

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from cognizes.api.routes.tasks import get_task_service, router


@pytest.mark.unit
class TestTasksRoutes:
    """Test cases for task management routes."""

    @pytest.fixture
    def client(self):
        """Create a test client."""
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router, prefix="/tasks")
        return TestClient(app)

    @pytest.fixture
    def mock_task_service(self):
        """Create a mock task service."""
        service = AsyncMock()
        service.list_tasks = AsyncMock()
        service.get_task = AsyncMock()
        service.cancel_task = AsyncMock()
        service.get_task_logs = AsyncMock()
        service.cleanup_completed_tasks = AsyncMock()
        return service

    def test_get_task_service(self):
        """Test task service dependency injection."""
        service = get_task_service()
        assert service is not None

    @pytest.mark.asyncio
    async def test_list_tasks_success(self, mock_task_service):
        """Test successful task listing."""
        from cognizes.api.routes.tasks import list_tasks

        # Mock successful response
        mock_task_service.list_tasks.return_value = {
            "tasks": [
                {
                    "task_id": "task1",
                    "paper_id": "paper1",
                    "status": "completed",
                    "workflow": "full",
                }
            ],
            "total": 1,
            "limit": 20,
            "offset": 0,
        }

        result = await list_tasks(
            status="completed",
            paper_id="paper1",
            limit=20,
            offset=0,
            service=mock_task_service,
        )

        assert result["total"] == 1
        assert len(result["tasks"]) == 1
        assert result["tasks"][0]["task_id"] == "task1"

    @pytest.mark.asyncio
    async def test_list_tasks_with_filters(self, mock_task_service):
        """Test task listing with various filters."""
        from cognizes.api.routes.tasks import list_tasks

        mock_task_service.list_tasks.return_value = {
            "tasks": [],
            "total": 0,
            "limit": 20,
            "offset": 0,
        }

        # Test with all filters
        await list_tasks(
            status="processing",
            paper_id="paper123",
            workflow="extract_only",
            limit=10,
            offset=5,
            service=mock_task_service,
        )

        # Verify service was called with correct parameters
        mock_task_service.list_tasks.assert_called_once_with(
            status="processing",
            paper_id="paper123",
            workflow="extract_only",
            limit=10,
            offset=5,
        )

    @pytest.mark.asyncio
    async def test_list_tasks_service_error(self, mock_task_service):
        """Test task listing with service error."""
        from fastapi import HTTPException

        from cognizes.api.routes.tasks import list_tasks

        mock_task_service.list_tasks.side_effect = Exception("Service error")

        with pytest.raises(HTTPException, match="获取任务列表失败"):
            await list_tasks(service=mock_task_service)

    @pytest.mark.asyncio
    async def test_get_task_success(self, mock_task_service):
        """Test successful task retrieval."""
        from cognizes.api.routes.tasks import get_task

        task_data = {
            "task_id": "task123",
            "paper_id": "paper456",
            "status": "processing",
            "workflow": "full",
            "progress": 50,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T01:00:00Z",
        }

        mock_task_service.get_task.return_value = task_data

        result = await get_task("task123", mock_task_service)

        assert result["task_id"] == "task123"
        assert result["status"] == "processing"
        mock_task_service.get_task.assert_called_once_with("task123")

    @pytest.mark.asyncio
    async def test_get_task_not_found(self, mock_task_service):
        """Test task retrieval when task not found."""
        from fastapi import HTTPException

        from cognizes.api.routes.tasks import get_task

        mock_task_service.get_task.side_effect = ValueError("Task not found")

        with pytest.raises(HTTPException) as exc:
            await get_task("nonexistent_task", mock_task_service)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_task_service_error(self, mock_task_service):
        """Test task retrieval with service error."""
        from fastapi import HTTPException

        from cognizes.api.routes.tasks import get_task

        mock_task_service.get_task.side_effect = Exception("Service error")

        with pytest.raises(HTTPException, match="获取任务失败"):
            await get_task("task123", mock_task_service)

    @pytest.mark.asyncio
    async def test_cancel_task_success(self, mock_task_service):
        """Test successful task cancellation."""
        from cognizes.api.routes.tasks import cancel_task

        mock_task_service.cancel_task.return_value = {
            "success": True,
            "task_id": "task123",
            "message": "Task cancelled successfully",
        }

        result = await cancel_task("task123", mock_task_service)

        assert result["success"] is True
        assert result["task_id"] == "task123"
        mock_task_service.cancel_task.assert_called_once_with("task123")

    @pytest.mark.asyncio
    async def test_cancel_task_not_found(self, mock_task_service):
        """Test task cancellation when task not found."""
        from fastapi import HTTPException

        from cognizes.api.routes.tasks import cancel_task

        mock_task_service.cancel_task.side_effect = ValueError("Task not found")

        with pytest.raises(HTTPException) as exc:
            await cancel_task("nonexistent_task", mock_task_service)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_cancel_task_service_error(self, mock_task_service):
        """Test task cancellation with service error."""
        from fastapi import HTTPException

        from cognizes.api.routes.tasks import cancel_task

        mock_task_service.cancel_task.side_effect = Exception("Service error")

        with pytest.raises(HTTPException, match="取消任务失败"):
            await cancel_task("task123", mock_task_service)

    @pytest.mark.asyncio
    async def test_get_task_logs_success(self, mock_task_service):
        """Test successful task logs retrieval."""
        from cognizes.api.routes.tasks import get_task_logs

        mock_logs = [
            "2024-01-01 10:00:00 - Task started",
            "2024-01-01 10:01:00 - Processing paper...",
            "2024-01-01 10:02:00 - Extraction completed",
        ]

        mock_task_service.get_task_logs.return_value = mock_logs

        result = await get_task_logs("task123", 100, mock_task_service)

        assert result["task_id"] == "task123"
        assert result["logs"] == mock_logs
        assert len(result["logs"]) == 3
        mock_task_service.get_task_logs.assert_called_once_with("task123", 100)

    @pytest.mark.asyncio
    async def test_get_task_logs_with_line_limit(self, mock_task_service):
        """Test task logs retrieval with line limit."""
        from cognizes.api.routes.tasks import get_task_logs

        mock_task_service.get_task_logs.return_value = ["log entry"]

        # Test with different line limits
        await get_task_logs("task123", 50, mock_task_service)
        mock_task_service.get_task_logs.assert_called_once_with("task123", 50)

        await get_task_logs("task123", 500, mock_task_service)
        mock_task_service.get_task_logs.assert_called_with("task123", 500)

    @pytest.mark.asyncio
    async def test_get_task_logs_not_found(self, mock_task_service):
        """Test task logs retrieval when task not found."""
        from fastapi import HTTPException

        from cognizes.api.routes.tasks import get_task_logs

        mock_task_service.get_task_logs.side_effect = ValueError("Task not found")

        with pytest.raises(HTTPException) as exc:
            await get_task_logs("nonexistent_task", 100, mock_task_service)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_cleanup_completed_tasks_success(self, mock_task_service):
        """Test successful cleanup of completed tasks."""
        from cognizes.api.routes.tasks import cleanup_completed_tasks

        mock_task_service.cleanup_completed_tasks.return_value = {
            "deleted_count": 10,
            "message": "Successfully cleaned up 10 completed tasks",
        }

        result = await cleanup_completed_tasks(24, mock_task_service)

        assert result["deleted_count"] == 10
        assert "message" in result
        mock_task_service.cleanup_completed_tasks.assert_called_once_with(24)

    @pytest.mark.asyncio
    async def test_cleanup_completed_tasks_with_custom_hours(self, mock_task_service):
        """Test cleanup with custom hours parameter."""
        from cognizes.api.routes.tasks import cleanup_completed_tasks

        mock_task_service.cleanup_completed_tasks.return_value = {"deleted_count": 0}

        await cleanup_completed_tasks(48, mock_task_service)
        mock_task_service.cleanup_completed_tasks.assert_called_once_with(48)

    @pytest.mark.asyncio
    async def test_cleanup_completed_tasks_service_error(self, mock_task_service):
        """Test cleanup with service error."""
        from fastapi import HTTPException

        from cognizes.api.routes.tasks import cleanup_completed_tasks

        mock_task_service.cleanup_completed_tasks.side_effect = Exception("Service error")

        with pytest.raises(HTTPException, match="清理任务失败"):
            await cleanup_completed_tasks(24, mock_task_service)

    def test_tasks_router_configuration(self):
        """Test that tasks router is properly configured."""
        assert router is not None
        assert hasattr(router, "routes")

        # Check that routes are defined
        route_paths = [route.path for route in router.routes]
        assert "/" in route_paths  # list_tasks
        assert "/{task_id}" in route_paths  # get_task, cancel_task
        assert "/{task_id}/logs" in route_paths  # get_task_logs
        assert "/cleanup" in route_paths  # cleanup_completed_tasks

    def test_route_methods(self):
        """Test that HTTP methods are correctly configured."""
        route_methods = {}
        for route in router.routes:
            # FastAPI may have different path representations
            path = getattr(route, "path", None)
            if path:
                route_methods[path] = route.methods

        # Debug: print actual routes
        print("\nActual routes found:")
        for path, methods in route_methods.items():
            print(f"  {path}: {methods}")

        # Check each route has the expected methods
        assert "GET" in route_methods["/"]

        # For /{task_id}, check both GET and DELETE exist
        # They might be on separate route objects with same path
        task_id_get = False
        task_id_delete = False
        for route in router.routes:
            if getattr(route, "path", None) == "/{task_id}":
                if "GET" in route.methods:
                    task_id_get = True
                if "DELETE" in route.methods:
                    task_id_delete = True

        assert task_id_get, f"GET method not found for /{{task_id}}. Routes: {route_methods}"
        assert task_id_delete, f"DELETE method not found for /{{task_id}}. Routes: {route_methods}"

        assert "GET" in route_methods["/{task_id}/logs"]
        assert "DELETE" in route_methods["/cleanup"]
