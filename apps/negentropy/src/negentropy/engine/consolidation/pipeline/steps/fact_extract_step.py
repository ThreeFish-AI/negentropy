"""FactExtractStep — 包装现有 LLMFactExtractor + FactService.upsert。

行为与 Phase 4 ``_extract_and_store_facts`` 一致；产出写回 ``ctx.facts``。
"""

from __future__ import annotations

import time

from negentropy.engine.consolidation.llm_fact_extractor import LLMFactExtractor
from negentropy.logging import get_logger

from ..protocol import PipelineContext, StepResult
from ..registry import register

logger = get_logger("negentropy.engine.consolidation.pipeline.steps.fact_extract")


@register("fact_extract")
class FactExtractStep:
    name = "fact_extract"

    def __init__(self, extractor: LLMFactExtractor | None = None) -> None:
        self._extractor = extractor or LLMFactExtractor()

    async def run(self, ctx: PipelineContext) -> StepResult:
        start = time.perf_counter()
        if not ctx.turns:
            return StepResult(step_name=self.name, status="skipped", duration_ms=0, output_count=0)

        try:
            facts = await self._extractor.extract(ctx.turns)
        except Exception as exc:
            return StepResult(
                step_name=self.name,
                status="failed",
                duration_ms=int((time.perf_counter() - start) * 1000),
                error=str(exc),
            )
        if not facts:
            return StepResult(
                step_name=self.name,
                status="success",
                duration_ms=int((time.perf_counter() - start) * 1000),
                output_count=0,
            )

        ctx.facts.extend(facts)
        # upsert（与原 _extract_and_store_facts 保持等价）
        from negentropy.engine.factories.memory import get_fact_service

        fact_service = get_fact_service(embedding_fn=ctx.embedding_fn)
        upserted = 0
        for fact in facts:
            try:
                await fact_service.upsert_fact(
                    user_id=ctx.user_id,
                    app_name=ctx.app_name,
                    fact_type=fact.fact_type,
                    key=fact.key[:255],
                    value={"text": fact.value},
                    confidence=fact.confidence,
                    thread_id=ctx.thread_id,
                )
                upserted += 1
            except Exception as exc:
                logger.warning("fact_upsert_failed", key=fact.key[:50], error=str(exc))

        duration_ms = int((time.perf_counter() - start) * 1000)
        return StepResult(
            step_name=self.name,
            status="success",
            duration_ms=duration_ms,
            output_count=upserted,
            extra={"extracted": len(facts)},
        )


__all__ = ["FactExtractStep"]
