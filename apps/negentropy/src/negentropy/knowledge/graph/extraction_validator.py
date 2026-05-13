"""KG 实体抽取后置校验（防过度抽取 + 类型纠偏）

LLM 直接抽取存在两类质量缺陷：
  1. 过度抽取：长 chunk 产出实体数远超合理水位（污染下游消解 / 摘要 / 社区检测）。
  2. 类型误分类：典型如 AI 产品 ``Claude`` 被标为 ``person``。

本模块以三层正交防御提供后置纠偏：
  - ``apply_type_overrides``：known_entities 白名单覆盖 + AI 产品正则兜底，纠正 LLM 类型。
  - ``enforce_density_cap``：按 chunk 字符数动态截断实体数量，保留高 confidence。
  - ``load_known_entities``：白名单加载器（lru_cache，模块级缓存）。

模块对外接口稳定；规则数据维护在同目录 ``known_entities.yml`` 中（Single Source of Truth）。

参考：
  [1] Martinez-Rodriguez et al., "Information extraction meets the Semantic Web,"
      Semantic Web J., vol. 9, no. 6, pp. 815-840, 2018.
"""

from __future__ import annotations

import functools
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import structlog
import yaml

logger = structlog.get_logger(__name__)


# ────────────────────────── 模块常量 ──────────────────────────

KNOWN_ENTITIES_PATH: Path = Path(__file__).with_name("known_entities.yml")

# AI 产品兜底规则：捕获 known_entities.yml 未覆盖的型号变体（如 "Claude 3.7 Sonnet"）。
# 仅当 LLM 给出的类型为 person 时启用——避免误改正确的 product 类型。
#
# 设计：要求触发词后跟随至少一个"型号样式"后缀（数字开头或已知规格关键字），
# 避免把真人复合名（如 "Claude Shannon" / "Claude Monet" / "Gemini Cricket"）
# 误改为产品；裸名（"Claude" / "GPT-4" / "ChatGPT"）由 known_entities 白名单覆盖。
AI_PRODUCT_PATTERN: re.Pattern[str] = re.compile(
    r"^(?:claude|gpt|chatgpt|gemini|llama|mistral|copilot|github\s+copilot|o1)"
    r"(?:[\s.\-]+(?:\d[\w.]*"
    r"|opus|sonnet|haiku|pro|ultra|mini|turbo|preview|max|nano|flash|large|medium|small))+$",
    re.IGNORECASE,
)

# 密度上限：每 N 个字符允许 1 个核心实体；下界 3，避免极短 chunk 被砍光。
DENSITY_CHARS_PER_ENTITY: int = 200
DENSITY_MIN_FLOOR: int = 3


# ────────────────────────── 数据结构 ──────────────────────────


class _ConfidenceCarrier(Protocol):
    """支持 enforce_density_cap 的最小协议：拥有 confidence 字段。"""

    confidence: float


@dataclass
class ChunkExtractionStats:
    """单个 chunk 抽取阶段的可观测数据，由 extractor 内部写入，由 service 聚合。

    设计：可变 dataclass，便于跨函数累加；构造时全零，extractor 调用 ``_parse_entity_response``
    时填充字段；service 层每 chunk 创建一个新实例传入。
    """

    type_override_count: int = 0
    density_truncated: bool = False
    density_dropped_count: int = 0
    entity_density_per_kchar: float = 0.0  # 每千字符实体数（聚合 p95 用）


# ────────────────────────── 白名单加载 ──────────────────────────


@functools.lru_cache(maxsize=1)
def load_known_entities(path: Path | None = None) -> dict[str, tuple[str, str]]:
    """加载 known_entities.yml，返回 ``{normalized_name: (canonical_name, type)}``。

    Args:
        path: 可选覆盖路径（仅测试注入用）；生产固定读取模块同目录的 ``known_entities.yml``。

    Returns:
        归一化名（小写 + strip）到 ``(canonical_name, type)`` 的字典。
        加载失败返回空字典（容错：白名单缺失不影响主流程）。
    """
    target = path or KNOWN_ENTITIES_PATH
    try:
        with target.open("r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError) as exc:
        logger.warning("known_entities_load_failed", path=str(target), error=str(exc))
        return {}

    table: dict[str, tuple[str, str]] = {}

    def _ingest(entries: Iterable[dict], entity_type: str) -> None:
        for entry in entries or ():
            if not isinstance(entry, dict):
                continue
            name = (entry.get("name") or "").strip()
            if not name:
                continue
            table[name.lower()] = (name, entity_type)
            for alias in entry.get("aliases", []) or ():
                if isinstance(alias, str) and alias.strip():
                    table[alias.strip().lower()] = (name, entity_type)

    _ingest(data.get("products", []), "product")
    _ingest(data.get("organizations", []), "organization")
    return table


# ────────────────────────── 类型重判 ──────────────────────────


def apply_type_overrides(name: str, llm_type: str) -> tuple[str, str | None]:
    """对 LLM 标注的类型应用多层重判规则。

    优先级：known_entities 白名单 > AI 产品 regex 兜底（仅修正 person）> 原样。

    Args:
        name: 实体名（取 LLM 输出原文，函数内部归一化匹配）。
        llm_type: LLM 给出的类型字符串。

    Returns:
        ``(corrected_type, override_source)``：
          - ``override_source`` 为 ``"known_entities"`` / ``"regex_rule"`` 表示发生改判；
          - ``None`` 表示未改判。
    """
    if not name:
        return llm_type, None

    normalized = name.strip().lower()
    known = load_known_entities()
    hit = known.get(normalized)
    if hit is not None:
        _, canonical_type = hit
        if canonical_type != llm_type:
            return canonical_type, "known_entities"
        return llm_type, None

    if llm_type == "person" and AI_PRODUCT_PATTERN.match(name.strip()):
        return "product", "regex_rule"

    return llm_type, None


# ────────────────────────── 密度截断 ──────────────────────────


def compute_max_entities(chunk_len: int) -> int:
    """按 chunk 字符数计算实体数量上限：``max(DENSITY_MIN_FLOOR, chunk_len // DENSITY_CHARS_PER_ENTITY)``。"""
    return max(DENSITY_MIN_FLOOR, chunk_len // DENSITY_CHARS_PER_ENTITY)


def enforce_density_cap(
    results: list[_ConfidenceCarrier],
    chunk_len: int,
) -> tuple[list[_ConfidenceCarrier], int]:
    """对实体列表按 chunk 字符数施加密度上限，按 confidence 降序保留高置信度项。

    Args:
        results: 待校验的实体结果列表（要求拥有 ``confidence`` 浮点字段）。
        chunk_len: 当前 chunk 的字符数（用于推导上限）。

    Returns:
        ``(kept, dropped_count)``：被保留的实体列表与被截断的数量。
        截断时按 confidence 降序保留，对相同 confidence 维持原序（稳定排序）。
    """
    if not results:
        return results, 0

    cap = compute_max_entities(chunk_len)
    if len(results) <= cap:
        return results, 0

    # 稳定排序：confidence 降序，原 index 升序作为 tie-breaker。
    indexed = list(enumerate(results))
    indexed.sort(key=lambda pair: (-float(pair[1].confidence), pair[0]))
    kept_indices = sorted(idx for idx, _ in indexed[:cap])
    kept = [results[i] for i in kept_indices]
    dropped = len(results) - len(kept)
    return kept, dropped
