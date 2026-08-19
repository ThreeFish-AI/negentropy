#!/usr/bin/env python3
"""单句声音小样试听——直调 IndexTTS 服务合成一句话，不需要视频工程。

- 动机：全量一集（180–230 句）需 2.5–3.5 小时，而「克隆的音色像不像我」「哪档风格
  适合本集」只需一句话即可判定。本脚本把 tts.py 的合成路径剥出单句版，用于试听收敛。
- 一致性：风格预设、口播文本预处理、HTTP 契约全部复用 tts.py（单一事实源），小样与
  成片走完全相同的合成路径，听感可直接外推。
- 前置：参考音色样本（prepare_ref.py 产出）+ 已启动的 tts_server.py。

用法（仓库根执行）：
  # 单档试听
  uv run --no-project --with mutagen media/pipeline/scripts/tts_sample.py \
      --ref media/pipeline/voices/me-1.wav --style passionate --play
  # 五风格 A/B（neutral/passionate/lively/confident/positive 各合成一遍）
  uv run --no-project --with mutagen media/pipeline/scripts/tts_sample.py \
      --ref media/pipeline/voices/me-1.wav --all-styles --play

产物：<仓库根>/.temp/voice-samples/{风格}.mp3（已被根 .gitignore 忽略）——内含本人音色，
属生物特征信息，试听后请及时清理。完整手册见 media/pipeline/VOICE-CLONING.md §5.1。
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import sys
import time
from pathlib import Path

# tts.py 与本脚本同目录：显式注入 sys.path，令任意 cwd / 调用方式（含 python -m）均可导入
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tts import (  # noqa: E402 - 必须在 sys.path 注入之后导入
    MANUAL,
    STYLE_PRESETS,
    NonRetryableError,
    http_json,
    http_synthesize,
    mp3_duration,
    resolve_style,
    tts_text,
)

SERVER_SCRIPT = Path(__file__).resolve().parent / "tts_server.py"
# parents: [0]=scripts [1]=pipeline [2]=media [3]=仓库根（与 prepare_ref.py 的 parents[1] 同惯例）
DEFAULT_OUT_DIR = Path(__file__).resolve().parents[3] / ".temp" / "voice-samples"
DEFAULT_TEXT = "自进化编码智能体的核心不是写代码，而是让 AI 学会修改自己写代码的方式。"
ATTEMPTS = 2  # 非 4xx（如 MPS 数值问题致的 500）再试一次；4xx 立即失败


def build_jobs(
    args: argparse.Namespace,
) -> list[tuple[str, list[float] | None, float, float]]:
    """→ [(风格名, 情感向量|None, emo_alpha, duration_factor)]。

    --all-styles 逐档取各预设自带的 alpha/df（这正是 A/B 的意义，故与手动覆盖互斥）。
    """
    if args.all_styles:
        return [
            resolve_style(
                argparse.Namespace(
                    emo_vector=None, style=name, emo_alpha=None, duration_factor=None
                )
            )
            for name in STYLE_PRESETS
        ]
    return [resolve_style(args)]


def check_server(server: str, need_duration_factor: bool) -> None:
    """健康检查——服务未起时给出可直接粘贴的启动命令，避免等到合成阶段才失败。"""
    try:
        health = http_json("GET", f"{server}/health", None, 10)
        if not health.get("ok"):
            raise RuntimeError(f"health.ok=false: {health}")
    except Exception as e:  # noqa: BLE001 - 任何不可达都归一为可操作指引
        sys.exit(
            f"IndexTTS 服务不可用（{e}）。请先启动：\n"
            f"  cd ~/tools/index-tts && uv run --frozen --with fastapi --with uvicorn \\\n"
            f"      --with soundfile --with numpy --with lameenc \\\n"
            f"      python {SERVER_SCRIPT} --model-dir checkpoints --port 8766\n"
            f"详见 {MANUAL} §2.3"
        )
    print(
        f">> 服务就绪：IndexTTS-{health.get('version')} device={health.get('device')} "
        f"dtype={health.get('dtype')} encoder={health.get('encoder')}"
    )
    if need_duration_factor and not health.get("supports_duration_factor"):
        sys.exit(
            "当前服务为 IndexTTS-2（无语速控制），而所选风格的 duration_factor≠1.0：\n"
            f"  改用 --style neutral，或以 --indextts-version 2.5 重启服务（见 {MANUAL} §七）"
        )


def synthesize_one(
    args: argparse.Namespace,
    name: str,
    vec: list[float] | None,
    alpha: float,
    df: float,
    out_dir: Path,
) -> dict:
    """合成一档并落盘 → {style, path, duration, wall, rtf}。失败即退出（小样无需容错累积）。"""
    out = out_dir / f"{name}.mp3"
    last_err: Exception | None = None
    for attempt in range(ATTEMPTS):
        t0 = time.perf_counter()
        try:
            audio, fmt = http_synthesize(
                args.server,
                tts_text(args.text),
                str(args.ref),
                vec,
                alpha,
                df,
                args.lang,
                args.num_beams,
            )
        except NonRetryableError as e:
            sys.exit(f"[{name}] 请求被拒（4xx，重试无意义）：{e}")
        except Exception as e:  # noqa: BLE001 - 推理服务偶发 500/超时，整体重试
            last_err = e
            print(f"[{name}] 第 {attempt + 1}/{ATTEMPTS} 次失败：{e}", file=sys.stderr)
            continue
        wall = time.perf_counter() - t0
        if fmt != "mp3":
            sys.exit(
                f"[{name}] 服务端 MP3 编码器不可用（X-Audio-Format={fmt}）—— "
                f"按 {MANUAL} §七 带 --with lameenc 重启服务"
            )
        if not audio:
            last_err = RuntimeError("空音频响应")
            continue
        out.write_bytes(audio)
        duration = mp3_duration(out)
        rtf = wall / duration if duration else float("nan")
        print(  # flush：长跑常被 tee/nohup 重定向，缓冲会让进度看起来「卡住」
            f"[{name:<10}] 音频 {duration:5.2f}s · 墙钟 {wall:6.1f}s · RTF {rtf:5.1f} · {out}",
            flush=True,
        )
        return {
            "style": name,
            "path": out,
            "duration": duration,
            "wall": wall,
            "rtf": rtf,
        }
    sys.exit(f"[{name}] 合成失败：{last_err}")


def play(results: list[dict]) -> None:
    """顺序试听（macOS afplay）。缺 afplay 时只提示，不视为失败。"""
    player = shutil.which("afplay")
    if not player:
        print(
            "未找到 afplay（非 macOS？）：请用系统播放器打开上述文件试听",
            file=sys.stderr,
        )
        return
    for r in results:
        print(f">> 播放 {r['style']}（{r['duration']:.2f}s）…")
        subprocess.run([player, str(r["path"])], check=False)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="单句声音小样试听（直调 IndexTTS 服务，无需视频工程）"
    )
    parser.add_argument(
        "--ref", required=True, help="参考音色样本路径（prepare_ref.py 产出）"
    )
    parser.add_argument(
        "--text", default=None, help=f"试听文本（默认内置一句：{DEFAULT_TEXT}）"
    )
    parser.add_argument(
        "--text-file", default=None, help="从文件读取试听文本（与 --text 互斥）"
    )
    parser.add_argument(
        "--style",
        default="neutral",
        choices=list(STYLE_PRESETS),
        help="风格预设（默认 neutral）",
    )
    parser.add_argument(
        "--all-styles",
        action="store_true",
        help="逐档合成全部风格预设做 A/B（与 --emo-vector/--emo-alpha/--duration-factor 互斥）",
    )
    parser.add_argument(
        "--emo-vector",
        default=None,
        help="原始情感向量，如 happy:0.6,calm:0.2（与非默认 --style 互斥）",
    )
    parser.add_argument(
        "--emo-alpha", default=None, type=float, help="情感强度 0–1（默认随风格）"
    )
    parser.add_argument(
        "--duration-factor", default=None, type=float, help="语速 0.5–2.0（默认随风格）"
    )
    parser.add_argument("--lang", default="ZH", help="语言（默认 ZH）")
    parser.add_argument(
        "--num-beams",
        default=1,
        type=int,
        choices=[1, 2, 3, 4, 5],
        help="GPT 束搜索宽度（默认 1；耗时约按束宽线性放大，见 " + MANUAL + " §4.3b）",
    )
    parser.add_argument("--server", default="http://127.0.0.1:8766", help="服务地址")
    parser.add_argument(
        "--out-dir",
        default=None,
        help=f"产物目录（默认 {DEFAULT_OUT_DIR}，已被 .gitignore 忽略）",
    )
    parser.add_argument("--play", action="store_true", help="合成后用 afplay 顺序试听")
    parser.add_argument(
        "--dry-run", action="store_true", help="只解析并打印参数，不连服务、不合成"
    )
    args = parser.parse_args()
    args.server = args.server.rstrip("/")

    # ---- 参数互斥与取值校验（尽早失败：单档合成约 2 分钟，不能等到最后才报错）----
    if args.text and args.text_file:
        parser.error("--text 与 --text-file 互斥")
    if args.all_styles:
        overrides = [
            flag
            for flag, val in {
                "--emo-vector": args.emo_vector,
                "--emo-alpha": args.emo_alpha,
                "--duration-factor": args.duration_factor,
            }.items()
            if val is not None
        ]
        if overrides:
            parser.error(
                f"--all-styles 会逐档取各预设自带的 alpha/语速，不能与 {' '.join(overrides)} 同用"
            )
    if args.style != "neutral" and args.emo_vector:
        parser.error("--style 非默认值与 --emo-vector 互斥")
    if args.emo_alpha is not None and not 0.0 <= args.emo_alpha <= 1.0:
        parser.error("--emo-alpha 必须在 [0, 1]")
    if args.duration_factor is not None and not 0.5 <= args.duration_factor <= 2.0:
        parser.error("--duration-factor 必须在 [0.5, 2.0]")

    ref = Path(args.ref).expanduser().resolve()
    if not ref.is_file():
        parser.error(f"参考样本不存在: {ref}（生成方式见 {MANUAL} §三）")
    args.ref = ref  # 绝对路径：服务端按自身文件系统解析 ref_path，与客户端 cwd 无关

    if args.text_file:
        text_path = Path(args.text_file).expanduser().resolve()
        if not text_path.is_file():
            parser.error(f"文本文件不存在: {text_path}")
        args.text = text_path.read_text(encoding="utf-8").strip()
    args.text = (args.text or DEFAULT_TEXT).strip()
    if not args.text:
        parser.error("试听文本为空")

    try:
        jobs = build_jobs(args)
    except ValueError as e:  # parse_emo_vector 的键名/权重错误
        parser.error(str(e))
    for name, vec, alpha, df in jobs:
        if (
            vec is not None and sum(vec) * alpha > 0.8
        ):  # 与服务端同口径：alpha 缩放后校验有效和
            parser.error(
                f"[{name}] 情感向量有效和 {sum(vec) * alpha:.3f}（Σvec×alpha）超过 0.8 上限"
            )

    ref_sha1 = hashlib.sha1(ref.read_bytes()).hexdigest()[
        :12
    ]  # 与缓存摘要同前缀，便于与 .sha 对账
    print(f">> 文本（预处理后）：{tts_text(args.text)}")
    print(f">> 参考样本：{ref}（sha1 {ref_sha1}）")
    print(f">> 风格 {len(jobs)} 档 · num_beams={args.num_beams} · lang={args.lang}")
    for name, vec, alpha, df in jobs:
        vec_str = ",".join(f"{x:g}" for x in vec) if vec else "—（不注入情感）"
        print(f"   {name:<10} vec=[{vec_str}] alpha={alpha:g} df={df:g}")
    if args.dry_run:
        print(">> --dry-run：仅解析参数，未连接服务")
        return

    try:
        import mutagen  # noqa: F401 - 时长实测依赖，提前失败好过跑完才报错
    except ImportError:
        sys.exit(
            "缺少 mutagen（实测 MP3 时长用）：请以 `uv run --no-project --with mutagen ...` 执行"
        )

    check_server(args.server, need_duration_factor=any(df != 1.0 for *_, df in jobs))

    out_dir = (
        Path(args.out_dir).expanduser().resolve() if args.out_dir else DEFAULT_OUT_DIR
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f">> 产物目录：{out_dir}\n")

    results = [
        synthesize_one(args, name, vec, alpha, df, out_dir)
        for name, vec, alpha, df in jobs
    ]

    total_wall = sum(r["wall"] for r in results)
    print(f"\n完成 {len(results)} 档，总墙钟 {total_wall / 60:.1f} 分钟")
    if args.play:
        play(results)
    if (
        len(results) == 1 and results[0]["style"] == "raw"
    ):  # 手动向量：回显向量而非不存在的 --style raw
        chosen = f'--emo-vector "{args.emo_vector}"'
        if args.emo_alpha is not None:
            chosen += f" --emo-alpha {args.emo_alpha:g}"
        if args.duration_factor is not None:
            chosen += f" --duration-factor {args.duration_factor:g}"
    else:
        chosen = f"--style {results[0]['style'] if len(results) == 1 else '<选定风格>'}"
    print(
        f"\n下一步 · 选定风格后全量合成一集：\n"
        f"  cd media/<工程> && uv run --no-project --with mutagen scripts/tts.py \\\n"
        f"      --engine indextts --ref {ref} {chosen}\n"
        f"清理 · 小样含本人音色（生物特征信息），试听后请删除：rm -rf {out_dir}"
    )


if __name__ == "__main__":
    main()
