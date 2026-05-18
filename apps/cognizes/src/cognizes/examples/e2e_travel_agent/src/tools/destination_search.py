"""
目的地推荐工具 - 集成 Perception 层的混合检索能力

参考：docs/practice/030-the-perception.md - hybrid_search_function.sql
"""

from typing import Optional
import asyncpg

# 目的地静态知识（实际场景从 RAG 知识库检索）
DESTINATIONS = [
    {"name": "巴厘岛", "tags": ["海岛", "度假", "潜水", "SPA"], "climate": "热带"},
    {"name": "普吉岛", "tags": ["海岛", "沙滩", "夜生活"], "climate": "热带"},
    {"name": "京都", "tags": ["文化", "古迹", "樱花", "美食"], "climate": "温带"},
    {"name": "瑞士", "tags": ["滑雪", "雪山", "徒步", "自然"], "climate": "高山"},
    {"name": "马尔代夫", "tags": ["海岛", "蜜月", "潜水", "奢华"], "climate": "热带"},
]


async def recommend_destinations(preferences: str) -> list[dict]:
    """
    基于用户偏好推荐目的地

    Args:
        preferences: 用户的旅行偏好描述，如 "海岛 度假 潜水"

    Returns:
        推荐的目的地列表，按相关性排序
    """
    # 简化版：关键词匹配
    keywords = preferences.lower().split()
    scored = []

    for dest in DESTINATIONS:
        score = sum(1 for tag in dest["tags"] if any(kw in tag.lower() for kw in keywords))
        if score > 0:
            scored.append({**dest, "relevance_score": score})

    scored.sort(key=lambda x: x["relevance_score"], reverse=True)
    return scored[:5] if scored else DESTINATIONS[:3]  # 如果没匹配返回前3个


async def _get_embedding(text: str) -> list[float]:
    """获取文本 Embedding（占位，实际调用 Gemini API）"""
    # 实际实现参考 services.py 中的 embed_text 函数
    return [0.0] * 768  # 占位向量
