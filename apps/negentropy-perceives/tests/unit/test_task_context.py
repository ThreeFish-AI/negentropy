"""单元测试：任务上下文 (task_context) 与日志前缀渲染。"""

import asyncio
import logging

import pytest

from negentropy.perceives.core.logging import (
    ColoredFormatter,
    TaskContextFilter,
    _render_task_prefix,
    setup_logging,
)
from negentropy.perceives.core.task_context import (
    TaskTiming,
    bind_pipeline,
    method_var,
    new_task_id,
    pipeline_var,
    stage_var,
    task_id_var,
)


# ── ContextVar 基础 ─────────────────────────────────────────────────────────


class TestContextVarBasics:
    """ContextVar set / reset 与默认值。"""

    def test_task_id_default_is_none(self):
        assert task_id_var.get() is None

    def test_set_and_reset(self):
        tok = task_id_var.set("abc12345")
        assert task_id_var.get() == "abc12345"
        task_id_var.reset(tok)
        assert task_id_var.get() is None

    def test_bind_pipeline_returns_resettable_token(self):
        tok = bind_pipeline("pdf")
        assert pipeline_var.get() == "pdf"
        pipeline_var.reset(tok)
        assert pipeline_var.get() is None


class TestNewTaskId:
    """new_task_id 生成规格。"""

    def test_length_is_8(self):
        assert len(new_task_id()) == 8

    def test_hex_characters_only(self):
        tid = new_task_id()
        assert all(c in "0123456789abcdef" for c in tid)

    def test_unique_across_calls(self):
        ids = {new_task_id() for _ in range(100)}
        assert len(ids) == 100


# ── asyncio.gather 隔离性 ──────────────────────────────────────────────────


class TestAsyncIsolation:
    """stage_var 通过 asyncio.gather 独立拷贝、互不干扰。"""

    @pytest.mark.asyncio
    async def test_stage_isolation_in_gather(self):
        """并行任务各自 set stage_var，互不影响。"""

        async def worker(stage_name: str) -> str:
            tok = stage_var.set(stage_name)
            await asyncio.sleep(0.01)
            value = stage_var.get()
            stage_var.reset(tok)
            return value

        results = await asyncio.gather(
            worker("preprocessing"),
            worker("layout"),
            worker("assembly"),
        )
        assert set(results) == {"preprocessing", "layout", "assembly"}

    @pytest.mark.asyncio
    async def test_task_id_propagates_into_gather(self):
        """父任务 set 的 task_id 自动传播到 gather 子任务。"""

        tok = task_id_var.set("deadbeef")

        async def child() -> str | None:
            return task_id_var.get()

        results = await asyncio.gather(child(), child())
        task_id_var.reset(tok)
        assert results == ["deadbeef", "deadbeef"]

    @pytest.mark.asyncio
    async def test_child_set_does_not_leak_to_parent(self):
        """子任务 set 新值不影响父任务。"""
        parent_tok = task_id_var.set("parent")

        async def child() -> None:
            child_tok = task_id_var.set("child")
            assert task_id_var.get() == "child"
            task_id_var.reset(child_tok)

        await asyncio.gather(child())
        assert task_id_var.get() == "parent"
        task_id_var.reset(parent_tok)


# ── TaskTiming ──────────────────────────────────────────────────────────────


class TestTaskTiming:
    def test_stage_records_default_empty(self):
        t = TaskTiming(start_monotonic=0.0)
        assert t.stage_records == []

    def test_append_and_read(self):
        t = TaskTiming(start_monotonic=0.0)
        t.stage_records.append(("preprocessing", "docling", 12.5, True))
        assert len(t.stage_records) == 1
        assert t.stage_records[0] == ("preprocessing", "docling", 12.5, True)


# ── TaskContextFilter ───────────────────────────────────────────────────────


class TestTaskContextFilter:
    def test_filter_injects_attributes(self):
        task_tok = task_id_var.set("aabbccdd")
        pipeline_tok = pipeline_var.set("pdf")
        stage_tok = stage_var.set("layout")
        method_tok = method_var.set("docling")

        try:
            f = TaskContextFilter()
            record = logging.LogRecord("test", logging.INFO, "", 0, "msg", (), None)
            assert f.filter(record) is True
            assert record.task_id == "aabbccdd"
            assert record.pipeline == "pdf"
            assert record.stage == "layout"
            assert record.method == "docling"
        finally:
            method_var.reset(method_tok)
            stage_var.reset(stage_tok)
            pipeline_var.reset(pipeline_tok)
            task_id_var.reset(task_tok)

    def test_filter_defaults_to_none(self):
        f = TaskContextFilter()
        record = logging.LogRecord("test", logging.INFO, "", 0, "msg", (), None)
        f.filter(record)
        assert record.task_id is None
        assert record.pipeline is None
        assert record.stage is None
        assert record.method is None


# ── _render_task_prefix ─────────────────────────────────────────────────────


class TestRenderTaskPrefix:
    def test_empty_when_no_context(self):
        record = logging.LogRecord("test", logging.INFO, "", 0, "msg", (), None)
        assert _render_task_prefix(record) == ""

    def test_full_prefix(self):
        record = logging.LogRecord("test", logging.INFO, "", 0, "msg", (), None)
        record.task_id = "aabbccdd"
        record.pipeline = "pdf"
        record.stage = "layout"
        record.method = "docling"
        result = _render_task_prefix(record)
        assert result == "[task=aabbccdd pipeline=pdf stage=layout method=docling] "

    def test_partial_prefix(self):
        record = logging.LogRecord("test", logging.INFO, "", 0, "msg", (), None)
        record.task_id = "aabbccdd"
        record.pipeline = "webpage"
        assert _render_task_prefix(record) == "[task=aabbccdd pipeline=webpage] "

    def test_method_only(self):
        record = logging.LogRecord("test", logging.INFO, "", 0, "msg", (), None)
        record.method = "pymupdf"
        assert _render_task_prefix(record) == "[method=pymupdf] "


# ── ColoredFormatter 与任务前缀 ─────────────────────────────────────────────


class TestColoredFormatterWithPrefix:
    def test_non_tty_injects_prefix(self):
        setup_logging("INFO")
        fmt = ColoredFormatter(
            "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        fmt._use_colors = False

        record = logging.LogRecord(
            "negentropy.perceives.ops.pdf",
            logging.INFO,
            "",
            0,
            "Stage 完成",
            (),
            None,
        )
        record.task_id = "aabbccdd"
        record.pipeline = "pdf"
        record.stage = "layout"
        record.method = "docling"

        result = fmt.format(record)
        assert "[task=aabbccdd pipeline=pdf stage=layout method=docling]" in result
        assert "Stage 完成" in result

    def test_non_tty_no_prefix_when_no_context(self):
        setup_logging("INFO")
        fmt = ColoredFormatter(
            "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        fmt._use_colors = False

        record = logging.LogRecord(
            "test.logger", logging.INFO, "", 0, "hello", (), None
        )
        result = fmt.format(record)
        assert "[" not in result.split("test.logger:")[1]

    def test_tty_colored_prefix(self):
        fmt = ColoredFormatter(
            "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        fmt._use_colors = True

        record = logging.LogRecord(
            "negentropy.perceives.ops.pdf",
            logging.INFO,
            "",
            0,
            "Stage 完成",
            (),
            None,
        )
        record.task_id = "aabbccdd"
        record.pipeline = "pdf"

        result = fmt.format(record)
        assert "task=aabbccdd" in result
        assert "pipeline=pdf" in result
        # TTY 模式下前缀被蓝着色
        assert "\033[34m" in result
