"""共享服务单例与工厂函数。

本模块持有跨层共用的服务实例（WebScraper、MarkdownConverter）和工厂函数
（create_pdf_processor），供 ops / tools / sdk / cli / skills 统一引用。
"""

from typing import Optional

from ..markdown.converter import MarkdownConverter
from ..scraping import WebScraper


# 共享服务实例
web_scraper = WebScraper()
markdown_converter = MarkdownConverter()


def create_pdf_processor(
    enable_enhanced_features: bool = True, output_dir: Optional[str] = None
):
    """获取 PDF 处理器实例，延迟导入以避免启动警告。"""
    from ..pdf import PDFProcessor

    return PDFProcessor(
        enable_enhanced_features=enable_enhanced_features, output_dir=output_dir
    )
