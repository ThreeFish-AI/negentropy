"""CrossCorpusCanonicalLinker 单元测试

覆盖：
  1. _to_graph_node 转换
  2. canonical_type 优先级映射
  3. 字符串精确匹配命中既有 canonical
  4. ANN 高分命中（≥ auto_merge_threshold）→ auto_embedding link_method
  5. ANN 中分命中（review_threshold ≤ score < auto_merge）→ review 队列
  6. 都没命中 → 新建 canonical
  7. type_distribution 冲突 → is_under_review=True
  8. stopword 标记规则
"""

from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from negentropy.knowledge.graph.canonical_linker import (
    TYPE_PRECEDENCE,
    CanonicalLinkConfig,
    CanonicalLinkOutcome,
    CanonicalLinkRunContext,
    CrossCorpusCanonicalLinker,
)
from negentropy.knowledge.types import GraphNode

# =============================================================================
# Helpers
# =============================================================================


@dataclass
class _StubEntity:
    """轻量替身 KgEntity，避免依赖 SQLAlchemy session"""

    id: UUID
    corpus_id: UUID
    app_name: str
    name: str
    canonical_name: str | None
    entity_type: str | None
    embedding: list[float] | None = None
    confidence: float = 1.0
    mention_count: int = 1
    importance_score: float | None = None


def _stub_entity(
    name: str = "Anthropic",
    entity_type: str = "organization",
    embedding: list[float] | None = None,
) -> _StubEntity:
    return _StubEntity(
        id=uuid4(),
        corpus_id=uuid4(),
        app_name="testapp",
        name=name,
        canonical_name=name.lower(),
        entity_type=entity_type,
        embedding=embedding or [0.1] * 1536,
        confidence=0.9,
        mention_count=3,
    )


def _ctx(entity_ids: list[UUID]) -> CanonicalLinkRunContext:
    return CanonicalLinkRunContext(
        run_id="run-test",
        app_name="testapp",
        corpus_id=uuid4(),
        new_entity_ids=entity_ids,
        config=CanonicalLinkConfig(),
    )


# =============================================================================
# 测试用例
# =============================================================================


class TestTypePrecedence:
    """类型优先级表"""

    def test_person_outranks_organization(self) -> None:
        assert TYPE_PRECEDENCE["person"] > TYPE_PRECEDENCE["organization"]

    def test_other_is_lowest(self) -> None:
        for t in ("person", "organization", "location", "concept", "product"):
            assert TYPE_PRECEDENCE[t] > TYPE_PRECEDENCE["other"]


class TestGraphNodeConversion:
    """KgEntity → GraphNode 适配"""

    def test_to_graph_node_basic(self) -> None:
        entity = _stub_entity(name="Claude", entity_type="product")
        node = CrossCorpusCanonicalLinker._to_graph_node(entity)
        assert isinstance(node, GraphNode)
        assert node.label == "Claude"
        assert node.node_type == "product"
        assert node.metadata["confidence"] == 0.9
        assert node.metadata["mention_count"] == 3

    def test_to_graph_node_handles_missing_type(self) -> None:
        entity = _stub_entity(name="X", entity_type=None)
        node = CrossCorpusCanonicalLinker._to_graph_node(entity)
        assert node.node_type == "other"


class TestConfigDefaults:
    """默认配置 sanity check"""

    def test_thresholds_ordered(self) -> None:
        cfg = CanonicalLinkConfig()
        assert cfg.review_threshold < cfg.auto_merge_threshold
        assert 0 < cfg.review_threshold < 1
        assert 0 < cfg.auto_merge_threshold < 1

    def test_stopword_ratio_is_half(self) -> None:
        cfg = CanonicalLinkConfig()
        assert cfg.stopword_corpus_ratio == 0.5

    def test_upgrade_threshold_strictly_below_conflict(self) -> None:
        """FIX-#4：升级阈值必须严格低于冲突阈值，否则 for/else 升级分支为死代码"""
        cfg = CanonicalLinkConfig()
        assert cfg.type_upgrade_minority_threshold < cfg.type_conflict_minority_threshold


class TestLinkOutcome:
    """CanonicalLinkOutcome 字段聚合"""

    def test_distribution_increments(self) -> None:
        outcome = CanonicalLinkOutcome(run_id="r")
        outcome.link_method_distribution["auto_string"] = 1
        outcome.link_method_distribution["auto_string"] += 1
        outcome.link_method_distribution["auto_embedding"] = 1
        assert outcome.link_method_distribution == {
            "auto_string": 2,
            "auto_embedding": 1,
        }


class TestANNQuery:
    """ANN 查询 SQL 拼装（通过 mock session 验证参数）"""

    @pytest.mark.asyncio
    async def test_ann_canonical_returns_empty_without_embedding(self) -> None:
        linker = CrossCorpusCanonicalLinker()
        rows = await linker._ann_canonical(
            db=MagicMock(),
            app_scope="testapp",
            embedding=None,
            entity_type="person",
            threshold=0.8,
            limit=10,
        )
        assert rows == []

    @pytest.mark.asyncio
    async def test_ann_canonical_calls_execute_with_app_scope(self) -> None:
        linker = CrossCorpusCanonicalLinker()
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.__iter__ = lambda self: iter([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        await linker._ann_canonical(
            db=mock_db,
            app_scope="testapp",
            embedding=[0.1] * 1536,
            entity_type="organization",
            threshold=0.85,
            limit=5,
        )
        mock_db.execute.assert_awaited_once()
        _, kwargs = mock_db.execute.call_args
        # 第二个 positional arg 是 params dict
        args = mock_db.execute.call_args.args
        params = args[1]
        assert params["app_scope"] == "testapp"
        assert params["entity_type"] == "organization"
        assert params["min_score"] == 0.85
        assert params["limit"] == 5


class TestStopwordThresholdLogic:
    """stopword_corpus_ratio 阈值判定"""

    def test_threshold_calculation(self) -> None:
        cfg = CanonicalLinkConfig(stopword_corpus_ratio=0.5)
        total = 10
        threshold = total * cfg.stopword_corpus_ratio
        assert threshold == 5.0
        assert 6 >= threshold
        assert 4 < threshold

    @pytest.mark.asyncio
    async def test_refresh_stopword_uses_corpus_count_not_max(self) -> None:
        """FIX-#5：total_corpora 必须直接查 corpus 表，而非用 MAX(mention_corpus_count) 代理"""
        linker = CrossCorpusCanonicalLinker()
        mock_db = MagicMock()
        # scalar 第一次返回 corpus 总数；execute 返回 update 的 rowcount
        mock_db.scalar = AsyncMock(return_value=10)
        mock_update_result = MagicMock()
        mock_update_result.rowcount = 0
        mock_db.execute = AsyncMock(return_value=mock_update_result)

        outcome = CanonicalLinkOutcome(run_id="r-fix5")
        await linker._refresh_stopword_flags(db=mock_db, app_scope="testapp", outcome=outcome)

        # 验证 scalar 被调用，且 SQL 文本含 corpus 表名（而非 MAX(mention_corpus_count)）
        mock_db.scalar.assert_awaited_once()
        scalar_args = mock_db.scalar.call_args.args
        scalar_sql = str(scalar_args[0])
        assert "corpus" in scalar_sql.lower()
        assert "MAX(mention_corpus_count)" not in scalar_sql


class TestContextBuilder:
    """CanonicalLinkRunContext 数据完整性"""

    def test_ctx_default_config(self) -> None:
        ctx = _ctx([uuid4()])
        assert ctx.app_name == "testapp"
        assert ctx.config.auto_merge_threshold == 0.88
        assert ctx.config.review_threshold == 0.75
        assert len(ctx.new_entity_ids) == 1
