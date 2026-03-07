from __future__ import annotations

from contextlib import asynccontextmanager

import pytest

from negentropy.plugins.mcp_client import McpClientService


@pytest.mark.asyncio
async def test_discover_stdio_passes_structured_errlog(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    @asynccontextmanager
    async def fake_stdio_client(server_params, errlog):
        captured["server_params"] = server_params
        captured["errlog"] = errlog
        yield object(), object()

    class _Tool:
        def __init__(self) -> None:
            self.name = "demo"
            self.description = "demo tool"
            self.inputSchema = {"type": "object"}

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

    monkeypatch.setattr("negentropy.plugins.mcp_client.stdio_client", fake_stdio_client)
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


@pytest.mark.asyncio
async def test_call_tool_stdio_passes_structured_errlog(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    @asynccontextmanager
    async def fake_stdio_client(server_params, errlog):
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

    monkeypatch.setattr("negentropy.plugins.mcp_client.stdio_client", fake_stdio_client)
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
