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

import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from negentropy.models.perception import (
    KnowledgeDocument,
    WikiEntryAnnotation,
    WikiEntryComment,
    WikiPublication,
    WikiPublicationEntry,
    WikiPublicationSnapshot,
)

logger = logging.getLogger(__name__.rsplit(".", 1)[0])


class WikiDao:
    """Wiki 发布数据访问对象

    async 懒加载契约（详见 ISSUE-010 三阶）：所有返回 ``WikiPublication`` ORM
    对象的查询必须挂 ``selectinload(WikiPublication.entries)``，否则 handler /
    序列化路径（如 ``len(pub.entries)``）首次属性访问会触发
    ``sqlalchemy.exc.MissingGreenlet``。新增方法或新增 handler 若需访问
    ``snapshots`` / ``slug_redirects`` / ``catalog`` 等关系，需同步声明对应的
    eager loading option。
    """

    # ------------------------------------------------------------------
    # Publication CRUD
    # ------------------------------------------------------------------

    @staticmethod
    async def create_publication(
        db: AsyncSession,
        *,
        catalog_id: UUID,
        app_name: str,
        name: str,
        slug: str,
        description: str | None = None,
        theme: str = "default",
    ) -> WikiPublication:
        """创建 Wiki 发布记录（初始状态为 draft）"""
        pub = WikiPublication(
            catalog_id=catalog_id,
            app_name=app_name,
            name=name,
            slug=slug,
            description=description,
            status="draft",
            theme=theme,
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
        """按 ID 获取发布记录（eager-load entries 以兼容 async 序列化）"""
        result = await db.execute(
            select(WikiPublication).options(selectinload(WikiPublication.entries)).where(WikiPublication.id == pub_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_publication_by_slug(db: AsyncSession, catalog_id: UUID, slug: str) -> WikiPublication | None:
        """按 catalog + slug 获取发布记录（eager-load entries 以兼容 async 序列化）

        当前虽无调用方，但与 ``get_publication`` / ``list_publications`` 同构，
        预先满足类级 async 懒加载契约，避免未来 handler 调用时复现 ISSUE-010 三阶。
        """
        result = await db.execute(
            select(WikiPublication)
            .options(selectinload(WikiPublication.entries))
            .where(
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
        """列出发布记录（支持过滤和分页）

        eager-load entries 关系，规避 async SQLAlchemy 中
        `pub.entries` 首次属性访问触发隐式 IO 导致 MissingGreenlet 的缺陷。
        """
        query = select(WikiPublication).options(selectinload(WikiPublication.entries))

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
        entry_path: str | None = None,
        is_index_page: bool = False,
    ) -> WikiPublicationEntry:
        """创建或更新 DOCUMENT 类型条目（幂等：同一 publication+document 组合只保留一条）。

        ``entry_path``：``list[str]`` 序列化后的 JSON 字符串（Materialized Path）。
        ``entry_kind`` 始终设为 ``"DOCUMENT"``；``catalog_node_id`` 必为 NULL。
        """
        existing = await db.execute(
            select(WikiPublicationEntry).where(
                WikiPublicationEntry.publication_id == publication_id,
                WikiPublicationEntry.document_id == document_id,
                WikiPublicationEntry.entry_kind == "DOCUMENT",
            )
        )
        rec = existing.scalar_one_or_none()

        if rec is not None:
            # 更新现有记录
            rec.entry_slug = entry_slug
            rec.entry_title = entry_title
            rec.entry_path = entry_path
            rec.is_index_page = is_index_page
        else:
            rec = WikiPublicationEntry(
                publication_id=publication_id,
                document_id=document_id,
                entry_slug=entry_slug,
                entry_title=entry_title,
                entry_path=entry_path,
                is_index_page=is_index_page,
                entry_kind="DOCUMENT",
            )
            db.add(rec)

        await db.flush()
        return rec

    @staticmethod
    async def upsert_container_entry(
        db: AsyncSession,
        *,
        publication_id: UUID,
        catalog_node_id: UUID,
        entry_slug: str,
        entry_title: str | None,
        entry_path: str | None,
    ) -> WikiPublicationEntry:
        """创建或更新 CONTAINER 类型条目（幂等：同一 publication+catalog_node 组合只保留一条）。

        CONTAINER 条目对应 Catalog 中的 FOLDER 节点，提供导航树容器的元数据载体
        （title、description、entry_id），消除"用 slug 字符串合成虚拟容器"的痛点。

        ``document_id`` 强制为 NULL；``entry_kind=CONTAINER``。
        """
        existing = await db.execute(
            select(WikiPublicationEntry).where(
                WikiPublicationEntry.publication_id == publication_id,
                WikiPublicationEntry.catalog_node_id == catalog_node_id,
                WikiPublicationEntry.entry_kind == "CONTAINER",
            )
        )
        rec = existing.scalar_one_or_none()

        if rec is not None:
            rec.entry_slug = entry_slug
            rec.entry_title = entry_title
            rec.entry_path = entry_path
        else:
            rec = WikiPublicationEntry(
                publication_id=publication_id,
                document_id=None,
                catalog_node_id=catalog_node_id,
                entry_slug=entry_slug,
                entry_title=entry_title,
                entry_path=entry_path,
                is_index_page=False,
                entry_kind="CONTAINER",
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
        """获取发布的所有条目（按 is_index_page 优先 + entry_slug 字典序）。

        导航树嵌套合成委托给 :func:`negentropy.knowledge.wiki_tree.build_nav_tree`，
        本方法仅返回平铺结果以保持 DAO 层职责单一。
        """
        result = await db.execute(
            select(WikiPublicationEntry)
            .where(WikiPublicationEntry.publication_id == publication_id)
            .order_by(WikiPublicationEntry.is_index_page.desc(), WikiPublicationEntry.entry_slug)
        )
        return list(result.scalars().all())

    @staticmethod
    async def count_document_entries(db: AsyncSession, publication_id: UUID) -> int:
        """计算发布中 DOCUMENT 类型条目数量（排除 CONTAINER 文件夹节点）。"""
        result = await db.execute(
            select(func.count())
            .select_from(WikiPublicationEntry)
            .where(
                WikiPublicationEntry.publication_id == publication_id,
                WikiPublicationEntry.entry_kind == "DOCUMENT",
            )
        )
        return result.scalar() or 0

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
                KnowledgeDocument.display_name,
                KnowledgeDocument.markdown_content,
                KnowledgeDocument.metadata_,
            )
            .join(KnowledgeDocument, WikiPublicationEntry.document_id == KnowledgeDocument.id)
            .where(WikiPublicationEntry.id == entry_id)
        )
        row = result.one_or_none()
        if row is None:
            return None

        doc_id, filename, display_name, markdown_content, metadata = row
        # 与 wiki_service._resolve_doc_display_title 保持同源优先级：
        # display_name (用户覆盖) -> metadata_.title -> original_filename。
        resolved_title = (display_name or "").strip()
        if not resolved_title:
            meta_title = (metadata or {}).get("title")
            if isinstance(meta_title, str) and meta_title.strip():
                resolved_title = meta_title.strip()
        if not resolved_title:
            resolved_title = filename or "Untitled"
        return {
            "document_id": doc_id,
            "filename": filename,
            "display_name": display_name,
            "markdown_content": markdown_content or "",
            "title": resolved_title,
            "metadata": metadata or {},
        }

    # ------------------------------------------------------------------
    # 导航树（薄委托）
    # ------------------------------------------------------------------

    @staticmethod
    async def get_nav_tree(
        db: AsyncSession,
        publication_id: UUID,
    ) -> list[dict]:
        """获取发布的导航树结构。

        DAO 层仅承担"查 entries"，嵌套合成逻辑委托给纯函数
        :func:`negentropy.knowledge.wiki_tree.build_nav_tree`，便于单测覆盖。
        """
        from .wiki_tree import build_nav_tree

        entries = await WikiDao.get_entries(db, publication_id)
        return build_nav_tree(entries)

    @staticmethod
    async def remove_stale_entries(
        db: AsyncSession,
        publication_id: UUID,
        keep_document_ids: set[str],
        keep_container_node_ids: set[str] | None = None,
    ) -> int:
        """移除不再属于同步范围的条目（幂等性保证）。

        分别保留 ``DOCUMENT`` 类型中 document_id ∈ keep_document_ids 与
        ``CONTAINER`` 类型中 catalog_node_id ∈ keep_container_node_ids 的行；
        其余删除。
        """
        from sqlalchemy import and_, or_
        from sqlalchemy import delete as sql_delete

        keep_doc_uuids = [UUID(did) for did in keep_document_ids] if keep_document_ids else []
        keep_node_uuids = [UUID(nid) for nid in keep_container_node_ids] if keep_container_node_ids else []

        # 构造保留条件：DOCUMENT 行 document_id ∈ doc_keep，或 CONTAINER 行 catalog_node_id ∈ node_keep
        keep_clauses = []
        if keep_doc_uuids:
            keep_clauses.append(
                and_(
                    WikiPublicationEntry.entry_kind == "DOCUMENT",
                    WikiPublicationEntry.document_id.in_(keep_doc_uuids),
                )
            )
        if keep_node_uuids:
            keep_clauses.append(
                and_(
                    WikiPublicationEntry.entry_kind == "CONTAINER",
                    WikiPublicationEntry.catalog_node_id.in_(keep_node_uuids),
                )
            )

        if not keep_clauses:
            result = await db.execute(
                sql_delete(WikiPublicationEntry).where(
                    WikiPublicationEntry.publication_id == publication_id,
                )
            )
        else:
            keep_predicate = or_(*keep_clauses) if len(keep_clauses) > 1 else keep_clauses[0]
            result = await db.execute(
                sql_delete(WikiPublicationEntry).where(
                    WikiPublicationEntry.publication_id == publication_id,
                    sa.not_(keep_predicate),
                )
            )
        await db.flush()
        return result.rowcount

    # ------------------------------------------------------------------
    # Snapshot 冻结（SNAPSHOT 发布模式）
    # ------------------------------------------------------------------

    @staticmethod
    async def create_snapshot(
        db: AsyncSession,
        *,
        publication_id: UUID,
        version: int,
        frozen_entries: list[dict[str, Any]],
        metadata: dict[str, Any] | None = None,
    ) -> WikiPublicationSnapshot:
        """冻结当前 entries 到 ``WikiPublicationSnapshot``（仅追加）。

        ``WikiPublication.snapshot_version`` 同步指向最新冻结版本，便于 SSG
        在 SNAPSHOT 模式下直接以 ``snapshot_version`` 取定版内容。
        """
        snap = WikiPublicationSnapshot(
            publication_id=publication_id,
            version=version,
            frozen_entries=frozen_entries,
            metadata_=metadata or {},
        )
        db.add(snap)
        await db.flush()
        # 同步主表 snapshot_version 指针。
        pub = await WikiDao.get_publication(db, publication_id)
        if pub is not None:
            pub.snapshot_version = version
            await db.flush()
        return snap

    # ------------------------------------------------------------------
    # Comment CRUD (页面评论)
    # ------------------------------------------------------------------

    @staticmethod
    async def create_comment(
        db: AsyncSession,
        *,
        entry_id: UUID,
        user_id: str,
        body: str,
    ) -> WikiEntryComment:
        comment = WikiEntryComment(
            entry_id=entry_id,
            user_id=user_id,
            body=body,
        )
        db.add(comment)
        await db.flush()
        return comment

    @staticmethod
    async def list_comments(
        db: AsyncSession,
        entry_id: UUID,
        *,
        status: str = "active",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[dict], int]:
        """列出评论，JOIN user_states 解析用户 profile"""
        from negentropy.config import settings
        from negentropy.models.state import UserState

        base = select(WikiEntryComment).where(
            WikiEntryComment.entry_id == entry_id,
            WikiEntryComment.status == status,
        )
        count_q = select(func.count()).select_from(base.subquery())
        total = (await db.execute(count_q)).scalar() or 0

        rows_q = base.order_by(WikiEntryComment.created_at.asc()).offset(offset).limit(limit)
        result = await db.execute(rows_q)
        comments = list(result.scalars().all())

        # 批量解析用户 profile
        user_ids = {c.user_id for c in comments}
        user_map: dict[str, dict] = {}
        if user_ids:
            usr_result = await db.execute(
                select(UserState).where(
                    UserState.user_id.in_(user_ids),
                    UserState.app_name == settings.app_name,
                )
            )
            for usr in usr_result.scalars().all():
                profile = (usr.state or {}).get("profile", {})
                user_map[usr.user_id] = {
                    "user_name": profile.get("name"),
                    "user_picture": profile.get("picture"),
                }

        items = []
        for c in comments:
            info = user_map.get(c.user_id, {})
            items.append(
                {
                    "id": c.id,
                    "entry_id": c.entry_id,
                    "user_id": c.user_id,
                    "user_name": info.get("user_name"),
                    "user_picture": info.get("user_picture"),
                    "body": c.body,
                    "status": c.status,
                    "parent_comment_id": c.parent_comment_id,
                    "created_at": c.created_at,
                    "updated_at": c.updated_at,
                }
            )
        return items, total

    @staticmethod
    async def update_comment(
        db: AsyncSession,
        comment_id: UUID,
        user_id: str,
        body: str,
    ) -> WikiEntryComment | None:
        result = await db.execute(
            select(WikiEntryComment).where(
                WikiEntryComment.id == comment_id,
                WikiEntryComment.user_id == user_id,
                WikiEntryComment.status == "active",
            )
        )
        comment = result.scalar_one_or_none()
        if comment is None:
            return None
        comment.body = body
        await db.flush()
        return comment

    @staticmethod
    async def delete_comment(
        db: AsyncSession,
        comment_id: UUID,
        user_id: str,
        is_admin: bool = False,
    ) -> bool:
        conditions = [WikiEntryComment.id == comment_id, WikiEntryComment.status == "active"]
        if not is_admin:
            conditions.append(WikiEntryComment.user_id == user_id)
        result = await db.execute(select(WikiEntryComment).where(*conditions))
        comment = result.scalar_one_or_none()
        if comment is None:
            return False
        comment.status = "deleted"
        await db.flush()
        return True

    # ------------------------------------------------------------------
    # Annotation CRUD (文本注解)
    # ------------------------------------------------------------------

    @staticmethod
    async def create_annotation(
        db: AsyncSession,
        *,
        entry_id: UUID,
        user_id: str,
        body: str,
        quoted_text: str,
        anchor: dict[str, Any],
        pub_version: int,
    ) -> WikiEntryAnnotation:
        annotation = WikiEntryAnnotation(
            entry_id=entry_id,
            user_id=user_id,
            body=body,
            quoted_text=quoted_text,
            anchor=anchor,
            pub_version=pub_version,
        )
        db.add(annotation)
        await db.flush()
        return annotation

    @staticmethod
    async def list_annotations(
        db: AsyncSession,
        entry_id: UUID,
        *,
        status: str = "active",
        offset: int = 0,
        limit: int = 200,
    ) -> tuple[list[dict], int]:
        """列出注解，JOIN user_states 解析用户 profile"""
        from negentropy.config import settings
        from negentropy.models.state import UserState

        base = select(WikiEntryAnnotation).where(
            WikiEntryAnnotation.entry_id == entry_id,
            WikiEntryAnnotation.status == status,
        )
        count_q = select(func.count()).select_from(base.subquery())
        total = (await db.execute(count_q)).scalar() or 0

        rows_q = base.order_by(WikiEntryAnnotation.created_at.asc()).offset(offset).limit(limit)
        result = await db.execute(rows_q)
        annotations = list(result.scalars().all())

        user_ids = {a.user_id for a in annotations}
        user_map: dict[str, dict] = {}
        if user_ids:
            usr_result = await db.execute(
                select(UserState).where(
                    UserState.user_id.in_(user_ids),
                    UserState.app_name == settings.app_name,
                )
            )
            for usr in usr_result.scalars().all():
                profile = (usr.state or {}).get("profile", {})
                user_map[usr.user_id] = {
                    "user_name": profile.get("name"),
                    "user_picture": profile.get("picture"),
                }

        items = []
        for a in annotations:
            info = user_map.get(a.user_id, {})
            items.append(
                {
                    "id": a.id,
                    "entry_id": a.entry_id,
                    "user_id": a.user_id,
                    "user_name": info.get("user_name"),
                    "user_picture": info.get("user_picture"),
                    "body": a.body,
                    "quoted_text": a.quoted_text,
                    "anchor": a.anchor,
                    "pub_version": a.pub_version,
                    "status": a.status,
                    "created_at": a.created_at,
                    "updated_at": a.updated_at,
                }
            )
        return items, total

    @staticmethod
    async def update_annotation(
        db: AsyncSession,
        annotation_id: UUID,
        user_id: str,
        body: str,
    ) -> WikiEntryAnnotation | None:
        result = await db.execute(
            select(WikiEntryAnnotation).where(
                WikiEntryAnnotation.id == annotation_id,
                WikiEntryAnnotation.user_id == user_id,
                WikiEntryAnnotation.status == "active",
            )
        )
        annotation = result.scalar_one_or_none()
        if annotation is None:
            return None
        annotation.body = body
        await db.flush()
        return annotation

    @staticmethod
    async def delete_annotation(
        db: AsyncSession,
        annotation_id: UUID,
        user_id: str,
        is_admin: bool = False,
    ) -> bool:
        conditions = [WikiEntryAnnotation.id == annotation_id, WikiEntryAnnotation.status == "active"]
        if not is_admin:
            conditions.append(WikiEntryAnnotation.user_id == user_id)
        result = await db.execute(select(WikiEntryAnnotation).where(*conditions))
        annotation = result.scalar_one_or_none()
        if annotation is None:
            return False
        annotation.status = "deleted"
        await db.flush()
        return True
