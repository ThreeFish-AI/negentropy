#!/usr/bin/env python3
"""论文抽取工具（Stage ① 精读提取的取证工具箱）。

为「逐句断言 → 论文锚点」的可回溯校准提供机械化取证手段，替代此前每轮
临场手写的一次性 pymupdf 片段。五个子命令覆盖 Stage ① 的全部取证需求：

    map       § 编号 → 页码映射（先建映射，后续锚点一律写 §x.y (pN)）
    text      按页范围取正文，**默认分栏**（A4 双栏 LaTeX 直接 get_text 会交错两栏）
    captions  图表 caption 收割（喂给分镜的动画规格）
    find      逐条断言定点搜索，返回命中处上下文（校准表的主力）
    render    指定页光栅化为 PNG（看图；无需 poppler/ffmpeg）

依赖仅 pymupdf，从仓库根调用：

    uv run --no-project --with pymupdf $R/paper_extract.py \\
        "<论文.pdf>" find "far more frequently and cheaply"

注意：论文 PDF 通常不入库（根 .gitignore 屏蔽 /assets/），须传绝对路径；
文件名含 `:` 等字符时须加引号。
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import pymupdf
except ImportError:  # pragma: no cover - 依赖缺失时给可操作提示
    sys.exit("缺少 pymupdf —— 请以 `uv run --no-project --with pymupdf` 方式调用本脚本")

# § 标题行：编号 + 标题正文。要求标题以大写字母开头，排除正文里的「1. 」列表项
SECTION_RE = re.compile(r"^\s*(\d+(?:\.\d+)*)\.?\s+([A-Z][^\n]{3,80})$", re.M)
# 图表 caption：论文用 `Figure 1 | …` 与 `Table 1 | …`，也兼容 `:`/`.` 分隔
CAPTION_RE = re.compile(r"(Figure|Table)\s+(\d+)\s*[|:.]?\s*(.{0,400})", re.S)


def open_doc(path: str) -> pymupdf.Document:
    p = Path(path).expanduser()
    if not p.is_file():
        sys.exit(f"PDF 不存在: {p}")
    return pymupdf.open(p)


def parse_pages(spec: str, page_count: int) -> list[int]:
    """解析页码表达式为 0-based 页索引列表。支持 `12-24`、`1,7,8`、`3-5,9`。"""
    pages: list[int] = []
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            lo_s, _, hi_s = chunk.partition("-")
            lo, hi = int(lo_s), int(hi_s)
        else:
            lo = hi = int(chunk)
        if lo < 1 or hi > page_count or lo > hi:
            sys.exit(f"页码区间越界: {chunk}（PDF 共 {page_count} 页）")
        pages.extend(range(lo - 1, hi))
    if not pages:
        sys.exit("未解析出任何页码")
    return pages


def cmd_map(doc: pymupdf.Document, args: argparse.Namespace) -> None:
    print(f"# § → 页码映射（共 {doc.page_count} 页）")
    for i, page in enumerate(doc):
        hits = SECTION_RE.findall(page.get_text("text"))
        if hits:
            joined = " · ".join(
                f"{num} {title.strip()[:60]}"
                for num, title in hits[: args.max_per_page]
            )
            print(f"p{i + 1:>3}  {joined}")


def page_columns(page: pymupdf.Page, columns: int) -> list[str]:
    """把一页按等宽竖切成 N 栏分别取文，避免双栏排版的行交错。"""
    if columns <= 1:
        return [page.get_text("text", sort=True)]
    r = page.rect
    width = (r.x1 - r.x0) / columns
    out = []
    for c in range(columns):
        clip = pymupdf.Rect(r.x0 + c * width, r.y0, r.x0 + (c + 1) * width, r.y1)
        out.append(page.get_text("text", clip=clip, sort=True))
    return out


def cmd_text(doc: pymupdf.Document, args: argparse.Namespace) -> None:
    labels = "LMRSTUV"  # 栏标记，最多 7 栏够用
    for i in parse_pages(args.pages, doc.page_count):
        for c, chunk in enumerate(page_columns(doc[i], args.columns)):
            tag = labels[c] if args.columns > 1 else ""
            print(f"\n===== p{i + 1} {tag} =====")
            print(chunk.rstrip())


def cmd_captions(doc: pymupdf.Document, args: argparse.Namespace) -> None:
    print("# 图表 caption 收割")
    for i, page in enumerate(doc):
        for m in CAPTION_RE.finditer(page.get_text("text", sort=True)):
            body = " ".join(m.group(3).split())[: args.chars]
            if len(body) < 12:  # 过滤正文里的「Figure 2 makes this explicit」式交叉引用
                continue
            print(f"p{i + 1:>3}  {m.group(1)} {m.group(2)}: {body}")


def cmd_find(doc: pymupdf.Document, args: argparse.Namespace) -> None:
    total = 0
    for i, page in enumerate(doc):
        for rect in page.search_for(args.query):
            clip = pymupdf.Rect(
                rect.x0 - args.context,
                rect.y0 - 40,
                rect.x1 + args.context,
                rect.y1 + 80,
            )
            block = " ".join(page.get_text("text", clip=clip, sort=True).split())
            print(f"p{i + 1:>3}  {block[: args.chars]}")
            print("---")
            total += 1
            if args.limit and total >= args.limit:
                print(f"（已达 --limit {args.limit}，停止）")
                return
    if total == 0:
        # 命中为 0 是有意义的取证结果：说明该措辞不在论文里（例如编造的数字）
        print(f"（未命中）query={args.query!r} —— 论文全文无此措辞")
        sys.exit(1)


def cmd_render(doc: pymupdf.Document, args: argparse.Namespace) -> None:
    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    for i in parse_pages(args.pages, doc.page_count):
        dest = out_dir / f"p{i + 1:03d}.png"
        doc[i].get_pixmap(dpi=args.dpi).save(dest)
        print(f"{dest}  ({dest.stat().st_size // 1024} KB)")
    print(f"\n共 {len(parse_pages(args.pages, doc.page_count))} 页 → {out_dir}")
    print("⚠️ 这些是论文原图的参考副本，仅供查看以撰写动画规格；不得入库、不得出片。")


def main() -> None:
    ap = argparse.ArgumentParser(
        description="论文抽取工具（Stage ① 取证工具箱）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("pdf", help="论文 PDF 路径（文件名含特殊字符时加引号）")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("map", help="§ 编号 → 页码映射")
    p.add_argument(
        "--max-per-page", type=int, default=4, help="每页最多列出几个标题（默认 4）"
    )
    p.set_defaults(func=cmd_map)

    p = sub.add_parser("text", help="按页范围取正文（默认双栏分列）")
    p.add_argument("--pages", required=True, help="页码，如 12-24 或 1,7,8")
    p.add_argument(
        "--columns", type=int, default=2, help="分栏数，单栏排版传 1（默认 2）"
    )
    p.set_defaults(func=cmd_text)

    p = sub.add_parser("captions", help="图表 caption 收割")
    p.add_argument(
        "--chars", type=int, default=300, help="每条 caption 截断长度（默认 300）"
    )
    p.set_defaults(func=cmd_captions)

    p = sub.add_parser("find", help="定点搜索并返回上下文（未命中时退出码 1）")
    p.add_argument("query", help="要检索的原文措辞")
    p.add_argument("--context", type=int, default=280, help="左右扩展像素（默认 280）")
    p.add_argument(
        "--chars", type=int, default=400, help="每条上下文截断长度（默认 400）"
    )
    p.add_argument(
        "--limit", type=int, default=6, help="最多返回几条，0 = 不限（默认 6）"
    )
    p.set_defaults(func=cmd_find)

    p = sub.add_parser("render", help="指定页光栅化为 PNG（看图，无需 poppler）")
    p.add_argument("--pages", required=True, help="页码，如 26,32,39,50")
    p.add_argument("--out", required=True, help="输出目录（须在 gitignored 路径下）")
    p.add_argument("--dpi", type=int, default=170, help="光栅化 DPI（默认 170）")
    p.set_defaults(func=cmd_render)

    args = ap.parse_args()
    args.func(open_doc(args.pdf), args)


if __name__ == "__main__":
    main()
