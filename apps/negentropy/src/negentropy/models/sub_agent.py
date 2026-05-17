"""子智能体配置模型。"""

from typing import Any

from sqlalchemy import Boolean, Enum, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin
from .plugin_common import PluginVisibility


class SubAgent(Base, UUIDMixin, TimestampMixin):
    """子智能体配置"""

    __tablename__ = "sub_agents"

    # 所有权和可见性
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    visibility: Mapped[PluginVisibility] = mapped_column(
        Enum(PluginVisibility, schema=NEGENTROPY_SCHEMA), nullable=False, default=PluginVisibility.PRIVATE
    )

    # 基本信息
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    agent_type: Mapped[str] = mapped_column(String(100), nullable=False)  # llm_agent, workflow, etc.

    # Agent 配置
    system_prompt: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(100))
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")
    skills: Mapped[list[str] | None] = mapped_column(JSONB, server_default="[]")
    tools: Mapped[list[str] | None] = mapped_column(JSONB, server_default="[]")

    # 状态
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # 「系统内置」标识：与 BuiltinTool.is_system / McpServer.is_system / Skill.is_system
    # 对齐，作为可见性与权限判断的单一事实源（参见 permissions._is_plugin_builtin）。
    # 历史上通过 ``config.source == "negentropy_builtin"`` 标记的 SubAgent 在迁移
    # 0033 中会被自动回填为 ``is_system=TRUE``。
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    __table_args__ = (
        UniqueConstraint("name", name="sub_agents_name_unique"),
        Index("ix_sub_agents_owner", "owner_id"),
        Index("ix_sub_agents_is_system", "is_system"),
        {"schema": NEGENTROPY_SCHEMA},
    )
