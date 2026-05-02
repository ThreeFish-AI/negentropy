"""
子图上下文构建 (Graph Context Builder)

从种子实体出发，通过 BFS 扩展提取结构化子图，格式化为 LLM 可消费的上下文文本。
支持 Token 预算感知截断，确保上下文在 LLM 窗口内。

工程参考:
  - Microsoft GraphRAG: Local Search 实体邻域子图格式化
  - cognee: 知识片段 (Knowledge Fragments) 格式化
  - LightRAG: 双层图上下文

参考文献:
  [1] Y. Sun et al., "PullNet: Open domain question answering with
      iterative retrieval on knowledge bases," *ACL*, 2019.
  [2] T. Dettmers et al., "Are LLMs good knowledge graph reasoners?"
      *EMNLP*, 2023.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from negentropy.logging import get_logger

logger = get_logger(__name__.rsplit(".", 1)[0])

# 粗略估算：每个三元组约 30 tokens，每个实体约 20 tokens
TOKENS_PER_TRIPLE = 30
TOKENS_PER_ENTITY = 20


@dataclass(frozen=True)
class GraphContext:
    """结构化子图上下文"""

    triples: list[dict]  # [{subject, predicate, object, evidence}]
    entity_summaries: list[dict]  # [{name, type, importance}]
    community_context: str | None = None
    formatted_text: str = ""
    token_estimate: int = 0


class GraphContextBuilder:
    """子图上下文构建器 (Sun et al., PullNet, ACL 2019)

    从种子实体出发，通过 BFS 扩展提取子图，格式化为结构化文本。
    """

    def __init__(
        self,
        *,
        max_tokens: int = 4000,
        max_hops: int = 2,
        max_entities: int = 20,
    ) -> None:
        self._max_tokens = max_tokens
        self._max_hops = max_hops
        self._max_entities = max_entities

    async def build_context(
        self,
        seed_entities: list[dict],
        neighbor_fn: Any,  # Callable: (entity_id, corpus_id, depth, limit) → list[dict]
        corpus_id: Any,
    ) -> GraphContext:
        """构建子图上下文

        Args:
            seed_entities: 种子实体列表 [{id, name, type, score}]
            neighbor_fn: 异步回调，获取邻居实体和关系
            corpus_id: 语料库 ID

        Returns:
            GraphContext 包含格式化文本和元数据
        """
        if not seed_entities:
            return GraphContext(triples=[], entity_summaries=[])

        # 1. BFS 子图扩展
        visited_entities: dict[str, dict] = {}
        all_triples: list[dict] = []

        for seed in seed_entities[:10]:  # 限制种子数
            seed_id = seed.get("id", "")
            if seed_id:
                visited_entities[seed_id] = seed

        for _hop in range(self._max_hops):
            frontier = [eid for eid in visited_entities if not visited_entities[eid].get("_expanded")]
            if not frontier:
                break

            for entity_id in frontier[: self._max_entities]:
                visited_entities[entity_id]["_expanded"] = True

                if neighbor_fn is None:
                    continue

                try:
                    neighbors = await neighbor_fn(entity_id, corpus_id, 1, 5)
                except Exception:
                    continue

                for nb in neighbors:
                    nb_id = nb.get("id", "")
                    if nb_id and nb_id not in visited_entities:
                        visited_entities[nb_id] = {
                            "id": nb_id,
                            "name": nb.get("name", ""),
                            "type": nb.get("type", ""),
                        }
                    if nb.get("relation"):
                        all_triples.append(
                            {
                                "subject": visited_entities.get(entity_id, {}).get("name", entity_id),
                                "predicate": nb["relation"],
                                "object": nb.get("name", ""),
                                "evidence": nb.get("evidence", ""),
                            }
                        )

        # 2. 清理扩展标记
        for e in visited_entities.values():
            e.pop("_expanded", None)

        # 3. Token 预算截断
        entities_list = list(visited_entities.values())[: self._max_entities]
        triples_list = self._truncate_triples(all_triples)

        # 4. 格式化
        formatted = self._format_context(entities_list, triples_list)

        return GraphContext(
            triples=triples_list,
            entity_summaries=[
                {"name": e.get("name", ""), "type": e.get("type", ""), "importance": 0.5} for e in entities_list
            ],
            formatted_text=formatted,
            token_estimate=self._estimate_tokens(entities_list, triples_list),
        )

    def _truncate_triples(self, triples: list[dict]) -> list[dict]:
        """按 Token 预算截断三元组列表"""
        budget = self._max_tokens - 200  # 留出头部和实体摘要空间
        result = []
        used = 0

        for triple in triples:
            cost = TOKENS_PER_TRIPLE
            if used + cost > budget:
                break
            result.append(triple)
            used += cost

        return result

    def _format_context(
        self,
        entities: list[dict],
        triples: list[dict],
    ) -> str:
        """格式化为结构化文本"""
        parts = ["## Knowledge Graph Context"]

        if entities:
            parts.append("\n### Entities")
            for e in entities[:15]:
                name = e.get("name", "Unknown")
                etype = e.get("type", "unknown")
                parts.append(f"- {name} ({etype})")

        if triples:
            parts.append("\n### Relationships")
            for t in triples[:20]:
                subj = t.get("subject", "?")
                pred = t.get("predicate", "RELATED_TO")
                obj = t.get("object", "?")
                evidence = t.get("evidence", "")
                line = f"- {subj} --{pred}--> {obj}"
                if evidence:
                    line += f' [evidence: "{evidence[:80]}"]'
                parts.append(line)

        return "\n".join(parts)

    def _estimate_tokens(self, entities: list[dict], triples: list[dict]) -> int:
        return len(entities) * TOKENS_PER_ENTITY + len(triples) * TOKENS_PER_TRIPLE
