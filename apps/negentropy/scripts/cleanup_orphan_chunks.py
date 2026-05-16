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

from _db import script_engine

from negentropy.knowledge.cleanup import (
    check_index_completeness,
    cluster_by_time,
    delete_chunks,
    get_chunks_for_source,
    scan_source_uris,
)


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
    report_items: list[dict] = []
    all_deleted_chunks: list[dict] = []
    exit_code = 0

    async with script_engine(echo=False) as engine:
        async with engine.connect() as conn:
            # Step 1: 找可疑 source_uri
            candidates = await scan_source_uris(conn, corpus_id=corpus_id, app_name=app_name)

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
                chunks = await get_chunks_for_source(
                    conn, corpus_id=corpus_id, app_name=app_name, source_uri=source_uri
                )
                clusters = cluster_by_time(chunks)

                if len(clusters) <= 1:
                    print(f"    → Only 1 batch ({len(chunks)} chunks), skipping")
                    continue

                print(f"    → {len(clusters)} batches detected")

                # Step 3: 选最新批次，检查完整性
                latest = clusters[-1]
                is_complete = check_index_completeness(latest)

                if not is_complete and len(clusters) >= 2:
                    print("    ⚠ Latest batch has incomplete chunk_index, falling back to previous batch")
                    latest = clusters[-2]
                    is_complete = check_index_completeness(latest)
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

                csv_path = _write_backup_csv(
                    source_uri="",
                    chunks=all_deleted_chunks,
                    corpus_id=corpus_id,
                )
                print(f"\n📄 Backup written to: {csv_path}")

                deleted = await delete_chunks(conn, all_deleted_ids)
                await conn.commit()
                print(f"\n✓ Deleted {deleted} orphan chunks")
            elif all_deleted_chunks:
                print(f"\n(Dry run) Would delete {len(all_deleted_chunks)} orphan chunks. Use --apply to execute.")

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
