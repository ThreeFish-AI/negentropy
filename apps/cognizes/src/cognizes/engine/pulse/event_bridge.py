"""
Pulse EventBridge: 将 PostgreSQL 事件转换为 AG-UI 标准事件

职责:
1. 监听 PostgreSQL NOTIFY 事件
2. 转换为 AG-UI 标准事件格式
3. 通过 SSE/WebSocket 推送到前端
"""

from __future__ import annotations

import json
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, AsyncGenerator
from datetime import datetime


class AgUiEventType(str, Enum):
    """AG-UI 标准事件类型"""

    RUN_STARTED = "RUN_STARTED"
    RUN_FINISHED = "RUN_FINISHED"
    RUN_ERROR = "RUN_ERROR"
    STEP_STARTED = "STEP_STARTED"
    STEP_FINISHED = "STEP_FINISHED"
    TEXT_MESSAGE_START = "TEXT_MESSAGE_START"
    TEXT_MESSAGE_CONTENT = "TEXT_MESSAGE_CONTENT"
    TEXT_MESSAGE_END = "TEXT_MESSAGE_END"
    TOOL_CALL_START = "TOOL_CALL_START"
    TOOL_CALL_ARGS = "TOOL_CALL_ARGS"
    TOOL_CALL_END = "TOOL_CALL_END"
    STATE_SNAPSHOT = "STATE_SNAPSHOT"
    STATE_DELTA = "STATE_DELTA"
    MESSAGES_SNAPSHOT = "MESSAGES_SNAPSHOT"
    RAW = "RAW"
    CUSTOM = "CUSTOM"


@dataclass
class AgUiEvent:
    """AG-UI 标准事件"""

    type: AgUiEventType
    run_id: str
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())
    data: dict = field(default_factory=dict)

    def to_sse(self) -> str:
        """转换为 SSE 格式"""
        payload = {
            "type": self.type.value,
            "runId": self.run_id,
            "timestamp": self.timestamp,
            **self.data,
        }
        return f"data: {json.dumps(payload)}\n\n"


class PulseEventBridge:
    """
    Pulse 事件桥接器

    将 PostgreSQL 事件转换为 AG-UI 标准事件
    """

    def __init__(self, pg_listener):
        """
        Args:
            pg_listener: PgNotifyListener 实例
        """
        self._pg_listener = pg_listener
        self._subscribers: dict[str, list[asyncio.Queue]] = {}  # run_id -> queues
        self._running = False

    async def start(self) -> None:
        """启动事件桥接"""
        self._running = True

        # 注册 PostgreSQL 监听器回调
        await self._pg_listener.subscribe(channel="event_stream", callback=self._handle_pg_event)

    async def stop(self) -> None:
        """停止事件桥接"""
        self._running = False
        await self._pg_listener.unsubscribe("event_stream")

    async def subscribe(self, run_id: str) -> AsyncGenerator[AgUiEvent, None]:
        """
        订阅指定 run_id 的事件流

        Yields:
            AgUiEvent: AG-UI 标准事件
        """
        queue: asyncio.Queue = asyncio.Queue()

        if run_id not in self._subscribers:
            self._subscribers[run_id] = []
        self._subscribers[run_id].append(queue)

        try:
            while self._running:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield event

                    # 如果是完成事件，结束订阅
                    if event.type in (
                        AgUiEventType.RUN_FINISHED,
                        AgUiEventType.RUN_ERROR,
                    ):
                        break
                except asyncio.TimeoutError:
                    # 发送心跳
                    yield AgUiEvent(
                        type=AgUiEventType.CUSTOM,
                        run_id=run_id,
                        data={"name": "heartbeat"},
                    )
        finally:
            self._subscribers[run_id].remove(queue)
            if not self._subscribers[run_id]:
                del self._subscribers[run_id]

    async def _handle_pg_event(self, channel: str, payload: str) -> None:
        """处理 PostgreSQL 事件并转换为 AG-UI 事件"""
        try:
            data = json.loads(payload)
            event = self._convert_to_agui_event(data)

            if event and event.run_id in self._subscribers:
                for queue in self._subscribers[event.run_id]:
                    await queue.put(event)
        except json.JSONDecodeError:
            pass

    def _convert_to_agui_event(self, pg_data: dict) -> AgUiEvent | None:
        """
        将 PostgreSQL 事件数据转换为 AG-UI 事件

        Args:
            pg_data: PostgreSQL NOTIFY 载荷

        Returns:
            AG-UI 事件或 None
        """
        table = pg_data.get("table")
        operation = pg_data.get("operation")
        row_data = pg_data.get("data", {})

        run_id = row_data.get("run_id") or row_data.get("id")
        if not run_id:
            return None

        # 根据表和操作类型映射事件
        if table == "runs":
            if operation == "INSERT":
                return AgUiEvent(
                    type=AgUiEventType.RUN_STARTED,
                    run_id=run_id,
                    data={"threadId": row_data.get("thread_id")},
                )
            elif operation == "UPDATE":
                status = row_data.get("status")
                if status == "completed":
                    return AgUiEvent(
                        type=AgUiEventType.RUN_FINISHED,
                        run_id=run_id,
                        data={"status": status},
                    )
                elif status == "failed":
                    return AgUiEvent(
                        type=AgUiEventType.RUN_ERROR,
                        run_id=run_id,
                        data={"error": row_data.get("error")},
                    )

        elif table == "events":
            event_type = row_data.get("event_type")
            if event_type == "message":
                return AgUiEvent(
                    type=AgUiEventType.TEXT_MESSAGE_CONTENT,
                    run_id=run_id,
                    data={
                        "messageId": row_data.get("id"),
                        "delta": row_data.get("content", {}).get("text", ""),
                    },
                )
            elif event_type == "tool_call":
                return AgUiEvent(
                    type=AgUiEventType.TOOL_CALL_START,
                    run_id=run_id,
                    data={
                        "toolCallId": row_data.get("id"),
                        "toolCallName": row_data.get("content", {}).get("tool_name"),
                    },
                )

        elif table == "threads":
            if operation == "UPDATE" and "state" in row_data:
                return AgUiEvent(
                    type=AgUiEventType.STATE_DELTA,
                    run_id=run_id,
                    data={"delta": row_data.get("state_delta", [])},
                )

        return None


# FastAPI 端点示例
async def create_sse_endpoint(bridge: PulseEventBridge, run_id: str):
    """
    创建 SSE 事件流端点

    Usage:
        @app.get("/api/runs/{run_id}/events")
        async def stream_events(run_id: str):
            return StreamingResponse(
                create_sse_endpoint(bridge, run_id),
                media_type="text/event-stream"
            )
    """
    async for event in bridge.subscribe(run_id):
        yield event.to_sse()
