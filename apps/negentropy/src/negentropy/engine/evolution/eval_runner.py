"""记忆面 shadow / canary eval —— 窗口在线指标对比（**不建 eval 四表子系统**）。

利用 ``memory_retrieval_logs.config_version``（迁移 0081 新增列）分桶聚合：
- shadow 阶段：聚合 active 配置版本的近窗口指标（准入闸用，确认基线样本充足）；
- canary 阶段：分别聚合候选版本桶与 active 版线桶的窗口指标，供 ``decide_canary`` 对比。

聚合 SQL 复用 ``retrieval_tracker.get_effectiveness_metrics`` 的模板（同口径 zero_hit_rate /
helpful_ratio / referenced_rate），仅加 ``config_version`` 分桶。

参考文献：
[1] Z. Tan et al., "Reflective memory management for long-term personalized dialogue
    agents," in Proc. ACL, 2025. arXiv:2503.08026. 检索反馈在线调优的指标口径。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import MemoryRetrievalLog

logger = get_logger("negentropy.engine.evolution.eval_runner")


@dataclass(frozen=True, slots=True)
class WindowMetrics:
    """单配置版本桶的窗口聚合指标（满足 decision._MetricsView Protocol）。"""

    config_version: str | None
    sample_n: int  # 窗口内检索总次数（zero_hit_rate 分母）
    zero_hit_rate: float  # zero_hit / sample_n（越低越好）
    helpful_ratio: float  # helpful / with_feedback（越高越好；无反馈→0）
    referenced_rate: float  # referenced / sample_n（越高越好）
    diversity_ratio: float  # distinct retrieved memory_id / 非 zero_hit 样本数（防 collapse）

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.config_version,
            "sample_n": self.sample_n,
            "zero_hit_rate": round(self.zero_hit_rate, 4),
            "helpful_ratio": round(self.helpful_ratio, 4),
            "referenced_rate": round(self.referenced_rate, 4),
            "diversity_ratio": round(self.diversity_ratio, 4),
        }


async def aggregate_window(
    *,
    app_name: str,
    config_version: str | None,
    since: datetime,
    user_id: str | None = None,
) -> WindowMetrics:
    """聚合 ``memory_retrieval_logs`` 中指定 config_version 桶、``since`` 之后的窗口指标。

    ``config_version=None`` → 聚合历史未标版本的行（NULL 桶）。
    ``diversity_ratio``：distinct retrieved memory_id / 非 zero_hit 样本数（anti-collapse 护栏，
    综述 §10.4——防优化 helpful_ratio 靠收窄检索到单一记忆簇实现）。Python 侧二次聚合 distinct
    （窗口内行数有限，比 SQL unnest+distinct 关联写法更清晰可测）。
    """
    async with db_session.AsyncSessionLocal() as db:
        stmt = sa.select(
            sa.func.count().label("total"),
            sa.func.sum(sa.case((MemoryRetrievalLog.was_referenced.is_(True), 1), else_=0)).label("referenced"),
            sa.func.sum(sa.case((MemoryRetrievalLog.outcome_feedback == "helpful", 1), else_=0)).label("helpful"),
            sa.func.sum(sa.case((MemoryRetrievalLog.outcome_feedback.isnot(None), 1), else_=0)).label("with_feedback"),
            sa.func.sum(sa.case((sa.func.cardinality(MemoryRetrievalLog.retrieved_memory_ids) == 0, 1), else_=0)).label(
                "zero_hit"
            ),
        ).where(
            MemoryRetrievalLog.app_name == app_name,
            MemoryRetrievalLog.created_at >= since,
        )
        id_stmt = sa.select(MemoryRetrievalLog.retrieved_memory_ids).where(
            MemoryRetrievalLog.app_name == app_name,
            MemoryRetrievalLog.created_at >= since,
        )
        if config_version is None:
            stmt = stmt.where(MemoryRetrievalLog.config_version.is_(None))
            id_stmt = id_stmt.where(MemoryRetrievalLog.config_version.is_(None))
        else:
            stmt = stmt.where(MemoryRetrievalLog.config_version == config_version)
            id_stmt = id_stmt.where(MemoryRetrievalLog.config_version == config_version)
        if user_id:
            stmt = stmt.where(MemoryRetrievalLog.user_id == user_id)
            id_stmt = id_stmt.where(MemoryRetrievalLog.user_id == user_id)
        row = (await db.execute(stmt)).one()
        id_rows = (await db.execute(id_stmt)).scalars().all()

    total = row.total or 0
    referenced = row.referenced or 0
    helpful = row.helpful or 0
    with_feedback = row.with_feedback or 0
    zero_hit = row.zero_hit or 0
    distinct_mem = len({mid for ids in id_rows for mid in (ids or [])})
    non_zero = total - zero_hit
    return WindowMetrics(
        config_version=config_version,
        sample_n=total,
        zero_hit_rate=(zero_hit / total) if total else 0.0,
        helpful_ratio=(helpful / with_feedback) if with_feedback else 0.0,
        referenced_rate=(referenced / total) if total else 0.0,
        diversity_ratio=(distinct_mem / non_zero) if non_zero else 0.0,
    )


async def run_shadow_eval(*, app_name: str, active_version: str, window_seconds: int) -> WindowMetrics:
    """shadow 阶段：聚合 active 配置版本的近窗口指标（准入闸用）。"""
    since = datetime.now(UTC) - timedelta(seconds=window_seconds)
    return await aggregate_window(app_name=app_name, config_version=active_version, since=since)


async def run_canary_eval(
    *,
    app_name: str,
    baseline_version: str,
    candidate_version: str,
    window_seconds: int,
) -> tuple[WindowMetrics, WindowMetrics]:
    """canary 阶段：分别聚合基线桶与候选桶的窗口指标，供 ``decide_canary`` 对比。"""
    since = datetime.now(UTC) - timedelta(seconds=window_seconds)
    baseline = await aggregate_window(app_name=app_name, config_version=baseline_version, since=since)
    candidate = await aggregate_window(app_name=app_name, config_version=candidate_version, since=since)
    return baseline, candidate


__all__ = ["WindowMetrics", "aggregate_window", "run_shadow_eval", "run_canary_eval"]
