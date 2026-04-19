"""
Vendor Configuration 数据模型。

存储供应商级 API 凭证（api_key + api_base），供该供应商下所有模型共享。
每个供应商最多一条记录（vendor 作为自然主键）。
"""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin


class VendorConfig(Base, TimestampMixin):
    """供应商级凭证配置

    Attributes:
        vendor: 供应商标识 (如 openai, anthropic, gemini)，自然主键
        api_key: API 密钥
        api_base: 自定义 API Base URL (可选)
    """

    __tablename__ = "vendor_configs"

    vendor: Mapped[str] = mapped_column(String(50), primary_key=True)
    api_key: Mapped[str] = mapped_column(Text, nullable=False)
    api_base: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = ({"schema": NEGENTROPY_SCHEMA},)
