"""Definition Registry 模型 —— 所有「定义源」的单一事实源（SSOT）。

设计目标（详见方案文档）：
- 把原先分散在文件系统 / 代码里的定义源（Skill 模板、Routine 预设、Harness 技能
  ``SKILL.md``、代码内置 Agent 声明式规格）统一收敛到**一张表**，以「整段源文本
  （YAML / Markdown）入库 + 界面代码编辑器维护」的形态承载，数据库成为唯一 SSOT。
- 每个 ``kind`` 挂一个薄适配器（解析器 / 物化器 / 工厂，见
  ``negentropy.agents.definitions.registry``），下游 dataclass / 消费端零改动：
  各 loader 仅由「glob 文件」改为「查本表行 + 跑现有 ``_coerce_*``」。

正交分解：
- 本表存**定义源**（可编辑的 catalog / 规格文本），与运行时的 ``skills`` /
  ``routines`` / ``agents`` 活表正交；loader 负责在两者之间架桥（解析 / 物化）。
- ``source`` 是 SSOT；``meta`` / ``version`` / ``checksum`` 是从 ``source`` 派生的
  denormalized 冗余列，仅供列表展示、筛选与变更检测，写库时回填、不可反向权威。
"""

from typing import Any

from sqlalchemy import Boolean, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin

# 受支持的定义族（与 registry 适配器一一对应）。
DEFINITION_KINDS: frozenset[str] = frozenset(
    {
        "skill_template",  # Skill 模板目录（原 agents/skill_templates/*.yaml）
        "routine_preset",  # Routine 预设目录（原 agents/routine_presets/*.yaml）
        "harness_skill",  # Claude Code harness 技能（原 .agent/skills/*/SKILL.md）
        "agent",  # 代码内置 Agent 声明式规格（root + faculties + pipelines）
    }
)

# 受支持的源文本格式。
DEFINITION_FORMATS: frozenset[str] = frozenset({"yaml", "markdown"})


class Definition(Base, UUIDMixin, TimestampMixin):
    """统一定义源行。

    ``UniqueConstraint(kind, key)`` 保证「同一定义族内 key 唯一」，是各 loader
    幂等 upsert 与前端引用的稳定锚点（``key`` 承接原 ``template_id`` / ``preset_id``
    / SKILL 目录名 / Agent name）。
    """

    __tablename__ = "definitions"

    # ── 归类与标识 ──────────────────────────────────────────
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    format: Mapped[str] = mapped_column(String(16), nullable=False, server_default="yaml")

    # ── SSOT：整段源文本 ────────────────────────────────────
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default="")

    # ── 派生冗余（写库时从 source 解析回填，仅供列表 / 筛选 / 变更检测）──
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # sha256(source)，物化器据此跳过未变行、前端据此判定 dirty。
    checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ── 所有权与状态 ────────────────────────────────────────
    # 系统内置定义 owner_id='system'；用户自建定义写入其 user_id。
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False, server_default="system")
    # 与 Skill.is_system / Agent.is_system 对齐：系统内置定义受保护（禁删）。
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # 前端拖拽排序序号，值越小越靠前。
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        UniqueConstraint("kind", "key", name="uq_definitions_kind_key"),
        Index("ix_definitions_kind", "kind"),
        Index("ix_definitions_kind_enabled", "kind", "is_enabled"),
        Index("ix_definitions_owner", "owner_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )
