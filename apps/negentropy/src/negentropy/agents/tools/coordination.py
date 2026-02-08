"""
Coordination Tools - 协调工具

提供系部间协调的工具，支持流水线启动和状态管理。
遵循 AGENTS.md 的「反馈闭环」和「边界管理」原则。

参考文献:
[1] Google. "Agent Development Kit - Agent Coordination," _Google ADK Documentation_, 2025.
    https://google.github.io/adk-docs/
"""

from __future__ import annotations

from typing import Any

from google.adk.tools import ToolContext

from negentropy.agents.next_action import suggest_next_faculty
from negentropy.agents.state import (
    KNOWLEDGE_ACQUISITION_PIPELINE,
    PROBLEM_SOLVING_PIPELINE,
    VALUE_DELIVERY_PIPELINE,
)
from negentropy.agents.state_manager import (
    add_faculty_step,
    get_pipeline_summary,
    get_state,
    initialize_state,
    record_entropy_reduction,
    update_faculty_status,
)
from negentropy.logging import get_logger

logger = get_logger("negentropy.tools.coordination")


async def initiate_faculty_pipeline(
    pipeline_name: str,
    goal: str,
    tool_context: ToolContext,
    constraints: list[str] | None = None,
    success_criteria: list[str] | None = None,
) -> dict[str, Any]:
    """启动预定义的系部流水线

    根据流水线名称初始化相应的系部协调状态。

    Args:
        pipeline_name: 流水线名称
            - "KnowledgeAcquisitionPipeline": 知识获取流程
            - "ProblemSolvingPipeline": 问题解决流程
            - "ValueDeliveryPipeline": 价值交付流程
        goal: 任务目标
        constraints: 约束条件 (可选)
        success_criteria: 成功标准 (可选)

    Returns:
        流水线初始化结果
    """
    # 定义流水线配置
    pipeline_configs = {
        KNOWLEDGE_ACQUISITION_PIPELINE: {
            "description": "知识获取流程：感知 → 内化",
            "faculties": [
                {
                    "name": "PerceptionFaculty",
                    "purpose": "高信噪比的信息获取",
                    "description": "搜索和收集相关知识与资料",
                },
                {
                    "name": "InternalizationFaculty",
                    "purpose": "知识结构化与持久化",
                    "description": "将获取的信息整理并保存到知识库",
                },
            ],
        },
        PROBLEM_SOLVING_PIPELINE: {
            "description": "问题解决流程：感知 → 沉思 → 行动 → 内化",
            "faculties": [
                {
                    "name": "PerceptionFaculty",
                    "purpose": "理解问题上下文",
                    "description": "收集问题相关的所有信息",
                },
                {
                    "name": "ContemplationFaculty",
                    "purpose": "深度分析与方案规划",
                    "description": "分析问题根因并制定解决方案",
                },
                {
                    "name": "ActionFaculty",
                    "purpose": "精确执行解决方案",
                    "description": "实施修复或实现方案",
                },
                {
                    "name": "InternalizationFaculty",
                    "purpose": "沉淀经验教训",
                    "description": "记录问题和解决方案供未来参考",
                },
            ],
        },
        VALUE_DELIVERY_PIPELINE: {
            "description": "价值交付流程：感知 → 沉思 → 影响",
            "faculties": [
                {
                    "name": "PerceptionFaculty",
                    "purpose": "收集信息与数据",
                    "description": "收集交付内容所需的信息",
                },
                {
                    "name": "ContemplationFaculty",
                    "purpose": "提炼洞察与智慧",
                    "description": "综合信息并形成有价值的见解",
                },
                {
                    "name": "InfluenceFaculty",
                    "purpose": "清晰表达与传递价值",
                    "description": "将见解转化为清晰易懂的输出",
                },
            ],
        },
    }

    # 验证流水线名称
    if pipeline_name not in pipeline_configs:
        available = ", ".join(pipeline_configs.keys())
        return {
            "status": "failed",
            "error": f"未知的流水线名称: {pipeline_name}",
            "available_pipelines": available,
        }

    config = pipeline_configs[pipeline_name]

    # 初始化状态
    state = initialize_state(
        tool_context,
        goal=goal,
        constraints=constraints,
        success_criteria=success_criteria,
    )

    # 添加系部步骤
    for faculty_config in config["faculties"]:
        add_faculty_step(
            tool_context,
            faculty=faculty_config["name"],
            purpose=faculty_config["purpose"],
            input_schema={"description": faculty_config["description"]},
        )

    summary = get_pipeline_summary(tool_context)

    logger.info(
        "pipeline_initiated",
        pipeline=pipeline_name,
        goal=goal[:100],
        steps_count=len(config["faculties"]),
    )

    return {
        "status": "success",
        "pipeline": pipeline_name,
        "description": config["description"],
        "goal": goal,
        "steps_count": len(config["faculties"]),
        "faculties": [f["name"] for f in config["faculties"]],
        "summary": summary,
    }


async def record_faculty_output(
    faculty: str,
    output: dict,
    quality_score: float,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """记录系部输出用于反馈循环

    记录系部的执行结果和质量评分，用于后续反馈和精化。

    Args:
        faculty: 系部名称
        output: 输出结果
        quality_score: 质量评分 (0.0-1.0)
        tool_context: ADK 工具上下文

    Returns:
        记录结果
    """
    # 更新系部状态
    state = update_faculty_status(
        tool_context,
        faculty=faculty,
        status="completed" if quality_score > 0.5 else "failed",
        output=output,
    )

    if state is None:
        return {
            "status": "failed",
            "error": "无法获取或更新协调状态",
        }

    # 更新反馈状态
    state.feedback_loop.quality_score = quality_score
    if quality_score < 0.7:
        state.feedback_loop.needs_refinement = True
        state.feedback_loop.refinement_instructions = (
            f"系部 {faculty} 的输出质量评分为 {quality_score:.2f}，低于阈值 0.7。"
            f"建议进行精化以提高输出质量。"
        )

    # 保存状态
    from negentropy.agents.state_manager import save_state

    save_state(tool_context, state)

    logger.info(
        "faculty_output_recorded",
        faculty=faculty,
        quality_score=quality_score,
        needs_refinement=state.feedback_loop.needs_refinement,
    )

    return {
        "status": "success",
        "faculty": faculty,
        "quality_score": quality_score,
        "needs_refinement": state.feedback_loop.needs_refinement,
        "next_faculty": suggest_next_faculty(faculty, state.current_task.goal, tool_context),
    }


async def suggest_next_faculty_tool(
    current_faculty: str,
    task_goal: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """基于当前状态建议下一个系部

    在系部流水线执行过程中，智能建议下一个应该使用的系部。

    Args:
        current_faculty: 当前系部
        task_goal: 任务目标
        tool_context: ADK 工具上下文

    Returns:
        建议结果
    """
    next_faculty = await suggest_next_faculty(
        current_faculty=current_faculty,
        task_goal=task_goal,
        tool_context=tool_context,
    )

    if next_faculty is None:
        return {
            "status": "success",
            "current_faculty": current_faculty,
            "suggestion": None,
            "message": "当前流程已完成，无需进一步的系部协调",
        }

    # 获取流水线状态
    state = get_state(tool_context)
    next_step_info = None
    if state:
        for step in state.faculty_pipeline:
            if step.faculty == next_faculty:
                next_step_info = {
                    "faculty": step.faculty,
                    "purpose": step.purpose,
                    "status": step.status,
                }
                break

    return {
        "status": "success",
        "current_faculty": current_faculty,
        "suggestion": next_faculty,
        "next_step_info": next_step_info,
        "message": f"建议接下来使用 {next_faculty} 继续",
    }


async def calculate_entropy_reduction(
    before_state: dict,
    after_state: dict,
    tool_context: ToolContext,
    faculty: str = "unknown",
) -> dict[str, Any]:
    """计算熵减指标

    评估状态变化带来的熵减效果。

    Args:
        before_state: 处理前状态
        after_state: 处理后状态
        tool_context: ADK 工具上下文
        faculty: 执行的系部

    Returns:
        熵减度量结果
    """
    # 简化的熵计算（实际应用中可使用更复杂的算法）
    def calculate_entropy(state: dict) -> float:
        """基于状态的混乱程度计算熵"""
        if not state:
            return 1.0

        # 检查不确定性指标
        uncertainty_indicators = 0

        # 检查模糊关键词
        content = str(state.get("content", ""))
        ambiguous_words = ["可能", "或许", "应该", "大概", "maybe", "possibly"]
        uncertainty_indicators += sum(1 for word in ambiguous_words if word in content.lower())

        # 检查结构缺失
        if not any(marker in content for marker in ["#", "-", "*", "```"]):
            uncertainty_indicators += 1

        # 检查重复
        lines = content.split("\n")
        if len(lines) > len(set(lines)):
            uncertainty_indicators += 1

        # 归一化到 0-1 范围
        return min(1.0, uncertainty_indicators / 5.0)

    before_entropy = calculate_entropy(before_state)
    after_entropy = calculate_entropy(after_state)
    reduction = before_entropy - after_entropy

    # 记录熵减
    record_entropy_reduction(tool_context, faculty, before_entropy, after_entropy)

    logger.info(
        "entropy_reduction_calculated",
        faculty=faculty,
        before=before_entropy,
        after=after_entropy,
        reduction=reduction,
    )

    return {
        "status": "success",
        "faculty": faculty,
        "before_entropy": before_entropy,
        "after_entropy": after_entropy,
        "entropy_reduction": reduction,
        "reduction_percentage": (reduction / max(before_entropy, 0.01)) * 100,
        "assessment": (
            "显著熵减" if reduction > 0.3
            else "适度熵减" if reduction > 0.1
            else "熵减不明显" if reduction > 0
            else "熵增警告"
        ),
    }


__all__ = [
    "initiate_faculty_pipeline",
    "record_faculty_output",
    "suggest_next_faculty_tool",
    "calculate_entropy_reduction",
]
