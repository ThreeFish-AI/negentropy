"""Shared helpers for consolidation pipeline tests."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import uuid4

from negentropy.engine.consolidation.pipeline import PipelineContext, StepResult


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
