#!/usr/bin/env python3
"""
Negentropy Perceives MCP 服务器基础用法示例。

本脚本演示如何以编程方式使用各种抓取工具。
注意：仅供演示使用。实际使用中，MCP 服务器将通过 MCP 客户端（如 Claude Desktop）调用。
"""

import asyncio
import json
from typing import Any


# ---------------------------------------------------------------------------
# Mock MCP 客户端调用 —— 生产环境中替换为真实 MCP 客户端
# ---------------------------------------------------------------------------
async def mock_mcp_call(tool_name: str, params: dict[str, Any]) -> dict[str, Any]:
    """模拟 MCP 工具调用，返回 Mock 响应。"""
    print(f"Mock call to {tool_name} with params: {json.dumps(params, indent=2)}")
    return {
        "success": True,
        "data": {"message": f"Mock response from {tool_name}"},
        "duration_ms": 1000,
    }


# ---------------------------------------------------------------------------
# 示例定义：(标题, 工具名, 参数字典)
# ---------------------------------------------------------------------------
EXAMPLES: list[tuple[str, str, dict[str, Any]]] = [
    (
        "Link Discovery",
        "discover_links",
        {
            "url": "https://example.com",
            "internal_only": False,
            "filter_domains": None,
            "exclude_domains": ["spam.com", "ads.com"],
        },
    ),
    (
        "Page Inspection",
        "inspect_page",
        {"url": "https://example.com"},
    ),
    (
        "Webpage to Markdown",
        "parse_webpage_to_markdown",
        {
            "url": "https://httpbin.org/html",
            "method": "auto",
            "extract_main_content": True,
        },
    ),
    (
        "Batch Webpages to Markdown",
        "parse_webpages_to_markdown",
        {
            "urls": [
                "https://httpbin.org/html",
                "https://example.com",
            ],
            "method": "auto",
            "extract_main_content": True,
        },
    ),
    (
        "PDF to Markdown",
        "parse_pdf_to_markdown",
        {
            "pdf_source": "https://example.com/document.pdf",
            "method": "auto",
            "extract_images": True,
            "extract_tables": True,
            "extract_formulas": True,
        },
    ),
    (
        "Batch PDFs to Markdown",
        "parse_pdfs_to_markdown",
        {
            "pdf_sources": [
                "https://example.com/doc1.pdf",
                "https://example.com/doc2.pdf",
            ],
            "method": "auto",
            "extract_images": True,
            "extract_tables": True,
        },
    ),
]


# ---------------------------------------------------------------------------
# 运行器
# ---------------------------------------------------------------------------
async def _run_example(title: str, tool_name: str, params: dict[str, Any]) -> None:
    """执行单个示例：打印标题、调用 mock、打印结果。"""
    print(f"=== {title} ===")
    result = await mock_mcp_call(tool_name, params)
    print(f"Result: {json.dumps(result, indent=2)}")
    print()


async def main() -> None:
    """顺序运行所有示例。"""
    print("Negentropy Perceives MCP Server Usage Examples")
    print("=" * 50)
    print()

    for title, tool_name, params in EXAMPLES:
        try:
            await _run_example(title, tool_name, params)
        except Exception as e:
            print(f"Error in '{title}': {e}")
        await asyncio.sleep(1)

    print("All examples completed!")


if __name__ == "__main__":
    asyncio.run(main())
