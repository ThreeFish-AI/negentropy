"""Negentropy Perceives CLI — 命令行工具入口。"""

from __future__ import annotations

try:
    import typer
except ImportError:
    raise ImportError("CLI dependencies not installed. Install with: uv add typer rich")

app = typer.Typer(
    name="perceives",
    help="Negentropy Perceives — Web content extraction & PDF parsing CLI.",
    no_args_is_help=True,
    rich_markup_mode="rich",
)

# 注册子命令
from .commands import (  # noqa: E402
    discover_links,
    inspect_page,
    parse_pdf,
    parse_pdfs,
    parse_webpage,
    parse_webpages,
    prefetch_models,
    server,
)

app.command("discover-links")(discover_links.run)
app.command("inspect-page")(inspect_page.run)
app.command("parse-webpage")(parse_webpage.run)
app.command("parse-webpages")(parse_webpages.run)
app.command("parse-pdf")(parse_pdf.run)
app.command("parse-pdfs")(parse_pdfs.run)
app.command("prefetch-models")(prefetch_models.run)
app.command("server")(server.run)
