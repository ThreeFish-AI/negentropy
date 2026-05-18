"""
AgentExecutor 单元测试
验证 Agent 核心编排逻辑、解析器、工具调用及超时处理
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime
from cognizes.engine.mind.agent_executor import AgentExecutor, ExecutionStatus, ThinkingStep


# 模拟 LLM 响应
class MockLLM:
    def __init__(self, responses):
        self.responses = responses
        self.call_count = 0

    async def generate(self, user_input):
        if self.call_count < len(self.responses):
            resp = self.responses[self.call_count]
            self.call_count += 1
            return resp
        return "Final Answer: No more responses."


@pytest.fixture
def mock_tool_registry():
    registry = Mock()
    registry.invoke_tool = AsyncMock()
    return registry


class TestAgentExecutor:
    async def test_run_simple_turn(self, mock_tool_registry):
        """测试简单单轮对话 (直接 Final Answer)"""
        llm = MockLLM(["Final Answer: Hello world"])
        executor = AgentExecutor(llm, mock_tool_registry)

        result = await executor.run("Hi")

        assert result.status == ExecutionStatus.COMPLETED
        assert result.final_answer == "Hello world"
        assert len(result.steps) == 1
        assert result.steps[0].action is None

    async def test_run_with_tool_call(self, mock_tool_registry):
        """测试带工具调用的多轮对话"""
        # 1. Thought + Action
        # 2. Observation (by tool) -> Final Answer
        llm = MockLLM(
            ["Thought: I need to search.\nAction: search_tool\nAction Input: query", "Final Answer: Found it."]
        )
        mock_tool_registry.invoke_tool.return_value = "Search Result 123"

        executor = AgentExecutor(llm, mock_tool_registry)
        result = await executor.run("Search something")

        assert result.status == ExecutionStatus.COMPLETED
        assert result.final_answer == "Found it."
        assert len(result.steps) == 2

        # 验证第一步 (Action)
        step1 = result.steps[0]
        assert step1.action == "search_tool"
        assert step1.observation == "Search Result 123"

        mock_tool_registry.invoke_tool.assert_called_once()

    async def test_max_steps_reached(self, mock_tool_registry):
        """测试达到最大步数"""
        # 无限循环 Thought
        llm = MockLLM(["Thought: loop..."] * 5)

        executor = AgentExecutor(llm, mock_tool_registry, max_steps=3)
        result = await executor.run("Loop")

        assert result.status == ExecutionStatus.MAX_STEPS_REACHED
        assert len(result.steps) == 3
        assert result.error is not None

    async def test_timeout(self, mock_tool_registry):
        """测试执行超时"""
        delayed_llm = Mock()

        async def delay_gen(_):
            await asyncio.sleep(0.2)
            # 返回非结束 Thought，迫使进入下一次循环，从而触发循环头的超时检查
            return "Thought: delay..."

        delayed_llm.generate = delay_gen

        # 设置极短超时 0.1s < 0.2s
        executor = AgentExecutor(delayed_llm, mock_tool_registry, timeout_seconds=0.1)
        result = await executor.run("Timeout test")

        assert result.status == ExecutionStatus.TIMEOUT

    async def test_tool_error_handling(self, mock_tool_registry):
        """测试工具执行异常捕获"""
        llm = MockLLM(["Thought: try tool\nAction: fail_tool"])
        # 工具抛出异常
        mock_tool_registry.invoke_tool.side_effect = ValueError("Tool failed")

        executor = AgentExecutor(llm, mock_tool_registry, max_steps=1)
        result = await executor.run("Fail me")

        step = result.steps[0]
        assert "Error: Tool failed" in str(step.observation)

    def test_parse_response_formats(self, mock_tool_registry):
        """测试解析器逻辑"""
        executor = AgentExecutor(None, None)

        # 1. Standard
        r1 = "Thought: T1\nAction: A1\nAction Input: I1"
        t, a, i, f = executor._parse_response(r1)
        assert t == "T1"
        assert a == "A1"
        assert not f

        # 2. Final Answer
        r2 = "Some text... Final Answer: Result"
        t, a, i, f = executor._parse_response(r2)
        assert t == "Result"
        assert f is True
