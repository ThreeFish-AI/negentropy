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
    """将抽取的图片资产统一兜底拷贝到 markdown 输出目录的 ``images/`` 子目录。

    从 result 的所有已知图片来源收集图片实体，拷贝到 ``-o`` 同级 ``images/``，
    使 markdown 中 ``./images/<filename>`` 引用可达。覆盖四类来源：

    1. 传统 ``EnhancedPDFProcessor.output_directory``（上层未透传 ``output_dir`` 时
       即 ``tempfile.mkdtemp('enhanced_pdf_*')`` 临时目录）。
    2. auto/processor 路径 ``enhanced_assets["images"]["items"][].local_path``——
       其图片实体由 image_extraction stage 写入 ``tempfile.mkdtemp('pdf_images_')``
       临时目录；mineru 失败回退等场景下 ``output_directory`` 缺失，此前 CLI 直接
       no-op，导致候选 ``./images/*`` 全部死链。
    3. image_extraction stage 临时目录（若透传到 ``enhanced_assets["_temp_output_dir"]``）。
    4. ``PDFResponse.image_assets``（auto pipeline 路径），目标文件名取
       ``asset.filename`` 以对齐 markdown 引用（详见来源 4 处注释）。

    任一来源命中即拷贝；单图拷贝失败不中断整体落盘。
    """
    import shutil
    from pathlib import Path

    ea = getattr(result, "enhanced_assets", None) or {}
    image_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}
    images_dst = Path(output).resolve().parent / "images"

    # (源路径, 目标文件名) 二元组：来源 1–3 目标名沿用 basename，来源 4 用
    # asset.filename（见来源 4 注释）。
    src_files: list = []
    seen: set = set()

    def _add_file(p, dest_name: Optional[str] = None) -> None:
        if not p:
            return
        path = Path(str(p))
        if (
            path.is_file()
            and path.suffix.lower() in image_exts
            and str(path) not in seen
        ):
            seen.add(str(path))
            src_files.append((path, dest_name or path.name))

    def _add_dir(d) -> None:
        if not d:
            return
        path = Path(str(d))
        if path.is_dir():
            for p in path.iterdir():
                if p.is_file() and p.suffix.lower() in image_exts:
                    _add_file(p)

    # 来源 1：传统 EnhancedPDFProcessor.output_directory
    _add_dir(ea.get("output_directory"))

    # 来源 2：auto/processor 路径 enhanced_assets["images"]（dict 或 list）
    images_meta = ea.get("images")
    if isinstance(images_meta, dict):
        items = images_meta.get("items") or images_meta.get("files") or []
    elif isinstance(images_meta, (list, tuple)):
        items = images_meta
    else:
        items = []
    for it in items:
        if isinstance(it, dict):
            _add_file(it.get("local_path"))
        else:
            _add_file(getattr(it, "local_path", None))

    # 来源 3：image_extraction stage 临时目录（若已透传到 enhanced_assets）
    _add_dir(ea.get("_temp_output_dir"))

    # 来源 4：PDFResponse.image_assets（ImageAssetModel 列表，auto pipeline 路径）。
    # enhanced_assets 在 auto 路径仅含 images_extracted 计数，图片实体路径在本字段。
    # 目标文件名须取 asset.filename 而非 basename(image_path)：markdown 引用由
    # image_ref_normalizer 按 filename 生成 ./images/<filename>；且 auto_batch 跨切片
    # 去重重命名（batch_merge._rename_asset_on_disk）冲突/失败时 filename 会与
    # basename(image_path) 背离，用 basename 复制将致 ./images/* 死链。
    image_assets_field = getattr(result, "image_assets", None) or []
    sample_paths = []
    if isinstance(image_assets_field, (list, tuple)):
        for it in image_assets_field:
            p = getattr(it, "image_path", None) or getattr(it, "local_path", None)
            fname = getattr(it, "filename", None)
            sample_paths.append(p)
            _add_file(p, fname)

    if not src_files:
        console.print(
            "[yellow]图片资产落盘：未发现任何图片源"
            f"（enhanced_assets keys={list(ea.keys())},"
            f" image_assets={len(image_assets_field)},"
            f" sample_paths={sample_paths[:3]}）"
            "——候选 ./images/* 引用可能死链[/yellow]"
        )
        return

    images_dst.mkdir(parents=True, exist_ok=True)
    copied = 0
    for src, dest_name in src_files:
        try:
            shutil.copy2(src, images_dst / dest_name)
            copied += 1
        except OSError:
            # 单图拷贝失败不应中断整体输出落盘（如只读源/目标磁盘满/自拷贝
            # SameFileError，其为 OSError 子类）。
            pass
    console.print(f"[dim]图片资产落盘：{copied}/{len(src_files)} -> {images_dst}[/dim]")


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

        Path(output).write_text(formatted, encoding="utf-8")
        # 补齐图片资产落盘：传统路径图片写到 EnhancedPDFProcessor.output_directory
        # （可能为临时目录），需拷贝到 -o 同级 images/ 使 ./images/<filename> 引用可达。
        _copy_image_assets(result, output)
        console.print(f"[green]Output saved to {output}[/green]")
    else:
        console.print(formatted)
