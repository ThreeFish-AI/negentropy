"""Pytest configuration and shared fixtures."""

import pytest
import tempfile
from unittest.mock import Mock, AsyncMock

from negentropy.perceives.config import NegentropyPerceivesSettings
from negentropy.perceives.scraping import WebScraper
from negentropy.perceives.scraping import AntiDetectionScraper
from negentropy.perceives.scraping import FormHandler


@pytest.fixture
def test_config():
    """Test configuration with safe defaults."""
    return NegentropyPerceivesSettings(
        server_name="Test Negentropy Perceives",
        server_version="1.0.0-test",
        enable_javascript=False,
        use_random_user_agent=False,
        concurrent_requests=1,
        browser_timeout=10,
        max_retries=2,
    )


@pytest.fixture
def mock_web_scraper():
    """Mock WebScraper for testing."""
    scraper = Mock(spec=WebScraper)
    scraper.scrape_url = AsyncMock()
    scraper.scrape_multiple_urls = AsyncMock()
    return scraper


@pytest.fixture
def mock_anti_detection_scraper():
    """Mock AntiDetectionScraper for testing."""
    scraper = Mock(spec=AntiDetectionScraper)
    scraper.scrape_with_stealth = AsyncMock()
    return scraper


@pytest.fixture
def mock_form_handler():
    """Mock FormHandler for testing."""
    handler = Mock(spec=FormHandler)
    handler.fill_and_submit_form = AsyncMock()
    return handler


@pytest.fixture
def sample_html():
    """Sample HTML content for testing."""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Page</title>
    </head>
    <body>
        <h1>Test Heading</h1>
        <div class="content">
            <p>Test paragraph 1</p>
            <p>Test paragraph 2</p>
        </div>
        <ul class="list">
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
        </ul>
        <a href="https://example.com">Test Link</a>
        <form id="test-form">
            <input type="text" name="username" />
            <input type="password" name="password" />
            <button type="submit">Submit</button>
        </form>
    </body>
    </html>
    """


@pytest.fixture
def sample_extraction_config():
    """Sample extraction configuration for testing."""
    return {
        "title": "title",
        "heading": "h1",
        "content": {"selector": ".content p", "multiple": True, "attr": "text"},
        "links": {"selector": "a", "multiple": True, "attr": "href"},
    }


@pytest.fixture
def sample_scrape_result():
    """Sample scrape result for testing."""
    return {
        "url": "https://example.com",
        "status_code": 200,
        "title": "Test Page",
        "content": "Test content",
        "extracted_data": {
            "title": "Test Page",
            "heading": "Test Heading",
            "content": ["Test paragraph 1", "Test paragraph 2"],
            "links": ["https://example.com"],
        },
        "metadata": {
            "content_length": 500,
            "response_time": 1.5,
            "final_url": "https://example.com",
            "content_type": "text/html",
        },
    }


@pytest.fixture
def temp_cache_dir():
    """Temporary directory for cache testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield temp_dir


@pytest.fixture
def mock_http_response():
    """Mock HTTP response for testing."""
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.text = """
    <html>
        <head><title>Mock Page</title></head>
        <body><h1>Mock Content</h1></body>
    </html>
    """
    mock_response.headers = {"content-type": "text/html"}
    mock_response.url = "https://example.com"
    return mock_response
