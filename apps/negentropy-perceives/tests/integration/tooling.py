"""集成测试共享工具与参数 helper。"""

from negentropy.perceives.tools import app


DEFAULT_PDF_TOOL_KWARGS = {
    "method": "auto",
    "include_metadata": True,
    "page_range": None,
    "output_format": "markdown",
    "extract_images": True,
    "extract_tables": True,
    "extract_formulas": True,
    "embed_images": False,
    "enhanced_options": None,
}


async def get_tool_map() -> dict[str, object]:
    """返回 MCP 工具名称到工具对象的映射。"""
    return {tool.name: tool for tool in await app.list_tools()}


def select_tools(tool_map: dict[str, object], *tool_names: str) -> dict[str, object]:
    """从完整工具映射中选择指定工具。"""
    return {tool_name: tool_map[tool_name] for tool_name in tool_names}


def build_pdf_tool_kwargs(**overrides) -> dict[str, object]:
    """构造 PDF 工具调用参数。"""
    return {**DEFAULT_PDF_TOOL_KWARGS, **overrides}
