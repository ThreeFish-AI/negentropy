"""Routine 编排引擎 — 长周期自主任务的 Evaluator-Optimizer 闭环。

模块职责（正交分解）：
- ``decision``：纯函数守卫与决策逻辑（无 IO，可单元测试）。
- ``prompt_builder``：构建含目标 + 验收标准 + 累积反思的执行 prompt（Reflexion 注入）。
- ``runner``：进程内后台执行器注册表 + 全局并发信号量；非阻塞调用 ClaudeCodeService。
- ``evaluator``：LLM-as-Judge + 可选命令门控，产出 score / verdict / reflection。
- ``bus``：RoutineBus，SSE 事件 fan-out（复用 ExecutionBus 范式）。
- ``orchestrator``：RoutineOrchestrator.inspect_once() 主控制循环（reap → eval → dispatch）。

设计取舍见 ``docs/concepts/039-the-routine-system.md``。
"""

from __future__ import annotations

from .orchestrator import RoutineOrchestrator, get_orchestrator

__all__ = ["RoutineOrchestrator", "get_orchestrator"]
