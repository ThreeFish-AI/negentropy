"""目录节点 DAO（CRUD + 树查询）

正交职责（自 catalog_dao 拆分）：
  - 节点条目（``DocCatalogEntry``）的 CRUD（``create_node`` / ``get_node`` /
    ``update_node`` / ``delete_node``）。
  - 树查询：``get_tree``（catalog 全树）/ ``get_subtree``（子树）—— 基于 PG
    Recursive CTE，仅返回 FOLDER 结构节点（兼容历史 CATEGORY / COLLECTION 死值）。

与 ``catalog_dao``（Catalog 顶层 CRUD Façade）和 ``catalog_assignment_dao``（文档
N:M 软引用）正交解耦；外部代码经 ``CatalogDao`` Façade 类调用三类方法，向后兼容。
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.slug import compute_slug as _compute_slug
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.perception import DocCatalogEntry

logger = logging.getLogger("negentropy.knowledge")

# 目录树最大递归深度（防止无限循环或超深树导致性能问题）
MAX_TREE_DEPTH = 6

# node_type 大小写映射（API 层传入小写，ORM Enum 存储大写）
#
# 自 0010 起：
#   - 用户可见类型仅 ``FOLDER``；历史 ``category`` / ``collection`` 在前端均向 FOLDER 兜底；
#   - ``DOCUMENT_REF`` 仅由 ``assign_document`` 自动创建，UI 不暴露；
#   - 历史枚举值 CATEGORY / COLLECTION 在 PG ENUM 中保留为死值（无法 DROP VALUE），
#     映射保留以便老数据读取兼容。
_NODE_TYPE_TO_ENUM = {
    "folder": "FOLDER",
    "document_ref": "DOCUMENT_REF",
    # 兼容输入：旧前端或外部 API 调用方
    "category": "FOLDER",
    "collection": "FOLDER",
}
_ENUM_TO_NODE_TYPE = {
    "FOLDER": "folder",
    "DOCUMENT_REF": "document_ref",
    # 兼容输出：旧数据未迁移完成时的回退（理论上 0010 后不应出现）
    "CATEGORY": "folder",
    "COLLECTION": "folder",
}

# 树查询的合法结构节点类型（DOCUMENT_REF 作叶子单独经 assignment DAO 访问）
_TREE_NODE_TYPES = ("FOLDER", "CATEGORY", "COLLECTION")

__all__ = [
    "CatalogNodeDao",
    "_NODE_TYPE_TO_ENUM",
    "_ENUM_TO_NODE_TYPE",
    "MAX_TREE_DEPTH",
    "_compute_slug",
]


class CatalogNodeDao:
    """节点条目 CRUD + 树查询。

    所有方法为 ``@staticmethod``，保持与 Façade 调用习惯一致
    （``CatalogDao.create_node(...)`` 经多继承转发至此）。

    async 懒加载契约（详见 ISSUE-010）：当前所有 handler 对 ``DocCatalogEntry``
    仅访问标量列、或通过 ``get_tree``（递归 CTE）返回 dict / 显式查询结果，
    避开关系遍历，避免 ``MissingGreenlet`` 异常。
    """

    # ------------------------------------------------------------------
    # 节点 CRUD
    # ------------------------------------------------------------------

    @staticmethod
    async def create_node(
        db: AsyncSession,
        *,
        catalog_id: UUID,
        name: str,
        slug: str | None = None,
        parent_id: UUID | None = None,
        node_type: str = "folder",
        description: str | None = None,
        sort_order: int = 0,
        config: dict | None = None,
    ) -> DocCatalogEntry:
        """创建目录条目节点（FOLDER；DOCUMENT_REF 仅由 assign_document 自动创建）"""
        entry = DocCatalogEntry(
            catalog_id=catalog_id,
            name=name,
            slug_override=slug or None,
            parent_entry_id=parent_id,
            node_type=_NODE_TYPE_TO_ENUM.get(node_type, "FOLDER"),
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
        entry = await CatalogNodeDao.get_node(db, node_id)
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
        entry = await CatalogNodeDao.get_node(db, node_id)
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

        仅返回 FOLDER 结构节点（跳过 DOCUMENT_REF 叶节点）。历史 CATEGORY /
        COLLECTION 在 0010 迁移后已收敛为 FOLDER；保留对历史值的兼容查询，
        防止迁移中断时读路径崩溃。
        """
        return await _query_tree(db, catalog_id=catalog_id, entry_id=None, max_depth=max_depth)

    @staticmethod
    async def get_subtree(
        db: AsyncSession,
        entry_id: UUID,
        max_depth: int = MAX_TREE_DEPTH,
    ) -> list[dict]:
        """获取以指定条目为根的子树（仅 FOLDER / 历史 CATEGORY / COLLECTION 节点）"""
        return await _query_tree(db, catalog_id=None, entry_id=entry_id, max_depth=max_depth)


# ----------------------------------------------------------------------
# 内部：递归 CTE 树查询的复用实现（get_tree / get_subtree 共享）
# ----------------------------------------------------------------------


async def _query_tree(
    db: AsyncSession,
    *,
    catalog_id: UUID | None,
    entry_id: UUID | None,
    max_depth: int,
) -> list[dict]:
    """共享递归 CTE：根据 catalog_id（全树）或 entry_id（子树）锚定根。"""
    table = f"{NEGENTROPY_SCHEMA}.doc_catalog_entries"
    types_in = ", ".join(f"'{t}'" for t in _TREE_NODE_TYPES)

    if catalog_id is not None:
        anchor = "WHERE catalog_id = :catalog_id AND parent_entry_id IS NULL"
        anchor_params = {"catalog_id": str(catalog_id), "max_depth": max_depth}
    else:
        anchor = "WHERE id = :entry_id"
        anchor_params = {"entry_id": str(entry_id), "max_depth": max_depth}

    stmt = text(f"""
        WITH RECURSIVE tree AS (
            SELECT
                id, parent_entry_id AS parent_id, name, slug_override, node_type,
                description, position AS sort_order, config, catalog_id,
                0 AS depth, ARRAY[id] AS path
            FROM {table}
            {anchor}
              AND node_type IN ({types_in})

            UNION ALL

            SELECT
                n.id, n.parent_entry_id, n.name, n.slug_override, n.node_type,
                n.description, n.position, n.config, n.catalog_id,
                t.depth + 1, t.path || n.id
            FROM {table} n
            JOIN tree t ON n.parent_entry_id = t.id
            WHERE n.node_type IN ({types_in})
        )
        SELECT id, parent_id, name, slug_override, node_type,
               description, sort_order, config, catalog_id, depth, path
        FROM tree
        WHERE depth <= :max_depth
        ORDER BY depth, sort_order, name
    """)

    rows = (await db.execute(stmt, anchor_params)).all()

    result = [
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

    if catalog_id is not None:
        logger.debug(
            "catalog_tree_queried",
            extra={"catalog_id": str(catalog_id), "node_count": len(result)},
        )
    return result


# `Any` import retained for downstream type hints
_ = Any
