"""Python SDK facade for the Negentropy Perceives service.

Supports two modes:
1. MCP Client mode: Connect to a running MCP server via HTTP (default)
2. Direct mode: Call operations directly without MCP server (zero-config)

Usage::

    # MCP Client mode
    async with NegentropyPerceivesClient() as client:
        result = await client.discover_links(url="https://example.com")

    # Direct mode (no MCP server needed)
    async with NegentropyPerceivesClient(mode="direct") as client:
        result = await client.parse_webpage_to_markdown(url="https://example.com")
"""

from __future__ import annotations

from typing import Any

from .core.types import PDFMethod, PDFOutputFormat, ScrapeMethod
from .models import (
    BatchMarkdownResponse,
    BatchPDFResponse,
    LinksResponse,
    MarkdownResponse,
    PageInfoResponse,
    PDFResponse,
)


class NegentropyPerceivesError(Exception):
    """Base exception for Python SDK failures."""


class NegentropyPerceivesConnectionError(NegentropyPerceivesError):
    """Raised when the SDK cannot establish or maintain a client session."""


class NegentropyPerceivesToolError(NegentropyPerceivesError):
    """Raised when a tool invocation fails."""


# 向后兼容常量（Deprecated: 请使用 _default_base_url() 或直接从 config.settings 读取）
DEFAULT_BASE_URL = "http://localhost:2992/mcp"


def _default_base_url() -> str:
    """从全局配置动态构建默认 base URL（惰性导入，避免循环依赖）。"""
    from .config import settings

    return f"http://{settings.http_host}:{settings.http_port}{settings.http_path}"


class NegentropyPerceivesClient:
    """High-level async SDK for the Negentropy Perceives service.

    Mode 1 — MCP Client (remote)::

        async with NegentropyPerceivesClient() as client:
            result = await client.discover_links(url="https://example.com")

    Mode 2 — Direct (local, no MCP server)::

        async with NegentropyPerceivesClient(mode="direct") as client:
            result = await client.discover_links(url="https://example.com")
    """

    def __init__(
        self,
        base_url: str | None = None,
        *,
        mode: str = "mcp",
        headers: dict[str, str] | None = None,
        auth: Any = None,
        timeout: float | int | None = None,
        client_name: str = "negentropy-perceives-sdk",
    ) -> None:
        if mode not in ("mcp", "direct"):
            raise ValueError(f"Invalid mode: {mode!r}. Use 'mcp' or 'direct'.")

        self.base_url = base_url if base_url is not None else _default_base_url()
        self._mode = mode
        self._connected = False

        if mode == "mcp":
            from fastmcp import Client
            from fastmcp.client.transports import StreamableHttpTransport

            self._transport = StreamableHttpTransport(
                url=self.base_url, headers=headers, auth=auth
            )
            self._client: Any = Client(
                self._transport, name=client_name, timeout=timeout
            )
        else:
            self._client = None

    async def __aenter__(self) -> NegentropyPerceivesClient:
        await self.connect()
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        await self.close()

    # ── Connection management ──

    async def connect(self) -> None:
        """Connect to the remote MCP service (no-op in direct mode)."""
        if self._mode == "direct":
            self._connected = True
            return
        if self._connected:
            return
        try:
            await self._client.__aenter__()
            self._connected = True
        except Exception as exc:  # pragma: no cover - delegated to FastMCP
            raise NegentropyPerceivesConnectionError(
                f"Failed to connect to negentropy-perceives service at {self.base_url}"
            ) from exc

    async def close(self) -> None:
        """Close the underlying client session."""
        if not self._connected:
            return
        try:
            if self._mode == "mcp" and self._client is not None:
                await self._client.__aexit__(None, None, None)
        finally:
            self._connected = False

    # ── Low-level tool call (MCP mode only) ──

    async def list_tools(self) -> list[Any]:
        """List server tools (MCP mode only)."""
        if self._mode == "direct":
            raise NegentropyPerceivesError(
                "list_tools() is not available in direct mode"
            )
        await self.connect()
        try:
            return await self._client.list_tools()
        except Exception as exc:  # pragma: no cover - delegated to FastMCP
            raise NegentropyPerceivesConnectionError(
                "Failed to list tools from negentropy-perceives service"
            ) from exc

    async def call_tool(
        self,
        name: str,
        arguments: dict[str, Any] | None = None,
        *,
        timeout: float | int | None = None,
        raise_on_error: bool = True,
        meta: dict[str, Any] | None = None,
    ) -> Any:
        """Call an arbitrary MCP tool (MCP mode only)."""
        if self._mode == "direct":
            raise NegentropyPerceivesError(
                "call_tool() is not available in direct mode. Use typed methods instead."
            )
        await self.connect()
        try:
            return await self._client.call_tool(
                name,
                arguments or {},
                timeout=timeout,
                raise_on_error=raise_on_error,
                meta=meta,
            )
        except Exception as exc:  # pragma: no cover - delegated to FastMCP
            raise NegentropyPerceivesToolError(
                f"Tool '{name}' failed on negentropy-perceives service"
            ) from exc

    # ── Typed convenience methods ──

    async def discover_links(
        self,
        *,
        url: str,
        filter_domains: list[str] | None = None,
        exclude_domains: list[str] | None = None,
        internal_only: bool = False,
    ) -> LinksResponse:
        """Discover and filter hyperlinks from a web page."""
        if self._mode == "direct":
            from .core.services import web_scraper
            from .ops.discovery import discover_links as _op

            return await _op(
                url=url,
                filter_domains=filter_domains,
                exclude_domains=exclude_domains,
                internal_only=internal_only,
                web_scraper=web_scraper,
            )
        return await self.call_tool(
            "discover_links",
            {
                "url": url,
                "filter_domains": filter_domains,
                "exclude_domains": exclude_domains,
                "internal_only": internal_only,
            },
        )

    async def inspect_page(
        self,
        *,
        url: str,
    ) -> PageInfoResponse:
        """Inspect a web page for metadata and accessibility status."""
        if self._mode == "direct":
            from .core.services import web_scraper
            from .ops.discovery import inspect_page as _op

            return await _op(url=url, web_scraper=web_scraper)
        return await self.call_tool("inspect_page", {"url": url})

    async def parse_webpage_to_markdown(
        self,
        *,
        url: str,
        method: ScrapeMethod = "auto",
        extract_main_content: bool = True,
        include_metadata: bool = True,
        custom_options: dict[str, Any] | None = None,
        wait_for_element: str | None = None,
        formatting_options: dict[str, bool] | None = None,
        embed_images: bool = False,
        embed_options: dict[str, Any] | None = None,
    ) -> MarkdownResponse:
        """Parse a web page into structured Markdown."""
        if self._mode == "direct":
            from .core.services import markdown_converter, web_scraper
            from .ops.markdown import parse_webpage_to_markdown as _op

            return await _op(
                url=url,
                method=method,
                extract_main_content=extract_main_content,
                include_metadata=include_metadata,
                custom_options=custom_options,
                wait_for_element=wait_for_element,
                formatting_options=formatting_options,
                embed_images=embed_images,
                embed_options=embed_options,
                web_scraper=web_scraper,
                markdown_converter=markdown_converter,
            )
        return await self.call_tool(
            "parse_webpage_to_markdown",
            {
                "url": url,
                "method": method,
                "extract_main_content": extract_main_content,
                "include_metadata": include_metadata,
                "custom_options": custom_options,
                "wait_for_element": wait_for_element,
                "formatting_options": formatting_options,
                "embed_images": embed_images,
                "embed_options": embed_options,
            },
        )

    async def parse_webpages_to_markdown(
        self,
        *,
        urls: list[str],
        method: ScrapeMethod = "auto",
        extract_main_content: bool = True,
        include_metadata: bool = True,
        custom_options: dict[str, Any] | None = None,
        embed_images: bool = False,
        embed_options: dict[str, Any] | None = None,
    ) -> BatchMarkdownResponse:
        """Parse multiple web pages into Markdown format concurrently."""
        if self._mode == "direct":
            from .core.services import markdown_converter, web_scraper
            from .ops.markdown import parse_webpages_to_markdown as _op

            return await _op(
                urls=urls,
                method=method,
                extract_main_content=extract_main_content,
                include_metadata=include_metadata,
                custom_options=custom_options,
                embed_images=embed_images,
                embed_options=embed_options,
                web_scraper=web_scraper,
                markdown_converter=markdown_converter,
            )
        return await self.call_tool(
            "parse_webpages_to_markdown",
            {
                "urls": urls,
                "method": method,
                "extract_main_content": extract_main_content,
                "include_metadata": include_metadata,
                "custom_options": custom_options,
                "embed_images": embed_images,
                "embed_options": embed_options,
            },
        )

    async def parse_pdf_to_markdown(
        self,
        *,
        pdf_source: str,
        method: PDFMethod = "auto",
        include_metadata: bool = True,
        page_range: list[int] | None = None,
        output_format: PDFOutputFormat = "markdown",
        extract_images: bool = True,
        extract_tables: bool = True,
        extract_formulas: bool = True,
        embed_images: bool = False,
        enhanced_options: dict[str, Any] | None = None,
    ) -> PDFResponse:
        """Parse a PDF document into structured Markdown."""
        if self._mode == "direct":
            from .ops.pdf import parse_pdf_to_markdown as _op

            return await _op(
                pdf_source=pdf_source,
                method=method,
                include_metadata=include_metadata,
                page_range=page_range,
                output_format=output_format,
                extract_images=extract_images,
                extract_tables=extract_tables,
                extract_formulas=extract_formulas,
                embed_images=embed_images,
                enhanced_options=enhanced_options,
            )
        return await self.call_tool(
            "parse_pdf_to_markdown",
            {
                "pdf_source": pdf_source,
                "method": method,
                "include_metadata": include_metadata,
                "page_range": page_range,
                "output_format": output_format,
                "extract_images": extract_images,
                "extract_tables": extract_tables,
                "extract_formulas": extract_formulas,
                "embed_images": embed_images,
                "enhanced_options": enhanced_options,
            },
        )

    async def parse_pdfs_to_markdown(
        self,
        *,
        pdf_sources: list[str],
        method: PDFMethod = "auto",
        include_metadata: bool = True,
        page_range: list[int] | None = None,
        output_format: PDFOutputFormat = "markdown",
        extract_images: bool = True,
        extract_tables: bool = True,
        extract_formulas: bool = True,
        embed_images: bool = False,
        enhanced_options: dict[str, Any] | None = None,
    ) -> BatchPDFResponse:
        """Parse multiple PDF documents into Markdown format concurrently."""
        if self._mode == "direct":
            from .ops.pdf import parse_pdfs_to_markdown as _op

            return await _op(
                pdf_sources=pdf_sources,
                method=method,
                include_metadata=include_metadata,
                page_range=page_range,
                output_format=output_format,
                extract_images=extract_images,
                extract_tables=extract_tables,
                extract_formulas=extract_formulas,
                embed_images=embed_images,
                enhanced_options=enhanced_options,
            )
        return await self.call_tool(
            "parse_pdfs_to_markdown",
            {
                "pdf_sources": pdf_sources,
                "method": method,
                "include_metadata": include_metadata,
                "page_range": page_range,
                "output_format": output_format,
                "extract_images": extract_images,
                "extract_tables": extract_tables,
                "extract_formulas": extract_formulas,
                "embed_images": embed_images,
                "enhanced_options": enhanced_options,
            },
        )
