"""
ToolRegistry: 数据库驱动的动态工具注册表
"""

from __future__ import annotations
import json, uuid
from dataclasses import dataclass
from typing import Any, Callable
import asyncpg


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
    """前端定义工具"""

    name: str
    description: str
    parameters: dict  # JSON Schema
    render_component: str  # React 组件名称
    requires_confirmation: bool = False  # Human-in-the-Loop


class ToolRegistry:
    def __init__(self, pool: asyncpg.Pool, app_name: str | None = None):
        self._pool = pool
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
        """注册工具到数据库"""
        tool_id = str(uuid.uuid4())
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO tools (id, app_name, name, display_name, openapi_schema, permissions)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (app_name, name) DO UPDATE SET
                    display_name = $4, openapi_schema = $5, permissions = $6
                """,
                uuid.UUID(tool_id),
                self._app_name,
                name,
                display_name or name,
                json.dumps(openapi_schema or {}),
                json.dumps(permissions or {"allowed_users": ["*"]}),
            )
        self._function_registry[name] = func
        return ToolDefinition(
            id=tool_id,
            name=name,
            display_name=display_name or name,
            description="",
            openapi_schema=openapi_schema or {},
            permissions=permissions or {},
            is_active=True,
            call_count=0,
            avg_latency_ms=0,
        )

    async def get_available_tools(self, user_id: str | None = None) -> list[ToolDefinition]:
        """获取可用工具列表"""
        async with self._pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM tools WHERE app_name = $1 AND is_active = true", self._app_name)
        return [
            ToolDefinition(
                id=str(r["id"]),
                name=r["name"],
                display_name=r["display_name"],
                description=r["description"] or "",
                openapi_schema=json.loads(r["openapi_schema"]),
                permissions=json.loads(r["permissions"]),
                is_active=r["is_active"],
                call_count=r["call_count"],
                avg_latency_ms=r["avg_latency_ms"],
            )
            for r in rows
        ]

    async def invoke_tool(self, name: str, params: dict, *, run_id: str | None = None) -> Any:
        """调用工具并记录统计"""
        import time, asyncio

        func = self._function_registry.get(name)
        if not func:
            raise ValueError(f"Tool '{name}' not found")
        start = time.time()
        result = await func(**params) if asyncio.iscoroutinefunction(func) else func(**params)
        latency = (time.time() - start) * 1000
        # 更新统计
        async with self._pool.acquire() as conn:
            await conn.execute(
                "UPDATE tools SET call_count = call_count + 1, "
                "avg_latency_ms = (avg_latency_ms * call_count + $1) / (call_count + 1) "
                "WHERE app_name = $2 AND name = $3",
                latency,
                self._app_name,
                name,
            )
        return result

    async def register_frontend_tool(self, app_name: str, tool: FrontendTool) -> None:
        """注册前端定义工具"""
        self._frontend_tools[f"{app_name}:{tool.name}"] = tool

        # 同时持久化到数据库
        await self._pool.execute(
            """
            INSERT INTO tools (app_name, name, description, openapi_schema, permissions)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (app_name, name) DO UPDATE
            SET description = EXCLUDED.description,
                openapi_schema = EXCLUDED.openapi_schema,
                updated_at = NOW()
        """,
            app_name,
            tool.name,
            tool.description,
            json.dumps(tool.parameters),
            json.dumps({"requires_confirmation": tool.requires_confirmation}),
        )

    def get_frontend_tools(self, app_name: str) -> list[FrontendTool]:
        """获取应用的前端工具列表"""
        return [tool for key, tool in self._frontend_tools.items() if key.startswith(f"{app_name}:")]
