"""Pipeline Stage 基类与协议定义。

本模块定义了 Pipeline 框架的核心抽象：

- ``StageResult``: Stage 执行结果的统一包装
- ``Stage``: Stage 基类，定义统一的执行接口
- ``StageTool``: Stage 工具协议（鸭子类型接口）
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Generic, Optional, Protocol, TypeVar, runtime_checkable

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")


@dataclass
class StageResult(Generic[TOutput]):
    """Stage 执行结果的统一包装。"""

    success: bool
    output: Optional[TOutput] = None
    error: Optional[str] = None
    engine_used: str = ""
    elapsed_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class Stage(ABC, Generic[TInput, TOutput]):
    """Stage 基类：定义统一的执行接口。"""

    @property
    @abstractmethod
    def stage_id(self) -> str:
        """Stage 唯一标识（如 ``'layout_analysis'``）。"""

    @property
    @abstractmethod
    def stage_name(self) -> str:
        """Stage 中文名称（如 ``'版面分析与阅读顺序'``）。"""

    @abstractmethod
    async def execute(self, input_data: TInput) -> StageResult[TOutput]:
        """执行 Stage 逻辑。

        ⚠️ **Fallback-only path** ⚠️
        主路径由 ``PipelineOrchestrator._execute_stage`` →
        ``StageScheduler.run_stage`` 走, 经过 ``EngineSelector`` 重排
        ``tool_configs`` 后由 scheduler 按 rank 调度。各子类 ``execute()``
        中常见的 ``for tool_cls in _TOOLS.values(): ...`` 字典遍历降级模式
        **仅在被外部直接调用时**(测试 / 兼容旧调用方) 生效, 绕过 selector
        与 scheduler 的竞争机制。

        生产代码请通过 ``run_pdf_pipeline`` / ``PipelineOrchestrator`` 调用,
        避免直接 ``stage.execute(input_data)``。
        """

    def is_available(self) -> bool:
        """检测此 Stage 的默认引擎是否可用。"""
        return True


@runtime_checkable
class StageTool(Protocol):
    """Stage 工具协议：所有具体工具实现的鸭子类型接口。"""

    @property
    def name(self) -> str:
        """工具名称标识（如 ``'pymupdf'``）。"""
        ...

    def is_available(self) -> bool:
        """检测工具是否已安装且可用。"""
        ...

    async def execute(self, input_data: Any) -> StageResult:
        """执行工具逻辑。"""
        ...
