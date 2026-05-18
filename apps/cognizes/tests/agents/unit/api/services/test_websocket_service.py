"""Unit tests for WebSocketService."""

from unittest.mock import AsyncMock

import pytest

from cognizes.api.services.websocket_service import WebSocketService


@pytest.mark.unit
class TestWebSocketService:
    """Test cases for WebSocketService."""

    @pytest.fixture
    def mock_connection_manager(self):
        """Create a mock connection manager."""
        manager = AsyncMock()
        # Mock active_connections as a list for send_batch_progress tests
        manager.active_connections = ["client1", "client2", "client3"]
        return manager

    @pytest.fixture
    def websocket_service(self, mock_connection_manager):
        """Create a WebSocketService instance for testing."""
        return WebSocketService(mock_connection_manager)

    def test_websocket_service_initialization(self, websocket_service, mock_connection_manager):
        """Test WebSocketService initialization."""
        assert websocket_service.manager == mock_connection_manager

    @pytest.mark.asyncio
    async def test_send_task_update_minimal(self, websocket_service):
        """Test send_task_update with minimal parameters."""
        task_id = "task_123"
        status = "processing"

        # Test the service method directly - it should use the manager
        await websocket_service.send_task_update(task_id, status)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        message = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert message["type"] == "task_update"
        assert message["task_id"] == task_id
        assert message["status"] == status
        assert message["progress"] == 0.0
        assert message["message"] == ""
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_task_update_with_all_params(self, websocket_service):
        """Test send_task_update with all parameters."""
        task_id = "task_123"
        status = "processing"
        progress = 75.5
        message = "Processing file..."

        await websocket_service.send_task_update(task_id, status, progress, message)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        msg = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert msg["type"] == "task_update"
        assert msg["task_id"] == task_id
        assert msg["status"] == status
        assert msg["progress"] == progress
        assert msg["message"] == message
        assert "timestamp" in msg

    @pytest.mark.asyncio
    async def test_send_task_update_with_zero_progress(self, websocket_service):
        """Test send_task_update with explicit zero progress."""
        task_id = "task_123"
        status = "starting"
        progress = 0.0
        message = "Starting..."

        await websocket_service.send_task_update(task_id, status, progress, message)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        msg = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert msg["type"] == "task_update"
        assert msg["task_id"] == task_id
        assert msg["status"] == status
        assert msg["progress"] == progress
        assert msg["message"] == message
        assert "timestamp" in msg

    @pytest.mark.asyncio
    async def test_send_task_update_with_none_values(self, websocket_service):
        """Test send_task_update with None values."""
        task_id = "task_123"
        status = "processing"

        await websocket_service.send_task_update(task_id, status, None, None)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        msg = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert msg["type"] == "task_update"
        assert msg["task_id"] == task_id
        assert msg["status"] == status
        assert msg["progress"] == 0.0  # None defaults to 0.0
        assert msg["message"] == ""  # None defaults to ""
        assert "timestamp" in msg

    @pytest.mark.asyncio
    async def test_send_task_completion_success(self, websocket_service):
        """Test send_task_completion with success result."""
        task_id = "task_123"
        result = {"output_file": "translated.pdf", "word_count": 5000}

        await websocket_service.send_task_completion(task_id, result)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        msg = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert msg["type"] == "task_completed"
        assert msg["task_id"] == task_id
        assert msg["success"] is True
        assert msg["result"] == result
        assert msg["error"] == ""
        assert "timestamp" in msg

    @pytest.mark.asyncio
    async def test_send_task_completion_failure(self, websocket_service):
        """Test send_task_completion with error."""
        task_id = "task_123"
        error = "Translation failed: timeout"

        await websocket_service.send_task_completion(task_id, error=error)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        msg = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert msg["type"] == "task_completed"
        assert msg["task_id"] == task_id
        assert msg["success"] is False
        assert msg["result"] == {}
        assert msg["error"] == error
        assert "timestamp" in msg

    @pytest.mark.asyncio
    async def test_send_task_completion_both_result_and_error(self, websocket_service):
        """Test send_task_completion with both result and error."""
        task_id = "task_123"
        result = {"partial_output": "some content"}
        error = "Warning: incomplete translation"

        await websocket_service.send_task_completion(task_id, result, error)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        msg = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert msg["type"] == "task_completed"
        assert msg["task_id"] == task_id
        assert msg["success"] is False  # error is not None
        assert msg["result"] == result
        assert msg["error"] == error
        assert "timestamp" in msg

    @pytest.mark.asyncio
    async def test_send_task_completion_none_values(self, websocket_service):
        """Test send_task_completion with None values."""
        task_id = "task_123"

        await websocket_service.send_task_completion(task_id, None, None)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        msg = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert msg["type"] == "task_completed"
        assert msg["task_id"] == task_id
        assert msg["success"] is True  # error is None
        assert msg["result"] == {}
        assert msg["error"] == ""
        assert "timestamp" in msg

    @pytest.mark.asyncio
    async def test_send_batch_progress_minimal(self, websocket_service):
        """Test send_batch_progress with minimal parameters."""
        batch_id = "batch_123"
        total = 10
        processed = 5

        await websocket_service.send_batch_progress(batch_id, total, processed)

        # Verify send_personal_message was called for each active connection
        assert websocket_service.manager.send_personal_message.call_count == 3

        # Check the arguments for the first call
        call_args = websocket_service.manager.send_personal_message.call_args_list[0]
        message = call_args[0][0]
        client_id = call_args[0][1]

        assert client_id in ["client1", "client2", "client3"]
        assert message["type"] == "batch_progress"
        assert message["batch_id"] == batch_id
        assert message["total"] == total
        assert message["processed"] == processed
        assert message["progress"] == 50.0  # 5/10 * 100
        assert message["current_file"] == ""
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_batch_progress_with_current_file(self, websocket_service):
        """Test send_batch_progress with current file."""
        batch_id = "batch_123"
        total = 10
        processed = 5
        current_file = "paper5.pdf"

        await websocket_service.send_batch_progress(batch_id, total, processed, current_file)

        # Verify send_personal_message was called for each active connection
        assert websocket_service.manager.send_personal_message.call_count == 3

        # Check the arguments for the first call
        call_args = websocket_service.manager.send_personal_message.call_args_list[0]
        message = call_args[0][0]

        assert message["type"] == "batch_progress"
        assert message["batch_id"] == batch_id
        assert message["total"] == total
        assert message["processed"] == processed
        assert message["progress"] == 50.0  # 5/10 * 100
        assert message["current_file"] == current_file
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_batch_progress_with_none_current_file(self, websocket_service):
        """Test send_batch_progress with None current file."""
        batch_id = "batch_123"
        total = 10
        processed = 5

        await websocket_service.send_batch_progress(batch_id, total, processed, None)

        # Verify send_personal_message was called for each active connection
        assert websocket_service.manager.send_personal_message.call_count == 3

        # Check the arguments for the first call
        call_args = websocket_service.manager.send_personal_message.call_args_list[0]
        message = call_args[0][0]

        assert message["type"] == "batch_progress"
        assert message["batch_id"] == batch_id
        assert message["total"] == total
        assert message["processed"] == processed
        assert message["progress"] == 50.0  # 5/10 * 100
        assert message["current_file"] == ""  # None defaults to ""
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_batch_progress_complete(self, websocket_service):
        """Test send_batch_progress when batch is complete."""
        batch_id = "batch_123"
        total = 10
        processed = 10
        current_file = None

        await websocket_service.send_batch_progress(batch_id, total, processed, current_file)

        # Verify send_personal_message was called for each active connection
        assert websocket_service.manager.send_personal_message.call_count == 3

        # Check the arguments for the first call
        call_args = websocket_service.manager.send_personal_message.call_args_list[0]
        message = call_args[0][0]

        assert message["type"] == "batch_progress"
        assert message["batch_id"] == batch_id
        assert message["total"] == total
        assert message["processed"] == processed
        assert message["progress"] == 100.0  # 10/10 * 100
        assert message["current_file"] == ""  # None defaults to ""
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_task_update_exception_handling(self, websocket_service, caplog):
        """Test send_task_update exception handling."""
        task_id = "task_123"
        status = "processing"

        # Make the manager's broadcast_to_subscribers raise an exception
        websocket_service.manager.broadcast_to_subscribers.side_effect = Exception("WebSocket error")

        # Should not raise exception, just log it
        await websocket_service.send_task_update(task_id, status)

        # Verify the error was handled (method didn't crash)
        # Verify the error was logged
        assert "Error sending task update: WebSocket error" in caplog.text
        # Ensure the method still attempted to call broadcast_to_subscribers
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_task_completion_exception_handling(self, websocket_service, caplog):
        """Test send_task_completion exception handling."""
        task_id = "task_123"

        # Make the manager's broadcast_to_subscribers raise an exception
        websocket_service.manager.broadcast_to_subscribers.side_effect = Exception("WebSocket connection lost")

        # Should not raise exception, just log it
        await websocket_service.send_task_completion(task_id)

        # Verify the error was handled (method didn't crash)
        # Verify the error was logged
        assert "Error sending task completion: WebSocket connection lost" in caplog.text
        # Ensure the method still attempted to call broadcast_to_subscribers
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_batch_progress_exception_handling(self, websocket_service, caplog):
        """Test send_batch_progress exception handling."""
        batch_id = "batch_123"
        total = 10
        processed = 5

        # Make the manager's send_personal_message raise an exception
        websocket_service.manager.send_personal_message.side_effect = Exception("Broadcast failed")

        # Should not raise exception, just log it
        await websocket_service.send_batch_progress(batch_id, total, processed)

        # Verify the error was handled (method didn't crash)
        # Verify errors were logged for each client
        assert "Error sending batch progress to client" in caplog.text
        # Ensure send_personal_message was called for each active connection
        assert websocket_service.manager.send_personal_message.call_count == 3

    @pytest.mark.asyncio
    async def test_service_methods_are_async(self, websocket_service):
        """Test that all service methods are async."""
        # Verify methods are coroutines
        import inspect

        assert inspect.iscoroutinefunction(websocket_service.send_task_update)
        assert inspect.iscoroutinefunction(websocket_service.send_task_completion)
        assert inspect.iscoroutinefunction(websocket_service.send_batch_progress)
        assert inspect.iscoroutinefunction(websocket_service.send_paper_analysis)

    @pytest.mark.asyncio
    async def test_send_task_update_with_float_progress(self, websocket_service):
        """Test send_task_update with float progress value."""
        task_id = "task_123"
        status = "processing"
        progress = 33.333333

        await websocket_service.send_task_update(task_id, status, progress)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        msg = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert msg["type"] == "task_update"
        assert msg["task_id"] == task_id
        assert msg["status"] == status
        assert msg["progress"] == progress
        assert msg["message"] == ""
        assert "timestamp" in msg

    @pytest.mark.asyncio
    async def test_send_task_update_with_empty_message(self, websocket_service):
        """Test send_task_update with empty message."""
        task_id = "task_123"
        status = "processing"
        progress = 50
        message = ""

        await websocket_service.send_task_update(task_id, status, progress, message)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        msg = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert msg["type"] == "task_update"
        assert msg["task_id"] == task_id
        assert msg["status"] == status
        assert msg["progress"] == progress
        assert msg["message"] == ""
        assert "timestamp" in msg

    @pytest.mark.asyncio
    async def test_send_batch_progress_zero_total(self, websocket_service):
        """Test send_batch_progress with zero total."""
        batch_id = "batch_123"
        total = 0
        processed = 0

        await websocket_service.send_batch_progress(batch_id, total, processed)

        # Verify send_personal_message was called for each active connection
        assert websocket_service.manager.send_personal_message.call_count == 3

        # Check the arguments for the first call
        call_args = websocket_service.manager.send_personal_message.call_args_list[0]
        message = call_args[0][0]

        assert message["type"] == "batch_progress"
        assert message["batch_id"] == batch_id
        assert message["total"] == 0
        assert message["processed"] == 0
        assert message["progress"] == 0  # 0/0 should be 0 to avoid division by zero
        assert message["current_file"] == ""
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_batch_progress_progress_calculation(self, websocket_service):
        """Test send_batch_progress with various progress states."""
        batch_id = "batch_123"
        total = 100

        test_cases = [
            (0, 0),  # Start
            (25, 25),  # Quarter
            (50, 50),  # Half
            (75, 75),  # Three quarters
            (100, 100),  # Complete
        ]

        for processed, expected_processed in test_cases:
            # Reset the mock for each iteration
            websocket_service.manager.send_personal_message.reset_mock()

            await websocket_service.send_batch_progress(batch_id, total, processed)

            # Verify send_personal_message was called for each active connection
            assert websocket_service.manager.send_personal_message.call_count == 3

            # Check the arguments for the first call
            call_args = websocket_service.manager.send_personal_message.call_args_list[0]
            message = call_args[0][0]

            assert message["type"] == "batch_progress"
            assert message["batch_id"] == batch_id
            assert message["total"] == total
            assert message["processed"] == expected_processed

            # Calculate expected progress percentage
            expected_progress = expected_processed / total * 100 if total > 0 else 0
            assert message["progress"] == expected_progress
            assert message["current_file"] == ""
            assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_paper_analysis_minimal(self, websocket_service):
        """Test send_paper_analysis with minimal parameters."""
        paper_id = "paper_123"
        analysis_data = {"title": "Test Paper", "status": "completed"}

        await websocket_service.send_paper_analysis(paper_id, analysis_data)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        message = call_args[0]
        sent_paper_id = call_args[1]

        assert sent_paper_id == paper_id
        assert message["type"] == "paper_analysis"
        assert message["paper_id"] == paper_id
        assert message["title"] == "Test Paper"
        assert message["status"] == "completed"
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_paper_analysis_complete(self, websocket_service):
        """Test send_paper_analysis with complete analysis data."""
        paper_id = "paper_456"
        analysis_data = {
            "title": "Deep Learning for NLP",
            "authors": ["John Doe", "Jane Smith"],
            "abstract": "This paper discusses...",
            "key_findings": [
                "Transformer models excel at NLP tasks",
                "Pre-training improves performance",
            ],
            "confidence_score": 0.95,
            "processing_time": 12.5,
            "word_count": 5000,
            "language": "en",
        }

        await websocket_service.send_paper_analysis(paper_id, analysis_data)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        message = call_args[0]
        sent_paper_id = call_args[1]

        assert sent_paper_id == paper_id
        assert message["type"] == "paper_analysis"
        assert message["paper_id"] == paper_id
        # Verify all analysis data fields are included
        for key, value in analysis_data.items():
            assert message[key] == value
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_paper_analysis_empty_data(self, websocket_service):
        """Test send_paper_analysis with empty analysis data."""
        paper_id = "paper_789"
        analysis_data = {}

        await websocket_service.send_paper_analysis(paper_id, analysis_data)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        message = call_args[0]
        sent_paper_id = call_args[1]

        assert sent_paper_id == paper_id
        assert message["type"] == "paper_analysis"
        assert message["paper_id"] == paper_id
        # Empty dict should only have type, paper_id, and timestamp
        assert len([k for k in message.keys() if k not in ["type", "paper_id", "timestamp"]]) == 0
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_paper_analysis_exception_handling(self, websocket_service, caplog):
        """Test send_paper_analysis exception handling."""
        paper_id = "paper_error"
        analysis_data = {"title": "Error Test"}

        # Make the manager's broadcast_to_subscribers raise an exception
        websocket_service.manager.broadcast_to_subscribers.side_effect = Exception("Analysis broadcast failed")

        # Should not raise exception, just log it
        await websocket_service.send_paper_analysis(paper_id, analysis_data)

        # Verify the error was handled (method didn't crash)
        # Verify the error was logged
        assert "Error sending paper analysis: Analysis broadcast failed" in caplog.text
        # Ensure the method still attempted to call broadcast_to_subscribers
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
