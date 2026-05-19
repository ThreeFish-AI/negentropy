"""内容提取子包：统一公共 API 入口。

按职责将内容提取拆分为两个正交模块：
- pages: 整页提取门面与默认内容提取（BS4 / Playwright / Selenium）
- selectors: 基于 CSS 选择器的配置化提取（BS4 / Playwright / Selenium）
"""

from .pages import (
    extract_default_content,
    extract_default_content_playwright,
    extract_page_data_playwright,
    extract_page_data_selenium,
)
from .selectors import (
    extract_with_bs4_config,
    extract_with_playwright_config,
    extract_with_selenium_config,
)

__all__ = [
    "extract_default_content",
    "extract_default_content_playwright",
    "extract_page_data_selenium",
    "extract_page_data_playwright",
    "extract_with_bs4_config",
    "extract_with_selenium_config",
    "extract_with_playwright_config",
]
