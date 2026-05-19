"""反检测抓取 (anti_detection) 单元测试。"""

import pytest
from unittest.mock import patch, AsyncMock

from negentropy.perceives.scraping.anti_detection import AntiDetectionScraper


class TestAntiDetectionScraperInit:
    """AntiDetectionScraper 初始化测试。"""

    def test_init_creates_instance(self):
        """实例化不报错。"""
        scraper = AntiDetectionScraper()
        assert scraper is not None

    def test_has_scrape_method(self):
        """核心方法存在。"""
        scraper = AntiDetectionScraper()
        assert hasattr(scraper, "scrape_with_stealth")
        assert hasattr(scraper, "cleanup")


class TestAntiDetectionScraperStealth:
    """AntiDetectionScraper 隐身抓取测试。"""

    @pytest.mark.asyncio
    async def test_invalid_stealth_method(self):
        """无效隐身方法返回错误。"""
        scraper = AntiDetectionScraper()
        result = await scraper.scrape_with_stealth(
            url="https://example.com", method="invalid_method"
        )
        assert "error" in result

    @pytest.mark.asyncio
    async def test_selenium_stealth_method_called(self):
        """Selenium 隐身方法被正确调用。"""
        scraper = AntiDetectionScraper()
        with patch.object(
            scraper,
            "_scrape_selenium",
            new_callable=AsyncMock,
            return_value={"title": "Test", "content": {}},
        ) as mock_method:
            result = await scraper.scrape_with_stealth(
                url="https://example.com", method="selenium"
            )
            mock_method.assert_called_once()
            assert result["title"] == "Test"

    @pytest.mark.asyncio
    async def test_playwright_stealth_method_called(self):
        """Playwright 隐身方法被正确调用。"""
        scraper = AntiDetectionScraper()
        with patch.object(
            scraper,
            "_scrape_playwright",
            new_callable=AsyncMock,
            return_value={"title": "Test", "content": {}},
        ) as mock_method:
            _result = await scraper.scrape_with_stealth(
                url="https://example.com", method="playwright"
            )
            mock_method.assert_called_once()

    @pytest.mark.asyncio
    async def test_error_returns_error_dict(self):
        """异常时返回错误字典。"""
        scraper = AntiDetectionScraper()
        with patch.object(
            scraper,
            "_scrape_selenium",
            new_callable=AsyncMock,
            side_effect=Exception("test error"),
        ):
            result = await scraper.scrape_with_stealth(url="https://example.com")
            assert "error" in result


class TestAntiDetectionScraperCleanup:
    """AntiDetectionScraper 资源清理测试。"""

    @pytest.mark.asyncio
    async def test_cleanup_no_op(self):
        """cleanup 为空操作（资源由上下文管理器管理）。"""
        scraper = AntiDetectionScraper()
        await scraper.cleanup()  # 不应抛出异常


class TestImportCompatibility:
    """导入兼容性测试。"""

    def test_import_from_anti_detection(self):
        """直接从 anti_detection 模块导入。"""
        from negentropy.perceives.scraping.anti_detection import AntiDetectionScraper

        assert AntiDetectionScraper is not None

    def test_import_module_level_functions(self):
        """模块级函数可导入。"""
        from negentropy.perceives.scraping.anti_detection import (
            _random_delay,
            _scroll_page_selenium,
            _scroll_page_playwright,
            _simulate_human_behavior_selenium,
            _simulate_human_behavior_playwright,
        )

        assert callable(_random_delay)
        assert callable(_scroll_page_selenium)
        assert callable(_scroll_page_playwright)
        assert callable(_simulate_human_behavior_selenium)
        assert callable(_simulate_human_behavior_playwright)
