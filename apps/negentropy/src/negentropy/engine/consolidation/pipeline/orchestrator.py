"""ConsolidationPipeline 编排器 — serial / parallel / fail_tolerant 三策略。"""

from __future__ import annotations

import asyncio
import time

from negentropy.logging import get_logger

from .protocol import ConsolidationStep, PipelineContext, StepResult

logger = get_logger("negentropy.engine.consolidation.pipeline.orchestrator")

_VALID_POLICIES = {"serial", "parallel", "fail_tolerant"}


class ConsolidationPipeline:
    """巩固后处理管线。

    三种策略：
    - ``serial``：按 step 顺序执行；任一 step 失败即停（旧行为兼容首选）；
    - ``parallel``：所有 step 并发执行（``asyncio.gather``）；适合彼此无依赖；
    - ``fail_tolerant``：串行执行但 step 失败仅记录，不阻断后续；用于实验性 step。

    每个 step 自己负责事务管理（失败不可向主写入路径传染）；超时由
    ``asyncio.wait_for`` 强制截断，超时记为 ``failed``。
    """

    def __init__(
        self,
        *,
        steps: list[ConsolidationStep],
        policy: str = "serial",
        timeout_per_step_ms: int = 30000,
    ) -> None:
        if policy not in _VALID_POLICIES:
            raise ValueError(f"Unknown pipeline policy: {policy!r}; valid: {sorted(_VALID_POLICIES)}")
        self._steps = steps
        self._policy = policy
        self._timeout_per_step = max(0.1, timeout_per_step_ms / 1000.0)

    @property
    def step_names(self) -> list[str]:
        return [s.name for s in self._steps]

    async def run(self, ctx: PipelineContext) -> list[StepResult]:
        if not self._steps:
            return []
        if self._policy == "parallel":
            return await self._run_parallel(ctx)
        return await self._run_sequential(ctx, fail_tolerant=self._policy == "fail_tolerant")

    async def _run_sequential(
        self,
        ctx: PipelineContext,
        *,
        fail_tolerant: bool,
    ) -> list[StepResult]:
        results: list[StepResult] = []
        for step in self._steps:
            res = await self._invoke_step(step, ctx)
            results.append(res)
            if not res.ok and not fail_tolerant:
                logger.warning(
                    "consolidation_pipeline_aborted",
                    failed_step=step.name,
                    error=res.error,
                )
                break
        return results

    async def _run_parallel(self, ctx: PipelineContext) -> list[StepResult]:
        coros = [self._invoke_step(step, ctx) for step in self._steps]
        return list(await asyncio.gather(*coros))

    async def _invoke_step(
        self,
        step: ConsolidationStep,
        ctx: PipelineContext,
    ) -> StepResult:
        start = time.perf_counter()
        try:
            res = await asyncio.wait_for(step.run(ctx), timeout=self._timeout_per_step)
        except TimeoutError:
            duration_ms = int((time.perf_counter() - start) * 1000)
            logger.warning(
                "consolidation_step_timeout",
                step=step.name,
                duration_ms=duration_ms,
                limit_ms=int(self._timeout_per_step * 1000),
            )
            return StepResult(
                step_name=step.name,
                status="failed",
                duration_ms=duration_ms,
                error="timeout",
            )
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start) * 1000)
            logger.warning(
                "consolidation_step_exception",
                step=step.name,
                duration_ms=duration_ms,
                error=str(exc),
            )
            return StepResult(
                step_name=step.name,
                status="failed",
                duration_ms=duration_ms,
                error=str(exc),
            )

        # step.run 自己已经返回 StepResult；duration 用 step 自报为准，否则补上
        if not isinstance(res, StepResult):
            duration_ms = int((time.perf_counter() - start) * 1000)
            return StepResult(
                step_name=step.name,
                status="failed",
                duration_ms=duration_ms,
                error=f"step did not return StepResult: {type(res).__name__}",
            )
        if res.duration_ms <= 0:
            res.duration_ms = int((time.perf_counter() - start) * 1000)
        return res


__all__ = ["ConsolidationPipeline"]
