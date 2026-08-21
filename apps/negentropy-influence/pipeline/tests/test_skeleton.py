"""骨架模板、漂移门与 scaffold 的执法。

模板的存在意义是「给复制源头一个名字」。但一份新目录若无人校验，它就是**第 5 份
副本**，净负。所以这里必须钉住三件事：
  1. skeleton.toml 声明的路径在模板里真实存在（清单不能指空）
  2. 模板与基线系列一致（模板不过期）
  3. 漂移门有方向、逃逸表生效、且**能真的报警**（正控——一个不会红的门等于没门）

另注：模板里的 `.tsx` 不被任何 tsconfig 覆盖，因此没有 tsc 检查。这不是漏洞，
而是漂移门保证的性质：模板与真集字节相同 ⟹ 真集的 `tsc --noEmit` 传递性地
验证了模板。门被关掉时会同时失去这层保障——该耦合已写入 skeleton.toml。

**但这条传递性有一个缺口**：它只覆盖受门档位。`theme.ts` 是 **seeded** 档、
不受门，而 frozen 组件对 `theme.serif` / `theme.sans` 有硬依赖——真集的 theme.ts
恰好齐全，模板的 seed 却曾缺这两个键，于是 scaffold 出的新集开箱即 6 个 TS2339
而漂移门照样报 0 处。补口在 `test_template_theme_covers_frozen_component_tokens`：
凡 seeded 档被 frozen 档消费，那个接口必须单独立判据。
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
INFLUENCE = PIPELINE.parent
SCRIPTS = PIPELINE / "scripts"
TEMPLATE = PIPELINE / "templates" / "video-skeleton"
VERIFY = SCRIPTS / "verify_skeleton.py"
SCAFFOLD = SCRIPTS / "scaffold.py"

GATED_CLASSES = ("frozen", "overridable", "regioned", "structured")


def skeleton() -> dict:
    return tomllib.loads((TEMPLATE / "skeleton.toml").read_text(encoding="utf-8"))


def run(script: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(script), *args],
        capture_output=True,
        text=True,
        check=False,
    )


# ── 镜像子项目：正控在副本上做，绝不改真文件 ──────────────────────────────
#
# 正控必须**注入漂移**才能证明门会红，但注入对象一度是受版本控制的**已发布**分集
# 文件（types.ts / package.json），还原只靠 try/finally：pytest 被 Ctrl-C 或进程
# 被杀就会把 `// injected drift` 留在工作树里，两个 workspace 并行跑还会互相踩。
# test_check_series.py 早已给出正解——在 tmp_path 里搭一个带 `.influence-root`
# 哨兵的假子项目再跑脚本。verify_skeleton/scaffold 同样只靠哨兵定位，故照搬即可。


def mirror(tmp_path: Path, *, episodes: list[str], scripts: tuple[str, ...]) -> Path:
    """在 tmp_path 下搭一个最小可跑的子项目副本 → 返回镜像的子项目根。

    只镜像门真正读的东西：哨兵 + series.json + 模板全量 + 受门档位对应的分集文件
    + 指定脚本（含同目录依赖 paths.py）。REPO 由「子项目在 apps/<name>/」派生，
    故这两级目录必须如实搭出来（与 test_check_series 的 INFLUENCE_REL 同理）。
    """
    import shutil

    inf = tmp_path / "apps" / "negentropy-influence"
    (inf / "pipeline" / "scripts").mkdir(parents=True)
    (inf / ".influence-root").write_text("# 假子项目哨兵\n", encoding="utf-8")
    shutil.copytree(TEMPLATE, inf / "pipeline" / "templates" / "video-skeleton")
    for name in (*scripts, "paths.py"):
        shutil.copy2(SCRIPTS / name, inf / "pipeline" / "scripts" / name)

    skel = skeleton()
    gated = [rel for cls in GATED_CLASSES for rel in skel["classes"].get(cls, [])]
    for slug in episodes:
        for rel in gated:
            src = INFLUENCE / "episodes" / slug / rel
            if not src.is_file():
                continue
            dst = inf / "episodes" / slug / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    (inf / "episodes").mkdir(exist_ok=True)
    return inf


def write_series(inf: Path, series: list[tuple[str, list[str]]]) -> None:
    (inf / "series.json").write_text(
        json.dumps(
            {
                "seriesList": [
                    {
                        "id": sid,
                        "title": sid,
                        "rule": "",
                        "episodes": [
                            {"episode": i, "slug": s, "path": f"episodes/{s}"}
                            for i, s in enumerate(slugs, 1)
                        ],
                    }
                    for sid, slugs in series
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def test_declared_paths_exist_in_template():
    """清单不能指空——一条指向不存在文件的 frozen 记录是静默失效的门。"""
    skel = skeleton()
    missing = []
    for cls in GATED_CLASSES:
        for rel in skel["classes"].get(cls, []):
            # .tmpl 后缀的模板文件对应生成物同名去后缀
            if (
                not (TEMPLATE / rel).is_file()
                and not (TEMPLATE / f"{rel}.tmpl").is_file()
            ):
                missing.append(f"{cls}:{rel}")
    assert not missing, f"skeleton.toml 声明了模板中不存在的路径：{missing}"


def test_every_template_file_is_classified():
    """反向：模板里的每个文件都该有档位归属，否则新增文件会悄悄不受门。"""
    skel = skeleton()
    classified = {
        rel
        for cls in (*GATED_CLASSES, "seeded")
        for rel in skel["classes"].get(cls, [])
    }
    template_only = {"skeleton.toml", "scenes-EXAMPLE.tsx.txt"}
    unclassified = []
    for p in TEMPLATE.rglob("*"):
        if not p.is_file() or p.name in template_only or p.name == ".gitkeep":
            continue
        rel = str(p.relative_to(TEMPLATE))
        if rel.endswith(".tmpl"):
            rel = rel[: -len(".tmpl")]
        if rel not in classified:
            unclassified.append(rel)
    assert not unclassified, f"模板文件未归档位（不受任何门约束）：{unclassified}"


def test_drift_entries_reference_real_episodes_and_paths():
    """逃逸表不能指向不存在的集或路径——陈旧豁免会静默放行真实漂移。"""
    skel = skeleton()
    slugs = {p.name for p in (INFLUENCE / "episodes").iterdir() if p.is_dir()}
    for d in skel.get("drift", []):
        assert d["episode"] in slugs, f"drift 指向不存在的集：{d['episode']}"
        assert (INFLUENCE / "episodes" / d["episode"] / d["path"]).is_file(), (
            f"drift 指向不存在的文件：{d['episode']}/{d['path']}"
        )
        assert d.get("reason", "").strip(), (
            f"{d['episode']}/{d['path']} 缺 reason —— 逃逸口必须被记录，"
            "无理由的豁免下一个人无法判断能否撤销"
        )
        # 机制上允许缺 fingerprint（向前兼容），但策略上不允许：不钉指纹的豁免
        # 等于「该文件从此永久免检」，包括与 reason 无关的后续改动。
        assert len(d.get("fingerprint", "")) == 12, (
            f"{d['episode']}/{d['path']} 缺 12 位 fingerprint —— 未钉指纹的豁免"
            "会把该文件此后的任何漂移一并放行；当前值可从 verify_skeleton.py 报告里取"
        )


def test_baseline_series_exists():
    skel = skeleton()
    ids = {
        s["id"]
        for s in json.loads((INFLUENCE / "series.json").read_text(encoding="utf-8"))[
            "seriesList"
        ]
    }
    assert skel["baselineOf"] in ids, (
        f"baselineOf={skel['baselineOf']!r} 不在 series.json"
    )


def test_gate_is_currently_clean():
    """全部既有漂移都已登记 —— 否则门一上线就红，而一上线就红的门会被立刻关掉。"""
    r = run(VERIFY, "--strict")
    assert r.returncode == 0, r.stdout + r.stderr
    assert "未登记漂移 0 处" in r.stdout, r.stdout


#: 正控用的两集：当前对全部受门档位都与模板一致，且在 skeleton.toml 里**无**
#: drift 条目——否则真登记表会把注入的漂移顺手豁免掉，正控自己失效。
CLEAN_A = "claude-code-explained-video"
CLEAN_B = "experience-era-agents-video"


def test_gate_actually_detects_drift(tmp_path):
    """**正控**：制造一处未登记漂移，门必须报出来并在 --strict 下失败。

    一个不会红的门等于没门。本条是这套机制的合法性来源。注入发生在镜像副本上。
    """
    inf = mirror(tmp_path, episodes=[CLEAN_A], scripts=("verify_skeleton.py",))
    write_series(inf, [("solo", [CLEAN_A])])
    verify = inf / "pipeline" / "scripts" / "verify_skeleton.py"
    assert run(verify, "--strict").returncode == 0, "镜像基线本身就不干净"

    victim = inf / "episodes" / CLEAN_A / "video" / "src" / "types.ts"
    victim.write_bytes(victim.read_bytes() + b"\n// positive-control: injected drift\n")
    r = run(verify, "--strict")
    assert r.returncode == 1, f"门未能失败：\n{r.stdout}"
    assert "types.ts" in r.stdout, r.stdout


def test_gate_catches_structured_drift_via_tmpl_fallback(tmp_path):
    """**正控（structured 档）**：模板侧只有 `package.json.tmpl`，fingerprint 曾因此
    返回 None、I2 整段跳过——单集系列连 I1 也无比较对象，package.json 于是完全
    不受门。注入依赖漂移必须被 STALE 抓到（回退读 .tmpl 后模板指纹可得）。
    """
    inf = mirror(tmp_path, episodes=[CLEAN_A], scripts=("verify_skeleton.py",))
    write_series(inf, [("solo", [CLEAN_A])])
    verify = inf / "pipeline" / "scripts" / "verify_skeleton.py"

    victim = inf / "episodes" / CLEAN_A / "video" / "package.json"
    d = json.loads(victim.read_text(encoding="utf-8"))
    d["dependencies"]["react"] = "^18.0.0"  # 依赖漂移 = structured 档的执法对象
    victim.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    r = run(verify, "--strict")
    assert r.returncode == 1, f"structured 漂移未被抓住：\n{r.stdout}"
    assert "package.json" in r.stdout, r.stdout


def register_drift(inf: Path, episode: str, rel: str, fingerprint: str | None) -> None:
    """往镜像的 skeleton.toml 追加一条 `[[drift]]`。"""
    toml = inf / "pipeline" / "templates" / "video-skeleton" / "skeleton.toml"
    pin = f'fingerprint = "{fingerprint}"\n' if fingerprint else ""
    with toml.open("a", encoding="utf-8") as fh:
        fh.write(
            f'\n[[drift]]\nepisode = "{episode}"\npath = "{rel}"\n{pin}'
            'reason = "正控用条目"\n'
        )


def test_registered_drift_is_pinned_to_its_fingerprint(tmp_path):
    """**正控（豁免失效）**：登记表以 (episode, path) 为键，若不钉指纹，该文件此后
    对任何改动都永久免检——而 Main.tsx 恰是每集都要动的文件。指纹相符才放行，
    偏离内容一变必须报 DRIFT-CHANGED 并使 --strict 失败。
    """
    import verify_skeleton as vs

    rel = "video/src/types.ts"
    inf = mirror(tmp_path, episodes=[CLEAN_A, CLEAN_B], scripts=("verify_skeleton.py",))
    write_series(inf, [("pair", [CLEAN_A, CLEAN_B])])
    verify = inf / "pipeline" / "scripts" / "verify_skeleton.py"

    # B 集偏离（A 集仍等于模板，故 I1 有方向、能走到 DRIFT-CHANGED 分支）
    victim = inf / "episodes" / CLEAN_B / rel
    victim.write_bytes(victim.read_bytes() + b"\n// drift v1\n")
    fp_v1 = vs.fingerprint(victim, rel, "frozen")

    register_drift(inf, CLEAN_B, rel, fp_v1)
    assert run(verify, "--strict").returncode == 0, "指纹相符却未放行"

    # 偏离内容再变一次：同一条登记不得继续兜住它
    victim.write_bytes(victim.read_bytes() + b"\n// drift v2\n")
    r = run(verify, "--strict")
    assert r.returncode == 1, f"豁免未随偏离改变而失效：\n{r.stdout}"
    assert "DRIFT-CHANGED" in r.stdout, r.stdout


def test_i2_honours_the_drift_registry(tmp_path):
    """I2 必须与 I1 共用逃逸口：单集系列的 I1 是空条件，若 I2 不查登记表，
    给单集系列登记一条合法偏离后 `--strict` 永远红、登记者无路可走。
    """
    import verify_skeleton as vs

    rel = "video/src/types.ts"
    inf = mirror(tmp_path, episodes=[CLEAN_A], scripts=("verify_skeleton.py",))
    write_series(inf, [("solo", [CLEAN_A])])
    verify = inf / "pipeline" / "scripts" / "verify_skeleton.py"

    victim = inf / "episodes" / CLEAN_A / rel
    victim.write_bytes(victim.read_bytes() + b"\n// legit episode-local deviation\n")
    assert run(verify, "--strict").returncode == 1, "未登记的偏离竟然放行"

    register_drift(inf, CLEAN_A, rel, vs.fingerprint(victim, rel, "frozen"))
    r = run(verify, "--strict")
    assert r.returncode == 0, f"已登记的偏离仍被 STALE 判红：\n{r.stdout}"


def test_i2_honours_the_overridable_class(tmp_path):
    """`overridable` 的覆写许可对 I1 与 I2 必须**同时**有效。

    I2 若不认档位，「全系列都行使许可」就会报 STALE —— 而**单集系列行使一次即是
    全系列**（claude-code-explained 今天就是单集系列，timing.json 恰是文档鼓励
    「改节奏只动 JSON」的那个文件）。于是档位声明的「只报 INFO，不 FAIL」变成
    只在多集系列成立，等于把许可撤回一半，并逼人为一次合法覆写去登记 [[drift]]。
    """
    rel = "video/src/timing.json"
    assert rel in skeleton()["classes"]["overridable"], "档位前提变了，本用例该更新"
    inf = mirror(tmp_path, episodes=[CLEAN_A], scripts=("verify_skeleton.py",))
    write_series(inf, [("solo", [CLEAN_A])])
    verify = inf / "pipeline" / "scripts" / "verify_skeleton.py"
    assert run(verify, "--strict").returncode == 0, "镜像基线本身就不干净"

    victim = inf / "episodes" / CLEAN_A / rel
    timing = json.loads(victim.read_text(encoding="utf-8"))
    timing["sceneGapSec"] = timing["sceneGapSec"] + 0.3  # 行使覆写许可
    victim.write_text(json.dumps(timing), encoding="utf-8")

    r = run(verify, "--strict")
    assert r.returncode == 0, f"行使 overridable 许可却被判红：\n{r.stdout}"
    assert "STALE" not in r.stdout, r.stdout


def test_scaffold_produces_gate_clean_episode(tmp_path):
    """scaffold 出来的新集必须立刻通过冻结档比对（模板即真理）。

    在镜像里 scaffold：真 `episodes/` 下不留探针目录，也不怕并行跑测试互踩。
    """
    import hashlib

    slug = "pytest-probe-video"
    inf = mirror(tmp_path, episodes=[], scripts=("verify_skeleton.py", "scaffold.py"))
    write_series(inf, [("solo", [CLEAN_A])])
    r = run(inf / "pipeline" / "scripts" / "scaffold.py", slug, "--title", "自检")
    assert r.returncode == 0, r.stdout + r.stderr

    dest = inf / "episodes" / slug
    skel = skeleton()
    for rel in skel["classes"]["frozen"]:
        a = hashlib.md5((TEMPLATE / rel).read_bytes()).hexdigest()
        b = hashlib.md5((dest / rel).read_bytes()).hexdigest()
        assert a == b, f"scaffold 产物与模板不一致：{rel}"
    # seeded 档同样经 rglob 整树复制（scaffold 无显式文件清单）——chrome 层
    # motifs.tsx 若被未来改动漏掉，新集将连 Panel 都没有。钉住它。
    # （theme.ts 是 .tmpl 渲染产物，非字节直拷，故不在此列。）
    rel = "video/src/components/motifs.tsx"
    assert (dest / rel).read_bytes() == (TEMPLATE / rel).read_bytes(), (
        f"scaffold 未原样复制 seeded 文件：{rel}"
    )
    # scenes/ 刻意留空；样例只留在模板
    assert not (dest / "scenes-EXAMPLE.tsx.txt").exists()
    assert not any((dest / "video/src/scenes").glob("*.tsx"))
    # Main.tsx 不得带来别集的场景 import —— 否则新集开箱即 module-not-found
    main = (dest / "video/src/Main.tsx").read_text(encoding="utf-8")
    assert "./scenes/" not in main, "模板 Main.tsx 残留了某一集的场景 import"
    # 占位符必须全部渲染
    for rel in ("pipeline.toml", "README.md", "video/package.json"):
        assert "{{" not in (dest / rel).read_text(encoding="utf-8"), rel
    # 未登记到 series.json 的工程会被门点名
    out = run(inf / "pipeline" / "scripts" / "verify_skeleton.py").stdout
    assert slug in out and "未登记到 series.json" in out, out


def test_scaffolded_config_does_not_block_authoring_stages(tmp_path):
    """scaffold 产出的 pipeline.toml 必须通过 config 校验：占位符自身不合规会让
    新集连 `pipeline.py build`（Stage ③，与 TTS 无关）都跑不起来。
    """
    import config

    slug = "pytest-probe-video"
    inf = mirror(tmp_path, episodes=[], scripts=("scaffold.py",))
    assert (
        run(
            inf / "pipeline" / "scripts" / "scaffold.py", slug, "--title", "自检"
        ).returncode
        == 0
    )
    dest = inf / "episodes" / slug
    _cfg, _origin, fails, _warns = config.load(dest, required=True)
    assert not fails, f"scaffold 产物未通过配置校验：{fails}"


def test_scaffold_rejects_bad_slug_and_existing_dir():
    r = run(SCAFFOLD, "no-suffix", "--title", "x")
    assert r.returncode != 0 and "-video" in (r.stdout + r.stderr)
    r = run(SCAFFOLD, "claude-code-explained-video", "--title", "x")
    assert r.returncode != 0 and "已存在" in (r.stdout + r.stderr)


def test_template_readme_qa_commands_are_runnable():
    """模板 README 是每个新集经 scaffold 继承的「复现流水线」正典，qa 命令必须
    与 pipeline.py 的真实参数契约一致——曾整段缺 --video，照抄即 parser.error。
    """
    text = (TEMPLATE / "README.md.tmpl").read_text(encoding="utf-8")
    qa_cmds = re.findall(r"^\s*uv run.*pipeline\.py.*\bqa\b.*$", text, re.MULTILINE)
    assert qa_cmds, "模板 README 里没找到 qa 命令（检测器失效？）"
    for cmd in qa_cmds:
        assert "--video" in cmd, f"qa 命令缺 --video：{cmd}"
        # pipeline.py 以 cwd=<分集工程> 启动 qa_frames，后者 Path(video).resolve()
        # ⇒ 产物路径必须**工程相对**。`$P/out/…` 会被解析成 <工程>/$P/out/… 而落空。
        assert "--video out/" in cmd, f"qa 产物路径应为工程相对（out/…）：{cmd}"
        assert "$P/out/" not in cmd, (
            f"qa 产物路径不可用 $P 锚定（那是直调 qa_frames.py 才对的写法）：{cmd}"
        )


def test_paths_docstring_lists_all_real_importers():
    """paths.py 的「导入边界（承重，勿破）」须与实际导入方一致——契约在落地时
    就与代码矛盾的话，下一位读者会误判新增脚本违规。
    """
    doc = (SCRIPTS / "paths.py").read_text(encoding="utf-8")
    m = re.search(r"## 导入边界.*?`(.*?)`.*?可以 `import paths`", doc, re.DOTALL)
    assert m, "paths.py 导入边界小节形态变化，检测器该更新了"
    import subprocess

    r = subprocess.run(
        ["grep", "-l", r"from paths import", "-r", str(SCRIPTS)],
        capture_output=True,
        text=True,
        check=True,
    )
    real = {Path(p).name for p in r.stdout.split()} - {"paths.py"}
    allowed = set(re.findall(r"`(\w+\.py)`", doc))
    assert real <= allowed, f"实际导入方超出清单：{real - allowed}"
    assert "tts.py" not in real, "红线：tts.py 不可 import paths（拷出路径会断）"


#: 模板组件里读的 theme token。`theme.ts` 属 **seeded** 档、不受漂移门执法，
#: 而 frozen 组件对它有硬依赖——这个 seeded↔frozen 接口是本文件文件头那条
#: 「模板≡真集 ⟹ 真集 tsc 传递性验证模板」推理的**唯一缺口**：真集的 theme.ts
#: 是人写的、恰好齐全，模板的 seed 却可以缺键而无人发现。实测代价是 scaffold
#: 出的新集开箱即 6 个 TS2339（`theme.serif` / `theme.sans` 不存在）。
THEME_TOKEN_RE = re.compile(r"\btheme\.([A-Za-z][A-Za-z0-9]*)")
#: **必须先切出 `theme` 对象字面量再取键**：整文件扫会把同缩进的兄弟导出
#: （曾存在的 `export const font = { serif: … }`）一并算作已定义，于是把这条
#: 判据变成永真——注入正控时实测过一次假通过。
THEME_LITERAL_RE = re.compile(r"export const theme = \{(.*?)\n\} as const;", re.DOTALL)
#: seed 里以注释形式留给本集填的占位（concept/conceptDeep/deny 之类）不算已定义，
#: 但组件也不该引用它们——故只需比对「未注释的键」。
THEME_KEY_RE = re.compile(r"^ {2}([A-Za-z][A-Za-z0-9]*)\s*:", re.MULTILINE)
#: 受检面含 regioned：Main.tsx 同样由 scaffold 原样复制，它读 `theme.bg`。
THEME_CONSUMER_CLASSES = ("frozen", "regioned")


def seed_theme_keys() -> set[str]:
    """→ 模板 theme seed 中**未注释**的键（占位注释不算已定义）。

    供 frozen 消费面与 chrome 层 motifs 两条判据共用：键集合从 tmpl 动态解析，
    seed 将来增删底座键（如并入 danger）时判据零改动跟上。
    """
    seed = (TEMPLATE / "video/src/design/theme.ts.tmpl").read_text(encoding="utf-8")
    body = THEME_LITERAL_RE.search(seed)
    assert body, "seed 里找不到 `export const theme = {…} as const;`（形态变了？）"
    defined = set(THEME_KEY_RE.findall(body.group(1)))
    assert "bg" in defined, "seed 解析失效（键的缩进形态变了？检测器该更新了）"
    return defined


def test_template_theme_covers_frozen_component_tokens():
    """模板 theme.ts 必须覆盖 frozen 组件读到的每个 token（零依赖静态判据）。

    不拉 tsc：这套测试的定位是零基建依赖 / 5 秒跑完。判据贴着真实失效模式——
    「组件读了 seed 里没有的键」——而非贴着类型系统。
    """
    defined = seed_theme_keys()

    skel = skeleton()
    missing: list[str] = []
    gated = [
        rel for cls in THEME_CONSUMER_CLASSES for rel in skel["classes"].get(cls, [])
    ]
    for rel in gated:
        if not rel.endswith((".tsx", ".ts")):
            continue
        text = (TEMPLATE / rel).read_text(encoding="utf-8")
        for token in sorted(set(THEME_TOKEN_RE.findall(text))):
            if token not in defined:
                missing.append(f"{rel} 读了 theme.{token}")
    assert not missing, (
        "frozen 组件依赖的 token 不在模板 theme seed 里 —— scaffold 出的新集会"
        "直接 tsc 失败：\n  " + "\n  ".join(missing)
    )


# ── chrome 层 motifs 播种（seeded 档）──────────────────────────────────────
#
# motifs.tsx 的正交切分：chrome（机械排版/标注，模板播种）vs 母题（创作性，
# 各集复制 ep1 后裁剪）。seeded 档不受漂移门执法，但「模板 seed 只读底座
# token」这条接口性质必须有自己的判据——否则 chrome 层一次「顺手」引用了
# 某集概念色（core/mech/…），scaffold 出的新集就会开箱即 TS2339，且漂移门
# 照样报 0 处（theme.ts 属 seeded、无门）。这是上面那条 seeded↔frozen 缺口
# 的姊妹缺口：seeded↔seeded 同样无门。

#: chrome 层应播种的导出（含一个值导出与一个纯函数）。ep1 的调用面证明了
#: 这七个是跨集机械；清单变动 = 显式决策，须同步 skills/06 母题节首段。
CHROME_EXPORTS = frozenset(
    {"Panel", "Footnote", "SceneTag", "Counter", "CodeCard", "NumberedCard", "ease"}
)
#: 刻意不进模板的创作性母题（ep1 拥有；借用方式=复制后裁剪，见 skills/06 表）。
MOTIF_EXPORTS = frozenset(
    {"Terminal", "LoopRing", "DispatchTable", "GateRouter", "SlotRing", "useRingDot"}
)
MOTIFS_REL = "video/src/components/motifs.tsx"


def motifs_source(*, strip_comments: bool = False) -> str:
    text = (TEMPLATE / MOTIFS_REL).read_text(encoding="utf-8")
    if not strip_comments:
        return text
    #: 文件头注释里合法地写着「theme.ts」「Terminal」等字样——不剥注释的话
    #: token/导出提取会把散文当代码，判据直接误报。剥 `/* */` 与 `//` 两形态。
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    return re.sub(r"//[^\n]*", "", text)


def export_names(text: str) -> set[str]:
    """→ 文件里的具名导出（`export const/type X` 与文件尾 `export {X};` 一并计，
    小写导出如 `ease` 同样要抓——ep1 的惯用形态就是文件尾 re-export）。"""
    names = re.findall(
        r"^export (?:const|type) ([A-Za-z][A-Za-z0-9]*)", text, re.MULTILINE
    )
    names += re.findall(r"^export \{([A-Za-z][A-Za-z0-9]*)\};", text, re.MULTILINE)
    return set(names)


def test_seed_class_lists_motifs_and_file_exists():
    """seeded 档登记了 motifs.tsx 且模板侧真实存在（清单不能指空，同上）。"""
    skel = skeleton()
    assert MOTIFS_REL in skel["classes"]["seeded"], (
        f"{MOTIFS_REL} 应在 [classes].seeded（chrome 层由模板播种）"
    )
    assert (TEMPLATE / MOTIFS_REL).is_file(), f"模板缺 {MOTIFS_REL}"


def test_chrome_motifs_split_is_enforced():
    """模板 motifs.tsx 导出的恰是 chrome 集：七个机械导出在、五个母题不在。

    「多导出」比「少导出」更危险：多出来的若带了概念色依赖（如 ep1 的
    DispatchTable 读 theme.mech），它随 scaffold 复制进新集即 TS2339；少导出
    只是新集少个便利，无破坏。故两侧都钉死，清单变化须改这里的常量。
    """
    exports = export_names(motifs_source(strip_comments=True))
    leaked = exports & MOTIF_EXPORTS
    assert not leaked, f"母题不得进模板（复制 ep1 后裁剪才是正道）：{sorted(leaked)}"
    missing = CHROME_EXPORTS - exports
    assert not missing, f"chrome 层缺导出（调用面见 ep1 各 scenes）：{sorted(missing)}"


def test_chrome_motifs_only_read_base_theme_tokens():
    """chrome 层只读**未注释的**底座 token——概念色经 accent prop 注入。

    判据复用 test_template_theme_covers_frozen_component_tokens 的解析形态
    （seed_theme_keys），但受检面是 seeded↔seeded 接口（motifs ↔ theme.ts.tmpl）。
    """
    defined = seed_theme_keys()
    used = set(THEME_TOKEN_RE.findall(motifs_source(strip_comments=True)))
    missing = sorted(used - defined)
    assert not missing, (
        f"模板 motifs.tsx 读了 seed 未定义的 theme.{missing} —— 概念色须经 "
        "accent prop 注入，否则 scaffold 出的新集开箱即 TS2339"
    )
