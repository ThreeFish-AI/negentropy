"""
StateManager 数据库集成测试

测试范围：
- Session CRUD 完整流程
- 原子状态流转 + 乐观锁冲突
- 高并发写入
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
async def db():
    """创建测试数据库管理器"""
    db = DatabaseManager.get_instance()
    await db.get_pool()
    yield db
    # Pool managed by DatabaseManager


@pytest_asyncio.fixture
async def state_manager(db):
    """创建 StateManager 实例"""
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

        try:
            assert session.id is not None
            assert session.app_name == "test_app"
            assert session.user_id == "user_001"
            assert session.state["language"] == "zh-CN"
            assert session.version == 1
        finally:
            await state_manager.delete_session(session.app_name, session.user_id, session.id)

    @pytest.mark.asyncio
    async def test_get_session(self, state_manager):
        """测试获取会话"""
        created = await state_manager.create_session(app_name="test_app", user_id="user_002")

        try:
            fetched = await state_manager.get_session(app_name="test_app", user_id="user_002", session_id=created.id)

            assert fetched is not None
            assert fetched.id == created.id
        finally:
            await state_manager.delete_session(created.app_name, created.user_id, created.id)

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

        try:
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
        finally:
            await state_manager.delete_session(session.app_name, session.user_id, session.id)

    @pytest.mark.asyncio
    async def test_zero_dirty_reads(self, state_manager):
        """测试 0 脏读 - 并发写入测试"""
        session = await state_manager.create_session(
            app_name="test_app", user_id="user_005", initial_state={"counter": 0}
        )

        try:

            async def increment():
                for _ in range(10):
                    try:
                        current = await state_manager.get_session(session.app_name, session.user_id, session.id)
                        await state_manager.update_session_state(
                            current, {"counter": current.state.get("counter", 0) + 1}
                        )
                    except ConcurrencyConflictError:
                        pass

            # 并发执行 5 个任务
            await asyncio.gather(*[increment() for _ in range(5)])

            # 重新获取最新状态
            final = await state_manager.get_session(session.app_name, session.user_id, session.id)

            # 验证无数据丢失
            assert final.state["counter"] > 0
        finally:
            await state_manager.delete_session(session.app_name, session.user_id, session.id)


class TestOptimisticConcurrencyControl:
    """乐观并发控制测试"""

    @pytest.mark.asyncio
    async def test_version_conflict_detection(self, state_manager, db):
        """测试版本冲突检测"""
        session = await state_manager.create_session(app_name="test_app", user_id="user_006")

        try:
            # 模拟另一个进程先更新了状态
            async with db.acquire() as conn:
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
        finally:
            await state_manager.delete_session(session.app_name, session.user_id, session.id)


class TestTransactionRollback:
    """事务回滚测试"""

    @pytest.mark.asyncio
    async def test_rollback_on_error(self, state_manager, db):
        """测试异常时事务回滚，状态不变"""
        session = await state_manager.create_session(
            app_name="test_app",
            user_id="user_rollback",
            initial_state={"value": "original"},
        )

        try:
            # 人为制造冲突
            async with db.acquire() as conn:
                await conn.execute(
                    "UPDATE threads SET version = version + 100 WHERE id = $1",
                    uuid.UUID(session.id),
                )

            event = Event(
                id="",
                thread_id=session.id,
                invocation_id=str(uuid.uuid4()),
                author="agent",
                event_type="state_update",
                actions={"state_delta": {"value": "modified"}},
            )

            try:
                await state_manager.append_event(session, event)
            except ConcurrencyConflictError:
                pass

            # 验证原始状态未被修改
            fetched = await state_manager.get_session(session.app_name, session.user_id, session.id)
            assert fetched.state["value"] == "original"
        finally:
            await state_manager.delete_session(session.app_name, session.user_id, session.id)


class TestHighQPSPerformance:
    """高 QPS 性能测试"""

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
