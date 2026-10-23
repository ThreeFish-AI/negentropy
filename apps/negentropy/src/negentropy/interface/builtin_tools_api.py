"""
Interface Builtin Tools API — /interface/tools 内置工具 CRUD/连通性测试/排序。

由 api.py 按域机械拆分而来（2026-09 熵减）；行为与路由序保持不变，
契约由 tests/unit_tests/interface/test_route_table_contract.py 锁定。
"""

from __future__ import annotations

import shutil
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError

from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.plugin import (
    BuiltinTool,
    McpTool,
    PluginVisibility,
    ensure_dict,
)

from .permissions import check_plugin_access, check_plugin_ownership, get_visible_plugin_ids
from .tool_resolver import invalidate_tool_cache

# logger 名沿用拆分前的 "negentropy.interface.api"：日志消费方按名过滤，改名另行评审
logger = get_logger("negentropy.interface.api")
router = APIRouter(prefix="/interface", tags=["interface"])


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
    sort_order: int = 0

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
        sort_order=getattr(tool, "sort_order", 0),
    )


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

        stmt = (
            select(BuiltinTool)
            .where(BuiltinTool.id.in_(visible_ids))
            .order_by(
                BuiltinTool.sort_order.asc(),
                BuiltinTool.created_at.desc(),
            )
        )
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


# ── BuiltinTool Reorder ──
# /reorder 字面量路由必须注册在任何同方法 {id} 参数路由之前（防遮蔽，见 MCP 域注释）。


class BuiltinToolReorderItem(BaseModel):
    id: UUID
    sort_order: int


class BuiltinToolReorderRequest(BaseModel):
    items: list[BuiltinToolReorderItem]


@router.patch("/tools/reorder", response_model=list[BuiltinToolResponse])
async def reorder_builtin_tools(
    payload: BuiltinToolReorderRequest,
    user: AuthUser = Depends(get_current_user),
) -> list[BuiltinToolResponse]:
    """批量更新 Tool 排序序号。"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "builtin_tool", user)
        if not visible_ids:
            return []

        visible_set = set(visible_ids)
        for item in payload.items:
            if item.id not in visible_set:
                raise HTTPException(status_code=403, detail=f"No edit permission for tool {item.id}")

        # 批量查询所有目标 tool，避免 N+1
        target_ids = [item.id for item in payload.items]
        result = await db.execute(select(BuiltinTool).where(BuiltinTool.id.in_(target_ids)))
        tool_map = {t.id: t for t in result.scalars().all()}
        for item in payload.items:
            tool = tool_map.get(item.id)
            if tool:
                tool.sort_order = item.sort_order

        await db.commit()

        stmt = (
            select(BuiltinTool)
            .where(BuiltinTool.id.in_(visible_ids))
            .order_by(
                BuiltinTool.sort_order.asc(),
                BuiltinTool.created_at.desc(),
            )
        )
        result = await db.execute(stmt)
        tools = result.scalars().all()
        return [_builtin_tool_to_response(t) for t in tools]


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
