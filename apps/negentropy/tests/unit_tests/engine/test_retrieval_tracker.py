"""Tests for RetrievalTracker

覆盖检索日志、引用标记、反馈记录和效果指标计算。
指标定义对齐 Manning et al.<sup>[[31]](#ref31)</sup> 和 Shani & Gunawardana<sup>[[32]](#ref32)</sup>。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.fixture
def mock_db():
    with patch("negentropy.engine.adapters.postgres.retrieval_tracker.db_session") as mock_session:
        session = AsyncMock()
        mock_session.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)
        yield session


@pytest.fixture
def tracker():
    from negentropy.engine.adapters.postgres.retrieval_tracker import RetrievalTracker

    return RetrievalTracker()


def _make_log(**overrides):
    log = MagicMock()
    log.id = overrides.get("id", uuid4())
    return log


class TestRetrievalTracker:
    async def test_log_retrieval_stores_entry(self, mock_db, tracker):
        log_id = uuid4()
        mock_db.add = MagicMock()
        mock_db.refresh = AsyncMock(side_effect=lambda obj: setattr(obj, "id", log_id))

        result = await tracker.log_retrieval(
            user_id="u1",
            app_name="app1",
            query="test query",
            memory_ids=[uuid4()],
        )

        assert result == log_id

    async def test_log_retrieval_empty_memory_ids_returns_none(self, tracker):
        result = await tracker.log_retrieval(
            user_id="u1",
            app_name="app1",
            query="test",
            memory_ids=[],
        )
        assert result is None

    async def test_mark_referenced_updates_entry(self, mock_db, tracker):
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_db.execute.return_value = mock_result

        result = await tracker.mark_referenced(log_id=uuid4(), reference_count=3)

        assert result is True

    async def test_mark_referenced_nonexistent_returns_false(self, mock_db, tracker):
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db.execute.return_value = mock_result

        result = await tracker.mark_referenced(log_id=uuid4())

        assert result is False

    async def test_record_feedback_valid_outcomes(self, mock_db, tracker):
        for outcome in ("helpful", "irrelevant", "harmful"):
            mock_result = MagicMock()
            mock_result.rowcount = 1
            mock_db.execute.return_value = mock_result

            result = await tracker.record_feedback(log_id=uuid4(), outcome=outcome)
            assert result is True

    async def test_record_feedback_invalid_outcome_raises(self, tracker):
        with pytest.raises(ValueError, match="Invalid outcome"):
            await tracker.record_feedback(log_id=uuid4(), outcome="bad_value")

    async def test_get_effectiveness_metrics_empty(self, mock_db, tracker):
        row = MagicMock()
        row.total = 0
        mock_db.execute.return_value = MagicMock(one=MagicMock(return_value=row))

        metrics = await tracker.get_effectiveness_metrics(user_id="u1", app_name="app1")

        assert metrics["total_retrievals"] == 0
        assert metrics["precision_at_k"] == 0.0
        assert metrics["utilization_rate"] == 0.0
        assert metrics["noise_rate"] == 0.0

    async def test_get_effectiveness_metrics_with_data(self, mock_db, tracker):
        row = MagicMock()
        row.total = 100
        row.referenced = 60
        row.helpful = 30
        row.irrelevant = 10
        row.with_feedback = 50
        mock_db.execute.return_value = MagicMock(one=MagicMock(return_value=row))

        metrics = await tracker.get_effectiveness_metrics(user_id="u1", app_name="app1")

        assert metrics["total_retrievals"] == 100
        assert metrics["precision_at_k"] == 0.6
        assert metrics["utilization_rate"] == 0.6
        assert metrics["noise_rate"] == 0.2
