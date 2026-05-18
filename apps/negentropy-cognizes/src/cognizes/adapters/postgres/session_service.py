"""
PostgresSessionService: ADK SessionService 的 PostgreSQL 实现

继承 Google ADK BaseSessionService，实现对标 Vertex AI Agent Engine 的会话管理能力：
- Session CRUD 操作
- Event 追加与 State Delta 应用
- State 前缀作用域路由
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Optional

import asyncpg

# ADK 官方类型
from google.adk.sessions import Session
from google.adk.sessions.base_session_service import (
    BaseSessionService,
    GetSessionConfig,
    ListSessionsResponse,
)
from google.adk.events import Event


class PostgresSessionService(BaseSessionService):
    """
    PostgreSQL 实现的 SessionService

    继承 ADK BaseSessionService，可直接与 ADK Runner 集成。

    核心职责：
    1. Session 生命周期管理 (CRUD)
    2. Event 追加与 State 更新
    3. State 前缀路由 (无前缀/user:/app:/temp:)
    """

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool
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

        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO threads (id, app_name, user_id, state)
                VALUES ($1, $2, $3, $4)
                """,
                uuid.UUID(sid),
                app_name,
                user_id,
                json.dumps(initial_state),
            )

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

        async with self._pool.acquire() as conn:
            # 获取 Thread
            row = await conn.fetchrow(
                """
                SELECT id, app_name, user_id, state, updated_at
                FROM threads
                WHERE id = $1 AND app_name = $2 AND user_id = $3
                """,
                sid,
                app_name,
                user_id,
            )
            if not row:
                return None

            # 获取 Events
            events_query = """
                SELECT id, author, event_type, content, actions, created_at
                FROM events
                WHERE thread_id = $1
                ORDER BY sequence_num ASC
            """

            # 支持 GetSessionConfig 的过滤
            if config and config.num_recent_events:
                events_query = f"""
                    SELECT * FROM (
                        SELECT id, author, event_type, content, actions, created_at
                        FROM events
                        WHERE thread_id = $1
                        ORDER BY sequence_num DESC
                        LIMIT {config.num_recent_events}
                    ) sub ORDER BY created_at ASC
                """

            events = await conn.fetch(events_query, uuid.UUID(session_id))

            return Session(
                id=str(row["id"]),
                app_name=row["app_name"],
                user_id=row["user_id"],
                state=json.loads(row["state"]) if row["state"] else {},
                events=[self._row_to_event(e) for e in events],
                last_update_time=row["updated_at"].timestamp(),
            )

    async def list_sessions(self, *, app_name: str, user_id: Optional[str] = None) -> ListSessionsResponse:
        """列出所有会话"""
        async with self._pool.acquire() as conn:
            if user_id:
                rows = await conn.fetch(
                    """
                    SELECT id, app_name, user_id, state, updated_at
                    FROM threads
                    WHERE app_name = $1 AND user_id = $2
                    ORDER BY updated_at DESC
                    """,
                    app_name,
                    user_id,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT id, app_name, user_id, state, updated_at
                    FROM threads
                    WHERE app_name = $1
                    ORDER BY updated_at DESC
                    """,
                    app_name,
                )

        sessions = [
            Session(
                id=str(row["id"]),
                app_name=row["app_name"],
                user_id=row["user_id"],
                state=json.loads(row["state"]) if row["state"] else {},
                events=[],  # 列表不加载 events
                last_update_time=row["updated_at"].timestamp(),
            )
            for row in rows
        ]

        return ListSessionsResponse(sessions=sessions)

    async def delete_session(self, *, app_name: str, user_id: str, session_id: str) -> None:
        """删除会话"""
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                DELETE FROM threads
                WHERE id = $1 AND app_name = $2 AND user_id = $3
                """,
                uuid.UUID(session_id),
                app_name,
                user_id,
            )

    async def append_event(self, session: Session, event: Event) -> Event:
        """
        追加事件并应用 state_delta

        重写基类方法以支持 PostgreSQL 持久化
        """
        # 调用基类方法处理 temp: 前缀过滤和内存中的 session.state 更新
        event = await super().append_event(session, event)

        # 持久化到数据库 - 安全处理 UUID
        event_id = self._ensure_uuid(event.id)
        invocation_id = self._ensure_uuid(event.invocation_id)

        async with self._pool.acquire() as conn:
            async with conn.transaction():
                # 1. 插入 Event
                await conn.execute(
                    """
                    INSERT INTO events
                    (id, thread_id, invocation_id, author, event_type, content, actions)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """,
                    event_id,
                    uuid.UUID(session.id),
                    invocation_id,
                    event.author,
                    "message",
                    json.dumps(self._serialize_content(event.content)),
                    json.dumps(event.actions.model_dump() if event.actions else {}),
                )

                # 2. 应用 state_delta 到数据库
                if event.actions and event.actions.state_delta:
                    await self._apply_state_delta_to_db(conn, session, event.actions.state_delta)

        event.id = event_id
        return event

    async def _apply_state_delta_to_db(
        self, conn: asyncpg.Connection, session: Session, state_delta: dict[str, Any]
    ) -> None:
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

        # 更新 Session State
        if session_updates:
            await conn.execute(
                """
                UPDATE threads
                SET state = state || $1::jsonb, updated_at = NOW()
                WHERE id = $2
                """,
                json.dumps(session_updates),
                uuid.UUID(session.id),
            )

        # 更新 User State
        if user_updates:
            await conn.execute(
                """
                INSERT INTO user_states (user_id, app_name, state)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, app_name)
                DO UPDATE SET state = user_states.state || $3::jsonb,
                              updated_at = NOW()
                """,
                session.user_id,
                session.app_name,
                json.dumps(user_updates),
            )

        # 更新 App State
        if app_updates:
            await conn.execute(
                """
                INSERT INTO app_states (app_name, state)
                VALUES ($1, $2)
                ON CONFLICT (app_name)
                DO UPDATE SET state = app_states.state || $2::jsonb,
                              updated_at = NOW()
                """,
                session.app_name,
                json.dumps(app_updates),
            )

    def _row_to_event(self, row) -> Event:
        """将数据库行转换为 ADK Event 对象"""
        from google.genai import types

        content_dict = json.loads(row["content"]) if row["content"] else {}
        actions_dict = json.loads(row["actions"]) if row["actions"] else {}

        # 从存储的字典重建 Content 对象
        content = None
        if content_dict:
            parts = []
            for part_data in content_dict.get("parts", []):
                if isinstance(part_data, dict) and "text" in part_data:
                    parts.append(types.Part(text=part_data["text"]))
            if parts:
                content = types.Content(role=content_dict.get("role", "user"), parts=parts)

        return Event(id=str(row["id"]), author=row["author"], content=content, timestamp=row["created_at"].timestamp())

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
