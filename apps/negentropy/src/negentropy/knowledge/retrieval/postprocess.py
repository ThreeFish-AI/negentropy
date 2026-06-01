"""搜索后处理——从 KnowledgeService 正交提取的独立模块。

提供搜索结果的层级提升、元数据水合与检索计数记录，
与具体 KnowledgeService 实例解耦，仅依赖 repository 接口。
"""

from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from ..pipeline_tracker import CHUNK_ROLE_CHILD
from ..types import KnowledgeMatch
from .repository import KnowledgeRepository


async def lift_hierarchical_matches(
    repository: KnowledgeRepository,
    *,
    corpus_id: UUID,
    app_name: str,
    matches: Iterable[KnowledgeMatch],
    limit: int,
) -> list[KnowledgeMatch]:
    """将 child chunk 检索结果提升为 parent chunk（层级检索后处理）。

    遍历匹配结果，将属于同一 family 的 child chunk 合并为对应的 parent chunk，
    并附带匹配到的 child 详情。非 hierarchical 或非 child 的结果直接透传。
    """
    match_list = list(matches)
    grouped: dict[tuple[str | None, str], list[KnowledgeMatch]] = {}
    passthrough: list[KnowledgeMatch] = []

    for match in match_list:
        family_id = match.metadata.get("chunk_family_id")
        role = match.metadata.get("chunk_role")
        if role == CHUNK_ROLE_CHILD and isinstance(family_id, str) and family_id:
            grouped.setdefault((match.source_uri, family_id), []).append(match)
        else:
            passthrough.append(match)

    if not grouped:
        return match_list[:limit]

    lifted: list[KnowledgeMatch] = []
    for (source_uri, family_id), child_matches in grouped.items():
        parent_candidates = await repository.get_hierarchical_parent_matches(
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=source_uri,
            family_ids=[family_id],
        )
        if not parent_candidates:
            passthrough.extend(child_matches)
            continue

        parent = parent_candidates[0]
        best_child = max(child_matches, key=lambda item: item.combined_score)
        matched_child_indices = [
            item.metadata.get("child_chunk_index")
            for item in child_matches
            if item.metadata.get("child_chunk_index") is not None
        ]
        matched_child_chunks = [
            {
                "id": str(item.id),
                "child_chunk_index": item.metadata.get("child_chunk_index"),
                "content": item.content,
                "semantic_score": item.semantic_score,
                "keyword_score": item.keyword_score,
                "combined_score": item.combined_score,
            }
            for item in sorted(
                child_matches,
                key=lambda item: item.combined_score,
                reverse=True,
            )
        ]
        lifted.append(
            KnowledgeMatch(
                id=parent.id,
                content=parent.content,
                source_uri=parent.source_uri,
                metadata={
                    **parent.metadata,
                    "matched_child_chunk_indices": matched_child_indices,
                    "matched_child_chunks": matched_child_chunks,
                    "returned_parent_chunk": True,
                },
                semantic_score=best_child.semantic_score,
                keyword_score=best_child.keyword_score,
                combined_score=best_child.combined_score,
            )
        )

    merged = passthrough + lifted
    merged.sort(key=lambda item: item.combined_score, reverse=True)
    deduped: list[KnowledgeMatch] = []
    seen_ids = set()
    for item in merged:
        if item.id in seen_ids:
            continue
        deduped.append(item)
        seen_ids.add(item.id)
        if len(deduped) >= limit:
            break
    return deduped


async def hydrate_match_metadata(
    repository: KnowledgeRepository,
    *,
    corpus_id: UUID,
    app_name: str,
    matches: Iterable[KnowledgeMatch],
) -> list[KnowledgeMatch]:
    """从 repository 水合检索结果的额外元数据（retrieval_count, is_enabled 等）。"""
    match_list = list(matches)
    if not match_list:
        return []

    metadata_by_id = await repository.get_search_match_metadata(
        corpus_id=corpus_id,
        app_name=app_name,
        match_ids=[item.id for item in match_list],
    )
    if not metadata_by_id:
        return match_list

    hydrated: list[KnowledgeMatch] = []
    for item in match_list:
        extra_metadata = metadata_by_id.get(item.id)
        if not extra_metadata:
            hydrated.append(item)
            continue

        hydrated.append(
            KnowledgeMatch(
                id=item.id,
                content=item.content,
                source_uri=item.source_uri,
                metadata={
                    **item.metadata,
                    **extra_metadata,
                },
                retrieval_count=int(extra_metadata.get("retrieval_count", item.retrieval_count)),
                is_enabled=bool(extra_metadata.get("is_enabled", item.is_enabled)),
                semantic_score=item.semantic_score,
                keyword_score=item.keyword_score,
                combined_score=item.combined_score,
            )
        )

    return hydrated


async def record_match_retrievals(
    repository: KnowledgeRepository,
    *,
    corpus_id: UUID,
    app_name: str,
    matches: Iterable[KnowledgeMatch],
) -> list[KnowledgeMatch]:
    """记录检索命中并递增 retrieval_count。"""
    match_list = list(matches)
    child_ids = [item.id for item in match_list if item.metadata.get("chunk_role") == CHUNK_ROLE_CHILD]
    target_ids = child_ids or [item.id for item in match_list]
    increment_retrieval_counts = getattr(repository, "increment_retrieval_counts", None)
    if callable(increment_retrieval_counts):
        await increment_retrieval_counts(
            corpus_id=corpus_id,
            app_name=app_name,
            knowledge_ids=target_ids,
        )
    return [
        KnowledgeMatch(
            id=item.id,
            content=item.content,
            source_uri=item.source_uri,
            metadata=item.metadata,
            retrieval_count=item.retrieval_count + (0 if child_ids and item.id not in child_ids else 1),
            is_enabled=item.is_enabled,
            semantic_score=item.semantic_score,
            keyword_score=item.keyword_score,
            combined_score=item.combined_score,
        )
        for item in match_list
    ]
