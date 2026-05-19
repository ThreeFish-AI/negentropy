"""``build_marker_init_kwargs`` / ``build_mineru_init_kwargs`` 单元测试。

这两个构造器作为 stage→engine 单一通道，把 ``settings`` 中的设备/批处理偏好
透传到 worker 子进程内的 Engine 构造。本测试覆盖：

- 默认 settings 下的输出结构；
- ``mineru_device`` / ``mineru_backend``='auto' 时不进 init_kwargs；
- 显式值（非 'auto'）应进 init_kwargs；
- Marker 输出键集合稳定（与 ``MarkerEngine.__init__`` 形参对齐）。
"""

from __future__ import annotations

from unittest.mock import patch

from negentropy.perceives.pdf.engines._marker_kwargs import build_marker_init_kwargs
from negentropy.perceives.pdf.engines._mineru_kwargs import build_mineru_init_kwargs


# ============================================================
# build_marker_init_kwargs
# ============================================================
class TestMarkerInitKwargs:
    def test_default_keys_present(self) -> None:
        kw = build_marker_init_kwargs()
        # 与 MarkerEngine.__init__ 形参对齐
        assert set(kw.keys()) == {
            "llm_enhanced",
            "device",
            "inference_ram_gb",
            "num_workers",
            "half_precision",
        }

    def test_default_values_are_safe(self) -> None:
        """默认值应保留向后兼容的 CPU 强制路径。"""
        kw = build_marker_init_kwargs()
        assert kw["device"] is None  # 维持默认 CPU 强制
        assert kw["inference_ram_gb"] == 0
        assert kw["num_workers"] == 0
        assert kw["half_precision"] is False

    def test_settings_overrides_propagate(self) -> None:
        """settings 字段值应进入 init_kwargs。"""
        with patch(
            "negentropy.perceives.pdf.engines._marker_kwargs.settings", create=True
        ):
            # 直接 mock settings 较繁，改用 import 后 monkey-patch settings 属性
            pass
        # 改为对真实 settings 做 monkeypatch 风格断言：
        from negentropy.perceives import config as _cfg

        with patch.object(_cfg, "settings") as mocked:
            mocked.marker_llm_enhanced = True
            mocked.marker_torch_device = "mps"
            mocked.marker_inference_ram_gb = 18
            mocked.marker_num_workers = 4
            mocked.marker_half_precision = True
            kw = build_marker_init_kwargs()
            assert kw["llm_enhanced"] is True
            assert kw["device"] == "mps"
            assert kw["inference_ram_gb"] == 18
            assert kw["num_workers"] == 4
            assert kw["half_precision"] is True


# ============================================================
# build_mineru_init_kwargs
# ============================================================
class TestMineruInitKwargs:
    def test_default_skips_auto_values(self) -> None:
        """默认 settings: mineru_device='auto' / mineru_backend='auto' 时不进 kwargs。"""
        from negentropy.perceives import config as _cfg

        with patch.object(_cfg, "settings") as mocked:
            mocked.mineru_device = "auto"
            mocked.mineru_backend = "auto"
            kw = build_mineru_init_kwargs()
            assert kw == {}

    def test_explicit_device_propagates(self) -> None:
        from negentropy.perceives import config as _cfg

        with patch.object(_cfg, "settings") as mocked:
            mocked.mineru_device = "mps"
            mocked.mineru_backend = "auto"
            kw = build_mineru_init_kwargs()
            assert kw == {"device": "mps"}

    def test_explicit_backend_propagates(self) -> None:
        from negentropy.perceives import config as _cfg

        with patch.object(_cfg, "settings") as mocked:
            mocked.mineru_device = "auto"
            mocked.mineru_backend = "pipeline"
            kw = build_mineru_init_kwargs()
            assert kw == {"backend": "pipeline"}

    def test_overrides_kwargs_take_precedence(self) -> None:
        """传入 overrides 应覆盖 settings 派生值。"""
        from negentropy.perceives import config as _cfg

        with patch.object(_cfg, "settings") as mocked:
            mocked.mineru_device = "mps"
            mocked.mineru_backend = "auto"
            kw = build_mineru_init_kwargs(device="cuda")
            assert kw["device"] == "cuda"
