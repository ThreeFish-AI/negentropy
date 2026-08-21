"""check_series 五条规则的判定（用 tmp 仓库镜像，不依赖真实剧集状态）。

多系列语义（2026-08 起 series.json 顶层为 seriesList[]）也在此固定：
规则 1 跨系列全局，规则 2/3/4 按系列内判定。
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
SCRIPT = SCRIPTS_DIR / "check_series.py"
#: paths.py 是 check_series 的同目录依赖（子项目根锚点），镜像时必须一起搬
PATHS_MOD = SCRIPTS_DIR / "paths.py"
#: 子项目在假仓库中的位置。check_series 靠 .influence-root 哨兵定位它，
#: 而 REPO 由「子项目位于 apps/<name>/」派生——故这两级目录必须如实搭出来。
INFLUENCE_REL = "apps/negentropy-influence"

EP1 = {
    "episode": 1,
    "slug": "ep-a",
    "path": "episodes/ep-a",
    "title": "甲集标题",
    "accents": ["#F5C542"],
    "paper": {},
}
EP2 = {
    "episode": 2,
    "slug": "ep-b",
    "path": "episodes/ep-b",
    "title": "乙集标题",
    "accents": ["#4A9EFF"],
    "paper": {},
}
#: 另一个系列的第 1 集——用于验证「各系列各自都有第 1 集」不误报
OTHER1 = {
    "episode": 1,
    "slug": "ep-x",
    "path": "episodes/ep-x",
    "title": "丙集标题",
    "accents": ["#D97757"],
    "paper": {},
}


def S(sid: str, *eps: dict) -> dict:
    return {"id": sid, "title": sid, "rule": "", "episodes": list(eps)}


def ep_root(repo: Path, ep: dict) -> Path:
    """分集工程根。ep["path"] 是**子项目相对**，勿直接拼在 repo 上。"""
    return repo / INFLUENCE_REL / ep["path"]


def build_repo(tmp_path: Path, series_list: list[dict], files: dict[str, str]) -> Path:
    repo = tmp_path / "repo"
    influence = repo / INFLUENCE_REL
    (influence / "pipeline" / "scripts").mkdir(parents=True)
    (influence / ".influence-root").write_text("# 假仓库哨兵\n", encoding="utf-8")
    for series in series_list:
        for ep in series["episodes"]:
            # path 是**子项目相对**（与真 series.json 同义）
            root = influence / ep["path"]
            # exist_ok：重复 slug/path 的负例用例会两次落到同一目录
            (root / "script").mkdir(parents=True, exist_ok=True)
            (root / "script" / "narration.md").write_text(
                "## P0\n\n- [p0-01] 独立成片。\n", encoding="utf-8"
            )
            (root / "README.md").write_text(f"# {ep['title']}\n", encoding="utf-8")
            theme = root / "video/src/design/theme.ts"
            theme.parent.mkdir(parents=True, exist_ok=True)
            # 只落第一个 accent：让「清单多出的色」可被规则 4 抓到
            theme.write_text(
                f"export const theme = {{\n  x0: '{ep['accents'][0]}',\n}} as const;\n",
                encoding="utf-8",
            )
    (influence / "series.json").write_text(
        json.dumps({"seriesList": series_list}, ensure_ascii=False),
        encoding="utf-8",
    )
    # 注意与 path 的不对称：files 的键是**仓库相对**，这样同一个 helper 既能落
    # 受检文件（子项目内，被相对 glob 命中）也能落不受检文件（如 docs/other.md）。
    for rel, content in files.items():
        dest = repo / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")
    return repo


def run_check(repo: Path) -> tuple[int, str]:
    # check_series 靠 .influence-root 哨兵定位子项目根，再由「apps/<name>」派生仓库根；
    # 把脚本链路（含同目录依赖 paths.py）整体搬进 tmp 仓库镜像
    mirror_dir = repo / INFLUENCE_REL / "pipeline" / "scripts"
    mirror = mirror_dir / "check_series.py"
    mirror.write_bytes(Path(SCRIPT).read_bytes())
    (mirror_dir / "paths.py").write_bytes(Path(PATHS_MOD).read_bytes())
    r = subprocess.run(
        [sys.executable, str(mirror)],
        capture_output=True,
        text=True,
        check=False,
        cwd=repo,
    )
    return r.returncode, r.stdout + r.stderr


def test_clean_repo_passes(tmp_path):
    repo = build_repo(tmp_path, [S("t", EP1, EP2)], {"docs/other.md": "无关内容\n"})
    rc, out = run_check(repo)
    assert rc == 0, out


def test_spoken_other_title_fails(tmp_path):
    repo = build_repo(tmp_path, [S("t", EP1, EP2)], {})
    (ep_root(repo, EP1) / "script/narration.md").write_text(
        "## P0\n\n- [p0-02] 上期我们讲过《乙集标题》。\n", encoding="utf-8"
    )
    rc, out = run_check(repo)
    assert rc == 1 and "规则1" in out and "乙集标题" in out


def test_spoken_own_title_passes(tmp_path):
    repo = build_repo(tmp_path, [S("t", EP1, EP2)], {})
    (ep_root(repo, EP1) / "script/narration.md").write_text(
        f"## P0\n\n- [p0-02] 欢迎来到《{EP1['title']}》。\n- [p0-03] 我们下期再见。\n",
        encoding="utf-8",
    )
    rc, out = run_check(repo)
    assert rc == 0, out  # 自身标题 + 「下期」白名单


def test_title_order_inverted_fails(tmp_path):
    # 中性位置（非本集工程内）出现 ≥2 集标题时按首现位置判序——knowledge-map/CHANGELOG 场景
    files = {
        "apps/negentropy-influence/notes.md": "先提《乙集标题》再提《甲集标题》，顺序倒置。\n"
    }
    repo = build_repo(tmp_path, [S("t", EP1, EP2)], files)
    rc, out = run_check(repo)
    assert rc == 1 and "规则2" in out


def test_ordinal_binding_fails(tmp_path):
    files = {"apps/negentropy-influence/notes.md": "第一集是《乙集标题》。\n"}
    repo = build_repo(tmp_path, [S("t", EP1, EP2)], files)
    rc, out = run_check(repo)
    assert rc == 1 and "规则3" in out


def test_dead_link_fails(tmp_path):
    files = {
        "apps/negentropy-influence/episodes/ep-a/README.md": "# 甲集标题\n[已删除](../../video-package/README.md)\n"
    }
    repo = build_repo(tmp_path, [S("t", EP1, EP2)], files)
    rc, out = run_check(repo)
    assert rc == 1 and "规则5" in out and "video-package" in out


def test_accent_not_in_theme_fails(tmp_path):
    bad = {**EP1, "accents": ["#F5C542", "#123456"]}
    repo = build_repo(tmp_path, [S("t", bad, EP2)], {})
    rc, out = run_check(repo)
    assert rc == 1 and "#123456" in out


# ---------------------------------------------------------------- 多系列语义


def test_two_series_each_numbered_from_one_passes(tmp_path):
    """规则 4 的 1..N 连续性按系列内判定——两个系列各自都有第 1 集是合法的。"""
    repo = build_repo(tmp_path, [S("alpha", EP1, EP2), S("beta", OTHER1)], {})
    rc, out = run_check(repo)
    assert rc == 0, out


def test_cross_series_title_order_not_compared(tmp_path):
    """规则 2 只在系列内比顺序：先提 beta 首集再提 alpha 首集不构成倒置。"""
    files = {
        "apps/negentropy-influence/notes.md": "先提《丙集标题》，再提《甲集标题》。\n"
    }
    repo = build_repo(tmp_path, [S("alpha", EP1, EP2), S("beta", OTHER1)], files)
    rc, out = run_check(repo)
    assert rc == 0, out


def test_cross_series_spoken_title_fails(tmp_path):
    """规则 1 跨系列全局：beta 的口播提到 alpha 的片名仍然 FAIL。"""
    repo = build_repo(tmp_path, [S("alpha", EP1, EP2), S("beta", OTHER1)], {})
    (ep_root(repo, OTHER1) / "script/narration.md").write_text(
        "## P0\n\n- [p0-02] 这和《甲集标题》讲的是一回事。\n", encoding="utf-8"
    )
    rc, out = run_check(repo)
    assert rc == 1 and "规则1" in out and "甲集标题" in out


def test_ordinal_binding_matches_own_series_episode(tmp_path):
    """规则 3 判据是「标题 → 它自己的序号」：beta 首集旁写第一集合法。"""
    files = {"apps/negentropy-influence/notes.md": "第一集是《丙集标题》。\n"}
    repo = build_repo(tmp_path, [S("alpha", EP1, EP2), S("beta", OTHER1)], files)
    rc, out = run_check(repo)
    assert rc == 0, out


def test_duplicate_slug_across_series_fails(tmp_path):
    """slug 是工程目录名，跨系列也必须唯一（否则两系列指向同一工程）。"""
    dup = {**OTHER1, "slug": EP1["slug"], "path": EP1["path"], "title": "丁集标题"}
    repo = build_repo(tmp_path, [S("alpha", EP1), S("beta", dup)], {})
    rc, out = run_check(repo)
    assert rc == 1 and "规则4" in out and "重复" in out


def test_series_without_episodes_exits(tmp_path):
    repo = build_repo(tmp_path, [S("alpha", EP1)], {})
    (repo / INFLUENCE_REL / "series.json").write_text(
        json.dumps({"seriesList": [{"id": "empty", "episodes": []}]}),
        encoding="utf-8",
    )
    rc, out = run_check(repo)
    assert rc != 0 and "无 episodes" in out
