#!/usr/bin/env python3
"""从 manifest + timing.json 导出外挂字幕（.srt / .vtt）——B 站/YouTube 上传件。

时间已精确已知（每句实测 durationSec + 时间轴常数），导出是纯白捡的交付物。
与 Subtitle.tsx（片内烧录字幕）有一个**有意分歧**：烧录字幕保留整句时间窗
（含句间停顿，便于阅读）；外挂字幕的 cue 终点 = 起点 + durationSec——静默期
不该留字，否则平台播放器里上一句会挂到下一句开口。

用法：uv run --no-project $R/captions.py --project $P \
          [--format srt,vtt] [--out out]
输出：<工程>/out/captions.srt 与 .vtt（out/ 已 gitignore）
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # noqa: E402
from timeline import compute, load_constants  # noqa: E402


def fmt_ts_srt(sec: float) -> str:
    ms = round(sec * 1000)
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def fmt_ts_vtt(sec: float) -> str:
    return fmt_ts_srt(sec).replace(",", ".")


def build_cues(items: list[dict], c: dict) -> list[tuple[float, float, str]]:
    """[(startSec, endSec, text)]；end = start + durationSec（不含停顿，见模块注释）。"""
    return [
        (r["startSec"], r["startSec"] + r["durationSec"], r["text"])
        for r in compute(items, c)
    ]


def render_srt(cues: list[tuple[float, float, str]]) -> str:
    out = []
    for i, (a, b, text) in enumerate(cues, 1):
        out.append(f"{i}\n{fmt_ts_srt(a)} --> {fmt_ts_srt(b)}\n{text}\n")
    return "\n".join(out)


def render_vtt(cues: list[tuple[float, float, str]]) -> str:
    body = "\n".join(
        f"{fmt_ts_vtt(a)} --> {fmt_ts_vtt(b)}\n{text}\n" for a, b, text in cues
    )
    return f"WEBVTT\n\n{body}"


def main() -> None:
    ap = argparse.ArgumentParser(description="导出 srt/vtt 外挂字幕")
    ap.add_argument("--project", default=".", help="视频工程根目录")
    ap.add_argument("--format", default="srt,vtt", help="逗号分隔（默认 srt,vtt）")
    ap.add_argument("--out", default=None, help="输出目录（默认 <工程>/out）")
    args = ap.parse_args()

    root = Path(args.project).resolve()
    manifest = root / "video" / "public" / "audio" / "manifest.json"
    if not manifest.is_file():
        sys.exit(f"manifest.json 不存在: {manifest} —— 先运行 scripts/tts.py 合成配音")
    items = json.loads(manifest.read_text(encoding="utf-8"))
    c = load_constants(root)
    cues = build_cues(items, c)
    out_dir = Path(args.out).resolve() if args.out else root / "out"
    out_dir.mkdir(parents=True, exist_ok=True)

    for fmt in args.format.split(","):
        fmt = fmt.strip().lower()
        renderer = {"srt": render_srt, "vtt": render_vtt}.get(fmt)
        if renderer is None:
            ap.error(f"不支持的字幕格式: {fmt}（可选 srt / vtt）")
        dest = out_dir / f"captions.{fmt}"
        dest.write_text(renderer(cues), encoding="utf-8")
        print(f"{len(cues)} cues -> {dest}")


if __name__ == "__main__":
    main()
