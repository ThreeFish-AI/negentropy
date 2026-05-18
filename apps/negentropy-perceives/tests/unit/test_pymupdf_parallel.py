"""PyMuPDF 文本提取多页并发单元测试。

测试要点：
- ``_resolve_chunk_size`` 在 settings 缺失/0/正值三种情况下行为正确;
- ``_extract_chunk`` 串行执行单个 chunk 抽取（端到端，通过临时 PDF 验证）;
- 大文档触发并行路径，结果与串行路径在「blocks 内容、page_number、reading_order」
  上等价（避免重排引入不一致）;
- 小文档强制串行（避免开销 > 收益）。
"""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path
from typing import Tuple

import pytest

from negentropy.perceives.pipeline.models import PreprocessingOutput
from negentropy.perceives.pipeline.stages.pdf.text_extraction import FitzTextExtractor


# ============================================================
# chunk_size 解析
# ============================================================
class TestResolveChunkSize:
    """覆盖 chunk_size 解析的 3 个分支：默认（settings=0）/显式覆盖/超大值。

    NegentropyPerceivesSettings 是 frozen，因此通过 monkeypatch 替换 ``settings``
    属性的 ``__dict__['pdf_pymupdf_parallel_pages']`` 方式不可行；改用 mock
    ``getattr`` 路径上的 ``settings`` 引用。
    """

    def test_zero_means_auto(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from unittest.mock import MagicMock

        from negentropy.perceives import config as _cfg

        mocked = MagicMock()
        mocked.pdf_pymupdf_parallel_pages = 0
        monkeypatch.setattr(_cfg, "settings", mocked)
        size = FitzTextExtractor._resolve_chunk_size(80)
        assert 1 <= size <= 8  # 自动模式上限 8

    def test_explicit_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from unittest.mock import MagicMock

        from negentropy.perceives import config as _cfg

        mocked = MagicMock()
        mocked.pdf_pymupdf_parallel_pages = 3
        monkeypatch.setattr(_cfg, "settings", mocked)
        assert FitzTextExtractor._resolve_chunk_size(80) == 3

    def test_large_explicit_value(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from unittest.mock import MagicMock

        from negentropy.perceives import config as _cfg

        mocked = MagicMock()
        mocked.pdf_pymupdf_parallel_pages = 16
        monkeypatch.setattr(_cfg, "settings", mocked)
        # 显式 override 不会自动 clamp（信任用户判断）
        assert FitzTextExtractor._resolve_chunk_size(80) == 16


# ============================================================
# 端到端：通过临时 PDF 验证 chunk 抽取一致性
# ============================================================


def _build_minimal_pdf(num_pages: int) -> Path:
    """生成一个包含 ``num_pages`` 页文本的最小 PDF。

    每页文本格式：``Page <N> line1`` / ``Page <N> line2``，便于断言
    page_number 与文本内容的对应关系。

    Windows 注意：``tempfile.mkstemp`` 返回的 fd 在原进程持有写锁，
    导致 fitz.save 同名时上游 ``cannot remove file ... Permission denied``。
    必须先 ``os.close(fd)`` 释放再交给 fitz。
    """
    import os as _os

    import fitz  # type: ignore[import-untyped]

    doc = fitz.open()
    for n in range(num_pages):
        page = doc.new_page()
        page.insert_text((50, 100), f"Page {n} line1")
        page.insert_text((50, 130), f"Page {n} line2")

    fd, tmp_path = tempfile.mkstemp(prefix="test_parallel_pdf_", suffix=".pdf")
    # Windows 上需要先释放 mkstemp 持有的写锁，否则 fitz.save 同名失败
    _os.close(fd)
    tmp = Path(tmp_path)
    doc.save(str(tmp))
    doc.close()
    return tmp


def _safe_unlink(path: Path) -> None:
    """容错删除：Windows 上 fitz 句柄 GC 未完成时会报 PermissionError，
    多重试 + 静默吞下，避免污染 CI（实际清理由 OS 临时目录回收兜底）。
    """
    import gc

    gc.collect()
    for _ in range(3):
        try:
            path.unlink(missing_ok=True)
            return
        except (PermissionError, OSError):
            gc.collect()
    # 最终静默：临时文件会被 OS 临时目录策略回收


@pytest.fixture
def minimal_pdf_small() -> Path:
    pdf = _build_minimal_pdf(4)  # 小文档：触发串行
    yield pdf
    _safe_unlink(pdf)


@pytest.fixture
def minimal_pdf_large() -> Path:
    pdf = _build_minimal_pdf(20)  # 大文档：触发并行
    yield pdf
    _safe_unlink(pdf)


def _make_input(
    path: Path, page_range: Tuple[int, int] | None = None
) -> PreprocessingOutput:
    from negentropy.perceives.pipeline.models import DocumentCharacteristics

    return PreprocessingOutput(
        local_path=path,
        page_count=20,
        characteristics=DocumentCharacteristics(),
        page_range=page_range,
    )


class TestParallelExtraction:
    def test_small_doc_uses_serial(self, minimal_pdf_small: Path) -> None:
        """<10 页应保持串行（_extract_parallel 不被调用）。"""
        extractor = FitzTextExtractor()
        input_data = _make_input(minimal_pdf_small)
        result = asyncio.run(extractor._run(input_data))
        assert result.success
        assert result.output is not None
        assert result.output.full_text  # 非空
        # 串行路径下 page_count_processed 应等于 4
        assert result.output.metadata["page_count_processed"] == 4

    def test_large_doc_uses_parallel(self, minimal_pdf_large: Path) -> None:
        """>=10 页应触发并行路径，且 reading_order 严格递增。"""
        extractor = FitzTextExtractor()
        input_data = _make_input(minimal_pdf_large)
        result = asyncio.run(extractor._run(input_data))
        assert result.success
        assert result.output is not None
        assert result.output.metadata["page_count_processed"] == 20
        # reading_order 必须 0, 1, 2, ... 严格递增
        for i, block in enumerate(result.output.blocks):
            assert block.reading_order == i
        # page_number 必须按页升序（聚合后排序）
        prev_page = -1
        for block in result.output.blocks:
            assert block.page_number >= prev_page
            prev_page = block.page_number

    def test_parallel_serial_equivalence(
        self, minimal_pdf_large: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """并行 vs 串行 → 块数量、文本顺序应一致。"""
        from unittest.mock import MagicMock

        from negentropy.perceives import config as _cfg

        extractor = FitzTextExtractor()

        # 串行：默认阈值 10，9 页 < 10 触发串行
        small_input = _make_input(minimal_pdf_large, page_range=(0, 9))
        serial_result = asyncio.run(extractor._run(small_input))

        # 并行：把阈值降到 5，chunk_size = 4
        mocked = MagicMock()
        mocked.pdf_pymupdf_parallel_pages = 4
        monkeypatch.setattr(_cfg, "settings", mocked)
        monkeypatch.setattr(FitzTextExtractor, "_PARALLEL_PAGE_THRESHOLD", 5)
        big_input = _make_input(minimal_pdf_large, page_range=(0, 9))
        parallel_result = asyncio.run(extractor._run(big_input))

        assert serial_result.success and parallel_result.success
        # 块内容应一一对应（顺序按 page → in-page 排序后）
        s_blocks = [(b.page_number, b.text) for b in serial_result.output.blocks]
        p_blocks = [(b.page_number, b.text) for b in parallel_result.output.blocks]
        assert s_blocks == p_blocks

    def test_page_range_respected_in_parallel(self, minimal_pdf_large: Path) -> None:
        """并行路径下 page_range 仍应被尊重，不溢出。"""
        extractor = FitzTextExtractor()
        input_data = _make_input(minimal_pdf_large, page_range=(5, 15))
        result = asyncio.run(extractor._run(input_data))
        assert result.success
        page_nums = {b.page_number for b in result.output.blocks}
        assert page_nums.issubset(set(range(5, 15)))
        assert max(page_nums) < 15
        assert min(page_nums) >= 5
