"""
AG-UI 事件发射器
将 Agent 执行事件转换为 AG-UI 标准事件格式
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Any, Optional
import json
import time


class EventType(str, Enum):
    """AG-UI 16 种标准事件类型"""

    # Lifecycle Events
    RUN_STARTED = "RUN_STARTED"
    RUN_FINISHED = "RUN_FINISHED"
    RUN_ERROR = "RUN_ERROR"
    STEP_STARTED = "STEP_STARTED"
    STEP_FINISHED = "STEP_FINISHED"

    # Text Message Events
    TEXT_MESSAGE_START = "TEXT_MESSAGE_START"
    TEXT_MESSAGE_CONTENT = "TEXT_MESSAGE_CONTENT"
    TEXT_MESSAGE_END = "TEXT_MESSAGE_END"

    # Tool Call Events
    TOOL_CALL_START = "TOOL_CALL_START"
    TOOL_CALL_ARGS = "TOOL_CALL_ARGS"
    TOOL_CALL_END = "TOOL_CALL_END"

    # State Management Events
    STATE_SNAPSHOT = "STATE_SNAPSHOT"
    STATE_DELTA = "STATE_DELTA"
    MESSAGES_SNAPSHOT = "MESSAGES_SNAPSHOT"

    # Special Events
    RAW = "RAW"
    CUSTOM = "CUSTOM"


@dataclass
class BaseEvent:
    """AG-UI 基础事件"""

    type: EventType
    timestamp: float = field(default_factory=time.time)
    run_id: Optional[str] = None


@dataclass
class RunStartedEvent(BaseEvent):
    """运行开始事件"""

    type: EventType = EventType.RUN_STARTED


@dataclass
class TextMessageContentEvent(BaseEvent):
    """文本消息内容事件 (流式)"""

    type: EventType = EventType.TEXT_MESSAGE_CONTENT
    message_id: str = ""
    delta: str = ""  # 增量文本内容


@dataclass
class ToolCallStartEvent(BaseEvent):
    """工具调用开始事件"""

    type: EventType = EventType.TOOL_CALL_START
    tool_call_id: str = ""
    tool_call_name: str = ""


@dataclass
class StateDeltaEvent(BaseEvent):
    """状态增量事件"""

    type: EventType = EventType.STATE_DELTA
    delta: list = field(default_factory=list)  # JSON Patch 操作列表


class AgUiEventEmitter:
    """AG-UI 事件发射器"""

    def __init__(self, run_id: str):
        self.run_id = run_id
        self._event_buffer: list[BaseEvent] = []

    def emit_run_started(self) -> RunStartedEvent:
        """发射运行开始事件"""
        event = RunStartedEvent(run_id=self.run_id)
        self._event_buffer.append(event)
        return event

    def emit_text_content(self, message_id: str, delta: str) -> TextMessageContentEvent:
        """发射文本内容增量事件"""
        event = TextMessageContentEvent(run_id=self.run_id, message_id=message_id, delta=delta)
        self._event_buffer.append(event)
        return event

    def emit_tool_call_start(self, tool_call_id: str, name: str) -> ToolCallStartEvent:
        """发射工具调用开始事件"""
        event = ToolCallStartEvent(run_id=self.run_id, tool_call_id=tool_call_id, tool_call_name=name)
        self._event_buffer.append(event)
        return event

    def emit_state_delta(self, delta_operations: list[dict]) -> StateDeltaEvent:
        """发射状态增量事件 (JSON Patch)"""
        event = StateDeltaEvent(run_id=self.run_id, delta=delta_operations)
        self._event_buffer.append(event)
        return event

    def to_sse(self) -> str:
        """将事件缓冲区转换为 SSE 格式"""
        lines = []
        for event in self._event_buffer:
            data = json.dumps(
                {
                    "type": event.type.value,
                    "timestamp": event.timestamp,
                    "run_id": event.run_id,
                    **{k: v for k, v in event.__dict__.items() if k not in ("type", "timestamp", "run_id")},
                }
            )
            lines.append(f"data: {data}\n\n")
        return "".join(lines)
