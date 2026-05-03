"""
KG 质量可观测性指标管道

为 Knowledge Graph 构建流程收集定量指标，支持：
  1. 构建质量趋势追踪（跨 build 对比）
  2. 算法健康度监控

参考文献:
  [1] C. Majors et al., "Observability Engineering," O'Reilly, 2022.
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
    chunks_processed: int = 0
    chunks_failed: int = 0
    build_duration_ms: float = 0.0
    algorithm_warnings: int = 0
    community_levels: int = 0
    community_count_by_level: dict[int, int] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
