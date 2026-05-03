"""SummarizeStep — 触发用户画像摘要重建（opt-in；默认非启用 step）。

包装 ``MemorySummarizer.get_or_generate_summary``，强制 force_refresh=True。
注意 summarizer 已有 TTL 缓存，本 step 仅在显式启用时主动刷新。
"""

from __future__ import annotations

import time

from negentropy.logging import get_logger

from ..protocol import PipelineContext, StepResult
from ..registry import register

logger = get_logger("negentropy.engine.consolidation.pipeline.steps.summarize")


@register("summarize")
class SummarizeStep:
    name = "summarize"

    async def run(self, ctx: PipelineContext) -> StepResult:
        start = time.perf_counter()
        try:
            from negentropy.engine.factories.memory import get_memory_summarizer

            summarizer = get_memory_summarizer()
        except Exception as exc:
            return StepResult(
                step_name=self.name,
                status="failed",
                duration_ms=int((time.perf_counter() - start) * 1000),
                error=str(exc),
            )

        try:
            # 优先使用 force_refresh，旧版若无该参数则降级
            try:
                summary = await summarizer.get_or_generate_summary(
                    user_id=ctx.user_id, app_name=ctx.app_name, force_refresh=True
                )
            except TypeError:
                summary = await summarizer.get_or_generate_summary(user_id=ctx.user_id, app_name=ctx.app_name)
        except Exception as exc:
            return StepResult(
                step_name=self.name,
                status="failed",
                duration_ms=int((time.perf_counter() - start) * 1000),
                error=str(exc),
            )

        duration_ms = int((time.perf_counter() - start) * 1000)
        produced = 1 if summary and getattr(summary, "content", None) else 0
        return StepResult(
            step_name=self.name,
            status="success",
            duration_ms=duration_ms,
            output_count=produced,
        )


__all__ = ["SummarizeStep"]
