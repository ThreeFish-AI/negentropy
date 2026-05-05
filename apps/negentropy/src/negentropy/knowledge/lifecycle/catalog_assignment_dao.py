"""目录条目 ↔ 文档归属 DAO（DOCUMENT_REF 软引用 N:M）

正交职责（自 catalog_dao 拆分）：
  ``DOCUMENT_REF`` 子条目作为 ``DocCatalogEntry`` 与 ``KnowledgeDocument`` 的
  N:M 关联（同一文档可被多目录引用），由本模块统一维护其生命周期：
    - :meth:`assign_document` 幂等创建
    - :meth:`unassign_document` 删除关联
    - :meth:`get_node_documents` / :meth:`get_document_nodes` 双向查询

DOCUMENT_REF 仅由本模块创建——其它入口（如 :class:`CatalogService.create_node`）
显式拒绝该类型。
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.models.perception import DocCatalogEntry, KnowledgeDocument

logger = logging.getLogger("negentropy.knowledge")

__all__ = ["CatalogAssignmentDao"]


class CatalogAssignmentDao:
    """文档归属（``DOCUMENT_REF`` 子条目）"""

    @staticmethod
    async def assign_document(
        db: AsyncSession,
        catalog_entry_id: UUID,
        document_id: UUID,
    ) -> DocCatalogEntry:
        """将文档归入目录条目（幂等：已存在则返回现有 DOCUMENT_REF 子条目）"""
        existing = await db.execute(
            select(DocCatalogEntry).where(
                DocCatalogEntry.parent_entry_id == catalog_entry_id,
                DocCatalogEntry.document_id == document_id,
                DocCatalogEntry.node_type == "DOCUMENT_REF",
            )
        )
        rec = existing.scalar_one_or_none()
        if rec is not None:
            return rec

        # 获取父条目以继承 catalog_id
        parent_result = await db.execute(select(DocCatalogEntry).where(DocCatalogEntry.id == catalog_entry_id))
        parent = parent_result.scalar_one_or_none()
        catalog_id = parent.catalog_id if parent else None

        # 获取 document 元数据以填充 source_corpus_id 和名称
        doc_result = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == document_id))
        doc = doc_result.scalar_one_or_none()
        source_corpus_id = doc.corpus_id if doc else None
        doc_name = (doc.original_filename or str(document_id)) if doc else str(document_id)

        entry = DocCatalogEntry(
            catalog_id=catalog_id,
            parent_entry_id=catalog_entry_id,
            document_id=document_id,
            source_corpus_id=source_corpus_id,
            node_type="DOCUMENT_REF",
            name=doc_name,
            status="ACTIVE",
        )
        db.add(entry)
        await db.flush()
        logger.info(
            "document_assigned_to_catalog",
            extra={
                "catalog_entry_id": str(catalog_entry_id),
                "document_id": str(document_id),
                "source_corpus_id": str(source_corpus_id) if source_corpus_id else None,
            },
        )
        return entry

    @staticmethod
    async def unassign_document(
        db: AsyncSession,
        catalog_entry_id: UUID,
        document_id: UUID,
    ) -> bool:
        """移除文档的目录归属（删除 DOCUMENT_REF 子条目）"""
        result = await db.execute(
            select(DocCatalogEntry).where(
                DocCatalogEntry.parent_entry_id == catalog_entry_id,
                DocCatalogEntry.document_id == document_id,
                DocCatalogEntry.node_type == "DOCUMENT_REF",
            )
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            return False
        await db.delete(entry)
        await db.flush()
        return True

    @staticmethod
    async def get_node_documents(
        db: AsyncSession,
        catalog_entry_id: UUID,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[KnowledgeDocument], int]:
        """获取目录条目下的文档列表（通过 DOCUMENT_REF 子条目，分页）"""
        count_query = (
            select(func.count())
            .select_from(DocCatalogEntry)
            .where(
                DocCatalogEntry.parent_entry_id == catalog_entry_id,
                DocCatalogEntry.node_type == "DOCUMENT_REF",
                DocCatalogEntry.document_id.is_not(None),
            )
        )
        total = (await db.execute(count_query)).scalar() or 0

        query = (
            select(KnowledgeDocument)
            .join(DocCatalogEntry, KnowledgeDocument.id == DocCatalogEntry.document_id)
            .where(
                DocCatalogEntry.parent_entry_id == catalog_entry_id,
                DocCatalogEntry.node_type == "DOCUMENT_REF",
                DocCatalogEntry.document_id.is_not(None),
            )
            .order_by(DocCatalogEntry.position, DocCatalogEntry.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        documents = list((await db.execute(query)).scalars().all())
        return documents, total

    @staticmethod
    async def get_document_nodes(
        db: AsyncSession,
        document_id: UUID,
    ) -> list[DocCatalogEntry]:
        """获取文档所属的所有目录条目（DOCUMENT_REF 条目 backlink）"""
        result = await db.execute(
            select(DocCatalogEntry)
            .where(
                DocCatalogEntry.document_id == document_id,
                DocCatalogEntry.node_type == "DOCUMENT_REF",
            )
            .order_by(DocCatalogEntry.position, DocCatalogEntry.name)
        )
        return list(result.scalars().all())
