"""Tests for MemorySummarizer

覆盖摘要生成、TTL 缓存、LLM 失败降级。
Mock 模式对齐 test_llm_fact_extractor.py 的约定。
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.engine.consolidation.memory_summarizer import MemorySummarizer


def _make_llm_response(summary_text: str) -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = json.dumps({"summary": summary_text})
    return response


def _make_summary_obj(content: str, updated_at: datetime | None = None) -> MagicMock:
    obj = MagicMock()
    obj.content = content
    obj.updated_at = updated_at or datetime.now(UTC)
    obj.token_count = 100
    obj.source_memory_count = 5
    obj.source_fact_count = 3
    obj.model_used = "test-model"
    return obj


@pytest.fixture
def summarizer():
    with patch("negentropy.engine.consolidation.memory_summarizer.resolve_model_config") as mock:
        mock.return_value = ("test-model", {})
        with patch("negentropy.engine.consolidation.memory_summarizer.SummaryService"):
            return MemorySummarizer(ttl_hours=24)


class TestMemorySummarizer:
    async def test_generate_summary_with_data(self, summarizer):
        summary_text = "## User Profile\n- **Role**: Developer"
        with (
            patch.object(summarizer, "_load_memories", return_value=[MagicMock(content="I use Python")]),
            patch.object(summarizer, "_load_facts", return_value=[("preference", "lang", "Python")]),
            patch("negentropy.engine.consolidation.memory_summarizer.litellm") as mock_litellm,
            patch("negentropy.engine.consolidation.memory_summarizer.TokenCounter") as mock_tc,
        ):
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(summary_text))
            mock_tc.count_tokens_async = AsyncMock(return_value=50)

            upserted = _make_summary_obj(summary_text)
            summarizer._summary_service.upsert_summary = AsyncMock(return_value=upserted)

            result = await summarizer.generate_summary(user_id="u1", app_name="app1")

        assert result is not None

    async def test_generate_summary_no_data_returns_none(self, summarizer):
        with (
            patch.object(summarizer, "_load_memories", return_value=[]),
            patch.object(summarizer, "_load_facts", return_value=[]),
        ):
            result = await summarizer.generate_summary(user_id="u1", app_name="app1")

        assert result is None

    async def test_get_or_generate_returns_cached_within_ttl(self, summarizer):
        cached = _make_summary_obj("cached summary", updated_at=datetime.now(UTC))
        summarizer._summary_service.get_summary = AsyncMock(return_value=cached)

        result = await summarizer.get_or_generate_summary(user_id="u1", app_name="app1")

        assert result == cached

    async def test_get_or_generate_regenerates_after_ttl(self, summarizer):
        expired = _make_summary_obj(
            "old summary",
            updated_at=datetime.now(UTC) - timedelta(hours=48),
        )
        summarizer._summary_service.get_summary = AsyncMock(return_value=expired)

        fresh = _make_summary_obj("fresh summary")
        with (
            patch.object(summarizer, "generate_summary", return_value=fresh),
        ):
            result = await summarizer.get_or_generate_summary(user_id="u1", app_name="app1")

        assert result.content == "fresh summary"

    async def test_llm_failure_returns_cached_summary(self, summarizer):
        expired = _make_summary_obj(
            "old summary",
            updated_at=datetime.now(UTC) - timedelta(hours=48),
        )
        summarizer._summary_service.get_summary = AsyncMock(return_value=expired)

        with patch.object(summarizer, "generate_summary", side_effect=Exception("LLM error")):
            result = await summarizer.get_or_generate_summary(user_id="u1", app_name="app1")

        assert result == expired

    async def test_llm_malformed_json_returns_none(self, summarizer):
        with (
            patch.object(summarizer, "_load_memories", return_value=[MagicMock(content="test")]),
            patch.object(summarizer, "_load_facts", return_value=[]),
            patch("negentropy.engine.consolidation.memory_summarizer.litellm") as mock_litellm,
        ):
            bad_response = MagicMock()
            bad_response.choices = [MagicMock()]
            bad_response.choices[0].message.content = "not valid json {{{"
            mock_litellm.acompletion = AsyncMock(return_value=bad_response)

            result = await summarizer.generate_summary(user_id="u1", app_name="app1")

        assert result is None

    async def test_llm_retry_then_success(self, summarizer):
        good_response = _make_llm_response("## Profile")
        with (
            patch.object(summarizer, "_load_memories", return_value=[MagicMock(content="test")]),
            patch.object(summarizer, "_load_facts", return_value=[]),
            patch("negentropy.engine.consolidation.memory_summarizer.litellm") as mock_litellm,
            patch("negentropy.engine.consolidation.memory_summarizer.TokenCounter") as mock_tc,
            patch("negentropy.engine.consolidation.memory_summarizer.asyncio") as mock_asyncio,
        ):
            mock_litellm.acompletion = AsyncMock(
                side_effect=[Exception("timeout"), good_response],
            )
            mock_tc.count_tokens_async = AsyncMock(return_value=30)
            mock_asyncio.sleep = AsyncMock()
            upserted = _make_summary_obj("## Profile")
            summarizer._summary_service.upsert_summary = AsyncMock(return_value=upserted)

            result = await summarizer.generate_summary(user_id="u1", app_name="app1")

        assert result is not None
