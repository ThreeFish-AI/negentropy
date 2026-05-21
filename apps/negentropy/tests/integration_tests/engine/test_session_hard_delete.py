"""
Session 硬删除（hard_delete_session）集成测试

覆盖范围：
- 删除存在的 session 返回 True，且后续 list_sessions 不再包含；
- 删除不存在的 session 返回 False（防御性返回值，便于 API 层映射 404）；
- 已归档（metadata.archived=true）的 session 仍能被硬删除；
- thread 被删除时，其关联 events 由数据库级联清理（Event.thread_id ondelete=CASCADE）。

设计动机：ADK 基类的 ``delete_session`` 在本仓被重写为"归档"以维持兼容契约，
硬删除走独立的 ``hard_delete_session`` 入口。本测试锁定该入口契约与级联行为，
避免后续重构时悄然回退为软删除。
"""

from __future__ import annotations

import uuid

import pytest
from google.adk.events import Event as ADKEvent
from sqlalchemy import select

import negentropy.db.session as db_session
from negentropy.engine.adapters.postgres.session_service import PostgresSessionService
from negentropy.models.pulse import Event as EventModel


@pytest.mark.asyncio
async def test_hard_delete_session_removes_existing_session():
    """硬删除存在的 session：返回 True 且不再出现在 list_sessions 中。"""
    service = PostgresSessionService()
    app_name = f"hard_delete_app_{uuid.uuid4()}"
    user_id = f"hard_delete_user_{uuid.uuid4()}"

    session = await service.create_session(app_name=app_name, user_id=user_id)

    deleted = await service.hard_delete_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session.id,
    )
    assert deleted is True

    response = await service.list_sessions(app_name=app_name, user_id=user_id)
    assert all(s.id != session.id for s in response.sessions)


@pytest.mark.asyncio
async def test_hard_delete_session_returns_false_when_missing():
    """目标不存在时返回 False，便于 API 层映射 HTTP 404。"""
    service = PostgresSessionService()
    app_name = f"hard_delete_missing_app_{uuid.uuid4()}"
    user_id = f"hard_delete_missing_user_{uuid.uuid4()}"

    deleted = await service.hard_delete_session(
        app_name=app_name,
        user_id=user_id,
        session_id=str(uuid.uuid4()),
    )
    assert deleted is False


@pytest.mark.asyncio
async def test_hard_delete_session_works_on_archived_session():
    """归档后的 session 仍可硬删除，避免"已归档→不可清理"的死路径。"""
    service = PostgresSessionService()
    app_name = f"hard_delete_archived_app_{uuid.uuid4()}"
    user_id = f"hard_delete_archived_user_{uuid.uuid4()}"

    session = await service.create_session(app_name=app_name, user_id=user_id)
    archived = await service.archive_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session.id,
        archived=True,
    )
    assert archived is True

    deleted = await service.hard_delete_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session.id,
    )
    assert deleted is True

    response = await service.list_sessions(app_name=app_name, user_id=user_id)
    assert all(s.id != session.id for s in response.sessions)


@pytest.mark.asyncio
async def test_hard_delete_session_cascades_events():
    """删除 thread 时关联 events 由 FK 级联清理（ondelete=CASCADE）。"""
    service = PostgresSessionService()
    app_name = f"hard_delete_cascade_app_{uuid.uuid4()}"
    user_id = f"hard_delete_cascade_user_{uuid.uuid4()}"

    session = await service.create_session(app_name=app_name, user_id=user_id)

    for _ in range(3):
        await service.append_event(
            session,
            ADKEvent(
                id=str(uuid.uuid4()),
                author="user",
                content={"parts": [{"text": "cascade probe"}]},
            ),
        )

    # 删除前确认 events 已写入
    async with db_session.AsyncSessionLocal() as db:
        result = await db.execute(select(EventModel).where(EventModel.thread_id == uuid.UUID(session.id)))
        assert len(result.scalars().all()) == 3

    deleted = await service.hard_delete_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session.id,
    )
    assert deleted is True

    # 删除后 events 应一并清理
    async with db_session.AsyncSessionLocal() as db:
        result = await db.execute(select(EventModel).where(EventModel.thread_id == uuid.UUID(session.id)))
        assert result.scalars().all() == []
