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


def _copy_image_assets(result, output: str) -> None:
    """将抽取的图片资产拷贝到 markdown 输出目录的 ``images/`` 子目录。

    两条 pipeline 路径的图片落盘位置都可能与用户 ``-o`` 输出路径不一致，需在此统一
    搬运到 ``Path(output).parent / "images"``，使候选 markdown 中 ``./images/<filename>``
    引用可达（否则全量死链）：

    - **auto pipeline**：``result.image_assets``（``List[ImageAsset]``）携带每张图的绝对
      ``image_path``。其落盘约定（``_resolve_images_dir``）在未透传 ``output_dir`` 时
      回退到 ``<cwd>/output/<stem>/images/``，与用户 ``-o`` 路径常常不一致——此前本函数
      误以为 auto 路径「自带正确落盘」而对齐 no-op，导致 CLI 候选图片全量死链。
    - **传统（非 auto）路径**：图片写在 ``EnhancedPDFProcessor.output_directory``
      （``result.enhanced_assets["output_directory"]`` 指向的目录，可能为临时目录）。
    """
    import shutil
    from pathlib import Path

    images_dst = Path(output).resolve().parent / "images"

    src_files = []
    # (1) auto pipeline：从 image_assets 逐图收集绝对 image_path
    for asset in getattr(result, "image_assets", None) or []:
        image_path = getattr(asset, "image_path", None)
        if image_path:
            src_files.append(Path(image_path))
    # (2) 传统路径：从 enhanced_assets.output_directory 收集目录内全部图片
    ea = getattr(result, "enhanced_assets", None) or {}
    src_dir = ea.get("output_directory")
    if src_dir and Path(src_dir).is_dir():
        image_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}
        src_files.extend(
            p
            for p in Path(src_dir).iterdir()
            if p.is_file() and p.suffix.lower() in image_exts
        )

    if not src_files:
        return
    images_dst.mkdir(parents=True, exist_ok=True)
    seen = set()
    for src in src_files:
        try:
            if not src.is_file():
                continue
            dest = images_dst / src.name
            if src.name in seen or src.resolve() == dest.resolve():
                # 同名已拷贝 / 源与目标同一文件（auto 路径已恰好落在 images_dst 时）。
                continue
            seen.add(src.name)
            shutil.copy2(src, dest)
        except OSError:
            # 单图拷贝失败不应中断整体输出落盘（如只读源/目标磁盘满）。
            pass


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

        # markdown 文件输出写纯文档内容（result.content），剥离 CLI 展示用的元数据
        # 头尾（``## <source>`` / ``**Status**`` / 末尾 ``### Statistics``）——这些是
        # format_result 的展示 chrome、非文档内容，混入 .md 会污染下游消费（保真度
        # 比对、知识库灌库等）。stdout 与 json/plain 格式仍走 format_result 不变。
        if format == "markdown":
            Path(output).write_text(result.content or "", encoding="utf-8")
        else:
            Path(output).write_text(formatted, encoding="utf-8")
        # 补齐图片资产落盘：传统路径图片写到 EnhancedPDFProcessor.output_directory
        # （可能为临时目录），需拷贝到 -o 同级 images/ 使 ./images/<filename> 引用可达。
        _copy_image_assets(result, output)
        console.print(f"[green]Output saved to {output}[/green]")
    else:
        console.print(formatted)
