"""
KG 质量可观测性指标管道

为 Knowledge Graph 构建/查询流程收集定量指标，支持：
  1. 构建质量趋势追踪（跨 build 对比）
  2. LLM 成本可见性（token 用量）
  3. 算法健康度监控
  4. 查询性能基线

参考文献:
  [1] C. Majors et al., "Observability Engineering," O'Reilly, 2022.
  [2] S. Farrell et al., "Entity resolution quality measures," J. Data
      Intell., 2022.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class KgBuildMetrics:
    """单次图谱构建的定量指标"""

    entity_count: int = 0
    relation_count: int = 0
    custom_type_count: int = 0  # CUSTOM 关系数量
    avg_confidence: float = 0.0
    isolated_ratio: float = 0.0
    chunks_processed: int = 0
    chunks_failed: int = 0
    llm_tokens_used: int = 0
    build_duration_ms: float = 0.0
    algorithm_warnings: int = 0
    community_levels: int = 0
    community_count_by_level: dict[int, int] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class KgQueryMetrics:
    """单次图谱查询的定量指标"""

    query_type: str = ""  # "search" | "global_search" | "neighbors" | "path"
    latency_ms: float = 0.0
    result_count: int = 0
    cache_hit: bool = False
    level_used: int | None = None
    llm_tokens_used: int = 0

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        if self.level_used is None:
            d["level_used"] = "auto"
        return d


class LlmUsageTracker:
    """LLM token 用量追踪器（线程安全，用于构建流水线中的累积追踪）"""

    def __init__(self) -> None:
        self.prompt_tokens: int = 0
        self.completion_tokens: int = 0
        self.call_count: int = 0

    def add(self, usage: dict[str, int] | None) -> None:
        if usage is None:
            return
        self.prompt_tokens += usage.get("prompt_tokens", 0)
        self.completion_tokens += usage.get("completion_tokens", 0)
        self.call_count += 1

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    def to_dict(self) -> dict[str, int]:
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "call_count": self.call_count,
        }
