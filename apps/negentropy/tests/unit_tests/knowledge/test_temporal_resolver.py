"""
TemporalResolver 单元测试

验证时态事实冲突检测管线的三种分类：
  - REINFORCE: 同一事实重复出现
  - UPDATE: 事实值更新
  - CONTRADICTION: 互斥事实冲突
"""

from __future__ import annotations

from uuid import uuid4

from negentropy.knowledge.graph.temporal_resolver import TemporalResolver


def _make_relation(
    source: str = "entity:1",
    target: str = "entity:2",
    edge_type: str = "WORKS_FOR",
    evidence: str = "John works at OpenAI",
) -> dict:
    return {
        "source": source,
        "target": target,
        "edge_type": edge_type,
        "evidence": evidence,
        "weight": 0.9,
    }


class TestTemporalVerdict:
    async def test_reinforce_same_evidence(self):
        resolver = TemporalResolver()

        async def lookup(source, target, edge_type, corpus_id):
            return [{"id": uuid4(), "evidence_text": "John works at OpenAI", "target_id": "entity:2"}]

        relations = [_make_relation(evidence="John works at OpenAI")]
        results = await resolver.resolve_relations(relations, lookup, corpus_id=uuid4())

        assert len(results) == 1
        assert results[0]["temporal_verdict"] == "reinforce"
        assert results[0]["expire_ids"] == []

    async def test_update_different_evidence(self):
        resolver = TemporalResolver()

        async def lookup(source, target, edge_type, corpus_id):
            return [{"id": uuid4(), "evidence_text": "John works at Google", "target_id": "entity:2"}]

        relations = [_make_relation(evidence="John works at OpenAI")]
        results = await resolver.resolve_relations(relations, lookup, corpus_id=uuid4())

        assert len(results) == 1
        assert results[0]["temporal_verdict"] == "update"
        assert len(results[0]["expire_ids"]) == 1

    async def test_contradiction_mutually_exclusive(self):
        resolver = TemporalResolver()

        async def lookup(source, target, edge_type, corpus_id):
            if target is None:
                # 查找互斥关系
                return [{"id": uuid4(), "target_id": "entity:google", "evidence_text": "old"}]
            return []

        relations = [_make_relation(target="entity:openai", edge_type="WORKS_FOR")]
        results = await resolver.resolve_relations(relations, lookup, corpus_id=uuid4())

        assert len(results) == 1
        assert results[0]["temporal_verdict"] == "contradiction"

    async def test_no_existing_relations(self):
        resolver = TemporalResolver()

        async def lookup(source, target, edge_type, corpus_id):
            return []

        relations = [_make_relation()]
        results = await resolver.resolve_relations(relations, lookup, corpus_id=uuid4())

        assert len(results) == 1
        assert results[0]["temporal_verdict"] == "reinforce"
        assert results[0]["valid_from"] is not None
        assert results[0]["valid_to"] is None

    async def test_non_exclusive_type_no_contradiction(self):
        resolver = TemporalResolver()

        async def lookup(source, target, edge_type, corpus_id):
            # RELATED_TO 不是互斥类型，即使有多个也正常
            if target is None:
                return [{"id": uuid4(), "target_id": "entity:other", "evidence_text": "x"}]
            return []

        relations = [_make_relation(edge_type="RELATED_TO")]
        results = await resolver.resolve_relations(relations, lookup, corpus_id=uuid4())

        assert results[0]["temporal_verdict"] == "reinforce"

    async def test_lookup_error_graceful(self):
        resolver = TemporalResolver()

        async def failing_lookup(**kwargs):
            raise ConnectionError("DB down")

        relations = [_make_relation()]
        results = await resolver.resolve_relations(relations, failing_lookup, corpus_id=uuid4())

        # 出错时应保留关系，默认为 reinforce
        assert len(results) == 1
        assert results[0]["temporal_verdict"] == "reinforce"

    async def test_reinforce_when_db_evidence_is_null_and_input_is_empty(self):
        # 回归：DB evidence_text=NULL（被 dao 反序列化为 None）与上游 evidence=""（默认空串）
        # 应被视为一致，避免对未变化的关系误触发 UPDATE → expire。
        resolver = TemporalResolver()

        async def lookup(source, target, edge_type, corpus_id):
            return [{"id": uuid4(), "evidence_text": None, "target_id": "entity:2"}]

        relations = [_make_relation(evidence="")]
        results = await resolver.resolve_relations(relations, lookup, corpus_id=uuid4())

        assert len(results) == 1
        assert results[0]["temporal_verdict"] == "reinforce"
        assert results[0]["expire_ids"] == []

    async def test_multiple_relations(self):
        resolver = TemporalResolver()

        async def lookup(source, target, edge_type, corpus_id):
            return []

        relations = [
            _make_relation(source="e:1", target="e:2", edge_type="RELATED_TO"),
            _make_relation(source="e:2", target="e:3", edge_type="PART_OF"),
        ]
        results = await resolver.resolve_relations(relations, lookup, corpus_id=uuid4())

        assert len(results) == 2
        assert all(r["temporal_verdict"] == "reinforce" for r in results)
