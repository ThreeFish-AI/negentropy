"""
MemoryHealthChecker — 记忆系统健康检查。

检查维度：
1. DB 连通性（执行轻量 SELECT 1）
2. Feature flag 状态汇总
3. 核心表行数快照
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.observability.health_checker")


async def check_memory_health() -> dict[str, Any]:
    """执行记忆系统健康检查，返回结构化状态。"""
    status = "healthy"
    checks: dict[str, Any] = {}

    # 1 & 3. DB 连通性 + 核心表行数合并到单 session（旧实现开两个独立 session）：
    # 两个 inner try 保留失败粒度（「连通 OK 但计数失败」仍可区分）；外层 try 复现
    # 旧行为——session/checkout 完全不可用时 db 与 tables 均标记 error 并降级。
    try:
        async with db_session.AsyncSessionLocal() as db:
            try:
                await db.execute(sa.text("SELECT 1"))
                checks["db"] = {"status": "ok"}
            except Exception as exc:
                checks["db"] = {"status": "error", "detail": str(exc)[:200]}
                status = "degraded"

            # 核心表行数（无过滤全表 count，用于快速诊断空表）：两个标量子查询
            # 并入单次往返。
            try:
                from negentropy.models.internalization import Fact, Memory

                counts_stmt = sa.select(
                    sa.select(sa.func.count()).select_from(Memory).scalar_subquery().label("memories"),
                    sa.select(sa.func.count()).select_from(Fact).scalar_subquery().label("facts"),
                )
                row = (await db.execute(counts_stmt)).one()
                checks["tables"] = {
                    "memories": row.memories or 0,
                    "facts": row.facts or 0,
                }
            except Exception as exc:
                await db.rollback()
                checks["tables"] = {"status": "error", "detail": str(exc)[:200]}
                status = "degraded"
    except Exception as exc:
        checks.setdefault("db", {"status": "error", "detail": str(exc)[:200]})
        checks.setdefault("tables", {"status": "error", "detail": str(exc)[:200]})
        status = "degraded"

    # 2. Feature flags（纯配置读，独立于 DB：即使 DB / 会话不可用也必采集，与旧行为一致）
    try:
        from negentropy.config import settings as global_settings

        mem_cfg = global_settings.memory
        checks["features"] = {
            "hipporag": mem_cfg.hipporag.enabled,
            "reflection": mem_cfg.reflection.enabled,
            "consolidation_legacy": mem_cfg.consolidation.legacy,
            "consolidation_policy": mem_cfg.consolidation.policy,
            "consolidation_steps": mem_cfg.consolidation.steps,
            "pii_engine": mem_cfg.pii.engine,
            "relevance_enabled": mem_cfg.relevance.enabled,
            "gatekeeper_enabled": mem_cfg.pii.gatekeeper_enabled,
        }

        # 检测 PII 引擎实际运行状态（可能因 fallback 与配置不同）：
        # detector.name 返回 "presidio" / "regex"，与 pii_engine 配置项对比
        # 即可发现 Presidio 依赖缺失触发的静默降级（allow_engine_fallback=true 时）。
        try:
            from negentropy.engine.governance.pii.factory import get_pii_detector

            detector = get_pii_detector()
            checks["features"]["pii_engine_actual"] = detector.name
        except Exception as exc:
            checks["features"]["pii_engine_actual"] = "unavailable"
            logger.warning("pii_engine_probe_failed", error=str(exc)[:200])
    except Exception as exc:
        checks["features"] = {"status": "error", "detail": str(exc)[:200]}
        status = "degraded"

    return {"status": status, "checks": checks}
