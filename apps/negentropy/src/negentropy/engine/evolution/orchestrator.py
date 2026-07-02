"""EvolutionOrchestrator —— 自进化提案状态机 tick（对齐 routine orchestrator 三段式）。

``inspect_once()`` 由 ``evolution_inspector`` 心跳（默认 300s）驱动，三段式：

  (a) REAP    — 终态清理（目前为 no-op 占位；canary 超时回收见 ADVANCE 内联）；
  (b) ADVANCE — 推进 due 提案状态机：
                shadow_eval → (low+auto: canary | else: pending_approval) | rejected
                canary（窗口到期） → promote | rollback | hold（样本不足续等）
  (c) SPAWN   — 单在途检查 + 样本充足 → bg task 调 proposer → 落 shadow_eval 提案行

并发幂等：``FOR UPDATE SKIP LOCKED`` 抢占提案行 + ``uq_evolution_proposals_one_inflight``
部分唯一索引兜底（每 target_ref 至多一个非终态提案）。proposer / 聚合重活在 bg task /
ADVANCE 内，inspect_once 恒轻量（< 5s，远低于 tick）。

灰度：``settings.evolution.enabled=False`` 时 ``inspect_once`` 直接 no-op 返回。

参考文献：
[1] J. Zhang et al., "Darwin Gödel machine," arXiv:2505.22954, 2025. 档案库进化 + 评估门控。
[2] PostgreSQL Docs, *FOR UPDATE SKIP LOCKED*. 并发 tick 幂等。
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

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
    STATUS_CANARY,
    STATUS_PENDING_APPROVAL,
    STATUS_PROMOTED,
    STATUS_REJECTED,
    STATUS_ROLLED_BACK,
    STATUS_SHADOW_EVAL,
    TARGET_KIND_RETRIEVAL_CONFIG,
    EvolutionProposal,
    MemoryConfigVersion,
)

from . import eval_runner
from . import weights as weights_mod
from .decision import decide_canary, decide_shadow
from .proposer import RetrievalWeightProposer

logger = get_logger("negentropy.engine.evolution.orchestrator")

_BATCH_LIMIT = 10
_TARGET_REF = CONFIG_SCOPE_RETRIEVAL  # retrieval_config 面的 target_ref（= config_scope）


class EvolutionOrchestrator:
    """单例（经 ``get_evolution_orchestrator``），对齐 RoutineOrchestrator 范式。"""

    def __init__(self) -> None:
        self._proposer = RetrievalWeightProposer(model=settings.evolution.proposer_model)
        self._bg_tasks: set[asyncio.Task] = set()

    async def inspect_once(self) -> dict[str, int]:
        """三段式 tick。灰度关闭时 no-op。"""
        if not settings.evolution.enabled:
            return {"reaped": 0, "advanced": 0, "proposed": 0}

        advanced = await self._advance_due_proposals()
        # proposer 仅在无在途提案时 spawn（单在途不变量）；auto_mode 关闭时也允许 spawn
        # （提案落 shadow_eval 后停在 pending_approval 待人审）。
        proposed = await self._maybe_spawn_proposer()
        return {"reaped": 0, "advanced": advanced, "proposed": proposed}

    # ==================================================================
    # ADVANCE
    # ==================================================================

    async def _advance_due_proposals(self) -> int:
        """推进 shadow_eval / canary 状态的 due 提案。"""
        now = _utcnow()
        async with db_session.AsyncSessionLocal() as db:
            rows = (
                (
                    await db.execute(
                        sa.select(EvolutionProposal)
                        .where(EvolutionProposal.status.in_((STATUS_SHADOW_EVAL, STATUS_CANARY)))
                        .with_for_update(skip_locked=True)
                        .limit(_BATCH_LIMIT)
                    )
                )
                .scalars()
                .all()
            )
            for p in rows:
                if p.status == STATUS_SHADOW_EVAL:
                    await self._advance_shadow(db, p, now)
                elif p.status == STATUS_CANARY:
                    await self._advance_canary(db, p, now)
            await db.commit()
            return len(rows)

    async def _advance_shadow(self, db, proposal: EvolutionProposal, now: datetime) -> None:
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
        logger.info(
            "evolution_shadow_decided",
            proposal_id=str(proposal.id),
            action=dec.action,
            reason=dec.reason,
        )

    async def _advance_canary(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """canary 窗口到期 → promote | rollback | hold（未到期/样本不足续等）。"""
        started_at = _parse_dt((proposal.canary_config or {}).get("started_at"))
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

    async def _maybe_spawn_proposer(self) -> int:
        """单在途检查 + 样本充足 → bg task 调 proposer 落 shadow_eval 提案行。"""
        if not settings.evolution.proposer_enabled:
            return 0
        # 单在途：target_ref 已有非终态提案 → skip
        async with db_session.AsyncSessionLocal() as db:
            inflight = (
                await db.execute(
                    sa.select(sa.func.count())
                    .select_from(EvolutionProposal)
                    .where(
                        EvolutionProposal.target_ref == _TARGET_REF,
                        EvolutionProposal.status.in_(PROPOSAL_NON_TERMINAL),
                    )
                )
            ).scalar_one()
        if inflight and inflight > 0:
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
            recent_negatives = await _fetch_recent_negatives(limit=5)

            draft = await self._proposer.propose(
                active_snapshot=active_snapshot,
                window_metrics=window_metrics,
                recent_negatives=recent_negatives,
                min_samples=settings.evolution.min_samples,
            )
            if draft is None:
                return  # 冷启动 / no_change / LLM 失败 → 不提案

            async with db_session.AsyncSessionLocal() as db:
                # 再次确认单在途（bg 期间可能有别处入了提案）
                exists = (
                    await db.execute(
                        sa.select(sa.func.count())
                        .select_from(EvolutionProposal)
                        .where(
                            EvolutionProposal.target_ref == _TARGET_REF,
                            EvolutionProposal.status.in_(PROPOSAL_NON_TERMINAL),
                        )
                    )
                ).scalar_one()
                if exists and exists > 0:
                    return
                db.add(
                    EvolutionProposal(
                        target_kind=TARGET_KIND_RETRIEVAL_CONFIG,
                        target_ref=_TARGET_REF,
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
            config_scope=_TARGET_REF,
            new_version=proposal.proposed_version,
            snapshot=dict(proposal.payload or {}),
            origin=CONFIG_ORIGIN_EVOLUTION,
            rationale=proposal.rationale,
        )
        proposal.status = STATUS_PROMOTED
        proposal.decided_at = now
        weights_mod.invalidate(_TARGET_REF)

    async def _rollback(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """回滚：新写一条 active=旧基线快照（origin=manual），不删候选行（保留全历史）。"""
        base_snapshot, _ = await weights_mod.resolve_active_retrieval_config()
        # 取基线版本快照（回滚目标）
        base_row = (
            await db.execute(
                sa.select(MemoryConfigVersion).where(
                    MemoryConfigVersion.config_scope == _TARGET_REF,
                    MemoryConfigVersion.version == proposal.base_version,
                )
            )
        ).scalar_one_or_none()
        snapshot = dict(base_row.snapshot) if base_row is not None else base_snapshot
        await _flip_active(
            db,
            config_scope=_TARGET_REF,
            new_version=_bump_patch(proposal.base_version, suffix="rollback"),
            snapshot=snapshot,
            origin=CONFIG_ORIGIN_MANUAL,
            rationale=f"rollback 候选 {proposal.proposed_version}（退化）",
        )
        proposal.status = STATUS_ROLLED_BACK
        proposal.decided_at = now
        weights_mod.invalidate(_TARGET_REF)


# =============================================================================
# 模块级辅助（pure / 小 IO）
# =============================================================================


def _enter_canary(proposal: EvolutionProposal, now: datetime) -> None:
    """shadow 通过 → 进入 canary：设状态 + canary_config（比例/窗口/起始时间）。"""
    proposal.status = STATUS_CANARY
    proposal.canary_config = {
        "bucket_ratio": settings.evolution.canary_bucket_ratio_pct,
        "window_seconds": settings.evolution.canary_window_seconds,
        "started_at": now.isoformat(),
        "min_samples": settings.evolution.min_samples,
    }
    proposal.decided_at = now


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


async def _fetch_recent_negatives(*, limit: int = 5) -> list[dict[str, Any]]:
    """取近期待 eval proposer 避开的负样本（rejected/rolled_back，recent）。"""
    async with db_session.AsyncSessionLocal() as db:
        rows = (
            (
                await db.execute(
                    sa.select(EvolutionProposal)
                    .where(
                        EvolutionProposal.target_ref == _TARGET_REF,
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


def _bump_patch(version: str, suffix: str = "") -> str:
    """SemVer patch 位 +1（0.1.0 → 0.1.1）；解析失败回退 '0.1.x'。仅作候选标识，不强制全局唯一。"""
    try:
        parts = version.split(".")
        parts[-1] = str(int(parts[-1]) + 1)
        new = ".".join(parts)
        return f"{new}-{suffix}" if suffix else new
    except (ValueError, IndexError):
        return f"0.1.{uuid4().int % 1000}"


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _td(*, seconds: int):
    from datetime import timedelta

    return timedelta(seconds=seconds)


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


# =============================================================================
# 单例
# =============================================================================

_orchestrator: EvolutionOrchestrator | None = None


def get_evolution_orchestrator() -> EvolutionOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = EvolutionOrchestrator()
    return _orchestrator


__all__ = ["EvolutionOrchestrator", "get_evolution_orchestrator"]
