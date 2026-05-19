"""Markdown conversion utilities for various content types using MarkItDown."""

import logging
import os
import tempfile
from typing import Dict, Any, List, Optional, Union
from urllib.parse import urlparse
from pathlib import Path

try:
    from markitdown import MarkItDown
except ImportError:
    # Fallback for testing or if markitdown is not available
    MarkItDown = None  # type: ignore[misc, assignment]

import requests

from .formatter import MarkdownFormatter, markdown_to_text
from .html_preprocessor import (
    ImgDimensionRegistry,
    preprocess_html,
    extract_content_area,
    fallback_html_conversion,
    build_html_from_text,
)
from .image_embedder import embed_images_in_markdown

logger = logging.getLogger(__name__)


class MarkdownConverter:
    """Convert various content types to Markdown format using Microsoft's MarkItDown."""

    def __init__(
        self,
        enable_plugins: bool = False,
        llm_client=None,
        llm_model: Optional[str] = None,
    ):
        """
        Initialize the Markdown converter.

        Args:
            enable_plugins: Whether to enable MarkItDown plugins
            llm_client: Optional LLM client for enhanced image descriptions
            llm_model: LLM model to use (e.g., "gpt-4o")
        """
        if MarkItDown is None:
            raise ImportError(
                "MarkItDown is not available. Please install it with: pip install 'markitdown[all]'"
            )

        self.markitdown = MarkItDown(
            enable_plugins=enable_plugins, llm_client=llm_client, llm_model=llm_model
        )

        # Configuration options for different conversion scenarios
        self.default_options = {
            "extract_main_content": True,
            "preserve_structure": True,
            "clean_output": True,
            "include_links": True,
            "include_images": True,
        }

        # Advanced formatting options
        self.formatting_options = {
            "format_tables": True,
            "enhance_images": True,
            "optimize_links": True,
            "format_lists": True,
            "format_headings": True,
            "apply_typography": True,
            "smart_quotes": True,
            "em_dashes": True,
            "fix_spacing": True,
        }

        self._formatter = MarkdownFormatter(self.formatting_options)

    def _build_html_input(
        self, scrape_result: Dict[str, Any], extract_main_content: bool
    ) -> tuple[str, str, str, Dict[str, Any]]:
        """从抓取结果中构建 HTML 输入。"""
        url = scrape_result.get("url", "")
        title = scrape_result.get("title", "")
        page_content = scrape_result.get("content", {})

        html_content = page_content.get("html")
        if not html_content and page_content.get("text"):
            html_content = build_html_from_text(
                page_content["text"], title, page_content
            )
        if not html_content:
            raise ValueError("No content found in scrape result")
        if extract_main_content:
            html_content = extract_content_area(html_content)

        return url, title, html_content, page_content

    def _convert_html_with_formatting(
        self,
        html_content: str,
        url: str,
        custom_options: Optional[Dict[str, Any]],
        formatting_options: Optional[Dict[str, bool]],
    ) -> str:
        """在可选格式化配置下执行 HTML 转 Markdown。"""
        original_formatter = None
        if formatting_options:
            original_formatter = self._formatter
            merged = dict(self.formatting_options)
            merged.update(formatting_options)
            self._formatter = MarkdownFormatter(merged)

        try:
            return self.html_to_markdown(html_content, url, custom_options)
        finally:
            if original_formatter:
                self._formatter = original_formatter

    def _embed_images_if_needed(
        self,
        markdown_content: str,
        embed_images: bool,
        embed_options: Optional[Dict[str, Any]],
    ) -> tuple[str, Optional[Dict[str, Any]]]:
        """按需嵌入图片，返回 markdown 与统计信息。"""
        if not embed_images:
            return markdown_content, None

        opts = embed_options or {}
        embed_result = embed_images_in_markdown(
            markdown_content,
            max_images=int(opts.get("max_images", 50)),
            max_bytes_per_image=int(opts.get("max_bytes_per_image", 2_000_000)),
            timeout_seconds=int(opts.get("timeout_seconds", 10)),
        )
        return (
            embed_result.get("markdown", markdown_content),
            embed_result.get("stats"),
        )

    def _build_webpage_metadata(
        self,
        *,
        url: str,
        title: str,
        markdown_content: str,
        scrape_result: Dict[str, Any],
        page_content: Dict[str, Any],
        embed_stats: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """构建网页 Markdown 转换元数据。"""
        metadata = {
            "title": title,
            "meta_description": scrape_result.get("meta_description"),
            "word_count": len(markdown_content.split()),
            "character_count": len(markdown_content),
            "domain": urlparse(url).netloc if url else None,
        }
        if "links" in page_content:
            metadata["links_count"] = len(page_content["links"])
        if "images" in page_content:
            metadata["images_count"] = len(page_content["images"])
        if embed_stats is not None:
            metadata["image_embedding"] = embed_stats
        return metadata

    def html_to_markdown(
        self,
        html_content: str,
        base_url: Optional[str] = None,
        custom_options: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Convert HTML content to Markdown using MarkItDown.

        Args:
            html_content: HTML content to convert
            base_url: Base URL for resolving relative URLs
            custom_options: Custom options (maintained for compatibility)

        Returns:
            Markdown formatted content
        """
        try:
            # 图片尺寸登记簿：在 preprocess 阶段为带 width/height 的 <img>
            # 注入 sentinel 占位符，在 postprocess 阶段还原为内嵌 HTML <img>。
            # 仅当 formatter 的 preserve_image_dimensions 开关开启时生效。
            preserve_dims = self._formatter.options.get(
                "preserve_image_dimensions", True
            )
            img_registry = ImgDimensionRegistry() if preserve_dims else None

            # Preprocess HTML if needed
            processed_html = preprocess_html(
                html_content, base_url, img_registry=img_registry
            )

            # Create a temporary HTML file for MarkItDown to process
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".html", delete=False, encoding="utf-8"
            ) as temp_file:
                temp_file.write(processed_html)
                temp_file_path = temp_file.name

            try:
                # Convert using MarkItDown
                result = self.markitdown.convert(temp_file_path)
                markdown_content = result.text_content

                # Post-process the markdown for better formatting
                markdown_content = self.postprocess_markdown(
                    markdown_content, img_registry=img_registry
                )

                return markdown_content

            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_file_path)
                except OSError:
                    pass

        except Exception as e:
            logger.error(f"Error converting HTML to Markdown with MarkItDown: {str(e)}")
            # Fallback to basic conversion if MarkItDown fails
            return fallback_html_conversion(html_content)

    def postprocess_markdown(
        self,
        markdown_content: str,
        *,
        img_registry: Optional[ImgDimensionRegistry] = None,
    ) -> str:
        """
        Post-process Markdown content with advanced formatting features.

        Args:
            markdown_content: Raw Markdown content
            img_registry: 可选的图片尺寸登记簿（由 html_to_markdown 注入），
                PDF/纯文本等非 HTML 路径无需传递。

        Returns:
            Enhanced and cleaned up Markdown content
        """
        return self._formatter.format(markdown_content, img_registry=img_registry)

    # Delegate sub-module functions as methods for backward compatibility
    def preprocess_html(self, html_content: str, base_url: Optional[str] = None) -> str:
        """Preprocess HTML content before MarkItDown conversion."""
        return preprocess_html(html_content, base_url)

    def extract_content_area(self, html_content: str) -> str:
        """Extract the main content area from HTML."""
        return extract_content_area(html_content)

    # Delegate formatter methods for backward compatibility
    def _format_tables(self, md: str) -> str:
        return self._formatter._format_tables(md)

    def _format_images(self, md: str) -> str:
        return self._formatter._format_images(md)

    def _format_links(self, md: str) -> str:
        return self._formatter._format_links(md)

    def _format_code_blocks(self, md: str) -> str:
        return self._formatter._format_code_blocks(md)

    def _format_quotes(self, md: str) -> str:
        return self._formatter._format_quotes(md)

    def _format_lists(self, md: str) -> str:
        return self._formatter._format_lists(md)

    def _format_headings(self, md: str) -> str:
        return self._formatter._format_headings(md)

    def _apply_typography_fixes(self, md: str) -> str:
        return self._formatter._apply_typography_fixes(md)

    @staticmethod
    def _embed_images_in_markdown(markdown_content: str, **kwargs) -> dict:
        return embed_images_in_markdown(markdown_content, **kwargs)

    def convert_pdf_to_markdown(
        self,
        pdf_source: Union[str, Path],
        page_range: Optional[List[int]] = None,
        output_format: str = "markdown",
        include_metadata: bool = True,
    ) -> Dict[str, Any]:
        """
        Convert PDF to Markdown using MarkItDown.

        Args:
            pdf_source: Path to PDF file or URL
            page_range: Optional page range [start, end]
            output_format: Output format ("markdown" or "text")
            include_metadata: Whether to include metadata

        Returns:
            Dictionary with conversion results
        """
        try:
            # Handle URL downloads
            temp_file_path = None
            if isinstance(pdf_source, str) and pdf_source.startswith(
                ("http://", "https://")
            ):
                response = requests.get(pdf_source, timeout=30)
                response.raise_for_status()

                with tempfile.NamedTemporaryFile(
                    suffix=".pdf", delete=False
                ) as temp_file:
                    temp_file.write(response.content)
                    temp_file_path = temp_file.name
                    source_path = temp_file_path
            else:
                source_path = str(pdf_source)

            try:
                # Convert using MarkItDown
                result = self.markitdown.convert(source_path)
                content = result.text_content

                # Apply output format preference
                if output_format == "text":
                    content = markdown_to_text(content)

                return {
                    "success": True,
                    "content": content,
                    "source": str(pdf_source),
                    "method": "markitdown",
                    "output_format": output_format,
                    "metadata": {
                        "word_count": len(content.split()),
                        "character_count": len(content),
                    }
                    if include_metadata
                    else None,
                }

            finally:
                if temp_file_path and os.path.exists(temp_file_path):
                    try:
                        os.unlink(temp_file_path)
                    except OSError:
                        pass

        except Exception as e:
            logger.error(f"Error converting PDF to Markdown: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "source": str(pdf_source),
            }

    def convert_webpage_to_markdown(
        self,
        scrape_result: Dict[str, Any],
        extract_main_content: bool = True,
        include_metadata: bool = True,
        custom_options: Optional[Dict[str, Any]] = None,
        formatting_options: Optional[Dict[str, bool]] = None,
        *,
        embed_images: bool = False,
        embed_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Convert a scraped webpage result to Markdown format.

        Args:
            scrape_result: Result from web scraping
            extract_main_content: Whether to extract main content area
            include_metadata: Whether to include page metadata
            custom_options: Custom options (maintained for compatibility)
            formatting_options: Advanced formatting options

        Returns:
            Dictionary with Markdown content and metadata
        """
        try:
            if "error" in scrape_result:
                return {
                    "success": False,
                    "error": scrape_result["error"],
                    "url": scrape_result.get("url"),
                }

            url, title, html_content, page_content = self._build_html_input(
                scrape_result,
                extract_main_content,
            )
            markdown_content = self._convert_html_with_formatting(
                html_content,
                url,
                custom_options,
                formatting_options,
            )
            markdown_content, embed_stats = self._embed_images_if_needed(
                markdown_content,
                embed_images,
                embed_options,
            )

            # Prepare result
            result = {
                "success": True,
                "url": url,
                "markdown": markdown_content,
                "conversion_options": {
                    "extract_main_content": extract_main_content,
                    "include_metadata": include_metadata,
                    "custom_options": custom_options or {},
                    "formatting_options": formatting_options or {},
                    "embed_images": embed_images,
                    "embed_options": embed_options or {},
                },
            }

            # Include metadata if requested
            if include_metadata:
                result["metadata"] = self._build_webpage_metadata(
                    url=url,
                    title=title,
                    markdown_content=markdown_content,
                    scrape_result=scrape_result,
                    page_content=page_content,
                    embed_stats=embed_stats,
                )

            return result

        except Exception as e:
            logger.error(f"Error converting webpage to Markdown: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "url": scrape_result.get("url", ""),
            }

    def batch_convert_to_markdown(
        self,
        scrape_results: List[Dict[str, Any]],
        extract_main_content: bool = True,
        include_metadata: bool = True,
        custom_options: Optional[Dict[str, Any]] = None,
        formatting_options: Optional[Dict[str, bool]] = None,
        *,
        embed_images: bool = False,
        embed_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Convert multiple scraped webpage results to Markdown format.

        Args:
            scrape_results: List of scraping results
            extract_main_content: Whether to extract main content area
            include_metadata: Whether to include page metadata
            custom_options: Custom options (maintained for compatibility)
            formatting_options: Advanced formatting options

        Returns:
            Dictionary with converted results and summary
        """
        try:
            converted_results = []
            successful_conversions = 0
            failed_conversions = 0

            for scrape_result in scrape_results:
                conversion_result = self.convert_webpage_to_markdown(
                    scrape_result,
                    extract_main_content,
                    include_metadata,
                    custom_options,
                    formatting_options,
                    embed_images=embed_images,
                    embed_options=embed_options,
                )

                if conversion_result.get("success"):
                    successful_conversions += 1
                else:
                    failed_conversions += 1

                converted_results.append(conversion_result)

            return {
                "success": True,
                "results": converted_results,
                "summary": {
                    "total": len(scrape_results),
                    "successful": successful_conversions,
                    "failed": failed_conversions,
                    "success_rate": successful_conversions
                    / max(1, len(scrape_results)),
                },
                "conversion_options": {
                    "extract_main_content": extract_main_content,
                    "include_metadata": include_metadata,
                    "custom_options": custom_options or {},
                },
            }

        except Exception as e:
            logger.error(f"Error in batch Markdown conversion: {str(e)}")
            return {"success": False, "error": str(e), "results": []}
