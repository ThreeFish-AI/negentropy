#!/usr/bin/env python3
"""骨架漂移门——把 skills/06 的纸面义务变成秒级机器判据。

此前「A 档改任何一处须同步并验 md5 唯一」是散文规范，**从未被执行过一次**：
实测 Main.tsx 有注释/换行漂移（两旧集落后于两新集）、cards.tsx 裂成 3-vs-1，
都是在无人察觉中发生的。

两条不变量（依据 skills/06 的「义务限于同一系列内」）：
  I1 系列内一致：同一 series 的各集，frozen 文件哈希必须唯一
  I2 模板不过期：baselineOf 指定的系列必须与 templates/video-skeleton 一致
      —— 单集系列的 I1 是空条件（无比较对象），故 I2 不可省

两者**共用同一个逃逸口**（skeleton.toml 的 `[[drift]]`，见 exempt()）：语义不一致
会让单集系列拿不到文档承诺的豁免（I1 放行、I2 仍红，登记者无路可走）。豁免按
指纹钉住，偏离内容一变即报 DRIFT-CHANGED——否则「登记一次、永久免检」。

本档**只报告不阻塞**（退出码恒 0，除非 --strict）：转阻塞前须先把既有漂移登记
或收敛，否则第一次运行就红，而一个「一上线就红」的门只会被立刻关掉。

用法：
  uv run --no-project $R/verify_skeleton.py            # 报告
  uv run --no-project $R/verify_skeleton.py --strict    # 有未登记漂移即退出码 1
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tomllib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paths import INFLUENCE  # noqa: E402

TEMPLATE = INFLUENCE / "pipeline" / "templates" / "video-skeleton"
SKELETON_TOML = TEMPLATE / "skeleton.toml"

#: Main.tsx 的每集内容：场景 import 行 + SCENE_COMPONENTS 注册表条目。
#: 用归一化而非插入标记注释——后者要改动 4 个已发布集的 A 档邻近文件。
SCENE_IMPORT_RE = re.compile(r"^\s*import\s*\{[^}]*\}\s*from\s*'\./scenes/[^']+';\s*$")
REGISTRY_ENTRY_RE = re.compile(r"^\s*P\d+:\s*\w+,\s*$")


def md5(p: Path) -> str:
    return hashlib.md5(p.read_bytes()).hexdigest()[:12]


def normalize_main(text: str) -> str:
    """剥掉 Main.tsx 的每集内容，留下承重 boilerplate。"""
    keep = [
        ln
        for ln in text.split("\n")
        if not SCENE_IMPORT_RE.match(ln) and not REGISTRY_ENTRY_RE.match(ln)
    ]
    return "\n".join(keep)


def structured_package(text: str) -> str:
    """package.json 的受门子集：忽略 name/description，门住依赖与脚本。"""
    d = json.loads(text)
    return json.dumps(
        {k: d.get(k) for k in ("dependencies", "devDependencies", "scripts", "pnpm")},
        ensure_ascii=False,
        sort_keys=True,
    )


def template_source(rel: str) -> Path:
    """模板侧路径：`.tmpl` 是唯一例外——scaffold 渲染前后的同构性由 scaffold.py
    保证（frozen 档字节直拷、structured 档只比结构键），故比对时读渲染前原文。
    structured 的占位符 {{SLUG}}/{{TITLE}} 恰在被忽略的 name/description 里，
    json 解析不受影响；frozen 档无 .tmpl 文件，此回退对它不生效。"""
    plain = TEMPLATE / rel
    if plain.is_file() or not (TEMPLATE / f"{rel}.tmpl").is_file():
        return plain
    return TEMPLATE / f"{rel}.tmpl"


def fingerprint(path: Path, rel: str, cls: str) -> str | None:
    if not path.is_file():
        return None
    if cls == "regioned":
        return hashlib.md5(
            normalize_main(path.read_text(encoding="utf-8")).encode()
        ).hexdigest()[:12]
    if cls == "structured":
        return hashlib.md5(
            structured_package(path.read_text(encoding="utf-8")).encode()
        ).hexdigest()[:12]
    return md5(path)


#: 登记表类型：(episode, path) → (reason, fingerprint|None)
Registry = dict[tuple[str, str], tuple[str, str | None]]


def exempt(registry: Registry, slug: str, rel: str, fp: str) -> bool:
    """该集该文件的**当前**指纹是否被登记表放行。

    登记了但指纹已变 → 不放行，由调用方报 DRIFT-CHANGED：这正是「豁免随偏离
    内容改变而自动失效」的落点。未写 fingerprint 的旧条目仍无条件放行（向前
    兼容），但 tests/test_skeleton.py 要求每条 `[[drift]]` 都带指纹。
    """
    hit = registry.get((slug, rel))
    return hit is not None and (hit[1] is None or hit[1] == fp)


def main() -> int:
    ap = argparse.ArgumentParser(description="骨架漂移门（默认只报告）")
    ap.add_argument("--strict", action="store_true", help="有未登记漂移即退出码 1")
    args = ap.parse_args()

    skel = tomllib.loads(SKELETON_TOML.read_text(encoding="utf-8"))
    classes: dict[str, list[str]] = skel["classes"]
    baseline_series = skel.get("baselineOf")
    #: 登记表 → (reason, fingerprint|None)。**指纹钉住的是「已知的那处偏离」**：
    #: 不带指纹的豁免以 (episode, path) 为键无条件放行，于是该文件此后对任何改动
    #: 都永久免检——而 Main.tsx 恰是每集都要动的文件，等于把最该看的地方蒙上。
    #: 带指纹后豁免会在偏离内容改变时自动失效（同 `# type: ignore[code]` 只豁免
    #: 指定错误码，而非整行）；skeleton.toml 里写的「撤销条件」也随之成为机器判据。
    registered: Registry = {
        (d["episode"], d["path"]): (d.get("reason", ""), d.get("fingerprint"))
        for d in skel.get("drift", [])
    }
    series_list = json.loads((INFLUENCE / "series.json").read_text(encoding="utf-8"))[
        "seriesList"
    ]

    # 受门档位（seeded 不设门）
    gated = [
        (rel, cls)
        for cls in ("frozen", "overridable", "regioned", "structured")
        for rel in classes.get(cls, [])
    ]

    unregistered = 0
    print(
        f">> 骨架漂移门 · 模板 {TEMPLATE.relative_to(INFLUENCE)} · 受门 {len(gated)} 文件\n"
    )

    for series in series_list:
        eps = [e["slug"] for e in series["episodes"]]
        is_baseline = series["id"] == baseline_series
        tag = " [模板基线]" if is_baseline else ""
        print(f"  系列 {series['id']}（{len(eps)} 集）{tag}")
        for rel, cls in gated:
            tmpl_path = template_source(rel)
            tmpl_fp = fingerprint(tmpl_path, rel, cls)
            fps = {
                slug: fingerprint(INFLUENCE / "episodes" / slug / rel, rel, cls)
                or "缺失"
                for slug in eps
            }
            seen: dict[str, list[str]] = {}
            for slug, fp in fps.items():
                seen.setdefault(fp, []).append(slug)

            # 参照系：优先取模板指纹，其次取系列内多数——否则「与某人不一致」
            # 会把符合模板的多数集反过来报成偏离方（判据必须有方向）。
            if tmpl_fp and tmpl_fp in seen:
                ref = tmpl_fp
            else:
                ref = max(seen, key=lambda k: (len(seen[k]), k))

            # I1：系列内一致（相对参照系）
            for fp, slugs in sorted(seen.items()):
                if fp == ref:
                    continue
                for slug in slugs:
                    if exempt(registered, slug, rel, fp):
                        continue
                    if (slug, rel) in registered:  # 登记在册但指纹已变
                        unregistered += 1
                        print(
                            f"    DRIFT-CHANGED {rel} · {slug} 现为 {fp}，"
                            f"登记的是 {registered[(slug, rel)][1]}"
                            f" —— 偏离内容已变，豁免失效：请复核后更新 skeleton.toml"
                        )
                        continue
                    if cls == "overridable":
                        print(f"    INFO  {rel} · {slug} 行使了覆写许可（{fp}）")
                        continue
                    unregistered += 1
                    print(f"    DRIFT {rel} · {slug}（{fp}）≠ 参照（{ref}）")

            # I2：模板不过期 / 不被绕过。**当前只有一份模板**，故对全部系列执法：
            # 每集的 frozen 指纹必须等于模板，除非登记为漂移。只对基线系列执法的
            # 初版被自己的正控击穿——单集系列的 I1 是空条件（无同侪可比较），
            # 非基线的单集系列就完全落进了盲区。待将来出现第二份模板
            # （跨系列基线分叉），才回退为「仅基线系列」的窄语义。
            # I2 同样尊重逃逸口：全部偏离集都已登记时不报 STALE。否则**单集系列**
            # 拿不到文档承诺的豁免——I1 放行、I2 仍红，登记者无路可走（I1 的
            # 空条件性质正是 I2 存在的理由，两者对逃逸口的语义必须一致）。
            unreg = [s for s in eps if not exempt(registered, s, rel, fps[s])]
            if tmpl_fp and tmpl_fp not in seen and unreg:
                unregistered += 1
                scope = "基线系列" if is_baseline else "系列"
                print(
                    f"    STALE {rel} · {scope} {series['id']} 无一集匹配模板"
                    f"（模板 {tmpl_fp}，实际 {sorted(seen)}；未登记 {unreg}）"
                )

    # 孤儿工程：scaffold 出来但忘了登记 series.json 的目录。这类目录对
    # check_series（只遍历 series.json）与本门（同）**双向不可见**——脚手架
    # 让新建变便宜之后，这个缺口才真正需要堵。
    registered_slugs = {e["slug"] for s in series_list for e in s["episodes"]}
    orphans = sorted(
        p.name
        for p in (INFLUENCE / "episodes").iterdir()
        if p.is_dir() and p.name not in registered_slugs
    )
    if orphans:
        print(
            f"\n  ⚠️  未登记到 series.json 的工程目录（两个门都看不到它们）：{orphans}"
        )

    if registered:
        print("\n  已登记的合法偏离（逃逸口必须存在，但必须被记录）：")
        for (slug, rel), (why, pin) in sorted(registered.items()):
            print(f"    · {slug} / {rel}  [指纹 {pin or '未钉'}]\n        {why}")

    print(
        f"\n>> 未登记漂移 {unregistered} 处"
        + ("（--strict 下会失败）" if unregistered and not args.strict else "")
    )
    return 1 if (args.strict and unregistered) else 0


if __name__ == "__main__":
    sys.exit(main())
