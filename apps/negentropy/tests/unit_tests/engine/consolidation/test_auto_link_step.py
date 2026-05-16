"""Tests for AutoLinkStep."""

from __future__ import annotations

from negentropy.engine.consolidation.pipeline.steps.auto_link_step import AutoLinkStep

from .conftest import _new_ctx


class TestAutoLinkStep:
    async def test_skipped_when_no_new_memory_ids(self):
        step = AutoLinkStep()
        ctx = _new_ctx()
        result = await step.run(ctx)
        assert result.status == "skipped"
