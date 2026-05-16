"""cleanup_orphan_chunks CLI 聚类算法的单元测试。

不连真实 DB，仅验证时间聚类和完整性校验逻辑。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from negentropy.knowledge.cleanup import check_index_completeness, cluster_by_time


def _ts(minutes_ago: float) -> datetime:
    return datetime.now(UTC) - timedelta(minutes=minutes_ago)


def test_cluster_by_time_single_batch():
    """所有 chunks 在 60 秒内写入 → 单一批次。"""
    chunks = [
        {"id": f"id-{i}", "chunk_index": i, "created_at": _ts(1), "role": "parent" if i % 5 == 0 else "child"}
        for i in range(10)
    ]
    clusters = cluster_by_time(chunks, window_seconds=60)
    assert len(clusters) == 1
    assert len(clusters[0]) == 10


def test_cluster_by_time_multiple_batches():
    """多次摄取（间隔 >60s）→ 多个批次。"""
    base = datetime(2025, 1, 1, tzinfo=UTC)
    chunks = (
        # Batch 1: 0s 起，每 chunk 间隔 0.1s
        [
            {"id": f"old-{i}", "chunk_index": i, "created_at": base + timedelta(seconds=i * 0.1), "role": "parent"}
            for i in range(14)
        ]
        # Batch 2: 5 分钟起
        + [
            {
                "id": f"mid-{i}",
                "chunk_index": i + 14,
                "created_at": base + timedelta(minutes=5, seconds=i * 0.1),
                "role": "parent",
            }
            for i in range(14)
        ]
        # Batch 3: 10 分钟起
        + [
            {
                "id": f"new-{i}",
                "chunk_index": i + 28,
                "created_at": base + timedelta(minutes=10, seconds=i * 0.1),
                "role": "parent",
            }
            for i in range(14)
        ]
    )
    clusters = cluster_by_time(chunks, window_seconds=60)
    assert len(clusters) == 3
    assert all(len(c) == 14 for c in clusters)
    # 最新批次应包含 "new-" 前缀的 chunks
    assert clusters[-1][0]["id"].startswith("new-")


def test_cluster_by_time_empty():
    chunks = []
    clusters = cluster_by_time(chunks)
    assert clusters == []


def test_check_index_completeness_continuous():
    """chunk_index 从 0 起连续 → 完整。"""
    cluster = [{"chunk_index": i, "role": "parent"} for i in range(14)]
    assert check_index_completeness(cluster) is True


def test_check_index_completeness_with_gap():
    """chunk_index 有空缺（如 [0,1,3,4] 缺 2）→ 不完整。"""
    cluster = [{"chunk_index": i, "role": "parent"} for i in [0, 1, 3, 4]]
    assert check_index_completeness(cluster) is False


def test_check_index_completeness_only_children():
    """全 child 无 parent → 视为完整（无 parent 不阻止）。"""
    cluster = [{"chunk_index": i, "role": "child"} for i in range(5)]
    assert check_index_completeness(cluster) is True


def test_cluster_by_time_orphan_detection_scenario():
    """模拟实际场景：14 个 chunks 摄取 11 次 → 应识别 11 批。"""
    base = datetime(2025, 1, 1, tzinfo=UTC)
    batches = []
    # 10 次历史摄取，每次间隔 10 分钟
    for ingestion in range(10):
        base_ts = base + timedelta(minutes=ingestion * 10)
        for i in range(14):
            batches.append(
                {
                    "id": f"ingest-{ingestion}-{i}",
                    "chunk_index": ingestion * 14 + i,
                    "created_at": base_ts + timedelta(seconds=i * 0.1),
                    "role": "parent" if i == 0 else "child",
                }
            )
    # 最新一次摄取（100 分钟处）
    for i in range(14):
        batches.append(
            {
                "id": f"latest-{i}",
                "chunk_index": 140 + i,
                "created_at": base + timedelta(minutes=100, seconds=i * 0.1),
                "role": "parent" if i == 0 else "child",
            }
        )

    clusters = cluster_by_time(batches, window_seconds=60)
    assert len(clusters) == 11  # 10 old + 1 latest
    # 最新批次应包含 "latest-" 前缀
    assert clusters[-1][0]["id"].startswith("latest-")
    assert len(clusters[-1]) == 14
