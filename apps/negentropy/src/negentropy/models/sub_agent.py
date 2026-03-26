"""子智能体配置模型。"""

from typing import Any, Dict, List, Optional

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
    display_name: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    agent_type: Mapped[str] = mapped_column(String(100), nullable=False)  # llm_agent, workflow, etc.

    # Agent 配置
    system_prompt: Mapped[Optional[str]] = mapped_column(Text)
    model: Mapped[Optional[str]] = mapped_column(String(100))
    config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")
    skills: Mapped[Optional[List[str]]] = mapped_column(JSONB, server_default="[]")
    tools: Mapped[Optional[List[str]]] = mapped_column(JSONB, server_default="[]")

    # 状态
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("name", name="sub_agents_name_unique"),
        Index("ix_sub_agents_owner", "owner_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )
