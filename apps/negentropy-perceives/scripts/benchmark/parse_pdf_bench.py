#!/usr/bin/env python3
"""parse_pdf_to_markdown 端到端基准测试。

用法
====

    uv run python scripts/benchmark/parse_pdf_bench.py <pdf_path> \\
        [--output benchmarks/results/result.json] \\
        [--method auto] \\
        [--selector profile_aware|identity] \\
        [--device auto|cpu|mps|cuda]

输出
====

JSON 文件包含:
    - 设备信息（HardwareInfo, 含 chip_generation）
    - 每 stage 的 engine_used / elapsed_ms / success / metadata
    - 总耗时与 word_count

设计目的
========

提供可重复的基线，用于:
    1. 对比不同 selector 策略（profile_aware vs identity）的总耗时;
    2. 对比 Apple Silicon 代次（M1/M2/M3/M4）在相同 PDF 上的吞吐;
    3. 验证 PR1-3 的优化在真实 PDF 上的净收益。

不依赖
======

仅依赖项目自身 (uv run) — 无需额外 benchmark 框架。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import platform
import time
from pathlib import Path
from typing import Any, Dict


def _build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="parse_pdf_to_markdown 基准测试",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("pdf_path", type=str, help="PDF 文件路径")
    p.add_argument("--output", type=str, default=None, help="结果 JSON 输出路径")
    p.add_argument(
        "--method",
        type=str,
        default="auto",
        choices=[
            "auto",
            "pymupdf",
            "pypdf",
            "docling",
            "opendataloader",
            "mineru",
            "marker",
            "smart",
        ],
        help="parse_pdf_to_markdown 的 method 参数",
    )
    p.add_argument(
        "--selector",
        type=str,
        default=None,
        choices=["profile_aware", "identity"],
        help="覆盖 pipeline_engine_selector（默认读 settings）",
    )
    p.add_argument(
        "--device",
        type=str,
        default=None,
        choices=["auto", "cpu", "mps", "cuda", "xpu"],
        help="覆盖 mineru_device / accelerator_device（默认 settings）",
    )
    p.add_argument(
        "--page-range",
        type=str,
        default=None,
        help="页码范围 start,end (0-based, exclusive end)",
    )
    return p


def _apply_overrides(args: argparse.Namespace) -> None:
    """通过环境变量覆盖关键 settings（在 import settings 之前生效）。"""
    if args.selector:
        os.environ["NEGENTROPY_PERCEIVES_PIPELINE_ENGINE_SELECTOR"] = args.selector
    if args.device:
        os.environ["NEGENTROPY_PERCEIVES_MINERU_DEVICE"] = args.device
        os.environ["NEGENTROPY_PERCEIVES_ACCELERATOR_DEVICE"] = args.device


def _hardware_info_dict() -> Dict[str, Any]:
    from negentropy.perceives.pdf.hardware.detection import get_hardware_info

    info = get_hardware_info()
    return info.to_dict()


async def _run_bench(args: argparse.Namespace) -> Dict[str, Any]:
    from negentropy.perceives.ops.pdf import parse_pdf_to_markdown

    page_range = None
    if args.page_range:
        try:
            s, e = args.page_range.split(",", 1)
            page_range = (int(s), int(e))
        except ValueError:
            raise SystemExit(
                f"无效 --page-range：{args.page_range}（期望 'start,end'）"
            )

    start_ts = time.monotonic()
    # 形参名是 pdf_source（见 ops/pdf.py），page_range 为 Optional[List[int]]
    result = await parse_pdf_to_markdown(
        pdf_source=str(args.pdf_path),
        method=args.method,
        page_range=list(page_range) if page_range else None,
    )
    elapsed_s = time.monotonic() - start_ts

    # parse_pdf_to_markdown 返回 PDFResponse（pydantic 模型）。
    # enhanced_assets 内含 engines_used / images_extracted / tables_extracted /
    # stage_breakdown（PR #164 起恒填充，承载 stage 级时延与 selector_decision）。
    enhanced_assets = getattr(result, "enhanced_assets", None) or {}
    summary: Dict[str, Any] = {
        "pdf_path": str(args.pdf_path),
        "method": args.method,
        "selector": args.selector
        or os.environ.get("NEGENTROPY_PERCEIVES_PIPELINE_ENGINE_SELECTOR", "default"),
        "device_override": args.device,
        "page_range": page_range,
        "platform": f"{platform.system()} {platform.machine()}",
        "hardware": _hardware_info_dict(),
        "total_elapsed_s": round(elapsed_s, 2),
        "word_count": getattr(result, "word_count", 0),
        "page_count": getattr(result, "page_count", 0),
        "conversion_time": getattr(result, "conversion_time", None),
        "metadata": getattr(result, "metadata", None),
        "enhanced_assets": enhanced_assets or None,
        "engines_used": enhanced_assets.get("engines_used")
        if isinstance(enhanced_assets, dict)
        else None,
        # stage 级时延、selector 决策、skip 标志（基准矩阵脚本核心消费字段）
        "stage_breakdown": (
            enhanced_assets.get("stage_breakdown")
            if isinstance(enhanced_assets, dict)
            else None
        ),
        "method_used": getattr(result, "method", args.method),
        "error": getattr(result, "error", None),
        "success": bool(getattr(result, "success", False)),
    }
    return summary


def main() -> int:
    args = _build_argparser().parse_args()
    _apply_overrides(args)

    if not Path(args.pdf_path).exists():
        print(f"ERROR: PDF 路径不存在: {args.pdf_path}")
        return 2

    summary = asyncio.run(_run_bench(args))

    output_path = args.output
    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text(
            json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"基准结果已写入 {output_path}")
    else:
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    return 0 if summary["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
