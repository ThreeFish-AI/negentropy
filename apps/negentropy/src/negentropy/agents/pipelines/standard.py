"""
Standard Faculty Pipelines - 标准系部流水线

定义常见系部协作模式的流水线，使用 ADK 的 SequentialAgent 实现结构化协调。
这些流水线封装了「一核五翼」架构中的最佳实践，减少协调熵。

流水线设计原则（遵循 AGENTS.md）:
- **正交分解**: 每个流水线专注于特定的任务类型
- **复用驱动**: 通过组合现有系部实现复杂流程
- **反馈闭环**: 流水线输出支持后续精化和改进
- **最小干预**: 仅添加必要的协调逻辑

参考文献:
[1] Google. "Agent Development Kit - SequentialAgent," _Google ADK Documentation_, 2025.
    https://google.github.io/adk-docs/agents/workflow-agents/#sequentialagent
"""

from google.adk.agents import LlmAgent, SequentialAgent

from negentropy.agents.faculties.action import action_agent
from negentropy.agents.faculties.contemplation import contemplation_agent
from negentropy.agents.faculties.influence import influence_agent
from negentropy.agents.faculties.internalization import internalization_agent
from negentropy.agents.faculties.perception import perception_agent

# 流水线名称常量
KNOWLEDGE_ACQUISITION_PIPELINE_NAME = "KnowledgeAcquisitionPipeline"
PROBLEM_SOLVING_PIPELINE_NAME = "ProblemSolvingPipeline"
VALUE_DELIVERY_PIPELINE_NAME = "ValueDeliveryPipeline"


def create_knowledge_acquisition_pipeline(
    perception: LlmAgent | None = None,
    internalization: LlmAgent | None = None,
) -> SequentialAgent:
    """创建知识获取流水线

    实现信息从获取到结构化的完整流程：
    1. 感知系部：高信噪比的信息获取
    2. 内化系部：知识结构化与持久化

    适用场景：
    - 研究新领域或技术
    - 收集并整理需求
    - 构建知识库

    Args:
        perception: 感知系部智能体 (默认使用全局实例)
        internalization: 内化系部智能体 (默认使用全局实例)

    Returns:
        配置好的 SequentialAgent 流水线
    """
    if perception is None:
        perception = perception_agent
    if internalization is None:
        internalization = internalization_agent

    return SequentialAgent(
        name=KNOWLEDGE_ACQUISITION_PIPELINE_NAME,
        sub_agents=[perception, internalization],
    )


def create_problem_solving_pipeline(
    perception: LlmAgent | None = None,
    contemplation: LlmAgent | None = None,
    action: LlmAgent | None = None,
    internalization: LlmAgent | None = None,
) -> SequentialAgent:
    """创建问题解决流水线

    实现复杂问题的端到端解决流程：
    1. 感知系部：理解问题上下文
    2. 沉思系部：深度分析与方案规划
    3. 行动系部：精确执行解决方案
    4. 内化系部：沉淀经验教训

    适用场景：
    - Bug 修复与根因分析
    - 功能设计与实现
    - 系统优化与重构

    Args:
        perception: 感知系部智能体 (默认使用全局实例)
        contemplation: 沉思系部智能体 (默认使用全局实例)
        action: 行动系部智能体 (默认使用全局实例)
        internalization: 内化系部智能体 (默认使用全局实例)

    Returns:
        配置好的 SequentialAgent 流水线
    """
    if perception is None:
        perception = perception_agent
    if contemplation is None:
        contemplation = contemplation_agent
    if action is None:
        action = action_agent
    if internalization is None:
        internalization = internalization_agent

    return SequentialAgent(
        name=PROBLEM_SOLVING_PIPELINE_NAME,
        sub_agents=[perception, contemplation, action, internalization],
    )


def create_value_delivery_pipeline(
    perception: LlmAgent | None = None,
    contemplation: LlmAgent | None = None,
    influence: LlmAgent | None = None,
) -> SequentialAgent:
    """创建价值交付流水线

    实现从洞察到价值传递的完整流程：
    1. 感知系部：收集信息与数据
    2. 沉思系部：提炼洞察与智慧
    3. 影响系部：清晰表达与传递价值

    适用场景：
    - 撰写技术文档或报告
    - 生成演示内容
    - 提供决策建议

    Args:
        perception: 感知系部智能体 (默认使用全局实例)
        contemplation: 沉思系部智能体 (默认使用全局实例)
        influence: 影响系部智能体 (默认使用全局实例)

    Returns:
        配置好的 SequentialAgent 流水线
    """
    if perception is None:
        perception = perception_agent
    if contemplation is None:
        contemplation = contemplation_agent
    if influence is None:
        influence = influence_agent

    return SequentialAgent(
        name=VALUE_DELIVERY_PIPELINE_NAME,
        sub_agents=[perception, contemplation, influence],
    )


__all__ = [
    "create_knowledge_acquisition_pipeline",
    "create_problem_solving_pipeline",
    "create_value_delivery_pipeline",
    "KNOWLEDGE_ACQUISITION_PIPELINE_NAME",
    "PROBLEM_SOLVING_PIPELINE_NAME",
    "VALUE_DELIVERY_PIPELINE_NAME",
]
