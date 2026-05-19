"""PDF 源解析与临时文件管理。"""

import logging
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import aiohttp

logger = logging.getLogger(__name__)


def is_pdf_url(source: str) -> bool:
    """判断给定源是否为 http/https URL。"""
    try:
        parsed = urlparse(source)
        return parsed.scheme in ["http", "https"]
    except Exception:
        return False


async def download_pdf_to_temp(url: str, temp_dir: str) -> Path | None:
    """下载 PDF 到指定临时目录。"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    return None

                temp_file = tempfile.NamedTemporaryFile(
                    suffix=".pdf",
                    dir=temp_dir,
                    delete=False,
                )
                temp_file.write(await response.read())
                temp_file.close()
                return Path(temp_file.name)
    except Exception as e:
        logger.error("Error downloading PDF from %s: %s", url, e)
        return None
