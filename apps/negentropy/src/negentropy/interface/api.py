"""
Interface API 模块。

提供 MCP Server、Skill、SubAgent 的 CRUD 端点。
"""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func, select
from sqlalchemy.exc import IntegrityError

from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.config import settings
from negentropy.config.model_resolver import invalidate_cache as invalidate_model_cache
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.model_config import ModelConfig
from negentropy.models.plugin import (
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
    SubAgent,
)
from negentropy.models.vendor_config import VendorConfig

from .execution import McpToolExecutionService
from .permissions import check_plugin_access, check_plugin_ownership, get_visible_plugin_ids

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
    subagents: dict[str, int]
    models: dict[str, int]


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

    class Config:
        from_attributes = True


# =============================================================================
# SubAgent Models
# =============================================================================


class SubAgentCreateRequest(BaseModel):
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


class SubAgentUpdateRequest(BaseModel):
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


class SubAgentResponse(BaseModel):
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
    # ``"subagent"``（默认）适用于 Faculty 与用户自定义子 Agent。前端按此置顶 + Root 徽章。
    kind: str = "subagent"

    class Config:
        from_attributes = True


class NegentropySubAgentTemplateResponse(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    agent_type: str
    system_prompt: str | None = None
    model: str | None = None
    adk_config: dict[str, Any] = Field(default_factory=dict)
    tools: list[str] = Field(default_factory=list)


class NegentropySubAgentSyncResponse(BaseModel):
    created: int
    updated: int
    skipped: int
    agents: list[SubAgentResponse] = Field(default_factory=list)


# =============================================================================
# Stats Endpoint
# =============================================================================


@router.get("/stats", response_model=StatsResponse)
async def get_stats(user: AuthUser = Depends(get_current_user)) -> StatsResponse:
    """获取 Dashboard 统计数据"""
    async with AsyncSessionLocal() as db:
        # MCP Servers
        visible_mcp_ids = await get_visible_plugin_ids(db, "mcp_server", user)
        mcp_total = len(visible_mcp_ids)
        mcp_enabled_result = await db.scalar(
            select(func.count()).where(and_(McpServer.id.in_(visible_mcp_ids), McpServer.is_enabled.is_(True)))
        )
        mcp_enabled = mcp_enabled_result or 0

        # Skills
        visible_skill_ids = await get_visible_plugin_ids(db, "skill", user)
        skill_total = len(visible_skill_ids)
        skill_enabled_result = await db.scalar(
            select(func.count()).where(and_(Skill.id.in_(visible_skill_ids), Skill.is_enabled.is_(True)))
        )
        skill_enabled = skill_enabled_result or 0

        # SubAgents
        visible_subagent_ids = await get_visible_plugin_ids(db, "sub_agent", user)
        subagent_total = len(visible_subagent_ids)
        subagent_enabled_result = await db.scalar(
            select(func.count()).where(and_(SubAgent.id.in_(visible_subagent_ids), SubAgent.is_enabled.is_(True)))
        )
        subagent_enabled = subagent_enabled_result or 0

        # Models (Vendor configs + Model configs)
        # 仅 admin 可读，非 admin 以全 0 占位以便前端按角色决定是否展示
        if "admin" in user.roles:
            vendor_total = await db.scalar(select(func.count()).select_from(VendorConfig)) or 0
            model_total = await db.scalar(select(func.count()).select_from(ModelConfig)) or 0
            model_enabled = (
                await db.scalar(select(func.count()).select_from(ModelConfig).where(ModelConfig.enabled.is_(True))) or 0
            )
        else:
            vendor_total = 0
            model_total = 0
            model_enabled = 0

    return StatsResponse(
        mcp_servers={"total": mcp_total, "enabled": mcp_enabled},
        skills={"total": skill_total, "enabled": skill_enabled},
        subagents={"total": subagent_total, "enabled": subagent_enabled},
        models={"total": model_total, "enabled": model_enabled, "vendors": vendor_total},
    )


# =============================================================================
# MCP Server Endpoints
# =============================================================================


@router.get("/mcp/servers", response_model=list[McpServerResponse])
async def list_mcp_servers(user: AuthUser = Depends(get_current_user)) -> list[McpServerResponse]:
    """列出用户可见的 MCP 服务器"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "mcp_server", user)
        if not visible_ids:
            return []

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

    return [
        _mcp_server_to_response(
            server,
            tool_count_map.get(server.id, 0),
            template_count_map.get(server.id, 0),
        )
        for server in servers
    ]


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
    """
    from .mcp_client import McpClientService

    async with AsyncSessionLocal() as db:
        # 1. 权限检查
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        # 2. 获取 Server 配置
        server = await db.get(McpServer, server_id)
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")

        # 3. 调用 MCP Client Service
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

        # 4. 同步 Tools 到数据库
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

        # 5. 同步 Resource Templates 到数据库（以 uri_template 为键）
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

        # 删除 server 不再声明的 templates（保持 DB 与 server 声明一致）
        for stale_uri, stale_tpl in existing_template_map.items():
            if stale_uri not in seen_uri_templates:
                await db.delete(stale_tpl)

        await db.commit()

        # 6. 刷新以获取 ID
        for tool in updated_tools:
            await db.refresh(tool)
        for tpl in updated_templates:
            await db.refresh(tpl)

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
        )
        db.add(skill)
        await db.commit()
        await db.refresh(skill)

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

        for key, value in update_data.items():
            setattr(skill, key, value)

        await db.commit()
        await db.refresh(skill)

    return _skill_to_response(skill)


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
        await db.delete(skill)
        await db.commit()


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
    )


# =============================================================================
# SubAgents Endpoints
# =============================================================================


def _json_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _build_adk_config_from_payload(
    payload: dict[str, Any],
    existing_adk_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构建 SubAgent 的 ADK 配置（可回放）。"""
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


def _merge_subagent_config(
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


def _materialize_subagent_payload(
    agent: SubAgent | None,
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


def _resolve_subagent_source(config: dict[str, Any]) -> str:
    source = config.get("source")
    if isinstance(source, str) and source:
        return source
    return "user_defined"


def _extract_adk_config(agent: SubAgent) -> dict[str, Any]:
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


@router.get("/subagents", response_model=list[SubAgentResponse])
async def list_subagents(user: AuthUser = Depends(get_current_user)) -> list[SubAgentResponse]:
    """列出用户可见的 SubAgents"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "sub_agent", user)
        if not visible_ids:
            return []

        stmt = select(SubAgent).where(SubAgent.id.in_(visible_ids)).order_by(SubAgent.created_at.desc())
        result = await db.execute(stmt)
        agents = result.scalars().all()

    return [_subagent_to_response(a) for a in agents]


@router.get("/subagents/templates/negentropy", response_model=list[NegentropySubAgentTemplateResponse])
async def list_negentropy_subagent_templates(
    user: AuthUser = Depends(get_current_user),
) -> list[NegentropySubAgentTemplateResponse]:
    """返回 Negentropy 内置 5 个 Faculty SubAgent 模板（来自代码定义）。"""
    _ = user  # 显式依赖鉴权
    from .subagent_presets import build_negentropy_subagent_payloads

    payloads = build_negentropy_subagent_payloads()
    return [
        NegentropySubAgentTemplateResponse(
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


@router.post("/subagents/sync/negentropy", response_model=NegentropySubAgentSyncResponse)
async def sync_negentropy_subagents(
    user: AuthUser = Depends(get_current_user),
) -> NegentropySubAgentSyncResponse:
    """
    将代码中的 **主 Agent (NegentropyEngine) + 5 个 Faculty SubAgent** 同步到插件表。

    幂等语义：
    - 已存在且归属当前用户：更新为最新代码定义；
    - 已存在但归属其他用户：跳过；
    - 不存在：创建。

    Sync 完成后批量失效 ``subagent:`` 前缀缓存，使 ``DynamicRootLiteLlm`` /
    ``DynamicSubagentLiteLlm`` 与 ``InstructionProvider`` 立即看到 DB 最新值。
    """
    from .subagent_presets import build_negentropy_subagent_payloads

    payloads = build_negentropy_subagent_payloads()
    created_count = 0
    updated_count = 0
    skipped_count = 0
    touched_agents: list[SubAgent] = []

    async with AsyncSessionLocal() as db:
        for payload in payloads:
            existing = await db.scalar(select(SubAgent).where(SubAgent.name == payload["name"]))
            materialized = _materialize_subagent_payload(existing, payload)
            adk_config = _build_adk_config_from_payload(
                materialized,
                existing_adk_config=_json_dict(materialized.get("adk_config")),
            )
            merged_config = _merge_subagent_config(
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
                updated_count += 1
                touched_agents.append(existing)
                continue

            new_agent = SubAgent(
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
            )
            db.add(new_agent)
            created_count += 1
            touched_agents.append(new_agent)

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=f"SubAgent sync conflict: {exc}") from exc

        for agent in touched_agents:
            await db.refresh(agent)

    # 批量失效，让运行时 model + instruction 立即看到 Sync 后的 DB 值。
    invalidate_model_cache(prefix="subagent:")

    return NegentropySubAgentSyncResponse(
        created=created_count,
        updated=updated_count,
        skipped=skipped_count,
        agents=[_subagent_to_response(agent) for agent in touched_agents],
    )


@router.post("/subagents", response_model=SubAgentResponse, status_code=status.HTTP_201_CREATED)
async def create_subagent(
    payload: SubAgentCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> SubAgentResponse:
    """创建新的 SubAgent"""
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(SubAgent).where(SubAgent.name == payload.name))
        if existing:
            raise HTTPException(status_code=400, detail="SubAgent name already exists")

        incoming = payload.model_dump()
        materialized = _materialize_subagent_payload(None, incoming)
        adk_config = _build_adk_config_from_payload(
            materialized,
            existing_adk_config=_json_dict(materialized.get("adk_config")),
        )
        source = _resolve_subagent_source(_json_dict(materialized.get("config")))
        merged_config = _merge_subagent_config(
            current_config=None,
            update_config=_json_dict(materialized.get("config")),
            adk_config=adk_config,
            source=source,
        )

        agent = SubAgent(
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
            raise HTTPException(status_code=409, detail=f"SubAgent create conflict: {exc}") from exc
        await db.refresh(agent)

    return _subagent_to_response(agent)


@router.get("/subagents/{agent_id}", response_model=SubAgentResponse)
async def get_subagent(
    agent_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> SubAgentResponse:
    """获取 SubAgent 详情"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "sub_agent", agent_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        agent = await db.get(SubAgent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="SubAgent not found")
    return _subagent_to_response(agent)


@router.patch("/subagents/{agent_id}", response_model=SubAgentResponse)
async def update_subagent(
    agent_id: UUID,
    payload: SubAgentUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> SubAgentResponse:
    """更新 SubAgent"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "sub_agent", agent_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        agent = await db.get(SubAgent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="SubAgent not found")

        original_name = agent.name
        incoming = payload.model_dump(exclude_unset=True)
        confirm_builtin_rename = bool(incoming.pop("confirm_builtin_rename", False))

        if "name" in incoming:
            new_name = str(incoming["name"] or "").strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="SubAgent name cannot be empty")
            if new_name != agent.name:
                current_source = _resolve_subagent_source(_json_dict(agent.config))
                if current_source == "negentropy_builtin" and not confirm_builtin_rename:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Renaming a Negentropy built-in SubAgent may cause sync to create "
                            "a duplicate. Set confirm_builtin_rename=true to continue."
                        ),
                    )
                existing = await db.scalar(
                    select(SubAgent).where(and_(SubAgent.name == new_name, SubAgent.id != agent_id))
                )
                if existing:
                    raise HTTPException(status_code=400, detail="SubAgent name already exists")
            incoming["name"] = new_name

        materialized = _materialize_subagent_payload(agent, incoming)
        adk_config = _build_adk_config_from_payload(
            materialized,
            existing_adk_config=_json_dict(materialized.get("adk_config")),
        )
        source = _resolve_subagent_source(_json_dict(materialized.get("config")))
        merged_config = _merge_subagent_config(
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
            raise HTTPException(status_code=409, detail=f"SubAgent update conflict: {exc}") from exc
        await db.refresh(agent)

    invalidate_model_cache(prefix=f"subagent:{original_name}")
    if agent.name != original_name:
        invalidate_model_cache(prefix=f"subagent:{agent.name}")
    return _subagent_to_response(agent)


@router.delete("/subagents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subagent(
    agent_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """删除 SubAgent（仅 owner 可删除）"""
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "sub_agent", agent_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        agent = await db.get(SubAgent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="SubAgent not found")
        deleted_name = agent.name
        await db.delete(agent)
        await db.commit()

    invalidate_model_cache(prefix=f"subagent:{deleted_name}")


def _subagent_to_response(agent: SubAgent) -> SubAgentResponse:
    config = _json_dict(agent.config)
    source = _resolve_subagent_source(config)
    adk_config = _extract_adk_config(agent)
    raw_kind = adk_config.get("kind") if isinstance(adk_config, dict) else None
    kind = raw_kind if raw_kind in ("root", "subagent") else "subagent"
    return SubAgentResponse(
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
        is_builtin=source == "negentropy_builtin",
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
    if plugin_type not in ["mcp_server", "skill", "sub_agent"]:
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
    if plugin_type not in ["mcp_server", "skill", "sub_agent"]:
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
    if plugin_type not in ["mcp_server", "skill", "sub_agent"]:
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
