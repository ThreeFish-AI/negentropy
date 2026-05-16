"""SessionTitleInspector — 周期巡检 Session 自动标题

定位（与 PostgresSessionService 的反应式触发互补）：
- 反应式触发：用户首条消息追加时由 ``append_event`` 调度，覆盖**新**会话首次成标题。
- 巡检：周期扫描全表，补齐历史 / 失败 / 默认前缀 session；当 auto 标题对应的事件数
  显著增长后也会刷新一次，避免标题与最新对话脱节。

设计要点：
1. **共用持久化路径**：直接调用 ``PostgresSessionService._generate_title_for_session``
   完成实际工作，所有 metadata 写入与跳过判定都在那里，保持单一事实源。
2. **候选筛选下推 Postgres**：单条 SQL + JSONB 操作完成过滤，巡检 Python 侧零全表扫描。
3. **多 worker 安全**：每 session 一把 Postgres advisory lock，非阻塞 try-lock，
   失败即跳过，不阻塞用户 PATCH 改名（advisory lock 与行可见性正交）。
4. **失败退避**：``title_attempt_count >= max_attempts`` 的 session 自动移出候选池。
5. **手动 / legacy 保护**：``title_source = 'manual'`` 永不覆盖；``title`` 存在但
   ``title_source`` 缺失的 legacy 行保守视为 manual。
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass

from sqlalchemy import text

import negentropy.db.session as db_session
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.title_inspector")


@dataclass(frozen=True)
class TitleCandidate:
    """巡检候选 session 的最小信息。"""

    session_id: uuid.UUID
    max_event_seq: int
    title_generated_at_event_seq: int
    has_title: bool


# 候选筛选 SQL（Postgres 侧过滤，巡检 Python 侧零全表扫描）。
#
# 关键过滤：
# - archived 为 false（不修复归档会话）
# - title_source 缺省视为 'auto'（兼容尚未设置 source 的全新会话）
# - title_attempt_count < :max_attempts（退避）
# - 至少有 :min_events 条事件（避免空会话生成空洞标题）
# - 标题为空或缺失 OR 事件数已增长 >= :refresh_delta（刷新条件）
#
# 备注：legacy 行（有 title 无 title_source）在 HAVING 子句中会被 title 非空与
# refresh_delta 两条件共同截留——它们的 title_generated_at_event_seq 缺省视为 0，
# 但 _title_skip_reason 在反应路径中会再次拦截，二次确保不被覆盖。
_CANDIDATE_SQL = text(
    """
    SELECT
        t.id::text                                                          AS session_id,
        COALESCE(MAX(e.sequence_num), 0)                                    AS max_seq,
        COALESCE((t.metadata->>'title_generated_at_event_seq')::int, 0)     AS gen_seq,
        ((t.metadata->>'title') IS NOT NULL AND (t.metadata->>'title') <> '') AS has_title
    FROM negentropy.threads t
    LEFT JOIN negentropy.events e ON e.thread_id = t.id
    WHERE COALESCE((t.metadata->>'archived')::bool, false) = false
      AND COALESCE((t.metadata->>'title_source'), 'auto') = 'auto'
      AND COALESCE((t.metadata->>'title_attempt_count')::int, 0) < :max_attempts
    GROUP BY t.id
    HAVING COUNT(e.id) >= :min_events
       AND (
            (t.metadata->>'title') IS NULL OR (t.metadata->>'title') = ''
         OR COALESCE(MAX(e.sequence_num), 0)
            - COALESCE((t.metadata->>'title_generated_at_event_seq')::int, 0)
            >= :refresh_delta
       )
    ORDER BY (t.metadata->>'title') NULLS FIRST, COALESCE(MAX(e.sequence_num), 0) DESC
    LIMIT :batch_size
    """
)


class SessionTitleInspector:
    """周期性会话标题巡检任务。

    使用方式（见 ``engine/bootstrap.py``）：
        inspector = SessionTitleInspector(...)
        scheduler.register(
            key="session_title_inspector",
            callback=inspector.tick,
            interval_seconds=settings.services.session_title_inspect_interval,
        )
    """

    def __init__(
        self,
        *,
        concurrency: int = 2,
        batch_size: int = 20,
        min_events: int = 1,
        refresh_event_delta: int = 20,
        max_attempts: int = 5,
        session_service=None,
    ) -> None:
        self.concurrency = max(1, int(concurrency))
        self.batch_size = max(1, int(batch_size))
        self.min_events = max(0, int(min_events))
        self.refresh_event_delta = max(1, int(refresh_event_delta))
        self.max_attempts = max(1, int(max_attempts))
        # DI 入口：测试可注入独立 PostgresSessionService 实例，避免与共享单例
        # 状态（如其他测试的 mock 注入或缓存）耦合。生产路径不传，tick 时通过
        # ``get_session_service()`` 走单例工厂。
        self._session_service_override = session_service

    async def tick(self) -> None:
        """一次调度心跳：扫描候选 → 为每个 session 生成或刷新标题。

        ``AsyncScheduler`` 已为本回调提供时间门控与单实例互斥（``job.running`` flag），
        我们在这里只需关心**单进程内并发限流**与**多进程互斥**（advisory lock）。
        """
        from negentropy.engine.adapters.postgres.session_service import (
            PostgresSessionService,
        )

        if self._session_service_override is not None:
            session_service = self._session_service_override
        else:
            from negentropy.engine.factories.session import get_session_service

            session_service = get_session_service()
        if not isinstance(session_service, PostgresSessionService):
            logger.debug(
                "title_inspector_skipped_non_postgres_backend",
                backend=type(session_service).__name__,
            )
            return

        candidates = await self._find_candidates()
        if not candidates:
            logger.debug("title_inspector_no_candidates")
            return

        logger.info("title_inspector_tick_started", candidate_count=len(candidates))

        sem = asyncio.Semaphore(self.concurrency)

        async def _bounded(candidate: TitleCandidate) -> None:
            async with sem:
                await self._process_candidate(candidate, session_service)

        results = await asyncio.gather(
            *(_bounded(c) for c in candidates),
            return_exceptions=True,
        )
        # 异常聚合上报（候选间相互独立，单 session 失败不应阻断整批）
        errors = [r for r in results if isinstance(r, Exception)]
        logger.info(
            "title_inspector_tick_completed",
            candidate_count=len(candidates),
            error_count=len(errors),
        )
        for err in errors:
            logger.warning(
                "title_inspector_candidate_failed",
                error_type=type(err).__name__,
                error=str(err),
            )

    async def _find_candidates(self) -> list[TitleCandidate]:
        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                _CANDIDATE_SQL,
                {
                    "max_attempts": self.max_attempts,
                    "min_events": self.min_events,
                    "refresh_delta": self.refresh_event_delta,
                    "batch_size": self.batch_size,
                },
            )
            rows = result.mappings().all()
        return [
            TitleCandidate(
                session_id=uuid.UUID(row["session_id"]),
                max_event_seq=int(row["max_seq"]),
                title_generated_at_event_seq=int(row["gen_seq"]),
                has_title=bool(row["has_title"]),
            )
            for row in rows
        ]

    async def _process_candidate(self, candidate: TitleCandidate, session_service) -> None:
        sid_str = str(candidate.session_id)
        force_refresh = candidate.has_title and (
            candidate.max_event_seq - candidate.title_generated_at_event_seq >= self.refresh_event_delta
        )

        lock_key = self._lock_key_for_session(candidate.session_id)
        # 注意：advisory lock 必须在独立连接上，以便跨整段生成（含 LLM 调用 ~1-3s）持有；
        # ``_generate_title_for_session`` 会自行开新连接处理读写，两者不冲突。
        async with db_session.AsyncSessionLocal() as lock_conn:
            got = (
                await lock_conn.execute(
                    text("SELECT pg_try_advisory_lock(:k)"),
                    {"k": lock_key},
                )
            ).scalar()
            if not got:
                logger.debug(
                    "title_inspector_lock_held_elsewhere",
                    session_id=sid_str,
                )
                return
            try:
                logger.debug(
                    "title_inspector_processing",
                    session_id=sid_str,
                    force_refresh=force_refresh,
                    has_title=candidate.has_title,
                    max_event_seq=candidate.max_event_seq,
                )
                await session_service._generate_title_for_session(
                    sid_str,
                    force_refresh=force_refresh,
                )
            finally:
                await lock_conn.execute(
                    text("SELECT pg_advisory_unlock(:k)"),
                    {"k": lock_key},
                )
                await lock_conn.commit()

    @staticmethod
    def _lock_key_for_session(session_id: uuid.UUID) -> int:
        """将 UUID 映射为 64-bit signed int 供 ``pg_*_advisory_lock`` 使用。

        取 UUID 前 8 字节，big-endian、signed 解析，落入 ``[-2^63, 2^63-1]``，
        命中 Postgres BIGINT 类型。冲突概率约 1/2^64（uuid4 前 8 字节随机），
        在百万级 session 量下仍远低于其他失败路径。
        """
        return int.from_bytes(session_id.bytes[:8], "big", signed=True)


__all__ = ["SessionTitleInspector", "TitleCandidate"]
