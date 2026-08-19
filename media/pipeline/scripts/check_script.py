#!/usr/bin/env python3
"""④⑤ 内容门：分镜覆盖性、时长预算、淡入不变式——公共管线版本。

机械化三件此前靠人眼/散文守着的事：
  1. storyboard 的 beat 句 id 区间必须**覆盖**本幕每一句（无缺句），重叠仅允许
     「标题卡/章头压前句尾」的刻意惯例（该 beat 的句区间单元格以「尾」结尾标注）；
  2. 时长预算：narration.json 字数估算与 manifest 实测（若已合成）两个口径都对
     pipeline.toml 的 target_minutes 负责——首次把「策划宣称/估算/实测」三处接上；
  3. 幕间呼吸淡入淡出的不变式：2×sceneCrossFadeSec ≤ sentenceGap+sceneGap
    （淡入淡出必须花在既有静默里，时间轴零位移的前提）。

可选 --check-scenes：从 video/src/scenes/*.tsx 提取 beatWindow/w('id','id')
调用，与分镜表互比（WARN-only，TSX 正则本质近似）。

用法：uv run --no-project media/pipeline/scripts/check_script.py --project media/<工程>
退出码：0 = 通过；1 = 有 FAIL。WARN 不影响退出码但会列明。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # noqa: E402
from timeline import load_constants, total_duration_in_frames  # noqa: E402

#: 分镜表行：| 镜号 | 句区间 | 画面 | 动效 |。镜号形如 `0-A`/`2-B2`，句区间形如
#: `p0-01..03`（右端可为裸编号，须补幕前缀）、`p6-06a..06d`、单句 `p6-07`。
BEAT_ROW_RE = re.compile(
    r"^\|\s*(\d+-[A-Z]\d*)[^|]*\|\s*(p\d+-[0-9a-z-]+(?:\.\.[0-9a-z-]+)?)\s*([^|]*)\|"
)
#: 场景组件里的 beat 调用。实际形如 `w('p0-01', 'p0-04')`（各场景统一先定义
#: `const w = (fromId, toId?) => beatWindow(scene.sentences, scene.from, …)` 再使用），
#: 故匹配任意 `\w(...)` 调用并要求参数为 1–2 个单引号句 id。
SCENE_CALL_RE = re.compile(r"\bw\(\s*'([a-z0-9-]+)'(?:\s*,\s*'([a-z0-9-]+)')?\s*\)")
#: 幕名（P0/P1/…）从句 id 前缀还原
SCENE_OF_RE = re.compile(r"^(p\d+)-")


def fail(msgs: list[str], text: str) -> None:
    msgs.append(f"FAIL {text}")


def warn(msgs: list[str], text: str) -> None:
    msgs.append(f"WARN {text}")


def parse_storyboard(path: Path) -> list[tuple[str, str, str, str]]:
    """返回 [(镜号, 起句id, 止句id, 区间单元格原文)]。单元格原文含「尾」= 刻意压尾标注。"""
    beats: list[tuple[str, str, str, str]] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        if m := BEAT_ROW_RE.match(raw):
            beat_id, span, cell = m.group(1), m.group(2), (m.group(2) + m.group(3))
            if ".." in span:
                left, _, right = span.partition("..")
                # 右端可为裸编号（p0-01..03）——须补幕前缀，否则永远匹配不到句子
                if not right.startswith("p"):
                    scene = SCENE_OF_RE.match(left).group(1)  # type: ignore[union-attr]
                    right = f"{scene}-{right}"
            else:
                left = right = span
            beats.append((beat_id, left, right, cell))
    return beats


def check_coverage(
    items: list[dict], beats: list[tuple[str, str, str, str]], msgs: list[str]
) -> None:
    ids = [i["id"] for i in items]
    pos = {sid: k for k, sid in enumerate(ids)}
    covered = [False] * len(ids)
    for beat_id, left, right, cell in beats:
        if left not in pos or right not in pos:
            bad = left if left not in pos else right
            fail(
                msgs,
                f"镜 {beat_id}：句 id {bad!r} 不在 narration.json（分镜陈旧或笔误）",
            )
            continue
        a, b = pos[left], pos[right]
        if b < a:
            fail(msgs, f"镜 {beat_id}：区间 {cell} 起止倒置")
            continue
        overlap = any(covered[a : b + 1])
        deliberate = "尾" in cell  # 区间单元格原文含「尾」= 标题卡压前句尾的刻意惯例
        for k in range(a, b + 1):
            covered[k] = True
        if overlap and not deliberate:
            warn(
                msgs,
                f"镜 {beat_id}：区间 {cell} 与前镜重叠（若为标题卡压前句尾的刻意设计，请在句区间后标注「尾」）",
            )
    missing = [sid for sid, c in zip(ids, covered, strict=False) if not c]
    if missing:
        fail(msgs, f"分镜未覆盖 {len(missing)} 句: {' '.join(missing)}")
    # 分镜表与代码的镜号互比（按幕：分镜镜号前缀数字 == 幕序号）
    scene_nums = sorted({int(SCENE_OF_RE.match(i["id"]).group(1)[1:]) for i in items})  # type: ignore[union-attr]
    beat_nums = sorted({int(b[0].split("-")[0]) for b in beats})
    if beat_nums and beat_nums != scene_nums:
        warn(msgs, f"分镜覆盖的幕 {beat_nums} 与 narration 的幕 {scene_nums} 不一致")


def check_budget(root: Path, items: list[dict], cfg: dict, msgs: list[str]) -> None:
    narr = cfg.get("narration", {})
    lo, hi = narr.get("target_minutes", [0, 999])
    cpm = narr.get("chars_per_min", 280)
    chars = sum(len(i["text"]) for i in items)
    est_min = chars / cpm
    print(
        f"  估算口径：{chars} 字 ÷ {cpm} 字/分 = {est_min:.1f} 分钟（目标 {lo}–{hi}）"
    )
    if not lo <= est_min <= hi:
        fail(msgs, f"估算时长 {est_min:.1f} 分超预算 [{lo}, {hi}]")
    manifest = root / "video" / "public" / "audio" / "manifest.json"
    if manifest.is_file():
        c = load_constants(root)
        m_items = json.loads(manifest.read_text(encoding="utf-8"))
        real_min = total_duration_in_frames(m_items, c) / c["fps"] / 60
        print(
            f"  实测口径：manifest {len(m_items)} 句，含时距总长 = {real_min:.1f} 分钟"
        )
        if not lo <= real_min <= hi:
            fail(msgs, f"实测时长 {real_min:.1f} 分超预算 [{lo}, {hi}]")
        if {i["id"] for i in m_items} != {i["id"] for i in items}:
            fail(msgs, "manifest 与 narration.json 的句 id 集不一致——改稿后未重跑 tts")
    else:
        print("  实测口径：manifest 未生成（跳过；合成后复跑本门）")


def check_fade_invariant(root: Path, msgs: list[str]) -> None:
    c = load_constants(root)
    budget = c["sentenceGapSec"] + c["sceneGapSec"]
    if 2 * c["sceneCrossFadeSec"] > budget:
        fail(
            msgs,
            f"2×sceneCrossFadeSec({c['sceneCrossFadeSec']}) > 幕间静默预算({budget:.2f}s)"
            " —— 淡入淡出会吃进句子音频，SceneFade 时间轴零位移前提被破坏",
        )


def check_scenes(
    root: Path, beats: list[tuple[str, str, str, str]], msgs: list[str]
) -> None:
    scenes_dir = root / "video" / "src" / "scenes"
    if not scenes_dir.is_dir():
        return
    code_pairs: set[tuple[str, str]] = set()
    for tsx in sorted(scenes_dir.glob("*.tsx")):
        for m in SCENE_CALL_RE.finditer(tsx.read_text(encoding="utf-8")):
            left, right = m.group(1), m.group(2) or m.group(1)
            code_pairs.add((left, right))
    board_pairs = {(left, right) for _, left, right, _ in beats}
    for pair in sorted(board_pairs - code_pairs):
        warn(
            msgs,
            f"分镜区间 {pair[0]}..{pair[1]} 未在场景代码中找到对应 beatWindow/w 调用",
        )
    for pair in sorted(code_pairs - board_pairs):
        warn(msgs, f"场景代码区间 {pair[0]}..{pair[1]} 未在分镜表中登记（分镜陈旧）")


def main() -> None:
    ap = argparse.ArgumentParser(description="④⑤ 内容门：覆盖性/预算/淡入不变式")
    ap.add_argument("--project", default=".", help="视频工程根目录")
    ap.add_argument(
        "--check-scenes",
        action="store_true",
        help="附:分镜↔场景代码 beat 互比（WARN-only）",
    )
    ap.add_argument(
        "--json", action="store_true", help="以 JSON 输出结果（供 pipeline.py 汇总）"
    )
    args = ap.parse_args()

    root = Path(args.project).resolve()
    cfg_path = root / "pipeline.toml"
    cfg = (
        tomllib.loads(cfg_path.read_text(encoding="utf-8"))
        if cfg_path.is_file()
        else {}
    )
    items = json.loads((root / "script" / "narration.json").read_text(encoding="utf-8"))
    board = root / "script" / "storyboard.md"
    if not board.is_file():
        sys.exit(f"storyboard.md 不存在: {board}")

    msgs: list[str] = []
    beats = parse_storyboard(board)
    if not beats:
        fail(msgs, f"未能从 {board.name} 解析出任何 beat 行（格式变化？）")
    check_coverage(items, beats, msgs)
    check_budget(root, items, cfg, msgs)
    check_fade_invariant(root, msgs)
    if args.check_scenes:
        check_scenes(root, beats, msgs)

    fails = [m for m in msgs if m.startswith("FAIL")]
    warns = [m for m in msgs if m.startswith("WARN")]
    if args.json:
        print(
            json.dumps({"fails": fails, "warns": warns}, ensure_ascii=False, indent=1)
        )
    else:
        print(f">> 内容门 · {root.name} · {len(items)} 句 / {len(beats)} 镜")
        for m in msgs:
            print(f"  {m}")
        print(f">> FAIL {len(fails)} · WARN {len(warns)}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
