"""
GraphContextBuilder 单元测试

验证子图上下文构建的核心逻辑：
  - BFS 子图扩展
  - Token 预算截断
  - 上下文格式化
"""

from __future__ import annotations

from negentropy.knowledge.graph.context_builder import (
    TOKENS_PER_ENTITY,
    TOKENS_PER_TRIPLE,
    GraphContextBuilder,
)


def _seed(name: str = "OpenAI", entity_id: str = "e1") -> dict:
    return {"id": entity_id, "name": name, "type": "organization", "score": 0.9}


class TestGraphContextBuilder:
    async def test_empty_seeds(self):
        builder = GraphContextBuilder()
        ctx = await builder.build_context([], neighbor_fn=None, corpus_id=None)
        assert ctx.triples == []
        assert ctx.formatted_text == ""

    async def test_single_seed_no_neighbors(self):
        builder = GraphContextBuilder()
        ctx = await builder.build_context([_seed()], neighbor_fn=None, corpus_id=None)
        assert len(ctx.entity_summaries) == 1
        assert "OpenAI" in ctx.formatted_text

    async def test_bfs_expansion(self):
        builder = GraphContextBuilder(max_hops=1)

        async def fake_neighbor(entity_id, corpus_id, depth, limit):
            if entity_id == "e1":
                return [
                    {
                        "id": "e2",
                        "name": "GPT-4",
                        "type": "product",
                        "relation": "CREATED_BY",
                        "evidence": "OpenAI made GPT-4",
                    },
                ]
            return []

        ctx = await builder.build_context([_seed()], neighbor_fn=fake_neighbor, corpus_id=None)
        assert len(ctx.entity_summaries) == 2
        assert len(ctx.triples) == 1
        assert "CREATED_BY" in ctx.formatted_text

    async def test_token_budget_truncation(self):
        builder = GraphContextBuilder(max_tokens=200)  # 很小的预算

        # 创建超过预算的三元组
        large_triples = [
            {"subject": f"Entity{i}", "predicate": "RELATED_TO", "object": f"Entity{i + 1}", "evidence": ""}
            for i in range(50)
        ]

        result = builder._truncate_triples(large_triples)
        # 应被截断到远少于 50 个
        assert len(result) < 50

    async def test_format_includes_sections(self):
        builder = GraphContextBuilder()

        entities = [{"name": "OpenAI", "type": "org"}]
        triples = [{"subject": "OpenAI", "predicate": "MADE", "object": "GPT-4", "evidence": "created in 2023"}]

        formatted = builder._format_context(entities, triples)
        assert "## Knowledge Graph Context" in formatted
        assert "### Entities" in formatted
        assert "### Relationships" in formatted
        assert "OpenAI" in formatted
        assert "MADE" in formatted

    async def test_neighbor_error_graceful(self):
        builder = GraphContextBuilder()

        async def failing_neighbor(**kwargs):
            raise ConnectionError("DB down")

        ctx = await builder.build_context([_seed()], neighbor_fn=failing_neighbor, corpus_id=None)
        # 出错时应保留种子实体
        assert len(ctx.entity_summaries) >= 1

    async def test_token_estimate(self):
        builder = GraphContextBuilder()
        entities = [{"name": "A", "type": "x"}]
        triples = [{"subject": "A", "predicate": "R", "object": "B", "evidence": ""}]

        estimate = builder._estimate_tokens(entities, triples)
        assert estimate == TOKENS_PER_ENTITY + TOKENS_PER_TRIPLE
