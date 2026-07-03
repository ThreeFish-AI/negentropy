"""MemoryPipelinePromptHandler —— memory_pipeline_prompt 面（第三进化面，综述 §7）。

把综述 §3.5 的 Evolution 范式从 skill 推广到**记忆管线 prompt**（extractor / reflection / summarizer）：
候选 prompt 经 SuiteRunner + ``decide_skill_*`` 双相门验证后，promote 翻 ``memory_config_versions``
active 指针。**证明 ``TargetHandler`` 抽象 + eval 基座 target-agnostic**——第三面接入零改 orchestrator，
仅一个 handler 子类。

版本基座：``memory_config_versions``（``config_scope = target_ref``，如 ``pipeline_prompt``），
snapshot = ``{"prompt": "...", "expected_format": ...}``。运行时消费（consolidator 读 active prompt）
是后续接线（promote 已翻指针，consolidator 经 ``weights.resolve_active_retrieval_config`` 同款 helper 读取）。

与 ``SkillTemplateHandler`` 同构（eval-driven loop）；未来可抽 ``EvalDrivenHandler`` 共享基类去重。
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.engine.evolution.decision import decide_skill_canary, decide_skill_shadow, is_noop_template
from negentropy.engine.evolution.handlers._shared import _emit_evolution_event, _enter_canary
from negentropy.engine.evolution.proposer import _ProposerBase
from negentropy.engine.utils.json_extract import loads_lenient
from negentropy.logging import get_logger
from negentropy.models.eval_suite import (
    RUN_PARTITION_HOLDOUT,
    RUN_PARTITION_VISIBLE,
    TARGET_KIND_MEMORY_PIPELINE_PROMPT,
    EvalSuite,
)
from negentropy.models.evolution import (
    CONFIG_ORIGIN_EVOLUTION,
    ORIGIN_REFLECTION,
    PROPOSAL_NON_TERMINAL,
    RISK_LOW,
    STATUS_PENDING_APPROVAL,
    STATUS_PROMOTED,
    STATUS_REJECTED,
    STATUS_SHADOW_EVAL,
    EvolutionProposal,
    MemoryConfigVersion,
)

from ._shared import _bump_patch
from .skill import _run_view

logger = get_logger("negentropy.engine.evolution.memory_pipeline")


class MemoryPipelinePromptHandler:
    """memory_pipeline_prompt 面进化 handler（target_kind = ``memory_pipeline_prompt``）。"""

    target_kind = TARGET_KIND_MEMORY_PIPELINE_PROMPT

    def __init__(self, *, runner: Any | None = None, proposer: PipelinePromptProposer | None = None) -> None:
        if runner is None:
            from negentropy.engine.eval.runner import PromptExecutor, SuiteRunner

            runner = SuiteRunner(executors={self.target_kind: PromptExecutor()})
        self._runner = runner
        self._proposer = proposer or PipelinePromptProposer(model=settings.evolution.proposer_model)
        self._bg_tasks: set[asyncio.Task] = set()

    # ==================================================================
    # ADVANCE
    # ==================================================================

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

    # ==================================================================
    # promote / rollback（翻 memory_config_versions active 指针）
    # ==================================================================

    async def _promote(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """promote = 翻 ``memory_config_versions`` 的 is_active 指针到候选行（候选行 spawn 期已建，不新建）。"""
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
        # 失效管线 prompt 缓存，使 consolidator 立即读到新 active prompt（30s TTL 强一致刷新）
        from negentropy.engine.evolution import weights as weights_mod

        weights_mod.invalidate(proposal.target_ref)
        _emit_evolution_event(proposal, action="promote", reason="promoted")

    async def _rollback(self, db, proposal: EvolutionProposal, now: datetime, *, reason: str | None = None) -> None:
        proposal.status = "rolled_back"
        proposal.decided_at = now
        _emit_evolution_event(proposal, action="rollback", reason=reason or "rolled_back")

    async def rollback(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        await self._rollback(db, proposal, now, reason="stale_canary_timeout")

    # ==================================================================
    # SPAWN proposer
    # ==================================================================

    async def maybe_spawn(self) -> int:
        if not settings.evolution.memory_pipeline_enabled:
            return 0
        loop = asyncio.get_running_loop()
        task = loop.create_task(self._spawn_bg())
        self._bg_tasks.add(task)
        task.add_done_callback(self._bg_tasks.discard)
        return 1

    async def _spawn_bg(self) -> None:
        """扫有绑定 eval suite 的 config_scope → propose → 落 shadow_eval 提案 + 候选 version 行。"""
        try:
            async with db_session.AsyncSessionLocal() as db:
                scopes = (
                    (
                        await db.execute(
                            sa.select(EvalSuite.target_ref).where(EvalSuite.target_kind == self.target_kind).distinct()
                        )
                    )
                    .scalars()
                    .all()
                )
                for scope in scopes:
                    inflight = (
                        await db.execute(
                            sa.select(sa.func.count())
                            .select_from(EvolutionProposal)
                            .where(
                                EvolutionProposal.target_kind == self.target_kind,
                                EvolutionProposal.target_ref == scope,
                                EvolutionProposal.status.in_(PROPOSAL_NON_TERMINAL),
                            )
                        )
                    ).scalar_one()
                    if inflight:
                        continue
                    active_snap, active_ver = await self._active_snapshot(db, scope)
                    if not active_ver:
                        continue
                    draft = await self._proposer.propose(
                        scope_name=scope, active_prompt=str(active_snap.get("prompt") or "")
                    )
                    if draft is None:
                        continue
                    proposed = _bump_patch(active_ver)
                    db.add(
                        MemoryConfigVersion(
                            config_scope=scope,
                            version=proposed,
                            snapshot={"prompt": draft.prompt},
                            origin=CONFIG_ORIGIN_EVOLUTION,
                            rationale=draft.rationale,
                        )
                    )
                    db.add(
                        EvolutionProposal(
                            target_kind=self.target_kind,
                            target_ref=scope,
                            base_version=active_ver,
                            proposed_version=proposed,
                            payload={"prompt": draft.prompt},
                            origin=ORIGIN_REFLECTION,
                            rationale=draft.rationale or None,
                            status=STATUS_SHADOW_EVAL,
                            risk_level=RISK_LOW,
                        )
                    )
                    await db.commit()
                    logger.info("memory_pipeline_proposal_spawned", scope=scope, proposed=proposed)
        except Exception as exc:
            logger.warning("memory_pipeline_spawn_failed", error=str(exc))

    # ==================================================================
    # 内部辅助
    # ==================================================================

    @staticmethod
    async def _find_suite(db, scope: str) -> EvalSuite | None:
        return (
            await db.execute(
                sa.select(EvalSuite)
                .where(EvalSuite.target_kind == TARGET_KIND_MEMORY_PIPELINE_PROMPT, EvalSuite.target_ref == scope)
                .order_by(EvalSuite.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    async def _run_pair(self, db, *, suite: EvalSuite, proposal: EvolutionProposal, partition: str):
        base = await self._runner.run_suite(
            db,
            suite=suite,
            target_kind=self.target_kind,
            target_ref=proposal.target_ref,
            target_version=proposal.base_version,
            partition=partition,
            trigger="proposal",
        )
        cand = await self._runner.run_suite(
            db,
            suite=suite,
            target_kind=self.target_kind,
            target_ref=proposal.target_ref,
            target_version=proposal.proposed_version,
            baseline_version=proposal.base_version,
            partition=partition,
            trigger="proposal",
        )
        return base, cand

    @staticmethod
    async def _active_snapshot(db, scope: str) -> tuple[dict[str, Any], str]:
        """该 scope 的 active 配置快照 + version；无 active → ({}, "")。"""
        row = (
            await db.execute(
                sa.select(MemoryConfigVersion).where(
                    MemoryConfigVersion.config_scope == scope,
                    MemoryConfigVersion.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if row is None:
            return {}, ""
        return dict(row.snapshot or {}), row.version


# =============================================================================
# PipelinePromptProposer（GEPA 式有界变异 prompt）
# =============================================================================


class PipelinePromptProposer(_ProposerBase):
    """memory_pipeline_prompt 面 proposer：有界变异管线 prompt（extractor/reflection/summarizer）。

    复用 ``_ProposerBase`` LLM 调用骨架；无失败 case 信号时返回 None（冷启动保护，避免盲改 prompt）。
    """

    _TASK_KEY = "evolution.propose"

    async def propose(self, *, scope_name: str, active_prompt: str) -> Any:
        from .skill import SkillProposalDraft  # 复用 skill 的 draft 结构（prompt_template → prompt）

        await self._resolve_model()
        prompt = self._build_prompt(scope_name=scope_name, active_prompt=active_prompt)
        content = await self._call_llm(prompt)
        if not content:
            return None
        data = loads_lenient(content)
        if not isinstance(data, dict) or bool(data.get("no_change", False)):
            return None
        new_prompt = str(data.get("prompt") or data.get("prompt_template") or "").strip()
        if not new_prompt or is_noop_template(new_prompt, active_prompt):
            return None
        return SkillProposalDraft(prompt_template=new_prompt, rationale=str(data.get("rationale", "")).strip()[:240])

    def _build_prompt(self, *, scope_name: str, active_prompt: str) -> str:
        return _PIPELINE_PROPOSAL_PROMPT.format(scope=scope_name, active=active_prompt[:1200])


_PIPELINE_PROPOSAL_PROMPT = """\
你是记忆管线 prompt 进化器（GEPA 范式）。对 ``{scope}`` 的当前 prompt 提一次「有界变异」，
使其在抽取/反思/摘要任务上产出更贴合验收的结果。

# 当前 active prompt
{active}

# 约束
1. 仅输出新 prompt 全文，保留其输出格式契约不变；
2. 改进须具体（指向已知失败模式），勿泛泛重写；无明确改进空间则 no_change=true。

# 输出（仅 JSON 单行）
{{"prompt": "<新全文>", "rationale": "<≤120字改进依据>", "no_change": false}}
"""
