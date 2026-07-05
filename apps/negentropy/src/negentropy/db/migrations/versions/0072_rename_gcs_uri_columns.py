"""重命名 gcs_uri/markdown_gcs_uri 列为中性名 + 存量 URI scheme 改写

Revision ID: 0072
Revises: 0071
Create Date: 2026-06-20 00:00:00.000000+00:00

设计动机：
    GCS 退役（见 0071 与 GCS 退役迁移蓝图）的最后命名清理：业务表
    ``knowledge_documents`` / ``mcp_trial_assets`` 的 ``gcs_uri`` /
    ``markdown_gcs_uri`` 列承载的是中性存储 URI（现为 ``pgblob://``），列名
    保留 "gcs" 字样构成 Split-Brain 嫌疑。本迁移把列重命名为
    ``content_uri`` / ``markdown_uri``，与 ORM 属性、API 字段、前端字段统一。

正交分解：
    本迁移与 ORM/Schema/前端字段重命名**原子**进行（同一提交）。PG
    ``RENAME COLUMN`` 为元数据级操作（零数据拷贝、毫秒级），低风险。

存量 URI scheme 改写：
    历史 ``gs://{bucket}/key`` URI 改写为 ``pgblob://key``（正则剥离 bucket
    段），与新写入的 scheme 一致。注意：仅改写 URI **字符串**，blob 字节若
    原在 GCS 则需另行回填到 ``blob_objects``（见蓝图 R1）；本地 / 无存量数据
    环境无影响。``metadata_`` JSONB 内的 ``extracted_assets[].uri`` 暂不逐元素
    改写（旧数据资产清理为最佳努力，新数据自 Commit A 起即为 pgblob://）。

幂等性：
    ``RENAME COLUMN`` 非幂等（列不存在则报错），但 Alembic 版本表保证仅执行
    一次。downgrade 反向重命名 + scheme 回写（仅本地开发回滚便利，生产慎用）。
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0072"
down_revision: str | None = "0071"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

# (table, old_column, new_column)
_RENAMES = [
    ("knowledge_documents", "gcs_uri", "content_uri"),
    ("knowledge_documents", "markdown_gcs_uri", "markdown_uri"),
    ("mcp_trial_assets", "gcs_uri", "content_uri"),
]

# gs://{bucket}/key  →  pgblob://key（剥离 bucket 段）
_GCS_TO_BLOB = r"REGEXP_REPLACE(%s, '^gs://[^/]+/', 'pgblob://')"
# 反向（downgrade 本地回滚用）：pgblob://key → gs://negentropy/key
# 注：反向需假定 bucket 为 negentropy，仅用于本地开发回滚便利。
_BLOB_TO_GCS = r"REPLACE(%s, 'pgblob://', 'gs://negentropy/')"


def upgrade() -> None:
    # 1) 先改写存量 URI scheme（在旧列名上）
    for table, old_col, _new_col in _RENAMES:
        op.execute(f"UPDATE {SCHEMA}.{table} SET {old_col} = {_GCS_TO_BLOB % old_col} WHERE {old_col} LIKE 'gs://%'")

    # 2) 重命名列
    for table, old_col, new_col in _RENAMES:
        op.alter_column(table, old_col, new_column_name=new_col, schema=SCHEMA)


def downgrade() -> None:
    # 反向重命名
    for table, old_col, new_col in _RENAMES:
        op.alter_column(table, new_col, new_column_name=old_col, schema=SCHEMA)

    # 反向 scheme 回写（仅本地回滚便利；bucket 假定 negentropy）
    for table, old_col, _new_col in _RENAMES:
        op.execute(
            f"UPDATE {SCHEMA}.{table} SET {old_col} = {_BLOB_TO_GCS % old_col} WHERE {old_col} LIKE 'pgblob://%'"
        )
