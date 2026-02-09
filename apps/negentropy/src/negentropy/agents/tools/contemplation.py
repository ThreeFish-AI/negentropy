"""
Contemplation Faculty Tools - 沉思系部专用工具

提供反思分析、策略规划能力，支持熵减度量。

参考文献:
[1] C. E. Shannon, "A Mathematical Theory of Communication," _Bell System Technical Journal_, vol. 27, pp. 379-423, 623-656, 1948.
"""

from __future__ import annotations

import re
from typing import Any

from google.adk.tools import ToolContext

from negentropy.logging import get_logger

# Faculty agent name constants
PERCEPTION_FACULTY = "PerceptionFaculty"
INTERNALIZATION_FACULTY = "InternalizationFaculty"
CONTEMPLATION_FACULTY = "ContemplationFaculty"
ACTION_FACULTY = "ActionFaculty"
INFLUENCE_FACULTY = "InfluenceFaculty"

logger = get_logger("negentropy.tools.contemplation")


def _split_sentences(text: str) -> list[str]:
    """将文本分割为句子"""
    parts = re.split(r"[。！？.!?]\s*", text)
    return [p.strip() for p in parts if p.strip()]


def _assess_structure(text: str) -> float:
    """评估文本结构质量 (0.0-1.0)

    基于标题、列表、代码块等结构元素评估。
    """
    structure_indicators = [
        r"^#{1,6}\s",  # Markdown headers
        r"^\s*[-*+]\s",  # Markdown lists
        r"^\s*\d+\.\s",  # Numbered lists
        r"```",  # Code blocks
        r"\[.*\]\(.*\)",  # Links
    ]

    lines = text.splitlines()
    if not lines:
        return 0.0

    structured_lines = 0
    for line in lines:
        for pattern in structure_indicators:
            if re.search(pattern, line):
                structured_lines += 1
                break

    return min(1.0, structured_lines / max(len(lines), 1))


def _count_ambiguities(text: str) -> int:
    """统计模糊表述数量

    识别可能引起歧义的表述。
    """
    ambiguity_indicators = [
        r"\b可能\b",
        r"\b或许\b",
        r"\b大概\b",
        r"\b应该\b",
        r"\b似乎\b",
        r"\b好像\b",
        r"\b等等\b",
        r"\b之类的\b",
        r"\bsomething\b",
        r"\bsomehow\b",
        r"\bmaybe\b",
        r"\bpossibly\b",
    ]

    count = 0
    for pattern in ambiguity_indicators:
        count += len(re.findall(pattern, text, re.IGNORECASE))

    return count


def _identify_reduction_opportunities(text: str) -> list[str]:
    """识别熵减机会

    分析文本中可以通过结构化改进的方面。
    """
    opportunities = []

    # 检查重复概念
    sentences = _split_sentences(text)
    unique_concepts = set()
    repeated = []
    for sent in sentences:
        # 简化：提取关键词（实际应用中可用更复杂的NLP）
        words = re.findall(r"\b\w{3,}\b", sent.lower())
        for word in words:
            if word in unique_concepts and word not in repeated:
                repeated.append(word)
            unique_concepts.add(word)

    if repeated:
        opportunities.append(f"合并重复概念：{', '.join(repeated[:5])}")

    # 检查结构缺失
    if not re.search(r"^#{1,6}\s", text, re.MULTILINE):
        opportunities.append("添加标题层次结构")

    if not re.search(r"^\s*[-*+]\s", text, re.MULTILINE):
        opportunities.append("使用列表项组织内容")

    # 检查定义缺失
    technical_terms = re.findall(r"\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b", text)
    if len(technical_terms) > 2:
        opportunities.append("为技术术语添加明确定义")

    return opportunities


def _assess_goal_complexity(goal: str, constraints: list[str]) -> str:
    """评估目标复杂度

    基于目标描述和约束条件判断任务复杂度。
    """
    # 简单启发式规则
    complexity_indicators = {
        "simple": [
            r"\b查询\b",
            r"\b搜索\b",
            r"\b获取\b",
            r"\b显示\b",
            r"\b列出\b",
        ],
        "complex": [
            r"\b设计\b",
            r"\b实现\b",
            r"\b重构\b",
            r"\b优化\b",
            r"\b分析\b",
            r"\b规划\b",
        ],
    }

    goal_lower = goal.lower()

    # 检查复杂指标
    for pattern in complexity_indicators["complex"]:
        if re.search(pattern, goal_lower):
            if len(constraints) > 2 or len(goal) > 50:
                return "complex"
            return "moderate"

    # 检查简单指标
    for pattern in complexity_indicators["simple"]:
        if re.search(pattern, goal_lower):
            return "simple"

    # 默认中等复杂度
    return "moderate"


def _map_steps_to_faculties(steps: list[str]) -> dict[str, str]:
    """将步骤映射到系部

    基于步骤描述推断应该使用的系部。
    """
    mapping = {}

    for i, step in enumerate(steps):
        step_lower = step.lower()

        if any(word in step_lower for word in ["收集", "获取", "查询", "搜索", "理解"]):
            mapping[step] = PERCEPTION_FACULTY
        elif any(word in step_lower for word in ["规划", "分析", "设计", "反思"]):
            mapping[step] = CONTEMPLATION_FACULTY
        elif any(word in step_lower for word in ["执行", "实现", "操作", "修改"]):
            mapping[step] = ACTION_FACULTY
        elif any(word in step_lower for word in ["沉淀", "保存", "记录", "总结"]):
            mapping[step] = INTERNALIZATION_FACULTY
        elif any(word in step_lower for word in ["输出", "展示", "发布", "报告"]):
            mapping[step] = INFLUENCE_FACULTY
        else:
            # 根据位置推断
            if i == 0:
                mapping[step] = PERCEPTION_FACULTY
            elif i == len(steps) - 1:
                mapping[step] = INTERNALIZATION_FACULTY
            else:
                mapping[step] = CONTEMPLATION_FACULTY

    return mapping


def _suggest_pipeline(goal: str, steps: list[str]) -> str | None:
    """建议使用的流水线

    基于目标和步骤推荐合适的流水线。
    """
    goal_lower = goal.lower()

    # 知识获取类任务
    if any(word in goal_lower for word in ["研究", "学习", "了解", "收集", "知识"]):
        return "KnowledgeAcquisitionPipeline"

    # 问题解决类任务
    if any(word in goal_lower for word in ["修复", "解决", "实现", "开发", "优化"]):
        return "ProblemSolvingPipeline"

    # 价值交付类任务
    if any(word in goal_lower for word in ["撰写", "报告", "展示", "说明", "文档"]):
        return "ValueDeliveryPipeline"

    return None


def analyze_context(
    context: str,
    tool_context: ToolContext,
    include_entropy_analysis: bool = True,
) -> dict[str, Any]:
    """分析当前上下文，提取关键信息并评估熵减机会。

    Args:
        context: 上下文文本
        include_entropy_analysis: 是否包含熵减机会分析

    Returns:
        分析结果，包含关键信息、熵减机会和行动建议
    """
    lines = [line.strip(" \t-•") for line in context.splitlines() if line.strip()]
    if len(lines) >= 3:
        key_points = lines[:5]
    else:
        sentences = _split_sentences(context)
        key_points = sentences[:5]

    recommendations = []
    if context:
        recommendations = [
            "确认目标与成功标准",
            "补齐关键约束与依赖",
            "明确可验证的输出与时间点",
        ]

    result = {
        "status": "success",
        "message": "Context analysis completed",
        "key_points": key_points,
        "recommendations": recommendations,
        "metadata": {"chars": len(context), "lines": len(lines)},
    }

    # 熵感知分析
    if include_entropy_analysis:
        entropy_metrics = {
            "information_density": len(context.split()) / max(len(context), 1),
            "structure_score": _assess_structure(context),
            "ambiguity_count": _count_ambiguities(context),
            "reduction_opportunities": _identify_reduction_opportunities(context),
        }

        result["entropy_metrics"] = entropy_metrics

        # 基于熵分析添加建议
        if entropy_metrics["ambiguity_count"] > 3:
            recommendations.append("减少模糊表述，提高精确度")
        if entropy_metrics["structure_score"] < 0.3:
            recommendations.append("增加结构化元素（标题、列表）")

        logger.info(
            "context_analysis_completed",
            entropy_score=entropy_metrics["structure_score"],
            ambiguities=entropy_metrics["ambiguity_count"],
        )

    return result


def create_plan(
    goal: str,
    constraints: list[str] | None,
    tool_context: ToolContext,
    include_faculty_mapping: bool = True,
) -> dict[str, Any]:
    """创建达成目标的行动计划，包含系部映射。

    Args:
        goal: 目标描述
        constraints: 可选约束条件
        include_faculty_mapping: 是否包含系部映射

    Returns:
        计划详情，包含步骤和系部映射
    """
    constraints_list = constraints or []

    # 分析目标复杂度
    complexity = _assess_goal_complexity(goal, constraints_list)

    # 基于复杂度生成步骤
    if complexity == "simple":
        steps = ["执行核心动作", "验证结果"]
    elif complexity == "moderate":
        steps = [
            "收集必要信息",
            "制定执行计划",
            "实施核心变更",
            "验证与调整",
        ]
    else:  # complex
        steps = [
            "深度上下文分析",
            "信息收集与验证",
            "方案设计与评估",
            "分阶段实施",
            "持续监控与优化",
            "知识沉淀与复盘",
        ]

    result = {
        "status": "success",
        "goal": goal,
        "constraints": constraints_list,
        "steps": steps,
        "complexity": complexity,
        "message": "Plan created based on complexity analysis",
    }

    # 系部映射
    if include_faculty_mapping:
        faculty_mapping = _map_steps_to_faculties(steps)
        recommended_pipeline = _suggest_pipeline(goal, steps)

        result["faculty_mapping"] = faculty_mapping
        result["recommended_pipeline"] = recommended_pipeline

        # 如果推荐了流水线，添加使用建议
        if recommended_pipeline:
            result["pipeline_suggestion"] = (
                f"建议使用 '{recommended_pipeline}' 流水线，"
                f"它包含了完成任务所需的系部组合。"
            )

        logger.info(
            "plan_created",
            complexity=complexity,
            steps_count=len(steps),
            pipeline=recommended_pipeline,
        )

    return result

