"""Utility functions."""

import asyncio
import hashlib
import logging
import os
import re
import uuid
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def generate_paper_id(filename: str, category: str) -> str:
    """生成论文ID.

    Args:
        filename: 文件名
        category: 分类

    Returns:
        论文ID
    """
    # 清理文件名
    safe_filename = sanitize_filename(filename)
    name_without_ext = Path(safe_filename).stem

    # 生成时间戳
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # 生成唯一标识符
    unique_id = str(uuid.uuid4())[:8]

    return f"{category}_{timestamp}_{name_without_ext}_{unique_id}"


def sanitize_filename(filename: str) -> str:
    """清理文件名，移除不安全字符.

    Args:
        filename: 原始文件名

    Returns:
        安全的文件名
    """
    # 移除路径分隔符
    filename = os.path.basename(filename)

    # 替换不安全字符
    filename = re.sub(r'[<>:"/\\|?*]', "_", filename)

    # 限制长度
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[: 255 - len(ext)] + ext

    return filename


def get_file_hash(file_path: str) -> str:
    """计算文件哈希值.

    Args:
        file_path: 文件路径

    Returns:
        文件哈希值
    """
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def format_file_size(size_bytes: int) -> str:
    """格式化文件大小.

    Args:
        size_bytes: 字节数

    Returns:
        格式化的大小字符串
    """
    size = float(size_bytes)  # Convert to float for division
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"


def extract_text_summary(text: str, max_length: int = 200) -> str:
    """提取文本摘要.

    Args:
        text: 原始文本
        max_length: 最大长度

    Returns:
        文本摘要
    """
    if len(text) <= max_length:
        return text

    # 尝试在句子边界截断
    sentences = re.split(r"[.!?]+", text)
    summary = ""

    for sentence in sentences:
        if len(summary + sentence) <= max_length:
            summary += sentence + "."
        else:
            break

    if not summary or len(summary) < max_length * 0.5:
        # 如果摘要太短，直接截断
        summary = text[: max_length - 3] + "..."
    else:
        summary = summary.strip()

    return summary


def validate_pdf_file(file_path: str) -> dict[str, Any]:
    """验证 PDF 文件.

    Args:
        file_path: 文件路径

    Returns:
        验证结果
    """
    result: dict[str, bool | str | int | None] = {
        "valid": False,
        "error": None,
        "size": 0,
        "pages": 0,
    }

    try:
        # 检查文件是否存在
        if not os.path.exists(file_path):
            result["error"] = "File does not exist"
            return result

        # 检查文件扩展名
        if not file_path.lower().endswith(".pdf"):
            result["error"] = "Not a PDF file"
            return result

        # 获取文件大小
        result["size"] = os.path.getsize(file_path)

        # 尝试读取 PDF 文件信息
        try:
            import pypdf2

            with open(file_path, "rb") as f:
                pdf_reader = pypdf2.PdfReader(f)
                result["pages"] = len(pdf_reader.pages)
        except Exception as e:
            logger.warning(f"Could not read PDF info: {str(e)}")
            # 即使无法读取，也可能是有效的 PDF
            pass

        result["valid"] = True

    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Error validating PDF: {str(e)}")

    return result


def get_category_from_path(file_path: str) -> str:
    """从文件路径推断分类.

    Args:
        file_path: 文件路径

    Returns:
        分类名称
    """
    # 定义关键词映射
    category_keywords = {
        "multi-agent": ["multi-agent", "swarm", "collective", "distributed"],
        "llm-agents": ["agent", "llm", "language model", "gpt", "claude"],
        "context-engineering": ["context", "prompt", "retrieval", "rag"],
        "knowledge-graphs": ["knowledge", "graph", "ontology", "semantic"],
        "reasoning": ["reasoning", "inference", "logic", "deduction"],
        "planning": ["planning", "strategy", "goal", "hierarchical"],
    }

    # 从路径中提取
    path_parts = Path(file_path).parts
    path_str = " ".join(path_parts).lower()

    # 检查关键词
    for category, keywords in category_keywords.items():
        for keyword in keywords:
            if keyword in path_str:
                return category

    # 默认分类
    return "general"


def ensure_directory(directory: str) -> Path:
    """确保目录存在.

    Args:
        directory: 目录路径

    Returns:
        Path 对象
    """
    path = Path(directory)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_task_status_color(status: str) -> str:
    """获取任务状态对应的颜色.

    Args:
        status: 任务状态

    Returns:
        颜色代码
    """
    color_map = {
        "pending": "#6c757d",  # gray
        "processing": "#007bff",  # blue
        "completed": "#28a745",  # green
        "failed": "#dc3545",  # red
        "cancelled": "#ffc107",  # yellow
    }
    return color_map.get(status, "#6c757d")


def merge_dicts(*dicts: dict[str, Any]) -> dict[str, Any]:
    """合并多个字典.

    Args:
        *dicts: 要合并的字典

    Returns:
        合并后的字典
    """
    result = {}
    for d in dicts:
        if d:
            result.update(d)
    return result


def flatten_dict(d: dict[str, Any], parent_key: str = "", sep: str = ".") -> dict[str, Any]:
    """扁平化字典.

    Args:
        d: 嵌套字典
        parent_key: 父键名
        sep: 分隔符

    Returns:
        扁平化的字典
    """
    items: list[tuple[str, Any]] = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def retry_on_failure(max_retries: int = 3, delay: float = 1.0) -> Callable[..., Any]:
    """重试装饰器.

    Args:
        max_retries: 最大重试次数
        delay: 重试延迟（秒）
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_error: Exception | None = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < max_retries:
                        logger.warning(f"Attempt {attempt + 1} failed, retrying... Error: {str(e)}")
                        await asyncio.sleep(delay * (2**attempt))  # 指数退避
                    else:
                        logger.error(f"All {max_retries + 1} attempts failed")
            raise last_error if last_error is not None else Exception("Unknown error")

        return wrapper

    return decorator
