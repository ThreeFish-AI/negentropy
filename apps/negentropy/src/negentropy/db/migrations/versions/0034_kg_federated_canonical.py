"""联邦知识图谱：全局实体规范层 + 跨 Corpus 别名映射 + 跨 Corpus 关系桥

Revision ID: 0034
Revises: 0033
Create Date: 2026-05-17 09:00:00.000000+00:00

设计动机：
    KgEntity 当前以 (corpus_id, canonical_name) 为唯一约束，跨 Corpus 同名实体
    不会合并。这是 Corpus 多租户隔离的合理选择，但在 Home Studio 多 @Corpus 检索
    场景下，无法做跨 Corpus 实体桥接与多跳推理。

    本迁移引入「联邦图谱 + 全局实体规范层」（Federated KG + Global Entity
    Canonical Layer），保留 Corpus 物理隔离，新增一个虚拟规范层用于跨 Corpus
    多跳查询。架构哲学映射：

      - Microsoft GraphRAG (Edge et al., 2024) — 社区分层摘要
      - LightRAG (Guo et al., 2024)           — Dual-level low/high-level 检索
      - HippoRAG 2 (Gutiérrez et al., 2025)   — PPR + 2-hop 收敛最佳
      - PathRAG (Chen et al., 2024)           — 关系路径剪枝
      - Fellegi & Sunter (1969)               — 三阶段实体消解理论基础

新增表：
    1. kg_entity_canonical  — 全局规范实体（跨 Corpus 唯一身份，按 app_scope 隔离）
    2. kg_entity_alias      — Corpus-local 实体 → canonical 多对一映射
    3. kg_cross_corpus_bridge — 跨 Corpus 显式桥接关系（可选物化，加速 2-hop 遍历）

权限红线（不可越过）：
    - canonical 层按 app_scope 严格隔离（Phase 1 不跨 app）
    - 任何对 kg_entity_alias 的查询必须显式带 corpus_id 过滤（应用层 event hook 兜底）
    - canonical 实体永不直接对外暴露 canonical_id；仅做 server-side join 中转

幂等性：所有 CREATE TABLE / CREATE INDEX 均 IF NOT EXISTS；downgrade 仅 DROP。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0034"
down_revision: str | None = "0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    # =========================================================================
    # 1. kg_entity_canonical — 全局规范实体（跨 Corpus 唯一身份）
    # =========================================================================
    op.execute(
        sa.text(
            f"""
            CREATE TABLE IF NOT EXISTS {SCHEMA}.kg_entity_canonical (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                app_scope VARCHAR(255) NOT NULL,
                canonical_name_normalized VARCHAR(500) NOT NULL,
                display_name VARCHAR(500) NOT NULL,
                canonical_type VARCHAR(50) NOT NULL,
                type_distribution JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                primary_embedding vector(1536),
                aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
                mention_corpus_count INTEGER NOT NULL DEFAULT 0,
                mention_total_count INTEGER NOT NULL DEFAULT 0,
                importance_score FLOAT,
                is_under_review BOOLEAN NOT NULL DEFAULT FALSE,
                is_stopword_like BOOLEAN NOT NULL DEFAULT FALSE,
                review_reason TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_canonical_app_name_type
                    UNIQUE (app_scope, canonical_name_normalized, canonical_type)
            )
            """
        )
    )
    op.execute(
        sa.text(f"CREATE INDEX IF NOT EXISTS ix_canonical_app_scope ON {SCHEMA}.kg_entity_canonical (app_scope)")
    )
    op.execute(
        sa.text(
            f"""
            CREATE INDEX IF NOT EXISTS ix_canonical_embedding
            ON {SCHEMA}.kg_entity_canonical
            USING hnsw (primary_embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
            """
        )
    )
    # 部分索引：仅对 review 队列建索引（review 行通常占比 <5%）
    op.execute(
        sa.text(
            f"CREATE INDEX IF NOT EXISTS ix_canonical_review "
            f"ON {SCHEMA}.kg_entity_canonical (is_under_review) "
            f"WHERE is_under_review = TRUE"
        )
    )

    # =========================================================================
    # 2. kg_entity_alias — Corpus-local 实体 → canonical 多对一映射
    # =========================================================================
    op.execute(
        sa.text(
            f"""
            CREATE TABLE IF NOT EXISTS {SCHEMA}.kg_entity_alias (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                canonical_id UUID NOT NULL
                    REFERENCES {SCHEMA}.kg_entity_canonical(id) ON DELETE CASCADE,
                local_entity_id UUID NOT NULL
                    REFERENCES {SCHEMA}.kg_entities(id) ON DELETE CASCADE,
                corpus_id UUID NOT NULL
                    REFERENCES {SCHEMA}.corpus(id) ON DELETE CASCADE,
                app_name VARCHAR(255) NOT NULL,
                confidence FLOAT NOT NULL,
                link_method VARCHAR(32) NOT NULL,
                linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_alias_local UNIQUE (local_entity_id),
                CONSTRAINT chk_alias_link_method CHECK (
                    link_method IN ('auto_string','auto_embedding','auto_llm','manual','review')
                )
            )
            """
        )
    )
    op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS ix_alias_canonical ON {SCHEMA}.kg_entity_alias (canonical_id)"))
    # 权限热路径：(corpus_id, app_name) 复合索引，加速 IN (...) 过滤
    op.execute(
        sa.text(f"CREATE INDEX IF NOT EXISTS ix_alias_corpus_app ON {SCHEMA}.kg_entity_alias (corpus_id, app_name)")
    )

    # =========================================================================
    # 3. kg_cross_corpus_bridge — 跨 Corpus 显式桥接关系（Phase 1 建表不物化）
    # =========================================================================
    op.execute(
        sa.text(
            f"""
            CREATE TABLE IF NOT EXISTS {SCHEMA}.kg_cross_corpus_bridge (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                app_scope VARCHAR(255) NOT NULL,
                canonical_source_id UUID NOT NULL
                    REFERENCES {SCHEMA}.kg_entity_canonical(id) ON DELETE CASCADE,
                canonical_target_id UUID NOT NULL
                    REFERENCES {SCHEMA}.kg_entity_canonical(id) ON DELETE CASCADE,
                bridge_type VARCHAR(64) NOT NULL,
                weight FLOAT NOT NULL DEFAULT 1.0,
                supporting_evidence JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_bridge_endpoints
                    UNIQUE (canonical_source_id, canonical_target_id, bridge_type),
                CONSTRAINT chk_bridge_no_self
                    CHECK (canonical_source_id <> canonical_target_id)
            )
            """
        )
    )
    op.execute(
        sa.text(f"CREATE INDEX IF NOT EXISTS ix_bridge_source ON {SCHEMA}.kg_cross_corpus_bridge (canonical_source_id)")
    )
    op.execute(
        sa.text(f"CREATE INDEX IF NOT EXISTS ix_bridge_target ON {SCHEMA}.kg_cross_corpus_bridge (canonical_target_id)")
    )


def downgrade() -> None:
    # 反向顺序删表（先删依赖外键的子表）
    op.execute(sa.text(f"DROP TABLE IF EXISTS {SCHEMA}.kg_cross_corpus_bridge"))
    op.execute(sa.text(f"DROP TABLE IF EXISTS {SCHEMA}.kg_entity_alias"))
    op.execute(sa.text(f"DROP TABLE IF EXISTS {SCHEMA}.kg_entity_canonical"))
