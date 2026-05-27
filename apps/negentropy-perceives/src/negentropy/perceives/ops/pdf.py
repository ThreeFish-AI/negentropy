"""Core operations: PDF 解析为 Markdown。"""

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
DEFAULT_BATCH_PAGE_SIZE = 40
"""单切片最大页数。R8 基线 71 页全本 180-300s；40 页 ≈ 100-200s 单切片为甜蜜区。"""

DEFAULT_BATCH_THRESHOLD_PAGES = 60
"""超过该页数才启用分批；小于等于此值走原单次路径（既有 1604 单测零退化）。"""


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
                    )
                    if batched_response is not None:
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

        # 执行切片（带 1 次重试）
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

        if slice_result is None:
            err = f"slice [{page_start}, {page_end}) failed after retry"
            partial_failures.append((page_start, page_end, err))
            _save_slice_failure(checkpoint_dir, i, page_start, page_end, err)
            continue

        completed[i] = slice_result
        _save_slice_checkpoint(checkpoint_dir, i, page_start, page_end, slice_result)

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


# ---------------------------------------------------------------------------
# Checkpoint 管理（基于文件系统）
# ---------------------------------------------------------------------------


def _resolve_batch_state_dir(output_dir: Optional[str], pdf_source: str) -> Path:
    """解析 checkpoint 目录：``<output_dir>/.batch_state/`` 或 cwd 兜底。

    与 :func:`pipeline.convenience._resolve_images_dir` 同语义，避免多源头同名
    污染。
    """
    if output_dir:
        base = Path(output_dir)
    else:
        stem = Path(pdf_source).stem if pdf_source else "document"
        base = Path.cwd() / "output" / stem
    state = base / ".batch_state"
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
            same = (
                data.get("pdf_source") == expected["pdf_source"]
                and data.get("total_pages") == expected["total_pages"]
                and data.get("batch_size") == expected["batch_size"]
            )
            if same:
                logger.info("auto_batch resume manifest 命中 dir=%s", checkpoint_dir)
                return data
            logger.info("auto_batch manifest 配置不匹配，清理旧 checkpoint")
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
