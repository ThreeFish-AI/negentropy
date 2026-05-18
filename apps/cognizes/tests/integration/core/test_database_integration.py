"""
DatabaseManager 集成测试

测试范围：真实数据库连接
- 连接池生命周期
- 基础操作 (execute/fetch/fetchrow/fetchval)
- 事务上下文管理
- 健康检查
"""

import os
import uuid

import pytest
import pytest_asyncio

from cognizes.core.database import DatabaseManager


@pytest.fixture(autouse=True)
def reset_singleton():
    """每个测试前后重置单例"""
    DatabaseManager.reset_instance()
    yield
    DatabaseManager.reset_instance()


@pytest_asyncio.fixture
async def db():
    """创建数据库管理器实例"""
    database_url = os.environ.get("DATABASE_URL", "postgresql://aigc:@localhost/cognizes-engine")
    manager = DatabaseManager(dsn=database_url, enable_pgvector=True)
    yield manager
    await manager.close()


class TestPoolLifecycle:
    """连接池生命周期测试"""

    @pytest.mark.asyncio
    async def test_pool_creation(self, db):
        """测试连接池创建"""
        pool = await db.get_pool()
        assert pool is not None
        assert pool.get_size() >= db._min_pool_size

    @pytest.mark.asyncio
    async def test_pool_reuse(self, db):
        """测试连接池复用"""
        pool1 = await db.get_pool()
        pool2 = await db.get_pool()
        assert pool1 is pool2

    @pytest.mark.asyncio
    async def test_pool_close(self, db):
        """测试连接池关闭"""
        await db.get_pool()
        await db.close()
        assert db._pool is None


class TestBasicOperations:
    """基础操作测试"""

    @pytest.mark.asyncio
    async def test_execute(self, db):
        """测试 execute"""
        # 创建临时表
        await db.execute("CREATE TEMP TABLE test_exec (id INT, name TEXT)")
        result = await db.execute("INSERT INTO test_exec (id, name) VALUES ($1, $2)", 1, "test")
        assert "INSERT" in result

    @pytest.mark.asyncio
    async def test_fetch(self, db):
        """测试 fetch"""
        # 使用 generate_series 生成测试数据
        rows = await db.fetch("SELECT generate_series(1, 5) AS num")
        assert len(rows) == 5
        assert rows[0]["num"] == 1

    @pytest.mark.asyncio
    async def test_fetchrow(self, db):
        """测试 fetchrow"""
        row = await db.fetchrow("SELECT 1 AS one, 'hello' AS greeting")
        assert row["one"] == 1
        assert row["greeting"] == "hello"

    @pytest.mark.asyncio
    async def test_fetchrow_no_result(self, db):
        """测试 fetchrow 无结果"""
        row = await db.fetchrow("SELECT 1 WHERE 1 = 0")
        assert row is None

    @pytest.mark.asyncio
    async def test_fetchval(self, db):
        """测试 fetchval"""
        value = await db.fetchval("SELECT 42")
        assert value == 42

    @pytest.mark.asyncio
    async def test_fetchval_version(self, db):
        """测试 fetchval 获取版本"""
        version = await db.fetchval("SELECT version()")
        assert "PostgreSQL" in version


class TestTransactionContext:
    """事务上下文测试"""

    @pytest.mark.asyncio
    async def test_transaction_commit(self, db):
        """测试事务提交"""
        table_name = f"test_tx_{uuid.uuid4().hex[:8]}"

        async with db.transaction() as conn:
            await conn.execute(f"CREATE TEMP TABLE {table_name} (id INT)")
            await conn.execute(f"INSERT INTO {table_name} (id) VALUES (1)")

        # 事务外查询 (临时表在事务后仍可见)
        row = await db.fetchrow(f"SELECT * FROM {table_name}")
        assert row["id"] == 1

    @pytest.mark.asyncio
    async def test_transaction_rollback_on_exception(self, db):
        """测试事务异常回滚"""
        table_name = f"test_tx_rb_{uuid.uuid4().hex[:8]}"

        # 先创建表
        await db.execute(f"CREATE TEMP TABLE {table_name} (id INT)")
        await db.execute(f"INSERT INTO {table_name} (id) VALUES (100)")

        try:
            async with db.transaction() as conn:
                await conn.execute(f"UPDATE {table_name} SET id = 999 WHERE id = 100")
                raise ValueError("Simulated error")
        except ValueError:
            pass

        # 事务回滚，值应该还是 100
        value = await db.fetchval(f"SELECT id FROM {table_name}")
        assert value == 100


class TestAcquireContext:
    """acquire 上下文测试"""

    @pytest.mark.asyncio
    async def test_acquire(self, db):
        """测试 acquire 上下文"""
        async with db.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            assert result == 1


class TestHealthCheck:
    """健康检查测试"""

    @pytest.mark.asyncio
    async def test_health_check_healthy(self, db):
        """测试健康检查 - 正常"""
        health = await db.health_check()

        assert health["status"] == "healthy"
        assert "pool_size" in health
        assert "pool_min" in health
        assert "pool_max" in health
        assert "version" in health
        assert "PostgreSQL" in health["version"]

    @pytest.mark.asyncio
    async def test_health_check_unhealthy(self):
        """测试健康检查 - 异常"""
        # 使用无效的 DSN
        db = DatabaseManager(dsn="postgresql://invalid:invalid@nonexistent:5432/invalid", enable_pgvector=False)

        health = await db.health_check()
        assert health["status"] == "unhealthy"
        assert "error" in health


class TestConvenienceFunctions:
    """便捷函数测试"""

    @pytest.mark.asyncio
    async def test_get_db(self):
        """测试 get_db 便捷函数"""
        from cognizes.core.database import get_db

        db = await get_db()
        assert isinstance(db, DatabaseManager)

    @pytest.mark.asyncio
    async def test_get_pool_function(self):
        """测试 get_pool 便捷函数"""
        from cognizes.core.database import get_pool
        import asyncpg

        pool = await get_pool()
        assert isinstance(pool, asyncpg.Pool)


class TestVectorSearch:
    """向量搜索封装测试"""

    @pytest.mark.asyncio
    async def test_vector_search_basic(self, db):
        """测试 vector_search 基础功能"""
        import numpy as np

        embedding = np.random.randn(1536).astype(float).tolist()

        # 调用 vector_search (即使没有匹配结果也应该正常运行)
        rows = await db.vector_search(
            "memories",
            embedding,
            filters={"user_id": "nonexistent_user"},
            limit=10,
            ef_search=100,
        )

        assert isinstance(rows, list)

    @pytest.mark.asyncio
    async def test_vector_search_columns(self, db):
        """测试 vector_search 指定列"""
        import numpy as np

        embedding = np.random.randn(1536).astype(float).tolist()

        rows = await db.vector_search(
            "memories",
            embedding,
            columns="id, content",
            limit=5,
        )

        assert isinstance(rows, list)

    @pytest.mark.asyncio
    async def test_hybrid_search(self, db):
        """测试 hybrid_search"""
        import numpy as np

        embedding = np.random.randn(1536).astype(float).tolist()

        rows = await db.hybrid_search(
            user_id="test_user",
            app_name="test_app",
            query="machine learning",
            embedding=embedding,
            limit=10,
        )

        assert isinstance(rows, list)

    @pytest.mark.asyncio
    async def test_rrf_search(self, db):
        """测试 rrf_search"""
        import numpy as np

        embedding = np.random.randn(1536).astype(float).tolist()

        rows = await db.rrf_search(
            user_id="test_user",
            app_name="test_app",
            query="AI research",
            embedding=embedding,
            limit=10,
        )

        assert isinstance(rows, list)
