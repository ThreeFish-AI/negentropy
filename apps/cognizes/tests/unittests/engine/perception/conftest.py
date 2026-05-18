"""
Perception 单元测试共享 Fixtures

提供 Mock 对象和测试数据。
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture
def event_loop():
    """提供事件循环"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_db_pool():
    """模拟数据库连接池"""
    pool = AsyncMock()
    pool.fetch = AsyncMock(return_value=[])
    pool.execute = AsyncMock()
    pool.fetchval = AsyncMock(return_value=0)
    return pool


@pytest.fixture
def mock_event_emitter():
    """模拟 AG-UI 事件发射器"""
    emitter = AsyncMock()
    emitter.emit_step_started = AsyncMock()
    emitter.emit_step_finished = AsyncMock()
    emitter.emit_custom = AsyncMock()
    return emitter


@pytest.fixture
def sample_search_results():
    """示例搜索结果"""
    return [
        {"id": "doc1", "content": "Python programming basics", "score": 0.95},
        {"id": "doc2", "content": "Machine learning guide", "score": 0.90},
        {"id": "doc3", "content": "Data science fundamentals", "score": 0.85},
    ]


@pytest.fixture
def sample_query_embedding():
    """示例查询向量 (简化为 10 维)"""
    return [0.1] * 10
