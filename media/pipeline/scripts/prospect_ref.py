#!/usr/bin/env python3
"""参考音色样本「选段勘探」——从长录音里筛出更亮、更轻快的候选起点。

- 动机：克隆会把参考样本的**韵律风格**一并继承，样本定基线、情感向量只能在基线上微调。
  若合成结果不够轻快/阳光，换一段自己更亮的录音比继续加情感权重有效得多（实测见
  VOICE-CLONING.md §3.3）。人耳逐段试听 4 分钟录音成本太高，故先用客观指标筛候选。
- 指标（同一说话人内部相对比较，不作绝对判据）：
    F0 中位数  —— 音高高低（"亮不亮"的主因）
    F0 四分位距 —— 语调起伏（越大越有生气，太小则平板）
    音节率     —— 语速（"轻快"的主因），能量包络峰计数的粗代理
    谱质心     —— 明亮度/爽朗感
    RMS / 静音占比 / 发声占比 —— 响度与停顿，用于排除大段留白
- 输出：按综合分排序的候选起点，可直接喂给 prepare_ref.py 的 --start。

用法（仓库根）：
  uv run --no-project --with soundfile --with numpy \
      media/pipeline/scripts/prospect_ref.py ~/Documents/dify/me-1.mp3 [更多音频…] \
      [--window 12] [--step 2] [--top 4]

**响度/音高高不等于段落好**：候选仍须逐个 afplay 试听，确认人声干净、单说话人、
语句完整、语气贴近目标成片（详见 VOICE-CLONING.md §三）。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

FRAME, HOP = 1024, 512  # 32ms 帧 / 16ms 跳（sr=32k）
F0_MIN, F0_MAX = 75.0, 400.0
VOICED_AC = 0.35  # 自相关归一峰值阈：判定该帧是否为浊音
MANUAL = "media/pipeline/VOICE-CLONING.md"


def framed(x: np.ndarray, frame: int, hop: int) -> np.ndarray:
    n = 1 + max(0, (len(x) - frame) // hop)
    if not n:
        return np.zeros((0, frame), dtype=x.dtype)
    return x[np.arange(frame)[None, :] + hop * np.arange(n)[:, None]]


def frame_features(x: np.ndarray, sr: int) -> dict:
    """帧级 F0 / 谱质心 / RMS（整段算一次，供各窗口聚合）。"""
    F = framed(x, FRAME, HOP)
    if not len(F):
        return {}
    win = np.hanning(FRAME).astype(np.float32)
    rms = np.sqrt(np.mean(F**2, axis=1))
    ref = float(np.median(rms[rms > 0])) if np.any(rms > 0) else 0.0
    gate = rms > max(1e-4, 0.15 * ref)  # 过滤静音帧，避免噪声拉低统计
    lag_lo, lag_hi = int(sr / F0_MAX), int(sr / F0_MIN)
    nfft = 1 << (2 * FRAME - 1).bit_length()
    freqs = np.fft.rfftfreq(FRAME, 1 / sr)
    f0 = np.zeros(len(F), dtype=np.float32)
    centroid = np.zeros(len(F), dtype=np.float32)
    for s in range(0, len(F), 2048):  # 分块：整段一次 FFT 会吃掉几百 MB
        blk = F[s : s + 2048] * win
        spec = np.fft.rfft(blk, n=nfft)
        ac = np.fft.irfft(spec * np.conj(spec), n=nfft)[:, : lag_hi + 1]
        ac0 = ac[:, :1].copy()
        ac0[ac0 == 0] = 1.0
        seg = (ac / ac0)[:, lag_lo : lag_hi + 1]
        best = np.argmax(seg, axis=1)
        voiced = seg[np.arange(len(seg)), best] > VOICED_AC
        f0[s : s + len(blk)] = np.where(voiced, sr / np.maximum(best + lag_lo, 1), 0.0)
        mag = np.abs(np.fft.rfft(blk, n=FRAME))
        den = mag.sum(axis=1)
        den[den == 0] = 1.0
        centroid[s : s + len(blk)] = (mag * freqs).sum(axis=1) / den
    return {"f0": f0, "centroid": centroid, "rms": rms, "gate": gate}


def syllable_rate(seg: np.ndarray, sr: int) -> float:
    """能量包络峰计数 / 秒——音节率的粗代理（不辨声调，仅供相对比较）。"""
    hop = sr // 100  # 10ms
    e = np.sqrt(np.mean(framed(seg, hop * 2, hop) ** 2, axis=1))
    if len(e) < 3:
        return 0.0
    e = np.convolve(e, np.ones(5) / 5, mode="same")
    thr = 0.5 * float(np.median(e[e > 0])) if np.any(e > 0) else 0.0
    peaks, last = 0, -10
    for i in range(1, len(e) - 1):
        if e[i] > thr and e[i] >= e[i - 1] and e[i] > e[i + 1] and i - last >= 10:
            peaks, last = peaks + 1, i
    return peaks / (len(seg) / sr)


def window_stats(feat: dict, x: np.ndarray, sr: int, start: int, window: int) -> dict:
    fs, fe = (start * sr) // HOP, ((start + window) * sr) // HOP
    f0, gate = feat["f0"][fs:fe], feat["gate"][fs:fe]
    voiced = f0[(f0 > 0) & gate]
    seg = x[start * sr : (start + window) * sr]
    if len(voiced) < 20 or not len(seg):
        return {}
    rms = float(np.sqrt(np.mean(seg**2)))
    frame_rms = feat["rms"][fs:fe]
    return {
        "start": start,
        "f0_med": float(np.median(voiced)),
        "f0_iqr": float(np.percentile(voiced, 75) - np.percentile(voiced, 25)),
        "syl": syllable_rate(seg, sr),
        "cen": float(np.mean(feat["centroid"][fs:fe][gate])) if np.any(gate) else 0.0,
        "rms": rms,
        "sil": float(np.mean(frame_rms < 0.1 * rms)) if len(frame_rms) else 1.0,
        "voiced": float(np.mean((f0 > 0) & gate)),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="参考样本选段勘探（更亮/更轻快的候选起点）"
    )
    parser.add_argument("sources", nargs="+", help="待勘探音频（mp3/wav/flac…）")
    parser.add_argument(
        "--window", type=float, default=12.0, help="目标样本时长（秒，默认 12）"
    )
    parser.add_argument(
        "--step", type=float, default=2.0, help="滑窗步长（秒，默认 2）"
    )
    parser.add_argument(
        "--top", type=int, default=4, help="每个文件列出的候选数（默认 4）"
    )
    args = parser.parse_args()
    win, step = int(args.window), max(1, int(args.step))

    rows: list[dict] = []
    for src in args.sources:
        p = Path(src).expanduser()
        if not p.is_file():
            print(f"跳过（不存在）：{p}", file=sys.stderr)
            continue
        x, sr = sf.read(str(p), dtype="float32", always_2d=True)
        x = x.mean(axis=1)
        dur = len(x) / sr
        if dur < win:
            print(f"跳过（短于 {win}s）：{p.name} {dur:.1f}s", file=sys.stderr)
            continue
        feat = frame_features(x, sr)
        for s in range(0, int(dur) - win + 1, step):
            st = window_stats(feat, x, sr, s, win)
            if st:
                rows.append({**st, "file": p.name, "path": str(p)})
        print(f"# {p.name}: {dur:.0f}s sr={sr}", file=sys.stderr)

    if not rows:
        print("无有效窗口（音频过短或全为静音）", file=sys.stderr)
        return 1

    keys = ["f0_med", "f0_iqr", "syl", "cen", "rms"]
    arr = {k: np.array([r[k] for r in rows]) for k in keys}
    z = {k: (arr[k] - arr[k].mean()) / (arr[k].std() or 1.0) for k in keys}
    sil = np.array([r["sil"] for r in rows])
    voiced = np.array([r["voiced"] for r in rows])
    # 明亮阳光 = 音高高 + 谱质心高；轻快 = 音节率高；有生气 = 起伏大；
    # 扣分项：静音过多（>22%）、发声占比过低（<45%）——这类窗口多是留白或环境声。
    score = (
        1.0 * z["f0_med"]
        + 0.9 * z["cen"]
        + 0.9 * z["syl"]
        + 0.6 * z["f0_iqr"]
        + 0.3 * z["rms"]
        - 20.0 * np.maximum(0, sil - 0.22)
        - 15.0 * np.maximum(0, 0.45 - voiced)
    )
    for r, s in zip(rows, score, strict=True):
        r["score"] = float(s)

    print(
        f"\n{'file':<16}{'--start':>9}{'分':>7}{'F0中位':>8}{'F0起伏':>8}"
        f"{'音节率':>8}{'质心Hz':>8}{'RMS':>7}{'静音':>7}{'发声':>7}"
    )
    picked: dict[str, list[int]] = {}
    for r in sorted(rows, key=lambda r: -r["score"]):
        starts = picked.setdefault(r["file"], [])
        if len(starts) >= args.top:
            continue
        if any(
            abs(r["start"] - o) < win for o in starts
        ):  # 相邻窗口高度重叠，只留最高分
            continue
        starts.append(r["start"])
        print(
            f"{r['file']:<16}{r['start']:9d}{r['score']:7.2f}{r['f0_med']:8.1f}"
            f"{r['f0_iqr']:8.1f}{r['syl']:8.2f}{r['cen']:8.0f}{r['rms']:7.3f}"
            f"{r['sil']:7.2f}{r['voiced']:7.2f}"
        )

    print(
        f"\n下一步：挑 3–4 个候选各裁一份，再各跑一次 `--style neutral` 小样比对（见 {MANUAL} §3.3）：\n"
        f"  uv run --no-project --with soundfile --with numpy media/pipeline/scripts/prepare_ref.py \\\n"
        f"      <源音频> --start <上表 --start> --duration {win:g} --out media/pipeline/voices/<名字>.wav\n"
        "分高只代表「不小声、不平、不慢」，**不代表段落好**——务必 afplay 试听确认人声干净、单说话人、语句完整。"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
