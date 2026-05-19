"""Core operations: 链接发现与页面检查。"""

import logging
from typing import List, Optional
from urllib.parse import urlparse

from ..infra.parsing import validate_url
from ..models import LinkItem, LinksResponse, PageInfoResponse
from ..scraping import WebScraper

logger = logging.getLogger(__name__)


async def discover_links(
    url: str,
    *,
    filter_domains: Optional[List[str]] = None,
    exclude_domains: Optional[List[str]] = None,
    internal_only: bool = False,
    web_scraper: WebScraper,
) -> LinksResponse:
    """从网页中发现并过滤链接。

    Args:
        url: 目标网页 URL
        filter_domains: 白名单域名列表，仅包含这些域名的链接
        exclude_domains: 黑名单域名列表，排除这些域名的链接
        internal_only: 是否仅保留同域名链接
        web_scraper: WebScraper 实例（依赖注入）

    Returns:
        LinksResponse 包含分类链接列表和统计信息
    """
    try:
        url_error = validate_url(url)
        if url_error:
            raise ValueError(url_error)

        logger.info("Discovering links from: %s", url)

        scrape_result = await web_scraper.scrape_url(url=url, method="simple")

        if "error" in scrape_result:
            return LinksResponse(
                success=False,
                url=url,
                total_links=0,
                links=[],
                internal_links_count=0,
                external_links_count=0,
                error=scrape_result["error"],
            )

        all_links = scrape_result.get("content", {}).get("links", [])
        base_domain = urlparse(url).netloc

        filtered_links = []
        for link in all_links:
            link_url = link.get("url", "")
            if not link_url:
                continue

            link_domain = urlparse(link_url).netloc

            if internal_only and link_domain != base_domain:
                continue
            if filter_domains and link_domain not in filter_domains:
                continue
            if exclude_domains and link_domain in exclude_domains:
                continue

            filtered_links.append(
                LinkItem(
                    url=link_url,
                    text=link.get("text", "").strip(),
                    is_internal=link_domain == base_domain,
                )
            )

        internal_count = sum(1 for link in filtered_links if link.is_internal)
        external_count = len(filtered_links) - internal_count

        return LinksResponse(
            success=True,
            url=url,
            total_links=len(filtered_links),
            links=filtered_links,
            internal_links_count=internal_count,
            external_links_count=external_count,
        )

    except Exception as e:
        logger.error("Error discovering links from %s: %s", url, str(e))
        return LinksResponse(
            success=False,
            url=url,
            total_links=0,
            links=[],
            internal_links_count=0,
            external_links_count=0,
            error=str(e),
        )


async def inspect_page(
    url: str,
    *,
    web_scraper: WebScraper,
) -> PageInfoResponse:
    """检查页面元数据与可访问性。

    轻量级操作，不提取完整页面内容，适合快速预检。

    Args:
        url: 目标网页 URL
        web_scraper: WebScraper 实例（依赖注入）

    Returns:
        PageInfoResponse 包含标题、描述、状态码等元数据
    """
    try:
        url_error = validate_url(url)
        if url_error:
            raise ValueError(url_error)

        logger.info("Inspecting page: %s", url)

        result = await web_scraper.http_scraper.scrape(url, extract_config={})

        if "error" in result:
            return PageInfoResponse(
                success=False, url=url, status_code=0, error=result["error"]
            )

        return PageInfoResponse(
            success=True,
            url=result.get("url", url),
            title=result.get("title"),
            description=result.get("meta_description"),
            status_code=result.get("status_code", 200),
            content_type=result.get("content_type"),
            content_length=result.get("content_length"),
        )

    except Exception as e:
        logger.error("Error inspecting page %s: %s", url, str(e))
        return PageInfoResponse(success=False, url=url, status_code=0, error=str(e))
