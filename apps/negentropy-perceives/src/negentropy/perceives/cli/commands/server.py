"""CLI command: server — 启动 MCP 服务器。"""

from __future__ import annotations

from typing import Optional


try:
    import typer
except ImportError:
    raise ImportError("CLI dependencies not installed. Install with: uv add typer rich")


def run(
    config: Optional[str] = typer.Option(
        None, "--config", "-c", help="Custom YAML config file path"
    ),
    init_config: bool = typer.Option(
        False, "--init-config", help="Generate default config and exit"
    ),
) -> None:
    """Start the Negentropy Perceives MCP server."""
    from ...apps.app import main

    argv: list[str] = []
    if config:
        argv.extend(["-c", config])
    if init_config:
        argv.append("--init-config")

    main(argv=argv)
