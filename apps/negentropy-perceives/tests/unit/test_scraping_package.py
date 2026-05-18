"""scraping/ 子包结构与向后兼容性验证。"""


class TestScrapingPackageExports:
    """验证 scraping/ 子包的 __init__.py 导出完整性。"""

    def test_import_web_scraper_from_scraping(self):
        from negentropy.perceives.scraping import WebScraper

        assert WebScraper is not None

    def test_import_http_scraper_from_scraping(self):
        from negentropy.perceives.scraping import HttpScraper

        assert HttpScraper is not None

    def test_import_selenium_scraper_from_scraping(self):
        from negentropy.perceives.scraping import SeleniumScraper

        assert SeleniumScraper is not None

    def test_import_anti_detection_scraper_from_scraping(self):
        from negentropy.perceives.scraping import AntiDetectionScraper

        assert AntiDetectionScraper is not None

    def test_import_form_handler_from_scraping(self):
        from negentropy.perceives.scraping import FormHandler

        assert FormHandler is not None

    def test_import_build_chrome_options_from_scraping(self):
        from negentropy.perceives.scraping import build_chrome_options

        assert callable(build_chrome_options)

    def test_import_session_managers_from_scraping(self):
        from negentropy.perceives.scraping import (
            playwright_session,
            selenium_session,
            stealth_playwright_session,
            stealth_selenium_session,
        )

        assert callable(selenium_session)
        assert callable(playwright_session)
        assert callable(stealth_selenium_session)
        assert callable(stealth_playwright_session)
