"""Tests for ReflectionGenerator (Phase 5 F2)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.engine.consolidation.reflection_generator import (
    Reflection,
    ReflectionGenerator,
)


def _make_response(content: str) -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = content
    return response


@pytest.fixture
def generator():
    with patch("negentropy.engine.consolidation.reflection_generator.resolve_model_config") as mock_resolve:
        mock_resolve.return_value = ("test-model", {})
        return ReflectionGenerator(max_retries=1)


class TestReflectionGenerator:
    async def test_invalid_outcome_returns_none(self, generator):
        result = await generator.generate(query="how to deploy", retrieved_snippets=["x"], outcome="helpful")
        assert result is None

    async def test_empty_query_returns_none(self, generator):
        result = await generator.generate(query="   ", retrieved_snippets=["x"], outcome="harmful")
        assert result is None

    async def test_llm_success(self, generator):
        payload = json.dumps(
            {
                "lesson": "请避免在『部署』类问题中召回过时的 init.d 步骤",
                "applicable_when": ["deploy", "部署"],
                "anti_examples": ["旧版 init.d 启动指引"],
            }
        )
        with patch("negentropy.engine.consolidation.reflection_generator.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_response(payload))
            result = await generator.generate(
                query="how to deploy",
                retrieved_snippets=["use init.d to start the service"],
                outcome="harmful",
            )

        assert isinstance(result, Reflection)
        assert result.method == "llm"
        assert "部署" in result.lesson
        assert result.applicable_when[:2] == ["deploy", "部署"]
        assert "init.d" in result.anti_examples[0]

    async def test_llm_fallback_to_pattern_when_invalid_json(self, generator):
        with patch("negentropy.engine.consolidation.reflection_generator.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_response("not-json"))
            result = await generator.generate(
                query="how to deploy",
                retrieved_snippets=["use init.d to start the service"],
                outcome="harmful",
            )

        assert isinstance(result, Reflection)
        assert result.method == "pattern"
        assert "deploy" in result.lesson
        assert "init.d" in result.anti_examples[0]

    async def test_llm_fallback_when_exception(self, generator):
        with patch("negentropy.engine.consolidation.reflection_generator.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(side_effect=Exception("provider down"))
            result = await generator.generate(
                query="找去年 sprint 的目标记录",
                retrieved_snippets=[],
                outcome="irrelevant",
            )
        assert isinstance(result, Reflection)
        assert result.method == "pattern"
        assert "irrelevant" in result.lesson

    async def test_query_truncated_to_512_chars(self, generator):
        long_query = "x" * 1024
        with patch("negentropy.engine.consolidation.reflection_generator.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(side_effect=Exception("simulate"))
            result = await generator.generate(query=long_query, retrieved_snippets=[], outcome="harmful")
        assert isinstance(result, Reflection)
        # pattern fallback 中包含 query[:40]，从前缀截断；不应超长
        assert len(result.lesson) <= 240
