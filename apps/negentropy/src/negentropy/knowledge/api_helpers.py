"""Shared helper functions extracted from the knowledge API layer."""

from __future__ import annotations

from fastapi import HTTPException, status

from negentropy.config import settings
from negentropy.logging import get_logger

from .exceptions import (
    CorpusNotFound,
    DatabaseError,
    EmbeddingFailed,
    InvalidChunkSize,
    InvalidSearchConfig,
    KnowledgeError,
    SearchError,
    VersionConflict,
)

logger = get_logger("negentropy.knowledge.api_helpers")


def _resolve_app_name(app_name: str | None) -> str:
    return app_name or settings.app_name


def _map_exception_to_http(exc: KnowledgeError) -> HTTPException:
    """将 Knowledge 异常映射到 HTTP 异常

    遵循 RESTful API 设计原则：
    - 400: 请求参数错误
    - 404: 资源不存在
    - 409: 版本冲突
    - 500: 服务器内部错误
    - 502: 上游服务错误（vendor / Embedding 等外部依赖）
    """
    if isinstance(exc, CorpusNotFound):
        logger.warning("corpus_not_found", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": exc.code, "message": str(exc), "details": exc.details},
        )

    if isinstance(exc, VersionConflict):
        logger.warning("version_conflict", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": exc.code, "message": str(exc), "details": exc.details},
        )

    if isinstance(exc, (InvalidChunkSize, InvalidSearchConfig)):
        logger.warning("validation_error", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": exc.code, "message": str(exc), "details": exc.details},
        )

    if isinstance(exc, EmbeddingFailed):
        # 上游 Embedding 服务故障（vendor 4xx/5xx、连接异常等）：
        # 语义上属于 Bad Gateway 而非内部错误，便于前端区分"自身可重试"与"上游修复后再试"。
        logger.error("infrastructure_error", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": exc.code, "message": str(exc), "details": exc.details},
        )

    if isinstance(exc, SearchError):
        logger.error("infrastructure_error", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": exc.code, "message": str(exc), "details": exc.details},
        )

    if isinstance(exc, DatabaseError):
        logger.error("database_error", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": exc.code, "message": "Database operation failed", "details": exc.details},
        )

    # 默认 500 错误
    logger.error("unknown_knowledge_error", error=str(exc))
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"},
    )
