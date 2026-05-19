"""
Hippocampus 集成测试配置

共享的 fixtures 用于数据库集成测试
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta

import asyncpg
import pytest

from cognizes.core.database import DatabaseManager


@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def integration_db():
    """
    创建集成测试数据库管理器

    需要真实的 PostgreSQL 数据库
    """
    db = DatabaseManager.get_instance()
    await db.get_pool()
    yield db
    # 不关闭连接池，由 DatabaseManager 管理


@pytest.fixture
async def clean_integration_data(integration_db):
    """测试后清理数据"""
    created_ids = {"threads": [], "memories": [], "facts": [], "jobs": []}

    yield created_ids

    async with integration_db.acquire() as conn:
        if created_ids["jobs"]:
            await conn.execute("DELETE FROM consolidation_jobs WHERE id = ANY($1::uuid[])", created_ids["jobs"])
        if created_ids["facts"]:
            await conn.execute("DELETE FROM facts WHERE id = ANY($1::uuid[])", created_ids["facts"])
        if created_ids["memories"]:
            await conn.execute("DELETE FROM memories WHERE id = ANY($1::uuid[])", created_ids["memories"])
        if created_ids["threads"]:
            await conn.execute("DELETE FROM events WHERE thread_id = ANY($1::uuid[])", created_ids["threads"])
            await conn.execute("DELETE FROM threads WHERE id = ANY($1::uuid[])", created_ids["threads"])


@pytest.fixture
async def integration_thread(integration_db, clean_integration_data):
    """创建集成测试用的 Thread"""
    thread_id = uuid.uuid4()
    user_id = f"integration_test_{uuid.uuid4().hex[:8]}"
    app_name = "integration_test_app"

    async with integration_db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO threads (id, user_id, app_name, state)
            VALUES ($1, $2, $3, '{}')
        """,
            thread_id,
            user_id,
            app_name,
        )

    clean_integration_data["threads"].append(thread_id)

    return {
        "thread_id": str(thread_id),
        "user_id": user_id,
        "app_name": app_name,
    }


@pytest.fixture
async def integration_thread_with_events(integration_db, integration_thread):
    """创建带有事件的集成测试 Thread"""
    thread_id = uuid.UUID(integration_thread["thread_id"])

    async with integration_db.acquire() as conn:
        for i in range(5):
            await conn.execute(
                """
                INSERT INTO events (thread_id, author, event_type, content, sequence_num)
                VALUES ($1, $2, 'message', $3, $4)
            """,
                thread_id,
                "user" if i % 2 == 0 else "agent",
                f'{{"text": "集成测试消息 {i}"}}',
                i,
            )

    return integration_thread
