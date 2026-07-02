"""自进化子系统（GEPA 进化提案器 + 记忆检索参数自进化）。

第一切片（对齐 docs/concepts/design/self-evolving-agents.md Phase 3 记忆检索权重面）：
- ``decision`` 纯函数护栏（晋升/回滚判据）；
- ``canary`` thread→桶 路由纯函数；
- ``weights`` active 配置解析 + TTL 缓存 + 代码常量兜底；
- ``proposer`` GEPA 式反思驱动变异（镜像 reflection_generator）；
- ``eval_runner`` 记忆面窗口在线指标对比（不建 eval 四表）；
- ``orchestrator`` 状态机 tick（evolution_inspector 心跳驱动）。

后续阶段（agent/skill/knowledge 面、Phase 1 tool_invocations 遥测、eval 四表、归因 job）
复用本包的 decision/orchestrator/proposer 骨架，仅扩 target_kind 白名单 + 各面 eval_runner。
"""

from __future__ import annotations

from .orchestrator import EvolutionOrchestrator, get_evolution_orchestrator

__all__ = ["EvolutionOrchestrator", "get_evolution_orchestrator"]
