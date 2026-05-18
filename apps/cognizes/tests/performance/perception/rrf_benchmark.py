"""
RRF (Reciprocal Rank Fusion) Performance Benchmark.

Compares SQL-native RRF search against Python-side fusion to evaluate
the benefits of data locality and database-level optimization.

Usage:
    uv run python tests/performance/perception/rrf_benchmark.py
"""

import asyncio
import time
import numpy as np
import logging
from typing import List

from cognizes.core.database import DatabaseManager
from cognizes.engine.perception.rrf_fusion import SearchResult, rrf_fusion

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


async def benchmark(iterations: int = 20):
    """
    Runs the benchmark comparing SQL-native vs Python-side RRF.
    """
    db = DatabaseManager.get_instance()
    pool = await db.get_pool()

    query = "machine learning"
    user_id = "test_user"
    app_name = "test_app"

    # Generate a random embedding (1536 dims)
    embedding = np.random.randn(1536).astype(float).tolist()
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    logger.info(f"Starting RRF Performance Benchmark (Iterations: {iterations})...")

    # 1. SQL-Native RRF (Fusion happens inside the DB)
    sql_latencies = []
    logger.info("Running SQL-Native RRF...")
    for _ in range(iterations):
        start = time.perf_counter()
        await pool.fetch(
            "SELECT * FROM rrf_search($1, $2, $3, $4::vector, 50)", user_id, app_name, query, embedding_str
        )
        sql_latencies.append((time.perf_counter() - start) * 1000)
    avg_sql = sum(sql_latencies) / iterations

    # 2. Python-Side RRF (Recall from DB, Fusion in Python)
    py_latencies = []
    logger.info("Running Python-Side RRF...")
    for _ in range(iterations):
        start = time.perf_counter()

        # Semantic Recall
        semantic_rows = await pool.fetch(
            "SELECT id, content, (1 - (embedding <=> $1::vector)) as score FROM memories WHERE user_id=$2 LIMIT 50",
            embedding_str,
            user_id,
        )

        # Keyword Recall
        keyword_rows = await pool.fetch(
            "SELECT id, content, ts_rank_cd(search_vector, plainto_tsquery($1)) as score FROM memories WHERE user_id=$2 LIMIT 50",
            query,
            user_id,
        )

        # Fusion Logic in Python
        list_s = [SearchResult(id=str(r["id"]), content=r["content"], score=r["score"]) for r in semantic_rows]
        list_k = [SearchResult(id=str(r["id"]), content=r["content"], score=r["score"]) for r in keyword_rows]
        rrf_fusion([list_s, list_k], limit=50)

        py_latencies.append((time.perf_counter() - start) * 1000)
    avg_py = sum(py_latencies) / iterations

    # Output Results
    print("\n" + "=" * 50)
    print(f"{'Method':<25} | {'Avg Latency (ms)':<20}")
    print("-" * 50)
    print(f"{'SQL-Native RRF':<25} | {avg_sql:15.2f} ms")
    print(f"{'Python-Side RRF':<25} | {avg_py:15.2f} ms")
    print("-" * 50)
    print(f"{'Speedup Ratio':<25} | {avg_py / avg_sql:15.2f}x")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    try:
        asyncio.run(benchmark())
    except Exception as e:
        logger.error(f"Benchmark failed: {e}")
