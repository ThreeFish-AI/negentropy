"""S6: 图片提取 Stage。

图片提取、分类与 caption 生成。支持光栅图和矢量图形两种提取路径：

1. **光栅提取**：PyMuPDF ``get_images()`` 提取内嵌光栅图（JPEG/PNG）
2. **矢量渲染**：利用 layout_analysis 识别的 figure 区域 bbox，
   通过 ``page.get_pixmap(clip=rect)`` 渲染矢量图形为光栅图

委托关系：
- ``pdf.enhanced.EnhancedPDFProcessor.extract_images_from_pdf_page()`` — PyMuPDF 光栅提取
- ``_render_figure_regions()`` — 矢量图形 bbox 渲染（本模块新增）

并发策略：PyMuPDF 的 ``fitz.Document`` 对象并非线程安全，跨 worker 共享会
触发 SIGSEGV 或数据损坏（参见 PyMuPDF FAQ "Is PyMuPDF thread-safe?"）。
因此每页独立调用 ``fitz.open()``（官方实测 <10ms 的轻量操作），再通过
``asyncio.gather + Semaphore`` 限制并发度，既规避线程安全问题，又避免
长 PDF 同时打开过多文件句柄。
"""

from __future__ import annotations

import asyncio
import base64
import logging
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ...base import Stage, StageResult
from ...models import (
    ExtractedImage,
    ImageExtractionInput,
    ImageExtractionOutput,
    LayoutAnalysisOutput,
    LayoutRegion,
    PreprocessingOutput,
)
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)

# 默认页级并发上限（与 Pool 的 docling/mineru 竞争线一致），保留为模块级常量
# 兼容历史导入；运行时由 ``_resolve_concurrency()`` 从 settings 读取覆盖值。
_IMAGE_EXTRACT_CONCURRENCY = 4

# 矢量图渲染参数
_RENDER_DPI = 150
_RENDER_ZOOM = _RENDER_DPI / 72.0
# 空间重叠去重阈值：渲染区域与已有光栅图重叠面积占比超过此值时跳过
_OVERLAP_THRESHOLD = 0.5


def _resolve_concurrency() -> int:
    """从配置读取页级并发上限，失败回退到 ``_IMAGE_EXTRACT_CONCURRENCY``。

    M 系列大内存机型可上调以减少 18 张图 91s 的单线性瓶颈；
    旧机型或 GPU 紧张场景可下调到 4 维持原行为。
    """
    try:
        from ....config import settings as _settings

        val = int(_settings.pdf_image_extraction_concurrency)
        return max(1, val)
    except Exception:  # noqa: BLE001 - 配置未就绪时不阻塞抽图
        return _IMAGE_EXTRACT_CONCURRENCY


# ---------------------------------------------------------------------------
# 空间重叠计算
# ---------------------------------------------------------------------------


def _compute_overlap_ratio(
    bbox_a: Tuple[float, float, float, float],
    bbox_b: Tuple[float, float, float, float],
) -> float:
    """计算 bbox_a 被 bbox_b 覆盖的面积比例。

    Returns:
        0.0 ~ 1.0，表示 bbox_a 面积中被 bbox_b 覆盖的比例。
    """
    ax0, ay0, ax1, ay1 = bbox_a
    bx0, by0, bx1, by1 = bbox_b
    overlap_x0 = max(ax0, bx0)
    overlap_y0 = max(ay0, by0)
    overlap_x1 = min(ax1, bx1)
    overlap_y1 = min(ay1, by1)
    if overlap_x1 <= overlap_x0 or overlap_y1 <= overlap_y0:
        return 0.0
    overlap_area = (overlap_x1 - overlap_x0) * (overlap_y1 - overlap_y0)
    area_a = (ax1 - ax0) * (ay1 - ay0)
    if area_a <= 0:
        return 0.0
    return overlap_area / area_a


# ---------------------------------------------------------------------------
# 矢量图形区域渲染
# ---------------------------------------------------------------------------


async def _render_figure_regions(
    pdf_path: str,
    figure_regions: List[LayoutRegion],
    raster_images: List[ExtractedImage],
    start_page: int,
    end_page: int,
    output_dir: Path,
    sem: asyncio.Semaphore,
) -> List[ExtractedImage]:
    """将 layout_analysis 检测到的矢量 figure 区域渲染为光栅图。

    仅渲染与已有光栅图无显著空间重叠的区域（去重）。

    Args:
        pdf_path: PDF 文件路径。
        figure_regions: layout_analysis 检测到的 figure 区域列表。
        raster_images: 已提取的光栅图列表（用于去重）。
        start_page: 起始页码。
        end_page: 结束页码（exclusive）。
        output_dir: 图片输出目录。
        sem: 并发信号量。

    Returns:
        渲染后的 ``ExtractedImage`` 列表。
    """
    from ....pdf._imports import import_fitz

    fitz = import_fitz()

    # 按页索引光栅图 bbox，加速去重判断
    raster_by_page: Dict[int, List[Tuple[float, float, float, float]]] = {}
    for img in raster_images:
        if img.bbox and img.page_number is not None:
            raster_by_page.setdefault(img.page_number, []).append(img.bbox)

    # 按页分组 figure 区域
    regions_by_page: Dict[int, List[LayoutRegion]] = {}
    for region in figure_regions:
        if start_page <= region.page_number < end_page:
            regions_by_page.setdefault(region.page_number, []).append(region)

    if not regions_by_page:
        return []

    async def _render_page_figures(
        page_idx: int,
        regions: List[LayoutRegion],
    ) -> List[ExtractedImage]:
        async with sem:
            images: List[ExtractedImage] = []
            doc = fitz.open(pdf_path)
            try:
                page = doc[page_idx]
                for region_idx, region in enumerate(regions):
                    bbox = region.bbox
                    # 跳过退化 bbox
                    if bbox == (0, 0, 0, 0):
                        continue
                    x0, y0, x1, y1 = bbox
                    if x1 <= x0 or y1 <= y0:
                        continue

                    # 过滤装饰性小图标：PDF 坐标下宽或高 < 20pt 的区域通常是
                    # 项目符号、装饰线条、小型 icon 等，不是有意义的 figure
                    region_w = x1 - x0
                    region_h = y1 - y0
                    if region_w < 20 or region_h < 20:
                        logger.debug(
                            "跳过小区域 figure p%d region %d: %.1fx%.1f pt",
                            page_idx,
                            region_idx,
                            region_w,
                            region_h,
                        )
                        continue

                    # 去重：检查与同页光栅图的空间重叠
                    raster_bboxes = raster_by_page.get(page_idx, [])
                    skip = False
                    for rbox in raster_bboxes:
                        overlap = _compute_overlap_ratio((x0, y0, x1, y1), rbox)
                        if overlap > _OVERLAP_THRESHOLD:
                            skip = True
                            logger.debug(
                                "跳过渲染 figure p%d region %d: 与光栅图重叠 %.0f%%",
                                page_idx,
                                region_idx,
                                overlap * 100,
                            )
                            break
                    if skip:
                        continue

                    # 渲染裁剪区域
                    try:
                        rect = fitz.Rect(x0, y0, x1, y1)
                        mat = fitz.Matrix(_RENDER_ZOOM, _RENDER_ZOOM)
                        pix = page.get_pixmap(matrix=mat, clip=rect)

                        # CMYK → RGB
                        if pix.n - pix.alpha >= 4:
                            pix = fitz.Pixmap(fitz.csRGB, pix)

                        img_id = f"rendered_{page_idx}_{region_idx}"
                        filename = f"fig_p{page_idx + 1}_{region_idx + 1}.png"
                        local_path = output_dir / filename

                        # 处理文件名冲突
                        counter = 1
                        while local_path.exists():
                            filename = (
                                f"fig_p{page_idx + 1}_{region_idx + 1}_{counter}.png"
                            )
                            local_path = output_dir / filename
                            counter += 1

                        pix.save(str(local_path))
                        b64_data = base64.b64encode(pix.tobytes("png")).decode("ascii")

                        caption = (
                            region.metadata.get("caption") if region.metadata else None
                        )

                        images.append(
                            ExtractedImage(
                                image_id=img_id,
                                filename=filename,
                                local_path=str(local_path),
                                base64_data=b64_data,
                                mime_type="image/png",
                                width=pix.width,
                                height=pix.height,
                                page_number=page_idx,
                                bbox=(x0, y0, x1, y1),
                                caption=caption if caption else None,
                                reading_order=0,  # 由调用方统一分配
                            )
                        )
                        logger.info(
                            "渲染矢量 figure %s (page %d, %dx%d px)",
                            img_id,
                            page_idx,
                            pix.width,
                            pix.height,
                        )
                        pix = None
                    except Exception as e:
                        logger.warning(
                            "渲染 figure 区域失败 (page %d, region %d): %s",
                            page_idx,
                            region_idx,
                            e,
                        )
            finally:
                doc.close()
            return images

    # 并发渲染各页
    page_results = await asyncio.gather(
        *(_render_page_figures(p, regs) for p, regs in regions_by_page.items())
    )
    return [img for page_imgs in page_results for img in page_imgs]


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("image_extraction.pymupdf")
class FitzImageExtractor(PDFToolBase):
    """基于 PyMuPDF 的图片提取工具。

    三阶段提取策略：
    1. 光栅提取（``get_images()``）：提取 PDF 内嵌光栅图
    2. 矢量渲染（``get_pixmap(clip=rect)``）：渲染 layout_analysis
       检测到的矢量 figure 区域
    3. 合并去重 + 排序
    """

    tool_name = "pymupdf"

    def is_available(self) -> bool:
        try:
            from ....pdf._imports import import_fitz

            import_fitz()
            return True
        except ImportError:
            return False

    async def _run(self, input_data: Any) -> StageResult[ImageExtractionOutput]:
        """三阶段图片提取：光栅 + 矢量渲染 + 合并。"""
        try:
            from ....pdf._imports import import_fitz
            from ....pdf.enhanced import EnhancedPDFProcessor

            fitz = import_fitz()

            # 兼容两种输入类型：
            # - ImageExtractionInput（新版 layout-aware 路径）
            # - PreprocessingOutput（旧版降级路径，layout_analysis 失败时）
            preprocessing: PreprocessingOutput
            layout: Optional[LayoutAnalysisOutput] = None

            if isinstance(input_data, ImageExtractionInput):
                preprocessing = input_data.preprocessing
                layout = input_data.layout
            elif isinstance(input_data, PreprocessingOutput):
                preprocessing = input_data
            else:
                return StageResult(
                    success=False,
                    error=f"不支持的输入类型: {type(input_data).__name__}",
                )

            pdf_path = str(preprocessing.local_path)

            # 先用一次性 Document 读取页数，随后立即关闭；实际抽取走分页
            # 并发路径，每页独立 open/close（PyMuPDF 线程不安全，详见文件
            # 头部注释）。
            with fitz.open(pdf_path) as probe_doc:
                total_pages = probe_doc.page_count

            start_page = 0
            end_page = total_pages
            if preprocessing.page_range:
                start_page = max(0, preprocessing.page_range[0])
                end_page = min(total_pages, preprocessing.page_range[1])

            concurrency = _resolve_concurrency()
            sem = asyncio.Semaphore(concurrency)

            # 确定图片输出目录
            output_dir = Path(tempfile.mkdtemp(prefix="pdf_images_"))

            # ── Phase 1: 光栅图提取（原有逻辑）─────────────────────────
            async def _extract_raster_page(
                page_idx: int,
            ) -> List[ExtractedImage]:
                """在独立 Document 上提取单页光栅图；受 Semaphore 限流。"""
                async with sem:
                    processor = EnhancedPDFProcessor()
                    doc = fitz.open(pdf_path)
                    try:
                        page_images = await processor.extract_images_from_pdf_page(
                            doc, page_idx
                        )
                    finally:
                        doc.close()
                    results: List[ExtractedImage] = []
                    for extracted_img in page_images:
                        bbox = None
                        if extracted_img.position:
                            pos = extracted_img.position
                            bbox = (
                                pos.get("x0", 0),
                                pos.get("y0", 0),
                                pos.get("x1", 0),
                                pos.get("y1", 0),
                            )
                        results.append(
                            ExtractedImage(
                                image_id=extracted_img.id,
                                filename=extracted_img.filename,
                                local_path=extracted_img.local_path,
                                base64_data=extracted_img.base64_data,
                                mime_type=extracted_img.mime_type,
                                width=extracted_img.width,
                                height=extracted_img.height,
                                page_number=page_idx,
                                bbox=bbox,
                                caption=extracted_img.caption,
                            )
                        )
                    # 按 bbox y0 排序
                    results.sort(key=lambda img: img.bbox[1] if img.bbox else 0)
                    return results

            if end_page <= start_page:
                raster_images: List[ExtractedImage] = []
            else:
                pages_results = await asyncio.gather(
                    *(_extract_raster_page(p) for p in range(start_page, end_page))
                )
                raster_images = [
                    img for page_images in pages_results for img in page_images
                ]

            # ── Phase 2: 矢量图形渲染（新增）─────────────────────────
            rendered_images: List[ExtractedImage] = []
            if layout is not None and isinstance(layout, LayoutAnalysisOutput):
                figure_regions = [
                    r
                    for r in layout.regions
                    if r.region_type == "figure"
                    and r.bbox != (0, 0, 0, 0)
                    and (r.bbox[2] - r.bbox[0]) > 0
                    and (r.bbox[3] - r.bbox[1]) > 0
                ]
                if figure_regions:
                    rendered_images = await _render_figure_regions(
                        pdf_path=pdf_path,
                        figure_regions=figure_regions,
                        raster_images=raster_images,
                        start_page=start_page,
                        end_page=end_page,
                        output_dir=output_dir,
                        sem=sem,
                    )

            # ── Phase 3: 合并 + 排序 + 分配 reading_order ──────────
            all_images = raster_images + rendered_images
            all_images.sort(
                key=lambda img: (img.page_number or 0, img.bbox[1] if img.bbox else 0)
            )
            for order, img in enumerate(all_images):
                img.reading_order = order

            output = ImageExtractionOutput(
                images=all_images,
                total_count=len(all_images),
                metadata={
                    "engine": "pymupdf",
                    "concurrency": concurrency,
                    "page_count": max(0, end_page - start_page),
                    "raster_count": len(raster_images),
                    "rendered_count": len(rendered_images),
                    "_temp_output_dir": str(output_dir),
                },
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("PyMuPDF 图片提取失败: %s", e)
            return StageResult(success=False, error=f"PyMuPDF 图片提取失败: {e}")


@register_tool("image_extraction.opendataloader")
class OpenDataLoaderImageExtractor(PDFToolBase):
    """基于 OpenDataLoader 的图片提取工具（Apache-2.0 / CPU-only / 全元素 bbox）。"""

    tool_name = "opendataloader"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.opendataloader import OpenDataLoaderEngine

            return OpenDataLoaderEngine.is_available()
        except ImportError:
            return False

    async def _run(self, input_data: Any) -> StageResult[ImageExtractionOutput]:
        """使用 OpenDataLoader 提取图片信息。

        OpenDataLoader 的 ``EngineConversionResult.images`` 包含页码、bbox 与
        外部图片路径，但不提取 base64 数据和宽高信息。
        """
        try:
            from ....core.cancellation import current_cancel_scope
            from ....infra import get_engine_pool

            # 兼容两种输入类型（与 FitzImageExtractor 一致）
            preprocessing: PreprocessingOutput
            if isinstance(input_data, ImageExtractionInput):
                preprocessing = input_data.preprocessing
            elif isinstance(input_data, PreprocessingOutput):
                preprocessing = input_data
            else:
                return StageResult(
                    success=False,
                    error=f"不支持的输入类型: {type(input_data).__name__}",
                )

            _scope = current_cancel_scope()
            result = await get_engine_pool().run(
                "opendataloader",
                kwargs={"pdf_path": str(preprocessing.local_path)},
                init_kwargs={},
                deadline_monotonic=_scope.deadline_monotonic if _scope else None,
            )
            if result is None:
                return StageResult(success=False, error="OpenDataLoader 转换返回空结果")

            images: List[ExtractedImage] = []
            for idx, img in enumerate(result.images):
                images.append(
                    ExtractedImage(
                        image_id=f"odl_img_{idx}",
                        filename=img.filename or f"odl_img_{idx}.png",
                        local_path=img.local_path,
                        page_number=img.page_number
                        if img.page_number is not None
                        else 0,
                        bbox=img.bbox,
                        caption=img.caption,
                        reading_order=idx,
                    )
                )

            output = ImageExtractionOutput(
                images=images,
                total_count=len(images),
                metadata={
                    "engine": "opendataloader",
                    "page_count": result.page_count,
                },
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("OpenDataLoader 图片提取失败: %s", e)
            return StageResult(success=False, error=f"OpenDataLoader 图片提取失败: {e}")


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "pymupdf": FitzImageExtractor,
    "opendataloader": OpenDataLoaderImageExtractor,
}


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class ImageExtractionStage(Stage[ImageExtractionInput, ImageExtractionOutput]):
    """S6: 图片提取 Stage。"""

    STAGE_ID = "image_extraction"
    STAGE_NAME = "图片提取"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(self, input_data: Any) -> StageResult[ImageExtractionOutput]:
        """执行图片提取。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                return await tool.execute(input_data)
        return StageResult(
            success=False, error="无可用的图片提取工具（pymupdf 未安装）"
        )
