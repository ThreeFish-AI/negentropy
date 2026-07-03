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
from negentropy.models.evolution import (
    CONFIG_SCOPE_RETRIEVAL,
    STATUS_CANARY,
    STATUS_RUNTIME_CANARY,
    TARGET_KIND_SKILL_TEMPLATE,
    EvolutionProposal,
)

logger = get_logger("negentropy.engine.evolution.queries")

_CANARY_CACHE_TTL = 15.0
# target_ref -> (proposal_dict | None, fetched_at)
_canary_cache: dict[str, tuple[dict[str, Any] | None, float]] = {}
# skill_name -> (proposal_dict | None, fetched_at)  —— runtime_canary 灰度路由用
_skill_canary_cache: dict[str, tuple[dict[str, Any] | None, float]] = {}


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


def get_cached_skill_canary(skill_name: str) -> dict[str, Any] | None:
    """同步读 ``_skill_canary_cache``（不触 DB）——供 tool_telemetry 热路径打 canary_assignment 标记。

    返回 ``{proposed_version, bucket_ratio_pct}`` 或 None（缓存未命中/无在途 runtime_canary）。
    缓存由 ``fetch_active_skill_canary``（异步，skills_injector 解析时填充）维护，故 tool 调用时通常已命中。
    """
    cached = _skill_canary_cache.get(skill_name)
    if cached is None:
        return None
    return cached[0]


def invalidate_canary_cache(target_ref: str | None = None) -> None:
    """orchestrator 进入/退出 canary 状态后调用，强一致刷新。"""
    if target_ref is None:
        _canary_cache.clear()
        _skill_canary_cache.clear()
    else:
        _canary_cache.pop(target_ref, None)
        _skill_canary_cache.pop(target_ref, None)


async def fetch_active_skill_canary(skill_name: str) -> dict[str, Any] | None:
    """返回该 skill 的在途 runtime_canary 提案（status=runtime_canary），无则 None。

    供 ``skills_injector`` 灰度路由：命中桶的会话解析候选 version，其余解析 active_version。
    带短 TTL 缓存（skill 解析是高频路径）。返回 ``{proposed_version, bucket_ratio_pct}``。
    """
    now = time.monotonic()
    cached = _skill_canary_cache.get(skill_name)
    if cached is not None and (now - cached[1]) < _CANARY_CACHE_TTL:
        return cached[0]
    proposal = await _query_active_skill_canary(skill_name)
    _skill_canary_cache[skill_name] = (proposal, now)
    return proposal


async def _query_active_skill_canary(skill_name: str) -> dict[str, Any] | None:
    try:
        async with db_session.AsyncSessionLocal() as db:
            row = (
                await db.execute(
                    sa.select(EvolutionProposal)
                    .where(
                        EvolutionProposal.target_kind == TARGET_KIND_SKILL_TEMPLATE,
                        EvolutionProposal.target_ref == skill_name,
                        EvolutionProposal.status == STATUS_RUNTIME_CANARY,
                    )
                    .limit(1)
                )
            ).scalar_one_or_none()
            if row is None:
                return None
            cfg = dict(row.canary_config or {})
            return {
                "proposed_version": row.proposed_version,
                "bucket_ratio_pct": float(cfg.get("bucket_ratio") or 0.0),
            }
    except Exception as exc:
        logger.debug("evolution_skill_canary_query_failed", skill=skill_name, error=str(exc))
        return None


__all__ = [
    "fetch_active_canary",
    "fetch_active_skill_canary",
    "get_cached_skill_canary",
    "fetch_today_eval_cost",
    "invalidate_canary_cache",
]


async def fetch_today_eval_cost() -> float:
    """聚合今日 completed eval_runs 的 cost_total（SI #4 真实 $-cost，R8-c D7 绕过）。

    D7（``tool_invocations.cost_usd`` 恒 NULL）是**架构正确的**——函数调用无 LLM usage。
    进化子系统的主导成本是 eval suite 运行（N judge calls/case >> 1 proposer call），其 $-cost
    已由 R4-b（executor 侧）+ R5（judge 侧）写入 ``eval_runs.cost_total``。本函数聚合今日 completed
    runs 的 SUM，作 ``pre_propose_check.cost_today_usd`` 的合理代理。
    """
    from negentropy.models.eval_suite import EvalRun

    try:
        async with db_session.AsyncSessionLocal() as db:
            import datetime as _dt

            since = _dt.datetime.now(_dt.UTC) - _dt.timedelta(days=1)
            total = (
                await db.execute(
                    sa.select(sa.func.coalesce(sa.func.sum(EvalRun.cost_total), 0.0))
                    .where(EvalRun.created_at >= since)
                    .where(EvalRun.status == "completed")
                )
            ).scalar_one()
            return float(total)
    except Exception as exc:
        logger.debug("fetch_today_eval_cost_failed", error=str(exc))
        return 0.0
