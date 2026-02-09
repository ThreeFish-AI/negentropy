"""
Standard Faculty Pipelines - 标准系部流水线

定义常见系部协作模式的流水线，使用 ADK 的 SequentialAgent 实现结构化协调。
这些流水线封装了「一核五翼」架构中的最佳实践，减少协调熵。

每个流水线通过工厂函数创建独立的 Faculty Agent 实例，
避免违反 ADK 的 Agent 单亲规则 (single-parent rule)。
流水线步骤间通过 output_key → {var?} 模板机制传递上下文。

流水线设计原则（遵循 AGENTS.md）:
- **正交分解**: 每个流水线专注于特定的任务类型
- **复用驱动**: 通过组合现有系部实现复杂流程；使用 ADK 原生 output_key 状态传递
- **反馈闭环**: 流水线输出支持后续精化和改进
- **最小干预**: 仅添加必要的协调逻辑

参考文献:
[1] Google. "Agent Development Kit - SequentialAgent," _Google ADK Documentation_, 2025.
    https://google.github.io/adk-docs/agents/workflow-agents/#sequentialagent
[2] Google. "Agent Development Kit - Multi-Agent Systems," _Google ADK Documentation_, 2025.
    https://google.github.io/adk-docs/agents/multi-agents/
    "An agent instance can only be added as a sub-agent once."
"""

from google.adk.agents import SequentialAgent

from ..faculties.action import create_action_agent
from ..faculties.contemplation import create_contemplation_agent
from ..faculties.influence import create_influence_agent
from ..faculties.internalization import create_internalization_agent
from ..faculties.perception import create_perception_agent

# 流水线名称常量
KNOWLEDGE_ACQUISITION_PIPELINE_NAME = "KnowledgeAcquisitionPipeline"
PROBLEM_SOLVING_PIPELINE_NAME = "ProblemSolvingPipeline"
VALUE_DELIVERY_PIPELINE_NAME = "ValueDeliveryPipeline"


def create_knowledge_acquisition_pipeline() -> SequentialAgent:
    """创建知识获取流水线

    实现信息从获取到结构化的完整流程：
    1. 感知系部：高信噪比的信息获取 → output_key="perception_output"
    2. 内化系部：知识结构化与持久化 → output_key="internalization_output"

    适用场景：
    - 研究新领域或技术
    - 收集并整理需求
    - 构建知识库

    Returns:
        配置好的 SequentialAgent 流水线
    """
    return SequentialAgent(
        name=KNOWLEDGE_ACQUISITION_PIPELINE_NAME,
        description=(
            "Handles: research, learning, knowledge gathering, information collection. "
            "结构化知识获取流程。执行路径：感知 → 内化。"
        ),
        sub_agents=[
            create_perception_agent(output_key="perception_output"),
            create_internalization_agent(output_key="internalization_output"),
        ],
    )


def create_problem_solving_pipeline() -> SequentialAgent:
    """创建问题解决流水线

    实现复杂问题的端到端解决流程：
    1. 感知系部：理解问题上下文 → output_key="perception_output"
    2. 沉思系部：深度分析与方案规划 → output_key="contemplation_output"
    3. 行动系部：精确执行解决方案 → output_key="action_output"
    4. 内化系部：沉淀经验教训 → output_key="internalization_output"

    适用场景：
    - Bug 修复与根因分析
    - 功能设计与实现
    - 系统优化与重构

    Returns:
        配置好的 SequentialAgent 流水线
    """
    return SequentialAgent(
        name=PROBLEM_SOLVING_PIPELINE_NAME,
        description=(
            "Handles: bug fixing, feature implementation, system optimization, refactoring. "
            "端到端问题解决流程。执行路径：感知 → 沉思 → 行动 → 内化。"
        ),
        sub_agents=[
            create_perception_agent(output_key="perception_output"),
            create_contemplation_agent(output_key="contemplation_output"),
            create_action_agent(output_key="action_output"),
            create_internalization_agent(output_key="internalization_output"),
        ],
    )


def create_value_delivery_pipeline() -> SequentialAgent:
    """创建价值交付流水线

    实现从洞察到价值传递的完整流程：
    1. 感知系部：收集信息与数据 → output_key="perception_output"
    2. 沉思系部：提炼洞察与智慧 → output_key="contemplation_output"
    3. 影响系部：清晰表达与传递价值 → output_key="influence_output"

    适用场景：
    - 撰写技术文档或报告
    - 生成演示内容
    - 提供决策建议

    Returns:
        配置好的 SequentialAgent 流水线
    """
    return SequentialAgent(
        name=VALUE_DELIVERY_PIPELINE_NAME,
        description=(
            "Handles: documentation, report generation, presentations, decision recommendations. "
            "从洞察到价值传递的完整流程。执行路径：感知 → 沉思 → 影响。"
        ),
        sub_agents=[
            create_perception_agent(output_key="perception_output"),
            create_contemplation_agent(output_key="contemplation_output"),
            create_influence_agent(output_key="influence_output"),
        ],
    )


__all__ = [
    "create_knowledge_acquisition_pipeline",
    "create_problem_solving_pipeline",
    "create_value_delivery_pipeline",
    "KNOWLEDGE_ACQUISITION_PIPELINE_NAME",
    "PROBLEM_SOLVING_PIPELINE_NAME",
    "VALUE_DELIVERY_PIPELINE_NAME",
]
