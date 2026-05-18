"""
PostgresSessionService 单元测试
覆盖 ADK BaseSessionService 接口所有方法
"""

import pytest
import asyncio
from datetime import datetime
from cognizes.adapters.postgres.session_service import PostgresSessionService, Session, Event

# pytest-asyncio 配置
pytestmark = pytest.mark.asyncio


class TestPostgresSessionService:
    """SessionService 单元测试套件"""

    @pytest.fixture
    async def service(self, db_pool):
        """创建测试服务实例"""
        return PostgresSessionService(pool=db_pool)

    @pytest.fixture
    async def db_pool(self):
        """创建测试数据库连接池"""
        import asyncpg

        pool = await asyncpg.create_pool("postgresql://test:test@localhost:5432/test_db", min_size=1, max_size=5)
        yield pool
        await pool.close()

    # ========== create_session 测试 ==========

    async def test_create_session_basic(self, service):
        """测试基础会话创建"""
        session = await service.create_session(app_name="test_app", user_id="user_001")
        assert session.id is not None
        assert session.app_name == "test_app"
        assert session.user_id == "user_001"
        assert session.state == {}
        assert session.events == []

    async def test_create_session_with_initial_state(self, service):
        """测试带初始状态的会话创建"""
        initial_state = {"user:language": "zh-CN", "app:theme": "dark"}
        session = await service.create_session(app_name="test_app", user_id="user_002", state=initial_state)
        assert session.state["user:language"] == "zh-CN"
        assert session.state["app:theme"] == "dark"

    async def test_create_session_with_custom_id(self, service):
        """测试自定义会话 ID"""
        custom_id = "custom-session-123"
        session = await service.create_session(app_name="test_app", user_id="user_003", session_id=custom_id)
        assert session.id == custom_id

    # ========== get_session 测试 ==========

    async def test_get_session_exists(self, service):
        """测试获取已存在的会话"""
        created = await service.create_session(app_name="test_app", user_id="user_004")
        retrieved = await service.get_session(app_name="test_app", user_id="user_004", session_id=created.id)
        assert retrieved is not None
        assert retrieved.id == created.id

    async def test_get_session_not_found(self, service):
        """测试获取不存在的会话"""
        session = await service.get_session(app_name="test_app", user_id="user_005", session_id="non-existent-id")
        assert session is None

    async def test_get_session_with_config(self, service):
        """测试带配置的会话获取 (分页)"""
        from cognizes.adapters.postgres.session_service import GetSessionConfig

        session = await service.create_session(app_name="test_app", user_id="user_006")
        # 添加多个事件
        for i in range(10):
            await service.append_event(session, Event(id=f"event_{i}", author="user", content={"msg": f"hello {i}"}))

        # 仅获取最后 3 条事件
        config = GetSessionConfig(num_recent_events=3)
        result = await service.get_session(
            app_name="test_app", user_id="user_006", session_id=session.id, config=config
        )
        assert len(result.events) == 3

    # ========== list_sessions 测试 ==========

    async def test_list_sessions_by_user(self, service):
        """测试列出用户的所有会话"""
        # 创建多个会话
        for i in range(3):
            await service.create_session(app_name="test_app", user_id="user_007")
        response = await service.list_sessions(app_name="test_app", user_id="user_007")
        assert len(response.sessions) >= 3

    async def test_list_sessions_all_users(self, service):
        """测试列出所有用户会话 (admin)"""
        response = await service.list_sessions(app_name="test_app", user_id=None)
        assert isinstance(response.sessions, list)

    # ========== delete_session 测试 ==========

    async def test_delete_session(self, service):
        """测试删除会话"""
        session = await service.create_session(app_name="test_app", user_id="user_008")
        await service.delete_session(app_name="test_app", user_id="user_008", session_id=session.id)
        # 验证已删除
        deleted = await service.get_session(app_name="test_app", user_id="user_008", session_id=session.id)
        assert deleted is None

    # ========== State 前缀处理测试 ==========

    async def test_state_prefix_user_scope(self, service):
        """测试 user: 前缀 - 跨会话持久"""
        session1 = await service.create_session(app_name="test_app", user_id="user_009")
        # 设置 user 级别状态
        await service.append_event(
            session1, Event(id="e1", author="agent", actions={"state_delta": {"user:preference": "dark_mode"}})
        )
        # 新会话应继承 user: 状态
        session2 = await service.create_session(app_name="test_app", user_id="user_009")
        assert session2.state.get("user:preference") == "dark_mode"

    async def test_state_prefix_temp_not_persisted(self, service):
        """测试 temp: 前缀 - 不持久化"""
        session = await service.create_session(app_name="test_app", user_id="user_010")
        await service.append_event(
            session,
            Event(id="e1", author="agent", actions={"state_delta": {"temp:cache": "value", "app:config": "saved"}}),
        )
        # temp: 不应被持久化
        reloaded = await service.get_session(app_name="test_app", user_id="user_010", session_id=session.id)
        assert "temp:cache" not in reloaded.state
        assert reloaded.state.get("app:config") == "saved"
