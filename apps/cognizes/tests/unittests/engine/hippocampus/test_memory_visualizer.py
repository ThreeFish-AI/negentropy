"""
MemoryVisualizer 单元测试

覆盖:
- 数据类
- 事件类型枚举
- 进度计算
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from cognizes.engine.hippocampus.memory_visualizer import (
    MemoryVisualizer,
    MemoryEventType,
    ConsolidationProgress,
    MemoryHit,
    MemoryHealthMetrics,
)


class TestMemoryEventTypeEnum:
    """MemoryEventType 枚举测试"""

    def test_event_type_values(self):
        """验证事件类型值"""
        assert MemoryEventType.CONSOLIDATION_PROGRESS.value == "memory_consolidation_progress"
        assert MemoryEventType.MEMORY_HIT.value == "memory_hit"
        assert MemoryEventType.DECAY_UPDATE.value == "memory_decay_update"
        assert MemoryEventType.CONTEXT_BUDGET.value == "memory_context_budget"


class TestConsolidationProgressDataclass:
    """ConsolidationProgress 数据类测试"""

    def test_progress_creation(self):
        """验证创建"""
        progress = ConsolidationProgress(
            job_id="job-1",
            status="running",
            total_events=100,
            processed_events=50,
            extracted_facts=10,
        )
        assert progress.job_id == "job-1"
        assert progress.status == "running"
        assert progress.total_events == 100
        assert progress.processed_events == 50
        assert progress.extracted_facts == 10

    def test_progress_percent_calculation(self):
        """验证进度百分比计算"""
        progress = ConsolidationProgress(
            job_id="job-1",
            status="running",
            total_events=100,
            processed_events=75,
            extracted_facts=5,
        )
        assert progress.progress_percent == 75.0

    def test_progress_percent_zero_total(self):
        """验证总数为 0 时的进度"""
        progress = ConsolidationProgress(
            job_id="job-1",
            status="pending",
            total_events=0,
            processed_events=0,
            extracted_facts=0,
        )
        assert progress.progress_percent == 0.0


class TestMemoryHitDataclass:
    """MemoryHit 数据类测试"""

    def test_memory_hit_creation(self):
        """验证创建"""
        hit = MemoryHit(
            memory_id="mem-1",
            memory_type="episodic",
            content_preview="这是记忆预览...",
            relevance_score=0.88,
            source_session_id="session-1",
            retention_score=0.95,
        )
        assert hit.memory_id == "mem-1"
        assert hit.memory_type == "episodic"
        assert hit.relevance_score == 0.88
        assert hit.retention_score == 0.95

    def test_memory_hit_defaults(self):
        """验证默认值"""
        hit = MemoryHit(
            memory_id="mem-1",
            memory_type="semantic",
            content_preview="预览",
            relevance_score=0.5,
        )
        assert hit.source_session_id is None
        assert hit.created_at is None
        assert hit.retention_score == 1.0


class TestMemoryHealthMetricsDataclass:
    """MemoryHealthMetrics 数据类测试"""

    def test_metrics_creation(self):
        """验证创建"""
        metrics = MemoryHealthMetrics(
            total_memories=1000,
            episodic_count=600,
            semantic_count=300,
            procedural_count=100,
            avg_retention_score=0.72,
            low_retention_count=50,
            decay_rate_7d=0.05,
            top_accessed_memories=["mem-1", "mem-2", "mem-3"],
        )
        assert metrics.total_memories == 1000
        assert metrics.episodic_count == 600
        assert metrics.semantic_count == 300
        assert metrics.procedural_count == 100
        assert metrics.avg_retention_score == 0.72
        assert metrics.low_retention_count == 50
        assert metrics.decay_rate_7d == 0.05
        assert len(metrics.top_accessed_memories) == 3


class TestMemoryVisualizerUnit:
    """MemoryVisualizer 单元测试"""

    @pytest.fixture
    def mock_pool(self):
        """创建 Mock 连接池"""
        return MagicMock()

    @pytest.fixture
    def visualizer(self, mock_pool):
        """创建 Visualizer 实例"""
        return MemoryVisualizer(mock_pool)

    def test_initialization_without_emitter(self, mock_pool):
        """验证无事件发射器初始化"""
        visualizer = MemoryVisualizer(mock_pool)
        assert visualizer._pool is mock_pool
        assert visualizer._event_emitter is None

    def test_initialization_with_emitter(self, mock_pool):
        """验证有事件发射器初始化"""
        emitter = MagicMock()
        visualizer = MemoryVisualizer(mock_pool, event_emitter=emitter)
        assert visualizer._event_emitter is emitter
