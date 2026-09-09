"""Minimal UTC-anchored time helpers shared across domains.

独立成模块的原因：历史上 ``_utcnow`` 在 interface / agents / engine 等 8 处
各自内联定义；收敛为单一事实源时需要一个零依赖的叶子模块（仅 import
``datetime``），避免任何跨域 import 或循环依赖风险。
"""

from datetime import UTC, datetime


def utcnow() -> datetime:
    """Current timezone-aware UTC time."""
    return datetime.now(UTC)
