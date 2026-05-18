"""无状态文本与 URL 解析工具集。"""

import re
from typing import List, Optional
from urllib.parse import urlparse


def clean_text(text: str) -> str:
    """清洗提取的文本。"""
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", text)
    return text.strip()


def extract_emails(text: str) -> List[str]:
    """从文本中提取电子邮件地址。"""
    email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    return re.findall(email_pattern, text)


def extract_phone_numbers(text: str) -> List[str]:
    """从文本中提取电话号码。"""
    phone_patterns = [
        r"\b\d{3}-\d{3}-\d{4}\b",
        r"\b\(\d{3}\)\s*\d{3}-\d{4}\b",
        r"\b\d{3}\.\d{3}\.\d{4}\b",
        r"\b\d{10}\b",
    ]
    phone_numbers = []
    for pattern in phone_patterns:
        phone_numbers.extend(re.findall(pattern, text))
    return phone_numbers


def is_valid_url(url: str) -> bool:
    """检查 URL 是否有效。"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False


def validate_url(url: str) -> Optional[str]:
    """校验 URL 格式，返回错误信息或 None。"""
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return "Invalid URL format"
    return None


def normalize_url(url: str) -> str:
    """规范化 URL 格式。"""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    return normalized


def extract_domain(url: str) -> str:
    """从 URL 中提取域名。"""
    return urlparse(url).netloc
