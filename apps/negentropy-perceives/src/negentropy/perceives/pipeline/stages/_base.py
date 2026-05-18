"""Pipeline 工具基类，消除各 Stage 工具实现中的重复样板代码。

提供统一泛型基类 ``ToolBase`` 及两个便捷别名：
- ``PDFToolBase``: PDF Pipeline 工具基类（输入类型 Any）
- ``WebToolBase``: WebPage Pipeline 工具基类（输入类型 StageContext）

子类只需设置 ``tool_name`` 类属性并实现 ``_run()`` 方法。
如需自定义可用性检查，覆写 ``is_available()``。
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING, Any, Generic, TypeVar

from ..base import StageResult

if TYPE_CHECKING:
    from ..models import StageContext  # noqa: F401 – 用于静态类型检查

logger = logging.getLogger(__name__)

TInput = TypeVar("TInput")


class ToolBase(Generic[TInput]):
    """Pipeline 工具泛型基类。

    子类需设置 ``tool_name`` 类属性并实现 ``_run()`` 方法。
    如需自定义可用性检查，覆写 ``is_available()``。

    类属性 ``_pass_input_on_error`` 控制异常时是否在 StageResult 中
    回传原始输入（WebPage Pipeline 需要此行为以保持上下文可继续传递）。
    """

    tool_name: str = ""
    _pass_input_on_error: bool = False

    @property
    def name(self) -> str:
        return self.tool_name

    def is_available(self) -> bool:
        return True

    async def execute(self, input_data: TInput) -> StageResult:
        start = time.monotonic()
        try:
            result = await self._run(input_data)
        except Exception as e:
            logger.warning("%s 执行失败: %s", self.tool_name, e)
            result = StageResult(
                success=False,
                output=input_data if self._pass_input_on_error else None,
                error=str(e),
                engine_used=self.tool_name,
            )
        result.elapsed_ms = (time.monotonic() - start) * 1000
        return result

    async def _run(self, input_data: TInput) -> StageResult:
        raise NotImplementedError


# ── 向后兼容的类型别名 ──────────────────────────────────────

PDFToolBase = ToolBase[Any]
"""PDF Pipeline 工具基类（输入类型 Any）。"""


class WebToolBase(ToolBase["StageContext"]):
    """WebPage Pipeline 工具基类（输入类型 StageContext）。

    异常时自动在 StageResult 中回传原始上下文对象，
    以便后续 Stage 可继续操作。
    """

    _pass_input_on_error: bool = True
