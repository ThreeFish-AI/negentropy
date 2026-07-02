"""自进化子系统配置 — GEPA 进化提案器 + 记忆检索参数自进化。

env 前缀 ``NE_EVOLUTION_``；YAML 节点 ``evolution:``。
特性默认全关（``enabled=False``、``auto_mode=False``），灰度开启后由 ``evolution_inspector``
心跳驱动。所有阈值同时硬编码在 ``engine/evolution/decision.py`` 作为不变量下限，配置仅提供
可调旋钮（且不可越过代码层硬下限）。

参考文献：
[1] L. A. Agrawal et al., "GEPA," in Proc. ICLR (Oral), 2026. arXiv:2507.19457.
[2] Anthropic, *Building Effective AI Agents*, 2024. 自主回路须含停止条件与预算控制。
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class EvolutionSettings(BaseSettings):
    """自进化子系统配置。

    灰度策略：``enabled`` 总开关 + ``auto_mode``（False=全提案人工审批，True=low-risk 自动进 canary）。
    """

    model_config = SettingsConfigDict(
        env_prefix="NE_EVOLUTION_",
        env_nested_delimiter="__",
        extra="ignore",
        frozen=True,
    )

    enabled: bool = Field(
        default=False,
        description="自进化总开关（默认关）。关闭时 evolution_inspector handler 直接 no-op。",
    )
    auto_mode: bool = Field(
        default=False,
        description="low-risk 提案自动进 canary（跳过 pending_approval）；False=全提案人工审批（首部署默认）。",
    )
    proposer_enabled: bool = Field(default=True, description="proposer 子开关（spawn 新提案）。")
    skill_enabled: bool = Field(
        default=False,
        description="skill_template 面 proposer 子开关（GEPA 变异 prompt_template）；默认关，独立于 retrieval 面。",
    )
    memory_pipeline_enabled: bool = Field(
        default=False,
        description="memory_pipeline_prompt 面 proposer 子开关（GEPA 变异 extractor/reflection/summarizer"
        " prompt）；默认关。",
    )

    inspector_interval_seconds: int = Field(default=300, ge=60, description="evolution_inspector 心跳 tick 间隔（秒）")
    shadow_window_seconds: int = Field(default=3600, ge=300, description="shadow eval 聚合 active 配置的回溯窗口（秒）")
    canary_window_seconds: int = Field(
        default=7200, ge=600, description="canary 窗口时长（秒）；窗口结束后判 promote/rollback"
    )
    max_canary_seconds: int = Field(
        default=21600,
        ge=1800,
        description="canary 最长存活（默认 3×canary_window）；超时强制 rollback（防样本不足无限挂起）",
    )
    canary_bucket_ratio_pct: float = Field(default=10.0, ge=1.0, le=50.0, description="金丝雀流量百分比（默认 10%）")
    runtime_canary_enabled: bool = Field(
        default=False,
        description="skill 离线门通过后是否插入在线分桶灰度窗口（runtime_canary 状态）再全量晋升；"
        "False=离线门通过即全量翻 active_version（综述 §8 离线优先，默认关）",
    )
    runtime_canary_window_seconds: int = Field(
        default=3600,
        ge=300,
        description="runtime_canary 灰度窗口（秒）；窗口到期→全量晋升（在线信号门待 canary_assignment 标记接入）",
    )

    min_samples: int = Field(default=50, ge=10, description="晋升判据最小样本量（每桶检索次数）")
    helpful_ratio_min_improvement: float = Field(
        default=0.02, ge=0.0, description="helpful_ratio 改进下限（shadow 期参考）"
    )
    zero_hit_regression_max: float = Field(default=0.01, ge=0.0, description="zero_hit_rate 容许退化上限")

    weight_lower_bound: float = Field(default=0.3, ge=0.0, le=1.0, description="semantic_weight 硬下界")
    weight_upper_bound: float = Field(default=0.9, ge=0.0, le=1.0, description="semantic_weight 硬上界")
    weight_max_step: float = Field(default=0.10, ge=0.01, le=0.5, description="单步最大变异幅度")

    proposer_model: str | None = Field(default=None, description="proposer 显式模型覆盖")
    longitudinal_recheck_interval_seconds: int = Field(
        default=86400,
        ge=3600,
        description="纵向复评最小间隔（秒，默认 24h）：已晋升对象每隔此窗口在 holdout 集复测一次（综述 §8 #3）",
    )
    longitudinal_drift_max: float = Field(
        default=3.0,
        ge=0.0,
        description="纵向复评容许退化上限（复评 holdout 均值 < 晋升均值 − 此值 → 回退 active_version）",
    )
    max_proposals_per_day: int = Field(default=8, ge=1, description="每日提案数硬上限（blueprint §9.5 预算控制）")
    max_cost_usd_daily: float | None = Field(
        default=None, ge=0.0, description="每日 LLM 成本上限（USD）；None=不限（首部署默认关）"
    )
