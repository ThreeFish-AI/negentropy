"""
MemoryServiceFactory: 统一的 MemoryService 后端工厂

采用 Strategy + Factory 模式，根据配置动态选择 MemoryService 实现：
- inmemory: ADK 内置 InMemoryMemoryService (开发/测试)
- vertexai: ADK 内置 VertexAiMemoryBankService (GCP 生产环境)
- postgres: 自研 PostgresMemoryService (本地 PostgreSQL 环境)
"""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING, Awaitable, Callable, Optional

from google.adk.memory.base_memory_service import BaseMemoryService

from negentropy.config import settings

if TYPE_CHECKING:
    from negentropy.engine.adapters.postgres.fact_service import FactService
    from negentropy.engine.governance.memory import MemoryGovernanceService

# 类型别名：embedding 函数签名
EmbeddingFn = Callable[[str], Awaitable[list[float]]]


class MemoryBackend(str, Enum):
    """支持的 MemoryService 后端类型"""

    INMEMORY = "inmemory"
    VERTEXAI = "vertexai"
    POSTGRES = "postgres"


def create_inmemory_memory_service() -> BaseMemoryService:
    """创建 InMemory 后端 (ADK 内置)"""
    from google.adk.memory import InMemoryMemoryService

    return InMemoryMemoryService()


def create_vertexai_memory_service() -> BaseMemoryService:
    """创建 VertexAI 后端 (ADK 内置)"""
    from google.adk.memory import VertexAiMemoryBankService

    if not settings.vertex_project_id or not settings.vertex_location or not settings.vertex_agent_engine_id:
        raise ValueError(
            "VertexAI MemoryService requires VERTEX_PROJECT_ID, VERTEX_LOCATION, and VERTEX_AGENT_ENGINE_ID"
        )

    return VertexAiMemoryBankService(
        project=settings.vertex_project_id,
        location=settings.vertex_location,
        agent_engine_id=settings.vertex_agent_engine_id,
    )


def create_postgres_memory_service(
    embedding_fn: Optional[EmbeddingFn] = None,
    consolidation_worker=None,
) -> BaseMemoryService:
    """
    创建 Postgres 后端 (自研，ORM 实现)

    Args:
        embedding_fn: 向量化函数，签名: async (text: str) -> list[float]
        consolidation_worker: Phase 2 记忆巩固 Worker (可选)

    Returns:
        PostgresMemoryService 实例
    """
    from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService

    return PostgresMemoryService(embedding_fn=embedding_fn, consolidation_worker=consolidation_worker)


# 后端创建函数映射表 (Strategy Pattern)
_BACKEND_FACTORIES = {
    MemoryBackend.INMEMORY: create_inmemory_memory_service,
    MemoryBackend.VERTEXAI: create_vertexai_memory_service,
    MemoryBackend.POSTGRES: create_postgres_memory_service,
}

# 模块级单例缓存 (替代 lru_cache，避免参数变化时返回错误实例)
_memory_service_instance: Optional[BaseMemoryService] = None


def get_memory_service(backend: str | None = None) -> BaseMemoryService:
    """
    获取 MemoryService 实例 (工厂函数)

    Args:
        backend: 后端类型，可选值：inmemory, vertexai, postgres
                 若为 None，则从 settings.memory_service_backend 读取

    Returns:
        BaseMemoryService 实例

    Raises:
        ValueError: 不支持的后端类型
    """
    global _memory_service_instance

    backend_str = backend or settings.memory_service_backend
    try:
        backend_enum = MemoryBackend(backend_str.lower())
    except ValueError:
        raise ValueError(f"Unsupported memory backend: {backend_str}. Supported: {[b.value for b in MemoryBackend]}")

    # 如果已有缓存实例且未显式指定 backend，直接返回
    if _memory_service_instance is not None and backend is None:
        return _memory_service_instance

    factory = _BACKEND_FACTORIES.get(backend_enum)
    if not factory:
        raise ValueError(f"No factory registered for backend: {backend_enum}")

    instance = factory()

    # 仅在未显式指定 backend 时缓存 (避免测试中混用不同后端)
    if backend is None:
        _memory_service_instance = instance

    return instance


def reset_memory_service() -> None:
    """重置单例缓存 (用于测试)"""
    global _memory_service_instance
    _memory_service_instance = None


# ============================================================================
# Memory Governance Factory
# ============================================================================

_memory_governance_service_instance: Optional["MemoryGovernanceService"] = None


def get_memory_governance_service() -> "MemoryGovernanceService":
    """
    获取 MemoryGovernanceService 实例 (工厂函数)

    Returns:
        MemoryGovernanceService 实例
    """
    global _memory_governance_service_instance

    if _memory_governance_service_instance is None:
        from negentropy.engine.governance.memory import MemoryGovernanceService

        _memory_governance_service_instance = MemoryGovernanceService()

    return _memory_governance_service_instance


def reset_memory_governance_service() -> None:
    """重置 MemoryGovernanceService 单例缓存 (用于测试)"""
    global _memory_governance_service_instance
    _memory_governance_service_instance = None


# ============================================================================
# Fact Service Factory
# ============================================================================

_fact_service_instance: Optional["FactService"] = None


def get_fact_service(embedding_fn: Optional[EmbeddingFn] = None) -> "FactService":
    """
    获取 FactService 实例 (工厂函数)

    FactService 管理 Fact（语义记忆）的 CRUD 操作，
    支持向量语义检索与 ilike 回退。

    Args:
        embedding_fn: 向量化函数，签名: async (text: str) -> list[float]

    Returns:
        FactService 实例
    """
    global _fact_service_instance

    if _fact_service_instance is None:
        from negentropy.engine.adapters.postgres.fact_service import FactService

        _fact_service_instance = FactService(embedding_fn=embedding_fn)

    return _fact_service_instance


def reset_fact_service() -> None:
    """重置 FactService 单例缓存 (用于测试)"""
    global _fact_service_instance
    _fact_service_instance = None


__all__ = [
    "MemoryBackend",
    "EmbeddingFn",
    "get_memory_service",
    "reset_memory_service",
    "create_inmemory_memory_service",
    "create_vertexai_memory_service",
    "create_postgres_memory_service",
    # Memory Governance
    "get_memory_governance_service",
    "reset_memory_governance_service",
    # Fact Service
    "get_fact_service",
    "reset_fact_service",
]
