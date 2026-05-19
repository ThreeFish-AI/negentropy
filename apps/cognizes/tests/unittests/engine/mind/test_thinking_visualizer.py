"""
ThinkingVisualizer 单元测试
验证思维链可视化、工具调用、Trace 事件发射逻辑
"""

import pytest
from unittest.mock import AsyncMock, Mock
from cognizes.engine.mind.thinking_visualizer import (
    ThinkingVisualizer,
    ThinkingStep,
    ToolExecution,
    TraceSpan,
    MindEventType,
)


@pytest.fixture
def mock_emitter():
    emitter = AsyncMock()
    # Mock emit_custom, emit_step_started etc methods
    emitter.emit_custom = AsyncMock()
    emitter.emit_step_started = AsyncMock()
    emitter.emit_step_finished = AsyncMock()
    emitter.emit_tool_call_start = AsyncMock()
    emitter.emit_tool_call_args = AsyncMock()
    emitter.emit_tool_call_end = AsyncMock()
    return emitter


class TestThinkingVisualizer:
    async def test_emit_thinking_lifecycle(self, mock_emitter):
        """测试思维步骤完整生命周期"""
        viz = ThinkingVisualizer(event_emitter=mock_emitter)
        run_id = "test_run"
        step = ThinkingStep(
            step_id="step_1", step_type="thought", content="I need to think.", reasoning="Reasoning...", confidence=0.9
        )

        # 1. Start
        await viz.emit_thinking_started(run_id, step)
        mock_emitter.emit_step_started.assert_called_once()
        args = mock_emitter.emit_step_started.call_args[1]
        assert args["run_id"] == run_id
        assert args["step_name"] == "thinking_thought"

        # 2. Content Delta
        await viz.emit_thinking_content(run_id, step.step_id, " thinking content")
        mock_emitter.emit_custom.assert_called_with(
            run_id=run_id,
            event_name=MindEventType.THINKING_STEP.value,
            data={"stepId": step.step_id, "delta": " thinking content"},
        )

        # 3. Finish
        await viz.emit_thinking_finished(run_id, step)
        mock_emitter.emit_step_finished.assert_called_once()
        args = mock_emitter.emit_step_finished.call_args[1]
        assert args["data"]["content"] == "I need to think."

    async def test_emit_tool_call_lifecycle(self, mock_emitter):
        """测试工具调用完整生命周期"""
        viz = ThinkingVisualizer(event_emitter=mock_emitter)
        run_id = "test_run"
        execution = ToolExecution(tool_call_id="call_1", tool_name="search_tool", args={"query": "test"})

        # 1. Start
        await viz.emit_tool_call_start(run_id, execution)
        mock_emitter.emit_tool_call_start.assert_called_once()
        assert execution.status == "running"

        # 2. Args Delta
        await viz.emit_tool_call_args(run_id, "call_1", "query_delta")
        mock_emitter.emit_tool_call_args.assert_called_once()

        # 3. End
        await viz.emit_tool_call_end(run_id, "call_1", "result", 100.0)
        mock_emitter.emit_tool_call_end.assert_called_once()

        # 验证内部状态更新
        stored_exec = viz._tool_executions["call_1"]
        assert stored_exec.status == "completed"
        assert stored_exec.result == "result"
        assert stored_exec.latency_ms == 100.0

    async def test_emit_trace_span(self, mock_emitter):
        """测试 Trace Span 发射"""
        viz = ThinkingVisualizer(event_emitter=mock_emitter)
        span = TraceSpan(span_id="span_1", parent_span_id=None, operation_name="op", start_time=1000.0)

        await viz.emit_trace_span("run_1", span)

        mock_emitter.emit_custom.assert_called_once()
        call_args = mock_emitter.emit_custom.call_args[1]
        assert call_args["event_name"] == MindEventType.TRACE_SPAN.value
        assert call_args["data"]["spanId"] == "span_1"

    async def test_get_thinking_summary(self, mock_emitter):
        """测试摘要生成"""
        viz = ThinkingVisualizer(event_emitter=mock_emitter)

        # 添加数据
        step = ThinkingStep("s1", "thought", "content")
        viz._current_steps.append(step)

        tool = ToolExecution("t1", "tool", {}, result="res", status="completed", latency_ms=50)
        viz._tool_executions["t1"] = tool

        summary = viz.get_thinking_summary()

        assert summary["totalSteps"] == 1
        assert summary["steps"][0]["id"] == "s1"
        assert len(summary["toolCalls"]) == 1
        assert summary["toolCalls"][0]["latencyMs"] == 50
