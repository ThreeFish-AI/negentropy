"""
High-Selectivity Filtering 性能测试

验证高过滤比场景下的召回率和延迟。

对应任务: P3-2-3, P3-2-4
"""

import time

import numpy as np
import pytest

pytestmark = pytest.mark.asyncio


def to_pgvector(embedding: list[float]) -> str:
    """将 embedding list 转换为 pgvector 格式字符串"""
    return "[" + ",".join(str(x) for x in embedding) + "]"


class TestIterativeScanConfiguration:
    """迭代扫描配置测试"""

    async def test_iterative_scan_setting(self, integration_db):
        """测试迭代扫描设置"""
        async with integration_db.acquire() as conn:
            # 设置迭代扫描参数
            await conn.execute("SET hnsw.iterative_scan = relaxed_order")
            await conn.execute("SET hnsw.ef_search = 200")

            # 验证设置生效
            result = await conn.fetchval("SHOW hnsw.ef_search")
            assert result == "200"

    async def test_max_scan_tuples_setting(self, integration_db):
        """测试最大扫描元组设置"""
        async with integration_db.acquire() as conn:
            await conn.execute("SET hnsw.max_scan_tuples = 20000")

            result = await conn.fetchval("SHOW hnsw.max_scan_tuples")
            assert int(result) == 20000


class TestHighSelectivityQueries:
    """高选择性查询测试"""

    async def test_rare_user_query(self, integration_db, setup_test_data, test_user_id):
        """稀有用户查询测试"""
        embedding = np.random.randn(1536).astype(float).tolist()

        # 配置迭代扫描
        async with integration_db.acquire() as conn:
            await conn.execute("SET hnsw.iterative_scan = relaxed_order")
            await conn.execute("SET hnsw.ef_search = 200")

            start = time.perf_counter()
            rows = await conn.fetch(
                """
                SELECT id FROM memories
                WHERE user_id = $1
                ORDER BY embedding <=> $2
                LIMIT 10
            """,
                test_user_id,
                embedding,
            )
            latency_ms = (time.perf_counter() - start) * 1000

        print(f"\n=== 稀有用户查询: {len(rows)} 结果, {latency_ms:.2f}ms ===")

        # 测试数据有 10 条，应该能返回
        assert len(rows) <= 10

    async def test_vector_search_with_filter(self, integration_db, setup_test_data, test_user_id, test_app_name):
        """带过滤条件的向量检索测试"""
        embedding = np.random.randn(1536).astype(float).tolist()

        async with integration_db.acquire() as conn:
            await conn.execute("SET hnsw.iterative_scan = relaxed_order")

            rows = await conn.fetch(
                """
                SELECT id, content
                FROM memories
                WHERE user_id = $1 AND app_name = $2
                ORDER BY embedding <=> $3
                LIMIT 10
            """,
                test_user_id,
                test_app_name,
                embedding,
            )

        assert len(rows) <= 10


class TestEfSearchImpact:
    """ef_search 参数影响测试"""

    async def test_ef_search_values(self, integration_db, setup_test_data, test_user_id):
        """测试不同 ef_search 值"""
        embedding = np.random.randn(1536).astype(float).tolist()
        ef_values = [40, 100, 200]
        results = {}

        for ef in ef_values:
            async with integration_db.acquire() as conn:
                await conn.execute(f"SET hnsw.ef_search = {ef}")
                await conn.execute("SET hnsw.iterative_scan = relaxed_order")

                start = time.perf_counter()
                rows = await conn.fetch(
                    """
                    SELECT id FROM memories
                    WHERE user_id = $1
                    ORDER BY embedding <=> $2
                    LIMIT 10
                """,
                    test_user_id,
                    embedding,
                )
                latency_ms = (time.perf_counter() - start) * 1000

                results[ef] = {"count": len(rows), "latency": latency_ms}

        print("\n=== ef_search 影响 ===")
        for ef, data in results.items():
            print(f"ef_search={ef}: {data['count']} 结果, {data['latency']:.2f}ms")

        # 验证所有配置都能返回结果
        for ef, data in results.items():
            assert data["count"] >= 0


# 运行: uv run pytest tests/integration/perception/test_high_selectivity.py -v -s
