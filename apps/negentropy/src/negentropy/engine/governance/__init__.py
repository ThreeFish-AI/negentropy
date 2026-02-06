"""
Engine Governance Module

提供 Memory 治理服务，包括审计决策处理、版本控制和遗忘曲线计算。

职责:
1. 记忆审计决策处理 (retain/delete/anonymize)
2. 版本冲突检测与幂等性保障
3. 记忆保留策略执行（基于艾宾浩斯遗忘曲线）

遵循 AGENTS.md 原则:
- 正交分解: Memory Governance 与 Knowledge Base 完全独立
- 边界管理: Engine 层负责业务逻辑，Adapters 层负责数据访问
- 复用驱动: 复用现有的 ORM 模型和会话工厂

参考文献:
[1] A. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," 1885.
"""

from .memory import MemoryGovernanceService

__all__ = ["MemoryGovernanceService"]
