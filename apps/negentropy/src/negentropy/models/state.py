"""应用与用户状态数据模型。

UserState 和 AppState 使用复合主键（无 UUID），用于存储应用/用户级别的 JSONB 状态，
与 pulse.py 中基于 UUID 的会话模型（Thread/Event/Message）在数据模式上正交。
"""

from datetime import datetime
from typing import Any, Dict

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import TIMESTAMP, Base


class UserState(Base):
    """用户应用状态"""

    __tablename__ = "user_states"

    user_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    app_name: Mapped[str] = mapped_column(String(255), primary_key=True)
    state: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class AppState(Base):
    """应用全局状态"""

    __tablename__ = "app_states"

    app_name: Mapped[str] = mapped_column(String(255), primary_key=True)
    state: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
