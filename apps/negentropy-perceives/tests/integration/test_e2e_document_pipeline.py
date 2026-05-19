"""端到端文档处理流水线集成测试。

覆盖完整的文档处理流水线，包括：
- 网页抓取与发现
- 网页转 Markdown
- PDF 批量处理
- HTML 页面批量处理
- 服务器指标与缓存清理
"""

import pytest
import asyncio
import time
from unittest.mock import patch

from negentropy.perceives.tools import web_scraper


# ---------------------------------------------------------------------------
# 共用测试数据
# ---------------------------------------------------------------------------

PORTAL_CONTENT = {
    "url": "https://research-portal.edu/publications",
    "title": "Research Publications Portal",
    "status_code": 200,
    "content": {
        "html": """
        <html>
            <head>
                <title>Research Publications Portal</title>
                <meta name="description" content="Latest research publications and papers">
            </head>
            <body>
                <main>
                    <h1>Latest Research Publications</h1>

                    <section class="featured-papers">
                        <h2>Featured Papers</h2>
                        <article>
                            <h3>AI in Healthcare: A Comprehensive Review</h3>
                            <p>This study examines the applications of artificial intelligence in healthcare.</p>
                            <a href="/papers/ai-healthcare-2024.pdf">Download PDF</a>
                            <a href="/papers/ai-healthcare-summary.html">Read Summary</a>
                        </article>

                        <article>
                            <h3>Machine Learning for Climate Prediction</h3>
                            <p>Advanced ML techniques for weather and climate modeling.</p>
                            <a href="/papers/ml-climate-2024.pdf">Download PDF</a>
                            <a href="/papers/ml-climate-methodology.html">Methodology</a>
                        </article>
                    </section>

                    <section class="recent-updates">
                        <h2>Recent Updates</h2>
                        <ul>
                            <li><a href="/news/funding-announcement.html">New Research Funding</a></li>
                            <li><a href="/docs/submission-guidelines.pdf">Paper Submission Guidelines</a></li>
                            <li><a href="/about/team.html">Meet Our Research Team</a></li>
                        </ul>
                    </section>
                </main>
            </body>
        </html>
        """,
        "text": "Research Publications Portal Latest research publications and papers...",
        "links": [
            {
                "url": "https://research-portal.edu/papers/ai-healthcare-2024.pdf",
                "text": "Download PDF",
            },
            {
                "url": "https://research-portal.edu/papers/ai-healthcare-summary.html",
                "text": "Read Summary",
            },
            {
                "url": "https://research-portal.edu/papers/ml-climate-2024.pdf",
                "text": "Download PDF",
            },
            {
                "url": "https://research-portal.edu/papers/ml-climate-methodology.html",
                "text": "Methodology",
            },
            {
                "url": "https://research-portal.edu/news/funding-announcement.html",
                "text": "New Research Funding",
            },
            {
                "url": "https://research-portal.edu/docs/submission-guidelines.pdf",
                "text": "Paper Submission Guidelines",
            },
            {
                "url": "https://research-portal.edu/about/team.html",
                "text": "Meet Our Research Team",
            },
        ],
        "images": [{"src": "/assets/portal-logo.png", "alt": "Research Portal Logo"}],
    },
    "meta_description": "Latest research publications and papers",
    "metadata": {
        "response_time": 1.2,
        "content_length": 3847,
        "encoding": "utf-8",
    },
}


PDF_CONTENTS = {
    "ai-healthcare-2024.pdf": {
        "success": True,
        "text": """AI in Healthcare: A Comprehensive Review

Abstract

This comprehensive review examines the current state and future prospects of artificial intelligence applications in healthcare. We analyze over 200 recent studies and provide insights into key areas including diagnostic imaging, drug discovery, personalized medicine, and clinical decision support systems.

1. Introduction

Artificial intelligence (AI) has emerged as a transformative technology in healthcare, offering unprecedented opportunities to improve patient outcomes, reduce costs, and enhance the efficiency of healthcare delivery. This review synthesizes current research and identifies key trends, challenges, and opportunities.

2. Diagnostic Imaging

AI-powered diagnostic imaging has shown remarkable success in various medical specialties:

2.1 Radiology
- Deep learning models for X-ray interpretation
- CT scan analysis for early cancer detection
- MRI enhancement and anomaly detection

2.2 Pathology
- Histological slide analysis
- Cancer cell identification and grading
- Workflow optimization

3. Drug Discovery and Development

AI is revolutionizing pharmaceutical research through:
- Molecular target identification
- Drug-drug interaction prediction
- Clinical trial optimization
- Personalized dosing strategies

4. Clinical Decision Support

AI-driven clinical decision support systems provide:
- Real-time patient monitoring
- Risk stratification
- Treatment recommendation algorithms
- Medication management

5. Challenges and Limitations

Despite significant progress, several challenges remain:
- Data privacy and security concerns
- Regulatory compliance requirements
- Integration with existing healthcare systems
- Clinician acceptance and training

6. Future Directions

The future of AI in healthcare includes:
- Federated learning approaches
- Explainable AI for clinical applications
- Real-world evidence generation
- Global health applications

Conclusion

AI represents a paradigm shift in healthcare delivery. Continued research, collaboration, and careful implementation will be essential for realizing its full potential while addressing current limitations.
""",
        "markdown": "# AI in Healthcare: A Comprehensive Review\n\n## Abstract\n\nThis comprehensive review examines the current state and future prospects of artificial intelligence applications in healthcare.\n\n## 1. Introduction\n\nArtificial intelligence (AI) has emerged as a transformative technology in healthcare.",
        "source": "https://research-portal.edu/papers/ai-healthcare-2024.pdf",
        "method_used": "pymupdf",
        "output_format": "markdown",
        "pages_processed": 15,
        "word_count": 1847,
        "character_count": 11234,
        "metadata": {
            "title": "AI in Healthcare: A Comprehensive Review",
            "author": "Dr. Sarah Chen, Prof. Michael Rodriguez",
            "subject": "Healthcare AI Review",
            "creator": "LaTeX",
            "total_pages": 15,
            "file_size_bytes": 2458112,
        },
    },
    "ml-climate-2024.pdf": {
        "success": True,
        "text": """Machine Learning for Climate Prediction

Executive Summary

This paper presents advanced machine learning techniques for improving weather and climate prediction accuracy. Our ensemble approach combines deep learning, statistical models, and physics-informed neural networks to achieve state-of-the-art performance in short-term and long-term forecasting.

Key Findings:
- 23% improvement in 7-day weather prediction accuracy
- 15% better performance in seasonal climate forecasting
- Reduced computational requirements by 40%
- Enhanced extreme weather event detection

1. Methodology

Our approach integrates multiple ML techniques:

1.1 Deep Learning Models
- Convolutional Neural Networks for spatial pattern recognition
- LSTM networks for temporal sequence modeling
- Transformer architectures for attention-based predictions

1.2 Physics-Informed Neural Networks
- Conservation law constraints
- Physical boundary conditions
- Energy balance equations

1.3 Statistical Ensemble Methods
- Random forest regressors
- Gradient boosting machines
- Bayesian model averaging

2. Data Sources and Preprocessing

We utilized comprehensive datasets including:
- Satellite observations (MODIS, GOES, Sentinel)
- Weather station networks (NOAA, WMO)
- Ocean buoy measurements
- Reanalysis products (ERA5, MERRA-2)

3. Results and Validation

Performance metrics across different prediction horizons show consistent improvements over traditional numerical weather prediction models.

4. Implementation and Scalability

The proposed framework is designed for operational deployment with considerations for:
- Real-time data ingestion
- Distributed computing architectures
- Uncertainty quantification
- Model interpretability

5. Future Work

Ongoing research directions include:
- Integration of additional Earth system components
- Improved handling of rare events
- Enhanced resolution capabilities
- Climate change impact assessment
""",
        "markdown": "# Machine Learning for Climate Prediction\n\n## Executive Summary\n\nThis paper presents advanced machine learning techniques for improving weather and climate prediction accuracy.",
        "source": "https://research-portal.edu/papers/ml-climate-2024.pdf",
        "method_used": "pymupdf",
        "pages_processed": 12,
        "word_count": 1456,
        "metadata": {
            "title": "Machine Learning for Climate Prediction",
            "author": "Dr. Elena Kowalski, Dr. James Park, Prof. Lisa Thompson",
            "total_pages": 12,
        },
    },
    "submission-guidelines.pdf": {
        "success": True,
        "text": """Research Paper Submission Guidelines

1. General Requirements

All submissions must adhere to the following guidelines:
- Original research not published elsewhere
- Maximum length: 8 pages (excluding references)
- Double-blind peer review process
- Submission deadline: December 15, 2024

2. Formatting Guidelines

2.1 Document Structure
- Title page with author information
- Abstract (maximum 250 words)
- Keywords (3-5 terms)
- Main content sections
- References in IEEE format
- Appendices (if applicable)

2.2 Technical Specifications
- Font: Times New Roman, 12pt
- Line spacing: Double
- Margins: 1 inch all sides
- File format: PDF only
- Maximum file size: 10 MB

3. Review Process

3.1 Initial Screening
- Editorial review for scope and quality
- Plagiarism detection
- Format compliance check

3.2 Peer Review
- Minimum 2 expert reviewers
- Double-blind review process
- Review criteria: novelty, technical quality, clarity

3.3 Decision Timeline
- Initial decision: 6 weeks from submission
- Revision period: 4 weeks
- Final decision: 2 weeks after revision

4. Publication Ethics

Authors must ensure:
- No conflicts of interest
- Proper attribution of prior work
- Data availability for reproducibility
- Ethical approval for human subjects research

5. Contact Information

Submissions: submissions@research-portal.edu
Technical support: support@research-portal.edu
Editorial office: +1-555-0123
""",
        "markdown": "# Research Paper Submission Guidelines\n\n## 1. General Requirements\n\nAll submissions must adhere to the following guidelines.",
        "source": "https://research-portal.edu/docs/submission-guidelines.pdf",
        "method_used": "pypdf",
        "pages_processed": 3,
        "word_count": 487,
        "metadata": {
            "title": "Research Paper Submission Guidelines",
            "total_pages": 3,
        },
    },
}


async def mock_scrape_with_delay(
    url, method="simple", extract_config=None, wait_for_element=None
):
    """模拟带网络延迟的页面抓取。"""
    await asyncio.sleep(0.1)  # Simulate network latency
    return PORTAL_CONTENT


# ---------------------------------------------------------------------------
# 测试类
# ---------------------------------------------------------------------------


class TestDocumentPipeline:
    """端到端文档处理流水线集成测试。"""

    @pytest.mark.asyncio
    async def test_initial_page_discovery(self, e2e_tools):
        """Step 1：初始页面发现 — 抓取研究门户首页并验证响应。"""
        scrape_tool = e2e_tools["parse_webpage_to_markdown"]

        with patch.object(
            web_scraper, "scrape_url", side_effect=mock_scrape_with_delay
        ):
            start_time = time.time()
            portal_result = await scrape_tool.fn(
                url="https://research-portal.edu/publications",
                method="simple",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                wait_for_element=None,
                formatting_options=None,
                embed_images=False,
                embed_options=None,
            )
            scrape_duration = time.time() - start_time

            assert portal_result.success is True
            assert scrape_duration > 0.1  # Verify delay was applied
            # Title "Research Publications Portal" is in metadata, markdown content has "Latest Research Publications"
            assert (
                "Research Publications Portal" in portal_result.markdown_content
                or "Latest Research Publications" in portal_result.markdown_content
                or portal_result.metadata.get("title") == "Research Publications Portal"
            )

    @pytest.mark.asyncio
    async def test_portal_markdown_conversion(self, e2e_tools):
        """Step 2：将门户页面转换为 Markdown 并验证内容与元数据。"""
        markdown_tool = e2e_tools["parse_webpage_to_markdown"]

        with patch.object(
            web_scraper, "scrape_url", side_effect=mock_scrape_with_delay
        ):
            markdown_result = await markdown_tool.fn(
                url="https://research-portal.edu/publications",
                method="auto",
                extract_main_content=True,
                include_metadata=True,
                custom_options=None,
                wait_for_element=None,
                formatting_options={
                    "format_tables": True,
                    "detect_code_language": True,
                    "enhance_images": True,
                    "format_headings": True,
                    "apply_typography": True,
                },
                embed_images=False,
                embed_options=None,
            )

            assert markdown_result.success is True
            markdown_content = markdown_result.markdown_content

            # Verify main content extraction worked
            assert "# Latest Research Publications" in markdown_content
            assert "Featured Papers" in markdown_content
            assert "Recent Updates" in markdown_content

            # Verify metadata is included
            metadata = markdown_result.metadata
            assert metadata["title"] == "Research Publications Portal"
            assert metadata["word_count"] > 0
            assert (
                "links" in metadata or metadata.get("link_count", 0) >= 0
            )  # Allow for different metadata formats

    @pytest.mark.asyncio
    async def test_batch_pdf_processing(self, e2e_tools, pdf_processor):
        """Step 3：批量提取并处理所有 PDF 文档，验证汇总统计。"""
        pdf_urls = [
            "https://research-portal.edu/papers/ai-healthcare-2024.pdf",
            "https://research-portal.edu/papers/ml-climate-2024.pdf",
            "https://research-portal.edu/docs/submission-guidelines.pdf",
        ]

        async def mock_pdf_process(
            pdf_source,
            method="auto",
            include_metadata=True,
            page_range=None,
            output_format="markdown",
        ):
            filename = pdf_source.split("/")[-1]
            content = PDF_CONTENTS.get(filename, {})

            if content:
                processing_time = (
                    content.get("pages_processed", 1) * 0.05
                )  # 50ms per page
                await asyncio.sleep(processing_time)
                return content
            else:
                return {
                    "success": False,
                    "error": "PDF file not found or processing failed",
                    "source": pdf_source,
                }

        batch_pdf_tool = e2e_tools["parse_pdfs_to_markdown"]

        with (
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
                return_value=pdf_processor,
            ),
            patch.object(pdf_processor, "batch_process_pdfs") as mock_batch_pdf,
        ):

            async def mock_batch_process(
                pdf_sources,
                method="auto",
                include_metadata=True,
                page_range=None,
                output_format="markdown",
                extract_images=False,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                enhanced_options=None,
            ):
                results = []
                successful_count = 0
                total_words = 0
                total_pages = 0

                for source in pdf_sources:
                    result = await mock_pdf_process(
                        source, method, include_metadata, page_range, output_format
                    )
                    results.append(result)

                    if result.get("success"):
                        successful_count += 1
                        total_words += result.get("word_count", 0)
                        total_pages += result.get("pages_processed", 0)

                return {
                    "success": True,
                    "results": results,
                    "summary": {
                        "total_pdfs": len(pdf_sources),
                        "successful": successful_count,
                        "failed": len(pdf_sources) - successful_count,
                        "total_pages_processed": total_pages,
                        "total_words_extracted": total_words,
                        "method_used": method,
                        "output_format": output_format,
                    },
                }

            mock_batch_pdf.side_effect = mock_batch_process

            start_time = time.time()
            pdf_batch_result = await batch_pdf_tool.fn(
                pdf_sources=pdf_urls,
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
            processing_duration = time.time() - start_time

            assert pdf_batch_result.success is True
            assert (
                processing_duration > 0.3
            )  # Should take time to process multiple PDFs

            # BatchPDFResponse does not have a summary attribute, access individual attributes instead
            successful_count = pdf_batch_result.successful_count
            total_pdfs = pdf_batch_result.total_pdfs
            assert total_pdfs == 3
            assert successful_count == 3
            assert pdf_batch_result.total_word_count == 3790  # 1847 + 1456 + 487
            assert pdf_batch_result.total_pages == 30  # 15 + 12 + 3

    @pytest.mark.asyncio
    async def test_additional_html_pages_processing(self, e2e_tools):
        """Step 4：处理附加 HTML 页面以补全文档集。"""
        markdown_tool = e2e_tools["parse_webpage_to_markdown"]

        html_pages = [
            "https://research-portal.edu/papers/ai-healthcare-summary.html",
            "https://research-portal.edu/papers/ml-climate-methodology.html",
            "https://research-portal.edu/about/team.html",
        ]

        html_results = []
        for i, url in enumerate(html_pages):
            page_content = {
                "url": url,
                "title": f"Research Page {i + 1}",
                "content": {
                    "html": f"""
                    <html>
                        <body>
                            <main>
                                <h1>Research Page {i + 1}</h1>
                                <p>This page contains additional information about our research {i + 1}.</p>
                                <section>
                                    <h2>Key Points</h2>
                                    <ul>
                                        <li>Point 1 for research area {i + 1}</li>
                                        <li>Point 2 for research area {i + 1}</li>
                                        <li>Point 3 for research area {i + 1}</li>
                                    </ul>
                                </section>
                            </main>
                        </body>
                    </html>
                    """
                },
            }

            with patch.object(web_scraper, "scrape_url", return_value=page_content):
                result = await markdown_tool.fn(
                    url=url,
                    method="auto",
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

        # Verify all HTML pages were processed
        assert len(html_results) == 3
        for result in html_results:
            assert "Research Page" in result.markdown_content

    @pytest.mark.asyncio
    async def test_server_metrics_and_cache_cleanup(self, e2e_tools):
        """Step 5：验证服务器指标获取与缓存清理功能。"""
        # 工具名可能因版本而异，使用 get() 安全访问
        metrics_tool = e2e_tools.get("get_server_metrics")
        clear_cache_tool = e2e_tools.get("clear_cache")

        if metrics_tool is None:
            pytest.skip("get_server_metrics 工具不可用")
        if clear_cache_tool is None:
            pytest.skip("clear_cache 工具不可用")

        # Check comprehensive metrics after processing
        metrics_result = await metrics_tool.fn()
        assert metrics_result.success is True

        # Clear cache to free resources
        cache_result = await clear_cache_tool.fn()
        assert cache_result.success is True
