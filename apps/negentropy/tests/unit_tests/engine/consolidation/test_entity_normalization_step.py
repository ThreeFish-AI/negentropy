"""Tests for EntityNormalizationStep — LLM-based entity normalization."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.engine.consolidation.pipeline.steps.entity_normalization_step import (
    EntityNormalizationStep,
)

from .conftest import _new_ctx


class TestEntityNormalizationStep:
    @pytest.fixture()
    def _patch_model_config(self):
        with patch(
            "negentropy.engine.consolidation.pipeline.steps.entity_normalization_step.resolve_model_config_async",
            new=AsyncMock(return_value=("test-model", {"temperature": 0.5})),
        ):
            yield

    async def test_skipped_on_empty_facts(self, _patch_model_config):
        step = EntityNormalizationStep()
        ctx = _new_ctx()
        ctx.facts = []
        result = await step.run(ctx)
        assert result.status == "skipped"
        assert result.output_count == 0
        assert result.step_name == "entity_normalization"

    async def test_llm_returns_entities(self, _patch_model_config):
        fake_fact_1 = MagicMock()
        fake_fact_1.fact_type = "preference"
        fake_fact_1.key = "lang"
        fake_fact_1.value = "TypeScript"
        fake_fact_2 = MagicMock()
        fake_fact_2.fact_type = "preference"
        fake_fact_2.key = "lang"
        fake_fact_2.value = "TS"

        ctx = _new_ctx()
        ctx.facts = [fake_fact_1, fake_fact_2]

        fake_response = MagicMock()
        json_content = json.dumps(
            {
                "entities": [
                    {
                        "canonical": "TypeScript",
                        "aliases": ["TS", "typescript"],
                        "kind": "language",
                    }
                ]
            }
        )
        fake_response.choices = [MagicMock(message=MagicMock(content=json_content))]

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
            step = EntityNormalizationStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1
        assert len(ctx.entities) == 1
        assert ctx.entities[0]["canonical"] == "TypeScript"
        assert "TS" in ctx.entities[0]["aliases"]

    async def test_llm_returns_empty_entities_list(self, _patch_model_config):
        fake_fact = MagicMock()
        fake_fact.fact_type = "preference"
        fake_fact.key = "lang"
        fake_fact.value = "Rust"

        ctx = _new_ctx()
        ctx.facts = [fake_fact]

        fake_response = MagicMock()
        fake_response.choices = [MagicMock(message=MagicMock(content='{"entities": []}'))]

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
            step = EntityNormalizationStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 0
        assert ctx.entities == []

    async def test_llm_returns_entities_without_canonical_filtered_out(self, _patch_model_config):
        fake_fact = MagicMock()
        fake_fact.fact_type = "preference"
        fake_fact.key = "lang"
        fake_fact.value = "Rust"

        ctx = _new_ctx()
        ctx.facts = [fake_fact]

        fake_response = MagicMock()
        fake_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"entities": [{"canonical": "Rust", "aliases": ["rust"], "kind": "language"}, {"aliases": ["bad"]}]}'  # noqa: E501
                )
            )
        ]

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
            step = EntityNormalizationStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1
        assert len(ctx.entities) == 1
        assert ctx.entities[0]["canonical"] == "Rust"

    async def test_llm_failure_returns_failed_status(self, _patch_model_config):
        fake_fact = MagicMock()
        fake_fact.fact_type = "preference"
        fake_fact.key = "lang"
        fake_fact.value = "Go"

        ctx = _new_ctx()
        ctx.facts = [fake_fact]

        with patch("litellm.acompletion", new_callable=AsyncMock, side_effect=RuntimeError("LLM unavailable")):
            step = EntityNormalizationStep(max_retries=1)
            result = await step.run(ctx)

        assert result.status == "failed"
        assert "entity_normalization llm failed" in result.error
        assert "LLM unavailable" in result.error

    async def test_llm_returns_invalid_json_then_failure(self, _patch_model_config):
        fake_fact = MagicMock()
        fake_fact.fact_type = "preference"
        fake_fact.key = "lang"
        fake_fact.value = "Python"

        ctx = _new_ctx()
        ctx.facts = [fake_fact]

        fake_response = MagicMock()
        fake_response.choices = [MagicMock(message=MagicMock(content="not valid json"))]

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
            step = EntityNormalizationStep(max_retries=1)
            result = await step.run(ctx)

        assert result.status == "failed"
        assert result.output_count == 0

    async def test_entities_extend_existing_ctx_entities(self, _patch_model_config):
        fake_fact = MagicMock()
        fake_fact.fact_type = "preference"
        fake_fact.key = "lang"
        fake_fact.value = "Kotlin"

        ctx = _new_ctx()
        ctx.facts = [fake_fact]
        ctx.entities = [{"canonical": "existing_entity", "aliases": [], "kind": "test"}]

        fake_response = MagicMock()
        fake_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"entities": [{"canonical": "Kotlin", "aliases": ["kotlin"], "kind": "language"}]}'
                )
            )
        ]

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
            step = EntityNormalizationStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert len(ctx.entities) == 2
        assert ctx.entities[0]["canonical"] == "existing_entity"
        assert ctx.entities[1]["canonical"] == "Kotlin"

    async def test_facts_truncated_to_50(self, _patch_model_config):
        facts = []
        for i in range(60):
            f = MagicMock()
            f.fact_type = "preference"
            f.key = f"k{i}"
            f.value = f"v{i}"
            facts.append(f)

        ctx = _new_ctx()
        ctx.facts = facts

        captured_prompt = {}

        async def _fake_completion(*args, **kwargs):
            captured_prompt["messages"] = kwargs.get("messages", args[1] if len(args) > 1 else [])
            fake_response = MagicMock()
            fake_response.choices = [MagicMock(message=MagicMock(content='{"entities": []}'))]
            return fake_response

        with patch("litellm.acompletion", new_callable=AsyncMock, side_effect=_fake_completion):
            step = EntityNormalizationStep()
            result = await step.run(ctx)

        assert result.status == "success"
        prompt_text = captured_prompt["messages"][0]["content"]
        fact_lines = [line for line in prompt_text.split("\n") if line.startswith("- ")]
        assert len(fact_lines) == 50
