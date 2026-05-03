"""Phase 4 G4 Personalized PageRank + Provenance 单元测试

不打开真实数据库（mock AsyncSession 返回 NetworkX-friendly 行）。

References:
    [1] L. Page et al., "The PageRank Citation Ranking," 1999.
    [2] B. Gutiérrez et al., "HippoRAG," NeurIPS 2024.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from negentropy.knowledge.graph.graph_algorithms import (
    compute_personalized_pagerank,
)
from negentropy.knowledge.graph.provenance import (
    EvidenceChain,
    EvidenceEdge,
    ProvenanceBuilder,
    evidence_chain_to_dict,
)

_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


def _entity_row(eid: str, name: str = "Entity"):
    row = MagicMock()
    row.id = eid
    row.name = name
    return row


def _relation_row(src: str, tgt: str, weight: float = 1.0):
    row = MagicMock()
    row.source_id = src
    row.target_id = tgt
    row.weight = weight
    return row


@pytest.fixture
def chain_mock_db():
    db = AsyncMock()
    db.execute = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_ppr_seed_normalization_and_priority(chain_mock_db):
    """PPR: seed 节点应通过 personalization 字典获得偏置 1.0 / N（teleport 偏置生效）"""
    # 4 节点链 a-b-c-d；seed=a
    entities = MagicMock()
    entities.__iter__ = MagicMock(return_value=iter([_entity_row(c, c) for c in ["a", "b", "c", "d"]]))
    relations = MagicMock()
    relations.__iter__ = MagicMock(
        return_value=iter(
            [
                _relation_row("a", "b"),
                _relation_row("b", "c"),
                _relation_row("c", "d"),
            ]
        )
    )
    chain_mock_db.execute.side_effect = [entities, relations]

    captured: dict = {}

    def fake_pagerank(G, **kwargs):  # noqa: N803
        captured["personalization"] = kwargs.get("personalization")
        # 给 seed 高分、其余递减以模拟典型 PPR 行为
        return {"a": 0.55, "b": 0.25, "c": 0.15, "d": 0.05}

    with patch("networkx.pagerank", side_effect=fake_pagerank):
        ranks = await compute_personalized_pagerank(chain_mock_db, _CORPUS_ID, seed_entities=["a"], max_iter=50)

    assert ranks["a"] > ranks["d"]
    # personalization 中 seed 'a' 必须为 1.0（仅一个 seed），其它为 0
    assert captured["personalization"]["a"] == pytest.approx(1.0)
    assert captured["personalization"]["d"] == pytest.approx(0.0)


@pytest.mark.asyncio
async def test_ppr_handles_empty_graph(chain_mock_db):
    """空图应返回空字典而非抛错"""
    empty = MagicMock()
    empty.__iter__ = MagicMock(return_value=iter([]))
    chain_mock_db.execute.side_effect = [empty, empty]

    ranks = await compute_personalized_pagerank(chain_mock_db, _CORPUS_ID, seed_entities=["x"])
    assert ranks == {}


@pytest.mark.asyncio
async def test_ppr_skips_seeds_not_in_graph(chain_mock_db):
    """所有 seed 不在图中时返回空"""
    entities = MagicMock()
    entities.__iter__ = MagicMock(return_value=iter([_entity_row("a", "A")]))
    relations = MagicMock()
    relations.__iter__ = MagicMock(return_value=iter([]))
    chain_mock_db.execute.side_effect = [entities, relations]

    ranks = await compute_personalized_pagerank(chain_mock_db, _CORPUS_ID, seed_entities=["nonexistent"])
    assert ranks == {}


@pytest.mark.asyncio
async def test_ppr_strips_entity_prefix(chain_mock_db):
    """seed_entities 含 entity: 前缀时应正常归一化"""
    entities = MagicMock()
    entities.__iter__ = MagicMock(return_value=iter([_entity_row("a", "A"), _entity_row("b", "B")]))
    relations = MagicMock()
    relations.__iter__ = MagicMock(return_value=iter([_relation_row("a", "b")]))
    chain_mock_db.execute.side_effect = [entities, relations]

    with patch("networkx.pagerank", return_value={"a": 0.7, "b": 0.3}):
        ranks = await compute_personalized_pagerank(chain_mock_db, _CORPUS_ID, seed_entities=["entity:a"])
    assert "a" in ranks


def test_evidence_chain_dict_roundtrip():
    """evidence_chain_to_dict 应保持字段完整且边可序列化"""
    chain = EvidenceChain(
        target_entity_id="t1",
        target_label="Target",
        score=0.42,
        seed_entity_id="s1",
        path=["s1", "m1", "t1"],
        edges=[
            EvidenceEdge(
                source_id="s1",
                target_id="m1",
                relation="REL",
                evidence_text="Hello",
                weight=0.9,
            ),
        ],
    )
    payload = evidence_chain_to_dict(chain)
    assert payload["target_entity_id"] == "t1"
    assert payload["edges"][0]["evidence_text"] == "Hello"
    assert payload["path"] == ["s1", "m1", "t1"]


def test_provenance_builder_validates_max_chain_depth():
    with pytest.raises(ValueError, match="max_chain_depth"):
        ProvenanceBuilder(max_chain_depth=99)


@pytest.mark.asyncio
async def test_provenance_builder_returns_seed_chain_when_target_is_seed():
    """target 自身就是 seed 时应直接返回 path=[target] / edges=[]"""
    db = AsyncMock()
    # _load_labels 调用一次
    labels_result = MagicMock()
    labels_result.__iter__ = MagicMock(return_value=iter([_entity_row("seed1", "Seed1")]))
    db.execute = AsyncMock(return_value=labels_result)

    builder = ProvenanceBuilder(max_chain_depth=3)
    chains = await builder.build(
        db,
        _CORPUS_ID,
        top_entities=[("seed1", 0.9)],
        seed_entities=["seed1"],
    )
    assert len(chains) == 1
    assert chains[0].seed_entity_id == "seed1"
    assert chains[0].path == ["seed1"]
    assert chains[0].edges == []


@pytest.mark.asyncio
async def test_provenance_builder_handles_no_path():
    """目标无可达路径到任何 seed 时应保留实体节点但 path/edges 退化"""
    db = AsyncMock()
    labels_result = MagicMock()
    labels_result.__iter__ = MagicMock(
        return_value=iter([_entity_row("isolated", "Isolated"), _entity_row("seed1", "Seed1")])
    )
    no_path_result = MagicMock()
    no_path_result.first = MagicMock(return_value=None)
    db.execute = AsyncMock(side_effect=[labels_result, no_path_result])

    builder = ProvenanceBuilder()
    chains = await builder.build(
        db,
        _CORPUS_ID,
        top_entities=[("isolated", 0.1)],
        seed_entities=["seed1"],
    )
    assert len(chains) == 1
    assert chains[0].seed_entity_id is None
    assert chains[0].path == ["isolated"]
    assert chains[0].edges == []
