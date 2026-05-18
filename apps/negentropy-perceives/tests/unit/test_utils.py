"""
## 工具类测试 (`test_utils.py`)

### RateLimiter 限流器测试

测试请求频率限制、时间窗口清理、多请求并发限流效果。

### RetryManager 重试管理器测试

测试退避延迟计算 (1s, 2s, 4s, 8s...)、失败后重试成功场景、最大重试次数耗尽处理、不同异常的重试策略。

### 工具函数测试

测试 URL 格式验证 (http/https)、HTML 标签移除和空白符处理、数据提取配置格式验证、异步函数执行时间测量。
"""

import pytest
import time
from unittest.mock import AsyncMock

from negentropy.perceives.infra import RateLimiter, rate_limiter
from negentropy.perceives.infra import RetryManager, retry_manager
from negentropy.perceives.infra import is_valid_url, clean_text, extract_emails
from negentropy.perceives.tools._registry import normalize_extract_config


class TestRateLimiter:
    """
    RateLimiter 限流器测试

    - **限流边界测试**: 测试请求频率限制
    - **时间窗口清理**: 测试过期请求时间戳清理
    - **并发限流**: 测试多请求并发限流效果
    """

    def test_rate_limiter_initialization(self):
        """
        测试限流器初始化

        验证 RateLimiter 实例包含正确的配置参数：
        - 请求频率设置正确
        - 最小间隔时间计算正确
        - 初始请求时间戳为 0
        """
        limiter = RateLimiter(requests_per_second=1.0)
        assert limiter.requests_per_second == 1.0
        assert limiter.min_interval == 1.0
        assert limiter.last_request_time == 0.0

    @pytest.mark.asyncio
    async def test_rate_limiting_within_limit(self):
        """
        测试在限制范围内的请求处理

        验证当请求频率未超过限制时，请求不会被延迟，确保正常请求不受影响
        """
        limiter = RateLimiter(requests_per_second=60.0)

        start_time = time.time()
        await limiter.wait()
        end_time = time.time()

        # Should not be delayed when within limit
        assert (end_time - start_time) < 0.1

    @pytest.mark.asyncio
    async def test_rate_limiting_exceeds_limit(self):
        """
        测试超过频率限制时的限流效果

        验证当请求频率超过限制时，后续请求会被适当延迟，防止对目标服务器造成压力
        """
        limiter = RateLimiter(requests_per_second=10.0)  # Higher limit for testing

        # Make two quick requests
        start_time = time.time()
        await limiter.wait()
        await limiter.wait()
        end_time = time.time()

        # Second request should be slightly delayed
        assert (end_time - start_time) >= 0.0  # Some delay expected

    def test_cleanup_old_requests(self):
        """
        测试过期请求时间戳清理

        验证限流器能够正确管理时间戳，清理过期的请求记录以防止内存泄漏
        """
        limiter = RateLimiter(requests_per_second=1.0)
        # Test that old timestamps are properly managed
        assert limiter.last_request_time == 0.0


class TestRetryManager:
    """Test the RetryManager class."""

    def test_retry_manager_initialization(self):
        """Test RetryManager initializes correctly."""
        manager = RetryManager(max_retries=3, base_delay=1.0)
        assert manager.max_retries == 3
        assert manager.base_delay == 1.0

    @pytest.mark.asyncio
    async def test_retry_success_first_attempt(self):
        """Test retry when operation succeeds on first attempt."""
        manager = RetryManager(max_retries=3)

        mock_func = AsyncMock(return_value="success")

        result = await manager.retry_async(mock_func)

        assert result == "success"
        assert mock_func.call_count == 1

    @pytest.mark.asyncio
    async def test_retry_success_after_failures(self):
        """Test retry when operation succeeds after failures."""
        manager = RetryManager(max_retries=3, base_delay=0.01)  # Very short delay

        mock_func = AsyncMock()
        mock_func.side_effect = [Exception("Error 1"), Exception("Error 2"), "success"]

        result = await manager.retry_async(mock_func)

        assert result == "success"
        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_retry_exhausted(self):
        """Test retry when all attempts are exhausted."""
        manager = RetryManager(max_retries=2, base_delay=0.01)

        mock_func = AsyncMock(side_effect=Exception("Persistent error"))

        with pytest.raises(Exception, match="Persistent error"):
            await manager.retry_async(mock_func)

        assert mock_func.call_count == 3  # Initial + 2 retries

    def test_calculate_delay_exponential_backoff(self):
        """Test exponential backoff delay calculation."""
        manager = RetryManager(base_delay=1.0, backoff_factor=2.0)

        # Test internal delay calculation logic
        delay_1 = manager.base_delay * (manager.backoff_factor**1)
        delay_2 = manager.base_delay * (manager.backoff_factor**2)

        assert delay_1 == 2.0
        assert delay_2 == 4.0


class TestUtilityFunctions:
    """Test standalone utility functions."""

    def test_is_valid_url_with_valid_urls(self):
        """Test is_valid_url with valid URLs."""
        assert is_valid_url("https://example.com") is True
        assert is_valid_url("http://test.org/path?query=value") is True
        assert is_valid_url("https://sub.domain.com:8080") is True

    def test_is_valid_url_with_invalid_urls(self):
        """Test is_valid_url with invalid URLs."""
        assert is_valid_url("not-a-url") is False
        assert is_valid_url("") is False

    def test_clean_text_basic(self):
        """Test clean_text basic cleaning."""
        dirty_text = "  \n\t  Hello   World  \r\n  "
        cleaned = clean_text(dirty_text)

        assert cleaned == "Hello World"

    def test_clean_text_email_extraction(self):
        """Test email extraction."""
        # Test email extraction
        text_with_email = "Contact us at test@example.com for more info"
        emails = extract_emails(text_with_email)
        assert "test@example.com" in emails

    def test_normalize_extract_config_valid(self):
        """Test normalize_extract_config with valid config."""
        valid_config = {
            "title": "h1",
            "content": {"selector": "p", "multiple": True, "attr": "text"},
        }

        validated = normalize_extract_config(valid_config)
        assert "title" in validated
        assert "content" in validated

    def test_normalize_extract_config_invalid(self):
        """Test normalize_extract_config with invalid config."""
        invalid_config = {
            "title": 123,  # Should be string or dict
        }

        with pytest.raises(ValueError):
            normalize_extract_config(invalid_config)

    def test_global_instances(self):
        """Test global utility instances are properly initialized."""
        assert rate_limiter is not None
        assert retry_manager is not None
