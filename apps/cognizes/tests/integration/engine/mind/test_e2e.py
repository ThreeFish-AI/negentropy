"""
E2E 集成测试 - 完整对话流程
验证 Session -> Agent -> Tool -> Memory 全链路
"""

import pytest
from cognizes.adapters.postgres.session_service import PostgresSessionService
from cognizes.adapters.postgres.memory_service import PostgresMemoryService
from cognizes.adapters.postgres.tool_registry import ToolRegistry

pytestmark = pytest.mark.asyncio


class TestE2EIntegration:
    """端到端集成测试"""

    @pytest.fixture
    async def db_manager(self):
        """获取数据库管理器"""
        from cognizes.core.database import DatabaseManager

        return DatabaseManager.get_instance()

    @pytest.fixture
    async def db_pool(self, db_manager):
        """创建数据库连接池"""
        pool = await db_manager.get_pool()
        yield pool
        # Pool managed by DatabaseManager

    async def test_complete_conversation_flow(self, db_pool, db_manager):
        """测试完整对话流程"""
        session_svc = PostgresSessionService(pool=db_pool)
        memory_svc = PostgresMemoryService(db=db_manager)
        tool_registry = ToolRegistry(pool=db_pool, app_name="test_app")

        # 1. 创建会话
        session = await session_svc.create_session(app_name="test_app", user_id="e2e_user")

        # 2. 注册工具
        await tool_registry.register_tool(
            name="calculator", func=lambda x, y: x + y, openapi_schema={"type": "function", "name": "calculator"}
        )

        # 3. 模拟多轮对话
        from google.adk.events import Event

        for turn in range(3):
            # 用户输入
            await session_svc.append_event(
                session,
                Event(
                    id=f"user_{turn}",
                    author="user",
                    # Pydantic usually handles dict->model conversion for content if definition allows,
                    # but to be safe/explicit if it expects specific structure:
                    content={"parts": [{"text": f"Turn {turn} message"}]},
                ),
            )
            # Agent 响应
            await session_svc.append_event(
                session,
                Event(
                    id=f"agent_{turn}",
                    author="agent",
                    content={"parts": [{"text": f"Response to turn {turn}"}]},
                    actions={"state_delta": {f"app:turn_{turn}": True}},
                ),
            )

        # 4. 验证事件记录
        final_session = await session_svc.get_session(app_name="test_app", user_id="e2e_user", session_id=session.id)
        assert len(final_session.events) == 6  # 3轮 * 2

        # 5. 存入长期记忆
        await memory_svc.add_session_to_memory(final_session)

        # 6. 验证记忆可搜索
        memories = await memory_svc.search_memory(app_name="test_app", user_id="e2e_user", query="Turn 2 message")
        assert len(memories.memories) > 0

    async def test_cross_session_memory_recall(self, db_pool, db_manager):
        """测试跨会话记忆召回"""
        session_svc = PostgresSessionService(pool=db_pool)
        memory_svc = PostgresMemoryService(db=db_manager)

        # 会话 1: 记录偏好
        from google.adk.events import Event

        session1 = await session_svc.create_session(app_name="test_app", user_id="memory_user")
        await session_svc.append_event(
            session1,
            Event(id="pref_1", author="user", content={"parts": [{"text": "I prefer window seats on flights"}]}),
        )
        await memory_svc.add_session_to_memory(session1)

        # 会话 2: 验证记忆召回
        memories = await memory_svc.search_memory(
            app_name="test_app", user_id="memory_user", query="flight seat preference"
        )
        assert any("window" in m.content.parts[0].text.lower() for m in memories.memories)
