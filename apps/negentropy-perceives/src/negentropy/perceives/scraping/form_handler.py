"""表单交互与提交处理模块。"""

import asyncio
import logging
from typing import Dict, Any, Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoSuchElementException

logger = logging.getLogger(__name__)


class FormHandler:
    """处理表单交互与提交。"""

    def __init__(self, driver_or_page: Any) -> None:
        self.driver_or_page = driver_or_page
        # Simple check for Playwright page
        self.is_playwright = hasattr(driver_or_page, "fill")

    async def fill_form(
        self,
        form_data: Dict[str, Any],
        submit: bool = False,
        submit_button_selector: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        填充表单并可选提交。

        Args:
            form_data: 字段选择器到值的映射字典
            submit: 是否提交表单
            submit_button_selector: 提交按钮的选择器（不使用默认按钮时指定）
        """
        try:
            results = {}

            for field_selector, value in form_data.items():
                field_result = await self._fill_field(field_selector, value)
                results[field_selector] = field_result

            if submit:
                submit_result = await self._submit_form(submit_button_selector)
                results["_submit"] = submit_result

            return {"success": True, "results": results}

        except Exception as e:
            logger.error(f"Error filling form: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _fill_field(self, selector: str, value: Any) -> Dict[str, Any]:
        """填充单个表单字段。"""
        try:
            if self.is_playwright:
                return await self._fill_field_playwright(selector, value)
            else:
                return await self._fill_field_selenium(selector, value)

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _fill_field_selenium(self, selector: str, value: Any) -> Dict[str, Any]:
        """使用 Selenium 填充字段。"""
        try:
            element = self.driver_or_page.find_element(By.CSS_SELECTOR, selector)
            tag_name = element.tag_name.lower()
            input_type = element.get_attribute("type")

            if tag_name == "select":
                # Handle select dropdown
                select = Select(element)
                if isinstance(value, int):
                    select.select_by_index(value)
                elif str(value).isdigit():
                    select.select_by_value(str(value))
                else:
                    select.select_by_visible_text(str(value))

            elif input_type in ["checkbox", "radio"]:
                # Handle checkbox/radio
                if value and not element.is_selected():
                    element.click()
                elif not value and element.is_selected():
                    element.click()

            elif input_type == "file":
                # Handle file upload
                element.send_keys(str(value))

            else:
                # Handle text inputs
                element.clear()
                element.send_keys(str(value))

            return {"success": True, "value": value}

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _fill_field_playwright(self, selector: str, value: Any) -> Dict[str, Any]:
        """使用 Playwright 填充字段。"""
        try:
            element = await self.driver_or_page.query_selector(selector)
            if not element:
                return {"success": False, "error": "Element not found"}

            tag_name = await element.evaluate("el => el.tagName.toLowerCase()")
            input_type = await element.get_attribute("type")

            if tag_name == "select":
                # Handle select dropdown
                if isinstance(value, int):
                    await element.select_option(index=value)
                else:
                    await element.select_option(label=str(value))

            elif input_type in ["checkbox", "radio"]:
                # Handle checkbox/radio
                is_checked = await element.is_checked()
                if value and not is_checked:
                    await element.check()
                elif not value and is_checked:
                    await element.uncheck()

            elif input_type == "file":
                # Handle file upload
                await element.set_input_files(str(value))

            else:
                # Handle text inputs
                await element.fill(str(value))

            return {"success": True, "value": value}

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _submit_form(
        self, submit_button_selector: Optional[str] = None
    ) -> Dict[str, Any]:
        """提交表单。"""
        try:
            if self.is_playwright:
                return await self._submit_form_playwright(submit_button_selector)
            else:
                return await self._submit_form_selenium(submit_button_selector)

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _submit_form_selenium(
        self, submit_button_selector: Optional[str] = None
    ) -> Dict[str, Any]:
        """使用 Selenium 提交表单。"""
        try:
            if submit_button_selector:
                # Use specific submit button
                submit_button = self.driver_or_page.find_element(
                    By.CSS_SELECTOR, submit_button_selector
                )
                submit_button.click()
            else:
                # Try to find submit button automatically
                submit_selectors = [
                    "input[type='submit']",
                    "button[type='submit']",
                    "button:contains('Submit')",
                    "input[value*='Submit']",
                    "button:contains('Send')",
                ]

                for selector in submit_selectors:
                    try:
                        if "contains" in selector:
                            # Use XPath for text content
                            xpath = "//button[contains(text(), 'Submit')] | //button[contains(text(), 'Send')]"
                            submit_button = self.driver_or_page.find_element(
                                By.XPATH, xpath
                            )
                        else:
                            submit_button = self.driver_or_page.find_element(
                                By.CSS_SELECTOR, selector
                            )

                        submit_button.click()
                        break
                    except NoSuchElementException:
                        continue
                else:
                    # If no submit button found, try submitting the form directly
                    form = self.driver_or_page.find_element(By.TAG_NAME, "form")
                    form.submit()

            # Wait for page to load after submission
            await asyncio.sleep(2)

            return {"success": True, "new_url": self.driver_or_page.current_url}

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _submit_form_playwright(
        self, submit_button_selector: Optional[str] = None
    ) -> Dict[str, Any]:
        """使用 Playwright 提交表单。"""
        try:
            if submit_button_selector:
                # Use specific submit button
                await self.driver_or_page.click(submit_button_selector)
            else:
                # Try to find submit button automatically
                submit_selectors = [
                    "input[type='submit']",
                    "button[type='submit']",
                    "text=Submit",
                    "text=Send",
                ]

                for selector in submit_selectors:
                    try:
                        await self.driver_or_page.click(selector)
                        break
                    except Exception:  # nosec B112
                        # Continue trying next submit button selector
                        continue
                else:
                    # If no submit button found, press Enter on the form
                    await self.driver_or_page.keyboard.press("Enter")

            # Wait for navigation or response
            try:
                await self.driver_or_page.wait_for_load_state(
                    "networkidle", timeout=10000
                )
            except Exception:  # nosec B110
                # Ignore timeout or navigation errors - form might submit without page load
                pass

            return {"success": True, "new_url": self.driver_or_page.url}

        except Exception as e:
            return {"success": False, "error": str(e)}
