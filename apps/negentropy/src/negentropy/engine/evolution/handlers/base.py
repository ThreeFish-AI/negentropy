"""TargetHandler —— 按 target_kind 分派的进化面抽象基类。

设计动机（综述 §7 meta-layer + 蓝图 §10 注记「第二面接入时再抽 TargetHandler 基类一次到位」）：
原 ``orchestrator`` 把 retrieval 面的 shadow/canary/promote/rollback/spawn 硬编码为方法；
本抽象把这些收敛为 per-target_kind 的 handler 接口，orchestrator 退化为「reap + 按类分派 +
遍历 spawn」的薄编排层。第二面（skill_template）接入只需新增 handler 子类，零改动 orchestrator。

接口契约：
- ``advance_shadow`` / ``advance_canary``：推进状态机（shadow→canary/pending/rejected；
  canary→promote/rollback/hold）。窗口未到期 / 样本不足等「留态」由 handler 自判。
- ``rollback``：暴露给 orchestrator 的 REAP（canary 超时强制回滚）+ handler 内 canary 退化复用。
- ``maybe_spawn``：单在途（per ``target_ref``）+ 预算守卫 + bg 调 proposer 落 shadow_eval 提案行。
  返回 0（本轮不 spawn）或 1（已派发 bg task）。

不变量：handler 不直接 commit；commit 由 orchestrator 在 ADVANCE tick 末统一执行（事务边界不变）。
REAP 路径的 rollback 自带 commit（对齐原 _reap_stale_canary 逐行 commit 语义）。

参考文献：
[1] J. Zhang et al., "Darwin Gödel machine," arXiv:2505.22954, 2025. 档案库进化 + 评估门控。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime


class TargetHandler(ABC):
    """进化面 handler 抽象基类。每个 ``target_kind`` 一个实现。"""

    target_kind: str = ""

    @abstractmethod
    async def advance_shadow(self, db, proposal, now: datetime) -> None:
        """shadow_eval → canary | pending_approval | rejected。"""

    @abstractmethod
    async def advance_canary(self, db, proposal, now: datetime) -> None:
        """canary 窗口到期 → promote | rollback | hold。窗口未到期 → 留 canary。"""

    @abstractmethod
    async def rollback(self, db, proposal, now: datetime) -> None:
        """回滚到基线（REAP 超时强制回滚 + canary 退化复用）。"""

    @abstractmethod
    async def maybe_spawn(self) -> int:
        """单在途（per target_ref）+ 预算守卫 → bg 调 proposer 落 shadow_eval 提案行。返回 0|1。"""

    async def recheck_longitudinal(self, db, proposal, now: datetime):
        """纵向复评（综述 §8 #3 + §10.5 + §9.3 持续再认证）。

        默认 no-op（返回 ``skip``）——无离线 eval 基座的面（如 retrieval 用在线 window 指标）
        不经此路径。有 eval 基座的面（skill）override：复跑 holdout 集 vs 晋升均值，drift 则回退
        ``active_version``。返回 ``Decision``（action ∈ promote/rollback/hold/skip）。
        """
        from ..decision import Decision

        return Decision("skip", reason="no_recheck_substrate")
