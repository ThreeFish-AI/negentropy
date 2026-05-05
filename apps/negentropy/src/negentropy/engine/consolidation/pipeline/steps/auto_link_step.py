"""AutoLinkStep — 包装 AssociationService.auto_link_memory（行为与 Phase 4 一致）。"""

from __future__ import annotations

import time

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import Memory

from ..protocol import PipelineContext, StepResult
from ..registry import register

logger = get_logger("negentropy.engine.consolidation.pipeline.steps.auto_link")


@register("auto_link")
class AutoLinkStep:
    name = "auto_link"

    async def run(self, ctx: PipelineContext) -> StepResult:
        start = time.perf_counter()
        if not ctx.new_memory_ids:
            return StepResult(step_name=self.name, status="skipped", duration_ms=0, output_count=0)

        from negentropy.engine.factories.memory import get_association_service

        association_service = get_association_service()
        try:
            async with db_session.AsyncSessionLocal() as db:
                stmt = sa.select(Memory).where(Memory.id.in_(ctx.new_memory_ids))
                result = await db.execute(stmt)
                new_memories = result.scalars().all()
        except Exception as exc:
            return StepResult(
                step_name=self.name,
                status="failed",
                duration_ms=int((time.perf_counter() - start) * 1000),
                error=str(exc),
            )

        linked = 0
        for m in new_memories:
            try:
                await association_service.auto_link_memory(
                    memory_id=m.id,
                    user_id=ctx.user_id,
                    app_name=ctx.app_name,
                    thread_id=m.thread_id,
                    embedding=m.embedding,
                    created_at=m.created_at,
                )
                linked += 1
            except Exception as exc:
                logger.debug("auto_link_failed", memory_id=str(m.id), error=str(exc))

        return StepResult(
            step_name=self.name,
            status="success",
            duration_ms=int((time.perf_counter() - start) * 1000),
            output_count=linked,
        )


__all__ = ["AutoLinkStep"]
