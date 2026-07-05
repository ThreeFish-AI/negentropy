"""RetrievalConfigHandler —— retrieval_config 面（hybrid 检索 semantic/keyword 权重）的进化 handler。

从原 ``orchestrator.py`` 的 retrieval 硬编码逻辑（_advance_shadow / _advance_canary / _promote /
_rollback / _maybe_spawn_proposer / _spawn_proposal_bg）原样迁入，**行为逐字节等价**——byte-
equivalence 由 ``test_evolution_orchestrator_state_machine`` golden 集成测试守护。

不变量：advance_shadow / advance_canary / promote / rollback 不 commit（事务边界由 orchestrator
统一持有）；maybe_spawn 内部 bg task 自带 session + commit（与原 _spawn_proposal_bg 一致）。
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.logging import get_logger
from negentropy.models.evolution import (
    CONFIG_ORIGIN_EVOLUTION,
    CONFIG_ORIGIN_MANUAL,
    CONFIG_SCOPE_RETRIEVAL,
    ORIGIN_REFLECTION,
    PROPOSAL_NON_TERMINAL,
    RISK_LOW,
    STATUS_PENDING_APPROVAL,
    STATUS_PROMOTED,
    STATUS_REJECTED,
    STATUS_ROLLED_BACK,
    STATUS_SHADOW_EVAL,
    EvolutionProposal,
    MemoryConfigVersion,
)

from .. import eval_runner
from .. import weights as weights_mod
from ..decision import (
    REASON_PROMOTED,
    REASON_ROLLED_BACK,
    REASON_STALE_CANARY,
    decide_canary,
    decide_shadow,
    is_noop_mutation,
    is_repeated_direction,
    pre_propose_check,
)
from ..proposer import RetrievalWeightProposer
from ..queries import fetch_today_eval_cost as _fetch_today_eval_cost
from ..queries import invalidate_canary_cache
from ._shared import _bump_patch, _emit_evolution_event, _enter_canary, _td, _utcnow

logger = get_logger("negentropy.engine.evolution.retrieval")


class RetrievalConfigHandler:
    """retrieval_config 面进化 handler（target_kind = ``retrieval_config``）。"""

    target_kind = "retrieval_config"

    def __init__(self) -> None:
        self._target_ref = CONFIG_SCOPE_RETRIEVAL  # = config_scope
        self._proposer = RetrievalWeightProposer(model=settings.evolution.proposer_model)
        self._bg_tasks: set[asyncio.Task] = set()

    # ==================================================================
    # ADVANCE
    # ==================================================================

    async def advance_shadow(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """shadow_eval → canary | pending_approval | rejected。"""
        app_name = settings.app.name
        active_snapshot, active_version = await weights_mod.resolve_active_retrieval_config()
        baseline = await eval_runner.run_shadow_eval(
            app_name=app_name,
            active_version=active_version,
            window_seconds=settings.evolution.shadow_window_seconds,
        )
        proposed_sw = float((proposal.payload or {}).get("semantic_weight", 0.7))
        dec = decide_shadow(
            baseline=baseline,
            proposed_semantic_weight=proposed_sw,
            min_samples=settings.evolution.min_samples,
        )
        proposal.shadow_eval_result = {
            "baseline": baseline.to_dict(),
            "proposed_semantic_weight": proposed_sw,
            "decided_at": now.isoformat(),
        }

        if dec.action == "hold":
            # low + auto_mode → 直入 canary；否则待人审
            if proposal.risk_level == RISK_LOW and settings.evolution.auto_mode:
                _enter_canary(proposal, now)
            else:
                proposal.status = STATUS_PENDING_APPROVAL
                proposal.decided_at = now
        else:
            proposal.status = STATUS_REJECTED
            proposal.decided_at = now
        _emit_evolution_event(proposal, action=proposal.status, reason=dec.reason)
        logger.info(
            "evolution_shadow_decided",
            proposal_id=str(proposal.id),
            action=dec.action,
            reason=dec.reason,
        )

    async def advance_canary(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """canary 窗口到期 → promote | rollback | hold（未到期/样本不足续等）。"""
        started_at = _parse_started_at(proposal)
        window = settings.evolution.canary_window_seconds
        if started_at is not None and (now - started_at).total_seconds() < window:
            return  # 窗口未到期，留 canary 续攒样本

        app_name = settings.app.name
        baseline, candidate = await eval_runner.run_canary_eval(
            app_name=app_name,
            baseline_version=proposal.base_version,
            candidate_version=proposal.proposed_version,
            window_seconds=window,
        )
        proposal.canary_metrics = {
            "baseline": baseline.to_dict(),
            "candidate": candidate.to_dict(),
            "decided_at": now.isoformat(),
        }
        dec = decide_canary(
            baseline=baseline,
            candidate=candidate,
            min_samples=settings.evolution.min_samples,
            zero_hit_regression_max=settings.evolution.zero_hit_regression_max,
        )
        if dec.is_promote:
            await self._promote(db, proposal, now)
        elif dec.is_rollback:
            await self._rollback(db, proposal, now)
        # hold（样本不足）→ 留 canary 续等（窗口已过但仍不足，下次 tick 再判；可由 REAP 超时兜底）
        logger.info(
            "evolution_canary_decided",
            proposal_id=str(proposal.id),
            action=dec.action,
            reason=dec.reason,
        )

    # ==================================================================
    # SPAWN proposer
    # ==================================================================

    async def maybe_spawn(self) -> int:
        """单在途（per target_ref）+ 预算守卫 + 样本充足 → bg task 调 proposer 落 shadow_eval 提案行。"""
        if not settings.evolution.proposer_enabled:
            return 0
        async with db_session.AsyncSessionLocal() as db:
            inflight = (
                await db.execute(
                    sa.select(sa.func.count())
                    .select_from(EvolutionProposal)
                    .where(
                        EvolutionProposal.target_ref == self._target_ref,
                        EvolutionProposal.status.in_(PROPOSAL_NON_TERMINAL),
                    )
                )
            ).scalar_one()
            proposals_today = (
                await db.execute(
                    sa.select(sa.func.count())
                    .select_from(EvolutionProposal)
                    .where(
                        EvolutionProposal.target_ref == self._target_ref,
                        EvolutionProposal.created_at >= _utcnow() - _td(days=1),
                    )
                )
            ).scalar_one()
        budget = pre_propose_check(
            inflight_count=inflight or 0,
            proposals_today=proposals_today or 0,
            max_proposals_per_day=settings.evolution.max_proposals_per_day,
            # R8-c D7 绕过：聚合 eval_runs.cost_total（真实 $-cost，R4-b+R5），不依赖 tool_invocations.cost_usd
            cost_today_usd=await _fetch_today_eval_cost(),
            max_cost_usd_daily=settings.evolution.max_cost_usd_daily,
        )
        if budget.action == "skip":
            logger.info("evolution_spawn_skipped", reason=budget.reason, detail=budget.detail)
            return 0

        loop = asyncio.get_running_loop()
        task = loop.create_task(self._spawn_proposal_bg())
        self._bg_tasks.add(task)
        task.add_done_callback(self._bg_tasks.discard)
        return 1

    async def _spawn_proposal_bg(self) -> None:
        """bg：读窗口指标 + active 配置 + 近期负样本 → propose → 落 shadow_eval 提案行。"""
        try:
            app_name = settings.app.name
            active_snapshot, active_version = await weights_mod.resolve_active_retrieval_config()
            window_seconds = settings.evolution.shadow_window_seconds
            since = datetime.now(UTC) - _td(seconds=window_seconds)
            window_metrics = (
                await eval_runner.aggregate_window(app_name=app_name, config_version=active_version, since=since)
            ).to_dict()
            recent_negatives = await _fetch_recent_negatives(self, limit=5)

            draft = await self._proposer.propose(
                active_snapshot=active_snapshot,
                window_metrics=window_metrics,
                recent_negatives=recent_negatives,
                min_samples=settings.evolution.min_samples,
            )
            if draft is None:
                return  # 冷启动 / no_change / LLM 失败 → 不提案

            # no-op / 防振荡硬护栏（综述 §3.5 DGM archive）：proposer prompt 软约束的确定性兜底
            active_sw = float(active_snapshot.get("semantic_weight", 0.7))
            negatives_sw = [float((n.get("payload") or {}).get("semantic_weight", 0.0)) for n in recent_negatives]
            if is_noop_mutation(draft.semantic_weight, active_sw):
                logger.info("evolution_spawn_noop", draft=draft.semantic_weight, active=active_sw)
                return
            if is_repeated_direction(draft.semantic_weight, negatives_sw):
                logger.info("evolution_spawn_oscillation", draft=draft.semantic_weight, negatives=negatives_sw)
                return

            async with db_session.AsyncSessionLocal() as db:
                # 再次确认单在途（bg 期间可能有别处入了提案）
                exists = (
                    await db.execute(
                        sa.select(sa.func.count())
                        .select_from(EvolutionProposal)
                        .where(
                            EvolutionProposal.target_ref == self._target_ref,
                            EvolutionProposal.status.in_(PROPOSAL_NON_TERMINAL),
                        )
                    )
                ).scalar_one()
                if exists and exists > 0:
                    return
                db.add(
                    EvolutionProposal(
                        target_kind=self.target_kind,
                        target_ref=self._target_ref,
                        base_version=active_version,
                        proposed_version=_bump_patch(active_version),
                        payload={
                            "semantic_weight": draft.semantic_weight,
                            "keyword_weight": draft.keyword_weight,
                        },
                        origin=ORIGIN_REFLECTION,
                        rationale=draft.rationale or None,
                        evidence={"window": window_metrics, "expected_effect": draft.expected_effect},
                        status=STATUS_SHADOW_EVAL,
                        risk_level=RISK_LOW,
                    )
                )
                await db.commit()
            logger.info(
                "evolution_proposal_spawned",
                semantic_weight=draft.semantic_weight,
                base=active_version,
            )
        except Exception as exc:
            logger.warning("evolution_spawn_failed", error=str(exc))

    # ==================================================================
    # promote / rollback
    # ==================================================================

    async def _promote(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """候选晋升：新写 MemoryConfigVersion(is_active=true) + 旧 active 置 false + 失效缓存。"""
        await _flip_active(
            db,
            config_scope=self._target_ref,
            new_version=proposal.proposed_version,
            snapshot=dict(proposal.payload or {}),
            origin=CONFIG_ORIGIN_EVOLUTION,
            rationale=proposal.rationale,
        )
        proposal.status = STATUS_PROMOTED
        proposal.decided_at = now
        weights_mod.invalidate(self._target_ref)
        invalidate_canary_cache(self._target_ref)  # 消除 fetch_active_canary 15s 缓存脏窗口
        _emit_evolution_event(
            proposal,
            action="promote",
            reason=REASON_PROMOTED,
            metrics=(proposal.canary_metrics or {}).get("candidate"),
        )

    async def _rollback(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """回滚：新写一条 active=旧基线快照（origin=manual），不删候选行（保留全历史）。"""
        base_snapshot, _ = await weights_mod.resolve_active_retrieval_config()
        # 取基线版本快照（回滚目标）
        base_row = (
            await db.execute(
                sa.select(MemoryConfigVersion).where(
                    MemoryConfigVersion.config_scope == self._target_ref,
                    MemoryConfigVersion.version == proposal.base_version,
                )
            )
        ).scalar_one_or_none()
        snapshot = dict(base_row.snapshot) if base_row is not None else base_snapshot
        await _flip_active(
            db,
            config_scope=self._target_ref,
            new_version=_bump_patch(proposal.base_version, suffix="rollback"),
            snapshot=snapshot,
            origin=CONFIG_ORIGIN_MANUAL,
            rationale=f"rollback 候选 {proposal.proposed_version}（退化）",
        )
        proposal.status = STATUS_ROLLED_BACK
        proposal.decided_at = now
        weights_mod.invalidate(self._target_ref)
        invalidate_canary_cache(self._target_ref)  # 消除 fetch_active_canary 15s 缓存脏窗口
        _emit_evolution_event(
            proposal,
            action="rollback",
            reason=REASON_STALE_CANARY if (proposal.canary_metrics or {}).get("reaped_reason") else REASON_ROLLED_BACK,
            metrics=(proposal.canary_metrics or {}).get("candidate"),
        )

    # 抽象基类契约：rollback 暴露给 orchestrator REAP 用（= 内部 _rollback）
    async def rollback(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        await self._rollback(db, proposal, now)


# =============================================================================
# 模块级辅助（retrieval 面 private）
# =============================================================================


def _parse_started_at(proposal: EvolutionProposal):
    from ._shared import _parse_dt

    return _parse_dt((proposal.canary_config or {}).get("started_at"))


async def _flip_active(
    db,
    *,
    config_scope: str,
    new_version: str,
    snapshot: dict[str, Any],
    origin: str,
    rationale: str | None,
) -> None:
    """旧 active 置 false → 新写一行 is_active=true（原子翻转）。"""
    await db.execute(
        sa.update(MemoryConfigVersion)
        .where(
            MemoryConfigVersion.config_scope == config_scope,
            MemoryConfigVersion.is_active.is_(True),
        )
        .values(is_active=False)
    )
    db.add(
        MemoryConfigVersion(
            config_scope=config_scope,
            version=new_version,
            snapshot=snapshot,
            origin=origin,
            is_active=True,
            rationale=rationale,
        )
    )


async def _fetch_recent_negatives(handler: RetrievalConfigHandler, *, limit: int = 5) -> list[dict[str, Any]]:
    """取近期待 eval proposer 避开的负样本（rejected/rolled_back，recent）。"""
    async with db_session.AsyncSessionLocal() as db:
        rows = (
            (
                await db.execute(
                    sa.select(EvolutionProposal)
                    .where(
                        EvolutionProposal.target_ref == handler._target_ref,
                        EvolutionProposal.status.in_((STATUS_REJECTED, STATUS_ROLLED_BACK)),
                    )
                    .order_by(EvolutionProposal.created_at.desc())
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
    return [{"payload": p.payload, "status": p.status, "rationale": p.rationale} for p in rows]
