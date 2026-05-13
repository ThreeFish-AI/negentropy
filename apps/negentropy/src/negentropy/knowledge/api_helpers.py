"""Shared helper functions extracted from the knowledge API layer."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text as sa_text

from negentropy.config import settings
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA

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

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger("negentropy.knowledge.api_helpers")


def _resolve_app_name(app_name: str | None) -> str:
    return app_name or settings.app_name


async def _resolve_corpus_model_ids(
    db: AsyncSession,
    corpus_id: UUID,
) -> tuple[str | None, str | None]:
    """解析 corpus.config['models'] 下的 (embedding_config_id, llm_config_id)。

    复用 ingestion 端在 ``graph/service.py:1341-1354`` 已确立的查询模式，让查询
    路径（Global Search / Graph Search / Multi-hop fallback）的 embedding 与 LLM
    完成模型解析与 ingestion 写入时使用同一份配置——避免「查询用默认 Gemini
    embed、社区摘要用 Corpus 自定义 embed」造成的向量空间错位。

    字段口径与 ``_MODELS_WHITELIST`` / ``_validate_models_references`` 一致：
    JSONB 中实际键为 ``embedding_config_id`` 与 ``llm_config_id`` —— 不是
    ``completion_config_id``，调用方需以此为准。

    Args:
        db: SQLAlchemy AsyncSession。
        corpus_id: 语料库 ID。

    Returns:
        ``(embedding_config_id, llm_config_id)``，任一字段缺失或查询异常时
        为 None；调用方应据此回退到全局默认（``build_embedding_fn(None)`` /
        ``resolve_llm_config()``），保持向后兼容。
    """
    embedding_config_id: str | None = None
    llm_config_id: str | None = None
    try:
        row = await db.execute(
            sa_text(f"""
                SELECT config FROM {NEGENTROPY_SCHEMA}.corpus
                WHERE id = :cid
            """),
            {"cid": str(corpus_id)},
        )
        cfg_val = row.scalar()
        if isinstance(cfg_val, dict):
            models_cfg = cfg_val.get("models")
            if isinstance(models_cfg, dict):
                eid = models_cfg.get("embedding_config_id")
                lid = models_cfg.get("llm_config_id")
                if eid is not None:
                    embedding_config_id = str(eid)
                if lid is not None:
                    llm_config_id = str(lid)
    except Exception as exc:  # noqa: BLE001 - 查询失败 → 静默回退默认
        logger.debug(
            "corpus_model_ids_resolve_failed",
            corpus_id=str(corpus_id),
            error=str(exc),
        )
    return embedding_config_id, llm_config_id


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
