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
from typing import Any

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
    return jaccard >= _JACCARD_THRESHOLD


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
    ) -> list[GraphNode]:
        """执行多策略实体消解，返回去重后的实体列表

        Args:
            new_entities: 待消解的新实体列表
            find_similar: 异步回调，签名 (embedding, corpus_id, entity_type, threshold, limit) → list
            corpus_id: 语料库 ID

        Returns:
            去重后的实体列表（重复实体已被合并）
        """
        if not new_entities:
            return new_entities

        # Stage 0: Blocking — 按 blocking_key 分组
        blocks: dict[str, list[int]] = defaultdict(list)
        for i, entity in enumerate(new_entities):
            key = blocking_key(entity)
            blocks[key].append(i)

        # 已合并的实体索引
        merged_secondary: set[int] = set()

        # Stage 1: 精确匹配 (block 内规范化标签 + 实体类型匹配)
        label_type_to_primary: dict[str, int] = {}
        for _key, indices in blocks.items():
            for idx in indices:
                entity = new_entities[idx]
                dedup_key = f"{normalize_label(entity.label or '')}|{entity.node_type or 'other'}"
                if dedup_key in label_type_to_primary:
                    # 合并：保留置信度更高的
                    # _pick_primary 返回 0 表示 primary_idx 胜出（保持现有 primary），
                    # 返回 1 表示 idx 胜出（替换 primary）。直接与 primary_idx 比较是错误的：
                    # 仅在 primary_idx == 0 时偶然正确，否则总是触发 swap，导致丢失高置信度实体。
                    primary_idx = label_type_to_primary[dedup_key]
                    if self._pick_primary(new_entities[primary_idx], new_entities[idx]) == 1:
                        merged_secondary.add(primary_idx)
                        label_type_to_primary[dedup_key] = idx
                    else:
                        merged_secondary.add(idx)
                else:
                    label_type_to_primary[dedup_key] = idx

        # Stage 1.5: Token 重叠检测 — 捕获缩写/别名/子串变体
        # 跨 block 对比：对 Stage 1 未合并的同类型实体计算 token Jaccard 系数，
        # 解决 "GAN" vs "Generative Adversarial Networks (GANs)" 类问题。
        token_merged = self._token_overlap_stage(new_entities, merged_secondary)
        merged_secondary.update(token_merged)

        # Stage 2: 向量 ANN 查找（对未合并的实体）
        remaining = [i for i in range(len(new_entities)) if i not in merged_secondary]

        if remaining and find_similar is not None:
            ann_merged = await self._ann_stage(new_entities, remaining, find_similar, corpus_id)
            merged_secondary.update(ann_merged)

        # 返回未被合并的实体
        result = [new_entities[i] for i in range(len(new_entities)) if i not in merged_secondary]

        if merged_secondary:
            logger.info(
                "entity_resolution_completed",
                total=len(new_entities),
                merged=len(merged_secondary),
                token_overlap_merged=len(token_merged),
                remaining=len(result),
            )

        return result

    def _pick_primary(self, a: GraphNode, b: GraphNode) -> int:
        """选择主实体（置信度更高者），返回 0 选 a，返回 1 选 b"""
        conf_a = (a.metadata or {}).get("confidence", 0.0)
        conf_b = (b.metadata or {}).get("confidence", 0.0)
        return 0 if conf_a >= conf_b else 1

    def _token_overlap_stage(
        self,
        entities: list[GraphNode],
        already_merged: set[int],
    ) -> set[int]:
        """Stage 1.5: Token 重叠检测 — 跨 block 捕获缩写/别名/子串变体

        对同 entity_type 的未合并实体，计算 token Jaccard 系数与子串包含关系，
        合并高重叠或子串匹配的实体对。典型场景：
          - "GAN" vs "Generative Adversarial Networks (GANs)"
          - "RetroForge" vs "RetroForge - 2D Retro Game Maker"
          - "Sonnet 4.5" vs "Claude Sonnet 4.5"
        """
        merged: set[int] = set()
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
                            primaries[pi] = (idx, tokens, norm)
                        else:
                            merged.add(idx)
                        matched = True
                        break

                if not matched:
                    primaries.append((idx, tokens, norm))

        if merged:
            logger.info(
                "token_overlap_merged",
                merged_count=len(merged),
            )
        return merged

    async def _ann_stage(
        self,
        entities: list[GraphNode],
        remaining_indices: list[int],
        find_similar: Any,
        corpus_id: Any,
    ) -> set[int]:
        """Stage 2: 向量 ANN 查找 + 合并"""
        merged: list[int] = []

        # 已确认为 primary 的规范化标签集合（含类型）
        primary_keys: set[str] = set()
        for i in range(len(entities)):
            if i not in remaining_indices:
                e = entities[i]
                primary_keys.add(f"{normalize_label(e.label or '')}|{e.node_type or 'other'}")

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

            for _similar_id, similar_name, score in similar:
                if similar_name == entity.label:
                    continue
                similar_key = f"{normalize_label(similar_name)}|{entity.node_type or 'other'}"
                if similar_key in primary_keys:
                    merged.append(idx)
                    break
                # 高置信度匹配直接合并：登记 DB primary 的键以便同批后续短路命中
                if score >= self._ann_threshold:
                    merged.append(idx)
                    primary_keys.add(similar_key)
                    break
                # 边界区域暂不合并（LLM 验证留给后续迭代）

        return set(merged)
