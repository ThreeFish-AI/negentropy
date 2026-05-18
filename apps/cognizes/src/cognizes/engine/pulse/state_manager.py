"""
StateManager: 原子状态流转管理器

实现对标 Google ADK SessionService 的状态管理能力：
- 原子状态流转 (Atomic State Transitions)
- 乐观并发控制 (Optimistic Concurrency Control)
- State 前缀作用域解析
"""

from __future__ import annotations

import asyncio
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from cognizes.core.database import DatabaseManager


@dataclass
class Session:
    """会话对象 - 对标 ADK Session"""

    id: str
    app_name: str
    user_id: str
    state: dict[str, Any] = field(default_factory=dict)
    version: int = 1
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Event:
    """事件对象 - 对标 ADK Event"""

    id: str
    thread_id: str
    invocation_id: str
    author: str  # 'user', 'agent', 'tool'
    event_type: str  # 'message', 'tool_call', 'state_update'
    content: dict[str, Any] = field(default_factory=dict)
    actions: dict[str, Any] = field(default_factory=dict)
    created_at: datetime | None = None


class ConcurrencyConflictError(Exception):
    """乐观锁冲突异常"""

    pass


class StateManager:
    """
    状态管理器 - 实现原子状态流转和乐观并发控制

    核心职责：
    1. Session CRUD 操作
    2. 原子事务保证 (BEGIN...COMMIT)
    3. 乐观锁 CAS (Compare-And-Set)
    4. State 前缀解析
    """

    def __init__(self, db: "DatabaseManager"):
        # Type hint is DatabaseManager to support IDE autocompletion
        self.db = db
        self._temp_state: dict[str, dict] = {}  # temp: 前缀的内存缓存

    # ========================================
    # Session CRUD 操作
    # ========================================

    # ========================================
    # Session CRUD 操作
    # ========================================

    async def create_session(self, app_name: str, user_id: str, initial_state: dict[str, Any] | None = None) -> Session:
        """创建新会话"""
        session_id = uuid.uuid4()
        state = initial_state or {}

        row = await self.db.sessions.create(session_id, app_name, user_id, state)
        return self._row_to_session(row)

    async def get_session(self, app_name: str, user_id: str, session_id: str) -> Session | None:
        """获取会话"""
        row = await self.db.sessions.get(uuid.UUID(session_id), app_name, user_id)
        return self._row_to_session(row) if row else None

    async def list_sessions(self, app_name: str, user_id: str) -> list[Session]:
        """列出用户所有会话"""
        rows = await self.db.sessions.list(app_name, user_id)
        return [self._row_to_session(row) for row in rows]

    async def delete_session(self, app_name: str, user_id: str, session_id: str) -> bool:
        """删除会话"""
        return await self.db.sessions.delete(uuid.UUID(session_id), app_name, user_id)

    # ========================================
    # 原子状态流转
    # ========================================

    async def append_event(self, session: Session, event: Event) -> Event:
        """
        追加事件并原子性地应用 state_delta
        """
        state_delta = event.actions.get("state_delta", {})
        new_state = None

        if state_delta:
            new_state = {**session.state, **state_delta}

        event_data = {
            "id": uuid.uuid4(),
            "invocation_id": uuid.UUID(event.invocation_id),
            "author": event.author,
            "event_type": event.event_type,
            "content": event.content,
            "actions": event.actions,
        }

        result = await self.db.events.atomic_append(uuid.UUID(session.id), session.version, new_state, event_data)

        if result["status"] == "conflict":
            raise ConcurrencyConflictError(
                f"Session {session.id} version conflict. Expected {session.version}, but it was modified."
            )

        # Success - update local objects
        event_row = result["event"]
        event.id = str(event_row["id"])
        event.created_at = event_row["created_at"]

        if result["version"] is not None:
            session.version = result["version"]
            if new_state:
                session.state = new_state

        return event

    # ========================================
    # 乐观并发控制 (OCC)
    # ========================================

    async def update_session_state(
        self, session: Session, state_delta: dict[str, Any], max_retries: int = 3
    ) -> Session:
        """
        带重试的乐观锁状态更新
        """
        for attempt in range(max_retries):
            try:
                # 构造一个 state_update 事件
                event = Event(
                    id="",
                    thread_id=session.id,
                    invocation_id=str(uuid.uuid4()),
                    author="system",
                    event_type="state_update",
                    actions={"state_delta": state_delta},
                )
                await self.append_event(session, event)
                return session

            except ConcurrencyConflictError:
                if attempt == max_retries - 1:
                    raise

                # 重新加载最新状态
                updated_session = await self.get_session(session.app_name, session.user_id, session.id)
                if updated_session:
                    session.state = updated_session.state
                    session.version = updated_session.version

                await asyncio.sleep(0.01 * (attempt + 1))  # 退避策略

        return session

    # ========================================
    # State 前缀处理
    # ========================================

    def parse_state_prefix(self, key: str) -> tuple[str, str]:
        """
        解析 State Key 的前缀
        """
        prefixes = ["user:", "app:", "temp:"]
        for prefix in prefixes:
            if key.startswith(prefix):
                return prefix.rstrip(":"), key[len(prefix) :]
        return "session", key

    async def set_state(self, session: Session, key: str, value: Any) -> None:
        """
        根据前缀设置状态值
        """
        prefix, actual_key = self.parse_state_prefix(key)

        if prefix == "session":
            await self.update_session_state(session, {actual_key: value})

        elif prefix == "temp":
            cache_key = f"{session.id}"
            if cache_key not in self._temp_state:
                self._temp_state[cache_key] = {}
            self._temp_state[cache_key][actual_key] = value

        elif prefix == "user":
            await self.db.states.set_user_state(session.user_id, session.app_name, actual_key, value)

        elif prefix == "app":
            await self.db.states.set_app_state(session.app_name, actual_key, value)

    async def get_state(self, session: Session, key: str, default: Any = None) -> Any:
        """
        根据前缀获取状态值
        """
        prefix, actual_key = self.parse_state_prefix(key)

        if prefix == "session":
            return session.state.get(actual_key, default)

        elif prefix == "temp":
            cache_key = f"{session.id}"
            temp_state = self._temp_state.get(cache_key, {})
            return temp_state.get(actual_key, default)

        elif prefix == "user":
            val = await self.db.states.get_user_state(session.user_id, session.app_name, actual_key)
            return val if val is not None else default

        elif prefix == "app":
            val = await self.db.states.get_app_state(session.app_name, actual_key)
            return val if val is not None else default

        return default

    async def get_all_state(self, session: Session) -> dict[str, Any]:
        """
        获取会话的完整状态视图 (合并所有作用域)
        """
        result = {}

        # Session scope (无前缀)
        result.update(session.state)

        # Temp scope
        cache_key = f"{session.id}"
        temp_state = self._temp_state.get(cache_key, {})
        for k, v in temp_state.items():
            result[f"temp:{k}"] = v

        # User scope
        user_state = await self.db.states.get_all_user_state(session.user_id, session.app_name)
        for k, v in user_state.items():
            result[f"user:{k}"] = v

        # App scope
        app_state = await self.db.states.get_all_app_state(session.app_name)
        for k, v in app_state.items():
            result[f"app:{k}"] = v

        return result

    # ========================================
    # 辅助方法
    # ========================================

    def _row_to_session(self, row: Any) -> Session:
        """将数据库行转换为 Session 对象"""
        # Note: 'row' is likely asyncpg.Record, but we use Any to avoid overly strict type checking
        # without importing asyncpg here if we want to decouple fully.

        raw_state = row["state"]
        if isinstance(raw_state, str):
            state = json.loads(raw_state)
        elif isinstance(raw_state, dict):
            state = raw_state
        else:
            state = {}

        return Session(
            id=str(row["id"]),
            app_name=row["app_name"],
            user_id=row["user_id"],
            state=state,
            version=row["version"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    async def create_session(self, app_name: str, user_id: str, initial_state: dict[str, Any] | None = None) -> Session:
        """创建新会话"""
        session_id = uuid.uuid4()
        state = initial_state or {}

        row = await self.db.sessions.create(session_id, app_name, user_id, state)
        return self._row_to_session(row)

    async def get_session(self, app_name: str, user_id: str, session_id: str) -> Session | None:
        """获取会话"""
        row = await self.db.sessions.get(uuid.UUID(session_id), app_name, user_id)
        return self._row_to_session(row) if row else None

    async def list_sessions(self, app_name: str, user_id: str) -> list[Session]:
        """列出用户所有会话"""
        rows = await self.db.sessions.list(app_name, user_id)
        return [self._row_to_session(row) for row in rows]

    async def delete_session(self, app_name: str, user_id: str, session_id: str) -> bool:
        """删除会话"""
        return await self.db.sessions.delete(uuid.UUID(session_id), app_name, user_id)

    # ========================================
    # 原子状态流转
    # ========================================

    async def append_event(self, session: Session, event: Event) -> Event:
        """
        追加事件并原子性地应用 state_delta
        """
        state_delta = event.actions.get("state_delta", {})
        new_state = None

        if state_delta:
            new_state = {**session.state, **state_delta}

        event_data = {
            "id": uuid.uuid4(),
            "invocation_id": uuid.UUID(event.invocation_id),
            "author": event.author,
            "event_type": event.event_type,
            "content": event.content,
            "actions": event.actions,
        }

        result = await self.db.events.atomic_append(uuid.UUID(session.id), session.version, new_state, event_data)

        if result["status"] == "conflict":
            raise ConcurrencyConflictError(
                f"Session {session.id} version conflict. Expected {session.version}, but it was modified."
            )

        # Success - update local objects
        event_row = result["event"]
        event.id = str(event_row["id"])
        event.created_at = event_row["created_at"]

        if result["version"] is not None:
            session.version = result["version"]
            if new_state:
                session.state = new_state

        return event

    # ========================================
    # 乐观并发控制 (OCC)
    # ========================================

    async def update_session_state(
        self, session: Session, state_delta: dict[str, Any], max_retries: int = 3
    ) -> Session:
        """
        带重试的乐观锁状态更新

        当检测到版本冲突时，自动重新加载最新状态并重试
        """
        for attempt in range(max_retries):
            try:
                # 构造一个 state_update 事件
                event = Event(
                    id="",
                    thread_id=session.id,
                    invocation_id=str(uuid.uuid4()),
                    author="system",
                    event_type="state_update",
                    actions={"state_delta": state_delta},
                )
                await self.append_event(session, event)
                return session

            except ConcurrencyConflictError:
                if attempt == max_retries - 1:
                    raise

                # 重新加载最新状态
                session = await self.get_session(session.app_name, session.user_id, session.id)
                await asyncio.sleep(0.01 * (attempt + 1))  # 退避策略

        return session

    # ========================================
    # State 前缀处理
    # ========================================

    def parse_state_prefix(self, key: str) -> tuple[str, str]:
        """
        解析 State Key 的前缀

        Returns:
            (prefix, actual_key): 前缀和实际的 key

        Examples:
            "user:language" -> ("user", "language")
            "app:max_retries" -> ("app", "max_retries")
            "temp:intermediate" -> ("temp", "intermediate")
            "task_progress" -> ("session", "task_progress")
        """
        prefixes = ["user:", "app:", "temp:"]
        for prefix in prefixes:
            if key.startswith(prefix):
                return prefix.rstrip(":"), key[len(prefix) :]
        return "session", key

    async def set_state(self, session: Session, key: str, value: Any) -> None:
        """
        根据前缀设置状态值
        """
        prefix, actual_key = self.parse_state_prefix(key)

        if prefix == "session":
            await self.update_session_state(session, {actual_key: value})

        elif prefix == "temp":
            cache_key = f"{session.id}"
            if cache_key not in self._temp_state:
                self._temp_state[cache_key] = {}
            self._temp_state[cache_key][actual_key] = value

        elif prefix == "user":
            await self.db.states.set_user_state(session.user_id, session.app_name, actual_key, value)

        elif prefix == "app":
            await self.db.states.set_app_state(session.app_name, actual_key, value)

    async def get_state(self, session: Session, key: str, default: Any = None) -> Any:
        """
        根据前缀获取状态值
        """
        prefix, actual_key = self.parse_state_prefix(key)

        if prefix == "session":
            return session.state.get(actual_key, default)

        elif prefix == "temp":
            cache_key = f"{session.id}"
            temp_state = self._temp_state.get(cache_key, {})
            return temp_state.get(actual_key, default)

        elif prefix == "user":
            val = await self.db.states.get_user_state(session.user_id, session.app_name, actual_key)
            return val if val is not None else default

        elif prefix == "app":
            val = await self.db.states.get_app_state(session.app_name, actual_key)
            return val if val is not None else default

        return default

    async def get_all_state(self, session: Session) -> dict[str, Any]:
        """
        获取会话的完整状态视图 (合并所有作用域)
        """
        result = {}

        # Session scope (无前缀)
        result.update(session.state)

        # Temp scope
        cache_key = f"{session.id}"
        temp_state = self._temp_state.get(cache_key, {})
        for k, v in temp_state.items():
            result[f"temp:{k}"] = v

        # User scope
        user_state = await self.db.states.get_all_user_state(session.user_id, session.app_name)
        for k, v in user_state.items():
            result[f"user:{k}"] = v

        # App scope
        app_state = await self.db.states.get_all_app_state(session.app_name)
        for k, v in app_state.items():
            result[f"app:{k}"] = v

        return result

    # ========================================
    # 辅助方法
    # ========================================

    def _row_to_session(self, row: asyncpg.Record) -> Session:
        """将数据库行转换为 Session 对象"""
        raw_state = row["state"]
        if isinstance(raw_state, str):
            state = json.loads(raw_state)
        elif isinstance(raw_state, dict):
            state = raw_state
        else:
            state = {}

        return Session(
            id=str(row["id"]),
            app_name=row["app_name"],
            user_id=row["user_id"],
            state=state,
            version=row["version"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
