"""check_series 六条规则的判定（用 tmp 仓库镜像，不依赖真实剧集状态）。

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


def main_tsx(*scenes: str) -> str:
    """按真 Main.tsx（regioned 档）的两处可变区域生成镜像。

    形状锚定真实的 `Record<string, React.FC<{scene: SceneRange}>>` 注解——
    泛型注解自带花括号，是规则 6 注册表解析的已知锚点坑（见其
    SCENE_REGISTRY_BODY_RE 注释），此处必须如实复刻，否则测不到那条路径。
    """
    imports = "\n".join(f"import {{{s}}} from './scenes/{s}';" for s in scenes)
    entries = "\n".join(f"  P{i}: {s}," for i, s in enumerate(scenes))
    return (
        f"{imports}\n"
        "const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {\n"
        f"{entries}\n"
        "};\n"
    )


def scene_file(name: str) -> str:
    """最小场景组件——规则 6 只看存在性与注册对齐，不读内容。"""
    return f"export const {name} = () => null;\n"


def build_repo(
    tmp_path: Path,
    series_list: list[dict],
    files: dict[str, str],
    scene_names: dict[str, tuple[str, ...]] | None = None,
) -> Path:
    """搭建镜像仓库。

    scene_names：slug → 场景组件名元组；值 `None` 表示该集**完全无场景层**
    （连 storyboard 也不落——脚手架期形态），`()` 表示落 storyboard 但场景为空。
    缺省对每集落 P0Hook/P1Ending 并配齐 storyboard / Main.tsx / scenes/——
    与真树的「已上线集」同构，规则 6 静默。负例用例覆盖个别 slug 构造违规形态。
    """
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
            scenes = (scene_names or {}).get(ep["slug"], ("P0Hook", "P1Ending"))
            if scenes is not None:
                # storyboard + Main.tsx + scenes/ 三件齐 = 规则 6 的执法前提
                (root / "script" / "storyboard.md").write_text(
                    "## P0\n\n- 开场\n", encoding="utf-8"
                )
                src = root / "video/src"
                (src / "scenes").mkdir(parents=True, exist_ok=True)
                (src / "Main.tsx").write_text(main_tsx(*scenes), encoding="utf-8")
                for s in scenes:
                    (src / "scenes" / f"{s}.tsx").write_text(
                        scene_file(s), encoding="utf-8"
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


# ---------------------------------------------------------------- 反向登记（规则 4 反向）
#
# scaffold 刻意不写 series.json（登记是内容决策），漏登因此是高概率人祸——
# 旧门只遍历 series.json 对孤儿目录**结构性失明**。判据按 narration.md 是否
# 落盘分级（死锁分析见 check_series.rule_manifest_integrity）。


def test_orphan_with_narration_fails(tmp_path):
    """narration.md 已落盘的未登记目录必须 FAIL：规则 1 的反串线扫描看不见它。"""
    repo = build_repo(tmp_path, [S("t", EP1)], {})
    orphan = repo / INFLUENCE_REL / "episodes" / "orphan-video"
    (orphan / "script").mkdir(parents=True)
    (orphan / "script" / "narration.md").write_text(
        "## P0\n\n- [p0-01] 独立成片。\n", encoding="utf-8"
    )
    rc, out = run_check(repo)
    assert rc == 1 and "规则4" in out and "orphan-video" in out
    assert "已有 narration.md" in out


def test_orphan_scaffold_warns_not_fails(tmp_path):
    """脚手架期（无 narration.md）只 WARN：一概 FAIL 会与规则 4 的 accents
    校验前后夹死 scaffold→登记窗口（死锁注释的机器化复述）。"""
    repo = build_repo(tmp_path, [S("t", EP1)], {})
    orphan = repo / INFLUENCE_REL / "episodes" / "orphan-video"
    (orphan / "script").mkdir(parents=True)  # 只有空 script/，narration 未落盘
    rc, out = run_check(repo)
    assert rc == 0 and "WARN 规则4" in out and "orphan-video" in out
    assert "转 FAIL" in out


def test_registered_episode_no_orphan_message(tmp_path):
    """已登记集不触发反向登记消息（默认 fixture 即此形态，显式锁死）。"""
    repo = build_repo(tmp_path, [S("t", EP1, EP2)], {})
    rc, out = run_check(repo)
    assert rc == 0 and "未登记到 series.json" not in out


# ---------------------------------------------------------------- 撞色（规则 4 系列内）


def test_same_hex_within_series_fails(tmp_path):
    """系列内两集共用同一 accent 是视觉契约违规（skills/06「已用色错开」）。"""
    clash = {**EP2, "accents": [EP1["accents"][0]]}
    repo = build_repo(tmp_path, [S("t", EP1, clash)], {})
    rc, out = run_check(repo)
    assert rc == 1 and "规则4" in out and "撞色" in out and EP1["accents"][0] in out
    assert "ep-a" in out and "ep-b" in out


def test_same_hex_across_series_passes(tmp_path):
    """跨系列撞色是接受态：两系列发布顺序与视觉契约各自独立（docstring 已固定）。"""
    clash = {**OTHER1, "accents": [EP1["accents"][0]]}
    repo = build_repo(tmp_path, [S("alpha", EP1), S("beta", clash)], {})
    rc, out = run_check(repo)
    assert rc == 0 and "撞色" not in out


def test_occupied_hex_info_line_present(tmp_path):
    """每系列刷一行已用色登记（skills/06 登记表的机器化输出）。"""
    repo = build_repo(tmp_path, [S("t", EP1, EP2)], {})
    rc, out = run_check(repo)
    assert rc == 0 and "INFO 规则4：t 已用色" in out
    assert EP1["accents"][0] in out and EP2["accents"][0] in out


# ---------------------------------------------------------------- 可渲染性（规则 6）


def test_storyboard_with_empty_scenes_fails(tmp_path):
    """storyboard 定稿后 scenes/ 仍空：口播已定、画面未写，规则 6 第一判据。"""
    repo = build_repo(tmp_path, [S("t", EP1)], {}, scene_names={EP1["slug"]: ()})
    rc, out = run_check(repo)
    assert rc == 1 and "规则6" in out and EP1["slug"] in out and "为空" in out


def test_registry_entry_without_scene_file_fails(tmp_path):
    """注册表条目指向不存在的场景文件——tsc/build 必炸的形态。

    必须保留一个在档场景文件（P1Ending）使「scenes/ 为空」判据先行放行，
    才能测到「注册 → import → 文件」这条链路本身。"""
    repo = build_repo(tmp_path, [S("t", EP1)], {})
    # 删掉注册表里的 P0Hook 的实体文件：注册与 import 都在，文件没了
    (ep_root(repo, EP1) / "video/src/scenes/P0Hook.tsx").unlink()
    rc, out = run_check(repo)
    assert rc == 1 and "规则6" in out and "P0Hook" in out


def test_registry_entry_without_import_fails(tmp_path):
    """注册表值无对应 import（标识符未定义）——与文件缺失同为渲染必炸形态。"""
    repo = build_repo(tmp_path, [S("t", EP1)], {})
    src = ep_root(repo, EP1) / "video/src"
    # 注册表保留 P0: P0Hook，但抹掉它的 import 行
    main = (src / "Main.tsx").read_text(encoding="utf-8")
    (src / "Main.tsx").write_text(
        main.replace("import {P0Hook} from './scenes/P0Hook';\n", ""),
        encoding="utf-8",
    )
    rc, out = run_check(repo)
    assert rc == 1 and "规则6" in out and "P0Hook" in out and "import" in out


def test_scene_file_not_registered_warns(tmp_path):
    """场景文件未进注册表只 WARN：可能是被其他场景 import 的合法辅助组件。"""
    repo = build_repo(
        tmp_path, [S("t", EP1)], {}, scene_names={EP1["slug"]: ("P0Hook",)}
    )
    (ep_root(repo, EP1) / "video/src/scenes/HelperCard.tsx").write_text(
        scene_file("HelperCard"), encoding="utf-8"
    )
    rc, out = run_check(repo)
    assert rc == 0 and "WARN 规则6" in out and "HelperCard" in out


def test_no_storyboard_rule6_silent(tmp_path):
    """storyboard 未落盘（阶段②完成前）是合法脚手架期，规则 6 整体不执法。"""
    repo = build_repo(tmp_path, [S("t", EP1)], {}, scene_names={EP1["slug"]: None})
    rc, out = run_check(repo)
    assert rc == 0 and "规则6" not in out
