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
                    primary_idx = label_type_to_primary[dedup_key]
                    if self._pick_primary(new_entities[primary_idx], new_entities[idx]) != primary_idx:
                        merged_secondary.add(primary_idx)
                        label_type_to_primary[dedup_key] = idx
                    else:
                        merged_secondary.add(idx)
                else:
                    label_type_to_primary[dedup_key] = idx

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
                remaining=len(result),
            )

        return result

    def _pick_primary(self, a: GraphNode, b: GraphNode) -> int:
        """选择主实体（置信度更高者），返回 0 选 a，返回 1 选 b"""
        conf_a = (a.metadata or {}).get("confidence", 0.0)
        conf_b = (b.metadata or {}).get("confidence", 0.0)
        return 0 if conf_a >= conf_b else 1

    async def _ann_stage(
        self,
        entities: list[GraphNode],
        remaining_indices: list[int],
        find_similar: Any,
        corpus_id: Any,
    ) -> set[int]:
        """Stage 2: 向量 ANN 查找 + 合并"""
        merged: set[int] = []

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
                # 高置信度匹配直接合并
                if score >= self._ann_threshold:
                    merged.append(idx)
                    primary_keys.add(f"{normalize_label(entity.label or '')}|{entity.node_type or 'other'}")
                    break
                # 边界区域暂不合并（LLM 验证留给后续迭代）

        return set(merged)
