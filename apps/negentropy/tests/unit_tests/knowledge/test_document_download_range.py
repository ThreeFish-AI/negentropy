"""文档下载/预览端点路由测试（Range 默认关闭 + 条件缓存）。

经 ``FastAPI() + include_router + TestClient`` 驱动真实请求头解析，``monkeypatch``
注入 Fake ``DocumentStorageService`` 以脱离 blob/DB。当前策略：非线性化 PDF 关闭
Range（``PREVIEW_RANGE_ENABLED=False``）—— 不声明 ``Accept-Ranges``、任何 ``Range``
统一回 200 全量以规避 range 风暴拖慢首屏；仅保留条件缓存（``ETag``/``304``）保证二次
打开快。断言：200 全量+校验器头、``Range`` 被忽略、``If-None-Match``→304，以及
**URL 源文档仍返回 Markdown**（显示内容回归护栏）。覆盖 corpus 与 library 两条路由。
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

from negentropy.knowledge.routes import documents as documents_routes
from negentropy.knowledge.routes import library as library_routes

PDF_BYTES = bytes(range(256)) * 4  # 1024 字节，确定性可切片
MD_TEXT = "# Hello\n\n正文内容。"
FILE_HASH = "ab" * 32  # 64 hex
UPDATED_AT = datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC)
ETAG = f'"{FILE_HASH}"'


class _FakeDoc:
    def __init__(self, *, is_url: bool = False) -> None:
        self.metadata_ = {"source_type": "url"} if is_url else {}
        self.original_filename = "page.html" if is_url else "report.pdf"
        self.display_name = None
        self.content_type = "text/html" if is_url else "application/pdf"
        self.file_size = 0 if is_url else len(PDF_BYTES)
        self.file_hash = FILE_HASH
        self.updated_at = UPDATED_AT
        self.content_uri = "pgblob://knowledge/app/c/report.pdf"


class _FakeService:
    def __init__(self, doc: _FakeDoc) -> None:
        self._doc = doc

    async def get_document(self, *, document_id, corpus_id=None, app_name=None):
        return self._doc

    async def get_document_content(self, document_id):
        return PDF_BYTES

    async def download_blob_range_by_uri(self, content_uri, start, length):
        return PDF_BYTES[start : start + length]

    async def get_blob_size_by_uri(self, content_uri):
        return len(PDF_BYTES)

    async def get_document_markdown(self, document_id):
        return MD_TEXT


def _client(monkeypatch, doc: _FakeDoc) -> TestClient:
    # 路由内 `from negentropy.storage.service import DocumentStorageService` 在调用时
    # 绑定，故 patch 模块属性为返回 Fake 的工厂（impl 以无参 `DocumentStorageService()` 构造）。
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: _FakeService(doc))
    app = FastAPI()
    app.include_router(documents_routes.router)
    app.include_router(library_routes.router)
    return TestClient(app)


CORPUS_URL = "/base/11111111-1111-1111-1111-111111111111/documents/22222222-2222-2222-2222-222222222222/download"
LIBRARY_URL = "/documents/22222222-2222-2222-2222-222222222222/download"


class TestBinaryPreview:
    """二进制源文档：Range 默认关闭（非线性化 PDF 避免 range 风暴），仅保留条件缓存。"""

    def test_plain_get_returns_200_with_caching_validators(self, monkeypatch):
        client = _client(monkeypatch, _FakeDoc())
        r = client.get(CORPUS_URL)
        assert r.status_code == 200
        # Range 关闭：不声明 Accept-Ranges → 浏览器不切到范围模式，首屏走单次全量下载。
        assert "accept-ranges" not in r.headers
        # 缓存协商头保留 → 「二次打开快」。
        assert r.headers["content-length"] == str(len(PDF_BYTES))
        assert r.headers["etag"] == ETAG
        assert "last-modified" in r.headers
        assert r.headers["cache-control"] == documents_routes.DOWNLOAD_CACHE_CONTROL
        assert r.headers["content-disposition"].lower().startswith("attachment")
        assert "content-range" not in r.headers
        assert r.content == PDF_BYTES

    def test_range_header_ignored_serves_full_200(self, monkeypatch):
        # 即便客户端发来 Range，也统一回 200 全量（不出现 206 / Content-Range）。
        client = _client(monkeypatch, _FakeDoc())
        r = client.get(CORPUS_URL, headers={"Range": "bytes=0-99"})
        assert r.status_code == 200
        assert "content-range" not in r.headers
        assert "accept-ranges" not in r.headers
        assert r.content == PDF_BYTES

    def test_out_of_range_also_serves_full_200(self, monkeypatch):
        # Range 关闭时越界 Range 不再触发 416，而是回 200 全量。
        client = _client(monkeypatch, _FakeDoc())
        r = client.get(CORPUS_URL, headers={"Range": "bytes=100000-100100"})
        assert r.status_code == 200
        assert r.content == PDF_BYTES

    def test_if_none_match_returns_304_empty(self, monkeypatch):
        # 条件缓存独立于 Range：命中 ETag 仍回 304 空 body（「二次打开快」）。
        client = _client(monkeypatch, _FakeDoc())
        r = client.get(CORPUS_URL, headers={"If-None-Match": ETAG})
        assert r.status_code == 304
        assert r.content == b""
        assert r.headers["etag"] == ETAG

    def test_library_route_serves_full_200(self, monkeypatch):
        client = _client(monkeypatch, _FakeDoc())
        r = client.get(LIBRARY_URL, headers={"Range": "bytes=10-19"})
        assert r.status_code == 200
        assert r.content == PDF_BYTES


class TestUrlDocUnchanged:
    def test_url_doc_returns_markdown_without_range(self, monkeypatch):
        # 显示内容回归护栏：URL 源文档仍返回 Markdown，不施加 Range，附 attachment。
        client = _client(monkeypatch, _FakeDoc(is_url=True))
        r = client.get(CORPUS_URL, headers={"Range": "bytes=0-9"})
        assert r.status_code == 200  # 不是 206
        assert r.headers["content-type"].startswith("text/markdown")
        assert "content-range" not in r.headers
        assert r.headers["content-disposition"].lower().startswith("attachment")
        assert r.content == MD_TEXT.encode("utf-8")
