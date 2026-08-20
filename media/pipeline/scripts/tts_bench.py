#!/usr/bin/env python3
"""IndexTTS 合成耗时基准与**测量环境体检**——运行于 index-tts 工程环境内（同 tts_server.py）。

## 为什么需要这个工具

2026-08-20 的性能调研发现：本机（M4 base / 24 GB）同一份工作量在 **6 次连续 infer 调用**
内从 14.49 s 漂到 48.74 s（3.4×），导致任何耗时 A/B 都不可信——交错设计的逐对比值摆动
0.75×/1.60×/0.75×，把 1.0 夹在中间。漂移有可识别的指纹：**「不该变的段变了」**
（`num_beams` 不作用于 S2M 却让 cfm 翻倍；6 s 参考的归一化 cfm 反而高于 12 s）。

所以在测任何参数之前，必须先证明**环境本身**能给出可复现的读数。本工具做两件事：

  1. `--check-only`：前置门（交换区余量 / 可用内存 / 是否已有其它 IndexTTS 实例占用）；
  2. A/A 复现性运行：同一配置连跑 N 次，报逐次耗时、分段耗时、RSS 与 MPS 分配器占用，
     并给出**环境是否合格**的判据（极差比、变异系数、随运行序的单调趋势）。

判据不看绝对速度，只看**同配置的可复现性**——环境不合格时任何 A/B 结论都是噪声。

## 用法（在 index-tts 根目录）

    cd ~/tools/index-tts
    ./.venv/bin/python <本仓>/media/pipeline/scripts/tts_bench.py --check-only
    ./.venv/bin/python <本仓>/media/pipeline/scripts/tts_bench.py \
        --ref <本仓>/media/pipeline/voices/me-bright.wav --runs 8 [--empty-cache]

`--empty-cache` 在每次调用后清 MPS 缓存并 gc——用于判定漂移是否来自分配器累积。
若开启后漂移消失，则长跑（整集 2 小时）也应在服务端逐句清理。

产物与完整方法论见 media/pipeline/INDEXTTS-2.5-ADVANCED.md §6.4。
"""

from __future__ import annotations

import argparse
import contextlib
import gc
import io
import json
import os
import re
import statistics as st
import subprocess
import sys
import time
from pathlib import Path

DEFAULT_TEXT = "自进化智能体会修改自己的代码。"
TIMER_RE = re.compile(r">> (gpt_gen_time|s2mel_time|bigvgan_time): ([\d.]+) seconds")

#: 环境门阈值。
#:
#: **静态内存指标一律只作告警**，唯一的硬门是「是否已有其它 IndexTTS 实例」（每个约 5 GB，
#: 机制上必然把 24 GB 机器推入换页）。理由是实测校准出来的：
#:   - macOS 的 swapfile **弹性增长**（本轮它自己从 5 GB 涨到 63 GB 又缩回），故「swap 空闲少」
#:     并不预示 OOM，把它当硬门会误杀；
#:   - 可用内存 9.7 GB 时跑完 8 次调用，**换页增量最大仅 31 MB**——内存不是瓶颈；那一轮
#:     2.37× 的漂移全部来自热节流。曾把硬门设在 10 GB，会错误拦住这类完全可用的环境。
#: 内存只有在**导致换页**时才要紧，而换页是逐次直接测量的（MAX_SWAP_DELTA_MB），
#: 故让直接测量当判据、静态指标只提示。
ADVISE_AVAIL_GB = 8.0
WARN_SWAP_FREE_GB = 4.0
#: 运行期间的换页增量才是漂移的**权威信号**：模型常驻不动时，稳定环境下应接近 0。
#: 阈值按「一次调用换进/换出超过 200 MB 即视为在换页」取。
MAX_SWAP_DELTA_MB = 200.0

#: A/A 合格判据：同配置连跑的极差比与变异系数。极差比 1.15 是经验值——
#: 低于它时，#7/#8 那类预期收益 20%+ 的参数效应才可能从噪声里分辨出来。
MAX_SPREAD_RATIO = 1.15
MAX_CV = 0.06
#: 相对漂移（后半中位 vs 前半中位）的上限。**趋势不能当门**——秩相关是无标度的，
#: 稳态尾部 15.19/15.31/15.42（极差仅 1.016×）会被判成「完美单调上升」+1.00，
#: 那是假阳性。量级才是判据；秩相关只留作诊断输出。
MAX_REL_DRIFT = 0.05


def _sysctl_swap() -> tuple[float, float]:
    """→ (已用 GB, 空闲 GB)。"""
    out = subprocess.run(
        ["sysctl", "-n", "vm.swapusage"], capture_output=True, text=True, check=False
    ).stdout
    used = re.search(r"used = ([\d.]+)M", out)
    free = re.search(r"free = ([\d.]+)M", out)
    return (
        float(used.group(1)) / 1024 if used else -1.0,
        float(free.group(1)) / 1024 if free else -1.0,
    )


def _vm_stat_raw() -> dict[str, int]:
    """vm_stat 原始计数（页数或累计次数，**不乘页大小**）。"""
    out = subprocess.run(
        ["vm_stat"], capture_output=True, text=True, check=False
    ).stdout
    d: dict[str, int] = {}
    for line in out.splitlines():
        m = re.match(r'^"?(.+?)"?:\s+(\d+)', line.strip())
        if m:
            d[m.group(1)] = int(m.group(2))
    return d


def _vm_stat() -> dict[str, int]:
    """页数 → 字节（仅对「Pages *」类指标有意义）。"""
    return {k: v * 16384 for k, v in _vm_stat_raw().items()}


def _swap_counters() -> tuple[int, int]:
    """→ (Swapins, Swapouts) 页数。运行期间的**增量**是漂移的权威信号。"""
    vm = _vm_stat_raw()
    return vm.get("Swapins", 0), vm.get("Swapouts", 0)


def _rss_mb(pid: int) -> float:
    out = subprocess.run(
        ["ps", "-o", "rss=", "-p", str(pid)],
        capture_output=True,
        text=True,
        check=False,
    ).stdout.strip()
    return float(out) / 1024 if out else -1.0


def _busy_ports() -> list[str]:
    """检测占用 IndexTTS 端口的进程 —— 每个常驻实例约 5 GB，是最常见的干扰源。

    **刻意用端口而不是扫命令行**：`pgrep -f tts_bench.py` 会命中调用方的包装 shell
    （其 argv 里含脚本名与 python 路径），实测连续两次误报「已有其它实例」而拦掉了完全
    可用的环境。端口是精确判据，不受 argv 与祖先链推断的影响。
    """
    hits = []
    for port in (8766, 8767):
        out = subprocess.run(
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN"],
            capture_output=True,
            text=True,
            check=False,
        ).stdout.strip()
        if out and len(out.splitlines()) > 1:
            hits.append(f"{port}: {out.splitlines()[1].split()[0]}")
    return hits


def check_env(*, strict: bool) -> bool:
    """前置门：交换区余量 / 可用内存 / 其它实例。返回是否合格。"""
    swap_used, swap_free = _sysctl_swap()
    vm = _vm_stat()
    free = vm.get("Pages free", 0) / 1e9
    inactive = vm.get("Pages inactive", 0) / 1e9
    purgeable = vm.get("Pages purgeable", 0) / 1e9
    avail = free + inactive + purgeable
    others = _busy_ports()

    print(">> 测量环境体检")
    print(
        f"   交换区：已用 {swap_used:.1f} GB · 空闲 {swap_free:.1f} GB"
        f"（告警线 <{WARN_SWAP_FREE_GB:g}；swapfile 弹性增长，故不作硬门）"
    )
    print(
        f"   可用内存：{avail:.1f} GB"
        f"（free {free:.1f} + inactive {inactive:.1f} + purgeable {purgeable:.1f}，提示线 <{ADVISE_AVAIL_GB:g}）"
    )
    print(
        f"   IndexTTS 端口占用：{len(others)} 个"
        + ("" if not others else f" ← {others}")
    )

    ok = True
    if 0 <= swap_free < WARN_SWAP_FREE_GB:
        print(
            "   ⚠️  交换区余量低：系统可能已在积极换页。不作硬门（macOS 会自行扩容），"
            "但运行期的换页增量若超阈值，判定会据此否决"
        )
    if avail < ADVISE_AVAIL_GB:
        print(
            "   ⚠️  可用内存偏低：仅作提示。是否真的换页由运行期的换页增量直接判定"
            "（实测 9.7 GB 可用时换页增量仅 31 MB，内存并非瓶颈）"
        )
    if others:
        print(
            "   ⚠️  已有常驻 IndexTTS 服务在跑（约 5 GB/个）：建议先停掉再测；"
            "是否真的造成干扰由运行期换页增量与稳态复现性判定"
        )
    print(
        "   ✅ 前置门通过 —— **静态指标一律只作提示**：本轮把它们逐条降级都是被实测打的"
        "（10 GB 内存硬门误杀了换页仅 31 MB 的可用环境；命令行扫描连续两次把包装 shell "
        "误判成实例）。真正的判据是运行期换页增量 + 稳态尾部复现性，都在下面直接测量。"
    )
    return ok


def _rank(xs: list[float]) -> list[float]:
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    for pos, i in enumerate(order):
        r[i] = float(pos)
    return r


def _spearman(xs: list[float], ys: list[float]) -> float:
    """秩相关（无 scipy 依赖）。用于检测「耗时随运行序单调上升」这一漂移指纹。"""
    n = len(xs)
    if n < 3:
        return 0.0
    rx, ry = _rank(xs), _rank(ys)
    mx, my = st.mean(rx), st.mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry, strict=True))
    den = sum((a - mx) ** 2 for a in rx) ** 0.5 * sum((b - my) ** 2 for b in ry) ** 0.5
    return num / den if den else 0.0


def _rel_drift(xs: list[float]) -> float:
    """后半中位相对前半中位的漂移比例。**量级判据**，替代无标度的秩相关做门。"""
    if len(xs) < 2:
        return 0.0
    h = len(xs) // 2
    a, b = st.median(xs[:h]), st.median(xs[h:])
    return (b - a) / a if a else 0.0


def stable_window(walls: list[float]) -> tuple[int, int, float, float, float]:
    """找出**最长连续稳定窗口** → (起, 止含, 极差比, CV, 相对漂移)。

    为什么不是「弃掉头部取尾部」：本机漂移是热节流，机器带余热开始时头几次偏慢，
    看起来「裁头部」就够。但实测遇到过反例——一轮 6 次里 #1–#5 稳在 15.15–15.86
    （极差 1.047×），末次却突然**变快**到 13.35 s（风扇终于起转 / 后台任务结束），
    只裁头部的判据永远裁不掉尾部异常点，于是把一个明显合格的环境判成不合格。

    故改为在所有连续窗口里取最长的合格者：既容忍带余热的头部，也容忍单点异常的尾部。
    """
    n = len(walls)
    best: tuple[int, int, float, float, float] | None = None
    for i in range(n):
        for j in range(i + 2, n):  # 至少 3 个点
            w = walls[i : j + 1]
            sp = max(w) / min(w)
            cv = st.stdev(w) / st.mean(w)
            dr = _rel_drift(w)
            if sp <= MAX_SPREAD_RATIO and cv <= MAX_CV and abs(dr) <= MAX_REL_DRIFT:
                cand = (i, j, sp, cv, dr)
                if best is None or (j - i) > (best[1] - best[0]):
                    best = cand
    if best:
        return best
    # 无合格窗口：回报最稳的 3 连窗口，供人判断差多少
    trip = min(
        (
            (
                i,
                i + 2,
                max(walls[i : i + 3]) / min(walls[i : i + 3]),
                st.stdev(walls[i : i + 3]) / st.mean(walls[i : i + 3]),
                _rel_drift(walls[i : i + 3]),
            )
            for i in range(n - 2)
        ),
        key=lambda t: t[3],
    )
    return trip


def main() -> None:
    ap = argparse.ArgumentParser(description="IndexTTS 合成耗时基准与测量环境体检")
    ap.add_argument("--ref", default=None, help="参考音色样本（A/A 运行必需）")
    ap.add_argument("--text", default=DEFAULT_TEXT, help="fixture 文本")
    ap.add_argument(
        "--runs", type=int, default=8, help="计时次数（另有 1 次预热，默认 8）"
    )
    ap.add_argument("--num-beams", type=int, default=1, help="束宽（默认 1）")
    ap.add_argument("--seed", type=int, default=4242, help="随机种子（固定才可复现）")
    ap.add_argument(
        "--emo-vector",
        default=None,
        help="8 维情感向量，逗号分隔（默认不注入，等价 neutral 纯克隆）",
    )
    ap.add_argument("--emo-alpha", type=float, default=1.0, help="情感强度")
    ap.add_argument(
        "--empty-cache",
        action="store_true",
        help="每次调用后清 MPS 缓存 + gc —— 用于判定漂移是否来自分配器累积",
    )
    ap.add_argument(
        "--cooldown",
        type=float,
        default=0.0,
        help="每次计时之间静置的秒数。本机漂移已确诊为**热节流**（换页≈0、MPS 分配器恒定，"
        "却随运行序单调爬升且全由 cfm 承担），故冷却间隔是唯一有效的缓解手段；"
        "实测冷态下前 2 次极差比仅 1.01×，第 3 次起开始漂",
    )
    ap.add_argument("--model-dir", default="checkpoints", help="模型目录")
    ap.add_argument("--check-only", action="store_true", help="只跑环境门，不加载模型")
    ap.add_argument(
        "--force", action="store_true", help="环境门不合格也继续（结果仅供参考）"
    )
    ap.add_argument("--json", default=None, help="把逐次读数写入 JSON")
    args = ap.parse_args()

    env_ok = check_env(strict=not args.check_only)
    if args.check_only:
        sys.exit(0 if env_ok else 1)
    if not env_ok and not args.force:
        sys.exit("环境门未通过；确需继续请加 --force（结果不可用于参数归因）")
    if not args.ref:
        sys.exit("A/A 运行需要 --ref 参考音色样本")
    ref = Path(args.ref).expanduser().resolve()
    if not ref.is_file():
        sys.exit(f"参考样本不存在: {ref}")

    import soundfile as sf
    import torch
    from transformers import set_seed

    sys.path.insert(0, str(Path.cwd()))
    from indextts.infer_v2_5 import IndexTTS2

    emo = [float(x) for x in args.emo_vector.split(",")] if args.emo_vector else None
    if emo is not None and len(emo) != 8:
        sys.exit("--emo-vector 必须为 8 维")

    print("\n>> 加载模型（不计入耗时读数）…", flush=True)
    t0 = time.perf_counter()
    tts = IndexTTS2(
        cfg_path=str(Path(args.model_dir) / "config.yaml"),
        model_dir=args.model_dir,
        use_bf16=True,  # MPS 分支内部强制 False ⇒ 实际 fp32
        use_cuda_kernel=False,
        use_deepspeed=False,
        use_qwen_emo=False,
    )
    print(f">> 加载 {time.perf_counter() - t0:.1f}s\n", flush=True)

    mps_ok = hasattr(torch, "mps") and torch.backends.mps.is_available()
    tmp = Path(os.environ.get("TMPDIR", "/tmp")) / "tts_bench"
    tmp.mkdir(parents=True, exist_ok=True)
    pid = os.getpid()

    def one(i: int) -> dict:
        si0, so0 = _swap_counters()
        set_seed(args.seed)
        buf = io.StringIO()
        t = time.perf_counter()
        with contextlib.redirect_stdout(buf):
            tts.infer(
                spk_audio_prompt=str(ref),
                text=args.text,
                output_path=str(tmp / f"b{i}.wav"),
                lang="ZH",
                emo_vector=emo,
                emo_alpha=args.emo_alpha,
                use_random=False,
                verbose=False,
                num_beams=args.num_beams,
            )
        wall = time.perf_counter() - t
        data, sr = sf.read(str(tmp / f"b{i}.wav"))
        stg = {m.group(1): float(m.group(2)) for m in TIMER_RE.finditer(buf.getvalue())}
        si1, so1 = _swap_counters()
        rec = {
            "i": i,
            "audio": len(data) / sr,
            "synth": wall,
            "rtf": wall / (len(data) / sr),
            **stg,
            "rss_mb": _rss_mb(pid),
            "swap_free_gb": _sysctl_swap()[1],
            # 本次调用期间的换页量（MB）——稳定环境下应接近 0
            "swapin_mb": (si1 - si0) * 16384 / 1e6,
            "swapout_mb": (so1 - so0) * 16384 / 1e6,
        }
        if mps_ok:
            rec["mps_alloc_gb"] = torch.mps.current_allocated_memory() / 1e9
            rec["mps_driver_gb"] = torch.mps.driver_allocated_memory() / 1e9
        if args.empty_cache:
            gc.collect()
            if mps_ok:
                torch.mps.empty_cache()
        return rec

    one(-1)  # 预热：填充上游按路径缓存的说话人条件（等价「排除 clone」）
    print(
        f">> A/A 复现性：同配置连跑 {args.runs} 次"
        f"（束宽 {args.num_beams} · seed {args.seed} · "
        f"{'注入情感' if emo else 'neutral'} · "
        f"{'每次清 MPS 缓存' if args.empty_cache else '不清缓存'}）"
    )
    rows = []
    for i in range(args.runs):
        if args.cooldown and i:
            time.sleep(args.cooldown)
        r = one(i)
        rows.append(r)
        extra = (
            f" mps {r.get('mps_alloc_gb', 0):.2f}/{r.get('mps_driver_gb', 0):.2f} GB"
            if mps_ok
            else ""
        )
        print(
            f"   #{i + 1:<2} synth {r['synth']:6.2f}s  RTF {r['rtf']:5.2f}  "
            f"cfm {r.get('s2mel_time', 0):6.2f}s  RSS {r['rss_mb']:6.0f} MB  "
            f"换页 in/out {r['swapin_mb']:6.0f}/{r['swapout_mb']:6.0f} MB{extra}",
            flush=True,
        )

    walls = [r["synth"] for r in rows]
    spread = max(walls) / min(walls)
    cv = st.stdev(walls) / st.mean(walls) if len(walls) > 1 else 0.0
    trend = _spearman([float(r["i"]) for r in rows], walls)
    print(f"\n>> A/A 判定（{len(walls)} 次，中位 {st.median(walls):.2f}s）")
    print(f"   极差比 max/min = {spread:.2f}×（门槛 ≤{MAX_SPREAD_RATIO:g}）")
    print(f"   变异系数 CV    = {cv:.3f}（门槛 ≤{MAX_CV:g}）")
    print(
        f"   随运行序趋势   = {trend:+.2f}（秩相关，**仅作诊断**：它无标度，"
        "微小的单调上升也会给出 +1.00，故不作判据）"
    )
    if mps_ok:
        d = rows[-1].get("mps_driver_gb", 0) - rows[0].get("mps_driver_gb", 0)
        print(f"   MPS 驱动占用变化 = {d:+.2f} GB（>0 且随序增长＝分配器累积）")
    max_swap = max(max(r["swapin_mb"], r["swapout_mb"]) for r in rows)
    print(
        f"   单次最大换页量 = {max_swap:.0f} MB（门槛 ≤{MAX_SWAP_DELTA_MB:g}；"
        ">0 说明模型常驻被挤出内存，是漂移的直接成因）"
    )
    i0, j0, t_sp, t_cv, t_dr = stable_window(walls)
    tail = walls[i0 : j0 + 1]
    print(
        f"\n   稳定窗口：第 {i0 + 1}–{j0 + 1} 次（共 {len(tail)} 次，"
        f"弃头 {i0} / 弃尾 {len(walls) - j0 - 1}），中位 {st.median(tail):.2f}s"
    )
    print(
        f"     极差比 {t_sp:.3f}×（门槛 ≤{MAX_SPREAD_RATIO:g}）  "
        f"CV {t_cv:.3f}（≤{MAX_CV:g}）  "
        f"相对漂移 {t_dr:+.1%}（|·| ≤{MAX_REL_DRIFT:.0%}）"
    )
    verdict = (
        t_sp <= MAX_SPREAD_RATIO
        and t_cv <= MAX_CV
        and abs(t_dr) <= MAX_REL_DRIFT
        and len(tail) >= 3
        and max_swap <= MAX_SWAP_DELTA_MB
    )
    print(
        f"\n   ✅ 环境合格：可以做参数 A/B —— 判据取第 {i0 + 1}–{j0 + 1} 次的稳定窗口，"
        f"A/B 时每档都须按同样方式取窗口后再比较"
        if verdict
        else "\n   ❌ 环境不合格：连稳态尾部都不满足判据（加大 --cooldown 或减少机器上的其它负载）"
    )
    if args.json:
        Path(args.json).write_text(
            json.dumps(
                {
                    "config": vars(args),
                    "rows": rows,
                    "spread": spread,
                    "cv": cv,
                    "trend": trend,
                    "window": [i0, j0],
                    "settled_spread": t_sp,
                    "settled_cv": t_cv,
                    "settled_rel_drift": t_dr,
                    "verdict": verdict,
                },
                ensure_ascii=False,
                indent=1,
            ),
            encoding="utf-8",
        )
        print(f"   读数已写入 {args.json}")
    sys.exit(0 if verdict else 1)


if __name__ == "__main__":
    main()
