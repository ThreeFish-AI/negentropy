"""
文档目录编目 — 服务层

提供目录树的创建、移动、查询、文档归属管理等功能。
核心能力：
  - 递归树查询（基于 PostgreSQL Recursive CTE）
  - 节点 CRUD + 移动（更新 parent_id）
  - 文档归类 / 取消归类
  - LLM 自动分类建议（预留接口）
"""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.catalog_dao import CatalogDao
from negentropy.logging import get_logger
from negentropy.models.perception import DocCatalogNode, KnowledgeDocument

logger = get_logger(__name__.rsplit(".", 1)[0])

# slug 合法字符集（URL-friendly）
_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class CatalogService:
    """文档目录编目服务"""

    # ------------------------------------------------------------------
    # 节点管理
    # ------------------------------------------------------------------

    async def create_node(
        self,
        db: AsyncSession,
        *,
        corpus_id: UUID,
        name: str,
        slug: str | None = None,
        parent_id: UUID | None = None,
        node_type: str = "category",
        description: str | None = None,
        sort_order: int = 0,
        config: dict | None = None,
    ) -> DocCatalogNode:
        """创建目录节点

        Args:
            db: 数据库会话
            corpus_id: 所属语料库 ID
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
            ValueError: node_type 不合法或 slug 格式错误
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

        # 如果指定了 parent_id，验证父节点存在且属于同一 corpus
        if parent_id is not None:
            parent = await CatalogDao.get_node(db, parent_id)
            if parent is None:
                raise ValueError(f"Parent node {parent_id} not found")
            if parent.corpus_id != corpus_id:
                raise ValueError("Parent node must belong to the same corpus")

        return await CatalogDao.create_node(
            db,
            corpus_id=corpus_id,
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
    ) -> DocCatalogNode | None:
        """更新目录节点"""
        # 如果更新了 slug，校验格式
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
    ) -> DocCatalogNode | None:
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
        corpus_id: UUID,
    ) -> list[dict]:
        """获取语料库完整目录树（扁平化列表，含 depth/path）"""
        return await CatalogDao.get_tree(db, corpus_id)

    async def get_subtree(self, db: AsyncSession, node_id: UUID) -> list[dict]:
        """获取以指定节点为根的子树"""
        return await CatalogDao.get_subtree(db, node_id)

    async def get_node(self, db: AsyncSession, node_id: UUID) -> DocCatalogNode | None:
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
        """将文档归入目录节点（幂等）"""
        # 验证两端都存在
        node = await CatalogDao.get_node(db, catalog_node_id)
        if node is None:
            raise ValueError(f"Catalog node {catalog_node_id} not found")
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
    ) -> list[DocCatalogNode]:
        """获取文档所属的所有目录节点"""
        return await CatalogDao.get_document_nodes(db, document_id)

    # ------------------------------------------------------------------
    # 工具方法
    # ------------------------------------------------------------------

    @staticmethod
    def _slugify(text: str) -> str:
        """将文本转换为 URL-friendly slug

        示例:
            "机器学习基础" → "ji-qi-xue-xi-ji-chu"
            "API 参考" → "api-can-kao"
        """
        import unicodedata

        # Unicode NFKC 规范化（处理全角字符等）
        normalized = unicodedata.normalize("NFKC", text)
        # 转小写、替换空格和特殊字符为连字符
        slug = re.sub(r"[^\w\s-]", "", normalized.lower())
        slug = re.sub(r"[\s_]+", "-", slug).strip("-")
        # 压缩连续连字符
        slug = re.sub(r"-{2,}", "-", slug)
        return slug or "untitled"
