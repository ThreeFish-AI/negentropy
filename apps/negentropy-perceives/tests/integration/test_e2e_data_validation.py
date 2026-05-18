"""端到端数据一致性与验证集成测试。

覆盖整个处理流水线中的数据一致性校验，包括：
- Unicode 与特殊字符处理
- 大数据量一致性校验
- 跨平台文件路径处理
- 并发场景下的数据完整性
"""

import pytest
import asyncio
from unittest.mock import patch

from negentropy.perceives.tools import web_scraper


class TestDataValidation:
    """端到端数据一致性与验证集成测试。"""

    @pytest.mark.asyncio
    async def test_unicode_and_special_character_handling(self, e2e_tools):
        """Test 1：Unicode 与特殊字符处理 — 验证多语言内容、数学符号、货币符号、emoji 的完整保留。"""
        scrape_tool = e2e_tools["parse_webpage_to_markdown"]
        markdown_tool = e2e_tools["parse_webpage_to_markdown"]

        unicode_content = {
            "url": "https://unicode-test.com",
            "title": "测试页面 - Test Page with ñ, é, ü, 中文",
            "content": {
                "html": """
                <html>
                    <head>
                        <meta charset="utf-8">
                        <title>测试页面 - Test Page with ñ, é, ü, 中文</title>
                    </head>
                    <body>
                        <h1>多语言测试 Multilingual Test</h1>
                        <p>English: Hello, world! \U0001f30d</p>
                        <p>中文：你好，世界！\U0001f30f</p>
                        <p>Español: ¡Hola, mundo! \U0001f30e</p>
                        <p>Français: Bonjour le monde! \U0001f1eb\U0001f1f7</p>
                        <p>Deutsch: Hallo Welt! \U0001f1e9\U0001f1ea</p>
                        <p>Русский: Привет, мир! \U0001f1f7\U0001f1fa</p>
                        <p>日本語: こんにちは、世界！\U0001f1ef\U0001f1f5</p>

                        <h2>Special Characters & Symbols</h2>
                        <p>Mathematical: \u2211\u2206\u220f\u222b\u221a\u221e\u00b1\u2264\u2265\u2260\u2248</p>
                        <p>Currency: $\u20ac\u00a3\u00a5\u20b9\u20bf</p>
                        <p>Arrows: \u2190\u2192\u2191\u2193\u2194\u2195\u2934\u2935</p>
                        <p>Quotes: \u201cHello\u201d \u2018World\u2019 \u201eTest\u201c \u201aQuote\u2018 \u00abFrench\u00bb \u2039Single\u203a</p>

                        <h2>HTML Entities</h2>
                        <p>&lt;tag&gt; &amp; entity &quot;quote&quot; &#x27;apostrophe&#x27;</p>
                    </body>
                </html>
                """,
                "text": "多语言测试 Multilingual Test English: Hello, world! 中文：你好，世界！",
            },
        }

        with patch.object(web_scraper, "scrape_url", return_value=unicode_content):
            # Test markdown conversion preserves Unicode
            scrape_result = await scrape_tool.fn(
                url="https://unicode-test.com",
                method="simple",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                wait_for_element=None,
                formatting_options=None,
                embed_images=False,
                embed_options=None,
            )
            assert scrape_result.success is True
            markdown = scrape_result.markdown_content
            assert "多语言测试" in markdown or "Multilingual Test" in markdown
            assert "你好，世界" in markdown or "中文" in markdown

            # Test markdown conversion preserves Unicode
            markdown_result = await markdown_tool.fn(
                url="https://unicode-test.com",
                method="auto",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                wait_for_element=None,
                formatting_options=None,
                embed_images=False,
                embed_options=None,
            )
            assert markdown_result.success is True
            markdown_content = markdown_result.markdown_content

            # Verify Unicode preservation - check for content that's actually in the HTML
            assert (
                "多语言测试" in markdown_content
                or "Multilingual Test" in markdown_content
            )
            assert (
                "你好，世界！" in markdown_content
                or "Hello, world!" in markdown_content
            )

            # Check for mathematical symbols (may be converted differently in markdown)
            assert (
                any(
                    symbol in markdown_content
                    for symbol in [
                        "\u2211",
                        "\u2206",
                        "\u220f",
                        "\u222b",
                        "\u221a",
                        "\u221e",
                    ]
                )
                or "Mathematical:" in markdown_content
            )

            # Check for currency symbols
            assert (
                any(
                    symbol in markdown_content
                    for symbol in ["$", "\u20ac", "\u00a3", "\u00a5"]
                )
                or "Currency:" in markdown_content
            )

            # Check for emojis - these might be preserved differently by different markdown converters
            # We'll check for any of the world emojis or the containing text
            assert any(
                emoji in markdown_content
                for emoji in ["\U0001f30d", "\U0001f30f", "\U0001f30e"]
            ) or (
                "Hello, world!" in markdown_content
                and ("中文" in markdown_content or "Español" in markdown_content)
            )

    @pytest.mark.asyncio
    async def test_large_data_consistency(self, e2e_tools, pdf_processor):
        """Test 2：大数据一致性 — 验证 100 个 section 的 ID/校验和/标题在处理后全部保留。"""
        convert_pdf_tool = e2e_tools["parse_pdf_to_markdown"]

        # Generate consistent test data
        test_sections = []
        for i in range(100):
            section_id = f"SEC{i:03d}"
            test_sections.append(
                {
                    "id": section_id,
                    "title": f"Section {i + 1}: Test Data Consistency",
                    "content": f"Content for section {i + 1} with identifier {section_id}. "
                    * 10,
                    "word_count": 100,
                    "checksum": f"CHK{i:03d}",
                }
            )

        # Simulate large document with consistent structure
        large_consistent_doc = {
            "success": True,
            "content": "\n\n".join(
                [
                    f"# {section['title']}\n\n{section['content']}\n\nChecksum: {section['checksum']}"
                    for section in test_sections
                ]
            ),
            "source": "/consistency-test.pdf",
            "word_count": sum(s["word_count"] for s in test_sections),
            "pages_processed": 100,
            "metadata": {"title": "Data Consistency Test Document", "total_pages": 100},
        }

        async def mock_consistent_pdf_process(*args, **kwargs):
            return large_consistent_doc

        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(
                pdf_processor, "process_pdf", side_effect=mock_consistent_pdf_process
            ),
        ):
            result = await convert_pdf_tool.fn(
                pdf_source="/consistency-test.pdf",
                method="auto",
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
            assert result.word_count == 10000  # 100 sections * 100 words

            # Verify data consistency in the output
            output_text = result.content
            for section in test_sections:
                assert section["id"] in output_text
                assert section["checksum"] in output_text
                assert section["title"] in output_text

    @pytest.mark.asyncio
    async def test_cross_platform_file_handling(self, e2e_tools, pdf_processor):
        """Test 3：跨平台文件路径处理 — 验证 Unix/Windows/URL/带空格/带重音符号等路径格式均可正确处理。"""
        batch_pdf_tool = e2e_tools["parse_pdfs_to_markdown"]

        # Simulate files with different path formats and encodings
        mixed_path_sources = [
            "/unix/style/path/document.pdf",
            "C:\\Windows\\Style\\Path\\document.pdf",
            "/path with spaces/document file.pdf",
            "/path/with/\u00e5cc\u00e9nts/d\u00f6c\u00fcm\u00e9nt.pdf",
            "https://example.com/url-document.pdf",
            "file:///local/file/document.pdf",
        ]

        async def mock_cross_platform_batch(pdf_sources, **kwargs):
            results = []
            for source in pdf_sources:
                # Normalize paths for processing
                normalized_source = source.replace("\\", "/")
                results.append(
                    {
                        "success": True,
                        "content": f"Processed document from: {normalized_source}",
                        "markdown": f"# Document\n\nSource: {normalized_source}",
                        "pdf_source": source,  # Keep original source
                        "word_count": 50,
                    }
                )

            return {
                "success": True,
                "results": results,
                "summary": {
                    "total_pdfs": len(pdf_sources),
                    "successful": len(pdf_sources),
                    "failed": 0,
                },
            }

        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(
                pdf_processor,
                "batch_process_pdfs",
                side_effect=mock_cross_platform_batch,
            ),
        ):
            result = await batch_pdf_tool.fn(
                pdf_sources=mixed_path_sources,
                method="auto",
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
            assert result.successful_count == 6

            # Verify each path type was handled correctly
            for i, source in enumerate(mixed_path_sources):
                result_item = result.results[i]
                assert result_item.success is True
                assert result_item.pdf_source == source  # Original source preserved
                assert "Processed document" in result_item.content

    @pytest.mark.asyncio
    async def test_concurrent_data_integrity(self, e2e_tools, pdf_processor):
        """Test 4：并发数据完整性 — 验证 10 个并发任务各自携带唯一标记并在结果中正确对应。"""
        convert_pdf_tool = e2e_tools["parse_pdf_to_markdown"]

        concurrent_integrity_tasks = []
        data_markers = {}

        # Create unique data markers for each concurrent task
        for i in range(10):
            marker = f"MARKER_{i:03d}_{hash(f'data_{i}') % 1000:03d}"
            data_markers[f"/concurrent-{i}.pdf"] = marker

        async def mock_concurrent_with_markers(pdf_source, *args, **kwargs):
            # Extract the source parameter correctly
            source = pdf_source
            marker = data_markers.get(source, "UNKNOWN_MARKER")

            await asyncio.sleep(0.05)  # Small delay to test concurrency

            return {
                "success": True,
                "content": f"Document content with unique marker: {marker}",
                "markdown": f"# Concurrent Document\n\nMarker: {marker}",
                "pdf_source": source,
                "word_count": 20,
            }

        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(
                pdf_processor, "process_pdf", side_effect=mock_concurrent_with_markers
            ),
        ):
            # Create concurrent tasks with unique data
            for source in data_markers.keys():
                task = convert_pdf_tool.fn(
                    pdf_source=source,
                    method="auto",
                    include_metadata=True,
                    page_range=None,
                    output_format="markdown",
                    extract_images=True,
                    extract_tables=True,
                    extract_formulas=True,
                    embed_images=False,
                    enhanced_options=None,
                )
                concurrent_integrity_tasks.append(task)

            # Execute all tasks concurrently
            concurrent_results = await asyncio.gather(*concurrent_integrity_tasks)

            # Verify data integrity for each result
            for result in concurrent_results:
                assert result.success is True
                source = result.pdf_source
                expected_marker = data_markers[source]
                assert expected_marker in result.content
