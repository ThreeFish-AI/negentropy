"""
LLM 重试退避（``_compute_retry_backoff``）单元测试。

覆盖三类故障的退避策略：
  1. 网关超时（Cloudflare 524 / "timeout"）：30s/60s/90s 递增（cap 120s）；
  2. 瞬时服务端错误 + ``retry_after`` 提示（502/503/429）：尊重服务端建议，
     叠加 floor（≥ 默认指数）/ cap（≤ 120s）；
  3. 普通错误：指数退避 1s/2s/4s（cap 10s）。

参考缺陷 4（plan: kg-build-fix）：Cloudflare 502 错误返回 ``retry_after: 60``
但旧实现按指数退避 1.1s 立刻重试，未尊重 Cloudflare 显式建议。
"""

from __future__ import annotations

from negentropy.knowledge.graph.extractors import (
    _compute_retry_backoff,
    _extract_retry_after_seconds,
)

# ============================================================================
# _extract_retry_after_seconds
# ============================================================================


class TestExtractRetryAfter:
    def test_json_body_unquoted_int(self):
        """JSON body 形式：'retry_after': 60。"""
        err = "{'type': 'error', 'retry_after': 60, 'status': 502}"
        assert _extract_retry_after_seconds(err) == 60.0

    def test_json_body_double_quoted_int(self):
        err = '{"retry_after": 30}'
        assert _extract_retry_after_seconds(err) == 30.0

    def test_json_body_quoted_string(self):
        err = '{"retry_after": "45"}'
        assert _extract_retry_after_seconds(err) == 45.0

    def test_http_header_form(self):
        """HTTP header 形式：Retry-After: 60。"""
        err = "HTTP/1.1 429 Too Many Requests\nRetry-After: 90"
        assert _extract_retry_after_seconds(err) == 90.0

    def test_http_header_case_insensitive(self):
        err = "retry-after: 15"
        assert _extract_retry_after_seconds(err) == 15.0

    def test_no_retry_after_returns_none(self):
        err = "Generic 500 Internal Server Error"
        assert _extract_retry_after_seconds(err) is None


# ============================================================================
# _compute_retry_backoff: 网关超时
# ============================================================================


class TestGatewayTimeoutBackoff:
    def test_524_attempt_0_around_30s(self):
        err = "litellm.Timeout: Cloudflare 524"
        backoff = _compute_retry_backoff(err, attempt=0)
        assert 30.0 <= backoff <= 35.0  # 30 + jitter[0,5]

    def test_524_attempt_1_around_60s(self):
        err = "Connection timed out"
        backoff = _compute_retry_backoff(err, attempt=1)
        assert 60.0 <= backoff <= 65.0

    def test_524_capped_at_120s(self):
        err = "524 timeout"
        backoff = _compute_retry_backoff(err, attempt=10)
        assert backoff <= 120.0


# ============================================================================
# _compute_retry_backoff: retry_after 解析（瞬时故障）
# ============================================================================


class TestRetryAfterHonored:
    def test_502_with_retry_after_60_uses_60(self):
        """关键回归：Cloudflare 502 + retry_after=60 → backoff ≥ 60s。"""
        err = "litellm.BadGatewayError: OpenAIException - Error code: 502 - {'type': 'bad gateway', 'retry_after': 60}"
        backoff = _compute_retry_backoff(err, attempt=0)
        # floor=max(60, default_backoff≈1)=60；jitter[0,1]
        assert 60.0 <= backoff <= 61.5

    def test_503_with_retry_after_15_uses_15(self):
        err = "503 Service Unavailable. Retry-After: 15"
        backoff = _compute_retry_backoff(err, attempt=0)
        assert 15.0 <= backoff <= 16.5

    def test_429_with_retry_after_capped_at_120(self):
        """超长 retry_after 被 cap 到 120s，防止构建阻塞。"""
        err = "429 Too Many Requests, retry_after: 3600"
        backoff = _compute_retry_backoff(err, attempt=0)
        assert backoff <= 121.5  # 120 + jitter[0,1.5]

    def test_502_retry_after_1_does_not_accelerate(self):
        """retry_after=1 比指数退避更快时，应使用 floor（默认退避）。"""
        err = "502 Bad Gateway, retry_after: 1"
        # attempt=3: default = min(2^3 + jitter, 10) = 8-9
        backoff = _compute_retry_backoff(err, attempt=3)
        # floor=max(1, 8-9)=8-9，加 jitter[0,1] 后 8-10
        assert backoff >= 8.0


# ============================================================================
# _compute_retry_backoff: 普通错误 / 非瞬时故障
# ============================================================================


class TestNonTransientBackoff:
    def test_400_with_retry_after_text_uses_exponential(self):
        """400 不是瞬时故障，即使错误体含 retry_after 也走原指数退避（不被错误延长）。"""
        err = "400 Bad Request, retry_after: 60"
        backoff = _compute_retry_backoff(err, attempt=0)
        # 默认指数：min(2^0 + jitter[0,1], 10) = 1.0-2.0
        assert 1.0 <= backoff <= 2.0

    def test_unknown_error_attempt_0(self):
        backoff = _compute_retry_backoff("ValueError: bad input", attempt=0)
        assert 1.0 <= backoff <= 2.0

    def test_unknown_error_attempt_2(self):
        backoff = _compute_retry_backoff("RuntimeError: foo", attempt=2)
        # min(2^2 + jitter[0,1], 10) = 4.0-5.0
        assert 4.0 <= backoff <= 5.0

    def test_unknown_error_capped_at_10s(self):
        backoff = _compute_retry_backoff("RuntimeError: foo", attempt=10)
        assert backoff <= 10.0


# ============================================================================
# _compute_retry_backoff: 网关超时优先级高于 retry_after
# ============================================================================


class TestGatewayTimeoutPrecedence:
    def test_524_with_retry_after_uses_524_logic(self):
        """524 + retry_after：524 网关超时逻辑优先（更激进的退避）。"""
        err = "524 timeout, retry_after: 5"
        backoff = _compute_retry_backoff(err, attempt=0)
        # 走 524 分支：30 + jitter[0,5]
        assert 30.0 <= backoff <= 35.0
