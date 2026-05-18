"""表单处理 (form_handler) 单元测试。"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from negentropy.perceives.scraping.form_handler import FormHandler


class TestFormHandlerInit:
    """FormHandler 初始化测试。"""

    def test_selenium_driver_detection(self):
        """检测 Selenium driver（无 fill 属性）。"""
        mock_driver = MagicMock(spec=["find_element", "current_url"])
        handler = FormHandler(mock_driver)
        assert handler.is_playwright is False

    def test_playwright_page_detection(self):
        """检测 Playwright page（有 fill 属性）。"""
        mock_page = MagicMock()
        mock_page.fill = AsyncMock()
        handler = FormHandler(mock_page)
        assert handler.is_playwright is True


class TestFormHandlerFillForm:
    """FormHandler 表单填写测试。"""

    @pytest.mark.asyncio
    async def test_fill_form_success(self):
        """成功填写表单。"""
        mock_driver = MagicMock(spec=["find_element", "current_url"])
        handler = FormHandler(mock_driver)

        with patch.object(
            handler,
            "_fill_field",
            new_callable=AsyncMock,
            return_value={"success": True, "value": "test"},
        ):
            result = await handler.fill_form({"#input": "test"})
            assert result["success"] is True
            assert "#input" in result["results"]

    @pytest.mark.asyncio
    async def test_fill_form_with_submit(self):
        """填写并提交表单。"""
        mock_driver = MagicMock(spec=["find_element", "current_url"])
        handler = FormHandler(mock_driver)

        with (
            patch.object(
                handler,
                "_fill_field",
                new_callable=AsyncMock,
                return_value={"success": True},
            ),
            patch.object(
                handler,
                "_submit_form",
                new_callable=AsyncMock,
                return_value={"success": True, "new_url": "https://example.com/done"},
            ),
        ):
            result = await handler.fill_form(
                {"#input": "test"}, submit=True, submit_button_selector="#submit"
            )
            assert result["success"] is True
            assert "_submit" in result["results"]

    @pytest.mark.asyncio
    async def test_fill_form_error(self):
        """表单填写异常处理。"""
        mock_driver = MagicMock(spec=["find_element", "current_url"])
        handler = FormHandler(mock_driver)

        with patch.object(
            handler,
            "_fill_field",
            new_callable=AsyncMock,
            side_effect=Exception("fill error"),
        ):
            result = await handler.fill_form({"#input": "test"})
            assert result["success"] is False
            assert "error" in result


class TestFormHandlerSelenium:
    """FormHandler Selenium 模式测试。"""

    @pytest.mark.asyncio
    async def test_fill_text_input(self):
        """Selenium 填写文本框。"""
        mock_element = MagicMock()
        mock_element.tag_name = "input"
        mock_element.get_attribute.return_value = "text"

        mock_driver = MagicMock(spec=["find_element", "current_url"])
        mock_driver.find_element.return_value = mock_element

        handler = FormHandler(mock_driver)
        result = await handler._fill_field_selenium("#name", "John")

        mock_element.clear.assert_called_once()
        mock_element.send_keys.assert_called_once_with("John")
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_fill_select_dropdown(self):
        """Selenium 填写下拉选择框。"""
        mock_element = MagicMock()
        mock_element.tag_name = "select"
        mock_element.get_attribute.return_value = None

        mock_driver = MagicMock(spec=["find_element", "current_url"])
        mock_driver.find_element.return_value = mock_element

        handler = FormHandler(mock_driver)

        with patch("negentropy.perceives.scraping.form_handler.Select") as MockSelect:
            mock_select = MagicMock()
            MockSelect.return_value = mock_select

            result = await handler._fill_field_selenium("#country", "China")
            mock_select.select_by_visible_text.assert_called_once_with("China")
            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_fill_checkbox(self):
        """Selenium 填写复选框。"""
        mock_element = MagicMock()
        mock_element.tag_name = "input"
        mock_element.get_attribute.return_value = "checkbox"
        mock_element.is_selected.return_value = False

        mock_driver = MagicMock(spec=["find_element", "current_url"])
        mock_driver.find_element.return_value = mock_element

        handler = FormHandler(mock_driver)
        result = await handler._fill_field_selenium("#agree", True)

        mock_element.click.assert_called_once()
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_fill_field_error(self):
        """Selenium 填写字段异常。"""
        mock_driver = MagicMock(spec=["find_element", "current_url"])
        mock_driver.find_element.side_effect = Exception("Element not found")

        handler = FormHandler(mock_driver)
        result = await handler._fill_field_selenium("#missing", "value")

        assert result["success"] is False
        assert "error" in result


class TestFormHandlerPlaywright:
    """FormHandler Playwright 模式测试。"""

    @pytest.mark.asyncio
    async def test_fill_text_input(self):
        """Playwright 填写文本框。"""
        mock_element = AsyncMock()
        mock_element.evaluate = AsyncMock(return_value="input")
        mock_element.get_attribute = AsyncMock(return_value="text")
        mock_element.fill = AsyncMock()

        mock_page = AsyncMock()
        mock_page.fill = AsyncMock()
        mock_page.query_selector = AsyncMock(return_value=mock_element)

        handler = FormHandler(mock_page)
        result = await handler._fill_field_playwright("#name", "John")

        mock_element.fill.assert_called_once_with("John")
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_fill_element_not_found(self):
        """Playwright 元素未找到。"""
        mock_page = AsyncMock()
        mock_page.fill = AsyncMock()
        mock_page.query_selector = AsyncMock(return_value=None)

        handler = FormHandler(mock_page)
        result = await handler._fill_field_playwright("#missing", "value")

        assert result["success"] is False
        assert "Element not found" in result["error"]


class TestFormHandlerSubmit:
    """FormHandler 表单提交测试。"""

    @pytest.mark.asyncio
    async def test_submit_with_selector_selenium(self):
        """Selenium 使用指定按钮提交。"""
        mock_button = MagicMock()
        mock_driver = MagicMock(spec=["find_element", "current_url"])
        mock_driver.find_element.return_value = mock_button
        mock_driver.current_url = "https://example.com/result"

        handler = FormHandler(mock_driver)
        result = await handler._submit_form_selenium("#submit-btn")

        mock_button.click.assert_called_once()
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_submit_with_selector_playwright(self):
        """Playwright 使用指定按钮提交。"""
        mock_page = AsyncMock()
        mock_page.fill = AsyncMock()
        mock_page.url = "https://example.com/result"

        handler = FormHandler(mock_page)
        result = await handler._submit_form_playwright("#submit-btn")

        mock_page.click.assert_called_once_with("#submit-btn")
        assert result["success"] is True


class TestImportCompatibility:
    """导入兼容性测试。"""

    def test_import_from_form_handler(self):
        """直接从 form_handler 模块导入。"""
        from negentropy.perceives.scraping.form_handler import FormHandler

        assert FormHandler is not None

    def test_import_from_form_handler_module(self):
        """直接从 form_handler 模块导入。"""
        from negentropy.perceives.scraping.form_handler import FormHandler

        assert FormHandler is not None
