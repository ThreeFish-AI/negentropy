"""
High-Selectivity Filtering 性能基准测试

测试不同 ef_search 参数下的 QPS 和 Recall@K。
"""

import asyncio
import time
from dataclasses import dataclass

import asyncpg
import numpy as np


@dataclass
class BenchmarkResult:
    """基准测试结果"""

    ef_search: int
    qps: float
    recall_at_10: float
    p99_latency_ms: float


async def run_benchmark(
    pool: asyncpg.Pool, query_embedding: list[float], user_id: str, ef_search_values: list[int], iterations: int = 100
) -> list[BenchmarkResult]:
    """运行基准测试"""
    results = []

    for ef_search in ef_search_values:
        # 设置 ef_search
        await pool.execute(f"SET hnsw.ef_search = {ef_search}")
        await pool.execute("SET hnsw.iterative_scan = relaxed_order")

        latencies = []
        recall_count = 0

        for _ in range(iterations):
            start = time.perf_counter()

            rows = await pool.fetch(
                """
                SELECT id, content
                FROM memories
                WHERE user_id = $1
                ORDER BY embedding <=> $2
                LIMIT 10
            """,
                user_id,
                query_embedding,
            )

            latency = (time.perf_counter() - start) * 1000
            latencies.append(latency)
            recall_count += len(rows)

        results.append(
            BenchmarkResult(
                ef_search=ef_search,
                qps=iterations / (sum(latencies) / 1000),
                recall_at_10=recall_count / (iterations * 10),
                p99_latency_ms=np.percentile(latencies, 99),
            )
        )

    return results


# 使用示例
async def main():
    from cognizes.core.database import DatabaseManager

    db = DatabaseManager.get_instance()
    pool = await db.get_pool()

    # 生成随机查询向量
    query_embedding = list(np.random.randn(1536).astype(float))

    results = await run_benchmark(pool, query_embedding, user_id="rare_user_001", ef_search_values=[40, 100, 200, 400])

    print("| ef_search | QPS | Recall@10 | P99 Latency |")
    print("|-----------|-----|-----------|-------------|")
    for r in results:
        print(f"| {r.ef_search} | {r.qps:.1f} | {r.recall_at_10:.2%} | {r.p99_latency_ms:.1f}ms |")

    # Pool managed by DatabaseManager


if __name__ == "__main__":
    asyncio.run(main())
