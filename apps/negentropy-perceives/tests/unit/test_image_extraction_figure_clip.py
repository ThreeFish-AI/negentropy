"""单元测试：``_render_figure_regions`` —— layout figure 区域整图渲染 + raster 反向去重。

ISSUE-094 R7：PDF Figure 是矢量绘图层（标签 / 标注 / 装饰）+ 嵌入位图的复合图形。
PyMuPDF ``get_images()`` 仅抽出嵌入位图，对矢量绘图层无能为力。R7 转用
``page.get_pixmap(clip=region.bbox)`` 对整个 layout figure region 重渲染，
完整保留 PDF 原版视觉信息（如 Context Engineering 2.0 Figure 1 顶部
"Context 1.0..4.0" 标题行、底部 "Context Input / Intelligence Level" 分类标签）。

反向去重策略锁定（``_FIGURE_CONTAINS_RASTER_THRESHOLD = 0.8``）：当 raster
≥ 80% 面积被 figure region 包含时，drop raster 并以 figure 整图替代。

ISSUE-094 R8：layout 工具返回的 figure region bbox 仅覆盖嵌入光栅图本体
（如 Context Engineering 2.0 Figure 1 ~299pt），未含完整视觉范围（列标题
+ 子标签 + 装饰线 + caption ~515pt）。新增 ``_expand_figure_bbox`` 后处理
扩展 bbox 至视觉对齐范围，使 markdown 的 ``<img width>`` 与 PDF 原版占比一致。
"""

from __future__ import annotations

from typing import Any, Dict, List

from negentropy.perceives.pipeline.stages.pdf.image_extraction import (
    _FIGURE_CONTAINS_RASTER_THRESHOLD,
    _compute_overlap_ratio,
    _expand_figure_bbox,
)


class _FakeRect:
    """模拟 ``fitz.Rect``，仅暴露 ``x0/y0/x1/y1`` 属性，供 ``_expand_figure_bbox``
    访问。避免在单测引入 PyMuPDF 重量级依赖。"""

    def __init__(self, x0: float, y0: float, x1: float, y1: float) -> None:
        self.x0 = float(x0)
        self.y0 = float(y0)
        self.x1 = float(x1)
        self.y1 = float(y1)


def _drawing(x0: float, y0: float, x1: float, y1: float) -> Dict[str, Any]:
    """构造一个 ``page.get_drawings()`` 风格的 dict（含 ``rect`` 字段）。"""
    return {"rect": _FakeRect(x0, y0, x1, y1)}


def _text_block(
    x0: float, y0: float, x1: float, y1: float, text: str
) -> Dict[str, Any]:
    """构造一个 ``page.get_text("dict")`` 风格的文本 block。"""
    return {
        "type": 0,
        "bbox": (x0, y0, x1, y1),
        "lines": [{"spans": [{"text": text}]}],
    }


def _wide_paragraph(x0: float, y0: float, x1: float, y1: float) -> Dict[str, Any]:
    """构造一个宽正文段落 block（宽度 > 50pt 才会进入正文栏估算）。"""
    return _text_block(x0, y0, x1, y1, "x" * 200)


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


class TestExpandFigureBbox:
    """``_expand_figure_bbox`` —— ISSUE-094 R8 figure bbox 视觉扩展。

    场景：Docling/MinerU 给出的 figure region bbox 仅覆盖嵌入光栅图本体，
    未含 figure 完整视觉范围（列标题/子标签/装饰线/caption）。此函数后处理
    bbox：从种子出发吸纳邻近矢量绘制与短文本块，得到与 PDF 视觉对齐的 bbox。
    """

    # 共享的正文栏估算：构造若干宽段落 block（> 50pt），让函数能识别正文栏
    # x0=72, x1=523 边界（A4 PDF 典型边距）。
    _COL_X0 = 72.0
    _COL_X1 = 523.0

    def _column_paragraphs(self) -> List[Dict[str, Any]]:
        """生成正文段落（用于横向截断 step3）。"""
        return [
            _wide_paragraph(self._COL_X0, 50.0, self._COL_X1, 80.0),
            _wide_paragraph(self._COL_X0, 90.0, self._COL_X1, 120.0),
            _wide_paragraph(self._COL_X0, 750.0, self._COL_X1, 780.0),
        ]

    # ──────────────────────────────────────────────────────────────
    # T1：矢量吸纳 —— 种子 bbox + 上下各一条装饰矢量，扩展后高度增长
    # ──────────────────────────────────────────────────────────────
    def test_t1_vector_drawings_absorbed_vertically(self) -> None:
        """种子上方 30pt / 下方 30pt 处各有一条与种子水平重叠的装饰矢量，
        扩展后 bbox 高度应显著大于种子（≥ 250pt，对比种子 199pt）。"""
        # 种子：298.7 × 199.2pt（Context Engineering 2.0 Figure 1 真实嵌入光栅图）
        seed = (180.4, 482.4, 479.2, 681.6)
        drawings = [
            # 上方装饰：与种子水平有完整重叠，垂直距种子 30pt
            _drawing(180.4, 452.4, 479.2, 472.4),
            # 下方装饰：同上，下方 30pt
            _drawing(180.4, 691.6, 479.2, 711.6),
            # 噪声：远离种子（垂直距 > 60pt 搜索窗），应被忽略
            _drawing(50.0, 30.0, 550.0, 45.0),
        ]
        text_dict = {"blocks": self._column_paragraphs()}
        result = _expand_figure_bbox(seed, drawings=drawings, text_dict=text_dict)
        ex0, ey0, ex1, ey1 = result
        # 高度从 ~199 扩展到 ~260（吸纳上下两条 20pt 高的装饰）
        assert ey1 - ey0 >= 250.0, f"扩展后高度仅 {ey1 - ey0:.1f}pt < 250pt"
        # 横向保持种子范围（drawings 与种子横向完全对齐，无扩展）
        assert ex0 == seed[0]
        assert ex1 == seed[2]

    # ──────────────────────────────────────────────────────────────
    # T2：短文本吸纳 + 横向截断到正文栏
    # ──────────────────────────────────────────────────────────────
    def test_t2_short_text_labels_absorbed_and_horizontal_clipped(self) -> None:
        """Context Engineering 2.0 Figure 1 还原场景：
        种子 bbox 仅覆盖中央 4 张机器人光栅图（180-479 pt 横向），但 PDF
        实际视觉范围含：
          - 顶部"More Intelligence..."副标题（横跨正文栏 72-523）
          - 4 列"Context X.0"列标题（中央偏宽）
          - 底部"Context as Translation/Instruction/Scenario/World"分类标签
          - "Human-AI Interaction Cost"箭头注释
        扩展后 bbox 横向应延伸到正文栏（72-523 范围），高度也应增加。"""
        seed = (180.4, 482.4, 479.2, 681.6)  # 中央光栅图本体
        drawings = [
            # 顶部副标题下方的横向装饰线（横跨正文栏，垂直距种子 22pt）
            _drawing(80.0, 460.0, 520.0, 462.0),
            # 底部箭头线（横跨正文栏，垂直距种子 18pt）
            _drawing(80.0, 700.0, 520.0, 702.0),
        ]
        text_dict = {
            "blocks": [
                *self._column_paragraphs(),
                # 顶部副标题（短文本，距种子上方 20pt 内）
                _text_block(
                    100.0,
                    465.0,
                    500.0,
                    478.0,
                    "More Intelligence. More Context-Processing Ability.",
                ),
                # 底部短标签（短文本，距种子下方 10pt 内）
                _text_block(70.0, 686.0, 530.0, 710.0, "Context as Translation"),
                # caption 段落（紧贴底部，长度 ~160 字符也属于短句范畴）
                _text_block(
                    72.0,
                    715.0,
                    523.0,
                    735.0,
                    "Figure 1: The Overview of context engineering",
                ),
            ]
        }
        result = _expand_figure_bbox(seed, drawings=drawings, text_dict=text_dict)
        ex0, ey0, ex1, ey1 = result
        # 横向应扩展到正文栏边界（容许 ±2pt 取整误差）
        assert ex0 <= 80.0, f"扩展后 x0={ex0:.1f}, 应 ≤ 80"
        assert ex1 >= 515.0, f"扩展后 x1={ex1:.1f}, 应 ≥ 515"
        # 扩展后宽度应接近正文栏全宽（≥ 440pt，对比种子 ~299pt）
        assert ex1 - ex0 >= 440.0, f"扩展后宽度仅 {ex1 - ex0:.1f}pt < 440pt"
        # 垂直方向也应扩展（吸纳上下文本与装饰）
        assert ey0 <= 466.0, f"扩展后 y0={ey0:.1f}, 应吸纳顶部副标题 ≤ 466"
        assert ey1 >= 700.0, f"扩展后 y1={ey1:.1f}, 应吸纳底部装饰 ≥ 700"

    # ──────────────────────────────────────────────────────────────
    # T3：退化保护 —— 异常 drawings 铺满整页，回退到种子
    # ──────────────────────────────────────────────────────────────
    def test_t3_degenerate_protection_falls_back_to_seed(self) -> None:
        """异常场景：drawings 中存在一个巨大矢量（覆盖整页），若简单吸纳
        会使扩展面积 > 种子 4 倍。退化保护应触发，回退到 seed_bbox。"""
        seed = (200.0, 400.0, 250.0, 450.0)  # 小种子 50x50
        drawings = [
            # 巨型矢量：覆盖整页（A4 595x842），与种子有水平重叠，
            # 但垂直距种子超过 60pt → 应被 step1 垂直窗过滤掉。
            # 此处刻意压在种子内部，构造"会被吸纳但导致面积爆炸"的反例。
            _drawing(0.0, 350.0, 595.0, 500.0),  # 595 x 150
        ]
        text_dict = {"blocks": self._column_paragraphs()}
        result = _expand_figure_bbox(seed, drawings=drawings, text_dict=text_dict)
        # 扩展后面积 595*150 = 89250 vs 种子 50*50 = 2500，比例 35.7x > 4.0
        # → 触发 max_expand_factor 退化保护，回退到种子
        assert result == seed

    # ──────────────────────────────────────────────────────────────
    # T4：空输入 / 无邻接元素 —— no-op，扩展是恒等映射
    # ──────────────────────────────────────────────────────────────
    def test_t4_no_neighbors_returns_seed_unchanged(self) -> None:
        """fixture 中没有邻接矢量也没有邻接文本（只有远端正文）→ 扩展函数
        应返回种子 bbox 不变（除被正文栏截断的情况）。此 case 保证既有
        R7 单测无回归（任何调用者只要不构造邻接元素，就观察不到行为变化）。"""
        seed = (180.4, 482.4, 479.2, 681.6)
        # 仅有远端正文段落（不在 ±60pt 垂直窗内）
        text_dict = {"blocks": self._column_paragraphs()}
        result = _expand_figure_bbox(seed, drawings=[], text_dict=text_dict)
        # 横向受正文栏截断（72-523），但种子横向 180-479 已在正文栏内 → 不变
        assert result == seed

    def test_t4b_empty_inputs(self) -> None:
        """drawings / text_dict 全空 → 直接返回种子。"""
        seed = (100.0, 200.0, 300.0, 400.0)
        result = _expand_figure_bbox(seed, drawings=[], text_dict={"blocks": []})
        assert result == seed

    def test_t4c_degenerate_seed_returns_unchanged(self) -> None:
        """零宽 / 零高种子直接返回（不做任何吸纳）。"""
        zero_w_seed = (100.0, 100.0, 100.0, 200.0)  # 零宽
        zero_h_seed = (100.0, 100.0, 200.0, 100.0)  # 零高
        assert (
            _expand_figure_bbox(zero_w_seed, drawings=[], text_dict={"blocks": []})
            == zero_w_seed
        )
        assert (
            _expand_figure_bbox(zero_h_seed, drawings=[], text_dict={"blocks": []})
            == zero_h_seed
        )

    # ──────────────────────────────────────────────────────────────
    # 辅助：噪声 drawing 过滤（水平重叠不足）
    # ──────────────────────────────────────────────────────────────
    def test_horizontally_disjoint_drawing_ignored(self) -> None:
        """drawing 与种子水平方向几乎不重叠（重叠比例 < 30%）→ 不吸纳。
        防御场景：figure 旁边的页眉横线、序号编号等装饰矢量误吸入。"""
        seed = (200.0, 400.0, 400.0, 600.0)  # 200x200
        drawings = [
            # 该装饰线宽 100pt，与种子的水平重叠仅 10pt（10/100 = 10% < 30%）
            _drawing(390.0, 380.0, 490.0, 385.0),
        ]
        text_dict = {"blocks": self._column_paragraphs()}
        result = _expand_figure_bbox(seed, drawings=drawings, text_dict=text_dict)
        # 不吸纳：bbox 不变
        assert result == seed
