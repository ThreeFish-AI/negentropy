"""
Faculty Coordination State Schemas - 系部协调状态模式

定义结构化的状态模式用于系部间协调，遵循 AGENTS.md 的「单一事实源」原则。
这些模式用于在 tool_context.state 中存储协调状态，确保系部间的一致性。

参考文献:
[1] Google. "Agent Development Kit - ToolContext," _Google ADK Documentation_, 2025.
    https://google.github.io/adk-docs/
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class TaskContext:
    """任务上下文

    存储当前任务的元信息，包括目标、约束和成功标准。
    用于跟踪任务进展和评估完成度。

    Attributes:
        goal: 任务目标描述
        constraints: 约束条件列表
        success_criteria: 成功标准列表
        completion_percentage: 完成百分比 (0.0-1.0)
    """

    goal: str
    constraints: list[str] = field(default_factory=list)
    success_criteria: list[str] = field(default_factory=list)
    completion_percentage: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式用于 state 存储"""
        return {
            "goal": self.goal,
            "constraints": self.constraints,
            "success_criteria": self.success_criteria,
            "completion_percentage": self.completion_percentage,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TaskContext":
        """从字典恢复实例"""
        return cls(
            goal=data.get("goal", ""),
            constraints=data.get("constraints", []),
            success_criteria=data.get("success_criteria", []),
            completion_percentage=data.get("completion_percentage", 0.0),
        )


@dataclass
class FacultyStep:
    """系部步骤

    定义流水线中的单个系部步骤，包含输入输出模式和状态。

    Attributes:
        faculty: 系部名称 (如 "PerceptionFaculty")
        purpose: 步骤目的描述
        input_schema: 输入模式
        output_schema: 输出模式
        status: 步骤状态
        output: 步骤输出 (可选)
    """

    faculty: str
    purpose: str
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    status: Literal["pending", "in_progress", "completed", "failed"] = "pending"
    output: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式用于 state 存储"""
        return {
            "faculty": self.faculty,
            "purpose": self.purpose,
            "input_schema": self.input_schema,
            "output_schema": self.output_schema,
            "status": self.status,
            "output": self.output,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FacultyStep":
        """从字典恢复实例"""
        return cls(
            faculty=data.get("faculty", ""),
            purpose=data.get("purpose", ""),
            input_schema=data.get("input_schema", {}),
            output_schema=data.get("output_schema", {}),
            status=data.get("status", "pending"),
            output=data.get("output"),
        )


@dataclass
class QualityMetrics:
    """质量指标

    用于评估系部输出的质量，支持熵减度量。

    Attributes:
        completeness: 完整性评分 (0.0-1.0)
        accuracy: 准确性评分 (0.0-1.0)
        clarity: 清晰度评分 (0.0-1.0)
        entropy_score: 熵评分 (越低越好)
    """

    completeness: float = 0.0
    accuracy: float = 0.0
    clarity: float = 0.0
    entropy_score: float = 1.0

    def overall_score(self) -> float:
        """计算总体质量评分"""
        return (self.completeness * 0.4 + self.accuracy * 0.4 + self.clarity * 0.2) / (
            1.0 + self.entropy_score * 0.1
        )

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式用于 state 存储"""
        return {
            "completeness": self.completeness,
            "accuracy": self.accuracy,
            "clarity": self.clarity,
            "entropy_score": self.entropy_score,
            "overall_score": self.overall_score(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "QualityMetrics":
        """从字典恢复实例"""
        return cls(
            completeness=data.get("completeness", 0.0),
            accuracy=data.get("accuracy", 0.0),
            clarity=data.get("clarity", 0.0),
            entropy_score=data.get("entropy_score", 1.0),
        )


@dataclass
class FeedbackState:
    """反馈状态

    用于在系部间传递反馈信息，实现反馈闭环。

    Attributes:
        last_faculty: 上一个执行的系部
        output_summary: 输出摘要
        quality_score: 质量评分
        needs_refinement: 是否需要精化
        refinement_instructions: 精化指令
    """

    last_faculty: str | None = None
    output_summary: dict[str, Any] = field(default_factory=dict)
    quality_score: float = 0.0
    needs_refinement: bool = False
    refinement_instructions: str = ""

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式用于 state 存储"""
        return {
            "last_faculty": self.last_faculty,
            "output_summary": self.output_summary,
            "quality_score": self.quality_score,
            "needs_refinement": self.needs_refinement,
            "refinement_instructions": self.refinement_instructions,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FeedbackState":
        """从字典恢复实例"""
        return cls(
            last_faculty=data.get("last_faculty"),
            output_summary=data.get("output_summary", {}),
            quality_score=data.get("quality_score", 0.0),
            needs_refinement=data.get("needs_refinement", False),
            refinement_instructions=data.get("refinement_instructions", ""),
        )


@dataclass
class NextAction:
    """下一步行动建议

    实现「主动导航」原则，为用户提供下一步最佳行动建议。

    Attributes:
        action: 行动描述
        faculty: 目标系部 (可选)
        rationale: 行动理由
        priority: 优先级 (1-10, 1为最高)
        estimated_entropy_reduction: 预估熵减效果 (0.0-1.0)
    """

    action: str
    faculty: str | None
    rationale: str
    priority: int
    estimated_entropy_reduction: float

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式用于 state 存储"""
        return {
            "action": self.action,
            "faculty": self.faculty,
            "rationale": self.rationale,
            "priority": self.priority,
            "estimated_entropy_reduction": self.estimated_entropy_reduction,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "NextAction":
        """从字典恢复实例"""
        return cls(
            action=data.get("action", ""),
            faculty=data.get("faculty"),
            rationale=data.get("rationale", ""),
            priority=data.get("priority", 5),
            estimated_entropy_reduction=data.get("estimated_entropy_reduction", 0.0),
        )


@dataclass
class EntropyTracking:
    """熵减追踪

    跟踪系统的熵减度量，用于评估系统改进效果。

    Attributes:
        initial_entropy: 初始熵值
        current_entropy: 当前熵值
        reduction_history: 熵减历史记录
    """

    initial_entropy: float = 1.0
    current_entropy: float = 1.0
    reduction_history: list[dict[str, Any]] = field(default_factory=list)

    def record_reduction(
        self, faculty: str, before: float, after: float, timestamp: str
    ) -> None:
        """记录一次熵减事件"""
        reduction = before - after
        self.reduction_history.append(
            {
                "faculty": faculty,
                "before": before,
                "after": after,
                "reduction": reduction,
                "timestamp": timestamp,
            }
        )
        self.current_entropy = after

    def total_reduction(self) -> float:
        """计算总熵减量"""
        return self.initial_entropy - self.current_entropy

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式用于 state 存储"""
        return {
            "initial_entropy": self.initial_entropy,
            "current_entropy": self.current_entropy,
            "total_reduction": self.total_reduction(),
            "reduction_history": self.reduction_history,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "EntropyTracking":
        """从字典恢复实例"""
        return cls(
            initial_entropy=data.get("initial_entropy", 1.0),
            current_entropy=data.get("current_entropy", 1.0),
            reduction_history=data.get("reduction_history", []),
        )


@dataclass
class FacultySessionState:
    """系部协调会话状态

    系部协调的主状态容器，遵循「单一事实源」原则。
    所有系部通过此状态共享信息，确保协调一致性。

    Attributes:
        current_task: 当前任务上下文
        faculty_pipeline: 系部流水线步骤
        feedback_loop: 反馈状态
        next_actions: 下一步行动建议列表
        entropy_metrics: 熵减追踪
    """

    current_task: TaskContext = field(default_factory=lambda: TaskContext(goal=""))
    faculty_pipeline: list[FacultyStep] = field(default_factory=list)
    feedback_loop: FeedbackState = field(default_factory=FeedbackState)
    next_actions: list[NextAction] = field(default_factory=list)
    entropy_metrics: EntropyTracking = field(default_factory=EntropyTracking)

    def to_state_dict(self) -> dict[str, Any]:
        """转换为 state 存储格式

        返回适合存储在 tool_context.state 中的字典格式。
        """
        return {
            "faculty_coordination": {
                "current_task": self.current_task.to_dict(),
                "faculty_pipeline": [step.to_dict() for step in self.faculty_pipeline],
                "feedback_loop": self.feedback_loop.to_dict(),
                "next_actions": [action.to_dict() for action in self.next_actions],
                "entropy_metrics": self.entropy_metrics.to_dict(),
            }
        }

    @classmethod
    def from_state_dict(cls, state: dict[str, Any]) -> "FacultySessionState":
        """从 state 恢复实例

        从 tool_context.state 中恢复协调状态。
        """
        coordination = state.get("faculty_coordination", {})
        current_task_data = coordination.get("current_task", {})
        pipeline_data = coordination.get("faculty_pipeline", [])
        feedback_data = coordination.get("feedback_loop", {})
        actions_data = coordination.get("next_actions", [])
        entropy_data = coordination.get("entropy_metrics", {})

        return cls(
            current_task=TaskContext.from_dict(current_task_data),
            faculty_pipeline=[FacultyStep.from_dict(step) for step in pipeline_data],
            feedback_loop=FeedbackState.from_dict(feedback_data),
            next_actions=[NextAction.from_dict(action) for action in actions_data],
            entropy_metrics=EntropyTracking.from_dict(entropy_data),
        )


# 预定义的系部名称常量
PERCEPTION_FACULTY = "PerceptionFaculty"
INTERNALIZATION_FACULTY = "InternalizationFaculty"
CONTEMPLATION_FACULTY = "ContemplationFaculty"
ACTION_FACULTY = "ActionFaculty"
INFLUENCE_FACULTY = "InfluenceFaculty"

# 预定义的流水线名称常量
KNOWLEDGE_ACQUISITION_PIPELINE = "KnowledgeAcquisitionPipeline"
PROBLEM_SOLVING_PIPELINE = "ProblemSolvingPipeline"
VALUE_DELIVERY_PIPELINE = "ValueDeliveryPipeline"

ALL_FACULTIES = [
    PERCEPTION_FACULTY,
    INTERNALIZATION_FACULTY,
    CONTEMPLATION_FACULTY,
    ACTION_FACULTY,
    INFLUENCE_FACULTY,
]

ALL_PIPELINES = [
    KNOWLEDGE_ACQUISITION_PIPELINE,
    PROBLEM_SOLVING_PIPELINE,
    VALUE_DELIVERY_PIPELINE,
]

__all__ = [
    "TaskContext",
    "FacultyStep",
    "QualityMetrics",
    "FeedbackState",
    "NextAction",
    "EntropyTracking",
    "FacultySessionState",
    "PERCEPTION_FACULTY",
    "INTERNALIZATION_FACULTY",
    "CONTEMPLATION_FACULTY",
    "ACTION_FACULTY",
    "INFLUENCE_FACULTY",
    "KNOWLEDGE_ACQUISITION_PIPELINE",
    "PROBLEM_SOLVING_PIPELINE",
    "VALUE_DELIVERY_PIPELINE",
    "ALL_FACULTIES",
    "ALL_PIPELINES",
]
