"""
Plugins API 模块。

提供 MCP Server、Skill、SubAgent 的 CRUD 端点。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from negentropy.auth.deps import get_current_user
from negentropy.auth.rbac import has_permission
from negentropy.auth.service import AuthUser
from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.plugin import (
    McpServer,
    McpTool,
    PluginPermission,
    PluginPermissionType,
    PluginVisibility,
    Skill,
    SubAgent,
)

from .permissions import check_plugin_access, check_plugin_ownership, get_visible_plugin_ids
from .subagent_presets import build_negentropy_subagent_payloads

logger = get_logger("negentropy.plugins.api")
router = APIRouter(prefix="/plugins", tags=["plugins"])


def _resolve_app_name(app_name: Optional[str]) -> str:
    return app_name or settings.app_name


# =============================================================================
# Common Response Models
# =============================================================================


class StatsResponse(BaseModel):
    """Dashboard 统计响应"""

    mcp_servers: Dict[str, int]
    skills: Dict[str, int]
    subagents: Dict[str, int]


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
    display_name: Optional[str] = None
    description: Optional[str] = None
    transport_type: str  # stdio, sse, http
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    env: Dict[str, str] = Field(default_factory=dict)
    url: Optional[str] = None
    headers: Dict[str, str] = Field(default_factory=dict)
    is_enabled: bool = True
    auto_start: bool = False
    config: Dict[str, Any] = Field(default_factory=dict)
    visibility: str = "private"


class McpServerUpdateRequest(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    command: Optional[str] = None
    args: Optional[List[str]] = None
    env: Optional[Dict[str, str]] = None
    url: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    is_enabled: Optional[bool] = None
    auto_start: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None
    visibility: Optional[str] = None


class McpServerResponse(BaseModel):
    id: UUID
    owner_id: str
    visibility: str
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    transport_type: str
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    env: Dict[str, str] = Field(default_factory=dict)
    url: Optional[str] = None
    headers: Dict[str, str] = Field(default_factory=dict)
    is_enabled: bool = True
    auto_start: bool = False
    config: Dict[str, Any] = Field(default_factory=dict)
    tool_count: int = 0

    class Config:
        from_attributes = True


# =============================================================================
# MCP Tool Models
# =============================================================================


class McpToolResponse(BaseModel):
    """MCP Tool 响应模型"""

    id: Optional[UUID] = None
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True
    call_count: int = 0

    class Config:
        from_attributes = True


class McpToolUpdateRequest(BaseModel):
    """MCP Tool 更新请求"""

    display_name: Optional[str] = None
    is_enabled: Optional[bool] = None


class LoadToolsResponse(BaseModel):
    """Load Tools 操作响应"""

    success: bool
    server_id: UUID
    tools: List[McpToolResponse] = Field(default_factory=list)
    duration_ms: int = 0
    error: Optional[str] = None


# =============================================================================
# Skill Models
# =============================================================================


class SkillCreateRequest(BaseModel):
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    category: str = "general"
    version: str = "1.0.0"
    prompt_template: Optional[str] = None
    config_schema: Dict[str, Any] = Field(default_factory=dict)
    default_config: Dict[str, Any] = Field(default_factory=dict)
    required_tools: List[str] = Field(default_factory=list)
    is_enabled: bool = True
    priority: int = 0
    visibility: str = "private"


class SkillUpdateRequest(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    version: Optional[str] = None
    prompt_template: Optional[str] = None
    config_schema: Optional[Dict[str, Any]] = None
    default_config: Optional[Dict[str, Any]] = None
    required_tools: Optional[List[str]] = None
    is_enabled: Optional[bool] = None
    priority: Optional[int] = None
    visibility: Optional[str] = None


class SkillResponse(BaseModel):
    id: UUID
    owner_id: str
    visibility: str
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    category: str
    version: str
    prompt_template: Optional[str] = None
    config_schema: Dict[str, Any] = Field(default_factory=dict)
    default_config: Dict[str, Any] = Field(default_factory=dict)
    required_tools: List[str] = Field(default_factory=list)
    is_enabled: bool
    priority: int

    class Config:
        from_attributes = True


# =============================================================================
# SubAgent Models
# =============================================================================


class SubAgentCreateRequest(BaseModel):
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    agent_type: str
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    adk_config: Dict[str, Any] = Field(default_factory=dict)
    skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    is_enabled: bool = True
    visibility: str = "private"


class SubAgentUpdateRequest(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    agent_type: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    adk_config: Optional[Dict[str, Any]] = None
    skills: Optional[List[str]] = None
    tools: Optional[List[str]] = None
    is_enabled: Optional[bool] = None
    visibility: Optional[str] = None
    confirm_builtin_rename: Optional[bool] = False


class SubAgentResponse(BaseModel):
    id: UUID
    owner_id: str
    visibility: str
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    agent_type: str
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    adk_config: Dict[str, Any] = Field(default_factory=dict)
    skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    source: str = "user_defined"
    is_builtin: bool = False
    is_enabled: bool

    class Config:
        from_attributes = True


class NegentropySubAgentTemplateResponse(BaseModel):
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    agent_type: str
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    adk_config: Dict[str, Any] = Field(default_factory=dict)
    tools: List[str] = Field(default_factory=list)


class NegentropySubAgentSyncResponse(BaseModel):
    created: int
    updated: int
    skipped: int
    agents: List[SubAgentResponse] = Field(default_factory=list)


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
            select(func.count()).where(
                and_(McpServer.id.in_(visible_mcp_ids), McpServer.is_enabled == True)
            )
        )
        mcp_enabled = mcp_enabled_result or 0

        # Skills
        visible_skill_ids = await get_visible_plugin_ids(db, "skill", user)
        skill_total = len(visible_skill_ids)
        skill_enabled_result = await db.scalar(
            select(func.count()).where(and_(Skill.id.in_(visible_skill_ids), Skill.is_enabled == True))
        )
        skill_enabled = skill_enabled_result or 0

        # SubAgents
        visible_subagent_ids = await get_visible_plugin_ids(db, "sub_agent", user)
        subagent_total = len(visible_subagent_ids)
        subagent_enabled_result = await db.scalar(
            select(func.count()).where(and_(SubAgent.id.in_(visible_subagent_ids), SubAgent.is_enabled == True))
        )
        subagent_enabled = subagent_enabled_result or 0

    return StatsResponse(
        mcp_servers={"total": mcp_total, "enabled": mcp_enabled},
        skills={"total": skill_total, "enabled": skill_enabled},
        subagents={"total": subagent_total, "enabled": subagent_enabled},
    )


# =============================================================================
# MCP Server Endpoints
# =============================================================================


@router.get("/mcp/servers", response_model=List[McpServerResponse])
async def list_mcp_servers(user: AuthUser = Depends(get_current_user)) -> List[McpServerResponse]:
    """列出用户可见的 MCP 服务器"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "mcp_server", user)
        if not visible_ids:
            return []

        stmt = (
            select(McpServer, func.count(McpTool.id))
            .outerjoin(McpTool, McpTool.server_id == McpServer.id)
            .where(McpServer.id.in_(visible_ids))
            .group_by(McpServer.id)
            .order_by(McpServer.created_at.desc())
        )
        result = await db.execute(stmt)
        rows = result.all()

    return [_mcp_server_to_response(server, count) for server, count in rows]


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

        stmt = (
            select(McpServer, func.count(McpTool.id))
            .outerjoin(McpTool, McpTool.server_id == McpServer.id)
            .where(McpServer.id == server_id)
            .group_by(McpServer.id)
        )
        result = await db.execute(stmt)
        row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Server not found")

    server, count = row
    return _mcp_server_to_response(server, count)


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
                    select(McpServer).where(
                        and_(McpServer.name == new_name, McpServer.id != server_id)
                    )
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


def _mcp_server_to_response(server: McpServer, tool_count: int) -> McpServerResponse:
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
    )


def _mcp_tool_to_response(tool: McpTool) -> McpToolResponse:
    """将 McpTool 模型转换为响应模型"""
    return McpToolResponse(
        id=tool.id,
        name=tool.name,
        display_name=tool.display_name,
        description=tool.description,
        input_schema=tool.input_schema or {},
        is_enabled=tool.is_enabled,
        call_count=tool.call_count or 0,
    )


# =============================================================================
# MCP Tool Endpoints
# =============================================================================


@router.post("/mcp/servers/{server_id}/tools:load", response_model=LoadToolsResponse)
async def load_mcp_server_tools(
    server_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> LoadToolsResponse:
    """
    连接 MCP Server 并加载其 Tools 列表。

    此操作会：
    1. 连接到 MCP Server
    2. 获取所有 Tools
    3. 同步到数据库（新增/更新）
    4. 返回 Tools 列表
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
                duration_ms=result.duration_ms,
                error=result.error,
            )

        # 4. 同步 Tools 到数据库
        existing_tools_result = await db.execute(select(McpTool).where(McpTool.server_id == server_id))
        existing_tools = existing_tools_result.scalars().all()
        existing_map = {t.name: t for t in existing_tools}

        updated_tools: List[McpTool] = []
        for tool_info in result.tools:
            if tool_info.name in existing_map:
                # 更新现有 Tool
                existing = existing_map[tool_info.name]
                existing.description = tool_info.description
                existing.input_schema = tool_info.input_schema
                updated_tools.append(existing)
            else:
                # 新增 Tool
                new_tool = McpTool(
                    server_id=server_id,
                    name=tool_info.name,
                    description=tool_info.description,
                    input_schema=tool_info.input_schema,
                    is_enabled=True,
                )
                db.add(new_tool)
                updated_tools.append(new_tool)

        await db.commit()

        # 5. 刷新以获取 ID
        for tool in updated_tools:
            await db.refresh(tool)

        logger.info(f"Loaded {len(updated_tools)} tools from MCP server {server.name}")

        return LoadToolsResponse(
            success=True,
            server_id=server_id,
            tools=[_mcp_tool_to_response(t) for t in updated_tools],
            duration_ms=result.duration_ms,
        )


@router.get("/mcp/servers/{server_id}/tools", response_model=List[McpToolResponse])
async def list_mcp_server_tools(
    server_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> List[McpToolResponse]:
    """列出指定 MCP Server 的所有 Tools"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "mcp_server", server_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        result = await db.execute(
            select(McpTool).where(McpTool.server_id == server_id).order_by(McpTool.name)
        )
        tools = result.scalars().all()

        return [_mcp_tool_to_response(t) for t in tools]


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


# =============================================================================
# Skills Endpoints
# =============================================================================


@router.get("/skills", response_model=List[SkillResponse])
async def list_skills(
    category: Optional[str] = Query(default=None),
    user: AuthUser = Depends(get_current_user),
) -> List[SkillResponse]:
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
                existing = await db.scalar(
                    select(Skill).where(and_(Skill.name == new_name, Skill.id != skill_id))
                )
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


def _json_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _build_adk_config_from_payload(
    payload: Dict[str, Any],
    existing_adk_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """构建 SubAgent 的 ADK 配置（可回放）。"""
    adk_config: Dict[str, Any] = dict(existing_adk_config or {})
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
    current_config: Optional[Dict[str, Any]],
    update_config: Optional[Dict[str, Any]],
    adk_config: Dict[str, Any],
    source: str,
) -> Dict[str, Any]:
    merged = dict(current_config or {})
    if isinstance(update_config, dict):
        merged.update(update_config)
    merged["adk_config"] = adk_config
    merged["source"] = source
    return merged


def _materialize_subagent_payload(
    agent: Optional[SubAgent],
    incoming: Dict[str, Any],
) -> Dict[str, Any]:
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


def _resolve_subagent_source(config: Dict[str, Any]) -> str:
    source = config.get("source")
    if isinstance(source, str) and source:
        return source
    return "user_defined"


def _extract_adk_config(agent: SubAgent) -> Dict[str, Any]:
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


@router.get("/subagents", response_model=List[SubAgentResponse])
async def list_subagents(user: AuthUser = Depends(get_current_user)) -> List[SubAgentResponse]:
    """列出用户可见的 SubAgents"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "sub_agent", user)
        if not visible_ids:
            return []

        stmt = select(SubAgent).where(SubAgent.id.in_(visible_ids)).order_by(SubAgent.created_at.desc())
        result = await db.execute(stmt)
        agents = result.scalars().all()

    return [_subagent_to_response(a) for a in agents]


@router.get("/subagents/templates/negentropy", response_model=List[NegentropySubAgentTemplateResponse])
async def list_negentropy_subagent_templates(
    user: AuthUser = Depends(get_current_user),
) -> List[NegentropySubAgentTemplateResponse]:
    """返回 Negentropy 内置 5 个 Faculty SubAgent 模板（来自代码定义）。"""
    _ = user  # 显式依赖鉴权
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
    将代码中的 5 个 Faculty SubAgent 同步到插件表。

    幂等语义：
    - 已存在且归属当前用户：更新为最新代码定义；
    - 已存在但归属其他用户：跳过；
    - 不存在：创建。
    """
    payloads = build_negentropy_subagent_payloads()
    created_count = 0
    updated_count = 0
    skipped_count = 0
    touched_agents: List[SubAgent] = []

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
        await db.delete(agent)
        await db.commit()


def _subagent_to_response(agent: SubAgent) -> SubAgentResponse:
    config = _json_dict(agent.config)
    source = _resolve_subagent_source(config)
    adk_config = _extract_adk_config(agent)
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
    )


# =============================================================================
# Permission Management Endpoints
# =============================================================================


@router.get("/{plugin_type}/{plugin_id}/permissions", response_model=List[PermissionResponse])
async def list_permissions(
    plugin_type: str,
    plugin_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> List[PermissionResponse]:
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

    return [
        PermissionResponse(id=p.id, user_id=p.user_id, permission=p.permission.value) for p in permissions
    ]


@router.post("/{plugin_type}/{plugin_id}/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
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
