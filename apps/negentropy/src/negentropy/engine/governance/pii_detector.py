"""Phase 4 兼容层 — thin re-export。

原 regex 占位实现已迁移至 ``engine/governance/pii/regex_detector.py``。
此模块保留以下符号以确保向后兼容：

- ``PIIMatch``：与原 dataclass 同义（实质是 ``PIISpan`` 的别名）；
- ``detect(text)``：默认走 ``RegexPIIDetector().detect``；
- ``summarize_flags(matches)``：与原函数等价；
- ``_luhn_check`` / ``_mask``：保留私有名以兼容现有测试。

新代码请直接 import ``negentropy.engine.governance.pii``。
"""

from __future__ import annotations

from dataclasses import dataclass

from negentropy.engine.governance.pii.base import PIISpan
from negentropy.engine.governance.pii.base import summarize_pii_flags as _summarize_pii_flags
from negentropy.engine.governance.pii.regex_detector import RegexPIIDetector
from negentropy.engine.governance.pii.regex_detector import luhn_check as _luhn_check_impl


@dataclass(frozen=True)
class PIIMatch:
    """旧版 dataclass；保留 ``span`` / ``masked_value`` 字段以兼容现有测试。"""

    pii_type: str
    span: tuple[int, int]
    masked_value: str


def _mask(value: str, head: int = 2, tail: int = 2) -> str:
    if len(value) <= head + tail:
        return "*" * len(value)
    return value[:head] + "*" * (len(value) - head - tail) + value[-tail:]


def _luhn_check(digits: str) -> bool:
    return _luhn_check_impl(digits)


def detect(text: str) -> list[PIIMatch]:
    """扫描文本返回旧版 PIIMatch 列表（仅 regex 引擎，向后兼容）。"""
    spans = RegexPIIDetector().detect(text)
    return [
        PIIMatch(
            pii_type=s.pii_type,
            span=(s.start, s.end),
            masked_value=_mask(s.text),
        )
        for s in spans
    ]


def summarize_flags(matches: list[PIIMatch]) -> dict[str, int]:
    flags: dict[str, int] = {}
    for m in matches:
        flags[m.pii_type] = flags.get(m.pii_type, 0) + 1
    return flags


__all__ = [
    "PIIMatch",
    "detect",
    "summarize_flags",
    "_luhn_check",
    "_mask",
    "PIISpan",
    "_summarize_pii_flags",
]
