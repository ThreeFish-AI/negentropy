"""Auto-extracted route module: Catalog management."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import ValidationError  # noqa: F401

from negentropy.db.session import AsyncSessionLocal
from negentropy.knowledge._shared import (
    _build_document_response,
    _get_catalog_service,
    _resolve_user_display_names,
)
from negentropy.logging import get_logger

if TYPE_CHECKING:
    pass

# Lifecycle schema imports
from negentropy.knowledge.lifecycle_schemas import (  # noqa: F401
    AssignDocumentRequest,
    CatalogTreeResponse,
    CategorySuggestionResponse,
    DocumentProvenanceResponse,
    WikiEntryContentResponse,
    WikiNavTreeResponse,
    WikiPublishActionResponse,
)
from negentropy.knowledge.lifecycle_schemas import CatalogCreateRequest as _CatalogCreateReq
from negentropy.knowledge.lifecycle_schemas import CatalogNodeCreateRequest as _CatalogNodeCreateReq
from negentropy.knowledge.lifecycle_schemas import CatalogNodeResponse as _CatalogNodeResp
from negentropy.knowledge.lifecycle_schemas import CatalogNodeUpdateRequest as _CatalogNodeUpdateReq
from negentropy.knowledge.lifecycle_schemas import CatalogResponse as _CatalogResp
from negentropy.knowledge.lifecycle_schemas import CatalogUpdateRequest as _CatalogUpdateReq

logger = get_logger("negentropy.knowledge.api")
router = APIRouter()

# =============================================================================
# Phase 3: 文档目录编目 API
# =============================================================================


def _to_catalog_node_resp(row: dict, *, children_count: int = 0, document_count: int = 0) -> _CatalogNodeResp:
    """将 DAO 树查询行（dict）转换为 API 响应 Schema"""
    return _CatalogNodeResp(
        id=row["id"],
        catalog_id=row["catalog_id"],
        parent_id=row.get("parent_id"),
        name=row["name"],
        slug=row["slug"],
        node_type=row["node_type"],
        description=row.get("description"),
        sort_order=row["sort_order"],
        config=row.get("config") or {},
        document_id=row.get("document_id"),
        source_corpus_id=row.get("source_corpus_id"),
        depth=row.get("depth", 0),
        children_count=children_count,
        document_count=document_count,
    )


def _entry_orm_to_resp(
    entry: Any, *, depth: int = 0, children_count: int = 0, document_count: int = 0
) -> _CatalogNodeResp:
    """将 DocCatalogEntry ORM 对象转换为 API 响应 Schema"""
    from negentropy.knowledge.lifecycle.catalog_dao import _ENUM_TO_NODE_TYPE, _compute_slug

    return _CatalogNodeResp(
        id=entry.id,
        catalog_id=entry.catalog_id,
        parent_id=entry.parent_entry_id,
        name=entry.name,
        slug=_compute_slug(entry.name, entry.slug_override),
        node_type=_ENUM_TO_NODE_TYPE.get(entry.node_type, entry.node_type) if entry.node_type else "folder",
        description=entry.description,
        sort_order=entry.position or 0,
        config=entry.config or {},
        source_corpus_id=entry.source_corpus_id,
        depth=depth,
        children_count=children_count,
        document_count=document_count,
    )


def _build_update_kwargs(body: _CatalogNodeUpdateReq) -> dict[str, Any]:
    """以「请求中显式出现的字段」为 SSOT 构建 PATCH 更新 kwargs。

    关键不变量：显式传入的 ``parent_id=None``（提升为根节点）**必须保留**，
    严禁被 ``if v is not None`` 之类的 falsy 过滤吞掉——否则「移动到顶层」会
    静默丢失父指针更新，刷新后回退为子节点。``model_dump(exclude_unset=True)``
    已保证未传字段不出现于结果，因此无需再做 None 过滤。
    """
    return body.model_dump(exclude_unset=True)


def _catalog_orm_to_resp(catalog: Any) -> _CatalogResp:
    vis = catalog.visibility or "INTERNAL"
    return _CatalogResp(
        id=catalog.id,
        name=catalog.name,
        slug=catalog.slug,
        app_name=catalog.app_name,
        description=catalog.description,
        visibility=vis.lower() if isinstance(vis, str) else "INTERNAL",
        is_archived=catalog.is_archived or False,
        version=catalog.version or 1,
        owner_id=catalog.owner_id,
        config=catalog.config or {},
        created_at=catalog.created_at,
        updated_at=catalog.updated_at,
    )


# =============================================================================
# Phase 3 补全: /catalogs RESTful 路由（对标 BFF 代理约定）
# =============================================================================


def _build_tree_response(tree_data: list[dict]) -> CatalogTreeResponse:
    """复用：将 CTE 扁平列表转为 CatalogTreeResponse（含 children_count）"""
    id_to_children_count: dict[UUID, int] = {}
    for node in tree_data:
        pid = node.get("parent_id")
        if pid is not None:
            id_to_children_count[pid] = id_to_children_count.get(pid, 0) + 1
    items = [_to_catalog_node_resp(node, children_count=id_to_children_count.get(node["id"], 0)) for node in tree_data]
    max_depth = max((n.get("depth", 0) for n in tree_data), default=0) if tree_data else 0
    return CatalogTreeResponse(tree=items, total_nodes=len(items), max_depth=max_depth)


# --- Catalog CRUD ---


@router.get("/catalogs")
async def list_catalogs(
    app_name: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """列出 Catalog（支持 app_name 过滤）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        catalogs, total = await catalog_svc.list_catalogs(
            db,
            app_name=app_name,
            include_archived=include_archived,
            offset=offset,
            limit=limit,
        )
    items = [_catalog_orm_to_resp(c) for c in catalogs]
    logger.info("api_list_catalogs", total=total)
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.post("/catalogs")
async def create_catalog(body: _CatalogCreateReq) -> _CatalogResp:
    """创建 Catalog"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        try:
            catalog = await catalog_svc.create_catalog(
                db,
                app_name=body.app_name,
                name=body.name,
                slug=body.slug,
                owner_id=body.owner_id,
                description=body.description,
                visibility=body.visibility.upper(),
                config=body.config if body.config else None,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        await db.commit()
    logger.info("api_create_catalog", catalog_id=str(catalog.id))
    return _catalog_orm_to_resp(catalog)


@router.get("/catalogs/{catalog_id}")
async def get_catalog(catalog_id: UUID) -> _CatalogResp:
    """获取单个 Catalog 详情"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        catalog = await catalog_svc.get_catalog(db, catalog_id)
    if catalog is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog not found")
    logger.info("api_get_catalog", catalog_id=str(catalog_id))
    return _catalog_orm_to_resp(catalog)


@router.patch("/catalogs/{catalog_id}")
async def update_catalog(
    catalog_id: UUID,
    body: _CatalogUpdateReq,
) -> _CatalogResp:
    """更新 Catalog 属性"""
    catalog_svc = _get_catalog_service()
    update_kwargs = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not update_kwargs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    if "visibility" in update_kwargs:
        update_kwargs["visibility"] = update_kwargs["visibility"].upper()
    async with AsyncSessionLocal() as db:
        try:
            catalog = await catalog_svc.update_catalog(db, catalog_id, **update_kwargs)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        if catalog is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog not found")
        await db.commit()
    logger.info("api_update_catalog", catalog_id=str(catalog_id))
    return _catalog_orm_to_resp(catalog)


@router.delete("/catalogs/{catalog_id}")
async def delete_catalog(catalog_id: UUID):
    """删除 Catalog（级联删除所有条目）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        deleted = await catalog_svc.delete_catalog(db, catalog_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog not found")
        await db.commit()
    logger.info("api_delete_catalog", catalog_id=str(catalog_id))
    return {"detail": "Catalog deleted", "catalog_id": str(catalog_id)}


# --- Catalog Tree ---


@router.get("/catalogs/{catalog_id}/tree")
async def get_catalog_tree_v2(catalog_id: UUID) -> CatalogTreeResponse:
    """获取 Catalog 完整目录树"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        tree_data = await catalog_svc.get_tree(db, catalog_id)
    resp = _build_tree_response(tree_data)
    logger.info("api_get_catalog_tree_v2", catalog_id=str(catalog_id), total_nodes=resp.total_nodes)
    return resp


# --- Catalog Entry CRUD ---


@router.get("/catalogs/{catalog_id}/entries")
async def list_catalog_entries(catalog_id: UUID) -> CatalogTreeResponse:
    """列出 Catalog 下所有条目"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        tree_data = await catalog_svc.get_tree(db, catalog_id)
    resp = _build_tree_response(tree_data)
    logger.info("api_list_catalog_entries", catalog_id=str(catalog_id), total=len(resp.tree))
    return resp


@router.post("/catalogs/{catalog_id}/entries")
async def create_catalog_entry(
    catalog_id: UUID,
    body: _CatalogNodeCreateReq,
) -> _CatalogNodeResp:
    """创建目录条目（catalog_id 从路径获取）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        try:
            node = await catalog_svc.create_node(
                db,
                catalog_id=catalog_id,
                name=body.name,
                slug=body.slug,
                parent_id=body.parent_id,
                node_type=body.node_type,
                description=body.description,
                sort_order=body.sort_order,
                config=body.config if body.config else None,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        await db.commit()
    logger.info("api_create_catalog_entry", node_id=str(node.id), catalog_id=str(catalog_id))
    return _entry_orm_to_resp(node)


@router.get("/catalogs/{catalog_id}/entries/{entry_id}")
async def get_catalog_entry(
    catalog_id: UUID,
    entry_id: UUID,
) -> _CatalogNodeResp:
    """获取单个目录条目详情"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        node = await catalog_svc.get_node(db, entry_id)
    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog entry not found")
    logger.info("api_get_catalog_entry", entry_id=str(entry_id))
    return _entry_orm_to_resp(node)


@router.patch("/catalogs/{catalog_id}/entries/{entry_id}")
async def update_catalog_entry(
    catalog_id: UUID,
    entry_id: UUID,
    body: _CatalogNodeUpdateReq,
) -> _CatalogNodeResp:
    """更新目录条目属性"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        update_kwargs = _build_update_kwargs(body)
        if not update_kwargs:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
        try:
            node = await catalog_svc.update_node(db, entry_id, **update_kwargs)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        if node is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog entry not found")
        await db.commit()
    logger.info("api_update_catalog_entry", entry_id=str(entry_id))
    return _entry_orm_to_resp(node)


@router.delete("/catalogs/{catalog_id}/entries/{entry_id}")
async def delete_catalog_entry(
    catalog_id: UUID,
    entry_id: UUID,
):
    """删除目录条目（级联删除子节点和文档关联）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        deleted = await catalog_svc.delete_node(db, entry_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog entry not found")
        await db.commit()
    logger.info("api_delete_catalog_entry", entry_id=str(entry_id))
    return {"detail": "Catalog entry deleted", "entry_id": str(entry_id)}


# --- Catalog Documents ---


@router.get("/catalogs/{catalog_id}/documents")
async def get_catalog_documents(
    catalog_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=200),
):
    """获取 Catalog 作用域下可分配的候选文档列表

    语义：返回与 catalog 同 app_name 下 status='active' 的全部 KnowledgeDocument，
    供 UI 「添加文档到节点」对话框作为候选集。已归属文档由 UI 侧基于 existingDocIds
    灰出（见 AddDocumentsDialog.tsx / DocumentAssignmentSection.tsx）。

    跨 app 不可见：与 catalog_service.assign_document 的 app_name 同源断言对齐
    （ISSUE-011 Phase 3 不变量）。
    """
    from negentropy.models.perception import DocCatalog
    from negentropy.storage.service import DocumentStorageService

    async with AsyncSessionLocal() as db:
        catalog = await db.get(DocCatalog, catalog_id)
        if catalog is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CATALOG_NOT_FOUND", "message": "Catalog not found"},
            )
        catalog_app = catalog.app_name  # app_name 创建后不可变（perception.py DocCatalog 约束）

    storage_service = DocumentStorageService()
    docs, total = await storage_service.list_documents(
        corpus_id=None,
        app_name=catalog_app,
        limit=limit,
        offset=offset,
    )
    unique_user_ids = list({doc.created_by for doc in docs if doc.created_by})
    name_map = await _resolve_user_display_names(unique_user_ids)
    items = [_build_document_response(doc, name_map) for doc in docs]

    logger.info(
        "api_get_catalog_documents",
        catalog_id=str(catalog_id),
        total=total,
        app_name=catalog_app,
    )
    return {"items": items, "total": total, "offset": offset, "limit": limit}


# --- Entry Documents ---


@router.get("/catalogs/{catalog_id}/entries/{entry_id}/documents")
async def get_entry_documents(
    catalog_id: UUID,
    entry_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """获取目录条目下已归属的文档列表（分页）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        documents, total = await catalog_svc.get_node_documents(db, entry_id, offset=offset, limit=limit)
    unique_user_ids = list({doc.created_by for doc in documents if doc.created_by})
    name_map = await _resolve_user_display_names(unique_user_ids)
    items = [_build_document_response(doc, name_map) for doc in documents]
    logger.info("api_get_entry_documents", entry_id=str(entry_id), total=total)
    return {"documents": items, "total": total, "offset": offset, "limit": limit}


@router.post("/catalogs/{catalog_id}/entries/{entry_id}/documents")
async def assign_documents_to_entry(
    catalog_id: UUID,
    entry_id: UUID,
    body: AssignDocumentRequest,
):
    """将一批文档归入目录条目（幂等操作）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        assigned_count = 0
        errors: list[str] = []
        for doc_id in body.document_ids:
            try:
                await catalog_svc.assign_document(db, entry_id, doc_id)
                assigned_count += 1
            except (ValueError, PermissionError) as exc:
                errors.append(f"{doc_id}: {exc}")
        await db.commit()
    logger.info("api_assign_documents_to_entry", entry_id=str(entry_id), assigned=assigned_count, errors=len(errors))
    result: dict[str, Any] = {"assigned_count": assigned_count, "total_requested": len(body.document_ids)}
    if errors:
        result["errors"] = errors
    return result


@router.delete("/catalogs/{catalog_id}/entries/{entry_id}/documents/{document_id}")
async def unassign_document_from_entry(
    catalog_id: UUID,
    entry_id: UUID,
    document_id: UUID,
):
    """从目录条目移除文档归属"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        removed = await catalog_svc.unassign_document(db, entry_id, document_id)
        await db.commit()
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found in catalog entry {entry_id}",
        )
    logger.info("api_unassign_document_from_entry", entry_id=str(entry_id), document_id=str(document_id))
    return {"detail": "Document unassigned from catalog entry"}
