"""WikiExportService 注入保留 docs Publication 的导出聚合单测。

通过 monkeypatch ``WikiDao.list_publications`` 返回空 DB pub 列表，仅触发 docs-pack
注入路径（无需真实 DB），断言：``publications.json`` / ``index.json`` 含 negentropy、
各文件落盘、DB 同名 slug 冲突时跳过、两次导出对未变 docs 幂等。
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from negentropy.knowledge.lifecycle.wiki_export_service import WikiExportService

_MOD = "negentropy.knowledge.lifecycle.wiki_export_service"


@pytest.fixture
def docs_tree(tmp_path: Path) -> Path:
    docs = tmp_path / "docs"
    (docs / "concepts").mkdir(parents=True)
    (docs / "README.md").write_text("# 根\n\n见 [A](./concepts/a.md)。\n", encoding="utf-8")
    (docs / "concepts" / "a.md").write_text("# A\n", encoding="utf-8")
    return docs


def _patch_docs_cfg(docs_root: Path, *, enabled: bool = True):
    """patch settings.knowledge.wiki_docs_sync 指向假 docs 树（保持其余默认）。"""
    from negentropy.config.knowledge import WikiDocsSyncSettings

    cfg = WikiDocsSyncSettings(docs_root=str(docs_root), enabled=enabled)
    # settings 是 frozen，整体替换其 knowledge.wiki_docs_sync 取值用 SimpleNamespace 旁路。
    from types import SimpleNamespace

    fake_settings = SimpleNamespace(
        knowledge=SimpleNamespace(
            wiki_docs_sync=cfg,
            wiki_export=SimpleNamespace(bake_assets=False, asset_base_url=None),
        )
    )
    return patch(f"{_MOD}.settings", fake_settings)


async def _export(out: Path) -> None:
    svc = WikiExportService()
    with patch(f"{_MOD}.WikiDao.list_publications", new=AsyncMock(return_value=([], 0))):
        await svc.export_all_published(db=None, out_dir=out)


@pytest.mark.asyncio
async def test_docs_pub_injected_into_pack(tmp_path: Path, docs_tree: Path):
    out = tmp_path / "content"
    with _patch_docs_cfg(docs_tree):
        await _export(out)

    pubs = json.loads((out / "publications.json").read_text())
    assert any(p["slug"] == "negentropy" for p in pubs["items"])
    assert pubs["total"] == 1  # DB 空 + 1 个 docs pub

    idx = json.loads((out / "index.json").read_text())
    assert any(r["slug"] == "negentropy" for r in idx["publications"])
    assert "negentropy" in idx["pubs"]

    neg = out / "publications" / "negentropy"
    for name in ("publication.json", "nav-tree.json", "entries-index.json"):
        assert (neg / name).is_file()
    # README + concepts/a → 2 篇文档 entry 文件
    eindex = json.loads((neg / "entries-index.json").read_text())
    doc_ids = [e["id"] for e in eindex["items"] if e["document_id"] is not None]
    assert len(doc_ids) == 2
    for did in doc_ids:
        assert (out / "entries" / f"{did}.json").is_file()


@pytest.mark.asyncio
async def test_disabled_skips_docs_pub(tmp_path: Path, docs_tree: Path):
    out = tmp_path / "content"
    with _patch_docs_cfg(docs_tree, enabled=False):
        await _export(out)
    pubs = json.loads((out / "publications.json").read_text())
    assert not any(p["slug"] == "negentropy" for p in pubs["items"])
    assert not (out / "publications" / "negentropy").exists()


@pytest.mark.asyncio
async def test_db_slug_conflict_skips_docs(tmp_path: Path, docs_tree: Path):
    """DB 已存在同名 slug 的 publication → 让位 DB，跳过 docs 合成。"""
    out = tmp_path / "content"
    from types import SimpleNamespace
    from uuid import UUID

    # WikiPublication 替身：覆盖 _serialize_publication 读取的全部字段。
    db_pub = SimpleNamespace(
        id=UUID("11111111-1111-4111-8111-111111111111"),
        catalog_id=UUID("44444444-4444-4444-8444-444444444441"),
        app_name="negentropy",
        publish_mode="LIVE",
        name="DB 占用 negentropy",
        slug="negentropy",
        description=None,
        status="published",
        theme="docs",
        version=1,
        published_at=None,
        created_at=None,
        updated_at=None,
    )

    svc = WikiExportService()
    with _patch_docs_cfg(docs_tree):
        with (
            patch(f"{_MOD}.WikiDao.list_publications", new=AsyncMock(return_value=([db_pub], 1))),
            patch(f"{_MOD}.WikiDao.get_entries", new=AsyncMock(return_value=[])),
            patch(f"{_MOD}.WikiDao.get_nav_tree", new=AsyncMock(return_value=[])),
            patch(f"{_MOD}.get_publication_graph", new=AsyncMock(return_value=None)),
        ):
            await svc.export_all_published(db=None, out_dir=out)

    pubs = json.loads((out / "publications.json").read_text())
    # 仅 DB pub（1 个），docs 合成被跳过（未额外注入第二个 negentropy）
    assert [p["slug"] for p in pubs["items"]] == ["negentropy"]
    assert pubs["total"] == 1


@pytest.mark.asyncio
async def test_progress_bounded_and_summary_counts_docs_pack(tmp_path: Path, docs_tree: Path):
    """进度日志按 publication 有界（与 entry 数解耦），且汇总计数含注入的 docs pack。

    回归背景：``wiki_export_done`` 曾用 ``len(pubs)`` 计数，漏掉 L204 追加的合成
    docs publication，导致同一次运行日志报 1 而 CLI 汇总报 2。
    """
    out = tmp_path / "content"
    from types import SimpleNamespace
    from uuid import UUID

    from structlog.testing import capture_logs

    db_pub = SimpleNamespace(
        id=UUID("22222222-2222-4222-8222-222222222222"),
        catalog_id=UUID("44444444-4444-4444-8444-444444444442"),
        app_name="negentropy",
        publish_mode="LIVE",
        name="Wiki",
        slug="wiki",
        description=None,
        status="published",
        theme=None,
        version=1,
        published_at=None,
        created_at=None,
        updated_at=None,
    )
    # 全部 CONTAINER（document_id=None）：只驱动进度循环，不触发内容读取与资产下载。
    entries = [
        SimpleNamespace(
            id=UUID(f"33333333-3333-4333-8333-{i:012d}"),
            document_id=None,
            entry_slug=f"e{i}",
            entry_title=f"E{i}",
            is_index_page=False,
            entry_kind="CONTAINER",
        )
        for i in range(50)
    ]

    svc = WikiExportService()
    with _patch_docs_cfg(docs_tree):
        with (
            patch(f"{_MOD}.WikiDao.list_publications", new=AsyncMock(return_value=([db_pub], 1))),
            patch(f"{_MOD}.WikiDao.get_entries", new=AsyncMock(return_value=entries)),
            patch(f"{_MOD}.WikiDao.get_nav_tree", new=AsyncMock(return_value=[])),
            patch(f"{_MOD}.get_publication_graph", new=AsyncMock(return_value=None)),
            capture_logs() as logs,
        ):
            await svc.export_all_published(db=None, out_dir=out)

    # 50 个 entry → step=5 → 10 条；无论语料多大都不逐条刷屏。
    progress = [r for r in logs if r["event"] == "wiki_export_progress"]
    assert 1 <= len(progress) <= 11, f"进度日志应有界，实际 {len(progress)} 条"
    assert progress[-1]["entries_done"] == len(entries), "末条进度须覆盖最后一个 entry"

    done = next(r for r in logs if r["event"] == "wiki_export_done")
    # DB pub（wiki）+ 合成 docs pack（negentropy）= 2；修复前此处为 len(pubs)=1。
    assert done["publications"] == 2


@pytest.mark.asyncio
async def test_idempotent_across_exports(tmp_path: Path, docs_tree: Path):
    out1, out2 = tmp_path / "c1", tmp_path / "c2"
    with _patch_docs_cfg(docs_tree):
        await _export(out1)
        await _export(out2)
    # 未变 docs → index.json 的 pubs（含确定性 entry_ids）逐字节一致。
    i1 = json.loads((out1 / "index.json").read_text())["pubs"]["negentropy"]
    i2 = json.loads((out2 / "index.json").read_text())["pubs"]["negentropy"]
    assert i1 == i2
