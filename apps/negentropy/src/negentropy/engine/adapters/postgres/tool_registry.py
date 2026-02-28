"""
ToolRegistry: 数据库驱动的动态工具注册表
"""

from __future__ import annotations

import inspect
import json
import time
import uuid
from dataclasses import dataclass
from typing import Any, Callable

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.models.action import Tool, ToolExecution


@dataclass
class ToolDefinition:
    id: str
    name: str
    display_name: str
    description: str
    openapi_schema: dict
    permissions: dict
    is_active: bool
    call_count: int
    avg_latency_ms: float
    call_count_success: int
    call_count_failed: int
    call_count_denied: int


@dataclass
class FrontendTool:
    """前端工具定义"""

    name: str
    description: str
    parameters: dict  # JSON Schema
    render_component: str  # React Component Name
    requires_confirmation: bool = False  # Human-in-the-Loop


class ToolRegistry:
    def __init__(self, app_name: str | None = None):
        self._app_name = app_name or settings.app_name
        self._function_registry: dict[str, Callable] = {}
        self._frontend_tools: dict[str, FrontendTool] = {}

    async def register_tool(
        self,
        name: str,
        func: Callable,
        *,
        display_name: str | None = None,
        description: str | None = None,
        openapi_schema: dict | None = None,
        permissions: dict | None = None,
    ) -> ToolDefinition:
        """注册工具到数据库 (Upsert)"""
        tool_id = str(uuid.uuid4())

        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                insert(Tool)
                .values(
                    id=uuid.UUID(tool_id),
                    app_name=self._app_name,
                    name=name,
                    display_name=display_name or name,
                    description=description,
                    openapi_schema=openapi_schema or {},
                    permissions=permissions or {"allowed_users": ["*"]},
                    is_active=True,
                    call_count=0,
                    avg_latency_ms=0.0,
                    call_count_success=0,
                    call_count_failed=0,
                    call_count_denied=0,
                )
                .on_conflict_do_update(
                    index_elements=["app_name", "name"],
                    set_={
                        "display_name": display_name or name,
                        "description": description,
                        "openapi_schema": openapi_schema or {},
                        "permissions": permissions or {"allowed_users": ["*"]},
                    },
                )
                .returning(Tool)
            )

            result = await db.execute(stmt)
            tool_orm = result.scalar_one()
            await db.commit()

        self._function_registry[name] = func

        return ToolDefinition(
            id=str(tool_orm.id),
            name=tool_orm.name,
            display_name=tool_orm.display_name or "",
            description=tool_orm.description or "",
            openapi_schema=tool_orm.openapi_schema,
            permissions=tool_orm.permissions,
            is_active=tool_orm.is_active,
            call_count=tool_orm.call_count,
            avg_latency_ms=tool_orm.avg_latency_ms,
            call_count_success=tool_orm.call_count_success,
            call_count_failed=tool_orm.call_count_failed,
            call_count_denied=tool_orm.call_count_denied,
        )

    async def get_available_tools(
        self,
        user_id: str | None = None,
        roles: list[str] | None = None,
    ) -> list[ToolDefinition]:
        """获取可用工具列表"""
        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Tool).where(Tool.app_name == self._app_name, Tool.is_active == True)
            result = await db.execute(stmt)
            rows = result.scalars().all()

        return [
            ToolDefinition(
                id=str(r.id),
                name=r.name,
                display_name=r.display_name or "",
                description=r.description or "",
                openapi_schema=r.openapi_schema,
                permissions=r.permissions,
                is_active=r.is_active,
                call_count=r.call_count,
                avg_latency_ms=r.avg_latency_ms,
                call_count_success=r.call_count_success,
                call_count_failed=r.call_count_failed,
                call_count_denied=r.call_count_denied,
            )
            for r in rows
            if self._is_tool_allowed(r.permissions or {}, user_id, roles)
        ]

    async def invoke_tool(
        self,
        name: str,
        params: dict,
        *,
        run_id: str | None = None,
        user_id: str | None = None,
        roles: list[str] | None = None,
    ) -> Any:
        """调用工具并记录统计"""
        func = self._function_registry.get(name)
        if not func:
            raise ValueError(f"Tool '{name}' not found")

        tool_row = None
        if user_id is not None or roles is not None or run_id is not None:
            async with db_session.AsyncSessionLocal() as db:
                stmt = select(Tool).where(Tool.app_name == self._app_name, Tool.name == name)
                result = await db.execute(stmt)
                tool_row = result.scalar_one_or_none()
            permissions = tool_row.permissions if tool_row and tool_row.permissions else {}
            if user_id is not None or roles is not None:
                if not self._is_tool_allowed(permissions, user_id, roles):
                    await self._record_execution(
                        tool_row,
                        run_id=run_id,
                        input_params=params,
                        status="denied",
                        error="permission_denied",
                        latency_ms=0.0,
                    )
                    await self._update_tool_stats(name=name, status="denied", latency_ms=0.0)
                    raise PermissionError(f"User '{user_id}' is not allowed to invoke tool '{name}'")

        start = time.time()
        error: Exception | None = None
        result: Any = None
        # Execute tool
        try:
            if inspect.iscoroutinefunction(func):
                result = await func(**params)
            else:
                result = func(**params)
        except Exception as exc:
            error = exc

        latency = (time.time() - start) * 1000

        if error is not None:
            await self._record_execution(
                tool_row,
                run_id=run_id,
                input_params=params,
                status="failed",
                error=str(error),
                latency_ms=latency,
            )
            await self._update_tool_stats(name=name, status="failed", latency_ms=latency)
            raise error

        await self._update_tool_stats(name=name, status="success", latency_ms=latency)

        await self._record_execution(
            tool_row,
            run_id=run_id,
            input_params=params,
            output_result=result,
            status="success",
            latency_ms=latency,
        )
        return result

    async def register_frontend_tool(self, app_name: str, tool: FrontendTool) -> None:
        """注册前端定义工具"""
        self._frontend_tools[f"{app_name}:{tool.name}"] = tool

        # Update DB
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                insert(Tool)
                .values(
                    id=uuid.uuid4(),
                    app_name=app_name,
                    name=tool.name,
                    description=tool.description,
                    openapi_schema=tool.parameters,
                    permissions={"requires_confirmation": tool.requires_confirmation},
                    is_active=True,
                )
                .on_conflict_do_update(
                    index_elements=["app_name", "name"],
                    set_={
                        "description": tool.description,
                        "openapi_schema": tool.parameters,
                        "permissions": {"requires_confirmation": tool.requires_confirmation},
                    },
                )
            )

            await db.execute(stmt)
            await db.commit()

    def get_frontend_tools(self, app_name: str) -> list[FrontendTool]:
        """获取应用的前端工具列表"""
        return [tool for key, tool in self._frontend_tools.items() if key.startswith(f"{app_name}:")]

    def _is_tool_allowed(self, permissions: dict, user_id: str | None, roles: list[str] | None) -> bool:
        """基于 permissions 决定是否允许访问工具 (RBAC + 用户白名单)"""
        allowed_users = permissions.get("allowed_users")
        allowed_roles = permissions.get("allowed_roles")
        if not allowed_users and not allowed_roles:
            return True
        if allowed_roles:
            if not isinstance(allowed_roles, list):
                return True
            if "*" in allowed_roles:
                return True
            if roles and any(role in allowed_roles for role in roles):
                return True
            if allowed_users is None:
                return False
        if not allowed_users:
            return True
        if not isinstance(allowed_users, list):
            return True
        if "*" in allowed_users:
            return True
        if user_id is None:
            return False
        return user_id in allowed_users

    async def _record_execution(
        self,
        tool: Tool | None,
        *,
        run_id: str | None,
        input_params: dict | None = None,
        output_result: Any | None = None,
        status: str | None = None,
        error: str | None = None,
        latency_ms: float | None = None,
    ) -> None:
        """记录工具执行审计"""
        if tool is None:
            return
        run_uuid = None
        if run_id:
            try:
                run_uuid = uuid.UUID(run_id)
            except ValueError:
                run_uuid = None
        normalized_result = self._normalize_output_result(output_result)
        execution = ToolExecution(
            tool_id=tool.id,
            run_id=run_uuid,
            input_params=input_params,
            output_result=normalized_result,
            status=status,
            latency_ms=latency_ms,
            error=error,
        )
        async with db_session.AsyncSessionLocal() as db:
            db.add(execution)
            await db.commit()

    async def _update_tool_stats(self, *, name: str, status: str, latency_ms: float) -> None:
        async with db_session.AsyncSessionLocal() as db:
            if status == "denied":
                stmt = (
                    update(Tool)
                    .where(Tool.app_name == self._app_name, Tool.name == name)
                    .values(call_count_denied=Tool.call_count_denied + 1)
                )
            else:
                stmt = (
                    update(Tool)
                    .where(Tool.app_name == self._app_name, Tool.name == name)
                    .values(
                        call_count=Tool.call_count + 1,
                        avg_latency_ms=(Tool.avg_latency_ms * Tool.call_count + latency_ms) / (Tool.call_count + 1),
                        call_count_success=Tool.call_count_success + (1 if status == "success" else 0),
                        call_count_failed=Tool.call_count_failed + (1 if status == "failed" else 0),
                    )
                )
            await db.execute(stmt)
            await db.commit()

    def _normalize_output_result(self, output_result: Any | None) -> dict | None:
        if output_result is None:
            return None
        if isinstance(output_result, dict):
            return output_result
        try:
            serialized = json.loads(json.dumps(output_result, default=str))
        except (TypeError, ValueError):
            return {"value": str(output_result)}
        return {"value": serialized}
