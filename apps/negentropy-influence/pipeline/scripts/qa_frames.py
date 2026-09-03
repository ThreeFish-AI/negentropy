#!/usr/bin/env python3
"""按句 id 从渲染产物中抽帧 + 自动视觉体检——公共管线版本。

时序常数直读 <工程>/video/src/timing.json（单一事实源，与 timing.ts / captions.py
同源），镜像常量已删除——工程改节奏只动 timing.json，本脚本自动跟随。

抽帧选择器（三选一）：
    <video.mp4> <句id>…            指定句（句中点帧）
    <video.mp4> --scene P1         该幕抽样至多 ~8 帧
    <video.mp4> --last-n 6         末 N 句——直指「末句短于 beat → 渐黑提前 → 长黑尾」
                                   上线 bug 的抽样盲区（尾幕必查）
    <video.mp4> --beat-heads N [--scene P4]
                                   每 beat 头部连抽 N 帧（0..N-1）——ISSUE-170 的机械
                                   补盲：句中点采样结构性错过亚秒入场瞬态。可与 --scene
                                   组合过滤幕。此模式 --check 关闭冻帧判定（静止 beat
                                   的头帧指纹相同是合法态）
A/B 对拍（advisory，退出码恒 0，供重制/重构回归归因）：
    --compare A.mp4 B.mp4 --scene P4|<句id>…
                                   同帧号抽 A/B 两版逐帧差异（meanΔ / 差异像素占比 /
                                   变化区域 bbox），按占比降序——「不外溢的意图变更」
                                   之外的一切差异都应被归因后再接受

自动体检（--check，惰性依赖 pillow+numpy）：
    黑帧/早渐黑    帧平均相对亮度 < 0.02 → FAIL（仅末 beat 且分镜末行写「渐黑」时豁免）
    字幕区侵入     字幕框**上方**的安全带（y∈[H-160, H-132)）内出现宽度 ≥24px 的亮块
                   → WARN（对应 skills/06 渲染缺陷清单第 2 条「角标 bottom ≥ 150」）
    冻帧           同幕相邻采样帧 16×16 灰度均值哈希 Hamming 距离 0 → WARN
                   （beat 窗口错位/未覆盖句区间渲染空白）
    字幕缺失       字幕带内无任何像素达文字亮度 → WARN（单句字幕渲染失败）

主题对比度（--check-theme，零依赖、不需要视频）：
    解析 video/src/design/theme.ts 的 #RRGGBB，按 WCAG 2.x 相对亮度对比
    theme.bg；概念色 < 4.5:1 → FAIL（此前只能肉眼估，见 skills/06 清单）。

抽帧计划（--stills-plan，零依赖、不需要视频）：
    TTS 长跑中途的分幕复检排期器（skills/08 ★节步骤 2–3 的机械化）：读部分
    manifest + narration.json + storyboard beats，混合时间轴（timeline.blend）
    后按每镜中点帧号，逐行打印 `remotion still` 命令——复制即可执行，无需先有
    draft.mp4（`still` 直接渲帧，首帧打包 ~100s、后续 4–5s/帧）。

用法：uv run --no-project [--with pillow --with numpy] $R/qa_frames.py \
          --project $P <video.mp4> [--scene P2|--last-n 6|句id…] [--check]
     uv run --no-project $R/qa_frames.py --project $P --check-theme
     uv run --no-project $R/qa_frames.py --project $P --stills-plan [--chars-per-sec 5]
输出：抽帧 <工程>/out/frames/{句id}.png；体检结果打屏，FAIL 使退出码非零。
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from timeline import blend, compute, load_constants  # noqa: E402

#: theme.ts 中颜色令牌（'#RRGGBB' 字面量）；bg 单独作为对比基准
THEME_COLOR_RE = re.compile(
    r"^\s{2}(?P<key>\w+):\s*'(?P<val>#[0-9A-Fa-f]{6})'", re.MULTILINE
)


def timeline(root: Path) -> dict[str, tuple[float, float]]:
    """读 manifest + timing.json，返回 {句id: (startSec, spanSec)}。"""
    manifest = root / "video" / "public" / "audio" / "manifest.json"
    if not manifest.is_file():
        sys.exit(f"manifest.json 不存在: {manifest} —— 先运行 scripts/tts.py 合成配音")
    items = json.loads(manifest.read_text(encoding="utf-8"))
    c = load_constants(root)
    return {r["id"]: (r["startSec"], r["spanSec"]) for r in compute(items, c)}


def stills_plan(root: Path, chars_per_sec: float) -> None:
    """按分镜每镜中点打印 `remotion still` 命令行（混合部分 manifest 的时间轴）。

    复用 check_script 的分镜解析（BEAT_ROW_RE 形态同源）而不是再写一份——两个
    消费者读同一个 storyboard.md，解析规则分叉即 split-brain。
    """
    from check_script import parse_storyboard

    board = root / "script" / "storyboard.md"
    if not board.is_file():
        sys.exit(f"storyboard.md 不存在: {board} —— 分镜复检的前置是分镜本身")
    beats = parse_storyboard(board)
    if not beats:
        sys.exit(f"未能从 {board} 解析出任何 beat 行（格式变化？）")

    manifest = root / "video" / "public" / "audio" / "manifest.json"
    narration = root / "script" / "narration.json"
    # manifest 缺失/部分句缺失都合法（长跑中途本来就只有一部分）：实测口径有多少
    # 用多少，其余按语速外推（timeline.blend 的职责）。
    m_items = (
        json.loads(manifest.read_text(encoding="utf-8")) if manifest.is_file() else []
    )
    measured = {i["id"]: i["durationSec"] for i in m_items}
    items = json.loads(narration.read_text(encoding="utf-8"))
    rows = compute(blend(items, measured, chars_per_sec), load_constants(root))
    by_id = {r["id"]: r for r in rows}
    ids = [r["id"] for r in rows]

    covered = len(measured)
    print(
        f">> 抽帧计划 · {root.name} · {len(beats)} 镜 · "
        f"实测 {covered}/{len(items)} 句（其余按 {chars_per_sec:g} 字/秒外推）\n"
        f"    在 video/ 目录下执行（首帧含打包 ~100s，之后每帧 4–5s）："
    )
    for beat_id, left, right, _cell in beats:
        if left not in by_id or right not in by_id:
            print(
                f"    # 镜 {beat_id}：句区间 {left}..{right} 不在 narration.json，跳过"
            )
            continue
        a, b = ids.index(left), ids.index(right)
        mid = rows[(a + b) // 2]  # 镜中点：区间内句的时长加权中位近似——取中段句中点
        frame = mid["fromFrame"] + mid["durationInFrames"] // 2
        out = f"out/still-{beat_id}.png"
        print(
            f"    ./node_modules/.bin/remotion still Main {out} "
            f"--frame={frame} --scale=0.4   # 镜 {beat_id}（{left}..{right}）"
        )


def beat_head_samples(
    beats: list[tuple[str, str, str, str]],
    tl: dict[str, tuple[float, float]],
    fps: int,
    n: int,
    offset: float = 0.0,
    scene_filter: list[str] | None = None,
) -> list[tuple[str, float]]:
    """每 beat 头部连抽 N 帧的 (帧名, 时间戳)。beat 起点 = 其首句 start。

    纯函数（tests/test_qa_checks 对拍黄金帧号）。scene_filter 形如 ['P4']：按
    镜号数字前缀过滤（0-A → P0）。区间首句不在 manifest 时跳过该 beat（分镜陈旧）。
    """
    samples: list[tuple[str, float]] = []
    for beat_id, left, _right, _cell in beats:
        if scene_filter and beat_id.split("-")[0] not in {
            sf.upper().lstrip("P") for sf in scene_filter
        }:
            continue
        if left not in tl:
            continue
        start = tl[left][0]
        for i in range(max(1, n)):
            samples.append((f"{beat_id}-h{i}", start + i / fps - offset))
    return samples


def frame_diff(a: Path, b: Path) -> dict:
    """两帧的差异摘要（纯函数，供 --compare 与单测）。

    mean：RGB 三通道平均绝对差（0-255）；frac：任一通道差 > DIFF_JND 的像素占比；
    bbox：差异像素的包围盒 (x0, y0, x1, y1)，全同帧为 None。JND 取 12——抗 jpeg
    压缩噪声的经验下限，非感知模型。
    """
    import numpy as np
    from PIL import Image

    A = np.asarray(Image.open(a).convert("RGB"), dtype=np.float32)
    B = np.asarray(Image.open(b).convert("RGB"), dtype=np.float32)
    if A.shape != B.shape:
        return {"mean": 255.0, "frac": 1.0, "bbox": None, "shape_mismatch": True}
    d = np.abs(A - B).max(axis=2)
    mask = d > DIFF_JND
    if not mask.any():
        return {"mean": float(np.abs(A - B).mean()), "frac": 0.0, "bbox": None}
    ys, xs = np.nonzero(mask)
    return {
        "mean": float(np.abs(A - B).mean()),
        "frac": float(mask.mean()),
        "bbox": (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())),
    }


def extract_frame(
    ffmpeg: list[str], video: Path, cwd: Path, ts: float, dst: Path
) -> None:
    try:
        subprocess.run(
            [
                *ffmpeg,
                "-y",
                "-ss",
                f"{ts:.3f}",
                "-i",
                str(video),
                "-frames:v",
                "1",
                "-update",
                "1",
                str(dst),
            ],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        print(f"ffmpeg 失败({dst.stem}): {(e.stderr or '')[-500:]}")
        raise


# ---------------- 自动体检（--check / --check-theme） ----------------

#: 亮度/对比阈值（经验值：深色底 #0E1116 的相对亮度 ≈ 0.006）
BLACK_MEAN_LIMIT = 0.02
SUBTITLE_BAND_PX = 160  # 字幕安全带高度（对应「bottom ≥ 150」清单位）
TEXT_BRIGHTNESS = 0.45
#: 字幕框占据安全带底部的高度（全分辨率像素）。来自 Subtitle.tsx 的**已知几何**：
#: 框顶距画底 = marginBottom 54 + 上下 padding 各 12 + 行高 fontSize(≤44)×1.35 = 137.4；
#: 墨水顶距画底实测 ≈118（44px 满字号，CJK em box 顶在行盒内还有半行距余量）。
#: 检查线取 132——在框顶 137.4 之下、墨水顶 118 之上，即窄带下缘只探进框顶 padding
#: （无墨水区），既不漏检框顶附近的侵入物，也不被字幕笔画误报。
#: 侵入检测只看**框上方**这条窄带——「角标/图形是否压进字幕安全区」本就是这个问题。
#:
#: 为什么不用「亮列连通段 + 最宽段=字幕框」的老判据（2026-08-21 废弃）：Subtitle.tsx
#: 的底是半透明 rgba(6,8,12,0.68) 压在 #0E1116 上，实测灰度仅 ≈0.10–0.14，而文字笔画
#: 0.45+。用文字阈值找框 → 每个汉字成一段（14 字字幕 → 14 段，最宽段 20px）→ 每帧刷
#: 十几条假报（本集全片 500+ 条 WARN，逐帧目检画面完全干净）；改用低阈值找框也不稳：
#: 抗锯齿会把框切碎，而放宽到能连成片时又与页面底色（0.045）区分不开。几何法无这些
#: 自由度，且与「bottom ≥ 150」这条清单位是同一口径。
SUBTITLE_BOX_H_PX = 132
#: 侵入物最小宽度（全分辨率像素，随 scale 折算）：窄于此的多是抗锯齿碎片
INTRUSION_MIN_W_PX = 24
CONTRAST_MIN = 4.5
#: A/B 对拍的逐像素刚可辨差异（just-noticeable diff 的经验值）
DIFF_JND = 12


def bright_segments(col, threshold: float) -> list[tuple[int, int]]:
    """列向亮度投影中，超过 threshold 的连通段 [(起, 止), …]（闭区间）。

    `col` 是 numpy 1-D 数组，但**刻意不加类型标注**：numpy 在本模块是
    `check_frames` 内的惰性导入（`--check` 才需要，`--check-theme` 零依赖），
    模块级没有 `np` 这个名字，标注会触发 F821。
    """
    bright = col > threshold
    segments: list[tuple[int, int]] = []
    i = 0
    while i < len(col):
        if bright[i]:
            j = i
            while j < len(col) and bright[j]:
                j += 1
            segments.append((i, j - 1))
            i = j
        else:
            i += 1
    return segments


def rel_luminance(r: int, g: int, b: int) -> float:
    def ch(v: float) -> float:
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    return 0.2126 * ch(r / 255) + 0.7152 * ch(g / 255) + 0.0722 * ch(b / 255)


def wcag_ratio(fg: tuple[int, int, int], bg: tuple[int, int, int]) -> float:
    l1, l2 = rel_luminance(*fg), rel_luminance(*bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def check_theme(root: Path, msgs: list[str]) -> None:
    theme = root / "video" / "src" / "design" / "theme.ts"
    if not theme.is_file():
        sys.exit(f"theme.ts 不存在: {theme}")
    colors = {
        m.group("key"): m.group("val")
        for m in THEME_COLOR_RE.finditer(theme.read_text(encoding="utf-8"))
    }
    if "bg" not in colors:
        sys.exit(f"{theme} 未解析出 bg 颜色令牌")

    def hex_rgb(h: str) -> tuple[int, int, int]:
        return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)

    bg = hex_rgb(colors["bg"])
    print(f">> 主题对比度 · 基准 bg {colors['bg']}")
    for key, val in colors.items():
        if key in ("bg", "panel", "panelBorder") or key.endswith("Deep"):
            continue  # 容器/描边色不承载正文信息
        ratio = wcag_ratio(hex_rgb(val), bg)
        mark = "✅" if ratio >= CONTRAST_MIN else "❌"
        print(f"  {mark} {key:<10} {val}  对 bg 对比度 {ratio:.2f}:1")
        if ratio < CONTRAST_MIN:
            msgs.append(
                f"FAIL {key} {val} 对 bg 对比度 {ratio:.2f}:1 < {CONTRAST_MIN}（skills/06 视觉契约：概念色须 ≥4.5:1）"
            )


def mean_hash(gray) -> int:
    """16×16 灰度均值哈希（dHash 简化版）：以均值为阈值的位图指纹。"""
    bits = 0
    avg = float(gray.mean())
    for v in gray.flatten():
        bits = (bits << 1) | (1 if float(v) > avg else 0)
    return bits


def tail_row_has_fade(board: Path) -> bool:
    """分镜表**最后一个表格行**（`| … |`）是否含「渐黑」——末 beat 渐黑豁免判据。

    按表格行而非文件末行：分镜表末尾常跟「字幕规范/实现映射」散文节，
    文件末 5 行判定会让豁免永不命中（EP1/EP2 实测如此，渐黑行距文件末约 10 行）。
    """
    if not board.is_file():
        return False
    rows = [
        ln
        for ln in board.read_text(encoding="utf-8").splitlines()
        if ln.strip().startswith("|")
    ]
    return bool(rows) and any("渐黑" in ln for ln in rows[-2:])


def check_frames(
    out: Path,
    ids: list[str],
    scale: float,
    fade_exempt_last: bool,
    msgs: list[str],
    freeze_check: bool = True,
    subtitle_check: bool = True,
) -> None:
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        sys.exit(
            "--check 需要 pillow 与 numpy：uv run --no-project --with pillow --with numpy …"
        )

    band_px = round(SUBTITLE_BAND_PX * scale)
    min_w_px = round(INTRUSION_MIN_W_PX * scale)  # 侵入物最小宽度，同口径折算
    box_h_px = round(SUBTITLE_BOX_H_PX * scale)  # 字幕框高度，同口径折算
    hashes: dict[str, int] = {}
    ordered: list[tuple[str, Path]] = []
    for sid in ids:
        png = out / f"{sid}.png"
        if not png.is_file():
            continue
        ordered.append((sid, png))
        img = np.asarray(Image.open(png).convert("L"), dtype=np.float32) / 255.0
        mean = float(img.mean())
        is_last = ordered.index((sid, png)) == len(ids) - 1
        if mean < BLACK_MEAN_LIMIT and not (fade_exempt_last and is_last):
            msgs.append(
                f"FAIL {sid}: 帧平均亮度 {mean:.4f} < {BLACK_MEAN_LIMIT}（黑帧/渐黑过早）"
            )
        band = img[img.shape[0] - band_px :, :] if band_px else img
        bright_px = float((band > TEXT_BRIGHTNESS).mean())
        # 字幕缺失只在句中点采样下有意义：beat 头帧落在句首淡入与句间空隙，
        # 无字幕是合法态（--beat-heads 传 subtitle_check=False）
        if subtitle_check and bright_px == 0:
            msgs.append(f"WARN {sid}: 字幕带内无文字亮度像素（字幕缺失？）")
        elif band_px > box_h_px:
            # 侵入检测按**几何**做（见 SUBTITLE_BOX_H_PX 注释）：只看字幕框上方那条窄带，
            # 里面出现宽于 min_w_px 的亮块 = 角标/图形压进了字幕安全区。
            above = band[: band_px - box_h_px, :]
            for a, b in bright_segments(above.max(axis=0), TEXT_BRIGHTNESS):
                if (b - a + 1) >= min_w_px:  # 闭区间：真实宽度 = b - a + 1
                    msgs.append(
                        f"WARN {sid}: 字幕框上方安全带内有亮块 x{a}–{b}"
                        f"（角标/图形侵入 bottom≥{SUBTITLE_BAND_PX}px 安全区）"
                    )
        hashes[sid] = mean_hash(
            np.asarray(Image.open(png).convert("L").resize((16, 16)))
        )

    if freeze_check:
        for (a, _), (b, _) in zip(ordered, ordered[1:], strict=False):
            if a.rsplit("-", 1)[0][:2] == b.rsplit("-", 1)[0][:2]:  # 同幕前缀
                if hashes[a] == hashes[b]:
                    msgs.append(f"WARN {a} 与 {b} 帧指纹相同（疑似冻帧/beat 窗口错位）")


# ---------------- main ----------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="按句 id 抽帧视觉 QA + 自动体检",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--project", default=".", help="视频工程根目录（含 video/ 与 out/）"
    )
    # action="append"：可重复传（`--scene P0 --scene P1`）。原先是单值 store——
    # 重复传时 argparse **静默只留最后一个**，于是「七幕体检」实际只查了末幕，
    # 而输出的 `FAIL 0` 长得跟全幕通过一模一样（本轮 EP2 交付前踩过：以为查了 7 幕，
    # 实际只查了 P6）。静默缩小检查面的默认值比报错更贵，故改为累积。
    parser.add_argument(
        "--scene", action="append", metavar="Pn", help="按幕抽样（如 P1；可重复传多幕）"
    )
    parser.add_argument("--last-n", type=int, help="抽末 N 句（尾幕渐黑必查）")
    parser.add_argument(
        "--check", action="store_true", help="对抽出的帧做自动体检（需 pillow+numpy）"
    )
    parser.add_argument(
        "--beat-heads",
        type=int,
        metavar="N",
        help="每 beat 头部连抽 N 帧（0..N-1，fps 间隔）——入场瞬态的机械补盲"
        "（ISSUE-170）；只可与 --scene 组合，此模式下 --check 关闭冻帧判定",
    )
    parser.add_argument(
        "--compare",
        nargs=2,
        metavar=("A.mp4", "B.mp4"),
        help="A/B 对拍：同帧号抽两版逐帧差异（advisory；需 --scene/--last-n/ids 之一）",
    )
    parser.add_argument(
        "--check-theme",
        action="store_true",
        help="只做主题对比度检查（零依赖，无需视频）",
    )
    parser.add_argument(
        "--stills-plan",
        action="store_true",
        help="只打印分幕复检的 remotion still 命令计划（零依赖，无需视频；"
        "实测句用 manifest 时长、其余按语速外推）",
    )
    parser.add_argument(
        "--chars-per-sec",
        type=float,
        default=5.0,
        help="[--stills-plan] 未合成句的外推语速（字/秒；首集实测起步值 300 字/分）",
    )
    parser.add_argument(
        "--scale",
        type=float,
        default=1.0,
        help="渲染产物缩放系数（草渲 0.5），供字幕带像素折算",
    )
    parser.add_argument(
        "--offset",
        type=float,
        default=0.0,
        help="时间轴整体偏移（草渲与终渲时间基准不一致时用）",
    )
    parser.add_argument("video", nargs="?", help="渲染产物 mp4 路径")
    parser.add_argument("ids", nargs="*", help="句 id 列表")
    args = parser.parse_args()

    root = Path(args.project).resolve()

    if args.stills_plan:
        stills_plan(root, args.chars_per_sec)
        return

    if args.check_theme:
        msgs: list[str] = []
        check_theme(root, msgs)
        for m in msgs:
            print(f"  {m}")
        print(f">> --check-theme · FAIL {sum(m.startswith('FAIL') for m in msgs)}")
        sys.exit(1 if any(m.startswith("FAIL") for m in msgs) else 0)

    selectors = sum(bool(x) for x in (args.scene, args.last_n, args.ids))
    if args.beat_heads:
        if args.last_n or args.ids:
            parser.error("--beat-heads 只可与 --scene 组合过滤幕")
        if not args.video:
            parser.error("--beat-heads 需要 <video>")
    elif args.compare:
        if selectors != 1:
            parser.error("--compare 需要 --scene / --last-n / ids 之一指定对拍帧")
    elif not args.video or selectors != 1:
        parser.error(
            "需要 <video> 且 --scene / --last-n / ids 三选一（或用 --check-theme）"
        )

    tl = timeline(root)
    offset = args.offset

    if args.compare:
        # A/B 对拍：同帧号抽两版，差异摘要按占比降序（advisory，退出码恒 0）
        from check_script import parse_storyboard  # noqa: PLC0415 - 同目录模块

        va, vb = (Path(x).resolve() for x in args.compare)
        ids = (
            [k for sc in args.scene for k in tl if k.startswith(sc.lower() + "-")]
            if args.scene
            else (list(tl)[-args.last_n :] if args.last_n else args.ids)
        )
        out_ab = root / "out" / "frames-ab"
        out_ab.mkdir(parents=True, exist_ok=True)
        ffmpeg = ["pnpm", "exec", "remotion", "ffmpeg"]
        rows: list[tuple[str, dict]] = []
        for sid in ids:
            if sid not in tl:
                print(f"跳过未知句 id: {sid}")
                continue
            ts = tl[sid][0] + tl[sid][1] / 2 - offset
            fa, fb = out_ab / f"{sid}.a.png", out_ab / f"{sid}.b.png"
            extract_frame(ffmpeg, va, root / "video", ts, fa)
            extract_frame(ffmpeg, vb, root / "video", ts, fb)
            rows.append((sid, frame_diff(fa, fb)))
            print(f"{sid} @ {ts:.2f}s 已对拍")
        rows.sort(key=lambda r: r[1]["frac"], reverse=True)
        print()
        for sid, d in rows:
            bbox = d["bbox"]
            print(
                f"  {sid}: meanΔ {d['mean']:6.2f} · 差异像素 {d['frac'] * 100:5.1f}%"
                + (f" · bbox {bbox}" if bbox else "")
            )
        hot = sum(1 for _, d in rows if d["frac"] > 0.05)
        print(
            f">> A/B 对拍 {len(rows)} 帧 · 差异像素 >5% 共 {hot} 帧"
            "（差异帧须逐一归因后才能接受；工具不替人判定「变好还是变坏」）"
        )
        return

    video = Path(args.video).resolve()
    out = root / "out" / "frames"
    if args.beat_heads:
        from check_script import parse_storyboard  # noqa: PLC0415 - 同目录模块

        board = root / "script" / "storyboard.md"
        if not board.is_file():
            sys.exit(f"storyboard.md 不存在: {board} —— --beat-heads 需要分镜表")
        samples = beat_head_samples(
            parse_storyboard(board),
            tl,
            load_constants(root)["fps"],
            args.beat_heads,
            offset,
            args.scene,
        )
        out.mkdir(parents=True, exist_ok=True)
        ffmpeg = ["pnpm", "exec", "remotion", "ffmpeg"]
        extracted: list[str] = []
        for name, ts in samples:
            dst = out / f"{name}.png"
            extract_frame(ffmpeg, video, root / "video", ts, dst)
            extracted.append(name)
            print(f"{name} @ {ts:.2f}s -> {dst.relative_to(root)}")
        if args.check:
            board_fade = tail_row_has_fade(board)
            msgs: list[str] = []
            check_frames(
                out,
                extracted,
                args.scale,
                board_fade,
                msgs,
                freeze_check=False,
                subtitle_check=False,
            )
            for m in msgs:
                print(f"  {m}")
            n_fail = sum(m.startswith("FAIL") for m in msgs)
            print(
                f">> beat 头部体检 · FAIL {n_fail} ·"
                f" WARN {sum(m.startswith('WARN') for m in msgs)}（冻帧判定已关闭）"
            )
            sys.exit(1 if n_fail else 0)
        return
    if args.scene:
        # 每幕**独立**抽样再拼接：抽样步长按各幕自身句数算，否则多幕合并后
        # 步长被总数放大，句少的幕会被整幕跳过（静默漏检，与 --scene 单值那个
        # 坑同族）。幕序按 tl 的出现顺序，与传参顺序无关。
        ids = []
        for scene in args.scene:
            prefix = scene.lower() + "-"
            scene_ids = [k for k in tl if k.startswith(prefix)]
            if not scene_ids:
                print(f"跳过无匹配句的幕: {scene}")
                continue
            ids += scene_ids[:: max(1, len(scene_ids) // 8)]  # 每幕最多抽 ~8 帧
    elif args.last_n:
        ids = list(tl)[-args.last_n :]
    else:
        ids = args.ids

    out.mkdir(parents=True, exist_ok=True)
    ffmpeg = ["pnpm", "exec", "remotion", "ffmpeg"]
    extracted: list[str] = []
    for sid in ids:
        if sid not in tl:
            print(f"跳过未知句 id: {sid}")
            continue
        start, dur = tl[sid]
        ts = start + dur / 2 - offset
        dst = out / f"{sid}.png"
        extract_frame(ffmpeg, video, root / "video", ts, dst)
        extracted.append(sid)
        print(f"{sid} @ {ts:.2f}s -> {dst.relative_to(root)}")

    if args.check:
        # 末 beat 渐黑豁免：分镜**最后一个表格行**含「渐黑」字样时，最后一个抽帧允许黑。
        # 按表格行而非文件末行——分镜表末尾常跟「字幕规范/实现映射」散文节，文件末行
        # 判定会让豁免永不命中（EP1/EP2 实测如此）。
        board = root / "script" / "storyboard.md"
        fade_tail = tail_row_has_fade(board)
        msgs: list[str] = []
        check_frames(out, extracted, args.scale, fade_tail, msgs)
        for m in msgs:
            print(f"  {m}")
        n_fail = sum(m.startswith("FAIL") for m in msgs)
        print(
            f">> 自动体检 · FAIL {n_fail} · WARN {sum(m.startswith('WARN') for m in msgs)}"
        )
        sys.exit(1 if n_fail else 0)


if __name__ == "__main__":
    main()
