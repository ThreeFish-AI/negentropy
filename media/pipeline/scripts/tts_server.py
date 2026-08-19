#!/usr/bin/env python3
"""IndexTTS 声音克隆推理服务——运行于 index-tts 工程环境内的本地 HTTP 服务。

- 位置约定：本脚本属于公共管线（SSOT），但必须在 index-tts checkout（如 ~/tools/index-tts）
  的 uv 环境内运行（torch/indextts 等重依赖不进入本仓）；
- 启动（在 index-tts 根目录）：
    uv run --frozen --with fastapi --with uvicorn --with soundfile --with numpy --with lameenc \
        python <本仓>/media/pipeline/scripts/tts_server.py --model-dir checkpoints --port 8766
- 端点：
    GET  /health     —— 服务与模型元信息（version/device/dtype/encoder/supports_duration_factor/
                        supports_emo_text）
    POST /synthesize —— JSON 请求合成，返回 MP3 bytes（X-Audio-Format 头）
- 情感三来源（互斥，只能给一个）：
    emo_vector   —— 8 维显式向量（有效和 Σvec×alpha ≤ 0.8）
    emo_ref_path —— 情感参考音频：音色仍取 ref_path，语调/情绪迁移自这段录音（无合成味）
    emo_text     —— 自然语言描述（需 --use-qwen-emo），服务端转向量并在 X-Emo-Vector 头回显
- 安全：仅监听 127.0.0.1，无鉴权，勿暴露公网；ref_path / emo_ref_path 为服务端本地绝对路径。

完整部署/排障手册见 media/pipeline/VOICE-CLONING.md。
"""

from __future__ import annotations

import argparse
import asyncio
import io
import math
import sys
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, field_validator


def ensure_indextts_import(index_tts_root: Path) -> None:
    """优先依赖 venv 已安装的 indextts；仅源码未安装时把 checkout 根目录塞进 sys.path 兜底。"""
    try:
        import indextts  # noqa: F401
    except ImportError:
        sys.path.insert(0, str(index_tts_root.resolve()))


def load_model(
    version: str, model_dir: Path, dtype: str, device: str, use_qwen_emo: bool = False
):
    """按版本构造 IndexTTS2；构造器差异以 webui.py build_tts() 为锚点：
    v2.5 仅 use_bf16（MPS 分支内部强制关闭），v2 为 use_fp16。
    use_qwen_emo 决定是否加载 QwenEmotion（自然语言情感描述→向量，约 +1.5 GB 内存）。

    返回 (tts 对象, 元信息 dict)。
    """
    if version == "2.5":
        from indextts.infer_v2_5 import IndexTTS2

        use_bf16 = dtype in ("auto", "bf16")  # MPS 分支内部会强制 False → 实际 fp32
        tts = IndexTTS2(
            cfg_path=str(model_dir / "config.yaml"),
            model_dir=str(model_dir),
            use_bf16=use_bf16,
            use_cuda_kernel=False,
            use_deepspeed=False,
            use_qwen_emo=use_qwen_emo,
            device=None if device == "auto" else device,
        )
        return tts, {
            "version": "2.5",
            "supports_duration_factor": True,
            # 从对象实际状态派生：MPS 分支构造器内部强制 use_bf16=False（实际 fp32）
            "dtype_flag": "bf16" if getattr(tts, "use_bf16", use_bf16) else "fp32",
        }

    from indextts.infer_v2 import IndexTTS2

    use_fp16 = dtype in ("auto", "fp16")
    tts = IndexTTS2(
        cfg_path=str(model_dir / "config.yaml"),
        model_dir=str(model_dir),
        use_fp16=use_fp16,
        use_cuda_kernel=False,
        use_deepspeed=False,
        use_qwen_emo=use_qwen_emo,
        device=None if device == "auto" else device,
    )
    return tts, {
        "version": "2",
        "supports_duration_factor": False,
        "dtype_flag": "fp16" if getattr(tts, "use_fp16", use_fp16) else "fp32",
    }


# ---------------- 编码层：WAV(float32) → MP3 bytes ----------------

_ENCODER: str | None = None


def _probe_encoders() -> str:
    """启动时一次性探测可用 MP3 编码器：soundfile（libsndfile≥1.1 自带 LAME）→ lameenc。"""
    global _ENCODER
    sr = 22050
    tone = (np.sin(2 * np.pi * 440 * np.arange(sr) / sr) * 0.5).astype(np.float32)
    try:
        buf = io.BytesIO()
        sf.write(buf, tone, sr, format="MP3", subtype="MPEG_LAYER_III")
        if buf.tell() > 0:
            _ENCODER = "soundfile"
            return _ENCODER
    except Exception:  # noqa: BLE001 - 探测失败换下一档
        pass
    try:
        import lameenc

        enc = lameenc.Encoder()
        enc.set_bit_rate(128)
        enc.set_in_sample_rate(sr)
        enc.set_channels(1)
        enc.set_quality(2)
        out = enc.encode(tone.tobytes()) + enc.flush()
        if len(out) > 0:
            _ENCODER = "lameenc"
            return _ENCODER
    except Exception:  # noqa: BLE001 - 双双失败，保留 None（返回 WAV）
        pass
    _ENCODER = None
    return "none"


def encode_mp3(data: np.ndarray, sr: int) -> tuple[bytes, str]:
    """输入 (N,) float32 → (音频 bytes, 实际格式)。无可用 MP3 编码器时回退 WAV。"""
    if _ENCODER == "soundfile":
        buf = io.BytesIO()
        sf.write(buf, data, sr, format="MP3", subtype="MPEG_LAYER_III")
        return buf.getvalue(), "mp3"
    if _ENCODER == "lameenc":
        import lameenc

        enc = lameenc.Encoder()
        enc.set_bit_rate(128)
        enc.set_in_sample_rate(sr)
        enc.set_channels(1)
        enc.set_quality(2)
        pcm = (np.clip(data, -1.0, 1.0) * 32767.0).astype(np.int16).tobytes()
        out = enc.encode(pcm) + enc.flush()
        return bytes(out), "mp3"
    # 双编码器均不可用：返回 WAV，由客户端按 X-Audio-Format 报错指引
    buf = io.BytesIO()
    sf.write(buf, data, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue(), "wav"


# ---------------- FastAPI 应用 ----------------

EMO_LABELS = "happy,angry,sad,afraid,disgusted,melancholic,surprised,calm"


class SynthesizeRequest(BaseModel):
    text: str
    ref_path: str
    emo_vector: list[float] | None = None
    # 情感参考音频：音色取自 ref_path，语调/情绪取自本字段（另一段录音），无合成味的风格迁移。
    # 上游 infer() 在 emo_vector 存在时会「静默丢弃」emo_audio_prompt，故本服务显式拒绝二者同传。
    emo_ref_path: str | None = None
    # 自然语言情感描述（如「轻快爽朗、自信阳光」）：服务端先用 QwenEmotion 转成 8 维向量，
    # 再按 ≤0.8 有效和规则缩放后当作 emo_vector 使用，并在 X-Emo-Vector 响应头回显供固化复用。
    emo_text: str | None = None
    emo_alpha: float = 1.0
    duration_factor: float = 1.0
    lang: str = "ZH"
    num_beams: int = 1

    @field_validator("emo_vector")
    @classmethod
    def _vec_ok(cls, v: list[float] | None) -> list[float] | None:
        if v is None:
            return v
        if len(v) != 8:
            raise ValueError(f"emo_vector 必须为 8 维（{EMO_LABELS}）")
        if not all(
            math.isfinite(x) and x >= 0 for x in v
        ):  # isfinite 拦 NaN/Inf（比较恒 False 漏网）
            raise ValueError("emo_vector 各分量必须为非负有限数值")
        return v  # 有效和（×emo_alpha）校验在 handler 内跨字段联合进行

    @field_validator("emo_alpha")
    @classmethod
    def _alpha_ok(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:  # NaN 会因比较恒 False 被拦截
            raise ValueError("emo_alpha 必须在 [0, 1]")
        return v

    @field_validator("duration_factor")
    @classmethod
    def _df_ok(cls, v: float) -> float:
        if not 0.5 <= v <= 2.0:  # NaN 会因比较恒 False 被拦截
            raise ValueError("duration_factor 必须在 [0.5, 2.0]")
        return v

    @field_validator("num_beams")
    @classmethod
    def _beams_ok(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("num_beams 必须在 [1, 5]")
        return v


STATE: dict = {}


def _qwen_vector_sync(tts, emo_text: str, alpha: float) -> list[float]:
    """自然语言情感描述 → 8 维向量（QwenEmotion），并按 ≤0.8 有效和规则整体缩放。

    Qwen 每维 clamp 在 [0, 1.2] 但**不做和归一**，Σ 可能 >1；而上游混合式为
    `emovec = Σ(w·基向量) + (1 - Σw)·参考音频情感`，Σw>1 会让参考音频项变负权重（发音劣化）。
    故此处等比缩放（保留 Qwen 选定的「方向」，只压「强度」），保底留 ≥0.2 的自然情感残量。
    """
    vec = list(tts.qwen_emo.inference(emo_text).values())
    total = sum(vec) * alpha
    if total > 0.8:
        scale = 0.8 / total
        vec = [round(x * scale, 4) for x in vec]
    return vec


def _infer_sync(tts, ref: Path, req: SynthesizeRequest, tmpdir: Path) -> Path:
    wav_path = tmpdir / "out.wav"
    kwargs = dict(
        spk_audio_prompt=str(ref),
        text=req.text,
        output_path=str(wav_path),
        emo_vector=req.emo_vector,
        emo_audio_prompt=req.emo_ref_path,
        emo_alpha=req.emo_alpha,
        use_random=False,
        verbose=False,
        # 束搜索宽度：上游默认 3；采样生成（do_sample=True）下 1 与 3 的听感差异可忽略，
        # 但 GPT 段耗时约按束宽线性放大（MPS fp32 实测 RTF 40-58），管线长跑默认 1。
        num_beams=req.num_beams,
    )
    if STATE["supports_duration_factor"]:
        kwargs["duration_factor"] = req.duration_factor
        kwargs["lang"] = req.lang
    tts.infer(**kwargs)
    return wav_path


def _read_audio(path: Path) -> tuple[np.ndarray, int]:
    data, sr = sf.read(str(path), dtype="float32")
    if not np.isfinite(data).all():
        raise HTTPException(
            500,
            "生成音频含 NaN/Inf（MPS 数值问题）：请重试；仍失败则服务加 --device cpu 重启",
        )
    return data, sr


@asynccontextmanager
async def lifespan(app: FastAPI):
    args = app.state.args
    ensure_indextts_import(args.index_tts_root)
    print(">> 加载 IndexTTS 模型（首次运行会自动下载 w2v-bert 等辅助模型）…")
    tts, meta = load_model(
        args.version, args.model_dir, args.dtype, args.device, args.use_qwen_emo
    )
    encoder = _probe_encoders()
    STATE.update(
        tts=tts,
        version=meta["version"],
        device=str(getattr(tts, "device", "unknown")),
        dtype=meta["dtype_flag"],
        encoder=encoder,
        supports_duration_factor=meta["supports_duration_factor"],
        supports_emo_text=getattr(tts, "qwen_emo", None) is not None,
        infer_lock=asyncio.Lock(),
    )
    print(
        f">> 就绪：IndexTTS-{STATE['version']} device={STATE['device']} dtype={STATE['dtype']} "
        f"encoder={encoder} emo_text={'on' if STATE['supports_emo_text'] else 'off'}"
    )
    yield
    STATE.clear()


app = FastAPI(title="IndexTTS Pipeline Server", version="1.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "version": STATE.get("version"),
        "device": STATE.get("device"),
        "synthesizing": STATE["infer_lock"].locked()
        if STATE.get("infer_lock")
        else False,
        "dtype": STATE.get("dtype"),
        "encoder": STATE.get("encoder"),
        "supports_duration_factor": STATE.get("supports_duration_factor"),
        "supports_emo_text": STATE.get("supports_emo_text", False),
    }


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    if not STATE:
        raise HTTPException(503, "模型尚未加载完成，请稍候")
    ref = Path(req.ref_path).expanduser()
    if not ref.is_file():
        raise HTTPException(400, f"参考音频不存在: {ref}")
    # 三种情感来源互斥：向量 / 参考音频 / 自然语言描述。上游对「向量+音频」是静默丢弃音频，
    # 静默降级比报错更难排查，故此处显式拒绝。
    sources = [
        name
        for name, val in (
            ("emo_vector", req.emo_vector),
            ("emo_ref_path", req.emo_ref_path),
            ("emo_text", req.emo_text),
        )
        if val
    ]
    if len(sources) > 1:
        raise HTTPException(400, f"情感来源互斥，只能给一个：{' / '.join(sources)}")
    if req.emo_ref_path:
        emo_ref = Path(req.emo_ref_path).expanduser()
        if not emo_ref.is_file():
            raise HTTPException(400, f"情感参考音频不存在: {emo_ref}")
        req.emo_ref_path = str(emo_ref)
    if req.emo_text and not STATE.get("supports_emo_text"):
        raise HTTPException(
            400,
            "emo_text 需要 QwenEmotion：服务启动时加 --use-qwen-emo（约 +1.5 GB 内存）",
        )
    effective_sum = (sum(req.emo_vector) if req.emo_vector else 0.0) * req.emo_alpha
    if effective_sum > 0.8:  # infer 内部以 alpha 缩放向量，有效和超界会产生负混合权重
        raise HTTPException(
            400,
            f"情感向量有效和 {effective_sum:.3f}（Σvec×alpha）超过 0.8 上限，请降低权重或 --emo-alpha",
        )
    if req.duration_factor != 1.0 and not STATE["supports_duration_factor"]:
        raise HTTPException(
            400,
            "IndexTTS-2 不支持 duration_factor（v2.5 专属），请改用 v2.5 服务或去掉 --duration-factor",
        )

    derived: list[float] | None = None
    async with STATE["infer_lock"]:
        if (
            req.emo_text
        ):  # 先算向量（占 GPU，须在锁内），再走与显式向量完全相同的合成路径
            derived = await asyncio.to_thread(
                _qwen_vector_sync, STATE["tts"], req.emo_text, req.emo_alpha
            )
            req.emo_vector = derived
        with tempfile.TemporaryDirectory(prefix="indextts_") as td:
            wav_path = await asyncio.to_thread(
                _infer_sync, STATE["tts"], ref, req, Path(td)
            )
            data, sr = await asyncio.to_thread(_read_audio, wav_path)
            audio, fmt = await asyncio.to_thread(encode_mp3, data, sr)
    headers = {"X-Audio-Format": fmt, "X-Duration-Sec": f"{len(data) / sr:.3f}"}
    if derived is not None:  # 回显 Qwen 推出的向量，便于事后用 --emo-vector 固化复现
        headers["X-Emo-Vector"] = ",".join(f"{x:g}" for x in derived)
    return Response(
        audio,
        media_type="audio/mpeg" if fmt == "mp3" else "audio/wav",
        headers=headers,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="IndexTTS 声音克隆推理服务")
    parser.add_argument(
        "--model-dir", default="checkpoints", help="模型目录（绝对或相对当前目录）"
    )
    parser.add_argument(
        "--index-tts-root",
        default=str(Path.cwd()),
        help="index-tts checkout 根目录（sys.path 兜底用）",
    )
    parser.add_argument(
        "--indextts-version", choices=["2", "2.5"], default="2.5", dest="version"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument(
        "--dtype",
        choices=["auto", "bf16", "fp16", "fp32"],
        default="auto",
        help="auto：v2.5→bf16（MPS 强制 fp32）/ v2→fp16；显式 fp32 两个版本均安全",
    )
    parser.add_argument("--device", choices=["auto", "mps", "cpu"], default="auto")
    parser.add_argument(
        "--use-qwen-emo",
        action="store_true",
        help="加载 QwenEmotion（0.6B，约 +1.5 GB 内存），开启后请求可用 emo_text 自然语言描述情感",
    )
    args = parser.parse_args()

    args.index_tts_root = Path(args.index_tts_root).resolve()
    args.model_dir = Path(args.model_dir).resolve()
    if not args.model_dir.is_dir():
        sys.exit(
            f"模型目录不存在: {args.model_dir} —— 先按 VOICE-CLONING.md §二 下载 checkpoints"
        )
    if not (args.model_dir / "config.yaml").is_file():
        sys.exit(
            f"模型目录缺少 config.yaml: {args.model_dir} —— checkpoints 下载不完整"
        )

    app.state.args = args
    print(
        f">> IndexTTS 服务器启动: {args.host}:{args.port} version={args.version} model_dir={args.model_dir}"
    )
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
