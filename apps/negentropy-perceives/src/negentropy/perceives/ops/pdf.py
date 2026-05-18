"""Core operations: PDF 解析为 Markdown。"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

from ..config import settings
from ..core.cancellation import bind_cancel_scope
from ..core.pipeline_support import try_pipeline
from ..core.services import create_pdf_processor
from ..core.task_context import bind_pipeline, pipeline_var
from ..core.types import PDFMethod, PDFOutputFormat, elapsed_ms, validate_page_range
from ..infra import rate_limiter
from ..models import BatchPDFResponse, ImageAssetModel, PDFResponse

logger = logging.getLogger(__name__)


async def parse_pdf_to_markdown(
    pdf_source: str,
    *,
    method: PDFMethod = "auto",
    include_metadata: bool = True,
    page_range: Optional[List[int]] = None,
    output_format: PDFOutputFormat = "markdown",
    extract_images: bool = True,
    extract_tables: bool = True,
    extract_formulas: bool = True,
    embed_images: bool = False,
    enhanced_options: Optional[Dict[str, Any]] = None,
    timeout: Optional[int] = None,
) -> PDFResponse:
    """将 PDF 文档解析为结构化 Markdown。

    支持 URL 和本地文件路径，提供多引擎降级链。

    Args:
        pdf_source: PDF 源路径（HTTP/HTTPS URL 或本地文件绝对路径）
        method: PDF 提取方法 (auto/smart/docling/mineru/marker/pymupdf/pypdf)
        include_metadata: 是否包含 PDF 元数据
        page_range: 页面范围 [start, end]
        output_format: 输出格式 (markdown/text)
        extract_images: 是否提取图像
        extract_tables: 是否提取表格
        extract_formulas: 是否提取公式
        embed_images: 是否将图像嵌入 Markdown
        enhanced_options: 增强处理选项

    Returns:
        PDFResponse 包含解析内容和元数据
    """
    _start = time.time()
    effective_timeout = timeout or settings.task_timeout_seconds
    pipeline_tok = bind_pipeline("pdf")
    try:
        try:
            async with bind_cancel_scope(timeout=effective_timeout):
                page_range_tuple, page_range_error = validate_page_range(page_range)
                if page_range_error:
                    return PDFResponse(
                        success=False,
                        pdf_source=pdf_source,
                        method=method,
                        output_format=output_format,
                        error=page_range_error,
                        conversion_time=0,
                    )

                logger.info(
                    "启动 Pipeline source=%s method=%s output=%s",
                    pdf_source,
                    method,
                    output_format,
                )

                await rate_limiter.wait()

                output_dir = None
                if enhanced_options and "output_dir" in enhanced_options:
                    output_dir = enhanced_options["output_dir"]

                # Pipeline 路径（method="auto" 且 Pipeline 配置可用时）
                if method == "auto":
                    from ..pipeline import run_pdf_pipeline

                    pipeline_result = await try_pipeline(
                        run_pdf_pipeline,
                        success_check=lambda r: getattr(r, "success", False),
                        source=pdf_source,
                        page_range=page_range_tuple,
                        extract_images=extract_images,
                        extract_tables=extract_tables,
                        extract_formulas=extract_formulas,
                        embed_images=embed_images,
                        output_dir=output_dir,
                    )
                    if pipeline_result is not None:
                        # 始终透出 enhanced_assets, 即便纯文本 PDF 也保留 engines_used /
                        # stage_breakdown, 让基准脚本与 MCP 调用方观测到 Pipeline 端到端
                        # 的引擎选择与 stage 时延分布 (PR #163 之前的条件门控会让纯文本
                        # PDF 永远拿不到这些观测信号, 阻碍严格循证调优)。
                        enhanced_assets = {
                            "images_extracted": pipeline_result.images_count,
                            "tables_extracted": pipeline_result.tables_count,
                            "formulas_extracted": pipeline_result.formulas_count,
                            "code_blocks_detected": pipeline_result.code_blocks_count,
                            "engines_used": pipeline_result.engines_used,
                            "stage_breakdown": pipeline_result.stage_results,
                        }
                        # 将 pipeline 层的 dataclass ImageAsset 映射为响应层
                        # 的 Pydantic ImageAssetModel；空列表统一回落为 None，
                        # 以便客户端用 `is None` 判断“无图片 vs 有图但未透出”。
                        # resource_uri 在此处保持为 None，由 tools 层在 wrapper
                        # 出口动态注册 MCP Resource 后回填。
                        image_assets_out = None
                        raw_assets = getattr(pipeline_result, "image_assets", None)
                        if raw_assets:
                            image_assets_out = [
                                ImageAssetModel(
                                    filename=a.filename,
                                    mime_type=a.mime_type,
                                    image_path=a.image_path,
                                    resource_uri=a.resource_uri,
                                    width=a.width,
                                    height=a.height,
                                    caption=a.caption,
                                    page_number=a.page_number,
                                )
                                for a in raw_assets
                            ]
                        return PDFResponse(
                            success=True,
                            pdf_source=pdf_source,
                            method="pipeline_auto",
                            output_format=output_format,
                            content=pipeline_result.markdown,
                            metadata=pipeline_result.metadata,
                            page_count=getattr(pipeline_result, "page_count", 0),
                            word_count=pipeline_result.word_count,
                            conversion_time=elapsed_ms(_start) / 1000.0,
                            enhanced_assets=enhanced_assets,
                            image_assets=image_assets_out,
                        )

                # 传统路径（直接调用 PDFProcessor）
                enable_enhanced = extract_images or extract_tables or extract_formulas

                pdf_processor = create_pdf_processor(
                    enable_enhanced_features=enable_enhanced, output_dir=output_dir
                )
                result = await pdf_processor.process_pdf(
                    pdf_source=pdf_source,
                    method=method,
                    include_metadata=include_metadata,
                    page_range=page_range_tuple,
                    output_format=output_format,
                    extract_images=extract_images,
                    extract_tables=extract_tables,
                    extract_formulas=extract_formulas,
                    embed_images=embed_images,
                    enhanced_options=enhanced_options,
                )

                if result.get("success"):
                    return PDFResponse(
                        success=True,
                        pdf_source=pdf_source,
                        method=method,
                        output_format=output_format,
                        content=result.get("content", result.get("markdown", "")),
                        metadata=result.get("metadata", {}),
                        page_count=result.get(
                            "page_count",
                            result.get("pages_processed", result.get("pages", 0)),
                        ),
                        word_count=result.get("word_count", 0),
                        conversion_time=elapsed_ms(_start) / 1000.0,
                        enhanced_assets=result.get("enhanced_assets"),
                        orchestration_info=result.get("orchestration_info"),
                    )
                else:
                    return PDFResponse(
                        success=False,
                        pdf_source=pdf_source,
                        method=method,
                        output_format=output_format,
                        error=result.get("error", "PDF conversion failed"),
                        conversion_time=elapsed_ms(_start) / 1000.0,
                    )
        except asyncio.TimeoutError:
            logger.error("任务超时（%ds）source=%s", effective_timeout, pdf_source)
            return PDFResponse(
                success=False,
                pdf_source=pdf_source,
                method=method,
                output_format=output_format,
                error=f"任务超时：超过 {effective_timeout} 秒仍未完成，已中止",
                conversion_time=float(effective_timeout),
            )
        except asyncio.CancelledError:
            logger.warning(
                "任务已取消 source=%s elapsed=%.2fs",
                pdf_source,
                elapsed_ms(_start) / 1000.0,
            )
            return PDFResponse(
                success=False,
                pdf_source=pdf_source,
                method=method,
                output_format=output_format,
                error="任务已取消：客户端主动取消或上游中断，已释放资源",
                conversion_time=elapsed_ms(_start) / 1000.0,
            )
        except Exception as e:
            logger.error("Error parsing PDF %s: %s", pdf_source, str(e))
            return PDFResponse(
                success=False,
                pdf_source=pdf_source,
                method=method,
                output_format=output_format,
                error=str(e),
                conversion_time=elapsed_ms(_start) / 1000.0,
            )
    finally:
        pipeline_var.reset(pipeline_tok)


async def parse_pdfs_to_markdown(
    pdf_sources: List[str],
    *,
    method: PDFMethod = "auto",
    include_metadata: bool = True,
    page_range: Optional[List[int]] = None,
    output_format: PDFOutputFormat = "markdown",
    extract_images: bool = True,
    extract_tables: bool = True,
    extract_formulas: bool = True,
    embed_images: bool = False,
    enhanced_options: Optional[Dict[str, Any]] = None,
    timeout: Optional[int] = None,
) -> BatchPDFResponse:
    """批量将 PDF 文档解析为 Markdown。

    Args:
        pdf_sources: PDF 源列表（支持 URL 和本地文件路径混合）
        method: 统一的 PDF 提取方法
        include_metadata: 是否包含元数据
        page_range: 统一的页面范围 [start, end]
        output_format: 统一的输出格式
        extract_images: 是否提取图像
        extract_tables: 是否提取表格
        extract_formulas: 是否提取公式
        embed_images: 是否嵌入图像
        enhanced_options: 统一的增强处理选项

    Returns:
        BatchPDFResponse 包含批量解析结果和统计信息
    """
    effective_timeout = timeout or settings.task_timeout_seconds
    pipeline_tok = bind_pipeline("pdf")
    start_time = time.time()
    try:
        try:
            async with bind_cancel_scope(timeout=effective_timeout):
                if not pdf_sources:
                    return BatchPDFResponse(
                        success=False,
                        total_pdfs=0,
                        successful_count=0,
                        failed_count=0,
                        results=[],
                        total_conversion_time=0,
                    )

                page_range_tuple, page_range_error = validate_page_range(page_range)
                if page_range_error:
                    return BatchPDFResponse(
                        success=False,
                        total_pdfs=len(pdf_sources),
                        successful_count=0,
                        failed_count=len(pdf_sources),
                        results=[],
                        total_conversion_time=0,
                    )

                logger.info(
                    "启动批量 Pipeline count=%d output=%s method=%s",
                    len(pdf_sources),
                    output_format,
                    method,
                )

                pdf_processor = create_pdf_processor()
                result = await pdf_processor.batch_process_pdfs(
                    pdf_sources=pdf_sources,
                    method=method,
                    include_metadata=include_metadata,
                    page_range=page_range_tuple,
                    output_format=output_format,
                    extract_images=extract_images,
                    extract_tables=extract_tables,
                    extract_formulas=extract_formulas,
                    embed_images=embed_images,
                    enhanced_options=enhanced_options,
                )

                duration_ms = int((time.time() - start_time) * 1000)

                pdf_responses = []
                for i, result_item in enumerate(result.get("results", [])):
                    pdf_source_item = pdf_sources[i] if i < len(pdf_sources) else ""
                    pdf_responses.append(
                        PDFResponse(
                            success=result_item.get("success", False),
                            pdf_source=pdf_source_item,
                            method=method,
                            output_format=output_format,
                            content=result_item.get("content", ""),
                            metadata=result_item.get("metadata", {}),
                            page_count=result_item.get(
                                "page_count", result_item.get("pages_processed", 0)
                            ),
                            word_count=result_item.get("word_count", 0),
                            conversion_time=result_item.get("conversion_time", 0),
                            error=result_item.get("error"),
                        )
                    )

                successful_count = sum(1 for r in pdf_responses if r.success)
                failed_count = len(pdf_responses) - successful_count
                total_pages = sum(r.page_count for r in pdf_responses)
                total_word_count = sum(r.word_count for r in pdf_responses)

                return BatchPDFResponse(
                    success=result.get("success", False),
                    total_pdfs=len(pdf_sources),
                    successful_count=successful_count,
                    failed_count=failed_count,
                    results=pdf_responses,
                    total_pages=total_pages,
                    total_word_count=total_word_count,
                    total_conversion_time=duration_ms / 1000.0,
                )
        except asyncio.TimeoutError:
            logger.error(
                "批量任务超时（%ds）count=%d", effective_timeout, len(pdf_sources)
            )
            return BatchPDFResponse(
                success=False,
                total_pdfs=len(pdf_sources) if pdf_sources else 0,
                successful_count=0,
                failed_count=len(pdf_sources) if pdf_sources else 0,
                results=[],
                total_pages=0,
                total_word_count=0,
                total_conversion_time=float(effective_timeout),
            )
        except asyncio.CancelledError:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.warning(
                "批量任务已取消 count=%d elapsed=%.2fs",
                len(pdf_sources) if pdf_sources else 0,
                duration_ms / 1000.0,
            )
            return BatchPDFResponse(
                success=False,
                total_pdfs=len(pdf_sources) if pdf_sources else 0,
                successful_count=0,
                failed_count=len(pdf_sources) if pdf_sources else 0,
                results=[],
                total_pages=0,
                total_word_count=0,
                total_conversion_time=duration_ms / 1000.0,
            )
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error("Error in batch PDF conversion: %s", str(e))
            return BatchPDFResponse(
                success=False,
                total_pdfs=len(pdf_sources) if pdf_sources else 0,
                successful_count=0,
                failed_count=len(pdf_sources) if pdf_sources else 0,
                results=[],
                total_pages=0,
                total_word_count=0,
                total_conversion_time=duration_ms / 1000.0,
            )
    finally:
        pipeline_var.reset(pipeline_tok)
