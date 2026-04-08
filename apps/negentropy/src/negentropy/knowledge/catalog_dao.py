"""
文档目录编目 — 数据访问层 (DAO)

提供 DocCatalogNode / DocCatalogMembership 表的 CRUD 操作，
包含 PostgreSQL Recursive CTE 树查询实现。
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Integer,
    Select,
    Text,
    func,
    literal_column,
    select,
    text,
    union_all,
)
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.models.perception import (
    DocCatalogMembership,
    DocCatalogNode,
    KnowledgeDocument,
)
from negentropy.models.base import NEGENTROPY_SCHEMA

logger = logging.getLogger(__name__.rsplit(".", 1)[0])

# 目录树最大递归深度（防止无限循环或超深树导致性能问题）
MAX_TREE_DEPTH = 6


class CatalogDao:
    """目录节点数据访问对象"""

    # ------------------------------------------------------------------
    # 节点 CRUD
    # ------------------------------------------------------------------

    @staticmethod
    async def create_node(
        db: AsyncSession,
        *,
        corpus_id: UUID,
        name: str,
        slug: str,
        parent_id: Optional[UUID] = None,
        node_type: str = "category",
        description: Optional[str] = None,
        sort_order: int = 0,
        config: Optional[dict] = None,
    ) -> DocCatalogNode:
        """创建目录节点"""
        node = DocCatalogNode(
            corpus_id=corpus_id,
            name=name,
            slug=slug,
            parent_id=parent_id,
            node_type=node_type,
            description=description,
            sort_order=sort_order,
            config=config or {},
        )
        db.add(node)
        await db.flush()
        logger.info("catalog_node_created", extra={
            "id": str(node.id),
            "corpus_id": str(corpus_id),
            "name": name,
            "slug": slug,
            "parent_id": str(parent_id) if parent_id else None,
        })
        return node

    @staticmethod
    async def get_node(db: AsyncSession, node_id: UUID) -> DocCatalogNode | None:
        """按 ID 获取节点"""
        result = await db.execute(
            select(DocCatalogNode).where(DocCatalogNode.id == node_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_node_by_slug(
        db: AsyncSession, corpus_id: UUID, slug: str
    ) -> DocCatalogNode | None:
        """按 corpus + slug 获取节点（slug 在同一 corpus 内唯一）"""
        result = await db.execute(
            select(DocCatalogNode).where(
                DocCatalogNode.corpus_id == corpus_id,
                DocCatalogNode.slug == slug,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_node(
        db: AsyncSession,
        node_id: UUID,
        *,
        name: Optional[str] = None,
        slug: Optional[str] = None,
        parent_id: Optional[UUID] = None,
        node_type: Optional[str] = None,
        description: Optional[str] = None,
        sort_order: Optional[int] = None,
        config: Optional[dict] = None,
    ) -> DocCatalogNode | None:
        """更新目录节点（仅更新传入的非 None 字段）"""
        node = await CatalogDao.get_node(db, node_id)
        if node is None:
            return None

        updates: dict = {}
        if name is not None:
            updates["name"] = name
        if slug is not None:
            updates["slug"] = slug
        if parent_id is not None:
            updates["parent_id"] = parent_id
        if node_type is not None:
            updates["node_type"] = node_type
        if description is not None:
            updates["description"] = description
        if sort_order is not None:
            updates["sort_order"] = sort_order
        if config is not None:
            updates["config"] = config

        for key, value in updates.items():
            setattr(node, key, value)

        await db.flush()
        logger.info("catalog_node_updated", extra={"id": str(node_id), "updates": list(updates.keys())})
        return node

    @staticmethod
    async def delete_node(db: AsyncSession, node_id: UUID) -> bool:
        """删除目录节点（级联删除子节点和关联关系）"""
        node = await CatalogDao.get_node(db, node_id)
        if node is None:
            return False
        await db.delete(node)
        await db.flush()
        logger.info("catalog_node_deleted", extra={"id": str(node_id)})
        return True

    # ------------------------------------------------------------------
    # 树查询 (Recursive CTE)
    # ------------------------------------------------------------------

    @staticmethod
    async def get_tree(
        db: AsyncSession,
        corpus_id: UUID,
        max_depth: int = MAX_TREE_DEPTH,
    ) -> list[dict]:
        """获取完整目录树（扁平化列表，含 depth 信息）

        使用 PostgreSQL WITH RECURSIVE CTE 实现 Adjacency List 到层级结构的转换。

        Returns:
            扁平化的节点列表，每个元素包含：
            - id, parent_id, name, slug, node_type, description, sort_order, config
            - depth: 层级深度（根节点为 0）
            - path: 从根到当前节点的 ID 路径数组
        """
        schema = NEGENTROPY_SCHEMA

        cte = (
            select(
                DocCatalogNode.id,
                DocCatalogNode.parent_id,
                DocCatalogNode.name,
                DocCatalogNode.slug,
                DocCatalogNode.node_type,
                DocCatalogNode.description,
                DocCatalogNode.sort_order,
                DocCatalogNode.config,
                literal_column("0").label("depth"),
                func.array([DocCatalogNode.id]).label("path"),
            )
            .where(
                DocCatalogNode.corpus_id == corpus_id,
                DocCatalogNode.parent_id.is_(None),
            )
            .cte("cat_tree", recursive=True)
        )

        recursive_part = select(
            DocCatalogNode.id,
            DocCatalogNode.parent_id,
            DocCatalogNode.name,
            DocCatalogNode.slug,
            DocCatalogNode.node_type,
            DocCatalogNode.description,
            DocCatalogNode.sort_order,
            DocCatalogNode.config,
            (cte.c.depth + 1).label("depth"),
            (cte.c.path + func.array([DocCatalogNode.id])).label("path"),
        ).join(
            cte,
            DocCatalogNode.parent_id == cte.c.id,
        )

        full_tree = union_all(cte.select(), recursive_part).alias("tree_result")
        # 限制最大深度，防止超深树导致性能问题
        query = (
            select(full_tree)
            .where(full_tree.c.depth <= max_depth)
            .order_by(full_tree.c.depth, full_tree.c.sort_order, full_tree.c.name)
        )

        result = await db.execute(query)
        rows = result.all()

        tree_data = []
        for row in rows:
            tree_data.append({
                "id": row[0],
                "parent_id": row[1],
                "name": row[2],
                "slug": row[3],
                "node_type": row[4],
                "description": row[5],
                "sort_order": row[6],
                "config": row[7],
                "depth": row[8],
                "path": list(row[9]) if row[9] else [],
            })

        logger.debug("catalog_tree_queried", extra={
            "corpus_id": str(corpus_id),
            "node_count": len(tree_data),
        })
        return tree_data

    @staticmethod
    async def get_subtree(
        db: AsyncSession,
        node_id: UUID,
        max_depth: int = MAX_TREE_DEPTH,
    ) -> list[dict]:
        """获取以指定节点为根的子树"""
        schema = NEGENTROPY_SCHEMA

        anchor = (
            select(
                DocCatalogNode.id,
                DocCatalogNode.parent_id,
                DocCatalogNode.name,
                DocCatalogNode.slug,
                DocCatalogNode.node_type,
                DocCatalogNode.description,
                DocCatalogNode.sort_order,
                DocCatalogNode.config,
                literal_column("0").label("depth"),
                func.array([DocCatalogNode.id]).label("path"),
            )
            .where(DocCatalogNode.id == node_id)
            .cte("sub_tree", recursive=True)
        )

        recursive_part = select(
            DocCatalogNode.id,
            DocCatalogNode.parent_id,
            DocCatalogNode.name,
            DocCatalogNode.slug,
            DocCatalogNode.node_type,
            DocCatalogNode.description,
            DocCatalogNode.sort_order,
            DocCatalogNode.config,
            (anchor.c.depth + 1).label("depth"),
            (anchor.c.path + func.array([DocCatalogNode.id])).label("path"),
        ).join(
            anchor,
            DocCatalogNode.parent_id == anchor.c.id,
        )

        full_tree = union_all(anchor.select(), recursive_part).alias("subtree_result")
        query = (
            select(full_tree)
            .where(full_tree.c.depth <= max_depth)
            .order_by(full_tree.c.depth, full_tree.c.sort_order)
        )

        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "id": row[0], "parent_id": row[1], "name": row[2], "slug": row[3],
                "node_type": row[4], "description": row[5], "sort_order": row[6],
                "config": row[7], "depth": row[8], "path": list(row[9]) if row[9] else [],
            }
            for row in rows
        ]

    # ------------------------------------------------------------------
    # 文档归属管理 (Membership)
    # ------------------------------------------------------------------

    @staticmethod
    async def assign_document(
        db: AsyncSession,
        catalog_node_id: UUID,
        document_id: UUID,
    ) -> DocCatalogMembership:
        """将文档归入目录节点（幂等：已存在则返回现有记录）"""
        # 检查是否已存在
        existing = await db.execute(
            select(DocCatalogMembership).where(
                DocCatalogMembership.catalog_node_id == catalog_node_id,
                DocCatalogMembership.document_id == document_id,
            )
        )
        existing_rec = existing.scalar_one_or_none()
        if existing_rec is not None:
            return existing_rec

        membership = DocCatalogMembership(
            catalog_node_id=catalog_node_id,
            document_id=document_id,
        )
        db.add(membership)
        await db.flush()
        logger.info("document_assigned_to_catalog", extra={
            "catalog_node_id": str(catalog_node_id),
            "document_id": str(document_id),
        })
        return membership

    @staticmethod
    async def unassign_document(
        db: AsyncSession,
        catalog_node_id: UUID,
        document_id: UUID,
    ) -> bool:
        """移除文档的目录归属"""
        result = await db.execute(
            select(DocCatalogMembership).where(
                DocCatalogMembership.catalog_node_id == catalog_node_id,
                DocCatalogMembership.document_id == document_id,
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            return False
        await db.delete(membership)
        await db.flush()
        return True

    @staticmethod
    async def get_node_documents(
        db: AsyncSession,
        catalog_node_id: UUID,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[KnowledgeDocument], int]:
        """获取目录节点下的文档列表（分页）"""
        count_query = select(func.count()).select_from(
            select(DocCatalogMembership.document_id)
            .where(DocCatalogMembership.catalog_node_id == catalog_node_id)
            .subquery()
        )
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = (
            select(KnowledgeDocument)
            .join(DocCatalogMembership, KnowledgeDocument.id == DocCatalogMembership.document_id)
            .where(DocCatalogMembership.catalog_node_id == catalog_node_id)
            .order_by(DocCatalogMembership.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await db.execute(query)
        documents = list(result.scalars().all())

        return documents, total

    @staticmethod
    async def get_document_nodes(
        db: AsyncSession,
        document_id: UUID,
    ) -> list[DocCatalogNode]:
        """获取文档所属的所有目录节点"""
        result = await db.execute(
            select(DocCatalogNode)
            .join(DocCatalogMembership, DocCatalogNode.id == DocCatalogMembership.catalog_node_id)
            .where(DocCatalogMembership.document_id == document_id)
            .order_by(DocCatalogNode.sort_order, DocCatalogNode.name)
        )
        return list(result.scalars().all())
