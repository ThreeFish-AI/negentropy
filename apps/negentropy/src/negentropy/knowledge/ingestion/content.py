from __future__ import annotations

import re

from negentropy.logging import get_logger

logger = get_logger("negentropy.knowledge.content")


def sanitize_filename(filename: str | None) -> str:
    """清理文件名，防止路径遍历和注入攻击

    Args:
        filename: 原始文件名

    Returns:
        清理后的安全文件名
    """
    if not filename:
        return "unknown"

    # 移除路径分隔符，只保留文件名
    name = filename.split("/")[-1].split("\\")[-1]

    # 只保留安全字符（字母、数字、中文、下划线、点、短横线）
    name = re.sub(r"[^\w\u4e00-\u9fff\-.]", "_", name)

    # 限制长度
    return name[:255] if len(name) > 255 else name or "unknown"


# ============================================================================
# File Content Extraction (文件内容提取)
# ============================================================================


async def extract_file_content(
    content: bytes,
    filename: str,
    content_type: str | None = None,
) -> str:
    """从文本/Markdown 文件中提取内容。

    PDF 文件需通过 MCP Tool（extract_source）提取，不在此函数处理。

    支持格式:
    - text/plain (.txt)
    - text/markdown (.md, .markdown)

    Args:
        content: 文件二进制内容
        filename: 原始文件名
        content_type: MIME 类型（可选）

    Returns:
        提取的纯文本内容

    Raises:
        ValueError: 不支持的文件类型或解析失败
    """
    logger.info(
        "extract_file_started",
        filename=filename,
        content_type=content_type,
        size=len(content),
    )

    # 根据文件扩展名判断类型
    ext = filename.lower().split(".")[-1] if "." in filename else ""

    if ext in ("txt", "md", "markdown"):
        text = _extract_text_file(content)
    else:
        raise ValueError(
            f"Unsupported file type for local extraction: {ext or content_type or 'unknown'}. "
            "PDF files should be extracted via MCP Tool (extract_source)."
        )

    logger.info(
        "extract_file_completed",
        filename=filename,
        text_length=len(text),
    )

    return text


def optimize_markdown_content(markdown: str) -> str:
    """对 Markdown 内容做轻量优化，提升可读性与稳定性。"""
    # 统一换行符并裁剪每行右侧空白
    normalized = markdown.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in normalized.split("\n")]

    # 压缩多余空行，最多保留一个空白行（段间留白）
    compact_lines: list[str] = []
    blank_count = 0
    for line in lines:
        if not line.strip():
            blank_count += 1
            if blank_count <= 1:
                compact_lines.append("")
            continue
        blank_count = 0
        compact_lines.append(line)

    return "\n".join(compact_lines).strip()


def _extract_text_file(content: bytes) -> str:
    """提取文本文件内容

    自动检测编码 (UTF-8, GBK, Latin-1)
    """
    # 尝试 UTF-8
    try:
        return content.decode("utf-8").strip()
    except UnicodeDecodeError:
        pass

    # 尝试 GBK (中文 Windows 常见)
    try:
        return content.decode("gbk").strip()
    except UnicodeDecodeError:
        pass

    # 尝试 Latin-1 (通用回退)
    try:
        return content.decode("latin-1").strip()
    except UnicodeDecodeError as exc:
        logger.error("text_file_decode_failed", error=str(exc))
        raise ValueError(f"Failed to decode text file: {exc}") from exc
