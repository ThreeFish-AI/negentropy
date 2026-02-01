"""
MemoryServiceFactory: 统一的 MemoryService 后端工厂

采用 Strategy + Factory 模式，根据配置动态选择 MemoryService 实现：
- inmemory: ADK 内置 InMemoryMemoryService (开发/测试)
- vertexai: ADK 内置 VertexAiMemoryBankService (GCP 生产环境)
- postgres: 自研 PostgresMemoryService (本地 PostgreSQL 环境)
"""

from __future__ import annotations

from enum import Enum
from functools import lru_cache
from typing import TYPE_CHECKING

from google.adk.memory.base_memory_service import BaseMemoryService

from negentropy.config import settings

if TYPE_CHECKING:
    pass


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


def create_postgres_memory_service() -> BaseMemoryService:
    """创建 Postgres 后端 (自研)"""
    from negentropy.adapters.postgres.memory_service import PostgresMemoryService

    # PostgresMemoryService 需要 DatabaseManager，这里暂时使用简化版
    # 实际使用时需要注入 db 和 embedding_fn
    raise NotImplementedError(
        "PostgresMemoryService requires DatabaseManager injection. "
        "Use create_postgres_memory_service_with_deps() instead."
    )


def create_postgres_memory_service_with_deps(db, embedding_fn=None, consolidation_worker=None) -> BaseMemoryService:
    """创建 Postgres 后端 (带依赖注入)"""
    from negentropy.adapters.postgres.memory_service import PostgresMemoryService

    return PostgresMemoryService(db=db, embedding_fn=embedding_fn, consolidation_worker=consolidation_worker)


# 后端创建函数映射表 (Strategy Pattern)
_BACKEND_FACTORIES = {
    MemoryBackend.INMEMORY: create_inmemory_memory_service,
    MemoryBackend.VERTEXAI: create_vertexai_memory_service,
    # postgres 需要特殊处理，见下方 get_memory_service
}


@lru_cache(maxsize=1)
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
        NotImplementedError: postgres 后端需要显式依赖注入
    """
    backend_str = backend or settings.memory_service_backend
    try:
        backend_enum = MemoryBackend(backend_str.lower())
    except ValueError:
        raise ValueError(f"Unsupported memory backend: {backend_str}. Supported: {[b.value for b in MemoryBackend]}")

    if backend_enum == MemoryBackend.POSTGRES:
        raise NotImplementedError(
            "Postgres backend requires dependency injection. Use create_postgres_memory_service_with_deps() directly."
        )

    factory = _BACKEND_FACTORIES.get(backend_enum)
    if not factory:
        raise ValueError(f"No factory registered for backend: {backend_enum}")

    return factory()


__all__ = [
    "MemoryBackend",
    "get_memory_service",
    "create_inmemory_memory_service",
    "create_vertexai_memory_service",
    "create_postgres_memory_service_with_deps",
]
