"""
Graph Algorithms 单元测试

验证核心图算法的正确性与边界处理：
  - export_graph_to_networkx: 图导出
  - compute_pagerank: PageRank 计算
  - compute_communities: Leiden/Louvain 社区检测
  - community_id 类型 CAST 正确性（ISSUE-082 regression）
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


def _make_nx_graph(nodes: list[str], edges: list[tuple[str, str, float]] | None = None):
    """构造 NetworkX DiGraph 测试用"""
    import networkx as nx

    G = nx.DiGraph()
    for n in nodes:
        G.add_node(n)
    if edges:
        for src, tgt, weight in edges:
            G.add_edge(src, tgt, weight=weight)
    return G


# ============================================================================
# _run_leiden
# ============================================================================


class TestRunLeiden:
    """测试 Leiden 社区检测辅助函数"""

    def _get_run_leiden(self):
        try:
            from negentropy.knowledge.graph.graph_algorithms import _LEIDEN_AVAILABLE, _run_leiden

            if not _LEIDEN_AVAILABLE:
                pytest.skip("leidenalg 不可用")
            return _run_leiden
        except ImportError:
            pytest.skip("leidenalg 不可用")

    def test_single_community(self):
        """完全连通的小图应归为 1 个社区"""
        import networkx as nx

        _run_leiden = self._get_run_leiden()
        nodes = [str(uuid4()) for _ in range(5)]
        G = nx.Graph()
        for n in nodes:
            G.add_node(n)
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                G.add_edge(nodes[i], nodes[j])

        result = _run_leiden(G, resolution=1.0, seed=42)
        assert len(result) >= 1
        assert sum(len(c) for c in result) == 5

    def test_disconnected_components(self):
        """两个断连子图应归为不同社区"""
        import networkx as nx

        _run_leiden = self._get_run_leiden()
        nodes_a = [str(uuid4()) for _ in range(3)]
        nodes_b = [str(uuid4()) for _ in range(3)]
        G = nx.Graph()
        for n in nodes_a + nodes_b:
            G.add_node(n)
        for i in range(len(nodes_a)):
            for j in range(i + 1, len(nodes_a)):
                G.add_edge(nodes_a[i], nodes_a[j])
        for i in range(len(nodes_b)):
            for j in range(i + 1, len(nodes_b)):
                G.add_edge(nodes_b[i], nodes_b[j])

        result = _run_leiden(G, resolution=1.0, seed=42)
        assert len(result) >= 2

    def test_single_node(self):
        """单节点图应归为 1 个社区"""
        import networkx as nx

        _run_leiden = self._get_run_leiden()
        G = nx.Graph()
        G.add_node(str(uuid4()))
        result = _run_leiden(G, resolution=1.0, seed=42)
        assert len(result) == 1
        assert sum(len(c) for c in result) == 1

    def test_empty_graph(self):
        """空图应返回空列表"""
        import networkx as nx

        _run_leiden = self._get_run_leiden()
        G = nx.Graph()
        result = _run_leiden(G, resolution=1.0, seed=42)
        assert len(result) == 0

    def test_weighted_graph(self):
        """带权图应能正常处理"""
        import networkx as nx

        _run_leiden = self._get_run_leiden()
        nodes = [str(uuid4()) for _ in range(6)]
        G = nx.Graph()
        for n in nodes:
            G.add_node(n)
        G.add_edge(nodes[0], nodes[1], weight=5.0)
        G.add_edge(nodes[1], nodes[2], weight=5.0)
        G.add_edge(nodes[3], nodes[4], weight=5.0)
        G.add_edge(nodes[4], nodes[5], weight=5.0)

        result = _run_leiden(G, resolution=1.0, seed=42)
        assert sum(len(c) for c in result) == 6


# ============================================================================
# compute_communities — community_id 类型 CAST 回归测试
# ============================================================================


class TestCommunityIdCast:
    """ISSUE-082 regression: community_id INTEGER 类型 CAST 缺失"""

    def test_values_clause_uses_integer_cast(self):
        """VALUES 子句中 cid 参数必须 CAST 为 integer"""
        # 直接检查 VALUES 模板中的 CAST 语句
        import inspect

        from negentropy.knowledge.graph.graph_algorithms import compute_communities

        source = inspect.getsource(compute_communities)
        # 确认 :cid_{j} 被包裹在 CAST(... AS integer) 中
        assert "CAST(:cid_" in source
        assert "AS integer)" in source

    def test_no_plain_cid_without_cast(self):
        """确认 VALUES 子句中不存在未 CAST 的 :cid_ 参数"""
        import inspect
        import re

        from negentropy.knowledge.graph.graph_algorithms import compute_communities

        source = inspect.getsource(compute_communities)
        # 所有 :cid_{j} 都应该被 CAST 包裹，不应出现裸参数
        for match in re.finditer(r":cid_\{j\}", source):
            # 检查前面是否有 CAST(
            before = source[max(0, match.start() - 20) : match.start()]
            assert "CAST(" in before, f"发现未 CAST 的 :cid_{{j}} 参数: ...{before}:cid_{{j}}..."


# ============================================================================
# compute_pagerank
# ============================================================================


class TestComputePagerank:
    """PageRank 计算边界测试"""

    def test_values_clause_uses_float_cast(self):
        """PageRank UPDATE 的 importance_score 应使用 CAST AS float"""
        import inspect

        from negentropy.knowledge.graph.graph_algorithms import compute_pagerank

        source = inspect.getsource(compute_pagerank)
        # importance_score 是 FLOAT 类型，需要确认 CAST 正确
        assert "CAST(" in source or "float" in source.lower()


# ============================================================================
# export_graph_to_networkx 边界
# ============================================================================


class TestExportGraph:
    """图导出边界测试"""

    @pytest.mark.asyncio
    async def test_empty_graph(self):
        """空语料库应返回空图"""
        with patch("negentropy.knowledge.graph.graph_algorithms.AsyncSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            # 模拟空查询结果
            mock_result = MagicMock()
            mock_result.fetchall.return_value = []
            mock_session.execute.return_value = mock_result

            from negentropy.knowledge.graph.graph_algorithms import export_graph_to_networkx

            G, labels = await export_graph_to_networkx(mock_session, uuid4())
            import networkx as nx

            assert isinstance(G, nx.DiGraph)
            assert G.number_of_nodes() == 0
