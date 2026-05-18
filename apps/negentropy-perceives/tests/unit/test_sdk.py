"""Python SDK tests for the NegentropyPerceivesClient (dual-mode)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from negentropy.perceives.sdk import (
    NegentropyPerceivesClient,
    NegentropyPerceivesConnectionError,
    NegentropyPerceivesError,
    NegentropyPerceivesToolError,
)


# ── MCP 模式测试 ──────────────────────────────────────────────────


class TestSDKMCPMode:
    """测试 SDK MCP Client 模式。"""

    def test_invalid_mode_raises(self):
        """无效模式应抛出 ValueError。"""
        with pytest.raises(ValueError, match="Invalid mode"):
            NegentropyPerceivesClient(mode="bogus")

    @pytest.mark.asyncio
    async def test_connect_and_close(self):
        """connect/close 应委托给底层 FastMCP Client。"""
        test_url = "http://localhost:2992/mcp"
        with (
            patch("fastmcp.client.transports.StreamableHttpTransport") as transport_cls,
            patch("fastmcp.Client") as client_cls,
        ):
            mock_client = AsyncMock()
            client_cls.return_value = mock_client

            client = NegentropyPerceivesClient(test_url)
            await client.connect()
            await client.close()

            transport_cls.assert_called_once_with(url=test_url, headers=None, auth=None)
            mock_client.__aenter__.assert_awaited_once()
            mock_client.__aexit__.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_list_tools_returns_server_tools(self):
        """list_tools 应返回底层 Client 的结果。"""
        with (
            patch("fastmcp.client.transports.StreamableHttpTransport"),
            patch("fastmcp.Client") as client_cls,
        ):
            tool = SimpleNamespace(name="discover_links")
            mock_client = AsyncMock()
            mock_client.list_tools = AsyncMock(return_value=[tool])
            client_cls.return_value = mock_client

            client = NegentropyPerceivesClient()
            tools = await client.list_tools()

            assert tools == [tool]

    @pytest.mark.asyncio
    async def test_call_tool_delegates(self):
        """call_tool 应透传工具名和参数。"""
        with (
            patch("fastmcp.client.transports.StreamableHttpTransport"),
            patch("fastmcp.Client") as client_cls,
        ):
            mock_client = AsyncMock()
            mock_client.call_tool = AsyncMock(return_value={"success": True})
            client_cls.return_value = mock_client

            client = NegentropyPerceivesClient()
            result = await client.call_tool("discover_links", {"url": "https://a.com"})

            assert result == {"success": True}
            mock_client.call_tool.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_connect_wraps_connection_errors(self):
        """连接错误应映射为 NegentropyPerceivesConnectionError。"""
        with (
            patch("fastmcp.client.transports.StreamableHttpTransport"),
            patch("fastmcp.Client") as client_cls,
        ):
            mock_client = AsyncMock()
            mock_client.__aenter__.side_effect = RuntimeError("boom")
            client_cls.return_value = mock_client

            client = NegentropyPerceivesClient()
            with pytest.raises(NegentropyPerceivesConnectionError):
                await client.connect()

    @pytest.mark.asyncio
    async def test_call_tool_wraps_tool_errors(self):
        """工具调用错误应映射为 NegentropyPerceivesToolError。"""
        with (
            patch("fastmcp.client.transports.StreamableHttpTransport"),
            patch("fastmcp.Client") as client_cls,
        ):
            mock_client = AsyncMock()
            mock_client.call_tool = AsyncMock(side_effect=RuntimeError("boom"))
            client_cls.return_value = mock_client

            client = NegentropyPerceivesClient()
            with pytest.raises(NegentropyPerceivesToolError):
                await client.call_tool("discover_links")

    @pytest.mark.asyncio
    async def test_discover_links_calls_tool(self):
        """discover_links 便捷方法应调用 call_tool。"""
        with (
            patch("fastmcp.client.transports.StreamableHttpTransport"),
            patch("fastmcp.Client"),
            patch.object(
                NegentropyPerceivesClient,
                "call_tool",
                new_callable=AsyncMock,
                return_value={"success": True},
            ) as mock_call,
        ):
            client = NegentropyPerceivesClient()
            result = await client.discover_links(url="https://example.com")

            assert result == {"success": True}
            mock_call.assert_awaited_once_with(
                "discover_links",
                {
                    "url": "https://example.com",
                    "filter_domains": None,
                    "exclude_domains": None,
                    "internal_only": False,
                },
            )


# ── Direct 模式测试 ──────────────────────────────────────────────


class TestSDKDirectMode:
    """测试 SDK Direct 模式（直接调用 ops 层）。"""

    def test_direct_mode_no_fastmcp_import(self):
        """Direct 模式不应导入 FastMCP Client。"""
        client = NegentropyPerceivesClient(mode="direct")
        assert client._mode == "direct"
        assert client._client is None

    @pytest.mark.asyncio
    async def test_connect_is_noop(self):
        """Direct 模式 connect 应为空操作。"""
        client = NegentropyPerceivesClient(mode="direct")
        await client.connect()
        assert client._connected is True

    @pytest.mark.asyncio
    async def test_list_tools_raises_in_direct_mode(self):
        """Direct 模式下 list_tools 应抛出 NegentropyPerceivesError。"""
        client = NegentropyPerceivesClient(mode="direct")
        await client.connect()
        with pytest.raises(
            NegentropyPerceivesError, match="not available in direct mode"
        ):
            await client.list_tools()

    @pytest.mark.asyncio
    async def test_call_tool_raises_in_direct_mode(self):
        """Direct 模式下 call_tool 应抛出 NegentropyPerceivesError。"""
        client = NegentropyPerceivesClient(mode="direct")
        await client.connect()
        with pytest.raises(
            NegentropyPerceivesError, match="not available in direct mode"
        ):
            await client.call_tool("discover_links")

    @pytest.mark.asyncio
    async def test_discover_links_direct(self):
        """Direct 模式下 discover_links 应调用 ops 层。"""
        with patch(
            "negentropy.perceives.ops.discovery.discover_links",
            new_callable=AsyncMock,
            return_value={"success": True, "links": []},
        ) as mock_op:
            client = NegentropyPerceivesClient(mode="direct")
            await client.connect()
            result = await client.discover_links(url="https://example.com")

            assert result["success"] is True
            mock_op.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_context_manager_direct_mode(self):
        """Direct 模式应支持 async context manager。"""
        client = NegentropyPerceivesClient(mode="direct")
        async with client:
            assert client._connected is True
        assert client._connected is False
