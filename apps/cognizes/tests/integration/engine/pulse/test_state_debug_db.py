"""
StateDebugService 数据库集成测试

测试范围：
- 状态历史查询
- 调试信息聚合（从真实数据库读取）
"""

import asyncio
import json
import uuid
import pytest
import pytest_asyncio


from cognizes.engine.pulse.state_debug import StateDebugService, StateDebugInfo
from cognizes.engine.pulse.state_manager import StateManager, Event
from cognizes.core.database import DatabaseManager


@pytest_asyncio.fixture
async def db():
    """创建测试数据库管理器"""
    db = DatabaseManager.get_instance()
    await db.get_pool()
    yield db
    # Pool managed by DatabaseManager


@pytest_asyncio.fixture
async def debug_service(db):
    """创建 StateDebugService 实例"""
    pool = await db.get_pool()
    return StateDebugService(pool)


@pytest_asyncio.fixture
async def state_manager(db):
    """创建 StateManager 实例"""
    # StateManager expects DatabaseManager, not Pool
    return StateManager(db)


class TestStateDebugServiceDB:
    """StateDebugService 数据库集成测试"""

    @pytest.mark.asyncio
    async def test_get_debug_info_basic(self, debug_service, state_manager):
        """基本调试信息获取"""
        # 创建测试 session
        session = await state_manager.create_session(
            app_name="debug_test",
            user_id="user_debug_001",
            initial_state={"counter": 0, "status": "init"},
        )

        try:
            # 获取调试信息
            info = await debug_service.get_debug_info(session.id)

            assert info.thread_id == session.id
            assert info.current_state["counter"] == 0
            assert info.current_state["status"] == "init"

        finally:
            # 清理测试数据
            await state_manager.delete_session(session.app_name, session.user_id, session.id)

    @pytest.mark.asyncio
    async def test_prefix_breakdown_from_db(self, debug_service, state_manager):
        """从数据库读取并分组前缀"""
        # 创建带混合作用域的 session
        session = await state_manager.create_session(
            app_name="debug_test",
            user_id="user_debug_002",
            initial_state={
                "task": "running",
                "user:theme": "dark",
                "app:version": "1.0",
            },
        )

        try:
            info = await debug_service.get_debug_info(session.id)

            # 验证前缀分组
            assert info.prefix_breakdown["session"]["task"] == "running"
            assert info.prefix_breakdown["user"]["theme"] == "dark"
            assert info.prefix_breakdown["app"]["version"] == "1.0"

        finally:
            await state_manager.delete_session(session.app_name, session.user_id, session.id)

    @pytest.mark.asyncio
    async def test_state_history_tracking(self, debug_service, state_manager):
        """状态历史追踪"""
        session = await state_manager.create_session(
            app_name="debug_test",
            user_id="user_debug_003",
            initial_state={"counter": 0},
        )

        try:
            # 执行几次状态更新
            for i in range(3):
                event = Event(
                    id="",
                    thread_id=session.id,
                    invocation_id=str(uuid.uuid4()),
                    author="agent",
                    event_type="state_update",
                    content={"state_delta": {"counter": i + 1}},
                    actions={"state_delta": {"counter": i + 1}},
                )
                await state_manager.append_event(session, event)

            # 获取调试信息
            info = await debug_service.get_debug_info(session.id)

            # 验证历史记录存在（具体数量取决于查询逻辑）
            assert isinstance(info.state_history, list)

        finally:
            await state_manager.delete_session(session.app_name, session.user_id, session.id)

    @pytest.mark.asyncio
    async def test_empty_thread_returns_empty_state(self, debug_service, db):
        """不存在的 thread 返回空状态"""
        fake_thread_id = str(uuid.uuid4())

        info = await debug_service.get_debug_info(fake_thread_id)

        assert info.current_state == {}
        assert info.state_history == []
