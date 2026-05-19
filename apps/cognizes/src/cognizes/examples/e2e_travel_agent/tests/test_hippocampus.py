"""
The Hippocampus 验收测试：验证记忆系统的巩固与召回能力
"""

import pytest
import asyncio
import time
from uuid import uuid4
from services import create_services
from google.adk.events import Event
from google.genai import types

pytestmark = pytest.mark.asyncio


class TestHippocampusValidation:
    """Hippocampus (记忆系统) 验收测试套件"""

    # ========== P5-2-4: 跨会话偏好记忆 ==========

    async def test_cross_session_preference_recall(self):
        """测试跨会话偏好记忆召回 (\"I hate spicy food\")"""
        session_service, memory_service = await create_services()

        user_id = f"preference_test_user_{uuid4()}"
        app_name = "travel_agent"

        # 第一个会话：用户表达偏好
        session1 = await session_service.create_session(app_name=app_name, user_id=user_id)
        session1.events = [
            Event(author="user", content=types.Content(parts=[types.Part(text="我不喜欢辣的食物")])),
            Event(author="assistant", content=types.Content(parts=[types.Part(text="好的，我记住了您不喜欢辣食")])),
        ]

        # 记忆巩固
        await memory_service.add_session_to_memory(session1)

        # 稍等一下让记忆写入
        await asyncio.sleep(0.5)

        # 第二个会话：验证偏好被召回
        result = await memory_service.search_memory(app_name=app_name, user_id=user_id, query="用户的饮食偏好")

        assert len(result.memories) > 0

        # Extract text from memory objects
        contents = []
        for m in result.memories:
            if hasattr(m.content, "parts"):
                contents.append(m.content.parts[0].text)
            else:
                contents.append(str(m.content))

        memory_content = " ".join(contents)
        assert "辣" in memory_content or "spicy" in memory_content.lower()

    # ========== P5-2-5: 记忆巩固流程 ==========

    async def test_memory_consolidation_flow(self):
        """测试 Fast Replay + Deep Reflection 记忆巩固流程"""
        session_service, memory_service = await create_services()

        user_id = f"consolidation_test_user_{uuid4()}"

        # 创建多轮对话 Session
        session = await session_service.create_session(app_name="travel_agent", user_id=user_id)

        # Construct events using properly typed objects
        session.events = [
            Event(author="user", content=types.Content(parts=[types.Part(text="我想去巴厘岛")])),
            Event(author="assistant", content=types.Content(parts=[types.Part(text="巴厘岛是个很棒的选择！")])),
            Event(author="user", content=types.Content(parts=[types.Part(text="我喜欢海滩和安静的地方")])),
            Event(author="assistant", content=types.Content(parts=[types.Part(text="了解，我会推荐海滩度假村")])),
            Event(author="user", content=types.Content(parts=[types.Part(text="预算大概 5000 人民币")])),
            Event(author="assistant", content=types.Content(parts=[types.Part(text="这个预算可以找到不错的选择")])),
        ]

        # 触发记忆巩固
        await memory_service.add_session_to_memory(session)

        # 验证记忆已生成
        result = await memory_service.search_memory(app_name="travel_agent", user_id=user_id, query="巴厘岛 海滩")

        assert len(result.memories) > 0

    # ========== P5-2-6: Read-Your-Writes 延迟 ==========

    async def test_read_your_writes_latency(self):
        """测试新记忆在下一 Turn 立即可见"""
        session_service, memory_service = await create_services()

        user_id = f"ryw_test_user_{uuid4()}"
        app_name = "travel_agent"

        # 写入记忆
        session = await session_service.create_session(app_name=app_name, user_id=user_id)
        unique_fact = f"用户喜欢{time.time()}"  # 唯一标识

        session.events = [Event(author="user", content=types.Content(parts=[types.Part(text=unique_fact)]))]

        # 记忆巩固
        start = time.perf_counter()
        await memory_service.add_session_to_memory(session)

        # 立即检索
        result = await memory_service.search_memory(app_name=app_name, user_id=user_id, query=unique_fact)
        latency_ms = (time.perf_counter() - start) * 1000

        print(f"Read-Your-Writes latency: {latency_ms:.2f}ms")

        # 验证记忆可见
        assert len(result.memories) > 0

        # Verify content match
        top_memory = result.memories[0]
        if hasattr(top_memory.content, "parts"):
            text = top_memory.content.parts[0].text
        else:
            text = str(top_memory.content)

        assert unique_fact in text
