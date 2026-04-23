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
        catalog_id: UUID,
        name: str,
        slug: str | None = None,
        description: str | None = None,
        theme: str = "default",
    ) -> WikiPublication:
        """创建新的 Wiki 发布记录

        Args:
            db: 数据库会话
            catalog_id: 关联的 Catalog ID
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
            catalog_id=catalog_id,
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
        catalog_id: UUID | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[WikiPublication], int]:
        """列出发布记录"""
        return await WikiDao.list_publications(db, catalog_id=catalog_id, status=status, offset=offset, limit=limit)

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
    ) -> dict:
        """从目录节点全量同步文档到 Wiki 条目（幂等）

        遍历指定目录节点的完整子树，将所有就绪文档自动创建 Entry 映射。
        设置 entry_order 为 Materialized Path（层级路径数组）以支持层级导航。

        **全量同步语义**：未覆盖到的既有条目将被移除，仅保留本次选中的文档。

        Args:
            publication_id: 目标发布 ID
            catalog_node_ids: 要同步的根目录节点 ID 列表

        Returns:
            {
                "synced_count": int,
                "errors": list[str],       # 前缀：skip:<doc_id>:<reason> / renamed:<doc_id>:<old>->:<new>
                "removed_count": int,
            }
        """
        import json

        from negentropy.knowledge.catalog_dao import CatalogDao

        synced = 0
        errors: list[str] = []
        synced_doc_ids: set[str] = set()
        seen_slugs: set[str] = set()

        for root_node_id in catalog_node_ids:
            subtree = await CatalogDao.get_subtree(db, root_node_id)
            if not subtree:
                errors.append(f"node:{root_node_id}:empty_subtree")
                continue

            node_map = {str(n["id"]): n for n in subtree}

            for node in subtree:
                # 构建从根到当前节点的层级 slug 路径（基于循环变量做环检测）
                path_slugs: list[str] = []
                current = node
                visited: set[str] = set()
                while current:
                    cur_id = str(current["id"])
                    if cur_id in visited:
                        errors.append(f"node:{cur_id}:cycle_detected")
                        break
                    visited.add(cur_id)
                    path_slugs.insert(0, current["slug"])
                    parent_id = current.get("parent_id")
                    if not parent_id:
                        break
                    current = node_map.get(str(parent_id))

                hierarchical_slug = "/".join(path_slugs)

                # 获取该节点下的文档
                docs, _ = await CatalogDao.get_node_documents(db, node["id"], limit=500)
                for doc in docs:
                    # 跳过未完成 markdown 提取的文档
                    if getattr(doc, "markdown_extract_status", None) != "completed":
                        errors.append(f"skip:{doc.id}:markdown_not_ready")
                        continue
                    if not getattr(doc, "markdown_content", None):
                        errors.append(f"skip:{doc.id}:no_content")
                        continue

                    doc_slug = self._slugify(doc.original_filename or f"doc-{doc.id}")
                    base_slug = f"{hierarchical_slug}/{doc_slug}" if hierarchical_slug else doc_slug

                    # slug 冲突兜底：追加 -2、-3...，避免违反 uq_wiki_entry_pub_slug
                    final_slug = base_slug
                    dedup_idx = 2
                    while final_slug in seen_slugs:
                        final_slug = f"{base_slug}-{dedup_idx}"
                        dedup_idx += 1
                    if final_slug != base_slug:
                        errors.append(f"renamed:{doc.id}:{base_slug}->:{final_slug}")
                    seen_slugs.add(final_slug)

                    final_doc_segment = final_slug.split("/")[-1]
                    entry_order = json.dumps(path_slugs + [final_doc_segment])

                    await WikiDao.upsert_entry(
                        db,
                        publication_id=publication_id,
                        document_id=doc.id,
                        entry_slug=final_slug,
                        entry_title=(doc.metadata_ or {}).get("title") or doc.original_filename,
                        entry_order=entry_order,
                    )
                    synced_doc_ids.add(str(doc.id))
                    synced += 1

        # 移除不再属于任何指定目录节点的条目（幂等性保证）
        removed = await WikiDao.remove_stale_entries(
            db,
            publication_id=publication_id,
            keep_document_ids=synced_doc_ids,
        )

        logger.info(
            "wiki_entries_synced_from_catalog",
            extra={
                "publication_id": str(publication_id),
                "synced_count": synced,
                "removed_count": removed,
                "errors_count": len(errors),
            },
        )
        return {"synced_count": synced, "errors": errors, "removed_count": removed}

    # ------------------------------------------------------------------
    # 工具方法
    # ------------------------------------------------------------------

    @staticmethod
    def _slugify(text: str) -> str:
        """将文本转换为 URL-friendly slug（严格 ASCII，对齐 wiki slug 校验正则）"""
        import unicodedata

        normalized = unicodedata.normalize("NFKC", text or "").lower()
        slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
        slug = re.sub(r"-{2,}", "-", slug)
        return slug or "untitled"
