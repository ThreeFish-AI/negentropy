"""
Interface API 模块。

提供 MCP Server、Skill、Agent 的 CRUD 端点。
"""

from __future__ import annotations

import json
import shutil
import time as _mcp_time
from asyncio import Lock as _AsyncLock
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func, select
from sqlalchemy.exc import IntegrityError

from negentropy.auth.deps import get_current_user, get_current_user_with_db_roles
from negentropy.auth.service import AuthUser
from negentropy.config import settings
from negentropy.config.model_resolver import invalidate_cache as invalidate_model_cache
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.model_config import ModelConfig
from negentropy.models.plugin import (
    Agent,
    BuiltinTool,
    McpResourceTemplate,
    McpServer,
    McpTool,
    McpToolRun,
    McpToolRunEvent,
    McpTrialAsset,
    PluginPermission,
    PluginPermissionType,
    PluginVisibility,
    Skill,
    SkillSchedule,
    SkillVersion,
    ensure_dict,
)
from negentropy.models.vendor_config import VendorConfig

from .execution import McpToolExecutionService
from .permissions import check_plugin_access, check_plugin_ownership, get_visible_plugin_ids
from .tool_resolver import invalidate_tool_cache

logger = get_logger("negentropy.interface.api")
router = APIRouter(prefix="/interface", tags=["interface"])


def _resolve_app_name(app_name: str | None) -> str:
    return app_name or settings.app_name


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


class PermissionGrantRequest(BaseModel):
    """授权请求"""

    user_id: str
    permission: str  # "view" or "edit"


class PermissionResponse(BaseModel):
    """授权记录响应"""

    id: UUID
    user_id: str
    permission: str

    class Config:
        from_attributes = True


# =============================================================================
# BuiltinTool Models
# =============================================================================


class BuiltinToolCreateRequest(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    tool_type: str = "search"
    version: str = "1.0.0"
    config: dict[str, Any] = Field(default_factory=dict)
    credentials: dict[str, Any] = Field(default_factory=dict)
    config_schema: dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True
    visibility: str = "private"


class BuiltinToolUpdateRequest(BaseModel):
    display_name: str | None = None
    description: str | None = None
    config: dict[str, Any] | None = None
    credentials: dict[str, Any] | None = None
    config_schema: dict[str, Any] | None = None
    is_enabled: bool | None = None
    visibility: str | None = None


class BuiltinToolResponse(BaseModel):
    id: UUID
    owner_id: str
    visibility: str
    name: str
    display_name: str | None = None
    description: str | None = None
    tool_type: str
    version: str
    config: dict[str, Any] = Field(default_factory=dict)
    credentials: dict[str, Any] = Field(default_factory=dict)
    config_schema: dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool
    is_system: bool = False

    class Config:
        from_attributes = True


class BuiltinToolAvailableResponse(BaseModel):
    """用于 Agent/Skill 工具挂载选择的简要信息"""

    name: str
    display_name: str | None = None
    tool_type: str
    is_enabled: bool
    source: str  # "builtin" or "mcp"


class BuiltinToolTestResponse(BaseModel):
    success: bool
    message: str
    latency_ms: float | None = None


class BuiltinToolTestRequest(BaseModel):
    """测试时可选的内联配置，避免必须先保存再测试"""

    config: dict[str, Any] | None = None
    credentials: dict[str, Any] | None = None


def _mask_credentials(credentials: dict[str, Any]) -> dict[str, Any]:
    """脱敏凭证字段：保留首尾字符，中间用 **** 替代。"""
    masked = {}
    for key, value in credentials.items():
        if isinstance(value, str) and len(value) > 8:
            masked[key] = value[:4] + "****" + value[-4:]
        elif isinstance(value, str) and len(value) > 0:
            masked[key] = "****"
        else:
            masked[key] = value
    return masked


def _is_masked_value(value: Any) -> bool:
    """判断值是否为 _mask_credentials 产生的脱敏占位值。"""
    return isinstance(value, str) and "****" in value


def _merge_masked_credentials(incoming: dict[str, Any], stored: dict[str, Any]) -> dict[str, Any]:
    """将 incoming 中的脱敏占位值替换为 stored 中的真实值。

    前端回传 GET 响应中的脱敏值时，用 DB 真实凭证替换：
    - incoming 中未被脱敏的字段（用户新输入）保持不变
    - incoming 中被脱敏且 stored 中无对应值时保留原值（下游校验拦截）
    """
    merged = {}
    for key, value in incoming.items():
        if _is_masked_value(value) and key in stored:
            merged[key] = stored[key]
        else:
            merged[key] = value
    return merged


def _builtin_tool_to_response(tool: BuiltinTool) -> BuiltinToolResponse:
    return BuiltinToolResponse(
        id=tool.id,
        owner_id=tool.owner_id,
        visibility=tool.visibility.value,
        name=tool.name,
        display_name=tool.display_name,
        description=tool.description,
        tool_type=tool.tool_type,
        version=tool.version,
        config=ensure_dict(tool.config),
        credentials=_mask_credentials(ensure_dict(tool.credentials)),
        config_schema=ensure_dict(tool.config_schema),
        is_enabled=tool.is_enabled,
        is_system=tool.is_system,
    )


# =============================================================================
# MCP Server Models
# =============================================================================


class McpServerCreateRequest(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    transport_type: str  # stdio, sse, http
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    url: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    is_enabled: bool = True
    auto_start: bool = False
    config: dict[str, Any] = Field(default_factory=dict)
    visibility: str = "private"


class McpServerUpdateRequest(BaseModel):
    name: str | None = None
    display_name: str | None = None
    description: str | None = None
    command: str | None = None
    args: list[str] | None = None
    env: dict[str, str] | None = None
    url: str | None = None
    headers: dict[str, str] | None = None
    is_enabled: bool | None = None
    auto_start: bool | None = None
    config: dict[str, Any] | None = None
    visibility: str | None = None


class McpServerResponse(BaseModel):
    id: UUID
    owner_id: str
    visibility: str
    name: str
    display_name: str | None = None
    description: str | None = None
    transport_type: str
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    url: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    is_enabled: bool = True
    auto_start: bool = False
    config: dict[str, Any] = Field(default_factory=dict)
    tool_count: int = 0
    resource_template_count: int = 0
    # 「系统内置」统一对外字段，前端据此渲染 Built-In 徽标 + 隐藏 Edit/Delete。
    is_builtin: bool = False
    # MCP 配置来源：db（系统 MCP 目录）、mcp_json（项目 .mcp.json 原生配置）、both（两者均有）。
    source: str = "db"

    class Config:
        from_attributes = True


# =============================================================================
# MCP Tool Models
# =============================================================================


class McpToolResponse(BaseModel):
    """MCP Tool 响应模型"""

    id: UUID | None = None
    name: str
    title: str | None = None
    display_name: str | None = None
    description: str | None = None
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    icons: list[dict[str, Any]] = Field(default_factory=list)
    annotations: dict[str, Any] = Field(default_factory=dict)
    execution: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True
    call_count: int = 0

    class Config:
        from_attributes = True


class McpToolUpdateRequest(BaseModel):
    """MCP Tool 更新请求"""

    display_name: str | None = None
    is_enabled: bool | None = None


class McpResourceTemplateResponse(BaseModel):
    """MCP Resource Template 响应模型（仅 Templates，不含动态实例）"""

    id: UUID | None = None
    uri_template: str
    name: str | None = None
    title: str | None = None
    description: str | None = None
    mime_type: str | None = None
    annotations: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True

    class Config:
        from_attributes = True


class LoadToolsResponse(BaseModel):
    """Load Tools 操作响应（capability 全量同步：tools + resource_templates）。

    保留 ``LoadToolsResponse`` 命名以维持向后兼容（旧前端可继续读取 ``tools``
    字段）；新增 ``resource_templates`` 字段在旧消费方处会被忽略。
    """

    success: bool
    server_id: UUID
    tools: list[McpToolResponse] = Field(default_factory=list)
    resource_templates: list[McpResourceTemplateResponse] = Field(default_factory=list)
    duration_ms: int = 0
    error: str | None = None


class McpTrialAssetResponse(BaseModel):
    id: UUID
    server_id: UUID
    owner_id: str
    original_filename: str
    content_type: str | None = None
    size_bytes: int
    sha256: str
    gcs_uri: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None


class McpToolRunEventResponse(BaseModel):
    id: UUID
    run_id: UUID
    sequence_num: int
    stage: str
    status: str
    title: str
    detail: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    duration_ms: int = 0
    timestamp: str | None = None


class McpToolRunSummaryResponse(BaseModel):
    id: UUID
    server_id: UUID
    tool_id: UUID | None = None
    tool_name: str
    origin: str
    status: str
    created_by: str | None = None
    request_payload: dict[str, Any] = Field(default_factory=dict)
    normalized_request_payload: dict[str, Any] = Field(default_factory=dict)
    result_payload: dict[str, Any] = Field(default_factory=dict)
    error_summary: str | None = None
    duration_ms: int = 0
    started_at: str | None = None
    ended_at: str | None = None


class McpToolRunDetailResponse(McpToolRunSummaryResponse):
    events: list[McpToolRunEventResponse] = Field(default_factory=list)


class ExecuteToolRequest(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    asset_refs: dict[str, Any] = Field(default_factory=dict)


class ExecuteToolResponse(BaseModel):
    success: bool
    run: McpToolRunDetailResponse
    error: str | None = None


# =============================================================================
# Skill Models
# =============================================================================


class SkillCreateRequest(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    category: str = "general"
    version: str = "1.0.0"
    prompt_template: str | None = None
    config_schema: dict[str, Any] = Field(default_factory=dict)
    default_config: dict[str, Any] = Field(default_factory=dict)
    required_tools: list[str] = Field(default_factory=list)
    is_enabled: bool = True
    priority: int = 0
    visibility: str = "private"
    enforcement_mode: str = "warning"
    resources: list[dict[str, Any]] = Field(default_factory=list)
    # 全局技能：TRUE 时自动注入全系统所有 Agent 的 Progressive Disclosure（见 skills_injector）。
    is_global: bool = False


class SkillUpdateRequest(BaseModel):
    name: str | None = None
    display_name: str | None = None
    description: str | None = None
    category: str | None = None
    version: str | None = None
    prompt_template: str | None = None
    config_schema: dict[str, Any] | None = None
    default_config: dict[str, Any] | None = None
    required_tools: list[str] | None = None
    is_enabled: bool | None = None
    priority: int | None = None
    visibility: str | None = None
    enforcement_mode: str | None = None
    resources: list[dict[str, Any]] | None = None
    is_global: bool | None = None


class SkillResponse(BaseModel):
    id: UUID
    owner_id: str
    visibility: str
    name: str
    display_name: str | None = None
    description: str | None = None
    category: str
    version: str
    prompt_template: str | None = None
    config_schema: dict[str, Any] = Field(default_factory=dict)
    default_config: dict[str, Any] = Field(default_factory=dict)
    required_tools: list[str] = Field(default_factory=list)
    is_enabled: bool
    priority: int
    enforcement_mode: str = "warning"
    resources: list[dict[str, Any]] = Field(default_factory=list)
    # 「系统内置」统一对外字段，与 MCP/Agent/Tool 字段保持一致。
    is_builtin: bool = False
    # 「全局技能」：TRUE 时自动注入全系统所有 Agent；前端据此渲染 Global 徽章。
    is_global: bool = False

    class Config:
        from_attributes = True


class SkillInvokeRequest(BaseModel):
    """``POST /interface/skills/{id}:invoke`` 请求体：渲染 prompt_template 并附带资源。"""

    variables: dict[str, Any] = Field(default_factory=dict)


class SkillInvokeResponse(BaseModel):
    """``POST /interface/skills/{id}:invoke`` 响应体。"""

    skill_id: UUID
    name: str
    rendered_prompt: str
    resources: list[dict[str, Any]] = Field(default_factory=list)
    missing_tools: list[str] = Field(default_factory=list)


class SkillTemplateSummary(BaseModel):
    """``GET /interface/skills/templates`` 单项响应。"""

    template_id: str
    name: str
    display_name: str | None = None
    description: str | None = None
    category: str
    version: str


class SkillFromTemplateRequest(BaseModel):
    """``POST /interface/skills/from-template`` 请求体。"""

    template_id: str
    name_override: str | None = None
    visibility: str | None = None


# Phase 3 — Skill 版本历史 / 调度
class SkillVersionResponse(BaseModel):
    id: UUID
    skill_id: UUID
    version: str
    snapshot: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


class SkillSnapshotRequest(BaseModel):
    """``POST /interface/skills/{id}/versions`` 请求体；默认 freeze 当前字段。"""

    version: str | None = None  # 不传时使用 Skill.version


class SkillScheduleRequest(BaseModel):
    cron_expr: str
    enabled: bool = True
    vars: dict[str, Any] = Field(default_factory=dict)


class SkillScheduleResponse(BaseModel):
    id: UUID
    skill_id: UUID
    owner_id: str
    cron_expr: str
    enabled: bool
    vars: dict[str, Any] = Field(default_factory=dict)
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime | None = None


# =============================================================================
# Agent Models
# =============================================================================


class AgentCreateRequest(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    agent_type: str
    system_prompt: str | None = None
    model: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    adk_config: dict[str, Any] = Field(default_factory=dict)
    skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    is_enabled: bool = True
    visibility: str = "private"


class AgentUpdateRequest(BaseModel):
    name: str | None = None
    display_name: str | None = None
    description: str | None = None
    agent_type: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    config: dict[str, Any] | None = None
    adk_config: dict[str, Any] | None = None
    skills: list[str] | None = None
    tools: list[str] | None = None
    is_enabled: bool | None = None
    visibility: str | None = None
    confirm_builtin_rename: bool | None = False


class AgentResponse(BaseModel):
    id: UUID
    owner_id: str
    visibility: str
    name: str
    display_name: str | None = None
    description: str | None = None
    agent_type: str
    system_prompt: str | None = None
    model: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    adk_config: dict[str, Any] = Field(default_factory=dict)
    skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    source: str = "user_defined"
    is_builtin: bool = False
    is_enabled: bool
    # `kind` 来源于 ``config.adk_config.kind``：``"root"`` 标记 Negentropy 主 Agent，
    # ``"agent"``（默认）适用于 Faculty 与用户自定义 Agent。前端按此置顶 + Root 徽章。
    kind: str = "agent"

    class Config:
        from_attributes = True


class NegentropyAgentTemplateResponse(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    agent_type: str
    system_prompt: str | None = None
    model: str | None = None
    adk_config: dict[str, Any] = Field(default_factory=dict)
    tools: list[str] = Field(default_factory=list)


class NegentropyAgentSyncResponse(BaseModel):
    created: int
    updated: int
    skipped: int
    agents: list[AgentResponse] = Field(default_factory=list)


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


# =============================================================================
# MCP Server Endpoints
# =============================================================================

# per-server load TTL 锁：避免 N 个 view 用户在打开 MCP 页时对同一 server 重复
# discover。键为 server_id，值为最近一次成功 load 的 monotonic 时间戳。
# 60s 窗口在「最终一致性」与「降低 streamablehttp 探测放大」之间取折中。
_MCP_LOAD_TTL_SECONDS = 60.0
_mcp_load_last_success: dict[UUID, float] = {}
_mcp_load_locks: dict[UUID, _AsyncLock] = {}


def _mcp_load_lock_for(server_id: UUID) -> _AsyncLock:
    lock = _mcp_load_locks.get(server_id)
    if lock is None:
        lock = _AsyncLock()
        _mcp_load_locks[server_id] = lock
    return lock


def _record_mcp_load_success(server_id: UUID) -> None:
    _mcp_load_last_success[server_id] = _mcp_time.monotonic()


async def _mcp_load_throttle_or_snapshot(db, server_id: UUID) -> LoadToolsResponse | None:
    """若 TTL 锁命中，直接返回 DB 现有 tools/templates 快照；否则返回 None 让调用方继续 discover。"""
    last = _mcp_load_last_success.get(server_id)
    if last is None or (_mcp_time.monotonic() - last) >= _MCP_LOAD_TTL_SECONDS:
        return None

    tools_stmt = select(McpTool).where(McpTool.server_id == server_id).order_by(McpTool.created_at.asc())
    templates_stmt = (
        select(McpResourceTemplate)
        .where(McpResourceTemplate.server_id == server_id)
        .order_by(McpResourceTemplate.created_at.asc())
    )
    tool_rows = (await db.execute(tools_stmt)).scalars().all()
    template_rows = (await db.execute(templates_stmt)).scalars().all()

    return LoadToolsResponse(
        success=True,
        server_id=server_id,
        tools=[_mcp_tool_to_response(t) for t in tool_rows],
        resource_templates=[_mcp_resource_template_to_response(t) for t in template_rows],
        duration_ms=0,
    )


@router.get("/mcp/servers", response_model=list[McpServerResponse])
async def list_mcp_servers(
    user: AuthUser = Depends(get_current_user),
    project_path: str | None = Query(None, alias="projectPath"),
) -> list[McpServerResponse]:
    """列出用户可见的 MCP 服务器，可选合并项目 ``.mcp.json`` 中定义的服务器。"""
    # ---- 1. DB 注册服务器 ----
    db_servers: list[McpServerResponse] = []
    db_names: set[str] = set()

    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "mcp_server", user)
        if visible_ids:
            # tool_count 与 resource_template_count 分两段查询：避免单条 SQL 的
            # JOIN 笛卡尔积导致两类计数互相膨胀。
            tool_count_stmt = (
                select(McpTool.server_id, func.count(McpTool.id))
                .where(McpTool.server_id.in_(visible_ids))
                .group_by(McpTool.server_id)
            )
            tool_count_rows = (await db.execute(tool_count_stmt)).all()
            tool_count_map: dict[UUID, int] = {row[0]: row[1] for row in tool_count_rows}

            template_count_stmt = (
                select(McpResourceTemplate.server_id, func.count(McpResourceTemplate.id))
                .where(McpResourceTemplate.server_id.in_(visible_ids))
                .group_by(McpResourceTemplate.server_id)
            )
            template_count_rows = (await db.execute(template_count_stmt)).all()
            template_count_map: dict[UUID, int] = {row[0]: row[1] for row in template_count_rows}

            servers_stmt = select(McpServer).where(McpServer.id.in_(visible_ids)).order_by(McpServer.created_at.desc())
            servers = (await db.execute(servers_stmt)).scalars().all()

            db_servers = [
                _mcp_server_to_response(
                    s,
                    tool_count_map.get(s.id, 0),
                    template_count_map.get(s.id, 0),
                )
                for s in servers
            ]
            db_names = {s.name for s in servers}

    # ---- 2. .mcp.json 原生配置（可选） ----
    from negentropy.interface.mcp_config_resolver import read_mcp_json

    mcp_json_servers = read_mcp_json(project_path)

    # 标记 DB 服务器中同时存在于 .mcp.json 的为 "both"
    for srv in db_servers:
        if srv.name in mcp_json_servers:
            srv.source = "both"

    # 合并 .mcp.json 独有的服务器（DB 中不存在）
    mcp_json_only = [
        _mcp_json_server_to_response(name, config) for name, config in mcp_json_servers.items() if name not in db_names
    ]

    return db_servers + mcp_json_only


@router.post("/mcp/servers", response_model=McpServerResponse, status_code=status.HTTP_201_CREATED)
async def create_mcp_server(
    payload: McpServerCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> McpServerResponse:
    """创建新的 MCP 服务器"""
    async with AsyncSessionLocal() as db:
        # Check duplicate name
        existing = await db.scalar(select(McpServer).where(McpServer.name == payload.name))
        if existing:
            raise HTTPException(status_code=400, detail="Server name already exists")

        server = McpServer(
            owner_id=user.user_id,
            visibility=PluginVisibility(payload.visibility),
            name=payload.name,
            display_name=payload.display_name,
            description=payload.description,
            transport_type=payload.transport_type,
            command=payload.command,
            args=payload.args,
            env=payload.env,
            url=payload.url,
            headers=payload.headers,
            is_enabled=payload.is_enabled,
            auto_start=payload.auto_start,
            config=payload.config,
        )
        db.add(server)
        await db.commit()
        await db.refresh(server)

    return _mcp_server_to_response(server, 0)


@router.get("/mcp/servers/{server_id}", response_model=McpServerResponse)
async def get_mcp_server(
    server_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> McpServerResponse:
    """获取 MCP 服务器详情"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        server = await db.get(McpServer, server_id)
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")

        tool_count = await db.scalar(select(func.count(McpTool.id)).where(McpTool.server_id == server_id))
        template_count = await db.scalar(
            select(func.count(McpResourceTemplate.id)).where(McpResourceTemplate.server_id == server_id)
        )

    return _mcp_server_to_response(server, tool_count or 0, template_count or 0)


@router.patch("/mcp/servers/{server_id}", response_model=McpServerResponse)
async def update_mcp_server(
    server_id: UUID,
    payload: McpServerUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> McpServerResponse:
    """更新 MCP 服务器"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        server = await db.get(McpServer, server_id)
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")

        update_data = payload.model_dump(exclude_unset=True)
        if "name" in update_data:
            new_name = str(update_data["name"] or "").strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="Server name cannot be empty")
            if new_name != server.name:
                existing = await db.scalar(
                    select(McpServer).where(and_(McpServer.name == new_name, McpServer.id != server_id))
                )
                if existing:
                    raise HTTPException(status_code=400, detail="Server name already exists")
            update_data["name"] = new_name
        if "visibility" in update_data:
            update_data["visibility"] = PluginVisibility(update_data["visibility"])

        for key, value in update_data.items():
            setattr(server, key, value)

        await db.commit()
        await db.refresh(server)

    return _mcp_server_to_response(server, 0)


@router.delete("/mcp/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mcp_server(
    server_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """删除 MCP 服务器（仅 owner 可删除）"""
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "mcp_server", server_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        server = await db.get(McpServer, server_id)
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")
        await db.delete(server)
        await db.commit()


def _mcp_server_to_response(
    server: McpServer,
    tool_count: int,
    resource_template_count: int = 0,
) -> McpServerResponse:
    return McpServerResponse(
        id=server.id,
        owner_id=server.owner_id,
        visibility=server.visibility.value,
        name=server.name,
        display_name=server.display_name,
        description=server.description,
        transport_type=server.transport_type,
        command=server.command,
        args=server.args or [],
        env=server.env or {},
        url=server.url,
        headers=server.headers or {},
        is_enabled=server.is_enabled,
        auto_start=server.auto_start,
        config=server.config or {},
        tool_count=tool_count or 0,
        resource_template_count=resource_template_count or 0,
        # 显式列优先；旧库未迁移到 0033 时回退 owner_id 前缀，与 permissions 模块保持一致。
        is_builtin=bool(getattr(server, "is_system", False)) or (server.owner_id or "").startswith("system"),
    )


def _mcp_json_server_to_response(name: str, config: dict[str, Any]) -> McpServerResponse:
    """将 ``.mcp.json`` 中的单条服务器配置转换为 ``McpServerResponse``。

    使用 ``UUID(int=0)`` 哨兵值标记「无 DB 记录」，前端据此跳过 tools 获取。
    """
    from negentropy.interface.mcp_config_resolver import derive_transport_type

    return McpServerResponse(
        id=UUID(int=0),
        owner_id="",
        visibility="private",
        name=name,
        display_name=None,
        description="Auto-discovered from .mcp.json",
        transport_type=derive_transport_type(config),
        command=config.get("command"),
        args=config.get("args", []),
        env={},
        url=config.get("url"),
        headers={},
        is_enabled=True,
        auto_start=False,
        config={},
        tool_count=0,
        resource_template_count=0,
        is_builtin=False,
        source="mcp_json",
    )


def _mcp_tool_to_response(tool: McpTool) -> McpToolResponse:
    """将 McpTool 模型转换为响应模型"""
    return McpToolResponse(
        id=tool.id,
        name=tool.name,
        title=tool.title,
        display_name=tool.display_name,
        description=tool.description,
        input_schema=tool.input_schema or {},
        output_schema=tool.output_schema or {},
        icons=tool.icons or [],
        annotations=tool.annotations or {},
        execution=tool.execution or {},
        meta=tool.meta or {},
        is_enabled=tool.is_enabled,
        call_count=tool.call_count or 0,
    )


def _mcp_resource_template_to_response(template: McpResourceTemplate) -> McpResourceTemplateResponse:
    """将 McpResourceTemplate 模型转换为响应模型"""
    return McpResourceTemplateResponse(
        id=template.id,
        uri_template=template.uri_template,
        name=template.name,
        title=template.title,
        description=template.description,
        mime_type=template.mime_type,
        annotations=template.annotations or {},
        meta=template.meta or {},
        is_enabled=template.is_enabled,
    )


def _mcp_trial_asset_to_response(asset: McpTrialAsset) -> McpTrialAssetResponse:
    return McpTrialAssetResponse(
        id=asset.id,
        server_id=asset.server_id,
        owner_id=asset.owner_id,
        original_filename=asset.original_filename,
        content_type=asset.content_type,
        size_bytes=asset.size_bytes,
        sha256=asset.sha256,
        gcs_uri=asset.gcs_uri,
        metadata=asset.metadata_ or {},
        created_at=asset.created_at.isoformat() if asset.created_at else None,
    )


def _mcp_tool_run_event_to_response(event: McpToolRunEvent) -> McpToolRunEventResponse:
    return McpToolRunEventResponse(
        id=event.id,
        run_id=event.run_id,
        sequence_num=event.sequence_num,
        stage=event.stage,
        status=event.status,
        title=event.title,
        detail=event.detail,
        payload=event.payload or {},
        duration_ms=event.duration_ms or 0,
        timestamp=event.timestamp.isoformat() if event.timestamp else None,
    )


def _mcp_tool_run_to_response(
    run: McpToolRun,
    events: list[McpToolRunEvent] | None = None,
) -> McpToolRunDetailResponse | McpToolRunSummaryResponse:
    payload = dict(
        id=run.id,
        server_id=run.server_id,
        tool_id=run.tool_id,
        tool_name=run.tool_name,
        origin=run.origin,
        status=run.status,
        created_by=run.created_by,
        request_payload=run.request_payload or {},
        normalized_request_payload=run.normalized_request_payload or {},
        result_payload=run.result_payload or {},
        error_summary=run.error_summary,
        duration_ms=run.duration_ms or 0,
        started_at=run.started_at.isoformat() if run.started_at else None,
        ended_at=run.ended_at.isoformat() if run.ended_at else None,
    )
    if events is None:
        return McpToolRunSummaryResponse(**payload)
    return McpToolRunDetailResponse(
        **payload,
        events=[_mcp_tool_run_event_to_response(item) for item in events],
    )


# =============================================================================
# MCP Tool Endpoints
# =============================================================================


@router.post("/mcp/servers/{server_id}/tools:load", response_model=LoadToolsResponse)
async def load_mcp_server_tools(
    server_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> LoadToolsResponse:
    """连接 MCP Server 并加载其 capability（tools + resource_templates）。

    此操作会：
    1. 连接到 MCP Server；
    2. 获取所有 Tools 与 Resource Templates；
    3. 同步到数据库（新增/更新；旧 server 无 resources capability 时静默兜底）；
    4. 返回完整 capability。

    权限语义：``view`` 即可触发——「工具发现」对用户视角是只读操作，``mcp_tools``
    与 ``mcp_resource_templates`` 是 server-scoped、不区分 owner 的能力快照表，
    写入对其他用户没有副作用。这是 ISSUE: 系统内置 MCP Server（如 negentropy-perceives）
    在普通用户的 MCP 页加载时显示 "Permission denied" 的根因修复。
    """
    from .mcp_client import McpClientService

    async with AsyncSessionLocal() as db:
        # 1. 权限检查（view 即可——工具发现属于只读语义；写入由 server-scoped TTL 锁去重）。
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        # 2. 获取 Server 配置
        server = await db.get(McpServer, server_id)
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")

        # 3. 快速路径：TTL 锁命中时直接返回 DB 现有快照，避免重复 streamablehttp 探测。
        cached_response = await _mcp_load_throttle_or_snapshot(db, server_id)
        if cached_response is not None:
            return cached_response

    # 4. 进入 per-server 异步互斥区：并发请求串行化，再进入 lock 后做一次双检锁，
    #    最大并发探测降为 1/60s，与 ISSUE: streamablehttp + OAuth 404 探测放大对齐。
    async with _mcp_load_lock_for(server_id):
        async with AsyncSessionLocal() as db:
            # 双检：取得锁后再判断 TTL，已被前一个并发请求刷新过则直接返回快照。
            cached_response = await _mcp_load_throttle_or_snapshot(db, server_id)
            if cached_response is not None:
                return cached_response

            server = await db.get(McpServer, server_id)
            if not server:
                raise HTTPException(status_code=404, detail="Server not found")

            # 5. 调用 MCP Client Service
            client = McpClientService()
            result = await client.discover_tools(
                transport_type=server.transport_type,
                command=server.command,
                args=server.args,
                env=server.env,
                url=server.url,
                headers=server.headers,
            )

            if not result.success:
                return LoadToolsResponse(
                    success=False,
                    server_id=server_id,
                    tools=[],
                    resource_templates=[],
                    duration_ms=result.duration_ms,
                    error=result.error,
                )

            # 6. 同步 Tools 到数据库
            existing_tools_result = await db.execute(select(McpTool).where(McpTool.server_id == server_id))
            existing_tools = existing_tools_result.scalars().all()
            existing_map = {t.name: t for t in existing_tools}

            updated_tools: list[McpTool] = []
            for tool_info in result.tools:
                if tool_info.name in existing_map:
                    # 更新现有 Tool
                    existing = existing_map[tool_info.name]
                    existing.title = tool_info.title
                    existing.description = tool_info.description
                    existing.input_schema = tool_info.input_schema
                    existing.output_schema = tool_info.output_schema
                    existing.icons = tool_info.icons
                    existing.annotations = tool_info.annotations
                    existing.execution = tool_info.execution
                    existing.meta = tool_info.meta
                    updated_tools.append(existing)
                else:
                    # 新增 Tool
                    new_tool = McpTool(
                        server_id=server_id,
                        name=tool_info.name,
                        title=tool_info.title,
                        description=tool_info.description,
                        input_schema=tool_info.input_schema,
                        output_schema=tool_info.output_schema,
                        icons=tool_info.icons,
                        annotations=tool_info.annotations,
                        execution=tool_info.execution,
                        meta=tool_info.meta,
                        is_enabled=True,
                    )
                    db.add(new_tool)
                    updated_tools.append(new_tool)

            # 7. 同步 Resource Templates 到数据库（以 uri_template 为键）
            existing_templates_result = await db.execute(
                select(McpResourceTemplate).where(McpResourceTemplate.server_id == server_id)
            )
            existing_templates = existing_templates_result.scalars().all()
            existing_template_map = {t.uri_template: t for t in existing_templates}

            updated_templates: list[McpResourceTemplate] = []
            seen_uri_templates: set[str] = set()
            for template_info in result.resource_templates:
                seen_uri_templates.add(template_info.uri_template)
                if template_info.uri_template in existing_template_map:
                    existing_tpl = existing_template_map[template_info.uri_template]
                    existing_tpl.name = template_info.name
                    existing_tpl.title = template_info.title
                    existing_tpl.description = template_info.description
                    existing_tpl.mime_type = template_info.mime_type
                    existing_tpl.annotations = template_info.annotations
                    existing_tpl.meta = template_info.meta
                    updated_templates.append(existing_tpl)
                else:
                    new_template = McpResourceTemplate(
                        server_id=server_id,
                        uri_template=template_info.uri_template,
                        name=template_info.name,
                        title=template_info.title,
                        description=template_info.description,
                        mime_type=template_info.mime_type,
                        annotations=template_info.annotations,
                        meta=template_info.meta,
                        is_enabled=True,
                    )
                    db.add(new_template)
                    updated_templates.append(new_template)

            # 仅在 server 权威返回 templates 列表时才裁剪 stale 行：
            # ``_discover_on_transport`` 对 ``list_resource_templates`` 的所有异常都
            # 会静默兜底返回空列表（兼容旧 server / 瞬态错误），若此处直接 prune 会
            # 把首次错误后的 DB 模板表清空，与 tools 同步"只增量更新、不裁剪"的语义
            # 不对称。``resource_templates_listed`` 区分"权威空列表"与"未支持/错误"。
            if result.resource_templates_listed:
                for stale_uri, stale_tpl in existing_template_map.items():
                    if stale_uri not in seen_uri_templates:
                        await db.delete(stale_tpl)

            await db.commit()

            # 8. 刷新以获取 ID
            for tool in updated_tools:
                await db.refresh(tool)
            for tpl in updated_templates:
                await db.refresh(tpl)

            # 9. 记录 TTL 锁时间戳，未来 60s 内的并发 / 重复请求直接走 DB 快照。
            _record_mcp_load_success(server_id)

            logger.info(
                f"Loaded {len(updated_tools)} tools and {len(updated_templates)} resource templates "
                f"from MCP server {server.name}"
            )

            return LoadToolsResponse(
                success=True,
                server_id=server_id,
                tools=[_mcp_tool_to_response(t) for t in updated_tools],
                resource_templates=[_mcp_resource_template_to_response(t) for t in updated_templates],
                duration_ms=result.duration_ms,
            )


@router.get("/mcp/servers/{server_id}/tools", response_model=list[McpToolResponse])
async def list_mcp_server_tools(
    server_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> list[McpToolResponse]:
    """列出指定 MCP Server 的所有 Tools"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        result = await db.execute(select(McpTool).where(McpTool.server_id == server_id).order_by(McpTool.name))
        tools = result.scalars().all()

        return [_mcp_tool_to_response(t) for t in tools]


@router.get(
    "/mcp/servers/{server_id}/resource-templates",
    response_model=list[McpResourceTemplateResponse],
)
async def list_mcp_server_resource_templates(
    server_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> list[McpResourceTemplateResponse]:
    """列出指定 MCP Server 已发现的 Resource Templates。

    动态实例化的 FileResource（带 ``<job_id>``）不入库，故此处仅返回模板。
    """
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        result = await db.execute(
            select(McpResourceTemplate)
            .where(McpResourceTemplate.server_id == server_id)
            .order_by(McpResourceTemplate.uri_template)
        )
        templates = result.scalars().all()

        return [_mcp_resource_template_to_response(t) for t in templates]


@router.patch("/mcp/servers/{server_id}/tools/{tool_id}", response_model=McpToolResponse)
async def update_mcp_tool(
    server_id: UUID,
    tool_id: UUID,
    payload: McpToolUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> McpToolResponse:
    """更新 Tool 配置（如 display_name, is_enabled）"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        tool = await db.get(McpTool, tool_id)
        if not tool or tool.server_id != server_id:
            raise HTTPException(status_code=404, detail="Tool not found")

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(tool, key, value)

        await db.commit()
        await db.refresh(tool)

        return _mcp_tool_to_response(tool)


@router.post("/mcp/servers/{server_id}/trial-assets", response_model=McpTrialAssetResponse)
async def upload_mcp_trial_asset(
    server_id: UUID,
    file: UploadFile = File(...),
    metadata: str | None = Form(default=None),
    user: AuthUser = Depends(get_current_user),
) -> McpTrialAssetResponse:
    """上传 MCP 试用文件到 GCS。"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        server = await db.get(McpServer, server_id)
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        extra_metadata: dict[str, Any] = {}
        if metadata:
            try:
                parsed = json.loads(metadata)
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid metadata JSON: {exc}") from exc
            if isinstance(parsed, dict):
                extra_metadata = parsed

        service = McpToolExecutionService(db)
        asset = await service.upload_trial_asset(
            server=server,
            owner_id=user.user_id,
            filename=file.filename or "upload.pdf",
            content=content,
            content_type=file.content_type,
            metadata=extra_metadata,
        )
        return _mcp_trial_asset_to_response(asset)


@router.post("/mcp/servers/{server_id}/tools:execute", response_model=ExecuteToolResponse)
async def execute_mcp_tool(
    server_id: UUID,
    payload: ExecuteToolRequest,
    user: AuthUser = Depends(get_current_user),
) -> ExecuteToolResponse:
    """执行指定 MCP Tool 并记录白盒历史。"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        server = await db.get(McpServer, server_id)
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")

        service = McpToolExecutionService(db)
        execution = await service.execute_tool(
            server=server,
            user=user,
            tool_name=payload.tool_name,
            arguments=payload.arguments,
            asset_refs=payload.asset_refs,
        )
        detail = _mcp_tool_run_to_response(execution.run, execution.events)
        return ExecuteToolResponse(
            success=execution.call_result.success,
            run=detail,
            error=execution.call_result.error,
        )


@router.get("/mcp/servers/{server_id}/runs", response_model=list[McpToolRunSummaryResponse])
async def list_mcp_tool_runs(
    server_id: UUID,
    tool_name: str | None = Query(default=None),
    origin: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=200),
    user: AuthUser = Depends(get_current_user),
) -> list[McpToolRunSummaryResponse]:
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        stmt = select(McpToolRun).where(McpToolRun.server_id == server_id)
        if tool_name:
            stmt = stmt.where(McpToolRun.tool_name == tool_name)
        if origin:
            stmt = stmt.where(McpToolRun.origin == origin)
        stmt = stmt.order_by(desc(McpToolRun.started_at)).limit(limit)
        result = await db.execute(stmt)
        runs = result.scalars().all()
        return [_mcp_tool_run_to_response(item) for item in runs]


@router.get("/mcp/runs/{run_id}", response_model=McpToolRunDetailResponse)
async def get_mcp_tool_run(
    run_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> McpToolRunDetailResponse:
    async with AsyncSessionLocal() as db:
        run = await db.get(McpToolRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")

        has_access, error = await check_plugin_access(db, "mcp_server", run.server_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        events_result = await db.execute(
            select(McpToolRunEvent).where(McpToolRunEvent.run_id == run_id).order_by(McpToolRunEvent.sequence_num.asc())
        )
        events = events_result.scalars().all()
        return _mcp_tool_run_to_response(run, list(events))


# =============================================================================
# BuiltinTool Endpoints
# =============================================================================


@router.get("/tools/available", response_model=list[BuiltinToolAvailableResponse])
async def list_available_tools(
    user: AuthUser = Depends(get_current_user),
) -> list[BuiltinToolAvailableResponse]:
    """列出所有可用工具（builtin + MCP），供 Agent/Skill 工具挂载选择"""
    tools: list[BuiltinToolAvailableResponse] = []

    async with AsyncSessionLocal() as db:
        # Builtin tools
        visible_tool_ids = await get_visible_plugin_ids(db, "builtin_tool", user)
        if visible_tool_ids:
            stmt = select(BuiltinTool).where(
                and_(BuiltinTool.id.in_(visible_tool_ids), BuiltinTool.is_enabled.is_(True))
            )
            result = await db.execute(stmt)
            builtin_tools = result.scalars().all()
            for t in builtin_tools:
                tools.append(
                    BuiltinToolAvailableResponse(
                        name=t.name,
                        display_name=t.display_name,
                        tool_type=t.tool_type,
                        is_enabled=t.is_enabled,
                        source="builtin",
                    )
                )

        # MCP tools
        visible_mcp_ids = await get_visible_plugin_ids(db, "mcp_server", user)
        if visible_mcp_ids:
            stmt = select(McpTool).where(and_(McpTool.server_id.in_(visible_mcp_ids), McpTool.is_enabled.is_(True)))
            result = await db.execute(stmt)
            mcp_tools = result.scalars().all()
            for t in mcp_tools:
                tools.append(
                    BuiltinToolAvailableResponse(
                        name=t.name,
                        display_name=getattr(t, "display_name", None) or getattr(t, "title", None),
                        tool_type="mcp",
                        is_enabled=t.is_enabled,
                        source="mcp",
                    )
                )

    return tools


@router.get("/tools", response_model=list[BuiltinToolResponse])
async def list_builtin_tools(
    user: AuthUser = Depends(get_current_user),
) -> list[BuiltinToolResponse]:
    """列出用户可见的内置工具"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "builtin_tool", user)
        if not visible_ids:
            return []

        stmt = select(BuiltinTool).where(BuiltinTool.id.in_(visible_ids)).order_by(BuiltinTool.created_at.desc())
        result = await db.execute(stmt)
        tools = result.scalars().all()

    return [_builtin_tool_to_response(t) for t in tools]


@router.post("/tools", response_model=BuiltinToolResponse, status_code=status.HTTP_201_CREATED)
async def create_builtin_tool(
    payload: BuiltinToolCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> BuiltinToolResponse:
    """创建自定义工具"""
    async with AsyncSessionLocal() as db:
        tool = BuiltinTool(
            owner_id=user.user_id,
            visibility=PluginVisibility(payload.visibility),
            name=payload.name,
            display_name=payload.display_name,
            description=payload.description,
            tool_type=payload.tool_type,
            version=payload.version,
            config=payload.config,
            credentials=payload.credentials,
            config_schema=payload.config_schema,
            is_enabled=payload.is_enabled,
            is_system=False,
        )
        db.add(tool)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=f"Tool with name '{payload.name}' already exists") from exc
        await db.refresh(tool)

    invalidate_tool_cache(payload.name)
    return _builtin_tool_to_response(tool)


@router.get("/tools/{tool_id}", response_model=BuiltinToolResponse)
async def get_builtin_tool(
    tool_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> BuiltinToolResponse:
    """获取工具详情"""
    async with AsyncSessionLocal() as db:
        # required_permission="view"：读取详情属只读语义，与同 module 其余 17 处
        # check_plugin_access 调用对齐；系统内置 (is_system=True) 走 view 全员通过、
        # edit 仅 admin 的分支（参见 permissions.py:_is_plugin_builtin）。
        has_access, error = await check_plugin_access(db, "builtin_tool", tool_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        tool = await db.get(BuiltinTool, tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")

    return _builtin_tool_to_response(tool)


@router.patch("/tools/{tool_id}", response_model=BuiltinToolResponse)
async def update_builtin_tool(
    tool_id: UUID,
    payload: BuiltinToolUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> BuiltinToolResponse:
    """更新工具配置"""
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "builtin_tool", tool_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        tool = await db.get(BuiltinTool, tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")

        update_data = payload.model_dump(exclude_unset=True)
        if "visibility" in update_data:
            update_data["visibility"] = PluginVisibility(update_data["visibility"])
        # 前端可能回传 GET 响应中的脱敏凭证，替换为 DB 真实值后再写入
        if "credentials" in update_data and update_data["credentials"] is not None:
            update_data["credentials"] = _merge_masked_credentials(
                update_data["credentials"], ensure_dict(tool.credentials)
            )
        # 校验 claude_code 类型工具的 cli_path 合法性
        if tool.tool_type == "claude_code" and "config" in update_data:
            new_config = update_data["config"]
            if isinstance(new_config, dict) and "cli_path" in new_config:
                cli_val = new_config["cli_path"]
                if isinstance(cli_val, str) and cli_val.strip():
                    if not shutil.which(cli_val):
                        raise HTTPException(
                            status_code=422,
                            detail=f"cli_path '{cli_val}' not found in PATH — "
                            f"ensure Claude Code CLI is installed and the path is correct",
                        )
        for field, value in update_data.items():
            setattr(tool, field, value)

        await db.commit()
        await db.refresh(tool)

    invalidate_tool_cache(tool.name)
    return _builtin_tool_to_response(tool)


@router.delete("/tools/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_builtin_tool(
    tool_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """删除工具（仅非系统工具可删除）"""
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "builtin_tool", tool_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        tool = await db.get(BuiltinTool, tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")

        if tool.is_system:
            raise HTTPException(status_code=403, detail="System tools cannot be deleted, only disabled")

        tool_name = tool.name
        await db.delete(tool)
        await db.commit()

    invalidate_tool_cache(tool_name)


@router.post("/tools/{tool_id}:test", response_model=BuiltinToolTestResponse)
async def test_builtin_tool(
    tool_id: UUID,
    payload: BuiltinToolTestRequest | None = None,
    user: AuthUser = Depends(get_current_user),
) -> BuiltinToolTestResponse:
    """测试工具配置连通性。支持通过请求体内联传入 config/credentials，无需先保存即可测试。"""
    import time

    import httpx

    async with AsyncSessionLocal() as db:
        # required_permission="view"：连通性测试不写库，与 MCP 同类只读端点
        # (list_mcp_tool_runs 等) 对齐；若用 "edit" 将禁止非 admin 用户测试系统
        # 内置工具（如 google_search），违背设计语义。
        has_access, error = await check_plugin_access(db, "builtin_tool", tool_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        tool = await db.get(BuiltinTool, tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")

    # 请求体内联参数优先，回退到 DB 存储值
    inline = payload or BuiltinToolTestRequest()
    config = inline.config if inline.config is not None else ensure_dict(tool.config)
    credentials = inline.credentials if inline.credentials is not None else ensure_dict(tool.credentials)
    # 前端可能回传 GET 响应中的脱敏凭证（含 ****），替换为 DB 真实值
    credentials = _merge_masked_credentials(credentials, ensure_dict(tool.credentials))

    if tool.tool_type == "search" and tool.name == "google_search":
        api_key = credentials.get("api_key", "")
        cx_id = config.get("cx_id", "")
        if not api_key or not cx_id:
            return BuiltinToolTestResponse(success=False, message="API Key or CX ID is not configured")

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={"key": api_key, "cx": cx_id, "q": "test"},
                )
            latency = (time.monotonic() - start) * 1000

            if response.status_code == 200:
                return BuiltinToolTestResponse(
                    success=True,
                    message="Google Search API connection successful",
                    latency_ms=round(latency, 1),
                )
            else:
                error_body = response.json().get("error", {})
                error_detail = error_body.get("message", response.text[:200])
                return BuiltinToolTestResponse(
                    success=False,
                    message=f"API error: {error_detail}",
                    latency_ms=round(latency, 1),
                )
        except Exception as exc:
            return BuiltinToolTestResponse(success=False, message=f"Connection failed: {exc}")

    if tool.tool_type == "claude_code":
        from negentropy.engine.claude_code.credentials import resolve_claude_code_credential
        from negentropy.engine.claude_code.models import ClaudeCodeConfig
        from negentropy.engine.claude_code.service import ClaudeCodeService

        cc_config = ClaudeCodeConfig(
            cli_path=config.get("cli_path", "claude"),
            model=config.get("model"),
            timeout_seconds=300.0,
            # 注入真实 Anthropic 凭证（UI credentials > 环境变量），令未保存即测试也走真实凭证。
            credential=resolve_claude_code_credential(credentials),
        )
        result = await ClaudeCodeService.test_connection(cc_config)
        latency = result.get("latency_ms")
        return BuiltinToolTestResponse(
            success=result["success"],
            message=result["message"],
            latency_ms=latency,
        )

    return BuiltinToolTestResponse(success=False, message=f"Test not supported for tool type: {tool.tool_type}")


# =============================================================================
# Skills Endpoints
# =============================================================================


@router.get("/skills", response_model=list[SkillResponse])
async def list_skills(
    category: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
) -> list[SkillResponse]:
    """列出用户可见的 Skills"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "skill", user)
        if not visible_ids:
            return []

        stmt = select(Skill).where(Skill.id.in_(visible_ids))
        if category:
            stmt = stmt.where(Skill.category == category)
        stmt = stmt.order_by(Skill.priority.desc(), Skill.created_at.desc())
        result = await db.execute(stmt)
        skills = result.scalars().all()

    return [_skill_to_response(s) for s in skills]


@router.post("/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    payload: SkillCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillResponse:
    """创建新的 Skill"""
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(Skill).where(Skill.name == payload.name))
        if existing:
            raise HTTPException(status_code=400, detail="Skill name already exists")

        skill = Skill(
            owner_id=user.user_id,
            visibility=PluginVisibility(payload.visibility),
            name=payload.name,
            display_name=payload.display_name,
            description=payload.description,
            category=payload.category,
            version=payload.version,
            prompt_template=payload.prompt_template,
            config_schema=payload.config_schema,
            default_config=payload.default_config,
            required_tools=payload.required_tools,
            is_enabled=payload.is_enabled,
            priority=payload.priority,
            enforcement_mode=payload.enforcement_mode
            if payload.enforcement_mode in ("warning", "strict")
            else "warning",
            resources=payload.resources or [],
            is_global=bool(payload.is_global),
        )
        db.add(skill)
        await db.commit()
        await db.refresh(skill)
        # Phase 3：新建时同步写入初始版本快照，让 Agent 引用 name@version 立即可用。
        try:
            db.add(_build_initial_version(skill))
            await db.commit()
        except Exception as exc:
            logger.warning("skill_initial_version_failed", skill_id=str(skill.id), error=str(exc))

    if skill.is_global:
        _invalidate_global_skill_caches()
    return _skill_to_response(skill)


def _build_initial_version(skill: Skill) -> SkillVersion:
    """构造一条 SkillVersion 行，用于 ``create_skill`` / ``from-template`` 之后立即落库。"""
    return SkillVersion(
        skill_id=skill.id,
        version=skill.version or "1.0.0",
        snapshot={
            "name": skill.name,
            "display_name": skill.display_name,
            "description": skill.description,
            "category": skill.category,
            "prompt_template": skill.prompt_template,
            "config_schema": skill.config_schema,
            "default_config": skill.default_config,
            "required_tools": skill.required_tools,
            "priority": skill.priority,
            "enforcement_mode": getattr(skill, "enforcement_mode", "warning"),
            "resources": skill.resources,
            "is_global": bool(getattr(skill, "is_global", False)),
        },
    )


@router.get("/skills/templates", response_model=list[SkillTemplateSummary])
async def list_skill_templates(
    user: AuthUser = Depends(get_current_user),
) -> list[SkillTemplateSummary]:
    """列出内置 Skill 模板（必须在 ``/skills/{skill_id}`` 之前声明，避免被动态路径吞噬）。"""
    from negentropy.agents.skill_templates import load_all

    templates = load_all()
    return [
        SkillTemplateSummary(
            template_id=t.template_id,
            name=t.name,
            display_name=t.display_name,
            description=t.description,
            category=t.category,
            version=t.version,
        )
        for t in templates
    ]


@router.post(
    "/skills/from-template",
    response_model=SkillResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_skill_from_template(
    payload: SkillFromTemplateRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillResponse:
    """根据内置模板一键创建 Skill。

    - ``name`` 冲突时自动追加 ``-{owner_short}`` 后缀（不抛 400，避免重试摩擦）；
    - ``visibility`` 默认随模板（多为 ``shared``），调用方可覆盖。
    - 路由必须在 ``/skills/{skill_id}`` 之前声明。
    """
    from negentropy.agents.skill_templates import load_all

    templates = {t.template_id: t for t in load_all()}
    tpl = templates.get(payload.template_id)
    if tpl is None:
        raise HTTPException(status_code=404, detail=f"Template '{payload.template_id}' not found")

    target_name = (payload.name_override or tpl.name).strip()
    if not target_name:
        raise HTTPException(status_code=400, detail="Skill name cannot be empty")

    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(Skill).where(Skill.name == target_name))
        if existing:
            short = (user.user_id or "u").split(":")[-1][:8]
            target_name = f"{target_name}-{short}"
            existing2 = await db.scalar(select(Skill).where(Skill.name == target_name))
            if existing2:
                import secrets

                target_name = f"{target_name}-{secrets.token_hex(3)}"

        visibility_value = payload.visibility or tpl.visibility
        skill = Skill(
            owner_id=user.user_id,
            visibility=PluginVisibility(visibility_value),
            name=target_name,
            display_name=tpl.display_name,
            description=tpl.description,
            category=tpl.category,
            version=tpl.version,
            prompt_template=tpl.prompt_template,
            config_schema=tpl.config_schema,
            default_config=tpl.default_config,
            required_tools=tpl.required_tools,
            is_enabled=True,
            priority=tpl.priority,
            enforcement_mode=tpl.enforcement_mode,
            resources=tpl.resources,
            is_global=bool(getattr(tpl, "is_global", False)),
        )
        db.add(skill)
        await db.commit()
        await db.refresh(skill)
        # Phase 3：模板安装后立刻写入初始版本快照。
        try:
            db.add(_build_initial_version(skill))
            await db.commit()
        except Exception as exc:
            logger.warning("skill_initial_version_failed", skill_id=str(skill.id), error=str(exc))

    if skill.is_global:
        _invalidate_global_skill_caches()
    return _skill_to_response(skill)


@router.get("/skills/{skill_id}", response_model=SkillResponse)
async def get_skill(
    skill_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> SkillResponse:
    """获取 Skill 详情"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")
    return _skill_to_response(skill)


@router.patch("/skills/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: UUID,
    payload: SkillUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillResponse:
    """更新 Skill"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")

        update_data = payload.model_dump(exclude_unset=True)
        if "name" in update_data:
            new_name = str(update_data["name"] or "").strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="Skill name cannot be empty")
            if new_name != skill.name:
                existing = await db.scalar(select(Skill).where(and_(Skill.name == new_name, Skill.id != skill_id)))
                if existing:
                    raise HTTPException(status_code=400, detail="Skill name already exists")
            update_data["name"] = new_name
        if "visibility" in update_data:
            update_data["visibility"] = PluginVisibility(update_data["visibility"])
        if "enforcement_mode" in update_data:
            mode = update_data.get("enforcement_mode")
            if mode not in ("warning", "strict"):
                raise HTTPException(status_code=400, detail="enforcement_mode must be 'warning' or 'strict'")
        if "resources" in update_data:
            res_value = update_data.get("resources") or []
            if not isinstance(res_value, list):
                raise HTTPException(status_code=400, detail="resources must be a list")
            update_data["resources"] = res_value

        # Phase 3：检测 version 字段变更，自动 snapshot 到 skill_versions。
        old_version = skill.version
        new_version = update_data.get("version")
        version_changed = bool(new_version) and new_version != old_version

        for key, value in update_data.items():
            setattr(skill, key, value)

        if version_changed:
            try:
                snapshot_payload = {
                    "name": skill.name,
                    "display_name": skill.display_name,
                    "description": skill.description,
                    "category": skill.category,
                    "prompt_template": skill.prompt_template,
                    "config_schema": skill.config_schema,
                    "default_config": skill.default_config,
                    "required_tools": skill.required_tools,
                    "priority": skill.priority,
                    "enforcement_mode": getattr(skill, "enforcement_mode", "warning"),
                    "resources": skill.resources,
                    "is_global": bool(getattr(skill, "is_global", False)),
                }
                existing = await db.scalar(
                    select(SkillVersion).where(
                        SkillVersion.skill_id == skill.id,
                        SkillVersion.version == new_version,
                    )
                )
                if existing is None:
                    db.add(
                        SkillVersion(
                            skill_id=skill.id,
                            version=new_version,
                            snapshot=snapshot_payload,
                        )
                    )
            except Exception as exc:
                logger.warning(
                    "skill_version_snapshot_failed",
                    skill_id=str(skill.id),
                    error=str(exc),
                )

        await db.commit()
        await db.refresh(skill)

    # 全局技能字段或当前为全局技能 → 失效缓存（含关闭 is_global 的情形）。
    if skill.is_global or "is_global" in update_data:
        _invalidate_global_skill_caches()
    return _skill_to_response(skill)


# =============================================================================
# Skills Phase 3 — versions / schedules endpoints
# =============================================================================


@router.get("/skills/{skill_id}/versions", response_model=list[SkillVersionResponse])
async def list_skill_versions(
    skill_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> list[SkillVersionResponse]:
    """列出指定 Skill 的全部历史版本（最新在前）。"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)
        rows = (
            (
                await db.execute(
                    select(SkillVersion)
                    .where(SkillVersion.skill_id == skill_id)
                    .order_by(SkillVersion.created_at.desc())
                )
            )
            .scalars()
            .all()
        )
    return [
        SkillVersionResponse(
            id=r.id,
            skill_id=r.skill_id,
            version=r.version,
            snapshot=dict(r.snapshot or {}),
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post(
    "/skills/{skill_id}/versions",
    response_model=SkillVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_skill_version(
    skill_id: UUID,
    payload: SkillSnapshotRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillVersionResponse:
    """手动 freeze 当前 Skill 字段为一个新版本快照。

    若 ``payload.version`` 不传，使用 Skill 当前 ``version`` 字段；
    同 (skill_id, version) 已存在时返回 409。
    """
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "skill", skill_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")

        version = (payload.version or skill.version or "").strip()
        if not version:
            raise HTTPException(status_code=400, detail="version is required")
        existing = await db.scalar(
            select(SkillVersion).where(SkillVersion.skill_id == skill_id, SkillVersion.version == version)
        )
        if existing is not None:
            raise HTTPException(status_code=409, detail=f"Version '{version}' already exists for this skill")

        snapshot_payload = {
            "name": skill.name,
            "display_name": skill.display_name,
            "description": skill.description,
            "category": skill.category,
            "prompt_template": skill.prompt_template,
            "config_schema": skill.config_schema,
            "default_config": skill.default_config,
            "required_tools": skill.required_tools,
            "priority": skill.priority,
            "enforcement_mode": getattr(skill, "enforcement_mode", "warning"),
            "resources": skill.resources,
        }
        row = SkillVersion(skill_id=skill_id, version=version, snapshot=snapshot_payload)
        db.add(row)
        await db.commit()
        await db.refresh(row)

    return SkillVersionResponse(
        id=row.id,
        skill_id=row.skill_id,
        version=row.version,
        snapshot=dict(row.snapshot or {}),
        created_at=row.created_at,
    )


@router.get("/skills/{skill_id}/schedules", response_model=list[SkillScheduleResponse])
async def list_skill_schedules(
    skill_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> list[SkillScheduleResponse]:
    """列出指定 Skill 关联的全部定时调度。"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)
        rows = (
            (
                await db.execute(
                    select(SkillSchedule)
                    .where(SkillSchedule.skill_id == skill_id)
                    .order_by(SkillSchedule.created_at.desc())
                )
            )
            .scalars()
            .all()
        )
    return [_schedule_to_response(s) for s in rows]


@router.post(
    "/skills/{skill_id}/schedules",
    response_model=SkillScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_skill_schedule(
    skill_id: UUID,
    payload: SkillScheduleRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillScheduleResponse:
    """新增一条定时调度：cron 表达式 + 透传变量。"""
    from croniter import CroniterBadCronError, croniter

    from negentropy.agents.skill_scheduler import ensure_scheduler_running

    cron_expr = (payload.cron_expr or "").strip()
    if not cron_expr:
        raise HTTPException(status_code=400, detail="cron_expr is required")
    try:
        # 与 ``skill_scheduler._utcnow`` 保持一致：tz-aware UTC，避免 naive
        # datetime 写入 ``next_run_at`` (TIMESTAMP WITH TIME ZONE) 时被驱动按本地
        # 时区错误解释。
        cron = croniter(cron_expr, datetime.now(UTC))
        next_run = cron.get_next(datetime)
    except (CroniterBadCronError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"invalid cron_expr: {exc}") from exc

    # 幂等懒启动 SkillScheduler tick（ADK 嵌入场景下 FastAPI startup hook 不触发）。
    await ensure_scheduler_running()

    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "skill", skill_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")

        sched = SkillSchedule(
            skill_id=skill_id,
            owner_id=user.user_id,
            cron_expr=cron_expr,
            enabled=payload.enabled,
            vars=payload.vars or {},
            next_run_at=next_run,
        )
        db.add(sched)
        await db.commit()
        await db.refresh(sched)

    return _schedule_to_response(sched)


@router.delete(
    "/skills/{skill_id}/schedules/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_skill_schedule(
    skill_id: UUID,
    schedule_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> None:
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "skill", skill_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)
        sched = await db.get(SkillSchedule, schedule_id)
        if not sched or sched.skill_id != skill_id:
            raise HTTPException(status_code=404, detail="Schedule not found")
        await db.delete(sched)
        await db.commit()


@router.post(
    "/skills/{skill_id}/schedules/{schedule_id}/run",
    response_model=SkillScheduleResponse,
)
async def run_skill_schedule(
    skill_id: UUID,
    schedule_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> SkillScheduleResponse:
    """手动触发一次调度（不等 cron tick）。"""
    from negentropy.agents.skill_scheduler import execute_schedule_once

    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)
        sched = await db.get(SkillSchedule, schedule_id)
        if not sched or sched.skill_id != skill_id:
            raise HTTPException(status_code=404, detail="Schedule not found")

    await execute_schedule_once(schedule_id)

    async with AsyncSessionLocal() as db:
        sched_after = await db.get(SkillSchedule, schedule_id)
        if sched_after is None:
            raise HTTPException(status_code=404, detail="Schedule disappeared after run")
        return _schedule_to_response(sched_after)


def _schedule_to_response(s: SkillSchedule) -> SkillScheduleResponse:
    return SkillScheduleResponse(
        id=s.id,
        skill_id=s.skill_id,
        owner_id=s.owner_id,
        cron_expr=s.cron_expr,
        enabled=s.enabled,
        vars=dict(s.vars or {}),
        last_run_at=s.last_run_at,
        next_run_at=s.next_run_at,
        last_error=s.last_error,
        created_at=s.created_at,
    )


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """删除 Skill（仅 owner 可删除）"""
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "skill", skill_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")
        was_global = bool(getattr(skill, "is_global", False))
        await db.delete(skill)
        await db.commit()

    if was_global:
        _invalidate_global_skill_caches()


def _skill_to_response(skill: Skill) -> SkillResponse:
    return SkillResponse(
        id=skill.id,
        owner_id=skill.owner_id,
        visibility=skill.visibility.value,
        name=skill.name,
        display_name=skill.display_name,
        description=skill.description,
        category=skill.category,
        version=skill.version,
        prompt_template=skill.prompt_template,
        config_schema=skill.config_schema or {},
        default_config=skill.default_config or {},
        required_tools=skill.required_tools or [],
        is_enabled=skill.is_enabled,
        priority=skill.priority,
        enforcement_mode=getattr(skill, "enforcement_mode", "warning") or "warning",
        resources=list(skill.resources or []) if hasattr(skill, "resources") else [],
        is_builtin=bool(getattr(skill, "is_system", False)) or (skill.owner_id or "").startswith("system"),
        is_global=bool(getattr(skill, "is_global", False)),
    )


def _invalidate_global_skill_caches() -> None:
    """全局技能写操作后清缓存，实现强一致（否则最长 60s TTL 后才生效）。

    清两处：``skills_injector`` 的全局块缓存（fallback 路径）+ ``model_resolver``
    的 ``subagent:`` 指令缓存（DB 路径已把全局块嵌入指令文本）。fail-soft。
    """
    try:
        from negentropy.agents.skills_injector import invalidate_global_skills_cache
        from negentropy.config.model_resolver import invalidate_cache

        invalidate_global_skills_cache()
        invalidate_cache(prefix="subagent:")
    except Exception as exc:  # pragma: no cover - 缓存失效兜底
        logger.warning("invalidate_global_skill_caches_failed", error=str(exc))


# =============================================================================
# Skills Phase 2 — invoke / templates endpoints
# =============================================================================


@router.post("/skills/{skill_id}/invoke", response_model=SkillInvokeResponse)
async def invoke_skill(
    skill_id: UUID,
    payload: SkillInvokeRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillInvokeResponse:
    """渲染 Skill 的 prompt_template（Layer 2 按需展开）+ 资源摘要 + 工具差异。

    服务端用 Jinja2 沙箱渲染 ``prompt_template``，**不**真正调用 LLM —— 调用方
    （UI Preview 按钮 / ``expand_skill`` ADK tool / 外部系统）拿到渲染结果后自行
    决定如何使用。``required_tools`` 与 ``vars`` 校验在此一次完成。
    """
    import os

    from negentropy.agents.skills_injector import (
        ResolvedSkill,
        format_skill_invocation,
        format_skill_resources,
        validate_required_tools,
    )

    if os.environ.get("NEGENTROPY_SKILLS_LAYER2_ENABLED", "true").lower() in ("0", "false", "no"):
        raise HTTPException(status_code=503, detail="Skills Layer 2 is disabled by feature flag")

    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")
        if not skill.is_enabled:
            raise HTTPException(status_code=409, detail="Skill is disabled")

        resolved = ResolvedSkill(
            id=str(skill.id),
            name=skill.name,
            display_name=skill.display_name,
            description=skill.description,
            prompt_template=skill.prompt_template,
            required_tools=tuple(skill.required_tools or []),
            is_enabled=skill.is_enabled,
            enforcement_mode=getattr(skill, "enforcement_mode", "warning") or "warning",
            resources=tuple(skill.resources or ()) if hasattr(skill, "resources") else (),
        )

    rendered = format_skill_invocation(resolved, variables=payload.variables) or ""
    if not rendered and resolved.resources:
        rendered = format_skill_resources(resolved, eager=True)
    return SkillInvokeResponse(
        skill_id=skill.id,
        name=skill.name,
        rendered_prompt=rendered,
        resources=list(resolved.resources),
        missing_tools=validate_required_tools(resolved, agent_tools=None) if resolved.required_tools else [],
    )


# =============================================================================
# Agents Endpoints
# =============================================================================


def _json_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _build_adk_config_from_payload(
    payload: dict[str, Any],
    existing_adk_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构建 Agent 的 ADK 配置（可回放）。"""
    adk_config: dict[str, Any] = dict(existing_adk_config or {})
    incoming_adk = payload.get("adk_config")
    if isinstance(incoming_adk, dict):
        adk_config.update(incoming_adk)

    # 核心字段始终由结构化列驱动，避免双写漂移
    name = payload.get("name")
    if isinstance(name, str) and name:
        adk_config["name"] = name

    description = payload.get("description")
    if description is None or isinstance(description, str):
        adk_config["description"] = description

    agent_type = payload.get("agent_type")
    if isinstance(agent_type, str) and agent_type:
        adk_config["agent_type"] = agent_type

    system_prompt = payload.get("system_prompt")
    if system_prompt is None or isinstance(system_prompt, str):
        adk_config["instruction"] = system_prompt

    model = payload.get("model")
    if model is None or isinstance(model, str):
        adk_config["model"] = model

    tools = payload.get("tools")
    if isinstance(tools, list):
        adk_config["tools"] = tools

    return adk_config


def _merge_agent_config(
    *,
    current_config: dict[str, Any] | None,
    update_config: dict[str, Any] | None,
    adk_config: dict[str, Any],
    source: str,
) -> dict[str, Any]:
    merged = dict(current_config or {})
    if isinstance(update_config, dict):
        merged.update(update_config)
    merged["adk_config"] = adk_config
    merged["source"] = source
    return merged


def _materialize_agent_payload(
    agent: Agent | None,
    incoming: dict[str, Any],
) -> dict[str, Any]:
    """将数据库对象与变更 payload 合并为完整视图，便于构建 adk_config。"""
    if agent is None:
        base = {
            "name": incoming.get("name"),
            "display_name": incoming.get("display_name"),
            "description": incoming.get("description"),
            "agent_type": incoming.get("agent_type"),
            "system_prompt": incoming.get("system_prompt"),
            "model": incoming.get("model"),
            "config": _json_dict(incoming.get("config")),
            "adk_config": _json_dict(incoming.get("adk_config")),
            "skills": incoming.get("skills") or [],
            "tools": incoming.get("tools") or [],
            "is_enabled": incoming.get("is_enabled", True),
            "visibility": incoming.get("visibility", "private"),
        }
        return base

    config = _json_dict(agent.config)
    base = {
        "name": agent.name,
        "display_name": agent.display_name,
        "description": agent.description,
        "agent_type": agent.agent_type,
        "system_prompt": agent.system_prompt,
        "model": agent.model,
        "config": config,
        "adk_config": _json_dict(config.get("adk_config")),
        "skills": agent.skills or [],
        "tools": agent.tools or [],
        "is_enabled": agent.is_enabled,
        "visibility": agent.visibility.value,
    }
    base.update(incoming)

    if "config" in incoming:
        base["config"] = _json_dict(incoming["config"])
    if "adk_config" in incoming:
        base["adk_config"] = _json_dict(incoming["adk_config"])
    return base


def _resolve_agent_source(config: dict[str, Any]) -> str:
    source = config.get("source")
    if isinstance(source, str) and source:
        return source
    return "user_defined"


def _extract_adk_config(agent: Agent) -> dict[str, Any]:
    config = _json_dict(agent.config)
    adk_config = config.get("adk_config")
    if isinstance(adk_config, dict):
        return adk_config

    # 兼容历史记录：若不存在 adk_config，则由结构化列推导最小可回放配置
    fallback_payload = {
        "name": agent.name,
        "description": agent.description,
        "agent_type": agent.agent_type,
        "system_prompt": agent.system_prompt,
        "model": agent.model,
        "tools": agent.tools or [],
    }
    return _build_adk_config_from_payload(fallback_payload)


@router.get("/agents", response_model=list[AgentResponse])
async def list_agents(user: AuthUser = Depends(get_current_user)) -> list[AgentResponse]:
    """列出用户可见的 Agents"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "agent", user)
        if not visible_ids:
            return []

        stmt = select(Agent).where(Agent.id.in_(visible_ids)).order_by(Agent.created_at.desc())
        result = await db.execute(stmt)
        agents = result.scalars().all()

    return [_agent_to_response(a) for a in agents]


@router.get("/agents/templates/negentropy", response_model=list[NegentropyAgentTemplateResponse])
async def list_negentropy_agent_templates(
    user: AuthUser = Depends(get_current_user),
) -> list[NegentropyAgentTemplateResponse]:
    """返回 Negentropy 内置 5 个 Faculty Agent 模板（来自代码定义）。"""
    _ = user  # 显式依赖鉴权
    from .agent_presets import build_negentropy_agent_payloads

    payloads = build_negentropy_agent_payloads()
    return [
        NegentropyAgentTemplateResponse(
            name=payload["name"],
            display_name=payload.get("display_name"),
            description=payload.get("description"),
            agent_type=payload.get("agent_type", "llm_agent"),
            system_prompt=payload.get("system_prompt"),
            model=payload.get("model"),
            adk_config=payload.get("adk_config", {}),
            tools=payload.get("tools", []),
        )
        for payload in payloads
    ]


@router.post("/agents/sync/negentropy", response_model=NegentropyAgentSyncResponse)
async def sync_negentropy_agents(
    user: AuthUser = Depends(get_current_user),
) -> NegentropyAgentSyncResponse:
    """
    将代码中的 **主 Agent (NegentropyEngine) + 5 个 Faculty Agent** 同步到插件表。

    幂等语义：
    - 已存在且归属当前用户：更新为最新代码定义；
    - 已存在但归属其他用户：跳过；
    - 不存在：创建。

    Sync 完成后批量失效 ``subagent:`` 前缀缓存，使 ``DynamicRootLiteLlm`` /
    ``DynamicSubagentLiteLlm`` 与 ``InstructionProvider`` 立即看到 DB 最新值。
    """
    from .agent_presets import build_negentropy_agent_payloads

    payloads = build_negentropy_agent_payloads()
    created_count = 0
    updated_count = 0
    skipped_count = 0
    touched_agents: list[Agent] = []

    async with AsyncSessionLocal() as db:
        for payload in payloads:
            existing = await db.scalar(select(Agent).where(Agent.name == payload["name"]))
            materialized = _materialize_agent_payload(existing, payload)
            adk_config = _build_adk_config_from_payload(
                materialized,
                existing_adk_config=_json_dict(materialized.get("adk_config")),
            )
            merged_config = _merge_agent_config(
                current_config=_json_dict(existing.config) if existing else None,
                update_config=_json_dict(materialized.get("config")),
                adk_config=adk_config,
                source="negentropy_builtin",
            )

            if existing:
                if existing.owner_id != user.user_id:
                    skipped_count += 1
                    continue

                existing.display_name = materialized.get("display_name")
                existing.description = materialized.get("description")
                existing.agent_type = materialized.get("agent_type")
                existing.system_prompt = materialized.get("system_prompt")
                existing.model = materialized.get("model")
                existing.config = merged_config
                existing.skills = materialized.get("skills") or []
                existing.tools = materialized.get("tools") or []
                existing.is_enabled = bool(materialized.get("is_enabled", True))
                existing.visibility = PluginVisibility(materialized.get("visibility", "private"))
                # 与迁移 0033 的回填语义对齐：经 negentropy 内置同步的 Agent 都是系统内置。
                existing.is_system = True
                updated_count += 1
                touched_agents.append(existing)
                continue

            new_agent = Agent(
                owner_id=user.user_id,
                visibility=PluginVisibility(materialized.get("visibility", "private")),
                name=materialized["name"],
                display_name=materialized.get("display_name"),
                description=materialized.get("description"),
                agent_type=materialized.get("agent_type", "llm_agent"),
                system_prompt=materialized.get("system_prompt"),
                model=materialized.get("model"),
                config=merged_config,
                skills=materialized.get("skills") or [],
                tools=materialized.get("tools") or [],
                is_enabled=bool(materialized.get("is_enabled", True)),
                is_system=True,
            )
            db.add(new_agent)
            created_count += 1
            touched_agents.append(new_agent)

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=f"Agent sync conflict: {exc}") from exc

        for agent in touched_agents:
            await db.refresh(agent)

    # 批量失效，让运行时 model + instruction 立即看到 Sync 后的 DB 值。
    # NB: ``subagent:`` 是 model_resolver 内部缓存键前缀（运行时 ADK 模型/指令解析层），
    # 与此处失效调用构成跨模块契约；二者须保持一致，故刻意保留旧前缀字面量。
    invalidate_model_cache(prefix="subagent:")

    return NegentropyAgentSyncResponse(
        created=created_count,
        updated=updated_count,
        skipped=skipped_count,
        agents=[_agent_to_response(agent) for agent in touched_agents],
    )


@router.post("/agents", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    payload: AgentCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> AgentResponse:
    """创建新的 Agent"""
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(Agent).where(Agent.name == payload.name))
        if existing:
            raise HTTPException(status_code=400, detail="Agent name already exists")

        incoming = payload.model_dump()
        materialized = _materialize_agent_payload(None, incoming)
        adk_config = _build_adk_config_from_payload(
            materialized,
            existing_adk_config=_json_dict(materialized.get("adk_config")),
        )
        source = _resolve_agent_source(_json_dict(materialized.get("config")))
        merged_config = _merge_agent_config(
            current_config=None,
            update_config=_json_dict(materialized.get("config")),
            adk_config=adk_config,
            source=source,
        )

        agent = Agent(
            owner_id=user.user_id,
            visibility=PluginVisibility(payload.visibility),
            name=payload.name,
            display_name=materialized.get("display_name"),
            description=materialized.get("description"),
            agent_type=materialized.get("agent_type", "llm_agent"),
            system_prompt=materialized.get("system_prompt"),
            model=materialized.get("model"),
            config=merged_config,
            skills=materialized.get("skills") or [],
            tools=materialized.get("tools") or [],
            is_enabled=bool(materialized.get("is_enabled", True)),
        )
        db.add(agent)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=f"Agent create conflict: {exc}") from exc
        await db.refresh(agent)

    return _agent_to_response(agent)


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> AgentResponse:
    """获取 Agent 详情"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "agent", agent_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        agent = await db.get(Agent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
    return _agent_to_response(agent)


@router.patch("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    payload: AgentUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> AgentResponse:
    """更新 Agent"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "agent", agent_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        agent = await db.get(Agent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        original_name = agent.name
        incoming = payload.model_dump(exclude_unset=True)
        confirm_builtin_rename = bool(incoming.pop("confirm_builtin_rename", False))

        if "name" in incoming:
            new_name = str(incoming["name"] or "").strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="Agent name cannot be empty")
            if new_name != agent.name:
                current_source = _resolve_agent_source(_json_dict(agent.config))
                if current_source == "negentropy_builtin" and not confirm_builtin_rename:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Renaming a Negentropy built-in Agent may cause sync to create "
                            "a duplicate. Set confirm_builtin_rename=true to continue."
                        ),
                    )
                existing = await db.scalar(select(Agent).where(and_(Agent.name == new_name, Agent.id != agent_id)))
                if existing:
                    raise HTTPException(status_code=400, detail="Agent name already exists")
            incoming["name"] = new_name

        materialized = _materialize_agent_payload(agent, incoming)
        adk_config = _build_adk_config_from_payload(
            materialized,
            existing_adk_config=_json_dict(materialized.get("adk_config")),
        )
        source = _resolve_agent_source(_json_dict(materialized.get("config")))
        merged_config = _merge_agent_config(
            current_config=_json_dict(agent.config),
            update_config=_json_dict(materialized.get("config")),
            adk_config=adk_config,
            source=source,
        )

        if "name" in incoming:
            agent.name = materialized.get("name", agent.name)
        if "display_name" in incoming:
            agent.display_name = materialized.get("display_name")
        if "description" in incoming:
            agent.description = materialized.get("description")
        if "agent_type" in incoming:
            agent.agent_type = materialized.get("agent_type", agent.agent_type)
        if "system_prompt" in incoming:
            agent.system_prompt = materialized.get("system_prompt")
        if "model" in incoming:
            agent.model = materialized.get("model")
        if "skills" in incoming:
            agent.skills = materialized.get("skills") or []
        if "tools" in incoming:
            agent.tools = materialized.get("tools") or []
        if "is_enabled" in incoming:
            agent.is_enabled = bool(materialized.get("is_enabled"))
        if "visibility" in incoming:
            agent.visibility = PluginVisibility(str(materialized.get("visibility")))
        agent.config = merged_config

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=f"Agent update conflict: {exc}") from exc
        await db.refresh(agent)

    invalidate_model_cache(prefix=f"subagent:{original_name}")
    if agent.name != original_name:
        invalidate_model_cache(prefix=f"subagent:{agent.name}")
    return _agent_to_response(agent)


@router.delete("/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """删除 Agent（仅 owner 可删除）"""
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "agent", agent_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        agent = await db.get(Agent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        deleted_name = agent.name
        await db.delete(agent)
        await db.commit()

    invalidate_model_cache(prefix=f"subagent:{deleted_name}")


def _agent_to_response(agent: Agent) -> AgentResponse:
    config = _json_dict(agent.config)
    source = _resolve_agent_source(config)
    adk_config = _extract_adk_config(agent)
    raw_kind = adk_config.get("kind") if isinstance(adk_config, dict) else None
    # 读时归一：root 行保持 "root"；其余（含历史值 "subagent"、新值 "agent" 及缺失）
    # 一律归一为 "agent"，使未跑迁移 0044 的历史行也能安全对外暴露。
    kind = "root" if raw_kind == "root" else "agent"
    # is_builtin OR 合并：显式 ``is_system`` 列（迁移 0033 起）+ 历史 config.source 标记。
    # 迁移 0033 已将 ``config.source == "negentropy_builtin"`` 行回填 is_system=TRUE，
    # 这里保留 OR 兼容仍未跑迁移的部署，下一个 release 周期可下线 config.source 判断。
    is_builtin = bool(getattr(agent, "is_system", False)) or source == "negentropy_builtin"
    return AgentResponse(
        id=agent.id,
        owner_id=agent.owner_id,
        visibility=agent.visibility.value,
        name=agent.name,
        display_name=agent.display_name,
        description=agent.description,
        agent_type=agent.agent_type,
        system_prompt=agent.system_prompt,
        model=agent.model,
        config=config,
        adk_config=adk_config,
        skills=agent.skills or [],
        tools=agent.tools or [],
        source=source,
        is_builtin=is_builtin,
        is_enabled=agent.is_enabled,
        kind=kind,
    )


# =============================================================================
# Permission Management Endpoints
# =============================================================================


@router.get("/{plugin_type}/{plugin_id}/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    plugin_type: str,
    plugin_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> list[PermissionResponse]:
    """获取插件的授权列表（仅 owner 可查看）"""
    if plugin_type not in ["mcp_server", "skill", "agent"]:
        raise HTTPException(status_code=400, detail="Invalid plugin type")

    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, plugin_type, plugin_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        result = await db.execute(
            select(PluginPermission).where(
                and_(
                    PluginPermission.plugin_type == plugin_type,
                    PluginPermission.plugin_id == plugin_id,
                )
            )
        )
        permissions = result.scalars().all()

    return [PermissionResponse(id=p.id, user_id=p.user_id, permission=p.permission.value) for p in permissions]


@router.post(
    "/{plugin_type}/{plugin_id}/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED
)
async def grant_permission(
    plugin_type: str,
    plugin_id: UUID,
    payload: PermissionGrantRequest,
    user: AuthUser = Depends(get_current_user),
) -> PermissionResponse:
    """授权给指定用户（仅 owner 可操作）"""
    if plugin_type not in ["mcp_server", "skill", "agent"]:
        raise HTTPException(status_code=400, detail="Invalid plugin type")

    if payload.permission not in ["view", "edit"]:
        raise HTTPException(status_code=400, detail="Invalid permission type")

    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, plugin_type, plugin_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        # Check if permission already exists
        existing = await db.scalar(
            select(PluginPermission).where(
                and_(
                    PluginPermission.plugin_type == plugin_type,
                    PluginPermission.plugin_id == plugin_id,
                    PluginPermission.user_id == payload.user_id,
                )
            )
        )
        if existing:
            # Update existing permission
            existing.permission = PluginPermissionType(payload.permission)
            await db.commit()
            await db.refresh(existing)
            return PermissionResponse(id=existing.id, user_id=existing.user_id, permission=existing.permission.value)

        # Create new permission
        permission = PluginPermission(
            plugin_type=plugin_type,
            plugin_id=plugin_id,
            user_id=payload.user_id,
            permission=PluginPermissionType(payload.permission),
        )
        db.add(permission)
        await db.commit()
        await db.refresh(permission)

    return PermissionResponse(id=permission.id, user_id=permission.user_id, permission=permission.permission.value)


@router.delete("/{plugin_type}/{plugin_id}/permissions/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_permission(
    plugin_type: str,
    plugin_id: UUID,
    user_id: str,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """撤销用户授权（仅 owner 可操作）"""
    if plugin_type not in ["mcp_server", "skill", "agent"]:
        raise HTTPException(status_code=400, detail="Invalid plugin type")

    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, plugin_type, plugin_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        permission = await db.scalar(
            select(PluginPermission).where(
                and_(
                    PluginPermission.plugin_type == plugin_type,
                    PluginPermission.plugin_id == plugin_id,
                    PluginPermission.user_id == user_id,
                )
            )
        )
        if permission:
            await db.delete(permission)
            await db.commit()
