"""KnowledgeStrategyHandler —— knowledge_strategy 面（第五进化面，综述 §7）。

把综述 §3.5 Evolution 范式推广到**知识图谱抽取策略**（entity/relation extraction prompts +
entity resolution threshold）：候选策略经 SuiteRunner + ``decide_skill_*`` 双相门验证后，
promote 翻 ``memory_config_versions`` active 指针。**TargetHandler 第五面**。

版本基座：``memory_config_versions``（``config_scope = target_ref``，如 ``knowledge_strategy``），
snapshot = ``{"entity_prompt": "...", "relation_prompt": "...", "ann_threshold": 0.85}``。
eval 指标 = ``knowledge/graph/quality.py`` 综合质量分（completeness/coverage/confidence/evidence）。
运行时消费（extractor 读 active prompts）是后续接线——promote 已翻指针。

与 ``MemoryPipelinePromptHandler`` 同构（eval-driven loop + memory_config_versions 版本基座）。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import sqlalchemy as sa

from negentropy.config import settings
from negentropy.engine.evolution.decision import decide_skill_canary, decide_skill_shadow
from negentropy.engine.evolution.handlers._shared import _emit_evolution_event, _enter_canary
from negentropy.logging import get_logger
from negentropy.models.eval_suite import RUN_PARTITION_HOLDOUT, RUN_PARTITION_VISIBLE, EvalSuite
from negentropy.models.evolution import (
    CONFIG_ORIGIN_EVOLUTION,
    RISK_LOW,
    STATUS_PENDING_APPROVAL,
    STATUS_PROMOTED,
    STATUS_REJECTED,
    EvolutionProposal,
    MemoryConfigVersion,
)

from .skill import _run_view

logger = get_logger("negentropy.engine.evolution.knowledge_strategy")


class KnowledgeStrategyHandler:
    """knowledge_strategy 面进化 handler（target_kind = ``knowledge_strategy``）。"""

    target_kind = "knowledge_strategy"

    def __init__(self, *, runner: Any | None = None) -> None:
        if runner is None:
            from negentropy.engine.eval.runner import KgExecutor, SuiteRunner

            runner = SuiteRunner(executors={"kg_extraction": KgExecutor()})
        self._runner = runner

    async def advance_shadow(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        suite = await self._find_suite(db, proposal.target_ref)
        if suite is None:
            proposal.status = STATUS_REJECTED
            proposal.decided_at = now
            _emit_evolution_event(proposal, action=proposal.status, reason="no_eval_suite")
            return
        base_run, cand_run = await self._run_pair(db, suite=suite, proposal=proposal, partition=RUN_PARTITION_VISIBLE)
        proposal.shadow_eval_result = {
            "baseline_mean": base_run.score_mean,
            "candidate_mean": cand_run.score_mean,
            "decided_at": now.isoformat(),
        }
        dec = decide_skill_shadow(baseline=await _run_view(db, base_run), candidate=await _run_view(db, cand_run))
        if dec.action == "hold":
            if proposal.risk_level == RISK_LOW and settings.evolution.auto_mode:
                _enter_canary(proposal, now)
            else:
                proposal.status = STATUS_PENDING_APPROVAL
                proposal.decided_at = now
        else:
            proposal.status = STATUS_REJECTED
            proposal.decided_at = now
        _emit_evolution_event(proposal, action=proposal.status, reason=dec.reason)

    async def advance_canary(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        suite = await self._find_suite(db, proposal.target_ref)
        if suite is None:
            await self._rollback(db, proposal, now)
            return
        base_run, cand_run = await self._run_pair(db, suite=suite, proposal=proposal, partition=RUN_PARTITION_HOLDOUT)
        proposal.canary_metrics = {
            "baseline_mean": base_run.score_mean,
            "candidate_mean": cand_run.score_mean,
            "decided_at": now.isoformat(),
        }
        dec = decide_skill_canary(baseline=await _run_view(db, base_run), candidate=await _run_view(db, cand_run))
        if dec.is_promote:
            await self._promote(db, proposal, now)
        elif dec.is_rollback:
            await self._rollback(db, proposal, now, reason=dec.reason)

    async def _promote(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """promote = 翻 ``memory_config_versions`` is_active 指针（同 MemoryPipelinePromptHandler）。"""
        await db.execute(
            sa.update(MemoryConfigVersion)
            .where(
                MemoryConfigVersion.config_scope == proposal.target_ref,
                MemoryConfigVersion.is_active.is_(True),
            )
            .values(is_active=False)
        )
        await db.execute(
            sa.update(MemoryConfigVersion)
            .where(
                MemoryConfigVersion.config_scope == proposal.target_ref,
                MemoryConfigVersion.version == proposal.proposed_version,
            )
            .values(is_active=True, origin=CONFIG_ORIGIN_EVOLUTION, rationale=proposal.rationale)
        )
        proposal.status = STATUS_PROMOTED
        proposal.decided_at = now
        from negentropy.engine.evolution import weights as weights_mod

        weights_mod.invalidate(proposal.target_ref)
        _emit_evolution_event(proposal, action="promote", reason="promoted")

    async def _rollback(self, db, proposal: EvolutionProposal, now: datetime, *, reason: str | None = None) -> None:
        proposal.status = "rolled_back"
        proposal.decided_at = now
        _emit_evolution_event(proposal, action="rollback", reason=reason or "rolled_back")

    async def rollback(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        await self._rollback(db, proposal, now, reason="stale_canary_timeout")

    async def maybe_spawn(self) -> int:
        if not settings.evolution.knowledge_strategy_enabled:
            return 0
        return 0  # proposer 留后续（KG 抽取 prompt 变异）；本切片验证闭环

    @staticmethod
    async def _find_suite(db, scope: str) -> EvalSuite | None:
        from negentropy.models.eval_suite import TARGET_KIND_KG_EXTRACTION

        return (
            await db.execute(
                sa.select(EvalSuite)
                .where(EvalSuite.target_kind == TARGET_KIND_KG_EXTRACTION, EvalSuite.target_ref == scope)
                .order_by(EvalSuite.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    async def _run_pair(self, db, *, suite: EvalSuite, proposal: EvolutionProposal, partition: str):
        from negentropy.models.eval_suite import TARGET_KIND_KG_EXTRACTION

        base = await self._runner.run_suite(
            db,
            suite=suite,
            target_kind=TARGET_KIND_KG_EXTRACTION,
            target_ref=proposal.target_ref,
            target_version=proposal.base_version,
            partition=partition,
            trigger="proposal",
        )
        cand = await self._runner.run_suite(
            db,
            suite=suite,
            target_kind=TARGET_KIND_KG_EXTRACTION,
            target_ref=proposal.target_ref,
            target_version=proposal.proposed_version,
            baseline_version=proposal.base_version,
            partition=partition,
            trigger="proposal",
        )
        return base, cand
