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

    # 1. DB 连通性
    try:
        async with db_session.AsyncSessionLocal() as db:
            await db.execute(sa.text("SELECT 1"))
        checks["db"] = {"status": "ok"}
    except Exception as exc:
        checks["db"] = {"status": "error", "detail": str(exc)[:200]}
        status = "degraded"

    # 2. Feature flags
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
        }
    except Exception as exc:
        checks["features"] = {"status": "error", "detail": str(exc)[:200]}
        status = "degraded"

    # 3. 核心表行数（用于快速诊断空表问题）
    try:
        async with db_session.AsyncSessionLocal() as db:
            from negentropy.models.internalization import Fact, Memory

            mem_count = (await db.execute(sa.select(sa.func.count()).select_from(Memory))).scalar() or 0
            fact_count = (await db.execute(sa.select(sa.func.count()).select_from(Fact))).scalar() or 0
            checks["tables"] = {
                "memories": mem_count,
                "facts": fact_count,
            }
    except Exception as exc:
        checks["tables"] = {"status": "error", "detail": str(exc)[:200]}
        status = "degraded"

    return {"status": status, "checks": checks}
