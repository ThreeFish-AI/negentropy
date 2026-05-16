"""Tests for SummarizeStep."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from negentropy.engine.consolidation.pipeline.steps.summarize_step import SummarizeStep

from .conftest import _new_ctx


class TestSummarizeStep:
    async def test_summarize_success(self):
        fake_summary = MagicMock()
        fake_summary.content = "summary text"
        fake_summarizer = MagicMock()
        fake_summarizer.get_or_generate_summary = AsyncMock(return_value=fake_summary)

        with patch(
            "negentropy.engine.factories.memory.get_memory_summarizer",
            return_value=fake_summarizer,
        ):
            step = SummarizeStep()
            result = await step.run(_new_ctx())

        assert result.status == "success"
        assert result.output_count == 1

    async def test_summarize_handles_old_signature(self):
        fake_summary = MagicMock()
        fake_summary.content = ""
        fake_summarizer = MagicMock()

        async def _resolver(*args, **kwargs):
            if "force_refresh" in kwargs:
                raise TypeError("unexpected keyword")
            return fake_summary

        fake_summarizer.get_or_generate_summary = AsyncMock(side_effect=_resolver)

        with patch(
            "negentropy.engine.factories.memory.get_memory_summarizer",
            return_value=fake_summarizer,
        ):
            step = SummarizeStep()
            result = await step.run(_new_ctx())

        assert result.status == "success"
        assert result.output_count == 0
