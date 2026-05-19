"""CLI command: inspect-page"""

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
    url: str = typer.Argument(..., help="Target webpage URL"),
    format: str = typer.Option(
        "json", "--format", "-f", help="Output: json|markdown|plain"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Output file path"
    ),
    remote: Optional[str] = typer.Option(
        None, "--remote", help="MCP server URL (remote mode)"
    ),
) -> None:
    """Inspect a web page for metadata and accessibility status."""
    asyncio.run(_run(url, format, output, remote))


async def _run(url, format, output, remote):
    if remote:
        from ...sdk import NegentropyPerceivesClient

        async with NegentropyPerceivesClient(base_url=remote) as client:
            result = await client.inspect_page(url=url)
    else:
        from ...ops.discovery import inspect_page
        from ...tools._registry import web_scraper

        result = await inspect_page(url=url, web_scraper=web_scraper)

    formatted = format_result(result, format=format)
    if output:
        from pathlib import Path

        Path(output).write_text(formatted, encoding="utf-8")
        console.print(f"[green]Output saved to {output}[/green]")
    else:
        console.print(formatted)
