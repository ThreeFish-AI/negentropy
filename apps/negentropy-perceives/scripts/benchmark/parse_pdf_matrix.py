#!/usr/bin/env python3
"""parse_pdf_to_markdown 矩阵基准编排器（Adaptive Engine Selection 实测专用）。

用法
====

    uv run python scripts/benchmark/parse_pdf_matrix.py <pdf_path> \\
        [--methods auto,docling,mineru,marker,pymupdf,opendataloader] \\
        [--selectors profile_aware,identity] \\
        [--devices mps,cpu] \\
        [--archive-dir benchmarks/runs] \\
        [--warmup-rounds 1] \\
        [--measured-rounds 1] \\
        [--page-range start,end] \\
        [--timeout 600] \\
        [--no-process-isolation]

设计目的
========

PR #163 已经把 parse_pdf_to_markdown 推进到「Apple Silicon 深度调优 +
Adaptive Engine Selection + 多页并行 + 基准矩阵」的形态，但缺少 stage 级
端到端实测数据用于回填 ``ProfileAwareSelector`` 的偏好顺序。本脚本通过
**矩阵基准 + 子进程隔离**采集 (method × selector × device) 组合在真实 PDF
上的 stage 级耗时与最终 markdown 质量,产物落到 ``benchmarks/runs/<ts>/``:

- ``matrix.json``: 所有 cell 的聚合结构化数据
- ``summary.md``: 人工审阅的判读视图（含 mermaid 柱状对比 + 决策建议）
- ``raw/<cell_id>.json``: 单 cell 的完整 JSON（与 ``parse_pdf_bench`` 同 schema）
- ``markdown/<cell_id>.md``: 单 cell 产出的最终 markdown（供人工质量对比）

子进程隔离
==========

默认每个 cell 在独立子进程中跑（``--cell-mode`` 路径），避免:
    1. 引擎 converter 类级缓存复用（导致后跑 cell 看似更快）
    2. MPS allocator 显存碎片化
    3. ``importlib`` import 副作用串扰
父进程仅负责调度与汇总;若需要快速本地试探,加 ``--no-process-isolation``
切换到同进程顺序执行（数据可信度下降,summary.md 会标注）。

实操推荐
========

    # 1. 模型预热（一次性, 避免冷启动数据污染）
    uv run perceives prefetch-models --engines docling,mineru,marker

    # 2. 跑标准矩阵（约 7-10 分钟 / 8 cells）
    uv run python scripts/benchmark/parse_pdf_matrix.py \\
        "assets/Context Engineering 2.0 - The Context of Context Engineering.pdf" \\
        --methods auto,docling,mineru,marker,pymupdf,opendataloader \\
        --selectors profile_aware,identity \\
        --devices mps,cpu

    # 3. 查看决策建议
    cat benchmarks/runs/$(ls -t benchmarks/runs | head -1)/summary.md

References:
    [1] negentropy-perceives PR #163 commit f9a6296.
    [2] /docs/agents/apple-silicon-tuning.md — 已沉淀的 Apple Silicon 调优要点。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import platform
import statistics
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------


@dataclass
class CellSpec:
    """单个矩阵单元（一个 method × selector × device 组合）。"""

    method: str
    selector: str
    device: str
    page_range: Optional[Tuple[int, int]] = None

    @property
    def cell_id(self) -> str:
        pr = f"_p{self.page_range[0]}-{self.page_range[1]}" if self.page_range else ""
        return f"{self.method}_{self.selector}_{self.device}{pr}"


@dataclass
class CellResult:
    """单 cell 的实测结果（聚合到 matrix.json 中的元素）。"""

    cell_id: str
    spec: CellSpec
    success: bool
    total_elapsed_s: float
    word_count: int
    page_count: int
    engines_used: List[str] = field(default_factory=list)
    stage_breakdown: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    images_extracted: int = 0
    tables_extracted: int = 0
    formulas_extracted: int = 0
    code_blocks_detected: int = 0
    error: Optional[str] = None
    raw_path: Optional[str] = None
    markdown_path: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "cell_id": self.cell_id,
            "spec": {
                "method": self.spec.method,
                "selector": self.spec.selector,
                "device": self.spec.device,
                "page_range": list(self.spec.page_range)
                if self.spec.page_range
                else None,
            },
            "success": self.success,
            "total_elapsed_s": self.total_elapsed_s,
            "word_count": self.word_count,
            "page_count": self.page_count,
            "engines_used": self.engines_used,
            "stage_breakdown": self.stage_breakdown,
            "images_extracted": self.images_extracted,
            "tables_extracted": self.tables_extracted,
            "formulas_extracted": self.formulas_extracted,
            "code_blocks_detected": self.code_blocks_detected,
            "error": self.error,
            "raw_path": self.raw_path,
            "markdown_path": self.markdown_path,
        }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="parse_pdf_to_markdown 矩阵基准编排器",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("pdf_path", type=str, help="PDF 文件路径")
    p.add_argument(
        "--methods",
        type=str,
        default="auto",
        help="逗号分隔的 method 列表（auto/docling/mineru/marker/pymupdf/opendataloader/pypdf）",
    )
    p.add_argument(
        "--selectors",
        type=str,
        default="profile_aware",
        help="逗号分隔的 selector 列表（profile_aware/identity）",
    )
    p.add_argument(
        "--devices",
        type=str,
        default="mps",
        help="逗号分隔的 device 列表（mps/cpu/cuda/xpu）",
    )
    p.add_argument(
        "--archive-dir",
        type=str,
        default="benchmarks/runs",
        help="产物归档父目录",
    )
    p.add_argument(
        "--warmup-rounds",
        type=int,
        default=1,
        help="预跑次数（数据丢弃，触发模型权重加载与 worker spawn）",
    )
    p.add_argument(
        "--measured-rounds",
        type=int,
        default=1,
        help="正式计时次数（每 cell 跑 N 轮取均值；目前仅取最近一次）",
    )
    p.add_argument(
        "--page-range",
        type=str,
        default=None,
        help="页码范围 start,end（0-based, exclusive end）",
    )
    p.add_argument(
        "--timeout",
        type=float,
        default=600.0,
        help="单 cell 超时（秒）",
    )
    p.add_argument(
        "--no-process-isolation",
        action="store_true",
        help="禁用子进程隔离（同进程顺序跑）— 仅用于快速本地试探, summary 会标注",
    )
    p.add_argument(
        "--cell-mode",
        action="store_true",
        help="（内部）作为单 cell 子进程运行，由父进程调用",
    )
    return p


# ---------------------------------------------------------------------------
# 子进程 cell 执行（--cell-mode）
# ---------------------------------------------------------------------------


def _hardware_info_dict() -> Dict[str, Any]:
    from negentropy.perceives.pdf.hardware.detection import get_hardware_info

    return get_hardware_info().to_dict()


async def _run_single_cell(
    pdf_path: str,
    method: str,
    page_range: Optional[Tuple[int, int]],
) -> Dict[str, Any]:
    """在当前进程内跑一次 parse_pdf_to_markdown，返回 summary dict。"""
    from negentropy.perceives.ops.pdf import parse_pdf_to_markdown

    start_ts = time.monotonic()
    result = await parse_pdf_to_markdown(
        pdf_source=pdf_path,
        method=method,
        page_range=list(page_range) if page_range else None,
    )
    elapsed_s = time.monotonic() - start_ts

    enhanced_assets = getattr(result, "enhanced_assets", None) or {}
    summary: Dict[str, Any] = {
        "pdf_path": pdf_path,
        "method": method,
        "selector": os.environ.get(
            "NEGENTROPY_PERCEIVES_PIPELINE_ENGINE_SELECTOR", "default"
        ),
        "device_override": os.environ.get("NEGENTROPY_PERCEIVES_MINERU_DEVICE"),
        "page_range": list(page_range) if page_range else None,
        "platform": f"{platform.system()} {platform.machine()}",
        "hardware": _hardware_info_dict(),
        "total_elapsed_s": round(elapsed_s, 2),
        "word_count": getattr(result, "word_count", 0),
        "page_count": getattr(result, "page_count", 0),
        "conversion_time": getattr(result, "conversion_time", None),
        "enhanced_assets": enhanced_assets or None,
        "engines_used": enhanced_assets.get("engines_used")
        if isinstance(enhanced_assets, dict)
        else None,
        "stage_breakdown": enhanced_assets.get("stage_breakdown")
        if isinstance(enhanced_assets, dict)
        else None,
        "method_used": getattr(result, "method", method),
        "error": getattr(result, "error", None),
        "success": bool(getattr(result, "success", False)),
        "markdown": getattr(result, "content", ""),
    }
    return summary


def _cell_main(args: argparse.Namespace) -> int:
    """--cell-mode 入口：单进程跑一个 cell，把 summary JSON 写到 stdout。"""
    # 通过环境变量传递 selector / device 已在父进程中完成
    page_range = None
    if args.page_range:
        s, e = args.page_range.split(",", 1)
        page_range = (int(s), int(e))

    summary = asyncio.run(_run_single_cell(args.pdf_path, args.methods, page_range))
    # 单 cell 模式下 ``--methods`` 是单值；这里覆盖回原始 method 字段
    summary["method"] = args.methods
    sys.stdout.write(json.dumps(summary, ensure_ascii=False))
    sys.stdout.flush()
    return 0 if summary.get("success") else 1


# ---------------------------------------------------------------------------
# 父进程调度
# ---------------------------------------------------------------------------


async def _run_cell_in_subprocess(
    pdf_path: str,
    spec: CellSpec,
    timeout_s: float,
    quiet: bool = True,
) -> Dict[str, Any]:
    """spawn 子进程跑一个 cell, 返回解析后的 summary dict。"""
    # 用绝对脚本路径调用, 避免依赖 scripts/ 作为 Python 包结构
    script_path = str(Path(__file__).resolve())
    cmd = [
        sys.executable,
        script_path,
        "--cell-mode",
        "--methods",
        spec.method,
    ]
    if spec.page_range:
        cmd.extend(["--page-range", f"{spec.page_range[0]},{spec.page_range[1]}"])
    cmd.append(pdf_path)

    env = os.environ.copy()
    env["NEGENTROPY_PERCEIVES_PIPELINE_ENGINE_SELECTOR"] = spec.selector
    env["NEGENTROPY_PERCEIVES_MINERU_DEVICE"] = spec.device
    env["NEGENTROPY_PERCEIVES_ACCELERATOR_DEVICE"] = spec.device

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
        cwd=os.getcwd(),
    )
    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(), timeout=timeout_s
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return {
            "success": False,
            "error": f"timeout after {timeout_s}s",
            "total_elapsed_s": timeout_s,
        }

    if not quiet and stderr_bytes:
        sys.stderr.write(stderr_bytes.decode("utf-8", errors="replace"))

    if not stdout_bytes.strip():
        return {
            "success": False,
            "error": (
                f"empty stdout; rc={proc.returncode}; stderr_tail="
                + stderr_bytes.decode("utf-8", errors="replace")[-500:]
            ),
            "total_elapsed_s": 0.0,
        }
    # PyMuPDF 等三方库偶尔会向 stdout 写一行警告(如 "Consider using the
    # pymupdf_layout package..."), 污染 JSON 解析。改为按行扫描, 取首个能解析
    # 为 JSON 的非空行作为 cell summary。
    text = stdout_bytes.decode("utf-8", errors="replace")
    candidates = [line for line in text.splitlines() if line.strip().startswith("{")]
    for line in candidates:
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue
    # 兜底: 整体尝试解析(向后兼容历史行为)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"invalid JSON from subprocess: {e}",
            "total_elapsed_s": 0.0,
            "raw_stdout": text[:2000],
        }


async def _run_cell_in_process(
    pdf_path: str,
    spec: CellSpec,
) -> Dict[str, Any]:
    """同进程跑一个 cell（--no-process-isolation 路径）。"""
    os.environ["NEGENTROPY_PERCEIVES_PIPELINE_ENGINE_SELECTOR"] = spec.selector
    os.environ["NEGENTROPY_PERCEIVES_MINERU_DEVICE"] = spec.device
    os.environ["NEGENTROPY_PERCEIVES_ACCELERATOR_DEVICE"] = spec.device
    return await _run_single_cell(pdf_path, spec.method, spec.page_range)


# ---------------------------------------------------------------------------
# 矩阵聚合与 summary 渲染
# ---------------------------------------------------------------------------


def _parse_summary_to_cell(spec: CellSpec, summary: Dict[str, Any]) -> CellResult:
    enhanced = summary.get("enhanced_assets") or {}
    return CellResult(
        cell_id=spec.cell_id,
        spec=spec,
        success=bool(summary.get("success", False)),
        total_elapsed_s=float(summary.get("total_elapsed_s") or 0.0),
        word_count=int(summary.get("word_count") or 0),
        page_count=int(summary.get("page_count") or 0),
        engines_used=list(summary.get("engines_used") or []),
        stage_breakdown=dict(summary.get("stage_breakdown") or {}),
        images_extracted=int(enhanced.get("images_extracted") or 0)
        if isinstance(enhanced, dict)
        else 0,
        tables_extracted=int(enhanced.get("tables_extracted") or 0)
        if isinstance(enhanced, dict)
        else 0,
        formulas_extracted=int(enhanced.get("formulas_extracted") or 0)
        if isinstance(enhanced, dict)
        else 0,
        code_blocks_detected=int(enhanced.get("code_blocks_detected") or 0)
        if isinstance(enhanced, dict)
        else 0,
        error=summary.get("error"),
    )


def _build_best_per_stage_table(cells: List[CellResult]) -> List[Dict[str, Any]]:
    """对每个 stage 找出最快的 (engine, elapsed_ms) + runner-up。"""
    stage_to_records: Dict[str, List[Tuple[str, float, str]]] = {}
    for c in cells:
        if not c.success:
            continue
        for stage, info in c.stage_breakdown.items():
            if info.get("selector_skipped"):
                continue
            engine = str(info.get("engine") or "-")
            ms = float(info.get("elapsed_ms") or 0.0)
            if ms <= 0:
                continue
            stage_to_records.setdefault(stage, []).append((engine, ms, c.cell_id))

    out: List[Dict[str, Any]] = []
    for stage, records in stage_to_records.items():
        records.sort(key=lambda r: r[1])
        best = records[0]
        runner = records[1] if len(records) > 1 else None
        out.append(
            {
                "stage": stage,
                "best_engine": best[0],
                "best_ms": round(best[1], 2),
                "best_cell": best[2],
                "runner_engine": runner[0] if runner else None,
                "runner_ms": round(runner[1], 2) if runner else None,
                "runner_cell": runner[2] if runner else None,
            }
        )
    out.sort(key=lambda r: r["stage"])
    return out


def _render_mermaid_bar_chart(cells: List[CellResult]) -> str:
    """生成 mermaid xychart 总耗时柱状图。"""
    successful = [c for c in cells if c.success]
    if not successful:
        return "（无成功 cell, 无法绘图）"
    successful.sort(key=lambda c: c.total_elapsed_s)
    labels = [c.cell_id for c in successful]
    values = [c.total_elapsed_s for c in successful]
    max_v = max(values) * 1.1
    return (
        "```mermaid\n"
        "xychart-beta\n"
        '    title "Total elapsed (s) per cell, lower is better"\n'
        f"    x-axis [{', '.join(repr(_truncate(lab, 40)) for lab in labels)}]\n"
        f'    y-axis "elapsed_s" 0 --> {max_v:.1f}\n'
        f"    bar [{', '.join(f'{v:.2f}' for v in values)}]\n"
        "```\n"
    )


def _truncate(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def _selector_vs_identity_savings(cells: List[CellResult]) -> Optional[str]:
    by_key: Dict[str, Dict[str, float]] = {}
    for c in cells:
        if not c.success or c.spec.method != "auto":
            continue
        key = f"{c.spec.method}|{c.spec.device}"
        by_key.setdefault(key, {})[c.spec.selector] = c.total_elapsed_s
    lines: List[str] = []
    for key, m in by_key.items():
        if "profile_aware" in m and "identity" in m:
            pa = m["profile_aware"]
            idt = m["identity"]
            delta = idt - pa
            pct = (delta / idt * 100.0) if idt > 0 else 0.0
            lines.append(
                f"- ``{key}``: profile_aware {pa:.2f}s vs identity {idt:.2f}s "
                f"→ 节省 {delta:+.2f}s ({pct:+.1f}%)"
            )
    if not lines:
        return None
    return "\n".join(lines)


def _word_count_stddev(cells: List[CellResult]) -> Optional[Tuple[float, float]]:
    counts = [c.word_count for c in cells if c.success and c.word_count > 0]
    if len(counts) < 2:
        return None
    mean = statistics.mean(counts)
    stdev = statistics.pstdev(counts)
    return (mean, stdev)


def _render_summary_markdown(
    pdf_path: str,
    cells: List[CellResult],
    process_isolation: bool,
    hardware: Dict[str, Any],
) -> str:
    successful = [c for c in cells if c.success]
    failed = [c for c in cells if not c.success]
    if successful:
        successful.sort(key=lambda c: c.total_elapsed_s)
        best = successful[0]
    else:
        best = None

    lines: List[str] = []
    lines.append(f"# parse_pdf_to_markdown 矩阵基准: {Path(pdf_path).name}")
    lines.append("")
    lines.append(f"- 时间: {time.strftime('%Y-%m-%dT%H:%M:%S')}")
    lines.append(f"- 平台: {platform.system()} {platform.machine()}")
    lines.append(
        f"- 芯片: {hardware.get('device_name', '?')} "
        f"(代次={hardware.get('chip_generation', '?')}), "
        f"内存={hardware.get('memory_gb', '?')}GB, "
        f"设备={hardware.get('device_type', '?')}"
    )
    lines.append(
        f"- 子进程隔离: {'是' if process_isolation else '否（数据可信度下降）'}"
    )
    lines.append(
        f"- 总 cell 数: {len(cells)} (成功 {len(successful)} / 失败 {len(failed)})"
    )
    lines.append("")

    # --- Top-line ---
    lines.append("## Top-line")
    if best:
        lines.append(
            f"- 最佳总耗时: ``{best.cell_id}`` → **{best.total_elapsed_s:.2f}s** "
            f"(word_count={best.word_count})"
        )
    if successful:
        slowest = successful[-1]
        lines.append(
            f"- 最慢总耗时: ``{slowest.cell_id}`` → {slowest.total_elapsed_s:.2f}s"
        )
    savings = _selector_vs_identity_savings(cells)
    if savings:
        lines.append("")
        lines.append("### profile_aware vs identity 对比")
        lines.append(savings)
    lines.append("")

    # --- Mermaid ---
    lines.append("## 总耗时柱状图（lower is better）")
    lines.append(_render_mermaid_bar_chart(cells))
    lines.append("")

    # --- Stage 级最优引擎 ---
    lines.append("## Stage 级最优引擎(实测)")
    lines.append("")
    lines.append(
        "| stage | best engine | elapsed_ms | best cell | runner-up | runner_ms |"
    )
    lines.append("|---|---|---:|---|---|---:|")
    for row in _build_best_per_stage_table(cells):
        lines.append(
            "| {stage} | {be} | {bm:.2f} | {bc} | {re} | {rm} |".format(
                stage=row["stage"],
                be=row["best_engine"],
                bm=row["best_ms"],
                bc=row["best_cell"],
                re=row["runner_engine"] or "-",
                rm=f"{row['runner_ms']:.2f}" if row["runner_ms"] else "-",
            )
        )
    lines.append("")

    # --- Sanity checks ---
    lines.append("## Sanity Checks")
    lines.append("")
    wc = _word_count_stddev(cells)
    if wc:
        mean, stdev = wc
        ratio = stdev / mean if mean > 0 else 0.0
        verdict = "✅" if ratio < 0.10 else ("⚠️" if ratio < 0.30 else "❌")
        lines.append(
            f"- word_count 跨 cell 一致性: mean={mean:.0f}, stdev={stdev:.0f} "
            f"(ratio={ratio:.2%}) {verdict}"
        )
    if savings:
        improved = any(
            "节省 +" in line or "节省 -" not in line
            for line in savings.splitlines()
            if "节省" in line
        )
        if not improved:
            lines.append("- ⚠️ profile_aware 未带来 ≥ 5% 净收益,需审视 selector 规则")
    lines.append("")

    # --- 失败 cell ---
    if failed:
        lines.append("## 失败 cell")
        lines.append("")
        for c in failed:
            lines.append(f"- ``{c.cell_id}``: {c.error or '(no error)'}")
        lines.append("")

    # --- 决策建议（启发式） ---
    lines.append("## 决策建议（启发式，需人工审阅）")
    lines.append("")
    recs = _generate_recommendations(cells)
    if recs:
        for r in recs:
            lines.append(f"- {r}")
    else:
        lines.append("- （无明显决策建议；矩阵数据已稳定）")
    lines.append("")

    return "\n".join(lines)


def _generate_recommendations(cells: List[CellResult]) -> List[str]:
    """基于实测数据生成 selector 调整建议（启发式）。"""
    recs: List[str] = []

    # 1. layout_analysis 单独耗时占比
    for c in cells:
        if not c.success:
            continue
        layout = c.stage_breakdown.get("layout_analysis", {})
        ms = float(layout.get("elapsed_ms") or 0.0)
        total_ms = c.total_elapsed_s * 1000.0
        if total_ms > 0 and ms / total_ms > 0.7:
            recs.append(
                f"``{c.cell_id}`` 中 layout_analysis 占总耗时 {ms / total_ms:.1%}, "
                f"考虑 D1: 验证 docling 跨 stage _ConvertCache 是否命中, "
                f"或 D3: 按需引擎预热"
            )
            break

    # 2. text_extraction 多引擎对比
    text_records: List[Tuple[str, float, str]] = []
    for c in cells:
        if not c.success:
            continue
        te = c.stage_breakdown.get("text_extraction", {})
        engine = str(te.get("engine") or "")
        ms = float(te.get("elapsed_ms") or 0.0)
        if engine and ms > 0:
            text_records.append((engine, ms, c.cell_id))
    if text_records:
        engine_to_min: Dict[str, Tuple[float, str]] = {}
        for engine, ms, cell_id in text_records:
            cur = engine_to_min.get(engine)
            if cur is None or ms < cur[0]:
                engine_to_min[engine] = (ms, cell_id)
        if len(engine_to_min) >= 2:
            sorted_engines = sorted(engine_to_min.items(), key=lambda kv: kv[1][0])
            best_engine, (best_ms, best_cell) = sorted_engines[0]
            recs.append(
                f"text_extraction 实测最快引擎: ``{best_engine}`` ({best_ms:.0f}ms @ "
                f"{best_cell}); 建议结合 chars 判定决定是否在 "
                f"``_select_text_extraction`` 中显式重排"
            )

    # 3. selector skip 节省的 stage
    skipped_stages = set()
    for c in cells:
        if c.spec.selector != "profile_aware":
            continue
        for stage, info in c.stage_breakdown.items():
            if info.get("selector_skipped"):
                skipped_stages.add(stage)
    if skipped_stages:
        recs.append(
            f"profile_aware selector 短路跳过的 stage: "
            f"``{', '.join(sorted(skipped_stages))}``;"
            f" 验证 ``ProfileAwareSelector.SKIPPABLE_STAGES_BY_FEATURE`` 规则准确性"
        )

    return recs


# ---------------------------------------------------------------------------
# 主调度
# ---------------------------------------------------------------------------


def _expand_matrix(
    methods: List[str],
    selectors: List[str],
    devices: List[str],
    page_range: Optional[Tuple[int, int]],
) -> List[CellSpec]:
    cells: List[CellSpec] = []
    seen: set = set()
    for m in methods:
        for s in selectors:
            # selector 仅对 method=auto 有意义；非 auto 时只保留 identity
            effective_s = s if m == "auto" else "identity"
            for d in devices:
                spec = CellSpec(
                    method=m, selector=effective_s, device=d, page_range=page_range
                )
                if spec.cell_id in seen:
                    continue
                seen.add(spec.cell_id)
                cells.append(spec)
    return cells


async def _run_matrix(args: argparse.Namespace) -> int:
    pdf_path = str(Path(args.pdf_path).resolve())
    if not Path(pdf_path).exists():
        print(f"ERROR: PDF 路径不存在: {pdf_path}", file=sys.stderr)
        return 2

    methods = [m.strip() for m in args.methods.split(",") if m.strip()]
    selectors = [s.strip() for s in args.selectors.split(",") if s.strip()]
    devices = [d.strip() for d in args.devices.split(",") if d.strip()]
    page_range: Optional[Tuple[int, int]] = None
    if args.page_range:
        s, e = args.page_range.split(",", 1)
        page_range = (int(s), int(e))

    specs = _expand_matrix(methods, selectors, devices, page_range)
    if not specs:
        print("ERROR: 矩阵为空（methods/selectors/devices 至少有一项为空）")
        return 2

    # ``--no-process-isolation`` + 多轴会让矩阵静默退化:
    # pydantic-settings 在首个 ``from negentropy.perceives.config import settings``
    # 时已把所有字段 freeze 为常量, 后续 mutate ``os.environ`` 对
    # ``settings.pipeline_engine_selector`` / ``settings.mineru_device`` /
    # ``settings.accelerator_device`` 完全没有作用 —— 不同 cell 实际跑的是
    # 第一个 cell 的取值的 N 次重复。此处硬阻断, 避免基准数据看似变化实则不变。
    if args.no_process_isolation and (len(selectors) > 1 or len(devices) > 1):
        print(
            "ERROR: ``--no-process-isolation`` 与多 ``--selectors``/``--devices`` 不兼容。\n"
            "       pydantic-settings 在首次导入即缓存所有字段, 后续 os.environ "
            "修改无效, 矩阵轴会被静默退化为第一个 cell 的取值。\n"
            "       请去掉 ``--no-process-isolation``(走子进程隔离, 默认), "
            "或将 ``--selectors``/``--devices`` 收敛到单值。",
            file=sys.stderr,
        )
        return 2

    # 归档目录
    timestamp = time.strftime("%Y%m%dT%H%M%S")
    run_dir = Path(args.archive_dir) / timestamp
    raw_dir = run_dir / "raw"
    md_dir = run_dir / "markdown"
    raw_dir.mkdir(parents=True, exist_ok=True)
    md_dir.mkdir(parents=True, exist_ok=True)

    print(
        f"矩阵基准: pdf={Path(pdf_path).name}, cells={len(specs)}, "
        f"warmup={args.warmup_rounds}, measured={args.measured_rounds}, "
        f"isolation={'no' if args.no_process_isolation else 'yes'}"
    )
    print(f"产物归档目录: {run_dir}")

    # --- Warmup ---
    if args.warmup_rounds > 0 and specs:
        warm_spec = specs[0]
        print(f"\n[warmup] 跑 {args.warmup_rounds} 轮（数据丢弃）...")
        for i in range(args.warmup_rounds):
            print(f"  warmup #{i + 1}/{args.warmup_rounds}: {warm_spec.cell_id}")
            if args.no_process_isolation:
                await _run_cell_in_process(pdf_path, warm_spec)
            else:
                await _run_cell_in_subprocess(pdf_path, warm_spec, args.timeout)

    # --- Measured ---
    print("\n[measured] 正式计时...")
    cells: List[CellResult] = []
    for idx, spec in enumerate(specs):
        print(f"  cell {idx + 1}/{len(specs)}: {spec.cell_id}")
        start = time.monotonic()
        if args.no_process_isolation:
            summary = await _run_cell_in_process(pdf_path, spec)
        else:
            summary = await _run_cell_in_subprocess(pdf_path, spec, args.timeout)
        elapsed = time.monotonic() - start
        # 写 raw + markdown
        raw_path = raw_dir / f"{spec.cell_id}.json"
        md_path = md_dir / f"{spec.cell_id}.md"
        try:
            raw_path.write_text(
                json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception as e:
            print(f"    写 raw 失败: {e}")
        md_text = summary.get("markdown") or ""
        if md_text:
            try:
                md_path.write_text(md_text, encoding="utf-8")
            except Exception as e:
                print(f"    写 markdown 失败: {e}")

        cell = _parse_summary_to_cell(spec, summary)
        cell.raw_path = str(raw_path)
        cell.markdown_path = str(md_path) if md_text else None
        cells.append(cell)
        status = "✓" if cell.success else "✗"
        print(
            f"    {status} elapsed={cell.total_elapsed_s:.2f}s "
            f"word_count={cell.word_count} (wall {elapsed:.2f}s)"
        )

    # --- 聚合 ---
    matrix_json = {
        "pdf_path": pdf_path,
        "pdf_name": Path(pdf_path).name,
        "timestamp": timestamp,
        "platform": f"{platform.system()} {platform.machine()}",
        "hardware": _hardware_info_dict(),
        "process_isolation": not args.no_process_isolation,
        "warmup_rounds": args.warmup_rounds,
        "measured_rounds": args.measured_rounds,
        "cells": [c.to_dict() for c in cells],
    }
    (run_dir / "matrix.json").write_text(
        json.dumps(matrix_json, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    summary_md = _render_summary_markdown(
        pdf_path,
        cells,
        process_isolation=not args.no_process_isolation,
        hardware=matrix_json["hardware"],
    )
    (run_dir / "summary.md").write_text(summary_md, encoding="utf-8")

    print(f"\n✓ matrix.json: {run_dir / 'matrix.json'}")
    print(f"✓ summary.md:  {run_dir / 'summary.md'}")
    print(f"✓ raw/:        {raw_dir} ({len(cells)} files)")
    print(f"✓ markdown/:   {md_dir}")

    failed = sum(1 for c in cells if not c.success)
    return 0 if failed == 0 else 1


def main() -> int:
    args = _build_argparser().parse_args()
    if args.cell_mode:
        return _cell_main(args)
    return asyncio.run(_run_matrix(args))


if __name__ == "__main__":
    raise SystemExit(main())
