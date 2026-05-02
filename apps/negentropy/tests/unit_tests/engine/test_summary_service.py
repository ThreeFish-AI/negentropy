"""Tests for SummaryService

覆盖 upsert / get / delete 的基本 CRUD 路径。
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def mock_db():
    with patch("negentropy.engine.adapters.postgres.summary_service.db_session") as mock_session:
        session = AsyncMock()
        mock_session.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)
        yield session


@pytest.fixture
def summary_service():
    from negentropy.engine.adapters.postgres.summary_service import SummaryService

    return SummaryService()


def _make_summary_row(**overrides):
    row = MagicMock()
    row.user_id = overrides.get("user_id", "u1")
    row.app_name = overrides.get("app_name", "app1")
    row.summary_type = overrides.get("summary_type", "user_profile")
    row.content = overrides.get("content", "## User Profile\n- **Role**: Developer")
    row.token_count = overrides.get("token_count", 50)
    row.updated_at = overrides.get("updated_at", datetime.now(UTC))
    return row


class TestSummaryService:
    async def test_upsert_summary(self, mock_db, summary_service):
        row = _make_summary_row()
        mock_db.execute.return_value = MagicMock(scalar_one=MagicMock(return_value=row))
        mock_db.execute.return_value.scalar_one.return_value = row

        with patch("negentropy.engine.adapters.postgres.summary_service.insert"):
            result = await summary_service.upsert_summary(
                user_id="u1",
                app_name="app1",
                summary_type="user_profile",
                content="## User Profile",
                token_count=50,
            )

        assert result is not None

    async def test_get_summary_returns_existing(self, mock_db, summary_service):
        row = _make_summary_row()
        mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=row))

        result = await summary_service.get_summary(user_id="u1", app_name="app1")

        assert result is not None

    async def test_get_summary_returns_none_when_not_found(self, mock_db, summary_service):
        mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))

        result = await summary_service.get_summary(user_id="u1", app_name="app1")

        assert result is None

    async def test_delete_summary_removes_entry(self, mock_db, summary_service):
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_db.execute.return_value = mock_result

        result = await summary_service.delete_summary(user_id="u1", app_name="app1")

        assert result is True

    async def test_delete_summary_returns_false_when_not_found(self, mock_db, summary_service):
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db.execute.return_value = mock_result

        result = await summary_service.delete_summary(user_id="u1", app_name="nonexistent")

        assert result is False
