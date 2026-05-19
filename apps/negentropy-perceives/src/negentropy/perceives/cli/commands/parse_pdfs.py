"""CLI command: parse-pdfs"""

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
    pdf_sources: list[str] = typer.Argument(
        ..., help="PDF sources (URLs or local file paths)"
    ),
    method: str = typer.Option(
        "auto", "--method", "-m", help="Extraction method: auto|docling|pymupdf|pypdf"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Output directory path"
    ),
    format: str = typer.Option(
        "json", "--format", "-f", help="Output: json|markdown|plain"
    ),
    output_format: str = typer.Option(
        "markdown", "--pdf-format", help="PDF output format: markdown|text"
    ),
    remote: Optional[str] = typer.Option(
        None, "--remote", help="MCP server URL (remote mode)"
    ),
) -> None:
    """Parse multiple PDF documents into Markdown format concurrently."""
    asyncio.run(_run(pdf_sources, method, output, format, output_format, remote))


async def _run(pdf_sources, method, output, format, output_format, remote):
    if remote:
        from ...sdk import NegentropyPerceivesClient

        async with NegentropyPerceivesClient(base_url=remote) as client:
            result = await client.parse_pdfs_to_markdown(
                pdf_sources=pdf_sources,
                method=method,
                output_format=output_format,
            )
    else:
        from ...ops.pdf import parse_pdfs_to_markdown

        result = await parse_pdfs_to_markdown(
            pdf_sources=pdf_sources,
            method=method,
            output_format=output_format,
        )

    formatted = format_result(result, format=format)
    if output:
        from pathlib import Path

        out_path = Path(output)
        out_path.mkdir(parents=True, exist_ok=True)
        out_file = out_path / "results.md"
        out_file.write_text(formatted, encoding="utf-8")
        console.print(f"[green]Output saved to {out_file}[/green]")
    else:
        console.print(formatted)
