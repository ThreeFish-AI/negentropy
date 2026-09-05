"""一核五翼 Agent 子系统配置。

env 前缀 ``NE_AGENTS_``；YAML 节点 ``agents:``。

本段配置治理「6 个内置 Agent 如何从 DB 单源解析运行时配置」的开关。指令（system_prompt）
与模型（model）历来即经 ``_dynamic_instruction`` / ``_dynamic_model`` 按 ``agents.name`` 每轮
读 DB；``tools`` 的运行时回源（WS1）为新增能力，故以总开关灰度：默认关 → 六翼工具集仍取代码
硬编码 default（与改造前逐字节等价），运维在**重新 Sync 使 ``agents.tools`` 对齐当前代码**后
再翻 True，避免陈旧 / 脏 DB 行导致运行时工具集回归。
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AgentsSettings(BaseSettings):
    """一核五翼 Agent 运行时配置解析开关。"""

    model_config = SettingsConfigDict(
        env_prefix="NE_AGENTS_",
        env_nested_delimiter="__",
        extra="ignore",
        frozen=True,
    )

    tools_from_db_enabled: bool = Field(
        default=False,
        description="启用六翼 tools 运行时从 DB(``agents.tools``)回源(WS1)。默认关 → "
        "``NegentropyToolset`` 恒用代码硬编码 default_names(零回归)。开启前须先调 "
        "``POST /interface/agents/sync/negentropy`` 使 DB tools 对齐当前代码，否则陈旧 DB "
        "会丢失代码新增工具。作为 kill-switch:出现异常关回即恢复硬编码基线。",
    )
