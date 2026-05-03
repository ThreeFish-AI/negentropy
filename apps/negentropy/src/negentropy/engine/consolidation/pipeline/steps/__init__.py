"""内置 ConsolidationStep 实现，导入即注册到 STEP_REGISTRY。

新增自定义 step 时，按 ``fact_extract_step`` 模板编写并放在本目录或第三方包，
import 一次即触发 ``@register("name")`` 装饰器。
"""

from . import (
    auto_link_step,  # noqa: F401
    entity_normalization_step,  # noqa: F401
    fact_extract_step,  # noqa: F401
    summarize_step,  # noqa: F401
)
