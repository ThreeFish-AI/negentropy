"""跨 Corpus 实体规范层链接器（Cross-Corpus Canonical Linker）

把 Corpus-local 的 KgEntity 链接到全局 KgEntityCanonical，建立 KgEntityAlias 多对一
映射，使 Home Studio 多 @Corpus 检索能通过 canonical 中转节点跨 Corpus 多跳推理。

设计哲学（按 Federated KG 路线，不做物理合并）：
  - canonical 是「指针索引」而非数据副本：KgEntity / KgRelation 一行不动
  - 复用 EntityResolver 的 Fellegi-Sunter 三阶段（Blocking + Comparison + Classification）
  - find_similar 回调改为查 kg_entity_canonical 的 HNSW ANN
  - 双阈值：auto_merge ≥ 0.88，0.75 ≤ confidence < 0.88 进入 review 队列
  - 类型冲突：取 type precedence 胜出方为 canonical_type，落败方留多 alias + 打折 confidence
  - mention_corpus_count / total_corpora > 0.5 标记 is_stopword_like，跨 Corpus 扩展时跳过

参考文献：
  [1] I. P. Fellegi and A. B. Sunter, "A theory for record linkage,"
      *J. Amer. Statist. Assoc.*, vol. 64, no. 328, pp. 1183–1210, 1969.
  [2] D. Edge et al., "From Local to Global: A Graph RAG Approach to Query-Focused
      Summarization," arXiv:2404.16130, 2024.
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger
from negentropy.models.perception import (
    Corpus,
    KgEntity,
    KgEntityAlias,
    KgEntityCanonical,
)

from ..types import GraphNode
from .entity_resolver import EntityResolver, normalize_label

logger = get_logger(__name__)


# =============================================================================
# 配置 & 阈值
# =============================================================================

# 类型优先级：越大越优先（PERSON 优先于 ORGANIZATION 优先于 CONCEPT...）
TYPE_PRECEDENCE: dict[str, int] = {
    "person": 10,
    "organization": 9,
    "location": 8,
    "event": 7,
    "product": 6,
    "concept": 5,
    "document": 4,
    "other": 1,
}


@dataclass(frozen=True)
class CanonicalLinkConfig:
    """链接器配置"""

    # 双阈值：≥ auto_merge_threshold 自动合并；落在 [review_threshold, auto_merge_threshold)
    # 进 review 队列；< review_threshold 各自建独立 canonical
    auto_merge_threshold: float = 0.88
    review_threshold: float = 0.75

    # canonical ANN 候选返回上限
    ann_limit: int = 10

    # 类型冲突：任一非主类型占比超过此值 → 标记 is_under_review
    type_conflict_minority_threshold: float = 0.30

    # 类型升级：在不构成冲突（所有非主类型 < type_conflict_minority_threshold）的前提下，
    # 若某个 precedence 更高的类型占比 ≥ 此值，则把它扶正为主类型；阈值必须严格低于
    # type_conflict_minority_threshold，否则两条分支永远不会同时可达（FIX-#4：
    # 之前与冲突阈值同值导致升级分支为死代码）。
    type_upgrade_minority_threshold: float = 0.15

    # 跨 Corpus 扩展时跳过：出现在 ≥ stopword_corpus_ratio 比例的 corpus 中
    stopword_corpus_ratio: float = 0.5


# =============================================================================
# 上下文 & 结果数据类
# =============================================================================


@dataclass
class CanonicalLinkRunContext:
    """单次链接任务的上下文（参考 GraphService 的 BuildRunContext 风格）"""

    run_id: str
    app_name: str  # canonical 在 app 范围内合并
    corpus_id: UUID  # 本次新增/变更的实体所属 corpus
    new_entity_ids: list[UUID] = field(default_factory=list)
    config: CanonicalLinkConfig = field(default_factory=CanonicalLinkConfig)


@dataclass
class CanonicalLinkOutcome:
    """单次链接结果摘要"""

    run_id: str
    processed_count: int = 0
    auto_merged_count: int = 0  # 命中既有 canonical
    new_canonical_count: int = 0  # 新建 canonical
    review_queued_count: int = 0  # 进入审核队列
    conflict_marked_count: int = 0  # 标记 is_under_review（类型冲突）
    stopword_marked_count: int = 0  # 标记 is_stopword_like
    link_method_distribution: dict[str, int] = field(default_factory=dict)


# =============================================================================
# CrossCorpusCanonicalLinker
# =============================================================================


class CrossCorpusCanonicalLinker:
    """把 Corpus-local KgEntity 链接到 KgEntityCanonical

    核心流程：
      1. 拉本批 KgEntity → 转成 GraphNode
      2. EntityResolver.resolve()（find_similar = 查 canonical ANN）
      3. 根据 resolve 结果与 confidence 分类：
         - 命中既有 canonical 且 confidence ≥ auto_merge_threshold → 写 alias
         - confidence ∈ [review, auto_merge) → 写 review 队列（link_method='review'）
         - 否则 → 新建 canonical 行 + 写 alias
      4. 更新 canonical 的聚合字段（mention_count / type_distribution / primary_embedding）
      5. 类型冲突 & stopword 标记
    """

    def __init__(
        self,
        session_factory: Callable[[], AsyncSession] | None = None,
        config: CanonicalLinkConfig | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._config = config or CanonicalLinkConfig()
        self._resolver = EntityResolver(
            ann_threshold=self._config.auto_merge_threshold,
            borderline_low=self._config.review_threshold,
            borderline_high=self._config.auto_merge_threshold,
        )

    # ------------------------------------------------------------------
    # 主入口
    # ------------------------------------------------------------------
    async def link_batch(
        self,
        ctx: CanonicalLinkRunContext,
        db: AsyncSession,
    ) -> CanonicalLinkOutcome:
        """链接一个 Corpus 内一批 KgEntity 到全局 canonical 层"""

        outcome = CanonicalLinkOutcome(run_id=ctx.run_id)

        if not ctx.new_entity_ids:
            return outcome

        local_entities = await self._fetch_local_entities(db, ctx.new_entity_ids)
        if not local_entities:
            return outcome

        outcome.processed_count = len(local_entities)

        # GraphNode 适配
        nodes = [self._to_graph_node(e) for e in local_entities]

        # find_similar 回调：查 canonical ANN
        async def _find_canonical_ann(
            *,
            embedding: list[float] | None,
            corpus_id: Any,  # noqa: ARG001  # resolver 把 corpus_id 当不透明 token 传入
            entity_type: str | None,
            threshold: float,
            limit: int,
        ) -> list[dict[str, Any]]:
            return await self._ann_canonical(
                db=db,
                app_scope=ctx.app_name,
                embedding=embedding,
                entity_type=entity_type,
                threshold=threshold,
                limit=limit,
            )

        # 调用 EntityResolver（但只取 ANN 阶段的命中信息，不取 local 去重结果——
        # 因为 local 实体在 kg_entities 表里都已独立存在，我们只关心它们各自如何挂 canonical）
        # 这里我们逐个实体单独跑 ANN 查询，避免 resolver 把 batch 内的实体相互合并掉。
        for entity, node in zip(local_entities, nodes, strict=True):
            await self._link_single_entity(
                db=db,
                entity=entity,
                node=node,
                ctx=ctx,
                find_similar=_find_canonical_ann,
                outcome=outcome,
            )

        # 后处理：刷新 stopword 标记（基于跨 Corpus 占比）
        await self._refresh_stopword_flags(db=db, app_scope=ctx.app_name, outcome=outcome)

        await db.commit()

        logger.info(
            "canonical_linker_batch_completed",
            run_id=ctx.run_id,
            app_name=ctx.app_name,
            corpus_id=str(ctx.corpus_id),
            **{
                "processed": outcome.processed_count,
                "auto_merged": outcome.auto_merged_count,
                "new_canonical": outcome.new_canonical_count,
                "review_queued": outcome.review_queued_count,
                "conflicts": outcome.conflict_marked_count,
                "stopwords": outcome.stopword_marked_count,
            },
        )
        return outcome

    # ------------------------------------------------------------------
    # 单实体链接
    # ------------------------------------------------------------------
    async def _link_single_entity(
        self,
        *,
        db: AsyncSession,
        entity: KgEntity,
        node: GraphNode,
        ctx: CanonicalLinkRunContext,
        find_similar: Callable[..., Awaitable[list[dict[str, Any]]]],
        outcome: CanonicalLinkOutcome,
    ) -> None:
        """对单个 KgEntity 决定链接方案"""

        # 已存在的 alias？幂等更新
        existing_alias = await db.scalar(
            select(KgEntityAlias).where(
                KgEntityAlias.local_entity_id == entity.id,
                KgEntityAlias.corpus_id == entity.corpus_id,
            )
        )
        if existing_alias is not None:
            return  # 已链接，跳过（增量更新由 mention_count 后处理负责）

        canonical_name_norm = normalize_label(entity.canonical_name or entity.name or "")
        if not canonical_name_norm:
            return

        # 1. 字符串精确匹配：app_scope + canonical_name_normalized + canonical_type
        ent_type = (entity.entity_type or "other").lower()
        existing_canonical = await db.scalar(
            select(KgEntityCanonical).where(
                KgEntityCanonical.app_scope == ctx.app_name,
                KgEntityCanonical.canonical_name_normalized == canonical_name_norm,
                KgEntityCanonical.canonical_type == ent_type,
            )
        )

        if existing_canonical is not None:
            await self._attach_alias(
                db=db,
                local_entity=entity,
                canonical=existing_canonical,
                confidence=1.0,
                link_method="auto_string",
                outcome=outcome,
                ctx=ctx,
            )
            return

        # 2. ANN 向量召回（如果实体有 embedding）
        candidates: list[dict[str, Any]] = []
        if entity.embedding is not None:
            candidates = await find_similar(
                embedding=entity.embedding,
                corpus_id=ctx.corpus_id,
                entity_type=ent_type,
                threshold=self._config.review_threshold,
                limit=self._config.ann_limit,
            )

        if candidates:
            top = candidates[0]
            top_score = float(top.get("score", 0.0))
            canonical_id = top.get("id")
            if canonical_id is not None and top_score >= self._config.auto_merge_threshold:
                canonical = await db.get(KgEntityCanonical, canonical_id)
                if canonical is not None:
                    await self._attach_alias(
                        db=db,
                        local_entity=entity,
                        canonical=canonical,
                        confidence=top_score,
                        link_method="auto_embedding",
                        outcome=outcome,
                        ctx=ctx,
                    )
                    return
            if canonical_id is not None and top_score >= self._config.review_threshold:
                canonical = await db.get(KgEntityCanonical, canonical_id)
                if canonical is not None:
                    await self._attach_alias(
                        db=db,
                        local_entity=entity,
                        canonical=canonical,
                        confidence=top_score,
                        link_method="review",
                        outcome=outcome,
                        ctx=ctx,
                        mark_review=True,
                    )
                    return

        # 3. 都没命中 → 新建 canonical 行
        await self._create_canonical_and_link(
            db=db,
            local_entity=entity,
            node=node,
            ctx=ctx,
            outcome=outcome,
        )

    # ------------------------------------------------------------------
    # canonical 创建 / alias 附加 / 聚合更新
    # ------------------------------------------------------------------
    async def _attach_alias(
        self,
        *,
        db: AsyncSession,
        local_entity: KgEntity,
        canonical: KgEntityCanonical,
        confidence: float,
        link_method: str,
        outcome: CanonicalLinkOutcome,
        ctx: CanonicalLinkRunContext,
        mark_review: bool = False,
    ) -> None:
        alias = KgEntityAlias(
            canonical_id=canonical.id,
            local_entity_id=local_entity.id,
            corpus_id=local_entity.corpus_id,
            app_name=local_entity.app_name,
            confidence=float(confidence),
            link_method=link_method,
        )
        db.add(alias)

        # 更新 canonical 聚合字段
        await self._update_canonical_aggregates(
            db=db,
            canonical=canonical,
            local_entity=local_entity,
            mark_review=mark_review,
        )

        outcome.auto_merged_count += 1
        outcome.link_method_distribution[link_method] = outcome.link_method_distribution.get(link_method, 0) + 1
        if mark_review:
            outcome.review_queued_count += 1

    async def _create_canonical_and_link(
        self,
        *,
        db: AsyncSession,
        local_entity: KgEntity,
        node: GraphNode,  # noqa: ARG002  # 保留 node 以备日后扩展
        ctx: CanonicalLinkRunContext,
        outcome: CanonicalLinkOutcome,
    ) -> None:
        canonical_name_norm = normalize_label(local_entity.canonical_name or local_entity.name or "")
        ent_type = (local_entity.entity_type or "other").lower()

        canonical = KgEntityCanonical(
            app_scope=ctx.app_name,
            canonical_name_normalized=canonical_name_norm,
            display_name=local_entity.name,
            canonical_type=ent_type,
            type_distribution={ent_type: 1},
            primary_embedding=local_entity.embedding,
            aliases=[{"name": local_entity.name, "corpus_id": str(local_entity.corpus_id), "score": 1.0}],
            mention_corpus_count=1,
            mention_total_count=int(local_entity.mention_count or 1),
            importance_score=local_entity.importance_score,
            is_under_review=False,
            is_stopword_like=False,
        )
        db.add(canonical)
        await db.flush()  # 拿到 canonical.id

        alias = KgEntityAlias(
            canonical_id=canonical.id,
            local_entity_id=local_entity.id,
            corpus_id=local_entity.corpus_id,
            app_name=local_entity.app_name,
            confidence=1.0,
            link_method="auto_string",  # 字符串匹配兜底（新建场景）
        )
        db.add(alias)

        outcome.new_canonical_count += 1
        outcome.link_method_distribution["auto_string"] = outcome.link_method_distribution.get("auto_string", 0) + 1

    async def _update_canonical_aggregates(
        self,
        *,
        db: AsyncSession,
        canonical: KgEntityCanonical,
        local_entity: KgEntity,
        mark_review: bool,
    ) -> None:
        """更新 canonical 的 mention 计数、type_distribution、primary_embedding"""

        # 检查是否新引入一个 corpus
        existing_corpus_count = await db.scalar(
            select(text("COUNT(DISTINCT corpus_id)"))
            .select_from(KgEntityAlias.__table__)
            .where(
                KgEntityAlias.canonical_id == canonical.id,
                KgEntityAlias.corpus_id != local_entity.corpus_id,  # 本批 alias 尚未 commit
            )
        )
        canonical.mention_corpus_count = int(existing_corpus_count or 0) + 1
        canonical.mention_total_count = (canonical.mention_total_count or 0) + int(local_entity.mention_count or 1)

        # type_distribution 累加
        dist = dict(canonical.type_distribution or {})
        ent_type = (local_entity.entity_type or "other").lower()
        dist[ent_type] = dist.get(ent_type, 0) + 1
        canonical.type_distribution = dist

        # 检查类型冲突：非主类型占比超过阈值 → mark review
        total = sum(dist.values()) or 1
        primary_type = canonical.canonical_type
        for t, count in dist.items():
            if t == primary_type:
                continue
            if count / total >= self._config.type_conflict_minority_threshold:
                canonical.is_under_review = True
                canonical.review_reason = f"type_conflict: primary={primary_type} dist={dist}"
                break
        else:
            # 重新评估 canonical_type：所有非主类型都未达到冲突阈值时，若某个
            # precedence 更高的类型占比 ≥ type_upgrade_minority_threshold，则升级主类型。
            # 升级阈值必须严格低于冲突阈值，否则该分支永远不可达（FIX-#4）。
            new_primary = max(
                dist.keys(),
                key=lambda t: (TYPE_PRECEDENCE.get(t, 0), dist[t]),
            )
            if (
                new_primary != primary_type
                and TYPE_PRECEDENCE.get(new_primary, 0) > TYPE_PRECEDENCE.get(primary_type, 0)
                and dist[new_primary] / total >= self._config.type_upgrade_minority_threshold
            ):
                canonical.canonical_type = new_primary

        # 别名列表追加（截断保留最近 32 个）
        aliases = list(canonical.aliases or [])
        aliases.append(
            {
                "name": local_entity.name,
                "corpus_id": str(local_entity.corpus_id),
                "score": 1.0 if not mark_review else 0.7,
            }
        )
        if len(aliases) > 32:
            aliases = aliases[-32:]
        canonical.aliases = aliases

        # primary_embedding 加权平均（用 mention_corpus_count 作为权重的近似）
        if local_entity.embedding is not None:
            existing = canonical.primary_embedding
            if existing is None:
                canonical.primary_embedding = local_entity.embedding
            else:
                w = max(1, canonical.mention_corpus_count - 1)
                new_vec = [
                    (existing_v * w + new_v) / (w + 1)
                    for existing_v, new_v in zip(existing, local_entity.embedding, strict=False)
                ]
                # 归一化（cosine 距离对 magnitude 敏感）
                norm = math.sqrt(sum(v * v for v in new_vec)) or 1.0
                canonical.primary_embedding = [v / norm for v in new_vec]

    async def _refresh_stopword_flags(
        self,
        *,
        db: AsyncSession,
        app_scope: str,
        outcome: CanonicalLinkOutcome,
    ) -> None:
        """根据 mention_corpus_count / total_corpora 标记 stopword_like

        total_corpora 直接查 corpus 表：MAX(mention_corpus_count) 始终 ≤ 真实 corpus
        数，作为分母会把阈值压得过低；此处仅一次 O(1) 索引扫描，代价可忽略。
        """
        total = await db.scalar(
            select(text("COUNT(*)")).select_from(Corpus.__table__).where(Corpus.app_name == app_scope)
        )
        total = int(total or 0)
        if total < 4:
            # 语料库数太少时 stopword 概念无意义
            return

        threshold = total * self._config.stopword_corpus_ratio
        result = await db.execute(
            update(KgEntityCanonical)
            .where(
                KgEntityCanonical.app_scope == app_scope,
                KgEntityCanonical.mention_corpus_count >= threshold,
                KgEntityCanonical.is_stopword_like.is_(False),
            )
            .values(is_stopword_like=True)
        )
        outcome.stopword_marked_count += int(result.rowcount or 0)

    # ------------------------------------------------------------------
    # 数据访问 & 辅助
    # ------------------------------------------------------------------
    async def _fetch_local_entities(
        self,
        db: AsyncSession,
        entity_ids: list[UUID],
    ) -> list[KgEntity]:
        if not entity_ids:
            return []
        rows = await db.execute(select(KgEntity).where(KgEntity.id.in_(entity_ids)))
        return list(rows.scalars().all())

    async def _ann_canonical(
        self,
        *,
        db: AsyncSession,
        app_scope: str,
        embedding: list[float] | None,
        entity_type: str | None,
        threshold: float,
        limit: int,
    ) -> list[dict[str, Any]]:
        """canonical 表的 ANN 召回（cosine 距离）"""
        if embedding is None:
            return []
        vec_str = "[" + ",".join(f"{v:.6f}" for v in embedding) + "]"
        type_clause = ""
        params: dict[str, Any] = {
            "app_scope": app_scope,
            "vec": vec_str,
            "limit": int(limit),
            "min_score": float(threshold),
        }
        if entity_type:
            type_clause = "AND canonical_type = :entity_type"
            params["entity_type"] = entity_type
        sql = text(
            f"""
            SELECT id, canonical_name_normalized, canonical_type,
                   1 - (primary_embedding <=> :vec::vector) AS score
            FROM negentropy.kg_entity_canonical
            WHERE app_scope = :app_scope
              AND primary_embedding IS NOT NULL
              {type_clause}
              AND (1 - (primary_embedding <=> :vec::vector)) >= :min_score
            ORDER BY primary_embedding <=> :vec::vector
            LIMIT :limit
            """
        )
        rows = await db.execute(sql, params)
        return [dict(r._mapping) for r in rows]

    @staticmethod
    def _to_graph_node(entity: KgEntity) -> GraphNode:
        """KgEntity → GraphNode 适配"""
        return GraphNode(
            id=str(entity.id),
            label=entity.name,
            node_type=entity.entity_type or "other",
            metadata={
                "confidence": float(entity.confidence or 0.0),
                "mention_count": int(entity.mention_count or 0),
            },
        )


# =============================================================================
# 工具函数（normalize_label 已 re-export，方便外部使用）
# =============================================================================

__all__ = [
    "CanonicalLinkConfig",
    "CanonicalLinkOutcome",
    "CanonicalLinkRunContext",
    "CrossCorpusCanonicalLinker",
    "TYPE_PRECEDENCE",
    "normalize_label",
]

# Re-import normalize_label to avoid unused warning + 提供顶层符号
_ = (unicodedata, re)  # noqa: B018 — 保留 import 以备 normalize_label 扩展
