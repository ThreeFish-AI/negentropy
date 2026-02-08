"""
Faculty State Manager - 系部状态管理器

提供集中式的状态管理功能，遵循 AGENTS.md 的「单一事实源」和「边界管理」原则。
通过结构化的访问模式维护系部间的一致性，防止状态熵增。

参考文献:
[1] Google. "Agent Development Kit - ToolContext," _Google ADK Documentation_, 2025.
    https://google.github.io/adk-docs/
"""

from __future__ import annotations

import datetime
from typing import Any

from google.adk.tools import ToolContext

from negentropy.agents.state import (
    ALL_FACULTIES,
    ALL_PIPELINES,
    EntropyTracking,
    FeedbackState,
    FacultySessionState,
    FacultyStep,
    NextAction,
    TaskContext,
)
from negentropy.logging import get_logger

logger = get_logger("negentropy.agents.state_manager")


# State keys for tool_context.state
FACULTY_COORDINATION_KEY = "faculty_coordination"
CURRENT_TASK_KEY = "current_task"
FACULTY_PIPELINE_KEY = "faculty_pipeline"
FEEDBACK_LOOP_KEY = "feedback_loop"
NEXT_ACTIONS_KEY = "next_actions"
ENTROPY_METRICS_KEY = "entropy_metrics"
ENTROPY_INITIAL_KEY = "initial_entropy"
ENTROPY_CURRENT_KEY = "current_entropy"
ENTROPY_HISTORY_KEY = "reduction_history"
ENTROPY_TOTAL_REDUCTION_KEY = "total_reduction"


def _get_current_timestamp() -> str:
    """获取当前时间戳 (ISO 格式)"""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def initialize_state(
    tool_context: ToolContext,
    goal: str,
    constraints: list[str] | None = None,
    success_criteria: list[str] | None = None,
) -> FacultySessionState:
    """初始化系部协调状态

    在 tool_context.state 中创建初始的协调状态。
    遵循「单一事实源」原则，确保状态的一致性。

    Args:
        tool_context: ADK 工具上下文
        goal: 任务目标
        constraints: 约束条件 (可选)
        success_criteria: 成功标准 (可选)

    Returns:
        初始化的系部会话状态
    """
    state = FacultySessionState(
        current_task=TaskContext(
            goal=goal,
            constraints=constraints or [],
            success_criteria=success_criteria or [],
        ),
        faculty_pipeline=[],
        feedback_loop=FeedbackState(),
        next_actions=[],
        entropy_metrics=EntropyTracking(),
    )

    # 将状态写入 tool_context.state
    if tool_context and hasattr(tool_context, "state"):
        tool_context.state.update(state.to_state_dict())
        logger.info(
            "state_initialized",
            goal=goal[:100],
            constraints_count=len(constraints or []),
        )

    return state


def get_state(tool_context: ToolContext) -> FacultySessionState | None:
    """获取当前系部协调状态

    从 tool_context.state 中读取协调状态。

    Args:
        tool_context: ADK 工具上下文

    Returns:
        当前系部会话状态，如果不存在则返回 None
    """
    if not tool_context or not hasattr(tool_context, "state"):
        logger.warning("state_not_available", reason="no_state_attribute")
        return None

    state_dict = tool_context.state
    if FACULTY_COORDINATION_KEY not in state_dict:
        logger.warning("state_not_initialized", key=FACULTY_COORDINATION_KEY)
        return None

    try:
        return FacultySessionState.from_state_dict(state_dict)
    except Exception as exc:
        logger.error("state_parse_failed", exc_info=exc)
        return None


def save_state(tool_context: ToolContext, state: FacultySessionState) -> None:
    """保存系部协调状态

    将更新后的状态写入 tool_context.state。

    Args:
        tool_context: ADK 工具上下文
        state: 要保存的系部会话状态
    """
    if not tool_context or not hasattr(tool_context, "state"):
        logger.warning("state_save_failed", reason="no_state_attribute")
        return

    try:
        tool_context.state.update(state.to_state_dict())
        logger.debug("state_saved")
    except Exception as exc:
        logger.error("state_save_failed", exc_info=exc)


def update_faculty_status(
    tool_context: ToolContext,
    faculty: str,
    status: str,
    output: dict[str, Any] | None = None,
) -> FacultySessionState | None:
    """更新系部状态

    更新指定系部的执行状态和输出。

    Args:
        tool_context: ADK 工具上下文
        faculty: 系部名称
        status: 新状态 ("pending" | "in_progress" | "completed" | "failed")
        output: 系部输出 (可选)

    Returns:
        更新后的系部会话状态，如果状态不可用则返回 None
    """
    state = get_state(tool_context)
    if state is None:
        logger.warning("faculty_status_update_failed", reason="state_not_available")
        return None

    # 查找并更新对应的系部步骤
    for step in state.faculty_pipeline:
        if step.faculty == faculty:
            step.status = status
            if output is not None:
                step.output = output
            logger.info(
                "faculty_status_updated",
                faculty=faculty,
                status=status,
                has_output=output is not None,
            )
            break
    else:
        logger.warning(
            "faculty_not_found_in_pipeline",
            faculty=faculty,
            pipeline_length=len(state.faculty_pipeline),
        )

    # 更新反馈状态
    if status in ("completed", "failed"):
        state.feedback_loop.last_faculty = faculty
        if output:
            state.feedback_loop.output_summary = {
                "faculty": faculty,
                "status": status,
                "output_keys": list(output.keys()) if isinstance(output, dict) else [],
            }

    save_state(tool_context, state)
    return state


def get_next_faculty(tool_context: ToolContext) -> str | None:
    """获取下一个待执行的系部

    根据当前流水线状态，返回下一个需要执行的系部。

    Args:
        tool_context: ADK 工具上下文

    Returns:
        下一个系部名称，如果没有待执行系部则返回 None
    """
    state = get_state(tool_context)
    if state is None:
        return None

    for step in state.faculty_pipeline:
        if step.status == "pending":
            return step.faculty

    return None


def add_faculty_step(
    tool_context: ToolContext,
    faculty: str,
    purpose: str,
    input_schema: dict[str, Any] | None = None,
    output_schema: dict[str, Any] | None = None,
) -> FacultySessionState | None:
    """添加系部步骤到流水线

    将新的系部步骤添加到当前流水线。

    Args:
        tool_context: ADK 工具上下文
        faculty: 系部名称
        purpose: 步骤目的
        input_schema: 输入模式 (可选)
        output_schema: 输出模式 (可选)

    Returns:
        更新后的系部会话状态，如果状态不可用则返回 None
    """
    state = get_state(tool_context)
    if state is None:
        # 如果状态不存在，先初始化
        state = initialize_state(tool_context, goal="")

    step = FacultyStep(
        faculty=faculty,
        purpose=purpose,
        input_schema=input_schema or {},
        output_schema=output_schema or {},
        status="pending",
    )

    state.faculty_pipeline.append(step)
    save_state(tool_context, state)

    logger.info(
        "faculty_step_added",
        faculty=faculty,
        purpose=purpose[:50],
        pipeline_position=len(state.faculty_pipeline),
    )

    return state


def record_entropy_reduction(
    tool_context: ToolContext,
    faculty: str,
    before_entropy: float,
    after_entropy: float,
) -> FacultySessionState | None:
    """记录熵减事件

    记录系部执行导致的熵减。

    Args:
        tool_context: ADK 工具上下文
        faculty: 系部名称
        before_entropy: 处理前熵值
        after_entropy: 处理后熵值

    Returns:
        更新后的系部会话状态，如果状态不可用则返回 None
    """
    state = get_state(tool_context)
    if state is None:
        logger.warning("entropy_reduction_record_failed", reason="state_not_available")
        return None

    timestamp = _get_current_timestamp()
    state.entropy_metrics.record_reduction(faculty, before_entropy, after_entropy, timestamp)

    save_state(tool_context, state)

    logger.info(
        "entropy_reduction_recorded",
        faculty=faculty,
        before=before_entropy,
        after=after_entropy,
        reduction=before_entropy - after_entropy,
        total=state.entropy_metrics.total_reduction(),
    )

    return state


def add_next_action(
    tool_context: ToolContext,
    action: str,
    faculty: str | None,
    rationale: str,
    priority: int = 5,
    estimated_entropy_reduction: float = 0.0,
) -> FacultySessionState | None:
    """添加下一步行动建议

    实现「主动导航」原则，为用户提供下一步行动建议。

    Args:
        tool_context: ADK 工具上下文
        action: 行动描述
        faculty: 目标系部 (可选)
        rationale: 行动理由
        priority: 优先级 (1-10, 1为最高)
        estimated_entropy_reduction: 预估熵减效果 (0.0-1.0)

    Returns:
        更新后的系部会话状态，如果状态不可用则返回 None
    """
    state = get_state(tool_context)
    if state is None:
        state = initialize_state(tool_context, goal="")

    next_action = NextAction(
        action=action,
        faculty=faculty,
        rationale=rationale,
        priority=priority,
        estimated_entropy_reduction=estimated_entropy_reduction,
    )

    state.next_actions.append(next_action)

    # 按优先级排序
    state.next_actions.sort(key=lambda x: x.priority)

    save_state(tool_context, state)

    logger.info(
        "next_action_added",
        action=action[:50],
        faculty=faculty,
        priority=priority,
    )

    return state


def get_next_actions(tool_context: ToolContext, limit: int = 5) -> list[NextAction]:
    """获取下一步行动建议

    返回当前优先级最高的行动建议。

    Args:
        tool_context: ADK 工具上下文
        limit: 返回数量限制

    Returns:
        行动建议列表
    """
    state = get_state(tool_context)
    if state is None:
        return []

    return state.next_actions[:limit]


def clear_next_actions(tool_context: ToolContext) -> FacultySessionState | None:
    """清除下一步行动建议

    清空当前的行动建议列表。

    Args:
        tool_context: ADK 工具上下文

    Returns:
        更新后的系部会话状态，如果状态不可用则返回 None
    """
    state = get_state(tool_context)
    if state is None:
        return None

    state.next_actions.clear()
    save_state(tool_context, state)

    logger.info("next_actions_cleared")

    return state


def update_task_completion(
    tool_context: ToolContext,
    completion_percentage: float,
) -> FacultySessionState | None:
    """更新任务完成度

    更新当前任务的完成百分比。

    Args:
        tool_context: ADK 工具上下文
        completion_percentage: 完成百分比 (0.0-1.0)

    Returns:
        更新后的系部会话状态，如果状态不可用则返回 None
    """
    state = get_state(tool_context)
    if state is None:
        return None

    state.current_task.completion_percentage = max(0.0, min(1.0, completion_percentage))
    save_state(tool_context, state)

    logger.info(
        "task_completion_updated",
        completion=state.current_task.completion_percentage,
    )

    return state


def get_pipeline_summary(tool_context: ToolContext) -> dict[str, Any]:
    """获取流水线摘要

    返回当前流水线的摘要信息，用于调试和监控。

    Args:
        tool_context: ADK 工具上下文

    Returns:
        流水线摘要字典
    """
    state = get_state(tool_context)
    if state is None:
        return {
            "status": "not_initialized",
            "pipeline_length": 0,
            "completed_count": 0,
            "pending_count": 0,
        }

    completed = sum(1 for step in state.faculty_pipeline if step.status == "completed")
    pending = sum(1 for step in state.faculty_pipeline if step.status == "pending")
    in_progress = sum(1 for step in state.faculty_pipeline if step.status == "in_progress")
    failed = sum(1 for step in state.faculty_pipeline if step.status == "failed")

    return {
        "status": "active",
        "pipeline_length": len(state.faculty_pipeline),
        "completed_count": completed,
        "pending_count": pending,
        "in_progress_count": in_progress,
        "failed_count": failed,
        "task_completion": state.current_task.completion_percentage,
        "total_entropy_reduction": state.entropy_metrics.total_reduction(),
        "next_actions_count": len(state.next_actions),
    }


__all__ = [
    "initialize_state",
    "get_state",
    "save_state",
    "update_faculty_status",
    "get_next_faculty",
    "add_faculty_step",
    "record_entropy_reduction",
    "add_next_action",
    "get_next_actions",
    "clear_next_actions",
    "update_task_completion",
    "get_pipeline_summary",
    "FACULTY_COORDINATION_KEY",
    "ALL_FACULTIES",
    "ALL_PIPELINES",
]
