"""WikiExportService._rewrite_asset_links 单测。

两条互斥路径（由 ``settings.knowledge.wiki_export.bake_assets`` 选择）：

- ``bake_assets=False``（URL 重写）：把 markdown 内 ``/api/documents/{doc}/assets/{file}``
  重写为 ``{asset_base_url}/knowledge/wiki/documents/{doc}/assets/{file}``（配置 base）
  或相对路径（未配置 base）。
- ``bake_assets=True``（烘焙）：下载资产字节写入 ``assets_dir/{doc}/{file}`` 静态文件，
  markdown 改为相对路径 ``/assets/{doc}/{file}``。

方法为 async + 关键字参 ``assets_dir``（bake 路径落点）。
"""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from negentropy.knowledge.lifecycle.wiki_export_service import WikiExportService

_DOC = "12345678-1234-1234-1234-1234567890ab"


def _md(ref: str) -> str:
    return f"# 标题\n\n![图](/api/documents/{_DOC}/assets/{ref})\n正文"


class _FakeWikiExport:
    """模拟 settings.knowledge.wiki_export 的最小替身。"""

    def __init__(self, asset_base_url, bake_assets=False):
        self.asset_base_url = asset_base_url
        self.bake_assets = bake_assets


def _patch_cfg(url, bake_assets=False):
    """patch settings.knowledge.wiki_export（asset_base_url + bake_assets）。"""
    return patch(
        "negentropy.knowledge.lifecycle.wiki_export_service.settings",
        new=type(
            "S",
            (),
            {"knowledge": type("K", (), {"wiki_export": _FakeWikiExport(url, bake_assets)})()},
        )(),
    )


def _assets_dir() -> Path:
    """bake 路径需要一个 assets 落点；URL 重写路径不写文件，给临时目录即可。"""
    return Path(tempfile.mkdtemp()) / "assets"


class _FakeStorage:
    """模拟 DocumentStorageService：按文件名返回确定字节。"""

    def __init__(self, available: set[str] | None = None):
        self._available = available  # None=全部可用；否则仅这些 filename 可用

    async def download_extraction_asset(self, *, document_id, filename):
        if self._available is not None and filename not in self._available:
            return None
        return b"BYTES-" + filename.encode()


# ---------------------------------------------------------------------------
# URL 重写路径（bake_assets=False）
# ---------------------------------------------------------------------------


class TestRewriteAssetLinksUrl:
    async def test_absolute_url_when_base_configured(self):
        svc = WikiExportService()
        with _patch_cfg("https://api.example.com"):
            out = await svc._rewrite_asset_links(_md("fig.png"), assets_dir=_assets_dir())
        assert f"https://api.example.com/knowledge/wiki/documents/{_DOC}/assets/fig.png" in out
        assert "/api/documents/" not in out

    async def test_trailing_slash_stripped(self):
        svc = WikiExportService()
        with _patch_cfg("https://api.example.com/"):
            out = await svc._rewrite_asset_links(_md("fig.png"), assets_dir=_assets_dir())
        assert "https://api.example.com/knowledge/wiki/documents/" in out
        assert "com//knowledge" not in out

    async def test_relative_url_when_base_absent(self):
        svc = WikiExportService()
        with _patch_cfg(None):
            out = await svc._rewrite_asset_links(_md("fig.png"), assets_dir=_assets_dir())
        assert f"/knowledge/wiki/documents/{_DOC}/assets/fig.png" in out
        assert "/api/documents/" not in out

    async def test_no_asset_ref_passthrough(self):
        svc = WikiExportService()
        md = "# 纯文本\n无图片引用"
        with _patch_cfg("https://api.example.com"):
            assert await svc._rewrite_asset_links(md, assets_dir=_assets_dir()) == md

    async def test_empty_markdown(self):
        svc = WikiExportService()
        with _patch_cfg("https://api.example.com"):
            assert await svc._rewrite_asset_links("", assets_dir=_assets_dir()) == ""

    async def test_multiple_assets_rewritten(self):
        svc = WikiExportService()
        md = f"![a](/api/documents/{_DOC}/assets/a.png)\n![b](/api/documents/{_DOC}/assets/b.jpg)"
        with _patch_cfg("https://api.example.com"):
            out = await svc._rewrite_asset_links(md, assets_dir=_assets_dir())
        assert f"https://api.example.com/knowledge/wiki/documents/{_DOC}/assets/a.png" in out
        assert f"https://api.example.com/knowledge/wiki/documents/{_DOC}/assets/b.jpg" in out
        assert "/api/documents/" not in out

    async def test_no_gcs_url_emitted(self):
        """回归保护：绝不再生成 storage.googleapis.com / gs:// 链接。"""
        svc = WikiExportService()
        with _patch_cfg("https://api.example.com"):
            out = await svc._rewrite_asset_links(_md("fig.png"), assets_dir=_assets_dir())
        assert "storage.googleapis.com" not in out
        assert "gs://" not in out


@pytest.mark.parametrize("base", ["https://a.com", None])
async def test_idempotent_second_pass_noop(base):
    """URL 重写路径：已重写的 markdown 再跑一次不应被二次改写。"""
    svc = WikiExportService()
    ad = _assets_dir()
    with _patch_cfg(base):
        once = await svc._rewrite_asset_links(_md("fig.png"), assets_dir=ad)
        twice = await svc._rewrite_asset_links(once, assets_dir=ad)
    assert once == twice


# ---------------------------------------------------------------------------
# 烘焙路径（bake_assets=True）
# ---------------------------------------------------------------------------


class TestRewriteAssetLinksBake:
    async def test_bake_writes_file_and_relative_path(self):
        svc = WikiExportService()
        svc._storage_service = _FakeStorage()  # 注入：全部资产可用
        ad = _assets_dir()
        with _patch_cfg(None, bake_assets=True):
            out = await svc._rewrite_asset_links(_md("fig.png"), assets_dir=ad)
        # markdown 改相对路径
        assert f"/assets/{_DOC}/fig.png" in out
        assert "/api/documents/" not in out
        assert "/knowledge/wiki/documents/" not in out
        # 字节落盘
        asset_file = ad / _DOC / "fig.png"
        assert asset_file.read_bytes() == b"BYTES-fig.png"
        assert len(svc._asset_files) == 1

    async def test_bake_missing_asset_keeps_original_ref(self):
        """资产下载失败（返回 None）时保留原引用、不阻断，不写文件。"""
        svc = WikiExportService()
        svc._storage_service = _FakeStorage(available=set())  # 全部不可用
        ad = _assets_dir()
        with _patch_cfg(None, bake_assets=True):
            out = await svc._rewrite_asset_links(_md("fig.png"), assets_dir=ad)
        # 下载失败 → 保留原始引用（容错）
        assert f"/api/documents/{_DOC}/assets/fig.png" in out
        assert not (ad / _DOC / "fig.png").exists()
        assert svc._asset_files == []
