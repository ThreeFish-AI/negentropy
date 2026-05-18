"""CLI command: parse-webpage"""

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
    method: str = typer.Option(
        "auto", "--method", "-m", help="Scraping method: auto|simple|selenium"
    ),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Output file path"
    ),
    format: str = typer.Option(
        "markdown", "--format", "-f", help="Output: json|markdown|plain"
    ),
    main_content: bool = typer.Option(
        True, "--main-content/--full-page", help="Extract main content only"
    ),
    no_metadata: bool = typer.Option(
        False, "--no-metadata", help="Exclude page metadata"
    ),
    embed_images: bool = typer.Option(
        False, "--embed-images", help="Embed images as data URI"
    ),
    remote: Optional[str] = typer.Option(
        None, "--remote", help="MCP server URL (remote mode)"
    ),
) -> None:
    """Parse a web page into structured Markdown."""
    asyncio.run(
        _run(
            url, method, output, format, main_content, no_metadata, embed_images, remote
        )
    )


async def _run(
    url, method, output, format, main_content, no_metadata, embed_images, remote
):
    if remote:
        from ...sdk import NegentropyPerceivesClient

        async with NegentropyPerceivesClient(base_url=remote) as client:
            result = await client.parse_webpage_to_markdown(
                url=url,
                method=method,
                extract_main_content=main_content,
                include_metadata=not no_metadata,
                embed_images=embed_images,
            )
    else:
        from ...ops.markdown import parse_webpage_to_markdown
        from ...tools._registry import markdown_converter, web_scraper

        result = await parse_webpage_to_markdown(
            url=url,
            method=method,
            extract_main_content=main_content,
            include_metadata=not no_metadata,
            embed_images=embed_images,
            web_scraper=web_scraper,
            markdown_converter=markdown_converter,
        )

    formatted = format_result(result, format=format)
    if output:
        from pathlib import Path

        Path(output).write_text(formatted, encoding="utf-8")
        console.print(f"[green]Output saved to {output}[/green]")
    else:
        console.print(formatted)
