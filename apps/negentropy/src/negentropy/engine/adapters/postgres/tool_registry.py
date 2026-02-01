"""
ToolRegistry: 数据库驱动的动态工具注册表
"""

from __future__ import annotations
import json
import uuid
import time
import asyncio
import inspect
from dataclasses import dataclass
from typing import Any, Callable, Optional

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

import negentropy.db.session as db_session
from negentropy.models.mind import Tool


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
        self._app_name = app_name or "default_app"
        self._function_registry: dict[str, Callable] = {}
        self._frontend_tools: dict[str, FrontendTool] = {}

    async def register_tool(
        self,
        name: str,
        func: Callable,
        *,
        display_name: str | None = None,
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
                    # description is optional
                    openapi_schema=openapi_schema or {},
                    permissions=permissions or {"allowed_users": ["*"]},
                    is_active=True,
                    call_count=0,
                    avg_latency_ms=0.0,
                )
                .on_conflict_do_update(
                    index_elements=["app_name", "name"],
                    set_={
                        "display_name": display_name or name,
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
        )

    async def get_available_tools(self, user_id: str | None = None) -> list[ToolDefinition]:
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
            )
            for r in rows
        ]

    async def invoke_tool(self, name: str, params: dict, *, run_id: str | None = None) -> Any:
        """调用工具并记录统计"""
        func = self._function_registry.get(name)
        if not func:
            raise ValueError(f"Tool '{name}' not found")

        start = time.time()
        # Execute tool
        try:
            if inspect.iscoroutinefunction(func):
                result = await func(**params)
            else:
                result = func(**params)
        except Exception as e:
            # Here we might want to log failure, but ToolRegistry primarily invokes
            raise e

        latency = (time.time() - start) * 1000

        # Update stats
        async with db_session.AsyncSessionLocal() as db:
            # Atomic update:
            # avg_latency = (old_avg * count + new_latency) / (count + 1)
            # count = count + 1
            stmt = (
                update(Tool)
                .where(Tool.app_name == self._app_name, Tool.name == name)
                .values(
                    call_count=Tool.call_count + 1,
                    avg_latency_ms=(Tool.avg_latency_ms * Tool.call_count + latency) / (Tool.call_count + 1),
                )
            )
            await db.execute(stmt)
            await db.commit()

        return result

    async def register_frontend_tool(self, app_name: str, tool: FrontendTool) -> None:
        """注册前端定义工具"""
        self._frontend_tools[f"{app_name}:{tool.name}"] = tool

        # Update DB
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                insert(Tool)
                .values(
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
                        "permissions": insert(Tool).excluded.permissions,
                        "updated_at": insert(Tool).excluded.updated_at,
                    },
                )
            )

            # Simple overwrite approach for permissions in conflict
            stmt = (
                insert(Tool)
                .values(
                    id=uuid.uuid4(),  # Generate new ID if inserting
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
