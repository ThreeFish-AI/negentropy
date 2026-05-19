"""Skill 基类: 定义 AI Agent 可调用的组合技能接口。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class SkillMetadata(BaseModel):
    """技能元数据，供 Agent 发现与选择。"""

    name: str = Field(..., description="技能唯一标识 (snake_case)")
    display_name: str = Field(..., description="人类可读名称")
    description: str = Field(..., description="技能描述（AI 消费用）")
    category: str = Field(
        ...,
        description="分类: extraction | conversion | analysis | composite",
    )
    input_schema: dict[str, Any] = Field(..., description="JSON Schema 格式的输入规范")
    output_schema: dict[str, Any] = Field(..., description="JSON Schema 格式的输出规范")
    requires: list[str] = Field(default_factory=list, description="依赖的工具名列表")
    tags: list[str] = Field(default_factory=list, description="可搜索标签")


class Skill(ABC):
    """组合技能抽象基类。

    一个 Skill 封装了多个工具调用的编排逻辑，
    为 AI Agent 提供更高层次的抽象。
    """

    @classmethod
    @abstractmethod
    def metadata(cls) -> SkillMetadata:
        """返回技能元数据。"""
        ...

    @classmethod
    @abstractmethod
    async def execute(cls, **kwargs: Any) -> dict[str, Any]:
        """执行技能逻辑。"""
        ...
