"""Tests for ConsolidationPipeline orchestrator."""

from __future__ import annotations

import asyncio

import pytest

from negentropy.engine.consolidation.pipeline import ConsolidationPipeline

from .conftest import _new_ctx, _RecordingStep


class TestConsolidationPipeline:
    async def test_serial_runs_in_order(self):
        s1 = _RecordingStep(name="a")
        s2 = _RecordingStep(name="b")
        pipe = ConsolidationPipeline(steps=[s1, s2], policy="serial")
        results = await pipe.run(_new_ctx())
        assert [r.step_name for r in results] == ["a", "b"]
        assert all(r.status == "success" for r in results)

    async def test_serial_aborts_on_failure(self):
        s1 = _RecordingStep(name="a", raise_exc=RuntimeError("boom"))
        s2 = _RecordingStep(name="b")
        pipe = ConsolidationPipeline(steps=[s1, s2], policy="serial")
        results = await pipe.run(_new_ctx())
        assert [r.step_name for r in results] == ["a"]
        assert results[0].status == "failed"
        assert s2.invoked == []

    async def test_fail_tolerant_continues(self):
        s1 = _RecordingStep(name="a", raise_exc=RuntimeError("boom"))
        s2 = _RecordingStep(name="b")
        pipe = ConsolidationPipeline(steps=[s1, s2], policy="fail_tolerant")
        results = await pipe.run(_new_ctx())
        assert [r.step_name for r in results] == ["a", "b"]
        assert results[0].status == "failed"
        assert results[1].status == "success"

    async def test_parallel_invokes_all_concurrently(self):
        s1 = _RecordingStep(name="a", delay=0.05)
        s2 = _RecordingStep(name="b", delay=0.05)
        pipe = ConsolidationPipeline(steps=[s1, s2], policy="parallel")
        loop_start = asyncio.get_event_loop().time()
        results = await pipe.run(_new_ctx())
        elapsed = asyncio.get_event_loop().time() - loop_start
        assert {r.step_name for r in results} == {"a", "b"}
        assert elapsed < 0.08

    async def test_step_timeout_marked_failed(self):
        slow = _RecordingStep(name="slow", delay=0.5)
        pipe = ConsolidationPipeline(steps=[slow], policy="serial", timeout_per_step_ms=50)
        results = await pipe.run(_new_ctx())
        assert results[0].status == "failed"
        assert results[0].error == "timeout"

    async def test_invalid_policy_raises(self):
        with pytest.raises(ValueError):
            ConsolidationPipeline(steps=[], policy="DAG")  # type: ignore[arg-type]

    async def test_empty_pipeline_returns_empty(self):
        pipe = ConsolidationPipeline(steps=[], policy="serial")
        assert await pipe.run(_new_ctx()) == []
