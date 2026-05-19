"""单元测试：跨 Stage 共享的 Docling init_kwargs 构造器。

跨 Stage 复用要求 layout / table / formula / code 四个 Stage 调用
``EngineWorkerPool.run(engine="docling", init_kwargs=...)`` 时传入
**完全相同**的 dict，使 ``_engine_worker_entry._make_cache_key`` 哈希命中。

本测试断言：

1. 默认无参调用产生空 dict（与 DoclingEngine 默认值一致）；
2. 同一 ``init_kwargs hash`` 在四个 Stage 间稳定可复现；
3. 显式覆盖参数会产生不同 hash（破坏跨 Stage 复用，但保留显式调试入口）。
"""

from __future__ import annotations

import json

from negentropy.perceives.pdf.engines._docling_kwargs import (
    build_docling_init_kwargs,
)


def _hash_kwargs(kwargs: dict) -> str:
    """复刻 ``_engine_worker_entry._hash_init_kwargs`` 行为以验证一致性。"""
    return json.dumps(kwargs, sort_keys=True, default=str)


class TestUnifiedKwargs:
    def test_default_no_args_is_empty_dict(self) -> None:
        kwargs = build_docling_init_kwargs()
        assert kwargs == {}

    def test_layout_table_formula_code_have_same_hash(self) -> None:
        """四个 Stage 调用相同的 builder → 相同 hash → cache 命中。"""
        layout = build_docling_init_kwargs()
        table = build_docling_init_kwargs()
        formula = build_docling_init_kwargs()
        code = build_docling_init_kwargs()

        h_layout = _hash_kwargs(layout)
        h_table = _hash_kwargs(table)
        h_formula = _hash_kwargs(formula)
        h_code = _hash_kwargs(code)

        assert h_layout == h_table == h_formula == h_code, (
            f"四个 Stage 的 init_kwargs hash 应一致："
            f"layout={h_layout}, table={h_table}, "
            f"formula={h_formula}, code={h_code}"
        )

    def test_explicit_override_changes_hash(self) -> None:
        """显式 override 仍允许（用于调试），但会破坏 cache 命中。"""
        default = build_docling_init_kwargs()
        custom = build_docling_init_kwargs(enable_ocr=True)
        assert default != custom
        assert _hash_kwargs(default) != _hash_kwargs(custom)

    def test_kwargs_dict_is_mutable_independent_copy(self) -> None:
        """每次调用返回新 dict，不共享引用。"""
        kwargs1 = build_docling_init_kwargs()
        kwargs2 = build_docling_init_kwargs()
        kwargs1["debug"] = True
        assert "debug" not in kwargs2
