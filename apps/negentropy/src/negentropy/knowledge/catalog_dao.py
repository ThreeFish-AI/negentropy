"""
文档目录编目 — 数据访问层 (DAO)

Phase 6 重写：基于 DocCatalog（全局顶层）+ DocCatalogEntry（N:M 融合节点）。
保留与旧接口兼容的节点方法（corpus_id 参数已改为 catalog_id）。
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.slug import compute_slug as _compute_slug  # 历史 API 兼容别名
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.perception import DocCatalog, DocCatalogEntry, KnowledgeDocument

logger = logging.getLogger(__name__.rsplit(".", 1)[0])

# 目录树最大递归深度（防止无限循环或超深树导致性能问题）
MAX_TREE_DEPTH = 6

# node_type 大小写映射（API 层传入小写，ORM Enum 存储大写）
_NODE_TYPE_TO_ENUM = {"category": "CATEGORY", "collection": "COLLECTION", "document_ref": "DOCUMENT_REF"}
_ENUM_TO_NODE_TYPE = {"CATEGORY": "category", "COLLECTION": "collection", "DOCUMENT_REF": "document_ref"}

__all__ = ["CatalogDao", "_ENUM_TO_NODE_TYPE", "_compute_slug", "MAX_TREE_DEPTH"]


class CatalogDao:
    """DocCatalog 顶层 CRUD + DocCatalogEntry 节点操作

    async 懒加载契约（详见 ISSUE-010 三阶）：当前所有 handler 对 ``DocCatalog`` /
    ``DocCatalogEntry`` 仅访问标量列、或通过 ``get_tree``（递归 CTE）/
    ``get_node_documents``（显式 JOIN）返回 dict / 显式查询结果，避开关系遍历。
    新增 handler 若需访问 ``catalog.entries`` / ``entry.children`` /
    ``entry.document`` / ``entry.source_corpus`` 等关系，**必须**在对应 DAO 查询层
    挂 ``selectinload(...)`` / ``joinedload(...)``，否则会触发
    ``sqlalchemy.exc.MissingGreenlet``。
    """

    # ------------------------------------------------------------------
    # DocCatalog 顶层 CRUD
    # ------------------------------------------------------------------

    @staticmethod
    async def create_catalog(
        db: AsyncSession,
        *,
        app_name: str,
        name: str,
        slug: str,
        owner_id: str | None = None,
        description: str | None = None,
        visibility: str = "INTERNAL",
        config: dict | None = None,
    ) -> DocCatalog:
        """创建 Catalog（初始版本为 1，未归档）"""
        catalog = DocCatalog(
            app_name=app_name,
            name=name,
            slug=slug,
            owner_id=owner_id,
            description=description,
            visibility=visibility,
            config=config or {},
            version=1,
            is_archived=False,
        )
        db.add(catalog)
        await db.flush()
        logger.info(
            "catalog_created",
            extra={"id": str(catalog.id), "app_name": app_name, "slug": slug},
        )
        return catalog

    @staticmethod
    async def get_catalog(db: AsyncSession, catalog_id: UUID) -> DocCatalog | None:
        """按 ID 获取 Catalog"""
        result = await db.execute(select(DocCatalog).where(DocCatalog.id == catalog_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_catalog_by_slug(db: AsyncSession, app_name: str, slug: str) -> DocCatalog | None:
        """按 app_name + slug 获取 Catalog（slug 在租户内唯一）"""
        result = await db.execute(select(DocCatalog).where(DocCatalog.app_name == app_name, DocCatalog.slug == slug))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_catalogs(
        db: AsyncSession,
        *,
        app_name: str | None = None,
        include_archived: bool = False,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[DocCatalog], int]:
        """列出 Catalog（支持按 app_name 过滤、归档过滤）"""
        query = select(DocCatalog)
        count_base = select(func.count()).select_from(DocCatalog)
        if app_name is not None:
            query = query.where(DocCatalog.app_name == app_name)
            count_base = count_base.where(DocCatalog.app_name == app_name)
        if not include_archived:
            query = query.where(DocCatalog.is_archived.is_(False))
            count_base = count_base.where(DocCatalog.is_archived.is_(False))
        total = (await db.execute(count_base)).scalar() or 0
        query = query.order_by(DocCatalog.created_at.desc()).offset(offset).limit(limit)
        items = list((await db.execute(query)).scalars().all())
        return items, total

    @staticmethod
    async def update_catalog(db: AsyncSession, catalog_id: UUID, **kwargs: Any) -> DocCatalog | None:
        """更新 Catalog 属性（不允许修改 app_name）"""
        catalog = await CatalogDao.get_catalog(db, catalog_id)
        if catalog is None:
            return None
        allowed = {"name", "description", "visibility", "config"}
        for k, v in kwargs.items():
            if k in allowed and v is not None:
                setattr(catalog, k, v)
        await db.flush()
        return catalog

    @staticmethod
    async def archive_catalog(db: AsyncSession, catalog_id: UUID) -> DocCatalog | None:
        """软归档 Catalog（is_archived=True）"""
        catalog = await CatalogDao.get_catalog(db, catalog_id)
        if catalog is None:
            return None
        catalog.is_archived = True
        await db.flush()
        logger.info("catalog_archived", extra={"id": str(catalog_id)})
        return catalog

    @staticmethod
    async def delete_catalog(db: AsyncSession, catalog_id: UUID) -> bool:
        """删除 Catalog（级联删除所有 entries）"""
        catalog = await CatalogDao.get_catalog(db, catalog_id)
        if catalog is None:
            return False
        await db.delete(catalog)
        await db.flush()
        logger.info("catalog_deleted", extra={"id": str(catalog_id)})
        return True

    # ------------------------------------------------------------------
    # DocCatalogEntry 节点操作（接口对齐旧 DocCatalogNode；corpus_id → catalog_id）
    # ------------------------------------------------------------------

    @staticmethod
    async def create_node(
        db: AsyncSession,
        *,
        catalog_id: UUID,
        name: str,
        slug: str | None = None,
        parent_id: UUID | None = None,
        node_type: str = "category",
        description: str | None = None,
        sort_order: int = 0,
        config: dict | None = None,
    ) -> DocCatalogEntry:
        """创建目录条目节点（CATEGORY / COLLECTION）"""
        entry = DocCatalogEntry(
            catalog_id=catalog_id,
            name=name,
            slug_override=slug or None,
            parent_entry_id=parent_id,
            node_type=_NODE_TYPE_TO_ENUM.get(node_type, "CATEGORY"),
            description=description,
            position=sort_order,
            config=config or {},
            status="ACTIVE",
        )
        db.add(entry)
        await db.flush()
        logger.info(
            "catalog_node_created",
            extra={
                "id": str(entry.id),
                "catalog_id": str(catalog_id),
                "node_name": name,
                "slug_override": slug,
                "parent_id": str(parent_id) if parent_id else None,
            },
        )
        return entry

    @staticmethod
    async def get_node(db: AsyncSession, node_id: UUID) -> DocCatalogEntry | None:
        """按 ID 获取条目节点"""
        result = await db.execute(select(DocCatalogEntry).where(DocCatalogEntry.id == node_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_node_by_slug(db: AsyncSession, catalog_id: UUID, slug: str) -> DocCatalogEntry | None:
        """按 catalog_id + slug_override 获取节点"""
        result = await db.execute(
            select(DocCatalogEntry).where(
                DocCatalogEntry.catalog_id == catalog_id,
                DocCatalogEntry.slug_override == slug,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_node(
        db: AsyncSession,
        node_id: UUID,
        *,
        name: str | None = None,
        slug: str | None = None,
        parent_id: UUID | None = None,
        node_type: str | None = None,
        description: str | None = None,
        sort_order: int | None = None,
        config: dict | None = None,
    ) -> DocCatalogEntry | None:
        """更新目录条目节点（仅更新传入的非 None 字段）"""
        entry = await CatalogDao.get_node(db, node_id)
        if entry is None:
            return None
        if name is not None:
            entry.name = name
        if slug is not None:
            entry.slug_override = slug
        if parent_id is not None:
            entry.parent_entry_id = parent_id
        if node_type is not None:
            entry.node_type = _NODE_TYPE_TO_ENUM.get(node_type, node_type)
        if description is not None:
            entry.description = description
        if sort_order is not None:
            entry.position = sort_order
        if config is not None:
            entry.config = config
        await db.flush()
        logger.info("catalog_node_updated", extra={"id": str(node_id)})
        return entry

    @staticmethod
    async def delete_node(db: AsyncSession, node_id: UUID) -> bool:
        """删除目录条目节点（CASCADE 自动清理子节点和 DOCUMENT_REF 子条目）"""
        entry = await CatalogDao.get_node(db, node_id)
        if entry is None:
            return False
        await db.delete(entry)
        await db.flush()
        logger.info("catalog_node_deleted", extra={"id": str(node_id)})
        return True

    # ------------------------------------------------------------------
    # 树查询 (Recursive CTE on doc_catalog_entries)
    # ------------------------------------------------------------------

    @staticmethod
    async def get_tree(
        db: AsyncSession,
        catalog_id: UUID,
        max_depth: int = MAX_TREE_DEPTH,
    ) -> list[dict]:
        """获取 Catalog 完整目录树（扁平化列表，含 depth / path）

        仅返回 CATEGORY / COLLECTION 结构节点（跳过 DOCUMENT_REF 叶节点），
        与旧 doc_catalog_nodes 语义保持一致。

        Returns:
            扁平化节点列表，每个元素包含：
            id, parent_id, name, slug, node_type, description,
            sort_order, config, catalog_id, depth, path
        """
        table = f"{NEGENTROPY_SCHEMA}.doc_catalog_entries"

        stmt = text(f"""
            WITH RECURSIVE cat_tree AS (
                SELECT
                    id, parent_entry_id AS parent_id, name, slug_override, node_type,
                    description, position AS sort_order, config, catalog_id,
                    0 AS depth, ARRAY[id] AS path
                FROM {table}
                WHERE catalog_id = :catalog_id AND parent_entry_id IS NULL
                  AND node_type IN ('CATEGORY', 'COLLECTION')

                UNION ALL

                SELECT
                    n.id, n.parent_entry_id, n.name, n.slug_override, n.node_type,
                    n.description, n.position, n.config, n.catalog_id,
                    ct.depth + 1, ct.path || n.id
                FROM {table} n
                JOIN cat_tree ct ON n.parent_entry_id = ct.id
                WHERE n.node_type IN ('CATEGORY', 'COLLECTION')
            )
            SELECT id, parent_id, name, slug_override, node_type,
                   description, sort_order, config, catalog_id, depth, path
            FROM cat_tree
            WHERE depth <= :max_depth
            ORDER BY depth, sort_order, name
        """)

        rows = (await db.execute(stmt, {"catalog_id": str(catalog_id), "max_depth": max_depth})).all()

        tree_data = [
            {
                "id": row[0],
                "parent_id": row[1],
                "name": row[2],
                "slug": _compute_slug(row[2], row[3]),
                "slug_override": row[3],
                "node_type": _ENUM_TO_NODE_TYPE.get(row[4], row[4]) if row[4] else row[4],
                "description": row[5],
                "sort_order": row[6],
                "config": row[7],
                "catalog_id": row[8],
                "depth": row[9],
                "path": list(row[10]) if row[10] else [],
            }
            for row in rows
        ]

        logger.debug(
            "catalog_tree_queried",
            extra={"catalog_id": str(catalog_id), "node_count": len(tree_data)},
        )
        return tree_data

    @staticmethod
    async def get_subtree(
        db: AsyncSession,
        entry_id: UUID,
        max_depth: int = MAX_TREE_DEPTH,
    ) -> list[dict]:
        """获取以指定条目为根的子树（仅 CATEGORY / COLLECTION 节点）"""
        table = f"{NEGENTROPY_SCHEMA}.doc_catalog_entries"

        stmt = text(f"""
            WITH RECURSIVE sub_tree AS (
                SELECT
                    id, parent_entry_id AS parent_id, name, slug_override, node_type,
                    description, position AS sort_order, config, catalog_id,
                    0 AS depth, ARRAY[id] AS path
                FROM {table}
                WHERE id = :entry_id AND node_type IN ('CATEGORY', 'COLLECTION')

                UNION ALL

                SELECT
                    n.id, n.parent_entry_id, n.name, n.slug_override, n.node_type,
                    n.description, n.position, n.config, n.catalog_id,
                    st.depth + 1, st.path || n.id
                FROM {table} n
                JOIN sub_tree st ON n.parent_entry_id = st.id
                WHERE n.node_type IN ('CATEGORY', 'COLLECTION')
            )
            SELECT id, parent_id, name, slug_override, node_type,
                   description, sort_order, config, catalog_id, depth, path
            FROM sub_tree
            WHERE depth <= :max_depth
            ORDER BY depth, sort_order
        """)

        rows = (await db.execute(stmt, {"entry_id": str(entry_id), "max_depth": max_depth})).all()

        return [
            {
                "id": row[0],
                "parent_id": row[1],
                "name": row[2],
                "slug": _compute_slug(row[2], row[3]),
                "slug_override": row[3],
                "node_type": _ENUM_TO_NODE_TYPE.get(row[4], row[4]) if row[4] else row[4],
                "description": row[5],
                "sort_order": row[6],
                "config": row[7],
                "catalog_id": row[8],
                "depth": row[9],
                "path": list(row[10]) if row[10] else [],
            }
            for row in rows
        ]

    # ------------------------------------------------------------------
    # 文档归属管理（通过 DOCUMENT_REF 子条目实现）
    # ------------------------------------------------------------------

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
        parent = await CatalogDao.get_node(db, catalog_entry_id)
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
