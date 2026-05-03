"""
MemoryMetricsService — 从现有 DB 表聚合记忆系统健康指标。

理论参考：
- Google SRE 四大黄金信号：Latency / Traffic / Errors / Saturation<sup>[[1]](#ref1)</sup>
- USE 方法：Utilization / Saturation / Errors<sup>[[2]](#ref2)</sup>

所有指标从现有表（memories, facts, memory_retrieval_logs, memory_audit_logs）聚合，
不引入新 schema。

参考文献:
[1] B. Beyer et al., *Site Reliability Engineering*, O'Reilly, 2016.
[2] B. Gregg, "The USE Method," <http://www.brendangregg.com/usemethod.html>, 2013.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import Fact, Memory, MemoryAuditLog, MemoryRetrievalLog

logger = get_logger("negentropy.engine.observability.memory_metrics")


async def get_memory_metrics(*, user_id: str | None = None, app_name: str = "negentropy") -> dict[str, Any]:
    """聚合记忆系统指标。

    基于 SRE 四大黄金信号<sup>[[1]](#ref1)</sup>和 USE 方法<sup>[[2]](#ref2)</sup>，
    从现有表聚合搜索延迟、巩固成功率、Retention 分布、PII 检测率等指标。
    """
    now = datetime.now(UTC)
    window_24h = now - timedelta(hours=24)

    async with db_session.AsyncSessionLocal() as db:
        # --- Retention 分布 ---
        retention_stmt = sa.select(
            sa.func.avg(Memory.retention_score).label("avg"),
            sa.func.percentile_cont(0.1).within_group(Memory.retention_score.asc()).label("p10"),
            sa.func.percentile_cont(0.9).within_group(Memory.retention_score.asc()).label("p90"),
            sa.func.count().label("total"),
            sa.func.sum(sa.case((Memory.retention_score < 0.1, 1), else_=0)).label("low_count"),
        ).where(
            Memory.app_name == app_name,
            sa.func.coalesce(Memory.metadata_["deleted"].astext, "false") != "true",
        )
        if user_id:
            retention_stmt = retention_stmt.where(Memory.user_id == user_id)
        ret_row = (await db.execute(retention_stmt)).one()

        # --- 搜索指标（24h） ---
        search_stmt = sa.select(
            sa.func.count().label("total_24h"),
            sa.func.sum(sa.case((MemoryRetrievalLog.was_referenced.is_(True), 1), else_=0)).label("referenced_24h"),
            sa.func.sum(sa.case((MemoryRetrievalLog.outcome_feedback == "helpful", 1), else_=0)).label("helpful_24h"),
            sa.func.sum(sa.case((MemoryRetrievalLog.outcome_feedback.isnot(None), 1), else_=0)).label(
                "with_feedback_24h"
            ),
        ).where(
            MemoryRetrievalLog.app_name == app_name,
            MemoryRetrievalLog.created_at >= window_24h,
        )
        if user_id:
            search_stmt = search_stmt.where(MemoryRetrievalLog.user_id == user_id)
        search_row = (await db.execute(search_stmt)).one()

        # --- 巩固指标（24h audit log） ---
        audit_stmt = sa.select(
            sa.func.count().label("total_24h"),
            sa.func.sum(sa.case((MemoryAuditLog.decision == "retain", 1), else_=0)).label("retain_24h"),
        ).where(
            MemoryAuditLog.app_name == app_name,
            MemoryAuditLog.created_at >= window_24h,
        )
        if user_id:
            audit_stmt = audit_stmt.where(MemoryAuditLog.user_id == user_id)
        audit_row = (await db.execute(audit_stmt)).one()

        # --- PII 检测率 ---
        pii_stmt = sa.select(
            sa.func.count().label("total"),
            sa.func.sum(
                sa.case(
                    (Memory.metadata_["pii_flags"].astext.isnot(None), 1),
                    else_=0,
                )
            ).label("with_pii"),
        ).where(
            Memory.app_name == app_name,
            sa.func.coalesce(Memory.metadata_["deleted"].astext, "false") != "true",
        )
        if user_id:
            pii_stmt = pii_stmt.where(Memory.user_id == user_id)
        pii_row = (await db.execute(pii_stmt)).one()

        # --- Facts & Associations ---
        fact_count = (
            await db.execute(sa.select(sa.func.count()).select_from(Fact).where(Fact.app_name == app_name))
        ).scalar() or 0

        assoc_count = 0
        try:
            from negentropy.models.internalization import MemoryAssociation

            assoc_count = (
                await db.execute(
                    sa.select(sa.func.count())
                    .select_from(MemoryAssociation)
                    .where(MemoryAssociation.app_name == app_name)
                )
            ).scalar() or 0
        except Exception:
            pass

        # --- KG Entity count ---
        kg_count = 0
        try:
            from negentropy.models.base import NEGENTROPY_SCHEMA

            kg_sql = sa.text(
                f"SELECT count(*) FROM {NEGENTROPY_SCHEMA}.kg_entities WHERE app_name = :app_name AND is_active IS TRUE"
            )
            kg_count = (await db.execute(kg_sql, {"app_name": app_name})).scalar() or 0
        except Exception:
            pass

    search_total = search_row.total_24h or 0
    with_feedback = search_row.with_feedback_24h or 0
    helpful = search_row.helpful_24h or 0
    audit_total = audit_row.total_24h or 0
    pii_total = pii_row.total or 0
    pii_with = pii_row.with_pii or 0

    return {
        # 搜索指标
        "search_total_24h": search_total,
        "search_reference_rate": (search_row.referenced_24h or 0) / search_total if search_total > 0 else 0.0,
        "search_helpful_rate": helpful / with_feedback if with_feedback > 0 else 0.0,
        # 巩固指标
        "consolidation_total_24h": audit_total,
        "consolidation_retain_rate": (audit_row.retain_24h or 0) / audit_total if audit_total > 0 else 0.0,
        # Retention 分布
        "retention_score_avg": float(ret_row.avg or 0.0),
        "retention_score_p10": float(ret_row.p10 or 0.0),
        "retention_score_p90": float(ret_row.p90 or 0.0),
        "low_retention_count": ret_row.low_count or 0,
        "memory_total": ret_row.total or 0,
        # PII
        "pii_detection_rate": pii_with / pii_total if pii_total > 0 else 0.0,
        "pii_detected_count": pii_with,
        # Facts & 关联
        "fact_count": fact_count,
        "association_count": assoc_count,
        "kg_entity_count": kg_count,
    }
