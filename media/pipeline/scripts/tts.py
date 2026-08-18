#!/usr/bin/env python3
"""逐句合成配音并产出时长 manifest——公共管线版本（双引擎）。

- 输入：<工程>/script/narration.json（单一事实源派生）
- 输出：<工程>/video/public/audio/{id}.mp3 + <工程>/video/public/audio/manifest.json
- 引擎：
  - edge（默认）：edge-tts 预置音色，免密钥，行为与历史版本完全一致；
  - indextts：声音克隆（IndexTTS-2.5 本地服务），需先启动 tts_server.py，
    通过 --ref 提供参考音色样本、--style 选择风格（激情/轻快/自信/正能量等）。
- 幂等：参数与文本未变则跳过（SHA1 摘要 sidecar 缓存）。

用法：
  edge：    uv run --no-project --with edge-tts --with mutagen media/pipeline/scripts/tts.py \
                --project media/<工程> [--voice zh-CN-YunxiNeural] [--rate +4%] [--force]
  indextts：uv run --no-project --with mutagen media/pipeline/scripts/tts.py \
                --project media/<工程> --engine indextts --ref <参考样本.wav> \
                [--style passionate] [--server http://127.0.0.1:8766] [--force]
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

# 风格预设：激情/轻快/自信/正能量 —— 数值为初值，可实测试听后微调。
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
) -> tuple[str, list[float] | None, float, float]:
    """返回 (风格名, 情感向量|None, emo_alpha, duration_factor)。"""
    if args.emo_vector:
        vec = parse_emo_vector(args.emo_vector)
        alpha = args.emo_alpha if args.emo_alpha is not None else 0.6
        df = args.duration_factor if args.duration_factor is not None else 1.0
        return "raw", vec, alpha, df
    preset = STYLE_PRESETS[args.style]
    alpha = args.emo_alpha if args.emo_alpha is not None else preset["alpha"]
    df = args.duration_factor if args.duration_factor is not None else preset["df"]
    return args.style, preset["vec"], alpha, df


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
) -> tuple[bytes, str]:
    """POST /synthesize → (mp3 bytes, X-Audio-Format)。4xx 不可重试。"""
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
    req = urllib.request.Request(
        f"{server}/synthesize",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
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
) -> str:
    vec_str = ",".join(repr(x) for x in vec) if vec else "none"
    # 束宽改变合成结果，须入键；默认 1 时省略字段——沿用历史摘要格式，存量缓存不失效
    beams_part = "" if num_beams == 1 else f"|beams={num_beams}"
    return hashlib.sha1(
        f"indextts|{engine_tag}|{ref_sha1}|{lang}|{style}|{vec_str}|{alpha!r}|{df!r}|{text}{beams_part}".encode()
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
) -> dict:
    sid, text = item["id"], item["text"]
    mp3 = out_dir / f"{sid}.mp3"
    meta = out_dir / f"{sid}.sha"
    digest = digest_indextts(ref_sha1, style, vec, alpha, df, lang, engine_tag, text, num_beams)

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
        default=1,
        type=int,
        choices=[1, 2, 3, 4, 5],
        help="[indextts] GPT 束搜索宽度（默认 1；采样生成下与上游默认 3 听感差异可忽略，"
        "但 GPT 段耗时约按束宽线性放大——长篇管线跑 1，质量敏感单句可试 3）",
    )
    idx.add_argument(
        "--engine-tag",
        default="indextts",
        help="[indextts] 缓存标记；模型升级后自定义以失效旧缓存",
    )
    args = parser.parse_args()
    args.server = args.server.rstrip("/")  # 尾斜杠归一：health/synthesize 两处拼 URL 前收口

    if args.list_styles:
        print(
            "风格        说明    情感向量（happy,angry,sad,afraid,disgusted,melancholic,surprised,calm）  alpha  语速"
        )
        for name, p in STYLE_PRESETS.items():
            vec = (
                ",".join(f"{x:g}" for x in p["vec"]) if p["vec"] else "—（不注入情感）"
            )
            print(f"{name:<10}  {p['label']:<6}  {vec:<62}  {p['alpha']:<5}  {p['df']}")
        return

    if args.engine == "edge":
        ignored = [
            flag
            for flag, val in {
                "--ref": args.ref,
                "--emo-vector": args.emo_vector,
                "--emo-alpha": args.emo_alpha,
                "--duration-factor": args.duration_factor,
                "--num-beams": args.num_beams != 1,
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
        if args.style != "neutral" and args.emo_vector:
            parser.error("--style 非默认值与 --emo-vector 互斥")
        try:
            style_name, vec, alpha, df = resolve_style(args)
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
        if vec is not None and sum(vec) * alpha > 0.8:  # infer 内部以 alpha 缩放，校验有效和
            parser.error(f"情感向量有效和 {sum(vec) * alpha:.3f}（Σvec×alpha）超过 0.8 上限")
        if args.duration_factor is not None and not 0.5 <= args.duration_factor <= 2.0:
            parser.error("--duration-factor 必须在 [0.5, 2.0]")

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

        ref_sha1 = hashlib.sha1(ref_path.read_bytes()).hexdigest()[:12]
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
                    num_beams=args.num_beams,
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
    print(f"manifest: {manifest_path}")


if __name__ == "__main__":
    asyncio.run(main())
