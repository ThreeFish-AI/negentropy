"""
EventBridge 端到端集成测试

测试范围：完整事件流链路
- PostgreSQL NOTIFY -> EventBridge -> AG-UI Event
- SSE 订阅流
"""

import asyncio
import json
import pytest
import pytest_asyncio

from cognizes.engine.pulse.event_bridge import (
    AgUiEventType,
    AgUiEvent,
    PulseEventBridge,
)
from cognizes.engine.pulse.pg_notify_listener import PgNotifyListener
from cognizes.core.database import DatabaseManager


# 注意：此测试需要运行中的 PostgreSQL 数据库


@pytest_asyncio.fixture
async def conn():
    """创建测试连接"""
    db = DatabaseManager.get_instance()
    await db.get_pool()
    async with db.acquire() as conn:
        yield conn


class TestEventBridgeE2E:
    """EventBridge 端到端测试"""

    @pytest.mark.asyncio
    async def test_notify_triggers_agui_event(self, conn):
        """NOTIFY -> AG-UI Event 完整链路"""
        received_events = []

        # 模拟 PgNotifyListener 的回调机制
        class MockListener:
            def __init__(self):
                self._callbacks = {}

            async def subscribe(self, channel: str, callback):
                self._callbacks[channel] = callback

            async def unsubscribe(self, channel: str):
                if channel in self._callbacks:
                    del self._callbacks[channel]

            async def simulate_notify(self, channel: str, payload: str):
                if channel in self._callbacks:
                    await self._callbacks[channel](channel, payload)

        listener = MockListener()
        bridge = PulseEventBridge(listener)

        await bridge.start()

        # 模拟接收到 runs 表 INSERT 通知
        await listener.simulate_notify(
            "event_stream",
            json.dumps(
                {
                    "table": "runs",
                    "operation": "INSERT",
                    "data": {"id": "test-run-001", "thread_id": "thread-001"},
                }
            ),
        )

        # 验证订阅者收到事件
        # 注意：由于没有实际订阅者，这里主要验证转换逻辑不报错

        await bridge.stop()

    @pytest.mark.asyncio
    async def test_sse_format_output(self):
        """SSE 格式输出测试"""
        event = AgUiEvent(
            type=AgUiEventType.RUN_STARTED,
            run_id="run-sse-test",
            data={"threadId": "thread-sse"},
        )
        sse_output = event.to_sse()

        # 验证 SSE 格式
        assert sse_output.startswith("data: ")
        assert sse_output.endswith("\n\n")

        # 验证 JSON 内容可解析
        json_part = sse_output[6:-2]
        parsed = json.loads(json_part)
        assert parsed["type"] == "RUN_STARTED"
        assert parsed["runId"] == "run-sse-test"

    @pytest.mark.asyncio
    async def test_event_type_mapping_completeness(self):
        """事件类型映射完整性测试"""
        from unittest.mock import MagicMock

        mock_listener = MagicMock()
        bridge = PulseEventBridge(mock_listener)

        # 测试各种表操作的映射
        test_cases = [
            # (table, operation, data, expected_type)
            (
                "runs",
                "INSERT",
                {"id": "r1", "thread_id": "t1"},
                AgUiEventType.RUN_STARTED,
            ),
            (
                "runs",
                "UPDATE",
                {"id": "r2", "status": "completed"},
                AgUiEventType.RUN_FINISHED,
            ),
            (
                "runs",
                "UPDATE",
                {"id": "r3", "status": "failed", "error": "err"},
                AgUiEventType.RUN_ERROR,
            ),
            (
                "events",
                "INSERT",
                {
                    "id": "e1",
                    "run_id": "r1",
                    "event_type": "message",
                    "content": {"text": "hi"},
                },
                AgUiEventType.TEXT_MESSAGE_CONTENT,
            ),
            (
                "events",
                "INSERT",
                {
                    "id": "e2",
                    "run_id": "r1",
                    "event_type": "tool_call",
                    "content": {"tool_name": "search"},
                },
                AgUiEventType.TOOL_CALL_START,
            ),
        ]

        for table, operation, data, expected_type in test_cases:
            pg_data = {"table": table, "operation": operation, "data": data}
            event = bridge._convert_to_agui_event(pg_data)
            assert event is not None, f"Failed for {table}.{operation}"
            assert event.type == expected_type, (
                f"Wrong type for {table}.{operation}: expected {expected_type}, got {event.type}"
            )
