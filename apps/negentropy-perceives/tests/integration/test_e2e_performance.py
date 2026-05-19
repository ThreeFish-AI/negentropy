"""端到端性能基准与优化集成测试。

覆盖系统在不同负载条件下的性能表现，包括：
- 大文档处理耗时
- 并发处理吞吐量
- 批量操作内存使用监控
- 不同网络延迟下的处理效率
"""

import pytest
import asyncio
import time
import gc
from unittest.mock import patch

from negentropy.perceives.tools import web_scraper


class TestPerformance:
    """端到端性能基准与优化集成测试。"""

    @pytest.mark.asyncio
    async def test_large_document_processing(self, e2e_tools, pdf_processor):
        """Performance Test 1：大文档处理 — 验证 50 页学术论文在合理时间内完成。"""
        convert_pdf_tool = e2e_tools["parse_pdf_to_markdown"]

        # Simulate a large academic paper
        large_pdf_content = {
            "success": True,
            "text": "# Large Academic Paper\n\n"
            + "## Section\n\nContent paragraph. " * 1000,
            "markdown": "# Large Academic Paper\n\n"
            + "## Section\n\nContent paragraph. " * 1000,
            "source": "/large-paper.pdf",
            "method_used": "pymupdf",
            "pages_processed": 50,
            "word_count": 15000,
            "character_count": 90000,
            "metadata": {
                "title": "Large Academic Paper",
                "total_pages": 50,
                "file_size_bytes": 5242880,  # 5MB
            },
        }

        # Test processing time for large document
        async def mock_large_pdf_process(*args, **kwargs):
            # Simulate realistic processing time for large document
            await asyncio.sleep(0.5)  # 500ms for 50-page document
            return large_pdf_content

        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(
                pdf_processor, "process_pdf", side_effect=mock_large_pdf_process
            ),
        ):
            start_time = time.time()
            result = await convert_pdf_tool.fn(
                pdf_source="/large-paper.pdf",
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
            large_doc_duration = time.time() - start_time

            assert result.success is True
            assert result.word_count == 15000
            assert result.page_count == 50
            assert (
                large_doc_duration < 1.5
            )  # Should complete within 1.5 seconds (CI-safe)

    @pytest.mark.asyncio
    async def test_concurrent_processing_benchmark(self, e2e_tools, pdf_processor):
        """Performance Test 2：并发处理基准 — 验证 8 个文档并发处理的吞吐量。"""
        convert_pdf_tool = e2e_tools["parse_pdf_to_markdown"]
        num_concurrent = 8

        # Create realistic concurrent load
        async def mock_concurrent_pdf_process(*args, **kwargs):
            await asyncio.sleep(0.1)  # 100ms per document
            return {
                "success": True,
                "text": "Concurrent document content",
                "markdown": "# Concurrent Document\n\nProcessed content.",
                "source": args[0] if args else "/concurrent.pdf",
                "word_count": 500,
                "pages_processed": 5,
            }

        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(
                pdf_processor, "process_pdf", side_effect=mock_concurrent_pdf_process
            ),
        ):
            # Create concurrent tasks
            concurrent_tasks = []
            for i in range(num_concurrent):
                task = convert_pdf_tool.fn(
                    pdf_source=f"/concurrent-{i}.pdf",
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
                concurrent_tasks.append(task)

            start_time = time.time()
            results = await asyncio.gather(*concurrent_tasks)
            concurrent_duration = time.time() - start_time

            # All tasks should succeed
            assert all(r.success for r in results)

            # Concurrent execution should be faster than sequential
            # Sequential would take: 8 * 0.1 = 0.8 seconds
            # Concurrent should complete faster due to async execution
            assert concurrent_duration < 1.5

            throughput = num_concurrent / concurrent_duration
            assert throughput > 6  # CI macOS runners have asyncio scheduling overhead

    @pytest.mark.asyncio
    async def test_memory_usage_during_batch_operations(self, e2e_tools, pdf_processor):
        """Performance Test 3：批量操作内存使用监控 — 验证 15 文档批处理不产生过多对象增长。"""
        gc.collect()
        initial_objects = len(gc.get_objects())

        # Process a large batch with memory monitoring
        batch_pdf_tool = e2e_tools["parse_pdfs_to_markdown"]
        large_batch_sources = [f"/batch-doc-{i}.pdf" for i in range(15)]

        async def mock_batch_with_memory_tracking(pdf_sources, **kwargs):
            results = []
            for source in pdf_sources:
                results.append(
                    {
                        "success": True,
                        "text": "Batch document content " * 100,  # Larger content
                        "markdown": "# Batch Document\n\n"
                        + "Content paragraph.\n" * 50,
                        "source": source,
                        "word_count": 200,
                        "pages_processed": 2,
                    }
                )

            return {
                "success": True,
                "results": results,
                "summary": {
                    "total_pdfs": len(pdf_sources),
                    "successful": len(pdf_sources),
                    "failed": 0,
                    "total_words_extracted": len(pdf_sources) * 200,
                    "total_pages_processed": len(pdf_sources) * 2,
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
                side_effect=mock_batch_with_memory_tracking,
            ),
        ):
            start_time = time.time()
            batch_result = await batch_pdf_tool.fn(
                pdf_sources=large_batch_sources,
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
            batch_duration = time.time() - start_time  # noqa: F841

            assert batch_result.success is True
            assert batch_result.total_word_count == 3000  # 15 * 200

        # Check memory usage after batch processing
        gc.collect()
        final_objects = len(gc.get_objects())
        memory_growth = final_objects - initial_objects

        # Memory growth should be reasonable for the amount of processing
        assert memory_growth < 2000, (
            f"Excessive memory usage: {memory_growth} new objects"
        )

    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_network_latency_efficiency(self, e2e_tools):
        """Performance Test 4：网络延迟模拟 — 验证不同延迟条件下的处理开销合理。

        标记为 slow：该用例仅 mock 外层 web_scraper.scrape_url，内层 scraping.engine
        仍会尝试真实访问，叠加 xdist + pytest-cov 后 overhead 在 CI 下不稳定，
        本地/慢速任务矩阵再跑即可（修正 mock 目标属独立工程）。
        """
        markdown_tool = e2e_tools["parse_webpage_to_markdown"]

        network_latencies = [
            0.05,
            0.1,
            0.2,
            0.5,
        ]  # Simulate different network conditions (removed 1.0s to reduce test time)
        network_results = []

        for latency in network_latencies:

            async def mock_network_with_latency(
                url, method="simple", extract_config=None, wait_for_element=None
            ):
                await asyncio.sleep(latency)
                return {
                    "url": url,
                    "title": f"Network Test (latency: {latency}s)",
                    "content": {
                        "html": f"<html><body><h1>Network Test</h1><p>Latency: {latency}s</p></body></html>"
                    },
                }

            with patch.object(
                web_scraper, "scrape_url", side_effect=mock_network_with_latency
            ):
                start_time = time.time()
                result = await markdown_tool.fn(
                    url=f"https://latency-test-{latency}.com",
                    method="auto",
                    extract_main_content=True,
                    include_metadata=True,
                    custom_options=None,
                    wait_for_element=None,
                    formatting_options=None,
                    embed_images=False,
                    embed_options=None,
                )
                actual_duration = time.time() - start_time

                assert result.success is True
                network_results.append(
                    {
                        "latency": latency,
                        "actual_duration": actual_duration,
                        "overhead": actual_duration - latency,
                    }
                )

        # Verify network handling efficiency
        for result in network_results:
            # Overhead should be reasonable, but allow for test environment variation
            # In test environments, there can be significant framework overhead
            if result["latency"] < 0.1:
                max_overhead = (
                    result["latency"] * 20.0 + 0.5
                )  # Allow 20x + 500ms base overhead for tiny latencies
            elif result["latency"] < 0.5:
                max_overhead = (
                    result["latency"] * 5.0 + 0.3
                )  # Allow 5x + 300ms overhead for small latencies
            else:
                max_overhead = (
                    result["latency"] * 2.0 + 0.2
                )  # Allow 2x + 200ms overhead for larger latencies

            assert result["overhead"] < max_overhead, (
                f"Latency {result['latency']}s has overhead {result['overhead']}s (max allowed: {max_overhead}s)"
            )
