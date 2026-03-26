"""知识运行时模型 -- Knowledge Graph 与 Pipeline 执行记录。"""

from typing import Any

from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin


class _KnowledgeRunMixin:
    """知识运行记录共享字段。

    提取 KnowledgeGraphRun 与 KnowledgePipelineRun 的公共列定义，
    各子类仅需定义 __tablename__ 和 __table_args__。
    """

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    run_id: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="'pending'")
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    idempotency_key: Mapped[str | None] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")


class KnowledgeGraphRun(_KnowledgeRunMixin, Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_graph_runs"

    __table_args__ = (
        UniqueConstraint("app_name", "run_id", name="knowledge_graph_runs_app_run_unique"),
        UniqueConstraint("app_name", "idempotency_key", name="knowledge_graph_runs_idempotency_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class KnowledgePipelineRun(_KnowledgeRunMixin, Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_pipeline_runs"

    __table_args__ = (
        UniqueConstraint("app_name", "run_id", name="knowledge_pipeline_runs_app_run_unique"),
        UniqueConstraint("app_name", "idempotency_key", name="knowledge_pipeline_runs_idempotency_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )
