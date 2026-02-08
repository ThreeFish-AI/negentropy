"""
Feedback Tools - 反馈工具

提供系部间反馈传递和质量评估的工具，实现反馈闭环机制。
遵循 AGENTS.md 的「反馈闭环」和「系统性完整性」原则。

参考文献:
[1] N. Wiener, "Cybernetics: Or Control and Communication in the Animal and the Machine,"
    _MIT Press_, 2nd ed., 1961. (关于反馈控制的经典著作)
"""

from __future__ import annotations

from typing import Any

from google.adk.tools import ToolContext

from negentropy.agents.schemas import calculate_output_quality, validate_faculty_output
from negentropy.agents.state_manager import (
    get_state,
    save_state,
    update_faculty_status,
)
from negentropy.logging import get_logger

logger = get_logger("negentropy.tools.feedback")


async def provide_feedback(
    from_faculty: str,
    to_faculty: str,
    feedback_content: dict[str, Any],
    tool_context: ToolContext,
) -> dict[str, Any]:
    """在系部间传递反馈

    实现系部间的反馈循环，允许一个系部向另一个系部提供反馈信息。

    Args:
        from_faculty: 反馈来源系部
        to_faculty: 反馈目标系部
        feedback_content: 反馈内容
        tool_context: ADK 工具上下文

    Returns:
        反馈传递结果
    """
    state = get_state(tool_context)
    if state is None:
        return {
            "status": "failed",
            "error": "无法获取协调状态",
        }

    # 记录反馈到状态
    feedback_record = {
        "from_faculty": from_faculty,
        "to_faculty": to_faculty,
        "content": feedback_content,
        "timestamp": _get_current_timestamp(),
    }

    # 将反馈添加到反馈状态中
    if "feedback_history" not in state.feedback_loop.output_summary:
        state.feedback_loop.output_summary["feedback_history"] = []

    state.feedback_loop.output_summary["feedback_history"].append(feedback_record)

    # 更新精化指令（如果反馈包含改进建议）
    if feedback_content.get("type") == "refinement":
        state.feedback_loop.needs_refinement = True
        state.feedback_loop.refinement_instructions = feedback_content.get(
            "instructions", "需要根据反馈进行精化"
        )

    save_state(tool_context, state)

    logger.info(
        "feedback_provided",
        from_faculty=from_faculty,
        to_faculty=to_faculty,
        feedback_type=feedback_content.get("type", "general"),
    )

    return {
        "status": "success",
        "from_faculty": from_faculty,
        "to_faculty": to_faculty,
        "feedback_id": f"{from_faculty}->{to_faculty}:{len(state.feedback_loop.output_summary.get('feedback_history', []))}",
        "message": f"反馈已从 {from_faculty} 传递到 {to_faculty}",
    }


async def assess_output_quality(
    faculty: str,
    output: dict[str, Any],
    expected_schema: dict[str, Any] | None = None,
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """评估系部输出质量

    基于内容完整性和准确性评估系部输出质量。

    Args:
        faculty: 系部名称
        output: 输出内容
        expected_schema: 期望的模式 (可选)
        tool_context: ADK 工具上下文 (可选)

    Returns:
        质量评估结果
    """
    # 验证基本格式
    is_valid = validate_faculty_output(output, faculty)

    if not is_valid:
        return {
            "status": "failed",
            "faculty": faculty,
            "valid": False,
            "error": "输出格式不符合要求",
        }

    # 计算质量指标
    quality = calculate_output_quality(output)

    # 如果提供了期望模式，进行额外验证
    schema_validation = {"passed": True, "details": []}
    if expected_schema:
        required_fields = expected_schema.get("required", [])
        missing_fields = [
            field for field in required_fields if field not in output
        ]
        if missing_fields:
            schema_validation["passed"] = False
            schema_validation["details"].append(
                f"缺少必需字段: {', '.join(missing_fields)}"
            )

    # 更新系部状态（如果提供了 tool_context）
    if tool_context:
        await record_faculty_output(
            faculty=faculty,
            output=output,
            quality_score=quality.overall_score(),
            tool_context=tool_context,
        )

    logger.info(
        "output_quality_assessed",
        faculty=faculty,
        overall_score=quality.overall_score(),
        is_valid=is_valid,
    )

    return {
        "status": "success",
        "faculty": faculty,
        "valid": is_valid,
        "quality_metrics": quality.to_dict(),
        "schema_validation": schema_validation,
        "assessment": (
            "优秀" if quality.overall_score() > 0.8
            else "良好" if quality.overall_score() > 0.6
            else "需要改进" if quality.overall_score() > 0.4
            else "不合格"
        ),
    }


async def trigger_refinement(
    faculty: str,
    refinement_instructions: str,
    tool_context: ToolContext,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """触发系部输出精化

    当输出质量不满足要求时，触发精化流程。

    Args:
        faculty: 需要精化的系部
        refinement_instructions: 精化指令
        tool_context: ADK 工具上下文
        context: 额外上下文信息 (可选)

    Returns:
        精化请求结果
    """
    state = get_state(tool_context)
    if state is None:
        return {
            "status": "failed",
            "error": "无法获取协调状态",
        }

    # 更新反馈状态
    state.feedback_loop.needs_refinement = True
    state.feedback_loop.refinement_instructions = refinement_instructions

    # 查找对应的系部步骤
    target_step = None
    for step in state.faculty_pipeline:
        if step.faculty == faculty:
            step.status = "pending"  # 重置为待处理状态
            target_step = step
            break

    save_state(tool_context, state)

    if target_step is None:
        logger.warning(
            "refinement_triggered_faculty_not_found",
            faculty=faculty,
        )
    else:
        logger.info(
            "refinement_triggered",
            faculty=faculty,
            instructions=refinement_instructions[:100],
        )

    return {
        "status": "success",
        "faculty": faculty,
        "refinement_requested": True,
        "instructions": refinement_instructions,
        "context_provided": context is not None,
        "message": f"已触发 {faculty} 的输出精化流程",
    }


async def provide_quality_feedback(
    output: dict[str, Any],
    faculty: str,
    quality_threshold: float = 0.7,
    tool_context: ToolContext | None = None,
) -> dict[str, Any]:
    """提供质量反馈

    评估输出质量并自动生成反馈。

    Args:
        output: 要评估的输出
        faculty: 系部名称
        quality_threshold: 质量阈值
        tool_context: ADK 工具上下文 (可选)

    Returns:
        质量反馈结果
    """
    assessment = await assess_output_quality(
        faculty=faculty,
        output=output,
        tool_context=tool_context,
    )

    overall_score = assessment.get("quality_metrics", {}).get("overall_score", 0.0)
    needs_refinement = overall_score < quality_threshold

    feedback = {
        "type": "quality_assessment",
        "faculty": faculty,
        "overall_score": overall_score,
        "meets_threshold": not needs_refinement,
        "threshold": quality_threshold,
    }

    if needs_refinement:
        feedback["recommendations"] = [
            "提高输出完整性",
            "增强内容准确性",
            "改善表达清晰度",
        ]

        # 如果提供了 tool_context，自动触发精化
        if tool_context:
            await trigger_refinement(
                faculty=faculty,
                refinement_instructions=(
                    f"输出质量评分为 {overall_score:.2f}，"
                    f"低于阈值 {quality_threshold}。请根据以下建议改进输出："
                    f"{feedback['recommendations']}"
                ),
                tool_context=tool_context,
            )

    logger.info(
        "quality_feedback_provided",
        faculty=faculty,
        score=overall_score,
        needs_refinement=needs_refinement,
    )

    return {
        "status": "success",
        "feedback": feedback,
        "assessment": assessment,
    }


def _get_current_timestamp() -> str:
    """获取当前时间戳 (ISO 格式)"""
    import datetime

    return datetime.datetime.now(datetime.timezone.utc).isoformat()


__all__ = [
    "provide_feedback",
    "assess_output_quality",
    "trigger_refinement",
    "provide_quality_feedback",
]
