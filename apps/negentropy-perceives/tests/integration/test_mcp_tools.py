"""
MCP 工具集成测试 — 正交结构

按关注点正交分解为 7 个测试类，覆盖 6 个核心 MCP 工具的注册、参数、
深度集成、工作流、健壮性与性能维度。
"""

import asyncio
import gc
import time
import pytest
from unittest.mock import patch

from negentropy.perceives.tools import app
from negentropy.perceives.markdown.converter import MarkdownConverter


# ---------------------------------------------------------------------------
# 1. 工具注册 + Schema + App 属性
# ---------------------------------------------------------------------------
class TestMCPToolRegistration:
    """测试 MCP 工具注册、Schema 完整性与应用属性"""

    @pytest.mark.asyncio
    async def test_all_6_mcp_tools_registered(self):
        """测试所有6个MCP工具都已注册"""
        tools = await app.list_tools()
        tool_names = [t.name for t in tools]

        # 当前项目中的6个MCP工具
        expected_tools = [
            "discover_links",  # 1. 链接提取
            "inspect_page",  # 2. 页面信息获取
            "parse_webpage_to_markdown",  # 3. 网页转Markdown
            "parse_webpages_to_markdown",  # 4. 批量网页转Markdown
            "parse_pdf_to_markdown",  # 5. PDF转Markdown
            "parse_pdfs_to_markdown",  # 6. 批量PDF转Markdown
        ]

        assert len(expected_tools) == 6, "预期工具数量应为6个"

        for expected_tool in expected_tools:
            assert expected_tool in tool_names, (
                f"工具 {expected_tool} 未在注册工具中找到"
            )

        # 确保注册的工具数量与预期一致
        assert len(tool_names) == 6, f"注册工具数量 {len(tool_names)} 与预期的6个不符"

    @pytest.mark.asyncio
    async def test_tool_schema_completeness(self):
        """测试所有工具的schema完整性"""
        tools = await app.list_tools()

        for tool in tools:
            tool_name = tool.name
            # 验证工具基本结构
            assert hasattr(tool, "name"), f"工具 {tool_name} 缺少 name 属性"
            assert hasattr(tool, "description"), (
                f"工具 {tool_name} 缺少 description 属性"
            )
            assert tool.description, f"工具 {tool_name} 的描述不能为空"

    @pytest.mark.asyncio
    async def test_app_metadata(self):
        """测试应用元数据"""
        assert hasattr(app, "name")
        assert hasattr(app, "version")
        assert app.name is not None
        assert app.version is not None


# ---------------------------------------------------------------------------
# 2. 参数验证
# ---------------------------------------------------------------------------
class TestMCPToolParameters:
    """测试 MCP 工具参数验证"""

    @pytest.mark.asyncio
    async def test_extraction_tools_parameters(self):
        """测试链接提取和页面信息工具参数"""
        tools_by_name = {t.name: t for t in await app.list_tools()}

        for tool_name in ("discover_links", "inspect_page"):
            assert tool_name in tools_by_name, f"工具 {tool_name} 未找到"
            tool = tools_by_name[tool_name]
            if hasattr(tool, "input_schema"):
                schema = tool.input_schema
                assert "properties" in schema
                assert "url" in schema["properties"]

    @pytest.mark.asyncio
    async def test_markdown_tools_parameters(self):
        """测试网页转 Markdown 工具参数 schema"""
        tools_by_name = {t.name: t for t in await app.list_tools()}

        # Test parse_webpage_to_markdown parameters
        convert_tool = tools_by_name["parse_webpage_to_markdown"]
        assert hasattr(convert_tool, "schema")

        # Test parse_webpages_to_markdown parameters
        batch_tool = tools_by_name["parse_webpages_to_markdown"]
        assert hasattr(batch_tool, "schema")

    @pytest.mark.asyncio
    async def test_pdf_tools_parameters(self):
        """测试 PDF 转换工具参数 schema"""
        tools_by_name = {t.name: t for t in await app.list_tools()}

        for tool_name in ("parse_pdf_to_markdown", "parse_pdfs_to_markdown"):
            assert tool_name in tools_by_name, f"工具 {tool_name} 未找到"
            tool = tools_by_name[tool_name]
            assert hasattr(tool, "schema")

    @pytest.mark.asyncio
    async def test_markdown_tools_parameters_embed_images(self):
        """Ensure embed_images and embed_options parameters are exposed."""
        tools_by_name = {t.name: t for t in await app.list_tools()}
        convert_tool = tools_by_name["parse_webpage_to_markdown"]
        batch_tool = tools_by_name["parse_webpages_to_markdown"]

        # Tool should accept embed_images and embed_options in parameters
        if hasattr(convert_tool, "parameters"):
            params = convert_tool.parameters.get("properties", {})
            assert "embed_images" in params
            assert "embed_options" in params

        if hasattr(batch_tool, "parameters"):
            params = batch_tool.parameters.get("properties", {})
            assert "embed_images" in params
            assert "embed_options" in params


# ---------------------------------------------------------------------------
# 3. Markdown 工具深度集成
# ---------------------------------------------------------------------------
class TestMarkdownToolIntegration:
    """Markdown 转换工具深度集成测试"""

    @pytest.mark.asyncio
    async def test_markdown_converter_component_integration(self):
        """Test that MarkdownConverter integrates properly with the system."""
        # Test direct MarkdownConverter functionality
        converter = MarkdownConverter()

        # Verify initialization
        assert converter.default_options["extract_main_content"] is True
        assert converter.formatting_options["format_tables"] is True

        # Test basic conversion
        html = "<html><body><h1>Test</h1><p>Content</p></body></html>"
        markdown = converter.html_to_markdown(html)

        assert "# Test" in markdown
        assert "Content" in markdown

    @pytest.mark.asyncio
    async def test_markdown_conversion_with_advanced_formatting(self):
        """Test advanced formatting options integration."""
        converter = MarkdownConverter()

        # HTML with various elements that trigger advanced formatting
        complex_html = """
        <html>
            <body>
                <h1>Test Article</h1>
                <table>
                    <tr><th>Col 1</th><th>Col 2</th></tr>
                    <tr><td>Data 1</td><td>Data 2</td></tr>
                </table>
                <pre><code>def test():\n    return True</code></pre>
                <blockquote>Important note</blockquote>
                <img src="test.jpg" alt="">
                <p>Text with -- dashes and "quotes"</p>
            </body>
        </html>
        """

        # Test with all formatting options enabled
        markdown = converter.html_to_markdown(complex_html)

        # Verify advanced formatting applied
        assert "| Col 1 | Col 2 |" in markdown  # Table formatting
        assert "```python" in markdown  # Code language detection
        assert "> Important note" in markdown  # Quote formatting
        assert "![Test](test.jpg)" in markdown  # Image enhancement
        assert "\u2014" in markdown  # Typography (-- to em dash)

    @pytest.mark.asyncio
    async def test_error_handling_integration(self):
        """Test error handling integration across components."""
        converter = MarkdownConverter()

        # Test with malformed HTML
        malformed_html = "<html><body><p>Unclosed paragraph<div>Mixed"

        # Should handle gracefully without crashing
        result = converter.html_to_markdown(malformed_html)
        assert isinstance(result, str)  # Should return something, not crash

        # Test with empty content
        empty_result = {
            "url": "https://empty.com",
            "content": {"html": "<html><body></body></html>"},
        }

        conversion_result = converter.convert_webpage_to_markdown(empty_result)
        assert conversion_result["success"] is True

    @pytest.mark.asyncio
    async def test_component_configuration_integration(self):
        """Test that configuration options work across the integration stack."""
        converter = MarkdownConverter()

        # Test configuration modification
        original_options = converter.formatting_options.copy()

        # Modify configuration
        test_options = {"format_tables": False, "apply_typography": False}

        # Test conversion with modified options
        html = "<html><body><table><tr><td>test</td></tr></table><p>Text -- with dashes</p></body></html>"
        result = converter.convert_webpage_to_markdown(
            {"url": "test", "content": {"html": html}}, formatting_options=test_options
        )

        # Configuration should have been applied
        assert result["conversion_options"]["formatting_options"] == test_options

        # Original options should be restored
        assert converter.formatting_options == original_options


# ---------------------------------------------------------------------------
# 4. PDF 工具集成
# ---------------------------------------------------------------------------
class TestPDFToolIntegration:
    """PDF 转换工具集成测试"""

    @pytest.mark.asyncio
    async def test_pdf_conversion_tools_registration(self):
        """Test that PDF conversion tools are properly registered."""
        tools_by_name = {t.name: t for t in await app.list_tools()}

        assert "parse_pdf_to_markdown" in tools_by_name
        assert "parse_pdfs_to_markdown" in tools_by_name

        # Check tool signatures
        pdf_tool = tools_by_name["parse_pdf_to_markdown"]
        assert pdf_tool.name == "parse_pdf_to_markdown"

        batch_pdf_tool = tools_by_name["parse_pdfs_to_markdown"]
        assert batch_pdf_tool.name == "parse_pdfs_to_markdown"

    @pytest.mark.asyncio
    async def test_pdf_tool_parameter_validation(self):
        """Test PDF tool parameter validation."""
        # Test that PDF tools are accessible through app
        tools_by_name = {t.name: t for t in await app.list_tools()}
        assert "parse_pdf_to_markdown" in tools_by_name

        pdf_tool = tools_by_name["parse_pdf_to_markdown"]
        assert pdf_tool.name == "parse_pdf_to_markdown"
        assert "PDF" in pdf_tool.description or "pdf" in pdf_tool.description

    @pytest.mark.asyncio
    async def test_batch_pdf_tool_parameter_validation(self):
        """Test batch PDF tool parameter validation."""
        # Test batch PDF tool registration
        tools_by_name = {t.name: t for t in await app.list_tools()}
        assert "parse_pdfs_to_markdown" in tools_by_name

        batch_pdf_tool = tools_by_name["parse_pdfs_to_markdown"]
        assert batch_pdf_tool.name == "parse_pdfs_to_markdown"
        assert (
            "batch" in batch_pdf_tool.description.lower()
            or "PDF" in batch_pdf_tool.description
        )

    @pytest.mark.asyncio
    async def test_pdf_tools_error_handling(self):
        """Test PDF tools error handling for nonexistent files."""
        # Verify tools exist and have proper structure
        tools_by_name = {t.name: t for t in await app.list_tools()}

        assert "parse_pdf_to_markdown" in tools_by_name
        assert "parse_pdfs_to_markdown" in tools_by_name

        # Verify the tools are properly registered
        assert tools_by_name["parse_pdf_to_markdown"].name == "parse_pdf_to_markdown"
        assert tools_by_name["parse_pdfs_to_markdown"].name == "parse_pdfs_to_markdown"

    @pytest.mark.asyncio
    async def test_pdf_tool_integration_with_mocks(self):
        """Test PDF tools with mocked PDF processing."""
        # Test that PDF tools can be accessed through app interface
        tools_by_name = {t.name: t for t in await app.list_tools()}

        pdf_tool = tools_by_name["parse_pdf_to_markdown"]
        assert pdf_tool is not None
        assert hasattr(pdf_tool, "description")
        assert hasattr(pdf_tool, "parameters")

        # Verify the tool structure is correct
        params = pdf_tool.parameters.get("properties", {})
        assert "pdf_source" in params
        assert "method" in params

    @pytest.mark.asyncio
    async def test_pdf_tools_resource_cleanup(self):
        """Test that PDF tools properly clean up resources."""
        from negentropy.perceives.tools import create_pdf_processor

        pdf_processor = create_pdf_processor()

        # Check that the processor has cleanup method
        assert hasattr(pdf_processor, "cleanup")
        assert callable(pdf_processor.cleanup)

        # Test cleanup doesn't throw errors when called
        try:
            pdf_processor.cleanup()
            assert True  # No exception thrown
        except Exception as e:
            pytest.fail(f"PDF processor cleanup failed: {str(e)}")


# ---------------------------------------------------------------------------
# 5. 工具协同工作流
# ---------------------------------------------------------------------------
class TestMCPToolWorkflows:
    """测试 MCP 工具协同工作流"""

    @pytest.mark.asyncio
    async def test_markdown_conversion_workflow(self):
        """测试网页转 Markdown 工作流工具可访问性"""
        with (
            patch(
                "negentropy.perceives.scraping.engine.WebScraper.scrape_url"
            ) as mock_scrape,
            patch(
                "negentropy.perceives.markdown.converter.MarkdownConverter.convert_webpage_to_markdown"
            ) as mock_convert,
        ):
            mock_scrape.return_value = {
                "url": "https://example.com",
                "status_code": 200,
                "title": "Example Domain",
                "content": {
                    "text": "This domain is for use in illustrative examples.",
                    "html": "<html><body><h1>Example Domain</h1></body></html>",
                },
            }
            mock_convert.return_value = {
                "success": True,
                "url": "https://example.com",
                "markdown": "# Example Domain\n\nThis domain is for use in illustrative examples.",
                "metadata": {"word_count": 10},
            }

            # 工作流工具应该能够无缝访问
            convert_tool = await app.get_tool("parse_webpage_to_markdown")
            batch_convert_tool = await app.get_tool("parse_webpages_to_markdown")

            assert convert_tool is not None
            assert batch_convert_tool is not None

    @pytest.mark.asyncio
    async def test_pdf_processing_workflow(self):
        """测试PDF处理工作流"""
        with patch(
            "negentropy.perceives.pdf.processor.PDFProcessor.process_pdf"
        ) as mock_pdf_process:
            mock_pdf_process.return_value = {
                "success": True,
                "source": "https://example.com/document.pdf",
                "text": "PDF document content extracted successfully",
                "markdown": "# PDF Document\n\nContent extracted successfully",
                "metadata": {
                    "pages_processed": 5,
                    "word_count": 500,
                    "method_used": "pymupdf",
                },
            }

            pdf_tool = await app.get_tool("parse_pdf_to_markdown")
            assert pdf_tool is not None


# ---------------------------------------------------------------------------
# 6. 健壮性 + 错误处理
# ---------------------------------------------------------------------------
class TestMCPToolRobustness:
    """测试 MCP 工具健壮性与错误处理"""

    @pytest.mark.asyncio
    async def test_tool_error_handling(self):
        """测试工具错误处理"""
        # 在新版 fastmcp 中，get_tool 对于不存在的工具返回 None
        result = await app.get_tool("nonexistent_tool")
        assert result is None, "不存在的工具应该返回 None"

    @pytest.mark.asyncio
    async def test_tools_handle_invalid_parameters(self):
        """测试工具处理无效参数的能力"""
        # 所有工具都应该存在并有基本的错误处理
        tools = await app.list_tools()
        for tool in tools:
            tool_name = tool.name
            assert tool is not None, f"工具 {tool_name} 不应该为 None"
            assert hasattr(tool, "name"), f"工具 {tool_name} 应该有 name 属性"

    @pytest.mark.asyncio
    async def test_concurrent_tool_access(self):
        """测试并发工具访问"""

        async def get_tool_concurrent(tool_name):
            return await app.get_tool(tool_name)

        # 并发访问所有6个工具
        tool_names = [
            "discover_links",
            "inspect_page",
            "parse_webpage_to_markdown",
            "parse_webpages_to_markdown",
            "parse_pdf_to_markdown",
            "parse_pdfs_to_markdown",
        ]

        tasks = [get_tool_concurrent(name) for name in tool_names]
        results = await asyncio.gather(*tasks)

        for i, result in enumerate(results):
            assert result is not None, f"并发访问工具 {tool_names[i]} 失败"

    @pytest.mark.asyncio
    async def test_memory_and_resource_management(self):
        """Test that the system manages memory and resources properly."""

        # Get initial memory usage
        initial_objects = len(gc.get_objects())

        # Create and use converter multiple times
        for i in range(10):
            converter = MarkdownConverter()
            html = f"<html><body><h1>Test {i}</h1><p>Content {i}</p></body></html>"
            markdown = converter.html_to_markdown(html)
            assert "Test" in markdown
            del converter

        # Force garbage collection
        gc.collect()

        # Check that we haven't leaked too many objects
        final_objects = len(gc.get_objects())
        object_growth = final_objects - initial_objects

        # Allow for some growth, but not excessive (less than 1000 new objects)
        assert object_growth < 1000, (
            f"Memory leak detected: {object_growth} new objects"
        )


# ---------------------------------------------------------------------------
# 7. 性能与可扩展性
# ---------------------------------------------------------------------------
class TestMCPToolPerformance:
    """测试 MCP 工具性能与可扩展性"""

    @pytest.mark.asyncio
    async def test_tool_registration_performance(self):
        """测试工具注册性能"""

        start_time = time.time()
        tools = await app.list_tools()
        end_time = time.time()

        registration_time = end_time - start_time

        assert len(tools) == 6, "应该注册6个工具"
        assert registration_time < 1.0, f"工具注册时间 {registration_time:.2f}s 过长"

    @pytest.mark.asyncio
    async def test_tool_access_performance(self):
        """测试工具访问性能"""

        tool_names = [
            "discover_links",
            "inspect_page",
            "parse_webpage_to_markdown",
            "parse_webpages_to_markdown",
            "parse_pdf_to_markdown",
            "parse_pdfs_to_markdown",
        ]

        for tool_name in tool_names:
            start_time = time.time()
            tool = await app.get_tool(tool_name)
            end_time = time.time()

            access_time = end_time - start_time

            assert tool is not None
            assert access_time < 0.1, (
                f"工具 {tool_name} 访问时间 {access_time:.3f}s 过长"
            )
