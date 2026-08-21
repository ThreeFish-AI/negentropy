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
- **保真度门**（2026-08-20 新增，与风格分**正交**）：风格分只回答「亮不亮、快不快」，
  完全不看音质。而文献侧的结论是保真度问题**事后无法弥补**——WildSpoof（arXiv:2602.05770）
  Table 2 显示事后增强能提升 UTMOS/DNSMOS 却让 SECS 从 0.35 掉到 0.28。故新增一组
  只做否决、不进加权的指标：削波、底噪绝对电平、动态范围（SNR 代理）、DC 偏置、
  低码率转码痕迹。
- 输出：按综合分排序的候选起点，可直接喂给 prepare_ref.py 的 --start。

用法（仓库根）：
  uv run --no-project --with soundfile --with numpy \
      $R/prospect_ref.py ~/Documents/dify/me-1.mp3 [更多音频…] \
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
MANUAL = "pipeline/VOICE-CLONING.md"

#: 保真度阈值。**只做告警与旁注，不进加权分、不硬失败**——阈值是跨录音设备的绝对值，
#: 先观察一轮真实录音的分布再决定是否升级为硬门（否则容易把风格问题误判成音质问题）。
CLIP_LEVEL = 0.999  # |x| ≥ 此值视为削波样本
MAX_CLIP_SAMPLES = 0  # 削波样本数上限：削波谐波落在 8 kHz 内，CMVN 抵消不掉
MAX_NOISE_DBFS = -50.0  # 底噪（帧 RMS 第 10 百分位）上限
MIN_DYNAMIC_DB = 35.0  # 浊音中位 − 底噪，SNR 代理下限
MAX_DC_OFFSET = 1e-3  # |均值| 上限
#: 绝对静音阈（dBFS）。原实现用**相对**阈（帧 RMS < 0.1×窗口 RMS），在有稳定底噪的
#: 录音上会系统性低估静音——底噪把帧 RMS 抬到阈值之上，停顿不被计为静音、扣分项失效。
SILENCE_DBFS = -45.0
#: 限带谱质心的频带。原实现用全带质心，会把「嗓音明亮」与「有嘶声/底噪」记成同一个信号
#: （噪声底恰恰抬高质心），叠加上面的相对静音阈，使「脏但亮」的段落获得双重虚高。
CENTROID_BAND = (300.0, 5000.0)

#: `--accept` 模式的风格合格线（路线图 #12「重录目标风格参考样本」的验收判据）。
#: 取自 VOICE-CLONING.md §3.3 的候选实测：现有最佳候选 me-1@28s 的**纯克隆小样**
#: 达到 F0 中位 163.3 Hz / 起伏 35.2，合格线取其九成——即「重录的样本至少要能达到
#: 换段落所能拿到的最好水平的九成」，否则不如直接换段落。
#: ⚠️ 阈值是对**纯克隆小样**（--style neutral 合成结果）而非样本本身；样本侧指标只作参考，
#: 因为克隆会压缩起伏（实测样本 35.2 → 小样 34.1 一类），二者不同尺度。
ACCEPT_SAMPLE_F0 = 150.0  # 样本 F0 中位下限（参考值，不否决）
ACCEPT_CLONE_F0 = 155.0  # 纯克隆小样 F0 中位下限
ACCEPT_CLONE_IQR = 34.0  # 纯克隆小样 F0 起伏下限


def framed(x: np.ndarray, frame: int, hop: int) -> np.ndarray:
    n = 1 + max(0, (len(x) - frame) // hop)
    if not n:
        return np.zeros((0, frame), dtype=x.dtype)
    return x[np.arange(frame)[None, :] + hop * np.arange(n)[:, None]]


def _dbfs(v: float) -> float:
    return 20.0 * float(np.log10(max(v, 1e-12)))


def fidelity_stats(
    seg: np.ndarray, frame_rms: np.ndarray, voiced_rms: np.ndarray
) -> dict:
    """保真度指标（只否决、不加权）。→ dict，含 `fid_flags` 人读旗标列表。

    **底噪只在窗口内确实存在停顿时才可估**：指标定义是「帧 RMS 第 10 百分位」，若整个
    窗口都在说话（连读、无气口），第 10 百分位测到的是**轻声段**而非底噪，会给出虚高的
    假警报（合成的恒幅正弦上实测 −13.6 dBFS）。故先检查有没有足够的「疑似静音」帧
    （低于 `SILENCE_DBFS + 10 dB` 的宽松线）；不足 5% 时把 `noise_db`/`dyn_db` 记为
    None 并旗标「底噪不可估」，交由人耳判断——宁可说「测不了」，不要给一个错的数。
    """
    clip = int(np.sum(np.abs(seg) >= CLIP_LEVEL))
    dc = float(abs(np.mean(seg))) if len(seg) else 0.0
    flags = []
    if clip > MAX_CLIP_SAMPLES:
        flags.append(f"削波{clip}")
    if dc > MAX_DC_OFFSET:
        flags.append(f"DC{dc:.1e}")

    quiet_thr = 10.0 ** ((SILENCE_DBFS + 10.0) / 20.0)
    if len(frame_rms) == 0 or float(np.mean(frame_rms < quiet_thr)) < 0.05:
        flags.append("底噪不可估(无停顿)")
        return {
            "clip": clip,
            "noise_db": None,
            "dyn_db": None,
            "dc": dc,
            "fid_flags": flags,
        }

    noise = _dbfs(float(np.percentile(frame_rms, 10)))
    speech = _dbfs(float(np.median(voiced_rms))) if len(voiced_rms) else -120.0
    dyn = speech - noise
    if noise > MAX_NOISE_DBFS:
        flags.append(f"底噪{noise:.0f}dB")
    if dyn < MIN_DYNAMIC_DB:
        flags.append(f"动态{dyn:.0f}dB")
    return {
        "clip": clip,
        "noise_db": noise,
        "dyn_db": dyn,
        "dc": dc,
        "fid_flags": flags,
    }


def bandwidth_khz(x: np.ndarray, sr: int, floor_db: float = -50.0) -> float:
    """有效带宽（kHz）：谱包络仍高于「峰值 + floor_db」的最高频率。

    用于识别低码率转码——64 kbps mp3 在 ~11 kHz 处断崖，正落在模型可见频带
    （重采样到 22.05 kHz 后 Nyquist 11.025 kHz）边缘，会在那里留下人工痕迹。

    **不能用「累积能量 99% 分位」**：语音能量本就集中在 3 kHz 以下，那样算出来
    任何正常语音都是约 3 kHz，会对每个窗口误报（本轮踩过）。判据必须是**相对自身
    峰值的断崖位置**，而不是能量占比。
    """
    n = min(len(x), sr * 8)  # 前 8 秒足够
    if n < 2048:
        return 0.0
    mag = np.abs(np.fft.rfft(x[:n] * np.hanning(n)))
    freqs = np.fft.rfftfreq(n, 1 / sr)
    # 对数谱做宽平滑，压掉谐波梳状结构，只看包络趋势。
    # **必须按实际抽头数归一化**：np.convolve(..., "same") 在两端少算抽头且不补偿，
    # 会把空频段的 −240 dB 抬到接近 0 dB，使顶端恒在阈值之上、带宽恒报 Nyquist
    # （本轮踩过：5 kHz 带限信号被测成 16 kHz）。
    k = max(1, len(mag) // 200)
    db = 20 * np.log10(mag + 1e-12)
    ker = np.ones(k)
    env = np.convolve(db, ker, mode="same") / np.convolve(
        np.ones_like(db), ker, mode="same"
    )
    thr = float(env.max()) + floor_db
    above = np.flatnonzero(env > thr)
    return float(freqs[above[-1]]) / 1000.0 if len(above) else 0.0


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
        # 限带质心：只在 300–5000 Hz 内算，切断「亮」与「噪」的混淆（见 CENTROID_BAND）
        band = (freqs >= CENTROID_BAND[0]) & (freqs <= CENTROID_BAND[1])
        bm = mag[:, band]
        den = bm.sum(axis=1)
        den[den == 0] = 1.0
        centroid[s : s + len(blk)] = (bm * freqs[band]).sum(axis=1) / den
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
    # 静音判定改用**绝对**阈（相对阈在有底噪的录音上会失效，见 SILENCE_DBFS）
    sil_thr = 10.0 ** (SILENCE_DBFS / 20.0)
    voiced_mask = (f0 > 0) & gate
    fid = fidelity_stats(seg, frame_rms, frame_rms[voiced_mask])
    return {
        "start": start,
        "f0_med": float(np.median(voiced)),
        "f0_iqr": float(np.percentile(voiced, 75) - np.percentile(voiced, 25)),
        "syl": syllable_rate(seg, sr),
        "cen": float(np.mean(feat["centroid"][fs:fe][gate])) if np.any(gate) else 0.0,
        "rms": rms,
        "sil": float(np.mean(frame_rms < sil_thr)) if len(frame_rms) else 1.0,
        "voiced": float(np.mean(voiced_mask)),
        **fid,
    }


def accept_mode(sources: list[str]) -> int:
    """验收模式：整段评估候选样本，输出保真度判定与风格参考值。

    与滑窗勘探的分工：勘探是「从长录音里找候选」，验收是「判断这一段能不能用」。
    验收只对**保真度**下硬结论（削波/底噪/动态/转码——这些事后无法弥补），风格指标
    仅作参考并给出下一步指引，因为风格的真正判据是纯克隆小样而不是样本本身。
    """
    bad = 0
    for src in sources:
        p = Path(src).expanduser()
        if not p.is_file():
            print(f"❌ 不存在：{p}", file=sys.stderr)
            bad += 1
            continue
        x, sr = sf.read(str(p), dtype="float32", always_2d=True)
        x = x.mean(axis=1)
        dur = len(x) / sr
        feat = frame_features(x, sr)
        if not feat:
            print(f"❌ {p.name}: 音频过短")
            bad += 1
            continue
        st = window_stats(feat, x, sr, 0, int(dur))
        if not st:
            print(f"❌ {p.name}: 无有效浊音帧（全静音？）")
            bad += 1
            continue
        bw = bandwidth_khz(x, sr)
        nyq = sr / 2000.0
        flags = list(st["fid_flags"])
        if bw < min(0.7 * nyq, 12.0):
            flags.append(f"带宽{bw:.1f}k")
        # 上游硬截断 15 秒且保前段丢尾部（infer_v2_5.py:396-408）
        if dur > 15.0:
            flags.append(f"超 15s（后 {dur - 15:.1f}s 永不进模型）")
        ok = not flags
        bad += 0 if ok else 1
        print(
            f"\n{'✅' if ok else '❌'} {p.name}  {dur:.1f}s · {sr} Hz · 有效带宽 {bw:.1f} kHz"
        )
        print(
            "   保真度：削波 {} · 底噪 {} · 动态 {} · DC {:.1e}".format(
                st["clip"],
                "不可估（窗口内无停顿）"
                if st["noise_db"] is None
                else f"{st['noise_db']:.0f} dBFS（≤{MAX_NOISE_DBFS:g}）",
                "不可估"
                if st["dyn_db"] is None
                else f"{st['dyn_db']:.0f} dB（≥{MIN_DYNAMIC_DB:g}）",
                st["dc"],
            )
        )
        print(
            f"   风格参考：F0 中位 {st['f0_med']:.1f} Hz · 起伏 {st['f0_iqr']:.1f}"
            f" · 音节率 {st['syl']:.2f} · 限带质心 {st['cen']:.0f} Hz"
            f" · 静音 {st['sil']:.2f} · 发声 {st['voiced']:.2f}"
        )
        if flags:
            print(f"   ⚠️  {'、'.join(flags)} —— 这类损伤事后无法弥补，请重录而非后期修")
        elif st["f0_med"] < ACCEPT_SAMPLE_F0:
            print(
                f"   提示：样本 F0 中位低于 {ACCEPT_SAMPLE_F0:g} Hz，克隆音大概率偏闷；"
                "若目标是「明快」建议重录得更亮一些"
            )
    print(
        f"\n下一步：对**通过保真度**的候选各跑一次纯克隆小样，比风格而非比样本：\n"
        f"  uv run --no-project --with mutagen $R/tts_sample.py \\\n"
        f"      --ref <裁剪后的样本.wav> --style neutral --seed 4242 --label <名字>\n"
        f"合格线（对**小样**，非样本）：F0 中位 ≥{ACCEPT_CLONE_F0:g} Hz 且起伏 ≥{ACCEPT_CLONE_IQR:g}"
        f"——即达到「换段落所能拿到的最好水平」的九成（见 {MANUAL} §3.3）；\n"
        f"未达标就重录，别靠加情感向量补（注入越多越像别人，见 INDEXTTS-2.5-ADVANCED.md §3）。"
    )
    return 1 if bad else 0


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
    parser.add_argument(
        "--accept",
        action="store_true",
        help="验收模式：把每个输入当作**一段完整的候选样本**整体评估（不滑窗），"
        "打印风格指标 + 保真度旗标 + 合格判定。用于路线图 #12「重录目标风格参考样本」："
        "录 2–3 个版本，各跑一次本模式筛掉音质不合格的，再对通过的跑纯克隆小样比风格",
    )
    args = parser.parse_args()
    win, step = int(args.window), max(1, int(args.step))

    if args.accept:
        return accept_mode(args.sources)

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
        roll = bandwidth_khz(x, sr)
        nyq = sr / 2000.0
        # 低码率转码痕迹：标称 sr 高，但有效带宽在远低于 Nyquist 处就断了。
        # 判据取「带宽 < 0.7×Nyquist 且 < 12 kHz」——12 kHz 以上的截断对模型不可见
        # （spk 路径无条件重采样到 22.05 kHz ⇒ Nyquist 11.025 kHz），无需告警。
        transcoded = roll < min(0.7 * nyq, 12.0)
        for s in range(0, int(dur) - win + 1, step):
            st = window_stats(feat, x, sr, s, win)
            if st:
                if transcoded:
                    st["fid_flags"] = [*st["fid_flags"], f"带宽{roll:.1f}k"]
                rows.append({**st, "file": p.name, "path": str(p)})
        print(
            f"# {p.name}: {dur:.0f}s sr={sr} 有效带宽 {roll:.1f} kHz"
            + ("（疑似低码率转码）" if transcoded else ""),
            file=sys.stderr,
        )

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
        f"{'底噪dB':>8}{'动态dB':>8}  保真旗标"
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
            f"{'   n/a' if r['noise_db'] is None else format(r['noise_db'], '8.0f')}"
            f"{'   n/a' if r['dyn_db'] is None else format(r['dyn_db'], '8.0f')}"
            + ("  ✅" if not r["fid_flags"] else "  ⚠️ " + ",".join(r["fid_flags"]))
        )

    print(
        f"\n下一步：挑 3–4 个候选各裁一份，再各跑一次 `--style neutral` 小样比对（见 {MANUAL} §3.3）：\n"
        f"  uv run --no-project --with soundfile --with numpy $R/prepare_ref.py \\\n"
        f"      <源音频> --start <上表 --start> --duration {win:g} --out pipeline/voices/<名字>.wav\n"
        "分高只代表「不小声、不平、不慢」，**不代表段落好**——务必 afplay 试听确认人声干净、单说话人、语句完整。\n"
        "保真旗标与风格分**正交**：⚠️ 的段落即使分高也别用（削波/底噪/动态不足/低码率转码的\n"
        "损伤事后无法弥补——事后增强会提升 UTMOS 却降低说话人相似度）。旗标目前只告警不否决，\n"
        "阈值见脚本顶部常量；观察一轮真实录音的分布后再决定是否升级为硬门。"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
