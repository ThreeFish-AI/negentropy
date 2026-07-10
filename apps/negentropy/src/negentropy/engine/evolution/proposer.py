"""GEPA 式进化提案器 — 镜像 ``engine/consolidation/reflection_generator.py`` 范式。

``_ProposerBase`` 封装 ``resolve_model_config_async`` + ``litellm.acompletion``(json_object) +
``2**attempt`` 退避 + JSON 容错骨架，供后续 agent/skill 面无重造复用（各面继承并 override
``_build_prompt`` / ``_parse``）。retrieval 面第一切片落 ``RetrievalWeightProposer``。

设计要点（与 reflection 的差异）：
- **无 pattern fallback**：进化提案无合理模板兜底——LLM 失败/解析失败一律返回 None
  （宁可不提不乱提，对齐蓝图 §9.6 进化提案治理）；
- **bounded mutation**：semantic_weight 单步 ≤ ``WEIGHT_MAX_STEP``、硬上下界 [0.3,0.9]，
  模型输出经 ``clamp_weight`` 后偏差过大视为失控→丢弃；
- **keyword_weight 强制归一**：``1 - semantic_weight``，不信任模型输出；
- **冷启动保护**：``window_metrics.sample_n < MIN_SAMPLE_N`` → 不调 LLM 直接 None。

参考文献：
[1] L. A. Agrawal et al., "GEPA: Reflective prompt evolution can outperform
    reinforcement learning," in Proc. ICLR (Oral), 2026. arXiv:2507.19457.
[2] Q. Zhang et al., "Agentic context engineering," in Proc. ICLR, 2026. arXiv:2510.04618.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

import litellm

from negentropy.engine.routine.faculty_bridge import run_faculty_json
from negentropy.engine.utils.json_extract import loads_lenient
from negentropy.engine.utils.model_config import resolve_model_config_async
from negentropy.logging import get_logger

from .decision import (
    MIN_SAMPLE_N,
    WEIGHT_LOWER_BOUND,
    WEIGHT_MAX_STEP,
    WEIGHT_UPPER_BOUND,
    clamp_weight,
    is_within_bounds,
)

logger = get_logger("negentropy.engine.evolution.proposer")

# 偏差失控阈值：clamp 后候选与模型原值偏差 > 2*MAX_STEP 视为模型失控，丢弃
_OUT_OF_CONTROL_TOLERANCE = WEIGHT_MAX_STEP * 2

# prompt 内嵌的近期负样本条数上限（避免 prompt 膨胀）
_MAX_RECENT_NEGATIVES = 5


@dataclass(frozen=True, slots=True)
class ProposalDraft:
    """proposer 产出的候选草案（尚未落库）。"""

    semantic_weight: float
    keyword_weight: float
    rationale: str
    expected_effect: dict[str, str] | None = None


class _ProposerBase:
    """LLM 调用 + 容错骨架（各面 proposer 继承并 override _build_prompt / _parse）。

    子类须实现：
    - ``_build_prompt(...)``：构造中文 prompt（返回 None 表示无需提案，如冷启动）；
    - ``_parse(content)``：解析 LLM JSON 输出为 ``ProposalDraft | None``。
    """

    _TASK_KEY = "evolution.propose"  # 子类可覆盖；须在 config/task_registry.py 注册

    def __init__(
        self,
        model: str | None = None,
        temperature: float = 0.0,
        max_retries: int = 3,
    ) -> None:
        self._explicit_model = model
        self._model: str = ""
        self._model_kwargs: dict[str, Any] = {}
        self._temperature = temperature
        self._max_retries = max_retries

    async def _resolve_model(self) -> None:
        self._model, self._model_kwargs = await resolve_model_config_async(
            self._TASK_KEY,
            explicit_model=self._explicit_model,
        )

    async def _call_llm(self, prompt: str) -> str | None:
        """带指数退避的 LLM 调用；全失败返回 None（无 pattern fallback）。"""
        last_error: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                safe_kwargs = {
                    k: v
                    for k, v in self._model_kwargs.items()
                    if k not in ("model", "messages", "temperature", "response_format")
                }
                response = await litellm.acompletion(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self._temperature,
                    response_format={"type": "json_object"},
                    **safe_kwargs,
                )
                return response.choices[0].message.content
            except Exception as exc:
                last_error = exc
                logger.warning("evolution_proposer_retry", attempt=attempt + 1, error=str(exc))
                await asyncio.sleep(2**attempt)
        logger.warning("evolution_proposer_llm_failed", error=str(last_error), model=self._model)
        return None

    # 子类 override：
    def _build_prompt(self, **kwargs: Any) -> str | None:  # noqa: ARG002
        raise NotImplementedError

    def _parse(self, content: str) -> ProposalDraft | None:  # noqa: ARG002
        raise NotImplementedError

    async def _propose_with_faculty(self, prompt: str) -> ProposalDraft | None:
        """FacultyBridge(contemplation, read_only) 优先 + litellm 兜底（WS2 收编）。

        ``parse→None``（解析失败 / 超界失控 / ``no_change=true``）即降级 litellm；litellm 亦失败
        → ``None``（「宁缺毋滥」，不提案）。开关关（默认）→ 直接 litellm，行为与改造前逐字节等价。
        提案属低频单发，用评审类超时（``faculty_bridge_timeout_seconds``）。
        """
        from negentropy.config import settings

        enabled = settings.routine.faculty_bridge_enabled and settings.routine.faculty_bridge_evolution_enabled

        async def fallback() -> ProposalDraft | None:
            content = await self._call_llm(prompt)
            if not content:
                return None
            return self._parse(content)

        draft, _used = await run_faculty_json(
            "contemplation",
            prompt,
            parse=self._parse,
            fallback=fallback,
            enabled=enabled,
            timeout_seconds=float(settings.routine.faculty_bridge_timeout_seconds),
            read_only=True,
        )
        return draft


class RetrievalWeightProposer(_ProposerBase):
    """retrieval_config 面：对 hybrid 检索 semantic/keyword 权重做 GEPA 式有界变异。"""

    _TASK_KEY = "evolution.propose"

    async def propose(
        self,
        *,
        active_snapshot: dict[str, float],
        window_metrics: dict[str, Any],
        recent_negatives: list[dict[str, Any]] | None = None,
        min_samples: int = MIN_SAMPLE_N,
    ) -> ProposalDraft | None:
        """产出 retrieval 权重变异草案。

        冷启动（``window_metrics.sample_n < min_samples``）→ 不调 LLM，返回 None。
        LLM 失败 / 解析失败 / 超界失控 / ``no_change=true`` → 返回 None。
        """
        sample_n = int(window_metrics.get("sample_n") or 0)
        if sample_n < min_samples:
            logger.info("evolution_proposer_skip_low_samples", sample_n=sample_n, min=min_samples)
            return None

        await self._resolve_model()
        prompt = self._build_prompt(
            active_snapshot=active_snapshot,
            window_metrics=window_metrics,
            recent_negatives=recent_negatives or [],
        )
        if prompt is None:
            return None

        return await self._propose_with_faculty(prompt)

    # ------------------------------------------------------------------
    # override
    # ------------------------------------------------------------------

    def _build_prompt(
        self,
        *,
        active_snapshot: dict[str, float],
        window_metrics: dict[str, Any],
        recent_negatives: list[dict[str, Any]],
    ) -> str | None:
        sw = active_snapshot.get("semantic_weight", 0.7)
        kw = active_snapshot.get("keyword_weight", 0.3)
        n = int(window_metrics.get("sample_n") or 0)
        zhr = _fmt(window_metrics.get("zero_hit_rate"))
        hr = _fmt(window_metrics.get("helpful_ratio"))
        rr = _fmt(window_metrics.get("referenced_rate"))

        negatives_block = _format_negatives(recent_negatives[:_MAX_RECENT_NEGATIVES])

        return _PROPOSAL_PROMPT.format(
            sw=sw,
            kw=kw,
            n=n,
            zhr=zhr,
            hr=hr,
            rr=rr,
            lower=WEIGHT_LOWER_BOUND,
            upper=WEIGHT_UPPER_BOUND,
            max_step=WEIGHT_MAX_STEP,
            negatives_block=negatives_block,
        )

    def _parse(self, content: str) -> ProposalDraft | None:
        data: dict[str, Any] = loads_lenient(content)
        if not isinstance(data, dict):
            logger.warning("evolution_proposer_response_not_json", preview=(content or "")[:200])
            return None

        if bool(data.get("no_change", False)):
            logger.info("evolution_proposer_no_change")
            return None

        raw_sw = data.get("semantic_weight")
        try:
            semantic_raw = float(raw_sw)
        except (TypeError, ValueError):
            logger.warning("evolution_proposer_invalid_weight", raw=raw_sw)
            return None

        # 有界变异校验：先确认模型输出在合法上下界内，再 clamp；clamp 后偏差过大→失控丢弃
        if not is_within_bounds(semantic_raw):
            clamped = clamp_weight(semantic_raw)
            if abs(clamped - semantic_raw) > _OUT_OF_CONTROL_TOLERANCE:
                logger.warning(
                    "evolution_proposer_out_of_control",
                    raw=semantic_raw,
                    clamped=clamped,
                )
                return None
            semantic = clamped
        else:
            semantic = round(semantic_raw, 4)

        keyword = round(1.0 - semantic, 4)  # 强制归一，不信任模型 keyword 输出
        rationale = str(data.get("rationale", "")).strip()[:240]
        expected = data.get("expected_effect")
        return ProposalDraft(
            semantic_weight=semantic,
            keyword_weight=keyword,
            rationale=rationale,
            expected_effect=expected if isinstance(expected, dict) else None,
        )


# =============================================================================
# prompt 模板 + 辅助
# =============================================================================

_PROPOSAL_PROMPT = """\
你是记忆检索参数进化器（GEPA 范式）。基于近窗口检索效果指标，提出对 hybrid 检索
语义/关键词权重的一次「有界变异」提案——目标是降低零命中、提升被引用检索的 helpful 占比。

# 当前 active 配置
semantic_weight={sw}，keyword_weight={kw}（二者之和恒为 1.0）

# 近窗口检索效果指标（样本量 n={n}）
- zero_hit_rate={zhr}（检索发生但零命中的比例，越低越好）
- helpful_ratio={hr}（被产出引用的检索中标记 helpful 的比例，越高越好）
- referenced_rate={rr}（被产出引用的检索占比，越高越好）

# 近期被拒绝/回滚的提案（避免重复探索死方向）
{negatives_block}

# 约束（违反将被 clamp 或丢弃）
1. bounded mutation：semantic_weight 单步变异幅度 ≤ {max_step}
2. 硬上下界：semantic_weight ∈ [{lower}, {upper}]
3. keyword_weight 自动等于 1 - semantic_weight，无需你给出
4. 仅在指标确有改进空间时提案；若当前配置已接近最优，返回 no_change=true

# 输出（仅 JSON 单行）
{{"semantic_weight": <float>, "rationale": "<≤120字改进依据，引用具体指标变化>", \
"expected_effect": {{"zero_hit_rate": "↑|↓|≈", "helpful_ratio": "↑|↓|≈"}}, "no_change": false}}
"""


def _fmt(v: Any, nd: int = 3) -> str:
    """格式化指标为字符串，None/非法 → 'N/A'。"""
    try:
        return f"{float(v):.{nd}f}"
    except (TypeError, ValueError):
        return "N/A"


def _format_negatives(negatives: list[dict[str, Any]]) -> str:
    if not negatives:
        return "（无）"
    lines: list[str] = []
    for i, neg in enumerate(negatives, 1):
        payload = neg.get("payload") or {}
        sw = payload.get("semantic_weight", "?")
        reason = neg.get("status") or neg.get("reason") or "?"
        lines.append(f"[{i}] semantic_weight={sw} → {reason}")
    return "\n".join(lines)


__all__ = ["ProposalDraft", "RetrievalWeightProposer"]
