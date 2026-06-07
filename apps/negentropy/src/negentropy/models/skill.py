"""技能模块定义模型。"""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    # 「系统内置」标识：与 BuiltinTool.is_system / McpServer.is_system / Agent.is_system
    # 对齐，作为可见性与权限判断的单一事实源（参见 permissions._is_plugin_builtin）。
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    # 「全局技能」标识：为 TRUE 时由 skills_injector.resolve_global_skills 自动并入
    # **全系统所有 Agent** 的 Progressive Disclosure（一核五翼 + 未来新增 Agent），
    # 无需在 ``Agent.skills`` 中显式列出。安全不变量：全局注入一律按 ``warning`` 强制，
    # 永不因 ``required_tools`` 缺失而阻塞任何 Agent 启动（详见 skills_injector）。
    is_global: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    # Phase 2 — 工具白名单 fail-close 模式（warning|strict，默认 warning）
    enforcement_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, default="warning", server_default="warning"
    )

    # Phase 2 — Layer 3 资源挂载：[{type, ref, title, lazy}, ...]
    # type ∈ {kg_node, memory, corpus, url, inline}；lazy=True 时不入常驻 prompt。
    # NOT NULL：与 0026 迁移对齐；server_default 让现有行升级时自动获得 ``[]``，
    # 调用方无需为空场景额外判 None。
    resources: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")

    __table_args__ = (
        UniqueConstraint("name", name="skills_name_unique"),
        Index("ix_skills_owner", "owner_id"),
        Index("ix_skills_category", "category"),
        Index("ix_skills_is_system", "is_system"),
        Index("ix_skills_is_global", "is_global"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    # Phase 3 — 版本历史与定时调度（关系反向定义）
    versions: Mapped[list["SkillVersion"]] = relationship(
        back_populates="skill",
        cascade="all, delete-orphan",
        order_by="SkillVersion.created_at.desc()",
    )
    schedules: Mapped[list["SkillSchedule"]] = relationship(
        back_populates="skill",
        cascade="all, delete-orphan",
    )


# =============================================================================
# Phase 3 — Skill 版本历史快照
# =============================================================================


class SkillVersion(Base, UUIDMixin, TimestampMixin):
    """Skill 版本历史快照（Phase 3）。

    每次 ``Skill.version`` 字段在 PATCH 中被改写时，自动写入一条 SkillVersion，
    把当时的 prompt_template / config_schema / default_config / required_tools /
    enforcement_mode / resources 全部 freeze 为 JSONB ``snapshot``。

    Agent.skills 的字符串可写成 ``name@1.0.0`` / ``name@~1.0`` / ``name@*``，
    skills_injector 解析时按 SemVer 在此表中查精确或 range 匹配的快照。

    设计取舍：
    - **不复用 CorpusVersion 的 version_number INT**（Skill 用 SemVer 字符串，
      与 packaging.version 一致，而非线性递增）；
    - **snapshot 是 JSONB**：避免每个字段 *_snapshot 列爆炸，统一一行。
    """

    __tablename__ = "skill_versions"

    skill_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.skills.id", ondelete="CASCADE"),
        nullable=False,
    )
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")

    skill: Mapped["Skill"] = relationship(back_populates="versions")

    __table_args__ = (
        UniqueConstraint("skill_id", "version", name="uq_skill_version"),
        Index("ix_skill_versions_skill_id", "skill_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )


# =============================================================================
# Phase 3 — Skill 定时调度
# =============================================================================


class SkillSchedule(Base, UUIDMixin, TimestampMixin):
    """Skill 定时调度（Phase 3）。

    AsyncScheduler 启动 60s tick，扫此表中 ``enabled AND next_run_at <= now()``
    的行（``FOR UPDATE SKIP LOCKED`` 防多 worker 竞争），调用 invoke 端点后更新
    ``last_run_at`` 与 ``next_run_at``。

    ``cron_expr`` 是 POSIX 5 字段（minute / hour / dom / month / dow），用 croniter
    库解析。``vars`` 是 invoke 时透传的变量字典。

    Phase 3 暂不启用 pg_cron（云厂商兼容性差），将来可平滑切换。
    """

    __tablename__ = "skill_schedules"

    skill_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.skills.id", ondelete="CASCADE"),
        nullable=False,
    )
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    cron_expr: Mapped[str] = mapped_column(String(64), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    vars: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    skill: Mapped["Skill"] = relationship(back_populates="schedules")

    __table_args__ = (
        Index("ix_skill_schedules_skill_id", "skill_id"),
        Index("ix_skill_schedules_due", "enabled", "next_run_at"),
        {"schema": NEGENTROPY_SCHEMA},
    )
