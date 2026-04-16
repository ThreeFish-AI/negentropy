"""
Model Configuration 数据模型。

存储 LLM、Embedding、Rerank 模型配置，支持管理员通过 Admin UI 动态切换。
每种 model_type 最多一个 is_default=True 的记录（通过部分唯一索引保证）。
"""

import enum
from typing import Any

from sqlalchemy import Boolean, Enum, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin


class ModelType(str, enum.Enum):
    """模型类型枚举"""

    LLM = "llm"
    EMBEDDING = "embedding"
    RERANK = "rerank"


class ModelConfig(Base, UUIDMixin, TimestampMixin):
    """模型配置

    Attributes:
        model_type: 模型类型 (llm / embedding / rerank)
        display_name: 管理界面展示名称
        vendor: 供应商标识 (如 openai, anthropic, zai, vertex_ai, deepseek, ollama)
        model_name: 模型标识符 (如 glm-5, text-embedding-005)
        is_default: 是否为该类型的默认模型
        enabled: 是否启用
        config: 供应商特定参数 (temperature, thinking_mode 等)
    """

    __tablename__ = "model_configs"

    model_type: Mapped[ModelType] = mapped_column(
        Enum(
            ModelType,
            values_callable=lambda enum: [e.value for e in enum],
            schema=NEGENTROPY_SCHEMA,
            name="model_type_enum",
            create_type=False,
        ),
        nullable=False,
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    vendor: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")

    __table_args__ = (
        # 每种 model_type 只能有一个 default
        Index(
            "ix_model_configs_default_unique",
            "model_type",
            unique=True,
            postgresql_where=(is_default.is_(True)),
        ),
        # 防止同一类型下重复的 vendor + model_name
        UniqueConstraint(
            "vendor",
            "model_name",
            "model_type",
            name="model_configs_vendor_model_type_unique",
        ),
        {"schema": NEGENTROPY_SCHEMA},
    )
