#!/usr/bin/env python3
"""逐句合成配音并产出时长 manifest——公共管线版本（双引擎）。

- 输入：<工程>/script/narration.json（单一事实源派生）
- 输出：<工程>/video/public/audio/{id}.mp3 + <工程>/video/public/audio/manifest.json
- 引擎：
  - edge（默认）：edge-tts 预置音色，免密钥，行为与历史版本完全一致；
  - indextts：声音克隆（IndexTTS-2.5 本地服务），需先启动 tts_server.py，
    通过 --ref 提供参考音色样本、--style 选择风格（sunny 明快阳光为推荐位，
    sunny-steady 为其定稿档＝同参数 + 束宽 3；另有激情/轻快/自信/正能量）。
- 幂等：参数与文本未变则跳过（SHA1 摘要 sidecar 缓存）。
- 版本库（indextts）：合成成功的句子按 digest 存入机器级持久库（默认
  ~/Library/Application Support/negentropy-influence/tts-store，环境变量 NE_TTS_STORE
  覆盖，--no-store 禁用）；集内缓存未命中时先按 digest 回收——换 worktree / 清盘不再
  丢整集合成成果，改稿只重配变更句。历史版本按 digest 文件名并存，不互相覆盖。

用法：
  edge：    uv run --no-project --with edge-tts --with mutagen $R/tts.py \
                --project $P [--voice zh-CN-YunxiNeural] [--rate +4%] [--force]
  indextts：uv run --no-project --with mutagen $R/tts.py \
                --project $P --engine indextts --ref <参考样本.wav> \
                [--style passionate] [--server http://127.0.0.1:8766] [--force]
  情感三来源（互斥）：--style/--emo-vector 向量注入 · --emo-ref <另一段录音> 语调迁移
                （更自然）· --emo-text "轻快爽朗、自信阳光" 自然语言（需服务端 --use-qwen-emo）
  （工程内薄包装等价于在工程目录下运行 scripts/tts.py）

声音克隆完整手册（部署/风格/排障/许可）见 pipeline/VOICE-CLONING.md。
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
import os
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

# edge_tts / mutagen 均惰性导入：克隆模式（indextts）无需 edge_tts；`--list-styles` 等本地操作零依赖。

DEFAULT_VOICE = "zh-CN-YunxiNeural"
DEFAULT_RATE = "+4%"
CONCURRENCY_EDGE = 6
CONCURRENCY_INDEXTTS = 1  # 服务端串行锁推理；>1 会在锁后排队，排队时长计入客户端超时
RETRIES = 4
HTTP_TIMEOUT = 600  # MPS fp32 长句可达数分钟；须覆盖队列等待
MANUAL = "pipeline/VOICE-CLONING.md"

# --plan 排期估算用的实测常数（MPS fp32，长跑折算口径：含降频、机器争用与逐句开销）。
# RTF_1BEAM 来自三集 596 句连续跑 8.5 小时 / 40.2 分钟纯语音；RTF_MULTIBEAM 由同句
# 1↔3 束 A/B 实测的约 3.2 倍推得（与早期 3 束直测的 RTF 40–58 区间一致）。
#
# ⚠️ 2026-08-20 实测偏差（EP1 v3 两遍法，187 句）：
#   A 遍 sunny(beams=1)：墙钟 ~1.9 h、纯语音 12.98 分 → 实测 RTF ≈ 8.8（常量 13 偏保守 1.5×）
#   B 遍 sunny-steady(beams=3)：墙钟 1.98 h、纯语音 12.89 分 → 实测 RTF ≈ 9.2（常量 45 偏保守 4.9×）
# 即机器空闲时 3 束的实际代价远低于「+241%」的旧口径（本次 B/A ≈ 1.04），旧数据应是
# 在机器被占用/热节流时测得。**常量刻意不下调**：--plan 的用途是排期决策，宁可高估
# 让人留出窗口，也不要低估导致长跑撞上其他任务；但看到估算与实测差 3–5 倍属正常。
RTF_1BEAM = 13.0
RTF_MULTIBEAM = 45.0
AVG_SEC_PER_LINE = 4.2  # 三集每句音频均值

# IndexTTS 8 维情感向量顺序（indextts/infer_v2_5.py 固定）：happy, angry, sad, afraid,
# disgusted, melancholic, surprised, calm。
#
# 有效和护栏 Σ分量×emo_alpha ≤ 0.8 是**本管线自定的口径**，不是上游行为（2026-08-20 核验）：
# 上游 infer() 从不归一化，normalize_emo_vec 全仓唯一调用点是 webui.py:665 的「自定义向量」
# 分支，且那条的 0.8 作用在**已乘 emo_bias 的和**上、且在 alpha 之前。
# emo_bias（infer_v2_5.py:493 硬编码）8 维严重不等权：
#   sad/afraid=1.0 > happy/disgusted/melancholic=0.9375 > angry=0.875 > surprised=0.6875 > calm=0.5625
# 后果：从社区/WebUI 抄来的 (vec, alpha) 经本仓复现实际**强 16%–33%**（含 calm 越重偏差越大，
# confident 档最失真），跨来源参数迁移必须重新试听定档。详见 INDEXTTS-2.5-ADVANCED.md §3.2。
#
# 另注：alpha 恰好等于「替换掉本人语调的百分比」**仅当名义向量和 = 1.0** ——
# sunny/passionate 刚好是 1.00，而 lively(0.85)/confident(0.90)/positive(0.95) 不是，
# 其 alpha 跨预设不可直接比较。
EMO_KEYS = [
    "happy",
    "angry",
    "sad",
    "afraid",
    "disgusted",
    "melancholic",
    "surprised",
    "calm",
]

# 风格预设 —— 数值为初值，可实测试听后微调。
# 可选键 "beams"：预设自带的束搜索宽度（缺省 1）。束宽会改变韵律稳定度，属风格的一部分，
# 故允许写进预设；命令行 --num-beams 显式给值时优先。束宽代价见下方 sunny-steady 注释
# （MPS 上近乎免费，CUDA 上近线性）；机器忙时想只让关键句更稳，用 --steady 混合档。
# 可选键 "sampling"：预设自带的采样参数覆盖（见 SAMPLING_DEFAULTS）。当前所有预设都不带 ——
# 任何写进预设的值都会改缓存摘要 ⇒ 整集重录，故须先 A/B 拿到证据再定档。
STYLE_PRESETS: dict[str, dict] = {
    "neutral": {"label": "中性", "vec": None, "alpha": 1.0, "df": 1.0},
    "passionate": {
        "label": "激情",
        # 高唤醒正价（happy 主载）+ 跳跃感（surprised）+ 少量 calm 锚定咬字；
        # 有效和 1.00×0.7=0.70 ≤0.8。
        # ⚠️ 校准（2026-08-20）：此处原注「df 0.97 护密集技术句清晰度」**方向写反了**。
        # duration_factor 作用于 S2M 的时间轴重采样（infer_v2_5.py:832 target_lengths），
        # df<1 → 梅尔帧更少 → 语速更快 → 每个音素分到的时间更短、咬字更紧，密集技术句
        # 应当**更糊**而非更清。护清晰度的正确方向是 df>1。0.97 的实际效果是「略快」，
        # 与本档「激情」的定位自洽，故数值保留、只更正因果表述。
        "vec": [0.70, 0, 0, 0, 0, 0, 0.20, 0.10],
        "alpha": 0.7,
        "df": 0.97,
    },
    # 以下三档的名义向量已归一到 Σvec=1.0（2026-08-20）：只有 Σvec=1.0 时 alpha 才等于
    # 「替换掉本人语调的百分比」，否则它被稀释成 α·Σvec、**跨预设不可比**。
    # alpha 同步反向缩放（α_new = α_old × Σvec_old），故有效注入 w=vec×alpha 在数学上不变。
    # **精确说法**：上游把 w 截断到 4 位小数（infer_v2_5.py:608 用 int() 截断而非四舍五入），
    # 而 0.33/0.455 一类值恰落在截断边界上，故 21 个分量里有 3 个出现 1e-4 的差异
    # （0.33→0.3299、0.455→0.4549、0.5249→0.525）。相对幅度 0.03%，远低于任何听感阈；
    # 且这三档**未被任何已上线剧集使用**（三集用 sunny-steady / passionate），即便真有
    # 差异也无影响。不要把它写成「逐项完全一致」——那是过度断言。
    # 由 tests/test_digest.py::test_preset_normalization_preserves_injection 钉死 1e-4 界。
    "lively": {
        "label": "轻快",
        "vec": [
            0.6470588,
            0,
            0,
            0,
            0,
            0,
            0.1764706,
            0.1764706,
        ],  # 原 .55/.15/.15 ÷ 0.85
        "alpha": 0.51,  # 原 0.6 × 0.85
        "df": 0.95,
    },
    "confident": {
        "label": "自信",
        "vec": [0.2777778, 0, 0, 0, 0, 0, 0, 0.7222222],  # 原 .25/.65 ÷ 0.90
        "alpha": 0.63,  # 原 0.7 × 0.90
        "df": 1.05,
    },
    "positive": {
        "label": "正能量",
        "vec": [0.7894737, 0, 0, 0, 0, 0, 0, 0.2105263],  # 原 .75/.20 ÷ 0.95
        "alpha": 0.665,  # 原 0.7 × 0.95
        "df": 1.0,
    },
    "sunny": {
        "label": "明快阳光",
        # 2026-08-19 试听定档（科普长视频推荐位）。方向由 QwenEmotion 对「轻快、爽朗、
        # 自信、阳光」推出（happy 近乎独载），强度则**人工压到 0.35**——Qwen 原始输出会顶到
        # Σ=0.8 上限，实测把克隆音高推到 199–223 Hz（说话人自然区间仅 142–163 Hz）而显假；
        # 0.35 留 65% 给本人真实语调，配 df 0.95 取「明快但不飘」。
        # 配套样本很关键：本档在 voices/me-bright.wav（me-1.mp3 --start 0.36 --duration 12）
        # 上定档，换回更闷的样本会失去明快感——见 VOICE-CLONING.md §3.3。
        "vec": [0.95, 0, 0, 0, 0, 0, 0.02, 0.03],
        "alpha": 0.35,
        "df": 0.95,
    },
    "sunny-steady": {
        "label": "明快稳健",
        # = sunny 同方向同强度同语速，只把束宽提到 3：GPT 段搜索更宽 → 韵律更收敛。
        # 实测（同文本同样本）：语调起伏 48.4 → 43.5、音节率 4.10 → 4.55，亮度基本不掉
        # （质心 1245 → 1223）——是唯一「不牺牲明快度就让语气更稳」的旋钮。
        # 代价高度依赖硬件，**不是无条件的「线性放大」**：束宽只作用于 T2S（S2M 入口的
        # codes 形状与束宽无关），而 MPS 上 T2S 只占三段耗时的 18–46%（2026-08-20 本机
        # 13 样本分段 profile：s2mel 反而占 45–73%）。整集实测 1→3 束仅 +4%
        # （EP1 v3 两遍法 1.9h → 1.98h）。故：CUDA 上近线性放大，MPS 上近乎免费。
        # 机器忙/热节流时仍可能出现数倍差，此时用 `--steady` 混合档只升关键句。
        "vec": [0.95, 0, 0, 0, 0, 0, 0.02, 0.03],
        "alpha": 0.35,
        "df": 0.95,
        "beams": 3,
    },
    # ── 以下两档是**候选**，尚未定档：新增而非改动生产档，故对三集缓存零影响。
    #    定档前必须按 INDEXTTS-2.5-ADVANCED.md §6.5 的测量协议做 A/B + 人耳确认。
    "sunny-pure": {
        "label": "明快纯载",
        # 候选（路线图 #10）：砍掉 sunny 里的配料维度，使 Σvec=1.0 与「happy 单载」
        # 同时成立 ⇒ alpha 语义最干净（它就是被替换掉的本人语调比例）。
        # ⚠️ 立论勘误（2026-09-02）：本档原注以 emo_bias「surprised 只兑付 69%、
        # calm 56%」为依据——该折扣**在本管线不生效**。施加 bias 的 normalize_emo_vec
        # （infer_v2_5.py:488）全仓唯一调用点是 webui.py:665；infer() 内对 emo_vector
        # 的唯一变换是 :605-607 的 int(x*alpha*10000)/10000，无 bias 相乘。故本管线
        # 名义权重即实际权重，「配料维度不划算」这条理由作废，本档退回纯 alpha 语义论证。
        # 顺带：surprised 的原型数是 10（happy 只有 3，emo_num=[3,17,2,8,4,5,10,24]），
        # 表达基底并不贫乏——砍它的代价可能比原注设想的大，定档须以试听为准。
        "vec": [1.0, 0, 0, 0, 0, 0, 0, 0],
        "alpha": 0.35,
        "df": 0.95,
    },
    "sunny-clear": {
        "label": "明快清晰",
        # 候选（路线图 #11）：= sunny-steady 但 df 1.05。依据是 df 方向的勘误——
        # df<1 = 更快 = 每音素分到的时间更短 = 咬字更紧更糊，护术语密集句的清晰度
        # 正确方向是 df>1（§3.4）。明快感仍由 happy/alpha 承担，与语速正交。
        # 代价：拉长时长 ⇒ 牵动 beat 与片尾渐黑窗口，定档后须重渲。
        "vec": [0.95, 0, 0, 0, 0, 0, 0.02, 0.03],
        "alpha": 0.35,
        "df": 1.05,
        "beams": 3,
    },
}


# 上游自回归采样参数的默认值 —— 已知副本，锚点 indextts/infer_v2_5.py:731-739（HEAD 4f8792f）；
# 与 infer_v2.py:536-544 完全一致，两版共享同一组默认。
#
# **分层 SSOT**：`SAMPLING_PASSTHROUGH_DEFAULTS`（7 个经 **generation_kwargs 透传给 HF
# generate 的参数）是唯一的数据副本，服务端 tts_server.py 运行时从本模块导入它（那个进程
# 不受本仓版本控制约束之外的依赖影响——导入是纯常量读取）；本字典在其上追加两个
# **非透传**键：text_normalization（v2.5 infer() 的独立形参）与 seed（本服务自己 set_seed），
# 它们不进 SAMPLING_RANGES/SAMPLING_CLI 的透传校验路径。
#
# 本副本只有一个用途：判定「这一项是否被显式改过」，从而决定**要不要进缓存摘要**。
# 摘要沿用「未使用即省略」规则（同 |beams=N），故全部取默认时摘要与历史逐字节相同 ——
# 这是已上线三集近 600 句缓存零失效的前提，由 tests/test_digest.py 黄金哈希钉死。
SAMPLING_PASSTHROUGH_DEFAULTS: dict[str, float | int] = {
    "temperature": 0.8,
    "top_p": 0.8,
    "top_k": 30,
    "length_penalty": 0.0,
    "repetition_penalty": 10.0,
    "max_mel_tokens": 1500,
    "interval_silence": 200,
}
SAMPLING_DEFAULTS: dict[str, float | int | bool | None] = {
    **SAMPLING_PASSTHROUGH_DEFAULTS,
    "text_normalization": True,
    "seed": None,
}

#: 采样参数的合法区间（对齐上游 webui.py:901-910 的滑杆），用于长跑前提前失败。
#: max_mel_tokens 上限 1815 = config.yaml 的 gpt.max_mel_tokens（mel 位置嵌入容量 ≈36.2 s）。
SAMPLING_RANGES: dict[str, tuple[float, float]] = {
    "temperature": (0.1, 2.0),
    "top_p": (0.0, 1.0),
    "top_k": (0, 100),
    "length_penalty": (-2.0, 2.0),
    "repetition_penalty": (0.1, 20.0),
    "max_mel_tokens": (50, 1815),
    "interval_silence": (0, 2000),
}


def tts_text(text: str) -> str:
    """口播文本微调：破折号换为逗号停顿，避免 TTS 念成怪音。

    注意这是**唯一**的程序化文本预处理：数字/百分号/量词的读法由上游中文归一化
    （wetext）承担，多音字与英文专名读音由逐字稿里的发音标注 `<字|读音>` 承担。
    归一化的已知陷阱（4 位年份与「年」之间不能有空格）由 check_script.py 的写稿 lint 拦。
    """
    return text.replace("——", "，").replace("……", "。")


def synth_source_text(item: dict) -> str:
    """取该句真正送去合成的文本：优先 `ttsText`（含发音标注），否则 `text`。

    `narration.json` 的 `text` 是**人读文本**，同时被字幕（captions.py）与字数预算
    （check_script.py）消费；发音标注只能进 `ttsText`，否则会泄漏到 SRT/VTT 并污染预算。
    未标注的句子没有 `ttsText` 字段 ⇒ 取值与历史完全一致 ⇒ 存量缓存不失效。
    """
    return item.get("ttsText") or item["text"]


def mp3_duration(path: Path) -> float:
    """mutagen 实测 MP3 时长（两引擎共用）。"""
    from mutagen.mp3 import MP3

    return MP3(str(path)).info.length


# ---------------- 风格解析 ----------------


def parse_emo_vector(spec: str) -> list[float]:
    """`happy:0.6,calm:0.2` → 8 维向量；未知键/负值/空集报错。"""
    vec = [0.0] * 8
    seen: set[str] = set()
    for part in spec.split(","):
        key, _, val = part.partition(":")
        key, val = key.strip().lower(), val.strip()
        if key not in EMO_KEYS:
            raise ValueError(f"未知情感键 {key!r}（可用：{','.join(EMO_KEYS)}）")
        if key in seen:
            raise ValueError(f"情感键重复：{key}")
        if not val:
            raise ValueError(f"情感权重缺失：{key}（格式如 happy:0.6）")
        weight = float(val)
        if not math.isfinite(weight) or weight < 0:  # isfinite 显式拦 NaN/Inf
            raise ValueError(f"情感权重必须为非负有限数值：{key}")
        vec[EMO_KEYS.index(key)] = weight
        seen.add(key)
    if not seen:
        raise ValueError("--emo-vector 不能为空")
    return vec


def resolve_style(
    args: argparse.Namespace,
) -> tuple[str, list[float] | None, float, float, int]:
    """返回 (风格名, 情感向量|None, emo_alpha, duration_factor, num_beams)。

    三个可覆盖参数（alpha / df / beams）一律「命令行显式给值优先，否则取预设」——
    故 --num-beams 的 argparse 默认值必须是 None 而非 1，否则无法区分「没给」与「给了 1」。
    """
    beams = args.num_beams if args.num_beams is not None else 1
    if args.emo_vector:
        vec = parse_emo_vector(args.emo_vector)
        alpha = args.emo_alpha if args.emo_alpha is not None else 0.6
        df = args.duration_factor if args.duration_factor is not None else 1.0
        return "raw", vec, alpha, df, beams
    preset = STYLE_PRESETS[args.style]
    alpha = args.emo_alpha if args.emo_alpha is not None else preset["alpha"]
    df = args.duration_factor if args.duration_factor is not None else preset["df"]
    if args.num_beams is None:  # 预设可自带束宽（如 sunny-steady=3），缺省为 1
        beams = preset.get("beams", 1)
    return args.style, preset["vec"], alpha, df, beams


#: 采样参数的 CLI 名 → 属性名（argparse 把连字符转下划线）。text_normalization / seed 单独处理。
SAMPLING_CLI = (
    "temperature",
    "top_p",
    "top_k",
    "length_penalty",
    "repetition_penalty",
    "max_mel_tokens",
    "interval_silence",
)


def resolve_sampling(args: argparse.Namespace) -> dict[str, float | int | bool]:
    """收集所有**被显式改动过**的采样参数；全默认时返回空 dict（摘要因此不变）。

    优先级同 alpha/df/beams：命令行显式给值 > 风格预设的 `sampling` 键 > 上游默认。
    预设自带采样参数是刻意留的扩展位——束宽已证明「属于风格的一部分」，length_penalty
    这类同样影响韵律的旋钮理应能随风格走；但**任何写进预设的值都会改摘要 ⇒ 整集重录**，
    故当前所有预设都不带 sampling，待 A/B 拿到证据后再定档。
    """
    preset_sampling: dict = (
        STYLE_PRESETS.get(args.style, {}).get("sampling", {}) if args.style else {}
    )
    out: dict[str, float | int | bool] = {}
    for key in SAMPLING_CLI:
        cli_val = getattr(args, key, None)
        val = cli_val if cli_val is not None else preset_sampling.get(key)
        if val is None:
            continue
        lo, hi = SAMPLING_RANGES[key]
        if not lo <= val <= hi:  # NaN 比较恒 False，一并被拦
            raise ValueError(f"--{key.replace('_', '-')} 必须在 [{lo:g}, {hi:g}]")
        if key == "top_k" and val == 1:
            raise ValueError(
                "--top-k 1 在束搜索下不安全（每束需保底 2 个候选）：用 0 关闭或 ≥2"
            )
        if val != SAMPLING_DEFAULTS[key]:
            out[key] = val
    if getattr(args, "no_text_normalization", False):
        out["text_normalization"] = False
    if getattr(args, "seed", None) is not None:
        # --seed-offset 是「换一条 take」的逃生口：固定种子会把某句锁死在一条可能不佳的
        # 采样结果上，偏移一位即可换一条而仍然可复现。
        out["seed"] = int(args.seed) + int(getattr(args, "seed_offset", 0) or 0)
    return out


def sampling_suffix(sampling: dict | None) -> str:
    """采样参数 → 缓存摘要后缀。空 dict 返回空串（存量缓存零失效的关键）。

    键按字母序，值用 repr()（防 0.7 → 0.70 之类的表示漂移，与 alpha/df 同口径）。
    """
    if not sampling:
        return ""
    return "".join(f"|{k}={sampling[k]!r}" for k in sorted(sampling))


# ---------------- 混合档：整集低束宽 + 指定句高束宽 ----------------
#
# 动机（实测）：3 束把语调起伏收窄约 10–20%、听感更「稳/可信」，但短句 RTF 从 6–7 涨到
# 20–31（数字密集句可达 31.5），整集从 2.5–3.5 小时涨到 8–15 小时。而真正决定第一印象的
# 只是冷开场与各幕金句——把这几句单独升到 3 束即可。代价按句线性：189 句一集里每升 1 句
# 约 +2.2 分钟（+1.3%），升 5 句 2.9→3.1 小时、升 20 句 →3.6 小时，而整集升档要 9.9 小时。
# 缓存 sidecar 按句独立（摘要含 |beams=N），故同一集内混用两种束宽完全安全、可分批补跑。


def parse_steady_selector(spec: str) -> tuple[set[str], set[str], list[str]]:
    """`P0,p3-25b,p5-*` → (精确句 id, 幕名, 前缀)。

    判定规则（可预测、无歧义）：以 `*` 结尾→前缀通配；含 `-`→精确句 id；其余→幕名。
    全部大小写不敏感。
    """
    ids: set[str] = set()
    scenes: set[str] = set()
    prefixes: list[str] = []
    for raw in spec.split(","):
        tok = raw.strip().lower()
        if not tok:
            continue
        if tok.endswith("*"):
            prefixes.append(tok[:-1])
        elif "-" in tok:
            ids.add(tok)
        else:
            scenes.add(tok)
    if not (ids or scenes or prefixes):
        raise ValueError("--steady 不能为空")
    return ids, scenes, prefixes


def steady_match(
    item: dict, ids: set[str], scenes: set[str], prefixes: list[str]
) -> bool:
    sid = str(item["id"]).lower()
    if sid in ids or str(item.get("scene", "")).lower() in scenes:
        return True
    return any(sid.startswith(p) for p in prefixes)


# ---------------- 音色签名护栏（防整集静默改写） ----------------

#: 音频目录下的音色签名标记。逐句 `{id}.sha` 只能发现「这一句该重合成」，
#: 发现不了「整集正被换成另一种声音」——因为换音色时每一句的摘要都合法地变了。
#: 本标记补的正是这个缺口：它记录上次成功合成的引擎/音色/风格，
#: 与本次不一致时硬失败，要求显式 --allow-voice-switch。不参与逐句摘要，故零缓存影响。
ENGINE_MARKER = ".engine"

#: tts_server.py 的启动命令此前有三份副本（本文件、tts_sample.py、VOICE-CLONING.md），
#: 其中一份还留着 `<仓库路径>` 占位符——粘贴即错。收敛为唯一生成处。
SERVER_SCRIPT = Path(__file__).resolve().parent / "tts_server.py"


def server_launch_hint(port: int = 8766) -> str:
    """返回可直接粘贴的 IndexTTS 服务启动命令（服务须运行在 index-tts 自己的环境里）。"""
    return (
        "  cd ~/tools/index-tts && uv run --frozen --with fastapi --with uvicorn \\\n"
        "      --with soundfile --with numpy --with lameenc \\\n"
        f"      python {SERVER_SCRIPT} --model-dir checkpoints --port {port}"
    )


def check_voice_marker(out_dir: Path, signature: str, allow_switch: bool) -> None:
    """比对音色签名；不一致且未显式放行时硬失败。"""
    marker = out_dir / ENGINE_MARKER
    if not marker.exists():
        return
    previous = marker.read_text(encoding="utf-8").strip()
    if previous == signature or allow_switch:
        return
    sys.exit(
        f"音色签名与上次合成不一致，将整集改写（{len(list(out_dir.glob('*.mp3')))} 个 mp3 单槽位覆盖）：\n"
        f"  上次: {previous}\n"
        f"  本次: {signature}\n"
        f"若确为有意重录，请显式加 --allow-voice-switch；否则请检查 --engine/--ref/--style 是否写错。\n"
        f"详见 {MANUAL} §六"
    )


def write_voice_marker(out_dir: Path, signature: str) -> None:
    (out_dir / ENGINE_MARKER).write_text(signature + "\n", encoding="utf-8")


# ---------------- 引擎一：edge-tts（历史路径，保持字节级一致） ----------------


def digest_edge(voice: str, rate: str, text: str) -> str:
    return hashlib.sha1(f"{voice}|{rate}|{text}".encode()).hexdigest()


async def synth_edge(
    sem: asyncio.Semaphore,
    item: dict,
    force: bool,
    voice: str,
    rate: str,
    out_dir: Path,
) -> dict:
    import edge_tts  # 惰性导入：仅 edge 引擎需要

    sid, text = item["id"], item["text"]
    mp3 = out_dir / f"{sid}.mp3"
    meta = out_dir / f"{sid}.sha"
    digest = digest_edge(voice, rate, text)

    if (
        not force
        and mp3.exists()
        and mp3.stat().st_size > 0
        and meta.exists()
        and meta.read_text() == digest
    ):
        pass
    else:
        async with sem:
            last_err: Exception | None = None
            for attempt in range(RETRIES):
                try:
                    communicate = edge_tts.Communicate(tts_text(text), voice, rate=rate)
                    await communicate.save(str(mp3))
                    if mp3.stat().st_size == 0:
                        raise RuntimeError("空音频文件")
                    meta.write_text(digest)
                    break
                except Exception as e:  # noqa: BLE001 - 网络服务需要整体重试
                    last_err = e
                    await asyncio.sleep(1.5 * (attempt + 1))
            else:
                raise RuntimeError(f"{sid} 合成失败: {last_err}")

    duration = mp3_duration(mp3)
    return {**item, "durationSec": round(duration, 3)}


# ---------------- 引擎二：IndexTTS 声音克隆（本地 HTTP 服务） ----------------


class NonRetryableError(Exception):
    """4xx 类错误：重试无意义，直接失败并携带服务端错误详情。"""


def _http_error_detail(e: urllib.error.HTTPError) -> str:
    try:
        parsed = json.loads(e.read())
        if isinstance(parsed, dict):
            return str(parsed.get("detail", parsed))
        if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
            return str(parsed[0].get("msg", parsed[0]))  # FastAPI 422 校验数组
        return str(parsed)
    except Exception:  # noqa: BLE001 - 详情解析失败退化为字符串
        return str(e)


def http_json(
    method: str, url: str, payload: dict | None = None, timeout: int = HTTP_TIMEOUT
) -> dict:
    """同步 urllib 调用（调用方需置于 asyncio.to_thread）；4xx → NonRetryableError。"""
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=data, method=method, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            ctype = resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        detail = _http_error_detail(e)
        if 400 <= e.code < 500:
            raise NonRetryableError(f"HTTP {e.code}: {detail}") from e
        raise RuntimeError(f"HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"连接失败: {e.reason}") from e
    if "application/json" not in ctype:
        raise NonRetryableError(f"响应 Content-Type 异常: {ctype}")
    return json.loads(body)


def http_synthesize(
    server: str,
    text: str,
    ref: str,
    vec: list[float] | None,
    alpha: float,
    df: float,
    lang: str,
    num_beams: int = 1,
    emo_ref: str | None = None,
    emo_text: str | None = None,
    headers_out: dict | None = None,
    sampling: dict | None = None,
) -> tuple[bytes, str]:
    """POST /synthesize → (mp3 bytes, X-Audio-Format)。4xx 不可重试。

    headers_out：可选出参，传入 dict 时回填全部响应头（如 emo_text 模式的 X-Emo-Vector），
    供试听工具回显；管线主路径不需要，故保持返回值签名不变。
    **键统一小写**——urllib 的 HTTPMessage 查找不分大小写，但拷进普通 dict 后会变成
    大小写敏感，而 Starlette 下发的响应头名是小写的，故此处归一避免调用方取不到值。
    """
    payload: dict = {
        "text": text,
        "ref_path": ref,
        "emo_alpha": alpha,
        "duration_factor": df,
        "lang": lang,
        "num_beams": num_beams,
    }
    if vec is not None:
        payload["emo_vector"] = vec
    if emo_ref:  # 情感参考音频：音色仍取 ref，语调迁移自 emo_ref（服务端与向量互斥）
        payload["emo_ref_path"] = emo_ref
    if emo_text:  # 自然语言情感描述（服务端 QwenEmotion 转向量）
        payload["emo_text"] = emo_text
    if sampling:  # 只发被显式改过的采样参数，其余由服务端取上游默认
        payload.update(sampling)
    req = urllib.request.Request(
        f"{server}/synthesize",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            if headers_out is not None:
                headers_out.update({k.lower(): v for k, v in resp.headers.items()})
            return resp.read(), resp.headers.get("X-Audio-Format", "unknown")
    except urllib.error.HTTPError as e:
        detail = _http_error_detail(e)
        if 400 <= e.code < 500:
            raise NonRetryableError(f"HTTP {e.code}: {detail}") from e
        raise RuntimeError(f"HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"连接失败: {e.reason}") from e


def digest_indextts(
    ref_sha1: str,
    style: str,
    vec: list[float] | None,
    alpha: float,
    df: float,
    lang: str,
    engine_tag: str,
    text: str,
    num_beams: int = 1,
    emo_ref_sha1: str | None = None,
    emo_text: str | None = None,
    sampling: dict | None = None,
) -> str:
    vec_str = ",".join(repr(x) for x in vec) if vec else "none"
    # 束宽/情感来源/采样参数改变合成结果，须入键；未使用时省略字段——沿用历史摘要格式，
    # 存量缓存不失效。新增字段一律追加在**末尾**且默认省略，故摘要格式可持续扩展。
    beams_part = "" if num_beams == 1 else f"|beams={num_beams}"
    emo_part = f"|emoref={emo_ref_sha1}" if emo_ref_sha1 else ""
    emo_part += f"|emotext={emo_text}" if emo_text else ""
    return hashlib.sha1(
        f"indextts|{engine_tag}|{ref_sha1}|{lang}|{style}|{vec_str}|{alpha!r}|{df!r}|{text}"
        f"{beams_part}{emo_part}{sampling_suffix(sampling)}".encode()
    ).hexdigest()


# ---------------- 音频版本库（内容寻址持久库，仅 indextts） ----------------
#
# 集内 audio/ 是 gitignored 本地产物 ⇒ 换 worktree / 清盘即丢整集合成成果
# （Claude Code 系列的 mp3 曾在任何工作区都不剩一份，实测教训）。版本库按
# 「句 id + digest 前 12 位」命名放在机器级持久目录，与任何 worktree 解耦：
#   - 合成成功 → store_deposit 入库（同 digest 刷新为最新音频；不同 digest 并存=保留历史版本）；
#   - 集内缓存未命中 → store_restore 按 digest 回收，命中即等价集内缓存命中；
#   - 改稿/换风格 ⇒ 新 digest 自然 miss 重配，旧版本文件保留可回退。
# 路径是机器属性：默认值在此 + NE_TTS_STORE 环境变量覆盖，永不写进受版本控制的
# toml（与 config.py 对 tts.server 的立场一致；tts.py 不 import paths.py 的边界
# 也不变——默认值是纯字面量）。仅接 indextts：edge 预置音色免密钥秒级重合成，
# 无 2 小时级资产可丢。

DEFAULT_STORE = "~/Library/Application Support/negentropy-influence/tts-store"


def store_root(disabled: bool) -> Path | None:
    """版本库根目录；--no-store 或 NE_TTS_STORE='' 时返回 None（全程直通不落盘）。"""
    if disabled:
        return None
    env = os.environ.get("NE_TTS_STORE")
    return Path(env or DEFAULT_STORE).expanduser()


def store_entry(store: Path | None, slug: str, sid: str, digest: str) -> Path | None:
    """库内条目路径：<root>/<集 slug>/<sid>.<digest12>.mp3（同名 .sha 邻档存全量 digest）。"""
    if store is None:
        return None
    return store / slug / f"{sid}.{digest[:12]}.mp3"


def store_has(store: Path | None, slug: str, sid: str, digest: str) -> bool:
    """--plan 用：库内是否存在该 digest 的句子（校验 .sha 邻档，防 12 位前缀巧合）。"""
    if store is None:
        return False
    mp3 = store_entry(store, slug, sid, digest)
    sha = mp3.with_suffix(".sha")
    return (
        mp3.is_file()
        and mp3.stat().st_size > 0
        and sha.is_file()
        and sha.read_text() == digest
    )


def store_deposit(
    mp3: Path, sid: str, digest: str, store: Path | None, slug: str
) -> None:
    """合成成功后入库。失败只 WARN 不断长跑——库是加速器，不是门。"""
    if store is None:
        return
    dst = store_entry(store, slug, sid, digest)
    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(mp3, dst)
        dst.with_suffix(".sha").write_text(digest, encoding="utf-8")
    except OSError as e:
        print(f"WARN 版本库入库失败（{sid}）：{e}", file=sys.stderr)


def store_restore(
    sid: str, digest: str, out_dir: Path, store: Path | None, slug: str
) -> bool:
    """集内缓存 miss 时先向库回收；命中则 mp3 + .sha 落位，等价集内缓存命中。"""
    if not store_has(store, slug, sid, digest):
        return False
    shutil.copyfile(store_entry(store, slug, sid, digest), out_dir / f"{sid}.mp3")
    (out_dir / f"{sid}.sha").write_text(digest, encoding="utf-8")
    return True


async def synth_indextts(
    sem: asyncio.Semaphore,
    item: dict,
    force: bool,
    ref: str,
    ref_sha1: str,
    style: str,
    vec: list[float] | None,
    alpha: float,
    df: float,
    lang: str,
    engine_tag: str,
    server: str,
    out_dir: Path,
    num_beams: int = 1,
    emo_ref: str | None = None,
    emo_ref_sha1: str | None = None,
    emo_text: str | None = None,
    sampling: dict | None = None,
    store: Path | None = None,
    slug: str = "",
) -> dict:
    sid, text = item["id"], synth_source_text(item)
    mp3 = out_dir / f"{sid}.mp3"
    meta = out_dir / f"{sid}.sha"
    digest = digest_indextts(
        ref_sha1,
        style,
        vec,
        alpha,
        df,
        lang,
        engine_tag,
        text,
        num_beams,
        emo_ref_sha1,
        emo_text,
        sampling,
    )

    if (
        not force
        and mp3.exists()
        and mp3.stat().st_size > 0
        and meta.exists()
        and meta.read_text() == digest
    ):
        pass
    elif not force and store_restore(sid, digest, out_dir, store, slug):
        pass  # 版本库回收命中：mp3 + .sha 已落位，等价集内缓存命中（--force 不走库）
    else:
        async with sem:
            last_err: Exception | None = None
            for attempt in range(RETRIES):
                try:
                    audio, fmt = await asyncio.to_thread(
                        http_synthesize,
                        server,
                        tts_text(text),
                        ref,
                        vec,
                        alpha,
                        df,
                        lang,
                        num_beams,
                        emo_ref,
                        emo_text,
                        None,  # headers_out：管线主路径不需要回填响应头
                        sampling,
                    )
                    if fmt != "mp3":
                        raise NonRetryableError(
                            f"服务端编码器不可用（X-Audio-Format={fmt}）—— 按 {MANUAL} §七 检查 soundfile/lameenc"
                        )
                    if not audio:
                        raise RuntimeError("空音频响应")
                    mp3.write_bytes(audio)
                    if mp3.stat().st_size == 0:
                        raise RuntimeError("空音频文件")
                    meta.write_text(digest)
                    store_deposit(mp3, sid, digest, store, slug)
                    break
                except NonRetryableError:
                    raise
                except Exception as e:  # noqa: BLE001 - 推理服务需要整体重试
                    last_err = e
                    await asyncio.sleep(1.5 * (attempt + 1))
            else:
                raise RuntimeError(f"{sid} 合成失败: {last_err}")

    duration = mp3_duration(mp3)
    return {**item, "durationSec": round(duration, 3)}


# ---------------- 主流程 ----------------


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="逐句 TTS 合成 + 时长 manifest（双引擎）"
    )
    parser.add_argument(
        "--engine",
        choices=["edge", "indextts"],
        default="edge",
        help="edge=预置音色（默认）；indextts=声音克隆（需本地服务）",
    )
    parser.add_argument(
        "--project", default=".", help="视频工程根目录（含 script/ 与 video/）"
    )
    parser.add_argument(
        "--voice", default=DEFAULT_VOICE, help="[edge] 语音（默认 zh-CN-YunxiNeural）"
    )
    parser.add_argument("--rate", default=DEFAULT_RATE, help="[edge] 语速（默认 +4%%）")
    parser.add_argument("--force", action="store_true", help="忽略缓存强制重合成")
    parser.add_argument(
        "--no-store",
        action="store_true",
        help="[indextts] 禁用音频版本库（默认启用；库根目录可用环境变量 NE_TTS_STORE 覆盖）",
    )
    parser.add_argument(
        "--allow-voice-switch",
        action="store_true",
        help="放行音色签名变更（引擎/音色/风格换档＝整集重录，须显式确认）",
    )
    parser.add_argument("--list-styles", action="store_true", help="列出风格预设并退出")

    idx = parser.add_argument_group("indextts 声音克隆")
    idx.add_argument(
        "--ref",
        default=None,
        help="[indextts] 参考音色样本路径（建议 10–14s 干净人声；硬上限 15s，上游超出即静默前截）",
    )
    idx.add_argument(
        "--expect-ref-sha1",
        default=None,
        metavar="12HEX",
        help="[indextts] 期望的参考样本 sha1 前 12 位，不符即硬失败——pipeline.py 从"
        "各集 pipeline.toml 自动带上，防「换样本静默重录整集」（指纹清单见 voices/refs.toml）",
    )
    idx.add_argument(
        "--server", default="http://127.0.0.1:8766", help="[indextts] 服务地址"
    )
    idx.add_argument(
        "--style",
        default="neutral",
        choices=list(STYLE_PRESETS),
        help="[indextts] 风格预设（默认 neutral）",
    )
    idx.add_argument(
        "--emo-vector",
        default=None,
        help="[indextts] 原始情感向量，如 happy:0.6,calm:0.2（与 --style 非默认值互斥）",
    )
    idx.add_argument(
        "--emo-ref",
        default=None,
        help="[indextts] 情感参考音频：音色仍取 --ref，语调/情绪迁移自这段录音（比向量注入更自然；"
        "与 --style 非默认值/--emo-vector/--emo-text 互斥）",
    )
    idx.add_argument(
        "--emo-text",
        default=None,
        help="[indextts] 自然语言情感描述，如「轻快爽朗、自信阳光」（需服务端 --use-qwen-emo；"
        "与 --style 非默认值/--emo-vector/--emo-ref 互斥）",
    )
    idx.add_argument(
        "--emo-alpha",
        default=None,
        type=float,
        help="[indextts] 情感强度 0–1（默认随风格）",
    )
    idx.add_argument(
        "--duration-factor",
        default=None,
        type=float,
        help="[indextts] 语速 0.5–2.0（默认随风格）",
    )
    idx.add_argument("--lang", default="ZH", help="[indextts] 语言（默认 ZH）")
    idx.add_argument(
        "--num-beams",
        default=None,
        type=int,
        choices=[1, 2, 3, 4, 5],
        help="[indextts] GPT 束搜索宽度（缺省随风格，多数预设为 1、sunny-steady 为 3；"
        "束宽越大韵律越稳但 GPT 段耗时约按束宽线性放大——长篇批量跑 1，定稿可试 3）",
    )
    idx.add_argument(
        "--steady",
        default=None,
        metavar="P0,p3-25b,p5-*",
        help="[indextts] 混合档：仅这些句子改用高束宽（默认 3），其余仍按风格的束宽。"
        "支持幕名（P0）/精确句 id（p3-25b）/前缀通配（p5-*），逗号分隔、大小写不敏感。"
        "用于把冷开场与金句升到更稳的档而不拖长整集耗时",
    )
    idx.add_argument(
        "--steady-beams",
        default=3,
        type=int,
        choices=[2, 3, 4, 5],
        help="[indextts] --steady 命中句所用束宽（默认 3）",
    )
    idx.add_argument(
        "--plan",
        action="store_true",
        help="[indextts] 只打印合成计划（各束宽句数、缓存命中/待合成、耗时估算）并退出，不连服务",
    )
    idx.add_argument(
        "--engine-tag",
        default="indextts",
        help="[indextts] 缓存标记；模型升级后自定义以失效旧缓存",
    )

    # 采样参数族：上游经 **generation_kwargs 透传给 HF generate，此前全部隐式继承上游默认，
    # 任何调优都得改服务源码。显式化后它们会**进缓存摘要**（仅在 ≠ 上游默认时），故改参必然
    # 重合成，不会出现「改了参数却命中旧缓存 ⇒ 误判无效果」这类假验证。
    # 缺省一律 None = 取风格预设的 sampling，再退到上游默认（见 resolve_sampling）。
    smp = parser.add_argument_group(
        "indextts 采样参数（专家级，缺省即上游默认；改任一项都会失效该句缓存）"
    )
    smp.add_argument(
        "--temperature",
        default=None,
        type=float,
        help="[indextts] 采样温度 0.1–2.0（上游默认 0.8）。收紧可降低长视频的句间韵律漂移，"
        "过紧会滑向单调播报",
    )
    smp.add_argument(
        "--top-p",
        default=None,
        type=float,
        help="[indextts] 核采样 0–1（上游默认 0.8）",
    )
    smp.add_argument(
        "--top-k",
        default=None,
        type=int,
        help="[indextts] top-k 0–100（上游默认 30；0=关闭，1 在束搜索下不安全故禁用）",
    )
    smp.add_argument(
        "--length-penalty",
        default=None,
        type=float,
        help="[indextts] 束打分长度惩罚 -2–2（上游默认 0.0）。**0.0 不是中性**：打分不做长度"
        "归一化而对数概率恒负，故系统性偏好更短假设，是 --num-beams>1 时吞尾/漏字的机制来源。"
        "抬到 0.3–1.0 可缓解；仅束搜索打分时生效，--num-beams 1 下改它无效",
    )
    smp.add_argument(
        "--repetition-penalty",
        default=None,
        type=float,
        help="[indextts] 重复惩罚 0.1–20（上游默认 10.0，自 v1 沿用且无测试支撑）。"
        "作用在语义码头上、是对 logit 的符号相关缩放；有效强度依赖 logit 绝对尺度，"
        "故**与音色/情感向量耦合**，跨音色不可迁移调参结论",
    )
    smp.add_argument(
        "--max-mel-tokens",
        default=None,
        type=int,
        help="[indextts] 生成上限 50–1815（上游默认 1500 ≈30 s；1815 为架构上限 ≈36.2 s）。"
        "溢出后果不是音频被裁短，而是文本尾部根本没被念出。本仓单句远未触顶，通常不需要动",
    )
    smp.add_argument(
        "--interval-silence",
        default=None,
        type=int,
        help="[indextts] 单请求内**分段之间**的静音毫秒（上游默认 200）。本管线逐句合成、"
        "单句远低于分段预算，故默认不生效；句间停顿由 video/src/timing.json 的 sentenceGapSec 决定",
    )
    smp.add_argument(
        "--no-text-normalization",
        action="store_true",
        help="[indextts] 关闭上游中文文本归一化（v2.5 专属）。**通常不要用**：实测 %% / 小数 /"
        "量词 / 月日 / 章节的读法本来就正确，关掉等于把全部读法责任推给逐字稿；"
        "发音标注 <字|读音> 本身免疫归一化，不需要为保标记而关它",
    )
    smp.add_argument(
        "--seed",
        default=None,
        type=int,
        help="[indextts] 随机种子。上游 do_sample 恒 True 且全链路无种子，同句每次合成都是"
        "不同的 take；给定种子后逐句可复现——这是任何参数 A/B 可信的前提",
    )
    smp.add_argument(
        "--seed-offset",
        default=0,
        type=int,
        help="[indextts] 与 --seed 相加（默认 0）。固定种子会把某句锁死在一条可能不佳的"
        "采样结果上，偏移一位即可换一条 take 而仍然可复现",
    )
    args = parser.parse_args()
    args.server = args.server.rstrip(
        "/"
    )  # 尾斜杠归一：health/synthesize 两处拼 URL 前收口

    if args.list_styles:
        print(
            "风格            说明      情感向量（happy,angry,sad,afraid,disgusted,melancholic,surprised,calm）"
            "  alpha  有效注入  语速  束宽"
        )
        for name, p in STYLE_PRESETS.items():
            vec = (
                ",".join(f"{x:g}" for x in p["vec"]) if p["vec"] else "—（不注入情感）"
            )
            eff = (sum(p["vec"]) * p["alpha"]) if p["vec"] else 0.0
            smp_note = (
                ""
                if not p.get("sampling")
                else "  采样 "
                + ",".join(f"{k}={v!r}" for k, v in sorted(p["sampling"].items()))
            )
            print(
                f"{name:<14}  {p['label']:<6}  {vec:<62}  {p['alpha']:<5}  "
                f"{eff:<8.3g}  {p['df']:<4}  {p.get('beams', 1)}{smp_note}"
            )
        print(
            "\n采样参数（temperature/top_p/top_k/length_penalty/repetition_penalty/"
            "max_mel_tokens/interval_silence）未在任何预设中覆盖，"
            "均取上游默认："
            + ", ".join(f"{k}={v!r}" for k, v in SAMPLING_DEFAULTS.items())
        )
        return

    if args.engine == "edge":
        # --plan 语义是「只看不跑」，而 edge 无束宽/无估时口径。若沿用「提示后照跑」的处理，
        # 漏写 --engine indextts 时会静默全量合成，把整集克隆音频改写成 edge 预置音色
        # （两引擎摘要必然不同，且 {id}.mp3 单槽位），故此处硬失败而非忽略。
        if args.plan:
            parser.error(
                "--plan 仅对 --engine indextts 生效（是否漏写 --engine indextts？）"
            )
        # 克隆专属参数分两类处置。**带值参数硬失败**：漏写 --engine indextts 的典型手型
        # 就是「照抄文档打了 --ref/--style 却丢了 --engine」，而 {id}.mp3 是单槽位、
        # 两引擎摘要必然不同 ⇒ 照跑就会把整集克隆音频静默改写成 edge 预置音色。
        # 上面 --plan 已按此论证硬化，合成路径同理（否则只硬化了「看」、没硬化「跑」）。
        clone_only = [
            flag
            for flag, val in {
                "--ref": args.ref,
                "--emo-vector": args.emo_vector,
                "--emo-ref": args.emo_ref,
                "--emo-text": args.emo_text,
                "--emo-alpha": args.emo_alpha is not None,
                "--duration-factor": args.duration_factor is not None,
                "--num-beams": args.num_beams is not None,
                "--steady": args.steady,
                "--style": args.style != "neutral",
                "--lang": args.lang != "ZH",
                # 采样参数族同属克隆专属：edge 不认这些旋钮，且两引擎摘要必然不同，
                # 照跑同样会把整集克隆音频改写成 edge 预置音色 ⇒ 与上面同口径硬失败。
                "--temperature": args.temperature is not None,
                "--top-p": args.top_p is not None,
                "--top-k": args.top_k is not None,
                "--length-penalty": args.length_penalty is not None,
                "--repetition-penalty": args.repetition_penalty is not None,
                "--max-mel-tokens": args.max_mel_tokens is not None,
                "--interval-silence": args.interval_silence is not None,
                "--no-text-normalization": args.no_text_normalization,
                "--seed": args.seed is not None,
            }.items()
            if val
        ]
        if clone_only:
            parser.error(
                f"以下参数仅对 --engine indextts 生效: {' '.join(clone_only)}"
                "（是否漏写 --engine indextts？若确实要用 edge 预置音色，请去掉这些参数）"
            )
        # 无副作用的旁路参数：给不到默认值也不会改变输出，只提示不失败
        benign = [
            flag
            for flag, val in {
                "--steady-beams": args.steady_beams != 3,
                "--server": args.server != "http://127.0.0.1:8766",
                "--engine-tag": args.engine_tag != "indextts",
                # --seed-offset 单独给值而没给 --seed 时无任何效果（见 resolve_sampling）
                "--seed-offset": args.seed_offset != 0 and args.seed is None,
            }.items()
            if val
        ]
        if benign:
            print(
                f"提示：以下参数仅对 --engine indextts 生效，已忽略: {' '.join(benign)}",
                file=sys.stderr,
            )

    root = Path(args.project).resolve()
    src = root / "script" / "narration.json"
    if not src.is_file():
        sys.exit(f"narration.json 不存在: {src} —— 先运行 build_narration.py 生成")
    out_dir = root / "video" / "public" / "audio"
    items = json.loads(src.read_text(encoding="utf-8"))
    out_dir.mkdir(parents=True, exist_ok=True)
    store = store_root(args.no_store)
    slug = root.name

    if args.engine == "edge":
        signature = f"edge|{args.voice}|{args.rate}"
        check_voice_marker(out_dir, signature, args.allow_voice_switch)
        sem = asyncio.Semaphore(CONCURRENCY_EDGE)
        results = await asyncio.gather(
            *(
                synth_edge(sem, i, args.force, args.voice, args.rate, out_dir)
                for i in items
            )
        )
    else:
        # 情感三来源互斥：显式向量 / 情感参考音频 / 自然语言描述（服务端亦校验，此处提前失败）
        emo_sources = [
            f
            for f, v in (
                ("--emo-vector", args.emo_vector),
                ("--emo-ref", args.emo_ref),
                ("--emo-text", args.emo_text),
            )
            if v
        ]
        if len(emo_sources) > 1:
            parser.error(f"情感来源互斥，只能给一个：{' '.join(emo_sources)}")
        if args.style != "neutral" and emo_sources:
            parser.error(f"--style 非默认值与 {emo_sources[0]} 互斥")
        if args.emo_ref or args.emo_text:
            # 音频/文本驱动情感时不注入向量；alpha 默认 1.0（完全采用该情感来源）
            style_name = "emoref" if args.emo_ref else "emotext"
            vec = None
            alpha = args.emo_alpha if args.emo_alpha is not None else 1.0
            df = args.duration_factor if args.duration_factor is not None else 1.0
            beams = args.num_beams if args.num_beams is not None else 1
        else:
            try:
                style_name, vec, alpha, df, beams = resolve_style(args)
            except ValueError as e:
                parser.error(str(e))
        try:
            sampling = resolve_sampling(args)
        except ValueError as e:
            parser.error(str(e))
        if not args.ref:
            parser.error(
                "--engine indextts 需要 --ref 参考音色样本（见 " + MANUAL + " §三）"
            )
        ref_path = Path(args.ref).expanduser().resolve()
        if not ref_path.is_file():
            parser.error(f"参考样本不存在: {ref_path}")
        if args.emo_alpha is not None and not 0.0 <= args.emo_alpha <= 1.0:
            parser.error("--emo-alpha 必须在 [0, 1]")
        if (
            vec is not None and sum(vec) * alpha > 0.8
        ):  # infer 内部以 alpha 缩放，校验有效和
            parser.error(
                f"情感向量有效和 {sum(vec) * alpha:.3f}（Σvec×alpha）超过 0.8 上限"
            )
        if args.duration_factor is not None and not 0.5 <= args.duration_factor <= 2.0:
            parser.error("--duration-factor 必须在 [0.5, 2.0]")

        emo_ref_path = emo_ref_sha1 = None
        if args.emo_ref:
            p = Path(args.emo_ref).expanduser().resolve()
            if not p.is_file():
                parser.error(f"情感参考音频不存在: {p}")
            emo_ref_path = str(p)
            # 情感样本按内容入摘要：换情感录音必须失效缓存（与 ref 同口径）
            emo_ref_sha1 = hashlib.sha1(p.read_bytes()).hexdigest()[:12]
        ref_sha1 = hashlib.sha1(ref_path.read_bytes()).hexdigest()[:12]
        # 指纹硬校验：样本即音色。换样本 = 整集换音色，必须在长跑开始前失败
        if args.expect_ref_sha1 and args.expect_ref_sha1 != ref_sha1:
            parser.error(
                f"参考样本指纹不符：期望 {args.expect_ref_sha1}，实得 {ref_sha1}"
                f"（{ref_path}）——源录音或裁剪参数已变。"
                f"勿在未核验音色上跑长合成；指纹清单见 pipeline/voices/refs.toml"
            )

        # 混合档：解析选择器并逐句定束宽（此处即失败，避免典型的「id 拼错→静默全按低束宽跑完」）
        beams_of: dict[str, int] = dict.fromkeys((i["id"] for i in items), beams)
        if args.steady:
            if args.steady_beams <= beams:
                parser.error(
                    f"--steady-beams {args.steady_beams} 不高于基础束宽 {beams}，混合档无意义"
                )
            try:
                sids, scenes, prefixes = parse_steady_selector(args.steady)
            except ValueError as e:
                parser.error(str(e))
            for tok in sorted(sids | scenes) + [p + "*" for p in prefixes]:
                one_id, one_scene, one_pre = parse_steady_selector(tok)
                if not any(steady_match(i, one_id, one_scene, one_pre) for i in items):
                    parser.error(
                        f"--steady 的 {tok!r} 未命中任何句子（幕名/句 id 拼错？）"
                    )
            for i in items:
                if steady_match(i, sids, scenes, prefixes):
                    beams_of[i["id"]] = args.steady_beams

        signature = f"indextts|{args.engine_tag}|{style_name}|{ref_sha1}"
        # 在 --plan 之前检查：排期正是发现「这次长跑将整集换音色」的最佳时机
        check_voice_marker(out_dir, signature, args.allow_voice_switch)

        if args.plan:  # 计划模式：纯本地计算，不连服务
            print(
                f">> 计划：{root.name} · 风格 {style_name} · alpha {alpha:g} · 语速 {df:g}"
                + (
                    ""
                    if not sampling
                    else " · 采样 "
                    + ",".join(f"{k}={sampling[k]!r}" for k in sorted(sampling))
                )
            )
            todo = {b: 0 for b in sorted(set(beams_of.values()))}
            cached = dict(todo)
            store_hits = dict(todo)
            for i in items:
                b = beams_of[i["id"]]
                d = digest_indextts(
                    ref_sha1,
                    style_name,
                    vec,
                    alpha,
                    df,
                    args.lang,
                    args.engine_tag,
                    synth_source_text(i),
                    b,
                    emo_ref_sha1,
                    args.emo_text,
                    sampling,
                )
                meta, mp3 = out_dir / f"{i['id']}.sha", out_dir / f"{i['id']}.mp3"
                hit = (
                    not args.force
                    and mp3.exists()
                    and mp3.stat().st_size > 0
                    and meta.exists()
                    and meta.read_text() == d
                )
                (cached if hit else todo)[b] += 1
                if not hit and not args.force and store_has(store, slug, i["id"], d):
                    store_hits[b] += 1
            # 估时用**整集长跑折算口径**（含降频、机器争用与逐句开销），不是单句空闲口径：
            # 1 束 RTF≈13（三集 596 句实测 8.5 h 折算）、≥2 束≈45（短句 A/B 实测约 3.2 倍）；
            # 每句音频按 4.2s（三集均值）。单句空闲时可快到 RTF 6–7，故本估算偏保守。
            est = sum(
                (n - store_hits[b])
                * AVG_SEC_PER_LINE
                * (RTF_1BEAM if b == 1 else RTF_MULTIBEAM)
                for b, n in todo.items()
            )
            for b in sorted(todo):
                print(
                    f"   束宽 {b}：待合成 {todo[b]:>3} 句 · 已缓存 {cached[b]:>3} 句"
                    + (
                        f" · 版本库可回收 {store_hits[b]:>3} 句"
                        if store_hits[b]
                        else ""
                    )
                    + ("" if b == 1 else "（高束宽档）")
                )
            print(
                f">> 待合成合计 {sum(todo.values())} 句"
                + (
                    f"（其中 {sum(store_hits.values())} 句由版本库直收，不占合成时间）"
                    if sum(store_hits.values())
                    else ""
                )
                + f"，估算墙钟约 {est / 3600:.1f} 小时"
                f"（长跑折算口径 RTF 1 束≈{RTF_1BEAM:g} / 高束宽≈{RTF_MULTIBEAM:g}，"
                f"机器负载会显著影响，仅作排期参考）"
            )
            return

        try:
            health = await asyncio.to_thread(
                http_json, "GET", f"{args.server}/health", None, 10
            )
            if not health.get("ok"):
                raise RuntimeError(f"health.ok=false: {health}")
        except Exception as e:  # noqa: BLE001 - 服务未启动给出可操作指引
            print(
                f"IndexTTS 服务不可用（{e}）。请先启动：\n{server_launch_hint()}\n详见 {MANUAL} §二",
                file=sys.stderr,
            )
            sys.exit(1)
        if df != 1.0 and not health.get("supports_duration_factor"):
            parser.error(
                "当前服务为 IndexTTS-2（无语速控制）：去掉 --duration-factor，或风格选 neutral，见 "
                + MANUAL
            )
        if args.emo_text and not health.get("supports_emo_text"):
            parser.error(
                "当前服务未加载 QwenEmotion：重启服务加 --use-qwen-emo，或改用 --emo-vector/--emo-ref，见 "
                + MANUAL
            )
        # 采样参数/种子对旧服务是**静默丢弃**（Pydantic 默认忽略未声明字段），而摘要这边已经
        # 按新参数变了 ⇒ 会产出「摘要说改过、音频其实没改」的假验证。故显式硬失败。
        sampling_only = {k: v for k, v in sampling.items() if k != "seed"}
        if sampling_only and not health.get("supports_sampling_params"):
            parser.error(
                f"当前服务不支持采样参数（{','.join(sorted(sampling_only))}）：服务端代码过旧，"
                f"请用本仓当前 tts_server.py 重启服务，见 {MANUAL} §二"
            )
        if "seed" in sampling and not health.get("supports_seed"):
            parser.error(
                f"当前服务不支持 --seed：服务端代码过旧，请用本仓当前 tts_server.py 重启服务，见 {MANUAL} §二"
            )
        if sampling.get("text_normalization") is False and not health.get(
            "supports_text_normalization"
        ):
            parser.error(
                "当前服务为 IndexTTS-2（infer() 无 text_normalization 形参）："
                "去掉 --no-text-normalization，或改用 v2.5 服务"
            )

        sem = asyncio.Semaphore(CONCURRENCY_INDEXTTS)
        results = await asyncio.gather(
            *(
                synth_indextts(
                    sem,
                    i,
                    args.force,
                    str(ref_path),
                    ref_sha1,
                    style_name,
                    vec,
                    alpha,
                    df,
                    args.lang,
                    args.engine_tag,
                    args.server,
                    out_dir,
                    # 逐句束宽：基础值来自「命令行优先、否则取预设」，--steady 命中句再提高
                    num_beams=beams_of[i["id"]],
                    emo_ref=emo_ref_path,
                    emo_ref_sha1=emo_ref_sha1,
                    emo_text=args.emo_text,
                    sampling=sampling,
                    store=store,
                    slug=slug,
                )
                for i in items
            )
        )

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(results, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    write_voice_marker(out_dir, signature)  # 成功收尾才落签名，中途失败不改变基线
    total = sum(r["durationSec"] for r in results)
    print(f"合成 {len(results)} 句，纯语音总时长 {total / 60:.2f} 分钟")
    if args.engine == "indextts" and args.steady:  # 混合档：回执两档各多少句，便于对账
        hi = sum(1 for i in items if beams_of[i["id"]] != beams)
        print(
            f"混合档：{len(items) - hi} 句按束宽 {beams}（{style_name}）+ "
            f"{hi} 句按束宽 {args.steady_beams}（--steady {args.steady}）"
        )
    print(f"manifest: {manifest_path}")


if __name__ == "__main__":
    asyncio.run(main())
