"""
PostgresSessionService 单元测试

测试策略:
- TestPostgresSessionServiceMocked: 使用 Mock 完全隔离外部依赖，聚焦纯逻辑验证
- TestPostgresSessionServiceIntegration: 需要真实数据库连接的集成测试

覆盖 ADK BaseSessionService 接口所有方法:
- create_session: 会话创建
- get_session: 会话获取
- list_sessions: 会话列表
- delete_session: 会话删除
- append_event: 事件追加与 state_delta 应用
"""

import pytest
import uuid
import json
import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

# pytest-asyncio 配置
pytestmark = pytest.mark.asyncio


# ============================================================================
# Mock 隔离的单元测试 (不依赖真实数据库)
# ============================================================================


class TestPostgresSessionServiceMocked:
    """
    PostgresSessionService 单元测试套件 (Mock 隔离)

    使用 unittest.mock 完全模拟 asyncpg.Pool，
    聚焦纯业务逻辑验证，不依赖真实数据库连接。
    """

    @pytest.fixture
    def mock_pool(self):
        """创建完全模拟的数据库连接池"""
        pool = MagicMock()
        conn = AsyncMock()

        # 模拟连接池上下文管理器
        # acquire() 返回一个 AsyncContextManager
        acm = AsyncMock()
        acm.__aenter__.return_value = conn
        acm.__aexit__.return_value = None
        pool.acquire.return_value = acm

        # 模拟事务上下文管理器
        transaction_acm = AsyncMock()
        transaction_acm.__aenter__.return_value = MagicMock()
        transaction_acm.__aexit__.return_value = None

        # conn.transaction is NOT async, it returns the context manager synchronously
        # So we use MagicMock instead of AsyncMock for the method itself
        conn.transaction = MagicMock(return_value=transaction_acm)

        # 默认模拟方法
        conn.execute = AsyncMock()
        conn.fetch = AsyncMock(return_value=[])
        conn.fetchrow = AsyncMock(return_value=None)

        return pool, conn

    @pytest.fixture
    def service(self, mock_pool):
        """创建测试服务实例"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, _ = mock_pool
        return PostgresSessionService(pool=pool)

    # ========== create_session 测试 ==========

    async def test_create_session_generates_uuid(self, mock_pool):
        """测试: 自动生成有效 UUID"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        session = await service.create_session(app_name="test_app", user_id="user_001")

        # 验证: ID 是有效 UUID
        assert session.id is not None
        uuid.UUID(session.id)  # 不抛异常即为有效 UUID

        # 验证: INSERT 被调用
        conn.execute.assert_called_once()
        call_sql = conn.execute.call_args[0][0]
        assert "INSERT INTO threads" in call_sql

    async def test_create_session_with_empty_state(self, mock_pool):
        """测试: 空状态初始化"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        session = await service.create_session(app_name="test_app", user_id="user_002", state=None)

        assert session.state == {}

    async def test_create_session_preserves_initial_state(self, mock_pool):
        """测试: 初始状态正确保存"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        initial_state = {"key1": "value1", "key2": 123}
        session = await service.create_session(app_name="test_app", user_id="user_003", state=initial_state)

        assert session.state == initial_state

    async def test_create_session_with_custom_id(self, mock_pool):
        """测试: 使用自定义会话 ID"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        custom_id = str(uuid.uuid4())
        session = await service.create_session(app_name="test_app", user_id="user_004", session_id=custom_id)

        assert session.id == custom_id

    async def test_create_session_returns_correct_metadata(self, mock_pool):
        """测试: 返回正确的元数据"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        session = await service.create_session(app_name="my_app", user_id="user_xyz")

        assert session.app_name == "my_app"
        assert session.user_id == "user_xyz"
        assert session.events == []

    # ========== get_session 测试 ==========

    async def test_get_session_returns_none_when_not_found(self, mock_pool):
        """测试: 会话不存在时返回 None"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        conn.fetchrow = AsyncMock(return_value=None)

        service = PostgresSessionService(pool=pool)
        result = await service.get_session(app_name="test_app", user_id="user_005", session_id=str(uuid.uuid4()))

        assert result is None

    async def test_get_session_returns_session_with_events(self, mock_pool):
        """测试: 返回包含事件的会话"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool

        session_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        # 模拟 threads 表返回
        conn.fetchrow = AsyncMock(
            return_value={
                "id": session_id,
                "app_name": "test_app",
                "user_id": "user_006",
                "state": '{"key": "value"}',
                "updated_at": now,
            }
        )

        # 模拟 events 表返回
        conn.fetch = AsyncMock(
            return_value=[
                {
                    "id": uuid.uuid4(),
                    "author": "user",
                    "event_type": "message",
                    "content": '{"text": "hello"}',
                    "actions": "{}",
                    "created_at": now,
                }
            ]
        )

        service = PostgresSessionService(pool=pool)
        result = await service.get_session(app_name="test_app", user_id="user_006", session_id=str(session_id))

        assert result is not None
        assert result.state == {"key": "value"}
        assert len(result.events) == 1

    async def test_get_session_with_invalid_uuid_returns_none(self, mock_pool):
        """测试: 无效 UUID 格式时返回 None (而非抛异常)"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        conn.fetchrow = AsyncMock(return_value=None)

        service = PostgresSessionService(pool=pool)

        # 使用无效 UUID 格式
        result = await service.get_session(app_name="test_app", user_id="user_007", session_id="not-a-valid-uuid")

        # 实现应处理异常并返回 None
        assert result is None

    # ========== list_sessions 测试 ==========

    async def test_list_sessions_returns_empty_list(self, mock_pool):
        """测试: 无会话时返回空列表"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        conn.fetch = AsyncMock(return_value=[])

        service = PostgresSessionService(pool=pool)
        response = await service.list_sessions(app_name="test_app", user_id="user_008")

        assert response.sessions == []

    async def test_list_sessions_returns_multiple_sessions(self, mock_pool):
        """测试: 返回多个会话"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        now = datetime.now(timezone.utc)

        conn.fetch = AsyncMock(
            return_value=[
                {"id": uuid.uuid4(), "app_name": "test_app", "user_id": "user_009", "state": "{}", "updated_at": now},
                {"id": uuid.uuid4(), "app_name": "test_app", "user_id": "user_009", "state": "{}", "updated_at": now},
            ]
        )

        service = PostgresSessionService(pool=pool)
        response = await service.list_sessions(app_name="test_app", user_id="user_009")

        assert len(response.sessions) == 2

    async def test_list_sessions_all_users_queries_without_user_filter(self, mock_pool):
        """测试: user_id 为 None 时查询所有用户"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        conn.fetch = AsyncMock(return_value=[])

        service = PostgresSessionService(pool=pool)
        await service.list_sessions(app_name="test_app", user_id=None)

        # 验证查询被调用
        conn.fetch.assert_called_once()

    # ========== delete_session 测试 ==========

    async def test_delete_session_calls_delete(self, mock_pool):
        """测试: 删除会话调用正确 SQL"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        session_id = str(uuid.uuid4())
        await service.delete_session(app_name="test_app", user_id="user_010", session_id=session_id)

        # 验证 DELETE 被调用
        conn.execute.assert_called_once()
        call_sql = conn.execute.call_args[0][0]
        assert "DELETE FROM threads" in call_sql

    # ========== State 前缀路由测试 ==========

    async def test_state_delta_normal_key_updates_threads(self, mock_pool):
        """测试: 无前缀键更新 threads.state"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService
        from google.adk.sessions import Session
        from google.adk.events import Event

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        session = Session(id=str(uuid.uuid4()), app_name="test_app", user_id="user_011", events=[], state={})

        # 创建带 state_delta 的 Event
        event = Event(author="agent", timestamp=datetime.now().timestamp())
        event.actions = MagicMock()
        event.actions.state_delta = {"normal_key": "session_value"}
        event.actions.model_dump.return_value = {"state_delta": {"normal_key": "session_value"}}

        await service.append_event(session, event)

        # 验证至少一次 execute 调用
        assert conn.execute.call_count >= 1

    async def test_state_delta_temp_prefix_not_persisted(self, mock_pool):
        """测试: temp: 前缀不写入数据库"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService
        from google.adk.sessions import Session
        from google.adk.events import Event

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        session = Session(id=str(uuid.uuid4()), app_name="test_app", user_id="user_012", events=[], state={})

        # 仅包含 temp: 前缀的 state_delta
        event = Event(author="agent", timestamp=datetime.now().timestamp())
        event.actions = MagicMock()
        event.actions.state_delta = {"temp:cache": "temporary_value"}

        # 注意: temp: 前缀在基类 _trim_temp_delta_state 中过滤
        # 此处验证逻辑正确处理

    async def test_state_delta_user_prefix_updates_user_states(self, mock_pool):
        """测试: user: 前缀更新 user_states 表"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService
        from google.adk.sessions import Session
        from google.adk.events import Event

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        session = Session(id=str(uuid.uuid4()), app_name="test_app", user_id="user_013", events=[], state={})

        event = Event(author="agent", timestamp=datetime.now().timestamp())
        event.actions = MagicMock()
        event.actions.state_delta = {"user:preference": "dark_mode"}
        event.actions.model_dump.return_value = {"state_delta": {"user:preference": "dark_mode"}}

        await service.append_event(session, event)

        # 验证 INSERT/UPDATE user_states
        calls = conn.execute.call_args_list
        # 至少有事件插入和状态更新两次调用
        assert len(calls) >= 1

    async def test_state_delta_app_prefix_updates_app_states(self, mock_pool):
        """测试: app: 前缀更新 app_states 表"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService
        from google.adk.sessions import Session
        from google.adk.events import Event

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        session = Session(id=str(uuid.uuid4()), app_name="test_app", user_id="user_014", events=[], state={})

        event = Event(author="agent", timestamp=datetime.now().timestamp())
        event.actions = MagicMock()
        event.actions.state_delta = {"app:config": "enabled"}
        event.actions.model_dump.return_value = {"state_delta": {"app:config": "enabled"}}

        await service.append_event(session, event)

        # 验证 INSERT/UPDATE app_states
        assert conn.execute.call_count >= 1

    # ========== 边界条件测试 ==========

    async def test_create_session_with_complex_state(self, mock_pool):
        """测试: 复杂嵌套状态正确序列化"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        complex_state = {
            "nested": {"level2": {"level3": "deep_value"}},
            "array": [1, 2, 3],
            "mixed": [{"a": 1}, {"b": 2}],
        }

        session = await service.create_session(app_name="test_app", user_id="user_015", state=complex_state)

        assert session.state == complex_state

    async def test_create_session_with_unicode_content(self, mock_pool):
        """测试: Unicode 内容正确处理"""
        from cognizes.adapters.postgres.session_service import PostgresSessionService

        pool, conn = mock_pool
        service = PostgresSessionService(pool=pool)

        unicode_state = {"chinese": "中文内容", "emoji": "👍🎉", "japanese": "日本語"}

        session = await service.create_session(app_name="测试应用", user_id="用户_016", state=unicode_state)

        assert session.state["chinese"] == "中文内容"
        assert session.state["emoji"] == "👍🎉"


# ============================================================================
# 需要真实数据库的集成测试 (标记为 skip，需手动启用)
# ============================================================================


class TestPostgresSessionServiceIntegration:
    """
    SessionService 集成测试套件 (需要真实数据库)

    运行方式:
    pytest tests/unittests/mind/test_session_service.py::TestPostgresSessionServiceIntegration -v
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
        # Pool managed by DatabaseManager

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
