"""
MCP Client Service Module.

提供 MCP Server 连接与 Tool 发现功能。
支持 stdio、sse、http (Streamable HTTP) 三种传输类型。
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

import anyio
import httpx
from mcp import ClientSession
from mcp.client import stdio as mcp_stdio
from mcp.client.sse import sse_client
from mcp.client.stdio import StdioServerParameters
from mcp.client.streamable_http import streamablehttp_client

from negentropy.logging import get_logger
from negentropy.logging.io import ExternalProcessLogStream, derive_external_process_source

logger = get_logger("negentropy.interface.mcp_client")
stderr_logger = get_logger("stderr")

# 连接/发现阶段超时（秒）
DEFAULT_TIMEOUT_SECONDS = 30
# 工具调用操作阶段超时兜底值（秒），当调用方未传 timeout_seconds 时使用
DEFAULT_OPERATION_TIMEOUT_SECONDS = 120


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
class McpResourceTemplateInfo:
    """MCP Resource Template 元信息（来自 resources/templates/list）"""

    uri_template: str
    name: str | None = None
    title: str | None = None
    description: str | None = None
    mime_type: str | None = None
    annotations: dict[str, Any] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class McpConnectionResult:
    """MCP Server 连接结果"""

    success: bool
    tools: list[McpToolInfo] = field(default_factory=list)
    resource_templates: list[McpResourceTemplateInfo] = field(default_factory=list)
    # 仅当 ``resources/templates/list`` 调用成功返回时为 True；旧 server 未声明
    # resources capability、瞬态网络抖动等场景下保持 False。调用方据此区分
    # "权威空列表"（可裁剪 stale 行）与"未支持/错误"（必须保留 stale 行）。
    resource_templates_listed: bool = False
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


@dataclass
class McpResourceContent:
    """MCP Resource 单条载荷（覆盖 BlobResourceContents 与 TextResourceContents）。"""

    uri: str
    mime_type: str | None = None
    blob_base64: str | None = None
    text: str | None = None


@dataclass
class McpResourceReadResult:
    """MCP resources/read 调用结果"""

    success: bool
    contents: list[McpResourceContent] = field(default_factory=list)
    error: str | None = None
    duration_ms: int = 0


@dataclass
class McpToolCallWithResourcesResult:
    """工具调用 + 同会话内动态资源解析结果。

    动态 FileResource（如 ``perceives://pdf/<job_id>/<filename>``）的生命周期与
    工具会话强绑定，必须在同一会话内立即拉取，避免事后失链。
    """

    tool_result: McpToolCallResult
    # uri -> 拉取成功的资源载荷
    resources: dict[str, McpResourceContent] = field(default_factory=dict)
    # uri -> 错误消息（部分失败时记录，不阻断主流程）
    resource_errors: dict[str, str] = field(default_factory=dict)


class McpClientService:
    """MCP Server 连接与 Tool 发现服务"""

    def __init__(self, timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS):
        self.timeout_seconds = timeout_seconds

    # ── 传输层抽象 ──────────────────────────────────────────────────

    @asynccontextmanager
    async def _open_transport(
        self,
        *,
        transport_type: str,
        command: str | None = None,
        args: list[str] | None = None,
        env: dict[str, str] | None = None,
        url: str | None = None,
        headers: dict[str, str] | None = None,
        stderr_callback: Callable[[str], None] | None = None,
    ):
        """根据传输类型建立连接，返回统一的 (read, write) 管道。"""
        if transport_type == "stdio":
            server_params = StdioServerParameters(
                command=command or "",
                args=args or [],
                env=env or {},
            )
            async with logged_stdio_client(
                server_params,
                errlog=self._build_stdio_errlog(command or "", args or []),
                stderr_callback=stderr_callback,
            ) as (read, write):
                yield read, write
        elif transport_type == "sse":
            async with sse_client(url or "", headers=headers or {}) as (read, write):
                yield read, write
        elif transport_type == "http":
            async with streamablehttp_client(url or "", headers=headers or {}) as (read, write, _):
                yield read, write
        else:
            raise ValueError(f"Unsupported transport type: {transport_type}")

    # ── 统一工具调用 ────────────────────────────────────────────────

    async def _call_tool_on_transport(
        self,
        *,
        transport_type: str,
        tool_name: str,
        arguments: dict[str, Any],
        timeout_seconds: float,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
        command: str | None = None,
        args: list[str] | None = None,
        env: dict[str, str] | None = None,
        url: str | None = None,
        headers: dict[str, str] | None = None,
        stderr_callback: Callable[[str], None] | None = None,
    ) -> McpToolCallResult:
        """统一的工具调用方法，适用于所有传输类型。"""
        transport_labels = {"stdio": "STDIO", "sse": "SSE", "http": "HTTP"}
        async with asyncio.timeout(timeout_seconds):
            _emit_event(
                event_callback,
                stage="transport_connect",
                status="running",
                title=f"建立 {transport_labels.get(transport_type, transport_type)} 连接",
                payload={"url": url} if url else {"command": command, "args": args},
            )
            async with self._open_transport(
                transport_type=transport_type,
                command=command,
                args=args,
                env=env,
                url=url,
                headers=headers,
                stderr_callback=stderr_callback,
            ) as (read, write):
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

    # ── 统一工具发现 ────────────────────────────────────────────────

    async def _discover_on_transport(
        self,
        *,
        transport_type: str,
        command: str | None = None,
        args: list[str] | None = None,
        env: dict[str, str] | None = None,
        url: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> McpConnectionResult:
        """统一的工具发现方法，适用于所有传输类型。"""
        async with asyncio.timeout(self.timeout_seconds):
            async with self._open_transport(
                transport_type=transport_type,
                command=command,
                args=args,
                env=env,
                url=url,
                headers=headers,
            ) as (read, write):
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

                    # Resource Templates 发现：旧 server 不声明 resources capability
                    # 时 list_resource_templates 会抛错，此处静默兜底，确保 tools 发现
                    # 不被资源能力可选性所阻断（向后兼容）。``resource_templates_listed``
                    # 区分"权威空列表"与"未支持/错误"，供上游判断是否可裁剪 stale 行。
                    resource_templates: list[McpResourceTemplateInfo] = []
                    resource_templates_listed = False
                    try:
                        templates_result = await session.list_resource_templates()
                        for tpl in templates_result.resourceTemplates:
                            resource_templates.append(
                                McpResourceTemplateInfo(
                                    uri_template=tpl.uriTemplate,
                                    name=tpl.name,
                                    title=getattr(tpl, "title", None),
                                    description=tpl.description,
                                    mime_type=tpl.mimeType,
                                    annotations=(tpl.annotations.model_dump(mode="json") if tpl.annotations else {}),
                                    meta=getattr(tpl, "meta", None) or {},
                                )
                            )
                        resource_templates_listed = True
                    except Exception as exc:
                        logger.debug(
                            "list_resource_templates_skipped",
                            transport_type=transport_type,
                            reason=str(exc),
                        )

                    transport_source = command if transport_type == "stdio" else url
                    logger.info(
                        f"Discovered {len(tools)} tools and {len(resource_templates)} resource templates "
                        f"via {transport_type} from {transport_source}"
                    )
                    return McpConnectionResult(
                        success=True,
                        tools=tools,
                        resource_templates=resource_templates,
                        resource_templates_listed=resource_templates_listed,
                    )

    # ── 公开入口方法 ────────────────────────────────────────────────

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
        effective_timeout = timeout_seconds if timeout_seconds is not None else DEFAULT_OPERATION_TIMEOUT_SECONDS

        # 参数前置校验
        if transport_type == "stdio" and not command:
            return McpToolCallResult(success=False, error="Command is required for stdio transport")
        if transport_type in ("sse", "http") and not url:
            return McpToolCallResult(success=False, error=f"URL is required for {transport_type} transport")
        if transport_type not in ("stdio", "sse", "http"):
            return McpToolCallResult(success=False, error=f"Unsupported transport type: {transport_type}")

        try:
            result = await self._call_tool_on_transport(
                transport_type=transport_type,
                tool_name=tool_name,
                arguments=arguments or {},
                timeout_seconds=effective_timeout,
                event_callback=event_callback,
                command=command,
                args=args,
                env=env,
                url=url,
                headers=headers,
                stderr_callback=stderr_callback,
            )
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

        # 参数前置校验
        if transport_type == "stdio" and not command:
            return McpConnectionResult(success=False, error="Command is required for stdio transport", duration_ms=0)
        if transport_type in ("sse", "http") and not url:
            return McpConnectionResult(
                success=False, error=f"URL is required for {transport_type} transport", duration_ms=0
            )
        if transport_type not in ("stdio", "sse", "http"):
            return McpConnectionResult(
                success=False, error=f"Unsupported transport type: {transport_type}", duration_ms=0
            )

        try:
            result = await self._discover_on_transport(
                transport_type=transport_type,
                command=command,
                args=args,
                env=env,
                url=url,
                headers=headers,
            )
            result.duration_ms = int((time.time() - start_time) * 1000)
            return result
        except TimeoutError:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"Connection timeout after {self.timeout_seconds}s"
            logger.warning(f"MCP connection timeout: {error_msg}")
            return McpConnectionResult(success=False, error=error_msg, duration_ms=duration_ms)
        except FileNotFoundError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"Command not found: {e.filename}"
            logger.warning(f"MCP command not found: {error_msg}")
            return McpConnectionResult(success=False, error=error_msg, duration_ms=duration_ms)
        except ExceptionGroup as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = self._extract_exception_group_error(e)
            logger.error(f"MCP 连接异常组: {error_msg}", exc_info=True)
            return McpConnectionResult(success=False, error=error_msg, duration_ms=duration_ms)
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = self._extract_error_message(e)
            logger.error(f"MCP connection failed: {error_msg}", exc_info=True)
            return McpConnectionResult(success=False, error=error_msg, duration_ms=duration_ms)

    # ── 同会话工具调用 + 动态资源解析 ───────────────────────────────

    async def _call_tool_and_resolve_resources_on_transport(
        self,
        *,
        transport_type: str,
        tool_name: str,
        arguments: dict[str, Any],
        timeout_seconds: float,
        resource_concurrency: int,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
        command: str | None = None,
        args: list[str] | None = None,
        env: dict[str, str] | None = None,
        url: str | None = None,
        headers: dict[str, str] | None = None,
        stderr_callback: Callable[[str], None] | None = None,
    ) -> McpToolCallWithResourcesResult:
        """在同一 ClientSession 内调用工具并立即并发拉取所有 ResourceLink。

        关键不变量：动态 FileResource（``perceives://pdf/<job_id>/...``）的生命
        周期与工具调用会话绑定，必须在 session 关闭前完成 ``resources/read``。
        本方法保证 tool call 与所有 read_resource 共享同一会话上下文。

        部分失败容错：单条资源拉取失败仅记录到 ``resource_errors``，不抛异常，
        不影响主 tool_result 的可用性（与计划中的 "warn + 占位" 策略对齐）。
        """
        transport_labels = {"stdio": "STDIO", "sse": "SSE", "http": "HTTP"}
        async with asyncio.timeout(timeout_seconds):
            _emit_event(
                event_callback,
                stage="transport_connect",
                status="running",
                title=f"建立 {transport_labels.get(transport_type, transport_type)} 连接",
                payload={"url": url} if url else {"command": command, "args": args},
            )
            async with self._open_transport(
                transport_type=transport_type,
                command=command,
                args=args,
                env=env,
                url=url,
                headers=headers,
                stderr_callback=stderr_callback,
            ) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    _emit_event(
                        event_callback,
                        stage="session_initialized",
                        status="completed",
                        title="MCP Session 已初始化",
                    )
                    tool_call_result = await session.call_tool(
                        tool_name,
                        arguments=arguments,
                        read_timeout_seconds=timedelta(seconds=timeout_seconds),
                    )
                    _emit_event(
                        event_callback,
                        stage="tool_result",
                        status="completed" if not bool(tool_call_result.isError) else "failed",
                        title="MCP Tool 返回结果",
                        payload={"tool_name": tool_name},
                    )

                    tool_result = McpToolCallResult(
                        success=not bool(tool_call_result.isError),
                        content=list(tool_call_result.content or []),
                        structured_content=getattr(tool_call_result, "structuredContent", None),
                        error=_extract_call_error(tool_call_result),
                    )

                    # 收集 ResourceLink URIs（按 result.content 出现顺序去重）
                    resource_uris: list[str] = []
                    seen: set[str] = set()
                    for item in tool_result.content:
                        if getattr(item, "type", None) == "resource_link":
                            uri = getattr(item, "uri", None)
                            if uri and uri not in seen:
                                resource_uris.append(str(uri))
                                seen.add(str(uri))

                    if not resource_uris:
                        return McpToolCallWithResourcesResult(tool_result=tool_result)

                    _emit_event(
                        event_callback,
                        stage="resource_read",
                        status="running",
                        title=f"并发读取 {len(resource_uris)} 个动态资源",
                    )

                    semaphore = asyncio.Semaphore(max(1, resource_concurrency))
                    resources: dict[str, McpResourceContent] = {}
                    resource_errors: dict[str, str] = {}

                    async def _read_one(uri: str) -> None:
                        async with semaphore:
                            try:
                                read_result = await session.read_resource(uri)
                                contents = _parse_resource_contents(read_result.contents)
                                if contents:
                                    # 单 URI 通常返回一个 content（覆盖：取首个非空载荷）
                                    chosen = next(
                                        (c for c in contents if c.blob_base64 or c.text),
                                        contents[0],
                                    )
                                    resources[uri] = chosen
                                else:
                                    resource_errors[uri] = "empty contents"
                            except Exception as exc:  # noqa: BLE001 — 单条容错
                                resource_errors[uri] = self._extract_error_message(exc)

                    # return_exceptions=True 双重保险：即便取消传播路径绕过
                    # _read_one 内部 try/except，也不会让单条失败击穿主流程。
                    await asyncio.gather(
                        *(_read_one(uri) for uri in resource_uris),
                        return_exceptions=True,
                    )

                    _emit_event(
                        event_callback,
                        stage="resource_read",
                        status="completed",
                        title=(f"动态资源读取完成：成功 {len(resources)} / 失败 {len(resource_errors)}"),
                    )

                    return McpToolCallWithResourcesResult(
                        tool_result=tool_result,
                        resources=resources,
                        resource_errors=resource_errors,
                    )

    async def call_tool_and_resolve_resources(
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
        resource_concurrency: int = 4,
        event_callback: Callable[[dict[str, Any]], None] | None = None,
        stderr_callback: Callable[[str], None] | None = None,
    ) -> McpToolCallWithResourcesResult:
        """连接 MCP Server，调用工具并在同会话内拉取所有 ResourceLink。"""
        start_time = time.time()
        effective_timeout = timeout_seconds if timeout_seconds is not None else DEFAULT_OPERATION_TIMEOUT_SECONDS

        if transport_type == "stdio" and not command:
            return McpToolCallWithResourcesResult(
                tool_result=McpToolCallResult(success=False, error="Command is required for stdio transport"),
            )
        if transport_type in ("sse", "http") and not url:
            return McpToolCallWithResourcesResult(
                tool_result=McpToolCallResult(success=False, error=f"URL is required for {transport_type} transport"),
            )
        if transport_type not in ("stdio", "sse", "http"):
            return McpToolCallWithResourcesResult(
                tool_result=McpToolCallResult(success=False, error=f"Unsupported transport type: {transport_type}"),
            )

        try:
            result = await self._call_tool_and_resolve_resources_on_transport(
                transport_type=transport_type,
                tool_name=tool_name,
                arguments=arguments or {},
                timeout_seconds=effective_timeout,
                resource_concurrency=resource_concurrency,
                event_callback=event_callback,
                command=command,
                args=args,
                env=env,
                url=url,
                headers=headers,
                stderr_callback=stderr_callback,
            )
            result.tool_result.duration_ms = int((time.time() - start_time) * 1000)
            return result
        except TimeoutError:
            return McpToolCallWithResourcesResult(
                tool_result=McpToolCallResult(
                    success=False,
                    error=f"Connection timeout after {effective_timeout}s",
                    duration_ms=int((time.time() - start_time) * 1000),
                ),
            )
        except FileNotFoundError as exc:
            return McpToolCallWithResourcesResult(
                tool_result=McpToolCallResult(
                    success=False,
                    error=f"Command not found: {exc.filename}",
                    duration_ms=int((time.time() - start_time) * 1000),
                ),
            )
        except ExceptionGroup as exc:
            return McpToolCallWithResourcesResult(
                tool_result=McpToolCallResult(
                    success=False,
                    error=self._extract_exception_group_error(exc),
                    duration_ms=int((time.time() - start_time) * 1000),
                ),
            )
        except Exception as exc:
            return McpToolCallWithResourcesResult(
                tool_result=McpToolCallResult(
                    success=False,
                    error=self._extract_error_message(exc),
                    duration_ms=int((time.time() - start_time) * 1000),
                ),
            )

    # ── 资源读取（resources/read） ──────────────────────────────────

    async def _read_resource_on_transport(
        self,
        *,
        transport_type: str,
        uri: str,
        timeout_seconds: float,
        command: str | None = None,
        args: list[str] | None = None,
        env: dict[str, str] | None = None,
        url: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> McpResourceReadResult:
        """统一的资源读取方法（resources/read）。

        注意：每次新建 ClientSession——Perceives 等 server 的动态 FileResource
        URI 通常依赖工具调用同一会话上下文。本方法适用于"短期独立会话内拉取
        已知静态 URI"的场景；动态实例的拉取应通过
        ``call_tool_and_resolve_resources`` 在工具会话内一次性完成。
        """
        async with asyncio.timeout(timeout_seconds):
            async with self._open_transport(
                transport_type=transport_type,
                command=command,
                args=args,
                env=env,
                url=url,
                headers=headers,
            ) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.read_resource(uri)
                    return McpResourceReadResult(
                        success=True,
                        contents=_parse_resource_contents(result.contents),
                    )

    async def read_resource(
        self,
        *,
        transport_type: str,
        uri: str,
        command: str | None = None,
        args: list[str] | None = None,
        env: dict[str, str] | None = None,
        url: str | None = None,
        headers: dict[str, str] | None = None,
        timeout_seconds: float | None = None,
    ) -> McpResourceReadResult:
        """连接 MCP Server 并按 URI 读取单个资源。"""
        start_time = time.time()
        effective_timeout = timeout_seconds if timeout_seconds is not None else DEFAULT_OPERATION_TIMEOUT_SECONDS

        if transport_type == "stdio" and not command:
            return McpResourceReadResult(success=False, error="Command is required for stdio transport")
        if transport_type in ("sse", "http") and not url:
            return McpResourceReadResult(success=False, error=f"URL is required for {transport_type} transport")
        if transport_type not in ("stdio", "sse", "http"):
            return McpResourceReadResult(success=False, error=f"Unsupported transport type: {transport_type}")

        try:
            result = await self._read_resource_on_transport(
                transport_type=transport_type,
                uri=uri,
                timeout_seconds=effective_timeout,
                command=command,
                args=args,
                env=env,
                url=url,
                headers=headers,
            )
            result.duration_ms = int((time.time() - start_time) * 1000)
            return result
        except TimeoutError:
            return McpResourceReadResult(
                success=False,
                error=f"Resource read timeout after {effective_timeout}s",
                duration_ms=int((time.time() - start_time) * 1000),
            )
        except ExceptionGroup as exc:
            return McpResourceReadResult(
                success=False,
                error=self._extract_exception_group_error(exc),
                duration_ms=int((time.time() - start_time) * 1000),
            )
        except Exception as exc:
            return McpResourceReadResult(
                success=False,
                error=self._extract_error_message(exc),
                duration_ms=int((time.time() - start_time) * 1000),
            )

    # ── 辅助方法 ────────────────────────────────────────────────────

    @staticmethod
    def _build_stdio_errlog(command: str, args: list[str]) -> ExternalProcessLogStream:
        return ExternalProcessLogStream(
            stderr_logger,
            source=derive_external_process_source(command, args),
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


def _parse_resource_contents(contents: Any) -> list[McpResourceContent]:
    """将 MCP ReadResourceResult.contents 解析为统一的 McpResourceContent 列表。

    覆盖 BlobResourceContents（blob 字段，base64）与 TextResourceContents（text 字段）。
    """
    parsed: list[McpResourceContent] = []
    for item in contents or []:
        uri = getattr(item, "uri", None)
        if not uri:
            continue
        parsed.append(
            McpResourceContent(
                uri=str(uri),
                mime_type=getattr(item, "mimeType", None),
                blob_base64=getattr(item, "blob", None),
                text=getattr(item, "text", None),
            )
        )
    return parsed


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
