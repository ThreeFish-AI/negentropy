"""跨 Stage 共享的 Docling init_kwargs 构造器。

**问题**：layout_analysis / table_extraction / formula_extraction / code_detection
四个 Stage 各自向 ``EngineWorkerPool`` 发送 ``docling.convert`` 调用，但
``init_kwargs`` 字典内容各不相同（``{}`` / ``{"enable_table_structure": True}`` /
``{"enable_formula_enrichment": True}``）。``_engine_worker_entry._make_cache_key``
按 ``init_kwargs`` 哈希构造缓存键，导致**每个 Stage 都生成新的缓存项**，
docling 内部 `_ConvertCache` 完全 miss，触发 4 次完整推理。

**方案**：所有 Stage 调用 :func:`build_docling_init_kwargs` 获取**完全相同**的
init_kwargs（默认参数），DoclingEngine 自身的构造器默认值已开启所有 enrichment
特性：

- ``enable_table_structure=True``
- ``enable_code_enrichment=True``
- ``enable_formula_enrichment=True``
- ``enable_picture_images=True``

因此「单次 convert()，多 Stage 各取所需」，layout 阶段触发的 convert 结果
可被 table/formula/code 三个 Stage 直接命中缓存复用，跨 Stage 整体节省约
3-4 次完整推理（每次 60-200s 量级）。

**约束**：若某 Stage 明确**不需要**某项特性，仍可通过传入显式 ``False`` 参数
覆盖；但这会破坏跨 Stage 复用，应当慎用。
"""

from __future__ import annotations

from typing import Any, Dict


def build_docling_init_kwargs(**overrides: Any) -> Dict[str, Any]:
    """构造跨 Stage 一致的 Docling 初始化参数。

    返回的 dict 顺序在 Python 3.7+ 中保证稳定，因此哈希签名可复现。

    Args:
        **overrides: 覆盖默认值的参数；不传则返回空 dict（DoclingEngine 用默认值）。

    Returns:
        dict：传给 ``EngineWorkerPool.run(engine="docling", init_kwargs=...)``。

    Examples:
        >>> # 标准用法：所有 stage 一致使用默认值
        >>> kwargs = build_docling_init_kwargs()
        >>> kwargs == {}
        True

        >>> # 调试用：显式禁用某特性
        >>> kwargs = build_docling_init_kwargs(enable_ocr=True)
        >>> kwargs
        {'enable_ocr': True}
    """
    return dict(overrides)


# 缓存键稳定性检查：当所有 stage 都调用 ``build_docling_init_kwargs()`` 不传参时，
# 返回的 dict 内容相同，``_engine_worker_entry._make_cache_key`` 中
# ``json.dumps(init_kwargs, sort_keys=True)`` 的哈希也相同，从而四个 stage 共享
# 同一份 docling.convert 结果。
