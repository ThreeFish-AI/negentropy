"""
内容提取子包单元测试。

覆盖 `content_extraction/` 子包中所有提取函数：
- extract_default_content (BeautifulSoup)
- extract_with_bs4_config (BeautifulSoup CSS)
- extract_with_selenium_config (Selenium)
- extract_with_playwright_config (Playwright)
- extract_default_content_playwright (Playwright)
- extract_page_data_selenium (Selenium 整页门面)
- extract_page_data_playwright (Playwright 整页门面)
"""

from unittest.mock import AsyncMock, Mock, MagicMock
from bs4 import BeautifulSoup

from negentropy.perceives.scraping.content_extraction import (
    extract_default_content,
    extract_with_bs4_config,
    extract_with_selenium_config,
    extract_with_playwright_config,
    extract_default_content_playwright,
    extract_page_data_selenium,
    extract_page_data_playwright,
)


# ---------------------------------------------------------------------------
# 子包导出完整性验证
# ---------------------------------------------------------------------------


def test_subpackage_exports():
    """验证 content_extraction 子包导出完整性。"""
    from negentropy.perceives.scraping import content_extraction

    expected_exports = [
        "extract_default_content",
        "extract_default_content_playwright",
        "extract_page_data_selenium",
        "extract_page_data_playwright",
        "extract_with_bs4_config",
        "extract_with_selenium_config",
        "extract_with_playwright_config",
    ]
    for name in expected_exports:
        assert hasattr(content_extraction, name), f"Missing export: {name}"


# ---------------------------------------------------------------------------
# BeautifulSoup 默认提取
# ---------------------------------------------------------------------------


class TestExtractDefaultContent:
    """测试 BeautifulSoup 默认内容提取。"""

    def test_extracts_text(self):
        """测试文本提取"""
        html = "<html><body><p>Hello World</p></body></html>"
        soup = BeautifulSoup(html, "html.parser")
        result = extract_default_content(soup, "https://example.com")

        assert "Hello World" in result["text"]

    def test_extracts_links(self):
        """测试链接提取"""
        html = '<html><body><a href="/page1">Link 1</a><a href="https://other.com">Link 2</a></body></html>'
        soup = BeautifulSoup(html, "html.parser")
        result = extract_default_content(soup, "https://example.com")

        assert len(result["links"]) == 2
        assert result["links"][0]["url"] == "https://example.com/page1"
        assert result["links"][0]["text"] == "Link 1"
        assert result["links"][1]["url"] == "https://other.com"

    def test_extracts_images(self):
        """测试图片提取"""
        html = '<html><body><img src="/img/logo.png" alt="Logo" /></body></html>'
        soup = BeautifulSoup(html, "html.parser")
        result = extract_default_content(soup, "https://example.com")

        assert len(result["images"]) == 1
        assert result["images"][0]["src"] == "https://example.com/img/logo.png"
        assert result["images"][0]["alt"] == "Logo"

    def test_empty_html(self):
        """测试空 HTML"""
        soup = BeautifulSoup("<html><body></body></html>", "html.parser")
        result = extract_default_content(soup, "https://example.com")

        assert result["text"] == ""
        assert result["links"] == []
        assert result["images"] == []

    def test_relative_url_resolution(self):
        """测试相对 URL 拼接"""
        html = '<html><body><a href="../page">Link</a><img src="images/photo.jpg" alt="Photo" /></body></html>'
        soup = BeautifulSoup(html, "html.parser")
        result = extract_default_content(soup, "https://example.com/dir/")

        assert result["links"][0]["url"] == "https://example.com/page"
        assert result["images"][0]["src"] == "https://example.com/dir/images/photo.jpg"


# ---------------------------------------------------------------------------
# BeautifulSoup CSS 配置化提取
# ---------------------------------------------------------------------------


class TestExtractWithBs4Config:
    """测试 BeautifulSoup CSS 配置化提取。"""

    def test_simple_string_selector(self):
        """测试简单字符串选择器"""
        html = "<html><body><h1>Title</h1><p>Content</p></body></html>"
        soup = BeautifulSoup(html, "html.parser")

        result = extract_with_bs4_config(soup, {"title": "h1"})
        assert result["title"] == ["Title"]

    def test_multiple_elements(self):
        """测试多元素选择"""
        html = "<html><body><li>A</li><li>B</li><li>C</li></body></html>"
        soup = BeautifulSoup(html, "html.parser")

        result = extract_with_bs4_config(soup, {"items": "li"})
        assert result["items"] == ["A", "B", "C"]

    def test_dict_config_multiple_text(self):
        """测试字典配置 - 多元素文本提取"""
        html = '<html><body><span class="tag">X</span><span class="tag">Y</span></body></html>'
        soup = BeautifulSoup(html, "html.parser")

        config = {"tags": {"selector": ".tag", "attr": "text", "multiple": True}}
        result = extract_with_bs4_config(soup, config)
        assert result["tags"] == ["X", "Y"]

    def test_dict_config_single_text(self):
        """测试字典配置 - 单元素文本提取"""
        html = "<html><body><h1>Main Title</h1></body></html>"
        soup = BeautifulSoup(html, "html.parser")

        config = {"title": {"selector": "h1", "attr": "text", "multiple": False}}
        result = extract_with_bs4_config(soup, config)
        assert result["title"] == "Main Title"

    def test_dict_config_attr_extraction(self):
        """测试字典配置 - 属性提取"""
        html = '<html><body><a href="https://example.com">Link</a></body></html>'
        soup = BeautifulSoup(html, "html.parser")

        config = {"link": {"selector": "a", "attr": "href", "multiple": False}}
        result = extract_with_bs4_config(soup, config)
        assert result["link"] == "https://example.com"

    def test_dict_config_multiple_attr(self):
        """测试字典配置 - 多元素属性提取"""
        html = '<html><body><a href="/a">A</a><a href="/b">B</a></body></html>'
        soup = BeautifulSoup(html, "html.parser")

        config = {"links": {"selector": "a", "attr": "href", "multiple": True}}
        result = extract_with_bs4_config(soup, config)
        assert result["links"] == ["/a", "/b"]

    def test_dict_config_no_attr_returns_html(self):
        """测试字典配置 - 无属性时返回 HTML 字符串"""
        html = "<html><body><div><b>Bold</b></div></body></html>"
        soup = BeautifulSoup(html, "html.parser")

        config = {"content": {"selector": "div", "multiple": False}}
        result = extract_with_bs4_config(soup, config)
        assert "<b>Bold</b>" in result["content"]

    def test_element_not_found(self):
        """测试元素未找到时返回 None"""
        html = "<html><body></body></html>"
        soup = BeautifulSoup(html, "html.parser")

        config = {
            "missing": {"selector": ".nonexistent", "attr": "text", "multiple": False}
        }
        result = extract_with_bs4_config(soup, config)
        assert result["missing"] is None

    def test_empty_config(self):
        """测试空配置返回空字典"""
        html = "<html><body><p>Hello</p></body></html>"
        soup = BeautifulSoup(html, "html.parser")

        result = extract_with_bs4_config(soup, {})
        assert result == {}

    def test_no_selector_in_dict(self):
        """测试字典配置中缺少 selector 时返回空列表"""
        html = "<html><body><p>Hello</p></body></html>"
        soup = BeautifulSoup(html, "html.parser")

        config = {"data": {"attr": "text", "multiple": True}}
        result = extract_with_bs4_config(soup, config)
        assert result["data"] == []


# ---------------------------------------------------------------------------
# Selenium 配置化提取
# ---------------------------------------------------------------------------


class TestExtractWithSeleniumConfig:
    """测试 Selenium 配置化提取。"""

    def _make_driver(self, elements_map=None):
        """创建 mock driver。"""
        driver = MagicMock()

        def find_elements(by, selector):
            if elements_map and selector in elements_map:
                return elements_map[selector]
            return []

        def find_element(by, selector):
            if elements_map and selector in elements_map:
                items = elements_map[selector]
                if items:
                    return items[0]
            raise Exception("Element not found")

        driver.find_elements = find_elements
        driver.find_element = find_element
        return driver

    def test_simple_string_selector(self):
        """测试简单字符串选择器"""
        elem = Mock()
        elem.text = "Hello"
        driver = self._make_driver({".title": [elem]})

        result = extract_with_selenium_config(driver, {"title": ".title"})

        assert result["title"] == ["Hello"]

    def test_dict_config_multiple_text(self):
        """测试字典配置 - 多元素文本提取"""
        elems = [Mock(text="A"), Mock(text="B")]
        driver = self._make_driver({".items": elems})

        config = {
            "items": {
                "selector": ".items",
                "attr": "text",
                "multiple": True,
            }
        }
        result = extract_with_selenium_config(driver, config)

        assert result["items"] == ["A", "B"]

    def test_dict_config_single_attr(self):
        """测试字典配置 - 单元素属性提取"""
        elem = Mock()
        elem.get_attribute = Mock(return_value="https://example.com")
        driver = self._make_driver({"a.link": [elem]})

        config = {
            "link": {
                "selector": "a.link",
                "attr": "href",
                "multiple": False,
            }
        }
        result = extract_with_selenium_config(driver, config)

        assert result["link"] == "https://example.com"

    def test_element_not_found(self):
        """测试元素未找到时返回 None"""
        driver = self._make_driver({})

        config = {
            "missing": {
                "selector": ".nonexistent",
                "attr": "text",
                "multiple": False,
            }
        }
        result = extract_with_selenium_config(driver, config)

        assert result["missing"] is None

    def test_extraction_error_handling(self):
        """测试提取出错时的容错处理"""
        driver = MagicMock()
        driver.find_elements = Mock(side_effect=Exception("Driver error"))

        result = extract_with_selenium_config(driver, {"data": ".selector"})

        assert result["data"] is None


# ---------------------------------------------------------------------------
# Playwright 配置化提取
# ---------------------------------------------------------------------------


class TestExtractWithPlaywrightConfig:
    """测试 Playwright CSS 配置化提取。"""

    def _make_element(self, text="", attr_map=None, inner_html=""):
        """创建 mock Playwright element。"""
        elem = AsyncMock()
        elem.text_content = AsyncMock(return_value=text)
        elem.get_attribute = AsyncMock(side_effect=lambda a: (attr_map or {}).get(a))
        elem.inner_html = AsyncMock(return_value=inner_html)
        return elem

    def _make_page(self, elements_map=None):
        """创建 mock Playwright page。"""
        page = AsyncMock()

        async def query_selector_all(selector):
            if elements_map and selector in elements_map:
                return elements_map[selector]
            return []

        async def query_selector(selector):
            if elements_map and selector in elements_map:
                items = elements_map[selector]
                return items[0] if items else None
            return None

        page.query_selector_all = AsyncMock(side_effect=query_selector_all)
        page.query_selector = AsyncMock(side_effect=query_selector)
        return page

    async def test_simple_string_selector(self):
        """测试简单字符串选择器"""
        elem = self._make_element(text="Hello")
        page = self._make_page({".title": [elem]})

        result = await extract_with_playwright_config(page, {"title": ".title"})
        assert result["title"] == ["Hello"]

    async def test_dict_config_multiple_text(self):
        """测试字典配置 - 多元素文本提取"""
        elems = [self._make_element(text="A"), self._make_element(text="B")]
        page = self._make_page({".items": elems})

        config = {"items": {"selector": ".items", "attr": "text", "multiple": True}}
        result = await extract_with_playwright_config(page, config)
        assert result["items"] == ["A", "B"]

    async def test_dict_config_single_attr(self):
        """测试字典配置 - 单元素属性提取"""
        elem = self._make_element(attr_map={"href": "https://example.com"})
        page = self._make_page({"a.link": [elem]})

        config = {"link": {"selector": "a.link", "attr": "href", "multiple": False}}
        result = await extract_with_playwright_config(page, config)
        assert result["link"] == "https://example.com"

    async def test_dict_config_no_attr_returns_inner_html(self):
        """测试字典配置 - 无属性时返回 innerHTML"""
        elem = self._make_element(inner_html="<b>Bold</b>")
        page = self._make_page({"div": [elem]})

        config = {"content": {"selector": "div", "multiple": False}}
        result = await extract_with_playwright_config(page, config)
        assert result["content"] == "<b>Bold</b>"

    async def test_element_not_found(self):
        """测试元素未找到时返回 None"""
        page = self._make_page({})

        config = {
            "missing": {"selector": ".nonexistent", "attr": "text", "multiple": False}
        }
        result = await extract_with_playwright_config(page, config)
        assert result["missing"] is None

    async def test_empty_config(self):
        """测试空配置返回空字典"""
        page = self._make_page({})

        result = await extract_with_playwright_config(page, {})
        assert result == {}

    async def test_extraction_error_handling(self):
        """测试提取出错时的容错处理"""
        page = AsyncMock()
        page.query_selector_all = AsyncMock(side_effect=Exception("Page error"))

        result = await extract_with_playwright_config(page, {"data": ".selector"})
        assert result["data"] is None


# ---------------------------------------------------------------------------
# Playwright 默认提取
# ---------------------------------------------------------------------------


class TestExtractDefaultContentPlaywright:
    """测试 Playwright 默认内容提取。"""

    async def test_extracts_text_and_links(self):
        """测试文本和链接提取"""
        page = AsyncMock()
        page.url = "https://example.com"
        page.text_content = AsyncMock(return_value="Hello World")

        link1 = AsyncMock()
        link1.get_attribute = AsyncMock(return_value="/page1")
        link1.text_content = AsyncMock(return_value="Link 1")

        link2 = AsyncMock()
        link2.get_attribute = AsyncMock(return_value="https://other.com")
        link2.text_content = AsyncMock(return_value="Link 2")

        page.query_selector_all = AsyncMock(return_value=[link1, link2])

        result = await extract_default_content_playwright(page)

        assert result["text"] == "Hello World"
        assert len(result["links"]) == 2
        assert result["links"][0]["url"] == "https://example.com/page1"
        assert result["links"][0]["text"] == "Link 1"
        assert result["links"][1]["url"] == "https://other.com"

    async def test_custom_base_url(self):
        """测试自定义 base_url"""
        page = AsyncMock()
        page.url = "https://original.com"
        page.text_content = AsyncMock(return_value="Content")

        link = AsyncMock()
        link.get_attribute = AsyncMock(return_value="/relative")
        link.text_content = AsyncMock(return_value="Link")

        page.query_selector_all = AsyncMock(return_value=[link])

        result = await extract_default_content_playwright(
            page, base_url="https://custom.com"
        )

        assert result["links"][0]["url"] == "https://custom.com/relative"

    async def test_empty_page(self):
        """测试空页面"""
        page = AsyncMock()
        page.url = "https://example.com"
        page.text_content = AsyncMock(return_value="")
        page.query_selector_all = AsyncMock(return_value=[])

        result = await extract_default_content_playwright(page)

        assert result["text"] == ""
        assert result["links"] == []

    async def test_skips_links_without_href(self):
        """测试跳过无 href 的链接"""
        page = AsyncMock()
        page.url = "https://example.com"
        page.text_content = AsyncMock(return_value="Content")

        link_no_href = AsyncMock()
        link_no_href.get_attribute = AsyncMock(return_value=None)
        link_no_href.text_content = AsyncMock(return_value="No href")

        link_with_href = AsyncMock()
        link_with_href.get_attribute = AsyncMock(return_value="/valid")
        link_with_href.text_content = AsyncMock(return_value="Valid")

        page.query_selector_all = AsyncMock(return_value=[link_no_href, link_with_href])

        result = await extract_default_content_playwright(page)

        assert len(result["links"]) == 1
        assert result["links"][0]["text"] == "Valid"


# ---------------------------------------------------------------------------
# Selenium 整页提取门面
# ---------------------------------------------------------------------------


class TestExtractPageDataSelenium:
    """测试 Selenium 整页数据提取门面函数。"""

    def _make_driver(
        self,
        *,
        title="Test Page",
        url="https://example.com",
        page_source="<html><body></body></html>",
        meta_desc="Test description",
    ):
        """创建 mock Selenium driver。"""
        driver = MagicMock()
        driver.title = title
        driver.current_url = url
        driver.page_source = page_source

        if meta_desc is not None:
            meta_elem = Mock()
            meta_elem.get_attribute.return_value = meta_desc
            driver.find_element.return_value = meta_elem
        else:
            from selenium.common.exceptions import NoSuchElementException

            driver.find_element.side_effect = NoSuchElementException()

        return driver

    def test_default_extraction(self):
        """测试默认提取（无 extract_config）。"""
        html = "<html><body><p>Hello</p><a href='/link'>Link</a></body></html>"
        driver = self._make_driver(page_source=html)

        result = extract_page_data_selenium(driver)

        assert result["title"] == "Test Page"
        assert result["meta_description"] == "Test description"
        assert "text" in result["content"]
        assert "links" in result["content"]

    def test_with_extract_config(self):
        """测试配置化提取。"""
        driver = self._make_driver()
        elem = Mock(text="Heading")
        driver.find_elements.return_value = [elem]

        result = extract_page_data_selenium(driver, {"heading": "h1"})

        assert result["title"] == "Test Page"
        assert "heading" in result["content"]

    def test_meta_description_not_found(self):
        """测试 meta description 不存在时返回 None。"""
        driver = self._make_driver(meta_desc=None)

        result = extract_page_data_selenium(driver)

        assert result["meta_description"] is None


# ---------------------------------------------------------------------------
# Playwright 整页提取门面
# ---------------------------------------------------------------------------


class TestExtractPageDataPlaywright:
    """测试 Playwright 整页数据提取门面函数。"""

    async def test_default_extraction(self):
        """测试默认提取（无 extract_config）。"""
        page = AsyncMock()
        page.title.return_value = "Test Page"
        page.url = "https://example.com"
        page.get_attribute.return_value = "Test description"
        page.text_content.return_value = "Hello World"
        page.query_selector_all.return_value = []

        result = await extract_page_data_playwright(page)

        assert result["title"] == "Test Page"
        assert result["meta_description"] == "Test description"
        assert result["content"]["text"] == "Hello World"
        assert result["content"]["links"] == []

    async def test_with_extract_config(self):
        """测试配置化提取。"""
        page = AsyncMock()
        page.title.return_value = "Test Page"
        page.get_attribute.return_value = None

        mock_elem = AsyncMock()
        mock_elem.text_content.return_value = "Heading"
        page.query_selector_all.return_value = [mock_elem]

        result = await extract_page_data_playwright(page, {"heading": "h1"})

        assert result["title"] == "Test Page"
        assert "heading" in result["content"]

    async def test_meta_description_exception(self):
        """测试 meta description 获取异常时返回 None。"""
        page = AsyncMock()
        page.title.return_value = "Test Page"
        page.url = "https://example.com"
        page.get_attribute.side_effect = Exception("Not found")
        page.text_content.return_value = "Content"
        page.query_selector_all.return_value = []

        result = await extract_page_data_playwright(page)

        assert result["meta_description"] is None
        assert result["content"]["text"] == "Content"
