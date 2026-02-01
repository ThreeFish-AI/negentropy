"""
SessionServiceFactory: 统一的 SessionService 后端工厂

采用 Strategy + Factory 模式，根据配置动态选择 SessionService 实现：
- inmemory: ADK 内置 InMemorySessionService (开发/测试)
- vertexai: ADK 内置 VertexAiSessionService (GCP 生产环境)
- database: ADK 内置 DatabaseSessionService (PostgreSQL/MySQL/SQLite)
"""

from __future__ import annotations

from enum import Enum
from functools import lru_cache
from typing import TYPE_CHECKING

from google.adk.sessions.base_session_service import BaseSessionService

from negentropy.config import settings

if TYPE_CHECKING:
    pass


class SessionBackend(str, Enum):
    """支持的 SessionService 后端类型"""

    INMEMORY = "inmemory"
    VERTEXAI = "vertexai"
    POSTGRES = "postgres"


def create_inmemory_session_service() -> BaseSessionService:
    """创建 InMemory 后端 (ADK 内置)"""
    from google.adk.sessions import InMemorySessionService

    return InMemorySessionService()


def create_vertexai_session_service() -> BaseSessionService:
    """创建 VertexAI 后端 (ADK 内置)"""
    from google.adk.sessions import VertexAiSessionService

    if not settings.vertex_project_id or not settings.vertex_location:
        raise ValueError("VertexAI SessionService requires VERTEX_PROJECT_ID and VERTEX_LOCATION")

    return VertexAiSessionService(
        project=settings.vertex_project_id,
        location=settings.vertex_location,
    )


def create_postgres_session_service() -> BaseSessionService:
    """创建 Postgres 后端 (ADK 内置，使用 DATABASE_URL)"""
    from google.adk.sessions import DatabaseSessionService

    if not settings.database_url:
        raise ValueError("Database SessionService requires DATABASE_URL")

    return DatabaseSessionService(db_url=settings.database_url)


# 后端创建函数映射表 (Strategy Pattern)
_BACKEND_FACTORIES = {
    SessionBackend.INMEMORY: create_inmemory_session_service,
    SessionBackend.VERTEXAI: create_vertexai_session_service,
    SessionBackend.POSTGRES: create_postgres_session_service,
}


@lru_cache(maxsize=1)
def get_session_service(backend: str | None = None) -> BaseSessionService:
    """
    获取 SessionService 实例 (工厂函数)

    Args:
        backend: 后端类型，可选值：inmemory, vertexai, postgres
                 若为 None，则从 settings.session_service_backend 读取

    Returns:
        BaseSessionService 实例

    Raises:
        ValueError: 不支持的后端类型
    """
    backend_str = backend or settings.session_service_backend
    try:
        backend_enum = SessionBackend(backend_str.lower())
    except ValueError:
        raise ValueError(f"Unsupported session backend: {backend_str}. Supported: {[b.value for b in SessionBackend]}")

    factory = _BACKEND_FACTORIES.get(backend_enum)
    if not factory:
        raise ValueError(f"No factory registered for backend: {backend_enum}")

    return factory()


__all__ = [
    "SessionBackend",
    "get_session_service",
    "create_inmemory_session_service",
    "create_vertexai_session_service",
    "create_postgres_session_service",
]
