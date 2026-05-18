"""
DatabaseManager: PostgreSQL 数据库统一管理器

提供统一的连接池管理和基础数据库操作封装：
- 单例连接池管理 (支持事件循环切换)
- 异步操作 (asyncpg) 和同步操作 (psycopg) 双驱动支持
- pgvector 扩展自动初始化
- 事务上下文管理
- 健康检查
"""

from __future__ import annotations

import asyncio
import json
import uuid
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

import asyncpg

logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    PostgreSQL 数据库管理器

    统一管理数据库连接池和基础操作，提供：
    - 单例模式避免重复创建连接池
    - 事件循环切换时自动重建连接池
    - pgvector 扩展初始化
    - 异步和同步操作封装

    使用方式:
        # 方式一：单例模式 (推荐)
        db = DatabaseManager.get_instance()
        rows = await db.fetch("SELECT * FROM users WHERE id = $1", user_id)

        # 方式二：直接实例化
        db = DatabaseManager(dsn="postgresql://user:pass@localhost/db")
        async with db.transaction() as conn:
            await conn.execute("INSERT INTO ...")

        # 方式三：获取连接池供其他服务使用
        pool = await db.get_pool()
        session_service = PostgresSessionService(pool=pool)
    """

    # 单例实例
    _instance: "DatabaseManager | None" = None
    _instance_dsn: str | None = None

    def __init__(
        self,
        dsn: str | None = None,
        *,
        min_pool_size: int = 2,
        max_pool_size: int = 10,
        enable_pgvector: bool = True,
    ):
        """
        初始化数据库管理器

        Args:
            dsn: 数据库连接字符串，默认从 DATABASE_URL 环境变量读取
            min_pool_size: 连接池最小连接数
            max_pool_size: 连接池最大连接数
            enable_pgvector: 是否启用 pgvector 扩展初始化
        """
        self._dsn = dsn or os.getenv("DATABASE_URL", "postgresql://aigc:@localhost:5432/cognizes-engine")
        self._min_pool_size = min_pool_size
        self._max_pool_size = max_pool_size
        self._enable_pgvector = enable_pgvector

        # 连接池和对应的事件循环
        self._pool: asyncpg.Pool | None = None
        self._pool_loop: asyncio.AbstractEventLoop | None = None

    @classmethod
    def get_instance(cls, dsn: str | None = None) -> "DatabaseManager":
        """
        获取单例实例

        Args:
            dsn: 数据库连接字符串 (仅在首次调用时生效)

        Returns:
            DatabaseManager 单例实例
        """
        effective_dsn = dsn or os.getenv("DATABASE_URL")

        if cls._instance is None or (effective_dsn and cls._instance_dsn != effective_dsn):
            cls._instance = cls(dsn=dsn)
            cls._instance_dsn = effective_dsn

        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """重置单例实例 (主要用于测试)"""
        cls._instance = None
        cls._instance_dsn = None

    @property
    def dsn(self) -> str:
        """获取数据库连接字符串"""
        return self._dsn

    async def get_pool(self) -> asyncpg.Pool:
        """
        获取数据库连接池

        支持事件循环切换时自动重建连接池

        Returns:
            asyncpg.Pool 连接池实例
        """
        current_loop = asyncio.get_running_loop()

        # 如果连接池不存在或在不同事件循环中创建，则重新创建
        if self._pool is None or self._pool_loop is not current_loop:
            if self._pool is not None:
                try:
                    await self._pool.close()
                except Exception:
                    pass  # 忽略关闭错误，旧事件循环可能已关闭

            # pgvector 初始化回调
            init_callback = None
            if self._enable_pgvector:
                try:
                    import pgvector.asyncpg

                    async def init_connection(conn: asyncpg.Connection) -> None:
                        await pgvector.asyncpg.register_vector(conn)

                    init_callback = init_connection
                except ImportError:
                    logger.warning("pgvector not installed, skipping vector type registration")

            self._pool = await asyncpg.create_pool(
                self._dsn,
                min_size=self._min_pool_size,
                max_size=self._max_pool_size,
                init=init_callback,
            )
            self._pool_loop = current_loop
            logger.info(f"Created database pool: min={self._min_pool_size}, max={self._max_pool_size}")

        return self._pool

    async def close(self) -> None:
        """关闭连接池"""
        if self._pool is not None:
            await self._pool.close()
            self._pool = None
            self._pool_loop = None
            logger.info("Database pool closed")

    # ========================================
    # 基础操作封装
    # ========================================

    async def execute(self, query: str, *args: Any) -> str:
        """
        执行 SQL 语句

        Args:
            query: SQL 查询语句
            *args: 查询参数

        Returns:
            执行结果状态字符串 (如 "INSERT 0 1")
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.execute(query, *args)

    async def fetch(self, query: str, *args: Any) -> list[asyncpg.Record]:
        """
        查询多行记录

        Args:
            query: SQL 查询语句
            *args: 查询参数

        Returns:
            查询结果列表
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args: Any) -> asyncpg.Record | None:
        """
        查询单行记录

        Args:
            query: SQL 查询语句
            *args: 查询参数

        Returns:
            单行记录或 None
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args: Any, column: int = 0) -> Any:
        """
        查询单个值

        Args:
            query: SQL 查询语句
            *args: 查询参数
            column: 返回的列索引

        Returns:
            查询结果的单个值
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchval(query, *args, column=column)

    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """
        事务上下文管理器

        Usage:
            async with db.transaction() as conn:
                await conn.execute("INSERT INTO ...")
                await conn.execute("UPDATE ...")
                # 自动提交，异常时自动回滚

        Yields:
            事务中的数据库连接
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                yield conn

    @asynccontextmanager
    async def acquire(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """
        获取连接上下文管理器

        Usage:
            async with db.acquire() as conn:
                await conn.execute("...")

        Yields:
            数据库连接
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            yield conn

    # ========================================
    # 向量搜索封装
    # ========================================

    async def vector_search(
        self,
        table: str,
        embedding: list[float],
        *,
        filters: dict[str, Any] | None = None,
        columns: str = "*",
        limit: int = 10,
        ef_search: int = 200,
        iterative_scan: str = "relaxed_order",
    ) -> list[asyncpg.Record]:
        """
        向量相似度搜索

        自动配置 HNSW 参数并执行向量相似度搜索。

        Args:
            table: 目标表名
            embedding: 查询向量
            filters: 过滤条件字典，如 {"user_id": "u1", "app_name": "app"}
            columns: 返回的列，默认 "*"
            limit: 返回数量限制
            ef_search: HNSW ef_search 参数 (越大召回越高，但越慢)
            iterative_scan: 迭代扫描模式，默认 "relaxed_order"

        Returns:
            查询结果列表

        Usage:
            rows = await db.vector_search(
                "memories",
                embedding,
                filters={"user_id": "u1"},
                limit=10,
                ef_search=200
            )
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            # 配置 HNSW 参数
            await conn.execute(f"SET hnsw.ef_search = {ef_search}")
            await conn.execute(f"SET hnsw.iterative_scan = {iterative_scan}")

            # 构建动态 WHERE 子句
            where_parts = []
            params: list[Any] = [embedding]

            if filters:
                for i, (key, value) in enumerate(filters.items(), start=2):
                    where_parts.append(f"{key} = ${i}")
                    params.append(value)

            where_clause = " AND ".join(where_parts) if where_parts else "1=1"

            query = f"""
                SELECT {columns}
                FROM {table}
                WHERE {where_clause}
                ORDER BY embedding <=> $1
                LIMIT {limit}
            """

            return await conn.fetch(query, *params)

    async def hybrid_search(
        self,
        user_id: str,
        app_name: str,
        query: str,
        embedding: list[float],
        limit: int = 50,
    ) -> list[asyncpg.Record]:
        """
        混合搜索 (语义 + 关键词)

        调用 PostgreSQL 的 hybrid_search() 函数，结合向量相似度和全文检索。

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            query: 关键词查询文本
            embedding: 查询向量
            limit: 返回数量限制

        Returns:
            包含 id, content, semantic_score, keyword_score, combined_score 的结果列表

        Usage:
            rows = await db.hybrid_search(
                "user_001", "demo_app",
                "machine learning",
                embedding,
                limit=50
            )
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(
                "SELECT * FROM hybrid_search($1, $2, $3, $4, $5)",
                user_id,
                app_name,
                query,
                embedding,
                limit,
            )

    async def rrf_search(
        self,
        user_id: str,
        app_name: str,
        query: str,
        embedding: list[float],
        limit: int = 50,
    ) -> list[asyncpg.Record]:
        """
        RRF 融合搜索 (Reciprocal Rank Fusion)

        调用 PostgreSQL 的 rrf_search() 函数，使用 RRF 算法融合多路召回结果。

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            query: 关键词查询文本
            embedding: 查询向量
            limit: 返回数量限制

        Returns:
            包含 rrf_score, semantic_rank, keyword_rank 的结果列表

        Usage:
            rows = await db.rrf_search(
                "user_001", "demo_app",
                "AI research",
                embedding,
                limit=10
            )
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(
                "SELECT * FROM rrf_search($1, $2, $3, $4, $5)",
                user_id,
                app_name,
                query,
                embedding,
                limit,
            )

    # ========================================
    # 同步操作 (用于 OTEL 导出等场景)
    # ========================================

    def execute_sync(self, query: str, *args: Any) -> None:
        """
        同步执行 SQL 语句

        用于无法使用异步的场景 (如 OpenTelemetry BatchSpanProcessor 回调)

        Args:
            query: SQL 查询语句
            *args: 查询参数
        """
        try:
            import psycopg

            with psycopg.connect(self._dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(query, args if args else None)
                conn.commit()
        except ImportError:
            logger.error("psycopg not installed, cannot execute sync query")
            raise

    def executemany_sync(self, query: str, params_list: list[tuple]) -> None:
        """
        同步批量执行 SQL 语句

        Args:
            query: SQL 查询语句
            params_list: 参数元组列表
        """
        try:
            import psycopg

            with psycopg.connect(self._dsn) as conn:
                with conn.cursor() as cur:
                    cur.executemany(query, params_list)
                conn.commit()
        except ImportError:
            logger.error("psycopg not installed, cannot execute sync batch query")
            raise

    # ========================================
    # 健康检查
    # ========================================

    async def health_check(self) -> dict[str, Any]:
        """
        数据库健康检查

        Returns:
            健康状态字典，包含:
            - status: "healthy" | "unhealthy"
            - pool_size: 当前连接池大小
            - pool_min: 最小连接数
            - pool_max: 最大连接数
            - version: PostgreSQL 版本
        """
        try:
            pool = await self.get_pool()
            version = await self.fetchval("SELECT version()")

            return {
                "status": "healthy",
                "pool_size": pool.get_size(),
                "pool_min": pool.get_min_size(),
                "pool_max": pool.get_max_size(),
                "pool_free": pool.get_idle_size(),
                "version": version,
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
            }

    # ========================================
    # 便捷函数
    # ========================================

    # ========================================
    # Repository Accessors
    # ========================================

    @property
    def sessions(self) -> "SessionRepository":
        from cognizes.core.repositories import SessionRepository

        return SessionRepository(self)

    @property
    def events(self) -> "EventRepository":
        from cognizes.core.repositories import EventRepository

        return EventRepository(self)

    @property
    def states(self) -> "StateRepository":
        from cognizes.core.repositories import StateRepository

        return StateRepository(self)

    @property
    def memories(self) -> "MemoryRepository":
        from cognizes.core.repositories import MemoryRepository

        return MemoryRepository(self)

    @property
    def facts(self) -> "FactsRepository":
        from cognizes.core.repositories import FactsRepository

        return FactsRepository(self)

    @property
    def instructions(self) -> "InstructionsRepository":
        from cognizes.core.repositories import InstructionsRepository

        return InstructionsRepository(self)


async def get_db() -> DatabaseManager:
    """
    获取数据库管理器实例的便捷函数

    Returns:
        DatabaseManager 单例实例
    """
    return DatabaseManager.get_instance()


async def get_pool() -> asyncpg.Pool:
    """
    获取数据库连接池的便捷函数

    Returns:
        asyncpg.Pool 连接池实例
    """
    db = DatabaseManager.get_instance()
    return await db.get_pool()
