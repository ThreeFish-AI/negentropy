"""``assembly`` stage — Figure overlay 矢量标签抑制 + caption 例外保留契约。

锁定 ISSUE-094 R6 修复契约：

- PyMuPDF 把 PDF 中 Figure 视觉区内的**矢量标签**（如 Context Engineering 2.0
  Figure 1 中 "Context 1.0..4.0" 标题行 / "Context Input" / "Intelligence Level"
  分类行）作为独立 ``text block`` 抽出，由于 ``image_extraction`` 仅给出位图
  bbox（小于 figure 视觉框），这些标签 text block 落到 ``_block_overlaps_special``
  几何检测之外，导致它们作为独立段落散落到 figure 下方破坏阅读流。
- 修复后：assembly 把 ``layout_analysis`` 的 ``region_type == "figure"``
  bbox 也纳入 ``special_regions``（覆盖完整 figure 视觉框），矢量标签
  自然被几何检测命中并抑制。
- Figure / Table caption（``Figure N:`` / ``Table N:`` 起手）即使几何上
  落入 layout figure region，也必须**例外保留**为段落，保证图表语义描述
  不被一同抑制。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.stages.pdf.assembly import (
    _is_figure_or_table_caption_text,
)


class TestIsFigureOrTableCaptionText:
    """``_is_figure_or_table_caption_text`` —— caption 例外保留判定。"""

    def test_classic_figure_colon(self) -> None:
        """``Figure 1: ...`` 是典型 caption。"""
        assert _is_figure_or_table_caption_text(
            "Figure 1: The Overview of context engineering 1.0 to 4.0."
        )

    def test_classic_table_colon(self) -> None:
        """``Table 3: ...`` 是典型 caption。"""
        assert _is_figure_or_table_caption_text(
            "Table 3: Comparison of memory architectures."
        )

    def test_figure_period(self) -> None:
        """``Figure 2. ...`` 使用句点分隔也接受。"""
        assert _is_figure_or_table_caption_text(
            "Figure 2. Trajectories of cognitive abilities."
        )

    def test_fig_abbreviated(self) -> None:
        """``Fig. 4: ...`` 缩写形式接受。"""
        assert _is_figure_or_table_caption_text(
            "Fig. 4: Memory tree structure with selective compression."
        )

    def test_tab_abbreviated(self) -> None:
        """``Tab 5 -`` 短横线分隔也接受。"""
        assert _is_figure_or_table_caption_text(
            "Tab 5 - Summary of evaluation metrics across datasets."
        )

    def test_case_insensitive(self) -> None:
        """大小写不敏感。"""
        assert _is_figure_or_table_caption_text("figure 1: caption text")
        assert _is_figure_or_table_caption_text("FIGURE 1: CAPTION TEXT")

    def test_figure_overlay_vector_label_rejected(self) -> None:
        """Figure 内部矢量标签（无编号 + 短小）NOT caption — 应被抑制。"""
        assert not _is_figure_or_table_caption_text("Context Input")
        assert not _is_figure_or_table_caption_text("Intelligence Level")
        assert not _is_figure_or_table_caption_text("Context 1.0")
        assert not _is_figure_or_table_caption_text("Context 2.0")
        assert not _is_figure_or_table_caption_text("Passive Executor")
        assert not _is_figure_or_table_caption_text(
            "Initiative Agent Reliable Collaborator Considerate Master"
        )
        assert not _is_figure_or_table_caption_text(
            "More Intelligence. More Context-Processing Ability."
        )

    def test_normal_paragraph_rejected(self) -> None:
        """正文段落 NOT caption。"""
        assert not _is_figure_or_table_caption_text(
            "In this paper, we discuss the context of context engineering."
        )

    def test_empty_rejected(self) -> None:
        """空字符串 NOT caption。"""
        assert not _is_figure_or_table_caption_text("")
        assert not _is_figure_or_table_caption_text("   ")

    def test_mid_paragraph_figure_reference_rejected(self) -> None:
        """段落中部的 "Figure 1" 引用 NOT caption（必须起手）。"""
        assert not _is_figure_or_table_caption_text(
            "As shown in Figure 1: this is just a reference."
        )
