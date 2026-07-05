"""SkillTemplateHandler —— skill_template 面（Skill ``prompt_template``）的进化 handler。

综述 §3.5（Skill Evolution）+ §7（meta-layer）的第二个进化面。闭环：

  propose（GEPA 变异 prompt_template）
    → shadow（SuiteRunner 在**可见集**上跑候选 vs 基线 → decide_skill_shadow 增益门 + 反事实归因）
    → canary（SuiteRunner 在**冻结 holdout 集**上跑 → decide_skill_canary 零回归门）
    → promote（翻 ``skills.active_version`` 指针）/ rollback

发布机制 = ``active_version`` 指针翻转（``skills_injector`` 未显式锁版本时解析 promoted 快照）。
**canary 用离线 eval-suite holdout 门**（综述 §8 强调离线 held-out 优于噪声在线 canary），
runtime 按 thread 分桶注入候选版本留作后续。

证据源：``visible_results_query``（该 skill 失败 case，**结构性排除 holdout**，综述 §9.4 防 Goodhart）
+ ``tool_invocations``（该 skill 失败调用）。无绑定 EvalSuite → 无验证手段 → reject。

参考文献：
[1] C. Jiang et al., "Self-Improving Agents in the Era of Experience," 2026. §3.5 / §7 / §8 / §9.4。
[2] L. A. Agrawal et al., "GEPA," ICLR (Oral), 2026. 反思驱动 prompt 变异。
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.engine.evolution.decision import (
    decide_longitudinal_drift,
    decide_runtime_canary_online,
    decide_safety_nonregression,
    decide_skill_canary,
    decide_skill_shadow,
    improvement_efficiency,
    is_noop_template,
)
from negentropy.engine.evolution.handlers._shared import (
    _bump_patch,
    _emit_evolution_event,
    _enter_canary,
    _enter_runtime_canary,
    _parse_dt,
)
from negentropy.engine.evolution.proposer import _ProposerBase
from negentropy.engine.utils.json_extract import loads_lenient
from negentropy.logging import get_logger
from negentropy.models.eval_suite import (
    RUN_PARTITION_HOLDOUT,
    RUN_PARTITION_VISIBLE,
    TARGET_KIND_SKILL,
    EvalResult,
    EvalRun,
    EvalSuite,
)
from negentropy.models.evolution import (
    ORIGIN_REFLECTION,
    PROPOSAL_NON_TERMINAL,
    RISK_LOW,
    STATUS_PENDING_APPROVAL,
    STATUS_PROMOTED,
    STATUS_REJECTED,
    STATUS_ROLLED_BACK,
    STATUS_SHADOW_EVAL,
    EvolutionProposal,
)
from negentropy.models.skill import Skill, SkillVersion

logger = get_logger("negentropy.engine.evolution.skill")

# prompt_template 有界变异约束（对齐蓝图 §5.3 Decagon 4x 压缩经验）
_PROMPT_MAX_CHARS = 1500
_MAX_FAIL_CASES_IN_PROMPT = 5
_MAX_RECENT_NEGATIVES = 5


# =============================================================================
# SkillProposer（GEPA 式有界变异 prompt_template）
# =============================================================================


@dataclass(frozen=True, slots=True)
class SkillProposalDraft:
    """SkillProposer 产出的候选草案。"""

    prompt_template: str
    rationale: str
    expected_effect: dict[str, str] | None = None


class SkillProposer(_ProposerBase):
    """skill_template 面 proposer：基于失败 case 反思，有界变异 ``prompt_template``。

    复用 ``_ProposerBase`` 的 LLM 调用 + 容错骨架；override ``_build_prompt`` / ``_parse``。
    自有 ``propose`` 签名（base 仅约束 _build_prompt/_parse）；无 pattern fallback。
    """

    _TASK_KEY = "evolution.propose"

    async def propose(
        self,
        *,
        skill_name: str,
        active_template: str,
        failing_cases: list[dict[str, Any]] | None = None,
        recent_negatives: list[dict[str, Any]] | None = None,
    ) -> SkillProposalDraft | None:
        """产出 ``prompt_template`` 变异草案。

        冷启动（无失败 case 且无近期负样本）→ 不调 LLM，返回 None（无改进信号）。
        LLM 失败 / 解析失败 / ``no_change=true`` / 长度超限 / 与 active 完全一致 → None。
        """
        fails = list(failing_cases or [])
        negatives = list(recent_negatives or [])
        if not fails and not negatives:
            logger.info("skill_proposer_skip_no_signal", skill=skill_name)
            return None

        await self._resolve_model()
        prompt = self._build_prompt(
            skill_name=skill_name,
            active_template=active_template,
            failing_cases=fails[:_MAX_FAIL_CASES_IN_PROMPT],
            recent_negatives=negatives[:_MAX_RECENT_NEGATIVES],
        )
        if prompt is None:
            return None
        content = await self._call_llm(prompt)
        if not content:
            return None
        return self._parse(content, active_template=active_template)

    # ------------------------------------------------------------------
    # override
    # ------------------------------------------------------------------

    def _build_prompt(
        self,
        *,
        skill_name: str,
        active_template: str,
        failing_cases: list[dict[str, Any]],
        recent_negatives: list[dict[str, Any]],
    ) -> str | None:
        fail_block = _format_fail_cases(failing_cases)
        neg_block = _format_negatives(recent_negatives)
        return _SKILL_PROPOSAL_PROMPT.format(
            skill=skill_name,
            active=active_template[:_PROMPT_MAX_CHARS],
            max_chars=_PROMPT_MAX_CHARS,
            fail_block=fail_block,
            neg_block=neg_block,
        )

    def _parse(self, content: str, *, active_template: str) -> SkillProposalDraft | None:
        data: dict[str, Any] = loads_lenient(content)
        if not isinstance(data, dict):
            logger.warning("skill_proposer_response_not_json", preview=(content or "")[:200])
            return None
        if bool(data.get("no_change", False)):
            logger.info("skill_proposer_no_change")
            return None
        template = str(data.get("prompt_template", "")).strip()
        if not template:
            logger.warning("skill_proposer_empty_template")
            return None
        if len(template) > _PROMPT_MAX_CHARS:
            logger.warning("skill_proposer_template_too_long", length=len(template), cap=_PROMPT_MAX_CHARS)
            return None
        if is_noop_template(template, active_template):
            logger.info("skill_proposer_noop_template")
            return None
        rationale = str(data.get("rationale", "")).strip()[:240]
        expected = data.get("expected_effect")
        return SkillProposalDraft(
            prompt_template=template,
            rationale=rationale,
            expected_effect=expected if isinstance(expected, dict) else None,
        )


_SKILL_PROPOSAL_PROMPT = """\
你是 skill prompt 进化器（GEPA 范式）。基于该 skill 的失败 case 与近期被拒提案，对它的
``prompt_template`` 提出一次「有界变异」——目标是让 skill 在这些失败场景下产出更贴合验收的指导。

# skill 名
{skill}

# 当前 active prompt_template
{active}

# 近窗口失败 case（visible 集；task + 验收 + 得分）
{fail_block}

# 近期被拒绝/回滚的提案（避免重复探索死方向）
{neg_block}

# 约束（违反将丢弃）
1. 仅产出新的 ``prompt_template`` 全文（不改 required_tools / resources 结构）；
2. 长度 ≤ {max_chars} 字（Decagon 4x 压缩经验：精炼优先）；
3. 必须针对上述失败 case 的具体缺陷做改进，而非泛泛重写；
4. 若失败 case 已无明确改进空间，返回 no_change=true。

# 输出（仅 JSON 单行）
{{"prompt_template": "<新全文>", "rationale": "<≤120字改进依据，引用具体失败 case>", \
"expected_effect": {{"visible_gain": "↑|≈"}}, "no_change": false}}
"""


def _format_fail_cases(cases: list[dict[str, Any]]) -> str:
    if not cases:
        return "（暂无失败 case）"
    lines: list[str] = []
    for i, c in enumerate(cases, 1):
        task = str(c.get("task") or c.get("input", {}).get("task") or "")[:120]
        score = c.get("score")
        lines.append(f"[{i}] score={score} task={task}")
    return "\n".join(lines)


def _format_negatives(negatives: list[dict[str, Any]]) -> str:
    if not negatives:
        return "（无）"
    lines: list[str] = []
    for i, n in enumerate(negatives, 1):
        reason = n.get("status") or n.get("reason") or "?"
        preview = str((n.get("payload") or {}).get("prompt_template", ""))[:60]
        lines.append(f"[{i}] {reason}: {preview}…")
    return "\n".join(lines)


# =============================================================================
# SkillTemplateHandler
# =============================================================================


class SkillTemplateHandler:
    """skill_template 面进化 handler（target_kind = ``skill_template``）。"""

    target_kind = "skill_template"

    def __init__(
        self,
        *,
        runner: Any | None = None,
        proposer: SkillProposer | None = None,
        attributor: Any | None = None,
    ) -> None:
        # 惰性 import：SuiteRunner / CounterfactualAttributor 反向依赖 eval 包，
        # 顶层 import 会与 ``eval.runner → evolution.__init__ → orchestrator → handlers → skill``
        # 成环，故在构造期才解析。
        if runner is None:
            from negentropy.engine.eval.runner import SuiteRunner

            runner = SuiteRunner()
        if attributor is None:
            from negentropy.engine.eval.attribution import CounterfactualAttributor

            attributor = CounterfactualAttributor()
        self._runner = runner
        self._proposer = proposer or SkillProposer(model=settings.evolution.proposer_model)
        self._attributor = attributor
        self._bg_tasks: set[asyncio.Task] = set()

    # ==================================================================
    # ADVANCE
    # ==================================================================

    async def advance_shadow(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """shadow：在可见集上跑候选 vs 基线 → decide_skill_shadow 增益门 + 反事实归因。"""
        suite = await self._find_suite(db, proposal.target_ref)
        if suite is None:
            proposal.status = STATUS_REJECTED
            proposal.decided_at = now
            _emit_evolution_event(proposal, action=proposal.status, reason="no_eval_suite")
            logger.warning("skill_shadow_no_suite", skill=proposal.target_ref, proposal_id=str(proposal.id))
            return

        base_run, cand_run = await self._run_pair(db, suite=suite, proposal=proposal, partition=RUN_PARTITION_VISIBLE)
        base_view = await _run_view(db, base_run)
        cand_view = await _run_view(db, cand_run)
        gain = cand_view.score_mean - base_view.score_mean
        proposal.shadow_eval_result = {
            "baseline_mean": base_run.score_mean,
            "candidate_mean": cand_run.score_mean,
            "candidate_regression_count": cand_run.regression_count,
            "improvement_efficiency": improvement_efficiency(
                score_gain=gain, cost_units=base_view.n_cases + cand_view.n_cases
            ),
            "candidate_cost_usd": cand_run.cost_total,  # SI #4 执行侧真实 $-cost（agent_loop 模式）
            "decided_at": now.isoformat(),
        }

        dec = decide_skill_shadow(baseline=base_view, candidate=cand_view)
        if dec.action == "hold":
            # 反事实归因（综述 §8 CTA）：写回候选 visible run 的 eval_results.attribution
            try:
                await self._attributor.attribute(db, candidate_run_id=cand_run.id, baseline_run_id=base_run.id)
            except Exception as exc:  # noqa: BLE001
                logger.warning("skill_shadow_attribution_failed", error=str(exc))
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
            "skill_shadow_decided",
            proposal_id=str(proposal.id),
            action=dec.action,
            reason=dec.reason,
        )

    async def advance_canary(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """canary：在冻结 holdout 集上跑候选 vs 基线 → decide_skill_canary 零回归门。

        skill 面用离线 eval-suite holdout 门（综述 §8），无在线窗口等待——进入 canary 后首个 tick
        即判 promote/rollback（REAP 超时兜底不再需要因「等样本」长期挂起）。
        """
        suite = await self._find_suite(db, proposal.target_ref)
        if suite is None:
            await self._rollback(db, proposal, now, reason="no_eval_suite")
            return

        base_run, cand_run = await self._run_pair(db, suite=suite, proposal=proposal, partition=RUN_PARTITION_HOLDOUT)
        proposal.canary_metrics = {
            "baseline_mean": base_run.score_mean,
            "candidate_mean": cand_run.score_mean,
            "candidate_regression_count": cand_run.regression_count,
            "decided_at": now.isoformat(),
        }
        base_view = await _run_view(db, base_run)
        cand_view = await _run_view(db, cand_run)
        dec = decide_skill_canary(baseline=base_view, candidate=cand_view)
        if dec.is_promote:
            # SI #6 safety non-regression 前置（综述 §8 + §9.3）：安全套件零回退方可晋升
            safety_dec = await self._check_safety_nonregression(db, proposal)
            if safety_dec is None or safety_dec.action == "promote":
                if settings.evolution.runtime_canary_enabled:
                    # R3-b runtime canary：离线门通过 → 进入在线分桶灰度窗口（综述 §9.3 受控发布），
                    # 窗口到期后再全量翻 active_version（advance_runtime_canary）
                    _enter_runtime_canary(proposal, now)
                else:
                    await self._promote(db, proposal, now)
            else:
                # 安全回退属高风险，不自动晋升，交人审
                proposal.status = STATUS_PENDING_APPROVAL
                proposal.decided_at = now
                _emit_evolution_event(proposal, action=proposal.status, reason=safety_dec.reason or "safety_regression")
        elif dec.is_rollback:
            await self._rollback(db, proposal, now, reason=dec.reason)
        # hold（holdout 样本不足）→ 留 canary 续等（下次 tick 再判）
        logger.info(
            "skill_canary_decided",
            proposal_id=str(proposal.id),
            action=dec.action,
            reason=dec.reason,
        )

    # ==================================================================
    # promote / rollback
    # ==================================================================

    async def _promote(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """晋升：确保候选 SkillVersion 存在 → 翻 ``skills.active_version`` 指针。"""
        await self._ensure_candidate_version(db, proposal)
        skill = await self._load_skill(db, proposal.target_ref)
        if skill is not None:
            skill.active_version = proposal.proposed_version
        proposal.status = STATUS_PROMOTED
        proposal.decided_at = now
        # 失效 skill canary 缓存（queries._skill_canary_cache 15s TTL），避免 tool_telemetry 残留分桶路由
        from negentropy.engine.evolution.queries import invalidate_canary_cache

        invalidate_canary_cache(proposal.target_ref)
        _emit_evolution_event(proposal, action="promote", reason="promoted")

    async def _rollback(self, db, proposal: EvolutionProposal, now: datetime, *, reason: str | None) -> None:
        """回滚：active_version 保持基线（不翻）；标记 rolled_back（候选 SkillVersion 保留全历史）。"""
        proposal.status = STATUS_ROLLED_BACK
        proposal.decided_at = now
        # 失效 skill canary 缓存（queries._skill_canary_cache 15s TTL）：回滚后停止把流量分到候选桶
        from negentropy.engine.evolution.queries import invalidate_canary_cache

        invalidate_canary_cache(proposal.target_ref)
        _emit_evolution_event(proposal, action="rollback", reason=reason or "rolled_back")

    async def rollback(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """抽象基类契约：REAP 超时强制回滚入口。"""
        await self._rollback(db, proposal, now, reason="stale_canary_timeout")

    async def _runtime_canary_online_gate(self, db, proposal: EvolutionProposal, started_at):
        """R6-b 在线 error-rate 门：聚合 runtime_canary 窗口内 expand_skill 真实调用（候选桶 vs 基线桶）。

        ``tool_invocations`` 中 ``tool_ref='expand_skill' AND skill_ref=skill_name AND created_at >= started_at``，
        按 ``canary_assignment`` 分桶（候选 = proposed_version；基线 = 其余/NULL）。
        返回 ``decide_runtime_canary_online`` Decision；候选桶无数据 → None（跳过在线门，交离线复评门）。
        """

        from negentropy.models.tool_telemetry import ToolInvocation

        if started_at is None:
            return None
        rows = (
            await db.execute(
                sa.select(
                    ToolInvocation.canary_assignment,
                    sa.func.count().label("n"),
                    sa.func.sum(sa.case((ToolInvocation.status == "error", 1), else_=0)).label("errors"),
                )
                .where(
                    ToolInvocation.tool_ref == "expand_skill",
                    ToolInvocation.skill_ref == proposal.target_ref,
                    ToolInvocation.created_at >= started_at,
                )
                .group_by(ToolInvocation.canary_assignment)
            )
        ).all()
        cand = next((r for r in rows if r.canary_assignment == proposal.proposed_version), None)
        base = next((r for r in rows if r.canary_assignment != proposal.proposed_version), None)
        if cand is None or not cand.n:
            return None  # 候选桶无在线数据 → 跳过在线门
        cand_err = float((cand.errors or 0) / cand.n)
        base_err = float((base.errors or 0) / base.n) if (base and base.n) else 0.0
        return decide_runtime_canary_online(
            candidate_err_rate=cand_err, candidate_n=int(cand.n), baseline_err_rate=base_err
        )

    async def advance_runtime_canary(self, db, proposal: EvolutionProposal, now: datetime) -> None:
        """runtime_canary 窗口到期 → 复跑 holdout 复评门（drift→rollback，否则全量晋升）。

        全量发布前的最后一道自验证（综述 §9.3 受控发布 + §8 longitudinal）：窗口末复跑 holdout 集
        对比晋升时均值（``canary_metrics.candidate_mean``），drift 超阈 → 回滚（灰度期已暴露退化），
        否则翻 ``active_version`` 全量晋升。复用 ``decide_longitudinal_drift`` 基座。窗口未到期 → 续跑。
        """
        started_at = _parse_dt((proposal.canary_config or {}).get("started_at"))
        window = settings.evolution.runtime_canary_window_seconds
        if started_at is not None and (now - started_at).total_seconds() < window:
            return  # 窗口未到期，留 runtime_canary 续跑

        # R6-b 在线 error-rate 门（综述 §9.3）：聚合 runtime_canary 窗口内 expand_skill 真实调用，
        # 候选桶 error-rate 较基线桶退化 → rollback（捕捉离线 eval 漏掉的真实分布问题）。样本不足则
        # 跳过在线门，交由下方离线复评门裁决。
        online_dec = await self._runtime_canary_online_gate(db, proposal, started_at)
        if online_dec is not None and online_dec.is_rollback:
            await self._rollback(db, proposal, now, reason="runtime_canary_online_error")
            logger.warning(
                "skill_runtime_canary_online_rollback",
                proposal_id=str(proposal.id),
                **(online_dec.detail or {}),
            )
            return

        suite = await self._find_suite(db, proposal.target_ref)
        if suite is None:
            await self._promote(db, proposal, now)  # 无 suite 可复评，降级为直接晋升
            logger.info("skill_runtime_canary_finalized", proposal_id=str(proposal.id))
            return
        recheck_run = await self._runner.run_suite(
            db,
            suite=suite,
            target_kind=TARGET_KIND_SKILL,
            target_ref=proposal.target_ref,
            target_version=proposal.proposed_version,
            partition=RUN_PARTITION_HOLDOUT,
            trigger="scheduled",
        )
        promotion_mean = float((proposal.canary_metrics or {}).get("candidate_mean") or 0.0)
        dec = decide_longitudinal_drift(
            promotion_mean=promotion_mean,
            recheck=await _run_view(db, recheck_run),
            drift_max=settings.evolution.longitudinal_drift_max,
        )
        if dec.is_rollback:
            await self._rollback(db, proposal, now, reason="runtime_canary_drift")
            logger.warning(
                "skill_runtime_canary_drift_rollback",
                proposal_id=str(proposal.id),
                recheck_mean=recheck_run.score_mean,
                promotion_mean=promotion_mean,
            )
        else:
            await self._promote(db, proposal, now)
            logger.info("skill_runtime_canary_finalized", proposal_id=str(proposal.id))

    # ==================================================================
    # 纵向复评（综述 §8 #3 longitudinal stability + §10.5 + §9.3 持续再认证）
    # ==================================================================

    async def recheck_longitudinal(self, db, proposal: EvolutionProposal, now: datetime):
        """已晋升 skill 在 holdout 集复跑，与晋升时均值对比；drift 超阈 → 回退 active_version。

        返回 ``Decision``（rollback=静默退化已回退 / hold=仍稳定 / skip=无绑定 suite）。
        晋升时均值取自 ``proposal.canary_metrics["candidate_mean"]``（advance_canary 写入）。
        """
        suite = await self._find_suite(db, proposal.target_ref)
        if suite is None:
            from negentropy.engine.evolution.decision import Decision

            return Decision("skip", reason="no_eval_suite")

        recheck_run = await self._runner.run_suite(
            db,
            suite=suite,
            target_kind=TARGET_KIND_SKILL,
            target_ref=proposal.target_ref,
            target_version=proposal.proposed_version,
            partition=RUN_PARTITION_HOLDOUT,
            trigger="scheduled",
        )
        promotion_mean = float((proposal.canary_metrics or {}).get("candidate_mean") or 0.0)
        dec = decide_longitudinal_drift(
            promotion_mean=promotion_mean,
            recheck=await _run_view(db, recheck_run),
            drift_max=settings.evolution.longitudinal_drift_max,
        )
        if dec.is_rollback:
            skill = await self._load_skill(db, proposal.target_ref)
            if skill is not None and skill.active_version == proposal.proposed_version:
                skill.active_version = proposal.base_version  # 回退到前一稳定版
            proposal.status = STATUS_ROLLED_BACK
            proposal.decided_at = now
            _emit_evolution_event(
                proposal,
                action="longitudinal_revert",
                reason=dec.reason,
                metrics={"recheck_mean": recheck_run.score_mean, "promotion_mean": promotion_mean},
            )
            logger.warning(
                "skill_longitudinal_revert",
                proposal_id=str(proposal.id),
                recheck_mean=recheck_run.score_mean,
                promotion_mean=promotion_mean,
                reverted_to=proposal.base_version,
            )
            return dec

        # R8-d 持续安全复评（综述 §9.3 + SI #6）：drift 未退化时，复跑 is_safety suite →
        # decide_safety_nonregression（候选=当前 active vs 基线）；安全退化 → 回退 active_version。
        # 复用 _check_safety_nonregression（canary 期同款逻辑）。
        try:
            safety_dec = await self._check_safety_nonregression(db, proposal)
            if safety_dec is not None and safety_dec.action == "rollback":
                skill = await self._load_skill(db, proposal.target_ref)
                if skill is not None and skill.active_version == proposal.proposed_version:
                    skill.active_version = proposal.base_version
                proposal.status = STATUS_ROLLED_BACK
                proposal.decided_at = now
                _emit_evolution_event(proposal, action="safety_recheck_revert", reason=safety_dec.reason)
                logger.warning(
                    "skill_safety_recheck_revert",
                    proposal_id=str(proposal.id),
                    reason=safety_dec.reason,
                )
                from negentropy.engine.evolution.decision import Decision

                return Decision("rollback", safety_dec.reason, {"safety_recheck": True})
        except Exception as exc:  # noqa: BLE001
            logger.warning("skill_safety_recheck_failed", error=str(exc))

        return dec

    # ==================================================================
    # SPAWN proposer
    # ==================================================================

    async def maybe_spawn(self) -> int:
        """per-skill 单在途 + skill_enabled + 预算 → bg propose 落 shadow_eval 提案 + 候选 SkillVersion。"""
        if not settings.evolution.skill_enabled:
            return 0
        loop = asyncio.get_running_loop()
        task = loop.create_task(self._spawn_bg())
        self._bg_tasks.add(task)
        task.add_done_callback(self._bg_tasks.discard)
        return 1

    async def _spawn_bg(self) -> None:
        """扫有失败证据且无在途提案的 skill → propose → 落 shadow_eval 提案 + 候选 SkillVersion。"""
        try:
            async with db_session.AsyncSessionLocal() as db:
                candidates = await self._find_spawning_candidates(db)
                if not candidates:
                    return
                for skill in candidates:
                    # per-skill 隔离：单 skill 异常（proposer 失败 / uq_skill_version 冲突）不阻塞其余 skill
                    try:
                        await self._spawn_one(db, skill)
                    except Exception as exc:  # noqa: BLE001
                        await db.rollback()  # 回滚本 skill 未提交改动，使会话可复用于下一 skill
                        logger.warning("skill_spawn_one_failed", skill=skill.name, error=str(exc))
                        continue
        except Exception as exc:
            logger.warning("skill_spawn_failed", error=str(exc))

    async def _spawn_one(self, db, skill: Skill) -> None:
        """单 skill 的 propose → 落 shadow_eval 提案 + 候选 SkillVersion（``_spawn_bg`` per-skill 调用）。

        抛出的异常由 ``_spawn_bg`` 的 per-iteration try/except 捕获并隔离，不影响同 tick 其它 skill。
        """
        active_tpl = await self._active_template(db, skill)
        fails = await self._fetch_failing_cases(db, skill.name)
        if not fails:
            return
        negatives = await self._fetch_recent_negatives(db, skill.name)
        draft = await self._proposer.propose(
            skill_name=skill.name,
            active_template=active_tpl,
            failing_cases=fails,
            recent_negatives=negatives,
        )
        if draft is None:
            return
        base_version = skill.active_version or skill.version
        proposed_version = _bump_patch(base_version)
        # 候选 SkillVersion（snapshot = 基线字段 + 变异 prompt_template）
        await self._write_candidate_version(db, skill, proposed_version, draft.prompt_template)
        db.add(
            EvolutionProposal(
                target_kind=self.target_kind,
                target_ref=skill.name,
                base_version=base_version,
                proposed_version=proposed_version,
                payload={"prompt_template": draft.prompt_template},
                origin=ORIGIN_REFLECTION,
                rationale=draft.rationale or None,
                evidence={
                    "failing_cases": fails[:_MAX_FAIL_CASES_IN_PROMPT],
                    "expected_effect": draft.expected_effect,
                },
                status=STATUS_SHADOW_EVAL,
                risk_level=RISK_LOW,
            )
        )
        await db.commit()
        logger.info(
            "skill_proposal_spawned",
            skill=skill.name,
            base=base_version,
            proposed=proposed_version,
        )

    # ==================================================================
    # 内部辅助
    # ==================================================================

    @staticmethod
    async def _find_suite(db, skill_name: str) -> EvalSuite | None:
        """主能力套件（非安全）：latest ``is_safety=False`` suite。安全套件由
        ``_check_safety_nonregression`` 单独处理。"""
        return (
            await db.execute(
                sa.select(EvalSuite)
                .where(
                    EvalSuite.target_kind == TARGET_KIND_SKILL,
                    EvalSuite.target_ref == skill_name,
                    EvalSuite.is_safety.is_(False),
                )
                .order_by(EvalSuite.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    async def _check_safety_nonregression(self, db, proposal: EvolutionProposal):
        """SI #6 safety non-regression（综述 §8 + §9.3）：遍历绑定的安全套件，候选须在每个上零回退。

        返回 ``Decision``（promote=全部通过 / rollback|hold=有安全套件未通过）；无安全套件 → None。
        """
        suites = (
            (
                await db.execute(
                    sa.select(EvalSuite).where(
                        EvalSuite.target_kind == TARGET_KIND_SKILL,
                        EvalSuite.target_ref == proposal.target_ref,
                        EvalSuite.is_safety.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )
        if not suites:
            return None
        last_dec = None
        for suite in suites:
            base_run, cand_run = await self._run_pair(
                db, suite=suite, proposal=proposal, partition=RUN_PARTITION_HOLDOUT
            )
            last_dec = decide_safety_nonregression(
                baseline=await _run_view(db, base_run),
                candidate=await _run_view(db, cand_run),
            )
            if last_dec.action != "promote":
                return last_dec  # 任一安全套件未通过即阻断
        return last_dec

    async def _run_pair(
        self,
        db,
        *,
        suite: EvalSuite,
        proposal: EvolutionProposal,
        partition: str,
    ) -> tuple[EvalRun, EvalRun]:
        """跑基线 + 候选两次 SuiteRunner（同 partition），返回 (baseline_run, candidate_run)。"""
        base_run = await self._runner.run_suite(
            db,
            suite=suite,
            target_kind=TARGET_KIND_SKILL,
            target_ref=proposal.target_ref,
            target_version=proposal.base_version,
            partition=partition,
            trigger="proposal",
        )
        cand_run = await self._runner.run_suite(
            db,
            suite=suite,
            target_kind=TARGET_KIND_SKILL,
            target_ref=proposal.target_ref,
            target_version=proposal.proposed_version,
            baseline_version=proposal.base_version,
            partition=partition,
            trigger="proposal",
        )
        return base_run, cand_run

    @staticmethod
    async def _load_skill(db, skill_name: str) -> Skill | None:
        return (await db.execute(sa.select(Skill).where(Skill.name == skill_name))).scalar_one_or_none()

    @staticmethod
    async def _ensure_candidate_version(db, proposal: EvolutionProposal) -> None:
        """晋升前确保候选 SkillVersion 存在（spawn 期已写；防御性幂等）。"""
        skill = await SkillTemplateHandler._load_skill(db, proposal.target_ref)
        if skill is None:
            return
        exists = (
            await db.execute(
                sa.select(SkillVersion).where(
                    SkillVersion.skill_id == skill.id,
                    SkillVersion.version == proposal.proposed_version,
                )
            )
        ).scalar_one_or_none()
        if exists is not None:
            return
        await SkillTemplateHandler._write_candidate_version(
            db, skill, proposal.proposed_version, str((proposal.payload or {}).get("prompt_template", ""))
        )

    @staticmethod
    async def _write_candidate_version(db, skill: Skill, version: str, prompt_template: str) -> None:
        """候选 SkillVersion snapshot = 基线 snapshot（或当前字段）+ 变异 prompt_template。"""
        base_snap = (
            await db.execute(
                sa.select(SkillVersion)
                .where(
                    SkillVersion.skill_id == skill.id,
                    SkillVersion.version == (skill.active_version or skill.version),
                )
                .order_by(SkillVersion.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if base_snap is not None:
            snap = dict(base_snap.snapshot or {})
        else:
            snap = {
                "prompt_template": skill.prompt_template,
                "default_config": skill.default_config,
                "required_tools": list(skill.required_tools or []),
                "enforcement_mode": getattr(skill, "enforcement_mode", "warning"),
                "resources": list(skill.resources or []),
                "display_name": skill.display_name,
                "description": skill.description,
            }
        snap["prompt_template"] = prompt_template
        db.add(SkillVersion(skill_id=skill.id, version=version, snapshot=snap))

    @staticmethod
    async def _active_template(db, skill: Skill) -> str:
        """skill 当前生效 prompt_template（active_version 快照 > live 字段）。"""
        ver = skill.active_version or skill.version
        row = (
            await db.execute(
                sa.select(SkillVersion).where(SkillVersion.skill_id == skill.id, SkillVersion.version == ver).limit(1)
            )
        ).scalar_one_or_none()
        if row is not None:
            return str((row.snapshot or {}).get("prompt_template") or "")
        return str(skill.prompt_template or "")

    @staticmethod
    async def _find_spawning_candidates(db) -> list[Skill]:
        """有失败证据（绑定 EvalSuite 且 visible 集存在低分 case）且无在途提案的 skill。

        简化（MVP）：扫所有绑定 EvalSuite 的 enabled skill，逐个在 _spawn_bg 内再查失败 case +
        单在途。生产期可加索引/缓存优化。
        """
        suite_skill_names = (
            (
                await db.execute(
                    sa.select(EvalSuite.target_ref).where(EvalSuite.target_kind == TARGET_KIND_SKILL).distinct()
                )
            )
            .scalars()
            .all()
        )
        if not suite_skill_names:
            return []
        rows = (
            (
                await db.execute(
                    sa.select(Skill).where(Skill.name.in_(list(suite_skill_names)), Skill.is_enabled.is_(True))
                )
            )
            .scalars()
            .all()
        )
        # 过滤掉有在途提案的 skill
        inflight_refs = set(
            (
                await db.execute(
                    sa.select(EvolutionProposal.target_ref).where(
                        EvolutionProposal.target_kind == "skill_template",
                        EvolutionProposal.status.in_(PROPOSAL_NON_TERMINAL),
                    )
                )
            )
            .scalars()
            .all()
        )
        return [s for s in rows if s.name not in inflight_refs]

    @staticmethod
    async def _fetch_failing_cases(
        db, skill_name: str, *, limit: int = _MAX_FAIL_CASES_IN_PROMPT
    ) -> list[dict[str, Any]]:
        """该 skill 的失败 case 证据——经 ``visible_results_query``（防 Goodhart，排除 holdout）。"""
        from negentropy.engine.eval.runner import visible_results_query

        suite_row = (
            await db.execute(
                sa.select(EvalSuite.id)
                .where(EvalSuite.target_kind == TARGET_KIND_SKILL, EvalSuite.target_ref == skill_name)
                .order_by(EvalSuite.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if suite_row is None:
            return []
        from negentropy.models.eval_suite import EvalCase

        # join EvalCase 取 task 文本：EvalResult 无 task 字段，proposer 反思需具体失败场景（综述 §3.5 GEPA）。
        stmt = (
            visible_results_query(suite_id=suite_row)
            .join(EvalCase, EvalCase.id == EvalResult.case_id)
            .add_columns(EvalCase.input)
            .where(EvalResult.score < 70)
            .limit(limit)
        )
        rows = (await db.execute(stmt)).all()
        return [
            {
                "score": float(er.score),
                "verdict": er.verdict,
                "task": str((case_input or {}).get("task") or "")[:120],
            }
            for er, case_input in rows
        ]

    @staticmethod
    async def _fetch_recent_negatives(
        db, skill_name: str, *, limit: int = _MAX_RECENT_NEGATIVES
    ) -> list[dict[str, Any]]:
        rows = (
            (
                await db.execute(
                    sa.select(EvolutionProposal)
                    .where(
                        EvolutionProposal.target_kind == "skill_template",
                        EvolutionProposal.target_ref == skill_name,
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


# =============================================================================
# 模块级辅助
# =============================================================================


async def _run_view(db, run: EvalRun):
    """从 EvalRun + 其 EvalResult 行数构造 decision._RunView 视图（Protocol；SimpleNamespace 满足结构）。"""
    from types import SimpleNamespace

    n_cases = (
        await db.execute(sa.select(sa.func.count()).select_from(EvalResult).where(EvalResult.run_id == run.id))
    ).scalar_one()
    return SimpleNamespace(
        score_mean=float(run.score_mean or 0.0),
        regression_count=int(run.regression_count or 0),
        n_cases=int(n_cases or 0),
        pass_rate=float(run.pass_rate or 0.0),
    )
