"""Pipeline Run 协作式取消信号通道（Process-local Event Registry）。

设计说明
- DB（`status='cancelling'`）是权威信号源，跨 worker / 跨进程重启可见。
- 本模块提供同 worker 进程内的 fast-path：通过 `asyncio.Event` 让 task 在
  下一个检查点（stage 边界 / phase 边界）秒级感知取消请求，避免依赖 DB 轮询
  的延迟。
- 多 worker 部署场景下，cancel API 落到 worker A、task 在 worker B 时，
  worker B 通过 stage 边界处的 DB SELECT 兜底感知 —— 见 PipelineTracker。

参考
- N. Smith, "Notes on structured concurrency, or: Go statement considered harmful,"
  Trio Project Documentation, 2018: cancel-as-request 而非 cancel-as-kill 的
  cooperative cancellation 设计哲学。
- M. Kleppmann, *Designing Data-Intensive Applications*, ch. 9 §9.4: DB 作为
  协调权威源 + 进程内 fast-path 的最终一致模式。
"""

from __future__ import annotations

import asyncio

# 模块级 registry：按 run_id 索引每个活跃 pipeline 的 cancel Event。
# - register 在 PipelineTracker.start() 时调用
# - unregister 在 execute_*_pipeline finally 块调用，确保终态后清理，零内存泄漏
# - asyncio dict 的写读是 event-loop 单线程操作，无需额外锁
_CANCEL_EVENTS: dict[str, asyncio.Event] = {}


def register_cancellable_run(run_id: str) -> asyncio.Event:
    """注册一个可取消 run，返回该 run 的 Event。

    幂等：若已注册（如 BackgroundTasks 重新调度同一 run），返回既有 Event 而非
    覆盖；这样 cancel API 已 set 过的状态不会因二次 register 丢失。
    """
    existing = _CANCEL_EVENTS.get(run_id)
    if existing is not None:
        return existing
    event = asyncio.Event()
    _CANCEL_EVENTS[run_id] = event
    return event


def signal_cancel(run_id: str) -> bool:
    """对 `run_id` 发出进程内取消信号。

    Returns:
        True 表示该 run 在本 worker 进程中（信号已 set，下一个检查点立即生效）；
        False 表示本 worker 中无该 run（task 可能在其他 worker，依赖 DB 兜底）。
    """
    event = _CANCEL_EVENTS.get(run_id)
    if event is None:
        return False
    event.set()
    return True


def is_cancelled(run_id: str) -> bool:
    """同步快速检查 `run_id` 是否已被取消（不阻塞、不 await）。

    chunk 级 hot loop 入口的首选检查方式：O(1) dict lookup，无 DB 压力。
    """
    event = _CANCEL_EVENTS.get(run_id)
    return event is not None and event.is_set()


def unregister_cancellable_run(run_id: str) -> None:
    """清理 registry 条目。在 execute_*_pipeline finally 块中调用，防内存泄漏。"""
    _CANCEL_EVENTS.pop(run_id, None)


def _registry_size() -> int:
    """仅用于测试：返回当前 registry 大小，验证内存泄漏防护。"""
    return len(_CANCEL_EVENTS)
