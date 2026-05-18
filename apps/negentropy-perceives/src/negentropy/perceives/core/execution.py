"""统一操作执行守卫。

封装 ops/ 层共用的操作模式：pipeline 上下文绑定、超时控制、取消处理、异常转换。
消除 parse_pdf_to_markdown / parse_webpage_to_markdown 等函数中重复的
try/except/finally 样板代码。
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Awaitable, Callable, Literal, Optional, TypeVar

from ..config import settings
from .cancellation import bind_cancel_scope
from .task_context import bind_pipeline, pipeline_var
from .types import elapsed_ms

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class OperationError:
    """操作执行期间的错误上下文，供调用方构建类型化的错误响应。"""

    kind: Literal["timeout", "cancelled", "exception"]
    message: str
    elapsed_seconds: float
    timeout_seconds: int


async def run_operation(
    pipeline_name: str,
    fn: Callable[[], Awaitable[T]],
    *,
    timeout: Optional[int] = None,
    error_fn: Callable[[OperationError], T],
) -> T:
    """执行带统一守卫的异步操作。

    封装以下横切关注点：
    1. pipeline 上下文绑定 / 释放
    2. 超时解析（timeout 参数 → settings.task_timeout_seconds 兜底）
    3. Cancel scope 绑定
    4. 三类异常（Timeout / Cancel / Exception）到 OperationError 的转换
    5. 调用方通过 error_fn 将 OperationError 映射为类型化的错误响应

    Args:
        pipeline_name: pipeline 上下文名称（"pdf" 或 "webpage"）
        fn: 无参异步函数，包含实际业务逻辑
        timeout: 可选超时覆盖（默认取 settings.task_timeout_seconds）
        error_fn: 错误响应构建器，接收 OperationError 返回类型化响应
    """
    _start = time.time()
    effective_timeout = timeout or settings.task_timeout_seconds
    pipeline_tok = bind_pipeline(pipeline_name)
    try:
        try:
            async with bind_cancel_scope(timeout=effective_timeout):
                return await fn()
        except asyncio.TimeoutError:
            logger.error("任务超时（%ds）pipeline=%s", effective_timeout, pipeline_name)
            return error_fn(
                OperationError(
                    kind="timeout",
                    message=f"任务超时：超过 {effective_timeout} 秒仍未完成，已中止",
                    elapsed_seconds=float(effective_timeout),
                    timeout_seconds=effective_timeout,
                )
            )
        except asyncio.CancelledError:
            elapsed = elapsed_ms(_start) / 1000.0
            logger.warning(
                "任务已取消 pipeline=%s elapsed=%.2fs", pipeline_name, elapsed
            )
            return error_fn(
                OperationError(
                    kind="cancelled",
                    message="任务已取消：客户端主动取消或上游中断，已释放资源",
                    elapsed_seconds=elapsed,
                    timeout_seconds=effective_timeout,
                )
            )
        except Exception as e:
            elapsed = elapsed_ms(_start) / 1000.0
            logger.error("操作异常 pipeline=%s: %s", pipeline_name, str(e))
            return error_fn(
                OperationError(
                    kind="exception",
                    message=str(e),
                    elapsed_seconds=elapsed,
                    timeout_seconds=effective_timeout,
                )
            )
    finally:
        pipeline_var.reset(pipeline_tok)
