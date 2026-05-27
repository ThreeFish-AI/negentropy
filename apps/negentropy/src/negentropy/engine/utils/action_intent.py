"""ActionIntentClassifier — Ingest vs Retrieve 二分类（轻量启发式）。

设计动机：
    ISSUE-096 移除 Composer「输出沉淀」Tab 后，沉淀入口由前端 UI 收敛为后端
    LLM 主动决策。本分类器在 root LLM 调用前对用户 prompt 做关键词扫描，把
    高置信度 hint 写入 ``session.state['action_intent_hint']``，供 Root
    instruction 与 InternalizationFaculty transfer 路径选择参考。

设计取舍：
    与 :mod:`negentropy.engine.utils.query_intent` 同范式（O(N) 单次正则扫描、
    无 LLM 调用），但语义维度正交：

    - ``query_intent``：记忆类型（procedural / episodic / semantic / preference）
    - ``action_intent``：动作类型（retrieve / ingest / ambiguous）

    二者在不同决策点消费，互不耦合。

判定优先级：
    1. ingest 与 retrieve 同时命中 → ``ambiguous``（confidence=0.4）
    2. 仅 ingest 命中 → ``ingest``（≥2 hits → 0.85，否则 0.7）
    3. 仅 retrieve 命中 → ``retrieve``（0.7）
    4. 皆未命中 → ``retrieve``（0.3，保守缺省避免误写入）

参考文献：
    [1] J. Wang, Z. Chen, R. Pasunuru et al., "Self-RAG: Learning to Retrieve,
        Generate, and Critique through Self-Reflection," in *Proc. ICLR*, 2024.
        — Self-reflective tokens 启发「在生成前先预测 action label」的可解释范式。
    [2] LangChain AI, "LangGraph: Conditional Routing and Stateful Multi-Actor
        Workflows," LangGraph Documentation, 2024-2025.
        — 关键词驱动 conditional edges 作为 first-line 路由 + LLM 作为
        decision-maker 的双层架构最佳实践。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

ActionLabel = Literal["retrieve", "ingest", "ambiguous"]

# 关键词集合（中英双语）。
# 中文 CJK 字符均为 ``\w``，无法用 ``\b`` 边界，故按字面子串匹配；
# 英文用 ``\b`` 防止部分匹配（如 "saver" 不应触发 save）。
_INGEST_ZH = re.compile(
    r"沉淀|入库|记录到|保存到|存到|写入|归档|收录|加到|加入|放进|"
    r"记下来|帮我记|备忘|建档|记一下|记下"
)
_INGEST_EN = re.compile(
    r"\b(ingest|save|store|record|archive|memorize|capture|"
    r"add\s+to|file\s+(?:to|under)|note\s+down)\b",
    re.IGNORECASE,
)
_RETRIEVE_ZH = re.compile(r"查询|搜索|检索|找一下|找找|查一下|查查|看看|问一下|关于|是什么|怎么")
_RETRIEVE_EN = re.compile(
    r"\b(search|find|look\s+up|query|retrieve|what\s+is|tell\s+me|"
    r"show\s+me|recall|how\s+(?:to|do))\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ActionIntent:
    """动作意图分类结果。

    Attributes:
        label: 三态标签——``retrieve`` / ``ingest`` / ``ambiguous``
        confidence: 启发式判定置信度（0.0-1.0）；调用方可据此决定是否信任 hint
        matched_keywords: 命中的关键词（去重 + 排序），便于可观测性与调试
    """

    label: ActionLabel
    confidence: float
    matched_keywords: tuple[str, ...]


def classify(query: str | None) -> ActionIntent:
    """对 query 做动作意图分类。

    Args:
        query: 用户输入文本；None / 空串 / 仅空白 → 保守缺省 ``retrieve``。

    Returns:
        ActionIntent；调用方应组合 ``state["corpus_ids"]`` 等上下文做最终决策，
        本函数为纯函数不依赖外部状态。
    """
    if not query or not query.strip():
        return ActionIntent(label="retrieve", confidence=0.0, matched_keywords=())

    text = query.strip()
    ingest_hits = _collect_hits(text, (_INGEST_ZH, _INGEST_EN))
    retrieve_hits = _collect_hits(text, (_RETRIEVE_ZH, _RETRIEVE_EN))

    if ingest_hits and retrieve_hits:
        combined = tuple(sorted(ingest_hits | retrieve_hits))
        return ActionIntent(label="ambiguous", confidence=0.4, matched_keywords=combined)
    if ingest_hits:
        confidence = 0.85 if len(ingest_hits) >= 2 else 0.7
        return ActionIntent(label="ingest", confidence=confidence, matched_keywords=tuple(sorted(ingest_hits)))
    if retrieve_hits:
        return ActionIntent(label="retrieve", confidence=0.7, matched_keywords=tuple(sorted(retrieve_hits)))
    # 皆未命中：保守缺省到 retrieve（绝不主动写入）
    return ActionIntent(label="retrieve", confidence=0.3, matched_keywords=())


def _collect_hits(text: str, patterns: tuple[re.Pattern[str], ...]) -> set[str]:
    """收集所有正则命中（小写归一）。"""
    hits: set[str] = set()
    for pattern in patterns:
        for match in pattern.finditer(text):
            hits.add(match.group(0).lower())
    return hits


__all__ = ["ActionLabel", "ActionIntent", "classify"]
