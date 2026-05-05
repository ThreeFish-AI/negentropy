"""skill_versions 历史快照表（Phase 3）

Revision ID: 0027
Revises: 0026
Create Date: 2026-05-05 00:00:00.000000+00:00

设计动机：
  Phase 3 让 SubAgent 能锁定特定 Skill 版本（``name@1.0.0`` / ``name@~1.0`` / ``name@*``）。
  本迁移建表 ``skill_versions``，并把现有所有 Skill 的当前 (id, version, *)
  回填一行 SkillVersion，保证升级后已有 SubAgent.skills 引用立即可解析。

字段：
  - id UUID 主键
  - skill_id UUID FK skills(id) ON DELETE CASCADE
  - version str (SemVer)
  - snapshot JSONB（包含 prompt_template / config_schema / default_config /
                    required_tools / enforcement_mode / resources / display_name /
                    description / category / priority）
  - created_at / updated_at TimestampMixin

参考文献：
  [1] SemVer 标准 https://semver.org/
  [2] CorpusVersion 模式 (apps/negentropy/src/negentropy/models/perception.py:529)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'negentropy' AND table_name = 'skill_versions'"
        )
    ).scalar()
    if not table_exists:
        op.create_table(
            "skill_versions",
            sa.Column(
                "id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
            ),
            sa.Column(
                "skill_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("negentropy.skills.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("version", sa.String(length=50), nullable=False),
            sa.Column("snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("skill_id", "version", name="uq_skill_version"),
            schema="negentropy",
        )
        op.create_index(
            "ix_skill_versions_skill_id",
            "skill_versions",
            ["skill_id"],
            schema="negentropy",
        )

    # 回填：把每个 Skill 的当前版本作为初始 SkillVersion 行入库（如尚未存在）。
    bind.execute(
        sa.text(
            """
            INSERT INTO negentropy.skill_versions (id, skill_id, version, snapshot, created_at, updated_at)
            SELECT gen_random_uuid(), s.id, s.version,
                   jsonb_build_object(
                       'name', s.name,
                       'display_name', s.display_name,
                       'description', s.description,
                       'category', s.category,
                       'prompt_template', s.prompt_template,
                       'config_schema', s.config_schema,
                       'default_config', s.default_config,
                       'required_tools', s.required_tools,
                       'priority', s.priority,
                       'enforcement_mode', s.enforcement_mode,
                       'resources', s.resources
                   ),
                   NOW(), NOW()
            FROM negentropy.skills s
            WHERE NOT EXISTS (
                SELECT 1 FROM negentropy.skill_versions sv
                WHERE sv.skill_id = s.id AND sv.version = s.version
            )
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'negentropy' AND table_name = 'skill_versions'"
        )
    ).scalar()
    if table_exists:
        op.drop_index("ix_skill_versions_skill_id", table_name="skill_versions", schema="negentropy")
        op.drop_table("skill_versions", schema="negentropy")
