from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin


class KnowledgeGraphRun(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_graph_runs"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    run_id: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="'pending'")
    payload: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    __table_args__ = (
        UniqueConstraint("app_name", "run_id", name="knowledge_graph_runs_app_run_unique"),
        UniqueConstraint("app_name", "idempotency_key", name="knowledge_graph_runs_idempotency_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class KnowledgePipelineRun(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_pipeline_runs"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    run_id: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="'pending'")
    payload: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    __table_args__ = (
        UniqueConstraint("app_name", "run_id", name="knowledge_pipeline_runs_app_run_unique"),
        UniqueConstraint("app_name", "idempotency_key", name="knowledge_pipeline_runs_idempotency_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )


# MemoryAuditLog 已迁移至 models/internalization.py
# 参考: https://github.com/ThreeFish-AI/agentic-ai-cognizes/blob/master/docs/research/034-knowledge-base.md
# Memory Governance 属于 Memory 模块，而非 Knowledge 模块
