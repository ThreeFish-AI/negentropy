"""Session 标题溯源（title_source）跳过策略与 inspector 锁键派生的纯函数单元测试。

这里只覆盖与 DB 无关的逻辑：
- ``PostgresSessionService._title_skip_reason`` 在 manual / legacy / auto / 空白
  四种 metadata 形态下的跳过决策。
- ``SessionTitleInspector._lock_key_for_session`` 派生的 advisory lock key 必须
  落在 Postgres BIGINT 范围 ``[-2^63, 2^63-1]``。

写入路径（``_persist_generated_title``、``_record_title_attempt_failure``、
``update_session_title``）的端到端断言放在集成测试 ``test_title_inspector.py``，
避免重复构造 fake AsyncSession。
"""

from __future__ import annotations

import uuid

import pytest

from negentropy.engine.adapters.postgres.session_service import PostgresSessionService
from negentropy.engine.title_inspector import SessionTitleInspector

# ------- _title_skip_reason -------


@pytest.mark.parametrize(
    ("metadata", "force_refresh", "expected"),
    [
        # 全新会话：可以生成
        ({}, False, None),
        ({"archived": False}, False, None),
        # auto 标题已存在，未强制刷新 → 跳过
        ({"title": "Hello", "title_source": "auto"}, False, "already_titled"),
        # auto 标题已存在，强制刷新 → 不跳过（巡检事件增长路径）
        ({"title": "Hello", "title_source": "auto"}, True, None),
        # manual 永不覆盖（即使强制刷新）
        ({"title": "My Project", "title_source": "manual"}, False, "manual"),
        ({"title": "My Project", "title_source": "manual"}, True, "manual"),
        # legacy：有 title 无 source → 保守视为 manual，强制刷新也不覆盖
        ({"title": "Old Title"}, False, "legacy"),
        ({"title": "Old Title"}, True, "legacy"),
        # 空 title 字符串等价于无 title——可以生成
        ({"title": "", "title_source": "auto"}, False, None),
        ({"title": None, "title_source": "auto"}, False, None),
    ],
)
def test_title_skip_reason_decision_matrix(metadata, force_refresh, expected):
    assert PostgresSessionService._title_skip_reason(metadata, force_refresh=force_refresh) == expected


# ------- SessionTitleInspector._lock_key_for_session -------


def test_lock_key_is_within_postgres_bigint_range():
    """Postgres BIGINT 范围 [-2^63, 2^63-1]，advisory lock 入参必须命中。"""
    for _ in range(200):
        sid = uuid.uuid4()
        key = SessionTitleInspector._lock_key_for_session(sid)
        assert -(2**63) <= key <= 2**63 - 1


def test_lock_key_is_deterministic_for_same_uuid():
    sid = uuid.UUID("12345678-1234-1234-1234-123456789abc")
    key_a = SessionTitleInspector._lock_key_for_session(sid)
    key_b = SessionTitleInspector._lock_key_for_session(sid)
    assert key_a == key_b


def test_lock_key_differs_across_distinct_uuids():
    sid_a = uuid.UUID("11111111-1111-1111-1111-111111111111")
    sid_b = uuid.UUID("22222222-2222-2222-2222-222222222222")
    assert SessionTitleInspector._lock_key_for_session(sid_a) != SessionTitleInspector._lock_key_for_session(sid_b)


# ------- SessionTitleInspector 构造与参数兜底 -------


def test_inspector_clamps_invalid_params_to_safe_floor():
    """防御性边界：负值或 0 不应让巡检失能/无限批量。"""
    inspector = SessionTitleInspector(
        concurrency=0,
        batch_size=-5,
        min_events=-1,
        refresh_event_delta=0,
        max_attempts=0,
    )
    assert inspector.concurrency == 1
    assert inspector.batch_size == 1
    assert inspector.min_events == 0
    assert inspector.refresh_event_delta == 1
    assert inspector.max_attempts == 1
