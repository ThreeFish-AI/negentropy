"""Memory Eval Runner — 单元/集成测试

标记 ``@pytest.mark.eval``，默认不跑（需 ``-m eval`` 显式触发）。
但保留两个轻量 sanity 测试默认跑，确保数据集与算法骨架不退化。
"""

from __future__ import annotations

import pytest

from tests.eval_tests.memory.eval_runner import (
    DATASETS_DIR,
    BM25Index,
    find_gold_indices,
    load_dataset,
    metrics_for_sample,
    run_dataset,
    tokenize,
)


def test_tokenize_lowercases_and_splits() -> None:
    assert tokenize("Hello, World 123!") == ["hello", "world", "123"]


def test_bm25_index_returns_ranked_results() -> None:
    docs = [
        "I work as a backend engineer using Postgres",
        "My dog Max loves dinosaurs and walks",
        "I drink coffee black no sugar",
    ]
    idx = BM25Index.build(docs)
    ranked = idx.score("Postgres backend")
    assert ranked, "BM25 must return non-empty ranking"
    assert ranked[0][0] == 0, "Top hit should be the doc about Postgres backend"


def test_load_locomo_mini_has_30_samples() -> None:
    path = DATASETS_DIR / "locomo_mini.jsonl"
    samples = load_dataset(path)
    assert len(samples) == 30, "LoCoMo mini must keep 30 samples"
    assert all(s.expected for s in samples), "Every sample must have expected substrings"
    assert all(s.memories for s in samples), "Every sample must have memories"


def test_load_longmemeval_mini_has_30_samples() -> None:
    path = DATASETS_DIR / "longmemeval_mini.jsonl"
    samples = load_dataset(path)
    assert len(samples) == 30
    task_types = {s.task_type for s in samples}
    # LongMemEval 应包含至少 3 类任务（保证多样性）
    assert len(task_types) >= 3, f"Expected diverse task types, got {task_types}"


def test_find_gold_indices_simple() -> None:
    mems = ["I love peanut butter", "Random other memory", "Never had nuts before"]
    expected = ["peanut"]
    gold = find_gold_indices(mems, expected)
    assert gold == {0}


def test_metrics_for_sample_perfect_match() -> None:
    # gold=[0]，rank 第一即命中
    ranked = [(0, 1.0), (1, 0.5)]
    m = metrics_for_sample(ranked, gold={0}, k=10)
    assert m["mrr"] == 1.0
    assert m["hit"] == 1.0
    assert m["recall"] == 1.0


def test_metrics_for_sample_no_match() -> None:
    ranked = [(0, 1.0), (1, 0.5)]
    m = metrics_for_sample(ranked, gold={5}, k=10)
    assert m["mrr"] == 0.0
    assert m["hit"] == 0.0


@pytest.mark.eval
def test_run_full_baseline_locomo() -> None:
    """Full baseline run — only invoked under ``pytest -m eval``."""
    result = run_dataset("LoCoMo-mini", DATASETS_DIR / "locomo_mini.jsonl")
    assert result.sample_count == 30
    # BM25 baseline 应当有合理的 MRR（业界水准 > 0.4）
    assert result.mrr_at_k > 0.3, f"BM25 baseline too weak: MRR@10={result.mrr_at_k}"
    assert result.hit_at_k > 0.5


@pytest.mark.eval
def test_run_full_baseline_longmemeval() -> None:
    result = run_dataset("LongMemEval-mini", DATASETS_DIR / "longmemeval_mini.jsonl")
    assert result.sample_count == 30
    # LongMemEval 包含 knowledge_update 等更难任务，阈值放宽
    assert result.mrr_at_k > 0.25
    # 必须按任务分解
    assert len(result.by_task) >= 3
