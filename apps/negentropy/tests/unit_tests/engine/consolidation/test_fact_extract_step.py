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

    async def test_failed_when_extractor_raises(self):
        """提取器抛错 → status=failed，且不触碰 FactService。"""
        fake_extractor = MagicMock()
        fake_extractor.extract = AsyncMock(side_effect=RuntimeError("llm boom"))

        ctx = _new_ctx()
        ctx.turns = [{"author": "user", "text": "I prefer Rust"}]

        with patch("negentropy.engine.factories.memory.get_fact_service") as mock_get:
            step = FactExtractStep(extractor=fake_extractor)
            result = await step.run(ctx)

        assert result.status == "failed"
        assert result.error
        mock_get.assert_not_called()

    async def test_empty_facts_is_success_zero(self):
        """提取出 0 条事实 → success / output_count=0，不写库。"""
        fake_extractor = MagicMock()
        fake_extractor.extract = AsyncMock(return_value=[])

        ctx = _new_ctx()
        ctx.turns = [{"author": "user", "text": "hi"}]

        with patch("negentropy.engine.factories.memory.get_fact_service") as mock_get:
            step = FactExtractStep(extractor=fake_extractor)
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 0
        assert ctx.facts == []
        mock_get.assert_not_called()

    async def test_upsert_failure_does_not_crash_step(self):
        """单条 upsert 抛错被吞掉，step 仍 success，output_count 仅计成功。"""
        fake_extractor = MagicMock()
        fake_extractor.extract = AsyncMock(
            return_value=[
                ExtractedFact(fact_type="preference", key="lang", value="rust", confidence=0.9),
                ExtractedFact(fact_type="profile", key="role", value="dev", confidence=0.9),
            ]
        )
        ctx = _new_ctx()
        ctx.turns = [{"author": "user", "text": "I prefer Rust, I am a dev"}]

        calls = {"n": 0}

        async def _upsert(**kwargs):
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("upsert boom")

        with patch("negentropy.engine.factories.memory.get_fact_service") as mock_get:
            fake_service = MagicMock()
            fake_service.upsert_fact = AsyncMock(side_effect=_upsert)
            mock_get.return_value = fake_service

            step = FactExtractStep(extractor=fake_extractor)
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1  # 2 条中 1 条 upsert 失败
        assert result.extra["extracted"] == 2
