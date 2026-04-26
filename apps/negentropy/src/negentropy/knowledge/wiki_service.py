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

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.revalidate import trigger_wiki_revalidate
from negentropy.knowledge.slug import is_valid_slug, slugify
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
        app_name: str,
        name: str,
        slug: str | None = None,
        description: str | None = None,
        theme: str = "default",
    ) -> WikiPublication:
        """创建新的 Wiki 发布记录

        Args:
            db: 数据库会话
            catalog_id: 关联的 Catalog ID
            app_name: 应用名称（从 Catalog 推导）
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
            slug = slugify(name)

        if not is_valid_slug(slug):
            raise ValueError(f"Invalid slug format: {slug!r}")

        return await WikiDao.create_publication(
            db,
            catalog_id=catalog_id,
            app_name=app_name,
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

    async def publish(self, db: AsyncSession, pub_id: UUID) -> tuple[WikiPublication | None, str]:
        """触发发布：draft/published → published，递增版本号。

        - ``publish_mode == 'SNAPSHOT'``：同步冻结 entries 到 snapshots 表。
        - 配置了 ``wiki_revalidate.url``：异步通知 SSG 主动 ISR revalidate（失败仅 WARN）。

        Returns:
            ``(publication, revalidation_status)`` — revalidation_status 为
            ``"dispatched"`` / ``"failed"`` / ``"not_configured"``。
        """
        try:
            pub = await WikiDao.publish(db, pub_id)
        except ValueError as exc:
            logger.warning("wiki_publish_failed", pub_id=str(pub_id), error=str(exc))
            raise

        revalidation = "not_configured"

        if pub is not None and pub.publish_mode == "SNAPSHOT":
            await self._freeze_snapshot(db, pub)

        if pub is not None:
            revalidation = await trigger_wiki_revalidate(
                publication_id=pub.id,
                pub_slug=pub.slug,
                app_name=pub.app_name,
                event="publish",
            )

        return pub, revalidation

    async def unpublish(self, db: AsyncSession, pub_id: UUID) -> tuple[WikiPublication | None, str]:
        """取消发布：published → draft，并通知 SSG 主动 revalidate。

        Returns:
            ``(publication, revalidation_status)``。
        """
        pub = await WikiDao.unpublish(db, pub_id)
        revalidation = "not_configured"
        if pub is not None:
            revalidation = await trigger_wiki_revalidate(
                publication_id=pub.id,
                pub_slug=pub.slug,
                app_name=pub.app_name,
                event="unpublish",
            )
        return pub, revalidation

    async def archive(self, db: AsyncSession, pub_id: UUID) -> WikiPublication | None:
        """归档发布：任意状态 → archived"""
        return await WikiDao.archive(db, pub_id)

    async def _freeze_snapshot(
        self,
        db: AsyncSession,
        pub: WikiPublication,
    ) -> None:
        """SNAPSHOT 模式：冻结当前 entries 到 wiki_publication_snapshots。

        frozen_entries 仅冻结条目映射元数据（id/slug/title/path/is_index_page/
        document_id），不冗余 markdown 内容——SSG 仍从 ``KnowledgeDocument``
        按 document_id 拉取，避免快照表膨胀。
        """
        entries = await WikiDao.get_entries(db, pub.id)
        frozen = [
            {
                "entry_id": str(e.id),
                "entry_slug": e.entry_slug,
                "entry_title": e.entry_title,
                "entry_path": e.entry_path,
                "is_index_page": bool(e.is_index_page),
                "document_id": str(e.document_id),
            }
            for e in entries
        ]
        await WikiDao.create_snapshot(
            db,
            publication_id=pub.id,
            version=pub.version,
            frozen_entries=frozen,
            metadata={"app_name": pub.app_name, "theme": pub.theme},
        )
        logger.info(
            "wiki_snapshot_frozen",
            pub_id=str(pub.id),
            version=pub.version,
            entries_count=len(frozen),
        )

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
        """从目录节点全量同步容器 + 文档到 Wiki 条目（幂等）。

        协调器：先 :meth:`_collect_subtree_plans` 摊平 Catalog 子树为
        ``(container_plans, document_plans)`` 两类计划流，再
        :meth:`_apply_entry_mappings` 将其分别映射为 CONTAINER / DOCUMENT 类型
        Wiki Entry 并去除孤立条目。两阶段拆分使"Catalog 遍历"与"Wiki 映射"两个
        正交职责可独立测试与演进。

        **全量同步语义**：未覆盖到的既有条目（含 CONTAINER 与 DOCUMENT）将被移除。

        Returns:
            ``{"synced_count": int, "container_count": int, "errors": list[str],
              "removed_count": int}``。
            ``errors`` 前缀语义：``skip:<doc_id>:<reason>`` /
            ``renamed:<doc_id>:<old>->:<new>`` / ``node:<id>:<reason>``。
        """
        container_plans, document_plans, errors = await self._collect_subtree_plans(db, catalog_node_ids)

        # 共享 slug 命名空间：``uq_wiki_entry_pub_slug`` 跨 entry_kind 全局唯一，
        # CONTAINER 与 DOCUMENT 不能各自维护 dedup 集合（否则 FOLDER `b` 与同级
        # 文档 ``b.md`` 会写入相同 slug 触发 IntegrityError）。
        seen_slugs: set[str] = set()

        container_count, container_errors, synced_node_ids = await self._apply_container_mappings(
            db, publication_id=publication_id, plans=container_plans, seen_slugs=seen_slugs
        )
        errors.extend(container_errors)

        synced, doc_errors, synced_doc_ids = await self._apply_document_mappings(
            db, publication_id=publication_id, plans=document_plans, seen_slugs=seen_slugs
        )
        errors.extend(doc_errors)

        removed = await WikiDao.remove_stale_entries(
            db,
            publication_id=publication_id,
            keep_document_ids=synced_doc_ids,
            keep_container_node_ids=synced_node_ids,
        )

        logger.info(
            "wiki_entries_synced_from_catalog",
            extra={
                "publication_id": str(publication_id),
                "synced_count": synced,
                "container_count": container_count,
                "removed_count": removed,
                "errors_count": len(errors),
            },
        )
        return {
            "synced_count": synced,
            "container_count": container_count,
            "errors": errors,
            "removed_count": removed,
        }

    async def _collect_subtree_plans(
        self,
        db: AsyncSession,
        catalog_node_ids: list[UUID],
    ) -> tuple[list[tuple[list[str], dict]], list[tuple[list[str], Any]], list[str]]:
        """遍历每个根节点子树，摊平为容器计划 + 文档计划两类序列。

        Returns:
            ``(container_plans, document_plans, errors)`` ——
              - ``container_plans``：``[(path_slugs, node_dict), ...]``，每个
                FOLDER 节点对应一条；
              - ``document_plans``：``[(path_slugs_with_parent_segment, doc), ...]``；
              - ``errors``：遍历期错误（环检测、空子树）。
        """
        from negentropy.knowledge.catalog_dao import CatalogDao

        container_plans: list[tuple[list[str], dict]] = []
        document_plans: list[tuple[list[str], Any]] = []
        errors: list[str] = []

        for root_node_id in catalog_node_ids:
            subtree = await CatalogDao.get_subtree(db, root_node_id)
            if not subtree:
                errors.append(f"node:{root_node_id}:empty_subtree")
                continue

            node_map = {str(n["id"]): n for n in subtree}

            for node in subtree:
                path_slugs, cycle_node_id = self._build_path_slugs(node, node_map)
                if cycle_node_id is not None:
                    errors.append(f"node:{cycle_node_id}:cycle_detected")
                    continue

                container_plans.append((path_slugs, node))

                docs, _ = await CatalogDao.get_node_documents(db, node["id"], limit=500)
                for doc in docs:
                    document_plans.append((path_slugs, doc))

        return container_plans, document_plans, errors

    @staticmethod
    def _build_path_slugs(
        node: dict,
        node_map: dict[str, dict],
    ) -> tuple[list[str], str | None]:
        """从指定 node 沿 parent_id 链回溯到根，构造 slug 路径。

        Returns:
            ``(path_slugs, cycle_node_id)``。``cycle_node_id`` 非 None 时表示在该
            节点处检测到环，调用方应跳过。
        """
        path_slugs: list[str] = []
        visited: set[str] = set()
        current: dict | None = node
        while current is not None:
            cur_id = str(current["id"])
            if cur_id in visited:
                return path_slugs, cur_id
            visited.add(cur_id)
            path_slugs.insert(0, current["slug"])
            parent_id = current.get("parent_id")
            if not parent_id:
                break
            current = node_map.get(str(parent_id))
        return path_slugs, None

    async def _apply_container_mappings(
        self,
        db: AsyncSession,
        *,
        publication_id: UUID,
        plans: list[tuple[list[str], dict]],
        seen_slugs: set[str],
    ) -> tuple[int, list[str], set[str]]:
        """为每个 FOLDER 节点写入 CONTAINER 类型 Wiki Entry。

        ``entry_slug`` 取 path 拼接（与 DOCUMENT 同形态）；``entry_title`` 取
        Catalog 节点的 ``name``，弥补"用 slug 段当 title"的 UX 缺口。

        ``seen_slugs`` 由调用方注入并与 :meth:`_apply_document_mappings` 共享，
        以保证 CONTAINER / DOCUMENT 跨类型也能命中 ``uq_wiki_entry_pub_slug``
        全局唯一约束的 dedup 兜底（``-2/-3`` 后缀）。

        Returns:
            ``(container_count, errors, synced_node_ids)``。
        """
        import json

        count = 0
        errors: list[str] = []
        synced_node_ids: set[str] = set()

        for path_slugs, node in plans:
            if not path_slugs:
                errors.append(f"node:{node.get('id')}:empty_path")
                continue

            base_slug = "/".join(path_slugs)
            final_slug = base_slug
            dedup_idx = 2
            while final_slug in seen_slugs:
                final_slug = f"{base_slug}-{dedup_idx}"
                dedup_idx += 1
            if final_slug != base_slug:
                errors.append(f"renamed:node:{node.get('id')}:{base_slug}->:{final_slug}")
            seen_slugs.add(final_slug)

            entry_path = json.dumps(path_slugs)

            await WikiDao.upsert_container_entry(
                db,
                publication_id=publication_id,
                catalog_node_id=node["id"],
                entry_slug=final_slug,
                entry_title=node.get("name") or path_slugs[-1],
                entry_path=entry_path,
            )
            synced_node_ids.add(str(node["id"]))
            count += 1

        return count, errors, synced_node_ids

    async def _apply_document_mappings(
        self,
        db: AsyncSession,
        *,
        publication_id: UUID,
        plans: list[tuple[list[str], Any]],
        seen_slugs: set[str],
    ) -> tuple[int, list[str], set[str]]:
        """对 DOCUMENT 计划应用 Wiki Entry 映射；处理 markdown 就绪 + slug 冲突。

        ``seen_slugs`` 与 :meth:`_apply_container_mappings` 共享，CONTAINER 先
        登记 slug，DOCUMENT 端遇冲突则走 ``-2/-3`` 后缀兜底。

        Returns:
            ``(synced_count, errors, synced_doc_ids)``。
        """
        import json

        synced = 0
        errors: list[str] = []
        synced_doc_ids: set[str] = set()

        for path_slugs, doc in plans:
            if getattr(doc, "markdown_extract_status", None) != "completed":
                errors.append(f"skip:{doc.id}:markdown_not_ready")
                continue
            if not getattr(doc, "markdown_content", None):
                errors.append(f"skip:{doc.id}:no_content")
                continue

            hierarchical_slug = "/".join(path_slugs)
            doc_slug = slugify(doc.original_filename or f"doc-{doc.id}")
            base_slug = f"{hierarchical_slug}/{doc_slug}" if hierarchical_slug else doc_slug

            # slug 冲突兜底：追加 -2、-3...，避免违反 uq_wiki_entry_pub_slug。
            final_slug = base_slug
            dedup_idx = 2
            while final_slug in seen_slugs:
                final_slug = f"{base_slug}-{dedup_idx}"
                dedup_idx += 1
            if final_slug != base_slug:
                errors.append(f"renamed:{doc.id}:{base_slug}->:{final_slug}")
            seen_slugs.add(final_slug)

            final_doc_segment = final_slug.split("/")[-1]
            entry_path = json.dumps(path_slugs + [final_doc_segment])

            await WikiDao.upsert_entry(
                db,
                publication_id=publication_id,
                document_id=doc.id,
                entry_slug=final_slug,
                entry_title=(doc.metadata_ or {}).get("title") or doc.original_filename,
                entry_path=entry_path,
            )
            synced_doc_ids.add(str(doc.id))
            synced += 1

        return synced, errors, synced_doc_ids
