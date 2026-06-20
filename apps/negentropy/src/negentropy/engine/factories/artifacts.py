"""
ArtifactsFactory: 统一的 ArtifactService 后端工厂

采用 Strategy + Factory 模式，根据配置动态选择 ArtifactService 实现：
- inmemory: ADK 内置 InMemoryArtifactService (开发/测试)
- postgres: 自研 PostgresArtifactService，持久化到 adk_artifacts 表 (生产/本地)
"""

from __future__ import annotations

from enum import Enum

from google.adk.artifacts import BaseArtifactService

from negentropy.config import settings
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.factories.artifacts")


class ArtifactBackend(str, Enum):
    """支持的 ArtifactService 后端类型"""

    INMEMORY = "inmemory"
    POSTGRES = "postgres"


def create_inmemory_artifact_service() -> BaseArtifactService:
    """创建 InMemory 后端"""
    from google.adk.artifacts import InMemoryArtifactService

    return InMemoryArtifactService()


def create_postgres_artifact_service() -> BaseArtifactService:
    """创建 PostgreSQL 后端（自研，默认制品持久化）。

    制品持久化到 ``adk_artifacts`` 表（bytea 存储），无需任何外部凭证 / bucket，
    与 memory/session 的 postgres 后端同库（pgvector 唯一数据存储哲学）。
    """
    from negentropy.engine.adapters.postgres.artifact_service import PostgresArtifactService

    return PostgresArtifactService()


# 后端创建函数映射表 (Strategy Pattern)
_BACKEND_FACTORIES = {
    ArtifactBackend.INMEMORY: create_inmemory_artifact_service,
    ArtifactBackend.POSTGRES: create_postgres_artifact_service,
}

# 模块级单例缓存
_artifact_service_instance: BaseArtifactService | None = None


def get_artifact_service(backend: str | None = None) -> BaseArtifactService:
    """
    获取 ArtifactService 实例 (工厂函数)

    Args:
        backend: 后端类型，可选值：inmemory, postgres
                 若为 None，则从 settings.artifact_service_backend 读取

    Returns:
        BaseArtifactService 实例

    Raises:
        ValueError: 不支持的后端类型
    """
    global _artifact_service_instance

    backend_str = backend or settings.artifact_service_backend
    try:
        backend_enum = ArtifactBackend(backend_str.lower())
    except ValueError:
        raise ValueError(
            f"Unsupported artifact backend: {backend_str}. Supported: {[b.value for b in ArtifactBackend]}"
        ) from None

    # 如果已有缓存实例且未显式指定 backend，直接返回
    if _artifact_service_instance is not None and backend is None:
        return _artifact_service_instance

    factory = _BACKEND_FACTORIES.get(backend_enum)
    if not factory:
        raise ValueError(f"No factory registered for backend: {backend_enum}")

    instance = factory()

    # 仅在未显式指定 backend 时缓存
    if backend is None:
        _artifact_service_instance = instance

    return instance


def reset_artifact_service() -> None:
    """重置单例缓存 (用于测试)"""
    global _artifact_service_instance
    _artifact_service_instance = None


__all__ = [
    "ArtifactBackend",
    "get_artifact_service",
    "reset_artifact_service",
    "create_inmemory_artifact_service",
    "create_postgres_artifact_service",
]
