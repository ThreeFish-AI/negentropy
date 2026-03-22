"""
MCP Client Service Module.

提供 MCP Server 连接与 Tool 发现功能。
支持 stdio、sse、http (Streamable HTTP) 三种传输类型。
"""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Callable

import anyio
import httpx
from mcp import ClientSession
from mcp.client import stdio as mcp_stdio
from mcp.client.sse import sse_client
from mcp.client.stdio import StdioServerParameters
from mcp.client.streamable_http import streamablehttp_client

from negentropy.logging import get_logger
from negentropy.logging.io import ExternalProcessLogStream, derive_external_process_source

logger = get_logger("negentropy.plugins.mcp_client")
stderr_logger = get_logger("stderr")

# 连接超时时间（秒）
DEFAULT_TIMEOUT_SECONDS = 30


@asynccontextmanager
async def logged_stdio_client(
    server: StdioServerParameters,
    errlog: ExternalProcessLogStream,
    stderr_callback: Callable[[str], None] | None = None,
):
    """
    Spawn stdio MCP servers with stderr piped, then forward stderr lines
    into the project's unified logging pipeline.
    """
    read_stream_writer, read_stream = anyio.create_memory_object_stream(0)
    write_stream, write_stream_reader = anyio.create_memory_object_stream(0)

    try:
        command = mcp_stdio._get_executable_command(server.command)
        process = await anyio.open_process(
            [command, *server.args],
            env=(
                {**mcp_stdio.get_default_environment(), **server.env}
                if server.env is not None
                else mcp_stdio.get_default_environment()
            ),
            stderr=-1,
            cwd=server.cwd,
            start_new_session=True,
        )
    except OSError:
        await read_stream.aclose()
        await write_stream.aclose()
        await read_stream_writer.aclose()
        await write_stream_reader.aclose()
        raise

    async def stdout_reader() -> None:
        assert process.stdout, "Opened process is missing stdout"

        try:
            async with read_stream_writer:
                buffer = ""
                async for chunk in mcp_stdio.TextReceiveStream(
                    process.stdout,
                    encoding=server.encoding,
                    errors=server.encoding_error_handler,
                ):
                    lines = (buffer + chunk).split("\n")
                    buffer = lines.pop()

                    for line in lines:
                        try:
                            message = mcp_stdio.types.JSONRPCMessage.model_validate_json(line)
                        except Exception as exc:  # pragma: no cover
                            logger.exception("Failed to parse JSONRPC message from server")
                            await read_stream_writer.send(exc)
                            continue

                        await read_stream_writer.send(mcp_stdio.SessionMessage(message))
        except anyio.ClosedResourceError:  # pragma: no cover
            await anyio.lowlevel.checkpoint()

    async def stderr_reader() -> None:
        assert process.stderr, "Opened process is missing stderr"

        try:
            async for chunk in mcp_stdio.TextReceiveStream(
                process.stderr,
                encoding=server.encoding,
                errors=server.encoding_error_handler,
            ):
                errlog.write(chunk)
                if stderr_callback:
                    stderr_callback(chunk)
        except anyio.ClosedResourceError:  # pragma: no cover
            await anyio.lowlevel.checkpoint()
        finally:
            errlog.flush()

    async def stdin_writer() -> None:
        assert process.stdin, "Opened process is missing stdin"

        try:
            async with write_stream_reader:
                async for session_message in write_stream_reader:
                    payload = session_message.message.model_dump_json(by_alias=True, exclude_none=True)
                    await process.stdin.send(
                        (payload + "\n").encode(
                            encoding=server.encoding,
                            errors=server.encoding_error_handler,
                        )
                    )
        except anyio.ClosedResourceError:  # pragma: no cover
            await anyio.lowlevel.checkpoint()

    async with (
        anyio.create_task_group() as tg,
        process,
    ):
        tg.start_soon(stdout_reader)
        tg.start_soon(stderr_reader)
        tg.start_soon(stdin_writer)
        try:
            yield read_stream, write_stream
        finally:
            if process.stdin:  # pragma: no branch
                try:
                    await process.stdin.aclose()
                except Exception:  # pragma: no cover
                    pass

            try:
                with anyio.fail_after(mcp_stdio.PROCESS_TERMINATION_TIMEOUT):
                    await process.wait()
            except TimeoutError:
                await mcp_stdio._terminate_process_tree(process)
            except ProcessLookupError:  # pragma: no cover
                pass
            await read_stream.aclose()
            await write_stream.aclose()
            await read_stream_writer.aclose()
            await write_stream_reader.aclose()


@dataclass
class McpToolInfo:
    """MCP Tool 元信息"""

    name: str
    title: str | None = None
    description: str | None = None
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    icons: list[dict[str, Any]] = field(default_factory=list)
    annotations: dict[str, Any] = field(default_factory=dict)
    execution: dict[str, Any] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class McpConnectionResult:
    """MCP Server 连接结果"""

    success: bool
    tools: list[McpToolInfo] = field(default_factory=list)
    error: str | None = None
    duration_ms: int = 0


@dataclass
class McpToolCallResult:
    """MCP Tool 调用结果"""

    success: bool
    content: list[Any] = field(default_factory=list)
    structured_content: Any | None = None
    error: str | None = None
    duration_ms: int = 0


class McpClientService:
    """MCP Server 连接与 Tool 发现服务"""

    def __init__(self, timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS):
        self.timeout_seconds = timeout_seconds

    async def call_tool(
        self,
        *,
        transport_type: str,
        tool_name: str,
        arguments: dict[str, Any] | None = None,
        command: str | None = None,
        args: list[str] | None = None,
        env: dict[str, str] | None = None,
        url: str | None = None,
        headers: dict[str, str] | None = None,
        timeout_seconds: float | None = None,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
        stderr_callback: Callable[[str], None] | None = None,
    ) -> McpToolCallResult:
        start_time = time.time()
        effective_timeout = timeout_seconds or self.timeout_seconds

        try:
            if transport_type == "stdio":
                if not command:
                    return McpToolCallResult(success=False, error="Command is required for stdio transport")
                result = await self._call_tool_stdio(
                    command=command,
                    args=args or [],
                    env=env or {},
                    tool_name=tool_name,
                    arguments=arguments or {},
                    timeout_seconds=effective_timeout,
                    event_callback=event_callback,
                    stderr_callback=stderr_callback,
                )
            elif transport_type == "sse":
                if not url:
                    return McpToolCallResult(success=False, error="URL is required for sse transport")
                result = await self._call_tool_sse(
                    url=url,
                    headers=headers or {},
                    tool_name=tool_name,
                    arguments=arguments or {},
                    timeout_seconds=effective_timeout,
                    event_callback=event_callback,
                )
            elif transport_type == "http":
                if not url:
                    return McpToolCallResult(success=False, error="URL is required for http transport")
                result = await self._call_tool_http(
                    url=url,
                    headers=headers or {},
                    tool_name=tool_name,
                    arguments=arguments or {},
                    timeout_seconds=effective_timeout,
                    event_callback=event_callback,
                )
            else:
                return McpToolCallResult(success=False, error=f"Unsupported transport type: {transport_type}")

            result.duration_ms = int((time.time() - start_time) * 1000)
            return result
        except TimeoutError:
            return McpToolCallResult(
                success=False,
                error=f"Connection timeout after {effective_timeout}s",
                duration_ms=int((time.time() - start_time) * 1000),
            )
        except FileNotFoundError as exc:
            return McpToolCallResult(
                success=False,
                error=f"Command not found: {exc.filename}",
                duration_ms=int((time.time() - start_time) * 1000),
            )
        except ExceptionGroup as exc:
            return McpToolCallResult(
                success=False,
                error=self._extract_exception_group_error(exc),
                duration_ms=int((time.time() - start_time) * 1000),
            )
        except Exception as exc:
            return McpToolCallResult(
                success=False,
                error=self._extract_error_message(exc),
                duration_ms=int((time.time() - start_time) * 1000),
            )

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
            async with logged_stdio_client(server_params, errlog=self._build_stdio_errlog(command, args)) as (
                read,
                write,
            ):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    tools_result = await session.list_tools()

                    tools = [
                        McpToolInfo(
                            name=t.name,
                            title=t.title,
                            description=t.description,
                            input_schema=t.inputSchema or {},
                            output_schema=t.outputSchema or {},
                            icons=[icon.model_dump(mode="json") for icon in (t.icons or [])],
                            annotations=t.annotations.model_dump(mode="json") if t.annotations else {},
                            execution=t.execution.model_dump(mode="json") if t.execution else {},
                            meta=t.meta or {},
                        )
                        for t in tools_result.tools
                    ]

                    logger.info(f"Discovered {len(tools)} tools via stdio from {command}")
                    return McpConnectionResult(success=True, tools=tools)

    async def _call_tool_stdio(
        self,
        *,
        command: str,
        args: list[str],
        env: dict[str, str],
        tool_name: str,
        arguments: dict[str, Any],
        timeout_seconds: float,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
        stderr_callback: Callable[[str], None] | None = None,
    ) -> McpToolCallResult:
        server_params = StdioServerParameters(command=command, args=args, env=env)
        async with asyncio.timeout(timeout_seconds):
            _emit_event(
                event_callback,
                stage="transport_connect",
                status="running",
                title="建立 STDIO 连接",
                payload={"command": command, "args": args},
            )
            async with logged_stdio_client(
                server_params,
                errlog=self._build_stdio_errlog(command, args),
                stderr_callback=stderr_callback,
            ) as (
                read,
                write,
            ):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    _emit_event(
                        event_callback,
                        stage="session_initialized",
                        status="completed",
                        title="MCP Session 已初始化",
                    )
                    result = await session.call_tool(
                        tool_name,
                        arguments=arguments,
                        read_timeout_seconds=timedelta(seconds=timeout_seconds),
                    )
                    _emit_event(
                        event_callback,
                        stage="tool_result",
                        status="completed" if not bool(result.isError) else "failed",
                        title="MCP Tool 返回结果",
                        payload={"tool_name": tool_name},
                    )
                    return McpToolCallResult(
                        success=not bool(result.isError),
                        content=list(result.content or []),
                        structured_content=getattr(result, "structuredContent", None),
                        error=_extract_call_error(result),
                    )

    @staticmethod
    def _build_stdio_errlog(command: str, args: list[str]) -> ExternalProcessLogStream:
        return ExternalProcessLogStream(
            stderr_logger,
            source=derive_external_process_source(command, args),
        )

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
                            title=t.title,
                            description=t.description,
                            input_schema=t.inputSchema or {},
                            output_schema=t.outputSchema or {},
                            icons=[icon.model_dump(mode="json") for icon in (t.icons or [])],
                            annotations=t.annotations.model_dump(mode="json") if t.annotations else {},
                            execution=t.execution.model_dump(mode="json") if t.execution else {},
                            meta=t.meta or {},
                        )
                        for t in tools_result.tools
                    ]

                    logger.info(f"Discovered {len(tools)} tools via sse from {url}")
                    return McpConnectionResult(success=True, tools=tools)

    async def _call_tool_sse(
        self,
        *,
        url: str,
        headers: dict[str, str],
        tool_name: str,
        arguments: dict[str, Any],
        timeout_seconds: float,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> McpToolCallResult:
        async with asyncio.timeout(timeout_seconds):
            _emit_event(
                event_callback,
                stage="transport_connect",
                status="running",
                title="建立 SSE 连接",
                payload={"url": url},
            )
            async with sse_client(url, headers=headers) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    _emit_event(
                        event_callback,
                        stage="session_initialized",
                        status="completed",
                        title="MCP Session 已初始化",
                    )
                    result = await session.call_tool(
                        tool_name,
                        arguments=arguments,
                        read_timeout_seconds=timedelta(seconds=timeout_seconds),
                    )
                    _emit_event(
                        event_callback,
                        stage="tool_result",
                        status="completed" if not bool(result.isError) else "failed",
                        title="MCP Tool 返回结果",
                        payload={"tool_name": tool_name},
                    )
                    return McpToolCallResult(
                        success=not bool(result.isError),
                        content=list(result.content or []),
                        structured_content=getattr(result, "structuredContent", None),
                        error=_extract_call_error(result),
                    )

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
                            title=t.title,
                            description=t.description,
                            input_schema=t.inputSchema or {},
                            output_schema=t.outputSchema or {},
                            icons=[icon.model_dump(mode="json") for icon in (t.icons or [])],
                            annotations=t.annotations.model_dump(mode="json") if t.annotations else {},
                            execution=t.execution.model_dump(mode="json") if t.execution else {},
                            meta=t.meta or {},
                        )
                        for t in tools_result.tools
                    ]

                    logger.info(f"Discovered {len(tools)} tools via http from {url}")
                    return McpConnectionResult(success=True, tools=tools)

    async def _call_tool_http(
        self,
        *,
        url: str,
        headers: dict[str, str],
        tool_name: str,
        arguments: dict[str, Any],
        timeout_seconds: float,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> McpToolCallResult:
        async with asyncio.timeout(timeout_seconds):
            _emit_event(
                event_callback,
                stage="transport_connect",
                status="running",
                title="建立 HTTP 连接",
                payload={"url": url},
            )
            async with streamablehttp_client(url, headers=headers) as (read, write, _session_id):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    _emit_event(
                        event_callback,
                        stage="session_initialized",
                        status="completed",
                        title="MCP Session 已初始化",
                    )
                    result = await session.call_tool(
                        tool_name,
                        arguments=arguments,
                        read_timeout_seconds=timedelta(seconds=timeout_seconds),
                    )
                    _emit_event(
                        event_callback,
                        stage="tool_result",
                        status="completed" if not bool(result.isError) else "failed",
                        title="MCP Tool 返回结果",
                        payload={"tool_name": tool_name},
                    )
                    return McpToolCallResult(
                        success=not bool(result.isError),
                        content=list(result.content or []),
                        structured_content=getattr(result, "structuredContent", None),
                        error=_extract_call_error(result),
                    )


def _extract_call_error(result: Any) -> str | None:
    if not getattr(result, "isError", None):
        return None
    content = getattr(result, "content", None) or []
    parts: list[str] = []
    for item in content:
        if getattr(item, "type", None) == "text" and getattr(item, "text", None):
            parts.append(item.text)
    return "\n".join(parts).strip() or "MCP tool returned an error"


def _emit_event(
    callback: Callable[[dict[str, Any]], None] | None,
    **event: Any,
) -> None:
    if callback:
        callback(event)
