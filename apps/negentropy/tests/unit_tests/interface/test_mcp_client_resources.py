"""MCP Client Resource Templates 发现与同会话动态资源拉取测试。

覆盖：
- ``_discover_on_transport`` 解析 ``list_resource_templates`` 返回；
- 旧 server 不声明 resources capability（``list_resource_templates`` 抛错）时
  静默兜底，不阻断 tools 发现；
- ``call_tool_and_resolve_resources`` 在同一会话内调工具并发拉取 ResourceLink；
- 单条资源拉取失败时记录到 ``resource_errors`` 而不抛异常。
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import pytest

from negentropy.interface.mcp_client import McpClientService


class _Tool:
    name = "demo"
    title = None
    description = None
    inputSchema = {}
    outputSchema = {}
    icons = []
    annotations = None
    execution = None
    meta = {}


class _ToolsResult:
    tools = [_Tool()]


class _Template:
    def __init__(self, uri_template: str, *, name: str | None = None, mime_type: str | None = None):
        self.uriTemplate = uri_template
        self.name = name
        self.title = None
        self.description = None
        self.mimeType = mime_type
        self.annotations = None


class _TemplatesResult:
    def __init__(self, templates):
        self.resourceTemplates = templates


@pytest.mark.asyncio
async def test_discover_includes_resource_templates(monkeypatch: pytest.MonkeyPatch) -> None:
    @asynccontextmanager
    async def fake_logged_stdio_client(server_params, errlog, stderr_callback=None):
        yield object(), object()

    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def initialize(self) -> None:
            return None

        async def list_tools(self):
            return _ToolsResult()

        async def list_resource_templates(self):
            return _TemplatesResult(
                [
                    _Template("perceives://pdf/{job_id}/{filename}", name="pdf-image", mime_type="image/png"),
                ]
            )

    monkeypatch.setattr("negentropy.interface.mcp_client.logged_stdio_client", fake_logged_stdio_client)
    monkeypatch.setattr("negentropy.interface.mcp_client.ClientSession", lambda read, write: _Session())

    service = McpClientService(timeout_seconds=5)
    result = await service.discover_tools("stdio", command="npx", args=[], env={})

    assert result.success is True
    assert len(result.tools) == 1
    assert len(result.resource_templates) == 1
    tpl = result.resource_templates[0]
    assert tpl.uri_template == "perceives://pdf/{job_id}/{filename}"
    assert tpl.name == "pdf-image"
    assert tpl.mime_type == "image/png"


@pytest.mark.asyncio
async def test_discover_tolerates_missing_resources_capability(monkeypatch: pytest.MonkeyPatch) -> None:
    """旧 server 不实现 list_resource_templates 时静默兜底，tools 发现不受影响。"""

    @asynccontextmanager
    async def fake_logged_stdio_client(server_params, errlog, stderr_callback=None):
        yield object(), object()

    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def initialize(self) -> None:
            return None

        async def list_tools(self):
            return _ToolsResult()

        async def list_resource_templates(self):
            raise RuntimeError("Method not found: resources/templates/list")

    monkeypatch.setattr("negentropy.interface.mcp_client.logged_stdio_client", fake_logged_stdio_client)
    monkeypatch.setattr("negentropy.interface.mcp_client.ClientSession", lambda read, write: _Session())

    service = McpClientService(timeout_seconds=5)
    result = await service.discover_tools("stdio", command="npx", args=[], env={})

    assert result.success is True
    assert len(result.tools) == 1
    assert result.resource_templates == []  # 静默兜底


@pytest.mark.asyncio
async def test_call_tool_and_resolve_resources_pulls_resource_links(monkeypatch: pytest.MonkeyPatch) -> None:
    """工具返回的 resource_link URI 应在同一会话内并发拉取。"""

    @asynccontextmanager
    async def fake_logged_stdio_client(server_params, errlog, stderr_callback=None):
        yield object(), object()

    class _Link:
        def __init__(self, uri: str):
            self.type = "resource_link"
            self.uri = uri
            self.mimeType = "image/png"
            self.name = None

    class _ToolCallResult:
        isError = False
        content = [
            type("_Text", (), {"type": "text", "text": "# md"})(),
            _Link("perceives://pdf/abc/img1.png"),
            _Link("perceives://pdf/abc/img2.png"),
        ]
        structuredContent = None

    class _BlobContents:
        def __init__(self, uri: str, blob: str):
            self.uri = uri
            self.mimeType = "image/png"
            self.blob = blob
            self.text = None

    class _ReadResult:
        def __init__(self, contents):
            self.contents = contents

    pulled_uris: list[str] = []

    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def initialize(self) -> None:
            return None

        async def call_tool(self, tool_name, arguments, read_timeout_seconds):
            return _ToolCallResult()

        async def read_resource(self, uri):
            pulled_uris.append(uri)
            payload = "AAAA" if "img1" in uri else "BBBB"
            return _ReadResult([_BlobContents(uri, payload)])

    monkeypatch.setattr("negentropy.interface.mcp_client.logged_stdio_client", fake_logged_stdio_client)
    monkeypatch.setattr("negentropy.interface.mcp_client.ClientSession", lambda read, write: _Session())

    service = McpClientService(timeout_seconds=5)
    result = await service.call_tool_and_resolve_resources(
        transport_type="stdio",
        command="npx",
        args=[],
        env={},
        tool_name="parse_pdf_to_markdown",
        arguments={"source": {"url": "x"}},
    )

    assert result.tool_result.success is True
    assert sorted(pulled_uris) == [
        "perceives://pdf/abc/img1.png",
        "perceives://pdf/abc/img2.png",
    ]
    assert set(result.resources.keys()) == {
        "perceives://pdf/abc/img1.png",
        "perceives://pdf/abc/img2.png",
    }
    assert result.resources["perceives://pdf/abc/img1.png"].blob_base64 == "AAAA"
    assert result.resources["perceives://pdf/abc/img2.png"].blob_base64 == "BBBB"
    assert result.resource_errors == {}


@pytest.mark.asyncio
async def test_resource_partial_failure_recorded_not_raised(monkeypatch: pytest.MonkeyPatch) -> None:
    """单条 read_resource 失败时只记录错误，不影响主 tool_result 与其他 URI 拉取。"""

    @asynccontextmanager
    async def fake_logged_stdio_client(server_params, errlog, stderr_callback=None):
        yield object(), object()

    class _Link:
        def __init__(self, uri: str):
            self.type = "resource_link"
            self.uri = uri
            self.mimeType = "image/png"
            self.name = None

    class _ToolCallResult:
        isError = False
        content = [_Link("perceives://pdf/abc/good.png"), _Link("perceives://pdf/abc/bad.png")]
        structuredContent = None

    class _BlobContents:
        def __init__(self, uri: str):
            self.uri = uri
            self.mimeType = "image/png"
            self.blob = "OK"
            self.text = None

    class _ReadResult:
        def __init__(self, contents):
            self.contents = contents

    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def initialize(self) -> None:
            return None

        async def call_tool(self, tool_name, arguments, read_timeout_seconds):
            return _ToolCallResult()

        async def read_resource(self, uri):
            if "bad" in uri:
                raise RuntimeError("Resource expired")
            return _ReadResult([_BlobContents(uri)])

    monkeypatch.setattr("negentropy.interface.mcp_client.logged_stdio_client", fake_logged_stdio_client)
    monkeypatch.setattr("negentropy.interface.mcp_client.ClientSession", lambda read, write: _Session())

    service = McpClientService(timeout_seconds=5)
    result = await service.call_tool_and_resolve_resources(
        transport_type="stdio",
        command="npx",
        args=[],
        env={},
        tool_name="parse_pdf_to_markdown",
        arguments={},
    )

    # 主 tool_result 仍成功
    assert result.tool_result.success is True
    # 成功拉取的资源进入 resources，失败进入 resource_errors
    assert "perceives://pdf/abc/good.png" in result.resources
    assert "perceives://pdf/abc/bad.png" in result.resource_errors
    assert "Resource expired" in result.resource_errors["perceives://pdf/abc/bad.png"]
