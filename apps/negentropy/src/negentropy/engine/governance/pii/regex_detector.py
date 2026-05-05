"""RegexPIIDetector — 把 Phase 4 的 regex + Luhn 占位封装为 PIIDetectorBase。

字段类型与命中行为与原 ``engine/governance/pii_detector.py`` 一一对应。
"""

from __future__ import annotations

import re

from .base import PIIDetectorBase, PIISpan

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_NA_RE = re.compile(r"(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)")
_PHONE_CN_RE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")
_ID_CARD_CN_RE = re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)")
_CREDIT_CARD_RE = re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")

_REGEX_SCORE = 0.99


def luhn_check(digits: str) -> bool:
    """Luhn 算法校验信用卡号有效性。"""
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


class RegexPIIDetector(PIIDetectorBase):
    """Phase 4 兼容引擎：4 类 regex + Luhn 校验 + 优先级覆盖。"""

    name = "regex"

    def detect(self, text: str, *, languages: list[str] | None = None) -> list[PIISpan]:
        if not text:
            return []
        matches: list[PIISpan] = []
        seen_spans: set[tuple[int, int]] = set()

        # 优先级：身份证 > 信用卡 > 邮箱 > 电话
        ordered = (
            ("id_card", _ID_CARD_CN_RE, None),
            ("credit_card", _CREDIT_CARD_RE, luhn_check),
            ("email", _EMAIL_RE, None),
            ("phone", _PHONE_NA_RE, None),
            ("phone", _PHONE_CN_RE, None),
        )
        for pii_type, pattern, validator in ordered:
            for m in pattern.finditer(text):
                span = (m.start(), m.end())
                if any(s[0] <= span[0] < s[1] for s in seen_spans):
                    continue
                value = m.group(0)
                if validator and not validator(value):
                    continue
                seen_spans.add(span)
                matches.append(
                    PIISpan(
                        pii_type=pii_type,
                        start=span[0],
                        end=span[1],
                        score=_REGEX_SCORE,
                        text=value,
                    )
                )
        # 按 start 升序返回
        matches.sort(key=lambda s: s.start)
        return matches


__all__ = ["RegexPIIDetector", "luhn_check"]
