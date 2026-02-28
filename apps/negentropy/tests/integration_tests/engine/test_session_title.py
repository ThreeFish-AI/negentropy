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
    """替代 LLM 的最小实现，避免外部依赖"""

    def __init__(self) -> None:
        pass

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
