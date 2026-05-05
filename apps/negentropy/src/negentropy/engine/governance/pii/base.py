"""PIIDetectorBase / PIISpan / 写入策略实现。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable
from dataclasses import dataclass

_VALID_POLICIES = {"mark", "mask", "anonymize"}


@dataclass(frozen=True)
class PIISpan:
    """单条 PII 命中。

    Attributes:
        pii_type: 类型标签（如 "email" / "phone" / "id_card" / "credit_card" / "person"）
        start: 在原文中的起始字符偏移
        end: 终止字符偏移（不含）
        score: 检测引擎置信度（0~1）；regex 引擎统一为 0.99
        text: 命中的原始片段
    """

    pii_type: str
    start: int
    end: int
    score: float
    text: str


class PIIDetectorBase(ABC):
    """PII 检测器抽象。"""

    name: str = "abstract"

    @abstractmethod
    def detect(self, text: str, *, languages: list[str] | None = None) -> list[PIISpan]:
        """识别 PII 片段；text 为空时返回空列表。"""
        raise NotImplementedError


def _mask_value(value: str, head: int = 2, tail: int = 2) -> str:
    """中间 mask；过短时全 mask。"""
    if len(value) <= head + tail:
        return "*" * len(value)
    return value[:head] + "*" * (len(value) - head - tail) + value[-tail:]


def apply_policy(
    text: str,
    spans: Iterable[PIISpan],
    *,
    policy: str = "mark",
    head: int = 2,
    tail: int = 2,
) -> str:
    """根据策略对文本进行处理。

    - ``mark``：原文返回（PII 信息保留在 spans 元数据中，UI 可标 🔒）
    - ``mask``：把每个 PII 片段替换为部分屏蔽（前 head 字符 + ``*`` + 后 tail 字符）
    - ``anonymize``：把每个 PII 片段替换为占位符 ``<PII_TYPE>``
    """
    if policy not in _VALID_POLICIES:
        raise ValueError(f"Unknown PII policy: {policy!r}; valid: {sorted(_VALID_POLICIES)}")
    if policy == "mark" or not text:
        return text

    sorted_spans = sorted(spans, key=lambda s: s.start)
    parts: list[str] = []
    cursor = 0
    for span in sorted_spans:
        if span.start < cursor:
            continue  # 重叠片段，跳过
        parts.append(text[cursor : span.start])
        if policy == "mask":
            parts.append(_mask_value(text[span.start : span.end], head=head, tail=tail))
        else:  # anonymize
            parts.append(f"<{span.pii_type.upper()}>")
        cursor = span.end
    parts.append(text[cursor:])
    return "".join(parts)


def summarize_pii_flags(spans: list[PIISpan]) -> dict[str, int]:
    """汇总 ``metadata.pii_flags = {pii_type: count}``。"""
    flags: dict[str, int] = {}
    for s in spans:
        flags[s.pii_type] = flags.get(s.pii_type, 0) + 1
    return flags


__all__ = ["PIIDetectorBase", "PIISpan", "apply_policy", "summarize_pii_flags"]
