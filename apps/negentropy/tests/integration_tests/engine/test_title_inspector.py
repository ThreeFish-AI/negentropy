"""SessionTitleInspector 端到端集成测试

覆盖巡检的 6 类核心行为：
1. 全新会话 backfill（无 title）→ 生成 + 标记 title_source=auto
2. manual 永不覆盖（title_source=manual）
3. legacy 永不覆盖（有 title 无 title_source）
4. 事件量显著增长后强制刷新（force_refresh 路径）
5. 失败累计 >= max_attempts 自动退出候选池
6. update_session_title 在写/清两条路径上的 metadata 形状契约

LLM 摘要器通过 monkeypatch 替换为 ``DummySummarizer``，避免外部依赖。
DB 写入复用项目根 conftest 注入的测试库 ``AsyncSessionLocal``。
"""

from __future__ import annotations

import uuid

import pytest
from google.adk.events import Event as ADKEvent
from sqlalchemy import select, update

import negentropy.db.session as db_session
from negentropy.engine.adapters.postgres.session_service import PostgresSessionService
from negentropy.engine.title_inspector import SessionTitleInspector


class _StableSummarizer:
    """每次 generate_title 返回相同标题，验证 backfill 与 manual/legacy 保护。"""

    @classmethod
    async def create(cls) -> _StableSummarizer:
        return cls()

    async def generate_title(self, history) -> str:
        return "首次标题"


class _CountingSummarizer:
    """每次调用返回带递增编号的标题，验证 refresh 后内容确实被覆盖。"""

    _counter = 0

    @classmethod
    async def create(cls) -> _CountingSummarizer:
        return cls()

    async def generate_title(self, history) -> str:
        _CountingSummarizer._counter += 1
        return f"标题 v{_CountingSummarizer._counter}"


class _FailingSummarizer:
    """LLM 调用总是抛错，用于验证 attempt_count 退避。"""

    @classmethod
    async def create(cls) -> _FailingSummarizer:
        return cls()

    async def generate_title(self, history):
        raise RuntimeError("simulated LLM auth failure")


async def _append_user_event(service: PostgresSessionService, session, text: str) -> None:
    event = ADKEvent(
        id=str(uuid.uuid4()),
        author="user",
        content={"parts": [{"text": text}]},
    )
    await service.append_event(session, event)


async def _get_metadata(session_id: str) -> dict:
    async with db_session.AsyncSessionLocal() as db:
        from negentropy.models.pulse import Thread

        result = await db.execute(select(Thread.metadata_).where(Thread.id == uuid.UUID(session_id)))
        return result.scalar() or {}


async def _force_metadata(session_id: str, metadata: dict) -> None:
    async with db_session.AsyncSessionLocal() as db:
        from negentropy.models.pulse import Thread

        await db.execute(update(Thread).where(Thread.id == uuid.UUID(session_id)).values(metadata_=metadata))
        await db.commit()


# ---------- Inspector backfill / refresh / skip ----------


@pytest.mark.asyncio
async def test_inspector_backfills_session_without_title(monkeypatch):
    """无 title 的 fresh-auto session 被巡检 backfill。"""
    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", _StableSummarizer)

    service = PostgresSessionService()
    app_name = f"inspector_backfill_{uuid.uuid4()}"
    user_id = f"user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    # 用 author!=user 追加事件，绕过反应式触发，模拟历史 session 留下的孤儿。
    event = ADKEvent(
        id=str(uuid.uuid4()),
        author="assistant",
        content={"parts": [{"text": "历史回复，没有触发标题"}]},
    )
    await service.append_event(session, event)
    await service.wait_for_background_tasks()
    pre = await _get_metadata(session.id)
    assert "title" not in pre

    inspector = SessionTitleInspector(batch_size=10, min_events=1, refresh_event_delta=20, session_service=service)
    await inspector.tick()

    post = await _get_metadata(session.id)
    assert post.get("title") == "首次标题"
    assert post.get("title_source") == "auto"
    assert post.get("title_generated_at_event_seq", 0) >= 1
    assert "title_generated_at" in post


@pytest.mark.asyncio
async def test_inspector_skips_manual_titles(monkeypatch):
    """title_source=manual 永不被覆盖，即使有大量新事件。"""
    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", _StableSummarizer)

    service = PostgresSessionService()
    app_name = f"inspector_manual_{uuid.uuid4()}"
    user_id = f"user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    # 用户先手动改名
    ok = await service.update_session_title(app_name=app_name, user_id=user_id, session_id=session.id, title="我的项目")
    assert ok
    pre = await _get_metadata(session.id)
    assert pre["title"] == "我的项目"
    assert pre["title_source"] == "manual"

    # 追加多个事件，让 max_seq - 0 远超 refresh_event_delta
    for i in range(5):
        await _append_user_event(service, session, f"消息 {i}")
    await service.wait_for_background_tasks()

    inspector = SessionTitleInspector(batch_size=10, min_events=1, refresh_event_delta=1, session_service=service)
    await inspector.tick()

    post = await _get_metadata(session.id)
    assert post["title"] == "我的项目"
    assert post["title_source"] == "manual"


@pytest.mark.asyncio
async def test_inspector_skips_legacy_titles(monkeypatch):
    """有 title 但 title_source 缺失的 legacy 行保守视为 manual，不被覆盖。"""
    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", _StableSummarizer)

    service = PostgresSessionService()
    app_name = f"inspector_legacy_{uuid.uuid4()}"
    user_id = f"user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    event = ADKEvent(
        id=str(uuid.uuid4()),
        author="assistant",
        content={"parts": [{"text": "随便一条事件"}]},
    )
    await service.append_event(session, event)

    # 直接植入 legacy 形状：title 有，但 title_source 缺失
    await _force_metadata(session.id, {"title": "旧标题保留"})

    inspector = SessionTitleInspector(batch_size=10, min_events=1, refresh_event_delta=1, session_service=service)
    await inspector.tick()

    post = await _get_metadata(session.id)
    assert post["title"] == "旧标题保留"
    assert "title_source" not in post


@pytest.mark.asyncio
async def test_inspector_refreshes_when_event_delta_exceeds_threshold(monkeypatch):
    """auto 标题在事件量显著增长后被刷新；event_seq 同步更新。"""
    _CountingSummarizer._counter = 0
    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", _CountingSummarizer)

    service = PostgresSessionService()
    app_name = f"inspector_refresh_{uuid.uuid4()}"
    user_id = f"user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    # 首条 user 消息触发反应式生成，得到 "标题 v1"
    await _append_user_event(service, session, "首次问候")
    await service.wait_for_background_tasks()
    after_first = await _get_metadata(session.id)
    assert after_first["title"] == "标题 v1"
    assert after_first["title_source"] == "auto"
    first_seq = after_first["title_generated_at_event_seq"]

    # 追加 3 条新事件——尚未达到 refresh_event_delta=10，巡检应跳过
    for i in range(3):
        await _append_user_event(service, session, f"小幅追加 {i}")
    await service.wait_for_background_tasks()

    # batch_size 设得足够大，避免共享测试库中的其他孤儿 session 把候选池占满
    # 导致目标 session 排在 LIMIT 之外（候选 SQL 以 NULL-title 优先）。
    inspector_short = SessionTitleInspector(
        batch_size=500, min_events=1, refresh_event_delta=10, session_service=service
    )
    await inspector_short.tick()
    unchanged = await _get_metadata(session.id)
    assert unchanged["title"] == "标题 v1"

    # 再追加事件直到 delta 跨过阈值——巡检触发刷新
    for i in range(8):
        await _append_user_event(service, session, f"大量追加 {i}")
    await service.wait_for_background_tasks()

    await inspector_short.tick()
    refreshed = await _get_metadata(session.id)
    assert refreshed["title"] != "标题 v1"
    assert refreshed["title"].startswith("标题 v")
    assert refreshed["title_source"] == "auto"
    assert refreshed["title_generated_at_event_seq"] > first_seq


@pytest.mark.asyncio
async def test_inspector_respects_max_attempts_backoff(monkeypatch):
    """连续失败的 session 在达到 max_attempts 后退出候选池。"""
    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", _FailingSummarizer)

    service = PostgresSessionService()
    app_name = f"inspector_backoff_{uuid.uuid4()}"
    user_id = f"user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    event = ADKEvent(
        id=str(uuid.uuid4()),
        author="assistant",
        content={"parts": [{"text": "失败重试样本"}]},
    )
    await service.append_event(session, event)

    inspector = SessionTitleInspector(
        batch_size=10, min_events=1, refresh_event_delta=20, max_attempts=2, session_service=service
    )

    # 第 1 次尝试：失败 → attempt_count=1
    await inspector.tick()
    meta1 = await _get_metadata(session.id)
    assert meta1.get("title_attempt_count") == 1
    assert "title" not in meta1

    # 第 2 次尝试：失败 → attempt_count=2，达到 max_attempts
    await inspector.tick()
    meta2 = await _get_metadata(session.id)
    assert meta2.get("title_attempt_count") == 2

    # 第 3 次：候选 SQL 应已排除该 session，attempt_count 不再增长
    await inspector.tick()
    meta3 = await _get_metadata(session.id)
    assert meta3.get("title_attempt_count") == 2  # unchanged


# ---------- update_session_title metadata shape contract ----------


@pytest.mark.asyncio
async def test_update_session_title_marks_manual_on_set():
    service = PostgresSessionService()
    app_name = f"update_set_{uuid.uuid4()}"
    user_id = f"user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    ok = await service.update_session_title(app_name=app_name, user_id=user_id, session_id=session.id, title="人工命名")
    assert ok
    meta = await _get_metadata(session.id)
    assert meta["title"] == "人工命名"
    assert meta["title_source"] == "manual"


@pytest.mark.asyncio
async def test_update_session_title_clear_removes_all_auto_keys(monkeypatch):
    """清空 title 时应同步清除所有 auto 溯源字段，让巡检视为 fresh-auto。"""
    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", _StableSummarizer)

    service = PostgresSessionService()
    app_name = f"update_clear_{uuid.uuid4()}"
    user_id = f"user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    # 先生成 auto 标题
    await _append_user_event(service, session, "触发生成")
    await service.wait_for_background_tasks()
    meta_after_gen = await _get_metadata(session.id)
    assert meta_after_gen["title"] == "首次标题"
    assert meta_after_gen["title_source"] == "auto"
    assert "title_generated_at_event_seq" in meta_after_gen
    assert "title_generated_at" in meta_after_gen

    # 清空 title
    ok = await service.update_session_title(app_name=app_name, user_id=user_id, session_id=session.id, title=None)
    assert ok
    meta_after_clear = await _get_metadata(session.id)
    assert "title" not in meta_after_clear
    assert "title_source" not in meta_after_clear
    assert "title_generated_at_event_seq" not in meta_after_clear
    assert "title_generated_at" not in meta_after_clear


# ---------- Reactive trigger now writes provenance fields ----------


@pytest.mark.asyncio
async def test_reactive_trigger_records_source_and_event_seq(monkeypatch):
    """append_event 触发的生成路径也应写入 title_source=auto 与 event_seq。"""
    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", _StableSummarizer)

    service = PostgresSessionService()
    app_name = f"reactive_provenance_{uuid.uuid4()}"
    user_id = f"user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    await _append_user_event(service, session, "你好")
    await service.wait_for_background_tasks()

    meta = await _get_metadata(session.id)
    assert meta["title"] == "首次标题"
    assert meta["title_source"] == "auto"
    assert meta["title_generated_at_event_seq"] >= 1
    assert "title_generated_at" in meta


# ---------- Advisory lock prevents concurrent inspector runs on same session ----------


@pytest.mark.asyncio
async def test_advisory_lock_serializes_concurrent_inspector_runs(monkeypatch):
    """两次并发 inspector.tick() 不会双重生成同一 session 标题。

    集成测试库存在跨测试残留 session，无法精准统计单 session 的 LLM 调用次数，
    所以这里改为通过 ``_generate_title_for_session`` 直接对同一 session 并发触发，
    更精准地验证 advisory lock + 二次 skip-guard 的串行化保证。
    """
    import asyncio

    call_count = 0

    class _CountedStableSummarizer:
        @classmethod
        async def create(cls) -> _CountedStableSummarizer:
            return cls()

        async def generate_title(self, history) -> str:
            nonlocal call_count
            call_count += 1
            return "唯一标题"

    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", _CountedStableSummarizer)

    service = PostgresSessionService()
    app_name = f"inspector_lock_{uuid.uuid4()}"
    user_id = f"user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    event = ADKEvent(
        id=str(uuid.uuid4()),
        author="assistant",
        content={"parts": [{"text": "并发候选种子"}]},
    )
    await service.append_event(session, event)

    inspector = SessionTitleInspector(
        batch_size=10, min_events=1, refresh_event_delta=20, concurrency=2, session_service=service
    )
    candidate = await inspector._find_candidates()
    target = next((c for c in candidate if str(c.session_id) == session.id), None)
    assert target is not None, "新建 session 应进入候选池"

    # 直接对同一 candidate 并发触发 _process_candidate——精准复现两个 worker
    # 在 SQL 查询窗口都命中同一 session 的极端情况。
    await asyncio.gather(
        inspector._process_candidate(target, service),
        inspector._process_candidate(target, service),
    )

    meta = await _get_metadata(session.id)
    assert meta["title"] == "唯一标题"
    assert meta["title_source"] == "auto"
    # 三层防御保证 LLM 对同一 session 至多被调用一次：
    # (1) advisory lock 让第二个并发任务 try_lock 失败而直接 return；
    # (2) 即便锁未生效，二次 skip-guard 在持久化前 reload metadata 命中 already_titled；
    # (3) 万一并发完全同步执行（罕见），不会产生 metadata 损坏。
    assert call_count == 1, f"expected exactly 1 LLM call, got {call_count}"
