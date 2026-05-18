"""
Reranker Precision Benchmark (Synthetic).

Verifies the CrossEncoder Reranker's ability to boost precision by prioritizing
relevant documents over noise, using synthetic data.

This validates P3-2-8 (Precision@10 Improvement) without requiring a manually labeled dataset.
"""

import asyncio
import random
import logging
from typing import List, Dict, Any
from dataclasses import dataclass

from cognizes.engine.perception.reranker import CrossEncoderReranker, RerankedResult

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@dataclass
class BenchmarkCase:
    query: str
    target_keyword: str
    num_relevant: int
    num_noise: int


CASES = [
    BenchmarkCase(query="What is machine learning?", target_keyword="machine learning", num_relevant=5, num_noise=15),
    BenchmarkCase(
        query="How to configure postgres for vector search?", target_keyword="postgres", num_relevant=3, num_noise=17
    ),
]


def generate_synthetic_docs(case: BenchmarkCase) -> List[Dict[str, Any]]:
    """Generate a mix of relevant and noise documents."""
    docs = []

    # Generate relevant docs
    for i in range(case.num_relevant):
        docs.append(
            {
                "id": f"rel_{i}",
                "content": f"This document discusses {case.target_keyword} in depth. Reliable source.",
                "label": 1,  # Relevant
            }
        )

    # Generate noise docs
    noise_topics = ["cooking", "sports", "gardening", "history", "music"]
    for i in range(case.num_noise):
        topic = random.choice(noise_topics)
        docs.append(
            {
                "id": f"noise_{i}",
                "content": f"This is a random document about {topic}. It has nothing to do with technology.",
                "label": 0,  # Irrelevant
            }
        )

    # Shuffle to simulate a poor L0 retrieval
    random.shuffle(docs)
    return docs


def calculate_precision_at_k(results: List[Dict[str, Any]], k: int) -> float:
    """Calculate Precision@K."""
    top_k = results[:k]
    relevant_count = sum(1 for doc in top_k if doc.get("label", 0) == 1)
    return relevant_count / k if k > 0 else 0.0


def benchmark():
    """Run the synthetic benchmark."""
    logger.info("Initializing CrossEncoderReranker (this may download model weights)...")
    try:
        reranker = CrossEncoderReranker()
    except Exception as e:
        logger.error(f"Failed to initialize reranker (likely missing dependencies or network issues): {e}")
        return

    logger.info("Starting Reranker Precision Benchmark...")
    print("\n" + "=" * 80)
    print(f"{'Query':<40} | {'Metric':<15} | {'L0 (Random)':<10} | {'L1 (Reranked)':<10}")
    print("-" * 80)

    total_l0_p10 = 0.0
    total_l1_p10 = 0.0

    for case in CASES:
        docs = generate_synthetic_docs(case)

        # 1. Evaluate "L0" (Simulated by random/shuffled order)
        # Note: In a real scenario, L0 would be BM25/Vector, which is better than random.
        # Here we just want to prove Reranker *can* sort based on relevance.
        l0_p10 = calculate_precision_at_k(docs, k=10)

        # 2. Run Reranker (L1)
        # The reranker expects 'score', but for synthetic input we can omit or set default
        rerank_input = [
            {"id": d["id"], "content": d["content"], "score": 0.0, "metadata": {"label": d["label"]}} for d in docs
        ]

        reranked_results: List[RerankedResult] = reranker.rerank(case.query, rerank_input, top_k=len(docs))

        # Map back to dicts with labels for evaluation
        l1_docs = []
        for r in reranked_results:
            l1_docs.append({"id": r.id, "content": r.content, "label": r.metadata["label"]})

        l1_p10 = calculate_precision_at_k(l1_docs, k=10)

        print(f"{case.query[:38]:<40} | {'P@10':<15} | {l0_p10:<10.2f} | {l1_p10:<10.2f}")

        total_l0_p10 += l0_p10
        total_l1_p10 += l1_p10

    avg_l0 = total_l0_p10 / len(CASES)
    avg_l1 = total_l1_p10 / len(CASES)

    print("-" * 80)
    print(f"{'AVERAGE':<40} | {'P@10':<15} | {avg_l0:<10.2f} | {avg_l1:<10.2f}")
    print("=" * 80 + "\n")

    if avg_l1 > avg_l0:
        logger.info(f"✅ PASSED: Reranker improved average Precision@10 from {avg_l0:.2f} to {avg_l1:.2f}")
    else:
        logger.warning(f"❌ FAILED: Reranker did not improve Precision@10 (L0: {avg_l0:.2f}, L1: {avg_l1:.2f})")


if __name__ == "__main__":
    benchmark()
