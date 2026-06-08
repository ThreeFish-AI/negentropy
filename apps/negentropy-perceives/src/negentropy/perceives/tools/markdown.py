"""MCP 工具: 网页解析为 Markdown。"""

from typing import Annotated, Any, Dict, List, Optional

from pydantic import Field

from ..ops.markdown import parse_webpage_to_markdown as _parse_webpage
from ..ops.markdown import parse_webpages_to_markdown as _parse_webpages
from ..models import BatchMarkdownResponse, MarkdownResponse
from ._registry import ScrapeMethod, app, markdown_converter, web_scraper


@app.tool()
async def parse_webpage_to_markdown(
    url: Annotated[
        str,
        Field(
            ...,
            description="目标网页URL，必须包含协议前缀（http:// 或 https://），将抓取并解析为 Markdown 格式",
        ),
    ],
    method: Annotated[
        ScrapeMethod,
        Field(
            default="auto",
            description="""抓取方法选择，可选值：
                "auto"（自动选择最佳方法）、
                "simple"（快速 HTTP 请求，不支持 JavaScript）、
                "scrapy"（Scrapy 框架，适合大规模抓取）、
                "selenium"（浏览器渲染，支持 JavaScript）""",
        ),
    ],
    extract_main_content: Annotated[
        bool,
        Field(
            default=True,
            description="是否仅提取主要内容区域，设为 True 时排除导航、广告、侧边栏等非主要内容",
        ),
    ],
    include_metadata: Annotated[
        bool,
        Field(
            default=True, description="是否在结果中包含页面元数据（标题、描述、字数等）"
        ),
    ],
    custom_options: Annotated[
        Optional[Dict[str, Any]],
        Field(
            default=None,
            description="自定义 Markdown 转换选项，支持 markitdown 库的各种参数配置",
        ),
    ],
    wait_for_element: Annotated[
        Optional[str],
        Field(
            default=None,
            description="""Selenium模式下等待加载的元素CSS选择器。
                示例：".content"、"#main-article\"""",
        ),
    ],
    formatting_options: Annotated[
        Optional[Dict[str, bool]],
        Field(
            default=None,
            description="""高级格式化选项，如表格对齐、代码检测等。
                示例：{"table_alignment": True, "code_detection": True}""",
        ),
    ],
    embed_images: Annotated[
        bool,
        Field(default=False, description="是否嵌入图片作为数据 URI，默认值：False"),
    ],
    embed_options: Annotated[
        Optional[Dict[str, Any]],
        Field(
            default=None,
            description="""图片嵌入选项配置。
                示例：{"max_bytes_per_image": 100000, "allowed_types": ["png", "jpg"]}""",
        ),
    ],
    timeout: Annotated[
        Optional[int],
        Field(
            default=None,
            ge=1,
            description="任务级超时秒数。为空则使用配置 task_timeout_seconds（默认 900s / 15 min），超时后优雅返回错误并取消子任务。",
        ),
    ] = None,
) -> MarkdownResponse:
    """
    Parse a web page into structured Markdown.

    This tool combines web scraping with Markdown conversion to provide clean,
    readable text format suitable for documentation, analysis, or storage.

    Capabilities:
    - Automatic main content extraction (removes nav, ads, etc.)
    - Customizable Markdown formatting options
    - Metadata extraction (title, description, word count, etc.)
    - Support for all scraping methods
    - Advanced formatting and image embedding
    - Task-level timeout with graceful cancellation

    Returns:
        MarkdownResponse with Markdown content, metadata, and conversion stats.
    """
    return await _parse_webpage(
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
        timeout=timeout,
    )


@app.tool()
async def parse_webpages_to_markdown(
    urls: Annotated[
        List[str],
        Field(
            ...,
            description="要批量解析为 Markdown 的 URL 列表，每个 URL 必须包含协议前缀，支持并发处理以提高效率",
        ),
    ],
    method: Annotated[
        ScrapeMethod,
        Field(
            default="auto",
            description="""统一的抓取方法：
                "auto"（智能选择最佳方法）、
                "simple"（轻量级 HTTP 请求）、
                "scrapy"（适合大批量抓取）、
                "selenium"（支持 JavaScript 动态页面）""",
        ),
    ],
    extract_main_content: Annotated[
        bool,
        Field(
            default=True,
            description="是否统一提取主要内容区域，过滤掉导航、广告、页脚等非核心内容，获得更纯净的 Markdown 文档",
        ),
    ],
    include_metadata: Annotated[
        bool,
        Field(
            default=True,
            description="是否在每个转换结果中包含页面元数据，包含标题、URL、字数、处理时间等信息",
        ),
    ],
    custom_options: Annotated[
        Optional[Dict[str, Any]],
        Field(
            default=None,
            description="""统一的 markitdown 自定义选项，应用于所有 URL。支持 HTML 标签处理、格式化选项等。
                示例：{"strip": ["nav", "footer"], "convert": ["article"]}""",
        ),
    ],
    embed_images: Annotated[
        bool,
        Field(
            default=False,
            description="是否在所有页面中嵌入图片作为数据 URI，默认值：False",
        ),
    ],
    embed_options: Annotated[
        Optional[Dict[str, Any]],
        Field(
            default=None,
            description="""统一的图片嵌入选项配置，应用于所有 URL。
                示例：{"max_bytes_per_image": 100000}""",
        ),
    ],
    timeout: Annotated[
        Optional[int],
        Field(
            default=None,
            ge=1,
            description="整批任务级超时秒数（整批共用）。为空则使用配置 task_timeout_seconds（默认 900s / 15 min）。",
        ),
    ] = None,
) -> BatchMarkdownResponse:
    """
    Parse multiple web pages into Markdown format concurrently.

    This tool provides batch processing for converting multiple web pages to Markdown.
    It processes all URLs concurrently for better performance.

    Capabilities:
    - Concurrent processing of multiple URLs
    - Consistent formatting across all converted pages
    - Detailed summary statistics
    - Error handling for individual failures
    - Batch-level timeout with graceful cancellation

    Returns:
        BatchMarkdownResponse with batch results and summary statistics.
    """
    return await _parse_webpages(
        urls=urls,
        method=method,
        extract_main_content=extract_main_content,
        include_metadata=include_metadata,
        custom_options=custom_options,
        embed_images=embed_images,
        embed_options=embed_options,
        web_scraper=web_scraper,
        markdown_converter=markdown_converter,
        timeout=timeout,
    )
