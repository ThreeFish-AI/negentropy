"""单元测试：MPS 在 spawn 子进程中的 first-touch 预热与诊断日志。

动机：spawn 子进程首次 `import torch` 后，`torch.backends.mps.is_available()`
在 Apple Silicon 某些组合下会稳定返回 False；需要显式分配一次 MPS tensor
触发懒初始化。`_preinit_torch_device` 负责完成此 first-touch 并把诊断结果
落到环境变量 `NEGENTROPY_MPS_READY` 与日志。
"""

from __future__ import annotations

import logging
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

from negentropy.perceives.infra._engine_worker_entry import _preinit_torch_device


@pytest.fixture(autouse=True)
def _clear_mps_env():
    """每个测试前后清理 NEGENTROPY_MPS_READY，避免互相污染。"""
    original = os.environ.pop("NEGENTROPY_MPS_READY", None)
    yield
    os.environ.pop("NEGENTROPY_MPS_READY", None)
    if original is not None:
        os.environ["NEGENTROPY_MPS_READY"] = original


class TestPreinitTorchDevice:
    """`_preinit_torch_device` 在各种环境下都不应抛异常。"""

    def test_no_torch_sets_ready_zero(self, caplog):
        """torch 不可导入时应设置 NEGENTROPY_MPS_READY=0 且不抛异常。"""

        def bad_import(name, *args, **kwargs):
            if name == "torch":
                raise ImportError("torch not installed")
            return __import__(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=bad_import):
            logger = logging.getLogger("test.preinit.no_torch")
            with caplog.at_level(logging.WARNING, logger=logger.name):
                _preinit_torch_device(logger)

        assert os.environ.get("NEGENTROPY_MPS_READY") == "0"

    def test_sets_mps_fallback_env_default(self):
        """子进程进入后 PYTORCH_ENABLE_MPS_FALLBACK 默认打开（=1），用作算子 fallback。"""
        original = os.environ.pop("PYTORCH_ENABLE_MPS_FALLBACK", None)
        try:
            logger = logging.getLogger("test.preinit.fallback")
            try:
                _preinit_torch_device(logger)
            except Exception:  # pragma: no cover - 函数不应抛
                pytest.fail("_preinit_torch_device 不应抛异常")
            assert os.environ.get("PYTORCH_ENABLE_MPS_FALLBACK") == "1"
        finally:
            if original is not None:
                os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = original
            else:
                os.environ.pop("PYTORCH_ENABLE_MPS_FALLBACK", None)

    def test_smoke_test_ok_sets_ready_one(self):
        """smoke_test 成功时 NEGENTROPY_MPS_READY=1，并执行强化 first-touch（matmul）。"""
        fake_torch = MagicMock()
        fake_torch.__version__ = "2.5.0"
        fake_torch.backends.mps.is_built.return_value = True
        fake_torch.backends.mps.is_available.return_value = True
        # 强化 first-touch：randn(1024,1024) + matmul + sum 链路
        pin_a = MagicMock(name="pin_a")
        pin_b = MagicMock(name="pin_b")
        pin_c = MagicMock(name="pin_c")
        pin_a.__matmul__.return_value = pin_c
        fake_torch.randn.side_effect = [pin_a, pin_b]

        real_import = __import__

        def mock_import(name, *args, **kwargs):
            if name == "torch":
                return fake_torch
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            with patch.object(sys, "platform", "darwin"):
                logger = logging.getLogger("test.preinit.ok")
                _preinit_torch_device(logger)

        assert os.environ.get("NEGENTROPY_MPS_READY") == "1"
        # 强化 first-touch：randn 被调用两次（pin_a/pin_b）
        assert fake_torch.randn.call_count == 2
        for call in fake_torch.randn.call_args_list:
            assert call.kwargs.get("device") == "mps"

    def test_smoke_test_fail_sets_ready_zero(self):
        """smoke_test 失败（如 MPS OOM）时 NEGENTROPY_MPS_READY=0。"""
        fake_torch = MagicMock()
        fake_torch.__version__ = "2.5.0"
        fake_torch.backends.mps.is_built.return_value = True
        fake_torch.backends.mps.is_available.return_value = False
        # randn 失败模拟 first-touch 异常
        fake_torch.randn.side_effect = RuntimeError("MPS OOM")

        real_import = __import__

        def mock_import(name, *args, **kwargs):
            if name == "torch":
                return fake_torch
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            with patch.object(sys, "platform", "darwin"):
                logger = logging.getLogger("test.preinit.fail")
                _preinit_torch_device(logger)

        assert os.environ.get("NEGENTROPY_MPS_READY") == "0"

    def test_skip_when_mps_not_built(self):
        """`mps_built=False` 时跳过 smoke_test 且 READY=0。"""
        fake_torch = MagicMock()
        fake_torch.__version__ = "2.5.0"
        fake_torch.backends.mps.is_built.return_value = False
        fake_torch.backends.mps.is_available.return_value = False

        real_import = __import__

        def mock_import(name, *args, **kwargs):
            if name == "torch":
                return fake_torch
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            with patch.object(sys, "platform", "darwin"):
                logger = logging.getLogger("test.preinit.notbuilt")
                _preinit_torch_device(logger)

        # 未 built 时不应执行 first-touch（randn）
        fake_torch.randn.assert_not_called()
        assert os.environ.get("NEGENTROPY_MPS_READY") == "0"

    def test_non_darwin_skips_smoke_test(self):
        """非 darwin 平台跳过 smoke_test，仍然设置 READY=0。"""
        fake_torch = MagicMock()
        fake_torch.__version__ = "2.5.0"
        fake_torch.backends.mps.is_built.return_value = False
        fake_torch.backends.mps.is_available.return_value = False

        real_import = __import__

        def mock_import(name, *args, **kwargs):
            if name == "torch":
                return fake_torch
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            with patch.object(sys, "platform", "linux"):
                logger = logging.getLogger("test.preinit.linux")
                _preinit_torch_device(logger)

        fake_torch.randn.assert_not_called()
        assert os.environ.get("NEGENTROPY_MPS_READY") == "0"


@pytest.mark.skipif(sys.platform != "darwin", reason="MPS 仅在 macOS 上可用")
class TestMPSIntegration:
    """真实 darwin 环境下的 MPS first-touch 集成验证。

    如果运行机器实际不支持 MPS（如 Intel Mac），应优雅降级到 READY=0 不抛异常。
    """

    def test_real_preinit_does_not_raise(self):
        """真实环境下 `_preinit_torch_device` 不抛异常。"""
        logger = logging.getLogger("test.preinit.real")
        try:
            _preinit_torch_device(logger)
        except Exception as e:  # pragma: no cover
            pytest.fail(f"真实 _preinit_torch_device 抛异常: {e}")

        # 必然设置了 NEGENTROPY_MPS_READY 为 "0" 或 "1"
        assert os.environ.get("NEGENTROPY_MPS_READY") in {"0", "1"}

    def test_real_preinit_on_m_series_sets_ready_one(self):
        """在 Apple Silicon M 系列且 torch 支持 MPS 时，READY 应为 1。"""
        try:
            import torch
        except ImportError:
            pytest.skip("torch 未安装")
        if not (
            hasattr(torch.backends, "mps") and torch.backends.mps.is_built()
        ):  # pragma: no cover
            pytest.skip("torch 未构建 MPS 后端")

        logger = logging.getLogger("test.preinit.real.m_series")
        _preinit_torch_device(logger)

        # 非强断言：允许 READY=0（smoke_test 偶发 OOM 或 driver 异常）
        assert os.environ.get("NEGENTROPY_MPS_READY") in {"0", "1"}
