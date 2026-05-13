"""
多策略实体消解 (Multi-Strategy Entity Resolution)

基于 Fellegi & Sunter (1969) 的经典三阶段模型实现：
  1. Blocking — 廉价预筛，将 O(n²) 降至 O(n·k)
  2. Comparison — 多维度比较（精确、别名、语义）
  3. Classification — 匹配/不匹配/待验证三路分类

工程参考:
  - cognee: 多层消解管线（精确 → 规范化 → ANN → LLM）
  - mem0: embedding 相似度 + 实体名称规范化合并

参考文献:
  [1] I. P. Fellegi and A. B. Sunter, "A theory for record linkage,"
      *J. Amer. Statist. Assoc.*, vol. 64, no. 328, pp. 1183–1210, 1969.
  [2] S. Mudgal et al., "Deep learning for entity matching: A design space
      exploration," *Proc. SIGMOD*, pp. 19–34, 2018.
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from typing import Any, NamedTuple

from negentropy.logging import get_logger

from ..types import GraphNode

logger = get_logger(__name__.rsplit(".", 1)[0])

# 法人实体后缀（用于规范化去后缀匹配）
_LEGAL_SUFFIXES = re.compile(
    r"\s*\b(inc|llc|ltd|corp|corporation|co|gmbh|ag|sa|nv|bv|pte|srl|srl|plc|limited|company)\b\.?\s*$",
    re.IGNORECASE,
)

# Token 重叠阈值
_JACCARD_THRESHOLD = 0.55
# 编辑距离相似度阈值（difflib.SequenceMatcher.ratio）
_EDIT_DISTANCE_THRESHOLD = 0.80


def _extract_tokens(normalized_label: str) -> set[str]:
    """从规范化标签中提取有意义的 token（过滤停用词和短 token）

    括号内的内容（如缩写）也会被提取为独立 token。
    """
    _STOPWORDS = frozenset({"the", "a", "an", "of", "in", "for", "and", "or", "to", "with", "by", "on", "at"})
    tokens = set()
    # 提取括号内内容作为额外 token（如 "(GANs)" → "gans"）
    for m in re.finditer(r"\(([^)]+)\)", normalized_label):
        inner = m.group(1).strip().lower()
        for t in inner.split():
            if len(t) >= 2 and t not in _STOPWORDS:
                tokens.add(t)
    # 移除括号后提取主体 token
    cleaned = re.sub(r"\([^)]*\)", "", normalized_label).strip()
    for t in cleaned.split():
        if len(t) >= 2 and t not in _STOPWORDS:
            tokens.add(t)
    return tokens


def _should_merge_by_tokens(
    norm_a: str,
    tokens_a: set[str],
    norm_b: str,
    tokens_b: set[str],
) -> bool:
    """判断两个实体是否应基于 token 重叠合并

    合并条件（满足任一）：
    1. 子串包含：较短的规范化标签是较长标签的子串（≥4 字符）
    2. Token 子集：短标签的 token 集合是长标签 token 集合的子集（且非空）
    3. 词干子集：去除尾部 s/es 后的 token 子集匹配（处理 GAN/GANs 类差异）
    4. 高 Jaccard 重叠：token 集合 Jaccard ≥ 阈值
    """
    # 条件 1: 子串包含（至少 4 字符，避免 "AI" 匹配到所有含 "ai" 的字符串）
    short, long = (norm_a, norm_b) if len(norm_a) <= len(norm_b) else (norm_b, norm_a)
    if len(short) >= 4 and short in long:
        return True

    # 条件 2: Token 子集（如 "sonnet 4.5" 的 token 完全包含在 "claude sonnet 4.5" 中）
    if tokens_a and tokens_b:
        smaller, larger = (tokens_a, tokens_b) if len(tokens_a) <= len(tokens_b) else (tokens_b, tokens_a)
        if smaller <= larger:
            return True

    # 条件 3: 词干子集匹配（GAN→gan 匹配 GANs→gan）
    if tokens_a and tokens_b:

        def _stem(s: str) -> str:
            return re.sub(r"s$", "", s) if len(s) > 2 else s

        stems_a = {_stem(t) for t in tokens_a}
        stems_b = {_stem(t) for t in tokens_b}
        smaller_stems, larger_stems = (stems_a, stems_b) if len(stems_a) <= len(stems_b) else (stems_b, stems_a)
        if smaller_stems and smaller_stems <= larger_stems:
            return True

    # 条件 4: Jaccard 系数
    if not tokens_a or not tokens_b:
        return False
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    jaccard = len(intersection) / len(union) if union else 0.0
    if jaccard >= _JACCARD_THRESHOLD:
        return True

    # 条件 5: 编辑距离 — 捕获单字符拼写变体（如 "rajasakeran" vs "rajasekaran"）
    # 仅对相似长度的标签触发，避免将短缩写与全称匹配
    if len(norm_a) >= 4 and len(norm_b) >= 4:
        len_ratio = min(len(norm_a), len(norm_b)) / max(len(norm_a), len(norm_b))
        if len_ratio >= 0.8:
            from difflib import SequenceMatcher

            similarity = SequenceMatcher(None, norm_a, norm_b).ratio()
            if similarity >= _EDIT_DISTANCE_THRESHOLD:
                return True

    return False


def _flatten_chain(chain: dict[str, str]) -> dict[str, str]:
    """展平传递映射链：A→B, B→C, C→D ⇒ A→D, B→D, C→D。

    用于 label 与 id 两条链路的统一收尾，确保下游 _resolve_ref / 关系端点重写
    能够一步跳到最终存留节点，避免中间节点丢失导致解析失败。

    Args:
        chain: 单跳映射字典（可能包含 A→B 与 B→C 同时存在的多跳链）。

    Returns:
        展平后的字典：每个 key 直接指向链路终点；环路被防御性截断。
    """
    flat: dict[str, str] = {}
    for src, dst in chain.items():
        current = dst
        visited = {src, dst}
        # 沿链路前推直至终点（无后继）或检测到环（防御性截断）。
        while current in chain:
            nxt = chain[current]
            if nxt in visited:
                break
            visited.add(nxt)
            current = nxt
        flat[src] = current
    return flat


# Unicode NFC + 小写 + 去除首尾空白的规范化
def normalize_label(label: str) -> str:
    """规范化实体标签：NFC + 小写 + 去空白 + 去法人后缀"""
    normalized = unicodedata.normalize("NFC", label).strip().lower()
    normalized = re.sub(r"\s+", " ", normalized)
    normalized = _LEGAL_SUFFIXES.sub("", normalized).strip()
    # 去除常见分隔符
    normalized = re.sub(r"[,.\-–—]", "", normalized)
    return normalized


def blocking_key(entity: GraphNode) -> str:
    """生成 blocking key: 规范名称前 3 字符 + 实体类型"""
    norm = normalize_label(entity.label or "")
    prefix = norm[:3] if len(norm) >= 3 else norm
    return f"{prefix}|{entity.node_type or 'other'}"


class ResolutionResult(NamedTuple):
    """实体消解结果：包含存留实体列表与合并映射

    Fields:
        entities: 经多策略去重后的存留实体列表。
        merge_map: 旧实体标签 → 存留实体标签的映射（传递链已展平）。
            供 GraphRAG 双写 / 标签级关系重写使用。
        id_merge_map: 旧实体 ID → 存留实体 ID 的映射（传递链已展平）。
            **关系端点重写的权威映射**。覆盖三个 stage：
              - Stage 1 (Exact): new_entity.id → primary new_entity.id
              - Stage 1.5 (Token): new_entity.id → primary new_entity.id
              - Stage 2 (ANN): new_entity.id → 现有 DB 实体 UUID
                （新实体被合并到 DB 既有实体；DB UUID 不会出现在 ``entities`` 列表中
                ——它通过 first-class 同步阶段在 ``kg_entities`` 表中独立存活）。
            参见 plan: kg-build-fix 缺陷 2。
    """

    entities: list[GraphNode]
    merge_map: dict[str, str]  # old_label → surviving_label
    id_merge_map: dict[str, str]  # old_entity_id → surviving_entity_id


class EntityResolver:
    """多策略实体消解管线 (Fellegi & Sunter, 1969)

    Pipeline: Blocking → Comparison → Classification → Merge

    四层比较策略（由廉价到昂贵排列）：
      1. Exact: 规范化标签精确匹配
      2. Alias: 别名字段查找
      3. ANN: 向量相似度 (threshold)
      4. LLM: 边界案例 LLM 验证 (borderline_range)
    """

    def __init__(
        self,
        *,
        ann_threshold: float = 0.85,
        borderline_low: float = 0.75,
        borderline_high: float = 0.85,
    ) -> None:
        self._ann_threshold = ann_threshold
        self._borderline_low = borderline_low
        self._borderline_high = borderline_high

    async def resolve(
        self,
        new_entities: list[GraphNode],
        find_similar: Any,  # Callable for ANN lookup
        corpus_id: Any,
    ) -> ResolutionResult:
        """执行多策略实体消解，返回去重后的实体列表与合并映射

        Args:
            new_entities: 待消解的新实体列表
            find_similar: 异步回调，签名 (embedding, corpus_id, entity_type, threshold, limit) → list
            corpus_id: 语料库 ID

        Returns:
            ResolutionResult(entities, merge_map, id_merge_map)
                - entities: 去重后的存留实体
                - merge_map: 旧 label → 存留 label（传递链已展平）
                - id_merge_map: 旧 entity_id → 存留 entity_id（传递链已展平）
                  对 ANN 命中 DB 既有实体的场景，存留 id 为 DB 实体的 UUID。
        """
        if not new_entities:
            return ResolutionResult(entities=new_entities, merge_map={}, id_merge_map={})

        # Stage 0: Blocking — 按 blocking_key 分组
        blocks: dict[str, list[int]] = defaultdict(list)
        for i, entity in enumerate(new_entities):
            key = blocking_key(entity)
            blocks[key].append(i)

        # 已合并的实体索引
        merged_secondary: set[int] = set()
        # 合并映射：被合并实体的 label → 存留实体的 label
        merge_map: dict[str, str] = {}
        # ID 合并映射：被合并实体的 entity_id → 存留实体的 entity_id
        id_merge_map: dict[str, str] = {}

        # Stage 1: 精确匹配 (block 内规范化标签 + 实体类型匹配)
        label_type_to_primary: dict[str, int] = {}
        for _key, indices in blocks.items():
            for idx in indices:
                entity = new_entities[idx]
                dedup_key = f"{normalize_label(entity.label or '')}|{entity.node_type or 'other'}"
                if dedup_key in label_type_to_primary:
                    primary_idx = label_type_to_primary[dedup_key]
                    if self._pick_primary(new_entities[primary_idx], new_entities[idx]) == 1:
                        merged_secondary.add(primary_idx)
                        merge_map[new_entities[primary_idx].label or ""] = new_entities[idx].label or ""
                        id_merge_map[new_entities[primary_idx].id] = new_entities[idx].id
                        label_type_to_primary[dedup_key] = idx
                    else:
                        merged_secondary.add(idx)
                        merge_map[new_entities[idx].label or ""] = new_entities[primary_idx].label or ""
                        id_merge_map[new_entities[idx].id] = new_entities[primary_idx].id
                else:
                    label_type_to_primary[dedup_key] = idx

        # Stage 1.5: Token 重叠检测 — 捕获缩写/别名/子串变体
        # 跨 block 对比：对 Stage 1 未合并的同类型实体计算 token Jaccard 系数，
        # 解决 "GAN" vs "Generative Adversarial Networks (GANs)" 类问题。
        token_merged, token_merge_map, token_id_merge_map = self._token_overlap_stage(new_entities, merged_secondary)
        merged_secondary.update(token_merged)
        merge_map.update(token_merge_map)
        id_merge_map.update(token_id_merge_map)

        # Stage 2: 向量 ANN 查找（对未合并的实体）
        remaining = [i for i in range(len(new_entities)) if i not in merged_secondary]

        if remaining and find_similar is not None:
            ann_merged, ann_id_merge_map, ann_merge_map = await self._ann_stage(
                new_entities, remaining, find_similar, corpus_id, id_merge_map
            )
            merged_secondary.update(ann_merged)
            id_merge_map.update(ann_id_merge_map)
            merge_map.update(ann_merge_map)

        # 返回未被合并的实体
        result = [new_entities[i] for i in range(len(new_entities)) if i not in merged_secondary]

        # 展平传递链：A→B, B→C ⇒ A→C, B→C。同样作用于 label 与 id 两条链路，
        # 防止多跳合并使下游 _resolve_ref 因中间节点缺失而失败。
        merge_map = _flatten_chain(merge_map)
        id_merge_map = _flatten_chain(id_merge_map)

        if merged_secondary:
            logger.info(
                "entity_resolution_completed",
                total=len(new_entities),
                merged=len(merged_secondary),
                token_overlap_merged=len(token_merged),
                remaining=len(result),
            )

        return ResolutionResult(entities=result, merge_map=merge_map, id_merge_map=id_merge_map)

    def _pick_primary(self, a: GraphNode, b: GraphNode) -> int:
        """选择主实体（置信度更高者），返回 0 选 a，返回 1 选 b"""
        conf_a = (a.metadata or {}).get("confidence", 0.0)
        conf_b = (b.metadata or {}).get("confidence", 0.0)
        return 0 if conf_a >= conf_b else 1

    def _token_overlap_stage(
        self,
        entities: list[GraphNode],
        already_merged: set[int],
    ) -> tuple[set[int], dict[str, str], dict[str, str]]:
        """Stage 1.5: Token 重叠检测 — 跨 block 捕获缩写/别名/子串变体

        对同 entity_type 的未合并实体，计算 token Jaccard 系数与子串包含关系，
        合并高重叠或子串匹配的实体对。典型场景：
          - "GAN" vs "Generative Adversarial Networks (GANs)"
          - "RetroForge" vs "RetroForge - 2D Retro Game Maker"
          - "Sonnet 4.5" vs "Claude Sonnet 4.5"

        Returns:
            (merged_indices, label_merge_map, id_merge_map) 三元组
        """
        merged: set[int] = set()
        merge_map: dict[str, str] = {}
        id_merge_map: dict[str, str] = {}
        # 按类型分组未合并的实体
        type_groups: dict[str, list[int]] = defaultdict(list)
        for i in range(len(entities)):
            if i not in already_merged and i not in merged:
                type_groups[entities[i].node_type or "other"].append(i)

        for _etype, indices in type_groups.items():
            # primary 集合：记录每个 primary 的 token 集合和规范化标签
            primaries: list[tuple[int, set[str], str]] = []
            for idx in indices:
                if idx in merged:
                    continue
                entity = entities[idx]
                norm = normalize_label(entity.label or "")
                tokens = _extract_tokens(norm)
                if not tokens:
                    continue

                matched = False
                for pi, (p_idx, p_tokens, p_norm) in enumerate(primaries):
                    if p_idx in merged:
                        continue
                    if _should_merge_by_tokens(norm, tokens, p_norm, p_tokens):
                        # 保留置信度更高的
                        if self._pick_primary(entities[p_idx], entity) == 1:
                            merged.add(p_idx)
                            merge_map[entities[p_idx].label or ""] = entity.label or ""
                            id_merge_map[entities[p_idx].id] = entity.id
                            primaries[pi] = (idx, tokens, norm)
                        else:
                            merged.add(idx)
                            merge_map[entity.label or ""] = entities[p_idx].label or ""
                            id_merge_map[entity.id] = entities[p_idx].id
                        matched = True
                        break

                if not matched:
                    primaries.append((idx, tokens, norm))

        if merged:
            logger.info(
                "token_overlap_merged",
                merged_count=len(merged),
            )
        return merged, merge_map, id_merge_map

    async def _ann_stage(
        self,
        entities: list[GraphNode],
        remaining_indices: list[int],
        find_similar: Any,
        corpus_id: Any,
        prior_id_merge_map: dict[str, str] | None = None,
    ) -> tuple[set[int], dict[str, str], dict[str, str]]:
        """Stage 2: 向量 ANN 查找 + 合并

        Args:
            entities: 全量实体列表。
            remaining_indices: 经 Stage 1/1.5 后存留的实体索引。
            find_similar: 向量相似度查询回调。
            corpus_id: 语料库 ID。
            prior_id_merge_map: Stage 1/1.5 已建立的 id_merge_map，
                用于将 secondary 标签命中回溯到最终存留 id。

        Returns:
            (merged_indices, id_merge_map, merge_map) 三元组。
            id_merge_map 的 value 可能为 DB 既有实体的 UUID（不存在于本批 entities 中），
            供下游关系端点重写直接跳到 DB 存留 id。
            merge_map 同步维护被合并实体的 label → similar_name（DB 实体名称）映射，
            确保下游 label_to_id fallback 路径能正确解析 ANN 合并的实体。
        """
        merged: list[int] = []
        id_merge_map: dict[str, str] = {}
        merge_map: dict[str, str] = {}
        _prior = prior_id_merge_map or {}

        # 存留实体的规范化标签集合（含类型）→ 存留实体 id。
        # 从 remaining_indices 填充，确保 primary_keys 指向真正的存留实体。
        survivor_keys: dict[str, str] = {}
        for i in remaining_indices:
            e = entities[i]
            key = f"{normalize_label(e.label or '')}|{e.node_type or 'other'}"
            survivor_keys[key] = e.id

        # 被合并 secondary 的标签 → 通过 _prior 回溯到最终存留 id。
        # 用于 ANN 返回的 similar_name 命中 secondary 标签时，仍能正确定位存留实体。
        secondary_survivor_keys: dict[str, str] = {}
        for i in range(len(entities)):
            if i not in remaining_indices:
                e = entities[i]
                key = f"{normalize_label(e.label or '')}|{e.node_type or 'other'}"
                if key not in survivor_keys:
                    # 通过 prior_id_merge_map 回溯到存留者
                    final_id = _prior.get(e.id, e.id)
                    secondary_survivor_keys[key] = final_id

        # 合并：survivor 优先（精确匹配），secondary 作为 fallback（经回溯后的 id）
        combined_keys: dict[str, str] = {**secondary_survivor_keys, **survivor_keys}

        for idx in remaining_indices:
            entity = entities[idx]
            embedding = (entity.metadata or {}).get("embedding")
            if not embedding or not entity.node_type:
                continue

            try:
                similar = await find_similar(
                    embedding=embedding,
                    corpus_id=corpus_id,
                    entity_type=entity.node_type,
                    threshold=self._borderline_low,  # 使用较低的阈值捕获更多候选
                    limit=3,
                )
            except Exception:
                continue

            for similar_id, similar_name, score in similar:
                if similar_name == entity.label:
                    continue
                similar_key = f"{normalize_label(similar_name)}|{entity.node_type or 'other'}"
                if similar_key in combined_keys:
                    # 命中本批其他存留实体（或经回溯的 secondary 标签）。
                    # 排除自合并：combined_keys 中该 key 指向的 id 可能是自身
                    # （如 "OpenAI" vs "OpenAI Inc." 经 normalize_label 后 key 相同）。
                    target_id = combined_keys[similar_key]
                    if target_id == entity.id:
                        # 规范化碰撞但实际是同一实体 → 跳过，交由 DB 路径判定
                        pass
                    else:
                        merged.append(idx)
                        id_merge_map[entity.id] = target_id
                        break
                # 高置信度匹配直接合并到 DB 既有实体：
                # similar_id 是 DB UUID（非本批 entities 中的 id），关系端点重写时
                # 需要跳到该 DB 实体。同时登记 combined_keys 以便同批后续短路命中。
                if score >= self._ann_threshold:
                    merged.append(idx)
                    id_merge_map[entity.id] = str(similar_id)
                    combined_keys[similar_key] = str(similar_id)
                    merge_map[entity.label or ""] = similar_name
                    break
                # 边界区域暂不合并（LLM 验证留给后续迭代）

        return set(merged), id_merge_map, merge_map
