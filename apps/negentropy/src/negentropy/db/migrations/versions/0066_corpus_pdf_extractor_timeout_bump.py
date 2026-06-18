"""Data: 修正存量 corpus 的 file_pdf 抽取超时(300000/600000 → 3600000/7200000)

Revision ID: 0066
Revises: 0065
Create Date: 2026-06-08 00:00:00.000000+00:00

设计动机(ISSUE-133 follow-up):
    大型 PDF Ingest「Connection timeout after 300.0s」的真正取值源,是 corpus 持久化
    配置(JSONB)里固化的 ``config.extractor_routes.file_pdf.targets[].timeout_ms``——
    建库时由 ``knowledge/_shared.py:_resolve_default_extractor_routes`` 从 YAML/config
    默认值(旧 300000/600000)写入。上一轮仅改了 ``_DEFAULT_EXTRACTION_TIMEOUT_MS`` 兜底
    (因 timeout_ms 已固化、``if not target.timeout_ms`` 永为假而从不命中=死代码),
    既未改 YAML 定义源,也未纠正已固化进 DB 的存量副本,故存量库仍以 300s 触发后端 MCP
    与 perceives 的双层超时。

    本迁移与 Part A(YAML/config 默认值升至 3600000/7200000,修「新建库」)正交配对,
    专责纠正「存量库」已固化进 DB 的旧默认值。后端超时是数据驱动的(``extraction.py``
    每次运行实时读 ``target.timeout_ms``),迁移落库后存量库重试即取新预算,无需引擎改码。

正交 / 最小干预:
    仅重写 ``file_pdf.targets[]`` 中【精确等于旧默认值】的 ``timeout_ms``:
      - 300000 → 3600000(主 ``parse_pdf_to_markdown``,1h)
      - 600000 → 7200000(备 ``parse_pdfs_to_markdown``,2h)
    其余值(用户显式自定义如 900000、无 ``timeout_ms`` 的元素、``url`` 路由)一律不动
    —— 经 ``CASE ... ELSE t`` 原样保留,杜绝覆盖用户显式配置。

幂等性:
    二次运行无 300000/600000 可命中(``EXISTS`` 守卫 → 零行)；重跑安全。

null 安全:
    ``CASE ... ELSE t`` 使缺 ``timeout_ms`` 的元素与不匹配元素原样透传(永不经 jsonb_set);
    路径缺失(``config`` / ``extractor_routes`` / ``file_pdf`` 任一不存在)经
    ``jsonb_typeof(NULL) <> 'array'`` 自然跳过;``jsonb_set(..., false)`` 为防御性兜底。
    ``EXISTS`` 守卫保证仅对「非空且含命中元素」的数组求值,``jsonb_agg`` 必非 NULL。

保序:
    ``WITH ORDINALITY`` + ``ORDER BY ord`` 保持 targets 数组原有主备顺序(priority 语义依赖序)。

downgrade:
    逆向同形(3600000→300000、7200000→600000),仅命中本迁移写入的新值。
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0066"
down_revision: str | None = "0065"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

# 旧默认值 → 新默认值(主 1h / 备 2h);downgrade 取其逆。
_UPGRADE_MAP: tuple[tuple[str, str], ...] = (("300000", "3600000"), ("600000", "7200000"))
_DOWNGRADE_MAP: tuple[tuple[str, str], ...] = (("3600000", "300000"), ("7200000", "600000"))

_TARGETS_PATH = "{extractor_routes,file_pdf,targets}"


def _rewrite_sql(mapping: tuple[tuple[str, str], ...]) -> str:
    """构造整体重写 ``file_pdf.targets[].timeout_ms`` 的幂等 UPDATE SQL。"""
    cases = "\n                    ".join(
        f"WHEN (t->>'timeout_ms') = '{src}' THEN jsonb_set(t, '{{timeout_ms}}', '{dst}'::jsonb)" for src, dst in mapping
    )
    src_values = ", ".join(f"'{src}'" for src, _ in mapping)
    return f"""
    UPDATE {SCHEMA}.corpus AS c
    SET config = jsonb_set(
        c.config,
        '{_TARGETS_PATH}',
        (
            SELECT jsonb_agg(
                CASE
                    {cases}
                    ELSE t
                END
                ORDER BY ord
            )
            FROM jsonb_array_elements(c.config #> '{_TARGETS_PATH}') WITH ORDINALITY AS arr(t, ord)
        ),
        false
    )
    WHERE jsonb_typeof(c.config #> '{_TARGETS_PATH}') = 'array'
      AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(c.config #> '{_TARGETS_PATH}') AS e(t)
          WHERE (e.t->>'timeout_ms') IN ({src_values})
      )
    """


def upgrade() -> None:
    op.execute(sa.text(_rewrite_sql(_UPGRADE_MAP)))


def downgrade() -> None:
    op.execute(sa.text(_rewrite_sql(_DOWNGRADE_MAP)))
