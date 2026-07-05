"""StreamingEventPersister — 迭代执行期间的增量动作事件持久化。

职责：在 Claude Code 执行长耗时迭代期间，每隔数秒将已捕获的动作事件增量写回 DB，
使前端 reload 后仍能看到「已完成」部分的审计步骤（而非仅在终端写回时一次性落库）。

生命周期：``start()`` → 多次 ``buffer(evt)`` → ``finalize()``（终端 flush + 清理）。
``finalize`` 后实例不可再用。

设计约束：
- ``buffer`` 为同步追加（非阻塞），由 ``_emit_events`` 的 ``on_event`` 回调调用。
- ``_flush`` 使用短生命周期 DB session（与 Runner 其它路径一致）。
- DB 写入失败不终止执行：失败的事件留在缓冲区，下次 flush 或 ``finalize`` 重试。
- ``ON CONFLICT (iteration_id, seq) DO NOTHING`` 保证与终端写回 ``_persist_events``
  完全幂等。

参考文献：
[1] PostgreSQL Docs, *INSERT ... ON CONFLICT DO NOTHING*, 2024. 幂等 upsert。
"""

from __future__ import annotations

import asyncio
from contextlib import suppress
from typing import Any
from uuid import UUID

from sqlalchemy.dialects.postgresql import insert as pg_insert

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.routine import RoutineIterationEvent

logger = get_logger("negentropy.engine.routine.streaming_persister")

# 单字段截断上限（与 runner._persist_events / service._EVENT_FIELD_CAP 一致）
_FIELD_CAP = 16 * 1024


class StreamingEventPersister:
    """缓冲动作事件并定期增量刷入 DB。

    用法::

        p = StreamingEventPersister(iteration_id, routine_id)
        p.start()                          # 启动后台 flush 定时器
        # ... 执行期间，on_event 回调调用 p.buffer(evt) ...
        await p.finalize()                 # 终端 flush + 停止定时器
    """

    def __init__(
        self,
        iteration_id: UUID,
        routine_id: UUID,
        flush_interval_seconds: float = 30.0,
    ) -> None:
        self._iteration_id = iteration_id
        self._routine_id = routine_id
        self._flush_interval = flush_interval_seconds
        self._buffer: list[dict[str, Any]] = []
        self._flushed_up_to: int = 0  # _buffer 中已成功刷入 DB 的事件下标
        self._task: asyncio.Task | None = None
        self._finalized = False

    # ------------------------------------------------------------------
    # 公开 API
    # ------------------------------------------------------------------

    def start(self) -> None:
        """启动后台 flush 定时器（asyncio.Task）。仅调用一次。"""
        if self._finalized:
            return
        self._task = asyncio.create_task(self._flush_loop(), name=f"streaming-persister-{self._iteration_id}")

    def buffer(self, evt: dict[str, Any]) -> None:
        """追加事件到内存缓冲（同步，非阻塞）。

        由 ``_make_action_sink`` 闭包在 ``on_event`` 回调中调用。
        ``evt`` 应携带 ``seq``（由 ``_emit_events`` 按到达顺序定格）。
        """
        if self._finalized:
            return
        self._buffer.append(evt)

    async def finalize(self) -> None:
        """终端 flush + 取消定时器。幂等（多次调用安全）。"""
        if self._finalized:
            return
        self._finalized = True
        if self._task is not None:
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        # 终端 flush：将所有未刷入的事件落库
        await self._flush()

    @property
    def flushed_count(self) -> int:
        """已成功刷入 DB 的事件数（仅供测试/监控）。"""
        return self._flushed_up_to

    # ------------------------------------------------------------------
    # 内部实现
    # ------------------------------------------------------------------

    async def _flush_loop(self) -> None:
        """后台定时器：每隔 ``_flush_interval`` 秒刷一次。"""
        while not self._finalized:
            try:
                await asyncio.sleep(self._flush_interval)
            except asyncio.CancelledError:
                return  # finalize() 取消了我们；它自己会做终端 flush
            await self._flush()

    async def _flush(self) -> None:
        """将缓冲区中未刷入的事件批量写入 DB。

        失败不抛错、不前移游标：下次 flush 或 finalize 会重试。
        ``ON CONFLICT (iteration_id, seq) DO NOTHING`` 与终端写回幂等。
        """
        pending = self._buffer[self._flushed_up_to :]
        if not pending:
            return
        rows = [_evt_to_row(self._iteration_id, self._routine_id, e) for e in pending]
        try:
            async with db_session.AsyncSessionLocal() as db:
                stmt = (
                    pg_insert(RoutineIterationEvent)
                    .values(rows)
                    .on_conflict_do_nothing(index_elements=["iteration_id", "seq"])
                )
                await db.execute(stmt)
                await db.commit()
            self._flushed_up_to += len(pending)
        except Exception:
            logger.warning(
                "streaming_persister_flush_failed",
                iteration_id=str(self._iteration_id),
                pending_count=len(pending),
                exc_info=True,
            )
            # 不前移游标，下次重试


# ------------------------------------------------------------------
# 工具函数（与 runner._persist_events 行逻辑一致，提取为共享函数）
# ------------------------------------------------------------------


def _evt_to_row(iteration_id: UUID, routine_id: UUID, evt: dict[str, Any]) -> dict[str, Any]:
    """单条事件 dict → DB 行 dict（含字段截断保护）。"""
    title = evt.get("title")
    tool_name = evt.get("tool_name")
    agent_role = evt.get("agent_role")
    return {
        "iteration_id": iteration_id,
        "routine_id": routine_id,
        "seq": int(evt.get("seq", 0)),
        "event_type": str(evt.get("event_type") or "unknown")[:24],
        "tool_name": str(tool_name)[:128] if tool_name is not None else None,
        "title": str(title)[:255] if title is not None else None,
        "payload": evt.get("payload") or {},
        "cost_usd": evt.get("cost_usd"),
        "agent_role": str(agent_role)[:32] if agent_role is not None else None,
    }


__all__ = ["StreamingEventPersister"]
