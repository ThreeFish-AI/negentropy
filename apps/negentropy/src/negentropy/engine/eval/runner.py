"""SuiteRunner — 离线评测执行器（综述 §8「验证其价值」层）。

对一个 ``EvalSuite`` 的指定 ``(target_kind, target_ref, target_version)``（+ 可选基线 version）
按 ``partition`` 切片跑 Judge，产 ``EvalRun`` + 一批 ``EvalResult``，并相对基线 run 计算
``regression_count``。Judge 复用 ``RoutineEvaluator.judge_once``（非锚定，与 routine 路径解耦）。

执行是 target-kind-specific：``TargetExecutor`` Protocol 屏蔽。本模块提供 ``SkillExecutor``
（v1 judge-the-prompt 模式）；retrieval/agent executor 留后续。

关键不变量（综述 §9.4 防 Goodhart）：proposer 读证据必须经 ``visible_results_query``——
它显式排除 ``partition = 'holdout'`` 的 run，使冻结 holdout 结果不回流 proposer。

参考文献：
[1] C. Jiang et al., "Self-Improving Agents in the Era of Experience," 2026. §8 held-out gain /
    backward retention；§9.4 冻结 holdout 不回流。
[2] Z. Zhou et al., "Counterfactual trace auditing," 2026. 行为影响 > 分数 Δ 的度量动机。
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.engine.evolution.decision import compute_run_regression as _compute_run_regression
from negentropy.engine.routine.evaluator import EvaluationResult, RoutineEvaluator
from negentropy.logging import get_logger
from negentropy.models.eval_suite import (
    RUN_PARTITION_ALL,
    RUN_PARTITION_HOLDOUT,
    RUN_PARTITION_VISIBLE,
    RUN_STATUS_COMPLETED,
    RUN_STATUS_FAILED,
    RUN_STATUS_RUNNING,
    TARGET_KIND_SKILL,
    EvalCase,
    EvalResult,
    EvalRun,
    EvalSuite,
)

logger = get_logger("negentropy.engine.eval.runner")

# 默认每 run Judge 调用上限（成本封顶；可被 scoring_config.max_judge_calls 覆盖）
DEFAULT_MAX_JUDGE_CALLS = 50
# 默认 pass 阈值（可被 scoring_config.pass_threshold 覆盖）
DEFAULT_PASS_THRESHOLD = 70.0


# =============================================================================
# 数据结构
# =============================================================================


@dataclass(frozen=True, slots=True)
class CaseOutput:
    """单 case 的执行产出（``TargetExecutor.execute`` 的返回）。"""

    body: str
    digest: str | None = None
    error: str | None = None
    cost_usd: float | None = None  # 执行侧真实 $-cost（litellm.completion_cost；None=未提取/失败）


class TargetExecutor(Protocol):
    """按 target-kind 执行一个 case，产出交给 Judge 的「目标产出」文本。"""

    async def execute(
        self,
        *,
        target_kind: str,
        target_ref: str,
        target_version: str,
        case_input: dict[str, Any],
    ) -> CaseOutput: ...


# =============================================================================
# SkillExecutor — v1 judge-the-prompt 模式
# =============================================================================


def _sha12(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()[:12]


class SkillExecutor:
    """skill 面 executor（v1 judge-the-prompt）。

    ``target_ref`` = skill name；``target_version`` = SemVer。从 ``skill_versions`` 表取该 version
    的 ``snapshot.prompt_template``，用 case 的 ``variables`` 经 Jinja2 沙箱渲染，作为「目标产出」
    交 Judge 评 **prompt 质量**（非端到端任务成功——该折中已在方案文档显式标注，agent-loop 模式
    留 ``scoring_config.execution_mode`` 后续）。

    渲染失败 fail-soft：回退原始模板（对齐 ``format_skill_invocation``）。
    snapshot 缺失（skill 未版本化）→ ``CaseOutput.error`` 标记，Judge 仍可对 live prompt 评分。
    """

    def __init__(self, *, jinja_env=None) -> None:
        # 复用 skills_injector 的沙箱环境配置；惰性 import 避免循环依赖
        if jinja_env is None:
            from jinja2 import StrictUndefined
            from jinja2.sandbox import SandboxedEnvironment

            jinja_env = SandboxedEnvironment(autoescape=False, undefined=StrictUndefined)
        self._env = jinja_env

    async def execute(
        self,
        *,
        target_kind: str,
        target_ref: str,
        target_version: str,
        case_input: dict[str, Any],
    ) -> CaseOutput:
        from negentropy.db import session as db_session  # 惰性：仅在执行期开 session
        from negentropy.models.skill import Skill, SkillVersion

        async with db_session.AsyncSessionLocal() as db:
            row = (
                await db.execute(
                    select(SkillVersion)
                    .join(Skill, Skill.id == SkillVersion.skill_id)
                    .where(Skill.name == target_ref, SkillVersion.version == target_version)
                )
            ).scalar_one_or_none()

            if row is None:
                # 候选 version 无快照：取 live skill 的 prompt_template 作降级评分（标记 error）
                skill = (await db.execute(select(Skill).where(Skill.name == target_ref))).scalar_one_or_none()
                template = (skill.prompt_template if skill else None) or ""
                rendered = template  # 无 variables 渲染
                logger.warning(
                    "eval_skill_unversioned",
                    skill=target_ref,
                    version=target_version,
                )
                return CaseOutput(
                    body=rendered or "(skill 无 prompt_template)", digest=_sha12(rendered), error="unversioned"
                )

            snapshot = dict(row.snapshot or {})
            template = snapshot.get("prompt_template") or ""
        variables = dict(case_input.get("variables") or {})
        try:
            rendered = self._env.from_string(template).render(**variables)
        except Exception as exc:
            logger.warning("eval_skill_render_failed", skill=target_ref, version=target_version, error=str(exc))
            rendered = template  # fail-soft
        return CaseOutput(body=rendered or "(skill 无 prompt_template)", digest=_sha12(rendered))


class AgentLoopExecutor:
    """skill 面 executor（``execution_mode="agent_loop"``）——skill-conditioned 单轮生成。

    与 ``SkillExecutor``（judge-the-prompt，评 prompt **文本**质量）的区别：把 ``SkillVersion``
    快照的 ``prompt_template`` 作 **system instruction**、case 的 ``task`` 作 user，发起一次真实 LLM
    生成，Judge 评**生成产出**而非评 prompt 文本——更贴近综述 §3「skill 指导真实任务行为」的语义。

    v1 为单轮生成（无工具调用 / 沙箱）；完整 agent-loop（多轮 + 工具 + MicroSandbox）是进一步工作。
    生成失败 fail-soft：回退空串，Judge 据此低分。
    """

    _TASK_KEY = "eval.execute"

    def __init__(self, *, model_override: str | None = None) -> None:
        self._model_override = model_override

    async def execute(
        self,
        *,
        target_kind: str,
        target_ref: str,
        target_version: str,
        case_input: dict[str, Any],
    ) -> CaseOutput:
        from negentropy.db import session as db_session
        from negentropy.models.skill import Skill, SkillVersion

        async with db_session.AsyncSessionLocal() as db:
            row = (
                await db.execute(
                    select(SkillVersion)
                    .join(Skill, Skill.id == SkillVersion.skill_id)
                    .where(Skill.name == target_ref, SkillVersion.version == target_version)
                )
            ).scalar_one_or_none()
            template = (dict(row.snapshot or {}).get("prompt_template") if row else None) or ""
        task = str((case_input or {}).get("task") or "")
        body, cost = await _conditioned_generate(
            system_prompt=template, user_task=task, model_override=self._model_override
        )
        return CaseOutput(body=body or "(agent 未产出)", digest=_sha12(body or ""), cost_usd=cost)


class PromptExecutor:
    """memory_pipeline_prompt 面 executor——跑候选 prompt 抽取/反思，Judge 评产出质量。

    ``target_ref`` = ``memory_config_versions.config_scope``（如 ``pipeline_prompt``）；
    ``target_version`` = 该 scope 下的 SemVer。从 ``memory_config_versions`` 取候选 snapshot.prompt，
    在 case 的 ``sample_text`` 上执行一次 LLM 生成，Judge 评产出（如抽取的事实是否覆盖 expected）。
    用于把综述 §3.5 的 Evolution 范式从 skill 推广到记忆管线 prompt（第三进化面，证明 ``TargetHandler``
    抽象 + eval 基座 target-agnostic）。
    """

    def __init__(self, *, model_override: str | None = None) -> None:
        self._model_override = model_override

    async def execute(
        self,
        *,
        target_kind: str,
        target_ref: str,
        target_version: str,
        case_input: dict[str, Any],
    ) -> CaseOutput:
        from negentropy.db import session as db_session
        from negentropy.models.evolution import MemoryConfigVersion

        async with db_session.AsyncSessionLocal() as db:
            row = (
                await db.execute(
                    select(MemoryConfigVersion).where(
                        MemoryConfigVersion.config_scope == target_ref,
                        MemoryConfigVersion.version == target_version,
                    )
                )
            ).scalar_one_or_none()
            prompt = (dict(row.snapshot or {}).get("prompt") if row else None) or ""
        sample_text = str((case_input or {}).get("sample_text") or (case_input or {}).get("task") or "")
        body, cost = await _conditioned_generate(
            system_prompt=prompt, user_task=sample_text, model_override=self._model_override
        )
        return CaseOutput(body=body or "(pipeline 未产出)", digest=_sha12(body or ""), cost_usd=cost)


async def _conditioned_generate(
    *, system_prompt: str, user_task: str, model_override: str | None
) -> tuple[str, float | None]:
    """单轮 LLM 生成（system=skill prompt，user=case task）。返回 ``(text, cost_usd)``。

    失败返回 ``("", None)``。``cost_usd`` 经 ``litellm.completion_cost(resp)`` 提取（SI #4 真实 $-cost），
    模型不在定价表 / 提取异常 → None（不阻塞生成）。
    """
    import litellm

    from negentropy.engine.utils.model_config import resolve_model_config_async

    try:
        model, kwargs = await resolve_model_config_async("eval.execute", explicit_model=model_override)
        safe_kwargs = {k: v for k, v in kwargs.items() if k not in ("model", "messages")}
        resp = await litellm.acompletion(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt or "(no skill instruction)"},
                {"role": "user", "content": user_task},
            ],
            **safe_kwargs,
        )
        text = resp.choices[0].message.content or ""
        return text, _extract_cost_usd(resp)
    except Exception as exc:  # noqa: BLE001
        logger.warning("eval_agent_loop_generate_failed", error=str(exc))
        return "", None


def _extract_cost_usd(resp) -> float | None:
    """从 litellm 响应提取 $-cost（``litellm.completion_cost``）；失败 → None。"""
    try:
        import litellm

        cost = litellm.completion_cost(resp)  # 综述 §8 #4 improvement efficiency 真实成本
        return float(cost) if cost is not None else None
    except Exception:  # noqa: BLE001  # 模型不在定价表 / 无 usage → 静默降级
        return None


# =============================================================================
# SuiteRunner
# =============================================================================


class SuiteRunner:
    """在 ``EvalSuite`` 上跑一次评测，产 ``EvalRun`` + ``EvalResult`` 行。

    用法：``await SuiteRunner().run_suite(session, suite=s, target_kind="skill",
    target_ref="paper_hunter", target_version="1.1.0", baseline_version="1.0.0",
    partition="visible")``。
    """

    def __init__(
        self,
        *,
        evaluator: RoutineEvaluator | None = None,
        executors: dict[str, TargetExecutor] | None = None,
        agent_executor: TargetExecutor | None = None,
    ) -> None:
        self._evaluator = evaluator or RoutineEvaluator()
        # 默认注册 skill executor；其它 target_kind 由调用方注入
        self._executors: dict[str, TargetExecutor] = (
            executors if executors is not None else {TARGET_KIND_SKILL: SkillExecutor()}
        )
        # ``execution_mode="agent_loop"`` 时用 agent_executor（默认 AgentLoopExecutor）
        self._agent_executor = agent_executor or AgentLoopExecutor()

    # ------------------------------------------------------------------
    # 公开 API
    # ------------------------------------------------------------------

    async def run_suite(
        self,
        session: AsyncSession,
        *,
        suite: EvalSuite,
        target_kind: str,
        target_ref: str,
        target_version: str,
        baseline_version: str | None = None,
        partition: str = RUN_PARTITION_ALL,
        trigger: str = "manual",
        gate_cwd: str | None = None,
    ) -> EvalRun:
        """对 suite 的 ``partition`` 切片跑 Judge，返回完成的 ``EvalRun``。"""
        executor = self._resolve_executor(target_kind, dict(suite.scoring_config or {}))
        if executor is None:
            return await self._fail_run(
                session,
                suite_id=suite.id,
                target_kind=target_kind,
                target_ref=target_ref,
                target_version=target_version,
                baseline_version=baseline_version,
                partition=partition,
                trigger=trigger,
                error=f"no executor registered for target_kind={target_kind}",
            )

        cases = await self._select_cases(session, suite_id=suite.id, partition=partition)
        cfg = dict(suite.scoring_config or {})
        max_calls = int(cfg.get("max_judge_calls") or DEFAULT_MAX_JUDGE_CALLS)
        if len(cases) > max_calls:
            return await self._fail_run(
                session,
                suite_id=suite.id,
                target_kind=target_kind,
                target_ref=target_ref,
                target_version=target_version,
                baseline_version=baseline_version,
                partition=partition,
                trigger=trigger,
                error=f"budget_exceeded: {len(cases)} cases > max_judge_calls={max_calls}",
            )

        run = EvalRun(
            suite_id=suite.id,
            target_kind=target_kind,
            target_ref=target_ref,
            target_version=target_version,
            baseline_version=baseline_version,
            trigger=trigger,
            status=RUN_STATUS_RUNNING,
            partition=partition,
            regression_count=0,
        )
        session.add(run)
        await session.flush()  # 拿 run.id

        pass_threshold = float(cfg.get("pass_threshold") or DEFAULT_PASS_THRESHOLD)
        default_rubric = cfg.get("acceptance_criteria") or cfg.get("rubric") or ""
        default_gate = cfg.get("verification_command")
        model_override = cfg.get("judge_model")

        scores: list[float] = []
        weights: list[float] = []
        costs: list[float] = []  # 执行侧真实 $-cost（SI #4；judge 侧 cost 待 _judge 重构）
        passed = 0
        latencies: list[float] = []
        case_scores: dict[str, float] = {}

        import time

        for case in cases:
            t0 = time.monotonic()
            output = await executor.execute(
                target_kind=target_kind,
                target_ref=target_ref,
                target_version=target_version,
                case_input=dict(case.input or {}),
            )
            expected = dict(case.expected or {})
            acceptance = expected.get("rubric") or expected.get("acceptance_criteria") or default_rubric or ""
            verification_command = expected.get("verification_command") or default_gate
            task = (case.input or {}).get("task") or ""

            res: EvaluationResult = await self._evaluator.judge_once(
                goal=str(task),
                acceptance_criteria=str(acceptance),
                summary=output.body,
                verification_command=verification_command,
                gate_cwd=gate_cwd,
                model_override=model_override,
            )
            latencies.append(time.monotonic() - t0)
            if output.cost_usd is not None:
                costs.append(output.cost_usd)

            score = float(res.score) if res.score is not None else 0.0
            scores.append(score)
            weights.append(float(case.weight or 1.0))
            if (res.verdict == "pass") or (score >= pass_threshold):
                passed += 1
            case_scores[str(case.id)] = score

            session.add(
                EvalResult(
                    run_id=run.id,
                    case_id=case.id,
                    score=score,
                    verdict=res.verdict,
                    output_digest=output.digest,
                    judge_raw={
                        "judge_prompt": res.judge_prompt,
                        "judge_raw_content": res.judge_raw,
                        "gate_output": res.gate_output,
                        "reflection": res.reflection,
                        "ok": res.ok,
                        "error": res.error,
                    },
                    is_frozen_case=bool(case.is_frozen),
                )
            )

        # 聚合
        total_w = sum(weights) or 1.0
        score_mean = sum(s * w for s, w in zip(scores, weights, strict=False)) / total_w if scores else 0.0
        pass_rate = (passed / len(cases)) if cases else 0.0
        latency_p95 = _percentile(latencies, 0.95) if latencies else None

        # 相对 baseline run 的 case 回退数（综述 §8 backward retention）
        regression_count = 0
        if baseline_version:
            regression_count = await self._regression_vs_baseline(
                session,
                suite_id=suite.id,
                partition=partition,
                candidate_scores=case_scores,
                baseline_version=baseline_version,
            )

        run.score_mean = round(score_mean, 4)
        run.pass_rate = round(pass_rate, 4)
        run.latency_p95 = round(latency_p95, 4) if latency_p95 is not None else None
        run.cost_total = round(sum(costs), 6) if costs else None  # SI #4 执行侧真实 $-cost
        run.regression_count = regression_count
        run.status = RUN_STATUS_COMPLETED
        await session.flush()
        return run

    # ------------------------------------------------------------------
    # 内部
    # ------------------------------------------------------------------

    def _resolve_executor(self, target_kind: str, cfg: dict[str, Any]) -> TargetExecutor | None:
        """按 target_kind + ``scoring_config.execution_mode`` 选 executor。

        skill 面：``execution_mode="agent_loop"`` → agent_executor（单轮 skill-conditioned 生成，
        Judge 评**生成产出**）；否则默认 ``SkillExecutor``（judge-the-prompt，评 prompt 文本）。
        其它 target_kind 用注入的 executors 字典。
        """
        if target_kind == TARGET_KIND_SKILL and str(cfg.get("execution_mode") or "").lower() == "agent_loop":
            return self._agent_executor
        return self._executors.get(target_kind)

    @staticmethod
    async def _select_cases(session: AsyncSession, *, suite_id, partition: str) -> list[EvalCase]:
        stmt = select(EvalCase).where(EvalCase.suite_id == suite_id)
        if partition == RUN_PARTITION_VISIBLE:
            stmt = stmt.where(EvalCase.is_frozen.is_(False))
        elif partition == RUN_PARTITION_HOLDOUT:
            stmt = stmt.where(EvalCase.is_frozen.is_(True))
        # partition == all: 不加过滤
        rows = (await session.execute(stmt)).scalars().all()
        return list(rows)

    async def _regression_vs_baseline(
        self,
        session: AsyncSession,
        *,
        suite_id,
        partition: str,
        candidate_scores: dict[str, float],
        baseline_version: str | None,
    ) -> int:
        """找同 suite + 同 partition + ``baseline_version`` 的最近 completed baseline run，
        按 case 对齐计回退数。

        显式按候选声明的 ``baseline_version`` 过滤（而非「最近的任意 run」），避免多次提案
        间基线漂移；无匹配基线 run → 0（无法判定回退时不下结论）。
        """
        if not baseline_version:
            return 0
        baseline = (
            await session.execute(
                select(EvalRun)
                .where(
                    EvalRun.suite_id == suite_id,
                    EvalRun.partition == partition,
                    EvalRun.target_version == baseline_version,
                    EvalRun.status == RUN_STATUS_COMPLETED,
                )
                .order_by(EvalRun.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if baseline is None:
            return 0
        rows = (
            await session.execute(select(EvalResult.case_id, EvalResult.score).where(EvalResult.run_id == baseline.id))
        ).all()
        baseline_scores: dict[str, float] = {}
        for case_id, score in rows:
            baseline_scores[str(case_id)] = float(score)
        return _compute_run_regression(
            baseline_scores=baseline_scores,
            candidate_scores=candidate_scores,
        )

    @staticmethod
    async def _fail_run(
        session: AsyncSession,
        *,
        suite_id,
        target_kind: str,
        target_ref: str,
        target_version: str,
        baseline_version: str | None,
        partition: str | None,
        trigger: str,
        error: str,
    ) -> EvalRun:
        run = EvalRun(
            suite_id=suite_id,
            target_kind=target_kind,
            target_ref=target_ref,
            target_version=target_version,
            baseline_version=baseline_version,
            trigger=trigger,
            status=RUN_STATUS_FAILED,
            partition=partition,
            regression_count=0,
            error=error,
        )
        session.add(run)
        await session.flush()
        return run


# =============================================================================
# 防 Goodhart 查询（proposer 读证据的唯一入口）
# =============================================================================


def visible_results_query(*, suite_id):
    """proposer 读取 eval 证据的**唯一入口**——结构性排除 ``partition='holdout'`` 的 run。

    综述 §9.4 防 Goodhart：冻结 holdout 结果不回流 proposer。任何 skill/agent 进化 proposer
    读取 case 级评分都必须经此函数，确保 holdout 仅服务于晋升裁决。
    """
    return (
        select(EvalResult)
        .join(EvalRun, EvalRun.id == EvalResult.run_id)
        .where(
            EvalRun.suite_id == suite_id,
            EvalRun.partition != RUN_PARTITION_HOLDOUT,
            EvalRun.status == RUN_STATUS_COMPLETED,
        )
    )


# =============================================================================
# 辅助
# =============================================================================


def _percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    # 线性插值（nearest-rank 对小样本噪声大，用线性）
    pos = q * (len(s) - 1)
    lo = int(pos)
    hi = min(lo + 1, len(s) - 1)
    frac = pos - lo
    return s[lo] + (s[hi] - s[lo]) * frac


__all__ = [
    "CaseOutput",
    "TargetExecutor",
    "SkillExecutor",
    "AgentLoopExecutor",
    "SuiteRunner",
    "visible_results_query",
]
