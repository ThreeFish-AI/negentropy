"""
文档目录编目 — 数据访问层 Façade

正交分解（自 PR-2 起）：
  - :mod:`catalog_dao`（本文件）：Catalog 顶层（``DocCatalog``）CRUD + Façade 类
    ``CatalogDao`` 通过多继承聚合节点与归属 DAO，保持调用面向后兼容。
  - :mod:`catalog_node_dao`：节点条目 CRUD + 树查询。
  - :mod:`catalog_assignment_dao`：DOCUMENT_REF 软引用 N:M 维护。

向后兼容：
  历史代码 ``from negentropy.knowledge.catalog_dao import CatalogDao``、
  ``CatalogDao.create_node(...)`` 与 ``CatalogDao.assign_document(...)`` 等仍
  正常工作（多继承转发）；常量 ``_NODE_TYPE_TO_ENUM`` / ``_ENUM_TO_NODE_TYPE``
  / ``MAX_TREE_DEPTH`` / ``_compute_slug`` 仍从此处可导入（重导出）。
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.models.perception import DocCatalog

from .catalog_assignment_dao import CatalogAssignmentDao
from .catalog_node_dao import (
    _ENUM_TO_NODE_TYPE,
    _NODE_TYPE_TO_ENUM,
    MAX_TREE_DEPTH,
    CatalogNodeDao,
    _compute_slug,
)

logger = logging.getLogger("negentropy.knowledge")

__all__ = [
    "CatalogDao",
    "CatalogNodeDao",
    "CatalogAssignmentDao",
    "_ENUM_TO_NODE_TYPE",
    "_NODE_TYPE_TO_ENUM",
    "_compute_slug",
    "MAX_TREE_DEPTH",
]


class _CatalogTopLevelDao:
    """Catalog 顶层（``DocCatalog``）CRUD。

    与节点（``CatalogNodeDao``）/ 归属（``CatalogAssignmentDao``）正交：
    本类只关心 Catalog 实体本身的生命周期；不触碰 entries / documents。
    """

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
        catalog = await _CatalogTopLevelDao.get_catalog(db, catalog_id)
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
        catalog = await _CatalogTopLevelDao.get_catalog(db, catalog_id)
        if catalog is None:
            return None
        catalog.is_archived = True
        await db.flush()
        logger.info("catalog_archived", extra={"id": str(catalog_id)})
        return catalog

    @staticmethod
    async def delete_catalog(db: AsyncSession, catalog_id: UUID) -> bool:
        """删除 Catalog（级联删除所有 entries）"""
        catalog = await _CatalogTopLevelDao.get_catalog(db, catalog_id)
        if catalog is None:
            return False
        await db.delete(catalog)
        await db.flush()
        logger.info("catalog_deleted", extra={"id": str(catalog_id)})
        return True


class CatalogDao(_CatalogTopLevelDao, CatalogNodeDao, CatalogAssignmentDao):
    """三类 DAO 的 Façade（多继承聚合）。

    历史代码继续使用 ``CatalogDao.create_node``、``CatalogDao.assign_document`` 等
    无需改动；新代码可按职责直接调用细分类（``CatalogNodeDao`` /
    ``CatalogAssignmentDao``）以提高可读性。
    """

    pass
