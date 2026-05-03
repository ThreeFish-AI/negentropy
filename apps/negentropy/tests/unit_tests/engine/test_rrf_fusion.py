"""
PostgresMemoryService._rrf_fuse 单元测试

测试 Reciprocal Rank Fusion 静态方法的正确性，包括：
- 单通道 / 双通道融合
- 重叠文档分数提升
- 空通道处理
- limit 截断
- k 参数对排名的影响
- metadata.fusion 字段
- search_level 标记

不连真实 DB。
"""

from __future__ import annotations

from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService


class TestRRFFuseSingleChannel:
    """单通道场景：RRF 退化为原始排名。"""

    def test_single_channel_preserves_order(self) -> None:
        """单通道输入时，输出应保持原始排列顺序（RRF 分数递减）。"""
        items = [
            {"id": "a", "content": "first", "relevance_score": 0.9},
            {"id": "b", "content": "second", "relevance_score": 0.7},
            {"id": "c", "content": "third", "relevance_score": 0.5},
        ]
        result = PostgresMemoryService._rrf_fuse(
            channels={"hybrid": items},
            k=60,
            limit=10,
        )
        assert [r["id"] for r in result] == ["a", "b", "c"]

    def test_single_channel_preserves_content(self) -> None:
        """单通道输出应保留原始 content 字段。"""
        items = [{"id": "x", "content": "hello world", "memory_type": "episodic"}]
        result = PostgresMemoryService._rrf_fuse(
            channels={"ppr": items},
            k=60,
            limit=10,
        )
        assert result[0]["content"] == "hello world"
        assert result[0]["memory_type"] == "episodic"


class TestRRFFuseTwoChannels:
    """双通道场景：验证重叠文档的分数提升。"""

    def test_overlapping_doc_gets_higher_score(self) -> None:
        """同时出现在两个通道的文档 RRF 分数应高于任一通道的独占文档。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [
                    {"id": "shared", "content": "overlap"},
                    {"id": "only_hybrid", "content": "unique to hybrid"},
                ],
                "ppr": [
                    {"id": "shared", "content": "overlap"},
                    {"id": "only_ppr", "content": "unique to ppr"},
                ],
            },
            k=60,
            limit=10,
        )
        ids = [r["id"] for r in result]
        assert ids[0] == "shared", "重叠文档应排第一"

    def test_no_overlap_preserves_all_docs(self) -> None:
        """两个通道无重叠时，所有文档都应出现在结果中。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [
                    {"id": "h1"},
                    {"id": "h2"},
                ],
                "ppr": [
                    {"id": "p1"},
                    {"id": "p2"},
                ],
            },
            k=60,
            limit=10,
        )
        result_ids = {r["id"] for r in result}
        assert result_ids == {"h1", "h2", "p1", "p2"}

    def test_rank_order_affects_rrf_score(self) -> None:
        """在通道中的排名越靠前，RRF 贡献越大。

        doc_i 在 hybrid 排 rank_i = i+1，在 ppr 排 rank_j = 10-i。
        总 RRF 分 = 1/(k+rank_i) + 1/(k+rank_j)，对称排名 doc_0 与 doc_9
        的 RRF 分数应相等（1/(k+1)+1/(k+10) == 1/(k+10)+1/(k+1)）。
        """
        hybrid_items = [{"id": f"doc_{i}"} for i in range(10)]
        ppr_items = list(reversed(hybrid_items))  # doc_0 → rank10, doc_9 → rank1

        result = PostgresMemoryService._rrf_fuse(
            channels={"hybrid": hybrid_items, "ppr": ppr_items},
            k=1,
            limit=20,
        )
        by_id = {r["id"]: r for r in result}
        # 对称对: doc_0 (hybrid=1, ppr=10) 与 doc_9 (hybrid=10, ppr=1) 分数应相等
        assert abs(by_id["doc_0"]["relevance_score"] - by_id["doc_9"]["relevance_score"]) < 0.001
        # doc_0 与 doc_5 (hybrid=1,ppr=10 vs hybrid=6,ppr=5) 分数不同
        assert abs(by_id["doc_0"]["relevance_score"] - by_id["doc_5"]["relevance_score"]) > 0.001


class TestRRFFuseEmptyChannels:
    """空通道边界场景。"""

    def test_empty_channel_returns_empty(self) -> None:
        """空 channels dict 应返回空列表。"""
        result = PostgresMemoryService._rrf_fuse(channels={}, k=60, limit=10)
        assert result == []

    def test_one_empty_one_filled(self) -> None:
        """一个通道为空时，返回另一个通道的结果。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "a"}, {"id": "b"}],
                "ppr": [],
            },
            k=60,
            limit=10,
        )
        assert len(result) == 2
        assert {r["id"] for r in result} == {"a", "b"}


class TestRRFFuseLimit:
    """limit 截断测试。"""

    def test_limit_is_respected(self) -> None:
        """limit 参数应正确截断结果。"""
        items = [{"id": f"m{i}"} for i in range(20)]
        result = PostgresMemoryService._rrf_fuse(
            channels={"ch": items},
            k=60,
            limit=5,
        )
        assert len(result) == 5

    def test_limit_larger_than_results(self) -> None:
        """limit 大于结果数时，不应产生额外条目。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={"ch": [{"id": "a"}, {"id": "b"}]},
            k=60,
            limit=100,
        )
        assert len(result) == 2


class TestRRFFuseKParameter:
    """RRF k 参数对排名的影响。"""

    def test_small_k_emphasizes_top_ranks(self) -> None:
        """较小的 k 值让排名靠前的文档获得更大的分数优势。"""
        # doc_shared 在 hybrid 排第 1，在 ppr 排第 1
        # doc_late 在 hybrid 排第 10，不在 ppr 中
        result_small_k = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "shared"}] + [{"id": f"filler_{i}"} for i in range(9)] + [{"id": "late"}],
                "ppr": [{"id": "shared"}],
            },
            k=1,
            limit=20,
        )
        ids = [r["id"] for r in result_small_k]
        assert ids[0] == "shared"

    def test_large_k_smooths_scores(self) -> None:
        """较大的 k 值让所有文档的 RRF 分数趋于均匀。"""
        items = [{"id": f"m{i}"} for i in range(5)]
        result = PostgresMemoryService._rrf_fuse(
            channels={"ch": items},
            k=10000,
            limit=5,
        )
        scores = [r["relevance_score"] for r in result]
        # 大 k 时分数差异应很小
        max_diff = max(scores) - min(scores)
        assert max_diff < 0.01


class TestRRFFuseMetadata:
    """metadata.fusion 字段验证。"""

    def test_metadata_fusion_field_populated(self) -> None:
        """融合后 metadata.fusion 应包含 channels / rrf_score / rrf_k。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "m1"}],
                "ppr": [{"id": "m1"}],
            },
            k=42,
            limit=10,
        )
        fusion = result[0]["metadata"]["fusion"]
        assert "channels" in fusion
        assert "rrf_score" in fusion
        assert fusion["rrf_k"] == 42

    def test_metadata_fusion_records_correct_ranks(self) -> None:
        """fusion.channels 应准确记录每个通道中的排名。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "a"}, {"id": "b"}, {"id": "c"}],
                "ppr": [{"id": "b"}, {"id": "a"}],
            },
            k=60,
            limit=10,
        )
        by_id = {r["id"]: r for r in result}
        assert by_id["a"]["metadata"]["fusion"]["channels"]["hybrid"] == 1
        assert by_id["a"]["metadata"]["fusion"]["channels"]["ppr"] == 2
        assert by_id["b"]["metadata"]["fusion"]["channels"]["hybrid"] == 2
        assert by_id["b"]["metadata"]["fusion"]["channels"]["ppr"] == 1
        assert by_id["c"]["metadata"]["fusion"]["channels"]["hybrid"] == 3
        assert by_id["c"]["metadata"]["fusion"]["channels"]["ppr"] is None

    def test_metadata_fusion_single_channel_missing_rank(self) -> None:
        """仅出现在一个通道的文档，另一通道的 rank 应为 None。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "only_h"}],
                "ppr": [{"id": "only_p"}],
            },
            k=60,
            limit=10,
        )
        by_id = {r["id"]: r for r in result}
        assert by_id["only_h"]["metadata"]["fusion"]["channels"]["ppr"] is None
        assert by_id["only_p"]["metadata"]["fusion"]["channels"]["hybrid"] is None


class TestRRFFuseSearchLevel:
    """search_level 标记逻辑验证。"""

    def test_both_channels_sets_ppr_hybrid(self) -> None:
        """同时出现在所有通道的文档，search_level 应为 ppr+hybrid。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "shared", "search_level": "hybrid"}],
                "ppr": [{"id": "shared", "search_level": "ppr"}],
            },
            k=60,
            limit=10,
        )
        assert result[0]["search_level"] == "ppr+hybrid"

    def test_single_channel_preserves_original_search_level(self) -> None:
        """仅出现在一个通道的文档，保留原始 search_level。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "h1", "search_level": "hybrid"}],
                "ppr": [{"id": "p1", "search_level": "ppr"}],
            },
            k=60,
            limit=10,
        )
        by_id = {r["id"]: r for r in result}
        assert by_id["h1"]["search_level"] == "hybrid"
        assert by_id["p1"]["search_level"] == "ppr"

    def test_doc_in_two_of_three_channels(self) -> None:
        """三通道场景中，文档出现在所有通道才标记为 ppr+hybrid。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "a", "search_level": "hybrid"}],
                "ppr": [{"id": "a", "search_level": "ppr"}],
                "third": [{"id": "b", "search_level": "third"}],
            },
            k=60,
            limit=10,
        )
        by_id = {r["id"]: r for r in result}
        # a 不在 third 中，不应标记为 ppr+hybrid
        assert by_id["a"]["search_level"] in ("hybrid", "ppr")

    def test_no_original_search_level_defaults_to_hybrid(self) -> None:
        """没有原始 search_level 时，单通道文档应回退到 hybrid。"""
        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "a"}],
                "ppr": [{"id": "b"}],
            },
            k=60,
            limit=10,
        )
        by_id = {r["id"]: r for r in result}
        assert by_id["a"]["search_level"] == "hybrid"
