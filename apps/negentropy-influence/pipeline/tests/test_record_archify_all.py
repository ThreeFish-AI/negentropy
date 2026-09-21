"""record_archify_all 的跳过资格判据：产物在 ≠ 产物可信（stale_reason）。"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

pytest.importorskip("playwright")  # record_archify 模块级依赖，缺则跳过整个文件

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE / "scripts"))

import record_archify_all as raa  # noqa: E402


def _scene(
    tmp_path: Path,
    views_ids: list[str],
    sidecar_ids: list[str],
    newer_product: bool = False,
) -> tuple[Path, Path, list[Path]]:
    """搭一个 (sidecar, views, products) 现场，落盘顺序复刻真实录制（sidecar 恒最后）。"""
    d = tmp_path / "a"
    d.mkdir()
    products: list[Path] = []
    for cid in sidecar_ids:
        for name in (f"a--{cid}.mp4", f"a--{cid}-end.png"):
            (d / name).write_bytes(b"x")
            products.append(d / name)
    sidecar = d / "a.json"
    sidecar.write_text(
        json.dumps(
            {
                "slug": "a",
                "chapters": [
                    {"id": c, "file": f"a--{c}.mp4", "end_still": f"a--{c}-end.png"}
                    for c in sidecar_ids
                ],
            }
        ),
        encoding="utf-8",
    )
    views = d / "a.views.json"
    views.write_text(json.dumps([{"id": c} for c in views_ids]), encoding="utf-8")
    if newer_product:
        # 半程重录：第 1 章已被新一轮覆盖（mtime 新于 sidecar），其余仍是旧素材
        products[0].write_bytes(b"new-session")
    return sidecar, views, products


def test_clean_products_are_trustworthy(tmp_path):
    sidecar, views, products = _scene(tmp_path, ["c1", "c2"], ["c1", "c2"])
    assert raa.stale_reason(sidecar, views, products) == ""


def test_product_newer_than_sidecar_means_interrupted_rerecord(tmp_path):
    sidecar, views, products = _scene(
        tmp_path, ["c1", "c2"], ["c1", "c2"], newer_product=True
    )
    assert "新于 sidecar" in raa.stale_reason(sidecar, views, products)


def test_views_chapter_drift_beats_stale_sidecar_list(tmp_path):
    # 旧清单的产物全在（存在性判据会误判已齐），但 views 已换章：c2 → c3
    sidecar, views, products = _scene(tmp_path, ["c1", "c3"], ["c1", "c2"])
    reason = raa.stale_reason(sidecar, views, products)
    assert "章节集不一致" in reason and "c2" in reason and "c3" in reason


def test_unreadable_sidecar_defers_to_expected_products(tmp_path):
    sidecar, views, products = _scene(tmp_path, ["c1"], ["c1"])
    sidecar.write_text("{broken", encoding="utf-8")
    assert raa.stale_reason(sidecar, views, products) == ""
