"""``negentropy backfill-session-titles`` —— 存量无语义 auto 会话标题的一次性治理。

定位（与生成侧质量门禁、巡检三者协同）：
- 生成侧 ``summarization.is_semantically_vacant_title`` 在源头拒绝写回无语义标题；
- 本 CLI 负责清理**已卡死**的历史坏标题——这些标题 ``title_source="auto"`` 且记录了
  ``title_generated_at_event_seq``，但所在短会话事件增量永远达不到巡检刷新阈值
  （默认 20），永久不进刷新候选池，无任何自愈路径。
- 清空后该 session 回到「无标题 fresh-auto」状态，巡检下一 tick 自然重新生成
  （此时已受生成侧质量门禁保护）。

设计要点：
1. **单一事实源**：vacant 判定一律调用 ``summarization.is_semantically_vacant_title``，
   绝不在本文件镜像黑名单。
2. **永不碰 manual / legacy**：扫描 SQL 硬过滤 ``COALESCE(title_source,'auto')='auto'``；
   清空 UPDATE WHERE 二次校验同谓词，并发期间被用户改 manual 则 0 row 命中、放弃。
3. **与在线 PATCH / 巡检互斥**：每条清空前后持 per-session advisory lock
   （复用 ``SessionTitleInspector._lock_key_for_session``），非阻塞 try-lock，拿不到即跳过。
4. **keyset 分页**：按 ``id`` 游标翻页，稳定不受其他行 update/delete 影响。
5. **幂等**：清空后 title 变 NULL，扫描条件不再命中；严禁 ``DELETE`` 行。
6. **默认 dry-run**：``--apply`` 才写库。

部署时序硬约束：生成侧质量门禁必须先于 ``--apply`` 上线，否则清空后巡检仍会再次生成坏标题。

用法：
    uv run python -m negentropy.cli_backfill_titles backfill-session-titles            # dry-run
    uv run python -m negentropy.cli_backfill_titles backfill-session-titles --apply    # 写库
    uv run python -m negentropy.cli_backfill_titles backfill-session-titles --apply --user <uid> --limit 50
"""

from __future__ import annotations

import argparse
import asyncio
import uuid

from sqlalchemy import text

from negentropy.engine.summarization import is_semantically_vacant_title
from negentropy.logging import get_logger

logger = get_logger("negentropy.cli_backfill_titles")

# 清空 auto 标题时一并移除的溯源字段（与 update_session_title(title=None) 同款 metadata 形状，
# 保持巡检把它视为 fresh-auto 候选）。
_CLEAR_KEYS = (
    "title",
    "title_source",
    "title_generated_at_event_seq",
    "title_generated_at",
    "title_attempt_count",
    "title_last_attempt_at",
)


def _build_keys_deletion_sql() -> str:
    """构造 ``metadata - 'k1' - 'k2' - ...`` 的链式 jsonb 删除表达式。"""
    expr = "metadata"
    for key in _CLEAR_KEYS:
        expr += f" - '{key}'"
    return expr


_SCAN_SQL_TEMPLATE = """
        SELECT t.id::text AS session_id,
               t.app_name,
               t.user_id,
               t.metadata->>'title' AS title
        FROM negentropy.threads t
        WHERE COALESCE((t.metadata->>'archived')::bool, false) = false
          AND COALESCE((t.metadata->>'title_source'), 'auto') = 'auto'
          AND (t.metadata->>'title') IS NOT NULL
          AND (t.metadata->>'title') <> ''
"""

_CLEAR_SQL = text(
    f"""
        UPDATE negentropy.threads
        SET metadata = {_build_keys_deletion_sql()},
            updated_at = NOW()
        WHERE id = CAST(:sid AS uuid)
          AND COALESCE((metadata->>'title_source'), 'auto') = 'auto'
    """
)


async def _scan_batch(db, *, last_id: str | None, batch_size: int, user_id: str | None):
    sql = _SCAN_SQL_TEMPLATE
    params: dict[str, object] = {"batch_size": batch_size}
    if last_id is not None:
        sql += "  AND t.id > CAST(:last_id AS uuid)\n"
        params["last_id"] = last_id
    if user_id is not None:
        sql += "  AND t.user_id = :user_id\n"
        params["user_id"] = user_id
    sql += "  ORDER BY t.id ASC\n  LIMIT :batch_size"
    result = await db.execute(text(sql), params)
    return result.all()


async def _clear_one(session_id: str) -> str:
    """清空单个 session 的 auto 标题，per-session advisory lock + title_source 护栏。

    返回值：「cleared」成功清空；「skipped_manual」并发期间被改 manual（0 row）；「locked」拿不到锁跳过。
    """
    import negentropy.db.session as db_session
    from negentropy.engine.title_inspector import SessionTitleInspector

    sid_uuid = uuid.UUID(session_id)
    lock_key = SessionTitleInspector._lock_key_for_session(sid_uuid)

    async with db_session.AsyncSessionLocal() as conn:
        got = (await conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": lock_key})).scalar()
        if not got:
            return "locked"
        try:
            result = await conn.execute(_CLEAR_SQL, {"sid": session_id})
            await conn.commit()
            return "cleared" if (result.rowcount or 0) > 0 else "skipped_manual"
        finally:
            await conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": lock_key})
            await conn.commit()


async def _run_backfill(args: argparse.Namespace) -> None:
    import negentropy.db.session as db_session

    apply_mode = bool(args.apply)
    limit = int(args.limit or 0)
    batch_size = max(1, int(args.batch_size))
    sleep_between = max(0.0, float(args.sleep_between_batches))
    user_id = args.user

    mode_label = "APPLY（写库）" if apply_mode else "DRY-RUN（只读，零写库）"
    print(
        f"▶ 会话标题存量治理 [{mode_label}]  batch_size={batch_size}"
        f"  limit={'∞' if limit == 0 else limit}"
        f"  user={user_id or '全部'}"
        f"  sleep={sleep_between}s",
        flush=True,
    )

    last_id: str | None = None
    scanned = 0
    vacant_hits = 0
    cleared = 0
    skipped_manual = 0
    locked = 0
    samples: list[tuple[str, str, str]] = []
    user_dist: dict[str, int] = {}

    while True:
        async with db_session.AsyncSessionLocal() as db:
            rows = await _scan_batch(db, last_id=last_id, batch_size=batch_size, user_id=user_id)

        if not rows:
            break

        for row in rows:
            last_id = row.session_id
            scanned += 1
            title = row.title or ""
            if not is_semantically_vacant_title(title):
                continue

            vacant_hits += 1
            user_dist[row.user_id] = user_dist.get(row.user_id, 0) + 1
            if len(samples) < 20:
                samples.append((row.session_id, title, row.user_id))

            if apply_mode:
                outcome = await _clear_one(row.session_id)
                if outcome == "cleared":
                    cleared += 1
                    logger.info(
                        "backfill_title_cleared",
                        session_id=row.session_id,
                        old_title=title,
                        user_id=row.user_id,
                    )
                elif outcome == "skipped_manual":
                    skipped_manual += 1
                else:  # locked
                    locked += 1

            if limit and vacant_hits >= limit:
                break

        if limit and vacant_hits >= limit:
            break

        if apply_mode and sleep_between > 0:
            await asyncio.sleep(sleep_between)

    print("", flush=True)
    print(f"✔ 扫描 auto 标题 session 数：{scanned}", flush=True)
    print(f"✔ 命中无语义（vacant）：{vacant_hits}", flush=True)
    if apply_mode:
        print(f"✔ 已清空（交巡检重新生成）：{cleared}", flush=True)
        if skipped_manual:
            print(f"  · 并发期间被改 manual 跳过：{skipped_manual}", flush=True)
        if locked:
            print(f"  · 拿不到 advisory lock 跳过：{locked}（可重跑补齐）", flush=True)
    else:
        print("（dry-run 未写库；加 --apply 执行清空）", flush=True)

    if user_dist:
        top = sorted(user_dist.items(), key=lambda kv: kv[1], reverse=True)[:10]
        dist_str = "，".join(f"{u}={n}" for u, n in top)
        print(f"✔ 命中按 user 分布（Top 10）：{dist_str}", flush=True)

    if samples:
        print("✔ 命中样例（最多 20 条）：", flush=True)
        for sid, title, uid in samples:
            display = title if len(title) <= 30 else title[:30] + "…"
            print(f'   · [{sid[:8]}] user={uid}  title="{display}"', flush=True)


def run_backfill_sync(args: argparse.Namespace) -> int:
    """同步入口：供 cli.py 调用。"""
    try:
        asyncio.run(_run_backfill(args))
        return 0
    except Exception as exc:  # noqa: BLE001
        logger.error("backfill_titles_failed", error=str(exc), error_type=type(exc).__name__)
        print(f"✘ 会话标题回填失败: {type(exc).__name__}: {exc}", flush=True)
        return 1
