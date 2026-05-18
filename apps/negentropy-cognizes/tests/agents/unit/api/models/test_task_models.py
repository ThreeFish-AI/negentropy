"""Unit tests for task models."""

import pytest
from pydantic import ValidationError

from cognizes.api.models.task import (
    BatchProgress,
    PingMessage,
    PongMessage,
    SubscribeMessage,
    SubscriptionConfirmed,
    TaskCompletion,
    TaskInfo,
    TaskListResponse,
    TaskResponse,
    TaskUpdate,
    UnsubscribeMessage,
    UnsubscriptionConfirmed,
    WebSocketMessage,
)


@pytest.mark.unit
class TestTaskResponse:
    """Test cases for TaskResponse model."""

    def test_task_response_minimal(self):
        """Test TaskResponse with minimal required fields."""
        task = TaskResponse(
            task_id="task_123",
            paper_id="paper_456",
            workflow="full",
            status="pending",
            created_at="2024-01-15T14:30:00",
            updated_at="2024-01-15T14:30:00",
        )
        assert task.task_id == "task_123"
        assert task.paper_id == "paper_456"
        assert task.workflow == "full"
        assert task.status == "pending"
        assert task.progress == 0  # Default value
        assert task.message == ""  # Default value
        assert task.result is None
        assert task.error is None
        assert task.params is None

    def test_task_response_with_progress(self):
        """Test TaskResponse with progress."""
        task = TaskResponse(
            task_id="task_123",
            paper_id="paper_456",
            workflow="full",
            status="processing",
            progress=65.5,
            message="Processing paper...",
            created_at="2024-01-15T14:30:00",
            updated_at="2024-01-15T14:35:00",
        )
        assert task.progress == 65.5
        assert task.message == "Processing paper..."

    def test_task_response_with_result(self):
        """Test TaskResponse with result."""
        result = {"content": "Extracted content", "word_count": 5000}
        task = TaskResponse(
            task_id="task_123",
            paper_id="paper_456",
            workflow="extract",
            status="completed",
            result=result,
            created_at="2024-01-15T14:30:00",
            updated_at="2024-01-15T14:45:00",
        )
        assert task.result == result
        assert task.status == "completed"

    def test_task_response_with_error(self):
        """Test TaskResponse with error."""
        task = TaskResponse(
            task_id="task_123",
            paper_id="paper_456",
            workflow="full",
            status="failed",
            error="Processing failed due to server error",
            created_at="2024-01-15T14:30:00",
            updated_at="2024-01-15T14:35:00",
        )
        assert task.error == "Processing failed due to server error"
        assert task.status == "failed"

    def test_task_response_progress_validation(self):
        """Test TaskResponse progress validation."""
        # Valid progress values
        TaskResponse(
            task_id="task_123",
            paper_id="paper_456",
            workflow="full",
            status="processing",
            progress=0,
            created_at="2024-01-15T14:30:00",
            updated_at="2024-01-15T14:30:00",
        )

        TaskResponse(
            task_id="task_123",
            paper_id="paper_456",
            workflow="full",
            status="processing",
            progress=100,
            created_at="2024-01-15T14:30:00",
            updated_at="2024-01-15T14:30:00",
        )

        # Invalid progress values
        with pytest.raises(ValidationError):
            TaskResponse(
                task_id="task_123",
                paper_id="paper_456",
                workflow="full",
                status="processing",
                progress=-1,  # Below 0
                created_at="2024-01-15T14:30:00",
                updated_at="2024-01-15T14:30:00",
            )

        with pytest.raises(ValidationError):
            TaskResponse(
                task_id="task_123",
                paper_id="paper_456",
                workflow="full",
                status="processing",
                progress=101,  # Above 100
                created_at="2024-01-15T14:30:00",
                updated_at="2024-01-15T14:30:00",
            )


@pytest.mark.unit
class TestTaskInfo:
    """Test cases for TaskInfo model."""

    def test_task_info_creation(self):
        """Test TaskInfo creation."""
        info = TaskInfo(
            task_id="task_123",
            paper_id="paper_456",
            workflow="full",
            status="processing",
            created_at="2024-01-15T14:30:00",
            updated_at="2024-01-15T14:35:00",
        )
        assert info.task_id == "task_123"
        assert info.paper_id == "paper_456"
        assert info.workflow == "full"
        assert info.status == "processing"
        assert info.progress == 0  # Default value


@pytest.mark.unit
class TestTaskListResponse:
    """Test cases for TaskListResponse model."""

    def test_task_list_response_empty(self):
        """Test TaskListResponse with empty list."""
        response = TaskListResponse(tasks=[], total=0, offset=0, limit=20)
        assert response.tasks == []
        assert response.total == 0
        assert response.offset == 0
        assert response.limit == 20

    def test_task_list_response_with_tasks(self):
        """Test TaskListResponse with tasks."""
        task1 = TaskInfo(
            task_id="task1",
            paper_id="paper1",
            workflow="full",
            status="completed",
            created_at="2024-01-15T14:30:00",
            updated_at="2024-01-15T14:45:00",
        )
        task2 = TaskInfo(
            task_id="task2",
            paper_id="paper2",
            workflow="extract",
            status="processing",
            progress=50,
            created_at="2024-01-15T14:35:00",
            updated_at="2024-01-15T14:40:00",
        )
        response = TaskListResponse(tasks=[task1, task2], total=2, offset=0, limit=20)
        assert len(response.tasks) == 2
        assert response.total == 2
        assert response.tasks[0].task_id == "task1"
        assert response.tasks[1].progress == 50


@pytest.mark.unit
class TestTaskUpdate:
    """Test cases for TaskUpdate model."""

    def test_task_update_minimal(self):
        """Test TaskUpdate with minimal required fields."""
        update = TaskUpdate(type="task_update", task_id="task_123", timestamp="2024-01-15T14:35:00")
        assert update.type == "task_update"
        assert update.task_id == "task_123"
        assert update.status is None
        assert update.progress is None
        assert update.message is None

    def test_task_update_with_all_fields(self):
        """Test TaskUpdate with all fields."""
        update = TaskUpdate(
            type="task_update",
            task_id="task_123",
            status="processing",
            progress=75.5,
            message="Extracting content...",
            timestamp="2024-01-15T14:35:00",
        )
        assert update.status == "processing"
        assert update.progress == 75.5
        assert update.message == "Extracting content..."


@pytest.mark.unit
class TestTaskCompletion:
    """Test cases for TaskCompletion model."""

    def test_task_completion_success(self):
        """Test TaskCompletion with success."""
        result = {"output_file": "translated_paper.pdf", "word_count": 5000}
        completion = TaskCompletion(
            type="task_completion",
            task_id="task_123",
            success=True,
            result=result,
            timestamp="2024-01-15T14:45:00",
        )
        assert completion.type == "task_completion"
        assert completion.task_id == "task_123"
        assert completion.success is True
        assert completion.result == result
        assert completion.error is None

    def test_task_completion_failure(self):
        """Test TaskCompletion with failure."""
        completion = TaskCompletion(
            type="task_completion",
            task_id="task_123",
            success=False,
            error="Translation failed: timeout",
            timestamp="2024-01-15T14:45:00",
        )
        assert completion.success is False
        assert completion.error == "Translation failed: timeout"
        assert completion.result is None


@pytest.mark.unit
class TestBatchProgress:
    """Test cases for BatchProgress model."""

    def test_batch_progress_creation(self):
        """Test BatchProgress creation."""
        progress = BatchProgress(
            type="batch_progress",
            batch_id="batch_123",
            total=10,
            processed=7,
            progress=70.0,
            current_file="paper7.pdf",
            timestamp="2024-01-15T14:35:00",
        )
        assert progress.type == "batch_progress"
        assert progress.batch_id == "batch_123"
        assert progress.total == 10
        assert progress.processed == 7
        assert progress.progress == 70.0
        assert progress.current_file == "paper7.pdf"

    def test_batch_progress_without_current_file(self):
        """Test BatchProgress without current file."""
        progress = BatchProgress(
            type="batch_progress",
            batch_id="batch_123",
            total=10,
            processed=10,
            progress=100.0,
            timestamp="2024-01-15T14:35:00",
        )
        assert progress.current_file is None
        assert progress.progress == 100.0


@pytest.mark.unit
class TestWebSocketMessages:
    """Test cases for WebSocket message models."""

    def test_ping_message(self):
        """Test PingMessage model."""
        ping = PingMessage(timestamp="2024-01-15T14:35:00")
        assert ping.type == "ping"
        assert ping.timestamp == "2024-01-15T14:35:00"

    def test_pong_message(self):
        """Test PongMessage model."""
        pong = PongMessage(timestamp="2024-01-15T14:35:00")
        assert pong.type == "pong"
        assert pong.timestamp == "2024-01-15T14:35:00"

    def test_subscribe_message(self):
        """Test SubscribeMessage model."""
        subscribe = SubscribeMessage(timestamp="2024-01-15T14:35:00", task_id="task_123")
        assert subscribe.type == "subscribe"
        assert subscribe.task_id == "task_123"

    def test_unsubscribe_message(self):
        """Test UnsubscribeMessage model."""
        unsubscribe = UnsubscribeMessage(timestamp="2024-01-15T14:35:00", task_id="task_123")
        assert unsubscribe.type == "unsubscribe"
        assert unsubscribe.task_id == "task_123"

    def test_subscription_confirmed(self):
        """Test SubscriptionConfirmed model."""
        confirmed = SubscriptionConfirmed(timestamp="2024-01-15T14:35:00", task_id="task_123")
        assert confirmed.type == "subscription_confirmed"
        assert confirmed.task_id == "task_123"

    def test_unsubscription_confirmed(self):
        """Test UnsubscriptionConfirmed model."""
        confirmed = UnsubscriptionConfirmed(timestamp="2024-01-15T14:35:00", task_id="task_123")
        assert confirmed.type == "unsubscription_confirmed"
        assert confirmed.task_id == "task_123"

    def test_websocket_message_base(self):
        """Test WebSocketMessage base model."""
        message = WebSocketMessage(type="custom_message", timestamp="2024-01-15T14:35:00")
        assert message.type == "custom_message"
        assert message.timestamp == "2024-01-15T14:35:00"

    def test_websocket_message_type_validation(self):
        """Test WebSocket message type validation."""
        # Valid type
        PingMessage(timestamp="2024-01-15T14:35:00")

        # Missing type (should fail)
        with pytest.raises(ValidationError):
            WebSocketMessage(
                timestamp="2024-01-15T14:35:00"
                # Missing type field
            )
