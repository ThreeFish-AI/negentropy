"""
单元测试：MCP 工具函数
测试 6 个 @app.tool() 装饰器的 MCP 工具函数
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest

from negentropy.perceives.tools.extraction import (
    discover_links,
    inspect_page,
)
from negentropy.perceives.tools.markdown import (
    parse_webpage_to_markdown,
    parse_webpages_to_markdown,
)
from negentropy.perceives.tools.pdf import (
    parse_pdf_to_markdown,
    parse_pdfs_to_markdown,
)


class TestMCPToolsExtraction:
    """测试数据提取 MCP 工具"""

    @pytest.mark.asyncio
    async def test_discover_links_success(self):
        """测试链接提取成功"""
        with patch("negentropy.perceives.tools.extraction.web_scraper") as mock_scraper:
            mock_result = {
                "content": {
                    "links": [
                        {"url": "https://example.com/page1", "text": "Page 1"},
                        {"url": "https://external.com/page", "text": "External"},
                    ]
                }
            }
            mock_scraper.scrape_url = AsyncMock(return_value=mock_result)

            result = await discover_links(
                url="https://example.com",
                filter_domains=None,
                exclude_domains=None,
                internal_only=True,
            )

            assert result.success is True
            # 内部链接过滤应该只保留同域名链接
            internal_links = [
                link for link in result.links if "example.com" in link.url
            ]
            assert len(internal_links) >= 1

    @pytest.mark.asyncio
    async def test_discover_links_domain_filtering(self):
        """测试域名过滤功能"""
        with patch("negentropy.perceives.tools.extraction.web_scraper") as mock_scraper:
            mock_result = {
                "content": {
                    "links": [
                        {"url": "https://example.com/page1", "text": "Page 1"},
                        {"url": "https://allowed.com/page", "text": "Allowed"},
                        {"url": "https://blocked.com/page", "text": "Blocked"},
                    ]
                }
            }
            mock_scraper.scrape_url = AsyncMock(return_value=mock_result)

            result = await discover_links(
                url="https://example.com",
                filter_domains=["example.com", "allowed.com"],
                exclude_domains=["blocked.com"],
                internal_only=False,
            )

            assert result.success is True
            # 检查过滤结果：不应包含 blocked.com
            for link in result.links:
                assert "blocked.com" not in link.url

    @pytest.mark.asyncio
    async def test_inspect_page_success(self):
        """测试页面信息获取成功"""
        with patch("negentropy.perceives.tools.extraction.web_scraper") as mock_scraper:
            mock_result = {
                "url": "https://example.com",
                "status_code": 200,
                "title": "Test Page",
                "meta_description": "A test page",
            }
            mock_scraper.http_scraper.scrape = AsyncMock(return_value=mock_result)

            result = await inspect_page(url="https://example.com")

            assert result.success is True
            assert result.title == "Test Page"
            assert result.status_code == 200


class TestMCPToolsMarkdown:
    """测试 Markdown 转换 MCP 工具"""

    @pytest.mark.asyncio
    async def test_parse_webpage_to_markdown_success(self):
        """测试单页面Markdown转换成功"""
        with (
            patch("negentropy.perceives.tools.markdown.web_scraper") as mock_scraper,
            patch(
                "negentropy.perceives.tools.markdown.markdown_converter"
            ) as mock_converter,
            patch("negentropy.perceives.ops.markdown.rate_limiter") as mock_limiter,
        ):
            mock_limiter.wait = AsyncMock()

            mock_scrape_result = {
                "url": "https://example.com",
                "content": {"html": "<h1>Test</h1><p>Content</p>"},
                "title": "Test Page",
            }
            mock_scraper.scrape_url = AsyncMock(return_value=mock_scrape_result)

            mock_conversion_result = {
                "success": True,
                "markdown": "# Test\n\nContent",
                "markdown_content": "# Test\n\nContent",
                "metadata": {"word_count": 2, "processing_time": 0.5},
            }
            mock_converter.convert_webpage_to_markdown.return_value = (
                mock_conversion_result
            )

            # 使用 method="simple" 绕过 Pipeline 路径（Pipeline 仅在 method="auto" 时触发）
            result = await parse_webpage_to_markdown(
                url="https://example.com",
                method="simple",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                wait_for_element=None,
                formatting_options=None,
                embed_images=False,
                embed_options=None,
            )

            assert result.success is True
            assert result.markdown_content == "# Test\n\nContent"

    @pytest.mark.asyncio
    async def test_parse_webpage_to_markdown_invalid_url(self):
        """测试无效URL处理"""
        result = await parse_webpage_to_markdown(
            url="invalid-url",
            method="simple",
            extract_main_content=True,
            include_metadata=True,
            custom_options=None,
            wait_for_element=None,
            formatting_options=None,
            embed_images=False,
            embed_options=None,
        )

        assert result.success is False
        assert "Invalid URL format" in result.error

    @pytest.mark.asyncio
    async def test_parse_webpages_to_markdown_success(self):
        """测试批量Markdown转换成功"""
        with (
            patch("negentropy.perceives.tools.markdown.web_scraper") as mock_scraper,
            patch(
                "negentropy.perceives.tools.markdown.markdown_converter"
            ) as mock_converter,
        ):
            mock_scrape_results = [
                {
                    "url": "https://example.com/1",
                    "content": {"html": "<h1>Page 1</h1>"},
                },
                {
                    "url": "https://example.com/2",
                    "content": {"html": "<h1>Page 2</h1>"},
                },
            ]
            mock_scraper.scrape_multiple_urls = AsyncMock(
                return_value=mock_scrape_results
            )

            mock_conversion_result = {
                "success": True,
                "results": [
                    {"success": True, "markdown": "# Page 1"},
                    {"success": True, "markdown": "# Page 2"},
                ],
                "summary": {"total": 2, "successful": 2, "failed": 0},
            }
            mock_converter.batch_convert_to_markdown.return_value = (
                mock_conversion_result
            )

            result = await parse_webpages_to_markdown(
                urls=["https://example.com/1", "https://example.com/2"],
                method="simple",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                embed_images=False,
                embed_options=None,
            )

            assert result.success is True
            assert result.total_urls == 2

    @pytest.mark.asyncio
    async def test_parse_webpages_to_markdown_empty_list(self):
        """测试空URL列表处理"""
        result = await parse_webpages_to_markdown(
            urls=[],
            method="simple",
            extract_main_content=True,
            include_metadata=True,
            custom_options=None,
            embed_images=False,
            embed_options=None,
        )

        assert result.success is False
        assert result.total_urls == 0


class TestMCPToolsPDF:
    """测试 PDF 处理 MCP 工具"""

    @pytest.mark.asyncio
    async def test_parse_pdf_to_markdown_success(self):
        """测试PDF转Markdown成功"""
        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor"
            ) as mock_get_processor,
            patch("negentropy.perceives.ops.pdf.rate_limiter") as mock_limiter,
        ):
            mock_limiter.wait = AsyncMock()

            mock_processor = Mock()
            mock_processor.process_pdf = AsyncMock(
                return_value={
                    "success": True,
                    "markdown": "# PDF Title\n\nPDF content",
                    "content": "# PDF Title\n\nPDF content",
                    "metadata": {"pages": 10, "word_count": 500},
                }
            )
            mock_get_processor.return_value = mock_processor

            # 使用 method="pymupdf" 绕过 Pipeline 路径（Pipeline 仅在 method="auto" 时触发）
            result = await parse_pdf_to_markdown(
                pdf_source="https://example.com/document.pdf",
                method="pymupdf",
                include_metadata=True,
                page_range=None,
                output_format="markdown",
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                enhanced_options=None,
            )

            assert result.success is True
            assert result.content == "# PDF Title\n\nPDF content"

    @pytest.mark.asyncio
    async def test_parse_pdf_to_markdown_invalid_page_range(self):
        """测试无效页码范围处理"""
        # page_range 需要 start < end，[10, 1] 应返回错误
        result = await parse_pdf_to_markdown(
            pdf_source="https://example.com/document.pdf",
            method="pymupdf",
            include_metadata=True,
            page_range=[10, 1],
            output_format="markdown",
            extract_images=True,
            extract_tables=True,
            extract_formulas=True,
            embed_images=False,
            enhanced_options=None,
        )

        assert result.success is False
        assert "Start page must be less than end page" in result.error

    @pytest.mark.asyncio
    async def test_parse_pdfs_to_markdown_success(self):
        """测试批量PDF转换成功"""
        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor"
            ) as mock_get_processor,
            patch("negentropy.perceives.ops.pdf.rate_limiter") as mock_limiter,
        ):
            mock_limiter.wait = AsyncMock()

            mock_processor = Mock()
            mock_processor.batch_process_pdfs = AsyncMock(
                return_value={
                    "success": True,
                    "results": [
                        {"success": True, "markdown": "# PDF 1", "content": "# PDF 1"},
                        {"success": True, "markdown": "# PDF 2", "content": "# PDF 2"},
                    ],
                    "summary": {"total": 2, "successful": 2, "failed": 0},
                }
            )
            mock_get_processor.return_value = mock_processor

            result = await parse_pdfs_to_markdown(
                pdf_sources=[
                    "https://example.com/doc1.pdf",
                    "https://example.com/doc2.pdf",
                ],
                method="pymupdf",
                include_metadata=True,
                page_range=None,
                output_format="markdown",
            )

            assert result.success is True
            assert result.total_pdfs == 2

    @pytest.mark.asyncio
    async def test_parse_pdfs_to_markdown_empty_list(self):
        """测试批量PDF转换空列表"""
        result = await parse_pdfs_to_markdown(
            pdf_sources=[],
            method="pymupdf",
            include_metadata=True,
            page_range=None,
            output_format="markdown",
        )
        assert result.success is False


class TestMCPToolsValidation:
    """测试 MCP 工具参数验证"""

    @pytest.mark.asyncio
    async def test_invalid_urls_handling(self):
        """测试无效URL的一致性处理"""
        invalid_urls = [
            "not-a-url",
            "ftp://example.com",  # 非HTTP协议
            "",  # 空字符串
            "http://",  # 不完整URL
        ]

        for invalid_url in invalid_urls:
            # 测试链接提取
            result = await discover_links(
                url=invalid_url,
                filter_domains=None,
                exclude_domains=None,
                internal_only=False,
            )
            assert result.success is False
            # 不同无效URL可能产生不同错误信息
            assert any(
                phrase in result.error
                for phrase in [
                    "Invalid URL format",
                    "No connection adapters",
                    "Unsupported protocol",
                    "Invalid schema",
                ]
            )

            # 测试页面信息获取
            result = await inspect_page(url=invalid_url)
            assert result.success is False
            assert any(
                phrase in result.error
                for phrase in [
                    "Invalid URL format",
                    "No connection adapters",
                    "Unsupported protocol",
                    "Invalid schema",
                ]
            )
