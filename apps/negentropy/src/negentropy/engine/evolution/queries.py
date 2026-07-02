"""Evolution 只读查询辅助 —— 供 memory_service 等外部模块查询在途 canary 提案。

刻意与 ``orchestrator`` 解耦（本模块不导入 proposer/eval_runner），避免 memory_service
等核心检索路径因进化子系统而承担重依赖 / 循环导入风险。仅依赖 models + db_session。

canary 查询带短 TTL 缓存（默认 15s）——检索是高频路径，每次 search_memory 都查一次
canary 提案会拖慢 p95；canary 状态变更频率远低于检索，缓存可接受秒级延迟。
"""

from __future__ import annotations

import time
from typing import Any

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.evolution import CONFIG_SCOPE_RETRIEVAL, STATUS_CANARY, EvolutionProposal

logger = get_logger("negentropy.engine.evolution.queries")

_CANARY_CACHE_TTL = 15.0
# target_ref -> (proposal_dict | None, fetched_at)
_canary_cache: dict[str, tuple[dict[str, Any] | None, float]] = {}


async def fetch_active_canary(target_ref: str = CONFIG_SCOPE_RETRIEVAL) -> dict[str, Any] | None:
    """返回在途 canary 提案（status=canary）的轻量 dict，无则 None。

    带短 TTL 缓存。返回字段：``{proposed_version, payload, canary_config}``。
    """
    now = time.monotonic()
    cached = _canary_cache.get(target_ref)
    if cached is not None and (now - cached[1]) < _CANARY_CACHE_TTL:
        return cached[0]

    proposal = await _query_active_canary(target_ref)
    _canary_cache[target_ref] = (proposal, now)
    return proposal


async def _query_active_canary(target_ref: str) -> dict[str, Any] | None:
    try:
        async with db_session.AsyncSessionLocal() as db:
            row = (
                await db.execute(
                    sa.select(EvolutionProposal)
                    .where(
                        EvolutionProposal.target_ref == target_ref,
                        EvolutionProposal.status == STATUS_CANARY,
                    )
                    .limit(1)
                )
            ).scalar_one_or_none()
            if row is None:
                return None
            return {
                "proposed_version": row.proposed_version,
                "payload": dict(row.payload or {}),
                "canary_config": dict(row.canary_config or {}),
            }
    except Exception as exc:
        logger.debug("evolution_canary_query_failed", target_ref=target_ref, error=str(exc))
        return None


def invalidate_canary_cache(target_ref: str | None = None) -> None:
    """orchestrator 进入/退出 canary 状态后调用，强一致刷新。"""
    if target_ref is None:
        _canary_cache.clear()
    else:
        _canary_cache.pop(target_ref, None)


__all__ = ["fetch_active_canary", "invalidate_canary_cache"]
