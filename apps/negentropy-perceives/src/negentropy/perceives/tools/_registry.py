"""MCP 工具注册枢纽。"""

import logging

from fastmcp import FastMCP

from ..config import settings
from ..core import (
    PDFMethod,
    PDFOutputFormat,
    ScrapeMethod,
    create_pdf_processor,
    elapsed_ms,
    markdown_converter,
    normalize_extract_config,
    validate_page_range,
    validate_url,
    web_scraper,
)

logger = logging.getLogger(__name__)

__all__ = [
    # 类型别名
    "ScrapeMethod",
    "PDFMethod",
    "PDFOutputFormat",
    # FastMCP 实例
    "app",
    # 共享服务实例（从 core re-export）
    "web_scraper",
    "markdown_converter",
    # 工厂函数（从 core re-export）
    "create_pdf_processor",
    # 辅助函数（从 core re-export）
    "validate_url",
    "validate_page_range",
    "normalize_extract_config",
    "elapsed_ms",
]

# FastMCP application instance
app = FastMCP(settings.server_name, version=settings.server_version)

# 注册任务级上下文中间件：在每次工具调用入口绑定 task_id / source / timing，
# 并在出口输出任务完成摘要。
from ._middleware import TaskContextMiddleware  # noqa: E402

app.add_middleware(TaskContextMiddleware())
