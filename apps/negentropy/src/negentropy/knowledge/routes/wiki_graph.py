"""Wiki Knowledge Graph 路由：将后端 KG 按 Wiki Publication 切片发布给 SSG 站点。

设计原则：

- **正交分解**：与 :mod:`wiki`（发布生命周期 CRUD）独立的模块；切片查询逻辑
  下沉到 :mod:`negentropy.knowledge.lifecycle.wiki_graph_service`，路由层只
  负责输入校验、可见性 gating 与响应包装。
- **可见性 gating**：仅 ``status='published'`` 的 publication 暴露给 Wiki，
  其余返回 404 / 403，与 ``wiki_service.publish`` 既有语义一致。
- **响应契约**：字段命名与主站 ``apps/negentropy-ui`` 的 GraphCanvas 同名
  （为未来抽共享类型留余地），新增 Wiki 专属字段见 :mod:`schemas`
  (``WikiGraphResponse`` 等)。
- **缓存键**：响应附 ``version`` 字段；HTTP 端通过 ``ETag = "{pub_id}:{version}"``
  支持客户端强缓存（SSG ``fetch`` 通过 Next.js ISR ``revalidate`` 配合，无
  需后端额外缓存层）。
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select

from negentropy.db.session import AsyncSessionLocal
from negentropy.knowledge.lifecycle import wiki_graph_service
from negentropy.knowledge.schemas import (
    WikiEntryGraphResponse,
    WikiGraphEntityDetailResponse,
    WikiGraphEntityItem,
    WikiGraphEntityListResponse,
    WikiGraphNeighborItem,
    WikiGraphResponse,
)
from negentropy.logging import get_logger
from negentropy.models.perception import WikiPublication, WikiPublicationEntry

logger = get_logger("negentropy.knowledge.api")
router = APIRouter()


# ---------------------------------------------------------------------------
# 内部辅助
# ---------------------------------------------------------------------------


async def _ensure_published(pub_id: UUID) -> WikiPublication:
    """加载 publication 并校验可见性（仅 published 暴露给 Wiki）。

    Raises:
        HTTPException 404：发布不存在；
        HTTPException 403：发布存在但状态非 published。
    """
    async with AsyncSessionLocal() as db:
        pub = await db.get(WikiPublication, pub_id)
        if pub is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "WIKI_PUB_NOT_FOUND", "message": "Wiki publication not found"},
            )
        if pub.status != "published":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "WIKI_PUB_NOT_PUBLISHED",
                    "message": "Wiki publication is not published",
                    "details": {"status": pub.status},
                },
            )
        return pub


def _set_cache_headers(response: Response, pub: WikiPublication) -> None:
    """以 ``{pub_id}:{version}`` 作为 ETag，并设置 5 分钟 max-age（与 SSG ISR 一致）。"""
    response.headers["ETag"] = f'"{pub.id}:{pub.version}"'
    response.headers["Cache-Control"] = "public, max-age=300"


# ---------------------------------------------------------------------------
# 路由端点
# ---------------------------------------------------------------------------


@router.get(
    "/wiki/publications/{pub_id}/graph",
    response_model=WikiGraphResponse,
)
async def get_publication_graph(
    pub_id: UUID,
    response: Response,
    max_nodes: int = Query(default=300, ge=1, le=1000),
    min_importance: float = Query(default=0.0, ge=0.0),
    include_isolated: bool = Query(default=False),
) -> WikiGraphResponse:
    """获取 Publication 整体切片图谱（节点 + 边）。

    切片语义：仅包含本 publication 关联 documents 所提及的实体；两端都在
    节点集合内的边才保留（无悬挂边）。节点超出 ``max_nodes`` 时按
    ``importance_score`` DESC 截断，响应 ``truncated=true``。
    """
    pub = await _ensure_published(pub_id)
    async with AsyncSessionLocal() as db:
        payload = await wiki_graph_service.get_publication_graph(
            db,
            pub_id=pub_id,
            max_nodes=max_nodes,
            min_importance=min_importance,
            include_isolated=include_isolated,
        )

    if payload is None:
        # _ensure_published 已确保存在；理论上不可达，防御性兜底
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")

    _set_cache_headers(response, pub)
    logger.info(
        "api_wiki_graph_payload",
        pub_id=str(pub_id),
        node_count=len(payload["nodes"]),
        edge_count=len(payload["edges"]),
        truncated=payload["truncated"],
        status_=payload["status"],
    )
    return WikiGraphResponse.model_validate(payload)


@router.get(
    "/wiki/publications/{pub_id}/graph/entities",
    response_model=WikiGraphEntityListResponse,
)
async def get_publication_graph_entities(
    pub_id: UUID,
    response: Response,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    sort_by: str = Query(
        default="importance",
        pattern="^(importance|mention|name)$",
        description="排序键：importance(默认) | mention | name",
    ),
) -> WikiGraphEntityListResponse:
    """获取 Publication 实体扁平列表（分页，供"实体面板/搜索"使用）。"""
    pub = await _ensure_published(pub_id)
    async with AsyncSessionLocal() as db:
        payload = await wiki_graph_service.get_publication_entities(
            db,
            pub_id=pub_id,
            offset=offset,
            limit=limit,
            sort_by=sort_by,
        )

    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")

    _set_cache_headers(response, pub)
    items = [WikiGraphEntityItem.model_validate(item) for item in payload["items"]]
    return WikiGraphEntityListResponse(
        publication_id=payload["publication_id"],
        version=payload["version"],
        total=payload["total"],
        offset=payload["offset"],
        limit=payload["limit"],
        items=items,
    )


@router.get(
    "/wiki/publications/{pub_id}/graph/entities/{entity_id}",
    response_model=WikiGraphEntityDetailResponse,
)
async def get_publication_graph_entity_detail(
    pub_id: UUID,
    entity_id: UUID,
    response: Response,
) -> WikiGraphEntityDetailResponse:
    """获取实体详情：基本信息 + 邻居（仅 publication 内）+ 提及该实体的 entries。"""
    pub = await _ensure_published(pub_id)
    async with AsyncSessionLocal() as db:
        payload = await wiki_graph_service.get_publication_entity_detail(
            db,
            pub_id=pub_id,
            entity_id=entity_id,
        )

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "WIKI_GRAPH_ENTITY_NOT_FOUND", "message": "Entity not in publication scope"},
        )

    _set_cache_headers(response, pub)
    return WikiGraphEntityDetailResponse(
        publication_id=payload["publication_id"],
        version=payload["version"],
        entity=WikiGraphEntityItem.model_validate(payload["entity"]),
        neighbors=[WikiGraphNeighborItem.model_validate(n) for n in payload["neighbors"]],
        mentioning_entries=payload["mentioning_entries"],
    )


@router.get(
    "/wiki/entries/{entry_id}/graph",
    response_model=WikiEntryGraphResponse,
)
async def get_wiki_entry_graph(
    entry_id: UUID,
    response: Response,
    max_nodes: int = Query(default=60, ge=1, le=300),
) -> WikiEntryGraphResponse:
    """获取单 entry 的"局部图"：该文档涉及实体 + 1 跳邻居。

    可见性 gating 沿用所属 publication 的 ``status='published'`` 约束。
    """
    # 提前查 entry 对应的 publication；用于 _ensure_published + ETag。
    async with AsyncSessionLocal() as db:
        entry_stmt = select(WikiPublicationEntry).where(WikiPublicationEntry.id == entry_id)
        entry = (await db.execute(entry_stmt)).scalar_one_or_none()

    if entry is None or entry.entry_kind != "DOCUMENT" or entry.document_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "WIKI_ENTRY_NOT_FOUND", "message": "Wiki entry not found"},
        )

    pub = await _ensure_published(entry.publication_id)

    async with AsyncSessionLocal() as db:
        payload = await wiki_graph_service.get_entry_graph(
            db,
            entry_id=entry_id,
            max_nodes=max_nodes,
        )

    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki entry graph not found")

    _set_cache_headers(response, pub)
    return WikiEntryGraphResponse.model_validate(payload)
