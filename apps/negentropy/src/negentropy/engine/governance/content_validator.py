"""Memory 内容格式校验器 — 检测非自然语言内容。

防止结构化 JSON 被写入 memories.content 字段。
设计参照同目录 pii_detector.py 的 thin-wrapper 模式：零依赖、同步、快速。
"""

from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass(frozen=True)
class ContentCheckResult:
    """内容格式检测结果。"""

    is_natural_language: bool
    detected_format: str  # "natural_language" | "json"


def validate_memory_content(text: str) -> ContentCheckResult:
    """校验 memory content 是否为自然语言。

    检测逻辑：
    1. 尝试 json.loads — 解析成功且为 dict（key ≥ 2）→ JSON
    2. 其余情况 → 自然语言

    Args:
        text: 待校验的 content 字符串。

    Returns:
        ContentCheckResult 含 is_natural_language 和 detected_format。
    """
    if not text or not text.strip():
        return ContentCheckResult(is_natural_language=True, detected_format="natural_language")

    stripped = text.strip()

    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict) and len(parsed) >= 2:
            return ContentCheckResult(is_natural_language=False, detected_format="json")
    except (json.JSONDecodeError, ValueError):
        pass

    return ContentCheckResult(is_natural_language=True, detected_format="natural_language")
