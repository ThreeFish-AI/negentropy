"""基于 Backend Adapter 的配置化选择器提取。"""

import logging
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable

logger = logging.getLogger(__name__)


@runtime_checkable
class BackendAdapter(Protocol):
    """后端提取适配器协议。"""

    def find_all(self, selector: str) -> List[Any]: ...
    def get_text(self, element: Any) -> Optional[str]: ...
    def get_attr(self, element: Any, attr: str) -> Optional[str]: ...
    def get_html(self, element: Any) -> str: ...
    def find_one(self, selector: str) -> Optional[Any]: ...


def _extract_selector_value(adapter: BackendAdapter, cfg: Dict[str, Any]) -> Any:
    selector, attr = cfg.get("selector"), cfg.get("attr")
    multiple = cfg.get("multiple", False)
    if multiple:
        elements = adapter.find_all(selector)  # type: ignore[arg-type]
        if attr == "text":
            return [adapter.get_text(e) for e in elements]
        if attr:
            return [adapter.get_attr(e, attr) for e in elements]
        return [adapter.get_html(e) for e in elements]
    element = adapter.find_one(selector)  # type: ignore[arg-type]
    if element is None:
        return None
    if attr == "text":
        return adapter.get_text(element)
    if attr:
        return adapter.get_attr(element, attr)
    return adapter.get_html(element)


def _extract_with_config(
    adapter: BackendAdapter, extract_config: Dict[str, Any]
) -> Dict[str, Any]:
    content: Dict[str, Any] = {}
    for key, selector_config in extract_config.items():
        try:
            if isinstance(selector_config, str):
                content[key] = [
                    adapter.get_text(e) for e in adapter.find_all(selector_config)
                ]
                continue
            if not isinstance(selector_config, dict):
                content[key] = None
                continue
            content[key] = _extract_selector_value(adapter, selector_config)
        except Exception as e:
            logger.warning("Failed to extract %s: %s", key, e)
            content[key] = None
    return content


class _BS4Adapter:
    def __init__(self, soup):
        self._soup = soup

    def find_all(self, selector: str) -> list:
        return self._soup.select(selector) if selector else []

    def find_one(self, selector: str):
        elements = self._soup.select(selector) if selector else []
        return elements[0] if elements else None

    def get_text(self, element) -> str:
        return element.get_text(strip=True)

    def get_attr(self, element, attr: str) -> str:
        return element.get(attr, "") if hasattr(element, "get") else ""

    def get_html(self, element) -> str:
        return str(element)


class _SeleniumAdapter:
    def __init__(self, driver):
        self._driver = driver

    def find_all(self, selector: str) -> list:
        from selenium.webdriver.common.by import By

        return self._driver.find_elements(By.CSS_SELECTOR, selector)

    def find_one(self, selector: str):
        from selenium.webdriver.common.by import By

        try:
            return self._driver.find_element(By.CSS_SELECTOR, selector)
        except Exception:
            return None

    def get_text(self, element) -> str:
        return element.text

    def get_attr(self, element, attr: str) -> str:
        return element.get_attribute(attr)

    def get_html(self, element) -> str:
        return element.get_attribute("outerHTML")


class _PlaywrightAdapter:
    def __init__(self, page):
        self._page = page

    async def find_all(self, selector: str) -> list:
        return await self._page.query_selector_all(selector)

    async def find_one(self, selector: str):
        return await self._page.query_selector(selector)

    async def get_text(self, element) -> str:
        return await element.text_content()

    async def get_attr(self, element, attr: str) -> str:
        return await element.get_attribute(attr)

    async def get_html(self, element) -> str:
        return await element.inner_html()


def extract_with_bs4_config(soup, extract_config: Dict[str, Any]) -> Dict[str, Any]:
    """使用 BeautifulSoup 按 extract_config 提取数据。"""
    return _extract_with_config(_BS4Adapter(soup), extract_config)


def extract_with_selenium_config(
    driver, extract_config: Dict[str, Any]
) -> Dict[str, Any]:
    """使用 Selenium driver 按 extract_config 提取数据。"""
    return _extract_with_config(_SeleniumAdapter(driver), extract_config)


async def extract_with_playwright_config(
    page, extract_config: Dict[str, Any]
) -> Dict[str, Any]:
    """使用 Playwright page 按 extract_config 提取数据。"""
    adapter = _PlaywrightAdapter(page)
    content: Dict[str, Any] = {}
    for key, selector_config in extract_config.items():
        try:
            if isinstance(selector_config, str):
                elements = await adapter.find_all(selector_config)
                content[key] = [await adapter.get_text(elem) for elem in elements]
                continue
            if not isinstance(selector_config, dict):
                content[key] = None
                continue
            content[key] = await _extract_playwright_selector_value(
                adapter, selector_config
            )
        except Exception as e:
            logger.warning("Failed to extract %s: %s", key, e)
            content[key] = None
    return content


async def _extract_playwright_selector_value(
    adapter: _PlaywrightAdapter, cfg: Dict[str, Any]
) -> Any:
    selector, attr = cfg.get("selector"), cfg.get("attr")
    multiple = cfg.get("multiple", False)
    if multiple:
        elements = await adapter.find_all(selector)  # type: ignore[arg-type]
        extracted = []
        for element in elements:
            if attr == "text":
                value = await adapter.get_text(element)
            elif attr:
                value = await adapter.get_attr(element, attr)
            else:
                value = await adapter.get_html(element)
            extracted.append(value)
        return extracted
    element = await adapter.find_one(selector)  # type: ignore[arg-type]
    if not element:
        return None
    if attr == "text":
        return await adapter.get_text(element)
    if attr:
        return await adapter.get_attr(element, attr)
    return await adapter.get_html(element)
