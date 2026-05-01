"""
PatternFactExtractor: 基于正则模式的对话事实提取器

从对话文本中提取结构化事实（用户偏好、个人信息、规则指令等），
无需 LLM 调用，纯模式匹配实现。

提取的事实类型（借鉴 Claude Code memoryTypes.ts 四类型分类法）：
- preference: 用户偏好（"我喜欢/偏好/希望..."）
- profile: 用户信息（"我是/我叫/我的..."）
- rule: 规则指令（"不要/总是/记住..."）
- custom: 其他事实性陈述

参考文献:
[1] Claude Code memoryTypes.ts — 四类型分类法（user/feedback/project/reference）
[2] mem0 — 通用记忆层事实提取与去重合并
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.consolidation.fact_extractor")

# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ExtractedFact:
    """提取出的事实"""

    fact_type: str  # preference / profile / rule / custom
    key: str
    value: str
    confidence: float = 0.7  # 模式匹配置信度低于 LLM 提取


# ---------------------------------------------------------------------------
# 提取模式定义
# ---------------------------------------------------------------------------

# 每种类型的模式列表：(compiled_regex, key_group_index, value_group_index)
# key_group_index / value_group_index 是正则中捕获组的编号
_PREFERENCE_PATTERNS: list[tuple[re.Pattern[str], int, int]] = [
    (re.compile(r"我(?:最)?喜欢(.+?)(?:[，。,\.]|$)", re.IGNORECASE), 1, 1),
    (re.compile(r"我(?:比较)?偏好(.+?)(?:[，。,\.]|$)", re.IGNORECASE), 1, 1),
    (re.compile(r"我(?:比较)?倾向(?:于)?(.+?)(?:[，。,\.]|$)", re.IGNORECASE), 1, 1),
    (re.compile(r"我(?:更)?希望(.+?)(?:[，。,\.]|$)", re.IGNORECASE), 1, 1),
    (re.compile(r"我(?:更)?喜欢用(.+?)(?:来|做|进行)?(?:[，。,\.]|$)"), 1, 1),
    (re.compile(r"I (?:really )?like (.+?)(?:[,\.]|$)", re.IGNORECASE), 1, 1),
    (re.compile(r"I prefer (.+?)(?:[,\.]|$)", re.IGNORECASE), 1, 1),
    (re.compile(r"My (?:favorite|preferred) (.+?) is (.+?)(?:[,\.]|$)", re.IGNORECASE), 1, 2),
]

_PROFILE_PATTERNS: list[tuple[re.Pattern[str], int, int]] = [
    (re.compile(r"我是(.+?)(?:[，。,\.]|$)"), 1, 1),
    (re.compile(r"我叫(.+?)(?:[，。,\.]|$)"), 1, 1),
    (re.compile(r"我(?:的)(?:名字|姓名|名)是(.+?)(?:[，。,\.]|$)"), 1, 1),
    (re.compile(r"我(?:的)(.+?)是(.+?)(?:[，。,\.]|$)"), 1, 2),
    (re.compile(r"My name is (.+?)(?:[,\.]|$)", re.IGNORECASE), 1, 1),
    (re.compile(r"I am (?:a |an )?(.+?)(?:[,\.]|$)", re.IGNORECASE), 1, 1),
    (re.compile(r"I work (?:at|for|in) (.+?)(?:[,\.]|$)", re.IGNORECASE), 1, 1),
    (re.compile(r"My (.+?) is (.+?)(?:[,\.]|$)", re.IGNORECASE), 1, 2),
]

_RULE_PATTERNS: list[tuple[re.Pattern[str], int, int]] = [
    (re.compile(r"(?:请|务必|一定要?)不要(.+?)(?:[，。,\.]|$)"), 1, 1),
    (re.compile(r"(?:请|务必|一定)要(.+?)(?:[，。,\.]|$)"), 1, 1),
    (re.compile(r"(?:请|务必|一定要?)总是(.+?)(?:[，。,\.]|$)"), 1, 1),
    (re.compile(r"(?:记住|请记住|记得)(.+?)(?:[，。,\.]|$)"), 1, 1),
    (re.compile(r"(?:永远|绝不|千万不要)(.+?)(?:[，。,\.]|$)"), 1, 1),
    (re.compile(r"(?:Don't|Do not|Never) (.+?)(?:[,\.]|$)", re.IGNORECASE), 1, 1),
    (re.compile(r"(?:Always|Must|Remember to) (.+?)(?:[,\.]|$)", re.IGNORECASE), 1, 1),
]

# ---------------------------------------------------------------------------
# 提取器
# ---------------------------------------------------------------------------

# 同一类型事实的最小 key 长度（过滤噪声）
_MIN_KEY_LENGTH = 2


class PatternFactExtractor:
    """基于正则模式的对话事实提取器

    从对话轮次中提取 preference / profile / rule / custom 四类事实。
    纯模式匹配，无需 LLM 调用。
    """

    def extract(self, turns: list[dict[str, str]]) -> list[ExtractedFact]:
        """从对话轮次中提取事实

        Args:
            turns: [{"author": "user"|"model", "text": "..."}, ...]

        Returns:
            提取出的事实列表（去重后）
        """
        facts: list[ExtractedFact] = []
        seen_keys: set[str] = set()

        for turn in turns:
            # 只从用户消息中提取事实
            if turn.get("author") != "user":
                continue
            text = turn.get("text", "")
            if not text:
                continue

            for fact in self._extract_from_text(text):
                dedup_key = f"{fact.fact_type}:{fact.key}"
                if dedup_key not in seen_keys and len(fact.key) >= _MIN_KEY_LENGTH:
                    seen_keys.add(dedup_key)
                    facts.append(fact)

        logger.debug(
            "facts_extracted",
            total_turns=len(turns),
            facts_count=len(facts),
            types={
                ft: sum(1 for f in facts if f.fact_type == ft) for ft in ("preference", "profile", "rule", "custom")
            },
        )
        return facts

    def _extract_from_text(self, text: str) -> list[ExtractedFact]:
        """从单条文本中提取所有匹配的事实"""
        facts: list[ExtractedFact] = []

        for pattern, key_group, value_group in _PREFERENCE_PATTERNS:
            for m in pattern.finditer(text):
                key = m.group(key_group).strip()
                value = m.group(value_group).strip() if value_group <= pattern.groups else key
                if key:
                    facts.append(ExtractedFact(fact_type="preference", key=key, value=value))

        for pattern, key_group, value_group in _PROFILE_PATTERNS:
            for m in pattern.finditer(text):
                key = m.group(key_group).strip()
                value = m.group(value_group).strip() if value_group <= pattern.groups else key
                if key:
                    facts.append(ExtractedFact(fact_type="profile", key=key, value=value))

        for pattern, key_group, value_group in _RULE_PATTERNS:
            for m in pattern.finditer(text):
                key = m.group(key_group).strip()
                value = m.group(value_group).strip() if value_group <= pattern.groups else key
                if key:
                    facts.append(ExtractedFact(fact_type="rule", key=key, value=value))

        return facts
