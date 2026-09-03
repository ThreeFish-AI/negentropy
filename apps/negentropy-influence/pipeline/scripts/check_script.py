#!/usr/bin/env python3
"""④⑤ 内容门：分镜覆盖性、时长预算、淡入不变式——公共管线版本。

机械化三件此前靠人眼/散文守着的事：
  1. storyboard 的 beat 句 id 区间必须**覆盖**本幕每一句（无缺句），重叠仅允许
     「标题卡/章头压前句尾」的刻意惯例（该 beat 的句区间单元格以「尾」结尾标注）；
  2. 时长预算：narration.json 字数估算与 manifest 实测（若已合成）两个口径都对
     pipeline.toml 的 target_minutes 负责——首次把「策划宣称/估算/实测」三处接上；
  3. 幕间呼吸淡入淡出的不变式：2×sceneCrossFadeSec ≤ sentenceGap+sceneGap
    （淡入淡出必须花在既有静默里，时间轴零位移的前提）；
  4. 读法陷阱：上游中文归一化实测会读错的写法（4 位年份带空格、三段版本号、
     数字区间连字符、±、10x、整句无汉字…）——见 READING_TRAPS，每条都附实测输出。

可选 --check-scenes：从 video/src/scenes/*.tsx 提取 beatWindow/w('id','id')
调用，与分镜表互比（WARN-only，TSX 正则本质近似）。

可选 --check-motion：分镜「动效」列的 @动词 标注 ↔ 场景代码运动模型调用互比
（WARN-only）。动效列可写 `@enter:fall`、`@stagger`、`@draw` 等（动词表从本集
video/src/motion/hooks.ts 的 use* 导出**派生**，单一事实源不复制）；镜内声明了
@动词 而该幕场景文件未调用对应 use 模型 → WARN——「FadeUp 写在分镜里却没进代码」
（本仓实测发生过 3 处）这一缺陷类的机械化。反向（代码用了模型而分镜没写）不报：
动效列是意图摘要而非全量清单。

可选 --pre-tts（TTS 前置门）：只跑**不需要分镜**的检查——时长预算（估算口径；
manifest 若在则含实测口径）+ 读法陷阱 + 发音标注合法性（build_narration 已在
生成期拦非法标注，此处对 narration.json 再收口一遍）。两遍法草稿遍（A 遍）写完
稿就要排配音、storyboard.md 尚未写——本模式在 storyboard.md 缺失时照常完成并
以 0 退出；storyboard 相关的覆盖性/淡入/场景互比在此模式下一律跳过。

可选 --pron-candidates（报告，非门）：逐句列出命中多音字候选表的句子
（候选表见 pron_marks.POLYPHONE_CANDIDATES；与 --pre-tts 互斥——一个是门、
一个是注意力清单，混跑会让退出码语义含混）。退出码恒 0。

用法：uv run --no-project $R/check_script.py --project $P
退出码：0 = 通过；1 = 有 FAIL。WARN 不影响退出码但会列明。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # noqa: E402
import config  # noqa: E402 - 同目录模块，须在 sys.path 注入之后
from pron_marks import scan_candidates, validate  # noqa: E402
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
    budget = narr.get("target_minutes")
    # 形状校验归 config.validate（FAIL 已在那里报过）；此处只管「能否作为预算窗使用」。
    # 缺失与形状非法同路处理：解包前崩溃会让 FAIL 清单一条也打不出来。
    usable = (
        isinstance(budget, list)
        and len(budget) == 2
        and all(isinstance(x, (int, float)) for x in budget)
    )
    if not usable:
        # 此前缺失时静默退化为 [0, 999]——一个「你以为开着其实关着的门」。
        # 点名 WARN 是本次改动的要点：门被跳过必须说出来。
        warn(
            msgs,
            f"narration.target_minutes 缺失或形状非法（{budget!r}）："
            "**跳过时长预算门**（无 pipeline.toml？）",
        )
        lo, hi = 0, 999
    else:
        lo, hi = budget
    # 默认值取自 config.SCHEMA：本函数在 `required=False` 且缺 pipeline.toml 时
    # 拿到的 cfg 是 `{}`（load 不走 resolve），内联一份 280 就是第二事实源。
    cpm = narr.get("chars_per_min", config.default("narration.chars_per_min"))
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


#: 读法陷阱：上游中文文本归一化（macOS 上是 wetext，`indextts/utils/front.py:116-142`）
#: 会把数字展开成口语读法，绝大多数写法都正确，但下列写法**实测读错**。
#:
#: 每条都标注了 2026-08-20 在本机 index-tts venv 上直接跑 `TextNormalizer.normalize()`
#: 得到的真实输出——加规则前先跑探针拿证据，不要凭直觉列清单（本轮就有两条「疑似错误」
#: 实测其实是对的：`0.5~1.0 秒`→`零点五到一点零秒`、`9:30`→`九点三十分`，故未列入）。
#:
#: 归一化是**幂等**的：把读法预写成汉字后再过一遍结果不变，所以修复可逐句增量做。
READING_TRAPS: tuple[tuple[str, str, str], ...] = (
    (
        r"\d{4}\s+年",
        "FAIL",
        "4 位年份与「年」之间有空格：`2026 年` 读成「两千零二十六年」（写成 `2026年` 才读「二零二六年」）",
        # ⚠️ 空格位置敏感（2026-08-21 探针复核）：错读只发生在空格**夹在年份与「年」之间**；
        # 空格在年份**前**（`这篇 2026年的`）读法正确（「二零二六年」），门也不触发——不要
        # 把这类句子「顺手规范化」成年份前无空格以外的别的形态。
    ),
    (
        r"\d+\.\d+\.\d+",
        "FAIL",
        "三段版本号：`2.5.1` 读成「二.五点一」（残留字面小数点）——改写为「二点五点一」",
    ),
    (
        r"\d\s*[-–—]\s*\d",
        "FAIL",
        "数字区间用连字符：`3-5 倍` 读成「三减五倍」——改写为「三到五倍」",
    ),
    (
        r"±",
        "FAIL",
        "正负号：`±3%` 读成「百分之正负三」（顺序颠倒）——改写为「正负百分之三」",
    ),
    (
        r"\d\s*[xX](?![A-Za-z])",
        "FAIL",
        "倍数用 x：`10x` 读成「十x」（裸字母）——改写为「十倍」",
    ),
    (
        r"\d{3,}\s*[A-Za-z]",
        "WARN",
        (
            "数字串+字母型号：`1080P` 读成「一千零八十P」（按基数读且裸字母）——"
            "若要逐位读需改写为「一零八零 P」"
        ),
    ),
    (
        r"≈",
        "WARN",
        "约等于号未被归一化展开（原样透传），大概率不发音——改写为「大约」",
    ),
)
READING_TRAPS_COMPILED = tuple(
    (re.compile(p), level, msg) for p, level, msg, *_ in READING_TRAPS
)

#: 汉字。整句无汉字时上游按 `use_chinese()`（front.py:106-114）逐句嗅探路由到**英文**
#: normalizer：实测 `IndexTTS 2.5`→`IndexTTS two point five`、`RTF 0.2065`→
#: `RTF oh point two oh six five`。逐字稿为字幕可读性把句子拆到 ≤43 字，反而**提高**了
#: 出现纯 ASCII 短句的概率——两个既有约束的隐性冲突，故必须成门。
HAN_RE = re.compile(r"[一-鿿]")


def check_reading_traps(items: list[dict], msgs: list[str]) -> None:
    """逐句扫描已知会被读错的写法（上游归一化的实测行为）。"""
    hits = 0
    for it in items:
        text = it["text"]
        for pattern, level, why in READING_TRAPS_COMPILED:
            if m := pattern.search(text):
                hits += 1
                (fail if level == "FAIL" else warn)(
                    msgs, f"句 {it['id']} 命中读法陷阱 {m.group(0)!r}：{why}"
                )
        if not HAN_RE.search(text):
            hits += 1
            fail(
                msgs,
                f"句 {it['id']} 整句无汉字（{text!r}）：上游按整句嗅探路由到英文归一化，"
                "数字会读成英文（`2.5`→`two point five`）——请并入相邻句或补中文",
            )
    print(f"  读法陷阱：{len(items)} 句扫描，命中 {hits} 处")


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


#: 动效列的结构化标注：`@enter:fall` / `@stagger` / `@accelTravel` …
MOTION_TAG_RE = re.compile(r"@([A-Za-z][A-Za-z0-9]*)")


def parse_motion_tags(board: Path) -> list[tuple[str, str]]:
    """返回 [(镜号, 动词)]。动效列 = 表格行第 4 单元格（| 镜 | 句区间 | 画面 | 动效 |）。"""
    tags: list[tuple[str, str]] = []
    for raw in board.read_text(encoding="utf-8").splitlines():
        if not raw.startswith("|") or "---" in raw:
            continue
        cells = [c.strip() for c in raw.strip().strip("|").split("|")]
        if len(cells) < 4 or not re.match(r"^\d+-[A-Z]\d*$", cells[0]):
            continue
        for m in MOTION_TAG_RE.finditer(cells[3]):
            tags.append((cells[0], m.group(1)))
    return tags


def check_motion(root: Path, msgs: list[str]) -> None:
    """@动词 标注 ↔ 场景代码运动模型调用互比（WARN-only）。

    动词表从本集 video/src/motion/hooks.ts 派生（use 词首字母小写化），
    不在本文件复制第二份——hooks.ts 加模型，这里自动跟随。
    """
    board = root / "script" / "storyboard.md"
    hooks_ts = root / "video" / "src" / "motion" / "hooks.ts"
    if not hooks_ts.is_file():
        return  # 运动层未铺设的集（如已冻结的旧集）——此门静默不适用
    verbs = {
        m.group(1)[0].lower() + m.group(1)[1:]
        for m in re.finditer(
            r"export (?:async )?function use(\w+)", hooks_ts.read_text(encoding="utf-8")
        )
    }
    # 场景文件 → 该文件调用的运动模型（import 来源限定 ../motion，防同名误配）
    scenes_dir = root / "video" / "src" / "scenes"
    per_file: dict[str, set[str]] = {}
    for tsx in sorted(scenes_dir.glob("*.tsx")):
        src = tsx.read_text(encoding="utf-8")
        used = set()
        if re.search(r"from ['\"]\.\./motion['\"]", src):
            for m in re.finditer(r"\buse([A-Z][A-Za-z0-9]*)\s*\(", src):
                v = m.group(1)[0].lower() + m.group(1)[1:]
                if v in verbs:
                    used.add(v)
        per_file[tsx.name] = used
    # beat 镜号数字前缀 → 幕场景文件（0-A → P0*.tsx）
    for beat, verb in parse_motion_tags(board):
        if verb not in verbs:
            warn(msgs, f"镜 {beat}：@{verb} 不在运动模型词表（hooks.ts 派生；拼写？）")
            continue
        scene_pref = f"P{beat.split('-')[0]}"
        owners = [n for n in per_file if n.startswith(scene_pref)]
        if not owners or not any(verb in per_file[n] for n in owners):
            warn(msgs, f"镜 {beat}：分镜声明 @{verb}，但 {scene_pref} 场景代码未调用")


def main() -> None:
    ap = argparse.ArgumentParser(description="④⑤ 内容门：覆盖性/预算/淡入不变式")
    ap.add_argument("--project", default=".", help="视频工程根目录")
    ap.add_argument(
        "--check-scenes",
        action="store_true",
        help="附:分镜↔场景代码 beat 互比（WARN-only）",
    )
    ap.add_argument(
        "--check-motion",
        action="store_true",
        help="附:分镜动效列 @动词 标注 ↔ 场景代码运动模型互比（WARN-only）",
    )
    ap.add_argument(
        "--pre-tts",
        action="store_true",
        help="TTS 前置门：只跑不需要分镜的检查（预算/读法陷阱/标注合法性），"
        "storyboard.md 缺失时照常完成（两遍法草稿遍场景）",
    )
    ap.add_argument(
        "--pron-candidates",
        action="store_true",
        help="报告（非门）：列出命中多音字候选表的句子，供复听时重点关注；退出码恒 0",
    )
    ap.add_argument(
        "--json", action="store_true", help="以 JSON 输出结果（供 pipeline.py 汇总）"
    )
    args = ap.parse_args()
    if args.pre_tts and args.pron_candidates:
        ap.error("--pre-tts 是门、--pron-candidates 是报告，两者互斥")

    root = Path(args.project).resolve()
    # required=False：内容门在没有 pipeline.toml 时仍应能跑（如新集脚手架期）。
    # 但受影响的门必须点名 WARN（见 check_budget）——静默跳过的门是 config.py
    # 存在的首要原因。schema/默认值与 pipeline.py 共用同一事实源。
    cfg, _origin, cfg_fails, cfg_warns = config.load(
        root, required=False, scope={"narration"}
    )
    items = json.loads((root / "script" / "narration.json").read_text(encoding="utf-8"))

    if args.pron_candidates:
        hits = scan_candidates(items)
        print(f">> 多音字候选 · {root.name} · {len(items)} 句（候选 ≠ 台账，非门）")
        for sid, char, risk, advice in hits:
            print(f"  {sid}  {char}  {risk}  → 若听出错读：{advice}")
        print(f">> 候选命中 {len(hits)} 处（确认读错才写台账，不要预防性标注）")
        return

    board = root / "script" / "storyboard.md"
    if not args.pre_tts and not board.is_file():
        sys.exit(f"storyboard.md 不存在: {board}")

    msgs: list[str] = []
    for f in cfg_fails:
        fail(msgs, f"配置：{f}")
    for w in cfg_warns:
        warn(msgs, f"配置：{w}")
    if args.pre_tts:
        # 两遍法草稿遍的形态：稿已定、分镜未写。只跑「文本自身」可判定的门——
        # 分镜覆盖性/淡入不变式/场景互比都依赖 storyboard 或 timing 常数随分镜
        # 联动，此时跳过并**点名**（静默跳过的门比没有门更糟）。
        print(
            f">> pre-TTS 前置门 · {root.name} · {len(items)} 句（分镜未写，跳过覆盖性/淡入/场景互比）"
        )
        check_budget(root, items, cfg, msgs)
        check_reading_traps(items, msgs)
        for it in items:
            errs, _warns = validate(it.get("ttsText") or it["text"])
            if errs:
                fail(msgs, f"句 {it['id']} 发音标注非法：{errs[0]}")
    else:
        beats = parse_storyboard(board)
        if not beats:
            fail(msgs, f"未能从 {board.name} 解析出任何 beat 行（格式变化？）")
        check_coverage(items, beats, msgs)
        check_budget(root, items, cfg, msgs)
        check_reading_traps(items, msgs)
        check_fade_invariant(root, msgs)
        if args.check_scenes:
            check_scenes(root, beats, msgs)
        if args.check_motion:
            check_motion(root, msgs)

    fails = [m for m in msgs if m.startswith("FAIL")]
    warns = [m for m in msgs if m.startswith("WARN")]
    if args.json:
        print(
            json.dumps({"fails": fails, "warns": warns}, ensure_ascii=False, indent=1)
        )
    else:
        n_beats = "—" if args.pre_tts else len(beats)
        print(f">> 内容门 · {root.name} · {len(items)} 句 / {n_beats} 镜")
        for m in msgs:
            print(f"  {m}")
        print(f">> FAIL {len(fails)} · WARN {len(warns)}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
