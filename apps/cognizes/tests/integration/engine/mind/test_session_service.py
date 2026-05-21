"""
PostgresSessionService 集成测试

需要真实数据库连接的集成测试，从 unittests 移入。

运行方式:
pytest tests/integration/engine/mind/test_session_service.py -v
"""

import pytest

# pytest-asyncio 配置
pytestmark = pytest.mark.asyncio


class TestPostgresSessionServiceIntegration:
    """
    SessionService 集成测试套件 (需要真实数据库)
    """

    @pytest.fixture
    async def service(self, db_pool):
        """创建测试服务实例"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        return PostgresSessionService(pool=db_pool)

    @pytest.fixture
    async def db_pool(self):
        """创建测试数据库连接池"""
        from cognizes.core.database import DatabaseManager

        db = DatabaseManager.get_instance()
        pool = await db.get_pool()
        yield pool

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

    async def test_get_session_exists(self, service):
        """测试获取已存在的会话"""
        created = await service.create_session(app_name="test_app", user_id="user_004")
        retrieved = await service.get_session(app_name="test_app", user_id="user_004", session_id=created.id)
        assert retrieved is not None
        assert retrieved.id == created.id

    async def test_delete_session(self, service):
        """测试删除会话"""
        session = await service.create_session(app_name="test_app", user_id="user_008")
        await service.delete_session(app_name="test_app", user_id="user_008", session_id=session.id)
        deleted = await service.get_session(app_name="test_app", user_id="user_008", session_id=session.id)
        assert deleted is None
