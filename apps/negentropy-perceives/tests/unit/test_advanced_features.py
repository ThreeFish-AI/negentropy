"""
## 高级功能测试 (`test_advanced_features.py`)

### AntiDetectionScraper 反检测测试

测试无状态编排层：隐身方法路由、上下文管理器委托、行为模拟（滚动 / 鼠标移动）、
整页数据提取门面。

### FormHandler 表单处理测试

测试输入框、密码框填写、下拉选择框、复选框处理、按钮点击和键盘提交、
WebDriverWait 元素等待功能、元素未找到等异常处理。
"""

import pytest
from contextlib import asynccontextmanager
from unittest.mock import Mock, patch, AsyncMock

from negentropy.perceives.scraping.anti_detection import (
    AntiDetectionScraper,
    _scroll_page_selenium,
    _scroll_page_playwright,
    _simulate_human_behavior_selenium,
    _simulate_human_behavior_playwright,
)
from negentropy.perceives.scraping.content_extraction import (
    extract_page_data_selenium,
    extract_page_data_playwright,
)
from negentropy.perceives.scraping.form_handler import FormHandler


class TestAntiDetectionScraper:
    """
    AntiDetectionScraper 反检测测试（无状态版本）

    - **方法路由**: 测试 selenium / playwright / 无效方法路由
    - **异常处理**: 测试异常时返回错误字典
    """

    def setup_method(self):
        self.scraper = AntiDetectionScraper()

    def test_scraper_initialization(self):
        """测试反检测爬虫初始化（无状态）。"""
        assert self.scraper is not None
        assert hasattr(self.scraper, "scrape_with_stealth")
        assert hasattr(self.scraper, "cleanup")

    @pytest.mark.asyncio
    async def test_invalid_stealth_method(self):
        """测试无效隐身方法的错误处理。"""
        result = await self.scraper.scrape_with_stealth(
            "https://example.com", method="invalid_method"
        )

        assert "error" in result
        assert "Unknown stealth method" in result["error"]
        assert result["url"] == "https://example.com"

    @pytest.mark.asyncio
    async def test_scraping_exception_handling(self):
        """测试网络错误和异常处理。"""
        with patch.object(self.scraper, "_scrape_selenium") as mock_scrape:
            mock_scrape.side_effect = Exception("Network error")

            result = await self.scraper.scrape_with_stealth(
                "https://example.com", method="selenium"
            )

            assert "error" in result
            assert "Network error" in result["error"]


class TestSeleniumStealth:
    """
    Selenium 隐身功能测试

    测试使用上下文管理器进行反检测爬取的编排流程，包括
    行为模拟、页面滚动、等待元素委托等。
    """

    def setup_method(self):
        self.scraper = AntiDetectionScraper()

    @patch("negentropy.perceives.scraping.anti_detection.extract_page_data_selenium")
    @patch(
        "negentropy.perceives.scraping.anti_detection._simulate_human_behavior_selenium"
    )
    @patch("negentropy.perceives.scraping.anti_detection._scroll_page_selenium")
    @patch("negentropy.perceives.scraping.anti_detection._random_delay")
    @patch("negentropy.perceives.scraping.anti_detection.stealth_selenium_session")
    @pytest.mark.asyncio
    async def test_selenium_stealth_scraping_success(
        self, mock_session, mock_delay, mock_scroll, mock_simulate, mock_extract
    ):
        """测试 Selenium 隐身爬取成功场景。"""
        mock_driver = Mock()
        mock_driver.current_url = "https://example.com/final"

        @asynccontextmanager
        async def fake_session(url, *, wait_for_element=None):
            yield mock_driver

        mock_session.side_effect = fake_session
        mock_delay.return_value = None
        mock_extract.return_value = {
            "title": "Test Page",
            "content": {"text": "Test content"},
            "meta_description": "Test description",
        }

        result = await self.scraper._scrape_selenium(
            "https://example.com",
            extract_config=None,
            wait_for_element=None,
            scroll_page=False,
        )

        assert result["title"] == "Test Page"
        assert result["url"] == "https://example.com/final"
        assert result["content"]["text"] == "Test content"

        mock_simulate.assert_called_once_with(mock_driver)
        mock_extract.assert_called_once_with(mock_driver, None)
        mock_scroll.assert_not_called()

    @patch("negentropy.perceives.scraping.anti_detection.extract_page_data_selenium")
    @patch(
        "negentropy.perceives.scraping.anti_detection._simulate_human_behavior_selenium"
    )
    @patch("negentropy.perceives.scraping.anti_detection._scroll_page_selenium")
    @patch("negentropy.perceives.scraping.anti_detection._random_delay")
    @patch("negentropy.perceives.scraping.anti_detection.stealth_selenium_session")
    @pytest.mark.asyncio
    async def test_selenium_stealth_with_scroll(
        self, mock_session, mock_delay, mock_scroll, mock_simulate, mock_extract
    ):
        """测试 Selenium 隐身爬取带滚动。"""
        mock_driver = Mock()
        mock_driver.current_url = "https://example.com"

        @asynccontextmanager
        async def fake_session(url, *, wait_for_element=None):
            yield mock_driver

        mock_session.side_effect = fake_session
        mock_delay.return_value = None
        mock_extract.return_value = {"title": "Test", "content": {}}

        await self.scraper._scrape_selenium(
            "https://example.com",
            extract_config=None,
            wait_for_element=None,
            scroll_page=True,
        )

        mock_scroll.assert_called_once_with(mock_driver)

    @patch("negentropy.perceives.scraping.anti_detection.extract_page_data_selenium")
    @patch(
        "negentropy.perceives.scraping.anti_detection._simulate_human_behavior_selenium"
    )
    @patch("negentropy.perceives.scraping.anti_detection._random_delay")
    @patch("negentropy.perceives.scraping.anti_detection.stealth_selenium_session")
    @pytest.mark.asyncio
    async def test_selenium_wait_for_element(
        self, mock_session, mock_delay, mock_simulate, mock_extract
    ):
        """测试 Selenium 等待特定元素（委托给上下文管理器）。"""
        mock_driver = Mock()
        mock_driver.current_url = "https://example.com"

        @asynccontextmanager
        async def fake_session(url, *, wait_for_element=None):
            assert wait_for_element == ".loading-spinner"
            yield mock_driver

        mock_session.side_effect = fake_session
        mock_delay.return_value = None
        mock_extract.return_value = {"title": "Test", "content": {}}

        await self.scraper._scrape_selenium(
            "https://example.com",
            extract_config=None,
            wait_for_element=".loading-spinner",
            scroll_page=False,
        )

    @patch("negentropy.perceives.scraping.anti_detection.random.randint")
    @patch("negentropy.perceives.scraping.anti_detection.random.uniform")
    @patch("asyncio.sleep")
    @pytest.mark.asyncio
    async def test_selenium_page_scrolling(
        self, mock_sleep, mock_uniform, mock_randint
    ):
        """测试 Selenium 页面滚动（模块级函数）。"""
        mock_randint.return_value = 300
        mock_uniform.return_value = 1.0

        mock_driver = Mock()

        def mock_execute_script(script):
            if "scrollHeight" in script:
                return 1000
            return None

        mock_driver.execute_script.side_effect = mock_execute_script

        await _scroll_page_selenium(mock_driver)

        assert mock_driver.execute_script.call_count >= 2
        mock_sleep.assert_called()

    # ActionChains 已下沉为 _simulate_human_behavior_selenium 内的懒加载导入；
    # patch 其源模块属性（调用期 `from selenium...import ActionChains` 从源模块取值，可被拦截）。
    @patch("selenium.webdriver.common.action_chains.ActionChains")
    @patch("negentropy.perceives.scraping.anti_detection.random.randint")
    @patch("negentropy.perceives.scraping.anti_detection.random.uniform")
    @patch("asyncio.sleep")
    @pytest.mark.asyncio
    async def test_selenium_human_behavior_simulation(
        self, mock_sleep, mock_uniform, mock_randint, mock_action_chains
    ):
        """测试 Selenium 人类行为模拟（模块级函数）。"""
        mock_randint.side_effect = [3, 100, 200, 300, 400, 500, 600]
        mock_uniform.return_value = 1.0

        mock_driver = Mock()
        mock_actions = Mock()
        mock_action_chains.return_value = mock_actions

        await _simulate_human_behavior_selenium(mock_driver)

        mock_action_chains.assert_called_once_with(mock_driver)
        mock_actions.perform.assert_called_once()
        mock_sleep.assert_called()


class TestPlaywrightStealth:
    """Playwright 隐身功能测试。"""

    def setup_method(self):
        self.scraper = AntiDetectionScraper()

    @patch("negentropy.perceives.scraping.anti_detection.extract_page_data_playwright")
    @patch(
        "negentropy.perceives.scraping.anti_detection._simulate_human_behavior_playwright"
    )
    @patch("negentropy.perceives.scraping.anti_detection._scroll_page_playwright")
    @patch("negentropy.perceives.scraping.anti_detection._random_delay")
    @patch("negentropy.perceives.scraping.anti_detection.stealth_playwright_session")
    @pytest.mark.asyncio
    async def test_playwright_stealth_scraping_success(
        self, mock_session, mock_delay, mock_scroll, mock_simulate, mock_extract
    ):
        """测试 Playwright 隐身爬取成功。"""
        mock_page = AsyncMock()
        mock_page.url = "https://example.com/final"

        @asynccontextmanager
        async def fake_session(url, *, wait_for_element=None):
            yield mock_page

        mock_session.side_effect = fake_session
        mock_delay.return_value = None
        mock_extract.return_value = {
            "title": "Test Page",
            "content": {"text": "Test content"},
        }

        result = await self.scraper._scrape_playwright(
            "https://example.com",
            extract_config=None,
            wait_for_element=None,
            scroll_page=False,
        )

        assert result["title"] == "Test Page"
        assert result["url"] == "https://example.com/final"

        mock_simulate.assert_called_once_with(mock_page)
        mock_extract.assert_called_once_with(mock_page, None)
        mock_scroll.assert_not_called()

    @patch("negentropy.perceives.scraping.anti_detection.extract_page_data_playwright")
    @patch(
        "negentropy.perceives.scraping.anti_detection._simulate_human_behavior_playwright"
    )
    @patch("negentropy.perceives.scraping.anti_detection._random_delay")
    @patch("negentropy.perceives.scraping.anti_detection.stealth_playwright_session")
    @pytest.mark.asyncio
    async def test_playwright_wait_for_element(
        self, mock_session, mock_delay, mock_simulate, mock_extract
    ):
        """测试 Playwright 等待特定元素（委托给上下文管理器）。"""
        mock_page = AsyncMock()
        mock_page.url = "https://example.com"

        @asynccontextmanager
        async def fake_session(url, *, wait_for_element=None):
            assert wait_for_element == ".content"
            yield mock_page

        mock_session.side_effect = fake_session
        mock_delay.return_value = None
        mock_extract.return_value = {"title": "Test", "content": {}}

        await self.scraper._scrape_playwright(
            "https://example.com",
            extract_config=None,
            wait_for_element=".content",
            scroll_page=False,
        )

    @pytest.mark.asyncio
    async def test_playwright_page_scrolling(self):
        """测试 Playwright 页面滚动（模块级函数）。"""
        mock_page = AsyncMock()
        mock_page.evaluate = AsyncMock()

        await _scroll_page_playwright(mock_page)

        mock_page.evaluate.assert_called_once()
        js_code = mock_page.evaluate.call_args[0][0]
        assert "scrollBy" in js_code
        assert "Promise" in js_code

    @patch("negentropy.perceives.scraping.anti_detection.random.randint")
    @patch("negentropy.perceives.scraping.anti_detection.random.uniform")
    @patch("asyncio.sleep")
    @pytest.mark.asyncio
    async def test_playwright_human_behavior_simulation(
        self, mock_sleep, mock_uniform, mock_randint
    ):
        """测试 Playwright 人类行为模拟（模块级函数）。"""
        mock_randint.side_effect = [3, 100, 200, 300, 400, 500, 600]
        mock_uniform.return_value = 0.5

        mock_page = AsyncMock()
        mock_mouse = AsyncMock()
        mock_page.mouse = mock_mouse

        await _simulate_human_behavior_playwright(mock_page)

        assert mock_mouse.move.call_count > 0
        mock_sleep.assert_called()


class TestDataExtraction:
    """测试整页数据提取门面（函数位于 content_extraction/pages.py）。"""

    @patch("negentropy.perceives.scraping.content_extraction.pages.BeautifulSoup")
    @pytest.mark.asyncio
    async def test_selenium_data_extraction_default(self, mock_beautifulsoup):
        """测试 Selenium 默认数据提取。"""
        mock_driver = Mock()
        mock_driver.title = "Test Page"
        mock_driver.current_url = "https://example.com"
        mock_driver.page_source = "<html><body><h1>Test</h1></body></html>"

        mock_meta_element = Mock()
        mock_meta_element.get_attribute.return_value = "Test description"
        mock_driver.find_element.return_value = mock_meta_element

        mock_soup = Mock()
        mock_soup.get_text.return_value = "Test content"
        mock_soup.find_all.return_value = []
        mock_beautifulsoup.return_value = mock_soup

        result = extract_page_data_selenium(mock_driver, extract_config=None)

        assert result["title"] == "Test Page"
        assert result["meta_description"] == "Test description"
        assert result["content"]["text"] == "Test content"
        assert result["content"]["links"] == []

    @patch("negentropy.perceives.scraping.content_extraction.pages.BeautifulSoup")
    @pytest.mark.asyncio
    async def test_selenium_data_extraction_with_config(self, mock_beautifulsoup):
        """测试 Selenium 配置化数据提取。"""
        from selenium.common.exceptions import NoSuchElementException

        mock_driver = Mock()
        mock_driver.title = "Test Page"
        mock_driver.current_url = "https://example.com"
        mock_driver.page_source = "<html></html>"

        def mock_find_element(by, selector):
            if "meta[name='description']" in selector:
                raise NoSuchElementException()
            mock_element = Mock()
            mock_element.get_attribute.return_value = "href_value"
            return mock_element

        mock_driver.find_element.side_effect = mock_find_element

        mock_element = Mock()
        mock_element.text = "Extracted text"
        mock_element.get_attribute.return_value = "href_value"
        mock_driver.find_elements.return_value = [mock_element]

        mock_beautifulsoup.return_value = Mock()

        extract_config = {
            "titles": "h1",
            "link": {"selector": "a", "attr": "href", "multiple": False},
        }

        result = extract_page_data_selenium(mock_driver, extract_config)

        assert result["title"] == "Test Page"
        assert result["meta_description"] is None
        assert result["content"]["titles"] == ["Extracted text"]
        assert result["content"]["link"] == "href_value"

    @pytest.mark.asyncio
    async def test_playwright_data_extraction_default(self):
        """测试 Playwright 默认数据提取。"""
        mock_page = AsyncMock()
        mock_page.title.return_value = "Test Page"
        mock_page.url = "https://example.com"
        mock_page.get_attribute.return_value = "Test description"
        mock_page.text_content.return_value = "Test content"
        mock_page.query_selector_all.return_value = []

        result = await extract_page_data_playwright(mock_page, extract_config=None)

        assert result["title"] == "Test Page"
        assert result["meta_description"] == "Test description"
        assert result["content"]["text"] == "Test content"
        assert result["content"]["links"] == []

    @pytest.mark.asyncio
    async def test_playwright_data_extraction_with_config(self):
        """测试 Playwright 配置化数据提取。"""
        mock_page = AsyncMock()
        mock_page.title.return_value = "Test Page"
        mock_page.get_attribute.return_value = None

        mock_element = AsyncMock()
        mock_element.text_content.return_value = "Extracted text"
        mock_element.get_attribute.return_value = "href_value"

        mock_page.query_selector_all.return_value = [mock_element]
        mock_page.query_selector.return_value = mock_element

        extract_config = {
            "titles": "h1",
            "link": {"selector": "a", "attr": "href", "multiple": False},
        }

        result = await extract_page_data_playwright(mock_page, extract_config)

        assert result["title"] == "Test Page"
        assert result["meta_description"] is None
        assert result["content"]["titles"] == ["Extracted text"]
        assert result["content"]["link"] == "href_value"


class TestResourceCleanup:
    """测试资源清理（无状态版本，cleanup 为空操作）。"""

    @pytest.mark.asyncio
    async def test_cleanup_no_op(self):
        """cleanup 为空操作（资源由上下文管理器管理）。"""
        scraper = AntiDetectionScraper()
        await scraper.cleanup()  # 不应抛出异常


class TestFormHandler:
    """
    FormHandler 表单处理测试

    - **基础表单填写**: 测试输入框、密码框填写
    - **复杂表单元素**: 测试下拉选择框、复选框处理
    - **表单提交**: 测试按钮点击和键盘提交
    - **元素等待**: 测试 WebDriverWait 元素等待功能
    - **错误恢复**: 测试元素未找到等异常处理
    """

    def test_form_handler_initialization_selenium(self):
        """
        测试表单处理器 Selenium 驱动器初始化

        验证 FormHandler 能够正确识别 Selenium WebDriver 并设置相应的处理模式
        """
        mock_driver = Mock()
        # Selenium驱动器没有fill方法
        delattr(mock_driver, "fill") if hasattr(mock_driver, "fill") else None

        handler = FormHandler(mock_driver)

        assert handler.driver_or_page == mock_driver
        assert handler.is_playwright is False

    def test_form_handler_initialization_playwright(self):
        """
        测试表单处理器 Playwright 页面初始化

        验证 FormHandler 能够正确识别 Playwright Page 对象并设置相应的处理模式
        """
        mock_page = Mock()
        mock_page.fill = Mock()  # Playwright页面有fill方法

        handler = FormHandler(mock_page)

        assert handler.driver_or_page == mock_page
        assert handler.is_playwright is True

    @pytest.mark.asyncio
    async def test_form_filling_success(self):
        """
        测试表单填充成功场景

        验证完整的表单填充流程：
        - 多个表单字段正确填写
        - 提交操作正确执行
        - 结果状态正确返回
        """
        mock_driver = Mock()
        handler = FormHandler(mock_driver)
        handler.is_playwright = False

        with (
            patch.object(handler, "_fill_field") as mock_fill_field,
            patch.object(handler, "_submit_form") as mock_submit,
        ):
            mock_fill_field.return_value = {"success": True, "value": "test"}
            mock_submit.return_value = {
                "success": True,
                "new_url": "https://example.com",
            }

            form_data = {"#username": "testuser", "#password": "testpass"}
            result = await handler.fill_form(
                form_data, submit=True, submit_button_selector="#submit"
            )

            assert result["success"] is True
            assert len(result["results"]) == 3  # 2 fields + submit
            mock_fill_field.assert_any_call("#username", "testuser")
            mock_fill_field.assert_any_call("#password", "testpass")
            mock_submit.assert_called_once_with("#submit")

    @pytest.mark.asyncio
    async def test_form_filling_error(self):
        """
        测试表单填充错误处理

        验证当表单填充过程中发生异常时，系统能够正确处理并返回错误信息
        """
        mock_driver = Mock()
        handler = FormHandler(mock_driver)

        with patch.object(handler, "_fill_field") as mock_fill_field:
            mock_fill_field.side_effect = Exception("Fill error")

            result = await handler.fill_form({"#field": "value"})

            assert result["success"] is False
            assert "Fill error" in result["error"]


class TestSeleniumFormHandling:
    """测试Selenium表单处理"""

    # Select 已下沉为 _fill_field_selenium 内的懒加载导入；patch 其源模块属性以拦截调用期导入。
    @patch("selenium.webdriver.support.ui.Select")
    @pytest.mark.asyncio
    async def test_selenium_fill_select_field(self, mock_select):
        """测试Selenium填充选择框"""
        mock_driver = Mock()
        mock_element = Mock()
        mock_element.tag_name = "select"
        mock_driver.find_element.return_value = mock_element

        mock_select_instance = Mock()
        mock_select.return_value = mock_select_instance

        handler = FormHandler(mock_driver)

        # 测试按可见文本选择
        result = await handler._fill_field_selenium("#select", "Option 1")

        assert result["success"] is True
        assert result["value"] == "Option 1"
        mock_select_instance.select_by_visible_text.assert_called_once_with("Option 1")

    @pytest.mark.asyncio
    async def test_selenium_fill_checkbox(self):
        """测试Selenium填充复选框"""
        mock_driver = Mock()
        mock_element = Mock()
        mock_element.tag_name = "input"
        mock_element.get_attribute.return_value = "checkbox"
        mock_element.is_selected.return_value = False
        mock_driver.find_element.return_value = mock_element

        handler = FormHandler(mock_driver)

        result = await handler._fill_field_selenium("#checkbox", True)

        assert result["success"] is True
        assert result["value"] is True
        mock_element.click.assert_called_once()

    @pytest.mark.asyncio
    async def test_selenium_fill_text_input(self):
        """测试Selenium填充文本输入"""
        mock_driver = Mock()
        mock_element = Mock()
        mock_element.tag_name = "input"
        mock_element.get_attribute.return_value = "text"
        mock_driver.find_element.return_value = mock_element

        handler = FormHandler(mock_driver)

        result = await handler._fill_field_selenium("#text", "test value")

        assert result["success"] is True
        assert result["value"] == "test value"
        mock_element.clear.assert_called_once()
        mock_element.send_keys.assert_called_once_with("test value")

    @pytest.mark.asyncio
    async def test_selenium_submit_form_with_button(self):
        """测试Selenium提交表单（指定按钮）"""
        mock_driver = Mock()
        mock_driver.current_url = "https://example.com/success"
        mock_button = Mock()
        mock_driver.find_element.return_value = mock_button

        handler = FormHandler(mock_driver)

        with patch("asyncio.sleep"):
            result = await handler._submit_form_selenium("#submit-btn")

        assert result["success"] is True
        assert result["new_url"] == "https://example.com/success"
        mock_button.click.assert_called_once()


class TestPlaywrightFormHandling:
    """测试Playwright表单处理"""

    @pytest.mark.asyncio
    async def test_playwright_fill_select_field(self):
        """测试Playwright填充选择框"""
        mock_page = AsyncMock()
        mock_element = AsyncMock()
        mock_element.evaluate.return_value = "select"
        mock_element.get_attribute.return_value = None
        mock_page.query_selector.return_value = mock_element

        handler = FormHandler(mock_page)
        handler.is_playwright = True

        result = await handler._fill_field_playwright("#select", "Option 1")

        assert result["success"] is True
        assert result["value"] == "Option 1"
        mock_element.select_option.assert_called_once_with(label="Option 1")

    @pytest.mark.asyncio
    async def test_playwright_fill_checkbox(self):
        """测试Playwright填充复选框"""
        mock_page = AsyncMock()
        mock_element = AsyncMock()
        mock_element.evaluate.return_value = "input"
        mock_element.get_attribute.return_value = "checkbox"
        mock_element.is_checked.return_value = False
        mock_page.query_selector.return_value = mock_element

        handler = FormHandler(mock_page)
        handler.is_playwright = True

        result = await handler._fill_field_playwright("#checkbox", True)

        assert result["success"] is True
        assert result["value"] is True
        mock_element.check.assert_called_once()

    @pytest.mark.asyncio
    async def test_playwright_fill_text_input(self):
        """测试Playwright填充文本输入"""
        mock_page = AsyncMock()
        mock_element = AsyncMock()
        mock_element.evaluate.return_value = "input"
        mock_element.get_attribute.return_value = "text"
        mock_page.query_selector.return_value = mock_element

        handler = FormHandler(mock_page)
        handler.is_playwright = True

        result = await handler._fill_field_playwright("#text", "test value")

        assert result["success"] is True
        assert result["value"] == "test value"
        mock_element.fill.assert_called_once_with("test value")

    @pytest.mark.asyncio
    async def test_playwright_fill_element_not_found(self):
        """测试Playwright元素未找到"""
        mock_page = AsyncMock()
        mock_page.query_selector.return_value = None

        handler = FormHandler(mock_page)
        handler.is_playwright = True

        result = await handler._fill_field_playwright("#nonexistent", "value")

        assert result["success"] is False
        assert result["error"] == "Element not found"

    @pytest.mark.asyncio
    async def test_playwright_submit_form_with_button(self):
        """测试Playwright提交表单（指定按钮）"""
        mock_page = AsyncMock()
        mock_page.url = "https://example.com/success"
        mock_page.wait_for_load_state = AsyncMock()

        handler = FormHandler(mock_page)
        handler.is_playwright = True

        result = await handler._submit_form_playwright("#submit-btn")

        assert result["success"] is True
        assert result["new_url"] == "https://example.com/success"
        mock_page.click.assert_called_once_with("#submit-btn")

    @pytest.mark.asyncio
    async def test_playwright_submit_form_auto_find(self):
        """测试Playwright自动查找提交按钮"""
        mock_page = AsyncMock()
        mock_page.url = "https://example.com/success"
        mock_page.click.side_effect = [
            Exception("Not found"),
            None,
        ]  # 第一个失败，第二个成功
        mock_page.wait_for_load_state = AsyncMock()

        handler = FormHandler(mock_page)
        handler.is_playwright = True

        result = await handler._submit_form_playwright()

        assert result["success"] is True
        # 应该尝试多个选择器
        assert mock_page.click.call_count >= 2


class TestFormHandlingErrorCases:
    """测试表单处理错误情况"""

    @pytest.mark.asyncio
    async def test_selenium_field_not_found(self):
        """测试Selenium字段未找到"""
        mock_driver = Mock()
        from selenium.common.exceptions import NoSuchElementException

        mock_driver.find_element.side_effect = NoSuchElementException(
            "Element not found"
        )

        handler = FormHandler(mock_driver)

        result = await handler._fill_field_selenium("#nonexistent", "value")

        assert result["success"] is False
        assert "Element not found" in result["error"]

    @pytest.mark.asyncio
    async def test_playwright_field_error(self):
        """测试Playwright字段操作错误"""
        mock_page = AsyncMock()
        mock_element = AsyncMock()
        mock_element.evaluate.side_effect = Exception("Evaluation error")
        mock_page.query_selector.return_value = mock_element

        handler = FormHandler(mock_page)
        handler.is_playwright = True

        result = await handler._fill_field_playwright("#field", "value")

        assert result["success"] is False
        assert "Evaluation error" in result["error"]

    @pytest.mark.asyncio
    async def test_selenium_submit_no_button_found(self):
        """测试Selenium提交时找不到按钮"""
        mock_driver = Mock()
        mock_driver.current_url = "https://example.com"
        from selenium.common.exceptions import NoSuchElementException

        mock_driver.find_element.side_effect = NoSuchElementException(
            "Button not found"
        )

        # 模拟找到表单并提交
        mock_form = Mock()
        mock_driver.find_element.side_effect = [
            NoSuchElementException("Submit button not found"),
            NoSuchElementException("Another button not found"),
            mock_form,  # 最后找到表单
        ]

        handler = FormHandler(mock_driver)

        with patch("asyncio.sleep"):
            _result = await handler._submit_form_selenium()

        # 应该尝试直接提交表单
        assert mock_driver.find_element.call_count > 1
