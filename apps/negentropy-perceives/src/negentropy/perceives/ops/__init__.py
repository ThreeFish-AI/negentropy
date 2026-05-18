"""Core operations: 共享业务逻辑，供 MCP / SDK / CLI / Skills 调用。

所有端点共享同一套核心操作函数，确保行为一致性。
"""

from .discovery import discover_links, inspect_page
from .markdown import parse_webpage_to_markdown, parse_webpages_to_markdown
from .pdf import parse_pdf_to_markdown, parse_pdfs_to_markdown

__all__ = [
    "discover_links",
    "inspect_page",
    "parse_webpage_to_markdown",
    "parse_webpages_to_markdown",
    "parse_pdf_to_markdown",
    "parse_pdfs_to_markdown",
]
