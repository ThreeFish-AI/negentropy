"""
PgNotifyListener 单元测试

测试范围：纯逻辑测试，不依赖数据库连接
- on_event() 回调注册
- _handle_notification() JSON 解析 & 回调触发
"""

import json
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime

from cognizes.engine.pulse.pg_notify_listener import (
    PgNotifyListener,
    NotifyEvent,
)


class TestNotifyEventDataclass:
    """NotifyEvent dataclass 测试"""

    def test_notify_event_creation(self):
        """基本创建测试"""
        event = NotifyEvent(
            channel="event_stream",
            payload={"key": "value"},
            received_at=datetime.now(),
        )
        assert event.channel == "event_stream"
        assert event.payload["key"] == "value"

    def test_notify_event_with_empty_payload(self):
        """空 payload 测试"""
        event = NotifyEvent(
            channel="test_channel",
            payload={},
            received_at=datetime.now(),
        )
        assert event.payload == {}


class TestCallbackRegistration:
    """回调注册测试"""

    def test_on_event_registers_callback(self):
        """测试回调注册"""
        listener = PgNotifyListener(dsn="postgresql://localhost/test")

        async def my_callback(event):
            pass

        listener.on_event("test_channel", my_callback)

        assert "test_channel" in listener._listeners
        assert my_callback in listener._listeners["test_channel"]

    def test_multiple_callbacks_same_channel(self):
        """同一频道多个回调"""
        listener = PgNotifyListener(dsn="postgresql://localhost/test")

        async def callback1(event):
            pass

        async def callback2(event):
            pass

        listener.on_event("test_channel", callback1)
        listener.on_event("test_channel", callback2)

        assert len(listener._listeners["test_channel"]) == 2

    def test_callbacks_different_channels(self):
        """不同频道回调隔离"""
        listener = PgNotifyListener(dsn="postgresql://localhost/test")

        async def callback1(event):
            pass

        async def callback2(event):
            pass

        listener.on_event("channel_a", callback1)
        listener.on_event("channel_b", callback2)

        assert len(listener._listeners["channel_a"]) == 1
        assert len(listener._listeners["channel_b"]) == 1


class TestHandleNotification:
    """_handle_notification 测试"""

    def test_parse_valid_json_payload(self):
        """解析有效 JSON payload"""
        listener = PgNotifyListener(dsn="postgresql://localhost/test")
        mock_conn = MagicMock()

        received_events = []

        async def capture_event(event):
            received_events.append(event)

        listener.on_event("test_channel", capture_event)

        # 调用处理函数
        with patch("asyncio.create_task"):
            listener._handle_notification(mock_conn, 12345, "test_channel", '{"key": "value"}')

    def test_parse_invalid_json_payload(self):
        """解析无效 JSON payload (降级为 raw)"""
        listener = PgNotifyListener(dsn="postgresql://localhost/test")
        mock_conn = MagicMock()

        with patch("asyncio.create_task") as mock_task:
            listener.on_event("test_channel", AsyncMock())
            listener._handle_notification(mock_conn, 12345, "test_channel", "not-valid-json")
            # 应该仍然触发回调，payload 为 {"raw": "..."}
            assert mock_task.called

    def test_no_callback_for_unregistered_channel(self):
        """未注册频道不触发回调"""
        listener = PgNotifyListener(dsn="postgresql://localhost/test")
        mock_conn = MagicMock()

        with patch("asyncio.create_task") as mock_task:
            listener._handle_notification(mock_conn, 12345, "unknown_channel", '{"key": "value"}')
            # 没有注册回调，不应该创建 task
            assert not mock_task.called


class TestListenerInitialization:
    """Listener 初始化测试"""

    def test_default_channels(self):
        """默认频道"""
        listener = PgNotifyListener(dsn="postgresql://localhost/test")
        assert listener.channels == ["event_stream"]

    def test_custom_channels(self):
        """自定义频道"""
        listener = PgNotifyListener(
            dsn="postgresql://localhost/test",
            channels=["channel_a", "channel_b"],
        )
        assert listener.channels == ["channel_a", "channel_b"]

    def test_initial_state(self):
        """初始状态"""
        listener = PgNotifyListener(dsn="postgresql://localhost/test")
        assert listener._connection is None
        assert listener._running is False
        assert listener._listeners == {}
