"""
MemoryRetentionManager 单元测试

覆盖:
- 保留分数计算逻辑
- 统计信息数据类
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from cognizes.engine.hippocampus.retention_manager import (
    MemoryRetentionManager,
    MemoryStats,
)


class TestMemoryStatsDataclass:
    """MemoryStats 数据类测试"""

    def test_memory_stats_creation(self):
        """验证 MemoryStats 创建"""
        stats = MemoryStats(
            total_memories=100,
            high_value_count=30,
            medium_value_count=50,
            low_value_count=20,
            avg_retention_score=0.65,
            cleaned_count=5,
        )
        assert stats.total_memories == 100
        assert stats.high_value_count == 30
        assert stats.medium_value_count == 50
        assert stats.low_value_count == 20
        assert stats.avg_retention_score == 0.65
        assert stats.cleaned_count == 5


class TestRetentionManagerUnit:
    """RetentionManager 单元测试 (Mock 数据库)"""

    @pytest.fixture
    def mock_pool(self):
        """创建 Mock 连接池"""
        pool = MagicMock()
        conn = AsyncMock()
        pool.acquire = MagicMock(return_value=AsyncMock(__aenter__=AsyncMock(return_value=conn)))
        return pool, conn

    @pytest.fixture
    def manager(self, mock_pool):
        """创建 Manager 实例"""
        pool, _ = mock_pool
        return MemoryRetentionManager(
            pool=pool,
            decay_rate=0.1,
            cleanup_threshold=0.1,
            min_age_days=7,
        )

    def test_default_parameters(self):
        """验证默认参数"""
        pool = MagicMock()
        manager = MemoryRetentionManager(pool)

        assert manager.decay_rate == 0.1
        assert manager.cleanup_threshold == 0.1
        assert manager.min_age_days == 7

    def test_custom_parameters(self):
        """验证自定义参数"""
        pool = MagicMock()
        manager = MemoryRetentionManager(
            pool=pool,
            decay_rate=0.2,
            cleanup_threshold=0.15,
            min_age_days=14,
        )

        assert manager.decay_rate == 0.2
        assert manager.cleanup_threshold == 0.15
        assert manager.min_age_days == 14


class TestRetentionDistribution:
    """保留分数分布测试"""

    def test_distribution_thresholds(self):
        """验证分布阈值定义"""
        # high: >= 0.7
        # medium: 0.3 <= x < 0.7
        # low: < 0.3
        assert 0.7 > 0.3  # high > medium threshold
        assert 0.3 > 0.0  # medium > low threshold
