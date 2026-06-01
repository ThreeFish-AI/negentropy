"""StreamingEventPersister 单测 — 增量事件持久化核心逻辑（mock DB）。

覆盖：buffer 累积、定时 flush、终端 finalize、幂等性、失败重试、事件行转换。
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from negentropy.engine.routine.streaming_persister import (
    StreamingEventPersister,
    _evt_to_row,
)


def _evt(seq: int, event_type: str = "tool_use", title: str = "Read foo.py") -> dict:
    return {
        "seq": seq,
        "event_type": event_type,
        "tool_name": "Read" if event_type == "tool_use" else None,
        "title": title,
        "payload": {"file_path": "foo.py"},
        "cost_usd": None,
    }


class TestEvtToRow:
    """_evt_to_row 字段截断与默认值。"""

    def test_basic_mapping(self):
        row = _evt_to_row(uuid4(), uuid4(), _evt(0))
        assert row["seq"] == 0
        assert row["event_type"] == "tool_use"
        assert row["tool_name"] == "Read"
        assert row["title"] == "Read foo.py"

    def test_missing_seq_defaults_to_zero(self):
        row = _evt_to_row(uuid4(), uuid4(), {"event_type": "assistant"})
        assert row["seq"] == 0

    def test_long_event_type_truncated_to_24(self):
        row = _evt_to_row(uuid4(), uuid4(), {"seq": 0, "event_type": "a" * 30})
        assert len(row["event_type"]) == 24

    def test_long_title_truncated_to_255(self):
        row = _evt_to_row(uuid4(), uuid4(), {"seq": 0, "event_type": "x", "title": "t" * 300})
        assert len(row["title"]) == 255

    def test_long_tool_name_truncated_to_128(self):
        row = _evt_to_row(uuid4(), uuid4(), {"seq": 0, "event_type": "x", "tool_name": "T" * 200})
        assert len(row["tool_name"]) == 128

    def test_null_fields_stay_null(self):
        row = _evt_to_row(uuid4(), uuid4(), {"seq": 0})
        assert row["tool_name"] is None
        assert row["title"] is None


class TestBuffer:
    """buffer() 同步追加行为。"""

    def test_buffer_accumulates(self):
        p = StreamingEventPersister(uuid4(), uuid4())
        p.buffer(_evt(0))
        p.buffer(_evt(1))
        p.buffer(_evt(2))
        assert len(p._buffer) == 3
        assert p._buffer[0]["seq"] == 0
        assert p._buffer[2]["seq"] == 2

    def test_buffer_after_finalize_is_noop(self):
        p = StreamingEventPersister(uuid4(), uuid4())
        # finalize without start → still marks finalized
        asyncio.get_event_loop().run_until_complete(p.finalize())
        p.buffer(_evt(0))
        assert len(p._buffer) == 0


class TestFlush:
    """_flush 增量 DB 写入。"""

    @pytest.mark.asyncio
    async def test_flush_writes_pending_events(self):
        p = StreamingEventPersister(uuid4(), uuid4())
        p.buffer(_evt(0))
        p.buffer(_evt(1))

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        # 模拟 async with
        mock_session_ctx = AsyncMock()
        mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_session_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.routine.streaming_persister.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value = mock_session_ctx
            await p._flush()

        mock_db.execute.assert_called_once()
        assert p._flushed_up_to == 2

    @pytest.mark.asyncio
    async def test_flush_on_empty_buffer_is_noop(self):
        p = StreamingEventPersister(uuid4(), uuid4())
        with patch("negentropy.engine.routine.streaming_persister.db_session") as mock_db_mod:
            await p._flush()
        mock_db_mod.AsyncSessionLocal.assert_not_called()
        assert p._flushed_up_to == 0

    @pytest.mark.asyncio
    async def test_flush_failure_does_not_advance_counter(self):
        p = StreamingEventPersister(uuid4(), uuid4())
        p.buffer(_evt(0))

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=RuntimeError("connection lost"))
        mock_db.commit = AsyncMock()
        mock_session_ctx = AsyncMock()
        mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_session_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.routine.streaming_persister.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value = mock_session_ctx
            await p._flush()  # should NOT raise

        assert p._flushed_up_to == 0  # not advanced

    @pytest.mark.asyncio
    async def test_flush_failure_then_success_retries(self):
        p = StreamingEventPersister(uuid4(), uuid4())
        p.buffer(_evt(0))
        p.buffer(_evt(1))

        # 第一次 flush 失败
        mock_db_fail = AsyncMock()
        mock_db_fail.execute = AsyncMock(side_effect=RuntimeError("timeout"))
        mock_db_fail.commit = AsyncMock()
        ctx_fail = AsyncMock()
        ctx_fail.__aenter__ = AsyncMock(return_value=mock_db_fail)
        ctx_fail.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.routine.streaming_persister.db_session") as mod:
            mod.AsyncSessionLocal.return_value = ctx_fail
            await p._flush()
        assert p._flushed_up_to == 0

        # 第二次 flush 成功
        mock_db_ok = AsyncMock()
        mock_db_ok.execute = AsyncMock()
        mock_db_ok.commit = AsyncMock()
        ctx_ok = AsyncMock()
        ctx_ok.__aenter__ = AsyncMock(return_value=mock_db_ok)
        ctx_ok.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.routine.streaming_persister.db_session") as mod:
            mod.AsyncSessionLocal.return_value = ctx_ok
            await p._flush()
        assert p._flushed_up_to == 2

    @pytest.mark.asyncio
    async def test_flush_only_writes_unflushed_portion(self):
        """增量 flush：仅刷入新增事件，不重复已刷入的。"""
        p = StreamingEventPersister(uuid4(), uuid4())
        p.buffer(_evt(0))
        p.buffer(_evt(1))

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_db)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.routine.streaming_persister.db_session") as mod:
            mod.AsyncSessionLocal.return_value = ctx
            await p._flush()
        assert p._flushed_up_to == 2

        # 追加新事件
        p.buffer(_evt(2))
        mock_db2 = AsyncMock()
        mock_db2.execute = AsyncMock()
        mock_db2.commit = AsyncMock()
        ctx2 = AsyncMock()
        ctx2.__aenter__ = AsyncMock(return_value=mock_db2)
        ctx2.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.routine.streaming_persister.db_session") as mod:
            mod.AsyncSessionLocal.return_value = ctx2
            await p._flush()
        assert p._flushed_up_to == 3
        # 第二次 flush 仅写入了 1 条（seq=2）——通过 flushed_up_to 增量验证


class TestFinalize:
    """finalize 幂等性与终端 flush。"""

    @pytest.mark.asyncio
    async def test_finalize_flushes_remaining(self):
        p = StreamingEventPersister(uuid4(), uuid4())
        p.buffer(_evt(0))

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_db)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.routine.streaming_persister.db_session") as mod:
            mod.AsyncSessionLocal.return_value = ctx
            await p.finalize()

        assert p._flushed_up_to == 1
        assert p._finalized is True

    @pytest.mark.asyncio
    async def test_finalize_idempotent(self):
        p = StreamingEventPersister(uuid4(), uuid4())

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_db)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.routine.streaming_persister.db_session") as mod:
            mod.AsyncSessionLocal.return_value = ctx
            await p.finalize()
            await p.finalize()  # 二次调用不应报错

        # flush 仅执行一次（空缓冲区 flush 不会调 DB）
        mock_db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_finalize_cancels_background_task(self):
        p = StreamingEventPersister(uuid4(), uuid4(), flush_interval_seconds=999)
        p.start()
        assert p._task is not None
        await p.finalize()
        assert p._task is None


class TestFlushLoop:
    """后台定时 flush。"""

    @pytest.mark.asyncio
    async def test_timer_fires_and_flushes(self):
        p = StreamingEventPersister(uuid4(), uuid4(), flush_interval_seconds=0.05)
        p.buffer(_evt(0))

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_db)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.routine.streaming_persister.db_session") as mod:
            mod.AsyncSessionLocal.return_value = ctx
            p.start()
            await asyncio.sleep(0.15)  # 等待至少一次 flush
            await p.finalize()

        assert p._flushed_up_to >= 1

    @pytest.mark.asyncio
    async def test_start_without_start_no_flush(self):
        """未 start() 时无后台 flush，finalize 仍能终端刷入。"""
        p = StreamingEventPersister(uuid4(), uuid4())
        p.buffer(_evt(0))

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_db)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.routine.streaming_persister.db_session") as mod:
            mod.AsyncSessionLocal.return_value = ctx
            # 不 start，直接 finalize
            await p.finalize()

        assert p._flushed_up_to == 1
