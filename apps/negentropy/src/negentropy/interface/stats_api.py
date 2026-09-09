"""
Interface Stats API — /interface/stats 聚合统计端点。

由 api.py 按域机械拆分而来（2026-09 熵减）；行为与路由序保持不变，
契约由 tests/unit_tests/interface/test_route_table_contract.py 锁定。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from negentropy.auth.deps import get_current_user_with_db_roles
from negentropy.auth.service import AuthUser
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.model_config import ModelConfig
from negentropy.models.plugin import (
    Agent,
    BuiltinTool,
    McpServer,
    Skill,
)
from negentropy.models.vendor_config import VendorConfig

from .permissions import get_visible_plugin_ids

# logger 名沿用拆分前的 "negentropy.interface.api"：日志消费方按名过滤，改名另行评审
logger = get_logger("negentropy.interface.api")
router = APIRouter(prefix="/interface", tags=["interface"])


# =============================================================================
# Common Response Models
# =============================================================================


class StatsResponse(BaseModel):
    """Dashboard 统计响应"""

    mcp_servers: dict[str, int]
    skills: dict[str, int]
    agents: dict[str, int]
    models: dict[str, int]
    tools: dict[str, int]


# =============================================================================
# Stats Endpoint
# =============================================================================


async def _safe_plugin_stats(db, plugin_type: str, model, user: AuthUser) -> dict[str, int]:
    """单类 plugin 的可见性 + enabled 计数，异常隔离 + 日志可定位。

    设计约定：
    - 任一段 SQL/ORM 异常（schema 漂移、迁移半途、enum 反序列化失败等）
      不再向上抛出 → Dashboard 不会被单点故障拖垮成全 0；
    - 失败时返回 ``{total: 0, enabled: 0}`` 与无可见行的语义一致，并
      ``logger.exception`` 记录 root cause，便于 backend stderr 定位。
    """
    try:
        visible_ids = await get_visible_plugin_ids(db, plugin_type, user)
        total = len(visible_ids)
        if not visible_ids:
            return {"total": 0, "enabled": 0}
        enabled = (
            await db.scalar(select(func.count()).where(and_(model.id.in_(visible_ids), model.is_enabled.is_(True))))
            or 0
        )
        return {"total": int(total), "enabled": int(enabled)}
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("interface_stats_plugin_failed", extra={"plugin_type": plugin_type, "error": str(exc)})
        return {"total": 0, "enabled": 0}


@router.get("/stats", response_model=StatsResponse)
async def get_stats(user: AuthUser = Depends(get_current_user_with_db_roles)) -> StatsResponse:
    """获取 Dashboard 统计数据。

    auth 依赖与 ``/auth/me`` 对齐到 ``get_current_user_with_db_roles``，避免
    「DB 已提升 admin、JWT 仍 user」的状态闪烁（ISSUE-049）：前端通过
    ``/auth/me`` 拿到 DB-resolved roles 显示 Models 卡片，stats 端点必须用
    同一口径才能与子页面一致。
    """
    async with AsyncSessionLocal() as db:
        mcp = await _safe_plugin_stats(db, "mcp_server", McpServer, user)
        skills = await _safe_plugin_stats(db, "skill", Skill, user)
        agents = await _safe_plugin_stats(db, "agent", Agent, user)
        tools = await _safe_plugin_stats(db, "builtin_tool", BuiltinTool, user)

        # Models / Vendor configs：仅 admin 可读，非 admin 以全 0 占位以便前端
        # 按角色决定是否展示。同样用 try/except 隔离，避免 vendor/model 表
        # 异常拖垮整体响应。
        vendor_total = 0
        model_total = 0
        model_enabled = 0
        if "admin" in user.roles:
            try:
                vendor_total = await db.scalar(select(func.count()).select_from(VendorConfig)) or 0
                model_total = await db.scalar(select(func.count()).select_from(ModelConfig)) or 0
                model_enabled = (
                    await db.scalar(select(func.count()).select_from(ModelConfig).where(ModelConfig.enabled.is_(True)))
                    or 0
                )
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception("interface_stats_models_failed", extra={"error": str(exc)})

    return StatsResponse(
        mcp_servers=mcp,
        skills=skills,
        agents=agents,
        models={"total": int(model_total), "enabled": int(model_enabled), "vendors": int(vendor_total)},
        tools=tools,
    )
