"""blob 对象存储模型。

GCS 退役后，知识文档原文 / Markdown 衍生 / 提取图片资产 / MCP trial 资产
统一以 ``bytea`` 持久化到 ``blob_objects`` 表，以 ``key``（存储路径）为主键。
业务层（``knowledge_documents`` / ``mcp_trial_assets``）的 ``content_uri`` 列
存 ``pgblob://{key}`` URI 作为指向本表的轻量指针。
"""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import BigInteger, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin


class BlobObject(Base, TimestampMixin):
    """blob 对象表——以存储 key 为主键的 ``bytea`` 内容仓库。

    ``key`` 与业务表（如 ``knowledge_documents.content_uri``）中存储的
    ``pgblob://{key}`` URI 一一对应。内容去重在业务层按 ``file_hash`` 完成，
    故同 key 重复上传为覆盖写。
    """

    __tablename__ = "blob_objects"
    __table_args__ = ({"schema": NEGENTROPY_SCHEMA},)

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    """存储 key，如 ``knowledge/negentropy/{corpus}/{file}``。"""

    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    """文件字节（PostgreSQL ``bytea``，自动 TOAST 外存）。"""

    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    """MIME 类型。"""

    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    """字节数。"""

    def __repr__(self) -> str:  # pragma: no cover - 调试辅助
        return f"<BlobObject key={self.key!r} size={self.size}>"


class AdkArtifact(Base, TimestampMixin):
    """ADK ArtifactService 的 PostgreSQL 持久化表。

    一行 = 一个 artifact 的一个版本。``data`` 以
    ``types.Part.model_dump_json()`` 序列化字节存储，加载时
    ``Part.model_validate_json()`` 还原，忠实保留 inline_data / text / file_data
    等所有变体。作用域：``session_id IS NULL`` 表示 user-scoped 制品。

    与 :class:`negentropy.models.pulse.Thread` / ``Event`` 同属 ADK 运行态数据，
    但按制品语义独立成表（机制与策略正交）。
    """

    __tablename__ = "adk_artifacts"
    __table_args__ = ({"schema": NEGENTROPY_SCHEMA},)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4, server_default=func.gen_random_uuid())
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    """``None`` 表示 user-scoped 制品。"""

    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    version: Mapped[int] = mapped_column(nullable=False)
    """从 0 单调递增的版本号。"""

    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    """``types.Part`` 序列化字节（JSON UTF-8）。"""

    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    """便利字段——制品 payload 的 MIME（若可推断）。"""

    custom_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    """用户自定义元数据（JSONB）。"""

    def __repr__(self) -> str:  # pragma: no cover - 调试辅助
        return (
            f"<AdkArtifact app={self.app_name!r} user={self.user_id!r} "
            f"session={self.session_id!r} file={self.filename!r} v{self.version}>"
        )
