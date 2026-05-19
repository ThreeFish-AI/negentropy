"""infra/ 子包结构与向后兼容性验证。"""


class TestInfraPackageExports:
    """验证 infra/ 子包的 __init__.py 导出完整性。"""

    def test_import_rate_limiter(self):
        from negentropy.perceives.infra import RateLimiter, rate_limiter

        assert RateLimiter is not None
        assert rate_limiter is not None

    def test_import_retry_manager(self):
        from negentropy.perceives.infra import RetryManager, retry_manager

        assert RetryManager is not None
        assert retry_manager is not None

    def test_import_parsing_functions(self):
        from negentropy.perceives.infra import (
            clean_text,
            extract_domain,
            extract_emails,
            extract_phone_numbers,
            is_valid_url,
            normalize_url,
        )

        assert callable(clean_text)
        assert callable(extract_domain)
        assert callable(extract_emails)
        assert callable(extract_phone_numbers)
        assert callable(is_valid_url)
        assert callable(normalize_url)

    def test_import_validate_url(self):
        from negentropy.perceives.infra import validate_url

        assert callable(validate_url)
        assert validate_url("https://example.com") is None
        assert validate_url("not-a-url") is not None
