"""
文档目录编目 — 服务层

提供 Catalog（全局顶层）及 CatalogEntry 节点的创建、移动、查询、
文档归属管理等功能。

核心能力：
  - Catalog CRUD（全局租户隔离，app_name 不可变）
  - 递归树查询（基于 PostgreSQL Recursive CTE）
  - 节点 CRUD + 移动（更新 parent_id，防循环引用）
  - 文档归类 / 取消归类（权限三级取交集：跨 app_name 禁止）
"""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.catalog_dao import CatalogDao
from negentropy.logging import get_logger
from negentropy.models.perception import DocCatalog, DocCatalogEntry, KnowledgeDocument

logger = get_logger(__name__.rsplit(".", 1)[0])

# slug 合法字符集（URL-friendly）
_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class CatalogService:
    """文档目录编目服务"""

    # ------------------------------------------------------------------
    # Catalog 顶层管理
    # ------------------------------------------------------------------

    async def create_catalog(
        self,
        db: AsyncSession,
        *,
        app_name: str,
        name: str,
        slug: str | None = None,
        owner_id: str | None = None,
        description: str | None = None,
        visibility: str = "INTERNAL",
        config: dict | None = None,
    ) -> DocCatalog:
        """创建全局 Catalog

        Args:
            db: 数据库会话
            app_name: 租户标识（创建后不可变）
            name: Catalog 名称
            slug: URL 标识（不传则从 name 自动生成；租户内唯一）
            owner_id: 归属账号（审计）
            description: 描述文本
            visibility: PRIVATE / INTERNAL / PUBLIC
            config: 扩展配置

        Returns:
            创建的 DocCatalog

        Raises:
            ValueError: slug 格式错误或租户内重复
        """
        if not slug:
            slug = self._slugify(name)

        if not _SLUG_PATTERN.match(slug):
            raise ValueError(
                f"Invalid slug format: {slug!r}. Must contain only lowercase alphanumeric characters and hyphens."
            )

        return await CatalogDao.create_catalog(
            db,
            app_name=app_name,
            name=name,
            slug=slug,
            owner_id=owner_id,
            description=description,
            visibility=visibility,
            config=config,
        )

    async def get_catalog(self, db: AsyncSession, catalog_id: UUID) -> DocCatalog | None:
        """获取单个 Catalog"""
        return await CatalogDao.get_catalog(db, catalog_id)

    async def list_catalogs(
        self,
        db: AsyncSession,
        *,
        app_name: str | None = None,
        include_archived: bool = False,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[DocCatalog], int]:
        """列出 Catalog（支持 app_name 过滤 + 归档过滤）"""
        return await CatalogDao.list_catalogs(
            db,
            app_name=app_name,
            include_archived=include_archived,
            offset=offset,
            limit=limit,
        )

    async def update_catalog(
        self,
        db: AsyncSession,
        catalog_id: UUID,
        **kwargs: Any,
    ) -> DocCatalog | None:
        """更新 Catalog 属性（app_name 不允许修改）"""
        if "app_name" in kwargs:
            raise ValueError("app_name is immutable and cannot be changed after creation")
        if "slug" in kwargs and kwargs["slug"]:
            if not _SLUG_PATTERN.match(kwargs["slug"]):
                raise ValueError(f"Invalid slug format: {kwargs['slug']!r}")
        return await CatalogDao.update_catalog(db, catalog_id, **kwargs)

    async def archive_catalog(self, db: AsyncSession, catalog_id: UUID) -> DocCatalog | None:
        """软归档 Catalog（is_archived=True；归档后禁止新增 entry）"""
        return await CatalogDao.archive_catalog(db, catalog_id)

    async def delete_catalog(self, db: AsyncSession, catalog_id: UUID) -> bool:
        """删除 Catalog（级联删除所有条目，不影响源文档）"""
        return await CatalogDao.delete_catalog(db, catalog_id)

    # ------------------------------------------------------------------
    # 节点管理
    # ------------------------------------------------------------------

    async def create_node(
        self,
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
        """创建目录节点

        Args:
            db: 数据库会话
            catalog_id: 所属 Catalog ID
            name: 节点名称
            slug: URL 友好标识（不传则从 name 自动生成）
            parent_id: 父节点 ID（None 表示根节点）
            node_type: 节点类型 (category/collection/document_ref)
            description: 描述文本
            sort_order: 排序权重
            config: JSONB 配置字典

        Returns:
            创建的节点对象

        Raises:
            ValueError: node_type 不合法、slug 格式错误或父节点不属于同一 catalog
        """
        # 校验 node_type
        valid_types = {"category", "collection", "document_ref"}
        if node_type not in valid_types:
            raise ValueError(f"Invalid node_type: {node_type!r}. Must be one of {valid_types}")

        # 自动生成 slug
        if not slug:
            slug = self._slugify(name)

        if not _SLUG_PATTERN.match(slug):
            raise ValueError(
                f"Invalid slug format: {slug!r}. Must contain only lowercase alphanumeric characters and hyphens."
            )

        # 验证 Catalog 未归档
        catalog = await CatalogDao.get_catalog(db, catalog_id)
        if catalog is None:
            raise ValueError(f"Catalog {catalog_id} not found")
        if catalog.is_archived:
            raise ValueError(f"Catalog {catalog_id} is archived; cannot add new entries")

        # 如果指定了 parent_id，验证父节点存在且属于同一 catalog
        if parent_id is not None:
            parent = await CatalogDao.get_node(db, parent_id)
            if parent is None:
                raise ValueError(f"Parent node {parent_id} not found")
            if parent.catalog_id != catalog_id:
                raise ValueError("Parent node must belong to the same catalog")

        return await CatalogDao.create_node(
            db,
            catalog_id=catalog_id,
            name=name,
            slug=slug,
            parent_id=parent_id,
            node_type=node_type,
            description=description,
            sort_order=sort_order,
            config=config,
        )

    async def update_node(
        self,
        db: AsyncSession,
        node_id: UUID,
        **kwargs: Any,
    ) -> DocCatalogEntry | None:
        """更新目录节点"""
        if "slug" in kwargs and kwargs["slug"]:
            if not _SLUG_PATTERN.match(kwargs["slug"]):
                raise ValueError(f"Invalid slug format: {kwargs['slug']!r}")
        return await CatalogDao.update_node(db, node_id, **kwargs)

    async def delete_node(self, db: AsyncSession, node_id: UUID) -> bool:
        """删除目录节点（级联删除子节点和关联）"""
        return await CatalogDao.delete_node(db, node_id)

    async def move_node(
        self,
        db: AsyncSession,
        node_id: UUID,
        new_parent_id: UUID | None,
    ) -> DocCatalogEntry | None:
        """移动节点到新的父节点下

        Args:
            node_id: 要移动的节点 ID
            new_parent_id: 新父节点 ID（None 表示提升为根节点）

        Returns:
            更新后的节点

        Raises:
            ValueError: 不能将节点移动到自身或其子节点下
        """
        # 防止循环引用：不能将节点移到自身或其子树下
        if new_parent_id == node_id:
            raise ValueError("Cannot move a node to itself")

        if new_parent_id is not None:
            subtree = await CatalogDao.get_subtree(db, node_id)
            descendant_ids = {n["id"] for n in subtree}
            if new_parent_id in descendant_ids:
                raise ValueError("Cannot move a node to its own descendant")

            # 验证新父节点存在
            new_parent = await CatalogDao.get_node(db, new_parent_id)
            if new_parent is None:
                raise ValueError(f"New parent node {new_parent_id} not found")

        return await CatalogDao.update_node(db, node_id, parent_id=new_parent_id)

    # ------------------------------------------------------------------
    # 树查询
    # ------------------------------------------------------------------

    async def get_tree(
        self,
        db: AsyncSession,
        catalog_id: UUID,
    ) -> list[dict]:
        """获取 Catalog 完整目录树（扁平化列表，含 depth/path）"""
        return await CatalogDao.get_tree(db, catalog_id)

    async def get_subtree(self, db: AsyncSession, node_id: UUID) -> list[dict]:
        """获取以指定节点为根的子树"""
        return await CatalogDao.get_subtree(db, node_id)

    async def get_node(self, db: AsyncSession, node_id: UUID) -> DocCatalogEntry | None:
        """获取单个节点详情"""
        return await CatalogDao.get_node(db, node_id)

    # ------------------------------------------------------------------
    # 文档归属
    # ------------------------------------------------------------------

    async def assign_document(
        self,
        db: AsyncSession,
        catalog_node_id: UUID,
        document_id: UUID,
    ) -> None:
        """将文档归入目录节点（幂等）

        权限约束：文档的源 Corpus 必须与 Catalog 属于同一 app_name。
        违反约束时抛出 PermissionError。
        """
        node = await CatalogDao.get_node(db, catalog_node_id)
        if node is None:
            raise ValueError(f"Catalog node {catalog_node_id} not found")

        # 权限校验：跨 app_name 文档归类禁止
        from sqlalchemy import select as sa_select

        from negentropy.models.perception import Corpus

        doc_result = await db.execute(sa_select(KnowledgeDocument).where(KnowledgeDocument.id == document_id))
        doc = doc_result.scalar_one_or_none()
        if doc is None:
            raise ValueError(f"Document {document_id} not found")

        catalog = await CatalogDao.get_catalog(db, node.catalog_id)
        if catalog is None:
            raise ValueError(f"Catalog {node.catalog_id} not found")

        corpus_result = await db.execute(sa_select(Corpus).where(Corpus.id == doc.corpus_id))
        corpus = corpus_result.scalar_one_or_none()
        if corpus is not None and corpus.app_name != catalog.app_name:
            raise PermissionError(
                f"Cannot assign document from corpus '{corpus.app_name}' "
                f"to catalog '{catalog.app_name}' (cross-app assignment forbidden)"
            )

        await CatalogDao.assign_document(db, catalog_node_id, document_id)

    async def unassign_document(
        self,
        db: AsyncSession,
        catalog_node_id: UUID,
        document_id: UUID,
    ) -> bool:
        """移除文档的目录归属"""
        return await CatalogDao.unassign_document(db, catalog_node_id, document_id)

    async def get_node_documents(
        self,
        db: AsyncSession,
        catalog_node_id: UUID,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[KnowledgeDocument], int]:
        """获取目录节点下的文档列表（分页）"""
        return await CatalogDao.get_node_documents(db, catalog_node_id, offset=offset, limit=limit)

    async def get_document_nodes(
        self,
        db: AsyncSession,
        document_id: UUID,
    ) -> list[DocCatalogEntry]:
        """获取文档所属的所有目录节点"""
        return await CatalogDao.get_document_nodes(db, document_id)

    # ------------------------------------------------------------------
    # 工具方法
    # ------------------------------------------------------------------

    @staticmethod
    def _slugify(text: str) -> str:
        """将文本转换为 URL-friendly slug"""
        import unicodedata

        normalized = unicodedata.normalize("NFKC", text or "").lower()
        slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
        return re.sub(r"-{2,}", "-", slug) or "untitled"
