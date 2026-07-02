"""离线评测子系统数据模型 — eval 四表（套件 / 用例 / 运行 / 结果）。

设计蓝图：``docs/concepts/design/self-evolving-agents.md`` §4（评测子系统）。
本模块把综述 §8「自我改进评测六目标」中的 **held-out gain** 与 **backward retention**
落地为可执行的离线评测基座：每个待进化对象（skill / agent / 检索配置 …）可绑定一个
``EvalSuite``，按 ``is_frozen`` 分出可见集与冻结 holdout 集，``SuiteRunner`` 在其上跑候选
vs 基线的 A/B，``decide_skill_*`` 据此作双相门裁决。

关键不变量（综述 §9.4 防 Goodhart）：
- **冻结 holdout 的结果不回流 proposer**——``visible_results_query`` 是 proposer 读取证据
  的唯一入口，它显式排除 ``partition = 'holdout'`` 的 run。
- ``eval_results.is_frozen_case`` 在运行时从 case 快照下来，使历史门裁决查询不受后续
  case flag 编辑影响（审计完整性）。
- ``eval_results.attribution`` JSONB 记录反事实 Skill Influence Pattern（综述 §8 CTA：
  with-skill vs without-skill 同 case 对齐 → score_delta + influence_label）。

参考文献：
[1] C. Jiang et al., "Self-Improving Agents in the Era of Experience: A Survey of Self- to
    Meta-Evolution," Frontis.AI / Tsinghua University, Jun. 2026. §8 SI 六目标 + SIP-Bench
    T0/T1/T2 协议；§9.4 防 Goodhart 四件套（冻结 holdout）。
[2] Z. Zhou et al., "Counterfactual trace auditing," 2026. with-skill vs without-skill
    轨迹对齐的 Skill Influence Pattern（pass-rate Δ 微小但行为影响显著）。
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy import text as _sa_text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin

# =============================================================================
# 部分索引 WHERE 子句（集中常量，便于审计/改值）
# =============================================================================


def sa_text_frozen_true():
    """部分索引的 WHERE 子句：is_frozen 为真（holdout 集）。"""
    return _sa_text("is_frozen = TRUE")


def sa_text_partition_holdout():
    """部分索引的 WHERE 子句：partition 为 holdout（便于 visible 查询排除）。"""
    return _sa_text("partition = 'holdout'")


# =============================================================================
# 白名单常量（代码层单一事实源；新增 target_kind / 枚举值在此追加）
# =============================================================================

# eval_suites.target_kind / eval_runs.target_kind —— 待评测对象类型（与 evolution 子系统
# target_kind 语义对齐但独立白名单：评测可覆盖尚未接入进化的对象）。
TARGET_KIND_SKILL = "skill"
TARGET_KIND_MEMORY_PIPELINE_PROMPT = "memory_pipeline_prompt"
TARGET_KIND_AGENT = "agent"
TARGET_KIND_MEMORY_RETRIEVAL = "memory_retrieval"
TARGET_KIND_KNOWLEDGE_RETRIEVAL = "knowledge_retrieval"
TARGET_KIND_BUILTIN_TOOL = "builtin_tool"
TARGET_KIND_MCP_TOOL = "mcp_tool"
TARGET_KIND_PIPELINE = "pipeline"
TARGET_KIND_KG_EXTRACTION = "kg_extraction"
ALLOWED_EVAL_TARGET_KINDS: tuple[str, ...] = (
    TARGET_KIND_SKILL,
    TARGET_KIND_MEMORY_PIPELINE_PROMPT,
    TARGET_KIND_AGENT,
    TARGET_KIND_MEMORY_RETRIEVAL,
    TARGET_KIND_KNOWLEDGE_RETRIEVAL,
    TARGET_KIND_BUILTIN_TOOL,
    TARGET_KIND_MCP_TOOL,
    TARGET_KIND_PIPELINE,
    TARGET_KIND_KG_EXTRACTION,
)

# eval_cases.source
CASE_SOURCE_MANUAL = "manual"
CASE_SOURCE_HARVESTED = "harvested"
CASE_SOURCE_SYNTHETIC = "synthetic"
ALLOWED_CASE_SOURCES: tuple[str, ...] = (CASE_SOURCE_MANUAL, CASE_SOURCE_HARVESTED, CASE_SOURCE_SYNTHETIC)

# eval_runs.trigger
RUN_TRIGGER_PROPOSAL = "proposal"
RUN_TRIGGER_SCHEDULED = "scheduled"
RUN_TRIGGER_MANUAL = "manual"
ALLOWED_RUN_TRIGGERS: tuple[str, ...] = (RUN_TRIGGER_PROPOSAL, RUN_TRIGGER_SCHEDULED, RUN_TRIGGER_MANUAL)

# eval_runs.status
RUN_STATUS_RUNNING = "running"
RUN_STATUS_COMPLETED = "completed"
RUN_STATUS_FAILED = "failed"
ALLOWED_RUN_STATUSES: tuple[str, ...] = (RUN_STATUS_RUNNING, RUN_STATUS_COMPLETED, RUN_STATUS_FAILED)

# eval_runs.partition（便利标记：本次 run 覆盖的 case 分片）
RUN_PARTITION_ALL = "all"
RUN_PARTITION_VISIBLE = "visible"
RUN_PARTITION_HOLDOUT = "holdout"
ALLOWED_RUN_PARTITIONS: tuple[str, ...] = (RUN_PARTITION_ALL, RUN_PARTITION_VISIBLE, RUN_PARTITION_HOLDOUT)

# eval_suites.visibility
SUITE_VISIBILITY_PRIVATE = "private"
SUITE_VISIBILITY_TEAM = "team"
SUITE_VISIBILITY_PUBLIC = "public"
ALLOWED_SUITE_VISIBILITIES: tuple[str, ...] = (
    SUITE_VISIBILITY_PRIVATE,
    SUITE_VISIBILITY_TEAM,
    SUITE_VISIBILITY_PUBLIC,
)


# =============================================================================
# 表 1：eval_suites（评测套件）
# =============================================================================


class EvalSuite(Base, UUIDMixin, TimestampMixin):
    """评测套件：绑定一个待评测对象 + 评分配置 + holdout 比例。

    ``scoring_config`` JSONB schema（由 SuiteRunner 消费）：
    ``{judge_model?, rubric, acceptance_criteria, verification_command?, pass_threshold,
    weight defaults, max_judge_calls?, execution_mode?}``。

    ``holdout_ratio`` 为 seeding 期目标切分比例；权威的 frozen 标志落在 ``EvalCase.is_frozen``
    （便于个别 case 手动调整）。``is_frozen`` 套件级默认仅作 seeding 时未显式指定 case 的回退。
    """

    __tablename__ = "eval_suites"

    target_kind: Mapped[str] = mapped_column(String(32), nullable=False, comment="白名单见 ALLOWED_EVAL_TARGET_KINDS")
    target_ref: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="target 稳定标识；skill = skill name；agent = agent name；retrieval = config scope",
    )
    scoring_config: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default="{}",
        comment="{judge_model, rubric, acceptance_criteria, verification_command?, pass_threshold, ...}",
    )
    is_frozen: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="套件级默认 frozen 标志（seeding 回退）；权威 frozen 在 EvalCase.is_frozen",
    )
    holdout_ratio: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.2,
        server_default="0.2",
        comment="seeding 期目标 holdout 切分比例",
    )
    is_safety: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="安全套件标记（综述 §8 #6 + §9.3）：晋升须在此集零回退，能力不得以安全退化换取",
    )
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    visibility: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=SUITE_VISIBILITY_PRIVATE,
        server_default=SUITE_VISIBILITY_PRIVATE,
        comment="private|team|public",
    )

    __table_args__ = (
        Index("ix_eval_suites_target", "target_kind", "target_ref"),
        Index("ix_eval_suites_owner", "owner_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )


# =============================================================================
# 表 2：eval_cases（评测用例）
# =============================================================================


class EvalCase(Base, UUIDMixin, TimestampMixin):
    """评测用例：一份输入 + 期望（rubric / 客观校验）+ frozen 标志。

    ``is_frozen`` 是 holdout 分区的**权威标志**（综述 §9.4 防 Goodhart 双轨）：
    - 可见集（``is_frozen=false``）：提案优化时可见，允许拟合；
    - 冻结 holdout（``is_frozen=true``）：仅晋升裁决时运行，**结果不回流 proposer**。

    ``input`` JSONB：``{task, variables?, context?}``（SkillExecutor 用 variables 渲染模板）。
    ``expected`` JSONB：``{rubric, verification_command?, acceptance_criteria?}``。
    ``provenance_ref``：``source=harvested`` 时溯源，如 ``tool_invocation:<uuid>``。
    """

    __tablename__ = "eval_cases"

    suite_id: Mapped[str] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.eval_suites.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_frozen: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="holdout 权威标志；true = 冻结集（不回流 proposer）",
    )
    input: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, comment="{task, variables?, context?}")
    expected: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True, comment="{rubric, verification_command?, acceptance_criteria?}"
    )
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0, server_default="1.0")
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    source: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=CASE_SOURCE_MANUAL,
        server_default=CASE_SOURCE_MANUAL,
        comment="manual|harvested|synthetic",
    )
    provenance_ref: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_eval_cases_suite", "suite_id"),
        # holdout 集查询加速（门裁决只跑 frozen case）
        Index("ix_eval_cases_suite_frozen", "suite_id", postgresql_where=sa_text_frozen_true()),
        {"schema": NEGENTROPY_SCHEMA},
    )


# =============================================================================
# 表 3：eval_runs（一次评测运行）
# =============================================================================


class EvalRun(Base, UUIDMixin, TimestampMixin):
    """评测运行：对某 target 的指定 version（+ 可选 baseline_version）跑一次 suite 的某分片。

    ``partition`` 便利标记本次覆盖的 case 分片（visible|holdout|all），缓存以避免 join。
    ``baseline_version`` 给出 parent 边，使 ``(target, suite)`` 上的 version 链成为综述 §8
    SIP-Bench T0/T1/T2 纵向稳定性轨迹。
    ``regression_count`` 由 SuiteRunner 对比 baseline run 计算后写入。
    """

    __tablename__ = "eval_runs"

    suite_id: Mapped[str] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.eval_suites.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    target_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    target_version: Mapped[str] = mapped_column(String(50), nullable=False, comment="候选 version（被评测）")
    baseline_version: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="基线 version（双相门对比的 parent 边）"
    )
    trigger: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=RUN_TRIGGER_MANUAL,
        server_default=RUN_TRIGGER_MANUAL,
        comment="proposal|scheduled|manual",
    )
    score_mean: Mapped[float | None] = mapped_column(Float, nullable=True)
    pass_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    cost_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    latency_p95: Mapped[float | None] = mapped_column(Float, nullable=True)
    regression_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        comment="相对 baseline run 的 case 回退数（ScoreDelta < -阈值）",
    )
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=RUN_STATUS_RUNNING,
        server_default=RUN_STATUS_RUNNING,
        comment="running|completed|failed",
    )
    partition: Mapped[str | None] = mapped_column(
        String(16), nullable=True, comment="visible|holdout|all（便利标记；防 Goodhart 查询依据）"
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_eval_runs_target", "target_kind", "target_ref", "target_version"),
        Index("ix_eval_runs_status", "status"),
        Index("ix_eval_runs_suite", "suite_id"),
        Index("ix_eval_runs_baseline", "target_kind", "target_ref", "baseline_version"),
        {"schema": NEGENTROPY_SCHEMA},
    )


# =============================================================================
# 表 4：eval_results（单 case 评分 + 审计 + 反事实归因）
# =============================================================================


class EvalResult(Base, UUIDMixin, TimestampMixin):
    """单 case 的 Judge 评分结果 + 全过程审计 + 反事实归因载荷。

    ``judge_raw`` JSONB 对齐 ``evaluator.py`` 全过程审计：``{judge_prompt, judge_raw_content,
    gate_output, reflection, progress_evidence}``。
    ``is_frozen_case`` 在运行时从 case 快照下来，使历史门裁决查询不受后续 case flag 编辑影响。
    ``attribution`` JSONB 仅在反事实子采样时写入（综述 §8 CTA 的 Skill Influence Pattern）。
    """

    __tablename__ = "eval_results"

    run_id: Mapped[str] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.eval_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    case_id: Mapped[str] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.eval_cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    score: Mapped[float] = mapped_column(Float, nullable=False, comment="0-100（对齐 evaluator.py 评分尺度）")
    verdict: Mapped[str | None] = mapped_column(
        String(32), nullable=True, comment="pass|progressing|stalled|regressed|unrecoverable"
    )
    output_digest: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="执行输出 sha256[:12]（16KB 上限体）"
    )
    judge_raw: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True, comment="全过程审计载荷")
    is_frozen_case: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        comment="运行时从 case 快照（审计完整性：历史门裁决不受后续 flag 编辑影响）",
    )
    attribution: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="反事实 Skill Influence Pattern：{with_version,without_version,with_score,...}",
    )

    __table_args__ = (
        Index("ix_eval_results_run", "run_id"),
        # 一 run 一 case 唯一（防重复写入）
        Index("uq_eval_results_run_case", "run_id", "case_id", unique=True),
        # frozen case 查询加速（holdout 门裁决）
        Index("ix_eval_results_run_frozen", "run_id", postgresql_where=_sa_text("is_frozen_case = TRUE")),
        {"schema": NEGENTROPY_SCHEMA},
    )
