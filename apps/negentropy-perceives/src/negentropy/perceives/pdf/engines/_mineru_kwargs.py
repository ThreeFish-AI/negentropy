"""跨 Stage 共享的 MinerU init_kwargs 构造器。

设计与 ``_docling_kwargs.build_docling_init_kwargs`` 同形态：所有 Stage 通过
单一通道把 ``settings.mineru_device`` / ``settings.mineru_backend`` / Apple Silicon
专用 ``mineru_mps_backend`` 透传到 worker 子进程的 ``MinerUEngine`` 构造。

为何重要：
    - Stage 直接传 ``init_kwargs={}`` 会让 worker 端 ``MinerUEngine(device=None,
      backend=None)`` 走默认探测路径，**不响应**用户在 settings/env 上配置的
      ``NEGENTROPY_PERCEIVES_MINERU_MPS_BACKEND=pipeline`` 等强制策略，
      导致配置看似生效但实际未透传。
    - 所有 Stage 走统一构造器后，相同 settings → 相同 init_kwargs 哈希，
      ``_engine_worker_entry._make_cache_key`` 命中同一 MinerUEngine 缓存项，
      避免多 Stage 重复加载 VLM 模型。
"""

from __future__ import annotations

from typing import Any, Dict


def build_mineru_init_kwargs(**overrides: Any) -> Dict[str, Any]:
    """从 ``settings`` 构造 ``MinerUEngine.__init__`` 的关键字参数。

    输出键集合（与 ``MinerUEngine.__init__`` 形参对齐）：
        - ``device: Optional[str]``：``settings.mineru_device``（'auto' 时省略）
        - ``backend: Optional[str]``：``settings.mineru_backend``（'auto' 时省略）

    备注：``mineru_mps_backend`` 不进 init_kwargs；它由 ``MinerUEngine`` 内部
    通过 ``_read_mps_backend_pref()`` 自行读取 settings，避免在 worker 子进程
    内重复探测 macOS 版本。
    """
    try:
        from ...config import settings
    except ImportError:
        return dict(overrides)

    kwargs: Dict[str, Any] = {}

    device = getattr(settings, "mineru_device", "auto")
    if device and str(device).lower() != "auto":
        kwargs["device"] = device

    backend = getattr(settings, "mineru_backend", "auto")
    if backend and str(backend).lower() != "auto":
        kwargs["backend"] = backend

    kwargs.update(overrides)
    return kwargs
