"""Mock configurations for WebSocket operations."""

import asyncio
import json
from collections.abc import Callable
from datetime import datetime
from typing import Any


class MockWebSocket:
    """Mock WebSocket connection for testing."""

    def __init__(self, client_id: str = "test_client"):
        self.client_id = client_id
        self.connected = False
        self.subscribed_tasks = set()
        self.sent_messages = []
        self.received_messages = []
        self.close_code = None
        self.close_reason = None

    async def accept(self):
        """Mock WebSocket accept."""
        self.connected = True

    async def send_text(self, data: str):
        """Mock sending text data."""
        if not self.connected:
            raise ConnectionError("WebSocket is not connected")
        self.sent_messages.append({"type": "text", "data": data, "timestamp": datetime.now().isoformat()})

    async def send_json(self, data: dict[str, Any]):
        """Mock sending JSON data."""
        await self.send_text(json.dumps(data))

    async def receive_text(self) -> str:
        """Mock receiving text data."""
        if not self.connected:
            raise ConnectionError("WebSocket is not connected")
        if self.received_messages:
            msg = self.received_messages.pop(0)
            return msg["data"] if isinstance(msg, dict) else msg
        # Simulate waiting for message
        await asyncio.sleep(0.1)
        return ""

    async def receive_json(self) -> dict[str, Any]:
        """Mock receiving JSON data."""
        text = await self.receive_text()
        return json.loads(text) if text else {}

    async def close(self, code: int = 1000, reason: str = ""):
        """Mock WebSocket close."""
        self.connected = False
        self.close_code = code
        self.close_reason = reason

    def add_received_message(self, message: dict[str, Any]):
        """Add a message to be received."""
        self.received_messages.append(message)

    def get_sent_messages(self) -> list[dict[str, Any]]:
        """Get all sent messages."""
        return self.sent_messages

    def clear_messages(self):
        """Clear sent and received messages."""
        self.sent_messages.clear()
        self.received_messages.clear()


class MockConnectionManager:
    """Mock WebSocket connection manager."""

    def __init__(self):
        self.connections: dict[str, MockWebSocket] = {}
        self.task_subscribers: dict[str, list[str]] = {}
        self.broadcast_messages = []

    async def connect(self, websocket: MockWebSocket, client_id: str):
        """Mock connecting a WebSocket."""
        await websocket.accept()
        self.connections[client_id] = websocket

    def disconnect(self, client_id: str):
        """Mock disconnecting a WebSocket."""
        if client_id in self.connections:
            del self.connections[client_id]
            # Remove from all task subscriptions
            for task_id in list(self.task_subscribers.keys()):
                if client_id in self.task_subscribers[task_id]:
                    self.task_subscribers[task_id].remove(client_id)
                    if not self.task_subscribers[task_id]:
                        del self.task_subscribers[task_id]

    async def send_personal_message(self, message: dict[str, Any], client_id: str):
        """Mock sending personal message."""
        if client_id in self.connections:
            await self.connections[client_id].send_json(message)

    async def broadcast(self, message: dict[str, Any]):
        """Mock broadcasting message to all connections."""
        self.broadcast_messages.append(message)
        for websocket in self.connections.values():
            try:
                await websocket.send_json(message)
            except Exception:
                # Connection might be closed
                pass

    async def subscribe_to_task(self, client_id: str, task_id: str):
        """Mock subscribing to task updates."""
        if task_id not in self.task_subscribers:
            self.task_subscribers[task_id] = []
        self.task_subscribers[task_id].append(client_id)

        if client_id in self.connections:
            self.connections[client_id].subscribed_tasks.add(task_id)

    async def unsubscribe_from_task(self, client_id: str, task_id: str):
        """Mock unsubscribing from task updates."""
        if task_id in self.task_subscribers:
            if client_id in self.task_subscribers[task_id]:
                self.task_subscribers[task_id].remove(client_id)
                if not self.task_subscribers[task_id]:
                    del self.task_subscribers[task_id]

        if client_id in self.connections:
            self.connections[client_id].subscribed_tasks.discard(task_id)

    async def send_task_update(self, task_id: str, update: dict[str, Any]):
        """Mock sending task update to subscribers."""
        if task_id in self.task_subscribers:
            message = {
                "type": "task_update",
                "task_id": task_id,
                **update,
                "timestamp": datetime.now().isoformat(),
            }
            for client_id in self.task_subscribers[task_id]:
                await self.send_personal_message(message, client_id)

    def get_connected_clients(self) -> list[str]:
        """Get list of connected client IDs."""
        return list(self.connections.keys())

    def get_task_subscribers(self, task_id: str) -> list[str]:
        """Get list of subscribers for a task."""
        return self.task_subscribers.get(task_id, [])

    def clear_all(self):
        """Clear all connections and subscriptions."""
        self.connections.clear()
        self.task_subscribers.clear()
        self.broadcast_messages.clear()


class MockWebSocketService:
    """Mock WebSocket service for testing."""

    def __init__(self):
        self.connection_manager = MockConnectionManager()
        self.active_tasks = {}
        self.message_handlers = {}

    async def handle_websocket(self, websocket: MockWebSocket, client_id: str):
        """Mock WebSocket connection handler."""
        await self.connection_manager.connect(websocket, client_id)

        try:
            while True:
                message = await websocket.receive_json()
                await self.handle_message(client_id, message)
        except Exception as e:
            print(f"WebSocket error for {client_id}: {e}")
        finally:
            self.connection_manager.disconnect(client_id)

    async def handle_message(self, client_id: str, message: dict[str, Any]):
        """Mock handling incoming WebSocket message."""
        message_type = message.get("type")

        if message_type == "subscribe":
            task_id = message.get("task_id")
            if task_id:
                await self.connection_manager.subscribe_to_task(client_id, task_id)

        elif message_type == "unsubscribe":
            task_id = message.get("task_id")
            if task_id:
                await self.connection_manager.unsubscribe_from_task(client_id, task_id)

        elif message_type == "ping":
            await self.connection_manager.send_personal_message(
                {"type": "pong", "timestamp": datetime.now().isoformat()}, client_id
            )

        # Call custom handler if registered
        if message_type in self.message_handlers:
            await self.message_handlers[message_type](client_id, message)

    def register_message_handler(self, message_type: str, handler: Callable):
        """Register a custom message handler."""
        self.message_handlers[message_type] = handler

    async def notify_task_progress(self, task_id: str, progress: float, message: str = ""):
        """Mock notifying task progress."""
        update = {"status": "processing", "progress": progress, "message": message}
        await self.connection_manager.send_task_update(task_id, update)

        # Update active task
        if task_id in self.active_tasks:
            self.active_tasks[task_id]["progress"] = progress
            if message:
                self.active_tasks[task_id]["message"] = message

    async def notify_task_completion(self, task_id: str, result: dict[str, Any] = None):
        """Mock notifying task completion."""
        update = {
            "status": "completed",
            "progress": 100.0,
            "message": "Task completed successfully",
            "result": result,
        }
        await self.connection_manager.send_task_update(task_id, update)

        # Update active task
        self.active_tasks[task_id]["status"] = "completed"
        self.active_tasks[task_id]["progress"] = 100.0

    async def notify_task_error(self, task_id: str, error: str):
        """Mock notifying task error."""
        update = {"status": "failed", "error": error}
        await self.connection_manager.send_task_update(task_id, update)

        # Update active task
        self.active_tasks[task_id]["status"] = "failed"
        self.active_tasks[task_id]["error"] = error

    def add_active_task(self, task_id: str, paper_id: str, workflow: str):
        """Add an active task to track."""
        self.active_tasks[task_id] = {
            "paper_id": paper_id,
            "workflow": workflow,
            "status": "processing",
            "progress": 0.0,
            "message": "Task started",
            "created_at": datetime.now().isoformat(),
        }

    def get_active_task(self, task_id: str) -> dict[str, Any] | None:
        """Get active task info."""
        return self.active_tasks.get(task_id)


# Global mock instances
mock_websocket_service = MockWebSocketService()
mock_connection_manager = MockConnectionManager()


def get_mock_websocket_service() -> MockWebSocketService:
    """Get the global mock WebSocket service instance."""
    return mock_websocket_service


def get_mock_connection_manager() -> MockConnectionManager:
    """Get the global mock connection manager instance."""
    return mock_connection_manager


# Utility functions for patching
def patch_websocket_service():
    """Create patches for WebSocket service."""
    from unittest.mock import patch

    patches = []

    # Patch WebSocketService
    patches.append(
        patch(
            "cognizes.api.services.websocket_service.WebSocketService",
            return_value=mock_websocket_service,
        )
    )

    # Patch ConnectionManager
    patches.append(
        patch(
            "cognizes.api.services.websocket_service.ConnectionManager",
            return_value=mock_connection_manager,
        )
    )

    # Patch FastAPI WebSocket
    patches.append(patch("fastapi.WebSocket", MockWebSocket))

    return patches


# Test helpers
async def simulate_task_progress(task_id: str, steps: list[tuple]):
    """Simulate task progress for testing.

    Args:
        task_id: The task ID to simulate progress for
        steps: List of (progress, message) tuples
    """
    for progress, message in steps:
        await mock_websocket_service.notify_task_progress(task_id, progress, message)
        await asyncio.sleep(0.01)  # Small delay for realism

    await mock_websocket_service.notify_task_completion(task_id, {"output": "success"})


def create_websocket_test_message(message_type: str, **kwargs) -> dict[str, Any]:
    """Create a WebSocket test message."""
    message = {"type": message_type, "timestamp": datetime.now().isoformat(), **kwargs}
    return message


def assert_websocket_message_sent(websocket: MockWebSocket, expected_type: str, **expected_fields):
    """Assert that a specific WebSocket message was sent."""
    messages = websocket.get_sent_messages()
    for msg in messages:
        if isinstance(msg.get("data"), str):
            try:
                data = json.loads(msg["data"])
            except (json.JSONDecodeError, TypeError):
                continue
        else:
            data = msg.get("data", {})

        if data.get("type") == expected_type:
            for key, value in expected_fields.items():
                assert data.get(key) == value, f"Field {key} mismatch"
            return True

    raise AssertionError(f"No message of type {expected_type} was sent")
