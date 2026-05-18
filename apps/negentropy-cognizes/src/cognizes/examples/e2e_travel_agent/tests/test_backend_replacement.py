"""
后端替换验证测试：确保 Open Agent Engine 与 Google InMemory 实现行为一致
"""

import os
import pytest
import asyncio
from services import create_services
from agent import create_travel_agent
from config import config, BackendType

pytestmark = pytest.mark.asyncio

# 检查是否有有效的 API key
HAS_API_KEY = bool(os.getenv("GOOGLE_API_KEY"))


class TestBackendReplacement:
    """验证 Drop-in Replacement 的行为一致性"""

    async def test_session_create_and_load(self):
        """测试 Session 创建与加载"""
        session_service, _ = await create_services()

        # 创建 Session
        session = await session_service.create_session(app_name="test_app", user_id="test_user")
        assert session.id is not None
        assert session.app_name == "test_app"

        # 加载 Session
        loaded = await session_service.get_session(app_name="test_app", user_id="test_user", session_id=session.id)
        assert loaded is not None
        assert loaded.id == session.id

    async def test_memory_store_and_search(self):
        """测试 Memory 存储与检索"""
        session_service, memory_service = await create_services()

        from google.adk.events import Event
        from google.genai import types

        # 创建测试 Session
        session = await session_service.create_session(app_name="test_app", user_id="test_user")

        # 构造 typed Event 对象
        event1 = Event(author="user", content=types.Content(parts=[types.Part(text="I don't like spicy food")]))
        event2 = Event(
            author="model",  # strict typed event uses 'model' typically, or 'assistant'? standard is 'model' for Gemini
            content=types.Content(parts=[types.Part(text="Noted!")]),
        )
        session.events = [event1, event2]

        # 存储到 Memory
        await memory_service.add_session_to_memory(session)

        # 检索
        result = await memory_service.search_memory(app_name="test_app", user_id="test_user", query="food preferences")

        assert len(result.memories) > 0

        # content 是 Content 对象，需要提取 text
        memory_content = result.memories[0].content
        if hasattr(memory_content, "parts"):
            text = memory_content.parts[0].text
        else:
            text = str(memory_content)

        assert "spicy" in text.lower()

    async def test_e2e_conversation(self):
        """测试端到端对话流程 - 完整验证"""
        from google.adk.runners import Runner
        from google.genai import types

        session_service, memory_service = await create_services()
        agent = create_travel_agent()
        runner = Runner(
            agent=agent,
            app_name="test_app",
            session_service=session_service,
            memory_service=memory_service,
        )

        # 1. 先创建 Session
        session = await session_service.create_session(app_name="test_app", user_id="test_user")
        assert session.id is not None

        # 2. 创建消息
        message1 = types.Content(parts=[types.Part(text="我想去巴厘岛度假，帮我推荐一些酒店")])

        # 3. 执行对话 - 使用 run_async 保持在同一个事件循环中
        events = []
        async for event in runner.run_async(user_id="test_user", session_id=session.id, new_message=message1):
            events.append(event)

        # 4. 验证收到了事件
        assert len(events) > 0, "应该收到至少一个事件"

        # 5. 查找文本响应
        response_text = None
        for event in events:
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        response_text = part.text
                        break

        # 6. 验证有响应内容
        assert response_text is not None, "应该有文本响应"
        assert len(response_text) > 0, "响应不应为空"
