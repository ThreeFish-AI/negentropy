"""
ArtifactsFactory: 统一的 ArtifactService 后端工厂

采用 Strategy + Factory 模式，根据配置动态选择 ArtifactService 实现：
- inmemory: ADK 内置 InMemoryArtifactService (开发/测试)
- gcs: ADK 内置 GcsArtifactService (生产环境)
"""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING

import google.auth
from google.adk.artifacts import BaseArtifactService

from negentropy.config import settings
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.factories.artifacts")

if TYPE_CHECKING:
    pass


class ArtifactBackend(str, Enum):
    """支持的 ArtifactService 后端类型"""

    INMEMORY = "inmemory"
    GCS = "gcs"


def create_inmemory_artifact_service() -> BaseArtifactService:
    """创建 InMemory 后端"""
    from google.adk.artifacts import InMemoryArtifactService

    return InMemoryArtifactService()


def create_gcs_artifact_service() -> BaseArtifactService:
    """创建 GCS 后端；Bucket 或凭证缺失时优雅降级为 inmemory 并告警。

    ArtifactService 属可选外部依赖：本地 / 无凭证场景不应因此阻断服务启动，故采用
    优雅降级（fail-open with warning）而非硬失败。生产环境务必配置 GCS 凭证与 bucket
    ——缺失将降级为 inmemory（制品不持久化、重启丢失）并打 WARNING 日志以暴露问题。
    """
    from google.adk.artifacts import GcsArtifactService, InMemoryArtifactService

    if not settings.gcs_bucket_name:
        logger.warning(
            "GCS_BUCKET_NAME 未配置，ArtifactService 降级为 inmemory（仅适用本地开发；"
            "生产环境请配置 GCS bucket 与凭证，否则制品将不持久化）"
        )
        return InMemoryArtifactService()

    # 凭证缺失 → 降级（生产凭证配错时亦不崩溃，但 WARNING 暴露问题，优于服务完全不可用）
    try:
        google.auth.default()
    except google.auth.exceptions.DefaultCredentialsError:
        logger.warning(
            "GCS 凭证缺失（未设置 GOOGLE_APPLICATION_CREDENTIALS），ArtifactService 降级为 inmemory"
            "（仅适用本地开发；生产环境请注入 GCS 凭证，否则制品将不持久化）"
        )
        return InMemoryArtifactService()

    return GcsArtifactService(bucket_name=settings.gcs_bucket_name)


# 后端创建函数映射表 (Strategy Pattern)
_BACKEND_FACTORIES = {
    ArtifactBackend.INMEMORY: create_inmemory_artifact_service,
    ArtifactBackend.GCS: create_gcs_artifact_service,
}

# 模块级单例缓存
_artifact_service_instance: BaseArtifactService | None = None


def get_artifact_service(backend: str | None = None) -> BaseArtifactService:
    """
    获取 ArtifactService 实例 (工厂函数)

    Args:
        backend: 后端类型，可选值：inmemory, gcs
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
    "create_gcs_artifact_service",
]
