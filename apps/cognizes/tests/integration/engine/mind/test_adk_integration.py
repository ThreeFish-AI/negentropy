"""
验收目标: 验证 adk-postgres 与 Google ADK LlmAgent 的完整集成

PostgresSessionService 已继承 ADK BaseSessionService，可直接与 ADK Runner 集成。
"""

import asyncio
import os
from functools import cached_property

import pytest
from google.adk.agents import LlmAgent
from google.adk.models.google_llm import Gemini
from google.adk.runners import Runner
from google.genai import Client, types

from cognizes.adapters.postgres.memory_service import PostgresMemoryService
from cognizes.adapters.postgres.session_service import PostgresSessionService
from cognizes.core.database import DatabaseManager

pytestmark = pytest.mark.asyncio


class CustomGemini(Gemini):
    """
    自定义 Gemini 模型类，支持自定义 API 端点

    通过 http_options 配置 base_url 来使用代理服务
    """

    @cached_property
    def api_client(self) -> Client:
        """覆盖 api_client，支持自定义 base_url"""
        api_key = os.environ.get("GOOGLE_API_KEY", "")
        base_url = os.environ.get("GOOGLE_BASE_URL")

        if base_url:
            print(f"📡 CustomGemini: 使用自定义端点 {base_url}")
            return Client(api_key=api_key, http_options={"base_url": base_url})
        else:
            return Client(api_key=api_key)


def create_custom_model(model_name: str = "gemini-2.5-flash") -> Gemini:
    """
    创建模型实例，根据环境变量决定使用自定义端点还是官方端点
    """
    base_url = os.environ.get("GOOGLE_BASE_URL")

    if base_url:
        return CustomGemini(model=model_name)
    else:
        return Gemini(model=model_name)


def get_event_text(event) -> str:
    """
    从 ADK Event 中提取文本内容

    Event.content 是 Content 对象，包含 parts 列表
    """
    if event.content and hasattr(event.content, "parts"):
        for part in event.content.parts:
            if hasattr(part, "text") and part.text:
                return part.text
    return ""


class TestAdkIntegration:
    """ADK 集成验收测试套件"""

    @pytest.fixture
    async def db_manager(self):
        """获取数据库管理器"""
        return DatabaseManager.get_instance()

    @pytest.fixture
    async def db_pool(self, db_manager):
        """创建数据库连接池"""
        pool = await db_manager.get_pool()
        yield pool
        # Pool managed by DatabaseManager

    # ========== PostgresSessionService 独立测试 ==========

    @pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="缺少 DATABASE_URL 环境变量")
    async def test_postgres_session_service_basic(self, db_pool):
        """测试 PostgresSessionService 基础 CRUD 操作"""
        session_svc = PostgresSessionService(pool=db_pool)

        # 创建会话
        session = await session_svc.create_session(app_name="integration_test", user_id="verifier")
        assert session.id is not None
        assert session.app_name == "integration_test"
        print(f"✅ Session 创建成功: {session.id}")

        # 获取会话
        loaded = await session_svc.get_session(app_name="integration_test", user_id="verifier", session_id=session.id)
        assert loaded is not None
        assert loaded.id == session.id
        print(f"✅ Session 获取成功: {loaded.id}")

        # 列出会话
        list_response = await session_svc.list_sessions(app_name="integration_test", user_id="verifier")
        assert len(list_response.sessions) > 0
        print(f"✅ 列出 {len(list_response.sessions)} 个会话")

        # 删除会话
        await session_svc.delete_session(app_name="integration_test", user_id="verifier", session_id=session.id)
        print("✅ Session 删除成功")

    # ========== ADK Runner 与 PostgresSessionService 集成测试 ==========

    @pytest.mark.skipif(
        not os.environ.get("GOOGLE_API_KEY") or not os.environ.get("DATABASE_URL"),
        reason="缺少 GOOGLE_API_KEY 或 DATABASE_URL 环境变量",
    )
    async def test_adk_runner_with_postgres_session_service(self, db_pool, db_manager):
        """
        测试 ADK Runner 与 PostgresSessionService 集成

        验证 PostgresSessionService 可作为 ADK Runner 的后端存储
        """
        # 使用 PostgreSQL Session 服务 + PostgreSQL Memory 服务
        # SessionService 仍使用 pool (尚未重构)
        session_svc = PostgresSessionService(pool=db_pool)
        # MemoryService 已重构使用 db_manager
        memory_svc = PostgresMemoryService(db=db_manager)

        # 1. 创建 Agent (使用自定义模型支持代理端点)
        custom_model = create_custom_model("gemini-2.5-flash")

        agent = LlmAgent(
            name="test_agent",
            model=custom_model,
            instruction="You are a helpful assistant. Reply briefly in one sentence.",
        )

        # 2. 创建 Runner
        runner = Runner(
            agent=agent,
            app_name="adk_postgres_test",
            session_service=session_svc,
            memory_service=memory_svc,
        )

        # 3. 创建 Session (通过 PostgresSessionService)
        session = await session_svc.create_session(app_name="adk_postgres_test", user_id="verifier")
        print(f"📝 创建 Session: {session.id}")

        # 4. 构建 Content 对象
        user_message = types.Content(role="user", parts=[types.Part(text="What is 2+2?")])

        # 5. 执行对话
        response_text = None
        async for event in runner.run_async(session_id=session.id, user_id="verifier", new_message=user_message):
            if event.is_final_response():
                response_text = get_event_text(event)
                break

        assert response_text, "Agent 应返回响应"
        print(f"✅ ADK + PostgresSessionService 集成验收通过: {response_text[:80]}...")

        # 6. 验证 Session 持久化
        loaded = await session_svc.get_session(app_name="adk_postgres_test", user_id="verifier", session_id=session.id)
        assert loaded is not None
        print(f"✅ Session 持久化验证: 包含 {len(loaded.events)} 个事件")

        # 7. 清理
        await session_svc.delete_session(app_name="adk_postgres_test", user_id="verifier", session_id=session.id)


# 保留原始脚本入口
async def verify_adk_integration():
    """ADK 集成验收 (独立执行，使用 PostgresSessionService)"""
    db = DatabaseManager.get_instance()
    pool = await db.get_pool()

    try:
        session_svc = PostgresSessionService(pool=pool)
        memory_svc = PostgresMemoryService(pool=pool)

        # 使用自定义模型
        custom_model = create_custom_model("gemini-2.5-flash")

        agent = LlmAgent(
            name="test_agent",
            model=custom_model,
            instruction="You are a helpful assistant.",
        )

        runner = Runner(
            agent=agent,
            app_name="adk_postgres_test",
            session_service=session_svc,
            memory_service=memory_svc,
        )

        session = await session_svc.create_session(app_name="adk_postgres_test", user_id="verifier")

        user_message = types.Content(role="user", parts=[types.Part(text="Hello, how are you?")])

        async for event in runner.run_async(session_id=session.id, user_id="verifier", new_message=user_message):
            if event.is_final_response():
                text = get_event_text(event)
                print(f"✅ ADK 集成验收通过: {text[:50]}...")
                break
    finally:
        # Pool managed by DatabaseManager
        pass


if __name__ == "__main__":
    asyncio.run(verify_adk_integration())
