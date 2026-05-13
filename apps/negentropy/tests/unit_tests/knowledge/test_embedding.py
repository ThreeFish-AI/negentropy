"""
Embedding 重试机制单元测试

测试 _call_with_retry() 的指数退避、超时和错误处理。
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from negentropy.knowledge.ingestion.embedding import _call_with_retry


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

        async def mock_sleep(duration):
            sleep_durations.append(duration)
            # 不实际等待

        with patch("negentropy.knowledge.ingestion.embedding.asyncio.sleep", side_effect=mock_sleep):
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


class TestNonRetryableFailFast:
    """凭证 / 路由类错误必须 fail-fast，不可重试到 max_retries。

    回归 Fix 3：embedding `_call_with_retry` 接入 `_is_non_retryable_error`。
    """

    @pytest.mark.asyncio
    async def test_authentication_error_does_not_retry(self):
        """模拟 LiteLLM AuthenticationError → 第一次失败立即抛出，不再重试。"""
        from litellm.exceptions import AuthenticationError

        call_count = 0

        async def auth_fail():
            nonlocal call_count
            call_count += 1
            raise AuthenticationError(
                message="The api_key client option must be set",
                llm_provider="openai",
                model="gpt-4o-mini",
            )

        with pytest.raises(AuthenticationError):
            await _call_with_retry(
                auth_fail,
                max_retries=3,
                base_backoff=0.01,
                timeout=5.0,
                context="test",
            )

        assert call_count == 1, "AuthenticationError 应在第 1 次后立即终止，不重试"

    @pytest.mark.asyncio
    async def test_not_found_error_does_not_retry(self):
        """模拟 LiteLLM NotFoundError (404 路由不存在) → 立即抛出。"""
        from litellm.exceptions import NotFoundError

        call_count = 0

        async def nf_fail():
            nonlocal call_count
            call_count += 1
            raise NotFoundError(
                message="no Route matched with those values",
                llm_provider="gemini",
                model="text-embedding-004",
            )

        with pytest.raises(NotFoundError):
            await _call_with_retry(
                nf_fail,
                max_retries=3,
                base_backoff=0.01,
                timeout=5.0,
                context="test",
            )

        assert call_count == 1, "NotFoundError 应在第 1 次后立即终止，不重试"

    @pytest.mark.asyncio
    async def test_text_pattern_matched_non_retryable(self):
        """LiteLLM 包装层把上游错误重包成 generic Exception 时，文本模式兜底依然命中。"""

        class _GenericWrap(Exception):
            pass

        call_count = 0

        async def text_match_fail():
            nonlocal call_count
            call_count += 1
            # 包含 'AuthenticationError' 文本，应被字符串模式识别为不可重试。
            raise _GenericWrap("Caught AuthenticationError: api_key missing")

        with pytest.raises(_GenericWrap):
            await _call_with_retry(
                text_match_fail,
                max_retries=3,
                base_backoff=0.01,
                timeout=5.0,
                context="test",
            )

        assert call_count == 1, "文本模式兜底应在第 1 次后立即终止"

    @pytest.mark.asyncio
    async def test_transient_error_still_retries(self):
        """ConnectionError 等可恢复错误仍应正常重试到上限（保证不破坏既有行为）。"""
        call_count = 0

        async def transient_fail():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("transient")

        with pytest.raises(ConnectionError):
            await _call_with_retry(
                transient_fail,
                max_retries=3,
                base_backoff=0.01,
                timeout=5.0,
                context="test",
            )

        assert call_count == 3, "transient 错误仍应重试到 max_retries"
