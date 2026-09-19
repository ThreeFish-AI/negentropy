"""archify 回放的结构性体检（qa_frames.py 是 frozen 档，故另起本脚本）。

只查**结构**，不查画面语义 —— 画面正确性只能靠 `remotion still` 逐帧目视
（`qa_frames --check` 对图层遮挡与时序错位全盲，见 issue.md ISSUE-167/170/177）。

三项判据：
  1. manifest × views 一致：manifest 里每个章节都能在对应 HTML 的 views 里找到；
  2. **rate 预演**：按 TTS 实测 manifest 算每个 cue 的真实 playbackRate，越界
     [0.7, 1.35] 即 FAIL 并给出建议 —— 把编排失衡提前到渲染前最便宜的时刻；
  3. 素材完整：webm / 末帧 PNG 存在且非空、measured_fps ≥ 18。

用法（工程根）：uv run --no-project scripts/check_archify.py
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIFY = ROOT / "video" / "public" / "archify"
SCENES = ROOT / "video" / "src" / "scenes"
MANIFEST_TS = ROOT / "video" / "src" / "archify.manifest.ts"
AUDIO = ROOT / "video" / "public" / "audio" / "manifest.json"
RATE_MIN, RATE_MAX, MIN_FPS = 0.7, 1.35, 18.0

sys.path.insert(0, str(ROOT.parent.parent / "pipeline" / "scripts"))
import timeline  # noqa: E402  —— 必须在 sys.path 注入之后导入


def load_manifest() -> dict:
    m = re.search(
        r"export const ARCHIFY = ([\s\S]+?) as const", MANIFEST_TS.read_text("utf-8")
    )
    if not m:
        raise SystemExit(
            "FAIL: archify.manifest.ts 解析失败——先跑 scripts/archify_manifest.py"
        )
    return json.loads(m.group(1))


def scene_cues() -> list[tuple[str, str, str]]:
    """从场景代码抽 (slug, chapterId, 锚句 id)。

    末尾的计数断言是必要的：本函数只认 `at: at('句id')` 形态，写成
    `at: 0, durationInFrames: bX.durationInFrames` 的 cue 会被静默漏掉 —— 2026-09-19
    实测正因此让 29 个 cue 只报了 27 个，漏掉的那个 rate 0.62 越界却没进 hold 清单，
    `--stills` 也没给它排抽帧。少算不报错等于门形同虚设，故漏识别一律硬失败。
    """
    out = []
    declared = 0
    for f in sorted(SCENES.glob("P*.tsx")):
        src = f.read_text("utf-8")
        declared += len(re.findall(r"chapterId:", src))
        for blk in re.finditer(r"<ArchifyRecap\b([\s\S]{0,2200}?)/>", src):
            body = blk.group(1)
            sm = re.search(r'slug="([^"]+)"', body)
            if not sm:
                continue
            for c in re.finditer(
                r"chapterId:\s*'([^']+)',\s*at:[^,]*?at\('([a-z0-9-]+)'\)", body
            ):
                out.append((sm.group(1), c.group(1), c.group(2)))
    if len(out) != declared:
        raise SystemExit(
            f"FAIL: 场景里声明了 {declared} 个 cue，只识别出 {len(out)} 个。\n"
            "      漏掉的写法请改成 `at: at('句id') - bX.from` + "
            "`dur('句id')`（单句 beat 与 `at: 0` 完全等价；dur 是各 scene 里与 at "
            "对称的取长辅助，不写 w('句id') 字面形态是为了不让 check_scenes 把镜内"
            "叠加层登记成镜区间）。"
        )
    return out


def emit_stills(man: dict, cues: list[tuple[str, str, str]]) -> None:
    """打印每个 archify cue 的**边界帧**抽帧命令（K1 入场 / K4 退场）。

    刻意不用 qa_frames --stills-plan：它打的是每镜**中点**，而 archify 对位要看的
    恰恰是边界——「章节换了没有」「字幕跟着换了没有」只在边界帧上可判。
    """
    items = json.loads(AUDIO.read_text("utf-8"))
    c = timeline.load_constants(ROOT)
    rows = {r["id"]: r for r in timeline.compute(items, c)}
    print("# archify 对位抽帧（工程根 video/ 下执行）")
    for slug, cid, sid in cues:
        r = rows.get(sid)
        ch = next((x for x in man[slug]["chapters"] if x["id"] == cid), None)
        if r is None or ch is None:
            continue
        k1 = r["fromFrame"] + 3
        k4 = r["fromFrame"] + r["durationInFrames"] - 4
        for tag, fr in (("K1入场", k1), ("K4退场", k4)):
            print(
                f"./node_modules/.bin/remotion still src/index.ts Main "
                f"out/k/{slug}--{cid}-{tag}-{fr}.png --frame={fr} --scale=0.5 "
                f"--log=error   # 期望：{ch['label']} · 首拍 {ch['beatNodes'][0]} / "
                f"末拍 {ch['beatNodes'][-1]} · 字幕={sid}"
            )


def main() -> None:
    ap = argparse.ArgumentParser(description="archify 回放结构门")
    ap.add_argument("--stills", action="store_true", help="只打印边界帧抽帧命令")
    args = ap.parse_args()
    fails: list[str] = []
    warns: list[str] = []
    man = load_manifest()

    # ① manifest × views 一致
    for slug, d in man.items():
        vf = ARCHIFY / "views" / f"{slug}.json"
        if not vf.is_file():
            fails.append(f"{slug}: 缺 views/{slug}.json")
            continue
        vids = {v["id"] for v in json.loads(vf.read_text("utf-8"))}
        for ch in d["chapters"]:
            if ch["id"] not in vids:
                fails.append(f"{slug}/{ch['id']}: manifest 有此章但 views 里没有")

    # ③ 素材完整
    n_ch = 0
    for slug, d in man.items():
        for ch in d["chapters"]:
            n_ch += 1
            for key in ("file", "endStill"):
                p = ARCHIFY / ch[key]
                if not p.is_file() or p.stat().st_size == 0:
                    fails.append(f"{slug}/{ch['id']}: 缺素材 {ch[key]}")
        sc = ARCHIFY / f"{slug}.json"
        if sc.is_file():
            fps = json.loads(sc.read_text("utf-8")).get("measured_fps")
            if fps is not None and fps < MIN_FPS:
                warns.append(f"{slug}: 录制均帧率 {fps} < {MIN_FPS}，建议重录")

    # ② rate 预演（需 TTS manifest）
    cues = scene_cues()

    # ④ 录了但没落镜：manifest 里有图、却没有任何 cue 引用它 —— 2026-09-19 实测
    #    evolution-timeline / autopilot-loop 各 3 章白录，而文档仍写着 14 张进片。
    unused = sorted(set(man) - {slug for slug, _, _ in cues})
    for slug in unused:
        warns.append(
            f"{slug}: manifest 有此图但无任何 cue 引用（{len(man[slug]['chapters'])} 章白录）"
            "——接进场景或从 manifest 摘掉"
        )

    if args.stills:
        if not AUDIO.is_file():
            raise SystemExit("需要 audio/manifest.json（先跑 tts）")
        emit_stills(man, cues)
        return
    explicit_stretch: set[tuple[str, str, str]] = set()  # 目前无 cue 写死 stretch
    fitted = {"stretch": 0, "hold": 0, "trim": 0}
    holds: list[str] = []
    if not AUDIO.is_file():
        warns.append("audio/manifest.json 未生成——**跳过 rate 预演门**（合成后复跑）")
    else:
        items = json.loads(AUDIO.read_text("utf-8"))
        c = timeline.load_constants(ROOT)
        dur = {r["id"]: r["durationInFrames"] for r in timeline.compute(items, c)}
        fps = c["fps"]
        for slug, cid, sid in cues:
            ch = next((x for x in man[slug]["chapters"] if x["id"] == cid), None)
            if ch is None:
                fails.append(f"{slug}/{cid}: 场景引用了 manifest 里不存在的章节")
                continue
            if sid not in dur:
                fails.append(f"{slug}/{cid}: 锚句 {sid} 不在 narration/manifest")
                continue
            rate = ch["storySec"] / (dur[sid] / fps)
            # 与 ArchifyRecap.pickFit 同构：越界会自动降到 hold/trim，不是缺陷。
            # 只有**显式写死 fit='stretch'** 且越界才会在渲染期抛错。
            explicit = (slug, cid, sid) in explicit_stretch
            if RATE_MIN <= rate <= RATE_MAX:
                fitted["stretch"] += 1
            elif explicit:
                want = ch["storySec"] / RATE_MAX, ch["storySec"] / RATE_MIN
                fails.append(
                    f"{slug}/{cid} @ {sid}: 显式 fit='stretch' 但 playbackRate "
                    f"{rate:.2f} 越界 [{RATE_MIN}, {RATE_MAX}]；该句需落在 "
                    f"{want[0]:.1f}–{want[1]:.1f}s，或去掉显式 fit 让它自动降档"
                )
            elif rate < RATE_MIN:
                fitted["hold"] += 1
                holds.append(
                    f"{slug}/{cid}@{sid} 章 {ch['storySec']:.1f}s < 句 "
                    f"{dur[sid] / fps:.1f}s → 播完冻结尾帧"
                )
            else:
                fitted["trim"] += 1
                holds.append(
                    f"{slug}/{cid}@{sid} 章 {ch['storySec']:.1f}s > 句 "
                    f"{dur[sid] / fps:.1f}s → 原速播、父级裁切"
                )
        print(
            f"  rate 预演：{len(cues)} 个 cue —— "
            f"变速铺满 {fitted['stretch']} · 冻结补足 {fitted['hold']} · 裁切 {fitted['trim']}"
        )
        for h in holds:
            print(f"    · {h}")

    print(f">> archify 体检 · {len(man)} 图 / {n_ch} 章 / {len(cues)} cue")
    for w in warns:
        print(f"  WARN {w}")
    for f in fails:
        print(f"  FAIL {f}")
    print(f">> FAIL {len(fails)} · WARN {len(warns)}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
