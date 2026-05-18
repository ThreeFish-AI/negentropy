"""
ADK Runner 集成示例
演示 PostgresSessionService 与 Google ADK LlmAgent 的协同工作
"""

import asyncio
from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.genai import types

from cognizes.adapters.postgres.session_service import PostgresSessionService
from cognizes.adapters.postgres.memory_service import PostgresMemoryService


async def run_agent_with_postgres():
    """使用 PostgreSQL 后端运行 ADK Agent"""

    # 1. 初始化 PostgreSQL 服务
    from cognizes.core.database import DatabaseManager

    db = DatabaseManager.get_instance()
    pool = await db.get_pool()

    session_service = PostgresSessionService(pool=pool)
    memory_service = PostgresMemoryService(pool=pool)

    # 2. 定义 Agent
    agent = LlmAgent(
        name="travel_assistant",
        model="gemini-2.0-flash",
        instruction="""
        You are a helpful travel assistant.
        Remember user preferences from past conversations.
        Use the search_flights tool to find flights.
        """,
        tools=[search_flights],  # 注册 Function Tool
    )

    # 3. 创建 Runner (核心集成点)
    runner = Runner(
        agent=agent,
        app_name="travel_app",
        session_service=session_service,  # 关键: 注入 PostgreSQL Session
        memory_service=memory_service,  # 关键: 注入 PostgreSQL Memory
    )

    # 4. 创建会话并执行
    session = await session_service.create_session(
        app_name="travel_app",
        user_id="user_123",
        state={"user:language": "zh-CN"},  # 初始用户偏好
    )

    # 5. 运行 Agent (InvocationContext 自动管理)
    user_message = types.Content(role="user", parts=[types.Part(text="帮我查一下明天北京到上海的航班")])

    async for event in runner.run_async(session_id=session.id, user_id="user_123", new_message=user_message):
        # 处理流式事件
        if event.is_final_response():
            print(f"Agent 回复: {event.text}")
        elif event.get_function_calls():
            print(f"工具调用: {event.get_function_calls()}")

    # 6. 验证状态持久化
    updated_session = await session_service.get_session(
        app_name="travel_app", user_id="user_123", session_id=session.id
    )
    print(f"会话事件数: {len(updated_session.events)}")
    print(f"会话状态: {updated_session.state}")

    # 7. 可选: 将会话存入长期记忆
    await memory_service.add_session_to_memory(updated_session)

    # Pool managed by DatabaseManager


# Function Tool 示例
def search_flights(origin: str, destination: str, date: str) -> dict:
    """搜索航班的工具函数"""
    return {
        "flights": [
            {"number": "CA1234", "departure": "08:00", "price": 680},
            {"number": "MU5678", "departure": "10:30", "price": 720},
        ]
    }


if __name__ == "__main__":
    asyncio.run(run_agent_with_postgres())
