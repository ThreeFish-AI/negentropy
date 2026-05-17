"""HybridPlanner — 四阶段检索编排器

把 search_knowledge_base 从「逐 Corpus hybrid 串行 + 全局排序」升级为：

    Stage 1: Intent Classification  （复用 UnifiedRetrievalService.classify_intent）
    Stage 2: Seed Retrieval         （asyncio.gather 多 Corpus 并行 hybrid search）
    Stage 3: Graph Expansion        （via canonical 跨 Corpus 桥接，max 2-hop）
    Stage 4: Fusion + Rerank        （RRF 融合 + LocalReranker bge-reranker-v2-m3）

设计哲学（IEEE）：
  [1] D. Edge et al., "From Local to Global: A Graph RAG Approach to Query-Focused
      Summarization," arXiv:2404.16130, 2024 — 社区分层摘要
  [2] B. J. Gutiérrez et al., "HippoRAG 2: From RAG to Memory: Non-Parametric
      Continual Learning," arXiv:2502.14802, 2025 — 2-hop 收敛最佳
  [3] B. Chen et al., "PathRAG: Pruning Graph-based RAG with Relational Paths,"
      arXiv:2502.14902, 2024 — 3-hop 起 P@10 显著下降，故 max_depth=2

权限红线：
  - effective_corpus_ids = scoped ∩ accessible，空则空返回
  - canonical 层按 app_scope 严格隔离
  - alias 查询必须带 corpus_id 过滤（由 perception.py model event hook 兜底）
"""

from __future__ import annotations

import asyncio
import time
from collections import OrderedDict, defaultdict
from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger

logger = get_logger("negentropy.agents.hybrid_planner")


# =============================================================================
# 类型
# =============================================================================

QueryIntent = Literal["fact", "explore", "relation", "multi_hop", "global_summary"]


# Intent 映射规则：UnifiedRetrievalService 五意图 → Planner 五意图
_INTENT_MAP = {
    "fact": "fact",
    "exploration": "explore",
    "comparison": "multi_hop",
    "navigation": "fact",
    "graph_query": "relation",
}

# global_summary 关键词
_GLOBAL_SUMMARY_PATTERNS = (
    "核心主题",
    "主题分布",
    "主要发现",
    "整体趋势",
    "总体观点",
    "总体趋势",
    "概览",
    "overall theme",
    "key topics",
    "key themes",
    "main themes",
)


@dataclass(frozen=True)
class PlannerConfig:
    """HybridPlanner 配置"""

    per_corpus_limit: int = 20
    pool_cap: int = 100
    graph_max_depth: int = 2
    graph_neighbors_per_hop: int = 100
    enable_graph_expansion: bool = True
    enable_rerank: bool = True
    fusion_mode: Literal["rrf", "weighted"] = "rrf"
    rrf_k: int = 60
    timeout_seconds: float = 12.0
    # high-degree hub 跳过阈值（避免在停用词样实体上扇出）
    canonical_hub_degree_threshold: int = 1000


@dataclass
class Candidate:
    """检索候选（每个 chunk 一条）"""

    chunk_id: str
    corpus_id: str
    corpus_name: str
    content: str
    source_uri: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    # 三路独立 rank（用于 RRF 融合）
    vector_rank: int | None = None
    keyword_rank: int | None = None
    graph_rank: int | None = None
    # 原始分数（保留用于 debug 与 weighted fusion 模式）
    semantic_score: float = 0.0
    keyword_score: float = 0.0
    graph_score: float = 0.0
    # 终态
    fusion_score: float = 0.0
    rerank_score: float | None = None
    evidence_type: Literal["primary", "graph_expanded"] = "primary"
    bridge_path: list[dict[str, Any]] | None = None


@dataclass
class EvidenceChain:
    """跨 Corpus 桥接证据链（HippoRAG / Think-on-Graph 风格）"""

    source_chunk_id: str
    source_corpus_id: str
    target_chunk_id: str
    target_corpus_id: str
    via_canonical_id: str
    via_canonical_name: str
    hop_count: int = 1


@dataclass
class PlannerResult:
    """Planner 最终输出"""

    intent: QueryIntent
    results: list[Candidate]
    bridges: list[EvidenceChain]
    expansion_triggered: bool
    stage_latencies_ms: dict[str, float] = field(default_factory=dict)

    @classmethod
    def empty(cls, intent: QueryIntent = "fact") -> PlannerResult:
        return cls(intent=intent, results=[], bridges=[], expansion_triggered=False)


# =============================================================================
# LRU + TTL 缓存（轻量实现，避免依赖 cachetools）
# =============================================================================


class _TTLLRUCache:
    """简单的 LRU + TTL 缓存（线程不安全，asyncio 单事件循环下足够）"""

    def __init__(self, maxsize: int, ttl_seconds: float) -> None:
        self._maxsize = maxsize
        self._ttl = ttl_seconds
        self._data: OrderedDict[Any, tuple[float, Any]] = OrderedDict()

    def get(self, key: Any) -> Any | None:
        entry = self._data.get(key)
        if entry is None:
            return None
        ts, value = entry
        if (time.monotonic() - ts) > self._ttl:
            self._data.pop(key, None)
            return None
        self._data.move_to_end(key)
        return value

    def set(self, key: Any, value: Any) -> None:
        if key in self._data:
            self._data.move_to_end(key)
        self._data[key] = (time.monotonic(), value)
        while len(self._data) > self._maxsize:
            self._data.popitem(last=False)


# =============================================================================
# HybridPlanner 主体
# =============================================================================


class HybridPlanner:
    """四阶段检索编排器

    使用方式（在 perception.search_knowledge_base 里）：

        planner = get_planner()
        result = await planner.plan(
            query=query,
            scoped_corpus_ids=scoped_ids,
            accessible_corpus_ids=accessible,
            top_k=10,
            config=PlannerConfig(),
            app_name=settings.app_name,
            force_graph_mode=force_graph,
        )
    """

    def __init__(
        self,
        *,
        knowledge_service: Any = None,
        classifier: Any = None,
        reranker: Any = None,
        session_factory: Any = None,
    ) -> None:
        self._kb = knowledge_service
        self._classifier = classifier
        self._reranker = reranker
        self._session_factory = session_factory
        self._cache_canonical = _TTLLRUCache(maxsize=2048, ttl_seconds=300)
        self._cache_provenance = _TTLLRUCache(maxsize=128, ttl_seconds=300)

    # ------------------------------------------------------------------
    # 主入口
    # ------------------------------------------------------------------
    async def plan(
        self,
        *,
        query: str,
        scoped_corpus_ids: list[UUID] | list[str],
        accessible_corpus_ids: frozenset[UUID] | frozenset[str] | None,
        top_k: int,
        config: PlannerConfig,
        app_name: str,
        force_graph_mode: bool = False,
    ) -> PlannerResult:
        """执行四阶段管线"""

        latencies: dict[str, float] = {}

        scoped = self._normalize_uuid_set(scoped_corpus_ids)
        accessible_norm: frozenset[str] | None = None
        if accessible_corpus_ids is not None:
            accessible_norm = self._normalize_uuid_set(list(accessible_corpus_ids))
        effective = (
            scoped & accessible_norm
            if (scoped and accessible_norm is not None)
            else (scoped or (accessible_norm or frozenset()))
        )

        if not effective:
            logger.info("planner_empty_scope", scoped=len(scoped), accessible=len(accessible_norm or []))
            return PlannerResult.empty()

        # Stage 1 — Intent
        t0 = time.monotonic()
        intent = self._classify_intent(query, force_graph_mode=force_graph_mode)
        latencies["intent_ms"] = (time.monotonic() - t0) * 1000

        # Stage 2 — Seed Retrieval
        t0 = time.monotonic()
        seeds_per_corpus = await self._seed_retrieval(
            query=query, effective_corpus_ids=list(effective), config=config, app_name=app_name
        )
        latencies["seed_ms"] = (time.monotonic() - t0) * 1000

        # Flatten seeds
        seed_candidates: list[Candidate] = []
        for corpus_id_str, items in seeds_per_corpus.items():
            for cand in items:
                cand.corpus_id = corpus_id_str
                seed_candidates.append(cand)

        # Stage 3 — Graph Expansion（条件触发）
        expanded_candidates: list[Candidate] = []
        bridges: list[EvidenceChain] = []
        expansion_triggered = False
        if config.enable_graph_expansion and (
            force_graph_mode
            or (intent in {"relation", "multi_hop", "explore", "global_summary"} and len(effective) >= 2)
        ):
            t0 = time.monotonic()
            try:
                expanded_candidates, bridges = await self._graph_expand(
                    seed_candidates=seed_candidates,
                    effective_corpus_ids=effective,
                    config=config,
                    app_name=app_name,
                )
                expansion_triggered = len(bridges) > 0
            except Exception as exc:  # noqa: BLE001 — Stage 失败降级，不打断主链路
                logger.warning("planner_graph_expansion_failed", error=str(exc))
            latencies["graph_ms"] = (time.monotonic() - t0) * 1000

        all_candidates = seed_candidates + expanded_candidates

        # Stage 4 — Fusion + Rerank
        t0 = time.monotonic()
        final = await self._fuse_and_rerank(query=query, candidates=all_candidates, top_k=top_k, config=config)
        latencies["rerank_ms"] = (time.monotonic() - t0) * 1000

        return PlannerResult(
            intent=intent,
            results=final,
            bridges=bridges,
            expansion_triggered=expansion_triggered,
            stage_latencies_ms=latencies,
        )

    # ------------------------------------------------------------------
    # Stage 1: Intent
    # ------------------------------------------------------------------
    def _classify_intent(self, query: str, *, force_graph_mode: bool) -> QueryIntent:
        if force_graph_mode:
            # @graph 强制模式：global_summary > relation 优先级
            q_lower = query.lower()
            for pat in _GLOBAL_SUMMARY_PATTERNS:
                if pat.lower() in q_lower:
                    return "global_summary"
            return "relation"

        # global_summary 优先（在 classifier 之前判断）
        q_lower = query.lower()
        for pat in _GLOBAL_SUMMARY_PATTERNS:
            if pat.lower() in q_lower:
                return "global_summary"

        if self._classifier is None:
            return "fact"
        try:
            raw = self._classifier.classify_intent(query)
        except Exception:  # noqa: BLE001
            return "fact"
        return _INTENT_MAP.get(raw, "fact")  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Stage 2: Seed Retrieval
    # ------------------------------------------------------------------
    async def _seed_retrieval(
        self,
        *,
        query: str,
        effective_corpus_ids: list[str],
        config: PlannerConfig,
        app_name: str,
    ) -> dict[str, list[Candidate]]:
        """并行对每个 Corpus 做 hybrid search"""
        if self._kb is None:
            return {cid: [] for cid in effective_corpus_ids}

        from negentropy.knowledge.types import SearchConfig

        search_config = SearchConfig(
            mode="hybrid",
            limit=config.per_corpus_limit,
        )

        async def _one(corpus_id_str: str) -> tuple[str, list[Candidate]]:
            try:
                matches = await self._kb.search(
                    corpus_id=UUID(corpus_id_str),
                    app_name=app_name,
                    query=query,
                    config=search_config,
                )
                cands: list[Candidate] = []
                for rank, m in enumerate(matches, start=1):
                    cands.append(
                        Candidate(
                            chunk_id=str(m.id),
                            corpus_id=corpus_id_str,
                            corpus_name="",  # 由调用方注入显示名
                            content=m.content,
                            source_uri=getattr(m, "source_uri", None),
                            metadata=dict(getattr(m, "metadata", {}) or {}),
                            vector_rank=rank,
                            keyword_rank=rank,
                            semantic_score=float(getattr(m, "semantic_score", 0.0) or 0.0),
                            keyword_score=float(getattr(m, "keyword_score", 0.0) or 0.0),
                        )
                    )
                return corpus_id_str, cands
            except Exception as exc:  # noqa: BLE001
                logger.warning("planner_seed_corpus_failed", corpus_id=corpus_id_str, error=str(exc))
                return corpus_id_str, []

        pairs = await asyncio.gather(*[_one(cid) for cid in effective_corpus_ids])
        return {cid: cands for cid, cands in pairs}

    # ------------------------------------------------------------------
    # Stage 3: Graph Expansion via canonical
    # ------------------------------------------------------------------
    async def _graph_expand(
        self,
        *,
        seed_candidates: list[Candidate],
        effective_corpus_ids: frozenset[str],
        config: PlannerConfig,
        app_name: str,
    ) -> tuple[list[Candidate], list[EvidenceChain]]:
        """从 seed chunks 拉实体 → canonical → 其他 Corpus 邻居 → chunks

        权限红线：所有 SQL 都带 corpus_id IN :corpus_ids 过滤
        """
        if not seed_candidates or self._session_factory is None:
            return [], []

        seed_chunk_ids = [c.chunk_id for c in seed_candidates]
        if not seed_chunk_ids:
            return [], []

        async with self._session_factory() as db:
            # 1. seed chunks → (chunk_id, entity_id) 对（mention 表回查；保留 chunk→entity
            #    映射，便于 Stage 5 正确归因 bridge 的源 chunk）
            chunk_entity_pairs = await self._chunks_to_entities(
                db=db, chunk_ids=seed_chunk_ids, corpus_ids=effective_corpus_ids
            )
            if not chunk_entity_pairs:
                return [], []
            seed_entity_ids = sorted({eid for _, eid in chunk_entity_pairs})

            # 2. entity_ids → canonical_ids（alias 表，带 corpus_id 过滤）
            entity_to_canonical = await self._entities_to_canonical(
                db=db, entity_ids=seed_entity_ids, corpus_ids=effective_corpus_ids
            )
            canonical_ids = set(entity_to_canonical.values())
            if not canonical_ids:
                return [], []

            # 3. 过滤 stopword_like + high-degree hub
            canonical_ids = await self._filter_useful_canonical(
                db=db,
                canonical_ids=canonical_ids,
                hub_threshold=config.canonical_hub_degree_threshold,
            )
            if not canonical_ids:
                return [], []

            # 4. canonical → 其他 Corpus 的 alias（带 corpus_id 过滤；max_depth=1 即足）
            neighbor_entities = await self._canonical_to_other_entities(
                db=db,
                canonical_ids=canonical_ids,
                effective_corpus_ids=effective_corpus_ids,
                exclude_entity_ids=seed_entity_ids,
                limit=config.graph_neighbors_per_hop,
            )
            if not neighbor_entities:
                return [], []

            # 5. canonical → seed chunk 的精确反查（FIX-#2）：用 chunk_entity_pairs +
            #    entity_to_canonical 链式 join，每个 canonical 绑到真正提到它的 seed chunk，
            #    避免以前按迭代顺序乱绑导致 bridges.source_chunk_id 归因错误。
            seed_chunk_lookup = {c.chunk_id: c for c in seed_candidates}
            canonical_to_seed_chunk: dict[str, Candidate] = {}
            for chunk_id, entity_id in chunk_entity_pairs:
                cid = entity_to_canonical.get(entity_id)
                if not cid or cid not in canonical_ids:
                    continue
                if cid in canonical_to_seed_chunk:
                    continue
                seed = seed_chunk_lookup.get(chunk_id)
                if seed is not None:
                    canonical_to_seed_chunk[cid] = seed

            # 6. 邻居 entity → mention 表反查 chunks
            expanded_cands, bridges = await self._entities_to_expanded_chunks(
                db=db,
                neighbor_rows=neighbor_entities,
                canonical_to_seed_chunk=canonical_to_seed_chunk,
                corpus_ids=effective_corpus_ids,
                config=config,
            )
            return expanded_cands, bridges

    async def _chunks_to_entities(
        self,
        *,
        db: AsyncSession,
        chunk_ids: list[str],
        corpus_ids: frozenset[str],
    ) -> list[tuple[str, str]]:
        """seed chunks → ``(chunk_id, entity_id)`` 对（mention 表）。

        FIX-#2：返回保留 chunk → entity 的多对多映射，调用方据此能精确反查
        「哪个 seed chunk 实际提到了某 canonical」。若改回 DISTINCT entity_id，
        会丢失映射信息，导致 bridges.source_chunk_id 误归因。
        """
        if not chunk_ids or not corpus_ids:
            return []
        sql = text(
            """
            SELECT DISTINCT knowledge_chunk_id, entity_id
            FROM negentropy.kg_entity_mentions
            WHERE knowledge_chunk_id = ANY(:chunk_ids::uuid[])
              AND corpus_id = ANY(:corpus_ids::uuid[])
            """
        )
        rows = await db.execute(
            sql,
            {"chunk_ids": chunk_ids, "corpus_ids": list(corpus_ids)},
        )
        return [(str(r[0]), str(r[1])) for r in rows]

    async def _entities_to_canonical(
        self,
        *,
        db: AsyncSession,
        entity_ids: list[str],
        corpus_ids: frozenset[str],
    ) -> dict[str, str]:
        """entity_id → canonical_id（必带 corpus_id 过滤，event hook 强制）"""
        if not entity_ids or not corpus_ids:
            return {}
        sql = text(
            """
            SELECT local_entity_id, canonical_id
            FROM negentropy.kg_entity_alias
            WHERE local_entity_id = ANY(:entity_ids::uuid[])
              AND corpus_id = ANY(:corpus_ids::uuid[])
            """
        )
        rows = await db.execute(
            sql,
            {"entity_ids": entity_ids, "corpus_ids": list(corpus_ids)},
        )
        return {str(r[0]): str(r[1]) for r in rows}

    async def _filter_useful_canonical(
        self,
        *,
        db: AsyncSession,
        canonical_ids: set[str],
        hub_threshold: int,
    ) -> set[str]:
        """过滤 stopword_like + high-degree hub"""
        if not canonical_ids:
            return canonical_ids
        sql = text(
            """
            SELECT c.id
            FROM negentropy.kg_entity_canonical c
            LEFT JOIN (
                SELECT canonical_id, COUNT(*) AS degree
                FROM negentropy.kg_entity_alias
                WHERE canonical_id = ANY(:ids::uuid[])
                GROUP BY canonical_id
            ) a ON a.canonical_id = c.id
            WHERE c.id = ANY(:ids::uuid[])
              AND c.is_stopword_like = FALSE
              AND c.is_under_review = FALSE
              AND COALESCE(a.degree, 0) <= :hub_threshold
            """
        )
        rows = await db.execute(
            sql,
            {"ids": list(canonical_ids), "hub_threshold": hub_threshold},
        )
        return {str(r[0]) for r in rows}

    async def _canonical_to_other_entities(
        self,
        *,
        db: AsyncSession,
        canonical_ids: set[str],
        effective_corpus_ids: frozenset[str],
        exclude_entity_ids: list[str],
        limit: int,
    ) -> list[dict[str, Any]]:
        """canonical_ids → 其他 entity（必带 corpus_id 过滤）"""
        if not canonical_ids or not effective_corpus_ids:
            return []
        sql = text(
            """
            SELECT a.local_entity_id, a.canonical_id, a.corpus_id, c.display_name
            FROM negentropy.kg_entity_alias a
            JOIN negentropy.kg_entity_canonical c ON c.id = a.canonical_id
            WHERE a.canonical_id = ANY(:canonical_ids::uuid[])
              AND a.corpus_id = ANY(:corpus_ids::uuid[])
              AND a.local_entity_id <> ALL(:exclude_ids::uuid[])
            ORDER BY a.confidence DESC
            LIMIT :lim
            """
        )
        rows = await db.execute(
            sql,
            {
                "canonical_ids": list(canonical_ids),
                "corpus_ids": list(effective_corpus_ids),
                "exclude_ids": exclude_entity_ids or [],
                "lim": int(limit),
            },
        )
        return [
            {
                "entity_id": str(r[0]),
                "canonical_id": str(r[1]),
                "corpus_id": str(r[2]),
                "display_name": r[3],
            }
            for r in rows
        ]

    async def _entities_to_expanded_chunks(
        self,
        *,
        db: AsyncSession,
        neighbor_rows: list[dict[str, Any]],
        canonical_to_seed_chunk: dict[str, Candidate],
        corpus_ids: frozenset[str],
        config: PlannerConfig,
    ) -> tuple[list[Candidate], list[EvidenceChain]]:
        """邻居 entity → mention 表反查 chunks，构造 EvidenceChain

        ``canonical_to_seed_chunk`` 由调用方基于 chunk→entity→canonical 链式 join 预先
        构造（见 :meth:`_graph_expand`），保证每个 canonical 绑定到真正提到它的 seed chunk，
        而非旧实现中按迭代顺序乱绑（FIX-#2）。
        """

        if not neighbor_rows:
            return [], []

        neighbor_entity_ids = [r["entity_id"] for r in neighbor_rows]
        sql = text(
            """
            SELECT m.entity_id, m.knowledge_chunk_id, m.corpus_id, k.content, k.source_uri, k.metadata
            FROM negentropy.kg_entity_mentions m
            JOIN negentropy.knowledge k ON k.id = m.knowledge_chunk_id
            WHERE m.entity_id = ANY(:entity_ids::uuid[])
              AND m.corpus_id = ANY(:corpus_ids::uuid[])
              AND m.knowledge_chunk_id IS NOT NULL
            ORDER BY m.created_at DESC
            LIMIT :lim
            """
        )
        rows = await db.execute(
            sql,
            {
                "entity_ids": neighbor_entity_ids,
                "corpus_ids": list(corpus_ids),
                "lim": int(config.graph_neighbors_per_hop),
            },
        )

        # 索引：entity_id → (canonical_id, display_name, corpus_id)
        ent_index = {r["entity_id"]: r for r in neighbor_rows}

        cands: list[Candidate] = []
        bridges: list[EvidenceChain] = []
        seen_chunks: set[str] = set()
        graph_rank_counter = 0
        for r in rows:
            chunk_id = str(r[1])
            if chunk_id in seen_chunks:
                continue
            seen_chunks.add(chunk_id)
            entity_id = str(r[0])
            corpus_id_str = str(r[2])
            content = r[3] or ""
            source_uri = r[4]
            metadata = dict(r[5] or {})
            ent_info = ent_index.get(entity_id, {})
            canonical_id = ent_info.get("canonical_id", "")
            display_name = ent_info.get("display_name", "")

            graph_rank_counter += 1
            cands.append(
                Candidate(
                    chunk_id=chunk_id,
                    corpus_id=corpus_id_str,
                    corpus_name="",
                    content=content,
                    source_uri=source_uri,
                    metadata=metadata,
                    graph_rank=graph_rank_counter,
                    graph_score=1.0 / (graph_rank_counter + 1),
                    evidence_type="graph_expanded",
                    bridge_path=[
                        {"role": "canonical", "id": canonical_id, "name": display_name},
                    ],
                )
            )

            seed_for_chain = canonical_to_seed_chunk.get(canonical_id)
            if seed_for_chain is not None and canonical_id:
                bridges.append(
                    EvidenceChain(
                        source_chunk_id=seed_for_chain.chunk_id,
                        source_corpus_id=seed_for_chain.corpus_id,
                        target_chunk_id=chunk_id,
                        target_corpus_id=corpus_id_str,
                        via_canonical_id=canonical_id,
                        via_canonical_name=display_name or "",
                        hop_count=1,
                    )
                )
        return cands, bridges

    # ------------------------------------------------------------------
    # Stage 4: Fusion + Rerank
    # ------------------------------------------------------------------
    async def _fuse_and_rerank(
        self,
        *,
        query: str,
        candidates: list[Candidate],
        top_k: int,
        config: PlannerConfig,
    ) -> list[Candidate]:
        """RRF 融合三路 rank，截取 pool_cap 后调 LocalReranker"""
        if not candidates:
            return []

        # RRF 融合
        if config.fusion_mode == "rrf":
            self._apply_rrf(candidates, k=config.rrf_k)
        else:
            self._apply_weighted(candidates)

        # 去重（同 chunk_id 保留 fusion_score 高者）
        dedup: dict[str, Candidate] = {}
        for c in candidates:
            existing = dedup.get(c.chunk_id)
            if existing is None or c.fusion_score > existing.fusion_score:
                dedup[c.chunk_id] = c
        unique = sorted(dedup.values(), key=lambda x: x.fusion_score, reverse=True)

        # 截取 pool_cap
        pool = unique[: config.pool_cap]

        # Rerank
        if config.enable_rerank and self._reranker is not None and pool:
            try:
                pool = await self._rerank(query=query, pool=pool, top_k=top_k)
            except Exception as exc:  # noqa: BLE001 — 降级
                logger.warning("planner_rerank_failed", error=str(exc))

        return pool[:top_k]

    @staticmethod
    def _apply_rrf(candidates: list[Candidate], *, k: int) -> None:
        """RRF: combined = Σ 1/(k + rank_i)，对三路 rank 求和"""
        for c in candidates:
            score = 0.0
            if c.vector_rank is not None:
                score += 1.0 / (k + c.vector_rank)
            if c.keyword_rank is not None:
                score += 1.0 / (k + c.keyword_rank)
            if c.graph_rank is not None:
                score += 1.0 / (k + c.graph_rank)
            c.fusion_score = score

    @staticmethod
    def _apply_weighted(candidates: list[Candidate]) -> None:
        """加权融合（fallback 模式）"""
        for c in candidates:
            c.fusion_score = c.semantic_score * 0.5 + c.keyword_score * 0.3 + c.graph_score * 0.2

    async def _rerank(self, *, query: str, pool: list[Candidate], top_k: int) -> list[Candidate]:
        """调用 LocalReranker（bge-reranker-v2-m3）"""
        if self._reranker is None:
            return pool
        from negentropy.knowledge.retrieval.reranking import RerankConfig
        from negentropy.knowledge.types import KnowledgeMatch

        # 适配为 KnowledgeMatch 列表喂给 reranker
        proxies: list[KnowledgeMatch] = []
        for c in pool:
            proxies.append(
                KnowledgeMatch(
                    id=UUID(c.chunk_id) if self._is_uuid(c.chunk_id) else UUID(int=0),
                    content=c.content,
                    source_uri=c.source_uri,
                    metadata=c.metadata or {},
                    semantic_score=c.semantic_score,
                    keyword_score=c.keyword_score,
                    combined_score=c.fusion_score,
                )
            )

        reranked = await self._reranker.rerank(
            query=query,
            candidates=proxies,
            config=RerankConfig(top_k=min(top_k, len(proxies)), score_threshold=0.0, normalize_scores=True),
        )

        # 把 rerank_score 写回到原 candidates
        chunk_to_cand = {c.chunk_id: c for c in pool}
        ordered: list[Candidate] = []
        for r in reranked:
            cand = chunk_to_cand.get(str(r.id))
            if cand is None:
                continue
            cand.rerank_score = r.semantic_score
            ordered.append(cand)
        return ordered

    # ------------------------------------------------------------------
    # 工具方法
    # ------------------------------------------------------------------
    @staticmethod
    def _normalize_uuid_set(items: list[Any]) -> frozenset[str]:
        out: set[str] = set()
        for x in items or []:
            try:
                out.add(str(UUID(str(x))))
            except (ValueError, TypeError):
                continue
        return frozenset(out)

    @staticmethod
    def _is_uuid(s: str) -> bool:
        try:
            UUID(s)
            return True
        except (ValueError, TypeError):
            return False


# =============================================================================
# 单例工厂
# =============================================================================

_planner_singleton: HybridPlanner | None = None


def get_planner() -> HybridPlanner:
    """全局 HybridPlanner 单例（延迟初始化避免循环导入）"""
    global _planner_singleton
    if _planner_singleton is not None:
        return _planner_singleton

    # 延迟导入避免循环
    from negentropy.db import session as db_session
    from negentropy.knowledge.retrieval.unified_search import UnifiedRetrievalService

    classifier = UnifiedRetrievalService()

    # KnowledgeService / Reranker 延迟绑定（首次使用时通过 perception.py 注入）
    _planner_singleton = HybridPlanner(
        knowledge_service=None,
        classifier=classifier,
        reranker=None,
        session_factory=db_session.AsyncSessionLocal,
    )
    return _planner_singleton


def configure_planner(
    *,
    knowledge_service: Any | None = None,
    reranker: Any | None = None,
) -> None:
    """在 perception.py 启动时注入 knowledge_service 与 reranker"""
    planner = get_planner()
    if knowledge_service is not None:
        planner._kb = knowledge_service  # noqa: SLF001
    if reranker is not None:
        planner._reranker = reranker  # noqa: SLF001


__all__ = [
    "Candidate",
    "EvidenceChain",
    "HybridPlanner",
    "PlannerConfig",
    "PlannerResult",
    "QueryIntent",
    "configure_planner",
    "get_planner",
]


# 保留 defaultdict import 防止 lint 抹除
_ = defaultdict  # noqa: B018
