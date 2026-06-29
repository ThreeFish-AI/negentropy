"""CLI command: parse-pdf"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from .._output import format_result
from .._progress import console


def _colocate_image_assets(result: Any, out_path: Any) -> None:
    """将提取出的图片资源并置到 ``-o`` 输出文件旁的 ``images/`` 目录。

    CLI 的 ``-o`` 仅写入 Markdown 文本，但图片由提取管线落盘到默认输出目录
    （如 ``<cwd>/output/<stem>/images/``），二者解耦会使 Markdown 中
    ``./images/...`` 相对引用全部裂图。此处按 ``result.image_assets`` 逐张拷贝
    到输出文件同级，使相对引用可解析。embed_images / --no-images 场景下
    ``image_assets`` 为空，本函数空操作。
    """
    import shutil
    from pathlib import Path

    assets = getattr(result, "image_assets", None) or []
    if not assets:
        return
    dest_images = out_path.parent / "images"
    dest_images.mkdir(parents=True, exist_ok=True)
    for a in assets:
        src = getattr(a, "image_path", None) or getattr(a, "local_path", None)
        if not src:
            continue
        src_path = Path(src)
        if not src_path.is_file():
            continue
        fname = getattr(a, "filename", None) or src_path.name
        dest = dest_images / fname
        try:
            if dest.exists() and dest.resolve() == src_path.resolve():
                continue
        except Exception:
            pass
        shutil.copy2(src_path, dest)


try:
    import typer
except ImportError:
    raise ImportError("CLI dependencies not installed. Install with: uv add typer rich")


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

        out_path = Path(output)
        out_path.write_text(formatted, encoding="utf-8")
        _colocate_image_assets(result, out_path)
        console.print(f"[green]Output saved to {output}[/green]")
    else:
        console.print(formatted)
