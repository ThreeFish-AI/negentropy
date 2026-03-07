from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import anyio
import pytest

from negentropy.logging.io import ExternalProcessLogStream
from negentropy.plugins.mcp_client import McpClientService, logged_stdio_client


@pytest.mark.asyncio
async def test_discover_stdio_uses_logged_stdio_client(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    @asynccontextmanager
    async def fake_logged_stdio_client(server_params, errlog):
        captured["server_params"] = server_params
        captured["errlog"] = errlog
        yield object(), object()

    class _Tool:
        def __init__(self) -> None:
            self.name = "demo"
            self.title = "Demo Tool"
            self.description = "demo tool"
            self.inputSchema = {"type": "object"}
            self.outputSchema = {"type": "object", "properties": {"ok": {"type": "boolean"}}}
            self.icons = [type("_Icon", (), {"model_dump": lambda self, mode="json": {"src": "https://example.com/icon.png"}})()]
            self.annotations = type(
                "_Annotations",
                (),
                {
                    "model_dump": lambda self, mode="json": {
                        "title": "Annotated Demo",
                        "readOnlyHint": True,
                    }
                },
            )()
            self.execution = type(
                "_Execution",
                (),
                {
                    "model_dump": lambda self, mode="json": {
                        "taskSupport": "optional",
                    }
                },
            )()
            self.meta = {"source": "spec"}

    class _ToolsResult:
        tools = [_Tool()]

    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def initialize(self) -> None:
            captured["initialized"] = True

        async def list_tools(self):
            return _ToolsResult()

    monkeypatch.setattr("negentropy.plugins.mcp_client.logged_stdio_client", fake_logged_stdio_client)
    monkeypatch.setattr("negentropy.plugins.mcp_client.ClientSession", lambda read, write: _Session())

    service = McpClientService(timeout_seconds=5)
    result = await service.discover_tools(
        "stdio",
        command="npx",
        args=["-y", "@zilliz/zai-mcp-server"],
        env={},
    )

    assert result.success is True
    assert captured["initialized"] is True
    assert captured["errlog"].source == "mcp.zai-mcp-server"
    assert result.tools[0].title == "Demo Tool"
    assert result.tools[0].output_schema == {"type": "object", "properties": {"ok": {"type": "boolean"}}}
    assert result.tools[0].icons == [{"src": "https://example.com/icon.png"}]
    assert result.tools[0].annotations == {"title": "Annotated Demo", "readOnlyHint": True}
    assert result.tools[0].execution == {"taskSupport": "optional"}
    assert result.tools[0].meta == {"source": "spec"}


@pytest.mark.asyncio
async def test_call_tool_stdio_passes_structured_errlog(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    @asynccontextmanager
    async def fake_logged_stdio_client(server_params, errlog):
        captured["server_params"] = server_params
        captured["errlog"] = errlog
        yield object(), object()

    class _Result:
        isError = False
        content = [{"type": "text", "text": "ok"}]
        structuredContent = {"ok": True}

    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def initialize(self) -> None:
            captured["initialized"] = True

        async def call_tool(self, tool_name, arguments, read_timeout_seconds):
            captured["tool_name"] = tool_name
            captured["arguments"] = arguments
            captured["read_timeout_seconds"] = read_timeout_seconds
            return _Result()

    monkeypatch.setattr("negentropy.plugins.mcp_client.logged_stdio_client", fake_logged_stdio_client)
    monkeypatch.setattr("negentropy.plugins.mcp_client.ClientSession", lambda read, write: _Session())

    service = McpClientService(timeout_seconds=5)
    result = await service.call_tool(
        transport_type="stdio",
        command="uvx",
        args=["mcp-server-fetch"],
        env={},
        tool_name="fetch",
        arguments={"url": "https://example.com"},
    )

    assert result.success is True
    assert captured["initialized"] is True
    assert captured["tool_name"] == "fetch"
    assert captured["errlog"].source == "mcp.mcp-server-fetch"


@pytest.mark.asyncio
async def test_logged_stdio_client_pipes_stderr_and_forwards_logs(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    events: list[tuple[int, str, dict[str, object]]] = []

    class _Logger:
        def log(self, level, event=None, **kwargs):
            events.append((level, event, kwargs))

    class _FakeStdin:
        async def send(self, data: bytes) -> None:
            captured["stdin_payload"] = data

        async def aclose(self) -> None:
            captured["stdin_closed"] = True

    class _FakeProcess:
        def __init__(self, stdout, stderr) -> None:
            self.stdin = _FakeStdin()
            self.stdout = stdout
            self.stderr = stderr

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def wait(self) -> None:
            captured["wait_called"] = True

    _stdout_send, stdout_recv = anyio.create_memory_object_stream[bytes](10)
    stderr_send, stderr_recv = anyio.create_memory_object_stream[bytes](10)

    process = _FakeProcess(stdout_recv, stderr_recv)

    async def fake_open_process(command, **kwargs):
        captured["command"] = command
        captured["stderr"] = kwargs.get("stderr")
        return process

    class _TextReceiveStream:
        def __init__(self, stream, encoding: str, errors: str):
            self.stream = stream
            self.encoding = encoding
            self.errors = errors

        def __aiter__(self):
            return self

        async def __anext__(self):
            try:
                chunk = await self.stream.receive()
            except anyio.EndOfStream:
                raise StopAsyncIteration from None
            return chunk.decode(self.encoding, errors=self.errors)

    monkeypatch.setattr("negentropy.plugins.mcp_client.anyio.open_process", fake_open_process)
    monkeypatch.setattr("negentropy.plugins.mcp_client.mcp_stdio._get_executable_command", lambda command: command)
    monkeypatch.setattr("negentropy.plugins.mcp_client.mcp_stdio.get_default_environment", lambda: {"PATH": "x"})
    monkeypatch.setattr("negentropy.plugins.mcp_client.mcp_stdio.TextReceiveStream", _TextReceiveStream)

    server_params = type(
        "_Params",
        (),
        {
            "command": "npx",
            "args": ["-y", "@zilliz/zai-mcp-server"],
            "env": {"FOO": "bar"},
            "cwd": None,
            "encoding": "utf-8",
            "encoding_error_handler": "replace",
        },
    )()

    errlog = ExternalProcessLogStream(_Logger(), source="mcp.zai-mcp-server")

    async with logged_stdio_client(server_params, errlog) as (_read, _write):
        await stderr_send.send(b"[2026-03-07T06:29:09.030Z] INFO: MCP Server Application initialized\n")
        await stderr_send.aclose()
        await _stdout_send.aclose()
        await anyio.sleep(0)

    assert captured["command"] == ["npx", "-y", "@zilliz/zai-mcp-server"]
    assert captured["stderr"] == -1
    assert events == [
        (
            logging.INFO,
            "MCP Server Application initialized",
            {"source": "mcp.zai-mcp-server", "timestamp": "2026-03-07T06:29:09.030Z"},
        )
    ]
