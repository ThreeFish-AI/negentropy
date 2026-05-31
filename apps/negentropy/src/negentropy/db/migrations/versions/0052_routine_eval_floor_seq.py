"""为 Routine 新增 eval_floor_seq（决策窗口水位线），支撑失败任务「重新启动 / 重跑」。

Revision ID: 0052
Revises: 0051
Create Date: 2026-05-31 12:00:00.000000+00:00

设计动机：
    失败 / 取消的 Routine 需要「一键重跑」能力。重启时复位运行态计数器（iteration_count /
    total_cost_usd / score / session / phase / pr_url）并将 status 置回 running 即可让编排器重新派发；
    但 ``decide()`` 的 no_progress / oscillation / 连续失败守卫均基于 ``_evaluated_history()``——
    它返回该 routine **全部** evaluated 迭代。若新一轮迭代追加在旧迭代之后，会被**旧一轮评分**判定为
    停滞而被立即再次终止。

      ``routines.eval_floor_seq``：决策窗口水位线。仅 ``seq > eval_floor_seq`` 的迭代参与
      决策 / 审批判定。重启时置为当前 ``MAX(seq)``，使新一轮尝试拥有干净的判定窗口，
      同时**保留**既往迭代行（审计 + ``uq_routine_iterations_seq`` 唯一性，``_next_seq()`` 取
      ``MAX(seq)+1`` 天然不冲突）。server_default='0' 对既有行安全回填（等价「全窗口」语义不变）。

幂等性：
    加列前以 information_schema 探测列存在性（仿 0048/0049 范式），便于半失败重试。

参考文献：
[1] 0049_routine_phase_and_pr.py — information_schema 幂等 DDL + schema 限定范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0052"
down_revision: str | None = "0051"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = :s AND table_name = :t AND column_name = :c"
            ),
            {"s": SCHEMA, "t": table_name, "c": column_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    if not _column_exists(bind, "routines", "eval_floor_seq"):
        op.add_column(
            "routines",
            sa.Column(
                "eval_floor_seq",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
                comment="决策窗口水位线：仅 seq > 此值的迭代参与 decide/审批判定；重启时置为当前 MAX(seq)",
            ),
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _column_exists(bind, "routines", "eval_floor_seq"):
        op.drop_column("routines", "eval_floor_seq", schema=SCHEMA)
