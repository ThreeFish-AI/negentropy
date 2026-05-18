"""集成测试：任务级超时 + 结构化日志端到端。

验证 ops 层的 `asyncio.timeout` 包裹与 pipeline context 绑定，
以及日志前缀在完整调用链中正确传播。
"""

import asyncio
import logging
import time
from unittest.mock import AsyncMock, patch

import pytest

from negentropy.perceives.core.logging import setup_logging
from negentropy.perceives.core.task_context import (
    TaskTiming,
    new_task_id,
    pipeline_var,
    task_id_var,
    timing_var,
)
from negentropy.perceives.ops.pdf import parse_pdf_to_markdown
from negentropy.perceives.ops.markdown import parse_webpage_to_markdown


@pytest.fixture(autouse=True)
def _init_logging():
    """确保日志体系已初始化（含 TaskContextFilter）。"""
    setup_logging("DEBUG")


# ── 超时行为 ───────────────────────────────────────────────────────────────


class TestTaskTimeout:
    """验证 asyncio.timeout 在 ops 层正确触发。"""

    @pytest.mark.asyncio
    async def test_pdf_timeout_returns_error_response(self):
        """超时时返回 PDFResponse(success=False, error 含 '任务超时')。"""

        async def _slow_pipeline(*args, **kwargs):
            await asyncio.sleep(60)
            return {"success": True}

        with (
            patch(
                "negentropy.perceives.ops.pdf.try_pipeline",
                new_callable=AsyncMock,
            ) as mock_try_pipeline,
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
            ) as mock_create_processor,
        ):
            mock_try_pipeline.side_effect = _slow_pipeline
            mock_processor = AsyncMock()
            mock_processor.process_pdf.return_value = {"success": True}
            mock_create_processor.return_value = mock_processor

            result = await parse_pdf_to_markdown(
                pdf_source="/tmp/test.pdf",
                method="auto",
                timeout=1,
            )

        assert result.success is False
        assert "任务超时" in result.error
        assert "1 秒" in result.error

    @pytest.mark.asyncio
    async def test_webpage_timeout_returns_error_response(self):
        """超时时返回 MarkdownResponse(success=False, error 含 '任务超时')。"""

        async def _slow_scrape(**kwargs):
            await asyncio.sleep(60)

        with (
            patch(
                "negentropy.perceives.ops.markdown.WebScraper",
            ) as MockScraper,
            patch(
                "negentropy.perceives.ops.markdown.MarkdownConverter",
            ),
        ):
            scraper = MockScraper.return_value
            scraper.scrape_url = _slow_scrape

            result = await parse_webpage_to_markdown(
                url="https://example.com",
                method="simple",
                web_scraper=scraper,
                markdown_converter=MockScraper.return_value,
                timeout=1,
            )

        assert result.success is False
        assert "任务超时" in result.error

    @pytest.mark.asyncio
    async def test_pdf_normal_completion_under_timeout(self):
        """正常完成的调用不受超时影响。"""

        with (
            patch(
                "negentropy.perceives.ops.pdf.try_pipeline",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
            ) as mock_create,
        ):
            mock_proc = AsyncMock()
            mock_proc.process_pdf.return_value = {
                "success": True,
                "content": "# Test",
                "metadata": {},
                "word_count": 5,
            }
            mock_create.return_value = mock_proc

            result = await parse_pdf_to_markdown(
                pdf_source="/tmp/test.pdf",
                method="auto",
                timeout=300,
            )

        assert result.success is True


# ── Pipeline Context 传播 ──────────────────────────────────────────────────


class TestPipelineContextPropagation:
    """验证 pipeline_var 在 ops 层正确绑定与释放。"""

    @pytest.mark.asyncio
    async def test_pipeline_var_set_during_pdf_ops(self):
        """PDF ops 执行期间 pipeline_var 为 'pdf'。"""

        captured_pipeline = None

        async def _capture_pipeline(*args, **kwargs):
            nonlocal captured_pipeline
            captured_pipeline = pipeline_var.get()
            return None

        with (
            patch(
                "negentropy.perceives.ops.pdf.try_pipeline",
                new_callable=AsyncMock,
                side_effect=_capture_pipeline,
            ),
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
            ) as mock_create,
        ):
            mock_proc = AsyncMock()
            mock_proc.process_pdf.return_value = {
                "success": True,
                "content": "# Test",
                "metadata": {},
                "word_count": 5,
            }
            mock_create.return_value = mock_proc

            await parse_pdf_to_markdown(
                pdf_source="/tmp/test.pdf",
                method="auto",
                timeout=60,
            )

        assert captured_pipeline == "pdf"

    @pytest.mark.asyncio
    async def test_pipeline_var_reset_after_pdf_ops(self):
        """PDF ops 完成后 pipeline_var 恢复为 None。"""

        with (
            patch(
                "negentropy.perceives.ops.pdf.try_pipeline",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "negentropy.perceives.ops.pdf.create_pdf_processor",
            ) as mock_create,
        ):
            mock_proc = AsyncMock()
            mock_proc.process_pdf.return_value = {
                "success": True,
                "content": "# Test",
                "metadata": {},
                "word_count": 5,
            }
            mock_create.return_value = mock_proc

            await parse_pdf_to_markdown(
                pdf_source="/tmp/test.pdf",
                method="auto",
                timeout=60,
            )

        assert pipeline_var.get() is None


# ── 日志前缀传播 ──────────────────────────────────────────────────────────


class TestLogPrefixPropagation:
    """验证日志行在完整调用链中携带 task 前缀。"""

    @pytest.mark.asyncio
    async def test_pdf_ops_logs_carry_task_prefix(self, caplog):
        """PDF ops 执行中的日志行携带 [task=… pipeline=pdf] 前缀。"""
        caplog.set_level(logging.INFO, logger="negentropy.perceives.ops.pdf")

        task_id = new_task_id()
        task_tok = task_id_var.set(task_id)

        try:
            with (
                patch(
                    "negentropy.perceives.ops.pdf.try_pipeline",
                    new_callable=AsyncMock,
                    return_value=None,
                ),
                patch(
                    "negentropy.perceives.ops.pdf.create_pdf_processor",
                ) as mock_create,
            ):
                mock_proc = AsyncMock()
                mock_proc.process_pdf.return_value = {
                    "success": True,
                    "content": "# Test",
                    "metadata": {},
                    "word_count": 5,
                }
                mock_create.return_value = mock_proc

                await parse_pdf_to_markdown(
                    pdf_source="/tmp/test.pdf",
                    method="auto",
                    timeout=60,
                )

            # 验证日志行中至少有一条携带 task_id
            pdf_logs = [
                r for r in caplog.records if r.name == "negentropy.perceives.ops.pdf"
            ]
            assert len(pdf_logs) > 0, "应至少产生一条 ops.pdf 日志"
            matching = [
                r
                for r in pdf_logs
                if getattr(r, "task_id", None) == task_id
                and getattr(r, "pipeline", None) == "pdf"
            ]
            assert len(matching) > 0, (
                f"应至少一条日志携带 task_id={task_id} pipeline=pdf，"
                f"实际：{[vars(r) for r in pdf_logs]}"
            )
        finally:
            task_id_var.reset(task_tok)

    @pytest.mark.asyncio
    async def test_stage_records_populated_in_timing(self):
        """Orchestrator _execute_stage 正确追加 timing.stage_records。"""
        from negentropy.perceives.pipeline.base import StageResult
        from negentropy.perceives.pipeline.orchestrator import PipelineOrchestrator

        task_id = new_task_id()
        task_tok = task_id_var.set(task_id)
        pipeline_tok = pipeline_var.set("pdf")
        timing = TaskTiming(start_monotonic=time.monotonic())
        timing_tok = timing_var.set(timing)

        try:
            with patch.object(
                PipelineOrchestrator,
                "__init__",
                lambda self, *a, **kw: None,
            ):
                orch = PipelineOrchestrator.__new__(PipelineOrchestrator)
                orch._engine_gates = {}
                orch._defaults = {}
                orch._pipeline_name = ""
                orch._scheduler = AsyncMock()
                orch._judge = None

            # Mock scheduler
            mock_result = StageResult(
                success=True, output="# test", engine_used="docling"
            )
            mock_result.elapsed_ms = 42.0
            orch._scheduler.run_stage = AsyncMock(return_value=mock_result)

            stage_cfg = {
                "name": "layout",
                "tools": [],
                "competition_mode": False,
            }

            result = await orch._execute_stage(stage_cfg, "input_data")
            assert result.success is True

            # 验证 timing 中有一条 stage 记录
            assert len(timing.stage_records) == 1
            stage_name, method, elapsed, success = timing.stage_records[0]
            assert stage_name == "layout"
            assert method == "docling"
            assert success is True
        finally:
            timing_var.reset(timing_tok)
            pipeline_var.reset(pipeline_tok)
            task_id_var.reset(task_tok)


# ── 中间件辅助函数 ─────────────────────────────────────────────────────────


class TestFormatStageSummary:
    """验证 _format_stage_summary 拼接格式。"""

    def test_empty_records(self):
        from negentropy.perceives.tools._middleware import _format_stage_summary

        timing = TaskTiming(start_monotonic=0.0)
        assert _format_stage_summary(timing) == "(no-stage)"

    def test_single_stage(self):
        from negentropy.perceives.tools._middleware import _format_stage_summary

        timing = TaskTiming(start_monotonic=0.0)
        timing.stage_records.append(("layout", "docling", 42.0, True))
        result = _format_stage_summary(timing)
        assert result == "layout(docling,42ms,ok)"

    def test_multiple_stages(self):
        from negentropy.perceives.tools._middleware import _format_stage_summary

        timing = TaskTiming(start_monotonic=0.0)
        timing.stage_records.append(("preprocessing", "-", 0.1, False))
        timing.stage_records.append(("layout", "docling", 100.0, True))
        result = _format_stage_summary(timing)
        assert result == "preprocessing(-,0ms,fail)→layout(docling,100ms,ok)"
