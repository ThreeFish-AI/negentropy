"""CLI command: discover-links"""

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
    filter_domains: Optional[list[str]] = typer.Option(
        None, "--filter-domains", help="Whitelist domains (comma-separated)"
    ),
    exclude_domains: Optional[list[str]] = typer.Option(
        None, "--exclude-domains", help="Blacklist domains (comma-separated)"
    ),
    internal_only: bool = typer.Option(
        False, "--internal-only", help="Only discover internal (same-domain) links"
    ),
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
    """Discover and filter hyperlinks from a web page."""
    asyncio.run(
        _run(
            url, filter_domains, exclude_domains, internal_only, format, output, remote
        )
    )


async def _run(
    url, filter_domains, exclude_domains, internal_only, format, output, remote
):
    if remote:
        from ...sdk import NegentropyPerceivesClient

        async with NegentropyPerceivesClient(base_url=remote) as client:
            result = await client.discover_links(
                url=url,
                filter_domains=filter_domains,
                exclude_domains=exclude_domains,
                internal_only=internal_only,
            )
    else:
        from ...ops.discovery import discover_links
        from ...tools._registry import web_scraper

        result = await discover_links(
            url=url,
            filter_domains=filter_domains,
            exclude_domains=exclude_domains,
            internal_only=internal_only,
            web_scraper=web_scraper,
        )

    formatted = format_result(result, format=format)
    _write_output(formatted, output)


def _write_output(content: str, output: Optional[str]) -> None:
    if output:
        from pathlib import Path

        Path(output).write_text(content, encoding="utf-8")
        console.print(f"[green]Output saved to {output}[/green]")
    else:
        console.print(content)
