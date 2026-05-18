"""Web 抓取引擎：HTTP / Selenium / Playwright / 反检测 / 表单交互。"""

from .anti_detection import AntiDetectionScraper
from .browser import (
    build_chrome_options,
    playwright_session,
    selenium_session,
    stealth_playwright_session,
    stealth_selenium_session,
)
from .engine import HttpScraper, SeleniumScraper, WebScraper
from .form_handler import FormHandler

__all__ = [
    "AntiDetectionScraper",
    "FormHandler",
    "HttpScraper",
    "SeleniumScraper",
    "WebScraper",
    "build_chrome_options",
    "playwright_session",
    "selenium_session",
    "stealth_playwright_session",
    "stealth_selenium_session",
]
