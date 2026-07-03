"""反事实 Skill Influence Pattern（综述 §8 Counterfactual Trace Auditing 的工程化）。

动机（综述 §8）：pass-rate Δ 可能很小（+0.3pp）但行为影响显著（522 处）。仅看 run 级均值会
漏掉单 case 的正/负迁移。``CounterfactualAttributor`` 对候选 run 与基线 run 的**重叠 case**
子采样计算 ``score_delta`` + ``influence_label``，写回候选 run 的 ``eval_results.attribution``——
使 skill 进化 proposer 看到「哪些 case 移动了」，而非仅均值。

只对**可见集**做（holdout 集候选专跑、不暴露基线，综述 §9.4 防 Goodhart）。复用既有 eval_results
行（候选 visible run + 基线 visible run），不重复 Judge，成本封顶在 ``sample_cap``。

参考文献：
[1] C. Jiang et al., "Self-Improving Agents in the Era of Experience," 2026. §8 CTA + path attribution。
[2] Z. Zhou et al., "Counterfactual trace auditing," 2026. 行为影响 vs 分数 Δ。
"""

from __future__ import annotations

import hashlib
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger
from negentropy.models.eval_suite import EvalResult

logger = get_logger("negentropy.engine.eval.attribution")

ATTRIBUTION_NEUTRAL_BAND = 3.0  # |Δ| < 此值 → neutral（噪声带）
ATTRIBUTION_SAMPLE_CAP = 20  # 反事实子采样上限（成本封顶）
_EVIDENCE_EXCERPT_CAP = 200  # evidence_excerpt 字符上限


def influence_label(*, score_delta: float, neutral_band: float = ATTRIBUTION_NEUTRAL_BAND) -> str:
    """单 case 的 score_delta → influence_label（positive|negative|neutral）。"""
    if abs(score_delta) < neutral_band:
        return "neutral"
    return "positive" if score_delta > 0 else "negative"


def _stable_rank_key(case_id: str) -> int:
    """case_id → 稳定整数（子采样确定性，避免随机）。"""
    return int(hashlib.sha256(str(case_id).encode()).hexdigest()[:12], 16)


def _excerpt(judge_raw: dict[str, Any] | None) -> str | None:
    if not isinstance(judge_raw, dict):
        return None
    reflection = judge_raw.get("reflection")
    if isinstance(reflection, str) and reflection.strip():
        return reflection.strip()[:_EVIDENCE_EXCERPT_CAP]
    return None


class CounterfactualAttributor:
    """对候选 run vs 基线 run 的重叠 case 子采样作反事实归因，写回候选 ``eval_results.attribution``。

    用法（SkillTemplateHandler.shadow 阶段）：候选 visible run 与基线 visible run 都完成后调
    ``await attributor.attribute(session, candidate_run_id=..., baseline_run_id=...)``。
    返回被写入 attribution 的 case 数。
    """

    def __init__(
        self,
        *,
        sample_cap: int = ATTRIBUTION_SAMPLE_CAP,
        neutral_band: float = ATTRIBUTION_NEUTRAL_BAND,
    ) -> None:
        self._sample_cap = sample_cap
        self._neutral_band = neutral_band

    async def attribute(
        self,
        session: AsyncSession,
        *,
        candidate_run_id: str,
        baseline_run_id: str,
    ) -> int:
        cand_rows = {
            str(r.case_id): r
            for r in (await session.execute(select(EvalResult).where(EvalResult.run_id == candidate_run_id)))
            .scalars()
            .all()
        }
        base_rows = {
            str(r.case_id): r
            for r in (await session.execute(select(EvalResult).where(EvalResult.run_id == baseline_run_id)))
            .scalars()
            .all()
        }

        overlap = [cid for cid in cand_rows if cid in base_rows]
        if not overlap:
            return 0
        # 稳定子采样：按 case_id hash 排序取前 sample_cap
        overlap.sort(key=_stable_rank_key)
        sampled = overlap[: self._sample_cap]

        count = 0
        for cid in sampled:
            cand = cand_rows[cid]
            base = base_rows[cid]
            delta = float(cand.score) - float(base.score)
            cand.attribution = {
                "with_version_run": str(candidate_run_id),
                "without_version_run": str(baseline_run_id),
                "with_score": float(cand.score),
                "without_score": float(base.score),
                "score_delta": round(delta, 4),
                "influence_label": influence_label(score_delta=delta, neutral_band=self._neutral_band),
                "with_verdict": cand.verdict,
                "without_verdict": base.verdict,
                "evidence_excerpt": _excerpt(cand.judge_raw),
            }
            count += 1
        await session.flush()
        logger.info(
            "eval_attribution_written",
            candidate_run=str(candidate_run_id),
            baseline_run=str(baseline_run_id),
            attributed=count,
            overlap=len(overlap),
        )
        return count


__all__ = [
    "ATTRIBUTION_NEUTRAL_BAND",
    "ATTRIBUTION_SAMPLE_CAP",
    "influence_label",
    "CounterfactualAttributor",
]
