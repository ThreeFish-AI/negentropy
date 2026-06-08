"""``ops.pdf.parse_pdf_to_markdown`` —— auto_batch 路径单元测试。

锁定 R9 ``auto_batch`` 调度契约：

- 小 PDF / auto_batch=False / 显式 page_range 一律走原单次 Pipeline 路径
  （既有 1604 单测 0 退化的最小保证）。
- 大 PDF 自动进入 ``_run_batched_pipeline`` 分批分支：串行调度 + 单切片
  重试 + checkpoint 持久化 + 跨切片合并。
- 全切片失败 → ``PDFResponse(success=False)``；至少 1 切片成功 → ``success=True``
  且 ``error`` 反映 partial 状态。
- ``resume=True`` 时跳过磁盘上已完成的切片 checkpoint；config 不匹配
  （不同 PDF / 不同 batch_size）时自动清除旧 checkpoint。

测试通过 monkeypatch ``run_pdf_pipeline`` + ``detect_pdf_total_pages``
完全屏蔽真实 Pipeline，单测在毫秒级完成。
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import List, Optional, Tuple

import pytest

from negentropy.perceives.ops import pdf as pdf_ops
from negentropy.perceives.pipeline.models import ImageAsset, PipelineResult


# ---------------------------------------------------------------------------
# 测试基础设施
# ---------------------------------------------------------------------------


def _state_dir_for(tmp_path: Path, pdf_source: str = "/tmp/fake.pdf") -> Path:
    """计算预期 checkpoint state_dir，与 ``_resolve_batch_state_dir`` 保持同步。

    ``_resolve_batch_state_dir`` 始终以 PDF 内容 SHA-1 前 12 字符（不存在的文件
    回退到 ``Path(pdf_source).stem``）作为最后一级子目录，从而保证同 ``output_dir``
    下不同 PDF 之间天然隔离。
    """
    cid = pdf_ops._stable_checkpoint_id(pdf_source)
    return tmp_path / ".batch_state" / cid


def _ok_pipeline_result(
    markdown: str = "stub markdown",
    word_count: int = 100,
    images_count: int = 0,
    image_assets: Optional[List[ImageAsset]] = None,
) -> PipelineResult:
    return PipelineResult(
        success=True,
        markdown=markdown,
        word_count=word_count,
        images_count=images_count,
        tables_count=0,
        formulas_count=0,
        code_blocks_count=0,
        engines_used=["docling"],
        image_assets=image_assets or [],
        metadata={"title": "stub"},
    )


def _failed_pipeline_result(error: str = "stub error") -> PipelineResult:
    return PipelineResult(success=False, error=error)


class _PipelineCallLog:
    """记录 ``run_pdf_pipeline`` 调用参数的辅助 fixture。"""

    def __init__(self) -> None:
        self.calls: List[dict] = []

    def make_stub(self, results: List[PipelineResult]):
        """构造按顺序返回 results 列表的 async stub；超出长度时返回失败。"""
        idx = {"i": 0}

        async def stub(
            *,
            source: str,
            page_range: Optional[Tuple[int, int]] = None,
            extract_images: bool = True,
            extract_tables: bool = True,
            extract_formulas: bool = True,
            embed_images: bool = False,
            output_dir: Optional[str] = None,
        ) -> PipelineResult:
            self.calls.append(
                {
                    "source": source,
                    "page_range": page_range,
                    "extract_images": extract_images,
                    "extract_tables": extract_tables,
                    "extract_formulas": extract_formulas,
                    "embed_images": embed_images,
                    "output_dir": output_dir,
                }
            )
            i = idx["i"]
            idx["i"] += 1
            if i < len(results):
                return results[i]
            return _failed_pipeline_result("超出 stub 长度")

        return stub


@pytest.fixture
def stub_attempt_pipeline(monkeypatch):
    """让 attempt_pipeline 直接调用其 run_pdf_pipeline 参数（无 retry + log）。"""

    async def passthrough(fn, *, success_check, **kwargs):
        result = await fn(**kwargs)
        return result if success_check(result) else None

    monkeypatch.setattr(pdf_ops, "attempt_pipeline", passthrough)


# ---------------------------------------------------------------------------
# parse_pdf_to_markdown 入口分支
# ---------------------------------------------------------------------------


class TestAutoBatchEntryBranches:
    """``parse_pdf_to_markdown`` 入口的 auto_batch 分支判定。"""

    def test_auto_batch_disabled_uses_single_path(
        self, monkeypatch, tmp_path, stub_attempt_pipeline
    ) -> None:
        """``auto_batch=False`` → 不调 _run_batched_pipeline，走单次。"""
        called = {"single": 0, "batched": 0}

        log = _PipelineCallLog()
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub([_ok_pipeline_result()]),
        )
        # detect_pdf_total_pages 返回大页数也无效（auto_batch=False）
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.batch_merge.detect_pdf_total_pages",
            lambda src: 200,
        )

        async def trap_batched(**kwargs):
            called["batched"] += 1
            return None

        monkeypatch.setattr(pdf_ops, "_run_batched_pipeline", trap_batched)

        pdf = tmp_path / "x.pdf"
        pdf.write_bytes(b"%PDF-1.4")
        resp = asyncio.run(
            pdf_ops.parse_pdf_to_markdown(
                pdf_source=str(pdf),
                auto_batch=False,
            )
        )
        assert called["batched"] == 0
        assert resp.success is True

    def test_total_pages_below_threshold_uses_single_path(
        self, monkeypatch, tmp_path, stub_attempt_pipeline
    ) -> None:
        """页数 <= threshold → 不进入分批分支。"""
        log = _PipelineCallLog()
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub([_ok_pipeline_result()]),
        )
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.batch_merge.detect_pdf_total_pages",
            lambda src: 50,  # 小于默认阈值 60
        )

        called = {"batched": 0}

        async def trap_batched(**kwargs):
            called["batched"] += 1
            return None

        monkeypatch.setattr(pdf_ops, "_run_batched_pipeline", trap_batched)

        pdf = tmp_path / "x.pdf"
        pdf.write_bytes(b"%PDF-1.4")
        asyncio.run(pdf_ops.parse_pdf_to_markdown(pdf_source=str(pdf)))
        assert called["batched"] == 0

    def test_explicit_page_range_bypasses_batching(
        self, monkeypatch, tmp_path, stub_attempt_pipeline
    ) -> None:
        """显式 page_range → 屏蔽 auto_batch，单次切片。"""
        log = _PipelineCallLog()
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub([_ok_pipeline_result()]),
        )
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.batch_merge.detect_pdf_total_pages",
            lambda src: 200,
        )

        called = {"batched": 0}

        async def trap_batched(**kwargs):
            called["batched"] += 1
            return None

        monkeypatch.setattr(pdf_ops, "_run_batched_pipeline", trap_batched)

        pdf = tmp_path / "x.pdf"
        pdf.write_bytes(b"%PDF-1.4")
        asyncio.run(
            pdf_ops.parse_pdf_to_markdown(
                pdf_source=str(pdf),
                page_range=[0, 30],
            )
        )
        assert called["batched"] == 0

    def test_above_threshold_invokes_batched_path(self, monkeypatch, tmp_path) -> None:
        """页数 > threshold + auto_batch=True + 无 page_range → 进入分批分支。"""
        captured = {"called": 0, "kwargs": None}

        async def stub_batched(**kwargs):
            captured["called"] += 1
            captured["kwargs"] = kwargs
            from negentropy.perceives.models import PDFResponse

            return PDFResponse(
                success=True,
                pdf_source=kwargs["pdf_source"],
                method="pipeline_auto_batch",
                output_format=kwargs["output_format"],
                content="batched merged",
                conversion_time=0.1,
            )

        monkeypatch.setattr(pdf_ops, "_run_batched_pipeline", stub_batched)
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.batch_merge.detect_pdf_total_pages",
            lambda src: 200,
        )

        pdf = tmp_path / "x.pdf"
        pdf.write_bytes(b"%PDF-1.4")
        resp = asyncio.run(pdf_ops.parse_pdf_to_markdown(pdf_source=str(pdf)))
        assert captured["called"] == 1
        assert captured["kwargs"]["total_pages"] == 200
        assert captured["kwargs"]["batch_size"] == pdf_ops.DEFAULT_BATCH_PAGE_SIZE
        assert resp.content == "batched merged"


# ---------------------------------------------------------------------------
# _run_batched_pipeline 调度
# ---------------------------------------------------------------------------


class TestRunBatchedPipeline:
    """``_run_batched_pipeline`` —— 串行调度 + 重试 + checkpoint。"""

    def test_serial_invocations_in_order(self, monkeypatch, tmp_path) -> None:
        """3 切片 → 3 次 run_pdf_pipeline 调用，page_range 顺序与切片对齐。"""
        log = _PipelineCallLog()
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub(
                [
                    _ok_pipeline_result(markdown="A"),
                    _ok_pipeline_result(markdown="B"),
                    _ok_pipeline_result(markdown="C"),
                ]
            ),
        )

        resp = asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source="/tmp/fake.pdf",
                output_format="markdown",
                total_pages=100,
                batch_size=40,
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                output_dir=str(tmp_path),
                start_time=0.0,
                resume=False,
            )
        )
        assert resp is not None
        assert resp.success is True
        assert [c["page_range"] for c in log.calls] == [
            (0, 40),
            (40, 80),
            (80, 100),
        ]
        # markdown 合并后包含 3 段
        assert "A" in (resp.content or "")
        assert "B" in (resp.content or "")
        assert "C" in (resp.content or "")

    def test_slice_failure_triggers_retry(self, monkeypatch, tmp_path) -> None:
        """单切片首次失败时重试 1 次；二次成功则切片视为成功。"""
        log = _PipelineCallLog()
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub(
                [
                    _failed_pipeline_result("first attempt failed"),
                    _ok_pipeline_result(markdown="retried"),
                ]
            ),
        )

        resp = asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source="/tmp/fake.pdf",
                output_format="markdown",
                total_pages=30,
                batch_size=40,
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                output_dir=str(tmp_path),
                start_time=0.0,
                resume=False,
            )
        )
        assert resp.success is True
        # 应有 2 次调用（1 次失败 + 1 次重试）
        assert len(log.calls) == 2
        assert "retried" in (resp.content or "")

    def test_all_slices_fail_returns_failure(self, monkeypatch, tmp_path) -> None:
        """所有切片均失败 → success=False + error 列出每切片。"""
        log = _PipelineCallLog()
        # 每切片 2 次 attempt 都失败 → 共 4 次失败（2 切片）
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub(
                [
                    _failed_pipeline_result("s0a1"),
                    _failed_pipeline_result("s0a2"),
                    _failed_pipeline_result("s1a1"),
                    _failed_pipeline_result("s1a2"),
                ]
            ),
        )

        resp = asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source="/tmp/fake.pdf",
                output_format="markdown",
                total_pages=60,
                batch_size=40,
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                output_dir=str(tmp_path),
                start_time=0.0,
                resume=False,
            )
        )
        assert resp.success is False
        assert resp.error is not None
        assert "所有切片均失败" in resp.error

    def test_partial_success_returns_success_with_error_note(
        self, monkeypatch, tmp_path
    ) -> None:
        """1 切片成功 + 1 切片失败 → success=True，error 注明 partial。"""
        log = _PipelineCallLog()
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub(
                [
                    _ok_pipeline_result(markdown="first"),
                    _failed_pipeline_result("s1a1"),
                    _failed_pipeline_result("s1a2"),
                ]
            ),
        )

        resp = asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source="/tmp/fake.pdf",
                output_format="markdown",
                total_pages=60,
                batch_size=40,
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                output_dir=str(tmp_path),
                start_time=0.0,
                resume=False,
            )
        )
        assert resp.success is True
        assert "first" in (resp.content or "")
        assert resp.error is not None
        assert "partial" in resp.error.lower()
        assert resp.enhanced_assets is not None
        assert len(resp.enhanced_assets["partial_failures"]) == 1

    def test_slice_timeout_marked_partial_and_continues(
        self, monkeypatch, tmp_path
    ) -> None:
        """单切片超时 → 标记 partial failure 并继续后续切片；超时切片不写 checkpoint。

        逐批超时（per_slice_timeout）是本次大 PDF 修复的核心保护：某切片处理
        超时后不应拖垮整个批处理，而是记录失败 marker 并继续，已完成切片的
        checkpoint 保留以支持断点续传。
        """
        # slice_0 阻塞超过 per_slice_timeout → 触发 asyncio.TimeoutError；
        # slice_1 正常返回。通过把 per_slice_timeout 降到极小值快速触发。
        monkeypatch.setattr(pdf_ops, "DEFAULT_PER_SLICE_TIMEOUT_SECONDS", 0.05)

        call_ranges: List[Tuple[int, int]] = []

        async def stub(*, source, page_range, **kwargs):
            call_ranges.append(page_range)
            if page_range == (0, 40):
                await asyncio.sleep(5)  # 远超 0.05s 预算 → 超时
                return _ok_pipeline_result(markdown="should-not-reach")
            return _ok_pipeline_result(markdown="slice-1-ok")

        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            stub,
        )

        resp = asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source="/tmp/fake.pdf",
                output_format="markdown",
                total_pages=60,
                batch_size=40,
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                output_dir=str(tmp_path),
                start_time=0.0,
                resume=False,
                total_timeout_seconds=3600,
            )
        )

        # slice_0 超时但 slice_1 成功 → 整体 partial success
        assert resp.success is True
        assert "slice-1-ok" in (resp.content or "")
        assert resp.error is not None
        assert resp.enhanced_assets is not None
        partial = resp.enhanced_assets["partial_failures"]
        assert len(partial) == 1
        assert "timed out" in partial[0]["error"]

        # 超时切片仅写 failure marker（slice_0.json status=failed，无 markdown），
        # 成功切片写完整 checkpoint（slice_1.json + slice_1.markdown.txt）。
        # 断点续传时 _load_slice_checkpoint 见超时切片无 markdown → 返回 None 重处理。
        state_dir = _state_dir_for(tmp_path)
        assert not (state_dir / "slice_0.markdown.txt").exists()
        slice0_meta = json.loads(
            (state_dir / "slice_0.json").read_text(encoding="utf-8")
        )
        assert slice0_meta["status"] == "failed"
        assert (state_dir / "slice_1.json").exists()
        assert (state_dir / "slice_1.markdown.txt").exists()


# ---------------------------------------------------------------------------
# Checkpoint / Resume
# ---------------------------------------------------------------------------


class TestCheckpointResume:
    """checkpoint 持久化与 resume 跳过完成切片。"""

    def test_checkpoint_files_persisted_after_success(
        self, monkeypatch, tmp_path
    ) -> None:
        """切片成功后 .batch_state/slice_{i}.json 与 markdown 文件落盘。"""
        log = _PipelineCallLog()
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub(
                [
                    _ok_pipeline_result(markdown="content-0"),
                    _ok_pipeline_result(markdown="content-1"),
                ]
            ),
        )

        asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source="/tmp/fake.pdf",
                output_format="markdown",
                total_pages=60,
                batch_size=40,
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                output_dir=str(tmp_path),
                start_time=0.0,
                resume=True,
            )
        )
        state_dir = _state_dir_for(tmp_path)
        assert (state_dir / "manifest.json").exists()
        assert (state_dir / "slice_0.json").exists()
        assert (state_dir / "slice_0.markdown.txt").exists()
        assert (state_dir / "slice_1.json").exists()
        assert (state_dir / "slice_1.markdown.txt").exists()

        # manifest 最终状态为 completed
        manifest = json.loads((state_dir / "manifest.json").read_text(encoding="utf-8"))
        assert manifest["status"] == "completed"

    def test_resume_skips_completed_slice(self, monkeypatch, tmp_path) -> None:
        """resume=True 时已有 slice_0 checkpoint → 仅调用 1 次（slice_1）。"""
        # 先伪造 slice_0 checkpoint（落到 PDF-content-keyed 子目录）
        state_dir = _state_dir_for(tmp_path)
        state_dir.mkdir(parents=True)
        (state_dir / "manifest.json").write_text(
            json.dumps(
                {
                    "pdf_source": "/tmp/fake.pdf",
                    "total_pages": 60,
                    "batch_size": 40,
                    "slice_ranges": [[0, 40], [40, 60]],
                    "status": "running",
                }
            ),
            encoding="utf-8",
        )
        (state_dir / "slice_0.markdown.txt").write_text(
            "resumed-content-0", encoding="utf-8"
        )
        (state_dir / "slice_0.json").write_text(
            json.dumps(
                {
                    "index": 0,
                    "page_start": 0,
                    "page_end": 40,
                    "status": "ok",
                    "word_count": 50,
                    "images_count": 0,
                    "tables_count": 0,
                    "formulas_count": 0,
                    "code_blocks_count": 0,
                    "engines_used": ["docling"],
                    "image_assets": [],
                    "metadata": {},
                }
            ),
            encoding="utf-8",
        )

        log = _PipelineCallLog()
        # 只期望 1 次调用：slice_1
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub([_ok_pipeline_result(markdown="fresh-1")]),
        )

        resp = asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source="/tmp/fake.pdf",
                output_format="markdown",
                total_pages=60,
                batch_size=40,
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                output_dir=str(tmp_path),
                start_time=0.0,
                resume=True,
            )
        )
        assert resp.success is True
        # 验证 resume：slice_0 走 checkpoint，slice_1 走 fresh
        assert "resumed-content-0" in (resp.content or "")
        assert "fresh-1" in (resp.content or "")
        # 只有 slice_1 走了真实 pipeline 调用（page_range=(40,60)）
        assert len(log.calls) == 1
        assert log.calls[0]["page_range"] == (40, 60)

    def test_config_mismatch_invalidates_checkpoint(
        self, monkeypatch, tmp_path
    ) -> None:
        """旧 manifest 的 batch_size 不匹配 → 清除 checkpoint，全切片重跑。"""
        state_dir = _state_dir_for(tmp_path)
        state_dir.mkdir(parents=True)
        (state_dir / "manifest.json").write_text(
            json.dumps(
                {
                    "pdf_source": "/tmp/fake.pdf",
                    "total_pages": 60,
                    "batch_size": 30,  # 故意不匹配
                    "slice_ranges": [[0, 30], [30, 60]],
                    "status": "running",
                }
            ),
            encoding="utf-8",
        )
        # 故意留一个看似可 resume 的 checkpoint
        (state_dir / "slice_0.markdown.txt").write_text("stale", encoding="utf-8")
        (state_dir / "slice_0.json").write_text(
            json.dumps(
                {
                    "index": 0,
                    "page_start": 0,
                    "page_end": 30,
                    "status": "ok",
                    "word_count": 1,
                    "engines_used": [],
                    "image_assets": [],
                    "metadata": {},
                }
            ),
            encoding="utf-8",
        )

        log = _PipelineCallLog()
        # 新配置 batch_size=40 → 2 切片全跑
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub(
                [
                    _ok_pipeline_result(markdown="fresh-0"),
                    _ok_pipeline_result(markdown="fresh-1"),
                ]
            ),
        )

        resp = asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source="/tmp/fake.pdf",
                output_format="markdown",
                total_pages=60,
                batch_size=40,  # 与旧 manifest 不匹配
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                output_dir=str(tmp_path),
                start_time=0.0,
                resume=True,
            )
        )
        assert resp.success is True
        # 旧 stale 内容不应出现
        assert "stale" not in (resp.content or "")
        assert len(log.calls) == 2

    def test_resume_disabled_reruns_all_slices(self, monkeypatch, tmp_path) -> None:
        """resume=False → 即便 checkpoint 存在也不复用。"""
        state_dir = _state_dir_for(tmp_path)
        state_dir.mkdir(parents=True)
        (state_dir / "slice_0.markdown.txt").write_text("old", encoding="utf-8")
        (state_dir / "slice_0.json").write_text(
            json.dumps({"status": "ok"}), encoding="utf-8"
        )

        log = _PipelineCallLog()
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log.make_stub([_ok_pipeline_result(markdown="fresh")]),
        )

        resp = asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source="/tmp/fake.pdf",
                output_format="markdown",
                total_pages=30,
                batch_size=40,
                extract_images=True,
                extract_tables=True,
                extract_formulas=True,
                embed_images=False,
                output_dir=str(tmp_path),
                start_time=0.0,
                resume=False,
            )
        )
        assert resp.success is True
        assert "fresh" in (resp.content or "")
        # 必然有真实调用（不复用 checkpoint）
        assert len(log.calls) == 1

    def test_different_pdfs_keep_separate_checkpoints(
        self, monkeypatch, tmp_path
    ) -> None:
        """同 ``output_dir`` 下不同 PDF 的 checkpoint 必须天然隔离。

        回归保护：早期实现中 ``_resolve_batch_state_dir`` 在显式提供
        ``output_dir`` 时不带 PDF 标识，使得相同 ``total_pages + batch_size``
        的不同 PDF 互相误用 checkpoint，merge 后返回与请求 PDF 不一致的内容。
        修复后 ``_resolve_batch_state_dir`` 始终以 PDF 内容 SHA-1 前缀作为
        最后一级子目录；本用例锁定该行为。
        """
        # 落两份不同内容的 PDF 字节，使 _stable_checkpoint_id 走真实哈希路径
        pdf_a = tmp_path / "doc_a.pdf"
        pdf_b = tmp_path / "doc_b.pdf"
        pdf_a.write_bytes(b"%PDF-1.4 alpha-content")
        pdf_b.write_bytes(b"%PDF-1.4 beta-content")
        shared_output = tmp_path / "shared"
        shared_output.mkdir()

        # PDF A：写入两片，落 checkpoint
        log_a = _PipelineCallLog()
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log_a.make_stub(
                [
                    _ok_pipeline_result(markdown="alpha-0"),
                    _ok_pipeline_result(markdown="alpha-1"),
                ]
            ),
        )
        resp_a = asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source=str(pdf_a),
                output_format="markdown",
                total_pages=60,
                batch_size=40,
                extract_images=False,
                extract_tables=False,
                extract_formulas=False,
                embed_images=False,
                output_dir=str(shared_output),
                start_time=0.0,
                resume=True,
            )
        )
        assert resp_a.success is True
        assert "alpha-0" in (resp_a.content or "")

        # PDF B：相同 total_pages + batch_size + output_dir，但 PDF 内容不同
        log_b = _PipelineCallLog()
        monkeypatch.setattr(
            "negentropy.perceives.pipeline.run_pdf_pipeline",
            log_b.make_stub(
                [
                    _ok_pipeline_result(markdown="beta-0"),
                    _ok_pipeline_result(markdown="beta-1"),
                ]
            ),
        )
        resp_b = asyncio.run(
            pdf_ops._run_batched_pipeline(
                pdf_source=str(pdf_b),
                output_format="markdown",
                total_pages=60,
                batch_size=40,
                extract_images=False,
                extract_tables=False,
                extract_formulas=False,
                embed_images=False,
                output_dir=str(shared_output),
                start_time=0.0,
                resume=True,
            )
        )
        assert resp_b.success is True
        # B 必须独立跑、独立返回，不应被 A 的 checkpoint 污染
        assert "beta-0" in (resp_b.content or "")
        assert "beta-1" in (resp_b.content or "")
        assert "alpha-0" not in (resp_b.content or "")
        assert "alpha-1" not in (resp_b.content or "")
        assert len(log_b.calls) == 2

        # checkpoint 目录应分别落在两个 cid 子目录下
        cid_a = pdf_ops._stable_checkpoint_id(str(pdf_a))
        cid_b = pdf_ops._stable_checkpoint_id(str(pdf_b))
        assert cid_a != cid_b
        assert (shared_output / ".batch_state" / cid_a / "manifest.json").exists()
        assert (shared_output / ".batch_state" / cid_b / "manifest.json").exists()


# ---------------------------------------------------------------------------
# MCP 工具签名兼容（tools/pdf.py）
# ---------------------------------------------------------------------------


def test_default_constants_are_documented_values() -> None:
    """auto_batch 默认参数与 tools/pdf.py 工具签名默认值对齐。

    动态比对工具签名默认值（而非硬编码数字），确保 ops 常量与对外 MCP 工具
    契约始终一致——修改默认分批策略时无需同步两处魔数。
    """
    import inspect

    from negentropy.perceives.tools import pdf as pdf_tools

    sig = inspect.signature(pdf_tools.parse_pdf_to_markdown)
    assert pdf_ops.DEFAULT_BATCH_PAGE_SIZE == sig.parameters["batch_page_size"].default
    assert (
        pdf_ops.DEFAULT_BATCH_THRESHOLD_PAGES
        == sig.parameters["batch_threshold_pages"].default
    )
    # 逐批超时常量须为正整数（5 分钟基线，保障每批充足处理时间）
    assert pdf_ops.DEFAULT_PER_SLICE_TIMEOUT_SECONDS > 0
