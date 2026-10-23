"""
Interface MCP API — /interface/mcp/* MCP Server/工具/试运行管理。

由 api.py 按域机械拆分而来（2026-09 熵减）；行为与路由序保持不变，
契约由 tests/unit_tests/interface/test_route_table_contract.py 锁定。
"""

from __future__ import annotations

import json
import time as _mcp_time
from asyncio import Lock as _AsyncLock
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func, select

from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.plugin import (
    McpResourceTemplate,
    McpServer,
    McpTool,
    McpToolRun,
    McpToolRunEvent,
    McpTrialAsset,
    PluginVisibility,
)

from .execution import McpToolExecutionService
from .permissions import check_plugin_access, check_plugin_ownership, get_visible_plugin_ids

# logger 名沿用拆分前的 "negentropy.interface.api"：日志消费方按名过滤，改名另行评审
logger = get_logger("negentropy.interface.api")
router = APIRouter(prefix="/interface", tags=["interface"])


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
    sort_order: int = 0

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
    content_uri: str
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

            servers_stmt = (
                select(McpServer)
                .where(McpServer.id.in_(visible_ids))
                .order_by(
                    McpServer.sort_order.asc(),
                    McpServer.created_at.desc(),
                )
            )
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


# ── MCP Server Reorder ──
# 注意：/reorder 等字面量路由必须注册在任何同方法 {id} 参数路由之前，
# 否则 Starlette 首序匹配会把 "reorder" 当 {server_id} 解析（历史 422 缺陷）。


class McpServerReorderItem(BaseModel):
    id: UUID
    sort_order: int


class McpServerReorderRequest(BaseModel):
    items: list[McpServerReorderItem]


@router.patch("/mcp/servers/reorder", response_model=list[McpServerResponse])
async def reorder_mcp_servers(
    payload: McpServerReorderRequest,
    user: AuthUser = Depends(get_current_user),
) -> list[McpServerResponse]:
    """批量更新 MCP Server 排序序号。"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "mcp_server", user)
        if not visible_ids:
            return []

        visible_set = set(visible_ids)
        for item in payload.items:
            if item.id not in visible_set:
                raise HTTPException(status_code=403, detail=f"No edit permission for MCP server {item.id}")

        # 批量查询所有目标 server，避免 N+1
        target_ids = [item.id for item in payload.items]
        result = await db.execute(select(McpServer).where(McpServer.id.in_(target_ids)))
        server_map = {s.id: s for s in result.scalars().all()}
        for item in payload.items:
            server = server_map.get(item.id)
            if server:
                server.sort_order = item.sort_order

        await db.commit()

        stmt = (
            select(McpServer)
            .where(McpServer.id.in_(visible_ids))
            .order_by(McpServer.sort_order.asc(), McpServer.created_at.desc())
        )
        result = await db.execute(stmt)
        servers = result.scalars().all()

        # 计算每个 server 的 tool_count 和 resource_template_count
        resp_list: list[McpServerResponse] = []
        for s in servers:
            tc = await _get_tool_count(db, s.id)
            rtc = await _get_resource_template_count(db, s.id)
            resp_list.append(_mcp_server_to_response(s, tc, rtc))
        return resp_list


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


async def _get_tool_count(db, server_id: UUID) -> int:
    from sqlalchemy import func as sa_func

    cnt = await db.scalar(select(sa_func.count()).select_from(McpTool).where(McpTool.server_id == server_id))
    return cnt or 0


async def _get_resource_template_count(db, server_id: UUID) -> int:
    from sqlalchemy import func as sa_func

    cnt = await db.scalar(
        select(sa_func.count()).select_from(McpResourceTemplate).where(McpResourceTemplate.server_id == server_id)
    )
    return cnt or 0


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
        sort_order=getattr(server, "sort_order", 0),
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
        content_uri=asset.content_uri,
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
