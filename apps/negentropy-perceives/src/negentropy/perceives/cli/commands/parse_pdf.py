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
        import shutil

        out_path = Path(output)
        out_path.write_text(formatted, encoding="utf-8")

        # 持久化提取的图片到输出目录的 images/，使 markdown 中的
        # ``./images/<filename>`` 引用可解析。CLI 默认仅写文本，pipeline
        # 产出的图片落盘在内部临时目录、随进程清理，否则引用将永久断裂。
        image_assets = getattr(result, "image_assets", None) or []
        saved_images = 0
        if image_assets and format == "markdown":
            images_dir = out_path.parent / "images"
            images_dir.mkdir(parents=True, exist_ok=True)
            for asset in image_assets:
                src = getattr(asset, "image_path", None)
                if src and Path(src).exists():
                    try:
                        shutil.copy2(src, images_dir / asset.filename)
                        saved_images += 1
                    except OSError:
                        pass
        suffix = f" (+{saved_images} images)" if image_assets else ""
        console.print(f"[green]Output saved to {output}{suffix}[/green]")
    else:
        console.print(formatted)
