"""反检测抓取模块，提供基于 Selenium 和 Playwright 的隐身抓取能力。"""

import asyncio
import random
from typing import Dict, Any, Optional
import logging

from selenium.webdriver.common.action_chains import ActionChains

from .browser import stealth_selenium_session, stealth_playwright_session
from .content_extraction import (
    extract_page_data_selenium,
    extract_page_data_playwright,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 隐身行为模拟（正交维度：与浏览器类型无关的行为策略）
# ---------------------------------------------------------------------------


async def _random_delay(min_sec: float = 1.0, max_sec: float = 3.0) -> None:
    """随机延迟，模拟人类操作间隔。"""
    await asyncio.sleep(random.uniform(min_sec, max_sec))  # nosec B311


async def _scroll_page_selenium(driver) -> None:
    """Selenium 自然滚动，触发动态内容加载。"""
    total_height = driver.execute_script("return document.body.scrollHeight")
    current_height = 0

    while current_height < total_height:
        scroll_amount = random.randint(200, 600)  # nosec B311
        driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
        await asyncio.sleep(random.uniform(0.5, 2.0))  # nosec B311
        current_height += scroll_amount

        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height > total_height:
            total_height = new_height


async def _scroll_page_playwright(page) -> None:
    """Playwright 自然滚动。"""
    await page.evaluate("""
        new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        })
    """)


async def _simulate_human_behavior_selenium(driver) -> None:
    """Selenium 人类行为模拟。"""
    try:
        actions = ActionChains(driver)
        for _ in range(random.randint(2, 5)):  # nosec B311
            x = random.randint(100, 800)  # nosec B311
            y = random.randint(100, 600)  # nosec B311
            actions.move_by_offset(x, y)
            await asyncio.sleep(random.uniform(0.1, 0.5))  # nosec B311
        actions.perform()
        await asyncio.sleep(random.uniform(1, 3))  # nosec B311
    except Exception as e:
        logger.debug(f"Error simulating human behavior: {str(e)}")


async def _simulate_human_behavior_playwright(page) -> None:
    """Playwright 人类行为模拟。"""
    try:
        for _ in range(random.randint(2, 4)):  # nosec B311
            x = random.randint(100, 800)  # nosec B311
            y = random.randint(100, 600)  # nosec B311
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.1, 0.5))  # nosec B311
        await asyncio.sleep(random.uniform(1, 2))  # nosec B311
    except Exception as e:
        logger.debug(f"Error simulating human behavior: {str(e)}")


# ---------------------------------------------------------------------------
# AntiDetectionScraper - 无状态编排层
# ---------------------------------------------------------------------------


class AntiDetectionScraper:
    """反检测抓取器，组合浏览器管理与隐身行为模拟。"""

    async def scrape_with_stealth(
        self,
        url: str,
        method: str = "selenium",
        extract_config: Optional[Dict[str, Any]] = None,
        wait_for_element: Optional[str] = None,
        scroll_page: bool = False,
    ) -> Dict[str, Any]:
        """
        Scrape using stealth techniques to avoid detection.

        Args:
            url: URL to scrape
            method: "selenium" or "playwright"
            extract_config: Data extraction configuration
            wait_for_element: Element to wait for
            scroll_page: Whether to scroll the page to load dynamic content
        """
        try:
            if method == "selenium":
                return await self._scrape_selenium(
                    url, extract_config, wait_for_element, scroll_page
                )
            elif method == "playwright":
                return await self._scrape_playwright(
                    url, extract_config, wait_for_element, scroll_page
                )
            else:
                raise ValueError(f"Unknown stealth method: {method}")
        except Exception as e:
            logger.error(f"Stealth scraping failed for {url}: {str(e)}")
            return {"error": str(e), "url": url}

    async def _scrape_selenium(
        self,
        url: str,
        extract_config: Optional[Dict[str, Any]],
        wait_for_element: Optional[str],
        scroll_page: bool,
    ) -> Dict[str, Any]:
        """Selenium 隐身抓取编排。"""
        await _random_delay()
        async with stealth_selenium_session(
            url, wait_for_element=wait_for_element
        ) as driver:
            await _random_delay(2, 4)
            if scroll_page:
                await _scroll_page_selenium(driver)
            await _simulate_human_behavior_selenium(driver)
            result = extract_page_data_selenium(driver, extract_config)
            result["url"] = driver.current_url
            return result

    async def _scrape_playwright(
        self,
        url: str,
        extract_config: Optional[Dict[str, Any]],
        wait_for_element: Optional[str],
        scroll_page: bool,
    ) -> Dict[str, Any]:
        """Playwright 隐身抓取编排。"""
        await _random_delay()
        async with stealth_playwright_session(
            url, wait_for_element=wait_for_element
        ) as page:
            if scroll_page:
                await _scroll_page_playwright(page)
            await _simulate_human_behavior_playwright(page)
            result = await extract_page_data_playwright(page, extract_config)
            result["url"] = page.url
            return result

    async def cleanup(self) -> None:
        """向后兼容，资源已由上下文管理器自动管理。"""
