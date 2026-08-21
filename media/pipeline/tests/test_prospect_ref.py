"""prospect_ref 的保真度门 —— 「风格分看不见的音质问题」的守门人。

背景：原评分公式 5 项全是**风格**指标（音高/起伏/音节率/质心/响度），0 项保真度。而
文献侧的结论是保真度损伤**事后无法弥补**——WildSpoof（arXiv:2602.05770）Table 2 显示
事后增强能提升 UTMOS/DNSMOS，却让说话人相似度 SECS 从 0.35 掉到 0.28。故新增一组只做
否决、不进加权的指标。

同时修掉原公式的两个自相加强的缺陷：
  1. 静音占比用**相对**阈（帧 RMS < 0.1×窗口 RMS），在有稳定底噪的录音上会系统性低估
     静音——底噪把帧 RMS 抬到阈值之上，停顿不被计为静音、扣分项失效。改绝对阈。
  2. 谱质心用**全带**，把「嗓音明亮」与「有嘶声/底噪」记成同一个信号（噪声底恰恰抬高
     质心）。叠加上一条，使「脏但亮」的段落获得双重虚高。改为 300–5000 Hz 限带。

用合成信号驱动（已知 F0 / 已知削波 / 已知带限），不依赖任何录音文件。
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from prospect_ref import (  # noqa: E402
    CLIP_LEVEL,
    MAX_NOISE_DBFS,
    MIN_DYNAMIC_DB,
    bandwidth_khz,
    fidelity_stats,
    frame_features,
    window_stats,
)

SR = 32000


def _voice(
    dur: float = 3.0,
    f0: float = 160.0,
    amp: float = 0.3,
    pauses: bool = True,
    broadband: float = 0.002,
) -> np.ndarray:
    """合成「浊音」：基频 + 若干谐波，幅度包络模拟音节，并插入真实停顿。

    `pauses=True` 很关键：底噪指标定义为「帧 RMS 第 10 百分位」，**前提是窗口里有气口**。
    早期夹具用了不落零的连续包络，于是第 10 百分位测到的是「轻声段」而非底噪，
    给出 −36 dBFS 的假警报——那是夹具不真实，不是代码错。
    """
    t = np.arange(int(SR * dur)) / SR
    sig = sum(amp / (k + 1) * np.sin(2 * np.pi * f0 * (k + 1) * t) for k in range(6))
    env = 0.5 + 0.5 * np.sin(2 * np.pi * 4.5 * t)  # 4.5 音节/秒
    x = sig * env
    if broadband:
        # 真实语音有摩擦音与房间本底，全频带都有低幅能量。纯谐波和**没有任何高频内容**
        # （实测有效带宽仅 2.74 kHz），带限类测试在那种夹具上无从谈起。
        x = x + broadband * np.random.default_rng(7).standard_normal(len(x))
    if pauses:  # 每秒插入 200 ms 静音，模拟气口
        for k in range(int(dur)):
            x[int((k + 0.8) * SR) : int((k + 1.0) * SR)] = 0.0
    return x.astype(np.float32)


def _frames(x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    f = frame_features(x, SR)
    voiced = (f["f0"] > 0) & f["gate"]
    return f["rms"], f["rms"][voiced]


# ---------------- 保真度指标 ----------------


def test_clean_voice_passes():
    x = _voice()
    fid = fidelity_stats(x, *_frames(x))
    assert fid["clip"] == 0
    assert fid["noise_db"] <= MAX_NOISE_DBFS
    assert fid["dyn_db"] >= MIN_DYNAMIC_DB
    assert fid["fid_flags"] == []


def test_clipping_is_flagged():
    x = _voice(amp=0.9)
    x = np.clip(x * 3.0, -1.0, 1.0).astype(np.float32)  # 强行削波
    fid = fidelity_stats(x, *_frames(x))
    assert fid["clip"] > 0
    assert any("削波" in f for f in fid["fid_flags"])
    assert np.max(np.abs(x)) >= CLIP_LEVEL


def test_noise_floor_is_flagged():
    """叠加 -40 dBFS 底噪：底噪超阈 + 动态range 塌缩，两项都该报。"""
    rng = np.random.default_rng(0)
    x = _voice() + (0.01 * rng.standard_normal(int(SR * 3.0))).astype(np.float32)
    fid = fidelity_stats(x, *_frames(x))
    assert fid["noise_db"] > MAX_NOISE_DBFS
    assert any("底噪" in f for f in fid["fid_flags"])


def test_dc_offset_is_flagged():
    x = (_voice() + 0.02).astype(np.float32)
    fid = fidelity_stats(x, *_frames(x))
    assert any("DC" in f for f in fid["fid_flags"])


# ---------------- 有效带宽（低码率转码识别） ----------------


def test_bandwidth_of_broadband_signal_is_near_nyquist():
    """白噪的有效带宽应接近 Nyquist —— 若接近 3 kHz 说明判据又退化成「能量占比」。"""
    rng = np.random.default_rng(1)
    x = (0.1 * rng.standard_normal(SR * 2)).astype(np.float32)
    assert bandwidth_khz(x, SR) > 0.9 * (SR / 2000.0)


def test_bandwidth_detects_band_limiting():
    """5 kHz 带限信号必须被测出约 5 kHz。"""
    x = _voice(dur=2.0)
    X = np.fft.rfft(x)
    X[np.fft.rfftfreq(len(x), 1 / SR) > 5000] = 0
    y = np.fft.irfft(X, len(x)).astype(np.float32)
    bw = bandwidth_khz(y, SR)
    assert 4.0 <= bw <= 6.0, bw


def test_bandwidth_not_confused_by_speech_spectral_tilt():
    """回归：语音能量集中在 3 kHz 以下，但**有效带宽不是 3 kHz**。

    最初用「累积能量 99% 分位」，对每个窗口都误报「滚降 2.9 kHz」——因为那衡量的是
    能量占比而非断崖位置。判据必须是相对自身峰值的落点。
    """
    x = _voice(dur=2.0)  # 谐波集中在 <1 kHz，但含全频带低幅本底（如真实录音）
    assert bandwidth_khz(x, SR) > 8.0


# ---------------- 修掉的两个旧缺陷 ----------------


def test_noise_floor_not_estimable_without_pauses():
    """无停顿的窗口不该给出底噪读数 —— 宁可说「测不了」，不要给一个错的数。

    夹具用**恒幅**正弦：只有它才真的没有安静帧。带包络的合成音即使不插停顿，包络落零处
    仍产生安静帧（实测 11.3% 的帧低于 −35 dBFS），会被判为可估。
    """
    t = np.arange(int(SR * 2.0)) / SR
    x = (0.3 * np.sin(2 * np.pi * 160.0 * t)).astype(np.float32)
    fid = fidelity_stats(x, *_frames(x))
    assert fid["noise_db"] is None and fid["dyn_db"] is None
    assert any("不可估" in f for f in fid["fid_flags"])


def test_silence_uses_absolute_threshold():
    """相对阈的缺陷：叠加底噪后停顿不再被计为静音。绝对阈须不受底噪影响。"""
    t = np.arange(int(SR * 4.0)) / SR
    speech = _voice(dur=4.0, pauses=False)
    speech[(t > 1.0) & (t < 3.0)] = 0.0  # 中间 2 秒真静音（占 50%）
    rng = np.random.default_rng(2)
    noisy = (speech + 0.003 * rng.standard_normal(len(speech))).astype(np.float32)

    def sil_of(x):
        f = frame_features(x, SR)
        st = window_stats(f, x, SR, 0, 4)
        return st["sil"] if st else None

    clean_sil, noisy_sil = sil_of(speech), sil_of(noisy)
    assert clean_sil is not None and noisy_sil is not None
    assert clean_sil > 0.3, f"干净信号的静音占比应显著（实得 {clean_sil}）"
    # 绝对阈下，-50 dBFS 量级的底噪不该把静音占比打到 0
    assert noisy_sil > 0.2, f"绝对阈应不受底噪掩盖（实得 {noisy_sil}）"


@pytest.mark.parametrize("hiss_amp", [0.0, 0.02])
def test_bandlimited_centroid_resists_hiss(hiss_amp):
    """限带质心应对高频嘶声不敏感 —— 否则「脏但亮」的段落会虚高。"""
    x = _voice(dur=2.0)
    if hiss_amp:
        rng = np.random.default_rng(3)
        hf = rng.standard_normal(len(x))
        X = np.fft.rfft(hf)
        X[np.fft.rfftfreq(len(x), 1 / SR) < 8000] = 0  # 只留 8 kHz 以上嘶声
        x = (x + hiss_amp * np.fft.irfft(X, len(x))).astype(np.float32)
    f = frame_features(x, SR)
    st = window_stats(f, x, SR, 0, 2)
    assert st, "应有有效浊音帧"
    # 限带上限 5 kHz ⇒ 8 kHz 以上的嘶声不可能把质心推高到 5 kHz 以上
    assert st["cen"] <= 5000.0
