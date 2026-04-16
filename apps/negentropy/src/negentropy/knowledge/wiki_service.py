"""
Wiki 发布 — 服务层

管理 Wiki 发布生命周期：创建 → 配置条目 → 发布 → 归档。
核心能力：
  - Publication CRUD + 状态流转 (draft ↔ published → archived)
  - Entry 管理（文档到 Wiki 条目的映射）
  - 导航树构建
  - 内容聚合（供 SSG 构建时拉取）
"""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.wiki_dao import WikiDao
from negentropy.logging import get_logger
from negentropy.models.perception import WikiPublication, WikiPublicationEntry

logger = get_logger(__name__.rsplit(".", 1)[0])

# 合法主题列表
VALID_THEMES = {"default", "book", "docs"}
# 合法状态列表
VALID_STATUSES = {"draft", "published", "archived"}


class WikiPublishingService:
    """Wiki 发布服务"""

    # ------------------------------------------------------------------
    # Publication 管理
    # ------------------------------------------------------------------

    async def create_publication(
        self,
        db: AsyncSession,
        *,
        corpus_id: UUID,
        name: str,
        slug: str | None = None,
        description: str | None = None,
        theme: str = "default",
    ) -> WikiPublication:
        """创建新的 Wiki 发布记录

        Args:
            db: 数据库会话
            corpus_id: 关联的语料库 ID
            name: 发布名称（如 "技术文档 Wiki"）
            slug: URL 友好标识（不传则从 name 自动生成）
            description: 描述文本
            theme: 主题风格 (default/book/docs)

        Returns:
            创建的发布记录

        Raises:
            ValueError: theme 不合法或 slug 格式错误
        """
        if theme not in VALID_THEMES:
            raise ValueError(f"Invalid theme: {theme!r}. Must be one of {VALID_THEMES}")

        if not slug:
            slug = self._slugify(name)

        if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", slug):
            raise ValueError(f"Invalid slug format: {slug!r}")

        return await WikiDao.create_publication(
            db,
            corpus_id=corpus_id,
            name=name,
            slug=slug,
            description=description,
            theme=theme,
        )

    async def get_publication(self, db: AsyncSession, pub_id: UUID) -> WikiPublication | None:
        """获取发布详情"""
        return await WikiDao.get_publication(db, pub_id)

    async def list_publications(
        self,
        db: AsyncSession,
        *,
        corpus_id: UUID | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[WikiPublication], int]:
        """列出发布记录"""
        return await WikiDao.list_publications(db, corpus_id=corpus_id, status=status, offset=offset, limit=limit)

    async def update_publication(
        self,
        db: AsyncSession,
        pub_id: UUID,
        **kwargs: Any,
    ) -> WikiPublication | None:
        """更新发布属性"""
        if "theme" in kwargs and kwargs["theme"] not in VALID_THEMES:
            raise ValueError(f"Invalid theme: {kwargs['theme']!r}")
        return await WikiDao.update_publication(db, pub_id, **kwargs)

    async def delete_publication(self, db: AsyncSession, pub_id: UUID) -> bool:
        """删除发布（级联删除所有条目）"""
        return await WikiDao.delete_publication(db, pub_id)

    # ------------------------------------------------------------------
    # 发布操作 (状态流转)
    # ------------------------------------------------------------------

    async def publish(self, db: AsyncSession, pub_id: UUID) -> WikiPublication | None:
        """触发发布：draft/published → published，递增版本号"""
        try:
            return await WikiDao.publish(db, pub_id)
        except ValueError as exc:
            logger.warning("wiki_publish_failed", pub_id=str(pub_id), error=str(exc))
            raise

    async def unpublish(self, db: AsyncSession, pub_id: UUID) -> WikiPublication | None:
        """取消发布：published → draft"""
        return await WikiDao.unpublish(db, pub_id)

    async def archive(self, db: AsyncSession, pub_id: UUID) -> WikiPublication | None:
        """归档发布：任意状态 → archived"""
        return await WikiDao.archive(db, pub_id)

    # ------------------------------------------------------------------
    # Entry 管理
    # ------------------------------------------------------------------

    async def add_entry(
        self,
        db: AsyncSession,
        *,
        publication_id: UUID,
        document_id: UUID,
        entry_slug: str,
        entry_title: str | None = None,
        is_index_page: bool = False,
    ) -> WikiPublicationEntry:
        """添加/更新文档到发布的映射条目"""
        return await WikiDao.upsert_entry(
            db,
            publication_id=publication_id,
            document_id=document_id,
            entry_slug=entry_slug,
            entry_title=entry_title,
            is_index_page=is_index_page,
        )

    async def remove_entry(self, db: AsyncSession, entry_id: UUID) -> bool:
        """移除条目"""
        return await WikiDao.remove_entry(db, entry_id)

    async def get_entries(self, db: AsyncSession, publication_id: UUID) -> list[WikiPublicationEntry]:
        """获取发布的所有条目"""
        return await WikiDao.get_entries(db, publication_id)

    async def get_entry_content(
        self,
        db: AsyncSession,
        entry_id: UUID,
    ) -> dict | None:
        """获取条目关联的 Markdown 内容"""
        return await WikiDao.get_entry_content(db, entry_id)

    async def get_nav_tree(
        self,
        db: AsyncSession,
        publication_id: UUID,
    ) -> list[dict]:
        """获取导航树结构"""
        return await WikiDao.get_nav_tree(db, publication_id)

    # ------------------------------------------------------------------
    # 批量操作
    # ------------------------------------------------------------------

    async def sync_entries_from_catalog(
        self,
        db: AsyncSession,
        *,
        publication_id: UUID,
        catalog_node_ids: list[UUID],
    ) -> int:
        """从目录节点批量同步文档到 Wiki 条目

        遍历指定目录节点下的所有文档，自动创建 Entry 映射。
        返回新增/更新的条目数量。

        Args:
            publication_id: 目标发布 ID
            catalog_node_ids: 要同步的目录节点 ID 列表

        Returns:
            同步的条目数
        """
        from negentropy.knowledge.catalog_dao import CatalogDao

        synced = 0
        for node_id in catalog_node_ids:
            docs, _ = await CatalogDao.get_node_documents(db, node_id, limit=500)
            for doc in docs:
                entry_slug = self._slugify(doc.filename or f"doc-{doc.id}")
                await WikiDao.upsert_entry(
                    db,
                    publication_id=publication_id,
                    document_id=doc.id,
                    entry_slug=entry_slug,
                    entry_title=(doc.metadata_ or {}).get("title") or doc.filename,
                )
                synced += 1

        logger.info(
            "wiki_entries_synced_from_catalog",
            extra={
                "publication_id": str(publication_id),
                "synced_count": synced,
            },
        )
        return synced

    # ------------------------------------------------------------------
    # 工具方法
    # ------------------------------------------------------------------

    @staticmethod
    def _slugify(text: str) -> str:
        """将文本转换为 URL-friendly slug"""
        import unicodedata

        normalized = unicodedata.normalize("NFKC", text)
        slug = re.sub(r"[^\w\s-]", "", normalized.lower())
        slug = re.sub(r"[\s_]+", "-", slug).strip("-")
        slug = re.sub(r"-{2,}", "-", slug)
        return slug or "untitled"
