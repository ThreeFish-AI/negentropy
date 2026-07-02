"""记忆检索权重解析（active 配置 + 短 TTL 缓存 + 代码常量兜底）。

解析顺序（单一事实源）：``memory_config_versions WHERE is_active=true`` →
回退代码常量（迁移未跑/表不存在/无 active 行时），version='0.1.0'（与 seed 基线一致）。

缓存对齐 ``config/model_resolver.py`` 的 TTL 范式（30s，比 60s 短——权重变更希望较快生效）；
``invalidate()`` 供 promote/rollback 后强一致刷新。

兼容性保证：seed 基线 v0.1.0 snapshot={0.7,0.3} 与 ``memory_service._DEFAULT_*_WEIGHT``
逐字节相等，故无论缓存是否命中、表是否存在，行为不变。
"""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy import select

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.evolution import CONFIG_SCOPE_RETRIEVAL, MemoryConfigVersion

logger = get_logger("negentropy.engine.evolution.weights")

# 代码常量兜底（与 memory_service._DEFAULT_SEMANTIC_WEIGHT/_DEFAULT_KEYWORD_WEIGHT、
# 迁移 0081 seed v0.1.0 三处逐字节对齐——cold-start fallback，表就绪后 DB 为 SSOT）。
_FALLBACK_SNAPSHOT: dict[str, float] = {"semantic_weight": 0.7, "keyword_weight": 0.3}
_FALLBACK_VERSION = "0.1.0"

_CACHE_TTL = 30.0  # 秒
# scope -> (snapshot, version, fetched_at_monotonic)
_cache: dict[str, tuple[dict[str, Any], str, float]] = {}


async def resolve_active_retrieval_config(
    config_scope: str = CONFIG_SCOPE_RETRIEVAL,
) -> tuple[dict[str, Any], str]:
    """返回 ``(snapshot, version)``。

    命中缓存且未过期 → 直接返回；否则查 ``memory_config_versions WHERE is_active=true``；
    表不存在/无 active 行 → 回退代码常量 + ``_FALLBACK_VERSION``（保证冷启行为逐字节不变）。
    """
    now = time.monotonic()
    cached = _cache.get(config_scope)
    if cached is not None and (now - cached[2]) < _CACHE_TTL:
        return cached[0], cached[1]

    snapshot, version = await _fetch_active(config_scope)
    _cache[config_scope] = (snapshot, version, now)
    return snapshot, version


async def _fetch_active(config_scope: str) -> tuple[dict[str, Any], str]:
    """从 DB 读 active 行；任一异常（表不存在等）→ 代码常量兜底（fail-soft，不抛）。"""
    try:
        async with db_session.AsyncSessionLocal() as db:
            row = (
                await db.execute(
                    select(MemoryConfigVersion).where(
                        MemoryConfigVersion.config_scope == config_scope,
                        MemoryConfigVersion.is_active.is_(True),
                    )
                )
            ).scalar_one_or_none()
            if row is not None:
                return dict(row.snapshot or {}), row.version
    except Exception as exc:
        logger.debug("evolution_weights_fetch_failed", config_scope=config_scope, error=str(exc))
    return dict(_FALLBACK_SNAPSHOT), _FALLBACK_VERSION


def invalidate(config_scope: str | None = None) -> None:
    """evolution promote/rollback 写完 active 行后调用，强一致刷新缓存。"""
    if config_scope is None:
        _cache.clear()
    else:
        _cache.pop(config_scope, None)


__all__ = ["resolve_active_retrieval_config", "invalidate"]
