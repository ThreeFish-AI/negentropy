"""
SummaryService: 记忆摘要存储服务

管理 MemorySummary 的 CRUD 操作，采用 INSERT ON CONFLICT UPDATE 的 upsert 语义。

参考文献:
[1] S. J. Sara, "Reconsolidation and the stability of memory traces,"
    Current Opinion in Neurobiology, vol. 35, pp. 110-115, 2015.
"""

from __future__ import annotations

from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import MemorySummary

logger = get_logger("negentropy.engine.adapters.postgres.summary_service")


class SummaryService:
    async def upsert_summary(
        self,
        *,
        user_id: str,
        app_name: str,
        summary_type: str,
        content: str,
        token_count: int | None = None,
        source_memory_count: int | None = None,
        source_fact_count: int | None = None,
        model_used: str | None = None,
    ) -> MemorySummary:
        stmt = insert(MemorySummary).values(
            user_id=user_id,
            app_name=app_name,
            summary_type=summary_type,
            content=content,
            token_count=token_count,
            source_memory_count=source_memory_count,
            source_fact_count=source_fact_count,
            model_used=model_used,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="memory_summaries_user_type_unique",
            set_={
                "content": stmt.excluded.content,
                "token_count": stmt.excluded.token_count,
                "source_memory_count": stmt.excluded.source_memory_count,
                "source_fact_count": stmt.excluded.source_fact_count,
                "model_used": stmt.excluded.model_used,
                "updated_at": datetime.now(UTC),
            },
        )
        stmt = stmt.returning(MemorySummary)

        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(stmt)
            row = result.scalar_one()
            await db.commit()

        logger.debug(
            "summary_upserted",
            user_id=user_id,
            app_name=app_name,
            summary_type=summary_type,
            token_count=token_count,
        )
        return row

    async def get_summary(
        self,
        *,
        user_id: str,
        app_name: str,
        summary_type: str = "user_profile",
    ) -> MemorySummary | None:
        async with db_session.AsyncSessionLocal() as db:
            stmt = sa.select(MemorySummary).where(
                MemorySummary.user_id == user_id,
                MemorySummary.app_name == app_name,
                MemorySummary.summary_type == summary_type,
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    async def delete_summary(
        self,
        *,
        user_id: str,
        app_name: str,
        summary_type: str = "user_profile",
    ) -> bool:
        async with db_session.AsyncSessionLocal() as db:
            stmt = sa.delete(MemorySummary).where(
                MemorySummary.user_id == user_id,
                MemorySummary.app_name == app_name,
                MemorySummary.summary_type == summary_type,
            )
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount > 0
