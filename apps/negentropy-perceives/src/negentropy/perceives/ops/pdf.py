"""Core operations: PDF 解析为 Markdown。"""

import logging
import time
from typing import Any, Callable, Dict, List, Optional

from ..core.execution import OperationError, run_operation
from ..core.pipeline_support import attempt_pipeline
from ..core.services import create_pdf_processor
from ..core.types import PDFMethod, PDFOutputFormat, elapsed_ms, validate_page_range
from ..infra import rate_limiter
from ..models import BatchPDFResponse, ImageAssetModel, PDFResponse

logger = logging.getLogger(__name__)


def _pdf_error_response(
    pdf_source: str,
    method: PDFMethod,
    output_format: PDFOutputFormat,
) -> Callable[[OperationError], PDFResponse]:
    """创建单 PDF 操作的错误响应构建器。"""

    def _build(err: OperationError) -> PDFResponse:
        return PDFResponse(
            success=False,
            pdf_source=pdf_source,
            method=method,
            output_format=output_format,
            error=err.message,
            conversion_time=err.elapsed_seconds,
        )

    return _build


def _batch_pdf_error_response(
    pdf_sources: List[str],
) -> Callable[[OperationError], BatchPDFResponse]:
    """创建批量 PDF 操作的错误响应构建器。"""
    total = len(pdf_sources) if pdf_sources else 0

    def _build(err: OperationError) -> BatchPDFResponse:
        return BatchPDFResponse(
            success=False,
            total_pdfs=total,
            successful_count=0,
            failed_count=total,
            results=[],
            total_pages=0,
            total_word_count=0,
            total_conversion_time=err.elapsed_seconds,
        )

    return _build


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

    async def _business_logic() -> PDFResponse:
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

            pipeline_result = await attempt_pipeline(
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
                enhanced_assets = {
                    "images_extracted": pipeline_result.images_count,
                    "tables_extracted": pipeline_result.tables_count,
                    "formulas_extracted": pipeline_result.formulas_count,
                    "code_blocks_detected": pipeline_result.code_blocks_count,
                    "engines_used": pipeline_result.engines_used,
                    "stage_breakdown": pipeline_result.stage_results,
                }
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

    return await run_operation(
        "pdf",
        _business_logic,
        timeout=timeout,
        error_fn=_pdf_error_response(pdf_source, method, output_format),
    )


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
    start_time = time.time()

    async def _business_logic() -> BatchPDFResponse:
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

    return await run_operation(
        "pdf",
        _business_logic,
        timeout=timeout,
        error_fn=_batch_pdf_error_response(pdf_sources),
    )
