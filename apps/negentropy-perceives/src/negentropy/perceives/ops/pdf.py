"""Core operations: PDF 解析为 Markdown。"""

import asyncio
import logging
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from ..core.execution import OperationError, run_operation
from ..core.pipeline_support import attempt_pipeline
from ..core.services import create_pdf_processor
from ..core.types import PDFMethod, PDFOutputFormat, elapsed_ms, validate_page_range
from ..infra import rate_limiter
from ..models import BatchPDFResponse, ImageAssetModel, PDFResponse

logger = logging.getLogger(__name__)


# auto_batch 默认参数（与 tools/pdf.py 工具签名默认值保持一致）
DEFAULT_BATCH_PAGE_SIZE = 20
"""单切片最大页数。20 页 ≈ 50-100s 单切片；更小分批粒度降低单批超时风险，提升 checkpoint 恢复效率。"""

DEFAULT_BATCH_THRESHOLD_PAGES = 60
"""超过该页数才启用分批；小于等于此值走原单次路径（既有 1604 单测零退化）。"""

DEFAULT_PER_SLICE_TIMEOUT_SECONDS = 300
"""逐批超时（5 分钟）。保障每批有充足的处理时间；超时后标记失败并继续下一批，checkpoint 保已完成的切片供断点续传。"""


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
    auto_batch: bool = True,
    batch_page_size: int = DEFAULT_BATCH_PAGE_SIZE,
    batch_threshold_pages: int = DEFAULT_BATCH_THRESHOLD_PAGES,
    resume: bool = True,
) -> PDFResponse:
    """将 PDF 文档解析为结构化 Markdown。

    支持 URL 和本地文件路径，提供多引擎降级链。大型 PDF（``> batch_threshold_pages``
    页）在 ``method="auto"`` 且 ``auto_batch=True`` 且未显式指定 ``page_range`` 时，
    自动按 ``batch_page_size`` 切片串行处理并跨切片合并；切片完成即落盘到
    ``<output_dir>/.batch_state/``，``resume=True`` 时复用已完成切片以支持
    断点续传。

    Args:
        pdf_source: PDF 源路径（HTTP/HTTPS URL 或本地文件绝对路径）
        method: PDF 提取方法 (auto/smart/docling/mineru/marker/pymupdf/pypdf)
        include_metadata: 是否包含 PDF 元数据
        page_range: 页面范围 [start, end]（显式指定时屏蔽 auto_batch）
        output_format: 输出格式 (markdown/text)
        extract_images: 是否提取图像
        extract_tables: 是否提取表格
        extract_formulas: 是否提取公式
        embed_images: 是否将图像嵌入 Markdown
        enhanced_options: 增强处理选项
        auto_batch: 是否在 ``method="auto"`` 且页数超阈值时自动分批
        batch_page_size: 单切片最大页数
        batch_threshold_pages: 启用分批的最小总页数阈值（<= 阈值走原单次路径）
        resume: 是否在分批模式下复用已完成切片的 checkpoint 实现断点续传

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
            from ..pipeline.batch_merge import detect_pdf_total_pages

            # auto_batch 分批分支：仅在显式无 page_range 时尝试
            if auto_batch and page_range_tuple is None:
                total_pages = detect_pdf_total_pages(pdf_source)
                if total_pages is not None and total_pages > batch_threshold_pages:
                    logger.info(
                        "auto_batch 启用 total_pages=%d batch_size=%d threshold=%d",
                        total_pages,
                        batch_page_size,
                        batch_threshold_pages,
                    )
                    batched_response = await _run_batched_pipeline(
                        pdf_source=pdf_source,
                        output_format=output_format,
                        total_pages=total_pages,
                        batch_size=batch_page_size,
                        extract_images=extract_images,
                        extract_tables=extract_tables,
                        extract_formulas=extract_formulas,
                        embed_images=embed_images,
                        output_dir=output_dir,
                        start_time=_start,
                        resume=resume,
                        total_timeout_seconds=timeout,
                    )
                    if batched_response is not None:
                        # auto_batch 合并后的 markdown 同样需走格式化咽喉点：
                        # 各 slice 经 pipeline 内部格式化，但跨 slice 合并 / 引擎原生
                        # 直出仍可能残留运行页眉、伪代码块等。统一格式化（幂等）。
                        from ..markdown.formatter import MarkdownFormatter

                        _batched_md = getattr(batched_response, "content", "") or ""
                        if _batched_md:
                            batched_response.content = (
                                MarkdownFormatter().format_fidelity_safe(_batched_md)
                            )
                        return batched_response
                    logger.warning(
                        "auto_batch 整体失败，回退到单次 Pipeline 路径 source=%s",
                        pdf_source,
                    )

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
                # auto/pipeline 路径的 markdown 通用格式化咽喉点：pipeline 内部
                # assembly 已格式化，但历史实测部分路径（引擎原生直出 / 降级）会
                # 绕过 assembly 的格式化，导致运行页眉残留、自然语言横幅被误判
                # 为代码块等。在此对最终 markdown 统一再走一次 MarkdownFormatter
                # （幂等：已格式化的内容二次格式化无副作用），确保所有 auto 产出
                # 一致地剥离运行页眉、降级伪代码块、排版/去重。
                from ..markdown.formatter import MarkdownFormatter

                _pipeline_md = pipeline_result.markdown
                if _pipeline_md:
                    _pipeline_md = MarkdownFormatter().format_fidelity_safe(
                        _pipeline_md
                    )
                    pipeline_result.markdown = _pipeline_md
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
            # 通用格式化咽喉点：无论引擎路径（docling/mineru/marker 经
            # _build_result_from_engine）还是 pymupdf/pypdf 降级路径，最终
            # markdown 都经此传入 PDFResponse。此前仅 assembly 管线路径格式化，
            # 引擎/降级路径直出裸 markdown，导致运行页眉逐页残留、自然语言横幅
            # 被误判为代码块等问题漏网。在此统一走 MarkdownFormatter，与 assembly
            # 路径对齐（剥离运行页眉、降级伪代码块、排版/去重等）。
            from ..markdown.formatter import MarkdownFormatter

            _content = result.get("content", result.get("markdown", ""))
            if _content:
                _content = MarkdownFormatter().format_fidelity_safe(_content)
            return PDFResponse(
                success=True,
                pdf_source=pdf_source,
                method=method,
                output_format=output_format,
                content=_content,
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


# ---------------------------------------------------------------------------
# auto_batch 分批调度（含 checkpoint/resume）
# ---------------------------------------------------------------------------


async def _run_batched_pipeline(
    *,
    pdf_source: str,
    output_format: PDFOutputFormat,
    total_pages: int,
    batch_size: int,
    extract_images: bool,
    extract_tables: bool,
    extract_formulas: bool,
    embed_images: bool,
    output_dir: Optional[str],
    start_time: float,
    resume: bool = True,
    total_timeout_seconds: Optional[int] = None,
) -> Optional[PDFResponse]:
    """auto_batch 路径：按页切片串行调用 run_pdf_pipeline 并跨切片合并。

    特性：
        - 每切片完成立即把 markdown + 资产列表落盘到 ``<output_dir>/.batch_state/``，
          实现 checkpoint。``resume=True`` 时跳过已完成切片。
        - 单切片失败重试 1 次（同参再调）；二次失败标记 ``error_partial`` 写入
          ``partial_failures``，继续后续切片。
        - 跨切片合并通过 :mod:`pipeline.batch_merge` 完成（资产去重、boundary
          marker、Figure caption 救援）。
        - 所有切片均失败时返回 ``PDFResponse(success=False, ...)``；至少 1 切片
          成功即返回 ``success=True``，``error`` 反映 partial 状态。

    Returns:
        ``PDFResponse``；若分批不可用（如 batch_merge 模块不存在），返回 ``None``
        以指示调用方回退到原单次路径。
    """
    from ..pipeline import run_pdf_pipeline
    from ..pipeline.batch_merge import (
        merge_pipeline_results,
        split_page_ranges,
    )

    try:
        slice_ranges = split_page_ranges(total_pages, batch_size)
    except ValueError as exc:
        logger.warning("auto_batch split 失败：%s", exc)
        return None

    # 初始化 checkpoint 目录
    checkpoint_dir = _resolve_batch_state_dir(output_dir, pdf_source)
    manifest = _load_or_init_manifest(
        checkpoint_dir=checkpoint_dir,
        pdf_source=pdf_source,
        total_pages=total_pages,
        batch_size=batch_size,
        slice_ranges=slice_ranges,
        resume=resume,
    )

    completed: List[Any] = [None] * len(slice_ranges)
    partial_failures: List[Tuple[int, int, str]] = []

    # 逐批超时：固定 5 分钟，保障每批有充足处理时间
    per_slice_timeout: float = DEFAULT_PER_SLICE_TIMEOUT_SECONDS
    logger.info(
        "auto_batch per_slice_timeout=%ds total_timeout=%s slices=%d",
        int(per_slice_timeout),
        f"{total_timeout_seconds}s" if total_timeout_seconds else "unbounded",
        len(slice_ranges),
    )

    for i, (page_start, page_end) in enumerate(slice_ranges):
        # 尝试 resume：已完成切片直接读 checkpoint
        if resume:
            cached = _load_slice_checkpoint(checkpoint_dir, i)
            if cached is not None:
                logger.info(
                    "[batch %d/%d] resume from checkpoint pages=%d-%d",
                    i + 1,
                    len(slice_ranges),
                    page_start + 1,
                    page_end,
                )
                completed[i] = cached
                continue

        # 执行切片（带 1 次重试 + 逐批超时保护）
        slice_result = None
        try:
            async with asyncio.timeout(per_slice_timeout):
                slice_result = await _execute_slice_with_retry(
                    run_pdf_pipeline=run_pdf_pipeline,
                    pdf_source=pdf_source,
                    page_range=(page_start, page_end),
                    extract_images=extract_images,
                    extract_tables=extract_tables,
                    extract_formulas=extract_formulas,
                    embed_images=embed_images,
                    output_dir=output_dir,
                    slice_index=i,
                    total_slices=len(slice_ranges),
                )
        except asyncio.TimeoutError:
            err = (
                f"slice [{page_start}, {page_end}) timed out "
                f"({per_slice_timeout:.0f}s budget)"
            )
            logger.warning("[batch %d/%d] %s", i + 1, len(slice_ranges), err)
            fallback = await _fallback_slice_lightweight(
                pdf_source=pdf_source,
                page_range=(page_start, page_end),
                output_dir=output_dir,
                slice_index=i,
                total_slices=len(slice_ranges),
            )
            if fallback is not None:
                completed[i] = fallback
                _save_slice_checkpoint(
                    checkpoint_dir, i, page_start, page_end, fallback
                )
                continue
            partial_failures.append((page_start, page_end, err))
            _save_slice_failure(checkpoint_dir, i, page_start, page_end, err)
            continue

        if slice_result is None:
            err = f"slice [{page_start}, {page_end}) failed after retry"
            logger.warning("[batch %d/%d] %s", i + 1, len(slice_ranges), err)
            fallback = await _fallback_slice_lightweight(
                pdf_source=pdf_source,
                page_range=(page_start, page_end),
                output_dir=output_dir,
                slice_index=i,
                total_slices=len(slice_ranges),
            )
            if fallback is not None:
                completed[i] = fallback
                _save_slice_checkpoint(
                    checkpoint_dir, i, page_start, page_end, fallback
                )
                continue
            partial_failures.append((page_start, page_end, err))
            _save_slice_failure(checkpoint_dir, i, page_start, page_end, err)
            continue

        completed[i] = slice_result
        _save_slice_checkpoint(checkpoint_dir, i, page_start, page_end, slice_result)

    # 首页标题守卫：docling 在全量批次中偶发丢弃首页标题/作者/摘要块（p1 单独跑
    # pymupdf 可完整产出）。对 page0 切片用 pymupdf page0 原文补回缺失前导内容，
    # 覆盖 checkpoint resume 与新跑两条路径（resume 会跳过 _execute_slice_with_retry）。
    if (
        slice_ranges
        and slice_ranges[0][0] == 0
        and completed
        and completed[0] is not None
    ):
        first_md = getattr(completed[0], "markdown", "") or ""
        guarded = _ensure_first_page_header(first_md, pdf_source)
        if guarded != first_md:
            completed[0].markdown = guarded

    # 收集成功切片
    successful_results = [r for r in completed if r is not None]
    successful_ranges = [rg for r, rg in zip(completed, slice_ranges) if r is not None]

    if not successful_results:
        logger.error(
            "auto_batch 全部切片失败 source=%s total=%d failures=%d",
            pdf_source,
            len(slice_ranges),
            len(partial_failures),
        )
        return PDFResponse(
            success=False,
            pdf_source=pdf_source,
            method="pipeline_auto_batch",
            output_format=output_format,
            error="所有切片均失败："
            + "; ".join(f"[{s},{e}): {err}" for s, e, err in partial_failures),
            conversion_time=elapsed_ms(start_time) / 1000.0,
        )

    # 跨切片合并
    merged = merge_pipeline_results(
        successful_results,
        successful_ranges,
        total_pages=total_pages,
        partial_failures=partial_failures,
    )

    # 全部完成 → 更新 manifest 状态
    _finalize_manifest(checkpoint_dir, manifest, partial_failures)

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
        for a in merged.image_assets
    ]

    enhanced_assets = {
        "images_extracted": merged.images_count,
        "tables_extracted": merged.tables_count,
        "formulas_extracted": merged.formulas_count,
        "code_blocks_detected": merged.code_blocks_count,
        "engines_used": merged.engines_used,
        "stage_breakdown": merged.stage_results,
        "batched": merged.metadata.get("batched", {}),
        "partial_failures": [
            {"start": s, "end": e, "error": err} for s, e, err in partial_failures
        ],
    }

    return PDFResponse(
        success=True,
        pdf_source=pdf_source,
        method="pipeline_auto_batch",
        output_format=output_format,
        content=merged.markdown,
        metadata=merged.metadata,
        page_count=merged.page_count,
        word_count=merged.word_count,
        conversion_time=elapsed_ms(start_time) / 1000.0,
        enhanced_assets=enhanced_assets,
        image_assets=image_assets_out,
        error=(
            f"partial success: {len(partial_failures)}/{len(slice_ranges)} 切片失败"
            if partial_failures
            else None
        ),
    )


async def _execute_slice_with_retry(
    *,
    run_pdf_pipeline,
    pdf_source: str,
    page_range: Tuple[int, int],
    extract_images: bool,
    extract_tables: bool,
    extract_formulas: bool,
    embed_images: bool,
    output_dir: Optional[str],
    slice_index: int,
    total_slices: int,
):
    """单切片执行 + 1 次重试。返回成功的 PipelineResult 或 None（最终失败）。"""
    start, end = page_range
    for attempt in range(2):
        try:
            logger.info(
                "[batch %d/%d] attempt=%d pages=%d-%d",
                slice_index + 1,
                total_slices,
                attempt + 1,
                start + 1,
                end,
            )
            result = await run_pdf_pipeline(
                source=pdf_source,
                page_range=(start, end),
                extract_images=extract_images,
                extract_tables=extract_tables,
                extract_formulas=extract_formulas,
                embed_images=embed_images,
                output_dir=output_dir,
            )
            if getattr(result, "success", False):
                return result
            logger.warning(
                "[batch %d/%d] attempt=%d 返回失败 error=%s",
                slice_index + 1,
                total_slices,
                attempt + 1,
                getattr(result, "error", "unknown"),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[batch %d/%d] attempt=%d 异常: %s",
                slice_index + 1,
                total_slices,
                attempt + 1,
                exc,
            )
    return None


async def _fallback_slice_lightweight(
    *,
    pdf_source: str,
    page_range: Tuple[int, int],
    output_dir: Optional[str],
    slice_index: int,
    total_slices: int,
) -> Optional[Any]:
    """切片超时/二次失败后的轻量引擎兜底：用 pymupdf 回收文字内容。

    必要性：auto 重型引擎（docling/mineru/marker）在大切片上可能整体超时，
    原逻辑直接丢弃整段内容（如标题/摘要/目录/前几章），致 Markdown 从中段起始、
    ``partial success``。本兜底在超时/失败后用本地快速引擎 pymupdf 重跑该切片
    页范围，至少回收文字、标题与段落顺序，避免内容整段丢失（图片资产适配较重，
    本兜底不回填 ``image_assets``；其文字保真已远胜于完全丢弃）。

    Returns:
        成功时返回 :class:`PipelineResult`（``engines_used`` 标记
        ``pymupdf-fallback``）；兜底亦失败/超时/异常/空内容时返回 ``None``。
    """
    from ..pipeline import PipelineResult

    start, end = page_range
    fallback_budget = 120.0
    try:
        pdf_processor = create_pdf_processor(
            enable_enhanced_features=False, output_dir=output_dir
        )
        async with asyncio.timeout(fallback_budget):
            result = await pdf_processor.process_pdf(
                pdf_source=pdf_source,
                method="pymupdf",
                include_metadata=False,
                page_range=(start, end),
                output_format="markdown",
                extract_images=False,
                extract_tables=False,
                extract_formulas=False,
                embed_images=False,
                enhanced_options=None,
            )
    except asyncio.TimeoutError:
        logger.warning(
            "[batch %d/%d] 轻量兜底超时 pages=%d-%d budget=%ds",
            slice_index + 1,
            total_slices,
            start + 1,
            end,
            int(fallback_budget),
        )
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[batch %d/%d] 轻量兜底异常 pages=%d-%d: %s",
            slice_index + 1,
            total_slices,
            start + 1,
            end,
            exc,
        )
        return None

    if not result.get("success"):
        logger.warning(
            "[batch %d/%d] 轻量兜底失败 pages=%d-%d error=%s",
            slice_index + 1,
            total_slices,
            start + 1,
            end,
            result.get("error", "unknown"),
        )
        return None

    markdown = result.get("content", result.get("markdown", ""))
    if not markdown.strip():
        return None

    logger.info(
        "[batch %d/%d] 轻量兜底成功(pymupdf) pages=%d-%d words=%s",
        slice_index + 1,
        total_slices,
        start + 1,
        end,
        result.get("word_count", 0),
    )
    return PipelineResult(
        success=True,
        markdown=markdown,
        page_count=result.get("page_count", end - start),
        word_count=result.get("word_count", 0),
        engines_used=["pymupdf-fallback"],
        metadata={"fallback_engine": "pymupdf"},
    )


def _ensure_first_page_header(markdown: str, pdf_source: str) -> str:
    """首页标题守卫：若首页切片 markdown 缺失文档标题，用 pymupdf page0 原文补回。

    背景：docling 文本引擎在全量批次中偶发丢弃首页标题/作者/摘要块，而 p1 单独跑
    pymupdf 可完整产出。本守卫取 pymupdf page0 首个非空行（≈文档标题），若该标题
    不在 markdown 中（任意位置），则把 page0 原文前导部分（标题+作者+摘要）以 H1
    形式前置补回；截至首个已存在于 markdown 的行（去重边界），无重叠则截至首个
    疑似章节标题（Contents / "1 Introduction" 等）。

    幂等：标题已存在则原样返回；pymupdf 抽取失败/无 page0 文本则原样返回（安全降级）。
    """
    import re

    if not markdown or not pdf_source:
        return markdown
    try:
        from ..pdf._imports import import_fitz

        fitz = import_fitz()
        doc = fitz.open(pdf_source)
        if doc.page_count == 0:
            return markdown
        p0_text = doc[0].get_text("text")
        doc.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "首页标题守卫：pymupdf page0 抽取失败 source=%s err=%s", pdf_source, exc
        )
        return markdown

    p0_lines = [ln.strip() for ln in p0_text.splitlines() if ln.strip()]
    if not p0_lines:
        return markdown
    title = p0_lines[0]

    def _norm(s: str) -> str:
        return re.sub(r"\s+", " ", s).strip().lower()

    title_norm = _norm(title)
    md_norm = _norm(markdown)
    # 标题已存在于 markdown（任意位置）→ 无需补回
    if title_norm and title_norm in md_norm:
        return markdown

    # 去重边界：page0 中首个（除标题外）已存在于 markdown 的长行
    boundary = None
    for ln in p0_lines[1:]:
        lnn = _norm(ln)
        if lnn and len(lnn) >= 12 and lnn in md_norm:
            boundary = ln
            break

    if boundary is not None:
        idx = p0_text.find(boundary)
        recovered = p0_text[:idx].strip() if idx > 0 else title
    else:
        # 无重叠：补到首个疑似章节标题（Contents / "1 Introduction" 等）前
        rec_lines = [title]
        for ln in p0_lines[1:]:
            if re.match(r"^(?:contents|\d+(?:\.\d+)*\s+[A-Z])", ln, re.IGNORECASE):
                break
            rec_lines.append(ln)
        recovered = "\n".join(rec_lines).strip()

    if not recovered:
        return markdown
    # 标题作 H1，其余作正文段落
    body = "\n".join(recovered.splitlines()[1:]).strip()
    header_md = f"# {title}".strip()
    if body:
        header_md += "\n\n" + body
    logger.info(
        "首页标题守卫：补回缺失前导内容 title=%r chars=%d", title[:60], len(header_md)
    )
    return header_md + "\n\n" + markdown.lstrip()


# ---------------------------------------------------------------------------
# Checkpoint 管理（基于文件系统）
# ---------------------------------------------------------------------------


def _stable_checkpoint_id(pdf_source: str) -> str:
    """计算 PDF 的稳定 checkpoint id（内容 SHA-1 前 12 字符）。

    必要性：backend 每次调用 MCP 都会把 GCS 字节写到新的临时路径，导致
    ``pdf_source.stem`` 每次都不同；若按 stem 派生 checkpoint 目录，跨调用
    resume 永远命中不到旧 checkpoint。
    解法：基于 PDF 文件**内容**的 SHA-1（前 12 字符 = 48 bit ≈ 280 万亿
    分之一碰撞）作为目录键，同内容 PDF 总是命中同一个 checkpoint 目录。

    Args:
        pdf_source: PDF 本地路径或 URL。

    Returns:
        12 字符稳定 id；读不到 PDF 时回退到路径 stem（向后兼容单次场景）。
    """
    import hashlib

    if pdf_source.startswith(("http://", "https://")):
        # usedforsecurity=False：此处 SHA-1 仅用于内容寻址（派生稳定 checkpoint
        # 目录键），非安全用途，避免 bandit B324 误报（与 _engine_worker_entry 一致）。
        return (
            "url-"
            + hashlib.sha1(
                pdf_source.encode("utf-8"), usedforsecurity=False
            ).hexdigest()[:8]
        )
    try:
        p = Path(pdf_source)
        if not p.exists():
            return p.stem or "document"
        h = hashlib.sha1(usedforsecurity=False)
        with open(p, "rb") as fh:
            while True:
                chunk = fh.read(1024 * 1024)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()[:12]
    except OSError as exc:
        logger.warning(
            "_stable_checkpoint_id 读取失败 source=%s err=%s", pdf_source, exc
        )
        return Path(pdf_source).stem if pdf_source else "document"


def _resolve_batch_state_dir(output_dir: Optional[str], pdf_source: str) -> Path:
    """解析 checkpoint 目录。

    无论是否提供 ``output_dir``，最终目录都以 PDF 内容 SHA-1 前 12 字符派生
    的稳定 id 作为最后一级子目录，确保同 ``output_dir`` 下不同 PDF 的
    checkpoint 天然隔离（防止跨 PDF 误用旧 slice 资产 / markdown）：

        - 提供 ``output_dir`` → ``<output_dir>/.batch_state/{sha1[:12]}/``；
        - 否则                 → ``<cwd>/output/.batch_state/{sha1[:12]}/``。

    与 :func:`pipeline.convenience._resolve_images_dir` 字符串 stem 路径不同；
    本目录专门给 checkpoint 用，必须跨 MCP 调用稳定且与 PDF 内容一一对应。
    """
    cid = _stable_checkpoint_id(pdf_source)
    if output_dir:
        base = Path(output_dir)
        state = base / ".batch_state" / cid
    else:
        state = Path.cwd() / "output" / ".batch_state" / cid
    state.mkdir(parents=True, exist_ok=True)
    return state


def _load_or_init_manifest(
    *,
    checkpoint_dir: Path,
    pdf_source: str,
    total_pages: int,
    batch_size: int,
    slice_ranges: List[Tuple[int, int]],
    resume: bool,
) -> Dict[str, Any]:
    """读 / 初始化 manifest.json。

    若 manifest 已存在但 config 不匹配（不同 PDF / 不同 batch_size）→ 视为新会话，
    覆盖 manifest 并清空所有 slice_* 文件，避免 resume 误用过期 checkpoint。
    """
    import json

    manifest_path = checkpoint_dir / "manifest.json"
    expected = {
        "pdf_source": pdf_source,
        "total_pages": total_pages,
        "batch_size": batch_size,
        "slice_ranges": [list(rg) for rg in slice_ranges],
    }

    if resume and manifest_path.exists():
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            # 不比 pdf_source 字符串：checkpoint_dir 的最后一级始终是 PDF 内容
            # SHA-1 前 12 字符（见 _resolve_batch_state_dir），同内容 PDF 必落在
            # 同一目录；不同内容 PDF 各自独立目录、互不影响。backend 每次调用
            # 临时文件名会变但内容不变，按字符串比对会导致误清除有效 checkpoint。
            # total_pages + batch_size 双键足以判定 manifest 与本次配置一致。
            same = (
                data.get("total_pages") == expected["total_pages"]
                and data.get("batch_size") == expected["batch_size"]
            )
            if same:
                logger.info("auto_batch resume manifest 命中 dir=%s", checkpoint_dir)
                return data
            logger.info(
                "auto_batch manifest 配置不匹配 (total/batch_size 漂移)，清理旧 checkpoint"
            )
        except (OSError, ValueError) as exc:
            logger.warning("manifest 读取失败 %s: %s", manifest_path, exc)

    # 清理旧 slice_* 残留
    try:
        for stale in checkpoint_dir.glob("slice_*.json"):
            stale.unlink(missing_ok=True)
        for stale in checkpoint_dir.glob("slice_*.markdown.txt"):
            stale.unlink(missing_ok=True)
    except OSError as exc:
        logger.warning("清理旧 checkpoint 失败 %s: %s", checkpoint_dir, exc)

    expected["status"] = "running"
    expected["started_at"] = time.time()
    try:
        manifest_path.write_text(
            json.dumps(expected, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("manifest 写入失败 %s: %s", manifest_path, exc)
    return expected


def _save_slice_checkpoint(
    checkpoint_dir: Path,
    index: int,
    page_start: int,
    page_end: int,
    result,
) -> None:
    """切片成功完成时落盘 checkpoint。

    分两文件：
        - ``slice_{i}.markdown.txt``：纯 markdown 文本（可能较大，单独存）。
        - ``slice_{i}.json``：元数据（计数、image_assets 文件名引用、状态等）。
    """
    import json

    md_path = checkpoint_dir / f"slice_{index}.markdown.txt"
    meta_path = checkpoint_dir / f"slice_{index}.json"
    try:
        md_path.write_text(getattr(result, "markdown", "") or "", encoding="utf-8")
    except OSError as exc:
        logger.warning("checkpoint markdown 写入失败 %s: %s", md_path, exc)
        return

    image_assets = [
        {
            "filename": a.filename,
            "mime_type": a.mime_type,
            "image_path": a.image_path,
            "resource_uri": a.resource_uri,
            "width": a.width,
            "height": a.height,
            "caption": a.caption,
            "page_number": a.page_number,
        }
        for a in (getattr(result, "image_assets", None) or [])
    ]
    payload = {
        "index": index,
        "page_start": page_start,
        "page_end": page_end,
        "status": "ok",
        "word_count": getattr(result, "word_count", 0),
        "images_count": getattr(result, "images_count", 0),
        "tables_count": getattr(result, "tables_count", 0),
        "formulas_count": getattr(result, "formulas_count", 0),
        "code_blocks_count": getattr(result, "code_blocks_count", 0),
        "engines_used": list(getattr(result, "engines_used", []) or []),
        "image_assets": image_assets,
        "metadata": getattr(result, "metadata", {}) or {},
        "saved_at": time.time(),
    }
    try:
        meta_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("checkpoint json 写入失败 %s: %s", meta_path, exc)


def _save_slice_failure(
    checkpoint_dir: Path,
    index: int,
    page_start: int,
    page_end: int,
    error: str,
) -> None:
    """切片二次重试仍失败时写入 failure 标记，便于 UI / 诊断。"""
    import json

    meta_path = checkpoint_dir / f"slice_{index}.json"
    payload = {
        "index": index,
        "page_start": page_start,
        "page_end": page_end,
        "status": "failed",
        "error": error,
        "saved_at": time.time(),
    }
    try:
        meta_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("failure checkpoint 写入失败 %s: %s", meta_path, exc)


def _load_slice_checkpoint(checkpoint_dir: Path, index: int):
    """读取已完成切片的 checkpoint，返回与 PipelineResult 同字段的轻量对象。

    Returns:
        命名空间对象（含 markdown / image_assets / word_count / ...），可被
        :func:`pipeline.batch_merge.merge_pipeline_results` 直接消费；
        未命中或 status != 'ok' 时返回 None。
    """
    import json
    from types import SimpleNamespace

    md_path = checkpoint_dir / f"slice_{index}.markdown.txt"
    meta_path = checkpoint_dir / f"slice_{index}.json"
    if not md_path.exists() or not meta_path.exists():
        return None
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        logger.warning("checkpoint json 读取失败 %s: %s", meta_path, exc)
        return None
    if meta.get("status") != "ok":
        return None
    try:
        markdown = md_path.read_text(encoding="utf-8")
    except OSError as exc:
        logger.warning("checkpoint markdown 读取失败 %s: %s", md_path, exc)
        return None

    from ..pipeline.models import ImageAsset

    image_assets = [
        ImageAsset(
            filename=item.get("filename", ""),
            mime_type=item.get("mime_type", "image/png"),
            image_path=item.get("image_path", ""),
            resource_uri=item.get("resource_uri"),
            width=item.get("width"),
            height=item.get("height"),
            caption=item.get("caption"),
            page_number=item.get("page_number"),
        )
        for item in meta.get("image_assets", [])
    ]

    return SimpleNamespace(
        success=True,
        markdown=markdown,
        word_count=meta.get("word_count", 0),
        images_count=meta.get("images_count", 0),
        tables_count=meta.get("tables_count", 0),
        formulas_count=meta.get("formulas_count", 0),
        code_blocks_count=meta.get("code_blocks_count", 0),
        engines_used=meta.get("engines_used", []),
        stage_results={},
        metadata=meta.get("metadata", {}),
        image_assets=image_assets,
        page_count=0,
        error=None,
    )


def _finalize_manifest(
    checkpoint_dir: Path,
    manifest: Dict[str, Any],
    partial_failures: List[Tuple[int, int, str]],
) -> None:
    """整批完成时更新 manifest 状态为 completed/partial，留作 UI / 诊断查阅。"""
    import json

    manifest_path = checkpoint_dir / "manifest.json"
    manifest["status"] = "partial" if partial_failures else "completed"
    manifest["finished_at"] = time.time()
    manifest["partial_failures"] = [
        {"start": s, "end": e, "error": err} for s, e, err in partial_failures
    ]
    try:
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("manifest 收尾写入失败 %s: %s", manifest_path, exc)
