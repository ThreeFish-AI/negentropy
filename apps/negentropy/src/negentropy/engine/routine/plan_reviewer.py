"""Routine Plan Reviewer — NegentropyEngine 自动审阅 Claude Code 的实现方案。

当 Claude Code 在 PLAN 阶段产出实现方案并等待审批时，NegentropyEngine 作为
Agent-as-Judge 对方案进行模块级审阅分析，产出 approve/refine 决策。

审阅产出：
- verdict：approve（通过）/ refine（需完善）
- score：0-100 评分
- module_reviews：按功能模块逐项评审
- feedback：给 Claude Code 的具体反馈（refine 时有效）
- reflection：Engine 内部反思

设计范式复用 ``evaluator.py``：``resolve_model_config_async`` + ``litellm.acompletion``
+ 结构化 JSON 输出 + 指数退避重试。
"""

from __future__ import annotations

import asyncio
from contextlib import suppress
from dataclasses import dataclass
from typing import Any

import litellm

from negentropy.engine.utils.json_extract import loads_lenient
from negentropy.engine.utils.model_config import resolve_model_config_async
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.routine.plan_reviewer")

_TASK_KEY = "routine.plan_review"
# 提交给 judge 的方案默认字符上限。历史值 8000 过小：多 Phase 迁移方案（10K~16K 字符）被静默
# 切到 Phase 3~6 处，judge 看不到尾部 → 反复误判「Phase 缺失/不完整」→ refine 闭环结构性无法收敛
# （Routine 卡环根因）。现代 judge 模型上下文 200K tokens，抬至 200000 字符后正常方案永不触发截断；
# 仅作失控超长的有限上界。可经 ``review(max_plan_chars=...)`` 覆盖（settings.routine.plan_review_max_plan_chars
# → ctx → hook 逐层透传）。
_DEFAULT_PLAN_MAX_CHARS = 200_000

# 真发生截断时附于方案末尾的显式告知：阻止 judge「因未见尾部而判完整性不达标」的死循环复发。
_TRUNCATION_NOTICE = (
    "\n\n[⚠ 方案过长已被系统截断：以上为方案前 {shown} 字符，尾部 {dropped} 字符未展示。"
    "请仅就已展示内容评审，**切勿因未见尾部而判定方案不完整或 Phase 缺失**。]"
)


@dataclass(frozen=True, slots=True)
class ModuleReview:
    """单个功能模块的评审结果。"""

    module: str
    status: str  # "pass" | "warn" | "fail"
    comment: str


@dataclass(frozen=True, slots=True)
class PlanReviewResult:
    """Plan 审阅产出。``ok=False`` 时表示审阅自身失败（LLM 不可用等）。"""

    ok: bool
    verdict: str | None = None  # "approve" | "refine"
    score: int | None = None
    module_reviews: tuple[ModuleReview, ...] = ()
    feedback: str | None = None
    reflection: str | None = None
    error: str | None = None
    judge_prompt: str | None = None
    judge_raw: str | None = None


_REVIEW_PROMPT = """\
你是 NegentropyEngine，系统的本我（Self）。
你的职责是以 Agent-as-Judge 的身份审阅 Claude Code 提交的实现方案（Plan）。

# 目标
{goal}

# 验收标准
{acceptance_criteria}

# Claude Code 提交的实现方案（Plan）
{plan_text}

# 既往迭代反馈
{reflections_section}

请从以下维度审阅此实现方案：

## 审阅维度
1. **完整性**：方案是否覆盖了所有验收标准？是否有遗漏的功能点或边界情况？
2. **可行性**：技术方案是否可落地？是否存在不可行的技术假设？
3. **风险识别**：方案是否有潜在的副作用或风险？是否考虑了错误处理和回退策略？
4. **模块划分**：方案的模块拆分是否合理？模块间依赖是否清晰？
5. **测试策略**：方案是否包含验证策略？是否能通过验收标准中的验证手段？

## 输出格式

对每个识别到的功能模块进行评审，然后给出总体决策。

仅输出 JSON：
{{"
  "score": <int 0-100>,
  "verdict": "<approve|refine>",
  "module_reviews": [
    {{"module": "<模块名>", "status": "<pass|warn|fail>", "comment": "<评审意见>"}}
  ],
  "feedback": "<给 CC 的反馈，refine 时为具体完善要求，approve 时为简短认可>",
  "reflection": "<Engine 内部反思，≤200字>"
}}"""

_VALID_VERDICTS = {"approve", "refine"}
_VALID_STATUSES = {"pass", "warn", "fail"}


class PlanReviewer:
    """NegentropyEngine Plan 自动审阅器。"""

    def __init__(
        self,
        *,
        explicit_model: str | None = None,
        temperature: float = 0.0,
        max_retries: int = 3,
        timeout_seconds: int = 60,
    ) -> None:
        self._explicit_model = explicit_model
        self._temperature = temperature
        self._max_retries = max_retries
        self._timeout_seconds = timeout_seconds

    async def review(
        self,
        *,
        goal: str,
        acceptance_criteria: str,
        plan_text: str,
        reflections: list[str] | None = None,
        max_plan_chars: int = _DEFAULT_PLAN_MAX_CHARS,
    ) -> PlanReviewResult:
        """审阅 Plan 并返回审阅结果。

        ``max_plan_chars``：提交给 judge 的方案字符上限。仅当方案超限才截断，并在尾部附
        :data:`_TRUNCATION_NOTICE` 告知 judge 勿据未见尾部判定缺失（防 refine 死循环复发）。
        """
        raw = (plan_text or "").strip()
        if len(raw) > max_plan_chars:
            plan = raw[:max_plan_chars] + _TRUNCATION_NOTICE.format(
                shown=max_plan_chars, dropped=len(raw) - max_plan_chars
            )
        else:
            plan = raw or "(Claude Code 未产出实现方案)"

        reflections_section = "（无既往反馈）"
        if reflections:
            bullet = "\n".join(f"- {r}" for r in reflections[-5:])
            reflections_section = bullet

        judge_prompt = _REVIEW_PROMPT.format(
            goal=goal,
            acceptance_criteria=acceptance_criteria,
            plan_text=plan,
            reflections_section=reflections_section,
        )

        try:
            score, verdict, module_reviews, feedback, reflection, judge_raw = await self._judge(judge_prompt)
        except Exception as exc:
            logger.warning("plan_review_judge_failed", error=str(exc))
            return PlanReviewResult(
                ok=False,
                error=str(exc),
                judge_prompt=judge_prompt,
            )

        return PlanReviewResult(
            ok=True,
            verdict=verdict,
            score=score,
            module_reviews=tuple(module_reviews),
            feedback=feedback,
            reflection=reflection,
            judge_prompt=judge_prompt,
            judge_raw=judge_raw,
        )

    async def _judge(self, prompt: str) -> tuple[int, str, list[ModuleReview], str, str, str]:
        """调用 LLM 审阅，含指数退避重试。

        FacultyBridge（路径 A，详见 ADR 040）：当 ``settings.routine.faculty_bridge_enabled`` 开启时，
        优先经 ADK Runner 同步调用**真实元神（Contemplation）Faculty** 产出审阅 JSON；失败/超时/解析
        异常即降级到下方 litellm 直调，保证 Plan 审阅永不因 Faculty 不可用而中断。
        """
        from negentropy.config import settings

        if settings.routine.faculty_bridge_enabled:
            with suppress(Exception):
                from negentropy.engine.routine.faculty_bridge import run_faculty

                text = await run_faculty(
                    "contemplation",
                    prompt,
                    timeout_seconds=float(settings.routine.faculty_bridge_timeout_seconds),
                )
                if text:
                    return self._parse(text)
                logger.info("plan_review_faculty_bridge_empty_fallback_litellm")

        model, model_kwargs = await resolve_model_config_async(_TASK_KEY, explicit_model=self._explicit_model)
        safe_kwargs = {
            k: v for k, v in model_kwargs.items() if k not in ("model", "messages", "temperature", "response_format")
        }

        last_error: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                response = await litellm.acompletion(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self._temperature,
                    response_format={"type": "json_object"},
                    timeout=self._timeout_seconds,
                    **safe_kwargs,
                )
                content = response.choices[0].message.content
                return self._parse(content)
            except Exception as exc:
                last_error = exc
                logger.warning("plan_review_judge_retry", attempt=attempt + 1, error=str(exc))
                await asyncio.sleep(2**attempt)

        raise RuntimeError(f"Plan review judge failed after {self._max_retries} retries: {last_error}")

    @staticmethod
    def _parse(content: str | None) -> tuple[int, str, list[ModuleReview], str, str, str]:
        """解析审阅 JSON。"""
        # 容错解析：剥离强模型（如 claude-sonnet-4-6）的 ```json 围栏后再 loads（ISSUE-127）。
        data: dict[str, Any] = loads_lenient(content)

        raw_score = data.get("score", 0)
        try:
            score = int(round(float(raw_score)))
        except (TypeError, ValueError):
            score = 0
        score = max(0, min(100, score))

        verdict = str(data.get("verdict", "")).strip().lower()
        if verdict not in _VALID_VERDICTS:
            verdict = "approve" if score >= 70 else "refine"

        module_reviews: list[ModuleReview] = []
        for raw in data.get("module_reviews", []):
            if isinstance(raw, dict):
                status = str(raw.get("status", "warn")).strip().lower()
                if status not in _VALID_STATUSES:
                    status = "warn"
                module_reviews.append(
                    ModuleReview(
                        module=str(raw.get("module", "未命名模块")),
                        status=status,
                        comment=str(raw.get("comment", "")),
                    )
                )

        feedback = str(data.get("feedback", "")).strip()
        reflection = str(data.get("reflection", "")).strip()

        return score, verdict, module_reviews, feedback, reflection, content or ""


__all__ = ["PlanReviewer", "PlanReviewResult", "ModuleReview"]
