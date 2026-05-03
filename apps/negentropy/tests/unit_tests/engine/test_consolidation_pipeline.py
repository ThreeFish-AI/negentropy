"""Tests for ConsolidationPipeline orchestrator + registry (Phase 5 F3)."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from negentropy.engine.consolidation.pipeline import (
    ConsolidationPipeline,
    PipelineContext,
    StepResult,
    build_pipeline,
    register,
)
from negentropy.engine.consolidation.pipeline.registry import STEP_REGISTRY


def _new_ctx() -> PipelineContext:
    return PipelineContext(user_id="alice", app_name="negentropy", thread_id=uuid4(), turns=[])


@dataclass
class _RecordingStep:
    name: str
    status: str = "success"
    output_count: int = 1
    delay: float = 0.0
    raise_exc: BaseException | None = None
    invoked: list[str] = None  # type: ignore

    def __post_init__(self) -> None:
        self.invoked = []

    async def run(self, ctx: PipelineContext) -> StepResult:
        if self.delay:
            await asyncio.sleep(self.delay)
        self.invoked.append(self.name)
        if self.raise_exc:
            raise self.raise_exc
        return StepResult(
            step_name=self.name,
            status=self.status,
            duration_ms=1,
            output_count=self.output_count,
        )


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
        # b 没被调用
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
        # 串行需要 100ms+，并行应 < 80ms
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


class TestRegistryBuilder:
    def test_default_steps_registered(self):
        # 触发内置 step 注册
        from negentropy.engine.consolidation.pipeline import steps as _  # noqa

        assert "fact_extract" in STEP_REGISTRY
        assert "auto_link" in STEP_REGISTRY

    def test_register_decorator(self):
        @register("test_xyz")
        class _S:
            name = "test_xyz"

            async def run(self, ctx):
                return StepResult(step_name=self.name, status="success", duration_ms=1)

        assert STEP_REGISTRY.get("test_xyz") is _S
        STEP_REGISTRY.pop("test_xyz", None)

    def test_build_pipeline_strict_unknown_raises(self):
        with pytest.raises(ValueError):
            build_pipeline(["nonexistent_step_xyz"], strict=True)

    def test_build_pipeline_non_strict_skips_unknown(self):
        from negentropy.engine.consolidation.pipeline import steps as _  # noqa

        pipe = build_pipeline(["fact_extract", "nope_step"], strict=False)
        assert pipe.step_names == ["fact_extract"]


class TestFactExtractStep:
    async def test_skipped_on_empty_turns(self):
        from negentropy.engine.consolidation.pipeline.steps.fact_extract_step import (
            FactExtractStep,
        )

        step = FactExtractStep(extractor=MagicMock())
        ctx = _new_ctx()
        result = await step.run(ctx)
        assert result.status == "skipped"
        assert result.output_count == 0

    async def test_extracts_and_upserts(self):
        from negentropy.engine.consolidation.fact_extractor import ExtractedFact
        from negentropy.engine.consolidation.pipeline.steps.fact_extract_step import (
            FactExtractStep,
        )

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


class TestAutoLinkStep:
    async def test_skipped_when_no_new_memory_ids(self):
        from negentropy.engine.consolidation.pipeline.steps.auto_link_step import (
            AutoLinkStep,
        )

        step = AutoLinkStep()
        ctx = _new_ctx()
        result = await step.run(ctx)
        assert result.status == "skipped"


class TestSummarizeStep:
    async def test_summarize_success(self):
        from negentropy.engine.consolidation.pipeline.steps.summarize_step import SummarizeStep

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
        from negentropy.engine.consolidation.pipeline.steps.summarize_step import SummarizeStep

        fake_summary = MagicMock()
        fake_summary.content = ""
        fake_summarizer = MagicMock()

        # 第一次（带 force_refresh）抛 TypeError，第二次（无 force_refresh）成功
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
        # content 为空 → output_count = 0
        assert result.output_count == 0
