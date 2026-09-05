"""fidelity_render — PDF 高保真巡检的视觉对比底座。

把源 PDF 与候选 Markdown 渲染为**可比对的光栅图像**，供 NegentropyEngine（Claude Code 会话）
的视觉能力逐页/逐模块比对、评分：

- 源 PDF 每页 → PNG（PyMuPDF ``page.get_pixmap``，perceives 已依赖 ``pymupdf``）。
- 候选 Markdown → 独立 HTML（Python-Markdown 的 tables/fenced_code/codehilite/toc 扩展 +
  KaTeX 自动渲染 + 最小 CSS，尽量贴合 ``DocumentMarkdownRenderer`` 栈）→ headless Chromium
  全页截图为 PNG（``playwright``，perceives 已依赖）。

设计取舍（Orthogonal Decomposition）：
- 本模块只做「文本/文件 → 图像」的确定性渲染，不做「比对/评分」（那是 ContemplationFaculty
  的视觉职责）。返回路径，由调用方读图后用视觉模型比对。
- 渲染对网络**不硬依赖**：KaTeX 经 CDN best-effort 加载，离线时数学公式回退为 ``$...$`` 原文
  （结构仍可比对），契合巡检「本地 headless、免鉴权」的安全红线。

CLI（巡检会话经 ``uv run`` 调用，产物路径打印为 JSON 便于解析）::

    uv run python -m negentropy.perceives.tools._fidelity_render \\
        --pdf /tmp/.../source.pdf --markdown ./patrol-candidate.md \\
        --out-dir /tmp/<doc_id>/render --dpi 150 --width 900

References:
[1] PyMuPDF, *Page Rendering*, ``fitz.Page.get_pixmap``.
[2] Microsoft, *Playwright*, headless Chromium screenshot.
[3] AGENTS.md · 浏览器验证协议（本地 headless，不跳同意屏 / 不模拟登录）。
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
from pathlib import Path
from typing import Any

__all__ = [
    "render_pdf_pages",
    "render_pdf_page_index",
    "markdown_to_html",
    "render_markdown_html_to_png",
    "render_page_pairs",
]


# ---------------------------------------------------------------------------
# PDF 每页 → PNG（PyMuPDF，同步）
# ---------------------------------------------------------------------------


def render_pdf_pages(
    pdf_path: str | Path,
    *,
    dpi: int = 150,
    out_dir: str | Path,
) -> list[tuple[int, str]]:
    """渲染 PDF 每页为 PNG；返回 [(page_n_从1起, png_abs_path), ...]。"""
    import fitz  # PyMuPDF  # noqa: PLC0415

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    matrix = fitz.Matrix(dpi / 72, dpi / 72)

    pairs: list[tuple[int, str]] = []
    with fitz.open(str(pdf_path)) as doc:
        for i, page in enumerate(doc, start=1):
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            png_path = out / f"pdf-page-{i:04d}.png"
            pix.save(str(png_path))
            pairs.append((i, str(png_path)))
    return pairs


def _fingerprint(text: str, *, n: int = 80) -> str:
    """文本块指纹：折叠空白 + 小写 + 截前 n 字符（供 PDF 页↔wiki DOM 锚点对齐）。"""
    return " ".join((text or "").split())[:n].lower()


def render_pdf_page_index(
    pdf_path: str | Path,
    *,
    fingerprint_chars: int = 80,
) -> dict[str, Any]:
    """提取源 PDF 的逐页结构索引（供程序化逐页预筛 + 与 wiki DOM 指纹对齐）。

    Returns:
        ``{"page_count": int, "toc": [[level, title, page], ...], "pages": [
            {"page": 1, "head_fingerprint": str, "tail_fingerprint": str,
             "image_count": int, "table_count": int, "text_block_count": int}
        ]}``

    - ``head/tail_fingerprint``：每页首/末文本块指纹（PDF 页↔wiki 流式内容锚点对齐用）。
    - ``table_count``：PyMuPDF ``page.find_tables()`` 检出的表格数（版本不支持则 0）。
    - 用于 ``patrol_page_check`` 程序化预筛（零 context 成本），不替代视觉判定。
    """
    import fitz  # PyMuPDF  # noqa: PLC0415
    from collections import Counter  # noqa: PLC0415

    page_blocks: list[list[str]] = []  # 每页文本块指纹序列
    page_full_texts: list[str] = []  # 每页完整正文（token 覆盖率判定用）
    page_meta: list[
        tuple[int, int, int]
    ] = []  # (image_count, table_count, text_block_count)
    with fitz.open(str(pdf_path)) as doc:
        page_count = doc.page_count
        toc = doc.get_toc(simple=True)  # [[level, title, page], ...]
        for i, page in enumerate(doc, start=1):
            raw_blocks = page.get_text(
                "blocks"
            )  # (x0,y0,x1,y1,text,no,type) type 0=text 1=image
            text_blocks = [
                b for b in raw_blocks if len(b) > 6 and b[6] == 0 and str(b[4]).strip()
            ]
            page_blocks.append(
                [_fingerprint(str(b[4]), n=fingerprint_chars) for b in text_blocks]
            )
            # 每页完整正文（未截断）：供 patrol_page_check 做 token 覆盖率判定。
            page_full_texts.append(" ".join(str(b[4]) for b in text_blocks))
            image_count = len(page.get_images(full=True))
            table_count = 0
            try:
                tabs = page.find_tables()
                table_count = len(tabs.tables) if tabs is not None else 0
            except Exception:  # noqa: BLE001 - 老版本 PyMuPDF 无 find_tables，降级 0
                table_count = 0
            page_meta.append((image_count, table_count, len(text_blocks)))

    # 检测 running header / footer：在 >40% 页重复出现的首/末文本块（页眉页脚家具）。
    # 这类块在 wiki DOM 中不重复（管线正确剥离），须从内容对齐中剔除，避免系统性失配。
    def _repeated(seq: list[str], threshold: float = 0.4) -> str:
        if not seq:
            return ""
        value, count = Counter(seq).most_common(1)[0]
        return value if count / len(seq) > threshold else ""

    header = _repeated([b[0] for b in page_blocks if b])
    footer = _repeated([b[-1] for b in page_blocks if b])

    pages: list[dict[str, Any]] = []
    for i, blocks in enumerate(page_blocks, start=1):
        # 剔除页眉页脚家具后的内容块指纹列表（供 patrol_page_check 做「内容覆盖率」判定，
        # 而非依赖块顺序对齐——双栏 PDF 的视觉块序 ≠ 单栏化 DOM 线性序，顺序对齐必假阳性）。
        content = [x for x in blocks if x and x not in (header, footer)]
        head = content[0] if content else ""
        tail = content[-1] if content else ""
        image_count, table_count, tbc = page_meta[i - 1]
        pages.append(
            {
                "page": i,
                "head_fingerprint": head,
                "tail_fingerprint": tail,
                "block_fingerprints": content,
                "full_text": page_full_texts[i - 1],
                "image_count": image_count,
                "table_count": table_count,
                "text_block_count": tbc,
            }
        )
    return {"page_count": page_count, "toc": toc, "pages": pages}


# ---------------------------------------------------------------------------
# Markdown → 独立 HTML（尽量贴合 DocumentMarkdownRenderer 栈）
# ---------------------------------------------------------------------------

_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8">
<title>{title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css">
<style>
  body{{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
       line-height:1.65; padding:24px; color:#1f2328; max-width:{width}px; margin:0 auto;}}
  table{{border-collapse:collapse;}} th,td{{border:1px solid #d0d7de;padding:6px 12px;}}
  img{{max-width:100%;}} pre{{padding:12px;overflow:auto;border-radius:6px;background:#f6f8fa;}}
  code{{background:#eff1f3;padding:1px 4px;border-radius:3px;}}
  pre code{{background:transparent;padding:0;}}
  h1,h2,h3{{border-bottom:1px solid #eaecef;padding-bottom:.3em;}}
</style></head><body>
{body}
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<script>
  if (window.renderMathInElement){{
    renderMathInElement(document.body, {{
      delimiters:[
        {{left:"$$",right:"$$",display:true}},
        {{left:"$",right:"$",display:false}},
        {{left:"\\\\[",right:"\\\\]",display:true}},
        {{left:"\\\\(",right:"\\\\)",display:false}}
      ],
      throwOnError:false
    }});
  }}
</script>
</body></html>
"""


def markdown_to_html(
    markdown_text: str,
    *,
    title: str = "candidate",
    width: int = 900,
) -> str:
    """Markdown 文本 → 独立 HTML 字符串（tables/fenced_code/codehilite/toc + KaTeX + CSS）。

    Python-Markdown 不可用时回退为 ``<pre>`` 包裹（结构仍可比对）。
    """
    body: str
    try:
        import markdown as md  # type: ignore[import-untyped]  # noqa: PLC0415

        body = md.markdown(
            markdown_text,
            extensions=["tables", "fenced_code", "codehilite", "toc", "sane_lists"],
            extension_configs={"codehilite": {"guess_lang": False}},
        )
    except Exception:  # noqa: BLE001 — 退化为 pre 包裹，保证可用
        import html as _html  # noqa: PLC0415

        body = f"<pre>{_html.escape(markdown_text)}</pre>"
    return _HTML_TEMPLATE.format(title=title, width=int(width), body=body)


async def render_markdown_html_to_png(
    html_path: str | Path,
    *,
    png_path: str | Path,
    width: int = 900,
) -> str:
    """headless Chromium 把 HTML 文件全页截图为 PNG；返回 png 绝对路径。"""
    from playwright.async_api import async_playwright  # noqa: PLC0415

    html_uri = Path(html_path).resolve().as_uri()
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        try:
            page = await browser.new_page(
                viewport={"width": int(width), "height": 1100}
            )
            await page.goto(html_uri, wait_until="load")
            # networkidle 等待 CDN（KaTeX/hljs）尽力加载；超时不阻断（离线回退原文）。
            # 用 contextlib.suppress 代替 try/except: pass，规避 bandit B110（CWE-703）。
            with contextlib.suppress(Exception):
                await page.wait_for_load_state("networkidle", timeout=8000)
            await page.screenshot(path=str(png_path), full_page=True)
        finally:
            await browser.close()
    return str(png_path)


# ---------------------------------------------------------------------------
# 编排：PDF 页 + Markdown HTML/PNG 一次性产出
# ---------------------------------------------------------------------------


async def render_page_pairs(
    *,
    pdf_path: str | Path,
    markdown_path: str | Path,
    out_dir: str | Path,
    dpi: int = 150,
    width: int = 900,
) -> dict[str, Any]:
    """渲染源 PDF 每页 PNG + 候选 Markdown HTML/PNG。

    **Legacy / 离线降级**：候选 Markdown 经 Python-Markdown 近似渲染，与真实 wiki 栈
    （react-markdown + remark/rehype）系统性不同（公式/Mermaid/figure/figcaption/图片尺寸/
    代码高亮假阳性）。巡检 inner loop 优先走真实 wiki 渲染栈（``patrol_wiki_env`` +
    Playwright 截 ``next dev`` 真页）；仅当 wiki dev server 不可用时（``wiki_render_available=False``）
    回退本路径，并标记本轮降级。

    Returns:
        ``{"pdf_pages": [(page_n, png_path), ...], "markdown_html": html_path,
           "markdown_png": png_path, "page_count": int}``
    """
    out = Path(out_dir)
    pdf_pages = render_pdf_pages(pdf_path, dpi=dpi, out_dir=out / "pdf")

    md_text = Path(markdown_path).read_text(encoding="utf-8")
    html = markdown_to_html(md_text, title=Path(markdown_path).stem, width=width)
    html_path = out / "candidate.html"
    html_path.write_text(html, encoding="utf-8")

    png_path = out / "candidate.png"
    await render_markdown_html_to_png(html_path, png_path=png_path, width=width)

    return {
        "pdf_pages": pdf_pages,
        "markdown_html": str(html_path),
        "markdown_png": str(png_path),
        "page_count": len(pdf_pages),
    }


# ---------------------------------------------------------------------------
# CLI（巡检会话经 uv run 调用，产物路径以 JSON 打印）
# ---------------------------------------------------------------------------


def _main() -> None:
    parser = argparse.ArgumentParser(description="PDF↔Markdown 视觉对比渲染助手")
    parser.add_argument("--pdf", required=True, help="源 PDF 路径")
    parser.add_argument("--markdown", required=True, help="候选 Markdown 路径")
    parser.add_argument("--out-dir", required=True, help="产物输出目录")
    parser.add_argument("--dpi", type=int, default=150)
    parser.add_argument("--width", type=int, default=900)
    args = parser.parse_args()

    result = asyncio.run(
        render_page_pairs(
            pdf_path=args.pdf,
            markdown_path=args.markdown,
            out_dir=args.out_dir,
            dpi=args.dpi,
            width=args.width,
        )
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    _main()
