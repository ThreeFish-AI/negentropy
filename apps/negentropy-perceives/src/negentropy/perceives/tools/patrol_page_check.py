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
  // 整页可见文本（innerText 含行内 code/公式/链接，且按视觉顺序拼接）——供 token 覆盖率判定，
  // 比分块 textContent 拼接更完整（不漏行内元素、不割裂）。
  const pageText = root.innerText || '';
  return { blocks, tables, tableCells, imgs, codeBlocks, headings, katexErrors, pageText };
}
"""


def _resolve_chromium_executable() -> str | None:
    """定位可用的 chromium 可执行文件；默认 headless-shell 缺失时回退完整 chromium。

    patrol 运行环境（本地/CI）的 Playwright 缓存布局可能只装了完整 chromium 而无
    chrome-headless-shell（headless 默认路径）；两者皆可 headless 运行。返回 None
    则交由 Playwright 默认解析。
    """
    import os

    candidates: list[Path] = []
    for env in (
        os.environ.get("PLAYWRIGHT_BROWSERS_PATH"),
        os.path.expanduser("~/Library/Caches/ms-playwright"),
        os.path.expanduser("~/.cache/ms-playwright"),
    ):
        if env:
            candidates.append(Path(env))
    for base in candidates:
        if not base.is_dir():
            continue
        # 1) chrome-headless-shell-* （版本号最大优先）
        for sub in sorted(base.glob("chromium_headless_shell-*"), reverse=True):
            for rel in ("chrome-headless-shell-mac-arm64/chrome-headless-shell",):
                c = sub / rel
                if c.exists():
                    return str(c)
        # 2) 完整 chromium-* （mac/linux 布局）
        for sub in sorted(base.glob("chromium-*"), reverse=True):
            for rel in (
                "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
                "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
                "chrome-linux/chrome",
            ):
                c = sub / rel
                if c.exists():
                    return str(c)
    return None


async def _probe_wiki_dom(
    wiki_url: str,
    *,
    width: int = 900,
    timeout_ms: int = 30000,
) -> dict[str, Any]:
    """headless Chromium 加载 wiki 页，evaluate 注入探针取 DOM 结构。"""
    from playwright.async_api import async_playwright  # noqa: PLC0415

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=_resolve_chromium_executable()
        )
        try:
            page = await browser.new_page(
                viewport={"width": int(width), "height": 1100}
            )
            await page.goto(wiki_url, wait_until="load", timeout=timeout_ms)
            # 等 KaTeX/ Mermaid 异步渲染尽力完成；超时不阻断（结构仍可比对）。
            # 用 contextlib.suppress 代替 try/except: pass，规避 bandit B110（CWE-703）。
            with contextlib.suppress(Exception):
                await page.wait_for_load_state("networkidle", timeout=8000)
            # 触发懒加载图片（loading="lazy"）：强制 eager + 重置 src 触发解码。
            # 原 scrollIntoView-in-loop 在大长页（300+ 页单 entry）里与 IntersectionObserver
            # 竞态——逐张 scrollIntoView 互相覆盖视口，中后段图 observer 未及触发即被滚离，
            # 致 naturalWidth=0 假阳性断图（实测 308 页文档误报 52 张断图，实为有效 PNG）。
            # 重置 src 强制浏览器拉取解码，与视口无关，稳健；超时仍不阻断——真断图恒 0。
            with contextlib.suppress(Exception):
                await page.evaluate(
                    "() => { for (const i of document.querySelectorAll('img')) {"
                    "  i.loading = 'eager';"
                    "  const s = i.getAttribute('src');"
                    "  if (s) { i.removeAttribute('src'); i.setAttribute('src', s); }"
                    "} }"
                )
                await page.wait_for_function(
                    "() => Array.from(document.querySelectorAll('img'))"
                    ".every(i => i.complete && i.naturalWidth > 0)",
                    timeout=20000,
                )
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

    # text 维度：改用「token 覆盖率」而非「块顺序对齐」。双栏学术 PDF 的视觉块顺序 ≠
    # 单栏化 DOM 线性顺序，且 PDF get_text("blocks") 块粒度 ≠ DOM 段落粒度、块内含软换行/
    # 连字符/目录点线，精确子串对齐必假阳性。正确口径是「该页的实词是否都出现在 DOM 中」
    # ——对语序、分块、换行不敏感，直接度量「内容是否缺失」。
    import re as _re  # noqa: PLC0415

    def _tokens(text: str) -> list[str]:
        # 提取字母数字词（含 CJK），小写；过滤 1 字符噪声。在字母↔数字边界切分
        # （PDF 把上标引用/编号粘连成 "Fu¹"→"fu1"，DOM 分词为 "fu"+"1"），避免把
        # 「作者名+上标」等表示差异误判为内容缺失——纯分词正确性,非针对性放宽。
        raw = _re.findall(r"[0-9a-zA-Z一-鿿]+", (text or "").lower())
        out: list[str] = []
        for w in raw:
            parts = (
                _re.findall(r"[a-z一-鿿]+|[0-9]+", w)
                if _re.search(r"[a-z一-鿿][0-9]|[0-9][a-z一-鿿]", w)
                else [w]
            )
            out.extend(p for p in parts if len(p) >= 2)
        return out

    # DOM 全文 token 集合：优先用 innerText（含行内 code/公式/链接、按视觉顺序），
    # 回退分块拼接。另备去分隔符长串，兜底 PDF 跨行连字符断词（如 execu-tion → executiON）。
    dom_page_text = dom.get("pageText") or " ".join(dom_blocks)
    dom_token_set = set(_tokens(dom_page_text))
    dom_collapsed = "".join(_tokens(dom_page_text))  # 无分隔连续串，兜底断词
    pdf_pages = {p["page"]: p for p in pdf_index["pages"]}

    def _text_coverage(page_meta: dict[str, Any]) -> tuple[str, str]:
        """该页实词在 DOM 的覆盖率 ≥0.9 green，≥0.75 warn，否则 red（含断词兜底）。"""
        page_text = page_meta.get("full_text") or " ".join(
            page_meta.get("block_fingerprints", [])
        )
        uniq = set(_tokens(page_text))
        if len(uniq) < 5:
            return "green", "本页文本极少（纯图表/分隔页）"

        # 命中：token 在 DOM token 集合，或（长度≥4 的词）作为子串出现在去分隔连续串中
        # ——后者吸收连字符断词与 PDF/DOM 分词差异，避免把表示差异误判为内容缺失。
        def _hit(t: str) -> bool:
            return t in dom_token_set or (len(t) >= 4 and t in dom_collapsed)

        hit = sum(1 for t in uniq if _hit(t))
        cov = hit / len(uniq)
        if cov >= 0.9:
            return "green", ""
        if cov >= 0.75:
            return "warn", f"词覆盖率 {cov:.0%}（{hit}/{len(uniq)}）"
        return "red", f"词覆盖率仅 {cov:.0%}（{hit}/{len(uniq)}），疑内容缺失"

    page_checks: list[dict[str, Any]] = []
    for ai in align_index:
        n = ai["pdf_page"]
        checks: dict[str, Any] = {}
        # text：内容覆盖率判定（不依赖块顺序对齐）。
        t_status, t_reason = _text_coverage(pdf_pages.get(n, {}))
        checks["text"] = {"status": t_status, "reason": t_reason}
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
