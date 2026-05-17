"""Orphan chunks 清理的纯算法与数据库操作。

从 CLI 脚本和 API 层中提取的公共逻辑，确保算法单一事实源。
CLI 脚本、API 端点、单元测试均从此模块导入。
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text

# 同一次摄取的所有 chunks 在 60 秒内写入，用此窗口做时间聚类
CLUSTER_WINDOW_SECONDS = 60


# ---------------------------------------------------------------------------
# 纯函数（无 DB 依赖）
# ---------------------------------------------------------------------------


def cluster_by_time(chunks: list[dict], window_seconds: int = CLUSTER_WINDOW_SECONDS) -> list[list[dict]]:
    """按 ``created_at`` 做时间窗聚类，返回多个批次。"""
    if not chunks:
        return []

    clusters: list[list[dict]] = []
    current: list[dict] = [chunks[0]]
    prev_ts = chunks[0]["created_at"]

    for c in chunks[1:]:
        ts = c["created_at"]
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


def check_index_completeness(cluster: list[dict]) -> bool:
    """检查 parent chunks 的 ``chunk_index`` 是否从 0 起连续无空缺。"""
    parent_indices = sorted({c["chunk_index"] for c in cluster if c["role"] != "child"})
    if not parent_indices:
        return True
    return parent_indices == list(range(len(parent_indices)))


# ---------------------------------------------------------------------------
# 异步数据库操作
# ---------------------------------------------------------------------------


async def scan_source_uris(conn: Any, *, corpus_id: str, app_name: str) -> list[dict]:
    """列出该 corpus 下所有有 >1 个时间聚类的 ``source_uri``。"""
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


async def get_chunks_for_source(conn: Any, *, corpus_id: str, app_name: str, source_uri: str) -> list[dict]:
    """拉取某个 ``source_uri`` 下所有 chunk 的元数据。"""
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


async def delete_chunks(conn: Any, chunk_ids: list[str]) -> int:
    """物理删除指定 ID 的 chunks，返回删除条数。"""
    if not chunk_ids:
        return 0
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
