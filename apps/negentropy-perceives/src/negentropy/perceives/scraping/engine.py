"""核心抓取模块：HTTP / Selenium 双引擎。"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from fake_useragent import UserAgent

from .browser import build_chrome_options
from ..config import settings
from .content_extraction import (
    extract_default_content,
    extract_with_bs4_config,
    extract_with_selenium_config,
)

logger = logging.getLogger(__name__)


class SeleniumScraper:
    """基于 Selenium 的抓取器，适用于 JavaScript 重度渲染的站点。"""

    def __init__(self) -> None:
        self.driver: Optional[webdriver.Chrome] = None
        self.ua = UserAgent() if settings.use_random_user_agent else None

    def _get_driver(self) -> webdriver.Chrome:
        """获取已配置的 Chrome 驱动实例。"""
        user_agent = (
            self.ua.random if (settings.use_random_user_agent and self.ua) else None
        )
        options = build_chrome_options(
            headless=settings.browser_headless,
            user_agent=user_agent,
        )
        return webdriver.Chrome(options=options)

    async def scrape(
        self,
        url: str,
        wait_for_element: Optional[str] = None,
        extract_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """使用 Selenium 抓取指定 URL。"""
        try:
            self.driver = self._get_driver()
            self.driver.get(url)

            # Wait for specific element if specified
            if wait_for_element:
                try:
                    WebDriverWait(self.driver, settings.browser_timeout).until(
                        EC.presence_of_element_located(
                            (By.CSS_SELECTOR, wait_for_element)
                        )
                    )
                except TimeoutException:
                    logger.warning(f"Timeout waiting for element: {wait_for_element}")

            # Extract page content
            page_source = self.driver.page_source
            soup = BeautifulSoup(page_source, "html.parser")

            result: dict[str, Any] = {
                "url": self.driver.current_url,
                "title": self.driver.title,
                "meta_description": None,
                "content": {},
            }

            # Get meta description
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc and hasattr(meta_desc, "get"):
                result["meta_description"] = meta_desc.get("content")  # type: ignore[assignment]

            # Extract based on configuration
            if extract_config:
                result["content"] = extract_with_selenium_config(
                    self.driver, extract_config
                )
            else:
                result["content"] = extract_default_content(soup, url)

            return result

        except Exception as e:
            logger.error(f"Selenium scraping failed for {url}: {str(e)}")
            return {"error": str(e), "url": url}
        finally:
            if self.driver:
                self.driver.quit()


class HttpScraper:
    """基于 HTTP 的抓取器，使用 requests 库。"""

    def __init__(self) -> None:
        self.session = requests.Session()
        self.ua = UserAgent() if settings.use_random_user_agent else None
        self._configure_session()

    def _configure_session(self) -> None:
        """配置 requests 会话。"""
        if settings.use_random_user_agent and self.ua:
            self.session.headers.update({"User-Agent": self.ua.random})
        else:
            self.session.headers.update({"User-Agent": settings.default_user_agent})

        if settings.use_proxy and settings.proxy_url:
            self.session.proxies.update(
                {"http": settings.proxy_url, "https": settings.proxy_url}
            )

    async def scrape(
        self, url: str, extract_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """使用 HTTP 请求抓取指定 URL。"""
        try:
            response = self.session.get(url, timeout=settings.request_timeout)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, "html.parser")

            result = {
                "url": response.url,
                "status_code": response.status_code,
                "title": None,
                "meta_description": None,
                "content": {},
            }

            # Extract title
            title_tag = soup.find("title")
            if title_tag:
                result["title"] = title_tag.get_text(strip=True)

            # Extract meta description
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc and hasattr(meta_desc, "get"):
                result["meta_description"] = meta_desc.get("content")

            # Extract based on configuration
            if extract_config:
                result["content"] = extract_with_bs4_config(soup, extract_config)
            else:
                result["content"] = extract_default_content(soup, url)

            return result

        except Exception as e:
            logger.error(f"HTTP scraping failed for {url}: {str(e)}")
            return {"error": str(e), "url": url}


class WebScraper:
    """主抓取调度器，自动选择合适的抓取方法。"""

    def __init__(self) -> None:
        self.http_scraper = HttpScraper()
        self.selenium_scraper = SeleniumScraper()
        # Backward-compatible alias
        self.simple_scraper = self.http_scraper

    async def scrape_url(
        self,
        url: str,
        method: str = "auto",
        extract_config: Optional[Dict[str, Any]] = None,
        wait_for_element: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        使用指定方法抓取 URL。

        Args:
            url: 待抓取的 URL
            method: 抓取方法（"auto"、"simple"、"scrapy"、"selenium"）
            extract_config: 数据提取配置
            wait_for_element: 等待的 CSS 选择器（仅 Selenium 模式）

        Returns:
            包含抓取数据的字典
        """

        if method == "auto":
            # Auto-detect best method based on URL and settings
            if settings.enable_javascript or wait_for_element:
                method = "selenium"
            else:
                method = "simple"

        logger.info(f"Scraping {url} using {method} method")

        try:
            if method in ("simple", "scrapy"):
                # scrapy method now routes to http_scraper (was already falling back)
                return await self.http_scraper.scrape(url, extract_config)
            elif method == "selenium":
                return await self.selenium_scraper.scrape(
                    url, wait_for_element, extract_config
                )
            else:
                raise ValueError(f"Unknown scraping method: {method}")

        except Exception as e:
            logger.error(f"Scraping failed for {url}: {str(e)}")
            return {"error": str(e), "url": url}

    async def scrape_multiple_urls(
        self,
        urls: List[str],
        method: str = "auto",
        extract_config: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """并发抓取多个 URL。"""
        tasks = [self.scrape_url(url, method, extract_config) for url in urls]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({"error": str(result), "url": urls[i]})
            else:
                processed_results.append(result)  # type: ignore[arg-type]

        return processed_results
