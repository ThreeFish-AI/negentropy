"""S2: 网页获取 — 三级降级链获取完整 HTML。

降级顺序：
1. ``aiohttp`` — 轻量级异步 HTTP 获取
2. ``playwright`` — Playwright 浏览器渲染
3. ``selenium`` — Selenium 浏览器渲染

委托给现有 ``scraping.engine`` 模块中的 ``HttpScraper`` / ``SeleniumScraper``
以及 ``scraping.browser`` 模块中的 ``playwright_session``。
"""

from __future__ import annotations

import logging
from typing import Dict

from ...base import StageResult
from ...models import StageContext
from ...registry import register_tool
from .._base import WebToolBase

logger = logging.getLogger(__name__)


@register_tool("aiohttp")
class AiohttpFetchTool(WebToolBase):
    """基于 aiohttp 的轻量级异步 HTTP 获取工具。"""

    tool_name = "aiohttp"

    def is_available(self) -> bool:
        try:
            import aiohttp  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 aiohttp 获取网页 HTML。"""
        import aiohttp

        url = ctx.url
        timeout_sec = ctx.config.get("request_timeout", 30)

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    timeout=aiohttp.ClientTimeout(total=timeout_sec),
                    headers={
                        "User-Agent": ctx.config.get(
                            "user_agent",
                            "Mozilla/5.0 (compatible; NegentropyCrawler/1.0)",
                        )
                    },
                ) as resp:
                    resp.raise_for_status()
                    html = await resp.text()

            ctx.raw_html = html

            # 尝试提取标题
            _extract_title_from_html(ctx)

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"status_code": resp.status, "content_length": len(html)},
            )
        except Exception as e:
            logger.warning("aiohttp 获取失败 (%s): %s", url, e)
            return StageResult(
                success=False,
                error=f"aiohttp 获取失败: {e}",
                engine_used=self.tool_name,
            )


@register_tool("playwright")
class PlaywrightFetchTool(WebToolBase):
    """基于 Playwright 的浏览器渲染获取工具。"""

    tool_name = "playwright"

    def is_available(self) -> bool:
        try:
            import playwright  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 Playwright 渲染并获取网页 HTML。"""
        from ....scraping.browser import playwright_session

        url = ctx.url
        wait_for = ctx.config.get("wait_for_element")

        try:
            async with playwright_session(url, wait_for_element=wait_for) as page:
                html = await page.content()
                title = await page.title()

            ctx.raw_html = html
            if title:
                ctx.title = title

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"content_length": len(html)},
            )
        except Exception as e:
            logger.warning("Playwright 获取失败 (%s): %s", url, e)
            return StageResult(
                success=False,
                error=f"Playwright 获取失败: {e}",
                engine_used=self.tool_name,
            )


@register_tool("selenium")
class SeleniumFetchTool(WebToolBase):
    """基于 Selenium 的浏览器渲染获取工具。

    委托给现有 ``scraping.engine.SeleniumScraper``。
    """

    tool_name = "selenium"

    def is_available(self) -> bool:
        try:
            from selenium import webdriver  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 Selenium 渲染并获取网页 HTML。"""
        from ....scraping.engine import SeleniumScraper

        url = ctx.url
        wait_for = ctx.config.get("wait_for_element")

        try:
            scraper = SeleniumScraper()
            result = await scraper.scrape(url, wait_for_element=wait_for)

            if "error" in result:
                return StageResult(
                    success=False,
                    error=f"Selenium 获取失败: {result['error']}",
                    engine_used=self.tool_name,
                )

            # Selenium 返回的是解析后的结构，需提取 HTML
            html = result.get("content", {}).get("html", "")
            if not html:
                # 回退：使用 page_source
                html = result.get("page_source", "")

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
            logger.warning("Selenium 获取失败 (%s): %s", url, e)
            return StageResult(
                success=False,
                error=f"Selenium 获取失败: {e}",
                engine_used=self.tool_name,
            )


def _extract_title_from_html(ctx: StageContext) -> None:
    """从 raw_html 中提取页面标题（轻量级解析）。"""
    if ctx.title:
        return
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(ctx.raw_html[:10000], "html.parser")
        title_tag = soup.find("title")
        if title_tag:
            ctx.title = title_tag.get_text(strip=True)
    except Exception:
        logger.debug("HTML title 提取失败", exc_info=True)


# Stage 本地工具映射
TOOLS: Dict[str, type] = {
    "aiohttp": AiohttpFetchTool,
    "playwright": PlaywrightFetchTool,
    "selenium": SeleniumFetchTool,
}

STAGE_ID = "page_fetching"
STAGE_NAME = "网页获取"
