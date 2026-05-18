"""S3: 反检测降级 — 使用隐身浏览器技术绕过反爬检测。

仅在 S2（网页获取）失败时触发。委托给现有
``scraping.anti_detection.AntiDetectionScraper``。

工具降级链：
1. ``playwright_stealth`` — Playwright 隐身模式
2. ``undetected_chromedriver`` — undetected-chromedriver + Selenium
"""

from __future__ import annotations

import logging
from typing import Dict

from ...base import StageResult
from ...models import StageContext
from ...registry import register_tool
from .._base import WebToolBase

logger = logging.getLogger(__name__)


@register_tool("playwright_stealth")
class PlaywrightStealthTool(WebToolBase):
    """基于 Playwright 隐身注入的反检测工具。

    委托给 ``scraping.anti_detection.AntiDetectionScraper`` 的 Playwright 路径。
    """

    tool_name = "playwright_stealth"

    def is_available(self) -> bool:
        try:
            import playwright  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 Playwright 隐身模式获取网页 HTML。"""
        from ....scraping.anti_detection import AntiDetectionScraper

        url = ctx.url
        wait_for = ctx.config.get("wait_for_element")
        scroll = ctx.config.get("scroll_page", False)

        try:
            scraper = AntiDetectionScraper()
            result = await scraper.scrape_with_stealth(
                url=url,
                method="playwright",
                wait_for_element=wait_for,
                scroll_page=scroll,
            )

            if "error" in result:
                return StageResult(
                    success=False,
                    error=f"Playwright 隐身获取失败: {result['error']}",
                    engine_used=self.tool_name,
                )

            html = result.get("content", {}).get("html", "")
            if html:
                ctx.raw_html = html
            if result.get("title"):
                ctx.title = result["title"]

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"content_length": len(ctx.raw_html)},
            )
        except Exception as e:
            logger.warning("Playwright 隐身获取失败 (%s): %s", url, e)
            return StageResult(
                success=False,
                error=f"Playwright 隐身获取失败: {e}",
                engine_used=self.tool_name,
            )


@register_tool("undetected_chromedriver")
class UndetectedChromeDriverTool(WebToolBase):
    """基于 undetected-chromedriver 的反检测工具。

    委托给 ``scraping.anti_detection.AntiDetectionScraper`` 的 Selenium 路径。
    """

    tool_name = "undetected_chromedriver"

    def is_available(self) -> bool:
        try:
            import undetected_chromedriver  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 undetected-chromedriver 获取网页 HTML。"""
        from ....scraping.anti_detection import AntiDetectionScraper

        url = ctx.url
        wait_for = ctx.config.get("wait_for_element")
        scroll = ctx.config.get("scroll_page", False)

        try:
            scraper = AntiDetectionScraper()
            result = await scraper.scrape_with_stealth(
                url=url,
                method="selenium",
                wait_for_element=wait_for,
                scroll_page=scroll,
            )

            if "error" in result:
                return StageResult(
                    success=False,
                    error=f"undetected-chromedriver 获取失败: {result['error']}",
                    engine_used=self.tool_name,
                )

            html = result.get("content", {}).get("html", "")
            if html:
                ctx.raw_html = html
            if result.get("title"):
                ctx.title = result["title"]

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"content_length": len(ctx.raw_html)},
            )
        except Exception as e:
            logger.warning("undetected-chromedriver 获取失败 (%s): %s", url, e)
            return StageResult(
                success=False,
                error=f"undetected-chromedriver 获取失败: {e}",
                engine_used=self.tool_name,
            )


# Stage 本地工具映射
TOOLS: Dict[str, type] = {
    "playwright_stealth": PlaywrightStealthTool,
    "undetected_chromedriver": UndetectedChromeDriverTool,
}

STAGE_ID = "anti_detection"
STAGE_NAME = "反检测降级"
