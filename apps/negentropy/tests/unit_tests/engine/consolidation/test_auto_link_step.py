"""Tests for AutoLinkStep.

T2 加固：补齐冒烟级覆盖 —— 空输入跳过、DB 拉取失败→failed、
单条关联失败不影响其余（output_count 反映成功数）、全部成功。
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from negentropy.engine.consolidation.pipeline.steps.auto_link_step import AutoLinkStep

from .conftest import _new_ctx


def _fake_memory(mid=None):
    m = MagicMock()
    m.id = mid or uuid4()
    m.thread_id = uuid4()
    m.embedding = [0.1] * 8
    m.created_at = None
    return m


def _patch_session_returning(memories):
    """构造一个 patch，使 AutoLinkStep 内 db 查询返回给定 memories。"""
    fake_db = MagicMock()
    result = MagicMock()
    scalars = MagicMock()
    scalars.all.return_value = memories
    result.scalars.return_value = scalars
    fake_db.execute = AsyncMock(return_value=result)

    @asynccontextmanager
    async def _cm():
        yield fake_db

    return patch(
        "negentropy.engine.consolidation.pipeline.steps.auto_link_step.db_session.AsyncSessionLocal",
        return_value=_cm(),
    )


class TestAutoLinkStep:
    async def test_skipped_when_no_new_memory_ids(self):
        step = AutoLinkStep()
        ctx = _new_ctx()
        result = await step.run(ctx)
        assert result.status == "skipped"
        assert result.output_count == 0

    async def test_failed_when_db_fetch_raises(self):
        """拉取新记忆抛错 → status=failed。"""
        ctx = _new_ctx()
        ctx.new_memory_ids = [uuid4()]

        @asynccontextmanager
        async def _boom():
            raise RuntimeError("db down")
            yield  # pragma: no cover

        with patch(
            "negentropy.engine.consolidation.pipeline.steps.auto_link_step.db_session.AsyncSessionLocal",
            return_value=_boom(),
        ):
            step = AutoLinkStep()
            result = await step.run(ctx)

        assert result.status == "failed"
        assert result.error

    async def test_partial_failure_counts_survivors(self):
        """一条关联抛错，其余成功 → output_count 只计成功条数。"""
        ctx = _new_ctx()
        mems = [_fake_memory(), _fake_memory(), _fake_memory()]
        ctx.new_memory_ids = [m.id for m in mems]

        call_count = {"n": 0}

        async def _auto_link(**kwargs):
            call_count["n"] += 1
            if call_count["n"] == 2:  # 第二条失败
                raise RuntimeError("link failed")

        fake_assoc = MagicMock()
        fake_assoc.auto_link_memory = AsyncMock(side_effect=_auto_link)

        with (
            _patch_session_returning(mems),
            patch(
                "negentropy.engine.factories.memory.get_association_service",
                return_value=fake_assoc,
            ),
        ):
            step = AutoLinkStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 2  # 3 条中 1 条失败 → 2 条成功

    async def test_all_links_succeed(self):
        ctx = _new_ctx()
        mems = [_fake_memory(), _fake_memory()]
        ctx.new_memory_ids = [m.id for m in mems]

        fake_assoc = MagicMock()
        fake_assoc.auto_link_memory = AsyncMock()

        with (
            _patch_session_returning(mems),
            patch(
                "negentropy.engine.factories.memory.get_association_service",
                return_value=fake_assoc,
            ),
        ):
            step = AutoLinkStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 2
        assert fake_assoc.auto_link_memory.await_count == 2
