"""CLI 进度指示器。"""

from __future__ import annotations

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()


def create_progress(message: str = "Processing") -> Progress:
    """创建一个带 spinner 的进度指示器。"""
    return Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    )
