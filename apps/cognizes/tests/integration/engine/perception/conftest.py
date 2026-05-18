"""
Perception 集成测试共享 Fixtures

提供真实数据库连接和测试数据设置。
"""

import os
import uuid

import asyncpg
import numpy as np
import pytest
import pytest_asyncio

from cognizes.core.database import DatabaseManager


@pytest_asyncio.fixture
async def integration_db():
    """
    函数级数据库管理器

    用于 Perception 集成测试。
    """
    db = DatabaseManager.get_instance()
    # 确保连接池已创建
    await db.get_pool()
    yield db
    # Pool managed by DatabaseManager


@pytest.fixture
def test_user_id():
    """测试用户 ID"""
    return "perception_test_user"


@pytest.fixture
def test_app_name():
    """测试应用名称"""
    return "perception_test_app"


@pytest_asyncio.fixture
async def setup_test_data(integration_db, test_user_id, test_app_name):
    """
    设置测试数据

    创建用于测试的记忆数据
    """
    # 插入测试数据
    async with integration_db.acquire() as conn:
        for i in range(10):
            embedding = np.random.randn(1536).astype(float).tolist()
            await conn.execute(
                """
                INSERT INTO memories (id, user_id, app_name, content, embedding, memory_type)
                VALUES ($1, $2, $3, $4, $5, 'episodic')
                ON CONFLICT (id) DO NOTHING
            """,
                uuid.uuid4(),
                test_user_id,
                test_app_name,
                f"Test memory {i} about machine learning and AI",
                embedding,
            )

    yield

    # 清理测试数据
    async with integration_db.acquire() as conn:
        await conn.execute("DELETE FROM memories WHERE user_id = $1", test_user_id)
