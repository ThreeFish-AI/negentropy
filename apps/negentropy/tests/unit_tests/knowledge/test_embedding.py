"""
Embedding 重试机制单元测试

测试 _call_with_retry() 的指数退避、超时和错误处理。
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from negentropy.knowledge.embedding import _call_with_retry


class TestCallWithRetry:
    """_call_with_retry 单元测试"""

    @pytest.mark.asyncio
    async def test_success_first_try(self):
        """首次调用成功应直接返回"""
        factory = AsyncMock(return_value="ok")

        result = await _call_with_retry(
            factory,
            max_retries=3,
            base_backoff=0.01,
            timeout=5.0,
            context="test",
        )

        assert result == "ok"
        factory.assert_called_once()

    @pytest.mark.asyncio
    async def test_success_after_retries(self):
        """前几次失败后成功应正确返回"""
        call_count = 0

        async def flaky_fn():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("transient failure")
            return "recovered"

        result = await _call_with_retry(
            flaky_fn,
            max_retries=3,
            base_backoff=0.01,
            timeout=5.0,
            context="test",
        )

        assert result == "recovered"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_max_retries_exhausted(self):
        """超过最大重试次数应抛出最后一次异常"""

        async def always_fail():
            raise RuntimeError("permanent failure")

        with pytest.raises(RuntimeError, match="permanent failure"):
            await _call_with_retry(
                always_fail,
                max_retries=3,
                base_backoff=0.01,
                timeout=5.0,
                context="test",
            )

    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """超时应触发重试"""
        call_count = 0

        async def slow_then_fast():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                await asyncio.sleep(10)  # 将被超时中断
            return "fast"

        result = await _call_with_retry(
            slow_then_fast,
            max_retries=3,
            base_backoff=0.01,
            timeout=0.1,  # 很短的超时
            context="test",
        )

        assert result == "fast"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_timeout_all_retries_raises(self):
        """所有重试都超时应抛出 TimeoutError"""

        async def always_slow():
            await asyncio.sleep(10)

        with pytest.raises(TimeoutError):
            await _call_with_retry(
                always_slow,
                max_retries=2,
                base_backoff=0.01,
                timeout=0.05,
                context="test",
            )

    @pytest.mark.asyncio
    async def test_exponential_backoff_called(self):
        """应使用指数退避间隔"""
        sleep_durations = []

        async def fail_fn():
            raise ValueError("fail")

        original_sleep = asyncio.sleep

        async def mock_sleep(duration):
            sleep_durations.append(duration)
            # 不实际等待

        with patch("negentropy.knowledge.embedding.asyncio.sleep", side_effect=mock_sleep):
            with pytest.raises(ValueError):
                await _call_with_retry(
                    fail_fn,
                    max_retries=4,
                    base_backoff=1.0,
                    timeout=5.0,
                    context="test",
                )

        # 验证指数退避: 1.0, 2.0, 4.0 (3 次间隔，因为第 4 次不需要等待)
        assert len(sleep_durations) == 3
        assert sleep_durations[0] == pytest.approx(1.0)
        assert sleep_durations[1] == pytest.approx(2.0)
        assert sleep_durations[2] == pytest.approx(4.0)
