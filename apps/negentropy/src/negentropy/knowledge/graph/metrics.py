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
    chunks_fallback: int = 0  # 使用 fallback 提取器（regex/cooccurrence）的 chunk 数
    llm_circuit_opened: bool = False  # 断路器是否在构建期间触发
    build_duration_ms: float = 0.0
    algorithm_warnings: int = 0
    community_levels: int = 0
    community_count_by_level: dict[int, int] = field(default_factory=dict)

    # ── 抽取质量观测（来源：extraction_validator 后置校验信号） ──
    over_extraction_chunks: int = 0  # 触发密度截断的 chunk 数
    type_override_count: int = 0  # known_entities / regex 改判次数（按实体计）
    entity_density_p95: float = 0.0  # 单 chunk 实体数 / chunk 字符长度 × 1000 的 P95

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
