"""``_is_decorative_raster_bbox`` 单元测试。

ISSUE-094 R9 D-1a 修订决策（2026-05-27）：保留 R8 既有「短边 ≤ 24pt」
最小必要过滤；**不**新增 cover header zone 激进规则——实机验证发现该规则
会误删 PDF 原版的机构 / 项目徽章（如 Context Engineering 2.0 PDF 封面顶部
的 ASI + SII-GAIR 双徽章），与「1:1 还原 PDF 所有内容（含高清原图、图片
显示尺寸）」的目标冲突。

本测试锁定：
- ① R8 既有规则：bbox 短边 ≤ 24pt 必须被识别（向后兼容）；
- ② 正文图片、cover header zone 内 PDF 原版机构徽章、长方形 banner 等
  **不可被误吞**（R9 D-1a 修订后的保护伞）。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.stages.pdf.image_extraction import (
    _is_decorative_raster_bbox,
)


class TestDecorativeRasterBboxFilter:
    """``_is_decorative_raster_bbox`` —— 装饰光栅图识别契约。"""

    # --- R8 既有规则：短边 ≤ 24pt --------------------------------------------

    def test_legacy_tiny_icon_short_side_below_24pt(self) -> None:
        """20×22 pt 装饰图（R8 实测的小图标）必须识别。"""
        assert _is_decorative_raster_bbox(bbox=(0, 0, 20, 22), page_idx=3) is True

    def test_legacy_thin_horizontal_bar_below_24pt(self) -> None:
        """200×10 pt 装饰横线（R8 既有规则覆盖）。"""
        assert _is_decorative_raster_bbox(bbox=(0, 0, 200, 10), page_idx=2) is True

    def test_legacy_elongated_strip(self) -> None:
        """120×15 pt 横向 strip（短边 15 ≤ 24 → R8 命中）。"""
        bbox = (100.0, 30.0, 220.0, 45.0)
        assert _is_decorative_raster_bbox(bbox=bbox, page_idx=0) is True

    # --- R9 修订决策：cover 徽章 / 机构 logo 必须保留（1:1 还原） -------------

    def test_keeps_cover_institutional_emblem_46x32(self) -> None:
        """46×32 pt cover 机构徽章（如 Context Engineering 2.0 PDF 的 ASI 徽章）保留。

        虽视觉为装饰，但是 PDF 原版视觉元素；R9 D-1a 修订决策不再过滤。
        """
        bbox = (100.0, 50.0, 146.0, 82.0)
        assert _is_decorative_raster_bbox(bbox=bbox, page_idx=0) is False

    def test_keeps_cover_logo_50x40(self) -> None:
        """50×40 pt cover 项目徽章（SII-GAIR 类）保留。"""
        bbox = (200.0, 80.0, 250.0, 120.0)
        assert _is_decorative_raster_bbox(bbox=bbox, page_idx=0) is False

    def test_keeps_cover_emblem_at_y0_zero(self) -> None:
        """y0=0 的极顶部 PDF 原版徽章保留（不可贪婪过滤）。"""
        bbox = (0.0, 0.0, 40.0, 40.0)
        assert _is_decorative_raster_bbox(bbox=bbox, page_idx=0) is False

    # --- 正文图片不可被误吞 --------------------------------------------------

    def test_keeps_figure_on_cover_below_header(self) -> None:
        """cover page y0=300pt 的中型 figure（如 abstract 后 Figure 1）保留。"""
        bbox = (50.0, 300.0, 540.0, 600.0)
        assert _is_decorative_raster_bbox(bbox=bbox, page_idx=0) is False

    def test_keeps_small_inline_image_on_body_page(self) -> None:
        """body page (page > 0) 上的小图（短边 > 24pt）保留。"""
        bbox = (100.0, 50.0, 146.0, 82.0)
        assert _is_decorative_raster_bbox(bbox=bbox, page_idx=5) is False

    def test_keeps_large_image_in_cover_top_zone(self) -> None:
        """cover page top zone 但尺寸较大的图（如 cover banner）保留。"""
        bbox = (50.0, 30.0, 540.0, 180.0)
        assert _is_decorative_raster_bbox(bbox=bbox, page_idx=0) is False

    def test_keeps_cover_figure_full_width(self) -> None:
        """cover page 上 A4 全宽图（如 Figure 1）保留。"""
        bbox = (50.0, 250.0, 545.0, 580.0)
        assert _is_decorative_raster_bbox(bbox=bbox, page_idx=0) is False

    # --- 异常 bbox -----------------------------------------------------------

    def test_zero_dimension_bbox_not_decorative(self) -> None:
        """退化 bbox（宽或高为 0）不判装饰，由上游清理。"""
        assert _is_decorative_raster_bbox(bbox=(0, 0, 0, 100), page_idx=0) is False
        assert _is_decorative_raster_bbox(bbox=(0, 0, 100, 0), page_idx=0) is False

    def test_negative_dimension_bbox_not_decorative(self) -> None:
        """异常 bbox（负宽高）不判装饰。"""
        assert _is_decorative_raster_bbox(bbox=(100, 100, 50, 50), page_idx=0) is False
