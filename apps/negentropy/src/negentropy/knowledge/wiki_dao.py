"""
Wiki 发布 — 数据访问层 (DAO)

提供 WikiPublication / WikiPublicationEntry 表的 CRUD 操作，
支持发布快照管理、条目映射、导航树构建等。
"""

from __future__ import annotations

import logging
from datetime import UTC
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.models.perception import (
    KnowledgeDocument,
    WikiPublication,
    WikiPublicationEntry,
)

logger = logging.getLogger(__name__.rsplit(".", 1)[0])


class WikiDao:
    """Wiki 发布数据访问对象"""

    # ------------------------------------------------------------------
    # Publication CRUD
    # ------------------------------------------------------------------

    @staticmethod
    async def create_publication(
        db: AsyncSession,
        *,
        catalog_id: UUID,
        name: str,
        slug: str,
        description: str | None = None,
        theme: str = "default",
        navigation_config: dict | None = None,
        custom_css: str | None = None,
        custom_js: str | None = None,
    ) -> WikiPublication:
        """创建 Wiki 发布记录（初始状态为 draft）"""
        pub = WikiPublication(
            catalog_id=catalog_id,
            name=name,
            slug=slug,
            description=description,
            status="draft",
            theme=theme,
            navigation_config=navigation_config or {},
            custom_css=custom_css,
            custom_js=custom_js,
            version=1,
        )
        db.add(pub)
        await db.flush()
        logger.info(
            "wiki_publication_created",
            extra={
                "id": str(pub.id),
                "catalog_id": str(catalog_id),
                "publication_name": name,
                "slug": slug,
            },
        )
        return pub

    @staticmethod
    async def get_publication(db: AsyncSession, pub_id: UUID) -> WikiPublication | None:
        """按 ID 获取发布记录"""
        result = await db.execute(select(WikiPublication).where(WikiPublication.id == pub_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_publication_by_slug(db: AsyncSession, catalog_id: UUID, slug: str) -> WikiPublication | None:
        """按 catalog + slug 获取发布记录"""
        result = await db.execute(
            select(WikiPublication).where(
                WikiPublication.catalog_id == catalog_id,
                WikiPublication.slug == slug,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_publications(
        db: AsyncSession,
        *,
        catalog_id: UUID | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[WikiPublication], int]:
        """列出发布记录（支持过滤和分页）"""
        query = select(WikiPublication)

        count_base = select(func.count()).select_from(WikiPublication)

        if catalog_id is not None:
            query = query.where(WikiPublication.catalog_id == catalog_id)
            count_base = count_base.where(WikiPublication.catalog_id == catalog_id)
        if status is not None:
            query = query.where(WikiPublication.status == status)
            count_base = count_base.where(WikiPublication.status == status)

        total_result = await db.execute(count_base)
        total = total_result.scalar() or 0

        query = query.order_by(WikiPublication.created_at.desc()).offset(offset).limit(limit)
        result = await db.execute(query)
        items = list(result.scalars().all())

        return items, total

    @staticmethod
    async def update_publication(
        db: AsyncSession,
        pub_id: UUID,
        **kwargs: Any,
    ) -> WikiPublication | None:
        """更新发布记录属性"""
        pub = await WikiDao.get_publication(db, pub_id)
        if pub is None:
            return None

        allowed_fields = {
            "name",
            "slug",
            "description",
            "status",
            "theme",
            "navigation_config",
            "custom_css",
            "custom_js",
        }
        for key, value in kwargs.items():
            if key in allowed_fields and value is not None:
                setattr(pub, key, value)

        await db.flush()
        return pub

    @staticmethod
    async def delete_publication(db: AsyncSession, pub_id: UUID) -> bool:
        """删除发布记录（级联删除所有条目）"""
        pub = await WikiDao.get_publication(db, pub_id)
        if pub is None:
            return False
        await db.delete(pub)
        await db.flush()
        return True

    # ------------------------------------------------------------------
    # 发布操作 (publish/unpublish/archive)
    # ------------------------------------------------------------------

    @staticmethod
    async def publish(db: AsyncSession, pub_id: UUID) -> WikiPublication | None:
        """将 draft 状态的发布记录标记为 published，递增版本号"""
        pub = await WikiDao.get_publication(db, pub_id)
        if pub is None:
            return None
        if pub.status not in ("draft", "published"):
            raise ValueError(f"Cannot publish a publication in status: {pub.status}")

        from datetime import datetime

        pub.status = "published"
        pub.version += 1
        pub.published_at = datetime.now(UTC)
        await db.flush()

        logger.info(
            "wiki_published",
            extra={
                "pub_id": str(pub_id),
                "version": pub.version,
            },
        )
        return pub

    @staticmethod
    async def unpublish(db: AsyncSession, pub_id: UUID) -> WikiPublication | None:
        """将 published 状态回退为 draft"""
        pub = await WikiDao.get_publication(db, pub_id)
        if pub is None:
            return None
        pub.status = "draft"
        await db.flush()
        return pub

    @staticmethod
    async def archive(db: AsyncSession, pub_id: UUID) -> WikiPublication | None:
        """归档发布记录"""
        pub = await WikiDao.get_publication(db, pub_id)
        if pub is None:
            return None
        pub.status = "archived"
        await db.flush()
        return pub

    # ------------------------------------------------------------------
    # Entry 管理 (条目映射)
    # ------------------------------------------------------------------

    @staticmethod
    async def upsert_entry(
        db: AsyncSession,
        *,
        publication_id: UUID,
        document_id: UUID,
        entry_slug: str,
        entry_title: str | None = None,
        entry_order: dict | None = None,
        is_index_page: bool = False,
    ) -> WikiPublicationEntry:
        """创建或更新条目映射（幂等：同一 publication+document 组合只保留一条）"""
        existing = await db.execute(
            select(WikiPublicationEntry).where(
                WikiPublicationEntry.publication_id == publication_id,
                WikiPublicationEntry.document_id == document_id,
            )
        )
        rec = existing.scalar_one_or_none()

        if rec is not None:
            # 更新现有记录
            rec.entry_slug = entry_slug
            rec.entry_title = entry_title
            rec.entry_order = entry_order
            rec.is_index_page = is_index_page
        else:
            rec = WikiPublicationEntry(
                publication_id=publication_id,
                document_id=document_id,
                entry_slug=entry_slug,
                entry_title=entry_title,
                entry_order=entry_order,
                is_index_page=is_index_page,
            )
            db.add(rec)

        await db.flush()
        return rec

    @staticmethod
    async def remove_entry(
        db: AsyncSession,
        entry_id: UUID,
    ) -> bool:
        """删除单条条目映射"""
        from sqlalchemy import delete as sql_delete

        result = await db.execute(sql_delete(WikiPublicationEntry).where(WikiPublicationEntry.id == entry_id))
        await db.flush()
        return result.rowcount > 0

    @staticmethod
    async def get_entries(
        db: AsyncSession,
        publication_id: UUID,
    ) -> list[WikiPublicationEntry]:
        """获取发布的所有条目（按 entry_order 排序）"""
        result = await db.execute(
            select(WikiPublicationEntry)
            .where(WikiPublicationEntry.publication_id == publication_id)
            .order_by(WikiPublicationEntry.is_index_page.desc(), WikiPublicationEntry.entry_slug)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_entry_by_slug(
        db: AsyncSession,
        publication_id: UUID,
        entry_slug: str,
    ) -> WikiPublicationEntry | None:
        """按 slug 获取单条条目"""
        result = await db.execute(
            select(WikiPublicationEntry).where(
                WikiPublicationEntry.publication_id == publication_id,
                WikiPublicationEntry.entry_slug == entry_slug,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_entry_content(
        db: AsyncSession,
        entry_id: UUID,
    ) -> dict | None:
        """获取条目关联文档的 Markdown 内容

        Returns:
            包含 markdown_content, title, metadata 的字典；文档不存在则返回 None
        """
        result = await db.execute(
            select(
                WikiPublicationEntry.document_id,
                KnowledgeDocument.original_filename,
                KnowledgeDocument.markdown_content,
                KnowledgeDocument.metadata_,
            )
            .join(KnowledgeDocument, WikiPublicationEntry.document_id == KnowledgeDocument.id)
            .where(WikiPublicationEntry.id == entry_id)
        )
        row = result.one_or_none()
        if row is None:
            return None

        doc_id, filename, markdown_content, metadata = row
        return {
            "document_id": doc_id,
            "filename": filename,
            "markdown_content": markdown_content or "",
            "title": (metadata or {}).get("title") or filename or "Untitled",
            "metadata": metadata or {},
        }

    # ------------------------------------------------------------------
    # 导航树
    # ------------------------------------------------------------------

    @staticmethod
    async def get_nav_tree(
        db: AsyncSession,
        publication_id: UUID,
    ) -> list[dict]:
        """获取发布的导航树结构

        基于 entries 的 entry_order 字段（Materialized Path）构建嵌套层级导航。
        如果 entry_order 为空，则回退为扁平列表。
        """
        import json

        entries = await WikiDao.get_entries(db, publication_id)

        def _insert_into_tree(root_items: list[dict], item: dict, order_path: list[str]) -> None:
            """将条目按 order_path 嵌入到树结构中"""
            if len(order_path) <= 1:
                root_items.append(item)
                return

            # 查找或创建父级容器节点
            parent_path = order_path[:-1]
            parent_slug = "/".join(parent_path)

            def _find_or_create_parent(children: list[dict]) -> dict:
                for child in children:
                    if child.get("_path") == parent_slug:
                        return child
                    nested = _find_or_create_parent(child.get("children", []))
                    if nested:
                        return nested
                # 创建目录容器节点
                container = {
                    "entry_id": None,
                    "entry_slug": parent_slug,
                    "entry_title": parent_path[-1],
                    "is_index_page": False,
                    "document_id": None,
                    "_path": parent_slug,
                    "children": [],
                }
                children.append(container)
                return container

            parent = _find_or_create_parent(root_items)
            if parent:
                parent.setdefault("children", []).append(item)
            else:
                root_items.append(item)

        root_items: list[dict] = []
        for entry in entries:
            order_path = entry.entry_order
            if isinstance(order_path, str):
                try:
                    order_path = json.loads(order_path)
                except (json.JSONDecodeError, TypeError):
                    order_path = [entry.entry_slug]

            item = {
                "entry_id": str(entry.id),
                "entry_slug": entry.entry_slug,
                "entry_title": entry.entry_title or entry.entry_slug,
                "is_index_page": entry.is_index_page,
                "document_id": str(entry.document_id),
                "children": [],
            }

            if order_path and len(order_path) > 1:
                _insert_into_tree(root_items, item, order_path)
            else:
                root_items.append(item)

        # 递归移除内部 _path 字段
        def _clean_internal(items: list[dict]) -> None:
            for item in items:
                item.pop("_path", None)
                _clean_internal(item.get("children", []))

        _clean_internal(root_items)
        return root_items

    @staticmethod
    async def remove_stale_entries(
        db: AsyncSession,
        publication_id: UUID,
        keep_document_ids: set[str],
    ) -> int:
        """移除不再属于同步范围的条目（幂等性保证）"""
        from sqlalchemy import delete as sql_delete

        if not keep_document_ids:
            result = await db.execute(
                sql_delete(WikiPublicationEntry).where(
                    WikiPublicationEntry.publication_id == publication_id,
                )
            )
        else:
            result = await db.execute(
                sql_delete(WikiPublicationEntry).where(
                    WikiPublicationEntry.publication_id == publication_id,
                    WikiPublicationEntry.document_id.notin_(
                        [UUID(did) for did in keep_document_ids],
                    ),
                )
            )
        await db.flush()
        return result.rowcount
