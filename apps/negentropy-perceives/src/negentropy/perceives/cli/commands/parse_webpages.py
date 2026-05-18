"""CLI command: parse-webpages"""

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
    urls: list[str] = typer.Argument(..., help="Target webpage URLs"),
    method: str = typer.Option(
        "auto", "--method", "-m", help="Scraping method: auto|simple|selenium"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Output directory path"
    ),
    format: str = typer.Option(
        "json", "--format", "-f", help="Output: json|markdown|plain"
    ),
    main_content: bool = typer.Option(
        True, "--main-content/--full-page", help="Extract main content only"
    ),
    embed_images: bool = typer.Option(
        False, "--embed-images", help="Embed images as data URI"
    ),
    remote: Optional[str] = typer.Option(
        None, "--remote", help="MCP server URL (remote mode)"
    ),
) -> None:
    """Parse multiple web pages into Markdown format concurrently."""
    asyncio.run(_run(urls, method, output, format, main_content, embed_images, remote))


async def _run(urls, method, output, format, main_content, embed_images, remote):
    if remote:
        from ...sdk import NegentropyPerceivesClient

        async with NegentropyPerceivesClient(base_url=remote) as client:
            result = await client.parse_webpages_to_markdown(
                urls=urls,
                method=method,
                extract_main_content=main_content,
                embed_images=embed_images,
            )
    else:
        from ...ops.markdown import parse_webpages_to_markdown
        from ...tools._registry import markdown_converter, web_scraper

        result = await parse_webpages_to_markdown(
            urls=urls,
            method=method,
            extract_main_content=main_content,
            embed_images=embed_images,
            web_scraper=web_scraper,
            markdown_converter=markdown_converter,
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
