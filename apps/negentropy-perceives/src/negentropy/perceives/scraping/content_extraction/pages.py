"""整页提取门面与默认内容提取。"""

from typing import Any, Dict, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .selectors import (
    extract_with_playwright_config,
    extract_with_selenium_config,
)


def extract_default_content(soup: BeautifulSoup, base_url: str) -> Dict[str, Any]:
    """从 BeautifulSoup 解析树中提取默认内容。"""
    text = soup.get_text(strip=True)
    links = [
        {
            "url": urljoin(base_url, str(anchor.get("href", ""))),
            "text": anchor.get_text(strip=True),
        }
        for anchor in soup.find_all("a", href=True)
        if hasattr(anchor, "get")
    ]
    images = [
        {
            "src": urljoin(base_url, str(image.get("src", ""))),
            "alt": str(image.get("alt", "")),
        }
        for image in soup.find_all("img", src=True)
        if hasattr(image, "get")
    ]
    return {"text": text, "links": links, "images": images}


async def extract_default_content_playwright(
    page, base_url: str | None = None
) -> Dict[str, Any]:
    """从 Playwright page 提取默认内容。"""
    effective_base_url = base_url or page.url
    text = await page.text_content("body")

    links = []
    for link_elem in await page.query_selector_all("a[href]"):
        href = await link_elem.get_attribute("href")
        link_text = await link_elem.text_content()
        if href:
            links.append(
                {
                    "url": urljoin(effective_base_url, href),
                    "text": link_text.strip() if link_text else "",
                }
            )

    return {"text": text, "links": links}


def extract_page_data_selenium(
    driver, extract_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Selenium 整页数据提取。"""
    from selenium.common.exceptions import NoSuchElementException
    from selenium.webdriver.common.by import By

    soup = BeautifulSoup(driver.page_source, "html.parser")
    result: Dict[str, Any] = {"title": driver.title, "content": {}}

    try:
        meta_elem = driver.find_element(By.CSS_SELECTOR, "meta[name='description']")
        result["meta_description"] = meta_elem.get_attribute("content")
    except NoSuchElementException:
        result["meta_description"] = None

    if extract_config:
        result["content"] = extract_with_selenium_config(driver, extract_config)
    else:
        default = extract_default_content(soup, driver.current_url)
        result["content"] = {
            "text": default["text"],
            "links": default["links"],
        }

    return result


async def extract_page_data_playwright(
    page, extract_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Playwright 整页数据提取。"""
    result: Dict[str, Any] = {"title": await page.title(), "content": {}}

    try:
        result["meta_description"] = await page.get_attribute(
            "meta[name='description']",
            "content",
        )
    except Exception:
        result["meta_description"] = None

    if extract_config:
        result["content"] = await extract_with_playwright_config(page, extract_config)
    else:
        default = await extract_default_content_playwright(page)
        result["content"] = {
            "text": default["text"],
            "links": default["links"],
        }

    return result
