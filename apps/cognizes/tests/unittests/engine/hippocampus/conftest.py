"""
Hippocampus 单元测试配置

提供测试 fixtures 和共享配置
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
async def test_db_pool():
    """
    创建测试数据库连接池

    环境变量:
    - TEST_DATABASE_URL: 测试数据库连接字符串
    """
    db = DatabaseManager.get_instance()
    pool = await db.get_pool()
    yield pool
    # Pool managed by DatabaseManager


@pytest.fixture
async def clean_test_data(test_db_pool):
    """
    测试后清理数据

    在每个测试结束后删除测试期间创建的数据
    """
    created_ids = {"threads": [], "memories": [], "facts": [], "jobs": []}

    yield created_ids

    # 清理
    async with test_db_pool.acquire() as conn:
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
async def test_thread(test_db_pool, clean_test_data):
    """创建测试用的 Thread"""
    thread_id = uuid.uuid4()
    user_id = "test_user"
    app_name = "test_app"

    async with test_db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO threads (id, user_id, app_name, state)
            VALUES ($1, $2, $3, '{}')
        """,
            thread_id,
            user_id,
            app_name,
        )

    clean_test_data["threads"].append(thread_id)

    return {
        "thread_id": str(thread_id),
        "user_id": user_id,
        "app_name": app_name,
    }


@pytest.fixture
async def test_thread_with_events(test_db_pool, test_thread):
    """创建带有事件的测试 Thread"""
    thread_id = uuid.UUID(test_thread["thread_id"])

    async with test_db_pool.acquire() as conn:
        for i in range(5):
            await conn.execute(
                """
                INSERT INTO events (thread_id, author, event_type, content, sequence_num)
                VALUES ($1, $2, 'message', $3, $4)
            """,
                thread_id,
                "user" if i % 2 == 0 else "agent",
                f'{{"text": "测试消息 {i}"}}',
                i,
            )

    return test_thread
