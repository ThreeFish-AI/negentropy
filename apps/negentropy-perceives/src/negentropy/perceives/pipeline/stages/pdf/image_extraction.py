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
from typing import Any, Dict, List, Optional, Set, Tuple

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
# 反向去重阈值：当一张光栅图 ≥ 该比例的面积被 figure region 包含时，
# 视为该光栅图是 figure region 的子组件（矢量绘图层 + 嵌入位图 + caption
# 等共同构成完整 Figure），改为渲染整个 figure region 并剔除该光栅图，
# 避免视图中"光栅位图 + 散落矢量标签"双轨损耗。0.8 阈值保留 20% 边距
# 余量以兼容 layout 与 raster bbox 的±几 pt 偏差。
_FIGURE_CONTAINS_RASTER_THRESHOLD = 0.8


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
# figure region bbox 视觉扩展（ISSUE-094 R8）
# ---------------------------------------------------------------------------


def _expand_figure_bbox(
    seed_bbox: Tuple[float, float, float, float],
    *,
    drawings: List[Dict[str, Any]],
    text_dict: Dict[str, Any],
    vertical_search_pt: float = 60.0,
    text_proximity_pt: float = 30.0,
    max_expand_factor: float = 4.0,
    min_drawing_h_overlap_ratio: float = 0.3,
    short_text_max_chars: int = 80,
    short_text_max_height_pt: float = 50.0,
) -> Tuple[float, float, float, float]:
    """以 seed_bbox 为种子，吸纳邻近矢量 drawings 与短文本标签，得到扩展 bbox。

    设计动机（ISSUE-094 R8）：
    Docling / MinerU 给出的 figure region bbox 通常仅覆盖嵌入光栅图本体，
    未包含 figure 的视觉上下文（列标题 / 子标签 / 轴说明 / 装饰线 / caption）。
    R7 修复了 pt → px 比例（96/72），但若种子 bbox 仅占正文栏 50%，最终
    markdown 的 <img width="..."> 仍远小于 PDF 视觉占用（Context Engineering
    2.0 Figure 1 为典型：种子 ~299pt vs 视觉 ~515pt）。本函数在不修改 layout
    工具契约的前提下后处理 bbox，从种子出发吸纳邻近矢量绘制与短文本块，
    得到与 PDF 原版视觉对齐的扩展 bbox。

    算法（基于 PDFFigures 2.0 [Clark & Divvala, JCDL'16] 的"光栅本体 + 矢量
    叠加 + caption 三层合并"思路）：

    1. **矢量吸纳**：搜索种子 ±vertical_search_pt 垂直范围内、与种子水平
       重叠 ≥ min_drawing_h_overlap_ratio 的矢量 drawings，与种子取 union；
    2. **文本吸纳**：搜索 step1 结果 ±text_proximity_pt 范围内、与之水平
       有重叠、且符合"短文本"特征（< short_text_max_chars 字符 或 块高 <
       short_text_max_height_pt 且宽高比 > 1.5）的文本块，再次取 union；
    3. **横向截断**：用 text_dict 中宽度 > 50pt 的文本块的 x0/x1 极值估算
       正文栏边界，扩展结果横向不超过该范围（防止吞入页眉页脚装饰）；
    4. **退化保护**：扩展面积 / 种子面积 > max_expand_factor 视为异常，
       回退到原种子。

    与 _render_figure_regions 集成时，drawings 与 text_dict 在页级缓存，
    同页多个 figure 复用，避免重复 IO（``page.get_drawings()`` 在长 PDF
    上每次调用 ~10ms）。

    Args:
        seed_bbox: 种子 bbox (x0, y0, x1, y1)，TopLeft 坐标，单位 pt。
        drawings: ``page.get_drawings()`` 返回的矢量绘制列表（每项含 ``rect``
            字段为 ``fitz.Rect`` 对象，需有 x0/y0/x1/y1 属性）。
        text_dict: ``page.get_text("dict")`` 返回的文本结构（含 ``blocks``
            列表，每个 block 有 ``type``、``bbox``、``lines.spans.text``）。
        vertical_search_pt: 矢量吸纳的垂直搜索半径（pt）。
        text_proximity_pt: 文本吸纳的垂直邻近半径（pt）。
        max_expand_factor: 退化保护阈值（扩展后面积上限相对种子的倍数）。
        min_drawing_h_overlap_ratio: 单个矢量被吸纳的最小水平重叠比例
            （以 drawing 自身宽度为分母），过滤"恰巧水平相邻但不属于 figure"
            的装饰矢量（如页眉横线）。
        short_text_max_chars: 短文本判定上限（字符数）。
        short_text_max_height_pt: 短文本判定的块高上限。

    Returns:
        扩展后的 bbox ``(x0, y0, x1, y1)``。若退化保护触发或扩展无效则返回
        ``seed_bbox`` 不变。
    """
    sx0, sy0, sx1, sy1 = (float(v) for v in seed_bbox)
    seed_w = sx1 - sx0
    seed_h = sy1 - sy0
    if seed_w <= 0 or seed_h <= 0:
        return seed_bbox
    seed_area = seed_w * seed_h

    # ── Step 1: 矢量吸纳 ────────────────────────────────────────────
    search_y_top = sy0 - vertical_search_pt
    search_y_bot = sy1 + vertical_search_pt
    ex0, ey0, ex1, ey1 = sx0, sy0, sx1, sy1
    for d in drawings or []:
        rect = d.get("rect") if isinstance(d, dict) else None
        if rect is None:
            continue
        try:
            dx0 = float(rect.x0)
            dy0 = float(rect.y0)
            dx1 = float(rect.x1)
            dy1 = float(rect.y1)
        except (AttributeError, TypeError, ValueError):
            continue
        if dx1 <= dx0 or dy1 <= dy0:
            continue
        # 垂直窗：drawing 必须与搜索窗有交集
        if dy1 < search_y_top or dy0 > search_y_bot:
            continue
        # 水平重叠（与种子）
        overlap_x0 = max(sx0, dx0)
        overlap_x1 = min(sx1, dx1)
        if overlap_x1 <= overlap_x0:
            continue
        h_overlap = overlap_x1 - overlap_x0
        drawing_w = dx1 - dx0
        # 以 drawing 自身宽度为分母的重叠比，过滤"擦边但不相关"的横向装饰线
        if h_overlap / max(drawing_w, 1e-6) < min_drawing_h_overlap_ratio:
            continue
        ex0 = min(ex0, dx0)
        ey0 = min(ey0, dy0)
        ex1 = max(ex1, dx1)
        ey1 = max(ey1, dy1)

    # ── Step 2: 文本吸纳（短文本标签 / caption / 列标题）─────────
    text_y_top = ey0 - text_proximity_pt
    text_y_bot = ey1 + text_proximity_pt
    blocks = text_dict.get("blocks", []) if isinstance(text_dict, dict) else []
    for block in blocks:
        # block["type"] == 0 是文本 block；图像块走 raster 路径，跳过
        if not isinstance(block, dict) or block.get("type", 0) != 0:
            continue
        bb = block.get("bbox")
        if not bb or len(bb) < 4:
            continue
        try:
            bx0, by0, bx1, by1 = (float(v) for v in bb[:4])
        except (TypeError, ValueError):
            continue
        if bx1 <= bx0 or by1 <= by0:
            continue
        # 垂直邻接窗
        if by1 < text_y_top or by0 > text_y_bot:
            continue
        # 必须与当前扩展区水平有重叠（否则是邻列文本）
        if bx1 <= ex0 or bx0 >= ex1:
            continue
        # 短文本判定：字符总数 < 阈值 或 扁平短文本（块高 < 阈值且宽高比 > 1.5）
        block_text_len = 0
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                block_text_len += len(span.get("text", ""))
        block_h = by1 - by0
        block_w = bx1 - bx0
        is_short_text = block_text_len < short_text_max_chars
        is_flat_short = block_h < short_text_max_height_pt and block_w > block_h * 1.5
        if not (is_short_text or is_flat_short):
            continue
        ex0 = min(ex0, bx0)
        ey0 = min(ey0, by0)
        ex1 = max(ex1, bx1)
        ey1 = max(ey1, by1)

    # ── Step 3: 横向截断到正文栏边界 ───────────────────────────────
    col_x0_candidates: List[float] = []
    col_x1_candidates: List[float] = []
    for block in blocks:
        if not isinstance(block, dict) or block.get("type", 0) != 0:
            continue
        bb = block.get("bbox")
        if not bb or len(bb) < 4:
            continue
        try:
            bx0, _, bx1, _ = (float(v) for v in bb[:4])
        except (TypeError, ValueError):
            continue
        # 仅用宽文本块（疑似正文行）估算正文栏边界
        if bx1 - bx0 < 50:
            continue
        col_x0_candidates.append(bx0)
        col_x1_candidates.append(bx1)
    if col_x0_candidates and col_x1_candidates:
        col_x0 = min(col_x0_candidates)
        col_x1 = max(col_x1_candidates)
        ex0 = max(ex0, col_x0)
        ex1 = min(ex1, col_x1)

    # 安全保护：bbox 反向时回退
    if ex1 <= ex0 or ey1 <= ey0:
        return seed_bbox

    # ── Step 4: 退化保护 ───────────────────────────────────────────
    expand_area = (ex1 - ex0) * (ey1 - ey0)
    if expand_area / max(seed_area, 1e-6) > max_expand_factor:
        return seed_bbox

    return (ex0, ey0, ex1, ey1)


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
) -> Tuple[List[ExtractedImage], Set[int]]:
    """将 layout_analysis 检测到的 figure 区域整体渲染为光栅图。

    与 PyMuPDF 仅抽出 figure 内部嵌入位图不同，本函数对 layout 给出的
    完整 figure region（含矢量绘图层标签 / 嵌入位图 / 注解等）一次性
    渲染为单张 PNG，保留 PDF 原版视觉信息（如 ISSUE-094 R7 中 Context
    Engineering 2.0 Figure 1 顶部 "Context 1.0..4.0" 标题行、底部
    "Context Input / Intelligence Level" 分类标签）。

    去重策略（反转 R6 之前的"figure 让位 raster"思路）：当一张光栅图
    ≥ ``_FIGURE_CONTAINS_RASTER_THRESHOLD`` (80%) 的面积被 figure region
    包含时，视为该 raster 是 figure 的子组件，**剔除 raster 并以 figure
    整图替代**。函数返回额外的 ``raster_indices_to_drop`` 索引集合供
    上层主流程剔除。

    Args:
        pdf_path: PDF 文件路径。
        figure_regions: layout_analysis 检测到的 figure 区域列表。
        raster_images: 已提取的光栅图列表（与 ``raster_indices_to_drop`` 一一对应）。
        start_page: 起始页码。
        end_page: 结束页码（exclusive）。
        output_dir: 图片输出目录。
        sem: 并发信号量。

    Returns:
        ``(rendered_images, raster_indices_to_drop)`` —— 渲染后的
        ``ExtractedImage`` 列表 + 应被 figure region 替代而剔除的
        ``raster_images`` 索引集合。
    """
    from ....pdf._imports import import_fitz

    fitz = import_fitz()

    # 按页索引光栅图（bbox + 原列表索引），加速去重判断
    raster_by_page: Dict[int, List[Tuple[int, Tuple[float, float, float, float]]]] = {}
    for idx, img in enumerate(raster_images):
        if img.bbox and img.page_number is not None:
            raster_by_page.setdefault(img.page_number, []).append((idx, img.bbox))

    # 按页分组 figure 区域
    regions_by_page: Dict[int, List[LayoutRegion]] = {}
    for region in figure_regions:
        if start_page <= region.page_number < end_page:
            regions_by_page.setdefault(region.page_number, []).append(region)

    if not regions_by_page:
        return [], set()

    async def _render_page_figures(
        page_idx: int,
        regions: List[LayoutRegion],
    ) -> Tuple[List[ExtractedImage], Set[int]]:
        async with sem:
            images: List[ExtractedImage] = []
            drop_indices: Set[int] = set()
            doc = fitz.open(pdf_path)
            try:
                page = doc[page_idx]
                # 页级缓存：drawings / text_dict 由同页所有 figure 共享，避免
                # 每个 region 重复扫描整页（PyMuPDF 实测每次 get_drawings 约 5-15ms）
                page_drawings: Optional[List[Dict[str, Any]]] = None
                page_text_dict: Optional[Dict[str, Any]] = None
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

                    # ── ISSUE-094 R8: figure bbox 视觉扩展 ────────────────
                    # Docling/MinerU 给出的 figure region bbox 通常仅覆盖嵌入
                    # 光栅图本体，未含 figure 完整视觉范围（列标题/子标签/
                    # 装饰线/caption）。R7 修复了 pt → px 比例换算，但若种子
                    # bbox 仅占正文栏 ~50%，markdown 中的 <img width> 仍远小于
                    # PDF 原版视觉占用。此处后处理 bbox：从种子出发吸纳邻近
                    # 矢量绘制与短文本块，使扩展后 bbox 与 PDF 视觉对齐
                    # （详见 _expand_figure_bbox 注释）。
                    if page_drawings is None:
                        try:
                            page_drawings = list(page.get_drawings())
                        except Exception as e:
                            logger.debug("get_drawings 失败 p%d: %s", page_idx, e)
                            page_drawings = []
                    if page_text_dict is None:
                        try:
                            page_text_dict = page.get_text("dict")
                        except Exception as e:
                            logger.debug("get_text(dict) 失败 p%d: %s", page_idx, e)
                            page_text_dict = {"blocks": []}

                    expanded_bbox = _expand_figure_bbox(
                        (x0, y0, x1, y1),
                        drawings=page_drawings,
                        text_dict=page_text_dict,
                    )
                    if expanded_bbox != (x0, y0, x1, y1):
                        new_w = expanded_bbox[2] - expanded_bbox[0]
                        new_h = expanded_bbox[3] - expanded_bbox[1]
                        # 显著扩展时记录（横向变宽 ≥ 5%）
                        if new_w > region_w * 1.05:
                            logger.info(
                                "figure bbox 扩展 p%d region %d: "
                                "%.1fx%.1f -> %.1fx%.1f pt",
                                page_idx,
                                region_idx,
                                region_w,
                                region_h,
                                new_w,
                                new_h,
                            )
                        x0, y0, x1, y1 = expanded_bbox
                    # ─────────────────────────────────────────────────────

                    # 反向去重：基于"扩展后"的 figure region 计算覆盖率（更
                    # 准确，因扩展后视觉范围可能新覆盖到此前未达 0.8 阈值的
                    # raster 子组件，例如 Context Engineering 2.0 Figure 1 的
                    # 4 张机器人嵌入图）
                    raster_entries = raster_by_page.get(page_idx, [])
                    contained_raster_idx: List[int] = []
                    for r_idx, rbox in raster_entries:
                        # 注意参数顺序：``_compute_overlap_ratio(A, B)`` 返回的是
                        # A 面积中被 B 覆盖的比例。这里要计算 raster 被 figure 包含
                        # 的比例，因此 A=raster_bbox，B=figure_region_bbox。
                        raster_in_figure = _compute_overlap_ratio(
                            rbox, (x0, y0, x1, y1)
                        )
                        if raster_in_figure >= _FIGURE_CONTAINS_RASTER_THRESHOLD:
                            contained_raster_idx.append(r_idx)

                    # 渲染裁剪区域（整个 layout figure region，含矢量标签）
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
                        # 仅在渲染成功后才剔除被包含的 raster，避免渲染失败
                        # 时同时丢失矢量标签与 raster 位图（双重信息损失）。
                        drop_indices.update(contained_raster_idx)
                        if contained_raster_idx:
                            logger.info(
                                "figure region 替代 %d 张 raster (page %d, region %d, %dx%d px)",
                                len(contained_raster_idx),
                                page_idx,
                                region_idx,
                                pix.width,
                                pix.height,
                            )
                        else:
                            logger.info(
                                "渲染独立 figure %s (page %d, %dx%d px)",
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
            return images, drop_indices

    # 并发渲染各页
    page_results = await asyncio.gather(
        *(_render_page_figures(p, regs) for p, regs in regions_by_page.items())
    )
    all_rendered: List[ExtractedImage] = []
    all_drop: Set[int] = set()
    for page_imgs, page_drop in page_results:
        all_rendered.extend(page_imgs)
        all_drop.update(page_drop)
    return all_rendered, all_drop


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
                            # 装饰性小图标二次过滤：PDF 点坐标维度 ≤ 24pt 的
                            # 光栅图通常是项目符号、章节图标、脚注上标等装饰元素。
                            # 上游 ``extract_images_from_pdf_page`` 已按渲染像素
                            # （< 50px）过滤，但当原图分辨率正好 ≥ 50px 而 PDF
                            # 显示尺寸 ≤ 24pt 时，会绕过该层防线（实测学术 PDF
                            # 中 20×22pt 的 SII 装饰图标即如此，``ExtractedImage.bbox``
                            # 维度算出 ``20.0×22.0`` pt）。阈值取 24pt 而非 20pt 是
                            # 为留出 ±2pt 的栅格化抖动余量，同时与矢量 figure 渲染
                            # 分支（< 20pt 严格剔除）形成梯度。
                            bw = bbox[2] - bbox[0]
                            bh = bbox[3] - bbox[1]
                            if bw > 0 and bh > 0 and (bw <= 24 or bh <= 24):
                                logger.debug(
                                    "跳过装饰光栅图 p%d %s: %.1fx%.1f pt",
                                    page_idx,
                                    extracted_img.id,
                                    bw,
                                    bh,
                                )
                                continue
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
            raster_drop_indices: Set[int] = set()
            if layout is not None and isinstance(layout, LayoutAnalysisOutput):
                figure_regions = [
                    r
                    for r in layout.regions
                    if r.region_type in ("figure", "picture")
                    and r.bbox != (0, 0, 0, 0)
                    and (r.bbox[2] - r.bbox[0]) > 0
                    and (r.bbox[3] - r.bbox[1]) > 0
                ]
                if figure_regions:
                    rendered_images, raster_drop_indices = await _render_figure_regions(
                        pdf_path=pdf_path,
                        figure_regions=figure_regions,
                        raster_images=raster_images,
                        start_page=start_page,
                        end_page=end_page,
                        output_dir=output_dir,
                        sem=sem,
                    )

            # ── Phase 3: 合并 + 排序 + 分配 reading_order ──────────
            # 剔除被 figure region 整体替代的 raster（避免双轨重复）
            if raster_drop_indices:
                raster_images = [
                    img
                    for idx, img in enumerate(raster_images)
                    if idx not in raster_drop_indices
                ]
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
