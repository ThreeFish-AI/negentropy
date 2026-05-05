"""Tests for LLMFactExtractor"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.engine.consolidation.llm_fact_extractor import LLMFactExtractor


def _make_llm_response(content: str) -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = content
    return response


@pytest.fixture
def extractor():
    with patch("negentropy.engine.consolidation.llm_fact_extractor.resolve_model_config") as mock_resolve:
        mock_resolve.return_value = ("test-model", {})
        return LLMFactExtractor()


class TestLLMFactExtractor:
    async def test_extract_valid_json(self, extractor):
        content = json.dumps(
            {
                "facts": [
                    {"type": "preference", "key": "programming language", "value": "prefers Python", "confidence": 0.9},
                    {"type": "profile", "key": "role", "value": "senior developer", "confidence": 0.85},
                ]
            }
        )
        with patch("negentropy.engine.consolidation.llm_fact_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            turns = [
                {"author": "user", "text": "I prefer using Python for my projects."},
                {"author": "model", "text": "Sure!"},
                {"author": "user", "text": "I'm a senior developer at a tech company."},
            ]
            facts = await extractor.extract(turns)

        assert len(facts) == 2
        assert facts[0].fact_type == "preference"
        assert facts[0].key == "programming language"
        assert facts[0].confidence == 0.9
        assert facts[1].fact_type == "profile"
        assert facts[1].key == "role"

    async def test_extract_malformed_json_fallback(self, extractor):
        with patch("negentropy.engine.consolidation.llm_fact_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response("not json at all"))
            turns = [{"author": "user", "text": "我喜欢用 Python 写代码"}]
            facts = await extractor.extract(turns)

        # Should fallback to PatternFactExtractor
        assert isinstance(facts, list)

    async def test_extract_llm_exception_fallback(self, extractor):
        with patch("negentropy.engine.consolidation.llm_fact_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(side_effect=Exception("API error"))
            turns = [{"author": "user", "text": "我喜欢用 Python 写代码"}]
            facts = await extractor.extract(turns)

        # Should fallback to PatternFactExtractor
        assert isinstance(facts, list)

    async def test_extract_empty_turns(self, extractor):
        facts = await extractor.extract([])
        assert facts == []

        facts = await extractor.extract([{"author": "model", "text": "Hello"}])
        assert facts == []

    async def test_extract_empty_text_turns(self, extractor):
        facts = await extractor.extract([{"author": "user", "text": ""}])
        assert facts == []

    async def test_extract_invalid_fact_type_normalized_to_custom(self, extractor):
        content = json.dumps(
            {
                "facts": [
                    {"type": "invalid_type", "key": "something", "value": "val", "confidence": 0.8},
                ]
            }
        )
        with patch("negentropy.engine.consolidation.llm_fact_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            turns = [{"author": "user", "text": "Something about something"}]
            facts = await extractor.extract(turns)

        assert len(facts) == 1
        assert facts[0].fact_type == "custom"

    async def test_extract_confidence_clamped(self, extractor):
        content = json.dumps(
            {
                "facts": [
                    {"type": "preference", "key": "test", "value": "val", "confidence": 2.0},
                ]
            }
        )
        with patch("negentropy.engine.consolidation.llm_fact_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            turns = [{"author": "user", "text": "I like test"}]
            facts = await extractor.extract(turns)

        assert len(facts) == 1
        assert facts[0].confidence == 1.0

    async def test_extract_deduplication(self, extractor):
        content = json.dumps(
            {
                "facts": [
                    {"type": "preference", "key": "lang", "value": "Python", "confidence": 0.9},
                    {"type": "preference", "key": "lang", "value": "Python", "confidence": 0.8},
                ]
            }
        )
        with patch("negentropy.engine.consolidation.llm_fact_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            turns = [{"author": "user", "text": "I like Python. I like Python."}]
            facts = await extractor.extract(turns)

        assert len(facts) == 1

    async def test_batch_turns_splits_large_input(self, extractor):
        turns = [{"author": "user", "text": f"Message {i} " * 100} for i in range(25)]
        batches = extractor._batch_turns(turns)
        assert len(batches) > 1
        for batch in batches:
            assert len(batch) <= 10

    async def test_extract_no_facts_key(self, extractor):
        content = json.dumps({"result": "no facts here"})
        with patch("negentropy.engine.consolidation.llm_fact_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            turns = [{"author": "user", "text": "Hello there"}]
            facts = await extractor.extract(turns)

        assert facts == []

    async def test_extract_short_key_filtered(self, extractor):
        content = json.dumps(
            {
                "facts": [
                    {"type": "preference", "key": "a", "value": "too short key", "confidence": 0.9},
                    {"type": "preference", "key": "valid key", "value": "ok", "confidence": 0.9},
                ]
            }
        )
        with patch("negentropy.engine.consolidation.llm_fact_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            turns = [{"author": "user", "text": "Some text"}]
            facts = await extractor.extract(turns)

        assert len(facts) == 1
        assert facts[0].key == "valid key"
