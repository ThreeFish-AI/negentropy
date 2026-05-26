"""单元测试：``FitzImageExtractor`` 装饰小图二次过滤。

ISSUE-094 第四轮：Context Engineering 2.0 论文中大量出现 PDF 显示尺寸
仅 20×22 pt 的装饰光栅图（SII 章节图标、脚注上标）。``EnhancedPDFProcessor``
按渲染像素 ``< 50px`` 过滤的逻辑，对原图分辨率本身已 ≥ 50px 但 PDF 显示尺寸
极小的装饰图无能为力。``FitzImageExtractor`` 内新增 bbox 维度 ``< 20pt``
二次过滤（与矢量 figure 分支阈值对齐），本测试守护该行为。
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import List
from unittest.mock import patch

import pytest

from negentropy.perceives.pdf.extraction.image import ExtractedImage as RawExtracted
from negentropy.perceives.pipeline.models import (
    DocumentCharacteristics,
    PreprocessingOutput,
)
from negentropy.perceives.pipeline.stages.pdf.image_extraction import (
    FitzImageExtractor,
    _IMAGE_EXTRACT_CONCURRENCY,
)


@pytest.fixture(autouse=True)
def _stable_concurrency(monkeypatch):
    monkeypatch.setattr(
        "negentropy.perceives.pipeline.stages.pdf.image_extraction._resolve_concurrency",
        lambda: _IMAGE_EXTRACT_CONCURRENCY,
    )
    yield


class _FakeDoc:
    def __init__(self, pages: int) -> None:
        self.page_count = pages
        self.closed = False

    def __enter__(self) -> "_FakeDoc":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def close(self) -> None:
        self.closed = True


class _FakeFitz:
    def __init__(self, pages: int) -> None:
        self._pages = pages
        self.open_calls: List[str] = []

    def open(self, path: str) -> _FakeDoc:
        self.open_calls.append(path)
        return _FakeDoc(self._pages)


def _raw_image(
    page_idx: int, idx: int, *, x0: float, y0: float, x1: float, y1: float
) -> RawExtracted:
    return RawExtracted(
        id=f"img_p{page_idx}_{idx}",
        filename=f"img_p{page_idx}_{idx}.png",
        local_path=f"/tmp/img_p{page_idx}_{idx}.png",
        base64_data="ZmFrZQ==",
        mime_type="image/png",
        width=100,
        height=100,
        page_number=page_idx,
        position={"x0": x0, "y0": y0, "x1": x1, "y1": y1},
        caption=None,
    )


class _MixedSizeProcessor:
    """每页吐出 1 张装饰小图（20×22 pt）和 1 张正常图（300×200 pt）。"""

    async def extract_images_from_pdf_page(
        self, pdf_document, page_num: int, image_format: str = "png"
    ) -> List[RawExtracted]:
        await asyncio.sleep(0)
        return [
            # 装饰图：bbox 仅 20×22 pt（典型 SII 章节图标 / 脚注上标）
            _raw_image(page_num, 0, x0=50.0, y0=100.0, x1=70.0, y1=122.0),
            # 正常 figure：300×200 pt
            _raw_image(page_num, 1, x0=100.0, y0=200.0, x1=400.0, y1=400.0),
        ]


def _make_input(pdf_path: Path) -> PreprocessingOutput:
    return PreprocessingOutput(
        local_path=pdf_path,
        page_count=3,
        characteristics=DocumentCharacteristics(),
        page_range=None,
    )


@pytest.fixture
def tmp_pdf(tmp_path: Path) -> Path:
    p = tmp_path / "fake.pdf"
    p.write_bytes(b"%PDF-1.7\n%stub\n")
    return p


class TestDecorativeRasterFilter:
    """装饰小图（bbox < 20pt）应在 raster 阶段被过滤。"""

    @pytest.mark.asyncio
    async def test_tiny_bbox_images_filtered(self, tmp_pdf: Path) -> None:
        pages = 3
        fake_fitz = _FakeFitz(pages)
        processor = _MixedSizeProcessor()

        with (
            patch(
                "negentropy.perceives.pdf._imports.import_fitz",
                return_value=fake_fitz,
            ),
            patch(
                "negentropy.perceives.pdf.enhanced.EnhancedPDFProcessor",
                return_value=processor,
            ),
        ):
            result = await FitzImageExtractor()._run(_make_input(tmp_pdf))

        assert result.success is True
        # 每页 2 张，其中 1 张装饰图被滤掉 → 共应剩 pages 张
        assert result.output.total_count == pages, (
            f"装饰小图未被过滤：期望 {pages} 张，实际 {result.output.total_count}"
        )
        # 留下的应全部是 bbox 维度 > 24pt 的正常 figure
        for img in result.output.images:
            assert img.bbox is not None
            bw = img.bbox[2] - img.bbox[0]
            bh = img.bbox[3] - img.bbox[1]
            assert bw > 24 and bh > 24, (
                f"图 {img.image_id} bbox 维度 {bw:.1f}x{bh:.1f} pt 应已被过滤"
            )

    @pytest.mark.asyncio
    async def test_image_without_bbox_not_filtered(self, tmp_pdf: Path) -> None:
        """无 position 的图（``bbox is None``）不参与维度过滤。"""

        class _NoBBoxProcessor:
            async def extract_images_from_pdf_page(
                self, pdf_document, page_num: int, image_format: str = "png"
            ) -> List[RawExtracted]:
                return [
                    RawExtracted(
                        id=f"img_p{page_num}_0",
                        filename=f"img_p{page_num}_0.png",
                        local_path=f"/tmp/img_p{page_num}_0.png",
                        base64_data="ZmFrZQ==",
                        mime_type="image/png",
                        width=100,
                        height=100,
                        page_number=page_num,
                        position=None,
                        caption=None,
                    )
                ]

        pages = 2
        fake_fitz = _FakeFitz(pages)

        with (
            patch(
                "negentropy.perceives.pdf._imports.import_fitz",
                return_value=fake_fitz,
            ),
            patch(
                "negentropy.perceives.pdf.enhanced.EnhancedPDFProcessor",
                return_value=_NoBBoxProcessor(),
            ),
        ):
            result = await FitzImageExtractor()._run(_make_input(tmp_pdf))

        assert result.success is True
        assert result.output.total_count == pages  # 全部保留
