"""PostgresBlobStorage 集成测试（需 PostgreSQL 测试库，autouse fixture 注入）。"""

import pytest

from negentropy.storage import StorageError
from negentropy.storage.postgres_client import PostgresBlobStorage
from negentropy.storage.uri import parse_uri


@pytest.fixture
def storage():
    return PostgresBlobStorage()


class TestComputeHashAndPath:
    def test_compute_hash_sha256(self, storage):
        h = storage.compute_hash(b"hello")
        # SHA-256("hello") 固定值
        assert h == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"

    def test_build_path_format(self, storage):
        key = storage.build_path("negentropy", "corpus-123", "my file.pdf")
        assert key == "knowledge/negentropy/corpus-123/my_file.pdf"

    def test_build_path_library_segment(self, storage):
        key = storage.build_path("negentropy", "library", "doc.md")
        assert key == "knowledge/negentropy/library/doc.md"


class TestUploadDownload:
    async def test_upload_returns_pgblob_uri(self, storage):
        uri = await storage.upload(b"hello world", "knowledge/app/c/test.bin", "application/octet-stream")
        assert uri == "pgblob://knowledge/app/c/test.bin"
        assert parse_uri(uri) == "knowledge/app/c/test.bin"

    async def test_download_roundtrip(self, storage):
        content = b"\x00\x01\x02binary payload\xff" * 10
        uri = await storage.upload(content, "knowledge/app/c/roundtrip.bin", "application/octet-stream")
        assert await storage.download(uri) == content

    async def test_upload_overwrite_same_key(self, storage):
        key = "knowledge/app/c/overwrite.bin"
        uri1 = await storage.upload(b"v1", key)
        uri2 = await storage.upload(b"v2", key)
        assert uri1 == uri2  # 同 key → 同 URI（覆盖写）
        assert await storage.download(uri1) == b"v2"

    async def test_download_missing_raises_storage_error(self, storage):
        with pytest.raises(StorageError):
            await storage.download("pgblob://knowledge/nonexistent/key")


class TestRangeReads:
    """``get_size`` / ``download_range``（HTTP Range 部分读）。"""

    async def test_get_size_matches_content_length(self, storage):
        content = bytes(range(256)) * 4  # 1024 字节
        uri = await storage.upload(content, "knowledge/app/c/size.bin")
        assert await storage.get_size(uri) == len(content)

    async def test_get_size_missing_returns_none(self, storage):
        assert await storage.get_size("pgblob://knowledge/missing/size.bin") is None

    async def test_download_range_byte_exact(self, storage):
        # 用 0x00..0xff 全字节序列证明按字节精确（非文本化、非编码错位）。
        content = bytes(range(256)) * 4  # 1024 字节
        uri = await storage.upload(content, "knowledge/app/c/range.bin")
        # 起始
        assert await storage.download_range(uri, 0, 100) == content[0:100]
        # 中段
        assert await storage.download_range(uri, 500, 123) == content[500:623]
        # 尾部
        assert await storage.download_range(uri, len(content) - 10, 10) == content[-10:]

    async def test_download_range_missing_raises(self, storage):
        with pytest.raises(StorageError):
            await storage.download_range("pgblob://knowledge/missing/range.bin", 0, 10)


class TestDeleteAndExists:
    async def test_exists_true_after_upload(self, storage):
        await storage.upload(b"data", "knowledge/app/c/exists.bin")
        assert await storage.exists("knowledge/app/c/exists.bin") is True

    async def test_exists_false(self, storage):
        assert await storage.exists("knowledge/app/c/never-exists.bin") is False

    async def test_delete_removes_blob(self, storage):
        key = "knowledge/app/c/todelete.bin"
        uri = await storage.upload(b"data", key)
        await storage.delete(uri)
        assert await storage.exists(key) is False
        with pytest.raises(StorageError):
            await storage.download(uri)

    async def test_delete_idempotent_missing(self, storage):
        # 删除不存在的 URI 不应抛错
        await storage.delete("pgblob://knowledge/missing/idempotent.bin")

    async def test_delete_invalid_uri_raises(self, storage):
        with pytest.raises(ValueError):
            await storage.delete("gs://bucket/x")
