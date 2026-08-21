#!/usr/bin/env python3
"""参考音色样本预处理——裁剪并规范化为 IndexTTS 克隆用 WAV。

- 输入：任意 mp3/wav/flac 录音（如手机录音、长片段素材；m4a 不受 libsndfile 支持，
  需先 `ffmpeg -i in.m4a out.wav`）
- 输出：pipeline/voices/<名字>.wav —— 16-bit PCM 单声道，保留原始采样率
- 动机：克隆参考音频 **10–14 秒**干净人声（硬上限 15 秒，见下）。

**两条实测口径（2026-08-20 核验上游 ~/tools/index-tts，HEAD 4f8792f）**：

1. **15 秒是硬上限，超出部分被静默丢弃**：`infer_v2_5.py:396-408` 的 `_load_and_cut_audio`
   对 spk 与 emo 两路都传 15，**保前段丢尾部**，且 `verbose=False` 时连截断日志都不打印。
   故 `--duration 16..30` 会生成一份「看起来更长、实际有一半永不进模型」的样本——
   本脚本因此把上限收到 15.0 并硬失败。文献侧也支持这个区间：speaker similarity
   随 prompt 时长上升后在 ~10 秒饱和（Voicebox / E2 TTS）。
2. **「保留原始采样率」对模型无影响**：`infer_v2_5.py:398` 的 `librosa.load` 不传 `sr`，
   即**无条件重采样到 22050 Hz 单声道**；再降到 16 kHz 喂 CAMPPlus / w2v-BERT
   （Nyquist 8 kHz）。写入的采样率只影响本仓文件的 sha1 与体积。录 96 kHz 无收益，
   但低码率 mp3（64 kbps 在 ~11 kHz 滚降）会在模型可见频带边缘留下人工痕迹。

样本时长的真实代价也不在「条件提取」——那一步按路径缓存、每个样本只算一次
（`infer_v2_5.py:619-664`）。真正的逐句成本是 `ref_mel` 作为 CFM 前缀**每句都参与
25 步扩散**（`:839-845`）：12 秒参考 ≈ 1034 个梅尔帧，而一句 6 秒目标只有 ≈517 帧。
本机实测（同文本同种子、交错 3 组）把参考从 12 秒换到 6 秒，`s2mel_time` 中位数
21.81s → 10.02s（−54%）——但音色与语速也随之改变，**不可为提速缩短参考**。

用法：uv run --no-project --with soundfile $R/prepare_ref.py \
          <源音频> [--start 10] [--duration 15] [--out pipeline/voices/me.wav]
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
        default=12.0,
        help="保留时长（秒，默认 12，推荐 10–14；硬上限 15——上游超出即静默前截）",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="输出路径（默认 pipeline/voices/<源文件名>.wav）",
    )
    args = parser.parse_args()

    src = Path(args.source).expanduser().resolve()
    if not src.is_file():
        print(f"源文件不存在: {src}", file=sys.stderr)
        return 1
    if args.start < 0:
        print("--start 不能为负数", file=sys.stderr)
        return 1
    if not 3.0 <= args.duration <= 15.0:
        # 上限 15 不是偏好而是**硬约束**：上游 _load_and_cut_audio 只取前 15 秒、
        # 静默丢弃其余（infer_v2_5.py:396-408），故 >15 的样本会有一部分永不进模型。
        print(
            "--duration 必须在 3–15 秒（推荐 10–14）：上游硬截断 15 秒且保前段丢尾部，"
            "超出部分永不进模型且无任何日志",
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
    # 峰值归一到 -3 dB。注意它**不是**为了「避免小音量削弱克隆相似度」——两条与相似度
    # 最直接相关的路径都对全局增益免疫：CAMPPlus 做 CMVN（infer_v2_5.py:647 feat-=mean），
    # w2v-BERT 的 SeamlessM4TFeatureExtractor 默认 do_normalize_per_mel_bins=True 逐 bin
    # 标准化。真实作用是稳定输出响度、并让无 CMVN 的 log-mel（ref_mel，CFM 前缀）落在
    # 训练分布的能量工作点上。真正会伤相似度的是**削波**——它产生的宽带谐波落在 8 kHz
    # 以内，CMVN 抵消不掉，故增益上限封在 4×。
    if peak > 0:
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
