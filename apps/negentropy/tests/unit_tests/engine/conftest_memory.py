"""
Memory 模块共享测试 fixtures

提供 embedding mock、DB session mock、样本数据等公共 fixture，
供 test_rrf_fusion / test_consolidation_helpers / test_intent_rerank 等复用。
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

# ---------------------------------------------------------------------------
# Embedding mock
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_embedding_fn():
    """返回一个 async mock embedding 函数，默认返回 1536 维零向量。

    用法:
        fn = mock_embedding_fn()
        vec = await fn("hello")  # -> [0.0] * 1536

    如需自定义维度:
        fn = mock_embedding_fn(dim=768)
    """

    def _factory(dim: int = 1536):
        fn = AsyncMock(return_value=[0.0] * dim)
        return fn

    return _factory


# ---------------------------------------------------------------------------
# DB session mock
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_db_session():
    """AsyncMock for SQLAlchemy AsyncSession，适合用于不需要真实 DB 的单元测试。"""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.begin_nested = AsyncMock()
    session.add = AsyncMock()
    session.scalar_one_or_none = AsyncMock(return_value=None)
    return session


# ---------------------------------------------------------------------------
# 样本数据 fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_speaker_turns():
    """典型的 user/model 对话轮次列表。"""
    return [
        {"author": "user", "text": "你好，帮我部署一下服务"},
        {"author": "model", "text": "好的，我来帮你部署。首先需要确认环境配置。"},
        {"author": "user", "text": "环境是 Kubernetes 集群"},
        {"author": "model", "text": "了解，K8s 集群部署流程如下：1. 编写 Deployment 2. 配置 Service 3. 应用 manifest"},
        {"author": "user", "text": "如何配置 HPA 自动扩缩容？"},
        {"author": "model", "text": "HPA 配置需要指定 minReplicas、maxReplicas 和 metrics 指标。"},
    ]


@pytest.fixture
def sample_search_results():
    """搜索结果列表，包含 id / content / metadata / relevance_score / memory_type。"""
    return [
        {
            "id": "00000000-0000-4000-8000-000000000001",
            "content": "Kubernetes 部署步骤：编写 Deployment YAML，配置 Service，kubectl apply",
            "metadata": {"source": "session"},
            "relevance_score": 0.92,
            "memory_type": "procedural",
        },
        {
            "id": "00000000-0000-4000-8000-000000000002",
            "content": "用户偏好使用 Kubernetes 进行服务部署",
            "metadata": {"source": "session"},
            "relevance_score": 0.85,
            "memory_type": "preference",
        },
        {
            "id": "00000000-0000-4000-8000-000000000003",
            "content": "上周讨论了微服务架构选型，决定使用 gRPC",
            "metadata": {"source": "session"},
            "relevance_score": 0.78,
            "memory_type": "episodic",
        },
        {
            "id": "00000000-0000-4000-8000-000000000004",
            "content": "gRPC 是 Google 开源的高性能 RPC 框架",
            "metadata": {"source": "session"},
            "relevance_score": 0.71,
            "memory_type": "semantic",
        },
    ]


# ---------------------------------------------------------------------------
# Governance Service fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def governance_service():
    """创建 MemoryGovernanceService 实例（mock DB，使用 __new__ 绕过 __init__）。"""
    from negentropy.engine.governance.memory import MemoryGovernanceService

    service = MemoryGovernanceService.__new__(MemoryGovernanceService)
    return service
