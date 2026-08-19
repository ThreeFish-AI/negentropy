#!/usr/bin/env python3
"""按句 id 从渲染产物中抽帧，用于视觉 QA——公共管线版本。

时序常数直读 <工程>/video/src/timing.json（单一事实源，与 timing.ts / captions.py
同源），镜像常量已删除——工程改节奏只动 timing.json，本脚本自动跟随。

用法：uv run --no-project media/pipeline/scripts/qa_frames.py --project media/<工程> \
          <video.mp4> <句id> [句id ...]
     uv run --no-project media/pipeline/scripts/qa_frames.py --project media/<工程> \
          <video.mp4> --scene P1        # 该幕抽样至多 ~8 帧（与 ids 二选一）
输出：<工程>/out/frames/{句id}.png
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # noqa: E402 - 导入同目录 timeline
from timeline import compute, load_constants  # noqa: E402


def timeline(root: Path) -> dict[str, tuple[float, float]]:
    """读 manifest + timing.json，返回 {句id: (startSec, spanSec)}。"""
    manifest = root / "video" / "public" / "audio" / "manifest.json"
    if not manifest.is_file():
        sys.exit(
            f"manifest.json 不存在: {manifest} —— 先运行 scripts/tts.py 合成配音"
        )
    items = json.loads(manifest.read_text(encoding="utf-8"))
    c = load_constants(root)
    return {r["id"]: (r["startSec"], r["spanSec"]) for r in compute(items, c)}


def main() -> None:
    parser = argparse.ArgumentParser(description="按句 id 抽帧视觉 QA")
    parser.add_argument(
        "--project", default=".", help="视频工程根目录（含 video/ 与 out/）"
    )
    parser.add_argument("--scene", help="按幕抽样（如 P1），与位置参数 ids 二选一")
    parser.add_argument(
        "--offset",
        type=float,
        default=0.0,
        help="时间轴整体偏移（草渲与终渲时间基准不一致时用）",
    )
    parser.add_argument("video", help="渲染产物 mp4 路径")
    parser.add_argument("ids", nargs="*", help="句 id 列表（与 --scene 二选一）")
    args = parser.parse_args()
    if bool(args.scene) == bool(args.ids):
        parser.error("ids 与 --scene 必须二选一")

    root = Path(args.project).resolve()
    video = Path(args.video).resolve()
    out = root / "out" / "frames"

    tl = timeline(root)
    offset = args.offset
    if args.scene:
        prefix = args.scene.lower() + "-"
        ids = [k for k in tl if k.startswith(prefix)]
        ids = ids[:: max(1, len(ids) // 8)]  # 每幕最多抽 ~8 帧
    else:
        ids = args.ids

    out.mkdir(parents=True, exist_ok=True)
    ffmpeg = ["pnpm", "exec", "remotion", "ffmpeg"]
    for sid in ids:
        if sid not in tl:
            print(f"跳过未知句 id: {sid}")
            continue
        start, dur = tl[sid]
        ts = start + dur / 2 - offset
        dst = out / f"{sid}.png"
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
                cwd=root / "video",
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            print(f"ffmpeg 失败({sid}): {(e.stderr or '')[-500:]}")
            raise
        print(f"{sid} @ {ts:.2f}s -> {dst.relative_to(root)}")


if __name__ == "__main__":
    main()
