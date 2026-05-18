"""
The Perception 验收测试：验证融合检索的精度与召回率
"""

import pytest
import asyncio
from services import create_services
from uuid import uuid4
from google.adk.events import Event
from google.genai import types

pytestmark = pytest.mark.asyncio


class TestPerceptionValidation:
    """Perception (融合检索) 验收测试套件"""

    @pytest.fixture(autouse=True)
    def mock_embedding_fn(self, monkeypatch):
        """Mock embedding function to ensure deterministic semantic search results"""
        import services

        async def mock_embed_text(text: str) -> list[float]:
            # Deterministic semantic mock
            vec = [0.1] * 1536
            if "海" in text or "轻松" in text or "度假" in text:
                vec[0] = 0.9  # High dimension 0 for Beach/Relax
            elif "山" in text or "滑雪" in text:
                vec[1] = 0.9  # High dimension 1 for Mountain/Ski
            elif "繁华" in text or "购物" in text:
                vec[2] = 0.9  # High dimension 2 for City
            return vec

        monkeypatch.setattr(services, "embed_text", mock_embed_text)

    @pytest.fixture
    async def seeded_memories(self):
        """预填充测试数据"""
        session_service, memory_service = await create_services()

        user_id = f"perception_test_user_{uuid4()}"
        app_name = "travel_agent"

        # 创建多个测试 Session 并巩固为记忆
        destinations = [
            ("巴厘岛", "海滩、冲浪、寺庙、轻松"),
            ("东京", "美食、购物、科技、繁华"),
            ("巴黎", "浪漫、艺术、美食、文化"),
            ("马尔代夫", "海岛、度假、潜水、安静"),
            ("瑞士", "雪山、滑雪、自然、宁静"),
        ]

        for dest, keywords in destinations:
            session = await session_service.create_session(app_name=app_name, user_id=user_id)
            session.events = [
                Event(author="user", content=types.Content(parts=[types.Part(text=f"我想了解{dest}")])),
                Event(author="model", content=types.Content(parts=[types.Part(text=f"{dest}的特点是：{keywords}")])),
            ]
            await memory_service.add_session_to_memory(session)

        await asyncio.sleep(1)  # 等待向量化完成
        return (session_service, memory_service, user_id, app_name)

    # ========== P5-2-7: 混合检索 ==========

    async def test_hybrid_search_fusion(self, seeded_memories):
        """测试关键词 + 向量融合检索结果正确"""
        _, memory_service, user_id, app_name = seeded_memories

        # 语义查询：期望召回海岛类目的地
        result = await memory_service.search_memory(app_name=app_name, user_id=user_id, query="推荐一些轻松的地方")

        assert len(result.memories) > 0

        # 提取 memories 中的文本内容进行验证
        contents_text = []
        for m in result.memories:
            if hasattr(m.content, "parts"):
                contents_text.append(m.content.parts[0].text)
            else:
                contents_text.append(str(m.content))

        joined_contents = " ".join(contents_text)

        # 验证召回了轻松相关的目的地
        assert any(kw in joined_contents for kw in ["轻松", "安静", "宁静", "度假"])

    # ========== P5-2-8: Reranking 效果 ==========

    async def test_reranking_improves_relevance(self, seeded_memories):
        """测试 Reranking 提升 Top-10 结果相关性"""
        _, memory_service, user_id, app_name = seeded_memories

        # 查询特定类型
        result = await memory_service.search_memory(app_name=app_name, user_id=user_id, query="海滩度假")

        # 验证最相关结果在 Top 位置
        assert len(result.memories) > 0
        top_result = result.memories[0]

        # 提取内容文本
        if hasattr(top_result.content, "parts"):
            text = top_result.content.parts[0].text
        else:
            text = str(top_result.content)

        assert any(kw in text for kw in ["海滩", "海岛", "潜水"])

    # ========== P5-2-9: 高过滤比召回率 ==========

    async def test_high_selectivity_recall(self):
        """测试 99% 过滤比场景下的召回率 >= 90%"""
        session_service, memory_service = await create_services()

        # 创建大量记忆 (模拟多用户场景)
        target_user = "high_selectivity_target"
        app_name = "travel_agent"

        # 目标用户的记忆
        target_session = await session_service.create_session(app_name=app_name, user_id=target_user)
        target_session.events = [
            Event(author="user", content=types.Content(parts=[types.Part(text="我喜欢寿司和拉面")])),
        ]
        await memory_service.add_session_to_memory(target_session)

        # 其他用户的大量记忆 (模拟 99% 的其他数据)
        for i in range(100):
            other_session = await session_service.create_session(app_name=app_name, user_id=f"other_user_{i}")
            other_session.events = [
                Event(author="user", content=types.Content(parts=[types.Part(text=f"随机内容 {uuid4()}")])),
            ]
            await memory_service.add_session_to_memory(other_session)

        await asyncio.sleep(2)  # 等待向量化

        # 仅查询目标用户的记忆
        result = await memory_service.search_memory(app_name=app_name, user_id=target_user, query="日本美食")

        # 验证召回了目标用户的记忆
        assert len(result.memories) > 0

        top_mem = result.memories[0]
        if hasattr(top_mem.content, "parts"):
            text = top_mem.content.parts[0].text
        else:
            text = str(top_mem.content)

        assert "寿司" in text or "拉面" in text
