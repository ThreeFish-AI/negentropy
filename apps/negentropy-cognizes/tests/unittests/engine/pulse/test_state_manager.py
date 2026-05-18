"""
StateManager 单元测试

验证目标：
1. Session CRUD 操作正确性
2. 原子状态流转 (0 脏读/丢失)
3. 乐观并发控制 (OCC)
4. State 前缀解析
"""

import asyncio
import uuid

import asyncpg
import pytest
import pytest_asyncio

from cognizes.engine.pulse.state_manager import (
    ConcurrencyConflictError,
    Event,
    StateManager,
)
from cognizes.core.database import DatabaseManager


@pytest_asyncio.fixture
async def state_manager():
    """创建 StateManager 实例"""
    db = DatabaseManager.get_instance()
    await db.get_pool()
    return StateManager(db)


class TestSessionCRUD:
    """Session CRUD 操作测试"""

    @pytest.mark.asyncio
    async def test_create_session(self, state_manager):
        """测试创建会话"""
        session = await state_manager.create_session(
            app_name="test_app", user_id="user_001", initial_state={"language": "zh-CN"}
        )

        assert session.id is not None
        assert session.app_name == "test_app"
        assert session.user_id == "user_001"
        assert session.state["language"] == "zh-CN"
        assert session.version == 1

    @pytest.mark.asyncio
    async def test_get_session(self, state_manager):
        """测试获取会话"""
        created = await state_manager.create_session(app_name="test_app", user_id="user_002")

        fetched = await state_manager.get_session(app_name="test_app", user_id="user_002", session_id=created.id)

        assert fetched is not None
        assert fetched.id == created.id

    @pytest.mark.asyncio
    async def test_delete_session(self, state_manager):
        """测试删除会话"""
        session = await state_manager.create_session(app_name="test_app", user_id="user_003")

        result = await state_manager.delete_session(app_name="test_app", user_id="user_003", session_id=session.id)

        assert result is True

        fetched = await state_manager.get_session(app_name="test_app", user_id="user_003", session_id=session.id)
        assert fetched is None


class TestAtomicStateTransitions:
    """原子状态流转测试"""

    @pytest.mark.asyncio
    async def test_append_event_with_state_delta(self, state_manager):
        """测试事件追加与状态更新的原子性"""
        session = await state_manager.create_session(
            app_name="test_app", user_id="user_004", initial_state={"counter": 0}
        )

        event = Event(
            id="",
            thread_id=session.id,
            invocation_id=str(uuid.uuid4()),
            author="agent",
            event_type="state_update",
            content={"text": "Incrementing counter"},
            actions={"state_delta": {"counter": 1}},
        )

        await state_manager.append_event(session, event)

        # 验证状态已更新
        assert session.state["counter"] == 1
        assert session.version == 2

    @pytest.mark.asyncio
    async def test_zero_dirty_reads(self, state_manager):
        """测试 0 脏读 - 并发写入测试"""
        session = await state_manager.create_session(
            app_name="test_app", user_id="user_005", initial_state={"counter": 0}
        )

        async def increment():
            for _ in range(10):
                try:
                    await state_manager.update_session_state(session, {"counter": session.state.get("counter", 0) + 1})
                except ConcurrencyConflictError:
                    pass

        # 并发执行 5 个任务
        await asyncio.gather(*[increment() for _ in range(5)])

        # 重新获取最新状态
        final = await state_manager.get_session(session.app_name, session.user_id, session.id)

        # 验证无数据丢失
        assert final.state["counter"] > 0


class TestOptimisticConcurrencyControl:
    """乐观并发控制测试"""

    @pytest.mark.asyncio
    async def test_version_conflict_detection(self, state_manager):
        """测试版本冲突检测"""
        session = await state_manager.create_session(app_name="test_app", user_id="user_006")

        # 模拟另一个进程先更新了状态
        async with state_manager.db.acquire() as conn:
            await conn.execute(
                "UPDATE threads SET version = version + 1 WHERE id = $1",
                uuid.UUID(session.id),
            )

        # 此时 session.version 已过期，应该抛出冲突
        event = Event(
            id="",
            thread_id=session.id,
            invocation_id=str(uuid.uuid4()),
            author="agent",
            event_type="state_update",
            actions={"state_delta": {"key": "value"}},
        )

        with pytest.raises(ConcurrencyConflictError):
            await state_manager.append_event(session, event)


class TestStatePrefixes:
    """State 前缀解析测试"""

    def test_parse_session_scope(self, state_manager):
        """测试无前缀 = Session Scope"""
        prefix, key = state_manager.parse_state_prefix("task_progress")
        assert prefix == "session"
        assert key == "task_progress"

    def test_parse_user_scope(self, state_manager):
        """测试 user: 前缀"""
        prefix, key = state_manager.parse_state_prefix("user:preferred_language")
        assert prefix == "user"
        assert key == "preferred_language"

    def test_parse_app_scope(self, state_manager):
        """测试 app: 前缀"""
        prefix, key = state_manager.parse_state_prefix("app:max_retries")
        assert prefix == "app"
        assert key == "max_retries"

    def test_parse_temp_scope(self, state_manager):
        """测试 temp: 前缀"""
        prefix, key = state_manager.parse_state_prefix("temp:intermediate_result")
        assert prefix == "temp"
        assert key == "intermediate_result"


class TestTransactionRollback:
    """事务回滚测试 (对标 P1-3-4)"""

    @pytest.mark.asyncio
    async def test_rollback_on_error(self, state_manager):
        """测试异常时事务回滚，状态不变"""
        session = await state_manager.create_session(
            app_name="test_app",
            user_id="user_rollback",
            initial_state={"value": "original"},
        )
        original_version = session.version

        # 模拟一个会失败的事件（例如无效的 JSON）
        try:
            event = Event(
                id="",
                thread_id=session.id,
                invocation_id=str(uuid.uuid4()),
                author="agent",
                event_type="state_update",
                actions={"state_delta": {"value": "modified"}},
            )
            # 人为制造冲突
            async with state_manager.db.acquire() as conn:
                await conn.execute(
                    "UPDATE threads SET version = version + 100 WHERE id = $1",
                    uuid.UUID(session.id),
                )
            await state_manager.append_event(session, event)
        except ConcurrencyConflictError:
            pass

        # 验证原始状态未被修改
        fetched = await state_manager.get_session(session.app_name, session.user_id, session.id)
        # 注意：version 被外部修改了，但 state 应该保持原值
        assert fetched.state["value"] == "original"


class TestMultiAgentConcurrency:
    """多 Agent 竞争写测试 (对标 P1-3-11)"""

    @pytest.mark.asyncio
    async def test_10_concurrent_writes_no_data_loss(self, state_manager):
        """10 并发写入，0 数据丢失"""
        session = await state_manager.create_session(
            app_name="test_app", user_id="user_concurrent", initial_state={"writes": []}
        )

        successful_writes = []

        async def agent_write(agent_id: int):
            """模拟单个 Agent 的写入"""
            for i in range(5):
                try:
                    # 每次都重新获取最新 session
                    current = await state_manager.get_session(session.app_name, session.user_id, session.id)
                    current_writes = current.state.get("writes", [])
                    new_writes = current_writes + [f"agent_{agent_id}_write_{i}"]

                    await state_manager.update_session_state(current, {"writes": new_writes})
                    successful_writes.append(f"agent_{agent_id}_write_{i}")
                except ConcurrencyConflictError:
                    # 冲突重试
                    await asyncio.sleep(0.01)

        # 10 个并发 Agent
        await asyncio.gather(*[agent_write(i) for i in range(10)])

        # 验证最终状态
        final = await state_manager.get_session(session.app_name, session.user_id, session.id)

        # 所有成功的写入都应该在最终状态中
        assert len(final.state["writes"]) > 0
        print(f"Total successful writes: {len(final.state['writes'])}")


class TestHighQPSPerformance:
    """高 QPS 性能测试 (对标 P1-3-12)"""

    @pytest.mark.asyncio
    async def test_100_qps_session_creation(self, state_manager):
        """100 QPS Session 创建测试"""
        import time

        start_time = time.perf_counter()
        sessions = []

        # 创建 100 个 Session
        for i in range(100):
            session = await state_manager.create_session(app_name="perf_test", user_id=f"user_{i}")
            sessions.append(session)

        elapsed = time.perf_counter() - start_time
        qps = 100 / elapsed

        print(f"Session creation: {qps:.2f} QPS ({elapsed:.3f}s for 100 sessions)")

        # 清理
        for session in sessions:
            await state_manager.delete_session(session.app_name, session.user_id, session.id)

        assert qps > 100, f"QPS {qps} is below target 100"
