"""Pipeline 降级工具函数。

封装 "尝试 Pipeline → 失败则降级" 的通用模式，
供 ops 层的 PDF 和 Markdown 转换操作共用。
"""

import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


async def try_pipeline(
    pipeline_fn: Callable[..., Any],
    *,
    success_check: Callable[[Any], bool],
    **kwargs: Any,
) -> Optional[Any]:
    """尝试 Pipeline 路径，失败时返回 None（降级到传统路径）。

    Args:
        pipeline_fn: Pipeline 执行函数（如 ``run_pdf_pipeline``）
        success_check: 判断 Pipeline 结果是否成功的回调
        **kwargs: 传递给 pipeline_fn 的参数

    Returns:
        Pipeline 成功时返回结果，失败时返回 None
    """
    try:
        result = await pipeline_fn(**kwargs)
        if success_check(result):
            return result
        error_msg = getattr(result, "error", None) or result.get("error", "")
        logger.info("Pipeline 路径失败，降级到传统路径: %s", error_msg)
    except Exception as exc:
        logger.info("Pipeline 路径异常，降级到传统路径: %s", exc)
    return None
