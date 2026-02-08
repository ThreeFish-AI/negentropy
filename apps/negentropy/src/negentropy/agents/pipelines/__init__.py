"""
Faculty Pipelines Module - 系部流水线模块

基于 ADK 的 SequentialAgent 实现标准化系部协调流水线，遵循「复用驱动」原则。
流水线封装常见的系部协作模式，减少协调熵。

参考文献:
[1] Google. "Agent Development Kit - Workflow Agents," _Google ADK Documentation_, 2025.
    https://google.github.io/adk-docs/agents/workflow-agents/
"""

from negentropy.agents.pipelines.adaptive import adaptive_orchestrator
from negentropy.agents.pipelines.iterative import (
    DEFAULT_MAX_ITERATIONS,
    DEFAULT_QUALITY_THRESHOLD,
    MIN_IMPROVEMENT_THRESHOLD,
    create_action_refinement_loop,
    create_contemplation_refinement_loop,
    create_perception_refinement_loop,
    create_refinement_loop,
)
from negentropy.agents.pipelines.standard import (
    KNOWLEDGE_ACQUISITION_PIPELINE_NAME,
    PROBLEM_SOLVING_PIPELINE_NAME,
    VALUE_DELIVERY_PIPELINE_NAME,
    create_knowledge_acquisition_pipeline,
    create_problem_solving_pipeline,
    create_value_delivery_pipeline,
)

__all__ = [
    # 标准流水线
    "create_knowledge_acquisition_pipeline",
    "create_problem_solving_pipeline",
    "create_value_delivery_pipeline",
    "KNOWLEDGE_ACQUISITION_PIPELINE_NAME",
    "PROBLEM_SOLVING_PIPELINE_NAME",
    "VALUE_DELIVERY_PIPELINE_NAME",
    # 迭代精化
    "create_refinement_loop",
    "create_contemplation_refinement_loop",
    "create_perception_refinement_loop",
    "create_action_refinement_loop",
    "DEFAULT_MAX_ITERATIONS",
    "DEFAULT_QUALITY_THRESHOLD",
    "MIN_IMPROVEMENT_THRESHOLD",
    # 自适应编排
    "adaptive_orchestrator",
]
