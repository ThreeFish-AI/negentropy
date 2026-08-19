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

用法：
  edge：    uv run --no-project --with edge-tts --with mutagen media/pipeline/scripts/tts.py \
                --project media/<工程> [--voice zh-CN-YunxiNeural] [--rate +4%] [--force]
  indextts：uv run --no-project --with mutagen media/pipeline/scripts/tts.py \
                --project media/<工程> --engine indextts --ref <参考样本.wav> \
                [--style passionate] [--server http://127.0.0.1:8766] [--force]
  情感三来源（互斥）：--style/--emo-vector 向量注入 · --emo-ref <另一段录音> 语调迁移
                （更自然）· --emo-text "轻快爽朗、自信阳光" 自然语言（需服务端 --use-qwen-emo）
  （工程内薄包装等价于在工程目录下运行 scripts/tts.py）

声音克隆完整手册（部署/风格/排障/许可）见 media/pipeline/VOICE-CLONING.md。
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
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
MANUAL = "media/pipeline/VOICE-CLONING.md"

# --plan 排期估算用的实测常数（MPS fp32，长跑折算口径：含降频、机器争用与逐句开销）。
# RTF_1BEAM 来自三集 596 句连续跑 8.5 小时 / 40.2 分钟纯语音；RTF_MULTIBEAM 由同句
# 1↔3 束 A/B 实测的约 3.2 倍推得（与早期 3 束直测的 RTF 40–58 区间一致）。
RTF_1BEAM = 13.0
RTF_MULTIBEAM = 45.0
AVG_SEC_PER_LINE = 4.2  # 三集每句音频均值

# IndexTTS 8 维情感向量顺序（indextts/infer_v2_5.py 固定）：happy, angry, sad, afraid,
# disgusted, melancholic, surprised, calm。有效和（Σ分量×emo_alpha）须 ≤0.8（直调 infer 不自动归一，双端校验）。
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
# 故允许写进预设；命令行 --num-beams 显式给值时优先。注意束宽 3 使整集墙钟约 ×3.4
#（长跑折算 RTF 13→45），若只想让关键句更稳，用 --steady 混合档而非整集升档。
STYLE_PRESETS: dict[str, dict] = {
    "neutral": {"label": "中性", "vec": None, "alpha": 1.0, "df": 1.0},
    "passionate": {
        "label": "激情",
        # 高唤醒正价（happy 主载）+ 跳跃感（surprised）+ 少量 calm 锚定咬字；
        # 有效和 1.00×0.7=0.70 ≤0.8；df 0.97 护密集技术句清晰度。
        "vec": [0.70, 0, 0, 0, 0, 0, 0.20, 0.10],
        "alpha": 0.7,
        "df": 0.97,
    },
    "lively": {
        "label": "轻快",
        "vec": [0.55, 0, 0, 0, 0, 0, 0.15, 0.15],
        "alpha": 0.6,
        "df": 0.95,
    },
    "confident": {
        "label": "自信",
        "vec": [0.25, 0, 0, 0, 0, 0, 0, 0.65],
        "alpha": 0.7,
        "df": 1.05,
    },
    "positive": {
        "label": "正能量",
        "vec": [0.75, 0, 0, 0, 0, 0, 0, 0.2],
        "alpha": 0.7,
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
        # 代价：GPT 段耗时约按束宽线性放大，**整集墙钟约 ×3.4**（189 句估算 2.9→9.9 小时，
        # 见 VOICE-CLONING.md §4.3b）。想只让关键句变稳请用 `--steady` 混合档，别整集升档。
        "vec": [0.95, 0, 0, 0, 0, 0, 0.02, 0.03],
        "alpha": 0.35,
        "df": 0.95,
        "beams": 3,
    },
}


def tts_text(text: str) -> str:
    """口播文本微调：破折号换为逗号停顿，避免 TTS 念成怪音。"""
    return text.replace("——", "，").replace("……", "。")


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
) -> str:
    vec_str = ",".join(repr(x) for x in vec) if vec else "none"
    # 束宽/情感来源改变合成结果，须入键；未使用时省略字段——沿用历史摘要格式，存量缓存不失效
    beams_part = "" if num_beams == 1 else f"|beams={num_beams}"
    emo_part = f"|emoref={emo_ref_sha1}" if emo_ref_sha1 else ""
    emo_part += f"|emotext={emo_text}" if emo_text else ""
    return hashlib.sha1(
        f"indextts|{engine_tag}|{ref_sha1}|{lang}|{style}|{vec_str}|{alpha!r}|{df!r}|{text}{beams_part}{emo_part}".encode()
    ).hexdigest()


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
) -> dict:
    sid, text = item["id"], item["text"]
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
    )

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
    parser.add_argument("--list-styles", action="store_true", help="列出风格预设并退出")

    idx = parser.add_argument_group("indextts 声音克隆")
    idx.add_argument(
        "--ref", default=None, help="[indextts] 参考音色样本路径（建议 5–15s 干净人声）"
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
            print(
                f"{name:<14}  {p['label']:<6}  {vec:<62}  {p['alpha']:<5}  "
                f"{eff:<8.3g}  {p['df']:<4}  {p.get('beams', 1)}"
            )
        return

    if args.engine == "edge":
        # --plan 语义是「只看不跑」，而 edge 无束宽/无估时口径。若沿用「提示后照跑」的处理，
        # 漏写 --engine indextts 时会静默全量合成，把整集克隆音频改写成 edge 预置音色
        #（两引擎摘要必然不同，且 {id}.mp3 单槽位），故此处硬失败而非忽略。
        if args.plan:
            parser.error(
                "--plan 仅对 --engine indextts 生效（是否漏写 --engine indextts？）"
            )
        ignored = [
            flag
            for flag, val in {
                "--ref": args.ref,
                "--emo-vector": args.emo_vector,
                "--emo-ref": args.emo_ref,
                "--emo-text": args.emo_text,
                "--emo-alpha": args.emo_alpha,
                "--duration-factor": args.duration_factor,
                "--num-beams": args.num_beams is not None,
                "--steady": args.steady,
                "--steady-beams": args.steady_beams != 3,
                "--server": args.server != "http://127.0.0.1:8766",
                "--style": args.style != "neutral",
                "--lang": args.lang != "ZH",
                "--engine-tag": args.engine_tag != "indextts",
            }.items()
            if val
        ]
        if ignored:
            print(
                f"提示：以下参数仅对 --engine indextts 生效，已忽略: {' '.join(ignored)}",
                file=sys.stderr,
            )

    root = Path(args.project).resolve()
    src = root / "script" / "narration.json"
    if not src.is_file():
        sys.exit(f"narration.json 不存在: {src} —— 先运行 build_narration.py 生成")
    out_dir = root / "video" / "public" / "audio"
    items = json.loads(src.read_text(encoding="utf-8"))
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.engine == "edge":
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

        if args.plan:  # 计划模式：纯本地计算，不连服务
            print(
                f">> 计划：{root.name} · 风格 {style_name} · alpha {alpha:g} · 语速 {df:g}"
            )
            todo = {b: 0 for b in sorted(set(beams_of.values()))}
            cached = dict(todo)
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
                    i["text"],
                    b,
                    emo_ref_sha1,
                    args.emo_text,
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
            # 估时用**整集长跑折算口径**（含降频、机器争用与逐句开销），不是单句空闲口径：
            # 1 束 RTF≈13（三集 596 句实测 8.5 h 折算）、≥2 束≈45（短句 A/B 实测约 3.2 倍）；
            # 每句音频按 4.2s（三集均值）。单句空闲时可快到 RTF 6–7，故本估算偏保守。
            est = sum(
                n * AVG_SEC_PER_LINE * (RTF_1BEAM if b == 1 else RTF_MULTIBEAM)
                for b, n in todo.items()
            )
            for b in sorted(todo):
                print(
                    f"   束宽 {b}：待合成 {todo[b]:>3} 句 · 已缓存 {cached[b]:>3} 句"
                    + ("" if b == 1 else "（高束宽档）")
                )
            print(
                f">> 待合成合计 {sum(todo.values())} 句，估算墙钟约 {est / 3600:.1f} 小时"
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
                f"IndexTTS 服务不可用（{e}）。请先启动：\n"
                f"  cd ~/tools/index-tts && uv run --frozen --with fastapi --with uvicorn --with soundfile \\\n"
                f"      --with numpy --with lameenc python <仓库路径>/media/pipeline/scripts/tts_server.py \\\n"
                f"      --model-dir checkpoints --port 8766\n"
                f"详见 {MANUAL} §二",
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
                )
                for i in items
            )
        )

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(results, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
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
