"""回填 ``negentropy.memories`` / ``negentropy.facts`` 的缺失 embedding 向量。

背景：
    PostgresMemoryService 历史上经无参 factory 构造（``embedding_fn=None``），
    记忆/事实写入从不生成向量——语义与混合检索因此从未生效（仅 BM25/ilike）。
    embedding_fn 接线修复后，新数据自动生成向量；本脚本为存量数据补齐。

用法：
    # 干跑（默认，仅统计缺失数量）
    uv run python apps/negentropy/scripts/backfill_memory_embeddings.py

    # 实际回填（memories + facts）
    uv run python apps/negentropy/scripts/backfill_memory_embeddings.py --apply

    # 仅回填 memories，限定批大小与限速
    uv run python apps/negentropy/scripts/backfill_memory_embeddings.py \\
        --apply --tables memories --batch-size 20 --sleep-ms 200

安全机制：
    1. 默认 dry_run，必须显式 ``--apply`` 才执行写入
    2. 仅 UPDATE embedding 列（``WHERE embedding IS NULL``），不删任何数据
    3. 幂等可重跑：已有向量的行天然跳过
    4. 单条失败仅计数跳过，不中断整批
"""

from __future__ import annotations

import argparse
import asyncio

from _db import run_script, script_engine
from sqlalchemy import text

# 与运行时写入路径保持同一事实源：
# - Memory: 直接对 content 向量化（memory_service._retry_embedding 语义）
# - Fact:   f"{key}: {str(value)}"（fact_service.upsert_fact 语义）
_TABLE_SPECS: dict[str, dict[str, str]] = {
    "memories": {
        "select": (
            "SELECT id, content AS embed_text FROM negentropy.memories "
            "WHERE embedding IS NULL ORDER BY created_at LIMIT :batch"
        ),
        "count": "SELECT count(*) FROM negentropy.memories WHERE embedding IS NULL",
        "update": "UPDATE negentropy.memories SET embedding = :embedding WHERE id = :id AND embedding IS NULL",
    },
    "facts": {
        "select": (
            "SELECT id, (key || ': ' || value::text) AS embed_text FROM negentropy.facts "
            "WHERE embedding IS NULL ORDER BY created_at LIMIT :batch"
        ),
        "count": "SELECT count(*) FROM negentropy.facts WHERE embedding IS NULL",
        "update": "UPDATE negentropy.facts SET embedding = :embedding WHERE id = :id AND embedding IS NULL",
    },
}


async def _backfill_table(
    engine,
    embed,
    *,
    table: str,
    apply: bool,
    batch_size: int,
    sleep_ms: int,
) -> tuple[int, int]:
    """回填单表。返回 (updated, failed)。"""
    spec = _TABLE_SPECS[table]

    async with engine.connect() as conn:
        missing = (await conn.execute(text(spec["count"]))).scalar_one()
    print(f"[{table}] embedding IS NULL: {missing}")
    if not missing or not apply:
        if missing and not apply:
            print(f"[{table}] (Dry run) Would backfill {missing} rows. Use --apply to execute.")
        return 0, 0

    updated = failed = 0
    while True:
        async with engine.connect() as conn:
            rows = (await conn.execute(text(spec["select"]), {"batch": batch_size})).fetchall()
        if not rows:
            break

        for row in rows:
            embed_text = (row.embed_text or "").strip()
            if not embed_text:
                failed += 1
                continue
            try:
                vector = await embed(embed_text)
            except Exception as exc:
                failed += 1
                print(f"[{table}] embed failed id={row.id}: {exc}")
                continue
            if not vector:
                failed += 1
                continue
            async with engine.begin() as conn:
                await conn.execute(
                    text(spec["update"]),
                    {"embedding": str(vector), "id": row.id},
                )
            updated += 1
            if sleep_ms:
                await asyncio.sleep(sleep_ms / 1000)

        print(f"[{table}] progress: updated={updated} failed={failed}")
        # 整批全失败时终止，避免对持续故障的 embedding 服务无限重试
        if failed and updated == 0:
            print(f"[{table}] aborting: all attempts in first batches failed")
            break

    print(f"[{table}] done: updated={updated} failed={failed}")
    return updated, failed


async def _main(*, apply: bool, tables: list[str], batch_size: int, sleep_ms: int) -> int:
    from negentropy.knowledge.ingestion.embedding import build_embedding_fn

    embed = build_embedding_fn()

    total_failed = 0
    async with script_engine(echo=False) as engine:
        for table in tables:
            _, failed = await _backfill_table(
                engine,
                embed,
                table=table,
                apply=apply,
                batch_size=batch_size,
                sleep_ms=sleep_ms,
            )
            total_failed += failed

    return 1 if total_failed else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill missing embeddings for memories/facts")
    parser.add_argument("--apply", action="store_true", help="Actually write embeddings (default: dry run)")
    parser.add_argument(
        "--tables",
        nargs="+",
        choices=sorted(_TABLE_SPECS),
        default=sorted(_TABLE_SPECS),
        help="Tables to backfill (default: facts memories)",
    )
    parser.add_argument("--batch-size", type=int, default=50, help="Rows per batch (default: 50)")
    parser.add_argument("--sleep-ms", type=int, default=100, help="Delay between rows in ms (default: 100)")
    args = parser.parse_args()

    run_script(
        _main(
            apply=args.apply,
            tables=args.tables,
            batch_size=args.batch_size,
            sleep_ms=args.sleep_ms,
        )
    )


if __name__ == "__main__":
    main()
