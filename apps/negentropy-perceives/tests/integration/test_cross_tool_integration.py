"""Cross-tool integration tests for combined functionality scenarios."""

import pytest
import asyncio
from unittest.mock import patch

from negentropy.perceives.tools import web_scraper
from negentropy.perceives.tools._registry import markdown_converter
from tests.integration.tooling import build_pdf_tool_kwargs, select_tools


@pytest.fixture
def all_tools(e2e_tools):
    """兼容旧测试签名，统一复用共享工具映射。"""
    return e2e_tools


@pytest.fixture
def scenario_tools(e2e_tools):
    """提供真实场景测试所需的工具子集。"""
    return select_tools(
        e2e_tools,
        "parse_webpage_to_markdown",
        "parse_pdf_to_markdown",
        "parse_pdfs_to_markdown",
        "discover_links",
        "inspect_page",
    )


class TestCrossToolIntegration:
    """Integration tests for scenarios involving multiple tools working together."""

    @pytest.mark.asyncio
    async def test_webpage_to_pdf_to_markdown_workflow(self, e2e_tools, pdf_processor):
        """Test a complete workflow: extract links from webpage, then process PDFs found."""
        tools = select_tools(e2e_tools, "discover_links", "parse_pdf_to_markdown")
        discover_links_tool = tools["discover_links"]
        convert_pdf_tool = tools["parse_pdf_to_markdown"]

        # Mock link extraction that finds PDF links
        scrape_result = {
            "url": "https://example.com/research-page",
            "content": {
                "links": [
                    {
                        "url": "https://example.com/papers/paper1.pdf",
                        "text": "Machine Learning Basics",
                    },
                    {
                        "url": "https://example.com/papers/paper2.pdf",
                        "text": "Deep Learning Advanced",
                    },
                    {
                        "url": "https://external.com/paper3.pdf",
                        "text": "Neural Networks",
                    },
                ],
            },
        }

        pdf_processing_result = {
            "success": True,
            "text": "# Machine Learning Basics\n\nThis paper covers fundamental concepts...",
            "markdown": "# Machine Learning Basics\n\nThis paper covers fundamental concepts in machine learning.",
            "content": "# Machine Learning Basics\n\nThis paper covers fundamental concepts in machine learning.",
            "source": "https://example.com/papers/paper1.pdf",
            "method_used": "pymupdf",
            "pages_processed": 15,
            "word_count": 5000,
            "metadata": {
                "title": "Machine Learning Basics",
                "author": "Dr. Smith",
                "total_pages": 15,
            },
        }

        with (
            patch.object(web_scraper, "scrape_url") as mock_scrape,
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_pdf,
        ):
            mock_scrape.return_value = scrape_result
            mock_pdf.return_value = pdf_processing_result

            # Step 1: Extract links from the webpage
            links_response = await discover_links_tool.fn(
                url="https://example.com/research-page",
                filter_domains=None,
                exclude_domains=None,
                internal_only=False,
            )

            assert links_response.success is True

            # Extract PDF links from the extracted links
            pdf_links = [
                link.url for link in links_response.links if link.url.endswith(".pdf")
            ]
            assert len(pdf_links) == 3

            # Step 2: Process the first PDF found
            first_pdf_url = pdf_links[0]
            pdf_response = await convert_pdf_tool.fn(
                pdf_source=first_pdf_url,
                **build_pdf_tool_kwargs(method="pymupdf"),
            )

            assert pdf_response.success is True
            assert pdf_response.pdf_source == first_pdf_url
            assert "Machine Learning Basics" in pdf_response.content

            # Verify the workflow executed correctly
            mock_scrape.assert_called_once_with(
                url="https://example.com/research-page",
                method="simple",
            )
            mock_pdf.assert_called_once_with(
                pdf_source=first_pdf_url,
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

    @pytest.mark.asyncio
    async def test_batch_webpage_to_pdf_workflow(self, e2e_tools, pdf_processor):
        """Test batch webpage conversion followed by batch PDF processing."""
        tools = select_tools(
            e2e_tools,
            "parse_webpages_to_markdown",
            "parse_pdfs_to_markdown",
        )
        batch_webpage_tool = tools["parse_webpages_to_markdown"]
        batch_pdf_tool = tools["parse_pdfs_to_markdown"]

        # Mock batch scraping results
        batch_scrape_results = [
            {
                "url": "https://site1.com",
                "title": "Site 1 - PDF Repository",
                "content": {
                    "html": "<html><body><h1>PDF Collection</h1><a href='/doc1.pdf'>Document 1</a></body></html>",
                    "links": [
                        {"url": "https://site1.com/doc1.pdf", "text": "Document 1"}
                    ],
                },
            },
            {
                "url": "https://site2.com",
                "title": "Site 2 - Research Portal",
                "content": {
                    "html": "<html><body><h1>Research</h1><a href='/research.pdf'>Research Paper</a></body></html>",
                    "links": [
                        {
                            "url": "https://site2.com/research.pdf",
                            "text": "Research Paper",
                        }
                    ],
                },
            },
        ]

        batch_pdf_results = {
            "success": True,
            "results": [
                {
                    "success": True,
                    "text": "Document 1 content...",
                    "markdown": "# Document 1\n\nContent of document 1.",
                    "content": "# Document 1\n\nContent of document 1.",
                    "source": "https://site1.com/doc1.pdf",
                    "word_count": 1000,
                },
                {
                    "success": True,
                    "text": "Research paper content...",
                    "markdown": "# Research Paper\n\nContent of research paper.",
                    "content": "# Research Paper\n\nContent of research paper.",
                    "source": "https://site2.com/research.pdf",
                    "word_count": 3000,
                },
            ],
            "summary": {
                "total_pdfs": 2,
                "successful_count": 2,
                "failed": 0,
                "total_word_count": 4000,
            },
        }

        with (
            patch.object(web_scraper, "scrape_multiple_urls") as mock_batch_scrape,
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "batch_process_pdfs") as mock_batch_pdf,
        ):
            mock_batch_scrape.return_value = batch_scrape_results
            mock_batch_pdf.return_value = batch_pdf_results

            # Step 1: Batch convert webpages to markdown
            scrape_urls = ["https://site1.com", "https://site2.com"]
            webpage_response = await batch_webpage_tool.fn(
                urls=scrape_urls,
                method="simple",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                embed_images=False,
                embed_options=None,
            )

            assert webpage_response.success is True
            assert webpage_response.total_urls == 2

            # Step 2: Batch process PDFs discovered from those pages
            pdf_sources = [
                "https://site1.com/doc1.pdf",
                "https://site2.com/research.pdf",
            ]
            pdf_response = await batch_pdf_tool.fn(
                pdf_sources=pdf_sources,
                **build_pdf_tool_kwargs(method="pymupdf"),
            )

            assert pdf_response.success is True
            assert pdf_response.total_pdfs == 2
            assert pdf_response.successful_count == 2
            assert pdf_response.total_word_count == 4000

    @pytest.mark.asyncio
    async def test_error_propagation_across_tools(self, all_tools, pdf_processor):
        """Test how errors propagate when using multiple tools together."""
        discover_links_tool = all_tools["discover_links"]
        pdf_tool = all_tools["parse_pdf_to_markdown"]

        # Mock a failed link extraction (scrape_url raises)
        with patch.object(web_scraper, "scrape_url") as mock_scrape:
            mock_scrape.side_effect = Exception("Network timeout")

            # First tool fails
            links_response = await discover_links_tool.fn(
                url="https://unreachable.com",
                filter_domains=None,
                exclude_domains=None,
                internal_only=False,
            )
            assert links_response.success is False

        # Mock a failed PDF processing
        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_pdf,
        ):
            mock_pdf.return_value = {
                "success": False,
                "error": "PDF parsing failed",
                "source": "/corrupted.pdf",
            }

            # Second tool fails with proper error handling
            pdf_response = await pdf_tool.fn(
                pdf_source="/corrupted.pdf",
                **build_pdf_tool_kwargs(method="pymupdf"),
            )
            assert pdf_response.success is False
            assert "PDF parsing failed" in (
                pdf_response.error
                if isinstance(pdf_response.error, str)
                else str(pdf_response.error)
            )

    @pytest.mark.asyncio
    async def test_resource_cleanup_across_multiple_tools(
        self, all_tools, pdf_processor
    ):
        """Test proper resource cleanup when using multiple tools."""
        import gc

        # Track initial memory state
        gc.collect()
        initial_objects = len(gc.get_objects())

        webpage_tool = all_tools["parse_webpage_to_markdown"]
        pdf_tool = all_tools["parse_pdf_to_markdown"]
        batch_pdf_tool = all_tools["parse_pdfs_to_markdown"]

        # Mock successful operations
        scrape_result = {
            "url": "https://test.com",
            "title": "Test",
            "content": {"html": "<html><body>Content</body></html>"},
        }

        pdf_result = {
            "success": True,
            "text": "Content " * 1000,  # Large content to test memory
            "markdown": "# Document\n\n" + "Paragraph.\n" * 500,
            "content": "# Document\n\n" + "Paragraph.\n" * 500,
            "source": "/test.pdf",
            "word_count": 1000,
        }

        batch_pdf_result = {
            "success": True,
            "results": [pdf_result for _ in range(5)],
            "summary": {"total_pdfs": 5, "successful_count": 5, "failed": 0},
        }

        with (
            patch.object(web_scraper, "scrape_url") as mock_scrape,
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_pdf,
            patch.object(pdf_processor, "batch_process_pdfs") as mock_batch_pdf,
        ):
            mock_scrape.return_value = scrape_result
            mock_pdf.return_value = pdf_result
            mock_batch_pdf.return_value = batch_pdf_result

            # Perform multiple operations with large data
            for i in range(10):
                await webpage_tool.fn(
                    url=f"https://test{i}.com",
                    method="simple",
                    extract_main_content=True,
                    include_metadata=True,
                    custom_options=None,
                    wait_for_element=None,
                    formatting_options=None,
                    embed_images=False,
                    embed_options=None,
                )
                await pdf_tool.fn(
                    pdf_source=f"/test{i}.pdf",
                    **build_pdf_tool_kwargs(method="pymupdf"),
                )

            # Perform batch operation
            await batch_pdf_tool.fn(
                pdf_sources=[f"/batch{i}.pdf" for i in range(5)],
                **build_pdf_tool_kwargs(method="pymupdf"),
            )

        # Force garbage collection and check memory usage
        gc.collect()
        final_objects = len(gc.get_objects())
        object_growth = final_objects - initial_objects

        # Allow reasonable object growth but detect potential leaks
        assert object_growth < 3000, (
            f"Potential memory leak: {object_growth} new objects"
        )

    @pytest.mark.asyncio
    async def test_concurrent_multi_tool_operations(self, all_tools, pdf_processor):
        """Test concurrent execution of different tools."""
        pdf_tool = all_tools["parse_pdf_to_markdown"]
        markdown_tool = all_tools["parse_webpage_to_markdown"]

        # Mock results for concurrent operations
        scrape_result = {
            "url": "https://concurrent-test.com",
            "title": "Concurrent Test",
            "content": {"html": "<html><body><h1>Test</h1></body></html>"},
        }

        pdf_result = {
            "success": True,
            "text": "Concurrent PDF content",
            "markdown": "# Concurrent PDF\n\nContent",
            "content": "# Concurrent PDF\n\nContent",
            "source": "/concurrent.pdf",
        }

        with (
            patch.object(web_scraper, "scrape_url") as mock_scrape,
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_pdf,
        ):
            mock_scrape.return_value = scrape_result
            mock_pdf.return_value = pdf_result

            # Create concurrent tasks using different tools
            tasks = [
                pdf_tool.fn(
                    pdf_source=f"/test{i}.pdf",
                    **build_pdf_tool_kwargs(method="pymupdf"),
                )
                for i in range(3)
            ] + [
                markdown_tool.fn(
                    url=f"https://markdown{i}.com",
                    method="simple",
                    extract_main_content=True,
                    include_metadata=True,
                    custom_options=None,
                    wait_for_element=None,
                    formatting_options=None,
                    embed_images=False,
                    embed_options=None,
                )
                for i in range(3)
            ]

            # Execute all concurrently
            results = await asyncio.gather(*tasks)

            # Verify all operations succeeded
            for result in results:
                assert result.success is True

            # Verify appropriate number of calls to each mock
            assert mock_scrape.call_count == 3  # 3 markdown conversions
            assert mock_pdf.call_count == 3  # 3 PDF operations


class TestRealWorldIntegrationScenarios:
    """Integration tests simulating real-world usage scenarios."""

    @pytest.mark.asyncio
    async def test_research_paper_collection_scenario(
        self, scenario_tools, pdf_processor
    ):
        """Test a complete research paper collection workflow."""
        # Scenario: User wants to collect and convert all research papers from an academic site

        # Step 1: Extract all links from the main page
        discover_links_tool = scenario_tools["discover_links"]

        links_result = {
            "url": "https://academic-site.com/papers",
            "links": [
                {
                    "url": "https://academic-site.com/paper1.pdf",
                    "text": "Machine Learning",
                },
                {
                    "url": "https://academic-site.com/paper2.pdf",
                    "text": "Deep Learning",
                },
                {
                    "url": "https://academic-site.com/paper3.html",
                    "text": "Overview Page",
                },
                {
                    "url": "https://academic-site.com/paper4.pdf",
                    "text": "Neural Networks",
                },
            ],
        }

        with patch.object(web_scraper, "scrape_url") as mock_scrape:
            mock_scrape.return_value = {
                "url": "https://academic-site.com/papers",
                "content": {"links": links_result["links"]},
            }

            # Extract all links
            links_response = await discover_links_tool.fn(
                url="https://academic-site.com/papers",
                filter_domains=None,
                exclude_domains=None,
                internal_only=False,
            )

            assert links_response.success is True

        # Step 2: Filter PDF links and batch process them
        pdf_links = [
            "https://academic-site.com/paper1.pdf",
            "https://academic-site.com/paper2.pdf",
            "https://academic-site.com/paper4.pdf",
        ]

        batch_pdf_tool = scenario_tools["parse_pdfs_to_markdown"]

        batch_result = {
            "success": True,
            "results": [
                {
                    "success": True,
                    "markdown": f"# Paper {i}\n\nResearch content {i}.",
                    "content": f"# Paper {i}\n\nResearch content {i}.",
                    "source": pdf_links[i - 1],
                    "word_count": 1000 * i,
                    "metadata": {"title": f"Research Paper {i}"},
                }
                for i in range(1, 4)
            ],
            "summary": {
                "total_pdfs": 3,
                "successful_count": 3,
                "failed": 0,
                "total_word_count": 6000,
            },
        }

        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "batch_process_pdfs") as mock_batch_pdf,
        ):
            mock_batch_pdf.return_value = batch_result

            batch_response = await batch_pdf_tool.fn(
                pdf_sources=pdf_links,
                **build_pdf_tool_kwargs(method="pymupdf"),
            )

            assert batch_response.success is True
            assert batch_response.successful_count == 3
            assert batch_response.total_word_count == 6000

        # Step 3: Also convert the overview HTML page to markdown
        markdown_tool = scenario_tools["parse_webpage_to_markdown"]

        with (
            patch.object(web_scraper, "scrape_url") as mock_scrape,
            patch.object(
                markdown_converter, "convert_webpage_to_markdown"
            ) as mock_convert,
        ):
            mock_scrape.return_value = {
                "url": "https://academic-site.com/paper3.html",
                "title": "Research Overview",
                "content": {
                    "html": "<html><body><h1>Research Overview</h1><p>Summary of all papers.</p></body></html>"
                },
            }
            mock_convert.return_value = {
                "success": True,
                "markdown_content": "# Research Overview\n\nSummary of all papers.",
                "metadata": {"title": "Research Overview"},
                "word_count": 6,
            }

            markdown_response = await markdown_tool.fn(
                url="https://academic-site.com/paper3.html",
                method="simple",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                wait_for_element=None,
                formatting_options=None,
                embed_images=False,
                embed_options=None,
            )

            assert markdown_response.success is True
            assert "Research Overview" in markdown_response.markdown_content

    @pytest.mark.asyncio
    async def test_website_documentation_backup_scenario(
        self, scenario_tools, pdf_processor
    ):
        """Test creating a complete backup of website documentation."""
        # Scenario: User wants to backup all documentation pages as markdown

        # Step 1: Extract links from the main documentation index
        discover_links_tool = scenario_tools["discover_links"]

        index_links = [
            {
                "url": "https://docs.example.com/getting-started",
                "text": "Getting Started",
            },
            {
                "url": "https://docs.example.com/api-reference",
                "text": "API Reference",
            },
            {
                "url": "https://docs.example.com/tutorials",
                "text": "Tutorials",
            },
            {
                "url": "https://docs.example.com/faq.pdf",
                "text": "FAQ (PDF)",
            },
        ]

        with patch.object(web_scraper, "scrape_url") as mock_scrape:
            mock_scrape.return_value = {
                "url": "https://docs.example.com",
                "content": {"links": index_links},
            }

            index_response = await discover_links_tool.fn(
                url="https://docs.example.com",
                filter_domains=None,
                exclude_domains=None,
                internal_only=False,
            )
            assert index_response.success is True

        # Step 2: Convert all HTML pages to markdown
        html_pages = [
            "https://docs.example.com/getting-started",
            "https://docs.example.com/api-reference",
            "https://docs.example.com/tutorials",
        ]

        markdown_tool = scenario_tools["parse_webpage_to_markdown"]

        # Process each HTML page individually
        html_results = []
        for i, url in enumerate(html_pages):
            with (
                patch.object(web_scraper, "scrape_url") as mock_scrape,
                patch.object(
                    markdown_converter, "convert_webpage_to_markdown"
                ) as mock_convert,
            ):
                mock_scrape.return_value = {
                    "url": url,
                    "title": f"Documentation Page {i + 1}",
                    "content": {
                        "html": f"<html><body><h1>Page {i + 1}</h1><p>Content for page {i + 1}</p></body></html>"
                    },
                }
                mock_convert.return_value = {
                    "success": True,
                    "markdown_content": f"# Page {i + 1}\\n\nContent for page {i + 1}.",
                    "metadata": {"title": f"Documentation Page {i + 1}"},
                    "word_count": 5,
                }

                result = await markdown_tool.fn(
                    url=url,
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
                html_results.append(result)

        # Step 3: Convert the PDF to markdown
        pdf_tool = scenario_tools["parse_pdf_to_markdown"]

        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "process_pdf") as mock_pdf,
        ):
            mock_pdf.return_value = {
                "success": True,
                "markdown": "# FAQ\n\n## Q: How to get started?\nA: Follow the getting started guide.",
                "content": "# FAQ\n\n## Q: How to get started?\nA: Follow the getting started guide.",
                "source": "https://docs.example.com/faq.pdf",
                "word_count": 50,
            }

            pdf_result = await pdf_tool.fn(
                pdf_source="https://docs.example.com/faq.pdf",
                **build_pdf_tool_kwargs(method="pymupdf"),
            )
            assert pdf_result.success is True

        # Verify complete documentation backup
        assert len(html_results) == 3
        for result in html_results:
            assert "Page" in result.markdown_content
        assert "FAQ" in pdf_result.content
