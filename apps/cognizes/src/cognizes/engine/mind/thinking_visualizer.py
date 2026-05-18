"""
Mind ThinkingVisualizer: 思维链可视化接口

职责:
1. 提供 Agent 思维过程的实时可视化
2. 展示工具调用的参数和结果
3. 集成 OpenTelemetry Trace 可视化
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional
from datetime import datetime
from enum import Enum


class MindEventType(str, Enum):
    """Mind 层 AG-UI 事件类型"""

    THINKING_STEP = "thinking_step"
    TOOL_EXECUTION = "tool_execution"
    TRACE_SPAN = "trace_span"
    DECISION_POINT = "decision_point"


@dataclass
class ThinkingStep:
    """思维步骤"""

    step_id: str
    step_type: str  # thought, action, observation
    content: str
    reasoning: Optional[str] = None
    confidence: float = 1.0
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())


@dataclass
class ToolExecution:
    """工具执行"""

    tool_call_id: str
    tool_name: str
    args: dict
    result: Optional[Any] = None
    status: str = "pending"  # pending, running, completed, failed
    latency_ms: float = 0.0


@dataclass
class TraceSpan:
    """追踪 Span"""

    span_id: str
    parent_span_id: Optional[str]
    operation_name: str
    start_time: float
    end_time: Optional[float] = None
    attributes: dict = field(default_factory=dict)
    status: str = "running"


class ThinkingVisualizer:
    """思维链可视化器"""

    def __init__(self, event_emitter=None):
        """
        Args:
            event_emitter: AG-UI 事件发射器
        """
        self._event_emitter = event_emitter
        self._current_steps: list[ThinkingStep] = []
        self._tool_executions: dict[str, ToolExecution] = {}

    async def emit_thinking_started(self, run_id: str, step: ThinkingStep) -> None:
        """
        发射思维步骤开始事件

        Args:
            run_id: 当前运行 ID
            step: 思维步骤
        """
        self._current_steps.append(step)

        if self._event_emitter:
            await self._event_emitter.emit_step_started(
                run_id=run_id,
                step_name=f"thinking_{step.step_type}",
                data={"stepId": step.step_id, "stepType": step.step_type, "stepIndex": len(self._current_steps)},
            )

    async def emit_thinking_content(self, run_id: str, step_id: str, content_delta: str) -> None:
        """
        发射思维内容增量事件 (流式)

        Args:
            run_id: 当前运行 ID
            step_id: 步骤 ID
            content_delta: 内容增量
        """
        if self._event_emitter:
            await self._event_emitter.emit_custom(
                run_id=run_id,
                event_name=MindEventType.THINKING_STEP.value,
                data={"stepId": step_id, "delta": content_delta},
            )

    async def emit_thinking_finished(self, run_id: str, step: ThinkingStep) -> None:
        """
        发射思维步骤完成事件

        Args:
            run_id: 当前运行 ID
            step: 思维步骤
        """
        if self._event_emitter:
            await self._event_emitter.emit_step_finished(
                run_id=run_id,
                step_name=f"thinking_{step.step_type}",
                data={
                    "stepId": step.step_id,
                    "content": step.content[:500],  # 截断长内容
                    "reasoning": step.reasoning,
                    "confidence": step.confidence,
                },
            )

    async def emit_tool_call_start(self, run_id: str, execution: ToolExecution) -> None:
        """
        发射工具调用开始事件

        Args:
            run_id: 当前运行 ID
            execution: 工具执行
        """
        self._tool_executions[execution.tool_call_id] = execution
        execution.status = "running"

        if self._event_emitter:
            await self._event_emitter.emit_tool_call_start(
                run_id=run_id, tool_call_id=execution.tool_call_id, tool_call_name=execution.tool_name
            )

    async def emit_tool_call_args(self, run_id: str, tool_call_id: str, args_delta: str) -> None:
        """
        发射工具参数增量事件 (流式)

        Args:
            run_id: 当前运行 ID
            tool_call_id: 工具调用 ID
            args_delta: 参数增量
        """
        if self._event_emitter:
            await self._event_emitter.emit_tool_call_args(run_id=run_id, tool_call_id=tool_call_id, delta=args_delta)

    async def emit_tool_call_end(self, run_id: str, tool_call_id: str, result: Any, latency_ms: float) -> None:
        """
        发射工具调用完成事件

        Args:
            run_id: 当前运行 ID
            tool_call_id: 工具调用 ID
            result: 执行结果
            latency_ms: 延迟
        """
        if tool_call_id in self._tool_executions:
            execution = self._tool_executions[tool_call_id]
            execution.result = result
            execution.status = "completed"
            execution.latency_ms = latency_ms

        if self._event_emitter:
            await self._event_emitter.emit_tool_call_end(
                run_id=run_id,
                tool_call_id=tool_call_id,
                result=str(result)[:1000],  # 截断长结果
            )

    async def emit_trace_span(self, run_id: str, span: TraceSpan) -> None:
        """
        发射追踪 Span 事件

        用于在前端展示 OpenTelemetry Trace

        Args:
            run_id: 当前运行 ID
            span: 追踪 Span
        """
        if self._event_emitter:
            await self._event_emitter.emit_custom(
                run_id=run_id,
                event_name=MindEventType.TRACE_SPAN.value,
                data={
                    "spanId": span.span_id,
                    "parentSpanId": span.parent_span_id,
                    "operationName": span.operation_name,
                    "startTime": span.start_time,
                    "endTime": span.end_time,
                    "durationMs": ((span.end_time - span.start_time) * 1000 if span.end_time else None),
                    "attributes": span.attributes,
                    "status": span.status,
                },
            )

    def get_thinking_summary(self) -> dict:
        """
        获取思维过程摘要

        Returns:
            思维摘要
        """
        return {
            "totalSteps": len(self._current_steps),
            "steps": [
                {"id": s.step_id, "type": s.step_type, "preview": s.content[:100] if s.content else ""}
                for s in self._current_steps
            ],
            "toolCalls": [
                {"id": e.tool_call_id, "name": e.tool_name, "status": e.status, "latencyMs": e.latency_ms}
                for e in self._tool_executions.values()
            ],
        }
