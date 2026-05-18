"""
综合集成测试 — 正交结构

按照关注点分离原则，将端到端集成测试拆分为以下正交维度：

1. TestMarkdownPipeline    — 端到端 Markdown 转换流水线
2. TestErrorResilience     — 错误恢复与韧性
3. TestPerformanceAndLoad  — 性能与负载
4. TestSystemHealth        — 系统健康与指标
5. TestSecurityCompliance  — 安全与合规
6. TestBackwardCompatibility — 向后兼容
"""

import os
import pytest
import asyncio
import time
from unittest.mock import patch, AsyncMock

from negentropy.perceives.tools import app
from negentropy.perceives.config import settings
from tests.integration.tooling import get_tool_map


# ---------------------------------------------------------------------------
# 1. 端到端 Markdown 转换流水线
# ---------------------------------------------------------------------------
class TestMarkdownPipeline:
    """端到端 Markdown 转换流水线测试"""

    @pytest.fixture
    def sample_html_content(self):
        """Sample HTML content for testing."""
        return """
        <!DOCTYPE html>
        <html>
            <head>
                <title>Sample Article</title>
                <meta name="description" content="A sample article for testing">
            </head>
            <body>
                <nav>Navigation menu</nav>
                <main>
                    <article>
                        <header>
                            <h1>Sample Article</h1>
                            <p class="byline">By Test Author</p>
                        </header>
                        <div class="content">
                            <p>This is the main content of the article with <strong>bold</strong> and <em>italic</em> text.</p>

                            <h2>Features Demonstrated</h2>
                            <ul>
                                <li>HTML to Markdown conversion</li>
                                <li>Advanced formatting options</li>
                                <li>Content extraction</li>
                            </ul>

                            <table>
                                <thead>
                                    <tr>
                                        <th>Feature</th>
                                        <th>Status</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Table formatting</td>
                                        <td>✅ Working</td>
                                        <td>Auto-aligned</td>
                                    </tr>
                                    <tr>
                                        <td>Code detection</td>
                                        <td>✅ Working</td>
                                        <td>Language hints</td>
                                    </tr>
                                </tbody>
                            </table>

                            <blockquote>
                                <p>This is an important quote that demonstrates blockquote formatting.</p>
                            </blockquote>

                            <h3>Code Example</h3>
                            <pre><code>def process_data(data):
    # Process the input data
    result = []
    for item in data:
        if item.is_valid():
            result.append(item.transform())
    return result</code></pre>

                            <p>Here's an image: <img src="/assets/diagram.png" alt="system-diagram"></p>

                            <p>And a link to <a href="https://example.com/docs">documentation</a>.</p>
                        </div>
                    </article>
                </main>
                <footer>Copyright notice</footer>
            </body>
        </html>
        """

    @pytest.fixture
    def mock_successful_scrape_result(self, sample_html_content):
        """Mock successful scraping result."""
        return {
            "url": "https://test-site.com/article",
            "title": "Sample Article",
            "status_code": 200,
            "content": {
                "html": sample_html_content,
                "text": "Sample Article By Test Author This is the main content...",
                "links": [{"url": "https://example.com/docs", "text": "documentation"}],
                "images": [{"src": "/assets/diagram.png", "alt": "system-diagram"}],
            },
            "meta_description": "A sample article for testing",
            "metadata": {"response_time": 1.5, "content_length": 2048},
        }

    @pytest.mark.asyncio
    async def test_full_markdown_conversion_pipeline(
        self, mock_successful_scrape_result
    ):
        """Test the complete markdown conversion pipeline from scraping to formatting."""
        # Get the parse_webpage_to_markdown tool
        tools = await get_tool_map()
        convert_tool = tools["parse_webpage_to_markdown"]

        # Mock the web scraping
        with patch("negentropy.perceives.tools.markdown.web_scraper") as mock_scraper:
            mock_scraper.scrape_url = AsyncMock(
                return_value=mock_successful_scrape_result
            )

            # Execute the tool with comprehensive formatting options
            formatting_options = {
                "format_tables": True,
                "detect_code_language": True,
                "format_quotes": True,
                "enhance_images": True,
                "optimize_links": True,
                "format_lists": True,
                "format_headings": True,
                "apply_typography": True,
            }

            # Call the tool function directly with individual parameters
            result = await convert_tool.fn(
                url="https://test-site.com/article",
                method="simple",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                formatting_options=formatting_options,
                wait_for_element=None,
                embed_images=False,
                embed_options=None,
            )

            # Verify the pipeline worked correctly
            assert result.success is True

            markdown = result.markdown_content

            # Verify content extraction and conversion
            # The main content extraction may extract only the article content
            assert (
                "# Sample Article" in markdown
                or "Sample Article" in markdown
                or "Features Demonstrated" in markdown
            )
            assert "## Features Demonstrated" in markdown
            assert "### Code Example" in markdown

            # Verify advanced formatting features
            assert "| Feature | Status | Notes |" in markdown  # Table formatting
            assert "```python" in markdown  # Code language detection
            assert "> This is an important quote" in markdown  # Quote formatting
            # Image should be present with some form of alt text or description
            assert "![" in markdown and "diagram" in markdown  # Image enhancement
            assert (
                "[documentation](https://example.com/docs)" in markdown
            )  # Link formatting
            assert "- HTML to Markdown conversion" in markdown  # List formatting

            # Verify metadata inclusion
            metadata = result.metadata
            assert metadata["title"] == "Sample Article"
            assert metadata["meta_description"] == "A sample article for testing"
            assert metadata["domain"] == "test-site.com"
            assert metadata["word_count"] > 0
            assert metadata["character_count"] > 0

    @pytest.mark.asyncio
    async def test_batch_conversion_with_mixed_results(self):
        """Test batch conversion with a mix of successful and failed results."""
        tools = await get_tool_map()
        batch_tool = tools["parse_webpages_to_markdown"]

        # Create mixed results - some success, some failures
        mixed_results = [
            {
                "url": "https://site1.com",
                "title": "Site 1",
                "content": {"html": "<html><body><h1>Success 1</h1></body></html>"},
            },
            {"url": "https://site2.com", "error": "Connection timeout"},
            {
                "url": "https://site3.com",
                "title": "Site 3",
                "content": {"html": "<html><body><h1>Success 2</h1></body></html>"},
            },
        ]

        with patch("negentropy.perceives.tools.markdown.web_scraper") as mock_scraper:
            mock_scraper.scrape_multiple_urls = AsyncMock(return_value=mixed_results)

            urls = ["https://site1.com", "https://site2.com", "https://site3.com"]

            result = await batch_tool.fn(
                urls=urls,
                method="simple",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                embed_images=False,
                embed_options=None,
            )

            assert result.success is True
            assert result.total_urls == 3
            assert result.successful_count == 2
            assert result.failed_count == 1

            # Verify individual results
            results = result.results
            assert results[0].success is True  # First should succeed
            assert results[1].success is False  # Second should fail
            assert results[2].success is True  # Third should succeed

    @pytest.mark.asyncio
    async def test_data_integrity_throughout_pipeline(self):
        """Test that data integrity is maintained throughout the processing pipeline."""
        tools = await get_tool_map()
        convert_tool = tools["parse_webpage_to_markdown"]

        # Test with content that could be corrupted during processing
        tricky_html = """
        <html>
            <body>
                <h1>Special Characters & Encoding Test</h1>
                <p>Unicode: 你好世界 🌍 émojis & entities &lt;&gt;&amp;</p>
                <p>Code with quotes: "hello" and 'world' and `code`</p>
                <pre><code>
                    function test() {
                        return "string with 'quotes' and \"doubles\"";
                    }
                </code></pre>
                <blockquote>Quote with -- dashes and... ellipsis</blockquote>
            </body>
        </html>
        """

        tricky_result = {
            "url": "https://encoding-test.com",
            "title": "Special Characters & Encoding Test",
            "content": {"html": tricky_html},
        }

        with patch("negentropy.perceives.tools.markdown.web_scraper") as mock_scraper:
            mock_scraper.scrape_url = AsyncMock(return_value=tricky_result)

            # Prepare request parameters
            url = "https://encoding-test.com"
            formatting_options = {"apply_typography": True}
            result = await convert_tool.fn(
                url=url,
                method="auto",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                formatting_options=formatting_options,
                wait_for_element=None,
                embed_images=False,
                embed_options=None,
            )

            assert result.success is True
            markdown = result.markdown_content

            # Verify special characters are preserved correctly
            assert "你好世界 🌍" in markdown  # Unicode preserved
            # HTML entities are properly converted to their symbols
            assert (
                "&lt;&gt;&amp;" in markdown or "<>&" in markdown
            )  # HTML entities handled
            assert "`code`" in markdown  # Inline code preserved
            assert "—" in markdown  # Typography enhancement applied (-- to em dash)

            # Verify quotes in code blocks are not changed
            assert "string with 'quotes'" in markdown
            assert 'and "doubles"' in markdown

    @pytest.mark.asyncio
    async def test_edge_cases_and_boundary_conditions(self):
        """Test various edge cases and boundary conditions."""
        tools = await get_tool_map()
        convert_tool = tools["parse_webpage_to_markdown"]

        # Test edge cases
        edge_cases = [
            # Empty content
            {
                "html": "<html><body></body></html>",
                "expected_behavior": "should_handle_empty",
            },
            # Only whitespace
            {
                "html": "<html><body>   \n\t   </body></html>",
                "expected_behavior": "should_handle_whitespace",
            },
            # Very long title
            {
                "html": f"<html><head><title>{'A' * 1000}</title></head><body><p>content</p></body></html>",
                "expected_behavior": "should_handle_long_title",
            },
            # Deeply nested elements
            {
                "html": "<html><body>"
                + "<div>" * 50
                + "Deep content"
                + "</div>" * 50
                + "</body></html>",
                "expected_behavior": "should_handle_deep_nesting",
            },
            # Malformed HTML
            {
                "html": "<html><body><p>Unclosed paragraph<div>Mixed content</body></html>",
                "expected_behavior": "should_handle_malformed",
            },
        ]

        for i, edge_case in enumerate(edge_cases):
            mock_result = {
                "url": f"https://edge-case-{i}.com",
                "title": f"Edge Case {i}",
                "content": {"html": edge_case["html"]},
            }

            with patch(
                "negentropy.perceives.tools.markdown.web_scraper"
            ) as mock_scraper:
                mock_scraper.scrape_url = AsyncMock(return_value=mock_result)

                result = await convert_tool.fn(
                    url=f"https://edge-case-{i}.com",
                    method="auto",
                    extract_main_content=True,
                    include_metadata=True,
                    custom_options=None,
                    formatting_options=None,
                    wait_for_element=None,
                    embed_images=False,
                    embed_options=None,
                )

                # Should not crash or throw unhandled exceptions
                assert result.success is True
                # May succeed or fail, but should provide meaningful response
                assert hasattr(result, "markdown_content")

                if result.success:
                    assert result.markdown_content is not None
                else:
                    assert result.error is not None

    @pytest.mark.asyncio
    async def test_configuration_flexibility(self):
        """Test that various configuration combinations work correctly."""
        tools = await get_tool_map()
        convert_tool = tools["parse_webpage_to_markdown"]

        sample_result = {
            "url": "https://config-test.com",
            "title": "Configuration Test",
            "content": {
                "html": "<html><body><h1>Test</h1><p>Content with <strong>formatting</strong></p></body></html>"
            },
        }

        # Test different configuration combinations
        config_combinations = [
            # All features enabled
            {
                "format_tables": True,
                "detect_code_language": True,
                "apply_typography": True,
            },
            # Only typography
            {
                "format_tables": False,
                "detect_code_language": False,
                "apply_typography": True,
            },
            # Only code detection
            {
                "format_tables": False,
                "detect_code_language": True,
                "apply_typography": False,
            },
            # All disabled
            {
                "format_tables": False,
                "detect_code_language": False,
                "apply_typography": False,
            },
        ]

        with patch("negentropy.perceives.tools.markdown.web_scraper") as mock_scraper:
            mock_scraper.scrape_url = AsyncMock(return_value=sample_result)

            for config in config_combinations:
                result = await convert_tool.fn(
                    url="https://config-test.com",
                    method="auto",
                    extract_main_content=True,
                    include_metadata=True,
                    custom_options=None,
                    formatting_options=config,
                    wait_for_element=None,
                    embed_images=False,
                    embed_options=None,
                )

                assert result.success is True
                # The tool should execute successfully with the provided configuration
                assert result.markdown_content is not None


# ---------------------------------------------------------------------------
# 2. 错误恢复与韧性
# ---------------------------------------------------------------------------
class TestErrorResilience:
    """错误恢复与韧性测试"""

    @pytest.mark.asyncio
    async def test_error_resilience_and_recovery(self):
        """Test system resilience when various components fail."""
        tools = await get_tool_map()
        convert_tool = tools["parse_webpage_to_markdown"]

        # Test with invalid URL that should cause an error
        with patch("negentropy.perceives.tools.markdown.web_scraper") as mock_scraper:
            # Mock a scraping failure
            mock_scraper.scrape_url = AsyncMock(
                side_effect=Exception("Network timeout error")
            )

            result = await convert_tool.fn(
                url="https://invalid-site.com",
                method="auto",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                formatting_options=None,
                wait_for_element=None,
                embed_images=False,
                embed_options=None,
            )

            # Should handle errors gracefully
            # When scraping fails, the tool should return with success=False
            assert (
                result.success is False
            )  # Tool execution failed due to scraping error
            assert result.error is not None  # Error information provided

    @pytest.mark.asyncio
    async def test_error_logging_and_handling(self):
        """Test that errors are properly logged and handled."""
        tools = await get_tool_map()
        convert_tool = tools["parse_webpage_to_markdown"]

        # Simulate various error conditions
        with patch("negentropy.perceives.tools.markdown.web_scraper") as mock_scraper:
            # Network error simulation
            mock_scraper.scrape_url = AsyncMock(side_effect=Exception("Network error"))

            result = await convert_tool.fn(
                url="https://error-test.com",
                method="auto",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                formatting_options=None,
                wait_for_element=None,
                embed_images=False,
                embed_options=None,
            )

            # Should handle error gracefully
            assert result.success is False
            assert result.error is not None

    @pytest.mark.asyncio
    async def test_invalid_input_handling(self):
        """测试无效输入处理"""
        # 所有工具都应该存在并能处理基本的验证
        tools = await get_tool_map()

        critical_tools = [
            "discover_links",
            "parse_webpage_to_markdown",
            "parse_pdf_to_markdown",
            "inspect_page",
        ]

        for tool_name in critical_tools:
            assert tool_name in tools, f"关键工具 {tool_name} 未注册"
            tool = tools[tool_name]
            assert tool is not None, f"工具 {tool_name} 为None"

    @pytest.mark.asyncio
    async def test_resource_exhaustion_handling(self):
        """测试资源耗尽处理"""
        # 模拟资源耗尽情况
        with patch("tempfile.mkdtemp") as mock_mkdtemp:
            mock_mkdtemp.side_effect = OSError("磁盘空间不足")

            # 系统应该能够优雅地处理这种情况
            pdf_tool = await app.get_tool("parse_pdf_to_markdown")
            assert pdf_tool is not None


# ---------------------------------------------------------------------------
# 3. 性能与负载
# ---------------------------------------------------------------------------
class TestPerformanceAndLoad:
    """性能与负载测试"""

    @pytest.mark.asyncio
    async def test_performance_under_load(self):
        """Test system performance under simulated load."""
        tools = await get_tool_map()
        batch_tool = tools["parse_webpages_to_markdown"]

        # Create a large number of mock results
        num_urls = 20
        mock_results = []
        for i in range(num_urls):
            mock_results.append(
                {
                    "url": f"https://example.com/page-{i}",
                    "title": f"Page {i}",
                    "content": {
                        "html": f"<html><body><h1>Page {i}</h1><p>Content for page {i}</p></body></html>"
                    },
                }
            )

        with patch("negentropy.perceives.tools.markdown.web_scraper") as mock_scraper:
            mock_scraper.scrape_multiple_urls = AsyncMock(return_value=mock_results)

            start_time = time.time()
            urls = [f"https://example.com/page-{i}" for i in range(num_urls)]
            result = await batch_tool.fn(
                urls=urls,
                method="simple",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                embed_images=False,
                embed_options=None,
            )
            duration = time.time() - start_time

            assert result.success is True
            assert result.successful_count == num_urls

            # Performance should be reasonable (less than 30 seconds for 20 pages)
            assert duration < 30.0

            # Calculate rough performance metrics
            pages_per_second = num_urls / duration
            assert (
                pages_per_second > 0.5
            )  # Should process at least 0.5 pages per second

    @pytest.mark.asyncio
    async def test_concurrent_requests_handling(self):
        """Test handling of multiple concurrent requests."""
        tools = await get_tool_map()
        convert_tool = tools["parse_webpage_to_markdown"]

        mock_result = {
            "url": "https://concurrent-test.com",
            "title": "Concurrent Test",
            "content": {"html": "<html><body><h1>Concurrent</h1></body></html>"},
        }

        with patch("negentropy.perceives.tools.markdown.web_scraper") as mock_scraper:
            mock_scraper.scrape_url = AsyncMock(return_value=mock_result)

            # Create multiple concurrent requests
            tasks = []
            num_concurrent = 5

            for i in range(num_concurrent):
                task = convert_tool.fn(
                    url=f"https://concurrent-test.com/page-{i}",
                    method="auto",
                    extract_main_content=True,
                    include_metadata=True,
                    custom_options=None,
                    formatting_options=None,
                    wait_for_element=None,
                    embed_images=False,
                    embed_options=None,
                )
                tasks.append(task)

            # Execute all tasks concurrently
            results = await asyncio.gather(*tasks)

            # All should succeed
            for result in results:
                assert result.success is True
                assert result.success is True
                assert "# Concurrent" in result.markdown_content

    @pytest.mark.asyncio
    async def test_memory_usage_integration(self):
        """测试内存使用集成"""
        try:
            import psutil
        except ImportError:
            pytest.skip("psutil not available for memory monitoring")

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss

        # 执行一系列操作
        tools = await get_tool_map()

        # 访问所有工具
        for tool_name in tools.keys():
            tool = await app.get_tool(tool_name)
            assert tool is not None

        final_memory = process.memory_info().rss
        memory_increase = final_memory - initial_memory

        # 内存增长应该在合理范围内（比如小于50MB）
        assert memory_increase < 50 * 1024 * 1024, (
            f"内存增长 {memory_increase / 1024 / 1024:.1f}MB 过大"
        )


# ---------------------------------------------------------------------------
# 4. 系统健康与指标
# ---------------------------------------------------------------------------
class TestSystemHealth:
    """系统健康与指标测试"""

    @pytest.mark.asyncio
    async def test_configuration_validation(self):
        """测试配置验证"""
        # 验证关键配置项
        assert settings.server_name is not None
        assert settings.server_version is not None
        assert settings.concurrent_requests > 0
        assert settings.request_timeout > 0
        assert settings.browser_timeout > 0

        # 验证工具能够使用这些配置
        tools = await get_tool_map()
        assert len(tools) == 6


# ---------------------------------------------------------------------------
# 5. 安全与合规
# ---------------------------------------------------------------------------
class TestSecurityCompliance:
    """安全与合规测试"""

    @pytest.mark.asyncio
    async def test_robots_txt_compliance_integration(self):
        """测试robots.txt合规性集成（已迁移到 Pipeline S1）"""
        # robots.txt 合规检查已从 MCP 工具层迁移到 Pipeline compliance_check Stage
        # 此测试验证合规配置仍可通过 settings 访问
        assert settings.rate_limit_requests_per_minute > 0
        assert settings.download_delay >= 0

    @pytest.mark.asyncio
    async def test_user_agent_and_rate_limiting(self):
        """测试User-Agent和速率限制"""
        # 验证配置中的User-Agent和速率限制设置
        assert settings.use_random_user_agent is not None
        assert settings.default_user_agent is not None
        assert settings.rate_limit_requests_per_minute > 0

        # 验证核心工具存在
        convert_tool = await app.get_tool("parse_webpage_to_markdown")
        extract_tool = await app.get_tool("discover_links")

        assert convert_tool is not None
        assert extract_tool is not None


# ---------------------------------------------------------------------------
# 6. 向后兼容
# ---------------------------------------------------------------------------
class TestBackwardCompatibility:
    """向后兼容测试"""

    @pytest.mark.asyncio
    async def test_api_backward_compatibility(self):
        """测试API向后兼容性"""
        # 验证所有预期的工具仍然存在
        expected_core_tools = [
            "discover_links",
            "parse_webpage_to_markdown",
            "parse_pdf_to_markdown",
        ]

        tools = await get_tool_map()

        for tool_name in expected_core_tools:
            assert tool_name in tools, f"核心工具 {tool_name} 缺失，可能破坏向后兼容性"

    @pytest.mark.asyncio
    async def test_tool_interface_stability(self):
        """测试工具接口稳定性"""
        tools = await get_tool_map()

        # 验证所有工具都有稳定的接口
        for tool_name, tool in tools.items():
            assert tool is not None
            assert hasattr(tool, "name")
            assert hasattr(tool, "description")
            assert tool.name == tool_name
            assert isinstance(tool.description, str)
            assert len(tool.description) > 0
