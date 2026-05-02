"""Graph Repository 时态查询（as-of）单元测试

覆盖 G3 双时态时间穿梭检索的 SQL 片段构造、参数注入与缓存键维度，
不打开真实数据库连接（使用 mocked session）。

References:
    [1] R. Snodgrass and I. Ahn, "A taxonomy of time in databases,"
        Proc. ACM SIGMOD, pp. 236–246, 1985.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.graph.repository import (
    AgeGraphRepository,
    _temporal_where_clause,
)

_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")
_AS_OF = datetime(2024, 5, 1, 0, 0, 0, tzinfo=UTC)


class TestTemporalWhereClause:
    """_temporal_where_clause 工具函数测试"""

    def test_default_alias_is_r(self):
        clause = _temporal_where_clause()
        assert "r.valid_from" in clause
        assert "r.valid_to" in clause
        assert ":as_of" in clause

    def test_custom_alias_substitution(self):
        clause = _temporal_where_clause("rel")
        assert "rel.valid_from" in clause
        assert "rel.valid_to" in clause
        assert "r.valid_from" not in clause

    def test_clause_structure_has_both_bounds(self):
        clause = _temporal_where_clause("r")
        assert "valid_from IS NULL OR" in clause
        assert "valid_to IS NULL OR" in clause


class TestRepositoryAsOfPropagation:
    """as_of 参数 → SQL 谓词与绑定参数的传递链路测试"""

    @pytest.fixture
    def mock_session(self) -> AsyncMock:
        session = AsyncMock(spec=AsyncSession)
        session.execute = AsyncMock()
        return session

    @pytest.fixture
    def repository(self, mock_session: AsyncMock) -> AgeGraphRepository:
        return AgeGraphRepository(session=mock_session)

    @pytest.mark.asyncio
    async def test_find_neighbors_passes_as_of_param(
        self, repository: AgeGraphRepository, mock_session: AsyncMock
    ) -> None:
        # 触发查询；返回空 result 即可，本测试仅验证参数与 SQL 结构
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        mock_session.execute.return_value = mock_result

        await repository.find_neighbors("entity:e1", max_depth=2, as_of=_AS_OF)

        assert mock_session.execute.called
        _query, params = mock_session.execute.call_args[0]
        sql_text = str(_query)
        assert "valid_from" in sql_text
        assert "valid_to" in sql_text
        assert params["as_of"] == _AS_OF

    @pytest.mark.asyncio
    async def test_find_neighbors_skips_temporal_when_as_of_none(
        self, repository: AgeGraphRepository, mock_session: AsyncMock
    ) -> None:
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        mock_session.execute.return_value = mock_result

        await repository.find_neighbors("entity:e1", max_depth=2)

        _query, params = mock_session.execute.call_args[0]
        sql_text = str(_query)
        assert "valid_from" not in sql_text
        assert "as_of" not in params

    @pytest.mark.asyncio
    async def test_find_path_injects_as_of_in_recursive_cte(
        self, repository: AgeGraphRepository, mock_session: AsyncMock
    ) -> None:
        mock_result = MagicMock()
        mock_result.first = MagicMock(return_value=None)
        mock_session.execute.return_value = mock_result

        await repository.find_path("entity:a", "entity:b", as_of=_AS_OF)

        _query, params = mock_session.execute.call_args[0]
        sql_text = str(_query)
        # 时态过滤应出现在 base 段（valid_from / valid_to 字面）
        assert "valid_from" in sql_text
        assert "valid_to" in sql_text
        assert params["as_of"] == _AS_OF

    @pytest.mark.asyncio
    async def test_get_relation_timeline_rejects_invalid_bucket(self, repository: AgeGraphRepository) -> None:
        with pytest.raises(ValueError, match="bucket"):
            await repository.get_relation_timeline(_CORPUS_ID, bucket="hour")

    @pytest.mark.asyncio
    async def test_get_relation_timeline_returns_serialized_points(
        self, repository: AgeGraphRepository, mock_session: AsyncMock
    ) -> None:
        mock_row = MagicMock()
        mock_row.bucket_date = datetime(2024, 5, 1, tzinfo=UTC)
        mock_row.active_count = 12
        mock_row.expired_count = 3
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([mock_row]))
        mock_session.execute.return_value = mock_result

        timeline = await repository.get_relation_timeline(_CORPUS_ID, bucket="day")
        assert len(timeline) == 1
        assert timeline[0]["active_count"] == 12
        assert timeline[0]["expired_count"] == 3
        assert timeline[0]["date"].startswith("2024-05-01")

    @pytest.mark.asyncio
    async def test_hybrid_search_temporal_falls_back_to_rrf(
        self, repository: AgeGraphRepository, mock_session: AsyncMock
    ) -> None:
        """传 as_of 但 rrf_k=None 时应自动升级为 RRF 模式（避免线性路径丢失时态）"""
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        mock_session.execute.return_value = mock_result

        await repository.hybrid_search(
            corpus_id=_CORPUS_ID,
            app_name="default",
            query_embedding=[0.0] * 4,
            query_text="test",
            limit=10,
            rrf_k=None,
            as_of=_AS_OF,
        )

        # 至少应触发了 RRF 路径的 semantic_query —— SELECT … FROM kg_entities …
        executed_sqls = [str(call.args[0]) for call in mock_session.execute.call_args_list]
        assert any("kg_entities" in sql for sql in executed_sqls)
        # 含 EXISTS 子查询过滤无活跃关系的实体
        assert any("EXISTS" in sql for sql in executed_sqls)
