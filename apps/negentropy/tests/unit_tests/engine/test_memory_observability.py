"""
Memory Observability 单元测试

测试健康检查和指标聚合的核心逻辑。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic_core import ValidationError


class TestHealthCheckerLogic:
    """check_memory_health 的核心逻辑测试（mock DB）。"""

    @pytest.mark.asyncio
    async def test_healthy_when_db_ok(self):
        """DB 连通时返回 healthy 状态。"""
        from negentropy.engine.observability.health_checker import check_memory_health

        mock_result = MagicMock()
        mock_result.scalar.return_value = 1

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.observability.health_checker.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value = mock_db
            result = await check_memory_health()

        assert result["status"] == "healthy"
        assert "checks" in result

    @pytest.mark.asyncio
    async def test_degraded_when_db_down(self):
        """DB 不可达时返回 degraded 状态。"""
        from negentropy.engine.observability.health_checker import check_memory_health

        mock_db = AsyncMock()
        mock_db.execute.side_effect = Exception("connection refused")
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.engine.observability.health_checker.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value = mock_db
            result = await check_memory_health()

        assert result["status"] == "degraded"
        assert result["checks"]["db"]["status"] == "error"


class TestMemoryMetricsDefaults:
    """get_memory_metrics 返回值结构测试。"""

    def test_function_signature(self):
        """验证 get_memory_metrics 函数存在且有正确签名。"""
        import inspect

        from negentropy.engine.observability.memory_metrics import get_memory_metrics

        sig = inspect.signature(get_memory_metrics)
        assert "user_id" in sig.parameters
        assert "app_name" in sig.parameters


class TestObservabilitySettings:
    """Phase 6 G4 Observability 配置测试。"""

    def test_defaults(self):
        """默认配置：health 和 metrics 均启用。"""
        from negentropy.config.memory import MemoryObservabilitySettings

        s = MemoryObservabilitySettings()
        assert s.health_enabled is True
        assert s.metrics_enabled is True

    def test_frozen(self):
        """配置对象不可变。"""
        from negentropy.config.memory import MemoryObservabilitySettings

        s = MemoryObservabilitySettings()
        with pytest.raises(ValidationError):
            s.health_enabled = False  # type: ignore[misc]

    def test_in_memory_settings(self):
        """MemorySettings 包含 observability 子配置。"""
        from negentropy.config.memory import MemorySettings

        s = MemorySettings()
        assert hasattr(s, "observability")
        assert s.observability.health_enabled is True
