"""
单元测试：tools/_registry.py 公共辅助函数
测试 validate_url, validate_page_range, elapsed_ms
"""

import time


from negentropy.perceives.tools._registry import (
    elapsed_ms,
    validate_page_range,
    validate_url,
)


class TestValidateUrl:
    """测试 URL 验证辅助函数"""

    def test_valid_http_url(self):
        assert validate_url("http://example.com") is None

    def test_valid_https_url(self):
        assert validate_url("https://example.com/path?q=1") is None

    def test_missing_scheme(self):
        assert validate_url("example.com") is not None

    def test_missing_netloc(self):
        assert validate_url("http://") is not None

    def test_empty_string(self):
        assert validate_url("") is not None

    def test_relative_path(self):
        assert validate_url("/path/to/page") is not None


class TestValidatePageRange:
    """测试页码范围验证辅助函数"""

    def test_none_returns_none(self):
        result, error = validate_page_range(None)
        assert result is None
        assert error is None

    def test_empty_list_returns_none(self):
        result, error = validate_page_range([])
        assert result is None
        assert error is None

    def test_valid_range(self):
        result, error = validate_page_range([0, 10])
        assert result == (0, 10)
        assert error is None

    def test_wrong_length(self):
        result, error = validate_page_range([1])
        assert result is None
        assert "exactly 2 elements" in error

    def test_three_elements(self):
        result, error = validate_page_range([1, 2, 3])
        assert result is None
        assert "exactly 2 elements" in error

    def test_negative_start(self):
        result, error = validate_page_range([-1, 5])
        assert result is None
        assert "non-negative" in error

    def test_negative_end(self):
        result, error = validate_page_range([0, -1])
        assert result is None
        assert "non-negative" in error

    def test_start_equals_end(self):
        result, error = validate_page_range([5, 5])
        assert result is None
        assert "less than" in error

    def test_start_greater_than_end(self):
        result, error = validate_page_range([10, 5])
        assert result is None
        assert "less than" in error


class TestElapsedMs:
    """测试耗时计算辅助函数"""

    def test_returns_int(self):
        start = time.time()
        result = elapsed_ms(start)
        assert isinstance(result, int)

    def test_positive_duration(self):
        start = time.time() - 0.1  # 100ms ago
        result = elapsed_ms(start)
        assert result >= 90  # Allow some tolerance
