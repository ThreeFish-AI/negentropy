"""进程隔离的引擎 Worker 池，支持"取消即杀进程"语义。

问题动机：
    MCP Client 取消请求时，服务端用 ``asyncio.to_thread`` 包装的 PDF 引擎
    (Docling/MinerU/Marker) 无法被真正停止——Python 线程无法强制 kill，
    原生 C++/CUDA 推理继续占用 CPU/GPU/显存直至自然结束。

解决思路（参考业界经典）：
    - **Celery `terminate=True`**：任务撤销时向 worker 发送 SIGTERM，
      彻底释放资源
    - **Gunicorn worker respawn**：worker 崩溃或被 kill 后 supervisor
      自动补齐，维持 pool 规模
    - **Erlang/OTP Supervisor Pattern**：let it crash + supervisor
      restart，让错误就地隔离
    - **Chromium 进程隔离**：把不可中断的原生代码放进子进程，保留主进程对
      生命周期的掌控

本模块职责：
    - ``EngineWorker``：封装一个子进程，通过 ``multiprocessing.Pipe`` 发送
      请求、接收结果，按需 terminate/kill
    - ``EngineWorkerPool``：supervisor 角色，每引擎维护一枚常驻 worker；
      任务取消时立即 pop + 后台 terminate 旧 worker，下次请求按需懒启动
      新 worker；按 ``max_tasks`` 周期性回收预防内存泄漏
    - ``isolation`` 支持三档：
      - ``"process"`` — 默认，真正释放资源
      - ``"thread"`` — 事件循环保持响应但线程无法被杀（仅作回退）
      - ``"inline"`` — 调试用，同步执行
"""

from __future__ import annotations

import asyncio
import atexit
import logging
import multiprocessing as mp
import os
import signal
import uuid
from multiprocessing.connection import Connection
from multiprocessing.context import SpawnProcess
from typing import Any, Dict, Optional

from . import _engine_worker_entry

logger = logging.getLogger(__name__)


def _safe_log(level: int, msg: str, *args: Any) -> None:
    """日志写入；在解释器退出阶段 stdio 可能已被关闭，此时静默失败即可。"""
    try:
        logger.log(level, msg, *args)
    except Exception:  # nosec B110
        pass


__all__ = [
    "EngineWorker",
    "EngineWorkerPool",
    "get_engine_pool",
    "set_engine_pool",
    "shutdown_engine_pool",
]


# ---------------------------------------------------------------------------
# 单 worker 封装
# ---------------------------------------------------------------------------


class EngineWorker:
    """单个子进程包装；承载一枚引擎实例。

    生命周期：``start()`` 拉起子进程并等待 ``ready`` 握手 → ``call()``
    发送请求并 await 响应（可被取消，取消时由 Pool 调 ``terminate()`` 强杀）。
    """

    def __init__(
        self,
        engine: str,
        *,
        max_tasks: int = 50,
        kill_grace: float = 2.0,
    ) -> None:
        self.engine = engine
        self._max_tasks = max_tasks
        self._kill_grace = kill_grace
        self._proc: Optional[SpawnProcess] = None
        self._conn: Optional[Connection] = None
        self._task_count = 0

    @property
    def pid(self) -> Optional[int]:
        return getattr(self._proc, "pid", None)

    def is_alive(self) -> bool:
        return self._proc is not None and self._proc.is_alive()

    def needs_recycle(self) -> bool:
        return self._task_count >= self._max_tasks

    async def start(self) -> None:
        """拉起子进程并等待 ``ready`` 握手。"""
        ctx = mp.get_context("spawn")
        parent_conn, child_conn = ctx.Pipe(duplex=True)
        # daemon=False：Marker 等引擎内部使用 torch DataLoader / Surya OCR
        # 的子进程池，Python 禁止 daemon 进程再派生子进程（"daemonic processes
        # are not allowed to have children"）。为避免父进程异常退出留下孤儿，
        # 在模块级 atexit 与 shutdown_engine_pool 路径中兜底强杀。
        proc = ctx.Process(
            target=_engine_worker_entry.worker_main,
            args=(child_conn, self.engine),
            name=f"engine-worker-{self.engine}",
            daemon=False,
        )
        proc.start()
        # 父进程关闭子端句柄；子进程会保留自己的一份
        try:
            child_conn.close()
        except Exception:  # nosec B110
            pass

        self._proc = proc
        self._conn = parent_conn

        # 等待 ready 握手（阻塞 recv 在线程里，避免卡 event loop）
        try:
            msg = await asyncio.to_thread(parent_conn.recv)
        except Exception as e:
            await self.terminate()
            raise RuntimeError(f"engine {self.engine} 启动握手失败: {e}") from e

        msg_type = msg.get("type") if isinstance(msg, dict) else None
        if msg_type == "init_error":
            err = msg.get("error", "init failed")  # type: ignore[union-attr]
            await self.terminate()
            raise RuntimeError(f"engine {self.engine} 初始化失败: {err}")
        if msg_type != "ready":
            await self.terminate()
            raise RuntimeError(f"engine {self.engine} 启动返回意外: {msg!r}")

        logger.info("EngineWorker %s 就绪 pid=%s", self.engine, proc.pid)

    async def call(
        self,
        method: str,
        kwargs: Dict[str, Any],
        *,
        init_kwargs: Optional[Dict[str, Any]] = None,
        deadline_monotonic: Optional[float] = None,
    ) -> Any:
        """执行 RPC 调用；取消时 ``asyncio.to_thread`` 抛 ``CancelledError``。

        ``init_kwargs`` 透传给子进程，由其决定是否需要重建引擎实例。
        """
        if self._conn is None or not self.is_alive():
            raise RuntimeError(f"worker {self.engine} 不可用")

        req_id = str(uuid.uuid4())
        request = {
            "type": "call",
            "id": req_id,
            "method": method,
            "kwargs": kwargs,
            "init_kwargs": init_kwargs or {},
            "deadline_monotonic": deadline_monotonic,
        }
        # send 是同步 pickle 写入；对小 dict 近似瞬时完成
        self._conn.send(request)
        self._task_count += 1

        response = await asyncio.to_thread(self._conn.recv)

        if not isinstance(response, dict):
            raise RuntimeError(f"worker {self.engine} 返回非法响应: {response!r}")
        if response.get("id") != req_id:
            raise RuntimeError(
                f"响应 id 不匹配: expected {req_id}, got {response.get('id')}"
            )
        if response.get("ok") is True:
            return response.get("result")

        exc_class = response.get("exc_class", "RuntimeError")
        error = response.get("error", "未知错误")
        if exc_class == "TimeoutError":
            raise TimeoutError(error)
        raise RuntimeError(f"{exc_class}: {error}")

    async def terminate(self) -> None:
        """SIGTERM → grace → SIGKILL；之后清理 conn/proc 引用。"""
        proc = self._proc
        if proc is None:
            self._cleanup()
            return
        if not proc.is_alive():
            self._cleanup()
            return

        pid = proc.pid
        _safe_log(
            logging.INFO,
            "EngineWorker %s 发送 SIGTERM pid=%s grace=%.1fs",
            self.engine,
            pid,
            self._kill_grace,
        )
        try:
            proc.terminate()
        except Exception as e:
            _safe_log(logging.WARNING, "terminate() 异常 pid=%s: %s", pid, e)

        try:
            await asyncio.to_thread(proc.join, self._kill_grace)
        except Exception:  # nosec B110
            # join 超时/异常不阻塞后续 SIGKILL 路径
            pass

        if proc.is_alive():
            _safe_log(
                logging.WARNING,
                "EngineWorker %s 未在 %.1fs 内退出, 发送 SIGKILL pid=%s",
                self.engine,
                self._kill_grace,
                pid,
            )
            try:
                proc.kill()
            except Exception as e:
                _safe_log(logging.WARNING, "kill() 异常 pid=%s: %s", pid, e)
            try:
                await asyncio.to_thread(proc.join, 1.0)
            except Exception:  # nosec B110
                pass

        self._cleanup()

    async def shutdown(self) -> None:
        """优雅下线：发送 shutdown 指令，超时则 terminate。"""
        proc = self._proc
        if proc is None or not proc.is_alive():
            self._cleanup()
            return
        try:
            if self._conn is not None:
                self._conn.send({"type": "shutdown"})
        except Exception:  # nosec B110
            # 发送 shutdown 失败则直接走 terminate 兜底
            pass
        try:
            await asyncio.to_thread(proc.join, 1.0)
        except Exception:  # nosec B110
            pass
        if proc is not None and proc.is_alive():
            await self.terminate()
        else:
            self._cleanup()

    def _cleanup(self) -> None:
        try:
            if self._conn is not None:
                self._conn.close()
        except Exception:  # nosec B110
            pass
        self._conn = None
        self._proc = None


# ---------------------------------------------------------------------------
# Pool（Supervisor）
# ---------------------------------------------------------------------------


class EngineWorkerPool:
    """按引擎维护常驻 worker；支持三档隔离策略与取消即杀语义。

    调用流程（默认 ``isolation="process"``）：
        1. ``run(engine, method, kwargs, deadline_monotonic)``
        2. 取该引擎的 ``asyncio.Lock``，串行化同引擎请求
        3. 按需 ``start()`` 新 worker（首次或上次被杀）
        4. ``worker.call(...)`` 执行 RPC
        5. 异常处理：
           - ``CancelledError`` → pop worker，后台 ``terminate()``，re-raise
           - 其他 Exception + 进程已死 → pop worker，re-raise
           - 正常完成 + 任务数达 ``max_tasks`` → pop worker，后台 shutdown
    """

    def __init__(
        self,
        *,
        isolation: str = "process",
        max_tasks_per_worker: int = 50,
        kill_grace: float = 2.0,
    ) -> None:
        self._isolation = isolation
        self._max_tasks = max_tasks_per_worker
        self._kill_grace = kill_grace
        self._workers: Dict[str, EngineWorker] = {}
        self._engine_locks: Dict[str, asyncio.Lock] = {}
        self._meta_lock = asyncio.Lock()
        self._closed = False

    @property
    def isolation(self) -> str:
        return self._isolation

    @property
    def workers(self) -> Dict[str, EngineWorker]:
        return self._workers

    async def _get_engine_lock(self, engine: str) -> asyncio.Lock:
        async with self._meta_lock:
            lock = self._engine_locks.get(engine)
            if lock is None:
                lock = asyncio.Lock()
                self._engine_locks[engine] = lock
            return lock

    async def _ensure_worker(self, engine: str) -> EngineWorker:
        existing = self._workers.get(engine)
        if existing is not None and existing.is_alive():
            return existing
        worker = EngineWorker(
            engine,
            max_tasks=self._max_tasks,
            kill_grace=self._kill_grace,
        )
        await worker.start()
        self._workers[engine] = worker
        return worker

    async def run(
        self,
        engine: str,
        method: str = "convert",
        *,
        kwargs: Optional[Dict[str, Any]] = None,
        init_kwargs: Optional[Dict[str, Any]] = None,
        deadline_monotonic: Optional[float] = None,
    ) -> Any:
        """分发调用到指定引擎的 worker。取消时强杀并重建。

        ``init_kwargs`` 为引擎构造参数；process 模式下透传子进程懒实例化，
        thread/inline 模式下在主进程就地实例化。子进程内对 ``init_kwargs``
        做哈希缓存，哈希变化时原地重建，不重启子进程。
        """
        if self._closed:
            raise RuntimeError("EngineWorkerPool 已关闭")
        kwargs = kwargs or {}

        # inline 模式：仅调试；同步执行
        if self._isolation == "inline":
            inst = _engine_worker_entry._load_engine(engine, init_kwargs)
            return getattr(inst, method)(**kwargs)

        # thread 模式：回退方案；不能真正 kill 但能解除事件循环阻塞
        if self._isolation == "thread":
            inst = _engine_worker_entry._load_engine(engine, init_kwargs)
            return await asyncio.to_thread(lambda: getattr(inst, method)(**kwargs))

        # process 模式（默认）
        engine_lock = await self._get_engine_lock(engine)
        async with engine_lock:
            worker = await self._ensure_worker(engine)
            try:
                result = await worker.call(
                    method,
                    kwargs,
                    init_kwargs=init_kwargs,
                    deadline_monotonic=deadline_monotonic,
                )
            except asyncio.CancelledError:
                pid = worker.pid
                logger.info(
                    "EngineWorkerPool 收到取消, 强杀 worker engine=%s pid=%s",
                    engine,
                    pid,
                )
                if self._workers.get(engine) is worker:
                    self._workers.pop(engine, None)
                asyncio.create_task(worker.terminate())
                raise
            except Exception:
                # 子进程已挂：从 pool 摘除，让下次请求重建
                if not worker.is_alive() and self._workers.get(engine) is worker:
                    self._workers.pop(engine, None)
                raise
            # 正常完成：按需周期回收
            if worker.needs_recycle():
                logger.info(
                    "EngineWorker %s 达到 max_tasks=%d, 周期性回收",
                    engine,
                    self._max_tasks,
                )
                if self._workers.get(engine) is worker:
                    self._workers.pop(engine, None)
                asyncio.create_task(worker.shutdown())
            return result

    async def warmup(self, engine: str) -> bool:
        """预热指定引擎的 worker：仅启动子进程 + ready 握手 + torch first-touch。

        与 :meth:`run` 的差异：
        - 不发送任何 RPC 请求，不递增 ``task_count``，不消耗 max_tasks 额度；
        - inline / thread 模式直接 no-op 返回 True（无子进程开销）；
        - 失败不抛出，仅返回 False 由调用侧决定是否重试。

        典型用法：在 preprocessing/quick_scan 这类轻量 stage 期间，把
        ~2-12s 的 spawn + torch import + MPS first-touch 开销移出
        layout_analysis 的关键路径。

        Returns:
            True = worker 已就绪（或非 process 模式无需预热）；False = 预热失败
        """
        if self._closed:
            return False
        if self._isolation != "process":
            return True

        engine_lock = await self._get_engine_lock(engine)
        async with engine_lock:
            try:
                worker = await self._ensure_worker(engine)
                logger.info(
                    "EngineWorker %s 预热完成 pid=%s（不计入 max_tasks）",
                    engine,
                    worker.pid,
                )
                return True
            except Exception as e:  # noqa: BLE001 - 预热失败不阻塞主流程
                logger.warning("EngineWorker %s 预热失败: %s", engine, e)
                return False

    async def shutdown(self) -> None:
        """关停所有 worker（优雅 → 强杀兜底）。"""
        self._closed = True
        async with self._meta_lock:
            workers = list(self._workers.values())
            self._workers.clear()
        for w in workers:
            try:
                await w.shutdown()
            except Exception as e:
                logger.warning("shutdown worker %s 异常: %s", w.engine, e)


# ---------------------------------------------------------------------------
# 模块级 Pool 单例：供 processor/orchestrator/pipeline 等下游就地访问
# ---------------------------------------------------------------------------


_pool_singleton: Optional[EngineWorkerPool] = None


def get_engine_pool() -> EngineWorkerPool:
    """获取全局引擎 Worker Pool 单例；若未预置则按 settings 懒加载。

    生产场景建议由 app 启动路径显式 ``set_engine_pool`` 注入，并在退出时
    ``shutdown_engine_pool``；未显式注入时退化为按当前进程 settings 懒创建，
    便于测试与脚本场景零配置可用。
    """
    global _pool_singleton
    if _pool_singleton is None:
        try:
            from ..config import settings
        except Exception:
            settings = None  # type: ignore[assignment]

        isolation = (
            getattr(settings, "pdf_engine_isolation", "process")
            if settings
            else "process"
        )
        max_tasks = (
            int(getattr(settings, "pdf_worker_max_tasks", 50)) if settings else 50
        )
        kill_grace = (
            float(getattr(settings, "pdf_worker_kill_grace_seconds", 2.0))
            if settings
            else 2.0
        )

        _pool_singleton = EngineWorkerPool(
            isolation=isolation,
            max_tasks_per_worker=max_tasks,
            kill_grace=kill_grace,
        )
    return _pool_singleton


def set_engine_pool(pool: Optional[EngineWorkerPool]) -> None:
    """显式注入 Pool 单例（由 app 启动路径调用）。传 None 清除。"""
    global _pool_singleton
    _pool_singleton = pool


async def shutdown_engine_pool() -> None:
    """关闭全局 Pool 并释放所有 worker（app 退出路径调用）。"""
    global _pool_singleton
    pool = _pool_singleton
    _pool_singleton = None
    if pool is not None:
        try:
            await pool.shutdown()
        except Exception as e:
            logger.warning("shutdown_engine_pool 异常: %s", e)


# ---------------------------------------------------------------------------
# atexit 兜底：daemon=False 后若父进程异常退出（未走 shutdown_engine_pool），
# 需显式 SIGKILL 所有仍存活的 worker，否则子进程会阻塞父进程真正退出或变成
# 孤儿。此 hook 仅做同步强杀，不依赖事件循环，也不抛异常。
# ---------------------------------------------------------------------------


def _cleanup_on_exit() -> None:
    """atexit 钩子：同步 SIGKILL 所有仍存活的 worker 子进程。"""
    pool = _pool_singleton
    if pool is None:
        return
    workers = list(pool._workers.values())
    for w in workers:
        proc = w._proc
        if proc is None or not proc.is_alive():
            continue
        pid = proc.pid
        _safe_log(
            logging.WARNING,
            "atexit 强杀未清理的 engine worker engine=%s pid=%s",
            w.engine,
            pid,
        )
        # 优先 SIGTERM，短 grace 后 SIGKILL（解释器退出阶段不能 await）
        try:
            proc.terminate()
        except Exception:  # nosec B110
            pass
        try:
            proc.join(0.5)
        except Exception:  # nosec B110
            pass
        if proc.is_alive():
            try:
                proc.kill()
            except Exception:  # nosec B110
                pass
            try:
                proc.join(0.5)
            except Exception:  # nosec B110
                pass
        # 兜底：若父进程已无权 kill（例如 PID 复用），尝试直接 SIGKILL
        if proc.is_alive() and pid is not None:
            try:
                os.kill(pid, signal.SIGKILL)
            except Exception:  # nosec B110
                pass


atexit.register(_cleanup_on_exit)
