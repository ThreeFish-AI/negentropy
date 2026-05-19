"""共享浏览器配置与生命周期管理工具模块。"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager, contextmanager
from typing import TYPE_CHECKING, AsyncIterator, Iterator, Optional

from selenium.webdriver.chrome.options import Options as ChromeOptions

from ..config import settings

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from playwright.async_api import Page
    from selenium.webdriver import Chrome


def build_chrome_options(
    *,
    headless: bool = True,
    stealth: bool = False,
    user_agent: str | None = None,
    proxy_url: str | None = None,
) -> ChromeOptions:
    """构建统一的 Chrome 浏览器选项配置。

    Args:
        headless: 是否启用无头模式
        stealth: 是否启用反检测选项
        user_agent: 自定义 User-Agent（为 None 时使用配置默认值）
        proxy_url: 代理服务器 URL
    """
    options = ChromeOptions()

    if headless:
        options.add_argument("--headless")

    # 基础稳定性选项
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")

    if stealth:
        # 反检测专用选项（模拟真实用户浏览器指纹）
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-plugins")
        options.add_argument("--disable-images")
        options.add_argument("--start-maximized")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        options.add_argument("--disable-blink-features=AutomationControlled")

    # User-Agent 配置
    if user_agent:
        options.add_argument(f"--user-agent={user_agent}")
    else:
        options.add_argument(f"--user-agent={settings.default_user_agent}")

    # 代理配置
    if proxy_url:
        options.add_argument(f"--proxy-server={proxy_url}")
    elif settings.use_proxy and settings.proxy_url:
        options.add_argument(f"--proxy-server={settings.proxy_url}")

    return options


@contextmanager
def selenium_session(
    url: str,
    *,
    wait_for_element: Optional[str] = None,
    headless: Optional[bool] = None,
) -> Iterator[Chrome]:
    """Selenium 浏览器会话，自动处理启动/导航/等待/销毁。

    Yields:
        已导航到目标 URL 的 Chrome WebDriver 实例。
    """
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    if headless is None:
        headless = settings.browser_headless

    options = build_chrome_options(headless=headless)
    driver = webdriver.Chrome(options=options)
    try:
        driver.get(url)
        if wait_for_element:
            WebDriverWait(driver, settings.browser_timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, wait_for_element))
            )
        yield driver
    finally:
        driver.quit()


@asynccontextmanager
async def playwright_session(
    url: str,
    *,
    wait_for_element: Optional[str] = None,
    headless: Optional[bool] = None,
) -> AsyncIterator[Page]:
    """Playwright 浏览器会话，自动处理启动/导航/等待/销毁。

    Yields:
        已导航到目标 URL 的 Playwright Page 实例。
    """
    from playwright.async_api import async_playwright

    if headless is None:
        headless = settings.browser_headless

    pw = await async_playwright().start()
    try:
        browser = await pw.chromium.launch(headless=headless)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto(url, timeout=60000)
        if wait_for_element:
            await page.wait_for_selector(
                wait_for_element,
                timeout=settings.browser_timeout * 1000,
            )
        yield page
    finally:
        await browser.close()
        await pw.stop()


@asynccontextmanager
async def stealth_selenium_session(
    url: str,
    *,
    wait_for_element: Optional[str] = None,
) -> AsyncIterator[Chrome]:
    """隐身 Selenium 会话，使用 undetected-chromedriver。

    Yields:
        已导航到目标 URL 的 undetected Chrome WebDriver 实例。
    """
    import undetected_chromedriver as uc
    from fake_useragent import UserAgent
    from selenium.common.exceptions import TimeoutException
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    ua = UserAgent()
    user_agent = ua.random if settings.use_random_user_agent else None
    options = build_chrome_options(
        headless=settings.browser_headless,
        stealth=True,
        user_agent=user_agent,
    )
    driver = uc.Chrome(options=options)
    driver.execute_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    try:
        driver.get(url)
        if wait_for_element:
            try:
                WebDriverWait(driver, settings.browser_timeout).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, wait_for_element))
                )
            except TimeoutException:
                logger.warning(f"Timeout waiting for element: {wait_for_element}")
        yield driver
    finally:
        driver.quit()


@asynccontextmanager
async def stealth_playwright_session(
    url: str,
    *,
    wait_for_element: Optional[str] = None,
) -> AsyncIterator[Page]:
    """隐身 Playwright 会话，注入反检测脚本。

    Yields:
        已导航到目标 URL 的 Playwright Page 实例。
    """
    from fake_useragent import UserAgent
    from playwright.async_api import async_playwright

    ua = UserAgent()
    pw = await async_playwright().start()
    try:
        browser = await pw.chromium.launch(
            headless=settings.browser_headless,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--window-size=1920,1080",
            ],
        )
        context_options: dict = {
            "viewport": {"width": 1920, "height": 1080},
            "user_agent": ua.random
            if settings.use_random_user_agent
            else settings.default_user_agent,
        }
        if settings.use_proxy and settings.proxy_url:
            context_options["proxy"] = {"server": settings.proxy_url}

        context = await browser.new_context(**context_options)
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        """)
        page = await context.new_page()
        await page.goto(url, timeout=60000, wait_until="domcontentloaded")
        if wait_for_element:
            try:
                await page.wait_for_selector(
                    wait_for_element,
                    timeout=settings.browser_timeout * 1000,
                )
            except Exception:
                logger.warning(f"Timeout waiting for element: {wait_for_element}")
        yield page
    finally:
        await browser.close()
        await pw.stop()
