"""Phase 5 F2 — RetrievalTracker.record_feedback 反思触发分支测试。"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from negentropy.engine.adapters.postgres.retrieval_tracker import (
    RetrievalTracker,
    get_pending_reflection_tasks,
)


@pytest.fixture
def patched_db():
    with patch("negentropy.engine.adapters.postgres.retrieval_tracker.db_session") as mock_session:
        session = AsyncMock()
        session.execute = AsyncMock(return_value=MagicMock(rowcount=1))
        mock_session.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)
        yield session


def _make_settings(*, enabled: bool):
    settings = MagicMock()
    settings.memory.reflection.enabled = enabled
    return settings


class TestRecordFeedbackReflection:
    async def test_helpful_feedback_does_not_trigger(self, patched_db):
        tracker = RetrievalTracker()
        with patch("negentropy.engine.consolidation.reflection_worker.ReflectionWorker") as mock_worker_cls:
            mock_worker = MagicMock()
            mock_worker.process = AsyncMock()
            mock_worker_cls.return_value = mock_worker

            with patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_make_settings(enabled=True))}):
                ok = await tracker.record_feedback(uuid4(), "helpful")
                # 让 fire-and-forget 任务有机会调度
                await asyncio.sleep(0.01)
                # 等所有挂起任务（理论上没有）
                pending = list(get_pending_reflection_tasks())
                if pending:
                    await asyncio.gather(*pending, return_exceptions=True)

        assert ok is True
        mock_worker.process.assert_not_called()

    async def test_harmful_feedback_triggers_reflection_when_enabled(self, patched_db):
        tracker = RetrievalTracker()
        log_id = uuid4()

        with patch("negentropy.engine.consolidation.reflection_worker.ReflectionWorker") as mock_worker_cls:
            mock_worker = MagicMock()
            mock_worker.process = AsyncMock()
            mock_worker_cls.return_value = mock_worker

            with patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_make_settings(enabled=True))}):
                ok = await tracker.record_feedback(log_id, "harmful")
                # 等待 fire-and-forget 任务完成
                pending = list(get_pending_reflection_tasks())
                if pending:
                    await asyncio.gather(*pending, return_exceptions=True)

        assert ok is True
        mock_worker.process.assert_awaited_once_with(log_id=log_id, outcome="harmful")

    async def test_irrelevant_feedback_skipped_when_disabled(self, patched_db):
        tracker = RetrievalTracker()
        log_id = uuid4()

        with patch("negentropy.engine.consolidation.reflection_worker.ReflectionWorker") as mock_worker_cls:
            mock_worker = MagicMock()
            mock_worker.process = AsyncMock()
            mock_worker_cls.return_value = mock_worker

            with patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_make_settings(enabled=False))}):
                ok = await tracker.record_feedback(log_id, "irrelevant")
                await asyncio.sleep(0.01)
                pending = list(get_pending_reflection_tasks())
                if pending:
                    await asyncio.gather(*pending, return_exceptions=True)

        assert ok is True
        mock_worker.process.assert_not_called()

    async def test_invalid_outcome_raises(self, patched_db):
        tracker = RetrievalTracker()
        with pytest.raises(ValueError):
            await tracker.record_feedback(uuid4(), "weird")

    async def test_reflection_task_failure_does_not_propagate(self, patched_db):
        tracker = RetrievalTracker()
        log_id = uuid4()
        with patch("negentropy.engine.consolidation.reflection_worker.ReflectionWorker") as mock_worker_cls:
            mock_worker = MagicMock()
            mock_worker.process = AsyncMock(side_effect=RuntimeError("boom"))
            mock_worker_cls.return_value = mock_worker

            with patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_make_settings(enabled=True))}):
                ok = await tracker.record_feedback(log_id, "harmful")
                pending = list(get_pending_reflection_tasks())
                if pending:
                    results = await asyncio.gather(*pending, return_exceptions=True)
                    # 主任务捕获异常后不向上抛
                    assert all(not isinstance(r, BaseException) for r in results)
        assert ok is True
