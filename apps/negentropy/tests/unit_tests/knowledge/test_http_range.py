"""``negentropy.knowledge._http_range`` 纯函数单元测试（RFC 9110/7233 语义）。

覆盖 200/206/304/416 全分支与条件请求优先级、Range 解析各形态（闭区间 / 开区间 /
后缀 / 越界裁剪 / 不可满足 / 多段退化）及空文件边界。本模块为纯函数，断言不依赖 DB。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from negentropy.knowledge._http_range import (
    RangeSpec,
    build_etag,
    decide_range_response,
    http_date,
)

LM = datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC)
ETAG = '"deadbeef"'
CACHE = "private, max-age=300, must-revalidate"
CT = "application/pdf"


def _decide(total=1000, *, range_header=None, if_range=None, if_none_match=None, if_modified_since=None):
    return decide_range_response(
        total_size=total,
        etag=ETAG,
        last_modified=LM,
        cache_control=CACHE,
        content_type=CT,
        range_header=range_header,
        if_range=if_range,
        if_none_match=if_none_match,
        if_modified_since=if_modified_since,
    )


class TestPrimitives:
    def test_build_etag_is_quoted_strong(self):
        assert build_etag("abc123") == '"abc123"'

    def test_http_date_rfc1123_gmt(self):
        assert http_date(LM) == "Fri, 02 Jan 2026 03:04:05 GMT"


class TestFull200:
    def test_no_range_returns_200_with_full_headers(self):
        d = _decide()
        assert d.status_code == 200
        assert d.is_full is True
        assert d.spec is None
        assert d.headers["Accept-Ranges"] == "bytes"
        assert d.headers["Content-Length"] == "1000"
        assert d.headers["ETag"] == ETAG
        assert d.headers["Last-Modified"] == "Fri, 02 Jan 2026 03:04:05 GMT"
        assert d.headers["Cache-Control"] == CACHE
        assert d.headers["Content-Type"] == CT
        assert "Content-Range" not in d.headers

    def test_non_bytes_unit_ignored(self):
        assert _decide(range_header="items=0-1").status_code == 200

    def test_malformed_range_ignored(self):
        assert _decide(range_header="bytes=abc").status_code == 200

    def test_multi_range_degrades_to_full(self):
        d = _decide(range_header="bytes=0-10,20-30")
        assert d.status_code == 200
        assert d.is_full is True

    def test_inverted_range_ignored(self):
        # end < start 视为非法 → 回 200 全量
        assert _decide(range_header="bytes=500-100").status_code == 200


class TestPartial206:
    def test_closed_range(self):
        d = _decide(range_header="bytes=0-99")
        assert d.status_code == 206
        assert d.headers["Content-Range"] == "bytes 0-99/1000"
        assert d.headers["Content-Length"] == "100"
        assert d.spec == RangeSpec(start=0, length=100, total=1000)
        assert "Accept-Ranges" in d.headers

    def test_open_ended_range(self):
        d = _decide(range_header="bytes=100-")
        assert d.status_code == 206
        assert d.headers["Content-Range"] == "bytes 100-999/1000"
        assert d.headers["Content-Length"] == "900"
        assert d.spec == RangeSpec(start=100, length=900, total=1000)

    def test_suffix_range(self):
        d = _decide(range_header="bytes=-50")
        assert d.status_code == 206
        assert d.headers["Content-Range"] == "bytes 950-999/1000"
        assert d.spec == RangeSpec(start=950, length=50, total=1000)

    def test_suffix_larger_than_total_returns_whole(self):
        d = _decide(range_header="bytes=-2000")
        assert d.status_code == 206
        assert d.headers["Content-Range"] == "bytes 0-999/1000"
        assert d.spec == RangeSpec(start=0, length=1000, total=1000)

    def test_end_beyond_eof_is_clamped(self):
        d = _decide(total=50, range_header="bytes=0-99")
        assert d.status_code == 206
        assert d.headers["Content-Range"] == "bytes 0-49/50"
        assert d.headers["Content-Length"] == "50"


class TestUnsatisfiable416:
    def test_start_beyond_eof(self):
        d = _decide(total=1000, range_header="bytes=1000-1100")
        assert d.status_code == 416
        assert d.headers["Content-Range"] == "bytes */1000"
        assert d.spec is None
        assert "Content-Length" not in d.headers

    def test_zero_suffix(self):
        assert _decide(range_header="bytes=-0").status_code == 416


class TestConditional:
    def test_if_none_match_hit_returns_304(self):
        d = _decide(if_none_match=ETAG)
        assert d.status_code == 304
        assert d.headers["ETag"] == ETAG
        assert "Content-Length" not in d.headers
        assert "Content-Range" not in d.headers

    def test_if_none_match_star_returns_304(self):
        assert _decide(if_none_match="*").status_code == 304

    def test_if_none_match_weak_form_matches(self):
        assert _decide(if_none_match=f"W/{ETAG}").status_code == 304

    def test_if_none_match_miss_proceeds(self):
        assert _decide(if_none_match='"other"').status_code == 200

    def test_if_none_match_precedes_if_modified_since(self):
        # INM 不命中时即便 IMS 命中也不应 304（INM 优先）
        future = http_date(LM + timedelta(days=1))
        d = _decide(if_none_match='"other"', if_modified_since=future)
        assert d.status_code == 200

    def test_if_modified_since_not_modified_returns_304(self):
        future = http_date(LM + timedelta(seconds=10))
        assert _decide(if_modified_since=future).status_code == 304

    def test_if_modified_since_modified_returns_200(self):
        past = http_date(LM - timedelta(seconds=10))
        assert _decide(if_modified_since=past).status_code == 200

    def test_if_modified_since_malformed_ignored(self):
        assert _decide(if_modified_since="not-a-date").status_code == 200

    def test_conditional_304_takes_precedence_over_range(self):
        # 条件命中时无视 Range，直接 304
        assert _decide(range_header="bytes=0-99", if_none_match=ETAG).status_code == 304


class TestIfRange:
    def test_if_range_match_serves_206(self):
        d = _decide(range_header="bytes=0-99", if_range=ETAG)
        assert d.status_code == 206

    def test_if_range_mismatch_serves_full_200(self):
        d = _decide(range_header="bytes=0-99", if_range='"stale"')
        assert d.status_code == 200
        assert d.is_full is True


class TestEmptyResource:
    def test_no_range_zero_length(self):
        d = _decide(total=0)
        assert d.status_code == 200
        assert d.headers["Content-Length"] == "0"

    def test_any_range_on_empty_is_416(self):
        assert _decide(total=0, range_header="bytes=0-0").status_code == 416
        assert _decide(total=0, range_header="bytes=-5").status_code == 416
