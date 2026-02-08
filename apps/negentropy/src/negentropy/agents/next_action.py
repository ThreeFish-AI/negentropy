"""
Next Action Engine - 下一步行动引擎

实现「主动导航」原则，基于上下文智能生成下一步最佳行动建议。
这减少了用户的决策熵，提供清晰的行动路径。

参考文献:
[1] N. Negroponte, "Being Digital," _Alfred A. Knopf_, 1995.
    (关于主动导航和减少用户决策负担的早期讨论)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from google.adk.tools import ToolContext

from negentropy.agents.state import (
    ACTION_FACULTY,
    CONTEMPLATION_FACULTY,
    INFLUENCE_FACULTY,
    INTERNALIZATION_FACULTY,
    PERCEPTION_FACULTY,
)
from negentropy.agents.state_manager import (
    add_next_action,
    get_state,
)
from negentropy.logging import get_logger

logger = get_logger("negentropy.agents.next_action")


@dataclass
class ActionSuggestion:
    """行动建议

    表示单个下一步行动建议。

    Attributes:
        action: 行动描述
        faculty: 目标系部（如果适用）
        rationale: 行动理由
        priority: 优先级 (1-10, 1为最高)
        estimated_entropy_reduction: 预估熵减效果 (0.0-1.0)
    """

    action: str
    faculty: str | None
    rationale: str
    priority: int
    estimated_entropy_reduction: float


def _assess_goal_completion(user_goal: str, completed_tasks: list[str]) -> float:
    """评估目标完成度

    基于用户目标和已完成任务评估完成百分比。

    Args:
        user_goal: 用户目标
        completed_tasks: 已完成任务列表

    Returns:
        完成度 (0.0-1.0)
    """
    if not user_goal:
        return 0.0

    # 简单启发式：根据关键词匹配
    goal_lower = user_goal.lower()

    # 检查关键动词
    completion_indicators = {
        "完成": ["完成", "结束", "达成"],
        "创建": ["创建", "生成", "建立"],
        "修复": ["修复", "解决", "修正"],
        "分析": ["分析", "理解", "研究"],
        "优化": ["优化", "改进", "提升"],
    }

    for indicator, keywords in completion_indicators.items():
        if any(kw in goal_lower for kw in keywords):
            # 检查已完成任务中是否包含对应关键词
            for task in completed_tasks:
                task_lower = task.lower()
                if any(kw in task_lower for kw in keywords):
                    return 0.8  # 高完成度

    return 0.0  # 默认未完成


def _identify_next_critical_step(
    user_goal: str, completed_tasks: list[str]
) -> dict[str, Any]:
    """识别下一个关键步骤

    基于目标和已完成任务，推断下一个关键步骤。

    Args:
        user_goal: 用户目标
        completed_tasks: 已完成任务列表

    Returns:
        包含 action, faculty, rationale 的字典
    """
    goal_lower = user_goal.lower()

    # 根据目标类型推断下一步
    if any(word in goal_lower for word in ["学习", "研究", "了解", "查找"]):
        if not any("搜索" in t or "查找" in t for t in completed_tasks):
            return {
                "action": "搜索相关文档和资料",
                "faculty": PERCEPTION_FACULTY,
                "rationale": "需要先收集基础信息才能深入理解",
            }
        else:
            return {
                "action": "将关键信息保存到知识库",
                "faculty": INTERNALIZATION_FACULTY,
                "rationale": "收集的信息应该结构化保存以便后续复用",
            }

    elif any(word in goal_lower for word in ["实现", "开发", "创建", "编写"]):
        if not any("规划" in t or "设计" in t for t in completed_tasks):
            return {
                "action": "制定详细的实现计划",
                "faculty": CONTEMPLATION_FACULTY,
                "rationale": "实现前需要清晰的方案设计",
            }
        else:
            return {
                "action": "开始执行实现",
                "faculty": ACTION_FACULTY,
                "rationale": "规划完成后即可开始编码实现",
            }

    elif any(word in goal_lower for word in ["修复", "解决", "调试"]):
        if not any("分析" in t or "诊断" in t for t in completed_tasks):
            return {
                "action": "分析问题根因",
                "faculty": CONTEMPLATION_FACULTY,
                "rationale": "修复前需要找到问题根源",
            }
        else:
            return {
                "action": "实施修复方案",
                "faculty": ACTION_FACULTY,
                "rationale": "根因分析完成后可以实施修复",
            }

    elif any(word in goal_lower for word in ["优化", "改进", "重构"]):
        return {
            "action": "分析当前状态并制定优化方案",
            "faculty": CONTEMPLATION_FACULTY,
            "rationale": "优化需要基于对现状的深度理解",
        }

    elif any(word in goal_lower for word in ["文档", "报告", "说明"]):
        return {
            "action": "收集必要信息并规划文档结构",
            "faculty": PERCEPTION_FACULTY,
            "rationale": "文档需要基于准确的信息和清晰的结构",
        }

    # 默认建议
    return {
        "action": "继续当前任务的下一步",
        "faculty": None,
        "rationale": "根据上下文继续推进",
    }


def _has_insights_worthy_of_capture(current_context: dict) -> bool:
    """检查是否有值得捕获的洞察

    Args:
        current_context: 当前上下文

    Returns:
        是否有高价值洞察
    """
    # 检查上下文中的关键内容
    content = current_context.get("content", "")
    if not content:
        return False

    # 简单启发式：检查是否包含原创性内容
    insight_indicators = [
        "发现",
        "洞察",
        "重要",
        "关键",
        "建议",
        "结论",
        "总结",
    ]

    return any(indicator in content for indicator in insight_indicators)


def _has_uncertain_outputs(current_context: dict) -> bool:
    """检查是否有不确定的输出

    Args:
        current_context: 当前上下文

    Returns:
        是否存在不确定性
    """
    # 检查质量指标
    quality = current_context.get("quality_indicators", {})
    accuracy = quality.get("accuracy", 1.0)

    return accuracy < 0.8


async def generate_next_actions(
    current_context: dict,
    completed_tasks: list[str],
    user_goal: str,
    tool_context: ToolContext,
    max_suggestions: int = 5,
) -> list[ActionSuggestion]:
    """生成下一步最佳行动建议

    基于当前状态、已完成任务和用户目标，智能推荐下一步行动。
    遵循 AGENTS.md 的「主动导航」原则。

    Args:
        current_context: 当前上下文状态
        completed_tasks: 已完成的任务列表
        user_goal: 用户目标
        tool_context: ADK 工具上下文
        max_suggestions: 最大建议数量

    Returns:
        按优先级排序的行动建议列表
    """
    suggestions = []
    priority_counter = 1

    # 1. 评估目标完成度
    goal_completion = _assess_goal_completion(user_goal, completed_tasks)

    if goal_completion < 1.0 and user_goal:
        # 建议继续工作
        next_step = _identify_next_critical_step(user_goal, completed_tasks)
        suggestions.append(
            ActionSuggestion(
                action=next_step["action"],
                faculty=next_step["faculty"],
                rationale=next_step["rationale"],
                priority=priority_counter,
                estimated_entropy_reduction=0.3,
            )
        )
        priority_counter += 1

    # 2. 建议知识捕获
    if _has_insights_worthy_of_capture(current_context):
        suggestions.append(
            ActionSuggestion(
                action="将关键洞察保存到知识库",
                faculty=INTERNALIZATION_FACULTY,
                rationale="当前会话产生了高价值洞察，应持久化以供未来复用",
                priority=priority_counter,
                estimated_entropy_reduction=0.5,
            )
        )
        priority_counter += 1

    # 3. 建议验证
    if _has_uncertain_outputs(current_context):
        suggestions.append(
            ActionSuggestion(
                action="验证关键输出的准确性",
                faculty=CONTEMPLATION_FACULTY,
                rationale="部分输出存在不确定性，建议进行二次验证",
                priority=priority_counter,
                estimated_entropy_reduction=0.2,
            )
        )
        priority_counter += 1

    # 4. 建议反思（对于复杂任务）
    if len(completed_tasks) >= 3:
        suggestions.append(
            ActionSuggestion(
                action="回顾已完成的工作并总结经验教训",
                faculty=CONTEMPLATION_FACULTY,
                rationale="已完成多个步骤，适合进行阶段性回顾和总结",
                priority=priority_counter,
                estimated_entropy_reduction=0.4,
            )
        )
        priority_counter += 1

    # 5. 建议输出（如果工作接近完成）
    if goal_completion > 0.7:
        suggestions.append(
            ActionSuggestion(
                action="准备最终输出或报告",
                faculty=INFLUENCE_FACULTY,
                rationale="任务接近完成，应准备清晰的价值输出",
                priority=priority_counter,
                estimated_entropy_reduction=0.3,
            )
        )

    # 限制返回数量并按优先级排序
    suggestions = sorted(suggestions, key=lambda x: x.priority)[:max_suggestions]

    # 将建议保存到状态
    state = get_state(tool_context)
    if state:
        for suggestion in suggestions:
            add_next_action(
                tool_context,
                action=suggestion.action,
                faculty=suggestion.faculty,
                rationale=suggestion.rationale,
                priority=suggestion.priority,
                estimated_entropy_reduction=suggestion.estimated_entropy_reduction,
            )

    logger.info(
        "next_actions_generated",
        count=len(suggestions),
        goal_completion=goal_completion,
    )

    return suggestions


async def suggest_next_faculty(
    current_faculty: str,
    task_goal: str,
    tool_context: ToolContext,
) -> str | None:
    """基于当前状态建议下一个系部

    在系部流水线执行过程中，建议下一个应该使用的系部。

    Args:
        current_faculty: 当前系部
        task_goal: 任务目标
        tool_context: ADK 工具上下文

    Returns:
        建议的下一个系部，如果没有则返回 None
    """
    # 定义系部流转逻辑
    flow_patterns = {
        PERCEPTION_FACULTY: {
            "default": INTERNALIZATION_FACULTY,
            "分析": CONTEMPLATION_FACULTY,
            "规划": CONTEMPLATION_FACULTY,
        },
        INTERNALIZATION_FACULTY: {
            "default": CONTEMPLATION_FACULTY,
            "继续": PERCEPTION_FACULTY,
        },
        CONTEMPLATION_FACULTY: {
            "default": ACTION_FACULTY,
            "输出": INFLUENCE_FACULTY,
            "分析": PERCEPTION_FACULTY,
        },
        ACTION_FACULTY: {
            "default": INTERNALIZATION_FACULTY,
            "输出": INFLUENCE_FACULTY,
        },
        INFLUENCE_FACULTY: {
            "default": None,  # 流程结束
        },
    }

    # 获取当前系部的流转模式
    patterns = flow_patterns.get(current_faculty, {})

    # 基于任务目标选择
    goal_lower = task_goal.lower()

    for keyword, next_faculty in patterns.items():
        if keyword != "default" and keyword in goal_lower:
            return next_faculty

    # 返回默认流转
    return patterns.get("default")


__all__ = [
    "ActionSuggestion",
    "generate_next_actions",
    "suggest_next_faculty",
]
