"""``pgvector_check`` handler — 启动时检查 pgvector 扩展可用性。

从 ``bootstrap.py:437-464`` 的 startup hook 平移为 oneshot 任务。
"""

from __future__ import annotations

from negentropy.logging import get_logger

from . import HandlerResult, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.pgvector_check")


@register_handler("pgvector_check")
async def pgvector_check_handler(task) -> HandlerResult:
    from sqlalchemy import text

    from negentropy.db.session import engine as async_engine

    try:
        async with async_engine.connect() as conn:
            result = await conn.execute(text("SELECT extversion FROM pg_extension WHERE extname = 'vector'"))
            version = result.scalar_one_or_none()
            if version:
                logger.info("pgvector_extension_ok", version=version)
                return HandlerResult(status="ok", output_summary=f"pgvector v{version}")
            logger.warning(
                "pgvector_extension_missing",
                hint="psql -d negentropy -c 'CREATE EXTENSION IF NOT EXISTS vector;'",
            )
            return HandlerResult(status="ok", output_summary="pgvector extension missing")
    except Exception as exc:
        msg = str(exc).lower()
        if "vector" in msg and ("could not access" in msg or "undefined file" in msg):
            logger.error(
                "pgvector_library_missing",
                error=str(exc),
                hint="brew install pgvector, then CREATE EXTENSION",
            )
            return HandlerResult(status="failed", error=f"pgvector library missing: {exc}")
        logger.warning("pgvector_check_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))
