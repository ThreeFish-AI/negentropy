"""Marker 引擎 init_kwargs 构造器（统一从 settings 派生设备/批处理参数）。

设计：
    与 ``_docling_kwargs.build_docling_init_kwargs`` 同形态，作为 stage→engine
    单一参数通道，避免每个 Stage 在 ``init_kwargs={}`` 路径下错失设备/批处理调优。

Marker 上游已知限制（marker.settings.Settings）：
    - ``TORCH_DEVICE`` 默认 ``None``：自动选 cuda > mps > cpu；
      但**代码注释**指出 "MPS device does not work for text detection,
      and will default to CPU"。
    - ``MODEL_DTYPE``：cuda → bfloat16；其他设备 → float32（mps 不会自动 fp16）。

本项目策略（保守 + 可观测）：
    - 默认仍 ``TORCH_DEVICE=cpu``（保留现状向后兼容）；
    - 用户通过 ``marker_torch_device`` 显式 opt-in MPS（自担 text detection 风险）；
    - ``marker_half_precision=True`` 且 ``device=mps`` 时启用 fp16 monkey-patch；
    - ``marker_inference_ram_gb`` / ``marker_num_workers`` > 0 时透传环境变量。

References:
    - VikParuchuri/marker README：TORCH_DEVICE / INFERENCE_RAM / NUM_WORKERS。
"""

from __future__ import annotations

from typing import Any, Dict


def build_marker_init_kwargs() -> Dict[str, Any]:
    """从 ``settings`` 构造 ``MarkerEngine.__init__`` 的关键字参数。

    输出键集合（与 ``MarkerEngine.__init__`` 形参对齐）：
        - ``llm_enhanced: bool``
        - ``device: Optional[str]``
        - ``inference_ram_gb: int``
        - ``num_workers: int``
        - ``half_precision: bool``

    返回的 dict 适合作为 ``EngineWorkerPool.run(..., init_kwargs=...)``
    透传到 worker 子进程的 MarkerEngine 构造。
    """
    try:
        from ...config import settings
    except ImportError:
        return {}

    kwargs: Dict[str, Any] = {
        "llm_enhanced": bool(getattr(settings, "marker_llm_enhanced", False)),
        "device": getattr(settings, "marker_torch_device", None) or None,
        "inference_ram_gb": int(getattr(settings, "marker_inference_ram_gb", 0)),
        "num_workers": int(getattr(settings, "marker_num_workers", 0)),
        "half_precision": bool(getattr(settings, "marker_half_precision", False)),
    }
    return kwargs
