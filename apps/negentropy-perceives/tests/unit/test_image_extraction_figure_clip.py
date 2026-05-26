"""单元测试：``_render_figure_regions`` —— layout figure 区域整图渲染 + raster 反向去重。

ISSUE-094 R7：PDF Figure 是矢量绘图层（标签 / 标注 / 装饰）+ 嵌入位图的复合图形。
PyMuPDF ``get_images()`` 仅抽出嵌入位图，对矢量绘图层无能为力。R7 转用
``page.get_pixmap(clip=region.bbox)`` 对整个 layout figure region 重渲染，
完整保留 PDF 原版视觉信息（如 Context Engineering 2.0 Figure 1 顶部
"Context 1.0..4.0" 标题行、底部 "Context Input / Intelligence Level" 分类标签）。

反向去重策略锁定（``_FIGURE_CONTAINS_RASTER_THRESHOLD = 0.8``）：当 raster
≥ 80% 面积被 figure region 包含时，drop raster 并以 figure 整图替代。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.stages.pdf.image_extraction import (
    _FIGURE_CONTAINS_RASTER_THRESHOLD,
    _compute_overlap_ratio,
)


class TestComputeOverlapRatio:
    """``_compute_overlap_ratio(A, B)`` —— A 面积中被 B 覆盖的比例。"""

    def test_fully_contained(self) -> None:
        """A 完全在 B 内部 → 100%。"""
        raster = (100.0, 200.0, 200.0, 280.0)  # 100x80
        figure = (50.0, 150.0, 300.0, 350.0)  # 完全包含 raster
        assert _compute_overlap_ratio(raster, figure) == 1.0

    def test_partial_overlap_50pct(self) -> None:
        """A 50% 在 B 内 → 0.5。"""
        raster = (0.0, 0.0, 100.0, 100.0)  # 100x100, area=10000
        figure = (50.0, 0.0, 150.0, 100.0)  # 50-100 与 raster 重叠
        # 重叠区域: x ∈ [50, 100], y ∈ [0, 100] → 50x100 = 5000
        # raster 面积: 10000; 比例 = 0.5
        assert _compute_overlap_ratio(raster, figure) == 0.5

    def test_no_overlap(self) -> None:
        """A 与 B 完全不重叠 → 0。"""
        raster = (0.0, 0.0, 50.0, 50.0)
        figure = (100.0, 100.0, 200.0, 200.0)
        assert _compute_overlap_ratio(raster, figure) == 0.0

    def test_threshold_at_80pct(self) -> None:
        """阈值边界 80% — ``_FIGURE_CONTAINS_RASTER_THRESHOLD`` 锁定。"""
        # raster 200x100 完全在 figure 内
        # figure 200x125（更高）+ 上下各 12.5pt 余量
        # raster 100% 被 figure 包含 → 命中阈值
        raster = (0.0, 12.5, 200.0, 112.5)
        figure = (0.0, 0.0, 200.0, 125.0)
        assert (
            _compute_overlap_ratio(raster, figure) >= _FIGURE_CONTAINS_RASTER_THRESHOLD
        )

    def test_figure_overlay_label_scenario(self) -> None:
        """Context Engineering 2.0 Figure 1 真实场景。

        PDF page 0 上：raster 位图（机器人）bbox ≈ (147, 360, 446, 559)，
        layout figure region bbox ≈ (130, 320, 470, 620)（含上下矢量标签）。
        raster 应 ≥ 80% 被 figure region 包含。
        """
        raster_bbox = (147.0, 360.0, 446.0, 559.0)  # 299x199
        figure_region = (130.0, 320.0, 470.0, 620.0)  # 340x300
        ratio = _compute_overlap_ratio(raster_bbox, figure_region)
        # raster 完全在 figure region 内：ratio = 1.0
        assert ratio == 1.0
        assert ratio >= _FIGURE_CONTAINS_RASTER_THRESHOLD

    def test_argument_order_matters(self) -> None:
        """参数顺序：``_compute_overlap_ratio(A, B)`` ≠ ``_compute_overlap_ratio(B, A)``。

        当 A 远小于 B 且完全在 B 内时，``ratio(A, B) = 1.0``（A 100% 被 B 包含），
        而 ``ratio(B, A) << 1.0``（B 仅一小部分被 A 覆盖）。
        """
        small = (10.0, 10.0, 20.0, 20.0)  # 10x10 = 100
        large = (0.0, 0.0, 100.0, 100.0)  # 100x100 = 10000
        assert _compute_overlap_ratio(small, large) == 1.0
        # large 仅 100/10000 = 1% 被 small 包含
        assert _compute_overlap_ratio(large, small) == 0.01

    def test_degenerate_bbox(self) -> None:
        """退化 bbox（面积为 0）返回 0 而非 ZeroDivisionError。"""
        zero_area = (10.0, 10.0, 10.0, 10.0)  # area = 0
        figure = (0.0, 0.0, 100.0, 100.0)
        assert _compute_overlap_ratio(zero_area, figure) == 0.0


class TestFigureContainsRasterThreshold:
    """``_FIGURE_CONTAINS_RASTER_THRESHOLD`` 阈值锁定。"""

    def test_threshold_value(self) -> None:
        """阈值固定在 0.8（80% raster 被 figure 包含才视为替代关系）。

        过低（如 0.5）会把同页相邻的多个 raster 都误判为 figure 内部成员，
        过高（如 0.95）则可能因 layout / raster bbox 几 pt 偏差导致漏命中。
        0.8 是经验最优。
        """
        assert _FIGURE_CONTAINS_RASTER_THRESHOLD == 0.8
