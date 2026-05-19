#!/usr/bin/env python3
"""
Index Warmup Utility for Knowledge Base (P3-5-5).

Consolidates index warming strategies:
1. Pipeline Mode: Full RAG pipeline processing (Chunking -> Embedding -> Vector DB).
2. Direct Mode: High-throughput direct database injection (for performance testing).

Usage:
    # Full Pipeline Mode (Simulate real ingestion)
    python3 src/cognizes/engine/perception/index_warmup.py --mode pipeline --count 100

    # Direct DB Mode (Fast generation for benchmarks)
    python3 src/cognizes/engine/perception/index_warmup.py --mode direct --count 100000
"""

import argparse
import asyncio
import logging
import random
import string
import sys
import time
import uuid
from pathlib import Path
from typing import List, Dict, Any
import numpy as np

# Add src to path if running mostly as script
current_file = Path(__file__).resolve()
project_root = current_file.parents[4]  # src/cognizes/engine/perception/index_warmup.py -> project_root
if str(project_root) not in sys.path:
    sys.path.append(str(project_root / "src"))

from cognizes.core.database import DatabaseManager
from cognizes.engine.perception.rag_pipeline import get_rag_pipeline

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ==========================================
# Shared Utilities
# ==========================================


def generate_random_text(min_length: int = 100, max_length: int = 500) -> str:
    """Generate random text content."""
    length = random.randint(min_length, max_length)
    words = []
    for _ in range(length // 5):
        word = "".join(random.choices(string.ascii_lowercase, k=random.randint(3, 10)))
        words.append(word)
    return " ".join(words)


def generate_metadata(idx: int, batch_idx: int) -> Dict[str, Any]:
    """Generate rich metadata for testing complex predicates."""
    return {
        "index": idx,
        "batch": batch_idx,
        "priority": random.randint(1, 5),
        "tags": random.sample(["research", "note", "task", "meeting", "important"], k=random.randint(1, 3)),
        "author": {"role": random.choice(["user", "admin", "expert"])},
        "status": random.choice(["draft", "published", "archived"]),
        "access_level": random.randint(1, 5),
    }


# ==========================================
# Pipeline Mode (from warmup_index.py)
# ==========================================


async def run_pipeline_mode(args):
    """Run ingestion via RAG Pipeline."""
    logger.info(f"🚀 Starting Pipeline Mode: {args.count} docs, batch {args.batch_size}")

    # Initialize DB
    try:
        db = DatabaseManager.get_instance(dsn=args.db_url)
        pool = await db.get_pool()
        logger.info("Database connected")
    except Exception as e:
        logger.warning(f"Database connection failed: {e}. Running in MOCK mode (no storage).")
        pool = None

    pipeline = get_rag_pipeline(db_pool=pool, embedding_provider=args.provider, app_name="warmup_script")

    async def ingest_batch(batch_id: int, count: int) -> int:
        tasks = []
        for i in range(count):
            global_idx = batch_id * args.batch_size + i
            doc_content = f"# Synthetic Document {global_idx}\n\n" + generate_random_text()
            source_uri = f"synthetic/{batch_id}/{i}.md"
            tasks.append(
                pipeline.index_document(
                    content=doc_content, source_uri=source_uri, metadata=generate_metadata(global_idx, batch_id)
                )
            )

        start = time.perf_counter()
        results = await asyncio.gather(*tasks)
        duration = time.perf_counter() - start

        total_tokens = sum(r.total_tokens for r in results)
        logger.debug(f"Batch {batch_id} completed: {count} docs, {total_tokens} tokens in {duration:.2f}s")
        return count

    start_total = time.perf_counter()
    total_batches = (args.count + args.batch_size - 1) // args.batch_size
    semaphore = asyncio.Semaphore(args.concurrency)

    async def limited_batch(batch_idx):
        async with semaphore:
            count = min(args.batch_size, args.count - batch_idx * args.batch_size)
            return await ingest_batch(batch_idx, count)

    tasks = [limited_batch(i) for i in range(total_batches)]

    completed_docs = 0
    for f in asyncio.as_completed(tasks):
        completed_docs += await f
        if completed_docs % (args.batch_size * 2) == 0:  # Log every few batches
            logger.info(f"Progress: {completed_docs}/{args.count} docs")

    total_duration = time.perf_counter() - start_total
    qps = args.count / total_duration if total_duration > 0 else 0

    logger.info(f"✅ Pipeline Warmup Completed!")
    logger.info(f"Total Time: {total_duration:.2f}s | Throughput: {qps:.2f} docs/sec")

    if pool:
        await pool.close()


# ==========================================
# Direct Mode (from generate_test_data.py)
# ==========================================


async def run_direct_mode(args):
    """Run direct SQL injection for high throughput."""
    logger.info(f"🚀 Starting Direct Mode: {args.count} records")

    import asyncpg

    # Direct DB connection for speed (skipping DatabaseManager singleton overhead if preferred,
    # but using it for consistency is fine. Here we stick to asyncpg pool for raw speed control)
    pool = await asyncpg.create_pool(args.db_url)

    rare_user_ratio = 0.01
    rare_user_id = "rare_user_001"
    common_users = [f"common_user_{i:04d}" for i in range(100)]

    start_time = time.time()

    batch_size = args.batch_size
    # Adjust batch size for direct mode if it's too small
    if batch_size < 1000:
        batch_size = 5000
        logger.info(f"Adjusted batch size to {batch_size} for direct mode efficiency")

    total_records = args.count

    for batch_idx, batch_start in enumerate(range(0, total_records, batch_size)):
        batch_end = min(batch_start + batch_size, total_records)
        records = []

        for i in range(batch_start, batch_end):
            if random.random() < rare_user_ratio:
                user_id = rare_user_id
            else:
                user_id = random.choice(common_users)

            # Generate random embedding (default 1536 dims for generic testing unless specified)
            # In direct mode we just generate random noise to fill valid vectors
            embedding = np.random.randn(1536).astype(np.float32).tolist()

            records.append(
                (
                    str(uuid.uuid4()),
                    user_id,
                    "warmup_script",
                    f"Direct content {i}. " + generate_random_text(50, 100),
                    embedding,
                    generate_metadata(i, batch_idx),
                )
            )

        await pool.executemany(
            """
            INSERT INTO memories (id, user_id, app_name, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            records,
        )

        # Progress
        progress = batch_end / total_records * 100
        elapsed = time.time() - start_time
        rate = batch_end / elapsed if elapsed > 0 else 0
        eta = (total_records - batch_end) / rate if rate > 0 else 0

        sys.stdout.write(f"\r   ⏳ Progress: {progress:5.1f}% | Rate: {rate:,.0f}/s | ETA: {eta:.0f}s")
        sys.stdout.flush()

    print()  # Newline
    elapsed = time.time() - start_time
    logger.info(f"✅ Direct Injection Completed! Total: {elapsed:.1f}s")

    await pool.close()


# ==========================================
# Main Entry Point
# ==========================================


async def main():
    parser = argparse.ArgumentParser(description="Index Warmup & Test Data Generator")

    # Common Args
    parser.add_argument(
        "--mode",
        choices=["pipeline", "direct"],
        default="pipeline",
        help="Mode: 'pipeline' (Full RAG) or 'direct' (SQL Injection)",
    )
    parser.add_argument("--count", type=int, default=1000, help="Total documents to generate")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size")
    parser.add_argument("--db-url", default="postgresql://aigc:@localhost/cognizes-engine", help="Database URL")
    parser.add_argument("--clean", action="store_true", help="Clean existing data before running")

    # Pipeline Args
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrency for pipeline mode")
    parser.add_argument("--provider", default="mock", help="Embedding provider for pipeline mode (mock/openai/gemini)")

    args = parser.parse_args()

    # Clean Logic
    if args.clean:
        logger.info("🗑️ Cleaning existing data for app 'warmup_script'...")
        db = DatabaseManager.get_instance(dsn=args.db_url)
        pool = await db.get_pool()
        await pool.execute("DELETE FROM memories WHERE app_name = 'warmup_script'")
        if args.mode == "direct":
            await pool.close()  # Close to release for direct connection if needed, though they are pooling.

    if args.mode == "pipeline":
        await run_pipeline_mode(args)
    else:
        await run_direct_mode(args)


if __name__ == "__main__":
    asyncio.run(main())
