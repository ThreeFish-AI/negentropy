"""
E2E 集成测试 - 完整对话流程
验证 Session -> Agent -> Tool -> Memory 全链路
"""

import pytest

from cognizes.adapters.postgres.memory_service import PostgresMemoryService
from cognizes.adapters.postgres.session_service import PostgresSessionService
from cognizes.adapters.postgres.tool_registry import ToolRegistry

pytestmark = pytest.mark.asyncio


class TestE2EIntegration:
    """端到端集成测试"""

    async def test_complete_conversation_flow(self, db_pool):
        """测试完整对话流程"""
        session_svc = PostgresSessionService(pool=db_pool)
        memory_svc = PostgresMemoryService(pool=db_pool)
        tool_registry = ToolRegistry(pool=db_pool, app_name="test_app")

        # 1. 创建会话
        session = await session_svc.create_session(app_name="test_app", user_id="e2e_user")

        # 2. 注册工具
        await tool_registry.register_tool(
            name="calculator", func=lambda x, y: x + y, openapi_schema={"type": "function", "name": "calculator"}
        )

        # 3. 模拟多轮对话
        for turn in range(3):
            # 用户输入
            await session_svc.append_event(
                session, {"id": f"user_{turn}", "author": "user", "content": {"text": f"Turn {turn} message"}}
            )
            # Agent 响应
            await session_svc.append_event(
                session,
                {
                    "id": f"agent_{turn}",
                    "author": "agent",
                    "content": {"text": f"Response to turn {turn}"},
                    "actions": {"state_delta": {f"app:turn_{turn}": True}},
                },
            )

        # 4. 验证事件记录
        final_session = await session_svc.get_session(app_name="test_app", user_id="e2e_user", session_id=session.id)
        assert len(final_session.events) == 6  # 3轮 * 2

        # 5. 存入长期记忆
        await memory_svc.add_session_to_memory(final_session)

        # 6. 验证记忆可搜索
        memories = await memory_svc.search_memory(app_name="test_app", user_id="e2e_user", query="Turn 2 message")
        assert len(memories.memories) > 0

    async def test_cross_session_memory_recall(self, db_pool):
        """测试跨会话记忆召回"""
        session_svc = PostgresSessionService(pool=db_pool)
        memory_svc = PostgresMemoryService(pool=db_pool)

        # 会话 1: 记录偏好
        session1 = await session_svc.create_session(app_name="test_app", user_id="memory_user")
        await session_svc.append_event(
            session1, {"id": "pref_1", "author": "user", "content": {"text": "I prefer window seats on flights"}}
        )
        await memory_svc.add_session_to_memory(session1)

        # 会话 2: 验证记忆召回
        memories = await memory_svc.search_memory(
            app_name="test_app", user_id="memory_user", query="flight seat preference"
        )
        assert any("window" in m.content.lower() for m in memories.memories)
