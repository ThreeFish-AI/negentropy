"""Core operations: 网页解析为 Markdown。"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

from ..config import settings
from ..core.cancellation import bind_cancel_scope
from ..core.pipeline_support import try_pipeline
from ..core.task_context import bind_pipeline, pipeline_var
from ..core.types import ScrapeMethod, elapsed_ms
from ..infra import rate_limiter
from ..infra.parsing import validate_url
from ..markdown.converter import MarkdownConverter
from ..models import BatchMarkdownResponse, MarkdownResponse
from ..scraping import WebScraper

logger = logging.getLogger(__name__)


async def parse_webpage_to_markdown(
    url: str,
    *,
    method: ScrapeMethod = "auto",
    extract_main_content: bool = True,
    include_metadata: bool = True,
    custom_options: Optional[Dict[str, Any]] = None,
    wait_for_element: Optional[str] = None,
    formatting_options: Optional[Dict[str, bool]] = None,
    embed_images: bool = False,
    embed_options: Optional[Dict[str, Any]] = None,
    web_scraper: WebScraper,
    markdown_converter: MarkdownConverter,
    timeout: Optional[int] = None,
) -> MarkdownResponse:
    """将网页解析为结构化 Markdown。

    Args:
        url: 目标网页 URL
        method: 抓取方法 (auto/simple/selenium/stealth_selenium/stealth_playwright)
        extract_main_content: 是否仅提取主要内容区域
        include_metadata: 是否包含页面元数据
        custom_options: 自定义 Markdown 转换选项
        wait_for_element: Selenium 模式下等待加载的 CSS 选择器
        formatting_options: 高级格式化选项
        embed_images: 是否嵌入图片
        embed_options: 图片嵌入选项
        web_scraper: WebScraper 实例
        markdown_converter: MarkdownConverter 实例

    Returns:
        MarkdownResponse 包含 Markdown 内容和元数据
    """
    method_key = f"markdown_{method}"
    _start = time.time()
    effective_timeout = timeout or settings.task_timeout_seconds
    pipeline_tok = bind_pipeline("webpage")
    try:
        try:
            async with bind_cancel_scope(timeout=effective_timeout):
                url_error = validate_url(url)
                if url_error:
                    return MarkdownResponse(
                        success=False,
                        url=url,
                        method=method,
                        error=url_error,
                        conversion_time=0,
                    )

                logger.info("启动 Pipeline url=%s method=%s", url, method)

                await rate_limiter.wait()

                # Pipeline 路径（method="auto" 且 Pipeline 配置可用时）
                if method == "auto":
                    from ..pipeline import run_webpage_pipeline

                    pipeline_result = await try_pipeline(
                        run_webpage_pipeline,
                        success_check=lambda r: bool(
                            isinstance(r, dict) and r.get("success")
                        ),
                        url=url,
                        method=method,
                        extract_main_content=extract_main_content,
                        include_metadata=include_metadata,
                        embed_images=embed_images,
                        custom_options=custom_options,
                        formatting_options=formatting_options,
                    )
                    if pipeline_result is not None:
                        return MarkdownResponse(
                            success=True,
                            url=url,
                            method="pipeline_auto",
                            markdown_content=pipeline_result.get(
                                "markdown_content", ""
                            ),
                            metadata=pipeline_result.get("metadata", {}),
                            word_count=pipeline_result.get("word_count", 0),
                            images_embedded=0,
                            conversion_time=elapsed_ms(_start) / 1000.0,
                        )

                # 传统路径（直接调用 web_scraper + markdown_converter）
                scrape_result = await web_scraper.scrape_url(
                    url=url,
                    method=method,
                    extract_config=None,
                    wait_for_element=wait_for_element,
                )

                if "error" in scrape_result:
                    return MarkdownResponse(
                        success=False,
                        url=url,
                        method=method,
                        error=scrape_result["error"],
                        conversion_time=elapsed_ms(_start) / 1000.0,
                    )

                conversion_result = markdown_converter.convert_webpage_to_markdown(
                    scrape_result=scrape_result,
                    extract_main_content=extract_main_content,
                    include_metadata=include_metadata,
                    custom_options=custom_options,
                    embed_images=embed_images,
                    embed_options=embed_options,
                )

                if conversion_result.get("success"):
                    return MarkdownResponse(
                        success=True,
                        url=url,
                        method=method_key,
                        markdown_content=conversion_result.get(
                            "markdown_content", conversion_result.get("markdown", "")
                        ),
                        metadata=conversion_result.get("metadata", {}),
                        word_count=conversion_result.get("word_count", 0),
                        images_embedded=conversion_result.get("images_embedded", 0),
                        conversion_time=elapsed_ms(_start) / 1000.0,
                    )
                else:
                    return MarkdownResponse(
                        success=False,
                        url=url,
                        method=method_key,
                        error=conversion_result.get(
                            "error", "Markdown conversion failed"
                        ),
                        conversion_time=elapsed_ms(_start) / 1000.0,
                    )
        except asyncio.TimeoutError:
            logger.error("任务超时（%ds）url=%s", effective_timeout, url)
            return MarkdownResponse(
                success=False,
                url=url,
                method=method_key,
                error=f"任务超时：超过 {effective_timeout} 秒仍未完成，已中止",
                conversion_time=float(effective_timeout),
            )
        except asyncio.CancelledError:
            logger.warning(
                "任务已取消 url=%s elapsed=%.2fs",
                url,
                elapsed_ms(_start) / 1000.0,
            )
            return MarkdownResponse(
                success=False,
                url=url,
                method=method_key,
                error="任务已取消：客户端主动取消或上游中断，已释放资源",
                conversion_time=elapsed_ms(_start) / 1000.0,
            )
        except Exception as e:
            logger.error("Error parsing webpage %s to Markdown: %s", url, str(e))
            return MarkdownResponse(
                success=False,
                url=url,
                method=method_key,
                error=str(e),
                conversion_time=elapsed_ms(_start) / 1000.0,
            )
    finally:
        pipeline_var.reset(pipeline_tok)


async def parse_webpages_to_markdown(
    urls: List[str],
    *,
    method: ScrapeMethod = "auto",
    extract_main_content: bool = True,
    include_metadata: bool = True,
    custom_options: Optional[Dict[str, Any]] = None,
    embed_images: bool = False,
    embed_options: Optional[Dict[str, Any]] = None,
    web_scraper: WebScraper,
    markdown_converter: MarkdownConverter,
    timeout: Optional[int] = None,
) -> BatchMarkdownResponse:
    """批量将网页解析为 Markdown。

    Args:
        urls: URL 列表
        method: 统一的抓取方法
        extract_main_content: 是否统一提取主要内容区域
        include_metadata: 是否包含页面元数据
        custom_options: 统一的自定义选项
        embed_images: 是否嵌入图片
        embed_options: 统一的图片嵌入选项
        web_scraper: WebScraper 实例
        markdown_converter: MarkdownConverter 实例

    Returns:
        BatchMarkdownResponse 包含批量转换结果和统计信息
    """
    effective_timeout = timeout or settings.task_timeout_seconds
    pipeline_tok = bind_pipeline("webpage")
    start_time = time.time()
    try:
        try:
            async with bind_cancel_scope(timeout=effective_timeout):
                if not urls:
                    return BatchMarkdownResponse(
                        success=False,
                        total_urls=0,
                        successful_count=0,
                        failed_count=0,
                        results=[],
                        total_conversion_time=0,
                    )

                for url in urls:
                    url_error = validate_url(url)
                    if url_error:
                        return BatchMarkdownResponse(
                            success=False,
                            total_urls=0,
                            successful_count=0,
                            failed_count=0,
                            results=[],
                            total_conversion_time=0,
                        )

                logger.info(
                    "启动批量 Pipeline count=%d method=%s",
                    len(urls),
                    method,
                )

                scrape_results = await web_scraper.scrape_multiple_urls(
                    urls=urls, method=method, extract_config=None
                )

                conversion_result = markdown_converter.batch_convert_to_markdown(
                    scrape_results=scrape_results,
                    extract_main_content=extract_main_content,
                    include_metadata=include_metadata,
                    custom_options=custom_options,
                    embed_images=embed_images,
                    embed_options=embed_options,
                )

                duration_ms = int((time.time() - start_time) * 1000)

                markdown_responses = []
                for i, result in enumerate(conversion_result.get("results", [])):
                    url_item = urls[i] if i < len(urls) else ""
                    markdown_responses.append(
                        MarkdownResponse(
                            success=result.get("success", False),
                            url=url_item,
                            method=f"markdown_{method}",
                            markdown_content=result.get("markdown_content", ""),
                            metadata=result.get("metadata", {}),
                            word_count=result.get("word_count", 0),
                            images_embedded=result.get("images_embedded", 0),
                            conversion_time=result.get("conversion_time", 0),
                            error=result.get("error"),
                        )
                    )

                successful_count = sum(1 for r in markdown_responses if r.success)
                failed_count = len(markdown_responses) - successful_count
                total_word_count = sum(r.word_count for r in markdown_responses)

                return BatchMarkdownResponse(
                    success=conversion_result.get("success", False),
                    total_urls=len(urls),
                    successful_count=successful_count,
                    failed_count=failed_count,
                    results=markdown_responses,
                    total_word_count=total_word_count,
                    total_conversion_time=duration_ms / 1000.0,
                )
        except asyncio.TimeoutError:
            logger.error("批量任务超时（%ds）count=%d", effective_timeout, len(urls))
            return BatchMarkdownResponse(
                success=False,
                total_urls=len(urls) if urls else 0,
                successful_count=0,
                failed_count=len(urls) if urls else 0,
                results=[],
                total_word_count=0,
                total_conversion_time=float(effective_timeout),
            )
        except asyncio.CancelledError:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.warning(
                "批量任务已取消 count=%d elapsed=%.2fs",
                len(urls) if urls else 0,
                duration_ms / 1000.0,
            )
            return BatchMarkdownResponse(
                success=False,
                total_urls=len(urls) if urls else 0,
                successful_count=0,
                failed_count=len(urls) if urls else 0,
                results=[],
                total_word_count=0,
                total_conversion_time=duration_ms / 1000.0,
            )
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error("Error in batch Markdown conversion: %s", str(e))
            return BatchMarkdownResponse(
                success=False,
                total_urls=len(urls) if urls else 0,
                successful_count=0,
                failed_count=len(urls) if urls else 0,
                results=[],
                total_word_count=0,
                total_conversion_time=duration_ms / 1000.0,
            )
    finally:
        pipeline_var.reset(pipeline_tok)
