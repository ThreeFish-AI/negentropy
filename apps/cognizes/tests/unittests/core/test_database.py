"""
DatabaseManager 单元测试

测试范围：纯逻辑测试，Mock 数据库连接
- 初始化与配置
- 单例模式
- DSN 解析
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from cognizes.core.database import DatabaseManager


class TestDatabaseManagerInitialization:
    """初始化测试"""

    def setup_method(self):
        """每个测试前重置单例"""
        DatabaseManager.reset_instance()

    def test_default_dsn_from_env(self):
        """测试从环境变量读取 DSN"""
        with patch.dict(os.environ, {"DATABASE_URL": "postgresql://test:pass@localhost/testdb"}):
            db = DatabaseManager()
            assert db.dsn == "postgresql://test:pass@localhost/testdb"

    def test_custom_dsn(self):
        """测试自定义 DSN"""
        db = DatabaseManager(dsn="postgresql://custom:pass@localhost/customdb")
        assert db.dsn == "postgresql://custom:pass@localhost/customdb"

    def test_custom_pool_sizes(self):
        """测试自定义连接池大小"""
        db = DatabaseManager(min_pool_size=5, max_pool_size=20)
        assert db._min_pool_size == 5
        assert db._max_pool_size == 20

    def test_pgvector_enabled_by_default(self):
        """测试 pgvector 默认启用"""
        db = DatabaseManager()
        assert db._enable_pgvector is True

    def test_pgvector_can_be_disabled(self):
        """测试 pgvector 可以禁用"""
        db = DatabaseManager(enable_pgvector=False)
        assert db._enable_pgvector is False


class TestSingletonPattern:
    """单例模式测试"""

    def setup_method(self):
        """每个测试前重置单例"""
        DatabaseManager.reset_instance()

    def test_get_instance_returns_same_instance(self):
        """测试 get_instance 返回相同实例"""
        db1 = DatabaseManager.get_instance()
        db2 = DatabaseManager.get_instance()
        assert db1 is db2

    def test_get_instance_with_different_dsn_creates_new_instance(self):
        """测试不同 DSN 创建新实例"""
        with patch.dict(os.environ, {"DATABASE_URL": "postgresql://first@localhost/db1"}):
            db1 = DatabaseManager.get_instance()

        with patch.dict(os.environ, {"DATABASE_URL": "postgresql://second@localhost/db2"}):
            db2 = DatabaseManager.get_instance(dsn="postgresql://second@localhost/db2")

        # 不同 DSN 应该创建新实例
        assert db1 is not db2

    def test_reset_instance_clears_singleton(self):
        """测试 reset_instance 清除单例"""
        db1 = DatabaseManager.get_instance()
        DatabaseManager.reset_instance()
        db2 = DatabaseManager.get_instance()
        assert db1 is not db2


class TestPoolManagement:
    """连接池管理测试 (Mock)"""

    def setup_method(self):
        """每个测试前重置单例"""
        DatabaseManager.reset_instance()

    @pytest.mark.asyncio
    async def test_get_pool_creates_pool(self):
        """测试 get_pool 创建连接池"""
        db = DatabaseManager(dsn="postgresql://test@localhost/testdb", enable_pgvector=False)

        mock_pool = MagicMock()
        mock_create = AsyncMock(return_value=mock_pool)
        with patch("asyncpg.create_pool", mock_create):
            pool = await db.get_pool()

            assert pool is mock_pool
            mock_create.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_pool_reuses_existing_pool(self):
        """测试 get_pool 复用现有连接池"""
        db = DatabaseManager(dsn="postgresql://test@localhost/testdb", enable_pgvector=False)

        mock_pool = MagicMock()
        mock_create = AsyncMock(return_value=mock_pool)
        with patch("asyncpg.create_pool", mock_create):
            pool1 = await db.get_pool()
            pool2 = await db.get_pool()

            assert pool1 is pool2
            assert mock_create.call_count == 1  # 只创建一次

    @pytest.mark.asyncio
    async def test_close_closes_pool(self):
        """测试 close 关闭连接池"""
        db = DatabaseManager(dsn="postgresql://test@localhost/testdb", enable_pgvector=False)

        mock_pool = MagicMock()
        mock_pool.close = AsyncMock()
        mock_create = AsyncMock(return_value=mock_pool)
        with patch("asyncpg.create_pool", mock_create):
            await db.get_pool()
            await db.close()

            mock_pool.close.assert_called_once()
            assert db._pool is None


class TestBasicOperations:
    """基础操作测试 (Mock)"""

    def setup_method(self):
        """每个测试前重置单例"""
        DatabaseManager.reset_instance()

    @pytest.mark.asyncio
    async def test_execute(self):
        """测试 execute 方法"""
        db = DatabaseManager(dsn="postgresql://test@localhost/testdb", enable_pgvector=False)

        mock_conn = AsyncMock()
        mock_conn.execute.return_value = "INSERT 0 1"

        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_create = AsyncMock(return_value=mock_pool)
        with patch("asyncpg.create_pool", mock_create):
            result = await db.execute("INSERT INTO test (id) VALUES ($1)", 1)
            assert result == "INSERT 0 1"
            mock_conn.execute.assert_called_once_with("INSERT INTO test (id) VALUES ($1)", 1)

    @pytest.mark.asyncio
    async def test_fetch(self):
        """测试 fetch 方法"""
        db = DatabaseManager(dsn="postgresql://test@localhost/testdb", enable_pgvector=False)

        mock_records = [{"id": 1, "name": "test1"}, {"id": 2, "name": "test2"}]
        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = mock_records

        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_create = AsyncMock(return_value=mock_pool)
        with patch("asyncpg.create_pool", mock_create):
            result = await db.fetch("SELECT * FROM test")
            assert result == mock_records

    @pytest.mark.asyncio
    async def test_fetchrow(self):
        """测试 fetchrow 方法"""
        db = DatabaseManager(dsn="postgresql://test@localhost/testdb", enable_pgvector=False)

        mock_record = {"id": 1, "name": "test"}
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = mock_record

        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_create = AsyncMock(return_value=mock_pool)
        with patch("asyncpg.create_pool", mock_create):
            result = await db.fetchrow("SELECT * FROM test WHERE id = $1", 1)
            assert result == mock_record

    @pytest.mark.asyncio
    async def test_fetchval(self):
        """测试 fetchval 方法"""
        db = DatabaseManager(dsn="postgresql://test@localhost/testdb", enable_pgvector=False)

        mock_conn = AsyncMock()
        mock_conn.fetchval.return_value = 42

        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
        mock_create = AsyncMock(return_value=mock_pool)
        with patch("asyncpg.create_pool", mock_create):
            result = await db.fetchval("SELECT COUNT(*) FROM test")
            assert result == 42


class TestSyncOperations:
    """同步操作测试"""

    def setup_method(self):
        """每个测试前重置单例"""
        DatabaseManager.reset_instance()

    def test_execute_sync(self):
        """测试同步执行"""
        db = DatabaseManager(dsn="postgresql://test@localhost/testdb")

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.__enter__.return_value = mock_conn

        with patch("psycopg.connect", return_value=mock_conn):
            db.execute_sync("INSERT INTO test (id) VALUES (%s)", 1)

            mock_cursor.execute.assert_called_once()
            mock_conn.commit.assert_called_once()
