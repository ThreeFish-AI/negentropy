"""
EventBridge 单元测试

测试范围：纯逻辑测试，不依赖数据库
- AgUiEvent.to_sse() SSE 格式化
- _convert_to_agui_event() 事件类型映射
"""

import json
import pytest
from datetime import datetime

from cognizes.engine.pulse.event_bridge import (
    AgUiEventType,
    AgUiEvent,
    PulseEventBridge,
)


class TestAgUiEventType:
    """AG-UI 事件类型枚举测试"""

    def test_all_event_types_defined(self):
        """确认所有事件类型已定义"""
        expected_types = [
            "RUN_STARTED",
            "RUN_FINISHED",
            "RUN_ERROR",
            "STEP_STARTED",
            "STEP_FINISHED",
            "TEXT_MESSAGE_START",
            "TEXT_MESSAGE_CONTENT",
            "TEXT_MESSAGE_END",
            "TOOL_CALL_START",
            "TOOL_CALL_ARGS",
            "TOOL_CALL_END",
            "STATE_SNAPSHOT",
            "STATE_DELTA",
            "MESSAGES_SNAPSHOT",
            "RAW",
            "CUSTOM",
        ]
        for t in expected_types:
            assert hasattr(AgUiEventType, t)

    def test_event_type_is_string(self):
        """事件类型值是字符串"""
        assert AgUiEventType.RUN_STARTED.value == "RUN_STARTED"
        assert isinstance(AgUiEventType.RUN_FINISHED.value, str)


class TestAgUiEventToSSE:
    """AgUiEvent.to_sse() 测试"""

    def test_basic_sse_format(self):
        """基本 SSE 格式"""
        event = AgUiEvent(
            type=AgUiEventType.RUN_STARTED,
            run_id="run-123",
            timestamp=1234567890.0,
            data={"threadId": "thread-456"},
        )
        sse = event.to_sse()

        assert sse.startswith("data: ")
        assert sse.endswith("\n\n")

        # 解析 JSON 部分
        json_str = sse[6:-2]  # 去掉 "data: " 和 "\n\n"
        parsed = json.loads(json_str)

        assert parsed["type"] == "RUN_STARTED"
        assert parsed["runId"] == "run-123"
        assert parsed["timestamp"] == 1234567890.0
        assert parsed["threadId"] == "thread-456"

    def test_sse_with_empty_data(self):
        """空 data 的 SSE"""
        event = AgUiEvent(
            type=AgUiEventType.RUN_FINISHED,
            run_id="run-789",
        )
        sse = event.to_sse()
        parsed = json.loads(sse[6:-2])

        assert parsed["type"] == "RUN_FINISHED"
        assert "runId" in parsed


class TestConvertToAgUiEvent:
    """_convert_to_agui_event 映射测试"""

    @pytest.fixture
    def bridge(self):
        """创建 EventBridge（Mock Listener）"""
        from unittest.mock import MagicMock

        mock_listener = MagicMock()
        return PulseEventBridge(mock_listener)

    def test_runs_insert_maps_to_run_started(self, bridge):
        """runs 表 INSERT -> RUN_STARTED"""
        pg_data = {
            "table": "runs",
            "operation": "INSERT",
            "data": {"id": "run-1", "thread_id": "thread-1"},
        }
        event = bridge._convert_to_agui_event(pg_data)

        assert event is not None
        assert event.type == AgUiEventType.RUN_STARTED
        assert event.run_id == "run-1"
        assert event.data["threadId"] == "thread-1"

    def test_runs_update_completed_maps_to_run_finished(self, bridge):
        """runs 表 UPDATE (completed) -> RUN_FINISHED"""
        pg_data = {
            "table": "runs",
            "operation": "UPDATE",
            "data": {"id": "run-2", "status": "completed"},
        }
        event = bridge._convert_to_agui_event(pg_data)

        assert event.type == AgUiEventType.RUN_FINISHED

    def test_runs_update_failed_maps_to_run_error(self, bridge):
        """runs 表 UPDATE (failed) -> RUN_ERROR"""
        pg_data = {
            "table": "runs",
            "operation": "UPDATE",
            "data": {
                "id": "run-3",
                "status": "failed",
                "error": "Something went wrong",
            },
        }
        event = bridge._convert_to_agui_event(pg_data)

        assert event.type == AgUiEventType.RUN_ERROR
        assert event.data["error"] == "Something went wrong"

    def test_events_message_maps_to_text_content(self, bridge):
        """events 表 message -> TEXT_MESSAGE_CONTENT"""
        pg_data = {
            "table": "events",
            "operation": "INSERT",
            "data": {
                "id": "evt-1",
                "run_id": "run-4",
                "event_type": "message",
                "content": {"text": "Hello world"},
            },
        }
        event = bridge._convert_to_agui_event(pg_data)

        assert event.type == AgUiEventType.TEXT_MESSAGE_CONTENT
        assert event.data["delta"] == "Hello world"

    def test_events_tool_call_maps_to_tool_call_start(self, bridge):
        """events 表 tool_call -> TOOL_CALL_START"""
        pg_data = {
            "table": "events",
            "operation": "INSERT",
            "data": {
                "id": "evt-2",
                "run_id": "run-5",
                "event_type": "tool_call",
                "content": {"tool_name": "search"},
            },
        }
        event = bridge._convert_to_agui_event(pg_data)

        assert event.type == AgUiEventType.TOOL_CALL_START
        assert event.data["toolCallName"] == "search"

    def test_threads_state_update_maps_to_state_delta(self, bridge):
        """threads 表 UPDATE (state) -> STATE_DELTA"""
        pg_data = {
            "table": "threads",
            "operation": "UPDATE",
            "data": {
                "id": "thread-1",
                "state": {"counter": 5},
                "state_delta": [{"op": "replace", "path": "/counter", "value": 5}],
            },
        }
        event = bridge._convert_to_agui_event(pg_data)

        assert event.type == AgUiEventType.STATE_DELTA

    def test_unknown_table_returns_none(self, bridge):
        """未知表返回 None"""
        pg_data = {
            "table": "unknown_table",
            "operation": "INSERT",
            "data": {"id": "123"},
        }
        event = bridge._convert_to_agui_event(pg_data)
        assert event is None

    def test_missing_run_id_returns_none(self, bridge):
        """缺少 run_id 返回 None"""
        pg_data = {
            "table": "runs",
            "operation": "INSERT",
            "data": {},  # 没有 id 或 run_id
        }
        event = bridge._convert_to_agui_event(pg_data)
        assert event is None
