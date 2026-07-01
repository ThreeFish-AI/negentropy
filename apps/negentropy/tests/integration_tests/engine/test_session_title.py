"""
Session Title 生成与列表展示的最小化闭环测试

目标：
首次用户消息触发后台生成标题，随后 list_sessions 可读取 metadata.title。
"""

from __future__ import annotations

import uuid

import pytest
from google.adk.events import Event as ADKEvent

from negentropy.engine.adapters.postgres.session_service import PostgresSessionService


class DummySummarizer:
    """替代 LLM 的最小实现，避免外部依赖。

    需暴露 ``async classmethod create()`` 与生产侧 ``SessionSummarizer.create()``
    异步工厂契约对齐——调用方 ``session_service.py`` 通过
    ``await SessionSummarizer.create()`` 构造实例，monkeypatch 替换的桩类必须
    兼容该入口。
    """

    @classmethod
    async def create(cls) -> DummySummarizer:
        return cls()

    async def generate_title(self, history) -> str:
        return "首次标题"


@pytest.mark.asyncio
async def test_first_user_message_triggers_title_generation(monkeypatch):
    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", DummySummarizer)

    service = PostgresSessionService()
    app_name = f"title_app_{uuid.uuid4()}"
    user_id = f"title_user_{uuid.uuid4()}"

    session = await service.create_session(app_name=app_name, user_id=user_id)

    event = ADKEvent(
        id=str(uuid.uuid4()),
        author="user",
        content={"parts": [{"text": "你好，这是一次标题生成测试。"}]},
    )

    await service.append_event(session, event)
    await service.wait_for_background_tasks()

    response = await service.list_sessions(app_name=app_name, user_id=user_id)
    target = next((s for s in response.sessions if s.id == session.id), None)

    assert target is not None
    title = (target.state.get("metadata") or {}).get("title")
    assert title == "首次标题"


@pytest.mark.asyncio
async def test_archive_and_unarchive_session_updates_metadata():
    service = PostgresSessionService()
    app_name = f"archive_app_{uuid.uuid4()}"
    user_id = f"archive_user_{uuid.uuid4()}"

    session = await service.create_session(app_name=app_name, user_id=user_id)

    archived = await service.archive_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session.id,
        archived=True,
    )
    assert archived is True

    response = await service.list_sessions(app_name=app_name, user_id=user_id)
    target = next((s for s in response.sessions if s.id == session.id), None)
    assert target is not None
    assert (target.state.get("metadata") or {}).get("archived") is True

    restored = await service.archive_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session.id,
        archived=False,
    )
    assert restored is True

    response = await service.list_sessions(app_name=app_name, user_id=user_id)
    target = next((s for s in response.sessions if s.id == session.id), None)
    assert target is not None
    assert (target.state.get("metadata") or {}).get("archived") is False


@pytest.mark.asyncio
async def test_get_session_preserves_event_sequence_for_tool_interleaving():
    service = PostgresSessionService()
    app_name = f"event_order_app_{uuid.uuid4()}"
    user_id = f"event_order_user_{uuid.uuid4()}"

    session = await service.create_session(app_name=app_name, user_id=user_id)

    events = [
        ADKEvent(
            id=str(uuid.uuid4()),
            author="assistant",
            content={"parts": [{"text": "好的，我将搜索 AfterShip。"}]},
        ),
        ADKEvent(
            id=str(uuid.uuid4()),
            author="assistant",
            content={
                "parts": [
                    {
                        "functionCall": {
                            "id": "call-1",
                            "name": "google_search",
                            "args": {"q": "AfterShip"},
                        }
                    }
                ]
            },
        ),
        ADKEvent(
            id=str(uuid.uuid4()),
            author="assistant",
            content={"parts": [{"text": "## AfterShip 信息摘要"}]},
        ),
    ]

    for event in events:
        await service.append_event(session, event)

    fetched = await service.get_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session.id,
    )

    assert fetched is not None
    assert len(fetched.events) == 3
    assert [str(event.id) for event in fetched.events] == [str(event.id) for event in events]
    assert fetched.events[0].content.parts[0].text == "好的，我将搜索 AfterShip。"
    assert fetched.events[1].author == "assistant"
    assert fetched.events[1].content is not None
    assert len(fetched.events[1].content.parts) == 1
    assert fetched.events[1].content.parts[0].text is None
    assert fetched.events[2].content.parts[0].text == "## AfterShip 信息摘要"


# ---------------------------------------------------------------------------
# history 提取增强：首条 user 消息必入 + 有效文本阈值
# ---------------------------------------------------------------------------


async def _append_event_with_author(service, session, author: str, text: str) -> None:
    event = ADKEvent(
        id=str(uuid.uuid4()),
        author=author,
        content={"parts": [{"text": text}]},
    )
    await service.append_event(session, event)


@pytest.mark.asyncio
async def test_long_session_history_includes_first_user_message(monkeypatch):
    """长会话（>6 条）首条 user 消息必须进入标题生成的 history。

    验证 ``_generate_title_for_session`` 的「首条 user + 最近 6 条」去重合并，
    避免长会话把最能代表主题的首条消息截断丢失。反应式路径首条消息后即成标题、
    后续会被 already_titled 跳过，故此处用 force_refresh 直接复现「最近 6 条窗口
    已不含首条」的场景（与 test_advisory_lock 同样直接调用内部方法）。
    """
    captured: list[list[str]] = []

    class _CaptureSummarizer:
        @classmethod
        async def create(cls) -> _CaptureSummarizer:
            return cls()

        async def generate_title(self, history) -> str:
            captured.append([p.text for c in history for p in c.parts if getattr(p, "text", None)])
            return "捕获会话主题"

    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", _CaptureSummarizer)

    service = PostgresSessionService()
    app_name = f"longhist_app_{uuid.uuid4()}"
    user_id = f"longhist_user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    first_text = "查询茅台股票最新财报数据"
    # 首条 user（最能代表主题）
    await _append_event_with_author(service, session, "user", first_text)
    # 再追加 6 条 assistant，使首条落在「最近 6 条」窗口之外
    for i in range(6):
        await _append_event_with_author(service, session, "assistant", f"后续补充回复编号 {i} 用以填充窗口")
    await service.wait_for_background_tasks()

    captured.clear()  # 清掉反应式触发的捕获，只看 force_refresh 这一次
    await service._generate_title_for_session(session.id, force_refresh=True)

    assert captured, "force_refresh 应触发一次生成"
    assert first_text in captured[-1], f"首条主题消息未进入 history: {captured[-1]}"


@pytest.mark.asyncio
async def test_low_content_history_skips_generation(monkeypatch):
    """有效文本总量 < 阈值（默认 8）时不发起 LLM 调用，避免在空对话上硬生成空洞标题。"""
    called = {"n": 0}

    class _CountingSummarizer:
        @classmethod
        async def create(cls) -> _CountingSummarizer:
            return cls()

        async def generate_title(self, history):
            called["n"] += 1
            return "不该被调用生成"

    monkeypatch.setattr("negentropy.engine.summarization.SessionSummarizer", _CountingSummarizer)

    service = PostgresSessionService()
    app_name = f"lowcontent_app_{uuid.uuid4()}"
    user_id = f"lowcontent_user_{uuid.uuid4()}"
    session = await service.create_session(app_name=app_name, user_id=user_id)

    # 仅追加一条 2 字 user 消息（< _TITLE_MIN_HISTORY_CHARS=8）
    await _append_event_with_author(service, session, "user", "你好")
    await service.wait_for_background_tasks()

    assert called["n"] == 0, "低内容 history 不应触发 LLM 标题生成"
    response = await service.list_sessions(app_name=app_name, user_id=user_id)
    target = next((s for s in response.sessions if s.id == session.id), None)
    assert target is not None
    assert "title" not in (target.state.get("metadata") or {})
