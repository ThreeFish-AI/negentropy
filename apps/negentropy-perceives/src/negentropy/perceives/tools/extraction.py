"""MCP 工具: 链接发现与页面检查。"""

from typing import Annotated, List, Optional

from pydantic import Field

from ..ops.discovery import discover_links as _discover_links
from ..ops.discovery import inspect_page as _inspect_page
from ..models import LinksResponse, PageInfoResponse
from ._registry import app, web_scraper


@app.tool()
async def discover_links(
    url: Annotated[
        str,
        Field(
            ...,
            description="""目标网页 URL，必须包含协议前缀（http://或https://），将从此页面发现所有链接。
                支持 http 和 https 协议的有效 URL 格式""",
        ),
    ],
    filter_domains: Annotated[
        Optional[List[str]],
        Field(
            default=None,
            description="""白名单域名列表，仅包含这些域名的链接。设置后只返回指定域名的链接。
                示例：["example.com", "subdomain.example.com", "blog.example.org"]""",
        ),
    ],
    exclude_domains: Annotated[
        Optional[List[str]],
        Field(
            default=None,
            description="""黑名单域名列表，排除这些域名的链接。用于过滤广告、跟踪器等不需要的外部链接。
                示例：["ads.com", "tracker.net", "analytics.google.com"]""",
        ),
    ],
    internal_only: Annotated[
        bool,
        Field(
            default=False,
            description="是否仅发现内部链接（同域名链接）。设为 True 时只返回与源页面相同域名的链接，忽略所有外部链接",
        ),
    ],
) -> LinksResponse:
    """
    Discover and filter hyperlinks from a web page.

    This tool performs site topology discovery, extracting and categorizing
    hyperlinks from any accessible web page. Supports domain-based filtering
    for link auditing and site mapping.

    Capabilities:
    - Extract all hyperlinks from any accessible web page
    - Filter by domain whitelist or blacklist
    - Classify links as internal (same domain) or external

    Use Cases:
    - Site auditing and link inventory
    - SEO analysis of internal/external link ratios
    - Identifying broken or suspicious outbound links

    Returns:
        LinksResponse with categorized link list and statistics.
    """
    return await _discover_links(
        url=url,
        filter_domains=filter_domains,
        exclude_domains=exclude_domains,
        internal_only=internal_only,
        web_scraper=web_scraper,
    )


@app.tool()
async def inspect_page(
    url: Annotated[
        str,
        Field(
            ...,
            description="""目标网页 URL，必须包含协议前缀（http://或https://），用于获取页面基础信息和元数据。
                这是一个轻量级工具，不会提取完整页面内容""",
        ),
    ],
) -> PageInfoResponse:
    """
    Inspect a web page for metadata and accessibility status.

    A lightweight diagnostic tool for quickly checking page accessibility
    and extracting basic metadata without full content extraction.

    Capabilities:
    - Check page HTTP status code
    - Extract title and meta description
    - Report content type and size

    Use Cases:
    - Quick page health check before full extraction
    - URL validation and redirect detection
    - SEO metadata auditing

    Returns:
        PageInfoResponse with page metadata and status information.
    """
    return await _inspect_page(url=url, web_scraper=web_scraper)
