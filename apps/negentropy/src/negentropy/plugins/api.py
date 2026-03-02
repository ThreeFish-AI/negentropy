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
    transport_type: str  # stdio, sse, websocket
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    env: Dict[str, str] = Field(default_factory=dict)
    url: Optional[str] = None
    is_enabled: bool = True
    auto_start: bool = False
    config: Dict[str, Any] = Field(default_factory=dict)
    visibility: str = "private"


class McpServerUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    command: Optional[str] = None
    args: Optional[List[str]] = None
    env: Optional[Dict[str, str]] = None
    url: Optional[str] = None
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
    is_enabled: bool = True
    auto_start: bool = False
    config: Dict[str, Any] = Field(default_factory=dict)
    tool_count: int = 0

    class Config:
        from_attributes = True


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
    skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    is_enabled: bool = True
    visibility: str = "private"


class SubAgentUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    agent_type: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    skills: Optional[List[str]] = None
    tools: Optional[List[str]] = None
    is_enabled: Optional[bool] = None
    visibility: Optional[str] = None


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
    skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    is_enabled: bool

    class Config:
        from_attributes = True


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
        is_enabled=server.is_enabled,
        auto_start=server.auto_start,
        config=server.config or {},
        tool_count=tool_count or 0,
    )


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

        agent = SubAgent(
            owner_id=user.user_id,
            visibility=PluginVisibility(payload.visibility),
            name=payload.name,
            display_name=payload.display_name,
            description=payload.description,
            agent_type=payload.agent_type,
            system_prompt=payload.system_prompt,
            model=payload.model,
            config=payload.config,
            skills=payload.skills,
            tools=payload.tools,
            is_enabled=payload.is_enabled,
        )
        db.add(agent)
        await db.commit()
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

        update_data = payload.model_dump(exclude_unset=True)
        if "visibility" in update_data:
            update_data["visibility"] = PluginVisibility(update_data["visibility"])

        for key, value in update_data.items():
            setattr(agent, key, value)

        await db.commit()
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
        config=agent.config or {},
        skills=agent.skills or [],
        tools=agent.tools or [],
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
