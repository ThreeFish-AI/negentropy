"""
Faculty Output Schemas - 系部输出模式

定义标准化的系部输出格式，实现反馈闭环和质量评估。
遵循 AGENTS.md 的「边界管理」和「反馈闭环」原则。

参考文献:
[1] Google. "Agent Development Kit - Output Schema," _Google ADK Documentation_, 2025.
    https://google.github.io/adk-docs/agents/llm-agents/#using-output-schema
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from negentropy.agents.state import QualityMetrics


@dataclass
class FacultyOutput:
    """标准系部输出格式

    定义所有系部输出的基础结构，确保一致的接口。

    Attributes:
        status: 输出状态
        content: 输出内容（文本或结构化数据）
        metadata: 元数据
        next_actions: 建议的下一步行动
        quality_indicators: 质量指标
    """

    status: Literal["success", "partial", "failed"]
    content: str | dict[str, Any]
    metadata: dict[str, Any] = field(default_factory=dict)
    next_actions: list[str] = field(default_factory=list)
    quality_indicators: QualityMetrics = field(default_factory=QualityMetrics)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式"""
        return {
            "status": self.status,
            "content": self.content,
            "metadata": self.metadata,
            "next_actions": self.next_actions,
            "quality_indicators": self.quality_indicators.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FacultyOutput":
        """从字典恢复实例"""
        quality_data = data.get("quality_indicators", {})
        return cls(
            status=data.get("status", "partial"),
            content=data.get("content", ""),
            metadata=data.get("metadata", {}),
            next_actions=data.get("next_actions", []),
            quality_indicators=QualityMetrics.from_dict(quality_data),
        )


@dataclass
class Source:
    """信息来源

    用于感知系部输出，标识信息来源。

    Attributes:
        uri: 来源 URI
        title: 来源标题
        type: 来源类型
        credibility: 可信度评分 (0.0-1.0)
    """

    uri: str
    title: str
    type: Literal["web", "knowledge_base", "database", "api", "other"]
    credibility: float = 0.8


@dataclass
class PerceptionOutput(FacultyOutput):
    """感知系部输出

    专门用于信息获取活动的输出。

    Attributes:
        sources: 信息来源列表
        confidence: 整体置信度 (0.0-1.0)
        signal_to_noise_ratio: 信噪比 (越高越好)
    """

    sources: list[Source] = field(default_factory=list)
    confidence: float = 0.0
    signal_to_noise_ratio: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式"""
        base = super().to_dict()
        base.update({
            "sources": [
                {
                    "uri": s.uri,
                    "title": s.title,
                    "type": s.type,
                    "credibility": s.credibility,
                }
                for s in self.sources
            ],
            "confidence": self.confidence,
            "signal_to_noise_ratio": self.signal_to_noise_ratio,
        })
        return base


@dataclass
class InternalizationOutput(FacultyOutput):
    """内化系部输出

    专门用于知识结构化活动的输出。

    Attributes:
        entities_created: 创建的实体数量
        connections_established: 建立的连接数量
        storage_uris: 存储 URI 列表
        knowledge_graph_updated: 知识图谱是否更新
    """

    entities_created: int = 0
    connections_established: int = 0
    storage_uris: list[str] = field(default_factory=list)
    knowledge_graph_updated: bool = False

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式"""
        base = super().to_dict()
        base.update({
            "entities_created": self.entities_created,
            "connections_established": self.connections_established,
            "storage_uris": self.storage_uris,
            "knowledge_graph_updated": self.knowledge_graph_updated,
        })
        return base


@dataclass
class ContemplationOutput(FacultyOutput):
    """沉思系部输出

    专门用于深度思考和规划活动的输出。

    Attributes:
        insights: 洞察列表
        recommendations: 建议列表
        risk_assessment: 风险评估
        alternative_approaches: 替代方案
    """

    insights: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    risk_assessment: dict[str, Any] = field(default_factory=dict)
    alternative_approaches: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式"""
        base = super().to_dict()
        base.update({
            "insights": self.insights,
            "recommendations": self.recommendations,
            "risk_assessment": self.risk_assessment,
            "alternative_approaches": self.alternative_approaches,
        })
        return base


@dataclass
class ActionOutput(FacultyOutput):
    """行动系部输出

    专门用于执行活动的输出。

    Attributes:
        changes_made: 已完成的变更列表
        verification_results: 验证结果
        rollback_info: 回滚信息（如果可用）
        execution_time_ms: 执行时间（毫秒）
    """

    changes_made: list[str] = field(default_factory=list)
    verification_results: dict[str, Any] = field(default_factory=dict)
    rollback_info: dict[str, Any] | None = None
    execution_time_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式"""
        base = super().to_dict()
        base.update({
            "changes_made": self.changes_made,
            "verification_results": self.verification_results,
            "rollback_info": self.rollback_info,
            "execution_time_ms": self.execution_time_ms,
        })
        return base


@dataclass
class InfluenceOutput(FacultyOutput):
    """影响系部输出

    专门用于价值传递活动的输出。

    Attributes:
        audience_reached: 触达的受众数量
        engagement_metrics: 参与度指标
        feedback_received: 收到的反馈
        delivery_channels: 交付渠道列表
    """

    audience_reached: int = 0
    engagement_metrics: dict[str, Any] = field(default_factory=dict)
    feedback_received: list[str] = field(default_factory=list)
    delivery_channels: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式"""
        base = super().to_dict()
        base.update({
            "audience_reached": self.audience_reached,
            "engagement_metrics": self.engagement_metrics,
            "feedback_received": self.feedback_received,
            "delivery_channels": self.delivery_channels,
        })
        return base


# 输出模式验证函数

def validate_faculty_output(output: dict[str, Any], faculty_type: str) -> bool:
    """验证系部输出格式

    检查输出是否符合对应系部的模式要求。

    Args:
        output: 要验证的输出字典
        faculty_type: 系部类型

    Returns:
        是否验证通过
    """
    # 基础字段检查
    if "status" not in output:
        return False

    if output["status"] not in ("success", "partial", "failed"):
        return False

    # 根据系部类型进行特定验证
    if faculty_type == "PerceptionFaculty":
        return "sources" in output or "content" in output
    elif faculty_type == "InternalizationFaculty":
        return "storage_uris" in output or "entities_created" in output
    elif faculty_type == "ContemplationFaculty":
        return "insights" in output or "recommendations" in output
    elif faculty_type == "ActionFaculty":
        return "changes_made" in output or "verification_results" in output
    elif faculty_type == "InfluenceFaculty":
        return "delivery_channels" in output or "audience_reached" in output

    # 默认检查是否有内容
    return "content" in output


def calculate_output_quality(output: dict[str, Any]) -> QualityMetrics:
    """计算输出质量指标

    基于输出内容计算质量评分。

    Args:
        output: 系部输出字典

    Returns:
        质量指标
    """
    metrics = QualityMetrics()

    # 完整性：检查必需字段
    status = output.get("status", "partial")
    if status == "success":
        metrics.completeness = 1.0
    elif status == "partial":
        metrics.completeness = 0.5
    else:
        metrics.completeness = 0.0

    # 准确性：基于来源和验证
    if "sources" in output and output["sources"]:
        metrics.accuracy = 0.8
    elif "verification_results" in output:
        verification = output["verification_results"]
        if verification.get("passed", False):
            metrics.accuracy = 0.9
        else:
            metrics.accuracy = 0.5
    else:
        metrics.accuracy = 0.6

    # 清晰度：基于结构化程度
    content = output.get("content", "")
    if isinstance(content, dict):
        metrics.clarity = 0.8
    elif isinstance(content, str):
        # 简单启发式：检查结构化标记
        if any(marker in content for marker in ["#", "-", "*", "```"]):
            metrics.clarity = 0.7
        else:
            metrics.clarity = 0.5
    else:
        metrics.clarity = 0.3

    # 熵评分：基于输出的不确定性
    ambiguity_count = output.get("metadata", {}).get("ambiguity_count", 0)
    metrics.entropy_score = min(1.0, ambiguity_count / 10.0)

    return metrics


__all__ = [
    "FacultyOutput",
    "Source",
    "PerceptionOutput",
    "InternalizationOutput",
    "ContemplationOutput",
    "ActionOutput",
    "InfluenceOutput",
    "validate_faculty_output",
    "calculate_output_quality",
]
