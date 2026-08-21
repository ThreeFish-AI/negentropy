#!/usr/bin/env python3
"""系列一致性校验——series.json（发布顺序 SSOT）的机械化执法。

此前顺序只活在散文与 React 常量里（EP3 的 SeriesThree 数组说「第一集=AI 如何
自己变强」而意图已变），且反串线 lint 无法只用 grep 实现：EP1 的 p1-25a 会命中
自己的片名「上线之后」——正确排除自身标题必须知道标题属于哪个工程，也就是
必须有清单。本脚本按价值降序执行五条规则：

  1. 口播反串线：任一集 narration.md 的口播行出现**他集标题**或顺序词
     （上一集/上期/第N集/前两集/本系列…）即 FAIL；自身标题排除；「下期」白名单
     （顺序无关收尾语）
  2. 多标题顺序：同一文件出现**同系列** ≥2 集标题时，首现顺序必须等于清单
     episode 顺序 —— 一条规则覆盖 SeriesThree 数组、storyboard、README、
     planning、知识索引
  3. 序号↔标题绑定：`第N集` 附近的标题必须与该标题自身的 episode 匹配
  4. 清单完整性：每个系列内 episode 连续无重、slug 全局唯一、路径存在、
     accents 色值在该集 theme.ts 中存在
  5. 相对链接死链：受检文件集内的 `](./x.md)` / `](../x)` 目标必须存在
    （抓 video-package 类残留并防复发）

多系列语义（2026-08 起 series.json 顶层为 seriesList[]）：
  - 规则 1 **跨系列全局生效**——不同系列各自独立成片，口播互不引用，故「他集」
    范围取全部系列的全部集，只按 slug 排除自身。
  - 规则 2/3/4 **按系列内判定**——两个系列的发布顺序互相无关，同一文件（知识
    索引 / CHANGELOG / series.md）同时提及多个系列属正常形态；episode 的
    `1..N` 连续性也只在系列内成立。

用法：uv run --no-project apps/negentropy-influence/pipeline/scripts/check_series.py
退出码：0 = 一致；1 = 有 FAIL。挂牌 pre-commit 后自动覆盖子项目相关提交。

受检范围按根拆分（见 COVERED_GLOBS_INFLUENCE / COVERED_GLOBS_REPO）：子项目侧
用相对 glob，故本脚本内不出现任何「子项目在仓库中的位置」字面量。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# 同目录模块：作为脚本运行时脚本目录即 sys.path[0]，无需注入
from paths import INFLUENCE, REPO

SERIES_JSON = INFLUENCE / "series.json"

#: 顺序词。白名单：「下期」顺序无关收尾语；「前两集」从终集视角恒真（相对表述，改序仍成立）
ORDINAL_WORDS = re.compile(
    r"上一集|上集|上期|下一集|下集|第[一二三四五六七八九十]集|前一集|本系列"
)
SPOKEN_LINE_RE = re.compile(r"^- \[(?P<id>[a-z0-9-]+)\]\s+(?P<text>.+)$", re.M)
REL_LINK_RE = re.compile(r"\]\((\.{1,2}/[^)#?]+)\)")
EP_NUM = re.compile(r"第([一二三四五六七八九十])集")

CN_NUM = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}

#: 受检文件集（规则 2/3/5 的扫描范围；.context 等工作区目录不含）。
#: **按根拆分**是刻意的：子项目侧写相对 glob，路径字面量便从本脚本彻底消失
#: —— 于是「误把 `apps/negentropy-influence/**` 写宽成 `apps/**`」这个陷阱
#: 结构性不可能发生（实测宽化会炸出 12 条其他子项目的既存死链假 FAIL）。
COVERED_GLOBS_INFLUENCE = (
    "**/*.md",
    "**/*.tsx",
    "**/*.ts",
)
#: 仓库级受检文件。science-video-pipeline 路由壳此前**完全没有死链校验**，而它
#: 有 13 条指向本子项目的链接——正是整目录迁移会一次性打断的东西。
#: 刻意只收该技能而非 `.agent/skills/**`：后者会连带执法其他技能的既存债
#: （实测 pdf-reader 有一条示意用占位链接 `../images/pdf_name/...`），
#: 把无关的假 FAIL 引进来，最终只会促使有人把这条 glob 整行删掉。
COVERED_GLOBS_REPO = (
    "docs/.agents/knowledge-map.md",
    "CHANGELOG.md",
    ".agent/skills/science-video-pipeline/**/*.md",
)


def load_series() -> list[dict]:
    """读取 seriesList[]；每个系列必须非空。"""
    if not SERIES_JSON.is_file():
        sys.exit(f"series.json 不存在: {SERIES_JSON}")
    data = json.loads(SERIES_JSON.read_text(encoding="utf-8"))
    series_list = data.get("seriesList", [])
    if not series_list:
        sys.exit("series.json 无 seriesList")
    for s in series_list:
        if not s.get("episodes"):
            sys.exit(f"series.json：系列 {s.get('id')!r} 无 episodes")
    return series_list


def all_episodes(series_list: list[dict]) -> list[dict]:
    """跨系列展平——规则 1/3 需要全局视野。"""
    return [ep for s in series_list for ep in s["episodes"]]


def covered_files() -> list[Path]:
    out: list[Path] = []
    for base, globs in (
        (INFLUENCE, COVERED_GLOBS_INFLUENCE),
        (REPO, COVERED_GLOBS_REPO),
    ):
        for g in globs:
            out.extend(
                p for p in base.glob(g) if p.is_file() and "node_modules" not in p.parts
            )
    return sorted(set(out))


def rule_spoken_interleave(series_list: list[dict], msgs: list[str]) -> None:
    """规则 1：口播反串线（**跨系列全局**——见模块 docstring「多系列语义」）。"""
    eps = all_episodes(series_list)
    for ep in eps:
        others = [e["title"] for e in eps if e["slug"] != ep["slug"]]
        narration = INFLUENCE / ep["path"] / "script" / "narration.md"
        if not narration.is_file():
            msgs.append(f"FAIL 规则1：{ep['slug']} 缺 {narration.relative_to(REPO)}")
            continue
        for m in SPOKEN_LINE_RE.finditer(narration.read_text(encoding="utf-8")):
            sid, text = m.group("id"), m.group("text")
            hit_other = [t for t in others if t in text]
            if hit_other:
                msgs.append(
                    f"FAIL 规则1：{ep['slug']} {sid} 口播出现他集标题「{hit_other[0]}」"
                )
            if w := ORDINAL_WORDS.search(text):
                msgs.append(
                    f"FAIL 规则1：{ep['slug']} {sid} 口播出现顺序词「{w.group(0)}」"
                    "——序号只允许存在于视觉层与 series.json"
                )


def rule_title_order(
    series_list: list[dict], files: list[Path], msgs: list[str]
) -> None:
    """规则 2：同一文件内**同系列**多集标题的首现顺序 == 清单顺序。

    文件位于某集工程内时排除其自集标题——本集文件以自己的片名开篇（H1/组件数组）
    是自然形态，不该被计入顺序。跨系列不比顺序：两个系列发布顺序互相无关，
    知识索引 / CHANGELOG / series.md 同时提及多系列属正常形态。
    """
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        segs = set(f.parts)
        for series in series_list:
            own = next(
                (e for e in series["episodes"] if e["path"].split("/")[-1] in segs),
                None,
            )
            present = [
                (text.find(e["title"]), e["episode"], e["title"])
                for e in series["episodes"]
                if e["title"] in text and e is not own
            ]
            if len(present) >= 2:
                seq = [ep for _, ep, _ in sorted(present)]  # 按文本首现位置排序
                if seq != sorted(seq):
                    msgs.append(
                        f"FAIL 规则2：{f.relative_to(REPO)} 中系列 {series['id']} 的多集标题"
                        f"首现顺序为 {[t for _, _, t in sorted(present)]}"
                        f"（episode 序 {seq}），与 series.json 顺序不符"
                    )


def rule_ordinal_binding(
    series_list: list[dict], files: list[Path], msgs: list[str]
) -> None:
    """规则 3：`第N集` 的 ±60 字符窗口内出现的标题必须与该标题自身的序号匹配。

    跨系列无需分组：判据是「标题 → 它自己的 episode」，与标题属于哪个系列无关。
    多系列下各自都有第 1 集，故合法序号集合取并集（`valid_nums`）。
    """
    eps = all_episodes(series_list)
    valid_nums = {e["episode"] for e in eps}
    title_to_ep = {e["title"]: e["episode"] for e in eps}
    for f in files:
        if (
            f.suffix != ".md"
        ):  # 仅散文：TSX 里标签常在标题之后，近邻法必误报（规则2已覆盖数组）
            continue
        segs = set(f.parts)
        own_ep = next(
            (e["episode"] for e in eps if e["path"].split("/")[-1] in segs),
            None,
        )
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for m in EP_NUM.finditer(text):
            if own_ep and CN_NUM.get(m.group(1)) == own_ep:
                continue  # 本集自称序号合法（如 EP3 README 开篇「系列第三集」）
            n = CN_NUM.get(m.group(1), 0)
            if n not in valid_nums:
                continue
            window = text[max(0, m.start() - 60) : m.end() + 60]
            for title, ep in title_to_ep.items():
                if title in window and ep != n:
                    msgs.append(
                        f"FAIL 规则3：{f.relative_to(REPO)} 「第{m.group(1)}集」邻域出现第 {ep} 集的标题《{title}》"
                    )


def rule_manifest_integrity(series_list: list[dict], msgs: list[str]) -> None:
    """规则 4：清单完整性——episode 连续性按系列内判定，slug 全局唯一。"""
    seen_slugs: dict[str, str] = {}
    for series in series_list:
        eps = series["episodes"]
        nums = [e["episode"] for e in eps]
        if nums != list(range(1, len(eps) + 1)):
            msgs.append(
                f"FAIL 规则4：系列 {series['id']} 的 episode 序列 {nums} 不连续或有重复"
            )
        for e in eps:
            # slug 是工程目录名，必须全局唯一（否则两系列指向同一工程）
            if e["slug"] in seen_slugs:
                msgs.append(
                    f"FAIL 规则4：slug {e['slug']} 在系列 {seen_slugs[e['slug']]} "
                    f"与 {series['id']} 重复"
                )
            seen_slugs[e["slug"]] = series["id"]
            root = INFLUENCE / e["path"]
            for need in ("README.md", "script/narration.md"):
                if not (root / need).is_file():
                    msgs.append(f"FAIL 规则4：{e['slug']} 缺 {need}")
            theme = root / "video" / "src" / "design" / "theme.ts"
            if theme.is_file():
                src = theme.read_text(encoding="utf-8")
                for hexv in e.get("accents", []):
                    if hexv not in src:
                        msgs.append(
                            f"FAIL 规则4：{e['slug']} 的 accents 色值 {hexv} "
                            "未出现在其 theme.ts"
                        )
            else:
                msgs.append(f"WARN 规则4：{e['slug']} 缺 theme.ts（工程未初始化？）")


def rule_dead_links(files: list[Path], msgs: list[str]) -> None:
    """规则 5：受检文件内的相对链接目标必须存在。"""
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for m in REL_LINK_RE.finditer(text):
            target = (f.parent / m.group(1)).resolve()
            if not target.exists():
                msgs.append(f"FAIL 规则5：{f.relative_to(REPO)} 死链 {m.group(1)}")


def main() -> None:
    series_list = load_series()
    files = covered_files()
    msgs: list[str] = []
    rule_spoken_interleave(series_list, msgs)
    rule_title_order(series_list, files, msgs)
    rule_ordinal_binding(series_list, files, msgs)
    rule_manifest_integrity(series_list, msgs)
    rule_dead_links(files, msgs)

    fails = [m for m in msgs if m.startswith("FAIL")]
    warns = [m for m in msgs if m.startswith("WARN")]
    for m in msgs:
        print(f"  {m}")
    n_eps = len(all_episodes(series_list))
    print(
        f">> 系列一致性 · {len(series_list)} 系列 / {n_eps} 集 · "
        f"受检 {len(files)} 文件 · FAIL {len(fails)} · WARN {len(warns)}"
    )
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
