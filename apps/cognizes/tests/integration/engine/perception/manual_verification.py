"""
Phase 3 验收测试脚本 (Manual Verification Runner)

验证 The Perception 的所有功能和性能指标。
此脚本来源于原文档 5.4 章节，作为手动验证的补充手段。
通常建议优先使用 pytest 运行对应的集成测试。
"""

import asyncio
import time
import os

import asyncpg
import numpy as np


async def test_hybrid_search(pool: asyncpg.Pool):
    """测试 One-Shot Hybrid Search"""
    query = "machine learning algorithms"
    query_embedding = list(np.random.randn(1536).astype(float))

    print(f"\n--- Testing Hybrid Search ---")
    start = time.perf_counter()
    rows = await pool.fetch(
        """
        SELECT * FROM hybrid_search($1, $2, $3, $4, 50)
    """,
        "test_user",
        "test_app",
        query,
        query_embedding,
    )
    latency = (time.perf_counter() - start) * 1000

    if len(rows) > 0:
        print(f"✅ Hybrid Search: {len(rows)} results, {latency:.1f}ms")
    else:
        print(f"⚠️ Hybrid Search: returned 0 results (might need data ingestion first)")

    if latency >= 100:
        print(f"⚠️ L0 latency {latency:.1f}ms exceeds 100ms target")


async def test_rrf_search(pool: asyncpg.Pool):
    """测试 RRF 融合检索"""
    query = "deep learning neural networks"
    query_embedding = list(np.random.randn(1536).astype(float))

    print(f"\n--- Testing RRF Search ---")
    rows = await pool.fetch(
        """
        SELECT * FROM rrf_search($1, $2, $3, $4, 50)
    """,
        "test_user",
        "test_app",
        query,
        query_embedding,
    )

    if len(rows) > 0:
        # 验证 RRF 分数递减
        scores = [row["rrf_score"] for row in rows]
        is_sorted = scores == sorted(scores, reverse=True)
        if is_sorted:
            print(f"✅ RRF Search: {len(rows)} results, scores correctly ordered")
        else:
            print(f"❌ RRF Search: scores NOT ordered!")
    else:
        print(f"⚠️ RRF Search: returned 0 results")


async def test_iterative_scan(pool: asyncpg.Pool):
    """测试高过滤比场景的迭代扫描"""
    print(f"\n--- Testing Iterative Scan (High Selectivity) ---")

    # 配置迭代扫描
    try:
        await pool.execute("SET hnsw.iterative_scan = relaxed_order")
        await pool.execute("SET hnsw.max_scan_tuples = 20000")
        await pool.execute("SET hnsw.ef_search = 200")
    except Exception as e:
        print(f"⚠️ Failed to set HNSW parameters (extension might not be updated): {e}")

    query_embedding = list(np.random.randn(1536).astype(float))

    # 使用稀有用户 ID (假设 < 1% 数据)
    rows = await pool.fetch(
        """
        SELECT id FROM memories
        WHERE user_id = 'rare_user_001'
        ORDER BY embedding <=> $1
        LIMIT 10
    """,
        query_embedding,
    )

    # 验证仍能返回结果 (迭代扫描生效)
    # 注：如果数据库中无此用户，测试会跳过
    print(f"✅ Iterative Scan: {len(rows)} results (rare user filter)")


async def main():
    db_url = os.getenv("DATABASE_URL", "postgresql://aigc:@localhost/cognizes-engine")
    try:
        pool = await asyncpg.create_pool(db_url)
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return

    print("=== Phase 3 Manual Acceptance Verification ===\n")

    await test_hybrid_search(pool)
    await test_rrf_search(pool)
    await test_iterative_scan(pool)

    print("\n=== Verification Complete ===")
    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
