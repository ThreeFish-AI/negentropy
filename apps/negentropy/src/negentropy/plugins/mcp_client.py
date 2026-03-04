"""
MCP Client Service Module.

提供 MCP Server 连接与 Tool 发现功能。
支持 stdio、sse、http (Streamable HTTP) 三种传输类型。
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp.client.streamable_http import streamablehttp_client

from negentropy.logging import get_logger

logger = get_logger("negentropy.plugins.mcp_client")

# 连接超时时间（秒）
DEFAULT_TIMEOUT_SECONDS = 30


@dataclass
class McpToolInfo:
    """MCP Tool 元信息"""

    name: str
    description: str | None = None
    input_schema: dict[str, Any] = field(default_factory=dict)


@dataclass
class McpConnectionResult:
    """MCP Server 连接结果"""

    success: bool
    tools: list[McpToolInfo] = field(default_factory=list)
    error: str | None = None
    duration_ms: int = 0


class McpClientService:
    """MCP Server 连接与 Tool 发现服务"""

    def __init__(self, timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS):
        self.timeout_seconds = timeout_seconds

    async def discover_tools(
        self,
        transport_type: str,
        command: str | None = None,
        args: list[str] | None = None,
        env: dict[str, str] | None = None,
        url: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> McpConnectionResult:
        """
        连接 MCP Server 并获取 Tools 列表。

        Args:
            transport_type: 传输类型 (stdio, sse, http)
            command: STDIO 模式的命令
            args: STDIO 模式的命令参数
            env: STDIO 模式的环境变量
            url: SSE/HTTP 模式的 URL
            headers: SSE/HTTP 模式的请求头

        Returns:
            McpConnectionResult: 包含连接结果和 Tools 列表
        """
        start_time = time.time()

        try:
            if transport_type == "stdio":
                if not command:
                    return McpConnectionResult(
                        success=False,
                        error="Command is required for stdio transport",
                        duration_ms=0,
                    )
                result = await self._discover_stdio(
                    command=command,
                    args=args or [],
                    env=env or {},
                )
            elif transport_type == "sse":
                if not url:
                    return McpConnectionResult(
                        success=False,
                        error="URL is required for sse transport",
                        duration_ms=0,
                    )
                result = await self._discover_sse(url=url, headers=headers or {})
            elif transport_type == "http":
                if not url:
                    return McpConnectionResult(
                        success=False,
                        error="URL is required for http transport",
                        duration_ms=0,
                    )
                result = await self._discover_http(url=url, headers=headers or {})
            else:
                return McpConnectionResult(
                    success=False,
                    error=f"Unsupported transport type: {transport_type}",
                    duration_ms=0,
                )

            result.duration_ms = int((time.time() - start_time) * 1000)
            return result

        except TimeoutError:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"Connection timeout after {self.timeout_seconds}s"
            logger.warning(f"MCP connection timeout: {error_msg}")
            return McpConnectionResult(
                success=False,
                error=error_msg,
                duration_ms=duration_ms,
            )
        except FileNotFoundError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"Command not found: {e.filename}"
            logger.warning(f"MCP command not found: {error_msg}")
            return McpConnectionResult(
                success=False,
                error=error_msg,
                duration_ms=duration_ms,
            )
        except ExceptionGroup as e:
            # anyio TaskGroup 抛出的异常组 - 提取子异常的真实错误消息
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = self._extract_exception_group_error(e)
            logger.error(f"MCP 连接异常组: {error_msg}", exc_info=True)
            return McpConnectionResult(
                success=False,
                error=error_msg,
                duration_ms=duration_ms,
            )
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = self._extract_error_message(e)
            logger.error(f"MCP connection failed: {error_msg}", exc_info=True)
            return McpConnectionResult(
                success=False,
                error=error_msg,
                duration_ms=duration_ms,
            )

    def _extract_exception_group_error(self, exc_group: ExceptionGroup) -> str:
        """从 ExceptionGroup 中提取友好的错误消息"""
        if not exc_group.exceptions:
            return str(exc_group)

        sub_exc = exc_group.exceptions[0]
        return self._extract_error_message(sub_exc)

    def _extract_error_message(self, exc: Exception) -> str:
        """从异常中提取友好的错误消息"""
        # HTTP 连接失败
        if isinstance(exc, httpx.ConnectError):
            return "无法连接到服务器，请检查 URL 是否正确以及服务是否已启动"
        # HTTP 超时
        if isinstance(exc, httpx.TimeoutException):
            return "连接超时，服务器响应时间过长"
        # HTTP 网络错误 (包含 ConnectError, ReadError, WriteError 等)
        if isinstance(exc, httpx.NetworkError):
            return f"网络连接失败: {exc}"
        # 嵌套的 ExceptionGroup
        if isinstance(exc, ExceptionGroup):
            return self._extract_exception_group_error(exc)
        # 其他异常
        return str(exc)

    async def _discover_stdio(
        self,
        command: str,
        args: list[str],
        env: dict[str, str],
    ) -> McpConnectionResult:
        """STDIO 传输类型的 Tool 发现"""
        server_params = StdioServerParameters(
            command=command,
            args=args,
            env=env,
        )

        async with asyncio.timeout(self.timeout_seconds):
            async with stdio_client(server_params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    tools_result = await session.list_tools()

                    tools = [
                        McpToolInfo(
                            name=t.name,
                            description=t.description,
                            input_schema=t.inputSchema or {},
                        )
                        for t in tools_result.tools
                    ]

                    logger.info(f"Discovered {len(tools)} tools via stdio from {command}")
                    return McpConnectionResult(success=True, tools=tools)

    async def _discover_sse(
        self,
        url: str,
        headers: dict[str, str],
    ) -> McpConnectionResult:
        """SSE 传输类型的 Tool 发现"""
        async with asyncio.timeout(self.timeout_seconds):
            async with sse_client(url, headers=headers) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    tools_result = await session.list_tools()

                    tools = [
                        McpToolInfo(
                            name=t.name,
                            description=t.description,
                            input_schema=t.inputSchema or {},
                        )
                        for t in tools_result.tools
                    ]

                    logger.info(f"Discovered {len(tools)} tools via sse from {url}")
                    return McpConnectionResult(success=True, tools=tools)

    async def _discover_http(
        self,
        url: str,
        headers: dict[str, str],
    ) -> McpConnectionResult:
        """HTTP (Streamable HTTP) 传输类型的 Tool 发现"""
        async with asyncio.timeout(self.timeout_seconds):
            async with streamablehttp_client(url, headers=headers) as (read, write, _session_id):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    tools_result = await session.list_tools()

                    tools = [
                        McpToolInfo(
                            name=t.name,
                            description=t.description,
                            input_schema=t.inputSchema or {},
                        )
                        for t in tools_result.tools
                    ]

                    logger.info(f"Discovered {len(tools)} tools via http from {url}")
                    return McpConnectionResult(success=True, tools=tools)
