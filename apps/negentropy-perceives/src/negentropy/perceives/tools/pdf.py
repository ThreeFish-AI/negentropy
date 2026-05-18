"""MCP 工具: PDF 解析为 Markdown。"""

from typing import Annotated, Any, Dict, List, Optional

from pydantic import Field

from ..ops.pdf import parse_pdf_to_markdown as _parse_pdf
from ..ops.pdf import parse_pdfs_to_markdown as _parse_pdfs
from ..models import BatchPDFResponse, PDFResponse
from ._image_resources import (
    register_batch_pdf_response_images,
    register_pdf_response_images,
)
from ._registry import PDFMethod, PDFOutputFormat, app


@app.tool()
async def parse_pdf_to_markdown(
    pdf_source: Annotated[
        str,
        Field(
            ...,
            description="""PDF 源路径，支持 HTTP/HTTPS URL 或本地文件绝对路径。
                URL 将自动下载处理，本地路径需确保文件存在。
                URL示例："https://example.com/document.pdf"
                本地路径示例："/path/to/document.pdf""",
        ),
    ],
    method: Annotated[
        PDFMethod,
        Field(
            default="auto",
            description="""PDF 提取方法：
                "auto"（自动选择最佳引擎，优先 Docling）、
                "smart"（LLM 编排多引擎并行处理 + 择优融合，最高质量，需配置 LLM API Key）、
                "docling"（Docling 引擎，AI 布局分析 + TableFormer 表格 + 代码检测，适合复杂文档）、
                "mineru"（MinerU 引擎，基于深度学习的文档结构分析，擅长学术论文与多栏排版，支持公式与表格提取）、
                "marker"（Marker 引擎，基于 Nougat 模型，擅长学术文档转换，保留公式与结构化排版）、
                "pymupdf"（PyMuPDF引擎，快速处理）、
                "pypdf"（PyPDF引擎，适合简单文本）""",
        ),
    ],
    include_metadata: Annotated[
        bool,
        Field(
            default=True,
            description="是否在结果中包含 PDF 元数据（标题、作者、创建日期、页数等）和处理统计信息",
        ),
    ],
    page_range: Annotated[
        Optional[List[int]],
        Field(
            default=None,
            description="""页面范围 [start, end] 用于部分提取，两个整数表示起始页和结束页。
                示例：[1, 10]提取第 1-10页。页码从 0 开始计数""",
        ),
    ],
    output_format: Annotated[
        PDFOutputFormat,
        Field(
            default="markdown",
            description="""输出格式选择：
                "markdown"（结构化Markdown文档，保留格式信息）、
                "text"（纯文本内容，去除所有格式）""",
        ),
    ],
    extract_images: Annotated[
        bool,
        Field(default=True, description="是否从 PDF 中提取图像"),
    ] = True,
    extract_tables: Annotated[
        bool,
        Field(default=True, description="是否从 PDF 中提取表格"),
    ] = True,
    extract_formulas: Annotated[
        bool,
        Field(default=True, description="是否从 PDF 中提取数学公式"),
    ] = True,
    embed_images: Annotated[
        bool,
        Field(default=False, description="是否将图像以 base64 嵌入 Markdown"),
    ] = False,
    enhanced_options: Annotated[
        Optional[Dict[str, Any]],
        Field(
            default=None,
            description="""增强处理选项配置。
                示例：{"output_dir": "/path/to/output", "image_size": [800, 600]}""",
        ),
    ] = None,
    timeout: Annotated[
        Optional[int],
        Field(
            default=None,
            ge=1,
            description="任务级超时秒数。为空则使用配置 task_timeout_seconds（默认 300s / 5 min），超时后优雅返回错误并取消子任务。",
        ),
    ] = None,
) -> PDFResponse:
    """
    Parse a PDF document into structured Markdown.

    This tool extracts content from PDF files (URLs or local paths) and converts
    to Markdown with multi-engine degradation support.

    Capabilities:
    - Multi-engine support with automatic degradation chain
    - Image, table, and formula extraction
    - Page range selection for partial extraction
    - LLM-orchestrated multi-engine fusion (smart mode)
    - Task-level timeout with graceful cancellation

    Returns:
        PDFResponse with parsed content, metadata, and asset statistics.
    """
    response = await _parse_pdf(
        pdf_source=pdf_source,
        method=method,
        include_metadata=include_metadata,
        page_range=page_range,
        output_format=output_format,
        extract_images=extract_images,
        extract_tables=extract_tables,
        extract_formulas=extract_formulas,
        embed_images=embed_images,
        enhanced_options=enhanced_options,
        timeout=timeout,
    )
    return register_pdf_response_images(response)


@app.tool()
async def parse_pdfs_to_markdown(
    pdf_sources: Annotated[
        List[str],
        Field(
            ...,
            description="""PDF 源列表，支持混合使用 URL 和本地文件路径。URL 将并发下载，本地文件需确保存在且可读。
                示例：[
                    "https://example.com/doc1.pdf",
                    "/path/to/doc2.pdf",
                    "https://example.com/doc3.pdf"
                ]""",
        ),
    ],
    method: Annotated[
        PDFMethod,
        Field(
            description="""统一的PDF提取方法：
                "auto"（智能选择最佳引擎）、
                "smart"（LLM 编排多引擎并行处理 + 择优融合，需配置 LLM API Key）、
                "docling"（AI 布局分析 + TableFormer 表格，适合复杂文档）、
                "mineru"（基于深度学习的文档结构分析，擅长学术论文与多栏排版）、
                "marker"（基于 Nougat 模型，擅长学术文档转换，保留公式与结构化排版）、
                "pymupdf"（适合复杂排版和图表）、
                "pypdf"（适合简单纯文本文档）""",
        ),
    ] = "auto",
    include_metadata: Annotated[
        bool,
        Field(
            description="是否在每个转换结果中包含PDF元数据和处理统计，包括文件名、大小、页数、处理时间等",
        ),
    ] = True,
    page_range: Annotated[
        Optional[List[int]],
        Field(
            description="""应用于所有PDF的统一页面范围 [start, end]。如未指定则提取全部页面。页码从 0 开始计数。
                示例：[0, 5] 为所有PDF提取前 5 页""",
        ),
    ] = None,
    output_format: Annotated[
        PDFOutputFormat,
        Field(
            description="""统一输出格式：
                "markdown"（保留标题、列表等结构化信息）、
                "text"（纯文本，去除所有格式化）""",
        ),
    ] = "markdown",
    extract_images: Annotated[
        bool,
        Field(
            description="是否从PDF中提取图像并保存为本地文件，在Markdown文档中引用",
        ),
    ] = True,
    extract_tables: Annotated[
        bool,
        Field(
            description="是否从PDF中提取表格并转换为Markdown表格格式",
        ),
    ] = True,
    extract_formulas: Annotated[
        bool,
        Field(
            description="是否从PDF中提取数学公式并保持LaTeX格式",
        ),
    ] = True,
    embed_images: Annotated[
        bool,
        Field(
            description="是否将提取的图像以base64格式嵌入到Markdown文档中（而非引用本地文件）",
        ),
    ] = False,
    enhanced_options: Annotated[
        Optional[Dict[str, Any]],
        Field(
            description="""统一的增强处理选项，应用于所有URL。
                示例：{"image_size": [800, 600]}""",
        ),
    ] = None,
    timeout: Annotated[
        Optional[int],
        Field(
            default=None,
            ge=1,
            description="整批任务级超时秒数（整批共用）。为空则使用配置 task_timeout_seconds（默认 300s / 5 min）。",
        ),
    ] = None,
) -> BatchPDFResponse:
    """
    Parse multiple PDF documents into Markdown format concurrently.

    This tool provides batch processing for converting multiple PDFs to Markdown.
    It processes all PDFs concurrently for better performance.

    Capabilities:
    - Concurrent processing of multiple PDFs
    - Support for both URLs and local file paths
    - Consistent extraction settings across all PDFs
    - Detailed summary statistics
    - Batch-level timeout with graceful cancellation

    Returns:
        BatchPDFResponse with batch results and comprehensive statistics.
    """
    response = await _parse_pdfs(
        pdf_sources=pdf_sources,
        method=method,
        include_metadata=include_metadata,
        page_range=page_range,
        output_format=output_format,
        extract_images=extract_images,
        extract_tables=extract_tables,
        extract_formulas=extract_formulas,
        embed_images=embed_images,
        enhanced_options=enhanced_options,
        timeout=timeout,
    )
    return register_batch_pdf_response_images(response)
