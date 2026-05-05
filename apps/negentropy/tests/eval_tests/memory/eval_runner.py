"""Memory Eval Runner — LoCoMo/LongMemEval 迷你评测脚本

设计目标：
1. 在不依赖外部 LLM API 的情况下提供检索质量基线（评测自身的"召回-排序"能力）
2. 计算 MRR@10 / NDCG@10 / Hit@K / F1（事实子串）
3. 输出 markdown 报告至 ``.temp/eval/<timestamp>.md``

工作原理：
- 加载 dataset → 为每条 sample 把 memories 灌进一个内存中的 BM25-like 索引
  （不连真实 PostgreSQL，便于本地/CI 快速跑）
- 对每条 question 做检索，找到包含 ``expected_answer_substrings`` 的 memories
  作为正样本（gold）
- 用 BM25 + token overlap 启发式排序，计算上述指标

Note: 这是"独立基线"——不调用 PostgresMemoryService，避免引入数据库
依赖；用于度量算法层面（语料 + query 的检索难度），可与未来真实 DB
评测产出做对比。

理论基础（IEEE）:
[1] A. Maharana et al., "Evaluating very long-term conversational memory of LLM agents," ACL 2024.
[2] D. Wu et al., "LongMemEval: Benchmarking chat assistants on long-term memory," arXiv:2410.10813, 2024.
[3] T. Chhikara et al., "Mem0: Building production-ready AI agents...,"
    arXiv:2504.19413, 2025.
"""

from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

DATASETS_DIR = Path(__file__).parent / "datasets"
DEFAULT_K = 10


def tokenize(text: str) -> list[str]:
    """简单 tokenizer：lower + alnum 切分。"""
    return re.findall(r"[a-z0-9]+", text.lower())


@dataclass
class BM25Index:
    """轻量 BM25 索引（k1=1.5, b=0.75，标准参数）。"""

    docs: list[str] = field(default_factory=list)
    doc_tokens: list[list[str]] = field(default_factory=list)
    df: Counter = field(default_factory=Counter)
    avg_dl: float = 0.0

    @classmethod
    def build(cls, docs: list[str]) -> BM25Index:
        idx = cls(docs=list(docs))
        for d in docs:
            toks = tokenize(d)
            idx.doc_tokens.append(toks)
            for t in set(toks):
                idx.df[t] += 1
        if idx.doc_tokens:
            idx.avg_dl = sum(len(t) for t in idx.doc_tokens) / len(idx.doc_tokens)
        return idx

    def score(self, query: str, k1: float = 1.5, b: float = 0.75) -> list[tuple[int, float]]:
        if not self.doc_tokens:
            return []
        q_tokens = tokenize(query)
        n = len(self.docs)
        results: list[tuple[int, float]] = []
        for i, d_toks in enumerate(self.doc_tokens):
            if not d_toks:
                continue
            dl = len(d_toks)
            tf = Counter(d_toks)
            score = 0.0
            for t in q_tokens:
                if t not in tf:
                    continue
                f = tf[t]
                df_t = self.df.get(t, 1)
                idf = math.log(1.0 + (n - df_t + 0.5) / (df_t + 0.5))
                num = f * (k1 + 1)
                denom = f + k1 * (1 - b + b * dl / max(self.avg_dl, 1.0))
                score += idf * (num / max(denom, 1e-9))
            results.append((i, score))
        results.sort(key=lambda x: x[1], reverse=True)
        return results


@dataclass
class EvalSample:
    sample_id: str
    session_id: str
    memories: list[str]
    question: str
    expected: list[str]  # lower-cased substrings
    task_type: str = "default"


def load_dataset(path: Path) -> list[EvalSample]:
    samples: list[EvalSample] = []
    if not path.exists():
        return samples
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            mems = obj.get("memories", [])
            mem_texts: list[str] = []
            for m in mems:
                if isinstance(m, dict):
                    mem_texts.append(m.get("text") or "")
                else:
                    mem_texts.append(str(m))
            samples.append(
                EvalSample(
                    sample_id=obj["sample_id"],
                    session_id=obj.get("session_id", obj["sample_id"]),
                    memories=[t for t in mem_texts if t],
                    question=obj["question"],
                    expected=[s.lower() for s in obj.get("expected_answer_substrings", [])],
                    task_type=obj.get("task_type", "default"),
                )
            )
    return samples


def find_gold_indices(memories: list[str], expected: list[str]) -> set[int]:
    """以 expected substrings 在哪条 memory 出现作为 gold 标签。"""
    gold: set[int] = set()
    for i, m in enumerate(memories):
        m_lower = m.lower()
        for sub in expected:
            if sub and sub in m_lower:
                gold.add(i)
                break
    return gold


def metrics_for_sample(ranked: list[tuple[int, float]], gold: set[int], k: int = DEFAULT_K) -> dict[str, float]:
    """单 sample 的 MRR / NDCG / Hit@k / Recall@k。"""
    if not gold:
        return {"mrr": 0.0, "ndcg": 0.0, "hit": 0.0, "recall": 0.0}
    # MRR
    mrr = 0.0
    for rank, (idx, _) in enumerate(ranked[:k], start=1):
        if idx in gold:
            mrr = 1.0 / rank
            break
    # NDCG
    dcg = 0.0
    for rank, (idx, _) in enumerate(ranked[:k], start=1):
        if idx in gold:
            dcg += 1.0 / math.log2(rank + 1)
    ideal_dcg = sum(1.0 / math.log2(r + 1) for r in range(1, min(len(gold), k) + 1))
    ndcg = dcg / ideal_dcg if ideal_dcg > 0 else 0.0
    # Hit@k & Recall@k
    top_ids = {idx for idx, _ in ranked[:k]}
    hit = 1.0 if top_ids & gold else 0.0
    recall = len(top_ids & gold) / len(gold) if gold else 0.0
    return {"mrr": mrr, "ndcg": ndcg, "hit": hit, "recall": recall}


def f1_substring(top_doc: str, expected: list[str]) -> dict[str, float]:
    """事实级 F1：基于 token 重叠（top1 检索结果 vs 期望关键词）。"""
    pred_tokens = set(tokenize(top_doc))
    exp_tokens: set[str] = set()
    for e in expected:
        exp_tokens.update(tokenize(e))
    if not exp_tokens or not pred_tokens:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}
    overlap = pred_tokens & exp_tokens
    precision = len(overlap) / len(pred_tokens)
    recall = len(overlap) / len(exp_tokens)
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    return {"precision": precision, "recall": recall, "f1": f1}


@dataclass
class DatasetMetrics:
    name: str
    sample_count: int
    mrr_at_k: float
    ndcg_at_k: float
    hit_at_k: float
    recall_at_k: float
    f1: float
    by_task: dict[str, dict[str, float]] = field(default_factory=dict)

    def to_markdown_row(self) -> str:
        return (
            f"| {self.name} | {self.sample_count} | {self.mrr_at_k:.3f} | "
            f"{self.ndcg_at_k:.3f} | {self.hit_at_k:.3f} | {self.recall_at_k:.3f} | {self.f1:.3f} |"
        )


def run_dataset(name: str, path: Path, k: int = DEFAULT_K) -> DatasetMetrics:
    samples = load_dataset(path)
    if not samples:
        return DatasetMetrics(
            name=name, sample_count=0, mrr_at_k=0.0, ndcg_at_k=0.0, hit_at_k=0.0, recall_at_k=0.0, f1=0.0
        )

    aggr_mrr = aggr_ndcg = aggr_hit = aggr_recall = aggr_f1 = 0.0
    by_task_acc: dict[str, list[dict[str, float]]] = defaultdict(list)

    for s in samples:
        idx = BM25Index.build(s.memories)
        gold = find_gold_indices(s.memories, s.expected)
        ranked = idx.score(s.question)
        m = metrics_for_sample(ranked, gold, k=k)
        f1 = f1_substring(s.memories[ranked[0][0]] if ranked else "", s.expected)["f1"] if ranked else 0.0
        aggr_mrr += m["mrr"]
        aggr_ndcg += m["ndcg"]
        aggr_hit += m["hit"]
        aggr_recall += m["recall"]
        aggr_f1 += f1
        by_task_acc[s.task_type].append({**m, "f1": f1})

    n = len(samples)
    by_task: dict[str, dict[str, float]] = {}
    for task, vals in by_task_acc.items():
        cnt = len(vals)
        by_task[task] = {
            "n": cnt,
            "mrr": sum(v["mrr"] for v in vals) / cnt,
            "ndcg": sum(v["ndcg"] for v in vals) / cnt,
            "hit": sum(v["hit"] for v in vals) / cnt,
            "f1": sum(v["f1"] for v in vals) / cnt,
        }

    return DatasetMetrics(
        name=name,
        sample_count=n,
        mrr_at_k=aggr_mrr / n,
        ndcg_at_k=aggr_ndcg / n,
        hit_at_k=aggr_hit / n,
        recall_at_k=aggr_recall / n,
        f1=aggr_f1 / n,
        by_task=by_task,
    )


def render_report(results: list[DatasetMetrics], k: int = DEFAULT_K) -> str:
    """Markdown 报告。"""
    lines: list[str] = []
    lines.append("# Memory Retrieval Eval — Baseline Report\n")
    lines.append(f"> 评测算法：BM25 (k1=1.5, b=0.75)；K = {k}\n")
    lines.append(
        "> 度量定义：MRR@K = 平均互倒名次；NDCG@K = 标准化折扣累积增益；"
        "Hit@K = 至少命中一个 gold；Recall@K = 命中 gold 比例；F1 = top-1 与期望关键词的 token-level F1。\n"
    )
    lines.append("\n## 总体结果\n")
    lines.append("| Dataset | N | MRR@K | NDCG@K | Hit@K | Recall@K | F1 |")
    lines.append("|---|---|---|---|---|---|---|")
    for r in results:
        lines.append(r.to_markdown_row())

    for r in results:
        if not r.by_task:
            continue
        lines.append(f"\n## 按任务类型分解（{r.name}）\n")
        lines.append("| Task | N | MRR@K | NDCG@K | Hit@K | F1 |")
        lines.append("|---|---|---|---|---|---|")
        for task, vals in sorted(r.by_task.items()):
            lines.append(
                f"| {task} | {vals['n']} | {vals['mrr']:.3f} | {vals['ndcg']:.3f} | "
                f"{vals['hit']:.3f} | {vals['f1']:.3f} |"
            )

    lines.append("\n## 解读建议\n")
    lines.append(
        "- 这是 BM25 单算法 baseline；Phase 4 后续将与 PostgresMemoryService\n"
        "  的 Hybrid (BM25 + pgvector + Query-Aware) 结果做对比，理想情况下\n"
        "  Hybrid 应在 NDCG@K / F1 上有 5%+ 提升。\n"
        "- 任务分解中，`temporal_reasoning` / `knowledge_update` 通常分数低于\n"
        "  `single_session_user`，反映纯检索难以解决"
        "时序更新冲突——这是 Phase 3 冲突消解 + Phase 4 Self-editing Tools 的目标场景。\n"
    )
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    import argparse
    from datetime import datetime

    parser = argparse.ArgumentParser(description="Memory Eval Runner")
    parser.add_argument("--k", type=int, default=DEFAULT_K)
    parser.add_argument(
        "--out",
        type=str,
        default=None,
        help="输出报告路径，默认 .temp/eval/baseline_<timestamp>.md（相对仓库根）",
    )
    args = parser.parse_args(argv)

    datasets = [
        ("LoCoMo-mini", DATASETS_DIR / "locomo_mini.jsonl"),
        ("LongMemEval-mini", DATASETS_DIR / "longmemeval_mini.jsonl"),
    ]
    results = [run_dataset(name, path, k=args.k) for name, path in datasets]
    report = render_report(results, k=args.k)

    out_path: Path
    if args.out:
        out_path = Path(args.out)
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        repo_root = Path(__file__).resolve().parents[5]
        out_path = repo_root / ".temp" / "eval" / f"baseline_{ts}.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(report, encoding="utf-8")
    print(f"Report written: {out_path}")
    print(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
