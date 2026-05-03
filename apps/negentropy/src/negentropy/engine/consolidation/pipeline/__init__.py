"""ConsolidationPipeline — Phase 5 F3 Memify 后处理插件管线

把 ``add_session_to_memory`` 中硬编码的 "fact_extract → auto_link" 两步
重构为 ``ConsolidationPipeline + ConsolidationStep`` 协议（Strategy + Chain of Responsibility）。

设计目标：
- 默认行为不回归（步骤顺序、行为与 Phase 4 一致）；
- 通过 ``settings.memory.consolidation.steps`` 可声明式扩展（实体规范化、主题聚类等）；
- 单 step 失败按 ``policy`` 决策（serial / parallel / fail_tolerant）。

参考：
[1] cognee Memify, https://docs.cognee.ai/core-concepts/main-operations/memify
[2] E. Gamma et al., Design Patterns: Elements of Reusable Object-Oriented Software, 1994.
"""

from .orchestrator import ConsolidationPipeline
from .protocol import ConsolidationStep, PipelineContext, StepResult
from .registry import STEP_REGISTRY, build_pipeline, register

__all__ = [
    "ConsolidationPipeline",
    "ConsolidationStep",
    "PipelineContext",
    "StepResult",
    "STEP_REGISTRY",
    "build_pipeline",
    "register",
]
