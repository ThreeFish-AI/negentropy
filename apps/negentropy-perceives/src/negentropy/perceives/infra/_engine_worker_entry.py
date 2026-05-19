"""引擎 worker 子进程入口点。

独立运行于 ``multiprocessing.Process`` 中，接收主进程通过 ``multiprocessing.Pipe``
发来的请求，按需懒加载对应引擎并执行 ``convert()``（或其他方法），将结果回送。

Why 子进程：
- Docling/MinerU/Marker 的原生推理（C++/CUDA）阻塞 Python 事件循环与 GIL，
  Python 线程无法被强制 kill；只有进程级终止（SIGTERM/SIGKILL）能真正释放
  GPU/显存与 CPU 占用。
- 每个引擎一个独立子进程，崩溃与被 kill 都不影响主进程，供 Pool 层按
  Erlang/OTP Supervisor Pattern 重建。

进程内启用懒加载：
- 子进程启动即立刻回送 ``ready``；首个 ``call`` 到达时按 ``init_kwargs`` 懒
  实例化引擎对象，后续调用若 ``init_kwargs`` 哈希发生变化则原地重建（不重
  启进程）。模型权重通常由底层库做全局缓存，原地重建成本远低于进程重启。
- 内置 ``_fake_slow`` / ``_fake_fast`` / ``_fake_crash`` 三个调试引擎，
  用于在集成测试中验证"取消→kill→重建"链路，无需真实 PDF 库依赖。
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
import time
import traceback
from collections import OrderedDict
from multiprocessing.connection import Connection
from typing import Any, Dict, Optional, Tuple

# ── 子进程内 convert 结果缓存（LRU + TTL）──────────────────────────────────
#
# 动机：Pipeline 把同一份 PDF 分发到 `layout_analysis` / `table_extraction` /
# `formula_extraction` / `code_detection` 四个 Stage，每个 Stage 都会对
# Docling/MinerU 发起一次 `convert()` 完整推理。Docling 的
# `DoclingConversionResult` 已一次性聚合 tables/formulas/code/layout，完全没
# 必要重复 3 次（实测每次 30s~120s）。
#
# 设计要点：
# - 仅在真实 torch 引擎（docling / mineru）的 `method=="convert"` 上生效；
#   Marker 不走缓存以免 DataLoader 副作用与大显存占用叠加；Fake 引擎跳过。
# - 键：`(pdf_fingerprint, page_range, init_kwargs_hash, embed_images)`；
#   指纹 = `size + mtime_ns + blake2b(head_64KB)`，业务层 PDF 变更会改 mtime。
# - 容量：LRU=4（覆盖“4 Stage + 1 备用”），TTL=5min（防止 long-lived worker 膨胀）。
# - 子进程单线程事件循环 `while True: recv→execute→send`，缓存无需加锁。

_CACHE_CAPACITY = 4
_CACHE_TTL_SECONDS = 300.0
_CACHEABLE_ENGINES = frozenset({"docling", "mineru", "opendataloader"})


class _ConvertCache:
    """LRU + TTL 缓存，专用于 worker 子进程内的 convert 结果复用。

    TTL 过期与 LRU 淘汰均为懒判定：`get()` 时检查 TTL，`put()` 时执行 LRU；
    子进程单线程运行，无需显式同步。
    """

    def __init__(
        self,
        capacity: int = _CACHE_CAPACITY,
        ttl_seconds: float = _CACHE_TTL_SECONDS,
    ) -> None:
        self._capacity = max(1, capacity)
        self._ttl = max(0.0, ttl_seconds)
        self._store: "OrderedDict[Tuple[Any, ...], Tuple[Any, float]]" = OrderedDict()

    def __len__(self) -> int:
        return len(self._store)

    def get(self, key: Tuple[Any, ...]) -> Optional[Any]:
        """命中则返回 value（并刷新 LRU 顺序）；未命中或过期返回 None。"""
        entry = self._store.get(key)
        if entry is None:
            return None
        value, ts = entry
        if self._ttl > 0 and (time.monotonic() - ts) > self._ttl:
            # 懒过期：删除并视作 miss
            self._store.pop(key, None)
            return None
        self._store.move_to_end(key)
        return value

    def put(self, key: Tuple[Any, ...], value: Any) -> None:
        """写入并淘汰最老条目。`None` 不入缓存（视为失败，上层可重试）。"""
        if value is None:
            return
        self._store[key] = (value, time.monotonic())
        self._store.move_to_end(key)
        while len(self._store) > self._capacity:
            self._store.popitem(last=False)

    def clear(self) -> None:
        self._store.clear()


def _pdf_fingerprint(pdf_path: str) -> Optional[str]:
    """对 PDF 文件生成稳定指纹。

    `size + mtime_ns + blake2b(head_64KB)`：
    - 只读前 64KB，常见 PDF 只需 I/O <1ms；
    - mtime_ns 对业务层“覆盖写”高度敏感；
    - blake2b 校验 header 防极端巧合；
    - 读取失败（如路径不存在）返回 None，上层视作 cache-miss 直接走推理。
    """
    try:
        st = os.stat(pdf_path)
        with open(pdf_path, "rb") as f:
            head = f.read(65536)
    except OSError:
        return None
    digest = hashlib.blake2b(head, digest_size=16, usedforsecurity=False).hexdigest()
    return f"{st.st_size}:{int(st.st_mtime_ns)}:{digest}"


def _make_cache_key(
    engine_name: str,
    kwargs: Dict[str, Any],
    init_hash: str,
) -> Optional[Tuple[Any, ...]]:
    """构造 convert 缓存键；缺失关键字段返回 None 以跳过缓存。"""
    pdf_path = kwargs.get("pdf_path")
    if not pdf_path or not isinstance(pdf_path, str):
        return None
    fingerprint = _pdf_fingerprint(pdf_path)
    if fingerprint is None:
        return None
    page_range = kwargs.get("page_range")
    if isinstance(page_range, list):
        page_range = tuple(page_range)
    embed_images = bool(kwargs.get("embed_images", False))
    return (engine_name, fingerprint, page_range, embed_images, init_hash)


# ── 调试引擎：供集成测试模拟各种场景，不依赖真实 PDF 引擎 ──────────────────


class _FakeSlowEngine:
    """阻塞 sleep_seconds 后返回成功，用于验证 timeout/cancel kill 路径。"""

    def convert(
        self,
        pdf_path: str,
        *,
        sleep_seconds: float = 30.0,
        **_: Any,
    ) -> dict:
        time.sleep(sleep_seconds)
        return {
            "markdown": f"slept {sleep_seconds}s on {pdf_path}",
            "engine_name": "_fake_slow",
            "page_count": 1,
        }


class _FakeFastEngine:
    """立即返回，用于验证正常路径与 worker 复用。"""

    def convert(self, pdf_path: str, **_: Any) -> dict:
        return {
            "markdown": f"fast output from {pdf_path}",
            "engine_name": "_fake_fast",
            "page_count": 1,
        }


class _FakeCrashEngine:
    """主动抛异常，用于验证子进程异常回传与 worker 存活判定。"""

    def convert(self, pdf_path: str, **_: Any) -> dict:
        raise RuntimeError(f"fake crash on {pdf_path}")


def _load_engine(engine_name: str, init_kwargs: Optional[Dict[str, Any]] = None) -> Any:
    """按需懒加载引擎实例。

    ``init_kwargs`` 透传给对应 Engine 的 ``__init__``；对内置 Fake 引擎忽略。
    未知引擎抛 ``ValueError``。
    """

    kw = init_kwargs or {}

    if engine_name == "docling":
        from ..pdf.engines.docling import DoclingEngine

        return DoclingEngine(**kw)
    if engine_name == "mineru":
        from ..pdf.engines.mineru import MinerUEngine

        return MinerUEngine(**kw)
    if engine_name == "marker":
        from ..pdf.engines.marker import MarkerEngine

        return MarkerEngine(**kw)
    if engine_name == "opendataloader":
        from ..pdf.engines.opendataloader import OpenDataLoaderEngine

        return OpenDataLoaderEngine(**kw)
    if engine_name == "_fake_slow":
        return _FakeSlowEngine()
    if engine_name == "_fake_fast":
        return _FakeFastEngine()
    if engine_name == "_fake_crash":
        return _FakeCrashEngine()
    raise ValueError(f"未知引擎: {engine_name}")


def _hash_init_kwargs(init_kwargs: Optional[Dict[str, Any]]) -> str:
    """对 init_kwargs 计算稳定哈希，用于判定是否需要重建引擎。"""
    if not init_kwargs:
        return "__empty__"
    try:
        serialized = json.dumps(init_kwargs, sort_keys=True, default=str)
    except Exception:
        serialized = repr(sorted(init_kwargs.items()))
    return hashlib.sha1(serialized.encode("utf-8"), usedforsecurity=False).hexdigest()


def _preinit_torch_device(logger: logging.Logger) -> None:
    """spawn 子进程内完成 torch 设备预热 + MPS first-touch + 诊断日志。

    **永不抛异常**：任何失败都被吞掉并降级到 CPU 路径，确保 worker 能稳定启动。
    副作用：
    - `PYTORCH_ENABLE_MPS_FALLBACK=1`：仅作算子 fallback 兜底，不禁用 MPS；
    - `NEGENTROPY_MPS_READY=1/0`：把 smoke_test 结果暴露给下游引擎（Docling
      `device_config` 可据此决定是否把 `AcceleratorDevice` 设为 MPS）；
    - 打印一行 `子进程 torch 诊断 {...}` 含版本、start_method、built、
      available、smoke_test（ok / skip:... / fail:ExcName:msg）。
    """
    # 默认 MPS 算子 fallback 兜底；真正禁用 MPS 的开关另行设计
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

    diag: Dict[str, Any] = {
        "start_method": None,
        "torch_version": None,
        "mps_built": None,
        "mps_available_raw": None,
        "mps_smoke_test": "skip:not_darwin",
    }

    try:
        import multiprocessing as mp

        diag["start_method"] = mp.get_start_method(allow_none=True)
    except Exception:  # nosec B110
        pass

    try:
        import torch
    except Exception as e:  # torch 缺失或导入失败，直接回退 CPU
        diag["mps_smoke_test"] = f"fail:torch_import:{type(e).__name__}"
        os.environ["NEGENTROPY_MPS_READY"] = "0"
        # 使用 warning 级别确保在默认 WARNING 日志阈值下也可见；单进程只调用一次
        logger.warning("子进程 torch 诊断 %s", diag)
        return

    diag["torch_version"] = getattr(torch, "__version__", "unknown")

    try:
        diag["mps_built"] = bool(torch.backends.mps.is_built())
    except Exception as e:
        diag["mps_built"] = f"err:{type(e).__name__}:{e}"
    try:
        diag["mps_available_raw"] = bool(torch.backends.mps.is_available())
    except Exception as e:
        diag["mps_available_raw"] = f"err:{type(e).__name__}:{e}"

    # 仅在 darwin 上尝试 first-touch（其他平台无 MPS）
    mps_ready = False
    if sys.platform == "darwin" and diag["mps_built"] is True:
        try:
            # 强化 first-touch：分配 + 矩阵乘 + 保持引用，确保 MPS allocator
            # 与 kernel cache 完整就绪。仅 first-touch 一次 zeros(1) 不足以让
            # docling 内部 decide_device(MPS) → torch.backends.mps.is_available()
            # 稳定返回 True：观察到 first-touch 后 MPS 状态偶发被回收。这里
            # 通过保留模块级引用 _MPS_PIN 防止 tensor 被 GC，将 MPS 上下文
            # 持续锁定在当前子进程生命周期内。
            global _MPS_PIN  # 锚定 MPS 设备状态，避免被 GC 释放
            pin_a = torch.randn(1024, 1024, device="mps")
            pin_b = torch.randn(1024, 1024, device="mps")
            pin_c = pin_a @ pin_b
            try:
                _ = float(pin_c.sum().to("cpu").item())
            except Exception:  # nosec B110 - sum 失败不阻塞 first-touch
                pass
            _MPS_PIN = (pin_a, pin_b, pin_c)
            try:
                if torch.backends.mps.is_available():
                    diag["mps_available_raw"] = True
            except Exception:  # nosec B110
                pass
            diag["mps_smoke_test"] = "ok"
            diag["mps_pin"] = "1024x1024_matmul_pinned"
            mps_ready = True
        except Exception as e:
            diag["mps_smoke_test"] = f"fail:{type(e).__name__}:{str(e)[:120]}"
    elif sys.platform == "darwin":
        diag["mps_smoke_test"] = "skip:mps_not_built"

    os.environ["NEGENTROPY_MPS_READY"] = "1" if mps_ready else "0"

    # Monkey-patch torch.backends.mps.is_available：first-touch 成功后，
    # 将 is_available 锁定为 True，确保 docling 内部
    # accelerator_utils.decide_device()（被 layout_model / table_structure_model /
    # code_formula_model 等 6+ 处调用）稳定识别 MPS。
    #
    # 必要性：spawn 子进程内 MPS allocator 状态不稳定，first-touch 后
    # is_available() 仍可能在模型加载等内存密集操作期间返回 False；
    # docling decide_device 在 76-80 行检测到 False 后直接回退 CPU。
    # 既然 first-touch + smoke_test 已确认 MPS 可用，可以安全地锁定判定结果。
    if mps_ready:
        torch.backends.mps.is_available = lambda: True  # type: ignore[assignment]

    # 根据诊断结果选择日志级别：成功/跳过用 INFO，失败用 WARNING
    _diag_level = (
        logging.WARNING if not mps_ready and sys.platform == "darwin" else logging.INFO
    )
    logger.log(_diag_level, "子进程 torch 诊断 %s", diag)


# MPS first-touch 后保持张量引用，防止 GC 释放 MPS 设备上下文。
# Docling/MinerU/Marker 调用 torch.backends.mps.is_available() 时依赖该状态。
_MPS_PIN: Optional[Any] = None


def worker_main(conn: Connection, engine_name: str) -> None:
    """子进程主循环：ready → 等请求 → 懒加载/执行 → 回写。

    协议：
    - 启动成功：``{"type": "ready"}``（立即发送，无预实例化）
    - 请求：``{"type": "call", "id": str, "method": str,
               "kwargs": dict, "init_kwargs": dict | None,
               "deadline_monotonic": float | None}``
    - 关闭：``{"type": "shutdown"}``
    - 响应：``{"type": "result", "id": str, "ok": bool,
               "result"|"error": ..., "exc_class": str}``
    """

    logging.basicConfig(
        level=logging.WARNING,
        stream=sys.stderr,
        format="%(asctime)s [%(levelname)s] engine_worker.%(name)s: %(message)s",
    )
    logger = logging.getLogger(f"{engine_name}.pid{os.getpid()}")

    # 立即回送 ready，不做预实例化（懒加载）
    try:
        conn.send({"type": "ready"})
    except Exception:
        return

    # MPS 环境预初始化（仅限 torch 相关引擎，避免 fake/test worker 的导入开销）
    #
    # 动机：spawn 子进程首次 `import torch` 后，`torch.backends.mps.is_available()`
    # 在 Apple Silicon 某些组合下会稳定返回 False；根因是 MPS 的统一内存
    # allocator 依赖懒初始化，`is_available()` 自身并不触发 first-touch。
    # 解决：在子进程启动时显式分配一次 MPS tensor（first-touch），之后 allocator
    # 就绪，`is_available()` 与 `AcceleratorDevice.MPS` 均可正常使用。
    #
    # 同时把诊断信息（torch 版本、start_method、built/available/smoke_test 结果）
    # 打到日志，便于远端 MPS 故障的线上排查。
    if engine_name in ("docling", "mineru", "marker"):
        _preinit_torch_device(logger)

    cached_engine: Optional[Any] = None
    cached_hash: Optional[str] = None
    # convert 结果缓存仅对 docling/mineru 生效；其他引擎保持此对象为 None
    convert_cache: Optional[_ConvertCache] = (
        _ConvertCache() if engine_name in _CACHEABLE_ENGINES else None
    )

    while True:
        try:
            request = conn.recv()
        except EOFError:
            break
        except Exception as e:
            logger.warning("recv 异常: %s", e)
            break

        if not isinstance(request, dict):
            continue

        msg_type = request.get("type")
        if msg_type == "shutdown":
            break
        if msg_type != "call":
            try:
                conn.send(
                    {
                        "type": "result",
                        "id": request.get("id"),
                        "ok": False,
                        "error": f"未知请求类型: {msg_type}",
                        "exc_class": "RuntimeError",
                    }
                )
            except Exception:
                break
            continue

        req_id = request.get("id")
        method = request.get("method", "convert")
        kwargs = request.get("kwargs", {}) or {}
        init_kwargs = request.get("init_kwargs") or {}
        deadline_monotonic = request.get("deadline_monotonic")

        # Deadline pre-check：若在请求到达时 deadline 已过，直接 fail-fast
        if deadline_monotonic is not None and time.monotonic() >= deadline_monotonic:
            try:
                conn.send(
                    {
                        "type": "result",
                        "id": req_id,
                        "ok": False,
                        "error": "deadline 已过 (pre-check)",
                        "exc_class": "TimeoutError",
                    }
                )
            except Exception:
                break
            continue

        # 按需懒加载 / 原地重建引擎
        new_hash = _hash_init_kwargs(init_kwargs)
        if cached_engine is None or cached_hash != new_hash:
            try:
                cached_engine = _load_engine(engine_name, init_kwargs)
                cached_hash = new_hash
            except Exception as e:
                try:
                    conn.send(
                        {
                            "type": "result",
                            "id": req_id,
                            "ok": False,
                            "error": f"初始化失败: {e}",
                            "exc_class": type(e).__name__,
                            "traceback": traceback.format_exc(),
                        }
                    )
                except Exception:
                    break
                continue

        # convert 结果缓存命中：同一 PDF 的 layout/table/formula/code 四个 Stage
        # 合用一次推理结果，miss 时走下方常规路径并在返回前回填。
        cache_key: Optional[Tuple[Any, ...]] = None
        if convert_cache is not None and method == "convert":
            cache_key = _make_cache_key(engine_name, kwargs, new_hash)
            if cache_key is not None:
                cached_result = convert_cache.get(cache_key)
                if cached_result is not None:
                    # 命中可观测性：跨 Stage 复用率的关键监控点。命中条件为
                    # 同一 (engine, fingerprint, page_range, embed_images, init_hash)。
                    logger.debug(
                        "convert cache hit engine=%s fingerprint=%s init_hash=%s",
                        engine_name,
                        cache_key[1] if len(cache_key) > 1 else "?",
                        new_hash[:8],
                    )
                    try:
                        conn.send(
                            {
                                "type": "result",
                                "id": req_id,
                                "ok": True,
                                "result": cached_result,
                            }
                        )
                    except Exception:
                        break
                    continue

        try:
            func = getattr(cached_engine, method)
            result = func(**kwargs)
            if cache_key is not None and result is not None:
                # convert 返回 None 通常代表“引擎不可用/转换失败”，不缓存
                # 以便下次可重试；非 None 结果写入缓存。
                convert_cache.put(cache_key, result)  # type: ignore[union-attr]
            conn.send(
                {
                    "type": "result",
                    "id": req_id,
                    "ok": True,
                    "result": result,
                }
            )
        except Exception as e:
            try:
                conn.send(
                    {
                        "type": "result",
                        "id": req_id,
                        "ok": False,
                        "error": str(e),
                        "exc_class": type(e).__name__,
                        "traceback": traceback.format_exc(),
                    }
                )
            except Exception:
                break

    try:
        conn.close()
    except Exception:  # nosec B110
        # 子进程退出阶段连接可能已在对端关闭；静默即可
        pass
