"""
Hybrid Search 集成测试

验证 hybrid_search 和 rrf_search SQL 函数的正确性和性能。

对应任务: P3-1-5, P3-1-7
"""

import time

import numpy as np
import pytest

pytestmark = pytest.mark.asyncio


def to_pgvector(embedding: list[float]) -> str:
    """将 embedding list 转换为 pgvector 格式字符串"""
    return "[" + ",".join(str(x) for x in embedding) + "]"


class TestHybridSearchFunction:
    """hybrid_search() SQL 函数测试"""

    async def test_function_exists(self, integration_db):
        """验证函数存在"""
        async with integration_db.acquire() as conn:
            result = await conn.fetchval("""
                SELECT proname FROM pg_proc
                WHERE proname = 'hybrid_search'
            """)

        assert result == "hybrid_search", "hybrid_search 函数不存在，请先部署 perception_schema.sql"

    async def test_empty_results(self, integration_db):
        """无匹配结果测试"""
        embedding = np.random.randn(1536).astype(float).tolist()

        async with integration_db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM hybrid_search($1, $2, $3, $4, 10)
            """,
                "nonexistent_user",
                "nonexistent_app",
                "test",
                embedding,
            )

        assert len(rows) == 0

    async def test_returns_combined_score(self, integration_db, setup_test_data, test_user_id, test_app_name):
        """验证返回合并分数"""
        embedding = np.random.randn(1536).astype(float).tolist()

        async with integration_db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, content, semantic_score, keyword_score, combined_score
                FROM hybrid_search($1, $2, $3, $4, 50)
            """,
                test_user_id,
                test_app_name,
                "machine learning",
                embedding,
            )

        if len(rows) > 0:
            row = rows[0]
            # 验证返回字段
            assert "combined_score" in row.keys()
            assert "semantic_score" in row.keys()
            # combined_score 应该是加权平均
            expected = row["semantic_score"] * 0.7 + row["keyword_score"] * 0.3
            assert abs(row["combined_score"] - expected) < 0.0001

    async def test_latency_under_100ms(self, integration_db, setup_test_data, test_user_id, test_app_name):
        """L0 延迟应小于 100ms"""
        embedding = np.random.randn(1536).astype(float).tolist()

        latencies = []
        async with integration_db.acquire() as conn:
            for _ in range(5):
                start = time.perf_counter()
                await conn.fetch(
                    """
                    SELECT * FROM hybrid_search($1, $2, $3, $4, 50)
                """,
                    test_user_id,
                    test_app_name,
                    "test query",
                    embedding,
                )
                latency_ms = (time.perf_counter() - start) * 1000
                latencies.append(latency_ms)

        avg_latency = sum(latencies) / len(latencies)
        print(f"\n=== Hybrid Search 平均延迟: {avg_latency:.2f}ms ===")

        assert avg_latency < 100, f"L0 延迟 {avg_latency:.1f}ms 超过 100ms 阈值"


class TestRRFSearchFunction:
    """rrf_search() SQL 函数测试"""

    async def test_function_exists(self, integration_db):
        """验证函数存在"""
        async with integration_db.acquire() as conn:
            result = await conn.fetchval("""
                SELECT proname FROM pg_proc
                WHERE proname = 'rrf_search'
            """)

        assert result == "rrf_search", "rrf_search 函数不存在，请先部署 perception_schema.sql"

    async def test_rrf_score_descending(self, integration_db, setup_test_data, test_user_id, test_app_name):
        """验证 RRF 分数递减排序"""
        embedding = np.random.randn(1536).astype(float).tolist()

        async with integration_db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, rrf_score FROM rrf_search($1, $2, $3, $4, 50)
            """,
                test_user_id,
                test_app_name,
                "machine learning",
                embedding,
            )

        if len(rows) > 1:
            scores = [row["rrf_score"] for row in rows]
            assert scores == sorted(scores, reverse=True), "RRF 分数应递减排序"

    async def test_includes_rank_info(self, integration_db, setup_test_data, test_user_id, test_app_name):
        """验证返回排名信息"""
        embedding = np.random.randn(1536).astype(float).tolist()

        async with integration_db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT semantic_rank, keyword_rank FROM rrf_search($1, $2, $3, $4, 10)
            """,
                test_user_id,
                test_app_name,
                "AI",
                embedding,
            )

        if len(rows) > 0:
            row = rows[0]
            assert "semantic_rank" in row.keys()
            assert "keyword_rank" in row.keys()


class TestSearchVectorIndex:
    """全文搜索索引测试"""

    async def test_search_vector_column_exists(self, integration_db):
        """验证 search_vector 列存在"""
        async with integration_db.acquire() as conn:
            result = await conn.fetchval("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'memories' AND column_name = 'search_vector'
            """)

        assert result == "search_vector", "search_vector 列不存在"

    async def test_gin_index_exists(self, integration_db):
        """验证 GIN 索引存在"""
        async with integration_db.acquire() as conn:
            result = await conn.fetchval("""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'memories' AND indexname = 'idx_memories_search_vector'
            """)

        assert result is not None, "idx_memories_search_vector 索引不存在"

    async def test_trigger_exists(self, integration_db):
        """验证 search_vector 触发器存在"""
        async with integration_db.acquire() as conn:
            result = await conn.fetchval("""
                SELECT tgname FROM pg_trigger
                WHERE tgname = 'trigger_memories_search_vector'
            """)

        assert result is not None, "search_vector 触发器不存在"


# 运行: uv run pytest tests/integration/perception/test_hybrid_search.py -v -s
