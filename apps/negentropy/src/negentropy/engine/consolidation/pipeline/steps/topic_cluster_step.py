"""TopicClusterStep — 基于 pgvector 余弦距离的 single-linkage 聚类。

将语义相近的记忆聚类，为每类生成标签写入 metadata_.topics。
使用纯 Python cosine distance 计算，不引入 sklearn 等外部依赖。

理论：
- CLS 理论<sup>[[1]](#ref1)</sup>：慢速皮层巩固将碎片记忆按主题聚合
- Single-linkage 聚类：两个 cluster 在任意两点距离 < ε 时合并

参考文献:
[1] J. L. McClelland et al., "Why there are complementary learning systems
    in the hippocampus and neocortex," *Psychological Review*, 102(3), 1995.
"""

from __future__ import annotations

import math
import re
import time
from collections import defaultdict

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import Memory

from ..protocol import PipelineContext, StepResult
from ..registry import register

logger = get_logger("negentropy.engine.consolidation.pipeline.steps.topic_cluster")


def _cosine_distance(a: list[float], b: list[float]) -> float:
    """计算两个向量的余弦距离 (1 - cosine_similarity)。"""
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 1.0
    return 1.0 - dot / (na * nb)


def _extract_label(contents: list[str]) -> str:
    """从多条内容中提取共同关键词作为聚类标签。"""
    stop = {
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "can",
        "shall",
        "to",
        "of",
        "in",
        "for",
        "on",
        "with",
        "at",
        "by",
        "from",
        "as",
        "into",
        "through",
        "during",
        "before",
        "after",
        "above",
        "below",
        "between",
        "out",
        "off",
        "over",
        "under",
        "again",
        "further",
        "then",
        "once",
        "and",
        "but",
        "or",
        "nor",
        "not",
        "so",
        "yet",
        "both",
        "either",
        "neither",
        "each",
        "every",
        "all",
        "any",
        "few",
        "more",
        "most",
        "other",
        "some",
        "such",
        "no",
        "only",
        "own",
        "same",
        "than",
        "too",
        "very",
        "just",
        "because",
        "if",
        "when",
        "where",
        "how",
        "what",
        "which",
        "who",
        "whom",
        "this",
        "that",
        "these",
        "those",
        "i",
        "me",
        "my",
        "we",
        "our",
        "you",
        "your",
        "he",
        "him",
        "his",
        "she",
        "her",
        "it",
        "its",
        "they",
        "them",
        "their",
        "user",
        "assistant",
    }
    word_freq: dict[str, int] = defaultdict(int)
    for content in contents:
        words = re.findall(r"[a-zA-Z一-鿿]{2,}", content.lower())
        for w in words:
            if w not in stop:
                word_freq[w] += 1
    if not word_freq:
        return "topic"
    top = sorted(word_freq.items(), key=lambda x: -x[1])[:3]
    return "_".join(w for w, _ in top)


@register("topic_cluster")
class TopicClusterStep:
    name = "topic_cluster"

    async def run(self, ctx: PipelineContext) -> StepResult:
        start = time.perf_counter()

        if not ctx.new_memory_ids:
            return StepResult(step_name=self.name, status="skipped", duration_ms=0, output_count=0)

        # 读取配置
        try:
            from negentropy.config import settings as global_settings

            eps = getattr(global_settings.memory.consolidation, "cluster_eps", 0.15)
        except Exception:
            eps = 0.15

        # 拉取新记忆的 embedding + content
        async with db_session.AsyncSessionLocal() as db:
            stmt = sa.select(Memory.id, Memory.content, Memory.embedding).where(
                Memory.id.in_(ctx.new_memory_ids),
                Memory.embedding.is_not(None),
            )
            rows = (await db.execute(stmt)).all()

        if len(rows) < 2:
            return StepResult(
                step_name=self.name,
                status="success",
                duration_ms=int((time.perf_counter() - start) * 1000),
                output_count=0,
            )

        # 计算 pairwise cosine distance 并做 single-linkage 聚类
        n = len(rows)
        parent = list(range(n))

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a: int, b: int) -> None:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        for i in range(n):
            emb_i = rows[i].embedding
            if emb_i is None:
                continue
            for j in range(i + 1, n):
                emb_j = rows[j].embedding
                if emb_j is None:
                    continue
                dist = _cosine_distance(emb_i, emb_j)
                if dist <= eps:
                    union(i, j)

        # 构建聚类
        clusters: dict[int, list[int]] = defaultdict(list)
        for i in range(n):
            clusters[find(i)].append(i)

        # 生成标签并更新 metadata
        cluster_labels: dict[int, str] = {}
        updated_count = 0
        for root, members in clusters.items():
            if len(members) < 2:
                continue
            contents = [rows[i].content or "" for i in members]
            label = _extract_label(contents)
            cluster_labels[root] = label
            ctx.topics.append({"label": label, "memory_count": len(members)})

            # 更新每条记忆的 metadata_.topics
            member_ids = [rows[i].id for i in members]
            async with db_session.AsyncSessionLocal() as db:
                for mid in member_ids:
                    stmt = (
                        sa.update(Memory)
                        .where(Memory.id == mid)
                        .values(
                            metadata_=sa.func.jsonb_set(
                                sa.func.coalesce(Memory.metadata_, sa.text("'{}'::jsonb")),
                                "{topics}",
                                sa.func.coalesce(
                                    sa.func.jsonb_path_query_array(
                                        sa.func.coalesce(Memory.metadata_, sa.text("'{}'::jsonb")),
                                        sa.text("'$.topics'"),
                                    ),
                                    sa.text("'[]'::jsonb"),
                                ).op("||")(sa.text(f"'[\"{label}\"]'::jsonb")),
                            )
                        )
                    )
                    await db.execute(stmt)
                await db.commit()
            updated_count += len(member_ids)

        duration_ms = int((time.perf_counter() - start) * 1000)
        return StepResult(
            step_name=self.name,
            status="success",
            duration_ms=duration_ms,
            output_count=updated_count,
            extra={"clusters": len(cluster_labels), "labels": list(cluster_labels.values())},
        )


__all__ = ["TopicClusterStep"]
