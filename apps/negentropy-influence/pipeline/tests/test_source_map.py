"""系列信源地图（source-map/*.toml）的存在执照——结构不变量，全程无网络。

地图是 章→集归属 与 双钉 的唯一事实源（各集 notes 只链接不重述），故它的
**自身一致性**必须独立执法：本文件只读 TOML/JSON 断言结构，不碰网络、
不碰台账（台账一致性归 test_source_ledger.py 的 audit 用例）。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import source_ledger as sl

INFLUENCE = Path(__file__).resolve().parents[2]
SOURCE_MAP_DIR = INFLUENCE / "source-map"

SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def load_series() -> dict[str, list[int]]:
    """→ {seriesId: [episode, …]}，集号顺序即清单顺序。"""
    data = json.loads((INFLUENCE / "series.json").read_text(encoding="utf-8"))
    return {s["id"]: [e["episode"] for e in s["episodes"]] for s in data["seriesList"]}


def maps() -> list[Path]:
    return sorted(SOURCE_MAP_DIR.glob("*.toml"))


def test_source_map_dir_has_at_least_one_map():
    assert maps(), f"{SOURCE_MAP_DIR} 无任何 .toml 地图"


def test_map_stem_is_registered_series_id():
    """文件名 stem 必须是 series.json 里的 seriesId——地图与清单一一配对。"""
    known = load_series()
    for m in maps():
        assert m.stem in known, f"{m.name}: stem 不是 series.json 的 seriesId"


def test_map_pins_are_40_hex_and_unique():
    for m in maps():
        smap = sl.load_source_map(m)
        refs = [p["ref"] for p in smap["pin"]]
        assert refs and len(refs) == len(set(refs)), f"{m.name}: pin ref 重复"
        for r in refs:
            assert SHA_RE.match(r), f"{m.name}: pin ref {r} 非 40 位十六进制 commit"


def test_map_pins_cover_registered_series_episodes():
    """清单里**已登记**的每一集都必须有钉；地图允许超前登记未脚手架的集（战役期
    地图先于 series.json 落地是正常次序），反向（登记了却没钉）才是漏钉事故。"""
    for m in maps():
        eps = set(load_series()[m.stem])
        smap = sl.load_source_map(m)
        covered = {ep for p in smap["pin"] for ep in p["episodes"]}
        missing = eps - covered
        assert not missing, f"{m.name}: 清单集号 {sorted(missing)} 无钉覆盖"
        # 一集只许落在一个钉里（双钉的「双」指两轨各钉一处，不是一集两钉）
        seen: dict[int, str] = {}
        for p in smap["pin"]:
            for ep in p["episodes"]:
                assert seen.setdefault(ep, p["ref"]) == p["ref"], (
                    f"{m.name}: episode {ep} 被 {seen[ep][:8]} 与 {p['ref'][:8]} 双钉"
                )


def test_map_chapter_ids_and_slugs_unique():
    for m in maps():
        smap = sl.load_source_map(m)
        ids = [c["id"] for c in smap["chapter"]]
        slugs = [c["slug"] for c in smap["chapter"]]
        assert len(ids) == len(set(ids)), f"{m.name}: chapter id 重复"
        assert len(slugs) == len(set(slugs)), f"{m.name}: chapter slug 重复"


def test_map_chapter_episodes_within_pin_coverage():
    """章的 episode 必须落在某钉的覆盖内——钉外之章会让 sync 当场退出（_pin_for 找不到钉）。"""
    for m in maps():
        smap = sl.load_source_map(m)
        covered = {ep for p in smap["pin"] for ep in p["episodes"]}
        for c in smap["chapter"]:
            assert c["episode"] in covered, (
                f"{m.name}: 章 {c['slug']} 的 episode {c['episode']} 不在任何钉的"
                f" episodes {sorted(covered)} 内"
            )


def test_map_every_pinned_episode_covered_by_chapter():
    """每个被钉覆盖的集至少有一章归属——空集会让 sync --episode N 直接退出。"""
    for m in maps():
        smap = sl.load_source_map(m)
        covered = {ep for p in smap["pin"] for ep in p["episodes"]}
        chapters = {c["episode"] for c in smap["chapter"]}
        missing = covered - chapters
        assert not missing, f"{m.name}: 集号 {sorted(missing)} 有钉却无任何章节归属"


def test_map_derived_ledger_names_globally_unique():
    """全地图派生条目名唯一——跨集 slug 撞名会让两集台账互踩（sync 无法区分归属）。"""
    for m in maps():
        smap = sl.load_source_map(m)
        names: list[str] = []
        for episode in sorted({c["episode"] for c in smap["chapter"]}):
            names += list(sl.derived_entries(smap, episode))
        dup = {n for n in names if names.count(n) > 1}
        assert not dup, f"{m.name}: 派生条目名跨集撞名 {sorted(dup)}"


def test_map_site_paths_nonempty_or_note_present():
    """sitePaths 空的章必须有 note 说明（如「仅仓库轨、站点无此页」）——防静默缺 site 条目。"""
    for m in maps():
        smap = sl.load_source_map(m)
        for c in smap["chapter"]:
            if not c.get("sitePaths"):
                assert c.get("note"), (
                    f"{m.name}: 章 {c['slug']} 无 sitePaths 也无 note——缺哪条轨？"
                )


def test_map_has_human_counterpart_md():
    """机器/人读配对纪律：每个 .toml 地图须有同名 .md（series.json/series.md 同款）。"""
    for m in maps():
        assert m.with_suffix(".md").is_file(), f"{m.name} 缺人读版 {m.stem}.md"


# ---------------------------------------------------------------- 归档的许可声明


def archive_dirs() -> list[Path]:
    """→ 全部 `research/source-archive/` 目录（有归档的集才有）。"""
    return sorted(p for p in INFLUENCE.glob("episodes/*/research/source-archive"))


def test_every_source_archive_carries_upstream_license():
    """归档即分发：上游整文件级副本必须附带许可与版权声明（skills/01 §多章批量取证 4）。

    判据落在**存在性**而非内容：许可文本因上游而异，能机器判定的是「建了归档却
    没放声明」这一形态——而它恰是最容易漏的（归档由 sync 之外的手工步骤产生，
    脚手架不会替你补）。声明必须按集落地，因为各集工程目录是可单独取出的交付单位。
    """
    missing: list[str] = []
    for d in archive_dirs():
        rel = d.relative_to(INFLUENCE)
        for name in ("LICENSE", "README.md"):
            if not (d / name).is_file():
                missing.append(f"{rel}/{name}")
    assert not missing, (
        "source-archive 缺许可/出处声明（MIT 等许可要求副本附带声明，"
        "且须随集落地）：\n  " + "\n  ".join(missing)
    )


def test_source_archive_license_is_nonempty_text():
    """空文件占位不算声明——「有个文件」与「有声明」必须不可混淆。"""
    for d in archive_dirs():
        lic = d / "LICENSE"
        if not lic.is_file():
            continue  # 缺失由上一条点名，此处不重复报
        text = lic.read_text(encoding="utf-8").strip()
        assert len(text) > 200, f"{lic.relative_to(INFLUENCE)} 内容过短，疑为占位"
        assert "Copyright" in text, (
            f"{lic.relative_to(INFLUENCE)} 无 Copyright 行——版权声明是许可要求的一半"
        )
