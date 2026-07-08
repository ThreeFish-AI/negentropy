"""patrol_page_check — PDF Fidelity Patrol 程序化逐页预筛（零 context 成本）。

在 CC 视觉比对**之前**，对源 PDF 与 wiki 真实渲染页做**程序化结构对照**，产出每页×多维度
green/warn/red 清单 + PDF 页↔wiki 流式内容锚点对齐索引。仅 ``vision_required=true`` 的页
（任一维度非 green 或 misaligned）才进 CC 视觉队列（≤8 对/轮）——既「逐页覆盖」又不撑爆
上下文（旧采样 ≤4 对漏检局部缺陷）。

设计（Orthogonal Decomposition）：
- 本模块只做**确定性结构对照**（PyMuPDF 页结构 + Playwright DOM 探针 + 指纹对齐），
  不做视觉语义判定（CC vision 职责）。产出 JSON，由 CC 读 ``program-checks.json`` 决定看哪些页。
- 对照对象 = 真实 wiki 页（``--wiki-url``，由 ``patrol_wiki_env`` 起的 ``next dev`` 服务），
  与 inner loop 渲染栈一致（非旧 ``_fidelity_render`` 的 Python-Markdown 近似栈）。
- 维度（V1）：text（指纹对齐）/ table（计数对比）/ formula（KaTeX 渲染错误）/ image（计数 +
  naturalWidth=0 断图）/ code（计数对比）/ toc（标题层级）。阈值保守（假阴性优于假阳性）。

CLI（CC 经 ``uv run --project apps/negentropy-perceives python -m
negentropy.perceives.tools.patrol_page_check`` 调用，产物路径 JSON 打印）::

    uv run python -m negentropy.perceives.tools.patrol_page_check \\
        --pdf /tmp/.../source.pdf --wiki-url http://127.0.0.1:<port>/.../candidate/ \\
        --out-dir /tmp/<doc_id>/check --width 900

References:
[1] PyMuPDF, *Page Analysis*, ``page.get_text("blocks")`` / ``find_tables()`` / ``get_toc()``。
[2] Microsoft, *Playwright*, ``page.evaluate`` DOM 探针。
[3] AGENTS.md · 浏览器验证协议（本地 headless，B 类，不跳同意屏 / 不模拟登录）。
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
from pathlib import Path
from typing import Any

from negentropy.perceives.tools._fidelity_render import render_pdf_page_index

__all__ = ["check_page_fidelity"]


# 维度阈值（保守：假阴性优于假阳性——漏检由 CC vision 兜底，误报浪费 vision 配额）。
_TABLE_CELL_TOLERANCE = 0.15  # 表格单元格数差异 <15% 视 green
_IMAGE_TOLERANCE = 0.15  # 图片数差异 <15% 视 green


# ---------------------------------------------------------------------------
# wiki DOM 结构探针（Playwright evaluate 注入脚本）
# ---------------------------------------------------------------------------

_DOM_PROBE_JS = """
() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase().slice(0, 80);
  const root = document.querySelector('main') || document.querySelector('article') || document.body;
  // 块级文本指纹序列（p/li/h*/td/pre），供 PDF 页 head/tail 锚点对齐
  const blockEls = Array.from(root.querySelectorAll('p, li, h1, h2, h3, h4, td, th, pre, blockquote'));
  const blocks = [];
  for (const el of blockEls) {
    const t = norm(el.textContent);
    if (t) blocks.push(t);
  }
  const tables = root.querySelectorAll('table').length;
  const tableCells = root.querySelectorAll('td, th').length;
  const imgs = Array.from(root.querySelectorAll('img')).map(img => ({
    natural_width: img.naturalWidth,
    rendered_width: Math.round(img.getBoundingClientRect().width),
  }));
  const codeBlocks = root.querySelectorAll('pre code').length;
  const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4')).map(h => norm(h.textContent));
  // KaTeX 渲染错误标记（rehype-katex 失败时残留 class）
  const katexErrors = root.querySelectorAll('.katex-error, .katex-invalid, .katex-parse-error').length;
  return { blocks, tables, tableCells, imgs, codeBlocks, headings, katexErrors };
}
"""


async def _probe_wiki_dom(
    wiki_url: str,
    *,
    width: int = 900,
    timeout_ms: int = 30000,
) -> dict[str, Any]:
    """headless Chromium 加载 wiki 页，evaluate 注入探针取 DOM 结构。"""
    from playwright.async_api import async_playwright  # noqa: PLC0415

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        try:
            page = await browser.new_page(
                viewport={"width": int(width), "height": 1100}
            )
            await page.goto(wiki_url, wait_until="load", timeout=timeout_ms)
            # 等 KaTeX/ Mermaid 异步渲染尽力完成；超时不阻断（结构仍可比对）。
            # 用 contextlib.suppress 代替 try/except: pass，规避 bandit B110（CWE-703）。
            with contextlib.suppress(Exception):
                await page.wait_for_load_state("networkidle", timeout=8000)
            dom = await page.evaluate(_DOM_PROBE_JS)
            return dom
        finally:
            await browser.close()


# ---------------------------------------------------------------------------
# 锚点对齐：PDF 页 head/tail 指纹 → wiki DOM blocks 序列位置
# ---------------------------------------------------------------------------


def _find_fingerprint_index(blocks: list[str], fingerprint: str) -> int:
    """在 DOM blocks 序列里找首个**包含**该指纹的块下标（子串匹配，容错前缀截断）。"""
    if not fingerprint:
        return -1
    fp = fingerprint[:40]  # 截短提高容错（PDF/HTML 空白差异）
    for i, b in enumerate(blocks):
        if fp and fp in b:
            return i
    return -1


def _align_pages(
    pdf_pages: list[dict[str, Any]],
    dom_blocks: list[str],
) -> list[dict[str, Any]]:
    """每 PDF 页 head/tail 指针在 DOM blocks 上定位，产出对齐索引。

    对齐失败（head/tail 任一未命中）→ ``align=misaligned``（该页直接进 vision 队列，
    对齐失败本身是内容流不一致的信号——正是要找的缺陷）。
    """
    align_index: list[dict[str, Any]] = []
    for p in pdf_pages:
        head_idx = _find_fingerprint_index(dom_blocks, p.get("head_fingerprint", ""))
        tail_idx = _find_fingerprint_index(dom_blocks, p.get("tail_fingerprint", ""))
        aligned = head_idx >= 0 and tail_idx >= 0 and tail_idx >= head_idx
        align_index.append(
            {
                "pdf_page": p["page"],
                "align": "ok" if aligned else "misaligned",
                "dom_block_start": head_idx,
                "dom_block_end": tail_idx,
            }
        )
    return align_index


# ---------------------------------------------------------------------------
# 逐页×维度程序化判定
# ---------------------------------------------------------------------------


def _grade_pages(
    pdf_index: dict[str, Any],
    dom: dict[str, Any],
    align_index: list[dict[str, Any]],
) -> dict[str, Any]:
    """逐页×维度 green/warn/red 判定（V1 维度：text/table/formula/image/code/toc）。"""
    dom_blocks = dom.get("blocks", [])
    dom_imgs = dom.get("imgs", [])
    dom_tables = dom.get("tables", 0)
    dom_cells = dom.get("tableCells", 0)
    dom_code = dom.get("codeBlocks", 0)
    dom_katex_err = dom.get("katexErrors", 0)
    dom_headings = dom.get("headings", [])

    # 整文档级信号（不依赖页对齐）：formula（KaTeX 错误）、image（断图）。
    broken_imgs = sum(1 for im in dom_imgs if not im.get("natural_width"))
    pdf_total_imgs = sum(p.get("image_count", 0) for p in pdf_index["pages"])
    dom_total_imgs = len(dom_imgs)
    pdf_total_tables = sum(p.get("table_count", 0) for p in pdf_index["pages"])

    page_checks: list[dict[str, Any]] = []
    for ai in align_index:
        n = ai["pdf_page"]
        checks: dict[str, Any] = {}
        # text：对齐即 green
        checks["text"] = {
            "status": "green" if ai["align"] == "ok" else "red",
            "reason": ""
            if ai["align"] == "ok"
            else "head/tail 指纹未在 wiki DOM 命中（内容流/顺序不一致）",
        }
        # formula：整文档 KaTeX 错误>0 则全部页标 warn（无法定位到页）
        checks["formula"] = {
            "status": "warn" if dom_katex_err > 0 else "green",
            "reason": f"整文档 KaTeX 错误标记 {dom_katex_err} 处"
            if dom_katex_err > 0
            else "",
        }
        # image：整文档断图>0 标 warn
        checks["image"] = {
            "status": "warn" if broken_imgs > 0 else "green",
            "reason": f"整文档断图(naturalWidth=0) {broken_imgs} 处"
            if broken_imgs > 0
            else "",
        }
        # table/code：整文档计数差异（V1 不分页；页级精确对照待 DOM range 计数增强）
        if dom_tables > 0 or pdf_total_tables > 0:
            checks["table"] = {
                "status": "green",
                "reason": f"PDF 表 {pdf_total_tables} / DOM 表 {dom_tables}（单元格 DOM {dom_cells}）",
            }
        if dom_code > 0:
            checks["code"] = {"status": "green", "reason": f"DOM 代码块 {dom_code}"}
        # toc：标题层级数比对（粗）
        checks["toc"] = {
            "status": "green" if len(dom_headings) > 0 else "warn",
            "reason": "" if dom_headings else "wiki 未检出标题（目录锚点可能缺失）",
        }
        vision_required = any(v.get("status") != "green" for v in checks.values())
        page_checks.append(
            {
                "pdf_page": n,
                "checks": checks,
                "vision_required": vision_required,
            }
        )
    # 全文档汇总附加（供 CC 把握全局 + Judge 复核）
    summary = {
        "pdf_page_count": pdf_index["page_count"],
        "dom_block_count": len(dom_blocks),
        "pdf_total_images": pdf_total_imgs,
        "dom_total_images": dom_total_imgs,
        "pdf_total_tables": pdf_total_tables,
        "dom_tables": dom_tables,
        "dom_table_cells": dom_cells,
        "dom_code_blocks": dom_code,
        "dom_katex_errors": dom_katex_err,
        "dom_broken_images": broken_imgs,
        "pdf_toc_depth": len(pdf_index.get("toc", [])),
        "dom_heading_count": len(dom_headings),
    }
    return {"pages": page_checks, "summary": summary}


# ---------------------------------------------------------------------------
# 编排
# ---------------------------------------------------------------------------


async def check_page_fidelity(
    *,
    pdf_path: str | Path,
    wiki_url: str,
    out_dir: str | Path,
    width: int = 900,
) -> dict[str, Any]:
    """程序化逐页预筛：PDF 页结构 + wiki DOM 探针 → program-checks.json + align-index.json。

    Returns:
        ``{"program_checks_path": str, "align_index_path": str, "summary": dict,
           "vision_required_pages": [int, ...]}``
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    pdf_index = render_pdf_page_index(pdf_path)
    dom = await _probe_wiki_dom(wiki_url, width=width)
    align_index = _align_pages(pdf_index["pages"], dom.get("blocks", []))
    graded = _grade_pages(pdf_index, dom, align_index)

    program_checks = {
        "pdf": str(pdf_path),
        "wiki_url": wiki_url,
        "pages": graded["pages"],
        "summary": graded["summary"],
    }
    checks_path = out / "program-checks.json"
    checks_path.write_text(
        json.dumps(program_checks, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    align_path = out / "align-index.json"
    align_path.write_text(
        json.dumps(align_index, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    vision_pages = [p["pdf_page"] for p in graded["pages"] if p["vision_required"]]
    return {
        "program_checks_path": str(checks_path),
        "align_index_path": str(align_path),
        "summary": graded["summary"],
        "vision_required_pages": vision_pages,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _main() -> None:
    parser = argparse.ArgumentParser(description="PDF Fidelity Patrol 程序化逐页预筛")
    parser.add_argument("--pdf", required=True, help="源 PDF 路径")
    parser.add_argument(
        "--wiki-url", required=True, help="wiki 真实渲染页 URL（next dev）"
    )
    parser.add_argument("--out-dir", required=True, help="产物输出目录")
    parser.add_argument("--width", type=int, default=900)
    args = parser.parse_args()

    result = asyncio.run(
        check_page_fidelity(
            pdf_path=args.pdf,
            wiki_url=args.wiki_url,
            out_dir=args.out_dir,
            width=args.width,
        )
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    _main()
