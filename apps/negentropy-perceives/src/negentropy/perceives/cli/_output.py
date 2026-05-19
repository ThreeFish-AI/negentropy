"""CLI 输出格式化工具。"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel


def format_result(result: Any, format: str = "json") -> str:
    """将操作结果格式化为指定输出格式。

    Args:
        result: Pydantic 模型或字典结果
        format: 输出格式 (json/markdown/plain)
    """
    if isinstance(result, BaseModel):
        data = result.model_dump()
    elif isinstance(result, dict):
        data = result
    else:
        return str(result)

    if format == "json":
        return json.dumps(data, ensure_ascii=False, indent=2, default=str)

    if format == "markdown":
        return _format_as_markdown(data)

    return _format_as_plain(data)


def _format_as_markdown(data: dict[str, Any]) -> str:
    """将结果格式化为 Markdown 文本。"""
    lines: list[str] = []

    # 标题
    url = data.get("url") or data.get("pdf_source") or data.get("source_url", "")
    if url:
        lines.append(f"## {url}")
        lines.append("")

    # 成功/失败状态
    success = data.get("success", False)
    status = "Success" if success else "Failed"
    lines.append(f"**Status**: {status}")
    lines.append("")

    # 错误信息
    error = data.get("error")
    if error:
        lines.append(f"**Error**: {error}")
        lines.append("")

    # 内容
    content = data.get("markdown_content") or data.get("content", "")
    if content:
        lines.append("---")
        lines.append("")
        lines.append(content)

    # 统计信息
    stats = _extract_stats(data)
    if stats:
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("### Statistics")
        lines.append("")
        for key, value in stats.items():
            lines.append(f"- **{key}**: {value}")

    # 批量结果摘要
    results = data.get("results", [])
    if results:
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append(f"### Results ({len(results)} items)")
        lines.append("")
        for i, item in enumerate(results, 1):
            item_url = item.get("url") or item.get("pdf_source", f"Item {i}")
            item_success = item.get("success", False)
            lines.append(f"{i}. {'OK' if item_success else 'FAIL'} — {item_url}")

    return "\n".join(lines)


def _format_as_plain(data: dict[str, Any]) -> str:
    """将结果格式化为纯文本。"""
    lines: list[str] = []

    success = data.get("success", False)
    lines.append(f"Status: {'Success' if success else 'Failed'}")

    url = data.get("url") or data.get("pdf_source") or ""
    if url:
        lines.append(f"URL: {url}")

    error = data.get("error")
    if error:
        lines.append(f"Error: {error}")

    content = data.get("markdown_content") or data.get("content", "")
    if content:
        lines.append("")
        lines.append(content)

    stats = _extract_stats(data)
    for key, value in stats.items():
        lines.append(f"{key}: {value}")

    return "\n".join(lines)


def _extract_stats(data: dict[str, Any]) -> dict[str, Any]:
    """提取统计信息。"""
    stat_keys = [
        "total_links",
        "internal_links_count",
        "external_links_count",
        "word_count",
        "page_count",
        "conversion_time",
        "method",
        "status_code",
        "total_urls",
        "successful_count",
        "failed_count",
        "total_pdfs",
        "total_pages",
        "total_word_count",
        "total_conversion_time",
    ]
    return {k: data[k] for k in stat_keys if k in data}
