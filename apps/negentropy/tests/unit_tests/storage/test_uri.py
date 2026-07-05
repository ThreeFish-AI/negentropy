"""``pgblob://`` URI 工具函数单测（纯逻辑，无 DB）。"""

import pytest

from negentropy.storage.uri import (
    BLOB_SCHEME,
    build_uri,
    is_blob_uri,
    parse_uri,
)


class TestBuildUri:
    def test_basic(self):
        assert build_uri("knowledge/app/corpus/file.pdf") == "pgblob://knowledge/app/corpus/file.pdf"

    def test_strips_leading_slash(self):
        assert build_uri("/key") == "pgblob://key"
        assert build_uri("key") == "pgblob://key"

    def test_preserves_internal_slashes(self):
        assert build_uri("a/b/c") == "pgblob://a/b/c"


class TestParseUri:
    def test_basic(self):
        assert parse_uri("pgblob://knowledge/app/corpus/file.pdf") == "knowledge/app/corpus/file.pdf"

    def test_roundtrip(self):
        key = "mcp-trials/negentropy/server/abc-name.bin"
        assert parse_uri(build_uri(key)) == key

    @pytest.mark.parametrize("bad", ["gs://bucket/x", "http://x", "pgblob:", "not a uri", ""])
    def test_invalid_raises(self, bad):
        with pytest.raises(ValueError):
            parse_uri(bad)

    def test_empty_key_is_parseable(self):
        # ``pgblob://``（空 key）语法合法，空 key 的语义问题（不存在）交由
        # download/delete 下游以 StorageError 处理，而非 URI 解析层。
        assert parse_uri("pgblob://") == ""


class TestIsBlobUri:
    @pytest.mark.parametrize(
        "uri",
        ["pgblob://x", "pgblob://a/b/c", "pgblob:///leading"],
    )
    def test_true(self, uri):
        assert is_blob_uri(uri) is True

    @pytest.mark.parametrize(
        "uri",
        ["gs://bucket/x", "http://x", "pgblob", "file:///x", "", "pgblob"],
    )
    def test_false(self, uri):
        assert is_blob_uri(uri) is False

    def test_none_is_false(self):
        assert is_blob_uri(None) is False


def test_scheme_constant():
    assert BLOB_SCHEME == "pgblob"
