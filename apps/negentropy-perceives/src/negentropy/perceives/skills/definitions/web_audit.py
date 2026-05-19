"""Web 审计技能: 组合链接发现与页面健康检查。"""

from __future__ import annotations

from typing import Any

from .._base import Skill, SkillMetadata
from .._registry import register_skill


@register_skill
class WebAuditSkill(Skill):
    """站点审计技能，组合链接发现与页面检查。

    工作流:
    1. 对起始 URL 执行 discover_links，获取全部链接
    2. 对前 N 个内部链接逐个执行 inspect_page
    3. 汇总生成审计报告
    """

    @classmethod
    def metadata(cls) -> SkillMetadata:
        return SkillMetadata(
            name="web_audit",
            display_name="Web Site Audit",
            description=(
                "Audit a website by discovering all links and checking page health. "
                "Returns a comprehensive report with link inventory, broken link detection, "
                "and page metadata summary."
            ),
            category="composite",
            input_schema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "Starting URL for audit",
                    },
                    "max_pages": {
                        "type": "integer",
                        "default": 10,
                        "description": "Max pages to inspect",
                    },
                    "filter_domains": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Only audit links from these domains",
                    },
                },
                "required": ["url"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "source_url": {"type": "string"},
                    "total_links": {"type": "integer"},
                    "link_inventory": {"type": "array"},
                    "page_health": {"type": "array"},
                    "broken_pages": {"type": "array"},
                    "summary": {"type": "object"},
                },
            },
            requires=["discover_links", "inspect_page"],
            tags=["audit", "seo", "links", "health-check"],
        )

    @classmethod
    async def execute(cls, **kwargs: Any) -> dict[str, Any]:
        """执行站点审计。

        Args:
            url: 起始 URL
            max_pages: 最大检查页面数（默认 10）
            filter_domains: 域名过滤列表
        """
        url = kwargs.get("url")
        max_pages = kwargs.get("max_pages", 10)

        if not url:
            return {"success": False, "error": "Missing required parameter: url"}

        from ...core.services import web_scraper
        from ...ops.discovery import discover_links, inspect_page

        # Step 1: 发现所有链接
        links_result = await discover_links(url=url, web_scraper=web_scraper)

        if not links_result.success:
            return {
                "success": False,
                "error": f"Failed to discover links: {links_result.error}",
            }

        # Step 2: 对内部链接执行页面检查
        internal_urls = [link.url for link in links_result.links if link.is_internal][
            :max_pages
        ]

        page_health = []
        for page_url in internal_urls:
            report = await inspect_page(url=page_url, web_scraper=web_scraper)
            page_health.append(
                {
                    "url": report.url,
                    "success": report.success,
                    "status_code": report.status_code,
                    "title": report.title,
                    "error": report.error,
                }
            )

        broken_pages = [p for p in page_health if not p["success"]]

        return {
            "success": True,
            "source_url": url,
            "total_links": links_result.total_links,
            "internal_links_count": links_result.internal_links_count,
            "external_links_count": links_result.external_links_count,
            "link_inventory": [
                {"url": link.url, "text": link.text, "is_internal": link.is_internal}
                for link in links_result.links
            ],
            "pages_inspected": len(page_health),
            "page_health": page_health,
            "broken_pages": broken_pages,
            "summary": {
                "total_links": links_result.total_links,
                "internal_links": links_result.internal_links_count,
                "external_links": links_result.external_links_count,
                "pages_inspected": len(page_health),
                "broken_pages": len(broken_pages),
            },
        }
