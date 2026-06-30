"""CLI command: parse-pdf"""

from __future__ import annotations

import asyncio
from typing import Optional

from .._output import format_result
from .._progress import console

try:
    import typer
except ImportError:
    raise ImportError("CLI dependencies not installed. Install with: uv add typer rich")


def _copy_image_assets(result, output: str) -> None:
    """将抽取的图片资产拷贝到 markdown 输出目录的 ``images/`` 子目录。

    两条路径：
    1. 传统（非 auto pipeline）路径：图片写到 ``EnhancedPDFProcessor.output_directory``
       （上层未透传 ``output_dir`` 时为 ``tempfile.mkdtemp('enhanced_pdf_*')``），
       从该目录整目录拷贝。
    2. auto pipeline 路径：``enhanced_assets`` 无 ``output_directory``，图片散落于
       image_extraction 的 ``tempfile.mkdtemp('pdf_images_*')`` 临时目录，路径记录在
       ``result.image_assets[i].image_path``。此前本函数对 auto 路径直接 no-op，
       致 ``./images/<filename>`` 引用全部死链（ISSUE: auto 路径图链失效）。此处
       按 ``image_assets`` 逐图拷贝补齐。
    """
    import shutil
    from pathlib import Path

    images_dst = Path(output).resolve().parent / "images"
    image_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}

    # 路径 1：传统路径——从 output_directory 整目录拷贝
    ea = getattr(result, "enhanced_assets", None) or {}
    src_dir = ea.get("output_directory")
    if src_dir and Path(src_dir).is_dir():
        candidates = [
            p
            for p in Path(src_dir).iterdir()
            if p.is_file() and p.suffix.lower() in image_exts
        ]
        if candidates:
            images_dst.mkdir(parents=True, exist_ok=True)
            for src in candidates:
                try:
                    shutil.copy2(src, images_dst / src.name)
                except OSError:
                    # 单图拷贝失败不应中断整体输出落盘。
                    pass
        return

    # 路径 2：auto pipeline——按 image_assets 逐图拷贝
    image_assets = getattr(result, "image_assets", None) or []
    if not image_assets:
        return
    images_dst.mkdir(parents=True, exist_ok=True)
    for asset in image_assets:
        asset_src = getattr(asset, "image_path", None)
        filename = getattr(asset, "filename", None)
        if not asset_src or not filename:
            continue
        asset_src_path = Path(asset_src)
        if not asset_src_path.is_file():
            continue
        try:
            shutil.copy2(asset_src_path, images_dst / filename)
        except OSError:
            pass


def run(
    pdf_source: str = typer.Argument(..., help="PDF source (URL or local file path)"),
    method: str = typer.Option(
        "auto", "--method", "-m", help="Extraction method: auto|docling|pymupdf|pypdf"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Output file path"
    ),
    format: str = typer.Option(
        "markdown", "--format", "-f", help="Output: json|markdown|plain"
    ),
    output_format: str = typer.Option(
        "markdown", "--pdf-format", help="PDF output format: markdown|text"
    ),
    no_metadata: bool = typer.Option(
        False, "--no-metadata", help="Exclude PDF metadata"
    ),
    no_images: bool = typer.Option(False, "--no-images", help="Skip image extraction"),
    no_tables: bool = typer.Option(False, "--no-tables", help="Skip table extraction"),
    no_formulas: bool = typer.Option(
        False, "--no-formulas", help="Skip formula extraction"
    ),
    embed_images: bool = typer.Option(
        False, "--embed-images", help="Embed images as base64"
    ),
    page_start: Optional[int] = typer.Option(
        None, "--page-start", help="Start page (0-indexed)"
    ),
    page_end: Optional[int] = typer.Option(
        None, "--page-end", help="End page (0-indexed)"
    ),
    remote: Optional[str] = typer.Option(
        None, "--remote", help="MCP server URL (remote mode)"
    ),
) -> None:
    """Parse a PDF document into structured Markdown."""
    page_range = None
    if page_start is not None and page_end is not None:
        page_range = [page_start, page_end]

    asyncio.run(
        _run(
            pdf_source,
            method,
            output,
            format,
            output_format,
            no_metadata,
            no_images,
            no_tables,
            no_formulas,
            embed_images,
            page_range,
            remote,
        )
    )


async def _run(
    pdf_source,
    method,
    output,
    format,
    output_format,
    no_metadata,
    no_images,
    no_tables,
    no_formulas,
    embed_images,
    page_range,
    remote,
):
    if remote:
        from ...sdk import NegentropyPerceivesClient

        async with NegentropyPerceivesClient(base_url=remote) as client:
            result = await client.parse_pdf_to_markdown(
                pdf_source=pdf_source,
                method=method,
                include_metadata=not no_metadata,
                page_range=page_range,
                output_format=output_format,
                extract_images=not no_images,
                extract_tables=not no_tables,
                extract_formulas=not no_formulas,
                embed_images=embed_images,
            )
    else:
        from ...ops.pdf import parse_pdf_to_markdown

        result = await parse_pdf_to_markdown(
            pdf_source=pdf_source,
            method=method,
            include_metadata=not no_metadata,
            page_range=page_range,
            output_format=output_format,
            extract_images=not no_images,
            extract_tables=not no_tables,
            extract_formulas=not no_formulas,
            embed_images=embed_images,
        )

    formatted = format_result(result, format=format)
    if output:
        from pathlib import Path

        Path(output).write_text(formatted, encoding="utf-8")
        # 补齐图片资产落盘：传统路径图片写到 EnhancedPDFProcessor.output_directory
        # （可能为临时目录），需拷贝到 -o 同级 images/ 使 ./images/<filename> 引用可达。
        _copy_image_assets(result, output)
        console.print(f"[green]Output saved to {output}[/green]")
    else:
        console.print(formatted)
