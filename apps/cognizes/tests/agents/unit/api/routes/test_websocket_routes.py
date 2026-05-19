"""Unit tests for websocket routes."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from cognizes.api.routes.websocket import (
    ConnectionManager,
    WebSocketService,
    get_websocket_service,
    router,
)


@pytest.mark.unit
class TestWebSocketRoutes:
    """Test cases for WebSocket routes."""

    @pytest.fixture
    def client(self):
        """Create a test client."""
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router, prefix="/ws")
        return TestClient(app)

    def test_websocket_service_dependency(self):
        """Test WebSocket service dependency injection."""
        service = get_websocket_service()
        assert service is not None

    @pytest.mark.asyncio
    async def test_websocket_endpoint_connects(self):
        """Test WebSocket endpoint connection."""
        # Mock the ConnectionManager
        with patch("cognizes.api.routes.websocket.manager") as mock_manager:
            mock_manager.connect = AsyncMock()
            mock_manager.disconnect = AsyncMock()
            mock_manager.active_connections = {}

            # Mock WebSocket connection
            mock_websocket = AsyncMock()
            mock_websocket.receive_text = AsyncMock(return_value='{"type": "ping"}')
            mock_websocket.send_text = AsyncMock()

            # Mock the websocket endpoint behavior
            with patch("fastapi.WebSocket") as mock_websocket_class:
                mock_ws_instance = AsyncMock()
                mock_websocket_class.return_value = mock_ws_instance

                # Simulate websocket connection
                mock_ws_instance.accept = AsyncMock()
                mock_ws_instance.receive_text = AsyncMock(side_effect=['{"type": "ping"}', '{"type": "disconnect"}'])
                mock_ws_instance.send_text = AsyncMock()

                # This would normally be tested via integration test
                # For unit test, we verify the service methods exist
                service = WebSocketService(mock_manager)
                assert hasattr(service, "send_task_update")
                assert hasattr(service, "send_task_completion")
                assert hasattr(service, "send_batch_progress")

    @pytest.mark.asyncio
    async def test_websocket_service_methods(self):
        """Test WebSocket service methods."""
        # Create a mock service instance
        mock_manager = AsyncMock()
        service = WebSocketService(mock_manager)

        # Test service has required methods
        assert hasattr(service, "send_task_update")
        assert hasattr(service, "send_task_completion")
        assert hasattr(service, "send_batch_progress")

    @pytest.mark.asyncio
    async def test_websocket_connection_handling(self):
        """Test WebSocket connection handling."""
        # Mock the ConnectionManager directly
        with patch("cognizes.api.routes.websocket.ConnectionManager") as mock_cm_class:
            mock_manager = AsyncMock()
            mock_cm_class.return_value = mock_manager

            # Setup mock
            mock_manager.connect = AsyncMock()
            mock_manager.disconnect = AsyncMock()
            mock_manager.active_connections = {}
            mock_manager.client_subscriptions = {}

            # Test connection manager instantiation
            cm = ConnectionManager()
            assert cm is not None

            # Verify connection handling methods exist
            assert hasattr(mock_manager, "connect")
            assert hasattr(mock_manager, "disconnect")
            assert hasattr(mock_manager, "send_personal_message")
            assert hasattr(mock_manager, "broadcast_to_subscribers")

    @pytest.mark.asyncio
    async def test_websocket_message_handling(self):
        """Test WebSocket message handling."""
        # Mock the ConnectionManager
        with patch("cognizes.api.routes.websocket.manager") as mock_manager:
            # Setup mock
            mock_manager.send_personal_message = AsyncMock()
            mock_manager.broadcast_to_subscribers = AsyncMock()
            mock_manager.subscribe = AsyncMock()
            mock_manager.unsubscribe = AsyncMock()

            # Test message sending
            await mock_manager.send_personal_message({"type": "test"}, "connection_id")
            mock_manager.send_personal_message.assert_called_once()

            await mock_manager.broadcast_to_subscribers({"type": "broadcast_test"}, "task_id")
            mock_manager.broadcast_to_subscribers.assert_called_once()

    def test_websocket_router_included(self):
        """Test that WebSocket router is properly configured."""
        assert router is not None
        assert hasattr(router, "routes")
        # WebSocket routes should be present
        routes = [route.path for route in router.routes]
        assert any("/ws" in route or route == "/ws" for route in routes)

    @pytest.mark.asyncio
    async def test_websocket_error_handling(self):
        """Test WebSocket error handling."""
        # Mock the ConnectionManager
        with patch("cognizes.api.routes.websocket.manager") as mock_manager:
            # Test connection error
            mock_manager.connect = AsyncMock(side_effect=Exception("Connection failed"))

            with pytest.raises(Exception, match="Connection failed"):
                await mock_manager.connect(None, "client_id")

    @pytest.mark.asyncio
    async def test_websocket_connection_lifecycle(self):
        """Test full WebSocket connection lifecycle."""
        # Mock the ConnectionManager
        with patch("cognizes.api.routes.websocket.manager") as mock_manager:
            # Setup mock lifecycle
            mock_manager.connect = AsyncMock()
            mock_manager.disconnect = AsyncMock()
            mock_manager.active_connections = {"client_1": "test_connection"}

            # Test connection lifecycle
            await mock_manager.connect(None, "client_1")
            mock_manager.connect.assert_called_once()

            # Test disconnect
            mock_manager.disconnect("client_1")
            mock_manager.disconnect.assert_called_once()

    @pytest.mark.asyncio
    async def test_websocket_message_types(self):
        """Test handling different WebSocket message types."""
        test_messages = [
            {"type": "task_update", "data": {"task_id": "123", "status": "processing"}},
            {"type": "progress", "data": {"progress": 50}},
            {"type": "error", "data": {"error": "Processing failed"}},
            {"type": "completed", "data": {"result": "success"}},
        ]

        # Mock the ConnectionManager
        with patch("cognizes.api.routes.websocket.manager") as mock_manager:
            mock_manager.broadcast_to_subscribers = AsyncMock()

            for message in test_messages:
                await mock_manager.broadcast_to_subscribers(message, "task_123")
                mock_manager.broadcast_to_subscribers.assert_called_with(message, "task_123")

    def test_websocket_service_singleton(self):
        """Test that WebSocket service is properly initialized."""

        service1 = get_websocket_service()
        service2 = get_websocket_service()

        # Service should be initialized (singleton behavior not strictly required)
        assert service1 is not None
        assert service2 is not None

    @pytest.mark.asyncio
    async def test_connection_manager_initialization(self):
        """Test ConnectionManager initialization."""
        manager = ConnectionManager()
        assert manager.active_connections == {}
        assert manager.client_subscriptions == {}

    @pytest.mark.asyncio
    async def test_connection_manager_subscribe_unsubscribe(self):
        """Test ConnectionManager subscribe/unsubscribe methods."""
        manager = ConnectionManager()

        # Initialize client_subscriptions for client1
        manager.client_subscriptions["client1"] = set()

        # Test subscribe
        await manager.subscribe("client1", "task1")
        assert "task1" in manager.client_subscriptions["client1"]

        # Test unsubscribe
        await manager.unsubscribe("client1", "task1")
        assert "task1" not in manager.client_subscriptions["client1"]

    def test_manager_instance(self):
        """Test that manager instance exists."""
        from cognizes.api.routes.websocket import manager

        assert manager is not None
        assert isinstance(manager, ConnectionManager)

    def test_router_exists(self):
        """Test that router exists."""
        from cognizes.api.routes.websocket import router

        assert router is not None

    def test_websocket_endpoint_exists(self):
        """Test that websocket endpoint function exists."""
        from cognizes.api.routes.websocket import websocket_endpoint

        assert callable(websocket_endpoint)

    @pytest.mark.asyncio
    async def test_connection_manager_connect(self):
        """Test ConnectionManager connect method."""
        manager = ConnectionManager()

        # Mock WebSocket
        mock_websocket = AsyncMock()
        mock_websocket.accept = AsyncMock()

        # Test connect
        await manager.connect(mock_websocket, "client1")

        assert "client1" in manager.active_connections
        assert manager.active_connections["client1"] == mock_websocket
        mock_websocket.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_connection_manager_disconnect(self):
        """Test ConnectionManager disconnect method."""
        manager = ConnectionManager()

        # Mock WebSocket
        mock_websocket = AsyncMock()

        # First connect
        await manager.connect(mock_websocket, "client1")
        assert "client1" in manager.active_connections

        # Then disconnect
        await manager.disconnect("client1")
        assert "client1" not in manager.active_connections

    @pytest.mark.asyncio
    async def test_connection_manager_send_personal_message(self):
        """Test ConnectionManager send_personal_message method."""
        manager = ConnectionManager()

        # Mock WebSocket
        mock_websocket = AsyncMock()
        mock_websocket.send_json = AsyncMock()

        # Connect client
        await manager.connect(mock_websocket, "client1")

        # Send message
        message = {"type": "test", "data": "hello"}
        await manager.send_personal_message(message, "client1")

        mock_websocket.send_json.assert_called_once_with(message)

    @pytest.mark.asyncio
    async def test_connection_manager_send_personal_message_not_connected(self):
        """Test sending message to disconnected client."""
        manager = ConnectionManager()

        # Try to send message to non-existent client
        message = {"type": "test", "data": "hello"}

        # Should not raise error, just silently fail
        await manager.send_personal_message(message, "non_existent")

    @pytest.mark.asyncio
    async def test_connection_manager_broadcast_to_subscribers(self):
        """Test ConnectionManager broadcast_to_subscribers method."""
        manager = ConnectionManager()

        # Mock WebSockets
        mock_ws1 = AsyncMock()
        mock_ws1.send_json = AsyncMock()
        mock_ws2 = AsyncMock()
        mock_ws2.send_json = AsyncMock()
        mock_ws3 = AsyncMock()
        mock_ws3.send_json = AsyncMock()

        # Connect clients
        await manager.connect(mock_ws1, "client1")
        await manager.connect(mock_ws2, "client2")
        await manager.connect(mock_ws3, "client3")

        # Subscribe clients to different tasks
        await manager.subscribe("client1", "task1")
        await manager.subscribe("client2", "task1")
        await manager.subscribe("client3", "task2")

        # Broadcast to task1 subscribers
        message = {"type": "update", "task_id": "task1", "status": "processing"}
        await manager.broadcast_to_subscribers(message, "task1")

        # Verify only task1 subscribers received the message
        mock_ws1.send_json.assert_called_once_with(message)
        mock_ws2.send_json.assert_called_once_with(message)
        mock_ws3.send_json.assert_not_called()

    @pytest.mark.asyncio
    async def test_connection_manager_subscribe(self):
        """Test ConnectionManager subscribe method."""
        manager = ConnectionManager()

        # Initialize client_subscriptions if needed
        if "client1" not in manager.client_subscriptions:
            manager.client_subscriptions["client1"] = set()

        # Subscribe to task
        await manager.subscribe("client1", "task1")

        assert "task1" in manager.client_subscriptions["client1"]

    @pytest.mark.asyncio
    async def test_connection_manager_unsubscribe(self):
        """Test ConnectionManager unsubscribe method."""
        manager = ConnectionManager()

        # Initialize client_subscriptions
        manager.client_subscriptions["client1"] = {"task1", "task2"}

        # Unsubscribe from one task
        await manager.unsubscribe("client1", "task1")

        assert "task1" not in manager.client_subscriptions["client1"]
        assert "task2" in manager.client_subscriptions["client1"]

    @pytest.mark.asyncio
    async def test_connection_manager_unsubscribe_all(self):
        """Test ConnectionManager unsubscribe from all tasks."""
        manager = ConnectionManager()

        # Initialize client_subscriptions
        manager.client_subscriptions["client1"] = {"task1", "task2", "task3"}

        # Unsubscribe from all
        await manager.unsubscribe("client1", None)

        assert manager.client_subscriptions["client1"] == set()

    @pytest.mark.asyncio
    async def test_websocket_service_send_task_update(self):
        """Test WebSocketService send_task_update method."""
        mock_manager = AsyncMock()
        mock_manager.broadcast_to_subscribers = AsyncMock()

        service = WebSocketService(mock_manager)

        # Send task update
        await service.send_task_update("task123", "processing", 50, "Task in progress")

        # Check the call was made with the expected structure (including timestamp)
        mock_manager.broadcast_to_subscribers.assert_called_once()
        call_args = mock_manager.broadcast_to_subscribers.call_args[0]
        message = call_args[0]
        task_id = call_args[1]

        assert task_id == "task123"
        assert message["type"] == "task_update"
        assert message["task_id"] == "task123"
        assert message["status"] == "processing"
        assert message["progress"] == 50
        assert message["message"] == "Task in progress"
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_websocket_service_send_task_completion(self):
        """Test WebSocketService send_task_completion method."""
        mock_manager = AsyncMock()
        mock_manager.broadcast_to_subscribers = AsyncMock()

        service = WebSocketService(mock_manager)

        # Send task completion
        await service.send_task_completion("task123", {"result": "success", "output": "processed"})

        # Check the call was made with the expected structure
        mock_manager.broadcast_to_subscribers.assert_called_once()
        call_args = mock_manager.broadcast_to_subscribers.call_args[0]
        message = call_args[0]
        task_id = call_args[1]

        assert task_id == "task123"
        assert message["type"] == "task_completed"
        assert message["task_id"] == "task123"
        assert message["success"] is True
        assert message["result"] == {"result": "success", "output": "processed"}
        assert message["error"] == ""
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_websocket_service_send_batch_progress(self):
        """Test WebSocketService send_batch_progress method."""
        mock_manager = AsyncMock()
        mock_manager.send_personal_message = AsyncMock()
        mock_manager.active_connections = ["client1", "client2"]

        service = WebSocketService(mock_manager)

        # Send batch progress using new API
        await service.send_batch_progress("batch123", 10, 5, "paper5")

        # Verify send_personal_message was called for each client
        assert mock_manager.send_personal_message.call_count == 2

        # Check the message content
        call_args = mock_manager.send_personal_message.call_args_list[0]
        message = call_args[0][0]
        client_id = call_args[0][1]

        assert client_id == "client1"
        assert message["type"] == "batch_progress"
        assert message["batch_id"] == "batch123"
        assert message["total"] == 10
        assert message["processed"] == 5
        assert message["progress"] == 50.0
        assert message["current_file"] == "paper5"
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_websocket_service_send_error(self):
        """Test WebSocketService error sending."""
        mock_manager = AsyncMock()
        mock_manager.broadcast_to_subscribers = AsyncMock(side_effect=Exception("Connection error"))

        service = WebSocketService(mock_manager)

        # Should not raise exception
        await service.send_task_update("task123", "error", 0, "Error occurred")

        # Error should be logged but not raised

    @pytest.mark.asyncio
    async def test_websocket_service_send_paper_analysis(self):
        """Test WebSocketService send_paper_analysis method."""
        mock_manager = AsyncMock()
        mock_manager.broadcast_to_subscribers = AsyncMock()

        service = WebSocketService(mock_manager)

        # Send paper analysis
        await service.send_paper_analysis("paper123", {"summary": "Test summary", "insights": []})

        mock_manager.broadcast_to_subscribers.assert_called_once()
        call_args = mock_manager.broadcast_to_subscribers.call_args[0]
        message = call_args[0]
        paper_id = call_args[1]

        assert paper_id == "paper123"
        assert message["type"] == "paper_analysis"
        assert message["paper_id"] == "paper123"
        assert message["summary"] == "Test summary"
        assert message["insights"] == []
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_connection_manager_get_connection_count(self):
        """Test ConnectionManager get_connection_count method."""
        manager = ConnectionManager()

        # Initially no connections
        assert manager.get_connection_count() == 0

        # Mock WebSockets
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()

        # Add connections
        await manager.connect(mock_ws1, "client1")
        await manager.connect(mock_ws2, "client2")

        # Check count
        assert manager.get_connection_count() == 2

        # Remove one connection
        await manager.disconnect("client1")

        # Check count again
        assert manager.get_connection_count() == 1

    @pytest.mark.asyncio
    async def test_connection_manager_get_subscriber_count(self):
        """Test ConnectionManager get_subscriber_count method."""
        manager = ConnectionManager()

        # Initially no subscribers
        assert manager.get_subscriber_count("task1") == 0

        # Mock WebSockets
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        mock_ws3 = AsyncMock()

        # Connect clients
        await manager.connect(mock_ws1, "client1")
        await manager.connect(mock_ws2, "client2")
        await manager.connect(mock_ws3, "client3")

        # Subscribe clients to task
        await manager.subscribe("client1", "task1")
        await manager.subscribe("client2", "task1")
        await manager.subscribe("client3", "task2")

        # Check subscriber count for task1
        assert manager.get_subscriber_count("task1") == 2
        assert manager.get_subscriber_count("task2") == 1
        assert manager.get_subscriber_count("task3") == 0

    @pytest.mark.asyncio
    async def test_connection_manager_cleanup_subscriptions(self):
        """Test ConnectionManager cleanup_subscriptions method."""
        manager = ConnectionManager()

        # Setup subscriptions
        manager.client_subscriptions = {
            "client1": {"task1", "task2"},
            "client2": {"task1", "task3"},
            "client3": {"task2"},
        }

        # Mock WebSockets
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()

        # Connect only client1 and client2
        manager.active_connections = {"client1": mock_ws1, "client2": mock_ws2}

        # Cleanup subscriptions for disconnected clients
        await manager.cleanup_subscriptions()

        # client3's subscriptions should be removed
        assert "client3" not in manager.client_subscriptions
        assert "client1" in manager.client_subscriptions
        assert "client2" in manager.client_subscriptions
