"""
PostgresSessionService: ADK SessionService 的 PostgreSQL 实现

继承 Google ADK BaseSessionService，实现对标 Vertex AI Agent Engine 的会话管理能力：
- Session CRUD 操作
- Event 追加与 State Delta 应用
- State 前缀作用域路由

重构说明：
    本版本从 raw asyncpg + SQL 迁移到 SQLAlchemy ORM，复用：
    - `db/session.py` 中的 `AsyncSessionLocal`
    - `models/pulse.py` 中的 `Thread`, `Event`, `UserState`, `AppState`
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

# ADK 官方类型
from google.adk.sessions import Session
from google.adk.sessions.base_session_service import (
    BaseSessionService,
    GetSessionConfig,
    ListSessionsResponse,
)
from google.adk.events import Event as ADKEvent

# ORM 模型与会话工厂
import negentropy.db.session as db_session
from negentropy.models.pulse import AppState, Event, Thread, UserState


class PostgresSessionService(BaseSessionService):
    """
    PostgreSQL 实现的 SessionService

    继承 ADK BaseSessionService，可直接与 ADK Runner 集成。

    核心职责：
    1. Session 生命周期管理 (CRUD)
    2. Event 追加与 State 更新
    3. State 前缀路由 (无前缀/user:/app:/temp:)
    """

    def __init__(self):
        self._temp_state: dict[str, dict] = {}  # temp: 前缀的内存缓存

    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: Optional[dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> Session:
        """创建新会话"""
        sid = session_id or str(uuid.uuid4())
        initial_state = state or {}

        async with db_session.AsyncSessionLocal() as db:
            thread = Thread(
                id=uuid.UUID(sid),
                app_name=app_name,
                user_id=user_id,
                state=initial_state,
            )
            db.add(thread)
            await db.commit()

        return Session(
            id=sid,
            app_name=app_name,
            user_id=user_id,
            state=initial_state,
            events=[],
            last_update_time=datetime.now().timestamp(),
        )

    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        config: Optional[GetSessionConfig] = None,
    ) -> Optional[Session]:
        """获取会话"""
        try:
            sid = uuid.UUID(session_id)
        except ValueError:
            return None

        async with db_session.AsyncSessionLocal() as db:
            # 获取 Thread
            result = await db.execute(
                select(Thread).where(
                    Thread.id == sid,
                    Thread.app_name == app_name,
                    Thread.user_id == user_id,
                )
            )
            thread = result.scalar_one_or_none()
            if not thread:
                return None

            # 获取 Events
            events_query = select(Event).where(Event.thread_id == sid).order_by(Event.sequence_num.asc())

            # 支持 GetSessionConfig 的过滤
            if config and config.num_recent_events:
                # 获取最新 N 条，然后按时间正序
                events_query = (
                    select(Event)
                    .where(Event.thread_id == sid)
                    .order_by(Event.sequence_num.desc())
                    .limit(config.num_recent_events)
                )

            events_result = await db.execute(events_query)
            events = list(events_result.scalars().all())

            # 如果使用了 limit，需要反转回正序
            if config and config.num_recent_events:
                events = list(reversed(events))

            return Session(
                id=str(thread.id),
                app_name=thread.app_name,
                user_id=thread.user_id,
                state=thread.state or {},
                events=[self._orm_to_adk_event(e) for e in events],
                last_update_time=thread.updated_at.timestamp() if thread.updated_at else datetime.now().timestamp(),
            )

    async def list_sessions(self, *, app_name: str, user_id: Optional[str] = None) -> ListSessionsResponse:
        """列出所有会话"""
        async with db_session.AsyncSessionLocal() as db:
            query = select(Thread).where(Thread.app_name == app_name)
            if user_id:
                query = query.where(Thread.user_id == user_id)
            query = query.order_by(Thread.updated_at.desc())

            result = await db.execute(query)
            threads = result.scalars().all()

        sessions = [
            Session(
                id=str(t.id),
                app_name=t.app_name,
                user_id=t.user_id,
                state=t.state or {},
                events=[],  # 列表不加载 events
                last_update_time=t.updated_at.timestamp() if t.updated_at else datetime.now().timestamp(),
            )
            for t in threads
        ]

        return ListSessionsResponse(sessions=sessions)

    async def delete_session(self, *, app_name: str, user_id: str, session_id: str) -> None:
        """删除会话"""
        async with db_session.AsyncSessionLocal() as db:
            await db.execute(
                delete(Thread).where(
                    Thread.id == uuid.UUID(session_id),
                    Thread.app_name == app_name,
                    Thread.user_id == user_id,
                )
            )
            await db.commit()

    async def append_event(self, session: Session, event: ADKEvent) -> ADKEvent:
        """
        追加事件并应用 state_delta

        重写基类方法以支持 PostgreSQL 持久化
        """
        # 调用基类方法处理 temp: 前缀过滤和内存中的 session.state 更新
        event = await super().append_event(session, event)

        # 持久化到数据库 - 安全处理 UUID
        event_id = self._ensure_uuid(event.id)
        invocation_id = self._ensure_uuid(event.invocation_id)

        async with db_session.AsyncSessionLocal() as db:
            # 1. 插入 Event
            db_event = Event(
                id=event_id,
                thread_id=uuid.UUID(session.id),
                invocation_id=invocation_id,
                author=event.author,
                event_type="message",
                content=self._serialize_content(event.content),
                actions=event.actions.model_dump() if event.actions else {},
            )
            db.add(db_event)

            # 2. 应用 state_delta 到数据库
            if event.actions and event.actions.state_delta:
                await self._apply_state_delta_to_db(db, session, event.actions.state_delta)

            await db.commit()

        event.id = event_id
        return event

    async def _apply_state_delta_to_db(self, db: AsyncSession, session: Session, state_delta: dict[str, Any]) -> None:
        """应用 state_delta，根据前缀路由到不同存储"""
        session_updates = {}
        user_updates = {}
        app_updates = {}

        for key, value in state_delta.items():
            if key.startswith("temp:"):
                # temp: 前缀 -> 内存缓存 (基类已处理跳过)
                continue
            elif key.startswith("user:"):
                # user: 前缀 -> user_states 表
                real_key = key[5:]
                user_updates[real_key] = value
            elif key.startswith("app:"):
                # app: 前缀 -> app_states 表
                real_key = key[4:]
                app_updates[real_key] = value
            else:
                # 无前缀 -> threads.state
                session_updates[key] = value

        # 更新 Session State (Thread)
        if session_updates:
            result = await db.execute(select(Thread).where(Thread.id == uuid.UUID(session.id)))
            thread = result.scalar_one_or_none()
            if thread:
                thread.state = {**(thread.state or {}), **session_updates}

        # 更新 User State (UPSERT)
        if user_updates:
            result = await db.execute(
                select(UserState).where(
                    UserState.user_id == session.user_id,
                    UserState.app_name == session.app_name,
                )
            )
            user_state = result.scalar_one_or_none()
            if user_state:
                user_state.state = {**(user_state.state or {}), **user_updates}
            else:
                db.add(
                    UserState(
                        user_id=session.user_id,
                        app_name=session.app_name,
                        state=user_updates,
                    )
                )

        # 更新 App State (UPSERT)
        if app_updates:
            result = await db.execute(select(AppState).where(AppState.app_name == session.app_name))
            app_state = result.scalar_one_or_none()
            if app_state:
                app_state.state = {**(app_state.state or {}), **app_updates}
            else:
                db.add(
                    AppState(
                        app_name=session.app_name,
                        state=app_updates,
                    )
                )

    def _orm_to_adk_event(self, event: Event) -> ADKEvent:
        """将 ORM Event 对象转换为 ADK Event 对象"""
        from google.genai import types

        content_dict = event.content or {}

        # 从存储的字典重建 Content 对象
        content = None
        if content_dict:
            parts = []
            for part_data in content_dict.get("parts", []):
                if isinstance(part_data, dict) and "text" in part_data:
                    parts.append(types.Part(text=part_data["text"]))
            if parts:
                content = types.Content(role=content_dict.get("role", "user"), parts=parts)

        return ADKEvent(
            id=str(event.id),
            author=event.author,
            content=content,
            timestamp=event.created_at.timestamp() if event.created_at else datetime.now().timestamp(),
        )

    def _ensure_uuid(self, value: Any) -> uuid.UUID:
        """确保值是有效的 UUID 对象"""
        if value is None:
            return uuid.uuid4()
        if isinstance(value, uuid.UUID):
            return value
        try:
            # 尝试作为标准 UUID 字符串解析
            return uuid.UUID(str(value))
        except (ValueError, AttributeError):
            # 如果解析失败，生成新的 UUID
            return uuid.uuid4()

    def _serialize_content(self, content: Any) -> dict:
        """安全序列化 Event.content"""
        if content is None:
            return {}
        if hasattr(content, "model_dump"):
            data = content.model_dump()
            return self._clean_for_json(data)
        if isinstance(content, dict):
            return self._clean_for_json(content)
        if isinstance(content, list):
            return {"parts": self._clean_for_json(content)}
        return {"text": str(content)}

    def _clean_for_json(self, obj: Any) -> Any:
        """递归清理对象使其可 JSON 序列化"""
        import base64

        if obj is None:
            return None
        if isinstance(obj, bytes):
            # bytes 转换为 base64 字符串
            return base64.b64encode(obj).decode("utf-8")
        if isinstance(obj, dict):
            return {k: self._clean_for_json(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._clean_for_json(item) for item in obj]
        if isinstance(obj, (str, int, float, bool)):
            return obj
        # 其他类型转换为字符串
        return str(obj)
