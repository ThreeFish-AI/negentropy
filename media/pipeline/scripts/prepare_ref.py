#!/usr/bin/env python3
"""参考音色样本预处理——裁剪并规范化为 IndexTTS 克隆用 WAV。

- 输入：任意 mp3/wav/flac 录音（如手机录音、长片段素材；m4a 不受 libsndfile 支持，
  需先 `ffmpeg -i in.m4a out.wav`）
- 输出：media/pipeline/voices/<名字>.wav —— 16-bit PCM 单声道，保留原始采样率（IndexTTS 内部重采样）
- 动机：克隆参考音频建议 5–15 秒干净人声；过长样本（如 4 分钟录音）会拖慢每句合成的
  条件提取，且质量并不更好。

用法：uv run --no-project --with soundfile media/pipeline/scripts/prepare_ref.py \
          <源音频> [--start 10] [--duration 15] [--out media/pipeline/voices/me.wav]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

VOICES_DIR = Path(__file__).resolve().parents[1] / "voices"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="裁剪/规范化参考音色样本 → 16-bit 单声道 WAV"
    )
    parser.add_argument(
        "source",
        help="源音频文件（mp3/wav/flac 等 soundfile 可读格式；m4a 需先 ffmpeg 转 wav）",
    )
    parser.add_argument(
        "--start", type=float, default=0.0, help="裁剪起点（秒，默认 0）"
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=15.0,
        help="保留时长（秒，默认 15，建议 5–15）",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="输出路径（默认 media/pipeline/voices/<源文件名>.wav）",
    )
    args = parser.parse_args()

    src = Path(args.source).expanduser().resolve()
    if not src.is_file():
        print(f"源文件不存在: {src}", file=sys.stderr)
        return 1
    if args.start < 0:
        print("--start 不能为负数", file=sys.stderr)
        return 1
    if not 3.0 <= args.duration <= 30.0:
        print(
            "--duration 建议 5–15 秒（允许 3–30），克隆效果与速度的平衡点",
            file=sys.stderr,
        )
        return 1

    data, sr = sf.read(str(src), dtype="float32", always_2d=True)
    total = len(data) / sr
    if args.start >= total:
        print(f"--start {args.start}s 超出源文件时长 {total:.1f}s", file=sys.stderr)
        return 1

    begin = int(args.start * sr)
    end = min(len(data), begin + int(args.duration * sr))
    clip = data[begin:end]
    if not len(clip):
        print(
            f"裁剪区间为空（--start {args.start}s 过大或源文件过短）", file=sys.stderr
        )
        return 1
    if clip.shape[1] > 1:  # 立体声 → 单声道
        clip = clip.mean(axis=1, keepdims=True)
    peak = float(np.max(np.abs(clip))) if len(clip) else 0.0
    if peak > 0:  # 峰值归一到 -3dB，避免过小音量削弱克隆相似度
        clip = clip * min(0.7 / peak, 4.0)

    out = (
        Path(args.out).expanduser().resolve()
        if args.out
        else VOICES_DIR / f"{src.stem}.wav"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out), clip, sr, subtype="PCM_16")

    print(f"已生成参考样本: {out}")
    print(f"时长 {len(clip) / sr:.1f}s · {sr} Hz · 单声道 · 16-bit")
    if total > args.duration + 5:
        print(
            f"提示：源文件共 {total:.0f}s，仅截取 [{args.start:.0f}s, {args.start + len(clip) / sr:.0f}s)，"
            f"请试听确认该段人声干净、无背景音乐"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
