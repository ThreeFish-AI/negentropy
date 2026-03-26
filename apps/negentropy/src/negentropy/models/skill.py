"""技能模块定义模型。"""

from typing import Any

from sqlalchemy import Boolean, Enum, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin
from .plugin_common import PluginVisibility


class Skill(Base, UUIDMixin, TimestampMixin):
    """技能模块定义"""

    __tablename__ = "skills"

    # 所有权和可见性
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    visibility: Mapped[PluginVisibility] = mapped_column(
        Enum(PluginVisibility, schema=NEGENTROPY_SCHEMA), nullable=False, default=PluginVisibility.PRIVATE
    )

    # 基本信息
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100), nullable=False, server_default="general")
    version: Mapped[str] = mapped_column(String(50), nullable=False, server_default="1.0.0")

    # 技能定义
    prompt_template: Mapped[str | None] = mapped_column(Text)
    config_schema: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")
    default_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")
    required_tools: Mapped[list[str] | None] = mapped_column(JSONB, server_default="[]")

    # 状态
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        UniqueConstraint("name", name="skills_name_unique"),
        Index("ix_skills_owner", "owner_id"),
        Index("ix_skills_category", "category"),
        {"schema": NEGENTROPY_SCHEMA},
    )
