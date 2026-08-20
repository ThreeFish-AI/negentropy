#!/usr/bin/env python3
"""按句 id 从渲染产物中抽帧 + 自动视觉体检——公共管线版本。

时序常数直读 <工程>/video/src/timing.json（单一事实源，与 timing.ts / captions.py
同源），镜像常量已删除——工程改节奏只动 timing.json，本脚本自动跟随。

抽帧选择器（三选一）：
    <video.mp4> <句id>…            指定句（句中点帧）
    <video.mp4> --scene P1         该幕抽样至多 ~8 帧
    <video.mp4> --last-n 6         末 N 句——直指「末句短于 beat → 渐黑提前 → 长黑尾」
                                   上线 bug 的抽样盲区（尾幕必查）

自动体检（--check，惰性依赖 pillow+numpy）：
    黑帧/早渐黑    帧平均相对亮度 < 0.02 → FAIL（仅末 beat 且分镜末行写「渐黑」时豁免）
    字幕区侵入     字幕带 y∈[H-160,H) 内、字幕框 x 区间之外有独立亮列连通段 → WARN
                   （对应 skills/06 渲染缺陷清单第 2 条「角标 bottom ≥ 150」）
    冻帧           同幕相邻采样帧 16×16 灰度均值哈希 Hamming 距离 0 → WARN
                   （beat 窗口错位/未覆盖句区间渲染空白）
    字幕缺失       字幕带内无任何像素达文字亮度 → WARN（单句字幕渲染失败）

主题对比度（--check-theme，零依赖、不需要视频）：
    解析 video/src/design/theme.ts 的 #RRGGBB，按 WCAG 2.x 相对亮度对比
    theme.bg；概念色 < 4.5:1 → FAIL（此前只能肉眼估，见 skills/06 清单）。

用法：uv run --no-project [--with pillow --with numpy] media/pipeline/scripts/qa_frames.py \
          --project media/<工程> <video.mp4> [--scene P2|--last-n 6|句id…] [--check]
     uv run --no-project media/pipeline/scripts/qa_frames.py --project media/<工程> --check-theme
输出：抽帧 <工程>/out/frames/{句id}.png；体检结果打屏，FAIL 使退出码非零。
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # noqa: E402 - 导入同目录 timeline
from timeline import compute, load_constants  # noqa: E402

#: theme.ts 中颜色令牌（'#RRGGBB' 字面量）；bg 单独作为对比基准
THEME_COLOR_RE = re.compile(r"^\s{2}(?P<key>\w+):\s*'(?P<val>#[0-9A-Fa-f]{6})'", re.M)


def timeline(root: Path) -> dict[str, tuple[float, float]]:
    """读 manifest + timing.json，返回 {句id: (startSec, spanSec)}。"""
    manifest = root / "video" / "public" / "audio" / "manifest.json"
    if not manifest.is_file():
        sys.exit(f"manifest.json 不存在: {manifest} —— 先运行 scripts/tts.py 合成配音")
    items = json.loads(manifest.read_text(encoding="utf-8"))
    c = load_constants(root)
    return {r["id"]: (r["startSec"], r["spanSec"]) for r in compute(items, c)}


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
SUBTITLE_GAP_PX = 80  # 字幕框与角标亮块的横向最小间隔（全分辨率口径，随 --scale 折算）
TEXT_BRIGHTNESS = 0.45
CONTRAST_MIN = 4.5


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
    out: Path, ids: list[str], scale: float, fade_exempt_last: bool, msgs: list[str]
) -> None:
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        sys.exit(
            "--check 需要 pillow 与 numpy：uv run --no-project --with pillow --with numpy …"
        )

    band_px = round(SUBTITLE_BAND_PX * scale)
    gap_px = round(SUBTITLE_GAP_PX * scale)  # 横向间隔阈值与带高同口径折算
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
        if bright_px == 0:
            msgs.append(f"WARN {sid}: 字幕带内无文字亮度像素（字幕缺失？）")
        else:
            # 侵入检测按「亮列连通段」做：字幕框 = 最宽连通段；与它保持 >80px 间隔的
            # 其他亮段 = 角标/图形侵入字幕安全带（单纯 min–max 会被远端角标吞掉边界）
            col = band.max(axis=0)
            bright = col > TEXT_BRIGHTNESS
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
            if segments:
                x0, x1 = max(segments, key=lambda s: s[1] - s[0])  # 最宽段 = 字幕框
                for a, b in segments:
                    if (a < x0 - gap_px or a > x1 + gap_px) and (b - a) < (x1 - x0):
                        msgs.append(
                            f"WARN {sid}: 字幕带内字幕框（x{x0}–{x1}）之外有独立亮块 x{a}–{b}"
                            f"（角标/图形侵入 bottom≥{SUBTITLE_BAND_PX}px 安全区）"
                        )
        hashes[sid] = mean_hash(
            np.asarray(Image.open(png).convert("L").resize((16, 16)))
        )

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
    parser.add_argument("--scene", help="按幕抽样（如 P1）")
    parser.add_argument("--last-n", type=int, help="抽末 N 句（尾幕渐黑必查）")
    parser.add_argument(
        "--check", action="store_true", help="对抽出的帧做自动体检（需 pillow+numpy）"
    )
    parser.add_argument(
        "--check-theme",
        action="store_true",
        help="只做主题对比度检查（零依赖，无需视频）",
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

    if args.check_theme:
        msgs: list[str] = []
        check_theme(root, msgs)
        for m in msgs:
            print(f"  {m}")
        print(f">> --check-theme · FAIL {sum(m.startswith('FAIL') for m in msgs)}")
        sys.exit(1 if any(m.startswith("FAIL") for m in msgs) else 0)

    selectors = sum(bool(x) for x in (args.scene, args.last_n, args.ids))
    if not args.video or selectors != 1:
        parser.error(
            "需要 <video> 且 --scene / --last-n / ids 三选一（或用 --check-theme）"
        )

    video = Path(args.video).resolve()
    out = root / "out" / "frames"
    tl = timeline(root)
    offset = args.offset
    if args.scene:
        prefix = args.scene.lower() + "-"
        ids = [k for k in tl if k.startswith(prefix)]
        ids = ids[:: max(1, len(ids) // 8)]  # 每幕最多抽 ~8 帧
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
