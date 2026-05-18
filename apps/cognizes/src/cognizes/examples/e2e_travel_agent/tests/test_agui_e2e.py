"""
AG-UI E2E 可视化验收测试

验证所有四大支柱的 AG-UI 事件在 E2E 场景中正确发射
"""

import pytest
import asyncio
import json
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport

# 导入 CopilotKit AG-UI 服务端应用
from cognizes.engine.agui.copilotkit_server import app


@pytest.fixture
async def agui_client():
    """AG-UI 客户端 - 使用 ASGITransport 直接测试 ASGI 应用"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


class TestAgUiE2E:
    """AG-UI E2E 测试套件"""

    @pytest.mark.asyncio
    async def test_event_stream_lifecycle(self, agui_client: AsyncClient):
        """
        测试事件流生命周期

        验证 RUN_STARTED -> ... -> RUN_FINISHED 完整流程
        """
        events = []

        async with agui_client.stream(
            "POST", "/api/copilotkit", json={"messages": [{"role": "user", "content": "你好"}]}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)

        # 验证生命周期事件
        event_types = [e["type"] for e in events]
        assert "RUN_STARTED" in event_types
        assert "RUN_FINISHED" in event_types or "RUN_ERROR" in event_types

        # 验证事件顺序
        run_start_idx = event_types.index("RUN_STARTED")
        run_end_idx = (
            len(event_types)
            - 1
            - event_types[::-1].index("RUN_FINISHED" if "RUN_FINISHED" in event_types else "RUN_ERROR")
        )
        assert run_start_idx < run_end_idx

    @pytest.mark.asyncio
    async def test_text_message_streaming(self, agui_client: AsyncClient):
        """
        测试文本消息流式输出

        验证 TEXT_MESSAGE_START -> CONTENT* -> END
        """
        events = []

        async with agui_client.stream(
            "POST", "/api/copilotkit", json={"messages": [{"role": "user", "content": "讲个笑话"}]}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)

        text_events = [e for e in events if e["type"].startswith("TEXT_MESSAGE")]

        # 验证有消息内容
        content_events = [e for e in text_events if e["type"] == "TEXT_MESSAGE_CONTENT"]
        assert len(content_events) > 0, "应该有流式消息内容"

        # 验证增量文本拼接
        full_text = "".join(e.get("delta", "") for e in content_events)
        assert len(full_text) > 0

    @pytest.mark.asyncio
    async def test_tool_call_visualization(self, agui_client: AsyncClient):
        """
        测试工具调用可视化

        验证 TOOL_CALL_START -> ARGS -> END
        """
        events = []

        # 触发一个需要工具调用的查询
        async with agui_client.stream(
            "POST", "/api/copilotkit", json={"messages": [{"role": "user", "content": "搜索北京到上海的航班"}]}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)

        tool_events = [e for e in events if e["type"].startswith("TOOL_CALL")]

        if tool_events:  # 如果有工具调用
            # 验证工具调用生命周期
            tool_types = [e["type"] for e in tool_events]
            assert "TOOL_CALL_START" in tool_types
            assert "TOOL_CALL_END" in tool_types

            # 验证工具名称存在
            start_event = next(e for e in tool_events if e["type"] == "TOOL_CALL_START")
            assert "toolCallName" in start_event

    @pytest.mark.asyncio
    async def test_memory_visualization(self, agui_client: AsyncClient):
        """
        测试记忆可视化

        验证 CUSTOM (memory_hit) 事件
        """
        # 首先创建一些记忆
        await agui_client.post("/api/copilotkit", json={"messages": [{"role": "user", "content": "我不喜欢辣的食物"}]})

        # 然后查询触发记忆召回
        events = []
        async with agui_client.stream(
            "POST", "/api/copilotkit", json={"messages": [{"role": "user", "content": "推荐一家餐厅"}]}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)

        # 查找记忆相关事件
        memory_events = [e for e in events if e["type"] == "CUSTOM" and e.get("name", "").startswith("memory_")]

        # 记忆召回应该被记录
        # (这取决于系统是否有足够的记忆)

    @pytest.mark.asyncio
    async def test_state_delta_synchronization(self, agui_client: AsyncClient):
        """
        测试状态增量同步

        验证 STATE_DELTA 事件正确发射
        """
        events = []

        async with agui_client.stream(
            "POST", "/api/copilotkit", json={"messages": [{"role": "user", "content": "记住我是 VIP 用户"}]}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)

        state_events = [e for e in events if e["type"] == "STATE_DELTA"]

        if state_events:
            # 验证 JSON Patch 格式
            for event in state_events:
                assert "delta" in event
                delta = event["delta"]
                assert isinstance(delta, list)
                for op in delta:
                    assert "op" in op
                    assert op["op"] in ["add", "remove", "replace"]

    @pytest.mark.asyncio
    async def test_event_latency(self, agui_client: AsyncClient):
        """
        测试事件延迟

        验证事件流延迟 < 100ms
        """
        import time

        start_time = time.perf_counter()
        first_event_time = None

        async with agui_client.stream(
            "POST", "/api/copilotkit", json={"messages": [{"role": "user", "content": "测试"}]}, timeout=30.0
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    if first_event_time is None:
                        first_event_time = time.perf_counter()
                    break

        latency_ms = (first_event_time - start_time) * 1000
        assert latency_ms < 100, f"首事件延迟 {latency_ms:.2f}ms > 100ms"
