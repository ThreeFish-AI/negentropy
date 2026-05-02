"""QueryIntentClassifier — 查询意图 → 记忆类型路由（轻量启发式）

设计动机：
不同记忆类型擅长回答不同问题（Tulving<sup>[[1]](#ref1)</sup>）：
- 含步骤词 / how-to → procedural（流程性记忆）
- 含时间词 / 事件描述 → episodic（情景记忆）
- 含定义词 / 实体 → semantic（语义记忆）
- 偏好相关 → preference

此处采用关键词级启发式（O(N) 单次扫描，无 LLM 调用），
作为 ContextAssembler 的"路由优先级"提示，不阻塞兜底全检索。

理论参考：
[1] E. Tulving, "Episodic and semantic memory," 1972.
[2] J. R. Anderson, "ACT: A simple theory of complex cognition," 1996.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# 关键词集合（中英双语）
# 中文关键词无法用 `\b` 边界（CJK 字符均为 `\w`），故按字面包含匹配；
# 英文用 `\b` 防止部分匹配 ("liked" 不应触发 prefer)。
_PROCEDURAL_EN = re.compile(r"\b(how\s+to|how\s+do|how\s+can|step|guide)\b", re.IGNORECASE)
_PROCEDURAL_ZH = re.compile(r"步骤|流程|怎么做|怎样|如何|教程")

_EPISODIC_EN = re.compile(r"\b(when|yesterday|last\s+week|recall|history)\b", re.IGNORECASE)
_EPISODIC_ZH = re.compile(r"今天|昨天|上周|去年|曾经|发生|那次|历史")

_SEMANTIC_EN = re.compile(r"\b(what\s+is|what\s+does|define|meaning)\b", re.IGNORECASE)
_SEMANTIC_ZH = re.compile(r"定义|含义|什么是|介绍")

_PREFERENCE_EN = re.compile(r"\b(prefer|favorite)\b", re.IGNORECASE)
_PREFERENCE_ZH = re.compile(r"偏好|喜欢|不喜欢|习惯")


@dataclass(frozen=True)
class IntentResult:
    """查询意图分类结果。

    Attributes:
        primary: 优先类型（首选注入类型）
        boost_types: 加权类型列表（按降序排序的次选）
        confidence: 启发式判定置信度（0.0-1.0）
    """

    primary: str
    boost_types: tuple[str, ...]
    confidence: float


def classify(query: str | None) -> IntentResult:
    """对 query 做意图分类。

    Returns:
        IntentResult；query 为空时返回 episodic 默认（最常见的对话场景）。
    """
    if not query or not query.strip():
        return IntentResult(primary="episodic", boost_types=("semantic",), confidence=0.0)

    text = query.strip()
    procedural = bool(_PROCEDURAL_EN.search(text) or _PROCEDURAL_ZH.search(text))
    episodic = bool(_EPISODIC_EN.search(text) or _EPISODIC_ZH.search(text))
    semantic = bool(_SEMANTIC_EN.search(text) or _SEMANTIC_ZH.search(text))
    preference = bool(_PREFERENCE_EN.search(text) or _PREFERENCE_ZH.search(text))

    # 多关键词命中时按优先级链：procedural > preference > episodic > semantic
    if procedural:
        return IntentResult(
            primary="procedural",
            boost_types=("semantic", "fact"),
            confidence=0.7 if not (episodic or semantic) else 0.55,
        )
    if preference:
        return IntentResult(
            primary="preference",
            boost_types=("semantic", "episodic"),
            confidence=0.7,
        )
    if episodic:
        return IntentResult(
            primary="episodic",
            boost_types=("semantic", "fact"),
            confidence=0.65,
        )
    if semantic:
        return IntentResult(
            primary="semantic",
            boost_types=("fact", "episodic"),
            confidence=0.6,
        )
    # 兜底：默认 episodic + semantic 双路
    return IntentResult(primary="episodic", boost_types=("semantic",), confidence=0.3)


__all__ = ["IntentResult", "classify"]
