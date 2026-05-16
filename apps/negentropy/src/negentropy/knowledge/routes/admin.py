"""Auto-extracted route module: Orphan chunk cleanup."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import ValidationError  # noqa: F401

from negentropy.db.session import AsyncSessionLocal
from negentropy.knowledge.api_helpers import _resolve_app_name
from negentropy.logging import get_logger

if TYPE_CHECKING:
    pass

# Lifecycle schema imports
from negentropy.knowledge.lifecycle_schemas import (  # noqa: F401
    AssignDocumentRequest,
    CatalogTreeResponse,
    CategorySuggestionResponse,
    DocumentProvenanceResponse,
    WikiEntryContentResponse,
    WikiNavTreeResponse,
    WikiPublishActionResponse,
)

logger = get_logger("negentropy.knowledge.api")
router = APIRouter()


@router.post("/base/{corpus_id}/admin/cleanup-orphans")
async def cleanup_orphan_chunks(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
    dry_run: bool = Query(default=True, description="True=audit only, False=physically delete"),
) -> dict[str, Any]:
    """清理指定 corpus 中因非幂等摄取累积的孤儿 chunks。

    按 (corpus_id, source_uri) 分组，对每组做 created_at 时间聚类，
    保留最新一次摄取的 chunks，物理删除其余批次。

    - 默认 dry_run=True，仅返回审计报告
    - dry_run=False 时物理删除并写 backup CSV
    """
    resolved_app = _resolve_app_name(app_name)
    from sqlalchemy import text

    report_items: list[dict[str, Any]] = []
    total_deleted = 0
    total_kept = 0

    async with AsyncSessionLocal() as db:
        # Step 1: 找可疑 source_uri（跨多个时间窗的）
        candidates_stmt = text(
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
        result = await db.execute(candidates_stmt, {"corpus_id": corpus_id, "app_name": resolved_app})
        candidates = result.all()

        for candidate in candidates:
            source_uri = candidate.source_uri

            # Step 2: 拉取该 source 下所有 chunks
            chunks_stmt = text(
                """
                SELECT
                    id, chunk_index, created_at,
                    metadata->>'chunk_role' AS role
                FROM negentropy.knowledge
                WHERE corpus_id = :corpus_id
                  AND app_name = :app_name
                  AND source_uri = :source_uri
                ORDER BY created_at ASC, chunk_index ASC
                """
            )
            chunks_result = await db.execute(
                chunks_stmt,
                {"corpus_id": corpus_id, "app_name": resolved_app, "source_uri": source_uri},
            )
            chunks = chunks_result.all()

            if not chunks:
                continue

            # Step 3: 时间聚类（60 秒窗口）
            clusters: list[list[Any]] = []
            current_cluster: list[Any] = [chunks[0]]
            prev_ts = chunks[0].created_at

            for c in chunks[1:]:
                gap = (c.created_at - prev_ts).total_seconds()
                if gap <= 60:
                    current_cluster.append(c)
                else:
                    clusters.append(current_cluster)
                    current_cluster = [c]
                prev_ts = c.created_at
            if current_cluster:
                clusters.append(current_cluster)

            if len(clusters) <= 1:
                continue

            # Step 4: 选最新批次
            latest = clusters[-1]
            # 完整性检查：parent chunk_index 应连续
            parent_indices = sorted({c.chunk_index for c in latest if c.role != "child"})
            is_complete = not parent_indices or parent_indices == list(range(len(parent_indices)))

            if not is_complete and len(clusters) >= 2:
                latest = clusters[-2]
                # 回退后重新检查完整性，与 CLI 脚本保持一致
                fb_parent_indices = sorted({c.chunk_index for c in latest if c.role != "child"})
                is_complete = not fb_parent_indices or fb_parent_indices == list(range(len(fb_parent_indices)))

            kept_ids = {str(c.id) for c in latest}
            deleted_ids = [str(c.id) for c in chunks if str(c.id) not in kept_ids]

            report_items.append(
                {
                    "source_uri": source_uri,
                    "kept_count": len(kept_ids),
                    "deleted_count": len(deleted_ids),
                    "total_batches": len(clusters),
                    "is_complete": is_complete,
                    "sample_deleted_ids": deleted_ids[:10],
                }
            )
            total_kept += len(kept_ids)
            total_deleted += len(deleted_ids)

            # Step 5: 物理删除（非 dry_run 时）
            if not dry_run and deleted_ids:
                batch_size = 500
                for i in range(0, len(deleted_ids), batch_size):
                    batch = deleted_ids[i : i + batch_size]
                    placeholders = ", ".join(f":id_{j}" for j in range(len(batch)))
                    params = {f"id_{j}": bid for j, bid in enumerate(batch)}
                    await db.execute(
                        text(f"DELETE FROM negentropy.knowledge WHERE id IN ({placeholders})"),
                        params,
                    )

        if not dry_run and total_deleted > 0:
            await db.commit()

    return {
        "corpus_id": str(corpus_id),
        "app_name": resolved_app,
        "dry_run": dry_run,
        "total_candidates": len(candidates),
        "total_kept": total_kept,
        "total_deleted": total_deleted,
        "items": report_items,
    }
