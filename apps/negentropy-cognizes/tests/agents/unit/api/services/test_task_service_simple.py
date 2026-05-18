"""Unit tests for TaskService - simplified version."""

from unittest.mock import MagicMock, patch

import pytest

from cognizes.api.services.task_service import TaskService


@pytest.mark.unit
class TestTaskService:
    """Test cases for TaskService."""

    @pytest.fixture
    def task_service(self):
        """Create a TaskService instance for testing."""
        with patch("cognizes.api.services.task_service.Path") as mock_path:
            # Mock the logs directory
            mock_logs_dir = MagicMock()
            mock_logs_dir.mkdir = MagicMock()
            mock_path.return_value = mock_logs_dir

            service = TaskService()
            return service

    @pytest.mark.asyncio
    async def test_initialize(self, task_service):
        """Test service initialization."""
        with patch("cognizes.api.services.task_service.logger") as mock_logger:
            await task_service.initialize()
            mock_logger.info.assert_called_once_with("TaskService initialized")

    @pytest.mark.asyncio
    async def test_cleanup(self, task_service):
        """Test service cleanup."""
        with patch("cognizes.api.services.task_service.logger") as mock_logger:
            await task_service.cleanup()
            mock_logger.info.assert_called_once_with("TaskService cleanup completed")

    @pytest.mark.asyncio
    async def test_create_task(self, task_service):
        """Test task creation."""
        paper_id = "test_paper_123"
        workflow = "full"
        params = {"option1": "value1", "option2": "value2"}

        task_id = await task_service.create_task(paper_id, workflow, params)

        assert task_id in task_service.tasks
        task = task_service.tasks[task_id]
        assert task["task_id"] == task_id
        assert task["paper_id"] == paper_id
        assert task["workflow"] == workflow
        assert task["status"] == "pending"
        assert task["params"] == params
        assert "created_at" in task
        assert "updated_at" in task

    @pytest.mark.asyncio
    async def test_create_task_without_params(self, task_service):
        """Test task creation without params."""
        paper_id = "test_paper_456"
        workflow = "extract_only"

        task_id = await task_service.create_task(paper_id, workflow)

        task = task_service.tasks[task_id]
        assert task["params"] == {}

    @pytest.mark.asyncio
    async def test_get_task(self, task_service):
        """Test getting a task."""
        # Create a task first
        task_id = await task_service.create_task("paper1", "full")

        # Get the task
        task = await task_service.get_task(task_id)

        assert task is not None
        assert task["task_id"] == task_id
        assert task["paper_id"] == "paper1"
        assert task["workflow"] == "full"

    @pytest.mark.asyncio
    async def test_get_nonexistent_task(self, task_service):
        """Test getting a nonexistent task."""
        with pytest.raises(ValueError, match="Task not found"):
            await task_service.get_task("nonexistent_id")

    @pytest.mark.asyncio
    async def test_update_task(self, task_service):
        """Test updating task."""
        # Create a task
        task_id = await task_service.create_task("paper1", "full")

        # Update status and progress
        await task_service.update_task(task_id, status="processing", progress=50)

        task = task_service.tasks[task_id]
        assert task["status"] == "processing"
        assert task["progress"] == 50

    @pytest.mark.asyncio
    async def test_update_task_with_result(self, task_service):
        """Test updating task with result."""
        # Create a task
        task_id = await task_service.create_task("paper1", "full")

        # Update with result
        result_data = {"output": "processed_data"}
        await task_service.update_task(task_id, status="completed", result=result_data)

        task = task_service.tasks[task_id]
        assert task["status"] == "completed"
        assert task["result"] == result_data

    @pytest.mark.asyncio
    async def test_update_nonexistent_task(self, task_service):
        """Test updating nonexistent task."""
        with patch("cognizes.api.services.task_service.logger") as mock_logger:
            await task_service.update_task("nonexistent", status="processing")
            mock_logger.warning.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_tasks(self, task_service):
        """Test listing tasks."""
        # Create multiple tasks
        await task_service.create_task("paper1", "full")
        await task_service.create_task("paper2", "extract_only")
        await task_service.create_task("paper3", "full")

        # List all tasks
        result = await task_service.list_tasks()

        assert "tasks" in result
        assert "total" in result
        assert result["total"] == 3
        assert len(result["tasks"]) == 3

    @pytest.mark.asyncio
    async def test_list_tasks_with_filters(self, task_service):
        """Test listing tasks with filters."""
        # Create tasks
        task_id1 = await task_service.create_task("paper1", "full")
        task_id2 = await task_service.create_task("paper2", "full")
        await task_service.create_task("paper3", "full")

        # Update statuses
        await task_service.update_task(task_id1, status="completed")
        await task_service.update_task(task_id2, status="processing")

        # List with status filter
        result = await task_service.list_tasks(status="processing")
        assert result["total"] == 1
        assert result["tasks"][0]["task_id"] == task_id2

        # List with paper_id filter
        result = await task_service.list_tasks(paper_id="paper1")
        assert result["total"] == 1
        assert result["tasks"][0]["paper_id"] == "paper1"

    # @pytest.mark.asyncio
    # async def test_cancel_task(self, task_service):
    #     """Test canceling a task."""
    #     # Create a task
    #     task_id = await task_service.create_task("paper1", "full")

    #     # Cancel the task
    #     result = await task_service.cancel_task(task_id)

    #     assert result["success"] is True
    #     assert task_id in result
    #     task = task_service.tasks[task_id]
    #     assert task["status"] == "cancelled"

    # @pytest.mark.asyncio
    # async def test_cancel_nonexistent_task(self, task_service):
    #     """Test canceling a nonexistent task."""
    #     with pytest.raises(ValueError, match="Task not found"):
    #         await task_service.cancel_task("nonexistent")

    @pytest.mark.asyncio
    async def test_get_task_logs(self, task_service):
        """Test getting task logs."""
        # Create a task
        task_id = await task_service.create_task("paper1", "full")

        # Get logs (even if empty)
        logs = await task_service.get_task_logs(task_id)

        assert isinstance(logs, list)

    @pytest.mark.asyncio
    async def test_get_logs_for_nonexistent_task(self, task_service):
        """Test getting logs for nonexistent task."""
        logs = await task_service.get_task_logs("nonexistent")
        assert logs == []

    # @pytest.mark.asyncio
    # async def test_cleanup_completed_tasks(self, task_service):
    #     """Test cleaning up completed tasks."""
    #     # Create tasks
    #     task_id1 = await task_service.create_task("paper1", "full")
    #     task_id2 = await task_service.create_task("paper2", "full")

    #     # Mark one as completed
    #     await task_service.update_task(task_id1, status="completed")

    #     # Cleanup completed tasks
    #     result = await task_service.cleanup_completed_tasks(24)

    #     assert "deleted_count" in result
    #     assert isinstance(result["deleted_count"], int)

    @pytest.mark.asyncio
    async def test_get_task_statistics(self, task_service):
        """Test getting task statistics."""
        # Create tasks
        await task_service.create_task("paper1", "full")
        await task_service.create_task("paper2", "full")
        await task_service.create_task("paper3", "extract_only")

        # Update statuses
        tasks = list(task_service.tasks.keys())
        await task_service.update_task(tasks[0], status="completed")
        await task_service.update_task(tasks[1], status="processing")
        await task_service.update_task(tasks[2], status="failed")

        # Get statistics
        stats = await task_service.get_task_statistics()

        assert "total" in stats
        assert "pending" in stats
        assert "processing" in stats
        assert "completed" in stats
        assert "failed" in stats
        assert stats["total"] == 3
