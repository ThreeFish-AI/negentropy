"""PII Detector — Phase 4 简易隐私信息检测占位

设计取舍：
- 不引入 microsoft/presidio 等重依赖（GDPR/PII 全方位治理是 Phase 5+ 范畴）
- 这里仅提供 regex 级检测占位，命中后写入 ``Memory.metadata.pii_flags``
- 给 UI 提供"🔒 含敏感信息"标记，提示用户审计

理论与法规参考：
[1] GDPR Art. 17 — Right to Erasure (Right to be Forgotten)
[2] NIST SP 800-122 — Guide to Protecting Personally Identifiable Information

支持的 PII 类型：
- ``email``：RFC 5322 简化版正则
- ``phone``：北美 + 中国大陆手机号
- ``id_card``：中国大陆身份证（18 位）
- ``credit_card``：常见信用卡号（13-19 位 + Luhn 校验）

False Positive 控制：
- ``credit_card`` 加 Luhn 校验，避免日期/订单号误识
- 其他类型仅做提示标记，不阻断写入或检索
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# 常用模式
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_NA_RE = re.compile(r"(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)")
_PHONE_CN_RE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")
_ID_CARD_CN_RE = re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)")
_CREDIT_CARD_RE = re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")


def _luhn_check(digits: str) -> bool:
    """Luhn 算法校验信用卡号有效性。

    从右往左每隔一位（第 2、4、6 ... 位，0-indexed 即奇数位置）做 ×2
    后大于 9 减 9，最后总和 mod 10 == 0 视为有效。
    """
    digits = re.sub(r"[^0-9]", "", digits)
    if len(digits) < 13:
        return False
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


@dataclass(frozen=True)
class PIIMatch:
    """单个 PII 命中。"""

    pii_type: str
    span: tuple[int, int]
    masked_value: str


def _mask(value: str, head: int = 2, tail: int = 2) -> str:
    """中间 mask，保留前 head/后 tail 字符；过短时全 mask。"""
    if len(value) <= head + tail:
        return "*" * len(value)
    return value[:head] + "*" * (len(value) - head - tail) + value[-tail:]


def detect(text: str) -> list[PIIMatch]:
    """扫描文本，返回 PII 命中清单。"""
    if not text:
        return []
    matches: list[PIIMatch] = []
    seen_spans: set[tuple[int, int]] = set()

    # 优先级：身份证 > 信用卡 > 邮箱 > 电话
    for pii_type, pattern, validator in (
        ("id_card", _ID_CARD_CN_RE, None),
        ("credit_card", _CREDIT_CARD_RE, lambda v: _luhn_check(v)),
        ("email", _EMAIL_RE, None),
        ("phone", _PHONE_NA_RE, None),
        ("phone", _PHONE_CN_RE, None),
    ):
        for m in pattern.finditer(text):
            span = (m.start(), m.end())
            if any(s[0] <= span[0] < s[1] for s in seen_spans):
                continue
            value = m.group(0)
            if validator and not validator(value):
                continue
            seen_spans.add(span)
            matches.append(PIIMatch(pii_type=pii_type, span=span, masked_value=_mask(value)))

    return matches


def summarize_flags(matches: list[PIIMatch]) -> dict[str, int]:
    """汇总 metadata.pii_flags 形态：{pii_type: count}。"""
    flags: dict[str, int] = {}
    for m in matches:
        flags[m.pii_type] = flags.get(m.pii_type, 0) + 1
    return flags


__all__ = ["PIIMatch", "detect", "summarize_flags"]
