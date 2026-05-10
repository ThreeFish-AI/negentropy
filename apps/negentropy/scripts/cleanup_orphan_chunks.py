"""清理 ``negentropy.knowledge`` 中因非幂等摄取累积的孤儿 chunks。

背景：
    ingest_text/file/url 在历史版本中不幂等——同一 (corpus_id, source_uri) 多次摄取
    纯 INSERT 不清理旧 chunks，导致 chunks 数量虚高（如 849 vs 预期 84）。

    本脚本按 (corpus_id, source_uri) 分组，对每组做 created_at 时间聚类，
    保留最新一次摄取的 chunks，物理删除其余批次。

用法：
    # 干跑（默认，仅审计报告）
    uv run python apps/negentropy/scripts/cleanup_orphan_chunks.py \\
        --corpus-id <UUID> --app-name <APP>

    # 实际删除
    uv run python apps/negentropy/scripts/cleanup_orphan_chunks.py \\
        --corpus-id <UUID> --app-name <APP> --apply

    # 导出报告
    uv run python apps/negentropy/scripts/cleanup_orphan_chunks.py \\
        --corpus-id <UUID> --app-name <APP> --output report.json

安全机制：
    1. --corpus-id 必填，限爆炸半径
    2. 默认 dry_run，必须显式 --apply 才物理删除
    3. --apply 时强制写 cleanup_<corpus>_<ts>.csv（可手工恢复）
    4. 最新批次 chunk_index 不连续则跳过该 source_uri 并标 needs_manual_review
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from negentropy.config import settings

# 同一次摄取的所有 chunks 在 60 秒内写入，用此窗口做时间聚类
_CLUSTER_WINDOW_SECONDS = 60


async def _scan_source_uris(conn, *, corpus_id: str, app_name: str) -> list[dict]:
    """列出该 corpus 下所有有 >1 个时间聚类的 source_uri。"""
    stmt = text(
        """
        SELECT
            source_uri,
            COUNT(*) AS total_chunks,
            COUNT(DISTINCT date_trunc('minute', created_at)) AS minute_buckets
        FROM negentropy.knowledge
        WHERE corpus_id = :corpus_id
          AND app_name = :app_name
          AND source_uri IS NOT NULL
        GROUP BY source_uri
        HAVING COUNT(DISTINCT date_trunc('minute', created_at)) > 1
           OR COUNT(*) > 100
        ORDER BY total_chunks DESC
        """
    )
    result = await conn.execute(stmt, {"corpus_id": corpus_id, "app_name": app_name})
    return [
        {
            "source_uri": row.source_uri,
            "total_chunks": row.total_chunks,
            "minute_buckets": row.minute_buckets,
        }
        for row in result.all()
    ]


async def _get_chunks_for_source(conn, *, corpus_id: str, app_name: str, source_uri: str) -> list[dict]:
    """拉取某个 source_uri 下所有 chunk 的元数据。"""
    stmt = text(
        """
        SELECT
            id, chunk_index, created_at,
            metadata->>'chunk_family_id' AS family_id,
            metadata->>'chunk_role' AS role
        FROM negentropy.knowledge
        WHERE corpus_id = :corpus_id
          AND app_name = :app_name
          AND source_uri = :source_uri
        ORDER BY created_at ASC, chunk_index ASC
        """
    )
    result = await conn.execute(
        stmt,
        {"corpus_id": corpus_id, "app_name": app_name, "source_uri": source_uri},
    )
    return [
        {
            "id": str(row.id),
            "source_uri": source_uri,
            "chunk_index": row.chunk_index,
            "created_at": row.created_at,
            "family_id": row.family_id,
            "role": row.role,
        }
        for row in result.all()
    ]


def _cluster_by_time(chunks: list[dict], window_seconds: int = _CLUSTER_WINDOW_SECONDS) -> list[list[dict]]:
    """按 created_at 做时间窗聚类，返回多个批次。"""
    if not chunks:
        return []

    clusters: list[list[dict]] = []
    current: list[dict] = [chunks[0]]
    prev_ts = chunks[0]["created_at"]

    for c in chunks[1:]:
        ts = c["created_at"]
        # 同一秒或距离前一 cluster 最后一个 <= window_seconds
        gap = (ts - prev_ts).total_seconds()
        if gap <= window_seconds:
            current.append(c)
        else:
            clusters.append(current)
            current = [c]
        prev_ts = ts

    if current:
        clusters.append(current)
    return clusters


def _check_index_completeness(cluster: list[dict]) -> bool:
    """检查 parent chunks 的 chunk_index 是否从 0 起连续无空缺。"""
    parent_indices = sorted({c["chunk_index"] for c in cluster if c["role"] != "child"})
    if not parent_indices:
        return True  # 无 parent（可能全 child，异常但不阻止）
    return parent_indices == list(range(len(parent_indices)))


async def _delete_chunks(conn, chunk_ids: list[str]) -> int:
    """物理删除指定 ID 的 chunks，返回删除条数。"""
    if not chunk_ids:
        return 0
    # 分批避免 IN 子句过长
    batch_size = 500
    total = 0
    for i in range(0, len(chunk_ids), batch_size):
        batch = chunk_ids[i : i + batch_size]
        placeholders = ", ".join(f":id_{j}" for j in range(len(batch)))
        params = {f"id_{j}": bid for j, bid in enumerate(batch)}
        stmt = text(f"DELETE FROM negentropy.knowledge WHERE id IN ({placeholders})")
        result = await conn.execute(stmt, params)
        total += result.rowcount or 0
    return total


def _write_backup_csv(source_uri: str, chunks: list[dict], corpus_id: str) -> str:
    """写 backup CSV 文件，返回路径。

    ``source_uri`` 作为默认值；每个 chunk 字典若含 ``source_uri`` 键则优先使用。
    """
    ts = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    filename = f"cleanup_{corpus_id[:8]}_{ts}.csv"
    filepath = Path(filename)
    with filepath.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "source_uri", "chunk_index", "role", "created_at", "content_preview"])
        for c in chunks:
            writer.writerow(
                [
                    c["id"],
                    c.get("source_uri") or source_uri,
                    c["chunk_index"],
                    c.get("role") or "",
                    str(c["created_at"]),
                    "",  # content_preview 留空，CLI 不拉 content
                ]
            )
    return str(filepath)


async def _cleanup(
    *,
    corpus_id: str,
    app_name: str,
    apply: bool,
    output_path: str | None,
) -> int:
    """执行清理。返回退出码（0=成功，1=有 needs_manual_review）。"""
    engine = create_async_engine(str(settings.database_url), echo=False)
    report_items: list[dict] = []
    all_deleted_chunks: list[dict] = []
    exit_code = 0

    try:
        async with engine.connect() as conn:
            # Step 1: 找可疑 source_uri
            candidates = await _scan_source_uris(conn, corpus_id=corpus_id, app_name=app_name)

            if not candidates:
                print(f"✓ No orphan sources found for corpus {corpus_id}")
                return 0

            print(f"Found {len(candidates)} candidate source(s) with potential orphans:\n")

            for candidate in candidates:
                source_uri = candidate["source_uri"]
                print(
                    f"  {source_uri[:80]}... "
                    f"(total={candidate['total_chunks']}, "
                    f"minute_buckets={candidate['minute_buckets']})"
                )

                # Step 2: 拉取所有 chunks 并聚类
                chunks = await _get_chunks_for_source(
                    conn, corpus_id=corpus_id, app_name=app_name, source_uri=source_uri
                )
                clusters = _cluster_by_time(chunks)

                if len(clusters) <= 1:
                    # 只有 1 个批次，检查是否 chunks 数合理
                    print(f"    → Only 1 batch ({len(chunks)} chunks), skipping")
                    continue

                print(f"    → {len(clusters)} batches detected")

                # Step 3: 选最新批次，检查完整性
                latest = clusters[-1]
                is_complete = _check_index_completeness(latest)

                if not is_complete and len(clusters) >= 2:
                    # 最新批次不完整，回退上一批
                    print("    ⚠ Latest batch has incomplete chunk_index, falling back to previous batch")
                    latest = clusters[-2]
                    is_complete = _check_index_completeness(latest)
                    if not is_complete:
                        print("    ⚠ Fallback batch also incomplete, marking as needs_manual_review")
                        exit_code = 1

                kept_ids = {c["id"] for c in latest}
                deleted_chunks = [c for c in chunks if c["id"] not in kept_ids]
                deleted_ids = [c["id"] for c in deleted_chunks]

                item_report = {
                    "source_uri": source_uri,
                    "kept_count": len(kept_ids),
                    "deleted_count": len(deleted_ids),
                    "total_batches": len(clusters),
                    "kept_batch_index": len(clusters) - (1 if is_complete or len(clusters) < 2 else 2),
                    "kept_at": str(latest[0]["created_at"]) if latest else None,
                    "is_complete": is_complete,
                    "sample_deleted_ids": deleted_ids[:10],
                }
                report_items.append(item_report)
                all_deleted_chunks.extend(deleted_chunks)

                print(f"    → Keep batch: {len(kept_ids)} chunks | Delete: {len(deleted_ids)} orphan chunks")

            # Step 4: 物理删除（仅在 --apply 时）
            if apply and all_deleted_chunks:
                all_deleted_ids = [c["id"] for c in all_deleted_chunks]

                # 先写 backup CSV（包含 per-chunk 元数据，便于手工恢复）
                csv_path = _write_backup_csv(
                    source_uri="",
                    chunks=all_deleted_chunks,
                    corpus_id=corpus_id,
                )
                print(f"\n📄 Backup written to: {csv_path}")

                deleted = await _delete_chunks(conn, all_deleted_ids)
                await conn.commit()
                print(f"\n✓ Deleted {deleted} orphan chunks")
            elif all_deleted_chunks:
                print(f"\n(Dry run) Would delete {len(all_deleted_chunks)} orphan chunks. Use --apply to execute.")

    finally:
        await engine.dispose()

    # Step 5: 输出报告
    if output_path:
        report = {
            "corpus_id": corpus_id,
            "app_name": app_name,
            "dry_run": not apply,
            "timestamp": datetime.now(UTC).isoformat(),
            "total_candidates": len(candidates),
            "total_deleted": len(all_deleted_chunks),
            "items": report_items,
        }
        Path(output_path).write_text(json.dumps(report, indent=2, ensure_ascii=False))
        print(f"\n📊 Report written to: {output_path}")

    return exit_code


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cleanup orphan chunks accumulated by non-idempotent ingest operations"
    )
    parser.add_argument("--corpus-id", required=True, help="Corpus UUID (required, limits blast radius)")
    parser.add_argument("--app-name", required=True, help="Application name")
    parser.add_argument("--apply", action="store_true", help="Actually delete orphan chunks (default: dry run)")
    parser.add_argument("--output", default=None, help="Output report JSON path (default: stdout summary)")
    args = parser.parse_args()

    # Validate UUID
    try:
        UUID(args.corpus_id)
    except ValueError:
        print(f"ERROR: Invalid corpus-id: {args.corpus_id}", file=sys.stderr)
        sys.exit(1)

    exit_code = asyncio.run(
        _cleanup(
            corpus_id=args.corpus_id,
            app_name=args.app_name,
            apply=args.apply,
            output_path=args.output,
        )
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
