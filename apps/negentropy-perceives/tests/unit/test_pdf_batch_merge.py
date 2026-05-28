"""``pipeline.batch_merge`` —— 跨切片合并模块单元测试。

锁定 R9 ``auto_batch`` 路径的合并契约：

- 切片范围生成（split_page_ranges）：整除 / 余切 / 单切片 / 边界异常。
- 资产去重（dedupe_image_assets）：同名同 sha 跳过 / 同名异 sha 重命名 /
  不同名共存 / sha 失败 fail-open。
- Markdown 图片引用重写（rewrite_image_refs_in_markdown）：markdown 语法 /
  HTML img / 路径前缀 / 单词边界保护。
- 边界 Figure caption 救援（boundary_figure_caption_rescue）：caption-img
  对称情形与 no-match 透传。
- 切片 markdown 拼接（merge_slice_markdowns）：boundary marker / 空切片跳过 /
  长度不匹配异常。
- 顶层合并（merge_pipeline_results）：计数累加 / engines 去重保序 / metadata
  补 total_pages / partial_failures 透传 / 空成功兜底。
- PDF 页数探测（detect_pdf_total_pages）：本地文件 / URL 返回 None / 缺失
  文件兜底。

合并模块为纯函数库（除资产 SHA-256 读盘 + 文件 rename），无外部依赖；测试用
``tmp_path`` fixture 构造真实小图文件验证去重链路。
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import List

import pytest

from negentropy.perceives.pipeline.batch_merge import (
    MergedBatchResult,
    boundary_figure_caption_rescue,
    dedupe_image_assets,
    detect_pdf_total_pages,
    merge_pipeline_results,
    merge_slice_markdowns,
    rewrite_image_refs_in_markdown,
    split_page_ranges,
)
from negentropy.perceives.pipeline.models import ImageAsset, PipelineResult


# ---------------------------------------------------------------------------
# split_page_ranges
# ---------------------------------------------------------------------------


class TestSplitPageRanges:
    """``split_page_ranges`` —— 把 [0, total) 切成 [start, end) 列表。"""

    def test_evenly_divisible(self) -> None:
        assert split_page_ranges(80, 40) == [(0, 40), (40, 80)]

    def test_with_remainder(self) -> None:
        assert split_page_ranges(95, 40) == [(0, 40), (40, 80), (80, 95)]

    def test_total_less_than_batch_size(self) -> None:
        assert split_page_ranges(30, 40) == [(0, 30)]

    def test_total_equals_batch_size(self) -> None:
        assert split_page_ranges(40, 40) == [(0, 40)]

    def test_single_page(self) -> None:
        assert split_page_ranges(1, 40) == [(0, 1)]

    def test_zero_total_raises(self) -> None:
        with pytest.raises(ValueError, match="total_pages"):
            split_page_ranges(0, 40)

    def test_negative_total_raises(self) -> None:
        with pytest.raises(ValueError, match="total_pages"):
            split_page_ranges(-5, 40)

    def test_zero_batch_size_raises(self) -> None:
        with pytest.raises(ValueError, match="batch_size"):
            split_page_ranges(100, 0)


# ---------------------------------------------------------------------------
# dedupe_image_assets
# ---------------------------------------------------------------------------


def _make_image(tmp_path: Path, name: str, content: bytes) -> ImageAsset:
    """落盘真实图片字节并返回 ImageAsset，用于触发 sha256 计算。"""
    p = tmp_path / name
    p.write_bytes(content)
    return ImageAsset(
        filename=name,
        mime_type="image/png",
        image_path=str(p.resolve()),
        resource_uri=None,
        width=100,
        height=80,
        caption=None,
        page_number=0,
    )


class TestDedupeImageAssets:
    """``dedupe_image_assets`` —— 跨切片图片去重 + 同名冲突重命名。"""

    def test_no_collision_all_kept(self, tmp_path: Path) -> None:
        a0 = _make_image(tmp_path, "a.png", b"AAAA")
        a1 = _make_image(tmp_path, "b.png", b"BBBB")
        merged, rename_map = dedupe_image_assets([[a0], [a1]])
        assert len(merged) == 2
        assert {asset.filename for asset in merged} == {"a.png", "b.png"}
        assert rename_map == {}

    def test_same_name_same_content_keeps_first(self, tmp_path: Path) -> None:
        # 两个切片各自落盘同名同内容文件
        d0 = tmp_path / "s0"
        d1 = tmp_path / "s1"
        d0.mkdir()
        d1.mkdir()
        (d0 / "img.png").write_bytes(b"SAME")
        (d1 / "img.png").write_bytes(b"SAME")
        a0 = ImageAsset(
            filename="img.png",
            image_path=str((d0 / "img.png").resolve()),
        )
        a1 = ImageAsset(
            filename="img.png",
            image_path=str((d1 / "img.png").resolve()),
        )
        merged, rename_map = dedupe_image_assets([[a0], [a1]])
        assert len(merged) == 1  # 仅保留首张
        assert rename_map == {}

    def test_same_name_different_content_renames_second(self, tmp_path: Path) -> None:
        (tmp_path / "img.png").write_bytes(b"FIRST")
        # 第二张同名不同内容，落到同目录（模拟切片合用 output_dir 但触发碰撞）
        d1 = tmp_path / "s1"
        d1.mkdir()
        (d1 / "img.png").write_bytes(b"SECOND")
        a0 = ImageAsset(
            filename="img.png",
            image_path=str((tmp_path / "img.png").resolve()),
        )
        a1 = ImageAsset(
            filename="img.png",
            image_path=str((d1 / "img.png").resolve()),
        )
        merged, rename_map = dedupe_image_assets([[a0], [a1]])
        # 第一张保留原名，第二张被改名为 b1_img.png
        names = sorted(asset.filename for asset in merged)
        assert names == ["b1_img.png", "img.png"]
        assert rename_map == {(1, "img.png"): "b1_img.png"}

    def test_missing_image_path_safe(self) -> None:
        a0 = ImageAsset(filename="x.png", image_path="")
        merged, rename_map = dedupe_image_assets([[a0]])
        assert len(merged) == 1
        assert rename_map == {}


# ---------------------------------------------------------------------------
# rewrite_image_refs_in_markdown
# ---------------------------------------------------------------------------


class TestRewriteImageRefs:
    """``rewrite_image_refs_in_markdown`` —— 按 rename_map 替换图片引用。"""

    def test_markdown_image_syntax(self) -> None:
        md = "Hello\n\n![cap](img.png)\n\nWorld"
        out = rewrite_image_refs_in_markdown(md, {"img.png": "b1_img.png"})
        assert "![cap](b1_img.png)" in out
        assert "img.png" not in out.replace("b1_img.png", "")

    def test_html_img_tag(self) -> None:
        md = 'Text\n\n<img src="img.png" width="100" />\n\nMore'
        out = rewrite_image_refs_in_markdown(md, {"img.png": "b1_img.png"})
        assert 'src="b1_img.png"' in out

    def test_relative_path_prefix_preserved(self) -> None:
        md = "![alt](./images/img.png)"
        out = rewrite_image_refs_in_markdown(md, {"img.png": "b1_img.png"})
        # 路径前缀保留，仅文件名段被替换
        assert "./images/b1_img.png" in out

    def test_word_boundary_protects_substrings(self) -> None:
        # "img.png.bak" 不应被替换
        md = "Reference: img.png.bak something else"
        out = rewrite_image_refs_in_markdown(md, {"img.png": "b1_img.png"})
        assert "img.png.bak" in out
        assert "b1_img.png.bak" not in out

    def test_empty_rename_map_returns_unchanged(self) -> None:
        md = "![](old.png)"
        assert rewrite_image_refs_in_markdown(md, {}) == md

    def test_empty_markdown_safe(self) -> None:
        assert rewrite_image_refs_in_markdown("", {"a": "b"}) == ""


# ---------------------------------------------------------------------------
# boundary_figure_caption_rescue
# ---------------------------------------------------------------------------


class TestBoundaryFigureCaptionRescue:
    """``boundary_figure_caption_rescue`` —— 跨切片 caption-img 救援。"""

    def test_case1_caption_in_a_tail_img_in_b_head(self) -> None:
        """切片 a 尾段 caption + 切片 b 首段图片 → caption 移到 b 图后。"""
        a = "Paragraph 1.\n\nFigure 3: An agent loop diagram."
        b = '<img src="figure-3.png" width="600" />\n\nNext paragraph.'
        new_a, new_b = boundary_figure_caption_rescue(a, b)
        assert "Figure 3:" not in new_a
        assert new_b.startswith("<img")
        assert "Figure 3:" in new_b
        # caption 在 img 之后
        idx_img = new_b.find("<img")
        idx_caption = new_b.find("Figure 3:")
        assert idx_img < idx_caption

    def test_case2_img_in_a_tail_caption_in_b_head(self) -> None:
        """切片 a 尾段图片 + 切片 b 首段 caption → caption 移到 a 图后。"""
        a = 'Body paragraph.\n\n<img src="figure-7.png" width="500" />'
        b = "Figure 7: System architecture overview.\n\nNext page text."
        new_a, new_b = boundary_figure_caption_rescue(a, b)
        assert "Figure 7:" not in new_b
        assert "Figure 7:" in new_a
        # img 与 caption 都在 a，且 img 在前
        idx_img = new_a.find("<img")
        idx_caption = new_a.find("Figure 7:")
        assert idx_img < idx_caption

    def test_no_match_returns_unchanged(self) -> None:
        a = "Regular paragraph A."
        b = "Regular paragraph B."
        new_a, new_b = boundary_figure_caption_rescue(a, b)
        assert new_a == a
        assert new_b == b

    def test_caption_only_no_img_unchanged(self) -> None:
        """两边都是 caption 但都不是 img → 不救援。"""
        a = "Figure 1: foo"
        b = "Figure 2: bar"
        new_a, new_b = boundary_figure_caption_rescue(a, b)
        assert (new_a, new_b) == (a, b)

    def test_empty_slice_safe(self) -> None:
        assert boundary_figure_caption_rescue("", "x") == ("", "x")
        assert boundary_figure_caption_rescue("x", "") == ("x", "")


# ---------------------------------------------------------------------------
# merge_slice_markdowns
# ---------------------------------------------------------------------------


class TestMergeSliceMarkdowns:
    """``merge_slice_markdowns`` —— 拼接 + boundary marker + caption 救援。"""

    def test_basic_concat_with_boundary_marker(self) -> None:
        slices = ["First slice text.", "Second slice text."]
        ranges = [(0, 40), (40, 80)]
        out = merge_slice_markdowns(slices, ranges)
        assert "First slice text." in out
        assert "Second slice text." in out
        assert "<!-- batch boundary: pages 41-80 -->" in out

    def test_boundary_marker_disabled(self) -> None:
        slices = ["A", "B"]
        ranges = [(0, 10), (10, 20)]
        out = merge_slice_markdowns(slices, ranges, boundary_marker=False)
        assert "batch boundary" not in out
        assert "A" in out and "B" in out

    def test_empty_slices_skipped(self) -> None:
        slices = ["A", "", "C"]
        ranges = [(0, 10), (10, 20), (20, 30)]
        out = merge_slice_markdowns(slices, ranges)
        assert "A" in out
        assert "C" in out

    def test_single_slice_no_boundary(self) -> None:
        out = merge_slice_markdowns(["only content"], [(0, 30)])
        assert "batch boundary" not in out
        assert "only content" in out

    def test_length_mismatch_raises(self) -> None:
        with pytest.raises(ValueError, match="不匹配"):
            merge_slice_markdowns(["A", "B"], [(0, 10)])

    def test_empty_input_returns_empty(self) -> None:
        assert merge_slice_markdowns([], []) == ""


# ---------------------------------------------------------------------------
# merge_pipeline_results
# ---------------------------------------------------------------------------


def _stub_pipeline_result(
    markdown: str = "",
    word_count: int = 0,
    images_count: int = 0,
    tables_count: int = 0,
    formulas_count: int = 0,
    code_blocks_count: int = 0,
    engines_used: List[str] | None = None,
    image_assets: List[ImageAsset] | None = None,
    metadata: dict | None = None,
) -> PipelineResult:
    return PipelineResult(
        success=True,
        markdown=markdown,
        word_count=word_count,
        images_count=images_count,
        tables_count=tables_count,
        formulas_count=formulas_count,
        code_blocks_count=code_blocks_count,
        engines_used=engines_used or [],
        image_assets=image_assets or [],
        metadata=metadata or {},
    )


class TestMergePipelineResults:
    """``merge_pipeline_results`` —— 顶层合并入口。"""

    def test_total_pages_overrides_metadata(self) -> None:
        results = [_stub_pipeline_result(markdown="A", metadata={"foo": "bar"})]
        merged = merge_pipeline_results(results, [(0, 40)], total_pages=200)
        assert merged.metadata["total_pages"] == 200
        assert merged.metadata["foo"] == "bar"

    def test_counts_are_summed_across_slices(self) -> None:
        results = [
            _stub_pipeline_result(
                word_count=10, tables_count=1, formulas_count=2, code_blocks_count=3
            ),
            _stub_pipeline_result(
                word_count=20, tables_count=2, formulas_count=3, code_blocks_count=4
            ),
        ]
        merged = merge_pipeline_results(results, [(0, 40), (40, 80)], total_pages=80)
        assert merged.word_count == 30
        assert merged.tables_count == 3
        assert merged.formulas_count == 5
        assert merged.code_blocks_count == 7

    def test_engines_unique_with_order_preserved(self) -> None:
        results = [
            _stub_pipeline_result(engines_used=["docling", "pymupdf"]),
            _stub_pipeline_result(engines_used=["mineru", "docling"]),
        ]
        merged = merge_pipeline_results(results, [(0, 40), (40, 80)], total_pages=80)
        assert merged.engines_used == ["docling", "pymupdf", "mineru"]

    def test_batched_metadata_populated(self) -> None:
        results = [_stub_pipeline_result(), _stub_pipeline_result()]
        merged = merge_pipeline_results(results, [(0, 40), (40, 80)], total_pages=80)
        assert merged.metadata["batched"]["slices"] == 2
        assert merged.metadata["batched"]["ranges"] == [[0, 40], [40, 80]]

    def test_partial_failures_recorded_in_metadata(self) -> None:
        results = [_stub_pipeline_result(markdown="A")]
        merged = merge_pipeline_results(
            results,
            [(0, 40)],
            total_pages=120,
            partial_failures=[(40, 80, "mineru timeout"), (80, 120, "OOM")],
        )
        assert merged.partial_failures == [
            (40, 80, "mineru timeout"),
            (80, 120, "OOM"),
        ]
        assert len(merged.metadata["partial_failures"]) == 2
        assert merged.metadata["partial_failures"][0]["error"] == "mineru timeout"

    def test_empty_results_with_failures_returns_failure(self) -> None:
        merged = merge_pipeline_results(
            [],
            [],
            total_pages=80,
            partial_failures=[(0, 40, "err1"), (40, 80, "err2")],
        )
        assert merged.success is False
        assert "所有切片均失败" in (merged.error or "")
        assert merged.markdown == ""

    def test_length_mismatch_raises(self) -> None:
        with pytest.raises(ValueError, match="不匹配"):
            merge_pipeline_results(
                [_stub_pipeline_result()], [(0, 40), (40, 80)], total_pages=80
            )


# ---------------------------------------------------------------------------
# detect_pdf_total_pages
# ---------------------------------------------------------------------------


class TestDetectPdfTotalPages:
    """``detect_pdf_total_pages`` —— 轻量 PDF 页数探测。"""

    def test_http_url_returns_none(self) -> None:
        assert detect_pdf_total_pages("http://example.com/doc.pdf") is None
        assert detect_pdf_total_pages("https://example.com/doc.pdf") is None

    def test_empty_source_returns_none(self) -> None:
        assert detect_pdf_total_pages("") is None

    def test_missing_file_returns_none(self, tmp_path: Path) -> None:
        assert detect_pdf_total_pages(str(tmp_path / "nope.pdf")) is None

    def test_local_pdf_returns_page_count(self, tmp_path: Path) -> None:
        """落一份 1 页空 PDF（用 fitz 现场生成），断言返回 1。"""
        try:
            import fitz
        except ImportError:
            pytest.skip("PyMuPDF 不可用")

        out = tmp_path / "tiny.pdf"
        doc = fitz.open()
        doc.new_page()
        doc.save(str(out))
        doc.close()
        assert detect_pdf_total_pages(str(out)) == 1


# ---------------------------------------------------------------------------
# MergedBatchResult dataclass 字段契约
# ---------------------------------------------------------------------------


class TestMergedBatchResultContract:
    """MergedBatchResult dataclass 字段稳定性测试。"""

    def test_default_partial_failures_is_empty_list(self) -> None:
        r = MergedBatchResult(
            markdown="",
            word_count=0,
            image_assets=[],
            images_count=0,
            tables_count=0,
            formulas_count=0,
            code_blocks_count=0,
            engines_used=[],
            stage_results={},
            metadata={},
            page_count=0,
        )
        assert r.partial_failures == []
        assert r.success is True
        assert r.error is None


def test_sha256_cache_smoke(tmp_path: Path) -> None:
    """SHA-256 缓存命中后 path → 摘要稳定。

    通过 ``dedupe_image_assets`` 两次调用同 path，验证内部缓存被使用且摘要等价
    于直接 hashlib 计算结果。
    """
    f = tmp_path / "x.png"
    f.write_bytes(b"deadbeef")
    expected = hashlib.sha256(b"deadbeef").hexdigest()
    a = ImageAsset(filename="x.png", image_path=str(f.resolve()))
    merged1, _ = dedupe_image_assets([[a]])
    merged2, _ = dedupe_image_assets([[a]])
    assert merged1[0].filename == "x.png"
    assert merged2[0].filename == "x.png"
    # 缓存内可见 path → expected
    from negentropy.perceives.pipeline.batch_merge import _FILE_HASH_CACHE

    assert _FILE_HASH_CACHE.get(str(f.resolve())) == expected
