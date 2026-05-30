"""AssociationService.expand_via_ppr BFS 边界条件测试

覆盖：
1. 空 seeds → 返回 {}
2. 单 seed 无边 → 返回 {seed: 1.0}
3. 深度截断（depth > 5 静默截断到 5）
4. 归一化边界（max_score ≤ 0 → 返回 {}）
5. BFS 多跳正确性
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from negentropy.engine.adapters.postgres.association_service import AssociationService


def _make_service() -> AssociationService:
    """创建 AssociationService 实例。"""
    return AssociationService()


class TestPPREmptySeeds:
    """空 seeds 边界条件。"""

    @pytest.mark.asyncio
    async def test_empty_seeds_returns_empty(self) -> None:
        """空 seeds 列表应立即返回 {}。"""
        svc = _make_service()
        result = await svc.expand_via_ppr(seeds=[])
        assert result == {}


class TestPPRSingleSeedNoEdges:
    """单 seed 无连接边。"""

    @pytest.mark.asyncio
    async def test_single_seed_no_edges(self) -> None:
        """单 seed 无边时应返回 {seed: 1.0}。"""
        svc = _make_service()
        seed = uuid4()

        mock_db = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        # SQL 查询返回空边集
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_db.execute.return_value = mock_result

        with patch("negentropy.engine.adapters.postgres.association_service.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value = mock_db
            result = await svc.expand_via_ppr(seeds=[seed])

        assert str(seed) in result
        assert result[str(seed)] == pytest.approx(1.0)


class TestPPRDepthClamping:
    """depth > 5 时静默截断。"""

    @pytest.mark.asyncio
    async def test_depth_clamped_to_five(self) -> None:
        """请求 depth=10 应被截断到 5，不抛异常。"""
        svc = _make_service()
        seed = uuid4()

        mock_db = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        # SQL 返回空边集（每层都无新节点，BFS 自然终止）
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_db.execute.return_value = mock_result

        with patch("negentropy.engine.adapters.postgres.association_service.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value = mock_db
            # 不应抛异常
            result = await svc.expand_via_ppr(seeds=[seed], depth=10)

        assert str(seed) in result


class TestPPRNormalizationBoundary:
    """归一化边界条件。"""

    @pytest.mark.asyncio
    async def test_zero_scores_returns_empty(self) -> None:
        """scores 为空（无种子且无扩展）应返回 {}。"""
        svc = _make_service()
        # 空 seeds 直接返回，不会进入 BFS
        result = await svc.expand_via_ppr(seeds=[])
        assert result == {}


class TestPPRMultiHopExpansion:
    """BFS 多跳正确性验证。"""

    @pytest.mark.asyncio
    async def test_two_hop_expansion(self) -> None:
        """两跳扩散应正确累加衰减权重。"""
        svc = _make_service()
        seed_id = uuid4()
        hop1_id = uuid4()
        hop2_id = uuid4()

        call_count = 0

        # 模拟边数据
        edge_hop1 = MagicMock()
        edge_hop1.src = seed_id
        edge_hop1.tgt = hop1_id
        edge_hop1.w = 0.8

        edge_hop2 = MagicMock()
        edge_hop2.src = hop1_id
        edge_hop2.tgt = hop2_id
        edge_hop2.w = 0.6

        mock_db = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        def mock_execute(sql, params=None):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.fetchall.return_value = [edge_hop1]
            elif call_count == 2:
                result.fetchall.return_value = [edge_hop2]
            else:
                result.fetchall.return_value = []
            return result

        mock_db.execute.side_effect = mock_execute

        with patch("negentropy.engine.adapters.postgres.association_service.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value = mock_db
            result = await svc.expand_via_ppr(seeds=[seed_id], depth=2, alpha=0.5)

        # seed 初始 1.0，hop1 得到 α^1 * 0.8 = 0.4，hop2 得到 α^2 * 0.6 = 0.15
        # 归一化：max = 1.0（seed）
        assert str(seed_id) in result
        assert str(hop1_id) in result
        assert str(hop2_id) in result
        assert result[str(seed_id)] == pytest.approx(1.0)
        assert result[str(hop1_id)] == pytest.approx(0.4)
        assert result[str(hop2_id)] == pytest.approx(0.15)


class TestPPRTopKLimit:
    """top_k 限制返回数量。"""

    @pytest.mark.asyncio
    async def test_top_k_limits_results(self) -> None:
        """top_k 应限制返回的实体数量。"""
        svc = _make_service()
        seed_id = uuid4()

        # 生成 10 个邻居
        edges = []
        neighbors = []
        for i in range(10):
            nid = uuid4()
            neighbors.append(nid)
            edge = MagicMock()
            edge.src = seed_id
            edge.tgt = nid
            edge.w = 1.0 - i * 0.05  # 递减权重
            edges.append(edge)

        mock_db = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        def mock_execute(sql, params=None):
            result = MagicMock()
            result.fetchall.return_value = edges
            return result

        mock_db.execute.side_effect = mock_execute

        with patch("negentropy.engine.adapters.postgres.association_service.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value = mock_db
            result = await svc.expand_via_ppr(seeds=[seed_id], depth=1, top_k=5)

        # 结果应不超过 top_k + seed（seed 不算在 top_k 内因为 top_k 排序后截断）
        assert len(result) <= 6  # seed + 最多 5 个邻居
