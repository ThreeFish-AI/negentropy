"""evolution canary 路由纯函数单测。"""

from __future__ import annotations

from negentropy.engine.evolution import canary as c


def test_bucket_index_deterministic_same_thread():
    a = c.bucket_index("thread-1", "user-1")
    b = c.bucket_index("thread-1", "user-1")
    assert a == b
    assert 0 <= a < 100


def test_bucket_index_falls_back_to_user_when_no_thread():
    bu = c.bucket_index(None, "user-1")
    assert 0 <= bu < 100


def test_bucket_index_never_canary_when_both_missing():
    assert c.bucket_index(None, None) == 100


def test_bucket_index_different_threads_likely_distributed():
    """不同 thread 落不同桶（概率性——用一组样本验证分布而非完全相等）。"""
    buckets = {c.bucket_index(f"thread-{i}", None) for i in range(20)}
    assert len(buckets) > 1  # 不全同桶


def test_should_use_candidate_below_ratio():
    assert c.should_use_candidate(5, 10.0) is True
    assert c.should_use_candidate(9, 10.0) is True


def test_should_use_candidate_at_or_above_ratio():
    assert c.should_use_candidate(10, 10.0) is False  # 边界：bucket < ratio 严格
    assert c.should_use_candidate(50, 10.0) is False


def test_resolve_canary_override_candidate_path():
    snap, ver = c.resolve_canary_override(
        active_snapshot={"semantic_weight": 0.7},
        active_version="0.1.0",
        candidate_snapshot={"semantic_weight": 0.6},
        candidate_version="0.1.1",
        bucket=3,
        ratio_pct=10.0,
    )
    assert snap == {"semantic_weight": 0.6}
    assert ver == "0.1.1"


def test_resolve_canary_override_active_path():
    snap, ver = c.resolve_canary_override(
        active_snapshot={"semantic_weight": 0.7},
        active_version="0.1.0",
        candidate_snapshot={"semantic_weight": 0.6},
        candidate_version="0.1.1",
        bucket=50,
        ratio_pct=10.0,
    )
    assert snap == {"semantic_weight": 0.7}
    assert ver == "0.1.0"


# ---------------------------------------------------------------------------
# P0-1：bucket_key 显式分桶键（解耦 routine 路径 "system" 同桶问题）
# ---------------------------------------------------------------------------


def test_bucket_index_explicit_key_wins_over_user():
    """显式 bucket_key 优先于 user_id：不同 user 同 key → 同桶（routine 路径按 routine.id 分桶）。"""
    a = c.bucket_index(None, "user-A", bucket_key="routine-1")
    b = c.bucket_index(None, "user-B", bucket_key="routine-1")
    assert a == b
    assert 0 <= a < 100


def test_bucket_index_different_keys_likely_different_buckets():
    """不同 bucket_key 落不同桶分布（解耦后自治 routine 不再共用同桶）。"""
    buckets = {c.bucket_index(None, "system", bucket_key=f"routine-{i}") for i in range(20)}
    assert len(buckets) > 1


def test_bucket_key_none_falls_back_to_user():
    """向后兼容：bucket_key=None → 回退 user_id（旧路径逐字节等价）。"""
    assert c.bucket_index(None, "u", bucket_key=None) == c.bucket_index(None, "u")
