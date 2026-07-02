"""Canary 路由纯函数 — thread/user → 桶 → 是否走候选配置。

无 IO、无 settings，可独立单测。同 thread 全程落同一桶（canary 污染防护：
避免同一会话一会儿看候选、一会儿看基线导致指标串味）。

参考文献：
[1] N. Shinn et al., "Reflexion," NeurIPS, 2023. 在线反馈驱动的策略调整。
"""

from __future__ import annotations

import hashlib

# 桶常数：都缺标识时返回 100（永不进 canary，恒走 active 配置）
_NEVER_CANARY_BUCKET = 100


def bucket_index(
    thread_id: str | None,
    user_id: str | None,
    *,
    bucket_key: str | None = None,
    salt: str = "evolution",
) -> int:
    """计算 [0, 100) 桶号。

    优先级：``bucket_key``（显式分桶键）> ``thread_id`` > ``user_id``；都缺 → 100（永不进 canary）。
    确定性：同一键全程同桶（canary 污染防护）。

    ``bucket_key`` 用于解耦「分桶粒度」与「user 标识」——routine 路径大量自治 routine 共用
    ``user_id="system"``，若按 user_id 分桶会全落同桶使灰度沦为 0%/100%；传 ``routine.id``
    作 bucket_key 即可按 routine 粒度正确灰度。默认 None → 回退 thread_id/user_id，旧路径逐字节等价。
    """
    key = bucket_key or thread_id or user_id
    if not key:
        return _NEVER_CANARY_BUCKET
    h = hashlib.sha256(f"{salt}:{key}".encode()).hexdigest()
    return int(h[:8], 16) % 100


def should_use_candidate(bucket: int, ratio_pct: float) -> bool:
    """``bucket < ratio_pct`` → 走候选配置。"""
    return bucket < ratio_pct


def resolve_canary_override(
    *,
    active_snapshot: dict,
    active_version: str,
    candidate_snapshot: dict,
    candidate_version: str,
    bucket: int,
    ratio_pct: float,
) -> tuple[dict, str]:
    """返回 ``(effective_snapshot, version_label)``。

    命中候选桶 → ``(candidate_snapshot, candidate_version)``；否则 ``(active_snapshot, active_version)``。
    调用方据此决定 ``search_memory`` 的权重入参与 ``retrieval_log.config_version`` 标记。
    """
    if should_use_candidate(bucket, ratio_pct):
        return candidate_snapshot, candidate_version
    return active_snapshot, active_version


__all__ = ["bucket_index", "should_use_candidate", "resolve_canary_override"]
