"""AgentPromptHandler —— agent_prompt 面（第六进化面，综述 §7 + ADR-3 Sync改造）。

Faculty agent ``system_prompt`` 进化。版本基座：``agent_versions`` 快照表 +
``agents.active_version`` 指针。ADR-3 Sync：``sync_negentropy_agents`` 继续覆写
``agents.system_prompt``（代码基线），``_load_subagent_row`` 在 ``active_version`` 非 NULL 时
改读快照（进化版本不受 sync 影响）。promote = 翻 ``agents.active_version``。

与 ``KnowledgeStrategyHandler`` / ``BuiltinToolConfigHandler`` 同构（eval-driven loop）。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import sqlalchemy as sa

from negentropy.config import settings
from negentropy.engine.evolution.decision import decide_skill_canary, decide_skill_shadow
from negentropy.engine.evolution.handlers._shared import _emit_evolution_event, _enter_canary
from negentropy.logging import get_logger
from negentropy.models.agent import Agent, AgentVersion
from negentropy.models.eval_suite import RUN_PARTITION_HOLDOUT, RUN_PARTITION_VISIBLE, EvalSuite
from negentropy.models.evolution import (
    RISK_LOW,
    STATUS_PENDING_APPROVAL,
    STATUS_PROMOTED,
    STATUS_REJECTED,
    EvolutionProposal,
)

from .skill import _run_view

logger = get_logger("negentropy.engine.evolution.agent_prompt")


class AgentPromptHandler:
    """agent_prompt 面进化 handler（target_kind = ``agent_prompt``）。"""

    target_kind = "agent_prompt"

    def __init__(self, *, runner: Any | None = None) -> None:
        if runner is None:
            from negentropy.engine.eval.runner import AgentExecutor, SuiteRunner

            runner = SuiteRunner(executors={"agent": AgentExecutor()})
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
        """promote = 翻 ``agents.active_version`` 到候选；候选 AgentVersion 缺失则从 payload 建。"""
        agent = await self._load_agent(db, proposal.target_ref)
        if agent is not None:
            exists = (
                await db.execute(
                    sa.select(AgentVersion).where(
                        AgentVersion.agent_id == agent.id,
                        AgentVersion.version == proposal.proposed_version,
                    )
                )
            ).scalar_one_or_none()
            if exists is None:
                db.add(
                    AgentVersion(
                        agent_id=agent.id,
                        version=proposal.proposed_version,
                        snapshot={
                            "system_prompt": str((proposal.payload or {}).get("system_prompt") or ""),
                        },
                    )
                )
            agent.active_version = proposal.proposed_version
        proposal.status = STATUS_PROMOTED
        proposal.decided_at = now
        # 失效 subagent 缓存（model_resolver 60s TTL），使 evolved system_prompt 翻指针后立即生效
        from negentropy.config.model_resolver import invalidate_cache

        invalidate_cache(prefix="subagent:")
        _emit_evolution_event(proposal, action="promote", reason="promoted")

    async def _rollback(self, db, proposal: EvolutionProposal, now: datetime, *, reason: str | None = None) -> None:
        proposal.status = "rolled_back"
        proposal.decided_at = now
        _emit_evolution_event(proposal, action="rollback", reason=reason or "rolled_back")

    async def rollback(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        await self._rollback(db, proposal, now, reason="stale_canary_timeout")

    async def maybe_spawn(self) -> int:
        if not settings.evolution.agent_prompt_enabled:
            return 0
        return 0  # proposer 留后续；本切片验证闭环

    @staticmethod
    async def _find_suite(db, agent_name: str) -> EvalSuite | None:
        from negentropy.models.eval_suite import TARGET_KIND_AGENT

        return (
            await db.execute(
                sa.select(EvalSuite)
                .where(EvalSuite.target_kind == TARGET_KIND_AGENT, EvalSuite.target_ref == agent_name)
                .order_by(EvalSuite.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    async def _run_pair(self, db, *, suite: EvalSuite, proposal: EvolutionProposal, partition: str):
        from negentropy.models.eval_suite import TARGET_KIND_AGENT

        base = await self._runner.run_suite(
            db,
            suite=suite,
            target_kind=TARGET_KIND_AGENT,
            target_ref=proposal.target_ref,
            target_version=proposal.base_version,
            partition=partition,
            trigger="proposal",
        )
        cand = await self._runner.run_suite(
            db,
            suite=suite,
            target_kind=TARGET_KIND_AGENT,
            target_ref=proposal.target_ref,
            target_version=proposal.proposed_version,
            baseline_version=proposal.base_version,
            partition=partition,
            trigger="proposal",
        )
        return base, cand

    @staticmethod
    async def _load_agent(db, agent_name: str) -> Agent | None:
        return (await db.execute(sa.select(Agent).where(Agent.name == agent_name))).scalar_one_or_none()
