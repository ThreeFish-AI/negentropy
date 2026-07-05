"""Repository 资源 — GitHub 地址 + 引擎主机本地仓库根路径 + 基线分支锚点。

定位（与 mcp/skill/agent/builtin_tool 并列的第 5 类 plugin 资源）：
    Repository 把「引擎主机上已 clone 的本地仓库根路径」+ GitHub 地址 + 基线分支注册为
    可复用资源。Routine 选定某 Repository 后，从中派生隔离 worktree 所需的 cwd(=local_path)
    与 baseline_branch。本资源**不引入任何 clone 远程仓库的逻辑** —— worktree 仍由
    engine/routine/workspace.py 基于 local_path 创建（fetch 基线最新 → 建隔离工作分支）。

权限模型：
    完全复用 plugin 体系（owner_id + visibility + is_system + permissions.check_plugin_*）。
    通过 permissions.PLUGIN_TYPE_MODEL_MAP 的 "repository" 键接入，无需新增权限代码。

单一事实源：
    Routine 仅持有 ``repository_id`` 指针（FK，ondelete=SET NULL），**不**复制 Repository 的
    local_path/baseline_branch 副本；有效配置在校验 / dispatch 时解析（见
    workspace.resolve_effective_repo）。
"""

from typing import Any

from sqlalchemy import Boolean, Enum, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin
from .plugin_common import PluginVisibility


class Repository(Base, UUIDMixin, TimestampMixin):
    """已注册的本地仓库锚点（GitHub 地址 + 本地根路径 + 基线分支）。"""

    __tablename__ = "repositories"

    # --- 所有权与可见性（对齐 McpServer / Skill / Agent）---
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    visibility: Mapped[PluginVisibility] = mapped_column(
        Enum(PluginVisibility, schema=NEGENTROPY_SCHEMA), nullable=False, default=PluginVisibility.PRIVATE
    )

    # --- 基本信息 ---
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)

    # --- Repository 专属锚点 ---
    # GitHub 远程地址（展示 / 溯源用；不触发任何 clone）。
    github_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    # 引擎主机上已 clone 的本地仓库根路径（= Routine 派生的 cwd / git worktree 的 project_path）。
    local_path: Mapped[str] = mapped_column(Text, nullable=False)
    # 基线分支 + PR base（如 origin/feature/1.x.x）；注册时由分支枚举端点提供下拉候选。
    baseline_branch: Mapped[str] = mapped_column(String(255), nullable=False)
    # fetch / PR base 归一所用的 git 远端名（对齐 RoutineSettings.git_remote 默认）。
    default_remote: Mapped[str] = mapped_column(String(255), nullable=False, default="origin", server_default="origin")

    # --- 状态与配置（对齐 McpServer）---
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # 「系统内置」标识：与 McpServer.is_system / BuiltinTool.is_system 对齐，
    # 作为 permissions._is_plugin_builtin 的可见性 / 权限判断单一事实源。
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")

    # 排序：前端拖拽排序后的持久化序号（预留），值越小越靠前。
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        # 唯一约束放 name —— 允许同一 GitHub repo 以不同 name / baseline 注册多条。
        UniqueConstraint("name", name="repositories_name_unique"),
        Index("ix_repositories_owner", "owner_id"),
        Index("ix_repositories_visibility", "visibility"),
        Index("ix_repositories_is_system", "is_system"),
        {"schema": NEGENTROPY_SCHEMA},
    )


__all__ = ["Repository"]
