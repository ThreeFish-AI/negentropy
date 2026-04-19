"""
Knowledge 模块常量定义

遵循 AGENTS.md 的 Single Source of Truth 原则，
将散落在代码中的魔法数字集中管理，便于维护和调整。

参考文献:
[1] E. Gamma, R. Helm, R. Johnson, and J. Vlissides, "Design Patterns: Elements of Reusable Object-Oriented Software,"
    Addison-Wesley Professional, 1994.
"""

from __future__ import annotations

# ================================
# 检索相关常量
# ================================

# 混合检索召回倍数
# 用于在混合检索时扩大召回范围，最终按融合分数排序
RECALL_MULTIPLIER = 2

# 默认语义检索权重
DEFAULT_SEMANTIC_WEIGHT = 0.7

# 默认关键词检索权重
DEFAULT_KEYWORD_WEIGHT = 0.3


# ================================
# 分块相关常量
# ================================

# 最小分块大小
MIN_CHUNK_SIZE = 1

# 最大重叠比例（相对于 chunk_size）
MAX_OVERLAP_RATIO = 0.5

# 默认分块大小（与 types.py 中 ChunkingConfig 默认值对齐）
DEFAULT_CHUNK_SIZE = 800

# 默认重叠大小（与 types.py 中 ChunkingConfig 默认值对齐）
DEFAULT_OVERLAP = 100

# 默认递归分隔符（中英混排友好）
DEFAULT_RECURSIVE_SEPARATORS = (
    "\n\n",
    "\n",
    "。",
    "！",
    "？",
    ". ",
    "! ",
    "? ",
    "；",
    ";",
    " ",
    "",
)

# 语义分块默认参数
DEFAULT_SEMANTIC_THRESHOLD = 0.85
DEFAULT_SEMANTIC_BUFFER_SIZE = 1
DEFAULT_SEMANTIC_MIN_CHUNK_SIZE = 50
DEFAULT_SEMANTIC_MAX_CHUNK_SIZE = 2000

# 层次分块默认参数
DEFAULT_HIERARCHICAL_PARENT_CHUNK_SIZE = 1024
DEFAULT_HIERARCHICAL_CHILD_CHUNK_SIZE = 256
DEFAULT_HIERARCHICAL_CHILD_OVERLAP = 51


# ================================
# 性能相关常量
# ================================

# 批量插入的批次大小
BATCH_INSERT_SIZE = 100

# 搜索结果默认返回数量
DEFAULT_SEARCH_LIMIT = 20


# ================================
# 验证相关常量
# ================================

# 元数据字段最大长度
METADATA_FIELD_MAX_LENGTH = 255

# 文本内容最大长度（用于日志预览）
TEXT_PREVIEW_MAX_LENGTH = 100

# 错误信息最大长度
ERROR_MESSAGE_MAX_LENGTH = 500
