"""WikiExportService._rewrite_asset_links 单测（GCS 退役后改写为主站资产端点 URL）。

纯函数（无 DB 依赖）：把 markdown 内 ``/api/documents/{doc}/assets/{file}`` 重写为
``{asset_base_url}/knowledge/wiki/documents/{doc}/assets/{file}``（配置 base）或
相对路径（未配置 base）。
"""

from unittest.mock import patch

import pytest

from negentropy.knowledge.lifecycle.wiki_export_service import WikiExportService

_DOC = "12345678-1234-1234-1234-1234567890ab"


def _md(ref: str) -> str:
    return f"# 标题\n\n![图](/api/documents/{_DOC}/assets/{ref})\n正文"


class _FakeWikiExport:
    """模拟 settings.knowledge.wiki_export 的最小替身。"""

    def __init__(self, asset_base_url):
        self.asset_base_url = asset_base_url


def _patch_base(url):
    """patch settings.knowledge.wiki_export.asset_base_url。"""
    return patch(
        "negentropy.knowledge.lifecycle.wiki_export_service.settings",
        new=type("S", (), {"knowledge": type("K", (), {"wiki_export": _FakeWikiExport(url)})()})(),
    )


class TestRewriteAssetLinks:
    def test_absolute_url_when_base_configured(self):
        svc = WikiExportService()
        with _patch_base("https://api.example.com"):
            out = svc._rewrite_asset_links(_md("fig.png"))
        assert f"https://api.example.com/knowledge/wiki/documents/{_DOC}/assets/fig.png" in out
        assert "/api/documents/" not in out

    def test_trailing_slash_stripped(self):
        svc = WikiExportService()
        with _patch_base("https://api.example.com/"):
            out = svc._rewrite_asset_links(_md("fig.png"))
        # 不应出现双斜杠
        assert "https://api.example.com/knowledge/wiki/documents/" in out
        assert "com//knowledge" not in out

    def test_relative_url_when_base_absent(self):
        svc = WikiExportService()
        with _patch_base(None):
            out = svc._rewrite_asset_links(_md("fig.png"))
        assert f"/knowledge/wiki/documents/{_DOC}/assets/fig.png" in out
        assert "/api/documents/" not in out

    def test_no_asset_ref_passthrough(self):
        svc = WikiExportService()
        md = "# 纯文本\n无图片引用"
        with _patch_base("https://api.example.com"):
            assert svc._rewrite_asset_links(md) == md

    def test_empty_markdown(self):
        svc = WikiExportService()
        with _patch_base("https://api.example.com"):
            assert svc._rewrite_asset_links("") == ""

    def test_multiple_assets_rewritten(self):
        svc = WikiExportService()
        md = f"![a](/api/documents/{_DOC}/assets/a.png)\n![b](/api/documents/{_DOC}/assets/b.jpg)"
        with _patch_base("https://api.example.com"):
            out = svc._rewrite_asset_links(md)
        assert f"https://api.example.com/knowledge/wiki/documents/{_DOC}/assets/a.png" in out
        assert f"https://api.example.com/knowledge/wiki/documents/{_DOC}/assets/b.jpg" in out
        assert "/api/documents/" not in out

    def test_no_gcs_url_emitted(self):
        """回归保护：绝不再生成 storage.googleapis.com / gs:// 链接。"""
        svc = WikiExportService()
        with _patch_base("https://api.example.com"):
            out = svc._rewrite_asset_links(_md("fig.png"))
        assert "storage.googleapis.com" not in out
        assert "gs://" not in out


@pytest.mark.parametrize("base", ["https://a.com", None])
def test_idempotent_second_pass_noop(base):
    """已重写的 markdown 再跑一次不应被二次改写（无 /api/documents/ 残留）。"""
    svc = WikiExportService()
    with _patch_base(base):
        once = svc._rewrite_asset_links(_md("fig.png"))
        twice = svc._rewrite_asset_links(once)
    assert once == twice
