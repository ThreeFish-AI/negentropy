"""任务 → 模型 映射数据模型。

将后台 LLM 调用（Memory Consolidation、Session 标题、KG 抽取等）与具体 model_config 绑定。
- 全局映射：``scope_corpus_id IS NULL``，由管理员在 ``/interface/task-models`` 页配置。
- Corpus 级映射：``scope_corpus_id`` 指向 ``corpus.id``，由用户在 Corpus 设置页配置。
- 缺行 = 回退到全局默认 / 硬编码 fallback，零破坏。

设计动机:
    用户原本只能通过 ``model_configs.is_default`` 设置全局唯一默认 LLM，无法为不同的
    后台任务（事实提取 vs 摘要 vs 反思）分别选择模型。本表为每个任务提供独立绑定能力，
    实现"用户在 UI 上为每处后台 LLM 调用单独选择模型"的产品诉求。
"""

from uuid import UUID

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, fk


class TaskModelSetting(Base, TimestampMixin):
    """任务模型映射。

    Attributes:
        scope_corpus_id: NULL = 全局映射；NOT NULL = 该 Corpus 专属映射。
        task_key: 任务标识符（如 ``consolidation.fact_extract``、``knowledge.kg.extraction.entity``）。
        model_config_id: 指向 ``model_configs.id``；该模型被禁用时由 resolver 自动回退。
    """

    __tablename__ = "task_model_settings"

    # 复合主键：(scope_corpus_id, task_key)。
    # 注意：PostgreSQL 复合主键允许 NULL，但 PK 唯一性约束会把 (NULL, 'x') 视为各自不同，
    # 因此还需要一条偏唯一索引（在 migration 中创建）来保证全局映射 (NULL, task_key) 唯一。
    scope_corpus_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        fk("corpus", ondelete="CASCADE"),
        primary_key=True,
        nullable=True,
    )
    task_key: Mapped[str] = mapped_column(String(128), primary_key=True)
    model_config_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(f"{NEGENTROPY_SCHEMA}.model_configs.id", ondelete="RESTRICT"),
        nullable=False,
    )

    __table_args__ = (
        # Corpus 级查询加速：列出某 Corpus 的所有任务映射。
        Index("ix_task_model_settings_corpus", "scope_corpus_id"),
        # 模型反查加速：找出依赖某 model_config 的所有任务（删除模型前的依赖检查）。
        Index("ix_task_model_settings_model", "model_config_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )
