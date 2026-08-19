#!/usr/bin/env python3
"""系列一致性校验——media/series.json（发布顺序 SSOT）的机械化执法。

此前顺序只活在散文与 React 常量里（EP3 的 SeriesThree 数组说「第一集=AI 如何
自己变强」而意图已变），且反串线 lint 无法只用 grep 实现：EP1 的 p1-25a 会命中
自己的片名「上线之后」——正确排除自身标题必须知道标题属于哪个工程，也就是
必须有清单。本脚本按价值降序执行五条规则：

  1. 口播反串线：任一集 narration.md 的口播行出现**他集标题**或顺序词
     （上一集/上期/第N集/前两集/本系列…）即 FAIL；自身标题排除；「下期」白名单
     （顺序无关收尾语）
  2. 多标题顺序：同一文件出现 ≥2 集标题时，首现顺序必须等于清单 episode 顺序
     —— 一条规则覆盖 SeriesThree 数组、storyboard、README、planning、知识索引
  3. 序号↔标题绑定：`第N集` 附近的标题必须与该集 episode 匹配
  4. 清单完整性：episode 连续无重、slug 唯一、路径存在、accents 色值在该集
     theme.ts 中存在
  5. 相对链接死链：受检文件集内的 `](./x.md)` / `](../x)` 目标必须存在
    （抓 video-package 类残留并防复发）

用法：uv run --no-project media/pipeline/scripts/check_series.py
退出码：0 = 一致；1 = 有 FAIL。挂牌 pre-commit 后自动覆盖 media/ 相关提交。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
SERIES_JSON = REPO / "media" / "series.json"

#: 顺序词（「下期」白名单——顺序无关的收尾语不算串线）
ORDINAL_WORDS = re.compile(
    r"上一集|上集|上期|下一集|下集|第[一二三四五六七八九十]集|前两集|前一集|本系列"
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

#: 受检文件集（规则 2/3/5 的扫描范围；.context 等工作区目录不含）
COVERED_GLOBS = (
    "media/**/*.md",
    "media/**/*.tsx",
    "media/**/*.ts",
    "docs/.agents/knowledge-map.md",
    "CHANGELOG.md",
)


def load_series() -> dict:
    if not SERIES_JSON.is_file():
        sys.exit(f"series.json 不存在: {SERIES_JSON}")
    data = json.loads(SERIES_JSON.read_text(encoding="utf-8"))
    eps = data.get("episodes", [])
    if not eps:
        sys.exit("series.json 无 episodes")
    return data


def covered_files() -> list[Path]:
    out: list[Path] = []
    for g in COVERED_GLOBS:
        out.extend(
            p for p in REPO.glob(g) if p.is_file() and "node_modules" not in p.parts
        )
    return sorted(set(out))


def rule_spoken_interleave(series: dict, msgs: list[str]) -> None:
    """规则 1：口播反串线。"""
    for ep in series["episodes"]:
        others = [e["title"] for e in series["episodes"] if e["slug"] != ep["slug"]]
        narration = REPO / ep["path"] / "script" / "narration.md"
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


def rule_title_order(series: dict, files: list[Path], msgs: list[str]) -> None:
    """规则 2：同一文件内多集标题的首现顺序 == 清单顺序。"""
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        present = [
            (text.find(e["title"]), e["episode"], e["title"])
            for e in series["episodes"]
            if e["title"] in text
        ]
        if len(present) >= 2:
            seq = [ep for _, ep, _ in sorted(present)]  # 按文本首现位置排序
            if seq != sorted(seq):
                msgs.append(
                    f"FAIL 规则2：{f.relative_to(REPO)} 中多集标题首现顺序为 "
                    f"{[t for _, _, t in sorted(present)]}（episode 序 {seq}），与 series.json 顺序不符"
                )


def rule_ordinal_binding(series: dict, files: list[Path], msgs: list[str]) -> None:
    """规则 3：`第N集` 的 ±60 字符窗口内出现的标题必须与该序号匹配。"""
    by_ep = {e["episode"]: e["title"] for e in series["episodes"]}
    title_to_ep = {e["title"]: e["episode"] for e in series["episodes"]}
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for m in EP_NUM.finditer(text):
            n = CN_NUM.get(m.group(1), 0)
            if n not in by_ep:
                continue
            window = text[max(0, m.start() - 60) : m.end() + 60]
            for title, ep in title_to_ep.items():
                if title in window and ep != n:
                    msgs.append(
                        f"FAIL 规则3：{f.relative_to(REPO)} 「第{m.group(1)}集」邻域出现第 {ep} 集的标题《{title}》"
                    )


def rule_manifest_integrity(series: dict, msgs: list[str]) -> None:
    """规则 4：清单完整性。"""
    eps = series["episodes"]
    nums = [e["episode"] for e in eps]
    if nums != list(range(1, len(eps) + 1)):
        msgs.append(f"FAIL 规则4：episode 序列 {nums} 不连续或有重复")
    slugs = [e["slug"] for e in eps]
    if len(set(slugs)) != len(slugs):
        msgs.append("FAIL 规则4：slug 重复")
    for e in eps:
        root = REPO / e["path"]
        for need in ("README.md", "script/narration.md"):
            if not (root / need).is_file():
                msgs.append(f"FAIL 规则4：{e['slug']} 缺 {need}")
        theme = root / "video" / "src" / "design" / "theme.ts"
        if theme.is_file():
            src = theme.read_text(encoding="utf-8")
            for hexv in e.get("accents", []):
                if hexv not in src:
                    msgs.append(
                        f"FAIL 规则4：{e['slug']} 的 accents 色值 {hexv} 未出现在其 theme.ts"
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
    series = load_series()
    files = covered_files()
    msgs: list[str] = []
    rule_spoken_interleave(series, msgs)
    rule_title_order(series, files, msgs)
    rule_ordinal_binding(series, files, msgs)
    rule_manifest_integrity(series, msgs)
    rule_dead_links(files, msgs)

    fails = [m for m in msgs if m.startswith("FAIL")]
    warns = [m for m in msgs if m.startswith("WARN")]
    for m in msgs:
        print(f"  {m}")
    print(
        f">> 系列一致性 · 受检 {len(files)} 文件 · FAIL {len(fails)} · WARN {len(warns)}"
    )
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
