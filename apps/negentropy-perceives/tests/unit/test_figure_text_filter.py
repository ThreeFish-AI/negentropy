"""图内文字空间过滤模块的单元测试。

测试覆盖：
1. is_text_inside_figure — 边界框重叠检测
2. is_caption_text — 标题模式识别
3. collect_figure_internal_texts — 批量过滤
4. remove_texts_from_markdown — Markdown 段落级移除
5. DoclingEngine 图内文字过滤集成
6. PyMuPDF 路径 figure_block_nos 过滤
"""

import pytest
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

from negentropy.perceives.pdf.figure_text_filter import (
    FigureRegion,
    collect_figure_internal_texts,
    is_caption_text,
    is_text_inside_figure,
    remove_texts_from_markdown,
)


# ============================================================
# 1. is_text_inside_figure 边界框重叠检测
# ============================================================
class TestIsTextInsideFigure:
    """测试空间重叠检测函数。"""

    def test_fully_contained(self):
        """文本完全在图区域内 → True"""
        assert (
            is_text_inside_figure(
                text_bbox=(100, 100, 200, 120),
                figure_bbox=(50, 50, 300, 300),
            )
            is True
        )

    def test_completely_outside(self):
        """文本完全在图区域外 → False"""
        assert (
            is_text_inside_figure(
                text_bbox=(400, 400, 500, 420),
                figure_bbox=(50, 50, 300, 300),
            )
            is False
        )

    def test_no_vertical_overlap(self):
        """水平重叠但垂直无交集 → False"""
        assert (
            is_text_inside_figure(
                text_bbox=(100, 350, 200, 370),
                figure_bbox=(50, 50, 300, 300),
            )
            is False
        )

    def test_no_horizontal_overlap(self):
        """垂直重叠但水平无交集 → False"""
        assert (
            is_text_inside_figure(
                text_bbox=(350, 100, 450, 120),
                figure_bbox=(50, 50, 300, 300),
            )
            is False
        )

    def test_partial_overlap_below_threshold(self):
        """重叠面积占比 < 0.6 → False"""
        # 文本宽度 150，只有 50 在图内：50/150 = 0.33
        assert (
            is_text_inside_figure(
                text_bbox=(250, 100, 400, 120),
                figure_bbox=(50, 50, 300, 300),
            )
            is False
        )

    def test_partial_overlap_above_threshold(self):
        """重叠面积占比 >= 0.6 → True"""
        # 文本宽度 120，有 100 在图内：100/120 = 0.83
        assert (
            is_text_inside_figure(
                text_bbox=(200, 100, 320, 120),
                figure_bbox=(50, 50, 300, 300),
            )
            is True
        )

    def test_custom_threshold(self):
        """自定义阈值测试"""
        # 50% 重叠，默认阈值 0.6 → False
        assert (
            is_text_inside_figure(
                text_bbox=(200, 100, 400, 120),
                figure_bbox=(50, 50, 300, 300),
                overlap_threshold=0.6,
            )
            is False
        )
        # 同样的重叠，阈值 0.4 → True
        assert (
            is_text_inside_figure(
                text_bbox=(200, 100, 400, 120),
                figure_bbox=(50, 50, 300, 300),
                overlap_threshold=0.4,
            )
            is True
        )

    def test_zero_area_text(self):
        """零面积文本 → False"""
        assert (
            is_text_inside_figure(
                text_bbox=(100, 100, 100, 120),
                figure_bbox=(50, 50, 300, 300),
            )
            is False
        )

    def test_exact_overlap(self):
        """文本与图区域完全重合 → True"""
        assert (
            is_text_inside_figure(
                text_bbox=(50, 50, 300, 300),
                figure_bbox=(50, 50, 300, 300),
            )
            is True
        )


# ============================================================
# 2. is_caption_text 标题模式识别
# ============================================================
class TestIsCaptionText:
    """测试标题模式检测。"""

    def test_figure_english(self):
        assert is_caption_text("Figure 1: Architecture diagram") is True

    def test_fig_abbreviated(self):
        assert is_caption_text("Fig. 2 System overview") is True

    def test_fig_no_dot(self):
        assert is_caption_text("Fig 3 Overview") is True

    def test_table_english(self):
        assert is_caption_text("Table 1: Results") is True

    def test_figure_chinese(self):
        assert is_caption_text("图 1 系统架构") is True

    def test_table_chinese(self):
        assert is_caption_text("表 2 实验结果") is True

    def test_image_keyword(self):
        assert is_caption_text("Image 5: Screenshot") is True

    def test_diagram_keyword(self):
        assert is_caption_text("Diagram 3: Flow") is True

    def test_chart_keyword(self):
        assert is_caption_text("Chart 1: Distribution") is True

    def test_regular_text(self):
        assert is_caption_text("This is regular body text") is False

    def test_figure_text_without_number(self):
        assert is_caption_text("Figure without number") is False

    def test_empty_text(self):
        assert is_caption_text("") is False

    def test_whitespace_only(self):
        assert is_caption_text("   ") is False

    def test_multiline_first_line_caption(self):
        assert is_caption_text("Figure 1: Title\nAdditional description") is True

    def test_case_insensitive(self):
        assert is_caption_text("FIGURE 1: TITLE") is True
        assert is_caption_text("figure 1: title") is True


# ============================================================
# 3. collect_figure_internal_texts 批量过滤
# ============================================================
class TestCollectFigureInternalTexts:
    """测试批量图内文字收集。"""

    def test_basic_filtering(self):
        """文本在图区域内应被收集"""
        items = [
            {
                "label": "text",
                "text": "Figure label",
                "page": 1,
                "bbox": (100, 100, 200, 120),
            },
            {
                "label": "text",
                "text": "Body text",
                "page": 1,
                "bbox": (50, 400, 500, 420),
            },
        ]
        regions = [FigureRegion(page_no=1, bbox=(80, 80, 250, 250))]

        result = collect_figure_internal_texts(
            items,
            regions,
            get_label=lambda x: x["label"],
            get_text=lambda x: x["text"],
            get_page_no=lambda x: x["page"],
            get_bbox=lambda x: x["bbox"],
        )

        assert "Figure label" in result
        assert "Body text" not in result

    def test_caption_excluded(self):
        """标题文字不应被收集"""
        items = [
            {
                "label": "text",
                "text": "Figure 1: Architecture",
                "page": 1,
                "bbox": (100, 260, 300, 280),
            },
        ]
        regions = [FigureRegion(page_no=1, bbox=(80, 80, 350, 300))]

        result = collect_figure_internal_texts(
            items,
            regions,
            get_label=lambda x: x["label"],
            get_text=lambda x: x["text"],
            get_page_no=lambda x: x["page"],
            get_bbox=lambda x: x["bbox"],
        )

        assert len(result) == 0

    def test_different_page(self):
        """不同页面的文本不受影响"""
        items = [
            {
                "label": "text",
                "text": "Some text",
                "page": 2,
                "bbox": (100, 100, 200, 120),
            },
        ]
        regions = [FigureRegion(page_no=1, bbox=(80, 80, 250, 250))]

        result = collect_figure_internal_texts(
            items,
            regions,
            get_label=lambda x: x["label"],
            get_text=lambda x: x["text"],
            get_page_no=lambda x: x["page"],
            get_bbox=lambda x: x["bbox"],
        )

        assert len(result) == 0

    def test_non_body_labels_ignored(self):
        """非正文 label 不参与过滤"""
        items = [
            {
                "label": "section_header",
                "text": "Title",
                "page": 1,
                "bbox": (100, 100, 200, 120),
            },
        ]
        regions = [FigureRegion(page_no=1, bbox=(80, 80, 250, 250))]

        result = collect_figure_internal_texts(
            items,
            regions,
            get_label=lambda x: x["label"],
            get_text=lambda x: x["text"],
            get_page_no=lambda x: x["page"],
            get_bbox=lambda x: x["bbox"],
        )

        assert len(result) == 0

    def test_empty_regions(self):
        """无图区域时返回空集"""
        items = [
            {
                "label": "text",
                "text": "Some text",
                "page": 1,
                "bbox": (100, 100, 200, 120),
            },
        ]
        result = collect_figure_internal_texts(
            items,
            [],
            get_label=lambda x: x["label"],
            get_text=lambda x: x["text"],
            get_page_no=lambda x: x["page"],
            get_bbox=lambda x: x["bbox"],
        )

        assert len(result) == 0


# ============================================================
# 4. remove_texts_from_markdown 段落级移除
# ============================================================
class TestRemoveTextsFromMarkdown:
    """测试 Markdown 文本移除。"""

    def test_basic_removal(self):
        md = "Context 1.0\n\nTitle\n\nAbstract"
        result = remove_texts_from_markdown(md, {"Context 1.0"})
        assert "Context 1.0" not in result
        assert "Title" in result
        assert "Abstract" in result

    def test_multiple_removals(self):
        md = "Context 1.0\n\nContext 2.0\n\nTitle\n\nContext 3.0\n\nAbstract"
        result = remove_texts_from_markdown(
            md, {"Context 1.0", "Context 2.0", "Context 3.0"}
        )
        assert "Context 1.0" not in result
        assert "Context 2.0" not in result
        assert "Context 3.0" not in result
        assert "Title" in result
        assert "Abstract" in result

    def test_no_removal_when_empty_set(self):
        md = "Title\n\nAbstract"
        result = remove_texts_from_markdown(md, set())
        assert result == md

    def test_preserves_unmatched_text(self):
        md = "Keep this\n\nRemove this\n\nKeep that"
        result = remove_texts_from_markdown(md, {"Remove this"})
        assert "Keep this" in result
        assert "Keep that" in result
        assert "Remove this" not in result

    def test_cleans_excessive_blank_lines(self):
        md = "A\n\nRemove\n\nB"
        result = remove_texts_from_markdown(md, {"Remove"})
        # 不应出现连续 3 个以上换行
        assert "\n\n\n" not in result

    def test_partial_match_not_removed(self):
        """只有完全匹配的段落才被移除"""
        md = "Context 1.0 is important\n\nContext 1.0\n\nEnd"
        result = remove_texts_from_markdown(md, {"Context 1.0"})
        assert "Context 1.0 is important" in result
        assert "End" in result


# ============================================================
# 5. DoclingEngine 图内文字过滤集成
# ============================================================
class TestDoclingEngineFigureFiltering:
    """测试 DoclingEngine 的图内文字过滤方法。"""

    def test_extract_bbox_tuple_ltrb(self):
        """从 l/t/r/b 属性提取 bbox"""
        from negentropy.perceives.pdf.docling_engine import DoclingEngine

        bbox_obj = Mock()
        bbox_obj.l = 10.0
        bbox_obj.t = 20.0
        bbox_obj.r = 300.0
        bbox_obj.b = 400.0
        result = DoclingEngine._extract_bbox_tuple(bbox_obj)
        assert result == (10.0, 20.0, 300.0, 400.0)

    def test_extract_bbox_tuple_x0y0x1y1(self):
        """从 x0/y0/x1/y1 属性提取 bbox"""
        from negentropy.perceives.pdf.docling_engine import DoclingEngine

        bbox_obj = Mock(spec=[])
        bbox_obj.x0 = 10.0
        bbox_obj.y0 = 20.0
        bbox_obj.x1 = 300.0
        bbox_obj.y1 = 400.0
        result = DoclingEngine._extract_bbox_tuple(bbox_obj)
        assert result == (10.0, 20.0, 300.0, 400.0)

    def test_extract_bbox_tuple_none(self):
        """None 输入返回 None"""
        from negentropy.perceives.pdf.docling_engine import DoclingEngine

        assert DoclingEngine._extract_bbox_tuple(None) is None

    def test_collect_figure_regions(self):
        """从 doc.pictures 中提取图区域"""
        from negentropy.perceives.pdf.docling_engine import DoclingEngine

        engine = DoclingEngine()

        prov_item = Mock()
        prov_item.page_no = 1
        bbox_obj = Mock()
        bbox_obj.l = 50.0
        bbox_obj.t = 100.0
        bbox_obj.r = 400.0
        bbox_obj.b = 350.0
        prov_item.bbox = bbox_obj

        pic = Mock()
        pic.prov = [prov_item]
        pic.caption_text = Mock(return_value="Fig 1")

        doc = Mock()
        doc.pictures = [pic]

        regions = engine._collect_figure_regions(doc)
        assert len(regions) == 1
        # Docling 上报 1-based page_no=1 → 项目 0-based 归一化为 0
        assert regions[0].page_no == 0
        assert regions[0].bbox == (50.0, 100.0, 400.0, 350.0)

    def test_filter_figure_internal_texts_integration(self):
        """端到端测试：图内文字被过滤，正文保留"""
        from negentropy.perceives.pdf.docling_engine import DoclingEngine

        engine = DoclingEngine()

        # 构建 mock doc
        prov_item = Mock()
        prov_item.page_no = 1
        bbox_obj = Mock()
        bbox_obj.l = 50.0
        bbox_obj.t = 50.0
        bbox_obj.r = 400.0
        bbox_obj.b = 300.0
        prov_item.bbox = bbox_obj

        pic = Mock()
        pic.prov = [prov_item]
        pic.caption_text = Mock(return_value="")
        pic.captions = []

        # 图内文字
        figure_text_item = Mock()
        figure_text_item.label = "text"
        figure_text_item.text = "Context 1.0"
        ft_prov = Mock()
        ft_prov.page_no = 1
        ft_bbox = Mock()
        ft_bbox.l = 100.0
        ft_bbox.t = 100.0
        ft_bbox.r = 200.0
        ft_bbox.b = 120.0
        ft_prov.bbox = ft_bbox
        figure_text_item.prov = [ft_prov]

        # 正文
        body_text_item = Mock()
        body_text_item.label = "text"
        body_text_item.text = "This is body text"
        bt_prov = Mock()
        bt_prov.page_no = 1
        bt_bbox = Mock()
        bt_bbox.l = 50.0
        bt_bbox.t = 400.0
        bt_bbox.r = 500.0
        bt_bbox.b = 420.0
        bt_prov.bbox = bt_bbox
        body_text_item.prov = [bt_prov]

        doc = Mock()
        doc.pictures = [pic]
        doc.iterate_items = Mock(
            return_value=[(figure_text_item, 0), (body_text_item, 0)]
        )

        markdown = "Context 1.0\n\nThis is body text"
        result = engine._filter_figure_internal_texts(doc, markdown)

        assert "Context 1.0" not in result
        assert "This is body text" in result


# ============================================================
# 6. PyMuPDF 路径 figure_block_nos 过滤
# ============================================================
class TestPyMuPDFFigureBlockFiltering:
    """测试 PyMuPDF 路径中图内文字块被排除。"""

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_text_inside_image_excluded(self, mock_import_fitz):
        """落在图片边界框内的文本块应被跳过。"""
        from negentropy.perceives.pdf.processor import PDFProcessor
        from negentropy.perceives.pdf.enhanced import ExtractedImage

        mock_fitz = Mock()
        mock_import_fitz.return_value = mock_fitz

        mock_doc = Mock()
        mock_doc.page_count = 1
        mock_doc.metadata = {}
        mock_fitz.open.return_value = mock_doc

        # 图片块 (x0=50, y0=50, x1=400, y1=300)
        # 图内文字块 (x0=100, y0=100, x1=200, y1=120) → 完全在图内
        # 正文块 (x0=50, y0=350, x1=500, y1=380)
        mock_page = Mock()
        mock_page.get_text.return_value = [
            (100, 100, 200, 120, "Figure label text\n", 0, 0),  # 图内文字
            (50, 50, 400, 300, "<image>", 1, 1),  # 图片块
            (50, 350, 500, 380, "Body paragraph\n", 2, 0),  # 正文
        ]
        mock_doc.load_page.return_value = mock_page

        processor = PDFProcessor()
        # 设置图片映射
        img = ExtractedImage(
            id="img_0",
            filename="test.png",
            local_path="/tmp/test.png",
            page_number=0,
            position={"x0": 50, "y0": 50, "x1": 400, "y1": 300},
        )
        processor._page_image_maps = {0: {1: img}}
        processor._page_table_maps = {}
        processor._page_math_blocks = {}
        processor._page_math_regions = {}

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            tmp_path = Path(f.name)

        try:
            result = await processor._extract_with_pymupdf(
                tmp_path, include_metadata=False
            )
            text = result["text"]

            assert result["success"] is True
            assert "Body paragraph" in text
            assert "Figure label text" not in text
        finally:
            if tmp_path.exists():
                tmp_path.unlink()
            processor.cleanup()
