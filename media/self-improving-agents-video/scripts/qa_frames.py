#!/usr/bin/env python3
"""按句 id 从渲染产物中抽帧，用于视觉 QA。

时序常量须与 video/src/timing.ts 保持一致（FPS/句间停顿/幕间停顿/片头引导）。

用法：uv run --no-project scripts/qa_frames.py <video.mp4> <句id> [句id ...]
     uv run --no-project scripts/qa_frames.py <video.mp4> --scene P1   # 该幕每镜首句
输出：out/frames/{句id}.png
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "video" / "public" / "audio" / "manifest.json"
OUT = ROOT / "out" / "frames"

# 与 video/src/timing.ts 对齐
FPS = 30
SENTENCE_GAP = 0.32
SCENE_GAP = 0.9
LEAD_IN = 0.6


def timeline() -> dict[str, tuple[float, float]]:
    items = json.loads(MANIFEST.read_text(encoding="utf-8"))
    result: dict[str, tuple[float, float]] = {}
    cursor_frames = round(LEAD_IN * FPS)
    for i, item in enumerate(items):
        nxt = items[i + 1] if i + 1 < len(items) else None
        gap = SENTENCE_GAP + (SCENE_GAP if nxt and nxt["scene"] != item["scene"] else 0)
        dur_frames = max(1, round((item["durationSec"] + gap) * FPS))
        result[item["id"]] = (cursor_frames / FPS, dur_frames / FPS)
        cursor_frames += dur_frames
    return result


def main() -> None:
    video = Path(sys.argv[1]).resolve()
    tl = timeline()
    argv = sys.argv[2:]
    offset = 0.0
    if argv and argv[0] == "--offset":
        offset = float(argv[1])
        argv = argv[2:]
    ids: list[str]
    if argv and argv[0] == "--scene":
        prefix = argv[1].lower() + "-"
        ids = [k for k in tl if k.startswith(prefix)]
        ids = ids[:: max(1, len(ids) // 8)]  # 每幕最多抽 ~8 帧
    else:
        ids = argv

    OUT.mkdir(parents=True, exist_ok=True)
    ffmpeg = ["pnpm", "exec", "remotion", "ffmpeg"]
    for sid in ids:
        if sid not in tl:
            print(f"跳过未知句 id: {sid}")
            continue
        start, dur = tl[sid]
        ts = start + dur / 2 - offset
        dst = OUT / f"{sid}.png"
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
                cwd=ROOT / "video",
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            print(f"ffmpeg 失败({sid}): {(e.stderr or '')[-500:]}")
            raise
        print(f"{sid} @ {ts:.2f}s -> {dst.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
