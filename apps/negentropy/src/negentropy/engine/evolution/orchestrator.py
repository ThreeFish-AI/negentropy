"""EvolutionOrchestrator —— 自进化提案状态机 tick（对齐 routine orchestrator 三段式）。

``inspect_once()`` 由 ``evolution_inspector`` 心跳（默认 300s）驱动，三段式：

  (a) REAP    — canary 超时强制回滚（样本不足视为未通过 → 回基线最安全）；
  (b) ADVANCE — 按 ``proposal.target_kind`` 分派到对应 ``TargetHandler`` 推进状态机：
                shadow_eval → (low+auto: canary | else: pending_approval) | rejected
                canary（窗口到期） → promote | rollback | hold（样本不足续等）
  (c) SPAWN   — 遍历注册 handler 各自 ``maybe_spawn``（单在途 + 预算守卫 + bg proposer）

并发幂等：``FOR UPDATE SKIP LOCKED`` 抢占提案行 + ``uq_evolution_proposals_one_inflight``
部分唯一索引兜底（每 target_ref 至多一个非终态提案）。

**TargetHandler 抽象**（综述 §7 meta-layer + 蓝图 §10「第二面接入时再抽」）：原 retrieval 硬编码
逻辑迁入 ``handlers/retrieval.py``；orchestrator 退化为薄分派层。第二面（skill_template）接入
只需 ``_handlers`` 注册一个新 handler。

灰度：``settings.evolution.enabled=False`` 时 ``inspect_once`` 直接 no-op 返回。

参考文献：
[1] J. Zhang et al., "Darwin Gödel machine," arXiv:2505.22954, 2025. 档案库进化 + 评估门控。
[2] PostgreSQL Docs, *FOR UPDATE SKIP LOCKED*. 并发 tick 幂等。
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.logging import get_logger
from negentropy.models.evolution import (
    STATUS_CANARY,
    STATUS_PROMOTED,
    STATUS_RUNTIME_CANARY,
    STATUS_SHADOW_EVAL,
    EvolutionProposal,
)

from .decision import REASON_STALE_CANARY, is_canary_stale
from .handlers import RetrievalConfigHandler, SkillTemplateHandler, TargetHandler
from .handlers._shared import (  # noqa: F401  (re-export：既有 orchestrator._x 引用 + 单测兼容)
    _bump_patch,
    _emit_evolution_event,
    _enter_canary,
    _get_routine_bus,
    _parse_dt,
    _summarize_metrics,
    _td,
    _utcnow,
)

logger = get_logger("negentropy.engine.evolution.orchestrator")

_BATCH_LIMIT = 10


class EvolutionOrchestrator:
    """单例（经 ``get_evolution_orchestrator``），对齐 RoutineOrchestrator 范式。"""

    def __init__(self) -> None:
        # 按 target_kind 注册 handler；第二面接入时追加一个 handler 即可。
        self._handlers: dict[str, TargetHandler] = {
            RetrievalConfigHandler.target_kind: RetrievalConfigHandler(),
            SkillTemplateHandler.target_kind: SkillTemplateHandler(),
        }

    def _handler_for(self, target_kind: str) -> TargetHandler | None:
        return self._handlers.get(target_kind)

    async def inspect_once(self) -> dict[str, int]:
        """三段式 tick。灰度关闭时 no-op。"""
        if not settings.evolution.enabled:
            return {"reaped": 0, "advanced": 0, "proposed": 0}

        reaped = await self._reap_stale_canary()
        advanced = await self._advance_due_proposals()
        # proposer 仅在无在途提案时 spawn（单在途不变量）；auto_mode 关闭时也允许 spawn
        # （提案落 shadow_eval 后停在 pending_approval 待人审）。每 handler 独立判断自己的 target_ref。
        proposed = 0
        for handler in self._handlers.values():
            try:
                proposed += await handler.maybe_spawn()
            except Exception as exc:  # noqa: BLE001  # 单 handler 异常不阻塞其它 handler / tick
                logger.warning("evolution_spawn_handler_failed", kind=handler.target_kind, error=str(exc))
        return {"reaped": reaped, "advanced": advanced, "proposed": proposed}

    async def _reap_stale_canary(self) -> int:
        """强制回收超时 canary：样本不足视为未通过 → rollback（canary 已污染流量，回基线最安全）。

        canary 窗口到期但候选样本不足时 handler ``advance_canary`` 会 hold 续等，无此 REAP 则永久挂起。
        超 ``max_canary_seconds`` → 强制 rollback（复用对应 handler 的 rollback，零新路径）。
        """
        now = _utcnow()
        max_sec = settings.evolution.max_canary_seconds
        async with _session() as db:
            rows = (
                (
                    await db.execute(
                        sa.select(EvolutionProposal)
                        .where(EvolutionProposal.status.in_((STATUS_CANARY, STATUS_RUNTIME_CANARY)))
                        .with_for_update(skip_locked=True)
                        .limit(_BATCH_LIMIT)
                    )
                )
                .scalars()
                .all()
            )
            stale = [
                p
                for p in rows
                if is_canary_stale(
                    started_at=_parse_dt((p.canary_config or {}).get("started_at")),
                    now=now,
                    max_seconds=max_sec,
                )
            ]
            for p in stale:
                handler = self._handler_for(p.target_kind)
                if handler is None:
                    logger.warning("evolution_reap_no_handler", kind=p.target_kind, proposal_id=str(p.id))
                    continue
                await handler.rollback(db, p, now)
                p.canary_metrics = {
                    **(p.canary_metrics or {}),
                    "reaped_reason": REASON_STALE_CANARY,
                }
                logger.warning(
                    "evolution_canary_reaped_stale",
                    proposal_id=str(p.id),
                    max_seconds=max_sec,
                )
            await db.commit()
            return len(stale)

    # ==================================================================
    # RECHECK（纵向复评，综述 §8 #3 + §10.5 + §9.3 持续再认证）
    # ==================================================================

    async def recheck_promoted(self) -> dict[str, int]:
        """已晋升对象周期性复评：按 ``longitudinal_recheck_interval_seconds`` due-check，
        对有 eval 基座的面分派 ``handler.recheck_longitudinal``；drift 超阈则该 handler 回退
        ``active_version``（survey：已晋升对象不会自动再验证，须持续再认证）。

        灰度关闭时 no-op。由独立 ``longitudinal_recheck`` 调度任务驱动（默认 cron 每日，enabled=False）。
        """
        if not settings.evolution.enabled:
            return {"rechecked": 0, "reverted": 0}
        now = _utcnow()
        interval = settings.evolution.longitudinal_recheck_interval_seconds
        rechecked = 0
        reverted = 0
        async with _session() as db:
            props = (
                (
                    await db.execute(
                        sa.select(EvolutionProposal)
                        .where(EvolutionProposal.status == STATUS_PROMOTED)
                        .limit(_BATCH_LIMIT)
                    )
                )
                .scalars()
                .all()
            )
            for p in props:
                handler = self._handler_for(p.target_kind)
                recheck_fn = getattr(handler, "recheck_longitudinal", None) if handler else None
                if recheck_fn is None:
                    continue  # 该面无复评基座（如 retrieval 用在线 window 指标）
                if not await self._due_for_recheck(db, p, interval=interval, now=now):
                    continue
                try:
                    dec = await recheck_fn(db, p, now)
                    rechecked += 1
                    if getattr(dec, "is_rollback", False):
                        reverted += 1
                except Exception as exc:  # noqa: BLE001
                    logger.warning("evolution_recheck_failed", proposal_id=str(p.id), error=str(exc))
            await db.commit()
            return {"rechecked": rechecked, "reverted": reverted}

    @staticmethod
    async def _due_for_recheck(db, proposal, *, interval: int, now) -> bool:
        """最近一次 scheduled holdout 复评 run 是否早于 interval（或从未复评）→ 是否 due。"""
        from negentropy.models.eval_suite import RUN_PARTITION_HOLDOUT, RUN_TRIGGER_SCHEDULED, EvalRun

        last = (
            await db.execute(
                sa.select(EvalRun.created_at)
                .where(
                    EvalRun.target_kind == proposal.target_kind,
                    EvalRun.target_ref == proposal.target_ref,
                    EvalRun.target_version == proposal.proposed_version,
                    EvalRun.partition == RUN_PARTITION_HOLDOUT,
                    EvalRun.trigger == RUN_TRIGGER_SCHEDULED,
                )
                .order_by(EvalRun.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if last is None:
            return True
        return (now - last).total_seconds() >= interval

    # ==================================================================
    # ADVANCE
    # ==================================================================

    async def _advance_due_proposals(self) -> int:
        """推进 shadow_eval / canary 状态的 due 提案（按 target_kind 分派到 handler）。"""
        now = _utcnow()
        advanced = 0
        async with _session() as db:
            rows = (
                (
                    await db.execute(
                        sa.select(EvolutionProposal)
                        .where(EvolutionProposal.status.in_((STATUS_SHADOW_EVAL, STATUS_CANARY, STATUS_RUNTIME_CANARY)))
                        .with_for_update(skip_locked=True)
                        .limit(_BATCH_LIMIT)
                    )
                )
                .scalars()
                .all()
            )
            for p in rows:
                handler = self._handler_for(p.target_kind)
                if handler is None:
                    logger.warning("evolution_advance_no_handler", kind=p.target_kind, proposal_id=str(p.id))
                    continue
                if p.status == STATUS_SHADOW_EVAL:
                    await handler.advance_shadow(db, p, now)
                elif p.status == STATUS_CANARY:
                    await handler.advance_canary(db, p, now)
                elif p.status == STATUS_RUNTIME_CANARY:
                    await handler.advance_runtime_canary(db, p, now)
                advanced += 1
            await db.commit()
            return advanced


# =============================================================================
# 单例
# =============================================================================

_orchestrator: EvolutionOrchestrator | None = None


def get_evolution_orchestrator() -> EvolutionOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = EvolutionOrchestrator()
    return _orchestrator


# =============================================================================
# 内部：session 上下文（对齐原 db_session.AsyncSessionLocal 用法）
# =============================================================================


@asynccontextmanager
async def _session():
    async with db_session.AsyncSessionLocal() as db:
        yield db


__all__ = [
    "EvolutionOrchestrator",
    "get_evolution_orchestrator",
    # re-export（单测兼容）
    "_bump_patch",
    "_parse_dt",
    "_enter_canary",
    "_emit_evolution_event",
    "_summarize_metrics",
]
