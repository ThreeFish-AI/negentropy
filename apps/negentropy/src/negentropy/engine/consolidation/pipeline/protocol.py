"""ConsolidationStep / PipelineContext / StepResult 协议定义。

Phase 5 F3 — 把巩固后处理的"事实抽取/关联建立/未来扩展"统一为可组合 step。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable
from uuid import UUID


@dataclass
class PipelineContext:
    """单次巩固运行共享的可变态。

    各 step 可读取上游产出（facts / entities / topics 等），并把自己的产出
    写回 ``ctx.facts`` / ``ctx.entities`` / 等。
    """

    user_id: str
    app_name: str
    thread_id: UUID | None
    turns: list[dict[str, str]] = field(default_factory=list)
    new_memory_ids: list[UUID] = field(default_factory=list)
    embedding_fn: Any | None = None
    facts: list[Any] = field(default_factory=list)
    entities: list[Any] = field(default_factory=list)
    topics: list[Any] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class StepResult:
    """单个 step 的执行结果。"""

    step_name: str
    status: str  # "success" | "failed" | "skipped"
    duration_ms: int = 0
    output_count: int = 0
    error: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.status == "success"


@runtime_checkable
class ConsolidationStep(Protocol):
    """巩固管线中的单个步骤。

    实现要求：
    - ``name`` 为唯一标识（注册到 STEP_REGISTRY）；
    - ``run(ctx)`` 异步执行，捕获自身异常并返回 StepResult，**不可向上抛**；
    - 写回 ``ctx`` 的产出供后续 step 使用。
    """

    name: str

    async def run(self, ctx: PipelineContext) -> StepResult: ...


__all__ = ["ConsolidationStep", "PipelineContext", "StepResult"]
