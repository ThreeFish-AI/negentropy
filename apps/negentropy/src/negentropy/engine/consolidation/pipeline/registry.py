"""STEP_REGISTRY — 全局 step 类型注册表 + pipeline builder。"""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING

from negentropy.logging import get_logger

from .protocol import ConsolidationStep

if TYPE_CHECKING:
    from .orchestrator import ConsolidationPipeline

logger = get_logger("negentropy.engine.consolidation.pipeline.registry")

# {step_name: factory}；factory 接受可选 kwargs 返回 step 实例
STEP_REGISTRY: dict[str, Callable[..., ConsolidationStep]] = {}


def register(name: str) -> Callable[[type[ConsolidationStep]], type[ConsolidationStep]]:
    """class decorator — 把 step 类注册到 STEP_REGISTRY。"""

    def _decorator(cls: type[ConsolidationStep]) -> type[ConsolidationStep]:
        if name in STEP_REGISTRY:
            logger.debug("consolidation_step_overridden", name=name)
        STEP_REGISTRY[name] = cls  # type: ignore[assignment]
        return cls

    return _decorator


def build_pipeline(
    step_names: list[str],
    *,
    policy: str = "serial",
    timeout_per_step_ms: int = 30000,
    strict: bool = True,
) -> ConsolidationPipeline:
    """根据 step 名称列表构造 pipeline。

    Args:
        step_names: 要启用的 step 名称序列；未注册的名称在 strict=True 时抛错
        policy: 编排策略（见 ``ConsolidationPipeline``）
        timeout_per_step_ms: 单 step 超时上限
        strict: True 时未注册名称即抛 ValueError；False 时跳过并写日志
    """
    from .orchestrator import ConsolidationPipeline

    steps: list[ConsolidationStep] = []
    for name in step_names:
        factory = STEP_REGISTRY.get(name)
        if factory is None:
            if strict:
                raise ValueError(f"Unknown consolidation step: {name!r} (registered: {list(STEP_REGISTRY)})")
            logger.warning("consolidation_step_unknown_skipped", name=name)
            continue
        steps.append(factory())
    return ConsolidationPipeline(
        steps=steps,
        policy=policy,
        timeout_per_step_ms=timeout_per_step_ms,
    )


__all__ = ["STEP_REGISTRY", "register", "build_pipeline"]
