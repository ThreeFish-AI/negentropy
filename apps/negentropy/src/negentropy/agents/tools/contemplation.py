"""
Contemplation Faculty Tools - 沉思系部专用工具

提供反思分析、策略规划能力。
"""

from __future__ import annotations

import re
from typing import Any

from google.adk.tools import ToolContext


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"[。！？.!?]\s*", text)
    return [p.strip() for p in parts if p.strip()]


def analyze_context(context: str, tool_context: ToolContext) -> dict[str, Any]:
    """分析当前上下文，提取关键信息。

    Args:
        context: 上下文文本

    Returns:
        分析结果
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
    return {
        "status": "success",
        "message": "Context analysis completed",
        "key_points": key_points,
        "recommendations": recommendations,
        "metadata": {"chars": len(context), "lines": len(lines)},
    }


def create_plan(goal: str, constraints: list[str] | None, tool_context: ToolContext) -> dict[str, Any]:
    """创建达成目标的行动计划。

    Args:
        goal: 目标描述
        constraints: 可选约束条件

    Returns:
        计划详情
    """
    steps = [
        "澄清目标与成功标准",
        "收集必要信息与依赖",
        "拆分任务并排序",
        "执行与验证",
        "回顾与沉淀",
    ]
    return {
        "status": "success",
        "goal": goal,
        "constraints": constraints or [],
        "steps": steps,
        "message": "Plan scaffold created",
    }
