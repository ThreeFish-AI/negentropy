"""
文档来源追踪 — 数据访问层 (DAO)

提供 DocSource 表的 CRUD 操作，遵循现有 dao.py 的模式。
"""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.models.perception import DocSource, KnowledgeDocument

logger = logging.getLogger(__name__.rsplit(".", 1)[0])


class SourceDao:
    """DocSource 数据访问对象"""

    @staticmethod
    async def create(
        db: AsyncSession,
        *,
        document_id: UUID,
        source_type: str,
        source_url: str | None = None,
        original_url: str | None = None,
        title: str | None = None,
        author: str | None = None,
        extracted_summary: str | None = None,
        extraction_duration_ms: int | None = None,
        extracted_at: datetime | None = None,
        extractor_tool_name: str | None = None,
        extractor_server_id: str | None = None,
        raw_metadata: dict | None = None,
    ) -> DocSource:
        """创建来源记录"""
        doc_source = DocSource(
            document_id=document_id,
            source_type=source_type,
            source_url=source_url,
            original_url=original_url,
            title=title,
            author=author,
            extracted_summary=extracted_summary,
            extraction_duration_ms=extraction_duration_ms,
            extracted_at=extracted_at,
            extractor_tool_name=extractor_tool_name,
            extractor_server_id=extractor_server_id,
            raw_metadata=raw_metadata or {},
        )
        db.add(doc_source)
        await db.flush()
        logger.info(
            "doc_source_created",
            extra={
                "id": str(doc_source.id),
                "document_id": str(document_id),
                "source_type": source_type,
            },
        )
        return doc_source

    @staticmethod
    async def get_by_id(db: AsyncSession, source_id: UUID) -> DocSource | None:
        """按 ID 获取来源记录"""
        result = await db.execute(select(DocSource).where(DocSource.id == source_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_document_id(db: AsyncSession, document_id: UUID) -> DocSource | None:
        """按文档 ID 获取来源记录"""
        result = await db.execute(select(DocSource).where(DocSource.document_id == document_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_by_corpus(
        db: AsyncSession,
        corpus_id: UUID,
        source_type: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[DocSource], int]:
        """列出语料库下的来源记录（支持分页和过滤）"""
        query = (
            select(DocSource)
            .join(KnowledgeDocument, DocSource.document_id == KnowledgeDocument.id)
            .where(KnowledgeDocument.corpus_id == corpus_id)
        )

        if source_type:
            query = query.where(DocSource.source_type == source_type)

        # 总数查询
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # 分页查询
        query = query.order_by(DocSource.created_at.desc()).offset(offset).limit(limit)
        result = await db.execute(query)
        items = list(result.scalars().all())

        return items, total

    @staticmethod
    async def delete(db: AsyncSession, source_id: UUID) -> bool:
        """删除来源记录（SET NULL 外键）"""
        doc_source = await SourceDao.get_by_id(db, source_id)
        if doc_source is None:
            return False
        # 先清除文档的外键引用
        await db.execute(
            update(KnowledgeDocument).where(KnowledgeDocument.source_id == source_id).values(source_id=None)
        )
        await db.delete(doc_source)
        await db.flush()
        return True
