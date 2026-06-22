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

import os
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.lifecycle_schemas import (
    WikiEntryContentResponse,
    WikiPublishTarget,
)
from negentropy.logging import get_logger
from negentropy.models.perception import WikiPublication, WikiPublicationEntry

from .slug import is_valid_slug, slugify
from .wiki_dao import WikiDao
from .wiki_redeploy import trigger_wiki_redeploy

logger = get_logger(__name__.rsplit(".", 1)[0])


def _spawn_wiki_deploy_script(
    script_relpath: str,
    *,
    env_overrides: dict[str, str] | None = None,
    spawn_log_key: str,
) -> None:
    """fire-and-forget spawn 一个相对仓库根的 wiki 部署脚本。

    ``subprocess.Popen`` 脱离请求生命周期后台运行；任何异常仅 WARN，绝不冒泡
    （``next build`` / git push 耗时且非事务性，不阻塞 publish 返回）。
    脚本路径为固定内部相对值（``script_relpath`` 不拼接外部输入），env 仅透传
    受信配置。

    与 ``trigger_wiki_redeploy``（webhook → 云端 CI）正交：本地 spawn 用本函数、
    分域/云端用 webhook。
    """
    try:
        import subprocess
        from pathlib import Path

        # 仓库根：本文件位于 apps/negentropy/src/negentropy/knowledge/lifecycle/。
        repo_root = Path(__file__).resolve().parents[6]
        script_path = (repo_root / script_relpath).resolve()
        if not script_path.is_file():
            logger.warning("wiki_deploy_script_missing", script=str(script_path))
            return

        env = dict(os.environ)
        if env_overrides:
            env.update(env_overrides)

        # fire-and-forget：脱离请求生命周期后台运行；输出交由脚本自身/系统日志。
        subprocess.Popen(  # noqa: S603 - 固定脚本路径，env 仅透传受信配置
            ["bash", str(script_path)],
            cwd=str(repo_root),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        logger.info(spawn_log_key, script=str(script_path))
    except Exception as exc:  # noqa: BLE001 - 主动吞噬：spawn 失败不阻塞发布
        logger.warning(f"{spawn_log_key}_failed", error=str(exc))


def _spawn_pages_publish() -> None:
    """生产目标：spawn ``publish-wiki-pages.sh``。

    全链路「导出（烘焙图片）→ next build → rsync → git push 到
    ``threefish-ai.github.io`` master」，直接更新 https://threefish-ai.github.io/。
    目标仓库/分支/token 由 ``wiki_pages_publish`` 配置可选覆盖；缺省时脚本回退
    ``gh auth token`` / SSH 凭证。fire-and-forget（由 ``publish(target=PRODUCTION)``
    显式触发）。
    """
    from negentropy.config import settings

    cfg = settings.knowledge.wiki_pages_publish
    env_overrides: dict[str, str] = {"WIKI_PAGES_BRANCH": cfg.branch}
    if cfg.repo:
        env_overrides["WIKI_PAGES_REPO"] = cfg.repo
    if cfg.token is not None:
        token_value = cfg.token.get_secret_value()
        if token_value:
            env_overrides["WIKI_PAGES_TOKEN"] = token_value
    _spawn_wiki_deploy_script(
        cfg.script,
        env_overrides=env_overrides,
        spawn_log_key="wiki_pages_publish_spawned",
    )


def _spawn_local_wiki_rebuild() -> None:
    """本地目标：spawn ``build-wiki-local.sh``。

    「导出 ``content/`` → ``next build`` 重建 ``apps/negentropy-wiki/out/``」，
    重建后由本地 wiki（``:3092``）serve 新产物（测试环境）。
    fire-and-forget（由 ``publish(target=LOCAL)`` 触发，默认目标）。
    """
    _spawn_wiki_deploy_script(
        "scripts/build-wiki-local.sh",
        env_overrides=None,
        spawn_log_key="wiki_local_rebuild_spawned",
    )


# 合法主题列表
VALID_THEMES = {"default", "book", "docs"}
# 合法状态列表
VALID_STATUSES = {"draft", "published", "archived"}


def build_entry_content_response(
    entry_id: UUID,
    content_data: dict,
    *,
    entry_slug: str = "",
) -> WikiEntryContentResponse:
    """由 ``WikiDao.get_entry_content`` 的原始 dict 构建对外响应（单一事实源）。

    解析作者信息（metadata 手动覆盖 > DocSource.author）、来源 URL、发布时间，
    与 ``routes.wiki.get_wiki_entry_content`` 共享同一逻辑，避免双份维护漂移
    （DRY：Wiki API 响应与静态内容包导出逐字段一致）。

    Args:
        entry_id: 条目 ID。
        content_data: ``WikiDao.get_entry_content`` 返回的 dict（含 markdown_content /
            title / metadata / author / source_url / entry_created_at 等）。
        entry_slug: 条目 slug；Wiki API 因历史原因传空串，静态导出传入真实 slug。
    """
    metadata = content_data.get("metadata", {})
    author_raw = metadata.get("author") or content_data.get("author")
    author_name: str | None = None
    author_url: str | None = None

    if author_raw:
        author_str = str(author_raw).strip()
        explicit_url = metadata.get("author_url")
        if explicit_url and isinstance(explicit_url, str):
            author_url = explicit_url
            if not author_name:
                author_name = author_str.rstrip("/").rsplit("/", 1)[-1] if author_str.startswith("http") else author_str
        elif author_str.startswith("http"):
            author_url = author_str
            author_name = author_str.rstrip("/").rsplit("/", 1)[-1]
        else:
            author_name = author_str

    published_at: str | None = None
    entry_created_at = content_data.get("entry_created_at")
    if entry_created_at:
        published_at = entry_created_at.isoformat() if hasattr(entry_created_at, "isoformat") else str(entry_created_at)

    return WikiEntryContentResponse(
        entry_id=entry_id,
        document_id=content_data["document_id"],
        entry_slug=entry_slug,
        entry_title=content_data.get("title"),
        markdown_content=content_data.get("markdown_content"),
        document_filename=content_data.get("filename") or "",
        author_name=author_name,
        author_url=author_url,
        source_url=content_data.get("source_url"),
        published_at=published_at,
    )


def _resolve_doc_display_title(doc: Any) -> str:
    """决定文档在 Wiki 站点上的展示标题（单一事实源）。

    优先级：``display_name``（用户手填覆盖）→ ``metadata_.title``
    （PDF / 抓取自动抽取）→ ``original_filename``（兜底）。

    用于 :meth:`WikiPublishingService.sync_publication` 与
    ``routes.wiki.get_entry_content``，保证后端 entry_title 与前端
    SSG 展示一致。
    """
    display_name = (getattr(doc, "display_name", None) or "").strip()
    if display_name:
        return display_name
    meta_title = (doc.metadata_ or {}).get("title") if getattr(doc, "metadata_", None) else None
    if isinstance(meta_title, str) and meta_title.strip():
        return meta_title.strip()
    return doc.original_filename


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

    async def publish(
        self,
        db: AsyncSession,
        pub_id: UUID,
        *,
        target: WikiPublishTarget = WikiPublishTarget.LOCAL,
    ) -> tuple[WikiPublication | None, str]:
        """触发发布：draft/published → published，递增版本号。

        - ``publish_mode == 'SNAPSHOT'``：同步冻结 entries 到 snapshots 表。
        - 始终触发 ``trigger_wiki_redeploy``（webhook → 云端 CI；本地未配置即 no-op，
          保留云端部署回溯兼容）。
        - 按 ``target`` fire-and-forget spawn 部署脚本（不阻塞 publish 返回）：
          - ``LOCAL``：重建本地 wiki（``build-wiki-local.sh``，测试环境）。
          - ``PRODUCTION``：推送到 ``threefish-ai.github.io`` master
            （``publish-wiki-pages.sh``，生产环境）。

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
            revalidation = await trigger_wiki_redeploy(
                publication_id=pub.id,
                pub_slug=pub.slug,
                app_name=pub.app_name,
                event="publish",
            )
            # 目标路由 spawn（fire-and-forget）：显式目标即授权，不再受
            # wiki_pages_publish.enabled 门控。
            if target == WikiPublishTarget.PRODUCTION:
                _spawn_pages_publish()
            else:
                _spawn_local_wiki_rebuild()

        return pub, revalidation

    async def unpublish(self, db: AsyncSession, pub_id: UUID) -> tuple[WikiPublication | None, str]:
        """取消发布：published → draft，并通知 SSG 主动 revalidate。

        Returns:
            ``(publication, revalidation_status)``。
        """
        pub = await WikiDao.unpublish(db, pub_id)
        revalidation = "not_configured"
        if pub is not None:
            revalidation = await trigger_wiki_redeploy(
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

        frozen_entries 仅冻结条目映射元数据（id/slug/title/description/path/
        is_index_page/document_id/entry_position），不冗余 markdown 内容——
        SSG 仍从 ``KnowledgeDocument`` 按 document_id 拉取，避免快照表膨胀。
        """
        entries = await WikiDao.get_entries(db, pub.id)
        frozen = [
            {
                "entry_id": str(e.id),
                "entry_slug": e.entry_slug,
                "entry_title": e.entry_title,
                "entry_description": e.entry_description,
                "entry_path": e.entry_path,
                "is_index_page": bool(e.is_index_page),
                "document_id": str(e.document_id),
                "entry_position": e.entry_position,
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

    async def count_document_entries(self, db: AsyncSession, publication_id: UUID) -> int:
        """计算发布中 DOCUMENT 类型条目数量。"""
        return await WikiDao.count_document_entries(db, publication_id)

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
        """遍历最小覆盖根集，摊平为容器计划 + 文档计划两类序列。

        当用户在选择对话框中同时勾选祖先与后代节点时（如 ``Harness-Engineering``
        与其子目录 ``Paper`` 并选），原本应共享同一棵树的节点会被独立当作多个
        同步根：第二轮以 ``Paper`` 为根的 ``get_subtree`` 不含其父节点，
        :meth:`_build_path_slugs` 沿 ``parent_id`` 回溯时在 ``node_map`` 中找不到祖先
        而提前终止，``Paper`` 的 ``path_slugs`` 退化为 ``["paper"]``，进而通过
        ``upsert_container_entry`` ``(publication_id, catalog_node_id)`` 唯一键覆盖
        首轮已正确写入的 ``["harness-engineering", "paper"]``，最终被
        ``build_nav_tree`` 视为独立顶层根（``len(path) <= 1``）。

        本函数因此先做 **最小覆盖根集（minimal antichain）** 过滤：若某入选节点是
        另一入选节点的后代，则丢弃后代，仅保留处于其外层的祖先作为遍历根，确保
        每个 FOLDER 仅在一棵子树语境下生成 plans，``entry_path`` 与 Catalog 原生
        父子层级保持一致。

        Returns:
            ``(container_plans, document_plans, errors)`` ——
              - ``container_plans``：``[(path_slugs, node_dict), ...]``，每个
                FOLDER 节点对应一条；
              - ``document_plans``：``[(path_slugs_with_parent_segment, doc), ...]``；
              - ``errors``：遍历期错误（``empty_subtree`` / ``cycle_detected`` /
                ``descendant_of:<ancestor_id>`` 表示因祖先并选而被丢弃）。
        """
        from .catalog_assignment_dao import CatalogAssignmentDao
        from .catalog_dao import CatalogDao

        container_plans: list[tuple[list[str], dict]] = []
        document_plans: list[tuple[list[str], Any]] = []
        errors: list[str] = []

        # P1: 拉取每个候选根的子树，缓存以避免在去重阶段重复 IO。
        # dict 键去重天然处理同一 ID 重复传入的情况。
        subtrees_by_root: dict[str, list[dict]] = {}
        for root_node_id in catalog_node_ids:
            rid = str(root_node_id)
            if rid in subtrees_by_root:
                continue
            subtree = await CatalogDao.get_subtree(db, root_node_id)
            if not subtree:
                errors.append(f"node:{root_node_id}:empty_subtree")
                continue
            subtrees_by_root[rid] = subtree

        # P2: 计算最小覆盖根集。若 rid 出现在另一根的后代集合中，则丢弃 rid。
        descendants_by_root: dict[str, set[str]] = {
            rid: {str(n["id"]) for n in subtree if str(n["id"]) != rid} for rid, subtree in subtrees_by_root.items()
        }
        minimal_root_ids: list[str] = []
        for rid in subtrees_by_root:
            ancestor = next(
                (other for other in subtrees_by_root if other != rid and rid in descendants_by_root[other]),
                None,
            )
            if ancestor is not None:
                errors.append(f"node:{rid}:descendant_of:{ancestor}")
                continue
            minimal_root_ids.append(rid)

        # P3: 仅对最小根集生成 plans，下游 _apply_* 接口与契约不变。
        for root_id in minimal_root_ids:
            subtree = subtrees_by_root[root_id]
            node_map = {str(n["id"]): n for n in subtree}

            for node in subtree:
                path_slugs, cycle_node_id = self._build_path_slugs(node, node_map)
                if cycle_node_id is not None:
                    errors.append(f"node:{cycle_node_id}:cycle_detected")
                    continue

                # 仅 FOLDER（含历史 CATEGORY / COLLECTION）成为 CONTAINER
                # Wiki 条目；DOCUMENT_REF 是文档引用叶子节点，不是结构容器，
                # 不应创建 CONTAINER 条目（否则其 slug 可能与已有 DOCUMENT 条目
                # 冲突触发 uq_wiki_entry_pub_slug 唯一约束违反）。
                if node.get("node_type") == "folder":
                    container_plans.append((path_slugs, node))

                # 使用 get_node_document_refs 获取文档 + position 排序值；
                # 对 DOCUMENT_REF 节点调用返回空集（无 DOCUMENT_REF 子节点），无副作用。
                doc_refs = await CatalogAssignmentDao.get_node_document_refs(db, node["id"])
                for doc, pos in doc_refs:
                    document_plans.append((path_slugs, doc, pos))

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
                entry_description=node.get("description"),
                entry_path=entry_path,
                entry_position=node.get("sort_order", 0),
            )
            synced_node_ids.add(str(node["id"]))
            count += 1

        return count, errors, synced_node_ids

    async def _apply_document_mappings(
        self,
        db: AsyncSession,
        *,
        publication_id: UUID,
        plans: list[tuple[list[str], Any, int]],
        seen_slugs: set[str],
    ) -> tuple[int, list[str], set[str]]:
        """对 DOCUMENT 计划应用 Wiki Entry 映射；处理 markdown 就绪 + slug 冲突。

        ``seen_slugs`` 与 :meth:`_apply_container_mappings` 共享，CONTAINER 先
        登记 slug，DOCUMENT 端遇冲突则走 ``-2/-3`` 后缀兜底。

        ``plans`` 元组格式：``(path_slugs, doc, position)``，其中 ``position``
        源自 Catalog DOCUMENT_REF 的 ``position`` 列，传递给 Wiki Entry 的
        ``entry_position`` 以保持排序一致性。

        Returns:
            ``(synced_count, errors, synced_doc_ids)``。
        """
        import json

        synced = 0
        errors: list[str] = []
        synced_doc_ids: set[str] = set()

        for path_slugs, doc, position in plans:
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
                entry_title=_resolve_doc_display_title(doc),
                entry_path=entry_path,
                entry_position=position,
            )
            synced_doc_ids.add(str(doc.id))
            synced += 1

        return synced, errors, synced_doc_ids
