"""Definition Registry 适配器层。

按 ``kind`` 挂薄适配器（校验器 / 元信息提取器 / 物化器 / 工厂），供
``interface.definitions_api`` 与各 loader 复用。核心入口见 ``registry``。
"""

from .registry import (
    DefinitionParseError,
    compute_checksum,
    parse_definition,
    parse_frontmatter,
    register_meta_extractor,
    register_validator,
)

__all__ = [
    "DefinitionParseError",
    "compute_checksum",
    "parse_definition",
    "parse_frontmatter",
    "register_meta_extractor",
    "register_validator",
]
