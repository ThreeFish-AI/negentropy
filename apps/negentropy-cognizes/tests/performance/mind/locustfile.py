"""
Mind 模块性能压测脚本 (Locust)

目标: 验证 SessionService 和 MemoryService 的性能指标
- P99 Latency < 50ms (SessionService)
- P99 Latency < 100ms (MemoryService)
- Error Rate < 0.1%
- Throughput > 500 RPS

使用方式:
    # 启动压测 (100 并发, 60 秒持续时间)
    locust -f tests/performance/mind/locustfile.py \
        --users 100 --spawn-rate 10 --run-time 60s \
        --host $DATABASE_URL \
        --html report_session.html
    
    # 无头模式运行
    locust -f tests/performance/mind/locustfile.py \
        --users 100 --spawn-rate 10 --run-time 60s \
        --host $DATABASE_URL \
        --headless \
        --csv=results

参考: docs/040-the-realm-of-mind.md Section 5.3.4
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from typing import Any

from locust import HttpUser, TaskSet, task, between, events
from locust.runners import MasterRunner, WorkerRunner

# 全局连接池 (Worker 共享)
_pool = None
_loop = None


def get_event_loop():
    """获取或创建事件循环"""
    global _loop
    if _loop is None:
        try:
            _loop = asyncio.get_event_loop()
            if _loop.is_closed():
                _loop = asyncio.new_event_loop()
                asyncio.set_event_loop(_loop)
        except RuntimeError:
            _loop = asyncio.new_event_loop()
            asyncio.set_event_loop(_loop)
    return _loop


async def init_db_pool(host: str):
    """初始化数据库连接池"""
    from cognizes.core.database import DatabaseManager

    db = DatabaseManager.get_instance(dsn=host)
    return await db.get_pool()


@events.init.add_listener
def on_locust_init(environment, **kwargs):
    """Locust 初始化时设置数据库连接池"""
    global _pool

    # Worker 或 Standalone 模式需要初始化连接池
    if not isinstance(environment.runner, MasterRunner):
        loop = get_event_loop()
        host = environment.host or os.environ.get("DATABASE_URL", "")
        if host:
            _pool = loop.run_until_complete(init_db_pool(host))
            print(f"✅ 数据库连接池已初始化: {host[:50]}...")


@events.quitting.add_listener
def on_locust_quit(environment, **kwargs):
    """Locust 退出时关闭连接池"""
    global _pool
    if _pool:
        loop = get_event_loop()
        loop.run_until_complete(_pool.close())
        print("✅ 数据库连接池已关闭")


class SessionServiceTasks(TaskSet):
    """SessionService 压测任务集"""

    def on_start(self):
        """任务开始前初始化测试数据"""
        self.app_name = "performance_test"
        self.user_id = f"perf_user_{uuid.uuid4().hex[:8]}"
        self.created_sessions = []

    def on_stop(self):
        """任务结束时清理测试数据"""
        loop = get_event_loop()
        for sid in self.created_sessions:
            try:
                loop.run_until_complete(self._delete_session(sid))
            except Exception:
                pass

    async def _delete_session(self, session_id: str):
        """删除会话"""
        global _pool
        if _pool:
            async with _pool.acquire() as conn:
                await conn.execute("DELETE FROM threads WHERE id = $1", uuid.UUID(session_id))

    @task(10)
    def create_session(self):
        """创建会话 - 高频操作"""
        global _pool
        if not _pool:
            return

        loop = get_event_loop()
        session_id = str(uuid.uuid4())
        initial_state = {
            "counter": 0,
            "user_name": f"test_user_{uuid.uuid4().hex[:6]}",
            "preferences": {"theme": "dark", "language": "zh"},
        }

        start_time = time.perf_counter()
        exception = None

        try:
            loop.run_until_complete(self._create_session_async(session_id, self.app_name, self.user_id, initial_state))
            self.created_sessions.append(session_id)
        except Exception as e:
            exception = e

        total_time = (time.perf_counter() - start_time) * 1000  # ms

        self.user.environment.events.request.fire(
            request_type="PostgreSQL",
            name="create_session",
            response_time=total_time,
            response_length=0,
            exception=exception,
            context={},
        )

    async def _create_session_async(self, session_id: str, app_name: str, user_id: str, state: dict):
        global _pool
        async with _pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO threads (id, app_name, user_id, state)
                VALUES ($1, $2, $3, $4)
                """,
                uuid.UUID(session_id),
                app_name,
                user_id,
                json.dumps(state),
            )

    @task(20)
    def get_session(self):
        """获取会话 - 最高频操作"""
        global _pool
        if not _pool or not self.created_sessions:
            return

        loop = get_event_loop()
        session_id = self.created_sessions[-1] if self.created_sessions else None
        if not session_id:
            return

        start_time = time.perf_counter()
        exception = None

        try:
            loop.run_until_complete(self._get_session_async(session_id, self.app_name, self.user_id))
        except Exception as e:
            exception = e

        total_time = (time.perf_counter() - start_time) * 1000

        self.user.environment.events.request.fire(
            request_type="PostgreSQL",
            name="get_session",
            response_time=total_time,
            response_length=0,
            exception=exception,
            context={},
        )

    async def _get_session_async(self, session_id: str, app_name: str, user_id: str):
        global _pool
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, app_name, user_id, state, updated_at
                FROM threads
                WHERE id = $1 AND app_name = $2 AND user_id = $3
                """,
                uuid.UUID(session_id),
                app_name,
                user_id,
            )
            return row

    @task(5)
    def list_sessions(self):
        """列出会话 - 中频操作"""
        global _pool
        if not _pool:
            return

        loop = get_event_loop()

        start_time = time.perf_counter()
        exception = None

        try:
            loop.run_until_complete(self._list_sessions_async(self.app_name, self.user_id))
        except Exception as e:
            exception = e

        total_time = (time.perf_counter() - start_time) * 1000

        self.user.environment.events.request.fire(
            request_type="PostgreSQL",
            name="list_sessions",
            response_time=total_time,
            response_length=0,
            exception=exception,
            context={},
        )

    async def _list_sessions_async(self, app_name: str, user_id: str):
        global _pool
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, app_name, user_id, state, updated_at
                FROM threads
                WHERE app_name = $1 AND user_id = $2
                ORDER BY updated_at DESC
                LIMIT 50
                """,
                app_name,
                user_id,
            )
            return rows

    @task(15)
    def update_state(self):
        """更新会话状态 - 高频操作"""
        global _pool
        if not _pool or not self.created_sessions:
            return

        loop = get_event_loop()
        session_id = self.created_sessions[-1] if self.created_sessions else None
        if not session_id:
            return

        state_delta = {"counter": int(time.time()) % 1000, "last_action": "update_state", "timestamp": time.time()}

        start_time = time.perf_counter()
        exception = None

        try:
            loop.run_until_complete(self._update_state_async(session_id, state_delta))
        except Exception as e:
            exception = e

        total_time = (time.perf_counter() - start_time) * 1000

        self.user.environment.events.request.fire(
            request_type="PostgreSQL",
            name="update_state",
            response_time=total_time,
            response_length=0,
            exception=exception,
            context={},
        )

    async def _update_state_async(self, session_id: str, state_delta: dict):
        global _pool
        async with _pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE threads
                SET state = state || $1::jsonb, updated_at = NOW()
                WHERE id = $2
                """,
                json.dumps(state_delta),
                uuid.UUID(session_id),
            )

    @task(3)
    def append_event(self):
        """追加事件 - 中频操作"""
        global _pool
        if not _pool or not self.created_sessions:
            return

        loop = get_event_loop()
        session_id = self.created_sessions[-1] if self.created_sessions else None
        if not session_id:
            return

        event_data = {
            "id": str(uuid.uuid4()),
            "author": "user",
            "content": {"parts": [{"text": f"Test message at {time.time()}"}]},
            "actions": {},
        }

        start_time = time.perf_counter()
        exception = None

        try:
            loop.run_until_complete(self._append_event_async(session_id, event_data))
        except Exception as e:
            exception = e

        total_time = (time.perf_counter() - start_time) * 1000

        self.user.environment.events.request.fire(
            request_type="PostgreSQL",
            name="append_event",
            response_time=total_time,
            response_length=0,
            exception=exception,
            context={},
        )

    async def _append_event_async(self, session_id: str, event_data: dict):
        global _pool
        async with _pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO events
                (id, thread_id, invocation_id, author, event_type, content, actions)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                uuid.UUID(event_data["id"]),
                uuid.UUID(session_id),
                uuid.uuid4(),  # invocation_id
                event_data["author"],
                "message",
                json.dumps(event_data["content"]),
                json.dumps(event_data["actions"]),
            )

    @task(2)
    def delete_session(self):
        """删除会话 - 低频操作"""
        global _pool
        if not _pool or len(self.created_sessions) < 5:
            return  # 保持至少 5 个会话供其他操作使用

        loop = get_event_loop()
        session_id = self.created_sessions.pop(0)

        start_time = time.perf_counter()
        exception = None

        try:
            loop.run_until_complete(self._delete_session(session_id))
        except Exception as e:
            exception = e

        total_time = (time.perf_counter() - start_time) * 1000

        self.user.environment.events.request.fire(
            request_type="PostgreSQL",
            name="delete_session",
            response_time=total_time,
            response_length=0,
            exception=exception,
            context={},
        )


class MemoryServiceTasks(TaskSet):
    """MemoryService 压测任务集"""

    def on_start(self):
        """初始化测试数据"""
        self.app_name = "performance_test"
        self.user_id = f"perf_user_{uuid.uuid4().hex[:8]}"
        self.created_memory_ids = []

    def on_stop(self):
        """清理测试数据"""
        loop = get_event_loop()
        for mid in self.created_memory_ids:
            try:
                loop.run_until_complete(self._delete_memory(mid))
            except Exception:
                pass

    async def _delete_memory(self, memory_id: str):
        global _pool
        if _pool:
            async with _pool.acquire() as conn:
                await conn.execute("DELETE FROM memories WHERE id = $1", uuid.UUID(memory_id))

    @task(5)
    def add_memory(self):
        """添加记忆 - 注意: 需要向量化，较慢"""
        global _pool
        if not _pool:
            return

        loop = get_event_loop()
        memory_id = str(uuid.uuid4())

        # 模拟记忆数据 (使用零向量避免真实向量化开销)
        memory_data = {
            "id": memory_id,
            "session_id": str(uuid.uuid4()),
            "content": f"Test memory content {uuid.uuid4().hex[:16]}",
            "metadata": {"source": "performance_test", "timestamp": time.time()},
        }

        start_time = time.perf_counter()
        exception = None

        try:
            loop.run_until_complete(self._add_memory_async(memory_data))
            self.created_memory_ids.append(memory_id)
        except Exception as e:
            exception = e

        total_time = (time.perf_counter() - start_time) * 1000

        self.user.environment.events.request.fire(
            request_type="PostgreSQL",
            name="add_memory",
            response_time=total_time,
            response_length=0,
            exception=exception,
            context={},
        )

    async def _add_memory_async(self, memory_data: dict):
        global _pool
        async with _pool.acquire() as conn:
            # 使用零向量模拟 (实际应使用 embedding 模型)
            zero_vector = "[" + ",".join(["0.0"] * 768) + "]"
            await conn.execute(
                """
                INSERT INTO memories (id, session_id, content, metadata, embedding, app_name, user_id)
                VALUES ($1, $2, $3, $4, $5::vector, $6, $7)
                """,
                uuid.UUID(memory_data["id"]),
                uuid.UUID(memory_data["session_id"]),
                memory_data["content"],
                json.dumps(memory_data["metadata"]),
                zero_vector,
                "performance_test",
                "perf_user",
            )

    @task(15)
    def search_memory(self):
        """搜索记忆 - 高频操作，需评估向量检索性能"""
        global _pool
        if not _pool:
            return

        loop = get_event_loop()

        # 使用随机查询向量
        query_vector = "[" + ",".join(["0.1"] * 768) + "]"
        limit = 10

        start_time = time.perf_counter()
        exception = None

        try:
            loop.run_until_complete(self._search_memory_async(query_vector, limit))
        except Exception as e:
            exception = e

        total_time = (time.perf_counter() - start_time) * 1000

        self.user.environment.events.request.fire(
            request_type="PostgreSQL",
            name="search_memory",
            response_time=total_time,
            response_length=0,
            exception=exception,
            context={},
        )

    async def _search_memory_async(self, query_vector: str, limit: int):
        global _pool
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, content, metadata, embedding <=> $1::vector AS distance
                FROM memories
                WHERE app_name = $2
                ORDER BY embedding <=> $1::vector
                LIMIT $3
                """,
                query_vector,
                "performance_test",
                limit,
            )
            return rows

    @task(5)
    def list_memories(self):
        """列出记忆"""
        global _pool
        if not _pool:
            return

        loop = get_event_loop()

        start_time = time.perf_counter()
        exception = None

        try:
            loop.run_until_complete(self._list_memories_async())
        except Exception as e:
            exception = e

        total_time = (time.perf_counter() - start_time) * 1000

        self.user.environment.events.request.fire(
            request_type="PostgreSQL",
            name="list_memories",
            response_time=total_time,
            response_length=0,
            exception=exception,
            context={},
        )

    async def _list_memories_async(self):
        global _pool
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, content, metadata, created_at
                FROM memories
                WHERE app_name = $1
                ORDER BY created_at DESC
                LIMIT 50
                """,
                "performance_test",
            )
            return rows


class SessionServiceUser(HttpUser):
    """SessionService 压测用户"""

    tasks = [SessionServiceTasks]
    wait_time = between(0.1, 0.5)  # 100-500ms 间隔
    weight = 3  # 权重: SessionService 操作更频繁


class MemoryServiceUser(HttpUser):
    """MemoryService 压测用户"""

    tasks = [MemoryServiceTasks]
    wait_time = between(0.5, 1.0)  # 500ms-1s 间隔
    weight = 1  # 权重: MemoryService 操作较少
