"""PostgresMemoryService._record_access 解耦行为测试

P1 观测闭环修复：A 段（访问计数更新，仅命中时）与 B 段（检索日志，始终记录）
相互独立 fail-soft——零命中也产生检索日志、A 段失败不吞掉 B 段。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService


@pytest.fixture
def service():
    return PostgresMemoryService(embedding_fn=None)


@pytest.fixture
def mock_db():
    with patch("negentropy.engine.adapters.postgres.memory_service.db_session") as mock_session:
        session = AsyncMock()
        mock_session.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)
        yield session


@pytest.fixture
def mock_log_retrieval():
    with patch(
        "negentropy.engine.adapters.postgres.retrieval_tracker.RetrievalTracker.log_retrieval",
        new_callable=AsyncMock,
    ) as mocked:
        mocked.return_value = uuid4()
        yield mocked


async def test_empty_results_still_logged(service, mock_db, mock_log_retrieval):
    """零命中：跳过 UPDATE，但仍写检索日志（memory_ids=[]）"""
    result = await service._record_access([], query="q", user_id="u1", app_name="app1")

    mock_db.execute.assert_not_awaited()
    mock_log_retrieval.assert_awaited_once()
    assert mock_log_retrieval.call_args.kwargs["memory_ids"] == []
    assert result == mock_log_retrieval.return_value


async def test_hits_update_and_log(service, mock_db, mock_log_retrieval):
    """命中：访问计数 UPDATE 与检索日志都执行"""
    mid = uuid4()
    result = await service._record_access([{"id": str(mid), "content": "x"}], query="q", user_id="u1", app_name="app1")

    mock_db.execute.assert_awaited_once()
    mock_log_retrieval.assert_awaited_once()
    assert mock_log_retrieval.call_args.kwargs["memory_ids"] == [mid]
    assert result == mock_log_retrieval.return_value


async def test_update_failure_does_not_block_logging(service, mock_db, mock_log_retrieval):
    """A 段 UPDATE 抛错：仅 warning，B 段检索日志照常"""
    mock_db.execute.side_effect = RuntimeError("db down")

    result = await service._record_access(
        [{"id": str(uuid4()), "content": "x"}], query="q", user_id="u1", app_name="app1"
    )

    mock_log_retrieval.assert_awaited_once()
    assert result == mock_log_retrieval.return_value


async def test_tracker_failure_swallowed(service, mock_db, mock_log_retrieval):
    """B 段 tracker 抛错：仅 warning，不上抛"""
    mock_log_retrieval.side_effect = RuntimeError("tracker down")

    result = await service._record_access([], query="q", user_id="u1", app_name="app1")

    assert result is None


async def test_missing_tenant_skips_logging(service, mock_db, mock_log_retrieval):
    """租户标识缺失（默认参 ""）：跳过检索日志，防御无主日志行"""
    result = await service._record_access([], query="q", user_id="", app_name="")

    mock_log_retrieval.assert_not_awaited()
    assert result is None
