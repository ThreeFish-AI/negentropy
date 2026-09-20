#!/usr/bin/env python3
"""archify 覆盖门：图例对文案/逐字稿/字幕的覆盖度、丰富度、匹配度（④⑤ 阶段）。

机械化 ISSUE-188 的待落实判据——「画面覆盖率**按句统计**，不按镜统计」「镜里挂了
archify 不构成回答」。三个维度：

  1. 覆盖度：句级 cue 锚定率（总体下限 + 分幕下限，整幕零锚 FAIL）；**最长连续
     无锚句 run 上限**（幕边界不重置——观众的「连续没图感」不过幕；豁免幕句子
     视为已锚断 run）；storyboard 声明了 archify 的镜，其句区间内至少 1 句被锚；
  2. 丰富度：图数 / cue 数 / 被引用章比 / **cue 密度（cue/分钟，时长取 audio
     manifest × timing，缺任一点名 WARN 跳过）** / **图型多样性（sidecar 顶层
     type 去重数；缺 type 归 untyped 计 1 种）**的地板。默认值是「任何用 archify
     的集都不该破」的宽松地板；真实目标由本集 toml 覆写成决策记录；
  3. 匹配度：分镜声明 ↔ 实际 cue 双向对账（声明未实现 FAIL / 未声明 WARN）；章
     token 必须可解析为某图 views 的 id 或 label（分镜陈旧即被抓）；同 slug 章节
     按锚句顺序的单调性（WARN——合法叙事重组存在）；**同锚句双 cue FAIL**
     （全屏独占下一句一图；异句窗含句间 gap 按构造铺满不重叠，锚句唯一 ⟺ 帧窗
     不相交）；**forbid_inset**（全屏切换集的策略声明：场景 variant 残留或分镜
     inset 标注即 FAIL）。

刻意不收的判据：views note ↔ 锚句的关键词重叠。探针实测 29 个 cue 里 28 个重叠
< 0.2（note 是图内视角、口播是叙事视角，天然两套词面），假阳性 96.5%——加规则前
先跑探针，别凭直觉扩大清单。

分镜标注规范（双向对账的前提）：画面列写
  `·**archify full**：图名 章 `chapterId`+`chapterId``
图名 = slug 或该图任一章 label（可解析即通过，如「病因链」= cause-chain 章的
label）；章 token 写 views 的 id（首选）或 label。无章 token 的标注（只声明图）
合法，仅免于逐章对账。

skip 语义（点名，绝不静默）：
  - 无任何 archify 资产 → 一行 ℹ️ 干净跳过（没用 archify 不是债，不是 WARN）；
  - 仅 sidecar 无 views/manifest（旧形态 ArchifyClip 直接消费，如 context-layer）
    → 点名 WARN 跳过（WARN 不影响退出码，同 rate 预演先例）；
  - views 在而 manifest.ts 缺（录制了未生成）→ WARN 跳过章口径，锚定率/对账照跑；
  - scenes 未写（video/src/scenes 缺）→ 点名 WARN，锚定率/分幕/对账/单调性随跳过
    （章 token 可解析性与丰富度图数地板不依赖场景，照跑）；
  - storyboard 零 archify 标注 → 双向对账降为单条 WARN，不逐 cue 刷屏。

防少算四道计数/形态断言（ISSUE-187：提取式门一律自带计数断言）：
  cue 侧 `chapterId:` 计数 == 提取数 + `at('句id')` 形态断言 + `durationInFrames:
  dur('同一句id')` 单参形态断言（多句窗会与邻句 cue 真重叠，且锚句与时长句分家
  是静默错窗）；storyboard 侧 `archify (full|inset)` 命中数 == 解析出的标注数；
  views 侧双映射条目数 == 各文件章数之和（JSON 读坏静默为空集会让全部 token
  「无法解析」刷屏）。（extract_cues 上移自 episode check_archify.scene_cues——
  那侧改为 import 本函数，单一提取器。）

用法：uv run --no-project $R/check_archify_coverage.py --project $P
退出码：0 = 通过；1 = 有 FAIL。WARN 不影响退出码但列明。
pipeline.py `check` 在 check_script 之后自动串联本门（`all` / `--series check`
随之获得）——不加 flag：忘带 flag = 检查面静默缩小（ISSUE-168 失效形态）。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config
import timeline
from check_script import parse_storyboard, parse_storyboard_visual

# ---------------- cue 提取（单一事实源，episode check_archify 反向 import） ----------------

CUE_BLOCK_RE = re.compile(r"<ArchifyRecap\b([\s\S]{0,2200}?)/>")
CUE_OBJ_RE = re.compile(r"\{chapterId:\s*'([^']+)'[^{}]*\}")
CUE_AT_RE = re.compile(r"at:[^,]*?at\('([a-z0-9-]+)'\)")
CUE_DUR_RE = re.compile(r"durationInFrames:\s*dur\('([a-z0-9-]+)'\)")

Cue = tuple[
    str, str, str, str, "str | None"
]  # (场景文件名, slug, chapterId, 锚句id, fit)


def extract_cues(scenes_dir: Path) -> list[Cue]:
    """从场景代码抽 (文件名, slug, chapterId, 锚句 id, 显式 fit)。

    两道硬失败都是必要的：计数断言防整块 ArchifyRecap 被漏读；at 形态断言防写成
    `at: 0, durationInFrames: bX.durationInFrames` 的 cue 静默漏掉——2026-09-19
    实测正因此让 29 个 cue 只报了 27 个。dur 单参形态断言防多句窗（dur('a','b')
    会与邻句 cue 真重叠）与锚句/时长句分家的静默错窗。少算不报错等于门形同虚设。
    """
    out: list[Cue] = []
    declared = 0
    for f in sorted(scenes_dir.glob("P*.tsx")):
        src = f.read_text(encoding="utf-8")
        declared += len(re.findall(r"chapterId:", src))
        for blk in CUE_BLOCK_RE.finditer(src):
            body = blk.group(1)
            sm = re.search(r'slug="([^"]+)"', body)
            if not sm:
                continue
            for c in CUE_OBJ_RE.finditer(body):
                obj = c.group(0)
                am = CUE_AT_RE.search(obj)
                if am is None:
                    raise SystemExit(
                        f"FAIL: {sm.group(1)}/{c.group(1)} 未识别出 `at('句id')` 锚，"
                        "请改成 `at: at('句id') - bX.from` + `dur('句id')`。"
                    )
                dm = CUE_DUR_RE.search(obj)
                if dm is None:
                    raise SystemExit(
                        f"FAIL: {sm.group(1)}/{c.group(1)} 未识别出 `dur('句id')` "
                        "单参时长——多句窗（dur('a','b')）会与邻句 cue 重叠，"
                        "全屏独占下请一章锚一句。"
                    )
                if dm.group(1) != am.group(1):
                    raise SystemExit(
                        f"FAIL: {sm.group(1)}/{c.group(1)} 锚句 {am.group(1)} 与时长句 "
                        f"{dm.group(1)} 不一致——cue 窗必须落在同一个句 id 上。"
                    )
                fm = re.search(r"fit:\s*'(stretch|hold|trim)'", obj)
                out.append(
                    (
                        f.stem,
                        sm.group(1),
                        c.group(1),
                        am.group(1),
                        fm.group(1) if fm else None,
                    )
                )
    if len(out) != declared:
        raise SystemExit(
            f"FAIL: 场景里声明了 {declared} 个 cue，只识别出 {len(out)} 个。\n"
            "      漏掉的写法请改成 `at: at('句id') - bX.from` + "
            "`dur('句id')`（单句 beat 与 `at: 0` 完全等价；dur 是各 scene 里与 at "
            "对称的取长辅助，不写 w('句id') 字面形态是为了不让 check_scenes 把镜内"
            "叠加层登记成镜区间）。"
        )
    return out


# ---------------- storyboard 标注解析 ----------------

ANN_RE = re.compile(r"\*\*archify\s+(full|inset)\*\*")
TOKEN_RE = re.compile(r"`([^`]+)`")
ANN_COUNT_RE = re.compile(r"archify\s+(?:full|inset)")


def parse_annotation(seg: str) -> dict | None:
    """`·` 分段里的一段 archify 标注 → {variant, names, tokens}；非标注段 → None。"""
    m = ANN_RE.search(seg)
    if not m:
        return None
    body = re.sub(r"^[：:]\s*", "", seg[m.end() :])
    tokens = TOKEN_RE.findall(seg)
    name_part = body.split("章", 1)[0].strip() if "章" in body else body.strip()
    names = [n.strip() for n in re.split(r"\s*\+\s*", name_part) if n.strip()]
    return {"variant": m.group(1), "names": names, "tokens": tokens}


def parse_board_annotations(
    board: Path,
) -> tuple[list[tuple[str, list[dict]]], list[str]]:
    """→ ([(镜号, [标注…])], fails)。

    计数断言：storyboard 全文 `archify (full|inset)` 命中数 == 解析出的标注数
    ——解析器漏行（如换一种加粗写法）会让对账静默缩小，必须硬失败。
    """
    text = board.read_text(encoding="utf-8")
    beats = parse_storyboard(board)
    visuals = parse_storyboard_visual(board)
    assert len(beats) == len(visuals), "parse_storyboard 与 visual 行集应按构造对齐"
    declared: list[tuple[str, list[dict]]] = []
    n_parsed = 0
    for (beat_id, _l, _r, _cell), (_bid, visual) in zip(beats, visuals, strict=True):
        anns = [a for a in (parse_annotation(seg) for seg in visual.split("·")) if a]
        n_parsed += len(anns)
        if anns:
            declared.append((beat_id, anns))
    fails: list[str] = []
    n_hits = len(ANN_COUNT_RE.findall(text))
    if n_hits != n_parsed:
        fails.append(
            f"storyboard 有 {n_hits} 处 `archify full/inset` 命中，只解析出 {n_parsed} 条标注"
            "——加粗/分隔写法变化会让对账静默缩小，请修 parse_annotation"
        )
    return declared, fails


# ---------------- views / manifest ----------------


def load_views(
    views_dir: Path,
) -> tuple[dict[str, list[dict]], dict[str, set[str]], dict[str, set[str]], list[str]]:
    """→ ({slug: chapters}, id→slugs, label→slugs, fails)。

    views 侧计数断言：双映射总条目数 == 各文件章数之和（JSON 读坏静默为空集会让
    全部 token「无法解析」刷屏，须先暴露读取失败本身）。
    """
    views: dict[str, list[dict]] = {}
    fails: list[str] = []
    total = 0
    for f in sorted(views_dir.glob("*.json")):
        try:
            chapters = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            fails.append(f"views/{f.name} 不是合法 JSON：{e}")
            continue
        if not isinstance(chapters, list) or not chapters:
            fails.append(f"views/{f.name} 解析出空章表（格式变化？）")
            continue
        views[f.stem] = chapters
        total += len(chapters)
    id_map: dict[str, set[str]] = {}
    label_map: dict[str, set[str]] = {}
    for slug, chapters in views.items():
        for ch in chapters:
            id_map.setdefault(ch["id"], set()).add(slug)
            label_map.setdefault(ch.get("label", ch["id"]), set()).add(slug)
    n_entries = sum(len(v) for v in id_map.values()) + sum(
        len(v) for v in label_map.values()
    )
    if total and n_entries != 2 * total:
        fails.append(
            f"views 双映射条目数 {n_entries} ≠ 章数×2（{total}×2）——章对象缺 id/label"
        )
    return views, id_map, label_map, fails


def load_manifest_ts(manifest_ts: Path) -> dict | None:
    m = re.search(
        r"export const ARCHIFY = ([\s\S]+?) as const",
        manifest_ts.read_text(encoding="utf-8"),
    )
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def resolve_name(name: str, views: dict[str, list[dict]]) -> set[str]:
    """图名 → slug 集（精确 slug / 归一化 slug / 任一章 label 三通道）。"""
    out: set[str] = set()
    norm = name.lower().replace(" ", "-")
    for slug, chapters in views.items():
        if (
            name == slug
            or norm == slug
            or any(ch.get("label") == name for ch in chapters)
        ):
            out.add(slug)
    return out


# ---------------- 主流程 ----------------


def main() -> None:
    ap = argparse.ArgumentParser(description="archify 覆盖门（覆盖度/丰富度/匹配度）")
    ap.add_argument("--project", required=True)
    args = ap.parse_args()
    root = Path(args.project).resolve()

    cfg, _origin, cfg_fails, cfg_warns = config.load(
        root, required=False, scope={"archify"}
    )
    arch = cfg.get("archify", {})
    min_diagrams = arch.get("min_diagrams", config.default("archify.min_diagrams"))
    min_cues = arch.get("min_cues", config.default("archify.min_cues"))
    min_anchor = arch.get(
        "min_anchor_ratio", config.default("archify.min_anchor_ratio")
    )
    min_chapter = arch.get(
        "min_chapter_ratio", config.default("archify.min_chapter_ratio")
    )
    per_scene_min = arch.get(
        "per_scene_min_anchors", config.default("archify.per_scene_min_anchors")
    )
    exempt = arch.get("exempt_scenes", config.default("archify.exempt_scenes"))
    max_run = arch.get(
        "max_unanchored_run", config.default("archify.max_unanchored_run")
    )
    min_scene_ratio = arch.get(
        "min_scene_anchor_ratio", config.default("archify.min_scene_anchor_ratio")
    )
    min_cpm = arch.get(
        "min_cues_per_minute", config.default("archify.min_cues_per_minute")
    )
    min_types = arch.get(
        "min_diagram_types", config.default("archify.min_diagram_types")
    )
    forbid_inset = arch.get("forbid_inset", config.default("archify.forbid_inset"))
    cue_exclusive = arch.get(
        "cue_sentence_exclusive", config.default("archify.cue_sentence_exclusive")
    )

    archify_dir = root / "video" / "public" / "archify"
    views_dir = archify_dir / "views"
    manifest_ts = root / "video" / "src" / "archify.manifest.ts"
    scenes_dir = root / "video" / "src" / "scenes"
    sidecars = sorted(archify_dir.glob("*.json")) if archify_dir.is_dir() else []
    views_files = sorted(views_dir.glob("*.json")) if views_dir.is_dir() else []

    # ---- skip 三分（点名，绝不静默） ----
    if not views_files and not sidecars and not manifest_ts.is_file():
        print(f">> archify 覆盖门 · {root.name} · 无 archify 资产，跳过")
        sys.exit(0)
    if not views_files:
        print(f">> archify 覆盖门 · {root.name}")
        if sidecars:
            print(
                f"  WARN 检测到 {len(sidecars)} 个 archify sidecar 但无 views"
                "（旧形态 ArchifyClip 直接消费）——跳过 archify 覆盖门"
            )
        sys.exit(0)

    fails: list[str] = []
    warns: list[str] = []
    infos: list[str] = []
    for f in cfg_fails:
        fails.append(f"配置：{f}")
    for w in cfg_warns:
        warns.append(f"配置：{w}")

    views, id_map, label_map, v_fails = load_views(views_dir)
    fails.extend(v_fails)

    manifest: dict | None = None
    if manifest_ts.is_file():
        manifest = load_manifest_ts(manifest_ts)
        if manifest is None:
            warns.append(
                "archify.manifest.ts 解析失败——跳过章口径（录制后重跑 archify_manifest.py）"
            )
    else:
        warns.append("archify.manifest.ts 未生成——跳过章归属与丰富度章口径")

    # ---- cue 提取 ----
    cues: list[Cue] = []
    have_cues = scenes_dir.is_dir()
    if have_cues:
        cues = extract_cues(scenes_dir)
        if not cues:
            fails.append(
                f"有 {len(views_files)} 张 archify 图但场景零 cue——图例组不足的核心症状"
            )
    else:
        warns.append("video/src/scenes 不存在（场景未写）——跳过锚定率/对账/单调性")

    # ---- narration ----
    narration_f = root / "script" / "narration.json"
    have_narr = narration_f.is_file()
    idx: dict[str, int] = {}
    scene_of: dict[str, str] = {}
    scene_order: list[str] = []
    if have_narr:
        items = json.loads(narration_f.read_text(encoding="utf-8"))
        for i, it in enumerate(items):
            idx[it["id"]] = i
            scn = it.get("scene") or ("P" + it["id"][1])
            scene_of[it["id"]] = scn
            if scn not in scene_order:
                scene_order.append(scn)
    else:
        warns.append("script/narration.json 缺失——跳过锚定率/分幕/声明镜判定")

    anchored: set[str] = set()
    max_run_seen: int | None = None

    # ---- 布局：forbid_inset（全屏切换集的策略声明，防画中画回退） ----
    if forbid_inset and scenes_dir.is_dir():
        for f in sorted(scenes_dir.glob("P*.tsx")):
            n = len(re.findall(r'variant="inset"', f.read_text(encoding="utf-8")))
            if n:
                fails.append(
                    f'{f.name}: 残留 {n} 处 variant="inset"'
                    "（forbid_inset 已开——全屏切换集不得回退画中画）"
                )

    # ---- 匹配度：同句排他（全屏独占下一句一图） ----
    if have_cues and cue_exclusive:
        seen_sid: dict[str, str] = {}
        for _f, slug, cid, sid, _fit in cues:
            if sid in seen_sid:
                fails.append(
                    f"同锚句双 cue：{sid} 同时被 {seen_sid[sid]} 与 {slug}/{cid} 占用"
                    "——全屏独占下一句一图，请挪章或拆句"
                )
            else:
                seen_sid[sid] = f"{slug}/{cid}"

    # ---- 匹配度：章归属 + 锚句存在（同时收集 anchored） ----
    if have_cues and have_narr:
        for _f, slug, cid, sid, _fit in cues:
            chapters = views.get(slug)
            if chapters is None:
                fails.append(f"{slug}/{cid}: 场景引用了 views 里不存在的图")
                continue
            if not any(ch["id"] == cid for ch in chapters):
                fails.append(f"{slug}/{cid}: 场景引用了 views 里不存在的章节")
            if manifest is not None:
                mch = manifest.get(slug, {}).get("chapters", [])
                if not any(ch.get("id") == cid for ch in mch):
                    fails.append(
                        f"{slug}/{cid}: 章不在 archify.manifest.ts（重跑 archify_manifest.py）"
                    )
            if sid not in idx:
                fails.append(f"{slug}/{cid}: 锚句 {sid} 不在 narration")
            else:
                anchored.add(sid)

    # ---- 覆盖度（scenes 缺失时随上方 WARN 一并跳过——说了跳过就不能照样判死） ----
    if have_narr and have_cues:
        n_total = len(idx)
        ratio = len(anchored) / n_total if n_total else 0.0
        n_of_scene: dict[str, int] = {}
        for scn in scene_of.values():
            n_of_scene[scn] = n_of_scene.get(scn, 0) + 1
        per_scene: dict[str, int] = {s: 0 for s in scene_order}
        for sid in anchored:
            per_scene[scene_of[sid]] = per_scene.get(scene_of[sid], 0) + 1
        stat = " · ".join(
            f"{s} {per_scene.get(s, 0)}/{n_of_scene[s]}" for s in scene_order
        )
        for s in scene_order:
            n_scene = n_of_scene[s]
            if per_scene.get(s, 0) < per_scene_min:
                if s in exempt:
                    infos.append(
                        f"{s} 豁免零锚判定（pipeline.toml [archify] exempt_scenes）"
                    )
                else:
                    fails.append(
                        f"{s}：整幕 {n_scene} 句锚定 {per_scene.get(s, 0)} < {per_scene_min}"
                        "（豁免须在 pipeline.toml [archify] exempt_scenes 显式声明）"
                    )
            elif n_scene and per_scene[s] / n_scene < min_scene_ratio:
                if s in exempt:
                    infos.append(
                        f"{s} 豁免分幕锚定率判定"
                        f"（{per_scene[s]}/{n_scene}，pipeline.toml exempt_scenes）"
                    )
                else:
                    fails.append(
                        f"{s}：分幕锚定率 {per_scene[s]}/{n_scene}"
                        f"（{per_scene[s] / n_scene:.0%}）< 下限 {min_scene_ratio:.0%}"
                    )
        if ratio < min_anchor:
            need = int(min_anchor * n_total) - len(anchored)
            fails.append(
                f"锚定率 {len(anchored)}/{n_total}（{ratio:.1%}）< 下限 {min_anchor:.0%}：还差 {need} 句"
            )
        # 最长连续无锚 run：幕边界不重置（观众体验不分幕）；豁免幕句子视为已锚断 run
        order = [sid for sid, _i in sorted(idx.items(), key=lambda kv: kv[1])]
        best_run = best_start = cur_run = cur_start = 0
        for pos, sid in enumerate(order):
            if sid in anchored or scene_of[sid] in exempt:
                cur_run = 0
                continue
            if cur_run == 0:
                cur_start = pos
            cur_run += 1
            if cur_run > best_run:
                best_run, best_start = cur_run, cur_start
        max_run_seen = best_run
        if best_run > max_run:
            fails.append(
                f"最长连续无锚 {best_run} 句（{order[best_start]} 起）> 上限 {max_run}"
                "——该段文案没有任何动效图例演示"
            )
    else:
        stat = "—"

    # ---- storyboard 声明镜锚定 + 双向对账 ----
    board = root / "script" / "storyboard.md"
    declared_pairs: set[tuple[str, str]] = set()  # (slug, chapterId) 已声明
    if board.is_file():
        declared, d_fails = parse_board_annotations(board)
        fails.extend(d_fails)
        if not declared and cues:
            warns.append(
                "分镜无任何 archify 标注，跳过双向对账（标注规范见 check_archify_coverage.py 文件头）"
            )
        beat_range = {
            bid: (idx.get(left, -1), idx.get(right, -1))
            for bid, left, right, _c in parse_storyboard(board)
        }
        for bid, anns in declared:
            for ann in anns:
                if forbid_inset and ann["variant"] == "inset":
                    fails.append(
                        f"镜 {bid}: 分镜标注 archify inset（forbid_inset 已开）——应改 full"
                    )
                tok_slugs_all: set[str] = set()
                for tok in ann["tokens"]:
                    slugs = id_map.get(tok, set()) | label_map.get(tok, set())
                    if not slugs:
                        fails.append(
                            f"镜 {bid}: 分镜声明 章 `{tok}` 无法解析（不在任何 views 的 id/label 表"
                            "——分镜陈旧或笔误）"
                        )
                        continue
                    tok_slugs_all |= slugs
                    chids = {
                        ch["id"]
                        for s in slugs
                        for ch in views[s]
                        if ch["id"] == tok or ch.get("label") == tok
                    }
                    hit = next(
                        (
                            sid
                            for _f, s2, cid, sid, _ft in cues
                            if s2 in slugs and cid in chids
                        ),
                        None,
                    )
                    pretty = "/".join(sorted(slugs))
                    # scenes 未写时 cues 为空、hit 恒 None——判「未实现」无意义，
                    # 随 skip 语义放行（上方 WARN 已点名跳过对账）
                    if hit is None and have_cues:
                        fails.append(
                            f"镜 {bid}: 分镜声明 {pretty}#{tok} 未在任何 cue 实现"
                        )
                    elif have_narr and hit in idx:
                        _l, _r = beat_range.get(bid, (-1, -1))
                        if _l >= 0 and not (_l <= idx[hit] <= _r):
                            warns.append(
                                f"镜 {bid}: 声明的 {pretty}#{tok} 锚在 {hit}，落在镜区间之外——错位或分镜滞后"
                            )
                    for s2 in slugs:
                        for cid2 in chids:
                            declared_pairs.add((s2, cid2))
                for nm in ann["names"]:
                    nslugs = resolve_name(nm, views)
                    if nslugs and tok_slugs_all and not (nslugs & tok_slugs_all):
                        warns.append(
                            f"镜 {bid}: 图名「{nm}」解析为 {'/'.join(sorted(nslugs))}"
                            f"，与章 token 的 {'/'.join(sorted(tok_slugs_all))} 不符"
                        )
        # 声明镜句区间零锚（ISSUE-188：按句统计，镜里挂了 archify 不构成回答）。
        # anchored 由 cue 侧收集——scenes 未写时恒空，随对账一并跳过
        if have_narr and have_cues:
            for bid, anns in declared:
                _l, _r = beat_range.get(bid, (-1, -1))
                if _l < 0:
                    continue
                sids_in = {sid for sid, i in idx.items() if _l <= i <= _r}
                if not (anchored & sids_in):
                    toks = (
                        ",".join(t for a in anns for t in a["tokens"]) or "（仅图名）"
                    )
                    fails.append(
                        f"镜 {bid}: 分镜声明 archify（{toks}）但句区间零锚"
                        "——「镜里挂了 archify」不构成回答（ISSUE-188）"
                    )
        # 反向：cue 未声明（分镜是意图摘要 → WARN）
        if declared:
            for _f, slug, cid, sid, _fit in cues:
                if (slug, cid) not in declared_pairs:
                    warns.append(
                        f"cue {slug}#{cid}（锚 {sid}）未在分镜声明——分镜陈旧或漏标注"
                    )
    elif cues:
        warns.append("storyboard.md 缺失——跳过声明镜锚定与双向对账")

    # ---- 匹配度：同 slug 章节播放顺序单调性（WARN） ----
    if have_cues and have_narr and views:
        by_slug: dict[str, list[tuple[int, int, str, str]]] = {}
        for _f, slug, cid, sid, _fit in cues:
            chapters = views.get(slug, [])
            pos = next((i for i, ch in enumerate(chapters) if ch["id"] == cid), -1)
            if sid in idx and pos >= 0:
                by_slug.setdefault(slug, []).append((idx[sid], pos, cid, sid))
        for slug, rows in by_slug.items():
            rows.sort()
            for (i1, p1, c1, s1), (_i2, p2, c2, s2) in zip(rows, rows[1:]):  # noqa: RUF007
                if p1 > p2:
                    l1 = next(
                        ch.get("label", c1) for ch in views[slug] if ch["id"] == c1
                    )
                    l2 = next(
                        ch.get("label", c2) for ch in views[slug] if ch["id"] == c2
                    )
                    warns.append(
                        f"{slug}: 章播放顺序 {c1}({l1})→{c2}({l2}) 逆序"
                        f"（锚句 {s1}→{s2}；叙事重组请人工确认）"
                    )

    # ---- 丰富度 ----
    if len(views_files) < min_diagrams:
        fails.append(f"图数 {len(views_files)} < 下限 {min_diagrams}（图例组不足）")
    if have_cues and len(cues) < min_cues:
        fails.append(f"cue 数 {len(cues)} < 下限 {min_cues}（图例丰富度不足）")
    # cue 密度：时长只认 audio manifest × timing（audio-first 唯一真相源）——
    # 缺任一点名 WARN 跳过，与 episode check_archify 的 rate 预演降级同先例，
    # 不用字数估算造第二时长真相源
    cpm_seen: float | None = None
    if have_cues:
        audio_f = root / "video" / "public" / "audio" / "manifest.json"
        if audio_f.is_file() and (root / "video" / "src" / "timing.json").is_file():
            try:
                consts = timeline.load_constants(root)
                items = json.loads(audio_f.read_text(encoding="utf-8"))
                minutes = (
                    timeline.total_duration_in_frames(items, consts)
                    / consts["fps"]
                    / 60
                )
                if minutes > 0:
                    cpm_seen = len(cues) / minutes
                    if cpm_seen < min_cpm:
                        fails.append(
                            f"cue 密度 {cpm_seen:.1f}/分钟 < 下限 {min_cpm}/分钟"
                            "（图例丰富度不足——单位时间内的演示密度）"
                        )
            except SystemExit:
                raise
            except (OSError, ValueError, KeyError) as e:
                warns.append(f"cue 密度计算失败（{e}）——跳过密度门")
        else:
            # ℹ️ 而非 WARN：pipeline.py check 在 tts 之前跑，audio 缺失是常态时序
            # 不是债；先跑 tts 再 check 即得密度判定
            infos.append(
                "audio/manifest.json 或 timing.json 缺失——跳过 cue 密度门（先跑 tts）"
            )
    # 图型多样性：sidecar 顶层 type（record_archify.py --type 落盘；旧 sidecar 由
    # scripts/archify_types.py 回填）。缺 type 归 untyped 计 1 种——旧集默认恒过
    types_seen: set[str] = set()
    untyped: list[str] = []
    for f in sidecars:
        try:
            t = json.loads(f.read_text(encoding="utf-8")).get("type")
        except json.JSONDecodeError:
            t = None
        if t:
            types_seen.add(t)
        else:
            untyped.append(f.stem)
    n_types = len(types_seen) + (1 if untyped else 0)
    if sidecars and n_types < min_types:
        fails.append(
            f"图型多样性 {n_types} 种（{'/'.join(sorted(types_seen)) or '无'}"
            f"{' + untyped' if untyped else ''}）< 下限 {min_types}"
            "——动效模型单一化"
        )
    if untyped:
        warns.append(
            f"{len(untyped)} 个 sidecar 缺 type 字段（归 untyped 计 1 种）："
            f"{'/'.join(untyped[:6])}{'…' if len(untyped) > 6 else ''}"
            "——用 scripts/archify_types.py 回填"
        )
    total_ch = 0
    if manifest is not None:
        total_ch = sum(len(d.get("chapters", [])) for d in manifest.values())
    elif views:
        total_ch = sum(len(v) for v in views.values())
    used_pairs = {(slug, cid) for _f, slug, cid, _sid, _ft in cues}
    if total_ch:
        used_ratio = len(used_pairs) / total_ch
        if have_cues and used_ratio < min_chapter:
            fails.append(
                f"被引用章 {len(used_pairs)}/{total_ch}（{used_ratio:.0%}）< 下限 {min_chapter:.0%}"
            )
    # 录而未落镜（manifest 优先——它证明录制发生过；无 manifest 时退 views）
    pool = manifest if manifest is not None else views
    for slug in pool:
        n = len(pool[slug].get("chapters", [])) if isinstance(pool[slug], dict) else 0
        if not any(s == slug for _f, s, _c, _sid, _ft in cues):
            warns.append(
                f"{slug}: {'manifest' if manifest is not None else 'views'} 有此图但无任何 cue 引用"
                f"（{n} 章白录）——接进场景或从 manifest 摘掉"
            )

    # ---- 输出 ----
    n_ch_view = sum(len(v) for v in views.values())
    pct = f"{len(anchored) / len(idx):.1%}" if have_narr and idx else "—"
    extra = []
    if cpm_seen is not None:
        extra.append(f"密度 {cpm_seen:.1f}/分")
    if sidecars:
        extra.append(f"图型 {n_types} 种")
    if max_run_seen is not None:
        extra.append(f"最长无锚 {max_run_seen} 句")
    tail = (" · " + " · ".join(extra)) if extra else ""
    print(
        f">> archify 覆盖门 · {root.name} · {len(views_files)} 图 / {n_ch_view} 章 / {len(cues)} cue · 锚定 {len(anchored)}/{len(idx) if have_narr else '—'}（{pct}）{tail}"
    )
    if have_narr and scene_order:
        print(f"  各幕锚定：{stat}")
    for i in infos:
        print(f"  ℹ️  {i}")
    for w in warns:
        print(f"  WARN {w}")
    for f in fails:
        print(f"  FAIL {f}")
    print(f">> FAIL {len(fails)} · WARN {len(warns)}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
