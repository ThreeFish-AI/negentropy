"""WebPage Pipeline 各 Stage 的具体实现。

本子包包含网页处理管线中各个 Stage 的具体工具实现：

- S1: 合规检查（robots.txt + URL 校验）
- S2: 网页获取（HTTP / Playwright / Selenium 三级降级链）
- S3: 反检测降级（Playwright Stealth / undetected-chromedriver）
- S4: 主内容区域识别（trafilatura / readability / BeautifulSoup 竞争）
- S5: HTML 清洗与预处理（BeautifulSoup）
- S6-S9: 并行富元素提取（数学公式 / 代码块 / 表格 / 图片）
- S10: Markdown 转换（MarkItDown / html2text 竞争）
- S11: Markdown 排版与格式化
- S12: 资源打包与元数据聚合

导入本包时会自动触发所有 Stage 工具的注册（通过 ``@register_tool``
装饰器注册到 ``pipeline.registry`` 全局注册表）。
"""

# 导入所有 Stage 模块以触发 @register_tool 装饰器的执行
from . import (  # noqa: F401
    anti_detection,
    asset_bundling,
    compliance_check,
    html_sanitization,
    main_content_extraction,
    markdown_conversion,
    markdown_formatting,
    page_fetching,
    rich_elements,
)

# 暴露各 Stage 的 STAGE_ID/STAGE_NAME/TOOLS 映射以供编排器查询
from .anti_detection import (
    STAGE_ID as ANTI_DETECTION_STAGE_ID,
    STAGE_NAME as ANTI_DETECTION_STAGE_NAME,
    TOOLS as ANTI_DETECTION_TOOLS,
)
from .asset_bundling import (
    STAGE_ID as ASSET_BUNDLING_STAGE_ID,
    STAGE_NAME as ASSET_BUNDLING_STAGE_NAME,
    TOOLS as ASSET_BUNDLING_TOOLS,
)
from .compliance_check import (
    STAGE_ID as COMPLIANCE_CHECK_STAGE_ID,
    STAGE_NAME as COMPLIANCE_CHECK_STAGE_NAME,
    TOOLS as COMPLIANCE_CHECK_TOOLS,
)
from .html_sanitization import (
    STAGE_ID as HTML_SANITIZATION_STAGE_ID,
    STAGE_NAME as HTML_SANITIZATION_STAGE_NAME,
    TOOLS as HTML_SANITIZATION_TOOLS,
)
from .main_content_extraction import (
    STAGE_ID as MAIN_CONTENT_EXTRACTION_STAGE_ID,
    STAGE_NAME as MAIN_CONTENT_EXTRACTION_STAGE_NAME,
    TOOLS as MAIN_CONTENT_EXTRACTION_TOOLS,
)
from .markdown_conversion import (
    STAGE_ID as MARKDOWN_CONVERSION_STAGE_ID,
    STAGE_NAME as MARKDOWN_CONVERSION_STAGE_NAME,
    TOOLS as MARKDOWN_CONVERSION_TOOLS,
)
from .markdown_formatting import (
    STAGE_ID as MARKDOWN_FORMATTING_STAGE_ID,
    STAGE_NAME as MARKDOWN_FORMATTING_STAGE_NAME,
    TOOLS as MARKDOWN_FORMATTING_TOOLS,
)
from .page_fetching import (
    STAGE_ID as PAGE_FETCHING_STAGE_ID,
    STAGE_NAME as PAGE_FETCHING_STAGE_NAME,
    TOOLS as PAGE_FETCHING_TOOLS,
)
from .rich_elements import (
    STAGE_ID as RICH_ELEMENTS_STAGE_ID,
    STAGE_NAME as RICH_ELEMENTS_STAGE_NAME,
    TOOLS as RICH_ELEMENTS_TOOLS,
    extract_all_rich_elements,
)

# 有序 Stage 列表（按执行顺序）
WEBPAGE_STAGES = [
    {
        "id": COMPLIANCE_CHECK_STAGE_ID,
        "name": COMPLIANCE_CHECK_STAGE_NAME,
        "tools": COMPLIANCE_CHECK_TOOLS,
    },
    {
        "id": PAGE_FETCHING_STAGE_ID,
        "name": PAGE_FETCHING_STAGE_NAME,
        "tools": PAGE_FETCHING_TOOLS,
    },
    {
        "id": ANTI_DETECTION_STAGE_ID,
        "name": ANTI_DETECTION_STAGE_NAME,
        "tools": ANTI_DETECTION_TOOLS,
    },
    {
        "id": MAIN_CONTENT_EXTRACTION_STAGE_ID,
        "name": MAIN_CONTENT_EXTRACTION_STAGE_NAME,
        "tools": MAIN_CONTENT_EXTRACTION_TOOLS,
    },
    {
        "id": HTML_SANITIZATION_STAGE_ID,
        "name": HTML_SANITIZATION_STAGE_NAME,
        "tools": HTML_SANITIZATION_TOOLS,
    },
    {
        "id": RICH_ELEMENTS_STAGE_ID,
        "name": RICH_ELEMENTS_STAGE_NAME,
        "tools": RICH_ELEMENTS_TOOLS,
    },
    {
        "id": MARKDOWN_CONVERSION_STAGE_ID,
        "name": MARKDOWN_CONVERSION_STAGE_NAME,
        "tools": MARKDOWN_CONVERSION_TOOLS,
    },
    {
        "id": MARKDOWN_FORMATTING_STAGE_ID,
        "name": MARKDOWN_FORMATTING_STAGE_NAME,
        "tools": MARKDOWN_FORMATTING_TOOLS,
    },
    {
        "id": ASSET_BUNDLING_STAGE_ID,
        "name": ASSET_BUNDLING_STAGE_NAME,
        "tools": ASSET_BUNDLING_TOOLS,
    },
]

__all__ = [
    # Stage 模块
    "compliance_check",
    "page_fetching",
    "anti_detection",
    "main_content_extraction",
    "html_sanitization",
    "rich_elements",
    "markdown_conversion",
    "markdown_formatting",
    "asset_bundling",
    # 辅助函数
    "extract_all_rich_elements",
    # Stage 列表
    "WEBPAGE_STAGES",
]
