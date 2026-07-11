"""进程级 root agent 覆盖槽（Phase 4 接线）。

叶子模块，零重导入 / 无循环依赖：仅承载一个可选的「有效 root agent」引用，供两条
解析路径在 ``NE_AGENTS_FROM_DB`` 开启时统一命中 DB 构造结果：

1. ADK AgentLoader 路径：``negentropy.root_agent`` / ``negentropy.agents.root_agent``
   模块属性（见各自 ``__getattr__``）；
2. Runner 工厂路径：``engine/factories/runner.get_runner()``。

flag-off / 未安装覆盖时 ``get_root_override()`` 返回 None，两条路径均回退到代码
``negentropy.agents.agent.root_agent``（零行为变化）。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from google.adk.agents.base_agent import BaseAgent

_OVERRIDE: BaseAgent | None = None


def set_root_override(agent: BaseAgent | None) -> None:
    """安装（或清除）有效 root agent 覆盖。传 None 等价于 :func:`clear_root_override`。"""
    global _OVERRIDE
    _OVERRIDE = agent


def get_root_override() -> BaseAgent | None:
    """返回当前覆盖的 root agent；未安装时返回 None（调用方回退代码 root_agent）。"""
    return _OVERRIDE


def clear_root_override() -> None:
    """清除覆盖（回退到代码 root_agent）。"""
    global _OVERRIDE
    _OVERRIDE = None
