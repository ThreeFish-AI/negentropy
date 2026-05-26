"""Auto-extracted route module: Wiki publishing."""

from __future__ import annotations

import mimetypes
import re
from io import BytesIO
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import ValidationError  # noqa: F401
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.db.session import AsyncSessionLocal
from negentropy.knowledge._shared import (
    _get_wiki_service,
)
from negentropy.logging import get_logger
from negentropy.models.perception import KnowledgeDocument, WikiPublicationEntry

if TYPE_CHECKING:
    pass

# Lifecycle schema imports
from negentropy.knowledge.lifecycle_schemas import (  # noqa: F401
    AssignDocumentRequest,
    CatalogTreeResponse,
    CategorySuggestionResponse,
    DocumentProvenanceResponse,
    WikiAnnotationCreateRequest,
    WikiAnnotationListResponse,
    WikiAnnotationResponse,
    WikiAnnotationUpdateRequest,
    WikiCommentCreateRequest,
    WikiCommentListResponse,
    WikiCommentResponse,
    WikiCommentUpdateRequest,
    WikiEntryContentResponse,
    WikiNavTreeResponse,
    WikiPublishActionResponse,
)
from negentropy.knowledge.lifecycle_schemas import SyncFromCatalogRequest as _SyncFromCatalogReq
from negentropy.knowledge.lifecycle_schemas import SyncFromCatalogResponse as _SyncFromCatalogResp
from negentropy.knowledge.lifecycle_schemas import WikiPublicationCreateRequest as _WikiPubCreateReq
from negentropy.knowledge.lifecycle_schemas import WikiPublicationListResponse as _WikiPubListResp
from negentropy.knowledge.lifecycle_schemas import WikiPublicationResponse as _WikiPubResp

logger = get_logger("negentropy.knowledge.api")
router = APIRouter()


@router.post("/wiki/publications")
async def create_wiki_publication(
    body: _WikiPubCreateReq,
) -> _WikiPubResp:
    """创建新的 Wiki 发布记录

    初始状态为 draft，需调用 publish 端点后 SSG 应用才能拉取数据。

    错误码：
      - 404 ``CATALOG_NOT_FOUND``：catalog_id 不存在；
      - 400 ``WIKI_PUB_INVALID_PARAM``：theme/slug 等参数不合法；
      - 409 ``WIKI_PUB_CATALOG_LIVE_CONFLICT``：该 catalog 已存在 1 个 LIVE 发布
        （`uq_wiki_pub_catalog_active` 部分唯一索引：每 catalog 仅允许 1 个 LIVE）；
      - 409 ``WIKI_PUB_SLUG_CONFLICT``：该 catalog 下 slug 重复
        （`uq_wiki_pub_catalog_slug` 唯一约束）。
    """
    from negentropy.knowledge.lifecycle.slug import slugify
    from negentropy.models.perception import DocCatalog, WikiPublication

    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        catalog = await db.get(DocCatalog, body.catalog_id)
        if catalog is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CATALOG_NOT_FOUND", "message": "Catalog not found"},
            )

        # ------------------------------------------------------------------
        # 业务前置检查（消解 99% 冲突场景，错误信息最清晰）
        # ------------------------------------------------------------------
        live_existing = (
            await db.execute(
                select(WikiPublication.id, WikiPublication.name, WikiPublication.slug)
                .where(
                    WikiPublication.catalog_id == body.catalog_id,
                    WikiPublication.publish_mode == "LIVE",
                )
                .limit(1)
            )
        ).first()
        if live_existing is not None:
            existing_id, existing_name, existing_slug = live_existing
            logger.warning(
                "wiki_pub_conflict_live",
                catalog_id=str(body.catalog_id),
                existing_publication_id=str(existing_id),
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "WIKI_PUB_CATALOG_LIVE_CONFLICT",
                    "message": "该 Catalog 已有一个生效中的 Wiki 发布，请先归档旧发布或在已有发布上编辑。",
                    "details": {
                        "catalog_id": str(body.catalog_id),
                        "existing_publication_id": str(existing_id),
                        "existing_publication_name": existing_name,
                        "existing_publication_slug": existing_slug,
                    },
                },
            )

        # 与 service 内部 slug 归一化逻辑保持一致（避免双重 slugify）
        normalized_slug = body.slug or slugify(body.name)
        slug_existing_id = await db.scalar(
            select(WikiPublication.id)
            .where(
                WikiPublication.catalog_id == body.catalog_id,
                WikiPublication.slug == normalized_slug,
            )
            .limit(1)
        )
        if slug_existing_id is not None:
            logger.warning(
                "wiki_pub_conflict_slug",
                catalog_id=str(body.catalog_id),
                slug=normalized_slug,
                existing_publication_id=str(slug_existing_id),
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "WIKI_PUB_SLUG_CONFLICT",
                    "message": f"该 Catalog 下已存在 slug 为 '{normalized_slug}' 的 Wiki 发布，请更换 slug 后重试。",
                    "details": {
                        "catalog_id": str(body.catalog_id),
                        "slug": normalized_slug,
                        "existing_publication_id": str(slug_existing_id),
                    },
                },
            )

        # ------------------------------------------------------------------
        # 创建 + commit；用 IntegrityError 兜底竞态 / 未来新约束
        # ------------------------------------------------------------------
        try:
            pub = await wiki_svc.create_publication(
                db,
                catalog_id=body.catalog_id,
                app_name=catalog.app_name,
                name=body.name,
                slug=body.slug,
                description=body.description,
                theme=body.theme,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "WIKI_PUB_INVALID_PARAM", "message": str(exc)},
            ) from exc

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            err_text = str(exc.orig) if exc.orig is not None else str(exc)
            if "uq_wiki_pub_catalog_active" in err_text:
                code = "WIKI_PUB_CATALOG_LIVE_CONFLICT"
                message = "该 Catalog 已有一个生效中的 Wiki 发布，请先归档旧发布或在已有发布上编辑。"
            elif "uq_wiki_pub_catalog_slug" in err_text:
                code = "WIKI_PUB_SLUG_CONFLICT"
                message = f"该 Catalog 下已存在 slug 为 '{normalized_slug}' 的 Wiki 发布，请更换 slug 后重试。"
            else:
                code = "WIKI_PUB_CONFLICT"
                message = "Wiki 发布创建冲突，请刷新后重试。"
            logger.warning(
                "wiki_pub_conflict_integrity",
                catalog_id=str(body.catalog_id),
                slug=normalized_slug,
                code=code,
                error=err_text,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": code,
                    "message": message,
                    "details": {
                        "catalog_id": str(body.catalog_id),
                        "slug": normalized_slug,
                    },
                },
            ) from exc

    logger.info("api_create_wiki_pub", pub_id=str(pub.id), catalog_id=str(body.catalog_id))
    resp = _WikiPubResp.model_validate(pub)
    resp.entries_count = 0
    return resp


@router.get("/wiki/publications")
async def list_wiki_publications(
    catalog_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> _WikiPubListResp:
    """列出 Wiki 发布记录"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        pubs, total = await wiki_svc.list_publications(
            db, catalog_id=catalog_id, status=status, offset=offset, limit=limit
        )

        items = []
        for pub in pubs:
            resp = _WikiPubResp.model_validate(pub)
            resp.entries_count = sum(1 for e in (pub.entries or []) if e.entry_kind == "DOCUMENT")
            items.append(resp)

    return _WikiPubListResp(items=items, total=total)


@router.get("/wiki/publications/{pub_id}")
async def get_wiki_publication(pub_id: UUID) -> _WikiPubResp:
    """获取单个 Wiki 发布详情"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        pub = await wiki_svc.get_publication(db, pub_id)

        if pub is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")

        resp = _WikiPubResp.model_validate(pub)
        resp.entries_count = sum(1 for e in (pub.entries or []) if e.entry_kind == "DOCUMENT")

    return resp


@router.patch("/wiki/publications/{pub_id}")
async def update_wiki_publication(
    pub_id: UUID,
    body: dict,  # 使用 dict 接受灵活更新字段
):
    """更新 Wiki 发布属性（部分更新）"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        try:
            pub = await wiki_svc.update_publication(db, pub_id, **body)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        if pub is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")
        await db.commit()

    logger.info("api_update_wiki_pub", pub_id=str(pub_id))
    return {"detail": "Publication updated"}


@router.delete("/wiki/publications/{pub_id}")
async def delete_wiki_publication(pub_id: UUID):
    """删除 Wiki 发布（级联删除所有条目）"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        deleted = await wiki_svc.delete_publication(db, pub_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")
        await db.commit()

    logger.info("api_delete_wiki_pub", pub_id=str(pub_id))
    return {"detail": "Publication deleted"}


# --- 发布操作 ---


@router.post("/wiki/publications/{pub_id}/publish")
async def publish_wiki(pub_id: UUID) -> WikiPublishActionResponse:
    """触发发布：将 draft/published 状态转为 published，递增版本号

    SSG 应用 (apps/negentropy-wiki) 在 ISR 再验证窗口内会自动拉取最新数据。
    响应中的 revalidation 字段反映 ISR 主动通知的状态。
    """
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        try:
            pub, revalidation_status = await wiki_svc.publish(db, pub_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        if pub is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")

        doc_count = await wiki_svc.count_document_entries(db, pub_id)
        await db.commit()

    logger.info("api_publish_wiki", pub_id=str(pub_id), version=pub.version)

    return WikiPublishActionResponse(
        publication_id=pub.id,
        status=pub.status,
        version=pub.version,
        published_at=pub.published_at,
        entries_count=doc_count,
        message=f"Published successfully (v{pub.version})",
        revalidation=revalidation_status,
    )


@router.post("/wiki/publications/{pub_id}/unpublish")
async def unpublish_wiki(pub_id: UUID) -> WikiPublishActionResponse:
    """取消发布：published → draft"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        pub, revalidation_status = await wiki_svc.unpublish(db, pub_id)
        if pub is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")
        doc_count = await wiki_svc.count_document_entries(db, pub_id)
        await db.commit()

    return WikiPublishActionResponse(
        publication_id=pub.id,
        status=pub.status,
        version=pub.version,
        published_at=pub.published_at,
        entries_count=doc_count,
        message="Unpublished successfully",
        revalidation=revalidation_status,
    )


# --- 条目管理 ---


@router.get("/wiki/publications/{pub_id}/entries")
async def get_wiki_entries(pub_id: UUID):
    """获取发布的所有条目列表"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        entries = await wiki_svc.get_entries(db, pub_id)

    items = [
        {
            "id": str(e.id),
            "document_id": str(e.document_id),
            "entry_slug": e.entry_slug,
            "entry_title": e.entry_title,
            "is_index_page": e.is_index_page,
        }
        for e in entries
    ]

    return {"items": items, "total": len(items)}


@router.post(
    "/wiki/publications/{pub_id}/sync-from-catalog",
    response_model=_SyncFromCatalogResp,
)
async def sync_wiki_from_catalog(
    pub_id: UUID,
    body: _SyncFromCatalogReq,
) -> _SyncFromCatalogResp:
    """从 Catalog 节点全量同步文档到 Wiki Publication（幂等）

    递归遍历指定目录节点子树，对状态为 completed 的文档建立 Wiki 条目映射，
    并以 Materialized Path 形式写入 ``entry_path`` 以支撑层级导航。

    **全量同步语义**：不属于本次 ``catalog_node_ids`` 子树的既有条目会被删除。
    同步完成后 SSG 依赖 ISR 窗口自动拉取，非即时可见。
    """
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        pub = await wiki_svc.get_publication(db, pub_id)
        if pub is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wiki publication not found",
            )
        result = await wiki_svc.sync_entries_from_catalog(
            db,
            publication_id=pub_id,
            catalog_node_ids=body.catalog_node_ids,
        )
        await db.commit()

    logger.info(
        "api_wiki_sync_from_catalog",
        pub_id=str(pub_id),
        synced_count=result["synced_count"],
        removed_count=result["removed_count"],
        errors_count=len(result["errors"]),
    )

    return _SyncFromCatalogResp(**result)


@router.get("/wiki/publications/{pub_id}/nav-tree")
async def get_wiki_nav_tree(pub_id: UUID) -> WikiNavTreeResponse:
    """获取 Wiki 导航树结构

    供 SSG 构建时生成侧边栏导航。后端基于 ``entry_path``（Materialized Path）合成
    嵌套树并以 ``{items: [...]}`` 信封返回（详见 ISSUE-017 四阶契约对齐）。
    """
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        nav_tree = await wiki_svc.get_nav_tree(db, pub_id)

    return WikiNavTreeResponse(publication_id=pub_id, nav_tree={"items": nav_tree})


_ASSET_FILENAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


@router.get("/wiki/documents/{document_id}/assets/{filename}")
async def get_wiki_document_asset(document_id: UUID, filename: str):
    """公开访问 Wiki 文档的衍生资产（图片等）。

    专为 Wiki Markdown 渲染设计：URL 中只需 ``document_id`` + ``filename``，
    不暴露 ``corpus_id`` / ``app_name`` / GCS bucket，便于 Markdown 链接保持
    简洁稳定。鉴权策略：与 ``/wiki/entries/{entry_id}/content`` 保持一致——
    Wiki 整体已通过 ``WikiPublication`` 的发布状态控制可见性，单条资产无需
    额外校验。

    安全防御：
      - filename 严格白名单 ``^[A-Za-z0-9._-]+$``，禁止 ``..`` / ``/``；
      - 仅查询单文档 GCS 派生路径下的资产，无路径穿越窗口。
    """
    if not _ASSET_FILENAME_PATTERN.match(filename) or len(filename) > 180:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_ASSET_NAME",
                "message": "Asset filename contains invalid characters or exceeds length limit",
            },
        )

    from negentropy.storage.gcs_client import StorageError
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()

    async with AsyncSessionLocal() as db:
        # 鉴权策略：document 必须至少被一个 WikiPublicationEntry 引用，避免持
        # 任意 KnowledgeDocument.id 即可拖走未发布文档的派生资产。该校验与
        # ``get_wiki_entry_content`` 通过 entry → publication 的间接归属
        # 一致：可被引用的 doc 才在 wiki 暴露面之内。
        scope_stmt = (
            select(KnowledgeDocument)
            .join(WikiPublicationEntry, WikiPublicationEntry.document_id == KnowledgeDocument.id)
            .where(KnowledgeDocument.id == document_id)
            .limit(1)
        )
        doc = (await db.execute(scope_stmt)).scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    gcs_path = DocumentStorageService._build_asset_gcs_path(
        app_name=doc.app_name,
        corpus_id=doc.corpus_id,
        document_id=doc.id,
        filename=filename,
    )

    try:
        gcs_client = storage_service._get_gcs_client()
        gcs_uri = f"gs://{gcs_client._bucket_name}/{gcs_path}"
        content = gcs_client.download(gcs_uri)
    except (StorageError, ValueError) as exc:
        logger.warning(
            "wiki_asset_download_failed",
            doc_id=str(document_id),
            asset_name=filename,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ASSET_NOT_FOUND", "message": "Requested asset not found"},
        ) from exc

    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return StreamingResponse(
        BytesIO(content),
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Length": str(len(content)),
        },
    )


@router.get("/wiki/entries/{entry_id}/content")
async def get_wiki_entry_content(entry_id: UUID) -> WikiEntryContentResponse:
    """获取单条 Wiki 条目的 Markdown 内容

    供 SSG 构建时拉取文档内容进行静态渲染。
    """
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        content_data = await wiki_svc.get_entry_content(db, entry_id)

    if content_data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki entry not found")

    logger.info("api_wiki_entry_content", entry_id=str(entry_id))

    return WikiEntryContentResponse(
        entry_id=entry_id,
        document_id=content_data["document_id"],
        entry_slug="",  # 需要额外查询 entry 表获取
        entry_title=content_data["title"],
        markdown_content=content_data["markdown_content"],
        document_filename=content_data["filename"] or "",
    )


# ---------------------------------------------------------------------------
# 页面评论 (Page Comments)
# ---------------------------------------------------------------------------


@router.get("/wiki/entries/{entry_id}/comments")
async def list_entry_comments(
    entry_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> WikiCommentListResponse:
    """获取 Wiki 条目的页面评论列表（公开）"""
    from negentropy.knowledge.lifecycle.wiki_dao import WikiDao

    async with AsyncSessionLocal() as db:
        items, total = await WikiDao.list_comments(db, entry_id, offset=offset, limit=limit)

    return WikiCommentListResponse(
        items=[WikiCommentResponse(**item) for item in items],
        total=total,
    )


@router.post("/wiki/entries/{entry_id}/comments", status_code=status.HTTP_201_CREATED)
async def create_entry_comment(
    entry_id: UUID,
    body: WikiCommentCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> WikiCommentResponse:
    """创建页面评论（需登录）"""
    from negentropy.knowledge.lifecycle.wiki_dao import WikiDao

    async with AsyncSessionLocal() as db:
        comment = await WikiDao.create_comment(
            db,
            entry_id=entry_id,
            user_id=user.user_id,
            body=body.body,
        )
        await db.commit()

    return WikiCommentResponse(
        id=comment.id,
        entry_id=comment.entry_id,
        user_id=comment.user_id,
        user_name=None,
        user_picture=None,
        body=comment.body,
        status=comment.status,
        parent_comment_id=comment.parent_comment_id,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.patch("/wiki/entries/{entry_id}/comments/{comment_id}")
async def update_entry_comment(
    entry_id: UUID,
    comment_id: UUID,
    body: WikiCommentUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> WikiCommentResponse:
    """编辑页面评论（仅 owner）"""
    from negentropy.knowledge.lifecycle.wiki_dao import WikiDao

    async with AsyncSessionLocal() as db:
        comment = await WikiDao.update_comment(db, comment_id, user.user_id, body.body)
        if comment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found or not owned by you")
        await db.commit()

    return WikiCommentResponse(
        id=comment.id,
        entry_id=comment.entry_id,
        user_id=comment.user_id,
        user_name=None,
        user_picture=None,
        body=comment.body,
        status=comment.status,
        parent_comment_id=comment.parent_comment_id,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.delete("/wiki/entries/{entry_id}/comments/{comment_id}")
async def delete_entry_comment(
    entry_id: UUID,
    comment_id: UUID,
    user: AuthUser = Depends(get_current_user),
):
    """软删除页面评论（owner 或 admin）"""
    is_admin = "admin" in (user.roles or [])

    from negentropy.knowledge.lifecycle.wiki_dao import WikiDao

    async with AsyncSessionLocal() as db:
        deleted = await WikiDao.delete_comment(db, comment_id, user.user_id, is_admin=is_admin)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        await db.commit()

    return {"detail": "Comment deleted"}


# ---------------------------------------------------------------------------
# 文本注解 (Text Annotations)
# ---------------------------------------------------------------------------


@router.get("/wiki/entries/{entry_id}/annotations")
async def list_entry_annotations(
    entry_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
) -> WikiAnnotationListResponse:
    """获取 Wiki 条目的文本注解列表（公开）"""
    from negentropy.knowledge.lifecycle.wiki_dao import WikiDao

    async with AsyncSessionLocal() as db:
        items, total = await WikiDao.list_annotations(db, entry_id, offset=offset, limit=limit)

    return WikiAnnotationListResponse(
        items=[WikiAnnotationResponse(**item) for item in items],
        total=total,
    )


@router.post("/wiki/entries/{entry_id}/annotations", status_code=status.HTTP_201_CREATED)
async def create_entry_annotation(
    entry_id: UUID,
    body: WikiAnnotationCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> WikiAnnotationResponse:
    """创建文本注解（需登录）"""
    from negentropy.knowledge.lifecycle.wiki_dao import WikiDao

    async with AsyncSessionLocal() as db:
        entry_result = await db.execute(select(WikiPublicationEntry).where(WikiPublicationEntry.id == entry_id))
        entry = entry_result.scalar_one_or_none()
        if entry is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

        from negentropy.models.perception import WikiPublication

        pub_result = await db.execute(select(WikiPublication.version).where(WikiPublication.id == entry.publication_id))
        pub_version = pub_result.scalar() or 1

        anchor_dict = body.anchor.model_dump()
        annotation = await WikiDao.create_annotation(
            db,
            entry_id=entry_id,
            user_id=user.user_id,
            body=body.body,
            quoted_text=body.quoted_text,
            anchor=anchor_dict,
            pub_version=pub_version,
        )
        await db.commit()

        # 解析用户 profile（复用 wiki_dao 的 UserState 查询模式）
        from negentropy.config import settings
        from negentropy.models.state import UserState

        user_name = None
        user_picture = None
        usr_result = await db.execute(
            select(UserState).where(
                UserState.user_id == user.user_id,
                UserState.app_name == settings.app_name,
            )
        )
        usr = usr_result.scalar_one_or_none()
        if usr:
            profile = (usr.state or {}).get("profile", {})
            user_name = profile.get("name")
            user_picture = profile.get("picture")

    return WikiAnnotationResponse(
        id=annotation.id,
        entry_id=annotation.entry_id,
        user_id=annotation.user_id,
        user_name=user_name,
        user_picture=user_picture,
        body=annotation.body,
        quoted_text=annotation.quoted_text,
        anchor=annotation.anchor,
        pub_version=annotation.pub_version,
        status=annotation.status,
        created_at=annotation.created_at,
        updated_at=annotation.updated_at,
    )


@router.patch("/wiki/entries/{entry_id}/annotations/{annotation_id}")
async def update_entry_annotation(
    entry_id: UUID,
    annotation_id: UUID,
    body: WikiAnnotationUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> WikiAnnotationResponse:
    """编辑文本注解（仅 owner）"""
    from negentropy.knowledge.lifecycle.wiki_dao import WikiDao

    async with AsyncSessionLocal() as db:
        annotation = await WikiDao.update_annotation(db, annotation_id, user.user_id, body.body)
        if annotation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found or not owned by you"
            )
        await db.commit()

        from negentropy.config import settings
        from negentropy.models.state import UserState

        user_name = None
        user_picture = None
        usr_result = await db.execute(
            select(UserState).where(
                UserState.user_id == user.user_id,
                UserState.app_name == settings.app_name,
            )
        )
        usr = usr_result.scalar_one_or_none()
        if usr:
            profile = (usr.state or {}).get("profile", {})
            user_name = profile.get("name")
            user_picture = profile.get("picture")

    return WikiAnnotationResponse(
        id=annotation.id,
        entry_id=annotation.entry_id,
        user_id=annotation.user_id,
        user_name=user_name,
        user_picture=user_picture,
        body=annotation.body,
        quoted_text=annotation.quoted_text,
        anchor=annotation.anchor,
        pub_version=annotation.pub_version,
        status=annotation.status,
        created_at=annotation.created_at,
        updated_at=annotation.updated_at,
    )


@router.delete("/wiki/entries/{entry_id}/annotations/{annotation_id}")
async def delete_entry_annotation(
    entry_id: UUID,
    annotation_id: UUID,
    user: AuthUser = Depends(get_current_user),
):
    """软删除文本注解（owner 或 admin）"""
    is_admin = "admin" in (user.roles or [])

    from negentropy.knowledge.lifecycle.wiki_dao import WikiDao

    async with AsyncSessionLocal() as db:
        deleted = await WikiDao.delete_annotation(db, annotation_id, user.user_id, is_admin=is_admin)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")
        await db.commit()

    return {"detail": "Annotation deleted"}
