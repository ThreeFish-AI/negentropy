"""PDF reading and conversion to Markdown skill.

Extracts text, metadata, and tables from PDF files (local or remote),
returning structured Markdown content with associated statistics.
"""

import logging
import os
from pathlib import Path
from typing import Any

import httpx
import pdfplumber

logger = logging.getLogger(__name__)


class PDFProcessingError(Exception):
    """Custom exception for PDF processing errors."""


def _convert_table_to_markdown(table: list[list[str]]) -> str:
    """Convert a 2D list representing a table into a Markdown table.

    Rows of unequal length are right-padded with empty strings so every
    column is aligned to the widest content in that column.

    Args:
        table: 2D list of cell values (strings or ``None``).

    Returns:
        A Markdown-formatted table string, or an empty string when *table*
        is falsy.
    """
    if not table:
        return ""

    # Normalise cells to strings
    cleaned: list[list[str]] = []
    for row in table:
        cleaned.append([str(cell) if cell is not None else "" for cell in row])

    # Determine column count from the widest row
    max_cols = max(len(row) for row in cleaned)

    # Pad every row to the same width
    for row in cleaned:
        while len(row) < max_cols:
            row.append("")

    # Compute per-column widths
    col_widths = [
        max(len(row[col]) for row in cleaned)
        for col in range(max_cols)
    ]

    # Header row
    header_cells = [
        cleaned[0][col].ljust(col_widths[col])
        for col in range(max_cols)
    ]
    lines: list[str] = [f"| {' | '.join(header_cells)} |"]

    # Separator row
    sep_cells = ["-" * col_widths[col] for col in range(max_cols)]
    lines.append(f"| {' | '.join(sep_cells)} |")

    # Data rows
    for row in cleaned[1:]:
        data_cells = [
            row[col].ljust(col_widths[col])
            for col in range(max_cols)
        ]
        lines.append(f"| {' | '.join(data_cells)} |")

    return "\n".join(lines)


async def handle_pdf_reader(params: dict[str, Any]) -> dict[str, Any]:
    """Read a PDF and convert its content to Markdown.

    The function accepts multiple parameter names for the source path so it
    can be driven by varying caller conventions:

    - ``file_path``, ``url``, ``pdf_path``, or ``pdf_source``

    When the value is an HTTP(S) URL the file is downloaded to a temporary
    location first and cleaned up after processing.

    Args:
        params: Dictionary with at least a file-path or URL key.  Optional
            keys: ``extract_tables`` (bool, default ``True``),
            ``page_range`` (``[start, end)`` 0-indexed).

    Returns:
        A result dictionary containing ``success``, ``data``, ``metadata``,
        ``assets``, and ``statistics`` keys on success, or ``success``,
        ``error``, and ``error_type`` on failure.
    """
    file_path = (
        params.get("file_path")
        or params.get("url")
        or params.get("pdf_path")
        or params.get("pdf_source")
    )
    if not file_path:
        return {
            "success": False,
            "error": "No file_path, url, or pdf_source provided",
            "error_type": "ValueError",
        }

    # --- Download remote PDFs to a temp file ----------------------------
    cleanup_temp = False
    if file_path.startswith(("http://", "https://")):
        async with httpx.AsyncClient() as client:
            response = await client.get(file_path)
            response.raise_for_status()
            temp_path = Path("/tmp") / f"temp_{os.getpid()}.pdf"
            temp_path.write_bytes(response.content)
            file_path = str(temp_path)
            cleanup_temp = True
    elif not os.path.isabs(file_path):
        file_path = os.path.abspath(file_path)

    # --- Extract content ------------------------------------------------
    try:
        content_parts: list[str] = []
        metadata: dict[str, str] = {}
        assets: dict[str, Any] = {"images": [], "tables": 0, "formulas": 0}
        total_words = 0

        with pdfplumber.open(file_path) as pdf:
            # Metadata
            if hasattr(pdf, "metadata") and pdf.metadata:
                metadata = {
                    "title": pdf.metadata.get("Title", ""),
                    "author": pdf.metadata.get("Author", ""),
                    "creator": pdf.metadata.get("Creator", ""),
                    "producer": pdf.metadata.get("Producer", ""),
                    "creation_date": str(pdf.metadata.get("CreationDate", "")),
                    "modification_date": str(pdf.metadata.get("ModDate", "")),
                }

            # Page range (0-indexed, end-exclusive)
            page_range = params.get("page_range")
            if page_range and len(page_range) >= 2:
                start_page = max(0, int(page_range[0]))
                end_page = min(len(pdf.pages), int(page_range[1]))
                pages_to_process = pdf.pages[start_page:end_page]
            else:
                start_page = 0
                end_page = len(pdf.pages)
                pages_to_process = pdf.pages

            for i, page in enumerate(pages_to_process):
                page_num = start_page + i + 1
                text = page.extract_text() or ""

                content_parts.append(f"\n\n## Page {page_num}\n\n")

                if text.strip():
                    content_parts.append(text)
                    total_words += len(text.split())

                # Tables
                if params.get("extract_tables", True):
                    tables = page.extract_tables()
                    for table in tables:
                        if table:
                            assets["tables"] += 1
                            clean_table = [
                                [str(cell) if cell is not None else "" for cell in row]
                                for row in table
                            ]
                            content_parts.append(f"\n\n{_convert_table_to_markdown(clean_table)}\n")

        # Assemble final Markdown
        full_content = "\n".join(content_parts)

        if metadata:
            metadata_header = "\n## Document Metadata\n\n"
            for key, value in metadata.items():
                if value:
                    metadata_header += f"- **{key.title()}**: {value}\n"
            full_content = metadata_header + "\n" + full_content

        page_count = end_page - start_page

        return {
            "success": True,
            "data": {
                "content": full_content,
                "markdown": full_content,
                "metadata": metadata,
                "images": assets.get("images", []),
                "tables": [f"Table {i + 1}" for i in range(int(assets.get("tables", 0)))],
                "formulas": [f"Formula {i + 1}" for i in range(int(assets.get("formulas", 0)))],
                "page_count": page_count,
            },
            "metadata": {
                **metadata,
                "page_count": page_count,
                "total_words": total_words,
            },
            "assets": assets,
            "statistics": {
                "total_words": total_words,
                "total_paragraphs": len([p for p in full_content.split("\n\n") if p.strip()]),
                "processing_time": "N/A",
            },
        }

    except PDFProcessingError:
        if cleanup_temp and os.path.exists(file_path):
            os.unlink(file_path)
        raise
    except Exception as e:
        if cleanup_temp and os.path.exists(file_path):
            os.unlink(file_path)
        if "PDF" in str(e) or "pdfplumber" in str(type(e).__name__) or "parsing" in str(e).lower():
            return {
                "success": False,
                "error": str(e),
                "error_type": "PDFProcessingError",
            }
        raise
