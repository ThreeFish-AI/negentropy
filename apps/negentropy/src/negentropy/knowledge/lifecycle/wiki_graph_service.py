"""Wiki Knowledge Graph 切片查询服务。

将"按 Publication 维度反查文档关联实体子图"的逻辑独立成正交模块，
与 :mod:`wiki_service`（发布生命周期）解耦。

切片算法（核心）::

    wiki_publication_entries (publication_id = X, entry_kind = 'DOCUMENT')
        → document_id 集合 D
            → kg_entity_mentions (document_id ∈ D)
                → DISTINCT entity_id 集合 N
                    → kg_entities (id ∈ N, is_active)            → 节点
                    → kg_relations (src ∈ N AND tgt ∈ N)         → 边（剔悬挂）

设计要点：

- **单一事实源**：所有切片在后端 SQL 中完成，Wiki 端不做二次过滤；
- **节点截断**：当节点数 > ``max_nodes`` 时，按 ``importance_score`` DESC、
  ``mention_count`` DESC 双关键字截断；先按截断后的节点集合再裁剪边，
  保证不出现悬挂边；
- **跨 corpus publication（阶段一）**：按 corpus_id 各自保留，节点
  ``metadata.corpus_id`` 标注；不做 canonical 合并（与 ``routes/graph.py``
  单 corpus 语义一致，最小干预）；
- **空 KG 兜底**：未构建 KG / 0 mention 时返回 ``status='no_kg'`` 或
  ``status='empty'``，让 Wiki 端展示友好空态而非异常。
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger
from negentropy.models.perception import (
    KgEntity,
    KgEntityMention,
    KgRelation,
    WikiPublication,
    WikiPublicationEntry,
)

logger = get_logger(__name__.rsplit(".", 1)[0])


# ---------------------------------------------------------------------------
# 内部数据结构
# ---------------------------------------------------------------------------


class _SliceContext:
    """单次切片查询的上下文，承载 publication 元数据与候选节点集合。

    通过显式上下文对象在多个查询步骤间传递（替代隐式参数串联），
    便于追加调试日志与未来扩展（如 corpus_ids 跨域桥接）。
    """

    __slots__ = (
        "publication",
        "document_ids",
        "node_ids",
        "kept_node_ids",
        "total_entities",
        "truncated",
    )

    def __init__(self, publication: WikiPublication) -> None:
        self.publication = publication
        self.document_ids: list[UUID] = []
        self.node_ids: list[UUID] = []
        self.kept_node_ids: list[UUID] = []
        self.total_entities: int = 0
        self.truncated: bool = False


# ---------------------------------------------------------------------------
# 公共 API
# ---------------------------------------------------------------------------


async def get_publication_graph(
    db: AsyncSession,
    *,
    pub_id: UUID,
    max_nodes: int = 300,
    min_importance: float = 0.0,
    include_isolated: bool = False,
    entry_slugs_per_node: int = 3,
) -> dict[str, Any] | None:
    """获取 Publication 整体切片图谱。

    Args:
        db: 异步数据库会话；
        pub_id: 发布 ID；
        max_nodes: 节点数上限（仅 published 暴露；超出时按 importance 截断）；
        min_importance: 最小 importance_score 过滤（None 视为 0）；
        include_isolated: 是否保留无边孤立节点（默认 False，减少视觉噪点）；
        entry_slugs_per_node: 每节点附带的 entry_slug 数（用于点击跳转）。

    Returns:
        ``None``：publication 不存在；
        否则：``{publication_id, version, status, nodes, edges, truncated,
                total_entities, corpus_ids}``。

    Notes:
        - 调用方负责发布状态可见性校验（仅 published 才暴露给 Wiki）。
        - ``status='no_kg'``：publication 关联 corpus 暂未构建 KG；
        - ``status='empty'``：KG 已存在但本 publication 文档无任何 mention。
    """
    pub = await db.get(WikiPublication, pub_id)
    if pub is None:
        return None

    ctx = _SliceContext(pub)
    await _load_document_ids(db, ctx)

    if not ctx.document_ids:
        return _empty_response(ctx, status_="empty")

    # 节点 ID（DISTINCT，按 importance 排序，可截断）
    await _load_candidate_node_ids(
        db,
        ctx,
        max_nodes=max_nodes,
        min_importance=min_importance,
    )

    if not ctx.kept_node_ids:
        return _empty_response(ctx, status_="empty")

    # 实体详情
    entities = await _load_entities(db, ctx.kept_node_ids)

    # mention_count_in_pub 聚合
    mention_counts = await _load_mention_counts_in_pub(
        db,
        document_ids=ctx.document_ids,
        entity_ids=ctx.kept_node_ids,
    )

    # entry_slugs（每实体 top-N）
    entry_slugs_map = await _load_entry_slugs_for_entities(
        db,
        pub_id=ctx.publication.id,
        entity_ids=ctx.kept_node_ids,
        per_node=entry_slugs_per_node,
    )

    # 边（两端都在节点集合内）
    edges = await _load_edges(db, ctx.kept_node_ids)

    nodes = [
        _build_node(
            ent,
            mention_count_in_pub=mention_counts.get(ent.id, 0),
            entry_slugs=entry_slugs_map.get(ent.id, []),
        )
        for ent in entities
    ]

    if not include_isolated and edges:
        connected_ids = {e["source"] for e in edges} | {e["target"] for e in edges}
        nodes = [n for n in nodes if n["id"] in connected_ids]

    corpus_ids = sorted({ent.corpus_id for ent in entities})

    return {
        "publication_id": ctx.publication.id,
        "version": ctx.publication.version,
        "status": "ok" if nodes else "empty",
        "nodes": nodes,
        "edges": edges,
        "truncated": ctx.truncated,
        "total_entities": ctx.total_entities,
        "corpus_ids": corpus_ids,
    }


async def get_publication_entities(
    db: AsyncSession,
    *,
    pub_id: UUID,
    offset: int = 0,
    limit: int = 50,
    sort_by: str = "importance",
    entry_slugs_per_node: int = 3,
) -> dict[str, Any] | None:
    """获取 Publication 实体扁平列表（分页）。

    供 Wiki 端"实体列表 + 搜索"侧边面板使用（首版可选；最简方案直接
    嵌入图谱响应即可）。
    """
    pub = await db.get(WikiPublication, pub_id)
    if pub is None:
        return None

    ctx = _SliceContext(pub)
    await _load_document_ids(db, ctx)
    if not ctx.document_ids:
        return _entity_list_empty(ctx, offset, limit)

    # 统计总实体数
    total_stmt = select(func.count(func.distinct(KgEntityMention.entity_id))).where(
        KgEntityMention.document_id.in_(ctx.document_ids)
    )
    total = int((await db.execute(total_stmt)).scalar() or 0)
    if total == 0:
        return _entity_list_empty(ctx, offset, limit)

    sort_clauses: list[Any] = _resolve_entity_sort(sort_by)
    mention_subq = (
        select(KgEntityMention.entity_id.label("entity_id"))
        .where(KgEntityMention.document_id.in_(ctx.document_ids))
        .distinct()
        .subquery()
    )
    items_stmt = (
        select(KgEntity)
        .join(mention_subq, mention_subq.c.entity_id == KgEntity.id)
        .where(KgEntity.is_active.is_(True))
        .order_by(*sort_clauses)
        .offset(offset)
        .limit(limit)
    )
    entities = (await db.execute(items_stmt)).scalars().all()
    entity_ids = [e.id for e in entities]

    mention_counts = await _load_mention_counts_in_pub(
        db,
        document_ids=ctx.document_ids,
        entity_ids=entity_ids,
    )
    entry_slugs_map = await _load_entry_slugs_for_entities(
        db,
        pub_id=ctx.publication.id,
        entity_ids=entity_ids,
        per_node=entry_slugs_per_node,
    )

    items = [
        {
            "id": str(ent.id),
            "name": ent.canonical_name or ent.name,
            "entity_type": ent.entity_type,
            "importance": ent.importance_score,
            "community_id": ent.community_id,
            "mention_count_in_pub": mention_counts.get(ent.id, 0),
            "entry_slugs": entry_slugs_map.get(ent.id, []),
            "corpus_id": ent.corpus_id,
        }
        for ent in entities
    ]

    return {
        "publication_id": ctx.publication.id,
        "version": ctx.publication.version,
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": items,
    }


async def get_publication_entity_detail(
    db: AsyncSession,
    *,
    pub_id: UUID,
    entity_id: UUID,
    entry_slugs_per_node: int = 3,
) -> dict[str, Any] | None:
    """获取单个实体详情：基本信息 + 邻居（限定在 publication 内）+ 提及 entries。"""
    pub = await db.get(WikiPublication, pub_id)
    if pub is None:
        return None

    ctx = _SliceContext(pub)
    await _load_document_ids(db, ctx)
    if not ctx.document_ids:
        return None

    # 候选节点集合（不截断，仅用于邻居过滤）
    node_ids_stmt = (
        select(KgEntityMention.entity_id).where(KgEntityMention.document_id.in_(ctx.document_ids)).distinct()
    )
    node_ids: list[UUID] = [row[0] for row in (await db.execute(node_ids_stmt)).all()]
    if entity_id not in node_ids:
        return None

    entity = await db.get(KgEntity, entity_id)
    if entity is None or not entity.is_active:
        return None

    mention_counts = await _load_mention_counts_in_pub(
        db,
        document_ids=ctx.document_ids,
        entity_ids=[entity_id],
    )
    entry_slugs_map = await _load_entry_slugs_for_entities(
        db,
        pub_id=pub_id,
        entity_ids=[entity_id],
        per_node=entry_slugs_per_node,
    )

    # 邻居：两端都在 node_ids 内（与图谱切片一致）
    out_stmt = (
        select(KgRelation, KgEntity)
        .join(KgEntity, KgEntity.id == KgRelation.target_id)
        .where(
            KgRelation.source_id == entity_id,
            KgRelation.target_id.in_(node_ids),
            KgRelation.is_active.is_(True),
            KgEntity.is_active.is_(True),
        )
    )
    in_stmt = (
        select(KgRelation, KgEntity)
        .join(KgEntity, KgEntity.id == KgRelation.source_id)
        .where(
            KgRelation.target_id == entity_id,
            KgRelation.source_id.in_(node_ids),
            KgRelation.is_active.is_(True),
            KgEntity.is_active.is_(True),
        )
    )

    neighbor_entity_ids: list[UUID] = []
    neighbors: list[dict[str, Any]] = []
    for rel, peer in (await db.execute(out_stmt)).all():
        neighbor_entity_ids.append(peer.id)
        neighbors.append(
            {
                "id": str(peer.id),
                "name": peer.canonical_name or peer.name,
                "entity_type": peer.entity_type,
                "relation_type": rel.relation_type,
                "direction": "outgoing",
                "weight": rel.weight,
                "entry_slugs": [],
            }
        )
    for rel, peer in (await db.execute(in_stmt)).all():
        neighbor_entity_ids.append(peer.id)
        neighbors.append(
            {
                "id": str(peer.id),
                "name": peer.canonical_name or peer.name,
                "entity_type": peer.entity_type,
                "relation_type": rel.relation_type,
                "direction": "incoming",
                "weight": rel.weight,
                "entry_slugs": [],
            }
        )

    if neighbor_entity_ids:
        neighbor_slugs = await _load_entry_slugs_for_entities(
            db,
            pub_id=pub_id,
            entity_ids=neighbor_entity_ids,
            per_node=entry_slugs_per_node,
        )
        for n in neighbors:
            n["entry_slugs"] = neighbor_slugs.get(UUID(n["id"]), [])

    # 提及该实体的 entries
    mentioning = await _load_mentioning_entries(
        db,
        pub_id=pub_id,
        entity_id=entity_id,
    )

    return {
        "publication_id": pub_id,
        "version": pub.version,
        "entity": {
            "id": str(entity.id),
            "name": entity.canonical_name or entity.name,
            "entity_type": entity.entity_type,
            "importance": entity.importance_score,
            "community_id": entity.community_id,
            "mention_count_in_pub": mention_counts.get(entity.id, 0),
            "entry_slugs": entry_slugs_map.get(entity.id, []),
            "corpus_id": entity.corpus_id,
        },
        "neighbors": neighbors,
        "mentioning_entries": mentioning,
    }


async def get_entry_graph(
    db: AsyncSession,
    *,
    entry_id: UUID,
    max_nodes: int = 60,
    entry_slugs_per_node: int = 3,
) -> dict[str, Any] | None:
    """获取单个 Wiki entry 的"局部图"：该文档涉及实体 + 1 跳邻居。"""
    entry = await db.get(WikiPublicationEntry, entry_id)
    if entry is None or entry.entry_kind != "DOCUMENT" or entry.document_id is None:
        return None

    pub = await db.get(WikiPublication, entry.publication_id)
    if pub is None:
        return None

    # 中心节点：该文档直接 mention 的实体
    center_stmt = select(KgEntityMention.entity_id).where(KgEntityMention.document_id == entry.document_id).distinct()
    center_ids: list[UUID] = [row[0] for row in (await db.execute(center_stmt)).all()]

    if not center_ids:
        return {
            "entry_id": entry.id,
            "publication_id": pub.id,
            "version": pub.version,
            "status": "empty",
            "nodes": [],
            "edges": [],
            "center_entity_ids": [],
        }

    # 一跳扩展：合并 center_ids 的所有 incoming + outgoing 邻居
    neighbors_stmt = select(KgRelation).where(
        ((KgRelation.source_id.in_(center_ids)) | (KgRelation.target_id.in_(center_ids))),
        KgRelation.is_active.is_(True),
    )
    all_relations = (await db.execute(neighbors_stmt)).scalars().all()
    node_ids: set[UUID] = set(center_ids)
    for rel in all_relations:
        node_ids.add(rel.source_id)
        node_ids.add(rel.target_id)

    # 按 max_nodes 截断（保证 center_ids 一定被保留）
    node_ids_list = list(node_ids)
    if len(node_ids_list) > max_nodes:
        center_set = set(center_ids)
        candidate_ids = [nid for nid in node_ids_list if nid not in center_set]
        # 优先保留 center，再用 importance 排序补全
        priority_stmt = (
            select(KgEntity.id)
            .where(KgEntity.id.in_(candidate_ids))
            .order_by(KgEntity.importance_score.desc().nulls_last(), KgEntity.mention_count.desc())
            .limit(max(max_nodes - len(center_ids), 0))
        )
        fill_ids = [row[0] for row in (await db.execute(priority_stmt)).all()]
        node_ids_list = list(center_set | set(fill_ids))

    entities = await _load_entities(db, node_ids_list)

    # mention_count_in_pub: 仅用本 publication 内所有 documents 反查
    ctx = _SliceContext(pub)
    await _load_document_ids(db, ctx)
    mention_counts = await _load_mention_counts_in_pub(
        db,
        document_ids=ctx.document_ids,
        entity_ids=[e.id for e in entities],
    )
    entry_slugs_map = await _load_entry_slugs_for_entities(
        db,
        pub_id=pub.id,
        entity_ids=[e.id for e in entities],
        per_node=entry_slugs_per_node,
    )

    nodes = [
        _build_node(
            ent,
            mention_count_in_pub=mention_counts.get(ent.id, 0),
            entry_slugs=entry_slugs_map.get(ent.id, []),
        )
        for ent in entities
    ]
    kept_set = {e.id for e in entities}
    edges = [_build_edge(rel) for rel in all_relations if rel.source_id in kept_set and rel.target_id in kept_set]

    return {
        "entry_id": entry.id,
        "publication_id": pub.id,
        "version": pub.version,
        "status": "ok" if nodes else "empty",
        "nodes": nodes,
        "edges": edges,
        "center_entity_ids": [str(cid) for cid in center_ids if cid in kept_set],
    }


# ---------------------------------------------------------------------------
# 内部辅助
# ---------------------------------------------------------------------------


def _resolve_entity_sort(sort_by: str) -> list[Any]:
    """实体列表排序键解析（白名单，避免注入风险）。"""
    if sort_by == "name":
        return [KgEntity.canonical_name.asc().nulls_last(), KgEntity.name.asc()]
    if sort_by == "mention":
        return [KgEntity.mention_count.desc(), KgEntity.importance_score.desc().nulls_last()]
    # 默认：importance
    return [KgEntity.importance_score.desc().nulls_last(), KgEntity.mention_count.desc()]


def _empty_response(ctx: _SliceContext, *, status_: str) -> dict[str, Any]:
    return {
        "publication_id": ctx.publication.id,
        "version": ctx.publication.version,
        "status": status_,
        "nodes": [],
        "edges": [],
        "truncated": False,
        "total_entities": 0,
        "corpus_ids": [],
    }


def _entity_list_empty(ctx: _SliceContext, offset: int, limit: int) -> dict[str, Any]:
    return {
        "publication_id": ctx.publication.id,
        "version": ctx.publication.version,
        "total": 0,
        "offset": offset,
        "limit": limit,
        "items": [],
    }


async def _load_document_ids(db: AsyncSession, ctx: _SliceContext) -> None:
    """加载 Publication 关联的 DOCUMENT 类型 entries 的 document_id 集合。"""
    stmt = select(WikiPublicationEntry.document_id).where(
        WikiPublicationEntry.publication_id == ctx.publication.id,
        WikiPublicationEntry.entry_kind == "DOCUMENT",
        WikiPublicationEntry.document_id.is_not(None),
    )
    ctx.document_ids = [row[0] for row in (await db.execute(stmt)).all() if row[0] is not None]


async def _load_candidate_node_ids(
    db: AsyncSession,
    ctx: _SliceContext,
    *,
    max_nodes: int,
    min_importance: float,
) -> None:
    """加载候选节点 ID（DISTINCT，按 importance 排序，可截断）。

    设置 ctx.node_ids（全集）、ctx.kept_node_ids（截断后）、ctx.total_entities、
    ctx.truncated。
    """
    # 全量计数：DISTINCT entity_id WHERE document_id IN documents
    count_stmt = select(func.count(func.distinct(KgEntityMention.entity_id))).where(
        KgEntityMention.document_id.in_(ctx.document_ids)
    )
    ctx.total_entities = int((await db.execute(count_stmt)).scalar() or 0)
    if ctx.total_entities == 0:
        return

    # 取候选节点 ID（联表 KgEntity 以应用 min_importance / is_active 过滤 + 排序）
    mention_subq = (
        select(KgEntityMention.entity_id.label("entity_id"))
        .where(KgEntityMention.document_id.in_(ctx.document_ids))
        .distinct()
        .subquery()
    )

    base_stmt = (
        select(KgEntity.id)
        .join(mention_subq, mention_subq.c.entity_id == KgEntity.id)
        .where(KgEntity.is_active.is_(True))
        .order_by(
            KgEntity.importance_score.desc().nulls_last(),
            KgEntity.mention_count.desc(),
        )
    )
    if min_importance > 0:
        base_stmt = base_stmt.where(KgEntity.importance_score >= min_importance)

    # 多取 1 个用于检测是否截断
    candidate_stmt = base_stmt.limit(max_nodes + 1)
    rows = (await db.execute(candidate_stmt)).all()
    ctx.node_ids = [row[0] for row in rows]

    if len(ctx.node_ids) > max_nodes:
        ctx.truncated = True
        ctx.kept_node_ids = ctx.node_ids[:max_nodes]
    else:
        ctx.kept_node_ids = ctx.node_ids


async def _load_entities(db: AsyncSession, entity_ids: list[UUID]) -> list[KgEntity]:
    if not entity_ids:
        return []
    stmt = select(KgEntity).where(KgEntity.id.in_(entity_ids), KgEntity.is_active.is_(True))
    return list((await db.execute(stmt)).scalars().all())


async def _load_edges(db: AsyncSession, node_ids: list[UUID]) -> list[dict[str, Any]]:
    """加载两端都在 node_ids 内的边（剔悬挂边）。"""
    if not node_ids:
        return []
    stmt = select(KgRelation).where(
        KgRelation.source_id.in_(node_ids),
        KgRelation.target_id.in_(node_ids),
        KgRelation.is_active.is_(True),
    )
    relations = (await db.execute(stmt)).scalars().all()
    return [_build_edge(rel) for rel in relations]


async def _load_mention_counts_in_pub(
    db: AsyncSession,
    *,
    document_ids: list[UUID],
    entity_ids: list[UUID],
) -> dict[UUID, int]:
    """聚合每个实体在 publication 内文档的提及次数。"""
    if not document_ids or not entity_ids:
        return {}
    stmt = (
        select(KgEntityMention.entity_id, func.count(KgEntityMention.id))
        .where(
            KgEntityMention.entity_id.in_(entity_ids),
            KgEntityMention.document_id.in_(document_ids),
        )
        .group_by(KgEntityMention.entity_id)
    )
    return {row[0]: int(row[1]) for row in (await db.execute(stmt)).all()}


async def _load_entry_slugs_for_entities(
    db: AsyncSession,
    *,
    pub_id: UUID,
    entity_ids: list[UUID],
    per_node: int,
) -> dict[UUID, list[str]]:
    """每实体取前 ``per_node`` 个相关 entry_slug。

    实现策略：先查出所有 (entity_id, entry_slug, mention_count) 三元组，
    再在 Python 端按 entity_id 分桶取前 N。简单稳健，避免依赖窗口函数。

    规模评估：典型实体数 ≤300 × 平均 entry ≤10 → 三元组数 ≤3000，可控。
    """
    if not entity_ids:
        return {}

    stmt = (
        select(
            KgEntityMention.entity_id,
            WikiPublicationEntry.entry_slug,
            func.count(KgEntityMention.id).label("cnt"),
        )
        .join(
            WikiPublicationEntry,
            WikiPublicationEntry.document_id == KgEntityMention.document_id,
        )
        .where(
            WikiPublicationEntry.publication_id == pub_id,
            WikiPublicationEntry.entry_kind == "DOCUMENT",
            KgEntityMention.entity_id.in_(entity_ids),
        )
        .group_by(KgEntityMention.entity_id, WikiPublicationEntry.entry_slug)
        .order_by(KgEntityMention.entity_id, func.count(KgEntityMention.id).desc())
    )
    result: dict[UUID, list[str]] = {}
    for ent_id, entry_slug, _cnt in (await db.execute(stmt)).all():
        bucket = result.setdefault(ent_id, [])
        if len(bucket) < per_node:
            bucket.append(entry_slug)
    return result


async def _load_mentioning_entries(
    db: AsyncSession,
    *,
    pub_id: UUID,
    entity_id: UUID,
) -> list[dict[str, Any]]:
    """加载提及指定实体的 Wiki entries，按 mention 数倒序。"""
    stmt = (
        select(
            WikiPublicationEntry.id,
            WikiPublicationEntry.entry_slug,
            WikiPublicationEntry.entry_title,
            WikiPublicationEntry.document_id,
            func.count(KgEntityMention.id).label("cnt"),
        )
        .join(
            KgEntityMention,
            KgEntityMention.document_id == WikiPublicationEntry.document_id,
        )
        .where(
            WikiPublicationEntry.publication_id == pub_id,
            WikiPublicationEntry.entry_kind == "DOCUMENT",
            KgEntityMention.entity_id == entity_id,
        )
        .group_by(
            WikiPublicationEntry.id,
            WikiPublicationEntry.entry_slug,
            WikiPublicationEntry.entry_title,
            WikiPublicationEntry.document_id,
        )
        .order_by(func.count(KgEntityMention.id).desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "entry_id": str(entry_id),
            "entry_slug": entry_slug,
            "entry_title": entry_title,
            "document_id": str(document_id) if document_id else None,
            "mention_count": int(cnt),
        }
        for entry_id, entry_slug, entry_title, document_id, cnt in rows
    ]


def _build_node(
    ent: KgEntity,
    *,
    mention_count_in_pub: int,
    entry_slugs: list[str],
) -> dict[str, Any]:
    """KgEntity → Wiki Graph 节点 dict。"""
    return {
        "id": str(ent.id),
        "label": ent.canonical_name or ent.name,
        "type": ent.entity_type,
        "importance": ent.importance_score,
        "community_id": ent.community_id,
        "entry_slugs": list(entry_slugs),
        "mention_count_in_pub": mention_count_in_pub,
        "metadata": {
            "corpus_id": str(ent.corpus_id),
            "entity_type": ent.entity_type,
            "confidence": ent.confidence,
            "global_mention_count": ent.mention_count,
        },
    }


def _build_edge(rel: KgRelation) -> dict[str, Any]:
    """KgRelation → Wiki Graph 边 dict。"""
    metadata: dict[str, Any] = {
        "confidence": rel.confidence,
    }
    if rel.evidence_text:
        # 仅截前 200 字防止响应膨胀
        snippet = rel.evidence_text.strip()
        metadata["evidence_snippet"] = snippet[:200] + ("…" if len(snippet) > 200 else "")
    return {
        "source": str(rel.source_id),
        "target": str(rel.target_id),
        "label": rel.relation_type,
        "type": rel.relation_type,
        "weight": rel.weight,
        "metadata": metadata,
    }


__all__ = [
    "get_publication_graph",
    "get_publication_entities",
    "get_publication_entity_detail",
    "get_entry_graph",
]
