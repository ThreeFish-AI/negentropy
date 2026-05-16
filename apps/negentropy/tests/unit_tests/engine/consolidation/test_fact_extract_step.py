"""Tests for FactExtractStep."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from negentropy.engine.consolidation.fact_extractor import ExtractedFact
from negentropy.engine.consolidation.pipeline.steps.fact_extract_step import FactExtractStep

from .conftest import _new_ctx


class TestFactExtractStep:
    async def test_skipped_on_empty_turns(self):
        step = FactExtractStep(extractor=MagicMock())
        ctx = _new_ctx()
        result = await step.run(ctx)
        assert result.status == "skipped"
        assert result.output_count == 0

    async def test_extracts_and_upserts(self):
        fake_extractor = MagicMock()
        fake_extractor.extract = AsyncMock(
            return_value=[
                ExtractedFact(fact_type="preference", key="lang", value="rust", confidence=0.9),
            ]
        )

        ctx = _new_ctx()
        ctx.turns = [{"author": "user", "text": "I prefer Rust"}]

        with patch("negentropy.engine.factories.memory.get_fact_service") as mock_get:
            fake_service = MagicMock()
            fake_service.upsert_fact = AsyncMock()
            mock_get.return_value = fake_service

            step = FactExtractStep(extractor=fake_extractor)
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1
        assert ctx.facts and ctx.facts[0].key == "lang"
        fake_service.upsert_fact.assert_awaited_once()
