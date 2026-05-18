"""单元测试：FitzImageExtractor 的分页并发提取。

动机：`pipeline/stages/pdf/image_extraction.py` 原本以单 `fitz.Document`
顺序抽取每一页的图片；37 页约 18 张图耗时 15s。改造为每页独立 open +
``asyncio.Semaphore(4)`` + ``asyncio.gather`` 后应显著降低总耗时。

PyMuPDF 的 `Document` 不是线程/重入安全（官方 FAQ: "Is PyMuPDF thread-
safe?"），因此并发路径必须使用独立的 Document 实例。这里通过
monkeypatch 替换 `fitz.open` 与 `EnhancedPDFProcessor` 以验证：

1) 页数枚举正确遵循 `page_range`；
2) 实际并发度不超过 `Semaphore(4)` 的上限；
3) 每页都打开了独立的 Document（即 `fitz.open` 被调用 page_count + 1
   次：1 次探测 + N 次每页抽取）；
4) 输出结构与原串行实现一致；
5) 总耗时接近 `(pages / concurrency) * per_page_cost`，证明并发生效。
"""

from __future__ import annotations

import asyncio
import time
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
    """统一固定并发度到默认 4，避免 settings 漂移影响断言。"""
    monkeypatch.setattr(
        "negentropy.perceives.pipeline.stages.pdf.image_extraction._resolve_concurrency",
        lambda: _IMAGE_EXTRACT_CONCURRENCY,
    )
    yield


# ── 测试替身 ────────────────────────────────────────────────────────────────


class _FakeDoc:
    """最小可用的假 Document：只需暴露 ``page_count`` 与 ``close``。"""

    def __init__(self, pages: int) -> None:
        self.page_count = pages
        self.closed = False

    def __enter__(self) -> "_FakeDoc":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # noqa: D401 - ctx manager
        self.close()

    def close(self) -> None:
        self.closed = True


class _FakeFitz:
    """仿 fitz 模块：记录每一次 open 以便断言并发开文档。"""

    def __init__(self, pages: int) -> None:
        self._pages = pages
        self.open_calls: List[str] = []

    def open(self, path: str) -> _FakeDoc:
        self.open_calls.append(path)
        return _FakeDoc(self._pages)


def _make_raw_image(page_idx: int, index: int) -> RawExtracted:
    return RawExtracted(
        id=f"img_p{page_idx}_{index}",
        filename=f"img_p{page_idx}_{index}.png",
        local_path=f"/tmp/img_p{page_idx}_{index}.png",
        base64_data="ZmFrZQ==",
        mime_type="image/png",
        width=64,
        height=48,
        page_number=page_idx,
        position={"x0": 1.0, "y0": 2.0, "x1": 65.0, "y1": 50.0},
        caption=f"Figure {page_idx}.{index}",
    )


class _ConcurrencyTrackingProcessor:
    """记录在同一时刻正在跑的协程数，用于验证 Semaphore 限流。"""

    def __init__(self, per_page_cost: float, images_per_page: int) -> None:
        self._per_page_cost = per_page_cost
        self._images_per_page = images_per_page
        self._lock = asyncio.Lock()
        self.in_flight = 0
        self.peak = 0

    async def extract_images_from_pdf_page(
        self, pdf_document, page_num: int, image_format: str = "png"
    ) -> List[RawExtracted]:
        async with self._lock:
            self.in_flight += 1
            if self.in_flight > self.peak:
                self.peak = self.in_flight
        try:
            await asyncio.sleep(self._per_page_cost)
            return [_make_raw_image(page_num, i) for i in range(self._images_per_page)]
        finally:
            async with self._lock:
                self.in_flight -= 1


# ── 辅助构造 ────────────────────────────────────────────────────────────────


def _make_input(pdf_path: Path, page_range=None) -> PreprocessingOutput:
    return PreprocessingOutput(
        local_path=pdf_path,
        page_count=10,  # 将被探测覆写
        characteristics=DocumentCharacteristics(),
        page_range=page_range,
    )


@pytest.fixture
def tmp_pdf(tmp_path: Path) -> Path:
    p = tmp_path / "fake.pdf"
    p.write_bytes(b"%PDF-1.7\n%stub\n")
    return p


# ── 核心用例 ────────────────────────────────────────────────────────────────


class TestFitzImageExtractorConcurrency:
    @pytest.mark.asyncio
    async def test_all_pages_processed_and_outputs_correct(self, tmp_pdf: Path) -> None:
        pages = 6
        images_per_page = 2
        fake_fitz = _FakeFitz(pages)
        processor = _ConcurrencyTrackingProcessor(
            per_page_cost=0.0, images_per_page=images_per_page
        )
        input_data = _make_input(tmp_pdf)

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
            result = await FitzImageExtractor()._run(input_data)

        assert result.success is True
        assert result.output is not None
        assert result.output.total_count == pages * images_per_page
        # 探测 + 每页一次 = pages + 1
        assert len(fake_fitz.open_calls) == pages + 1
        # metadata 透出并发度
        assert result.output.metadata["concurrency"] == _IMAGE_EXTRACT_CONCURRENCY
        assert result.output.metadata["page_count"] == pages
        assert result.output.metadata["engine"] == "pymupdf"

        # 输出字段与原始 ExtractedImage 一致映射
        first = result.output.images[0]
        assert first.image_id.startswith("img_p")
        assert first.filename.endswith(".png")
        assert first.bbox == (1.0, 2.0, 65.0, 50.0)
        assert first.page_number is not None

    @pytest.mark.asyncio
    async def test_concurrency_bounded_by_semaphore(self, tmp_pdf: Path) -> None:
        pages = 12
        fake_fitz = _FakeFitz(pages)
        processor = _ConcurrencyTrackingProcessor(per_page_cost=0.02, images_per_page=1)
        input_data = _make_input(tmp_pdf)

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
            result = await FitzImageExtractor()._run(input_data)

        assert result.success is True
        # peak 可能受调度抖动影响略低于上限，但决不应超过
        assert processor.peak <= _IMAGE_EXTRACT_CONCURRENCY
        # 同时必须 > 1，否则说明退化为串行
        assert processor.peak >= 2

    @pytest.mark.asyncio
    async def test_wall_time_improves_over_sequential(self, tmp_pdf: Path) -> None:
        """总耗时应接近 `ceil(pages / concurrency) * per_page`，远小于顺序。"""
        pages = 8
        per_page = 0.05
        fake_fitz = _FakeFitz(pages)
        processor = _ConcurrencyTrackingProcessor(
            per_page_cost=per_page, images_per_page=1
        )
        input_data = _make_input(tmp_pdf)

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
            t0 = time.perf_counter()
            result = await FitzImageExtractor()._run(input_data)
            elapsed = time.perf_counter() - t0

        assert result.success is True
        # 顺序耗时 = pages * per_page = 0.4s；并发 4 应 ≤ ~0.15s。
        # 放宽上限到顺序耗时的 60%，既留 CI 噪声空间，又能捕获退化。
        assert elapsed < pages * per_page * 0.6, (
            f"并发耗时 {elapsed:.3f}s 未优于顺序基线 {pages * per_page:.3f}s 的 60%"
        )

    @pytest.mark.asyncio
    async def test_respects_page_range(self, tmp_pdf: Path) -> None:
        pages = 10
        fake_fitz = _FakeFitz(pages)
        processor = _ConcurrencyTrackingProcessor(per_page_cost=0.0, images_per_page=1)
        input_data = _make_input(tmp_pdf, page_range=(2, 5))

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
            result = await FitzImageExtractor()._run(input_data)

        assert result.success is True
        # page_range=(2,5) 左闭右开 → 3 页：index 2/3/4
        assert result.output.total_count == 3
        assert {img.page_number for img in result.output.images} == {2, 3, 4}
        assert result.output.metadata["page_count"] == 3

    @pytest.mark.asyncio
    async def test_empty_page_range_yields_empty(self, tmp_pdf: Path) -> None:
        """`page_range=(5,5)` 等空区间应返回空图片列表而非报错。"""
        pages = 10
        fake_fitz = _FakeFitz(pages)
        processor = _ConcurrencyTrackingProcessor(per_page_cost=0.0, images_per_page=1)
        input_data = _make_input(tmp_pdf, page_range=(5, 5))

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
            result = await FitzImageExtractor()._run(input_data)

        assert result.success is True
        assert result.output.total_count == 0
        # 仅做一次探测 open；没有进入任何页抽取
        assert len(fake_fitz.open_calls) == 1

    @pytest.mark.asyncio
    async def test_extraction_exception_reported_as_failure(
        self, tmp_pdf: Path
    ) -> None:
        """任意一页抛异常时 Stage 应返回 success=False，不吞掉错误。"""
        pages = 3
        fake_fitz = _FakeFitz(pages)

        class _BoomProcessor:
            async def extract_images_from_pdf_page(self, *_a, **_kw):
                raise RuntimeError("boom")

        input_data = _make_input(tmp_pdf)

        with (
            patch(
                "negentropy.perceives.pdf._imports.import_fitz",
                return_value=fake_fitz,
            ),
            patch(
                "negentropy.perceives.pdf.enhanced.EnhancedPDFProcessor",
                return_value=_BoomProcessor(),
            ),
        ):
            result = await FitzImageExtractor()._run(input_data)

        assert result.success is False
        assert "boom" in (result.error or "")


class TestConcurrencyResolution:
    """`_resolve_concurrency()` 与 settings 字段的契约。"""

    def test_default_constant_preserved(self) -> None:
        """模块级 ``_IMAGE_EXTRACT_CONCURRENCY`` 保持向后兼容默认值 4。"""
        assert _IMAGE_EXTRACT_CONCURRENCY == 4

    def test_resolve_reads_settings(self, monkeypatch) -> None:
        """settings 中的 ``pdf_image_extraction_concurrency`` 会被读取。"""
        # 移除 monkeypatch 的预设，恢复真实 _resolve_concurrency
        monkeypatch.undo()

        from negentropy.perceives import config as _config_mod
        from negentropy.perceives.pipeline.stages.pdf import (
            image_extraction as _img_mod,
        )

        # 注入 settings.pdf_image_extraction_concurrency = 16 → resolve 应返回 16
        class _FakeSettings:
            pdf_image_extraction_concurrency = 16

        monkeypatch.setattr(_config_mod, "settings", _FakeSettings())
        # 重新调用：_resolve_concurrency 内部 from-import 取最新 settings
        assert _img_mod._resolve_concurrency() == 16

    def test_resolve_falls_back_on_invalid(self, monkeypatch) -> None:
        """settings 字段缺失或异常时回落到 ``_IMAGE_EXTRACT_CONCURRENCY``。"""
        monkeypatch.undo()
        from negentropy.perceives import config as _config_mod
        from negentropy.perceives.pipeline.stages.pdf import (
            image_extraction as _img_mod,
        )

        class _BrokenSettings:
            @property
            def pdf_image_extraction_concurrency(self):
                raise AttributeError("missing")

        monkeypatch.setattr(_config_mod, "settings", _BrokenSettings())
        assert _img_mod._resolve_concurrency() == _IMAGE_EXTRACT_CONCURRENCY

    def test_resolve_clamps_to_at_least_one(self, monkeypatch) -> None:
        """配置值 0 / 负数会被夹到 1，避免 Semaphore(0) 死锁。"""
        monkeypatch.undo()
        from negentropy.perceives import config as _config_mod
        from negentropy.perceives.pipeline.stages.pdf import (
            image_extraction as _img_mod,
        )

        class _ZeroSettings:
            pdf_image_extraction_concurrency = 0

        monkeypatch.setattr(_config_mod, "settings", _ZeroSettings())
        assert _img_mod._resolve_concurrency() == 1


class TestFitzImageExtractorContracts:
    """与原串行实现等价的契约断言。"""

    @pytest.mark.asyncio
    async def test_bbox_absent_when_position_missing(self, tmp_pdf: Path) -> None:
        fake_fitz = _FakeFitz(1)

        class _NoPosProcessor:
            async def extract_images_from_pdf_page(
                self, pdf_document, page_num, image_format="png"
            ):
                return [
                    RawExtracted(
                        id="x",
                        filename="x.png",
                        local_path="/tmp/x.png",
                        base64_data=None,
                        mime_type="image/png",
                        width=10,
                        height=10,
                        page_number=page_num,
                        position=None,
                        caption=None,
                    )
                ]

        input_data = _make_input(tmp_pdf)
        with (
            patch(
                "negentropy.perceives.pdf._imports.import_fitz",
                return_value=fake_fitz,
            ),
            patch(
                "negentropy.perceives.pdf.enhanced.EnhancedPDFProcessor",
                return_value=_NoPosProcessor(),
            ),
        ):
            result = await FitzImageExtractor()._run(input_data)

        assert result.success is True
        assert result.output.images[0].bbox is None
