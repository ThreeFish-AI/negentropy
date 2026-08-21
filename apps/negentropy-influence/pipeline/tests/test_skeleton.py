"""骨架模板、漂移门与 scaffold 的执法。

模板的存在意义是「给复制源头一个名字」。但一份新目录若无人校验，它就是**第 5 份
副本**，净负。所以这里必须钉住三件事：
  1. skeleton.toml 声明的路径在模板里真实存在（清单不能指空）
  2. 模板与基线系列一致（模板不过期）
  3. 漂移门有方向、逃逸表生效、且**能真的报警**（正控——一个不会红的门等于没门）

另注：模板里的 `.tsx` 不被任何 tsconfig 覆盖，因此没有 tsc 检查。这不是漏洞，
而是漂移门保证的性质：模板与真集字节相同 ⟹ 真集的 `tsc --noEmit` 传递性地
验证了模板。门被关掉时会同时失去这层保障——该耦合已写入 skeleton.toml。
"""

from __future__ import annotations

import json
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


def test_gate_actually_detects_drift(tmp_path):
    """**正控**：制造一处未登记漂移，门必须报出来并在 --strict 下失败。

    一个不会红的门等于没门。本条是这套机制的合法性来源。
    """
    victim = (
        INFLUENCE
        / "episodes"
        / "claude-code-explained-video"
        / "video"
        / "src"
        / "types.ts"
    )
    saved = victim.read_bytes()
    victim.write_bytes(saved + b"\n// positive-control: injected drift\n")
    try:
        r = run(VERIFY, "--strict")
        assert r.returncode == 1, f"门未能失败：\n{r.stdout}"
        assert "types.ts" in r.stdout, r.stdout
    finally:
        victim.write_bytes(saved)
    # 还原后必须转绿
    assert run(VERIFY, "--strict").returncode == 0


def test_gate_catches_structured_drift_via_tmpl_fallback():
    """**正控（structured 档）**：模板侧只有 `package.json.tmpl`，fingerprint 曾因此
    返回 None、I2 整段跳过——单集系列连 I1 也无比较对象，package.json 于是完全
    不受门。注入依赖漂移必须被 STALE 抓到（回退读 .tmpl 后模板指纹可得）。
    """
    import json

    victim = (
        INFLUENCE
        / "episodes"
        / "claude-code-explained-video"
        / "video"
        / "package.json"
    )
    saved = victim.read_bytes()
    d = json.loads(saved)
    d["dependencies"]["react"] = "^18.0.0"  # 依赖漂移 = structured 档的执法对象
    victim.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        r = run(VERIFY, "--strict")
        assert r.returncode == 1, f"structured 漂移未被抓住：\n{r.stdout}"
        assert "package.json" in r.stdout, r.stdout
    finally:
        victim.write_bytes(saved)
    assert run(VERIFY, "--strict").returncode == 0


def test_scaffold_produces_gate_clean_episode(tmp_path, monkeypatch):
    """scaffold 出来的新集必须立刻通过冻结档比对（模板即真理）。"""
    slug = "pytest-probe-video"
    dest = INFLUENCE / "episodes" / slug
    assert not dest.exists(), f"残留目录，请先清理：{dest}"
    r = run(SCAFFOLD, slug, "--title", "自检", "--ref-sha1", "0123456789ab")
    assert r.returncode == 0, r.stdout + r.stderr
    try:
        skel = skeleton()
        import hashlib

        for rel in skel["classes"]["frozen"]:
            a = hashlib.md5((TEMPLATE / rel).read_bytes()).hexdigest()
            b = hashlib.md5((dest / rel).read_bytes()).hexdigest()
            assert a == b, f"scaffold 产物与模板不一致：{rel}"
        # scenes/ 刻意留空；样例只留在模板
        assert not (dest / "scenes-EXAMPLE.tsx.txt").exists()
        assert not any((dest / "video/src/scenes").glob("*.tsx"))
        # 占位符必须全部渲染
        for rel in ("pipeline.toml", "README.md", "video/package.json"):
            assert "{{" not in (dest / rel).read_text(encoding="utf-8"), rel
        # 未登记到 series.json 的工程会被门点名
        out = run(VERIFY).stdout
        assert slug in out and "未登记到 series.json" in out, out
    finally:
        import shutil

        shutil.rmtree(dest, ignore_errors=True)


def test_scaffold_rejects_bad_slug_and_existing_dir():
    r = run(SCAFFOLD, "no-suffix", "--title", "x")
    assert r.returncode != 0 and "-video" in (r.stdout + r.stderr)
    r = run(SCAFFOLD, "claude-code-explained-video", "--title", "x")
    assert r.returncode != 0 and "已存在" in (r.stdout + r.stderr)


def test_template_readme_qa_commands_are_runnable():
    """模板 README 是每个新集经 scaffold 继承的「复现流水线」正典，qa 命令必须
    与 pipeline.py 的真实参数契约一致——曾整段缺 --video，照抄即 parser.error。
    """
    import re

    text = (TEMPLATE / "README.md.tmpl").read_text(encoding="utf-8")
    qa_cmds = re.findall(r"^\s*uv run.*pipeline\.py.*\bqa\b.*$", text, re.MULTILINE)
    assert qa_cmds, "模板 README 里没找到 qa 命令（检测器失效？）"
    for cmd in qa_cmds:
        assert "--video" in cmd, f"qa 命令缺 --video：{cmd}"
        assert "$P/out/" in cmd, f"qa 命令的产物路径未用 $P 锚定：{cmd}"


def test_paths_docstring_lists_all_real_importers():
    """paths.py 的「导入边界（承重，勿破）」须与实际导入方一致——契约在落地时
    就与代码矛盾的话，下一位读者会误判新增脚本违规。
    """
    import re

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
