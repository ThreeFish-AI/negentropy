"""设备感知配置策略模块的单元测试。

测试策略：
- 使用 mock 控制硬件检测结果，验证不同设备下的配置降级和优化逻辑
- 验证缓存键的设备段生成
- 验证 GPU batch size 自适应推断
"""

from unittest.mock import Mock, patch


from negentropy.perceives.pdf.hardware import DeviceType
from negentropy.perceives.pdf.hardware.device_config import (
    DoclingDeviceConfig,
    _apply_cuda_optimizations,
    _apply_mps_constraints,
    _apply_xpu_defaults,
    _compute_gpu_batch_sizes,
    resolve_device_config,
)


def _mock_hardware_info(
    memory_gb=24.0, device_type=DeviceType.MPS, chip_generation=None
):
    """创建 mock HardwareInfo 对象。"""
    info = Mock()
    info.memory_gb = memory_gb
    info.device_type = device_type
    # 注意：chip_generation 必须是 None 或 int，Mock 默认会自动生成 Mock 对象
    # 触发 `<=` 比较失败。
    info.chip_generation = chip_generation
    return info


# ============================================================
# DoclingDeviceConfig 数据类
# ============================================================
class TestDoclingDeviceConfig:
    """验证 DoclingDeviceConfig 数据类的字段与属性。"""

    def test_defaults(self) -> None:
        config = DoclingDeviceConfig(device="cpu")
        assert config.device == "cpu"
        assert config.num_threads == 4
        assert config.do_formula_enrichment is True
        assert config.do_table_structure is True
        assert config.table_mode == "accurate"
        assert config.use_flash_attention is False
        assert config.device_type == DeviceType.CPU
        assert config.adjustments == {}
        assert config.ocr_batch_size == 4
        assert config.layout_batch_size == 4
        assert config.table_batch_size == 4
        assert config.ocr_engine == "default"

    def test_cache_key_segment(self) -> None:
        config = DoclingDeviceConfig(
            device="mps", num_threads=8, use_flash_attention=False
        )
        segment = config.cache_key_segment
        assert "dev=mps" in segment
        assert "threads=8" in segment
        assert "fa2=False" in segment
        assert "batch=" in segment
        assert "ocr_eng=" in segment

    def test_different_devices_different_cache_keys(self) -> None:
        c1 = DoclingDeviceConfig(device="cpu")
        c2 = DoclingDeviceConfig(device="mps")
        assert c1.cache_key_segment != c2.cache_key_segment

    def test_same_device_same_cache_key(self) -> None:
        c1 = DoclingDeviceConfig(device="cuda", num_threads=4)
        c2 = DoclingDeviceConfig(device="cuda", num_threads=4)
        assert c1.cache_key_segment == c2.cache_key_segment

    def test_different_batch_sizes_different_cache_keys(self) -> None:
        """不同 batch size 应产生不同缓存键。"""
        c1 = DoclingDeviceConfig(device="mps", ocr_batch_size=8)
        c2 = DoclingDeviceConfig(device="mps", ocr_batch_size=16)
        assert c1.cache_key_segment != c2.cache_key_segment


# ============================================================
# GPU Batch Size 推断
# ============================================================
class TestComputeGPUBatchSizes:
    """验证 GPU batch size 推断逻辑。"""

    def test_cpu_returns_default(self) -> None:
        """CPU 应返回默认 batch size 4。"""
        ocr, layout, table = _compute_gpu_batch_sizes(None, DeviceType.CPU)
        assert ocr == 4 and layout == 4 and table == 4

    def test_cpu_with_memory_returns_default(self) -> None:
        """CPU 即使有内存信息也应返回默认值。"""
        ocr, layout, table = _compute_gpu_batch_sizes(32.0, DeviceType.CPU)
        assert ocr == 4

    def test_gpu_with_no_memory_info(self) -> None:
        """GPU 但无显存信息应返回安全默认值 8。"""
        ocr, layout, table = _compute_gpu_batch_sizes(None, DeviceType.MPS)
        assert ocr == 8
        assert table == 4  # max(4, 8 // 2)

    def test_mps_small_memory(self) -> None:
        """MPS 8GB (估算 6GB) 应返回保守值 8。"""
        ocr, layout, table = _compute_gpu_batch_sizes(6.0, DeviceType.MPS)
        assert ocr == 8

    def test_mps_medium_memory(self) -> None:
        """MPS 16GB (估算 12GB) 应返回 12。"""
        ocr, layout, table = _compute_gpu_batch_sizes(12.0, DeviceType.MPS)
        assert ocr == 12

    def test_mps_large_memory(self) -> None:
        """MPS 32GB (估算 24GB) 应返回 16。"""
        ocr, layout, table = _compute_gpu_batch_sizes(24.0, DeviceType.MPS)
        assert ocr == 16

    def test_mps_ultra_memory(self) -> None:
        """MPS 128GB (估算 96GB) 应返回 32。"""
        ocr, layout, table = _compute_gpu_batch_sizes(96.0, DeviceType.MPS)
        assert ocr == 32

    def test_cuda_small_memory(self) -> None:
        """CUDA 6GB 应返回 8。"""
        ocr, layout, table = _compute_gpu_batch_sizes(6.0, DeviceType.CUDA)
        assert ocr == 8

    def test_cuda_medium_memory(self) -> None:
        """CUDA 10GB 应返回 16。"""
        ocr, layout, table = _compute_gpu_batch_sizes(10.0, DeviceType.CUDA)
        assert ocr == 16

    def test_cuda_large_memory(self) -> None:
        """CUDA 16GB 应返回 32。"""
        ocr, layout, table = _compute_gpu_batch_sizes(16.0, DeviceType.CUDA)
        assert ocr == 32

    def test_cuda_24gb_returns_64(self) -> None:
        """CUDA 24GB+ 应返回 64。"""
        ocr, layout, table = _compute_gpu_batch_sizes(24.0, DeviceType.CUDA)
        assert ocr == 64
        assert table <= ocr

    def test_table_batch_more_conservative(self) -> None:
        """table_batch_size 应 <= ocr/layout batch size。"""
        for mem in [6.0, 12.0, 24.0, 48.0]:
            ocr, layout, table = _compute_gpu_batch_sizes(mem, DeviceType.CUDA)
            assert table <= ocr
            assert table >= 4

    def test_batch_monotonic_with_memory(self) -> None:
        """更大显存应产生更大或相等的 batch size。"""
        memories = [6.0, 12.0, 24.0, 96.0]
        prev_ocr = 0
        for mem in memories:
            ocr, _, _ = _compute_gpu_batch_sizes(mem, DeviceType.MPS)
            assert ocr >= prev_ocr
            prev_ocr = ocr

    def test_xpu_uses_moderate_strategy(self) -> None:
        """XPU 应使用中等策略。"""
        ocr, layout, table = _compute_gpu_batch_sizes(16.0, DeviceType.XPU)
        assert ocr == 16

    # --- Apple Silicon 芯片代次缩放 ---

    def test_mps_chip_generation_m1_baseline(self) -> None:
        """M1 (gen=1) 应保持 baseline，不放大。"""
        baseline = _compute_gpu_batch_sizes(24.0, DeviceType.MPS, 1)
        no_gen = _compute_gpu_batch_sizes(24.0, DeviceType.MPS)
        assert baseline == no_gen  # (16, 16, 8)
        assert baseline[0] == 16

    def test_mps_chip_generation_m2_baseline(self) -> None:
        """M2 (gen=2) 与 M1 等价（baseline）。"""
        m2 = _compute_gpu_batch_sizes(24.0, DeviceType.MPS, 2)
        assert m2 == (16, 16, 8)

    def test_mps_chip_generation_m3_scaled(self) -> None:
        """M3 (gen=3) 应在 baseline 上放大 1.25x。"""
        m3 = _compute_gpu_batch_sizes(24.0, DeviceType.MPS, 3)
        # baseline ocr=16 → 16*1.25=20
        assert m3[0] == 20
        assert m3[2] >= 4  # table 仍保守

    def test_mps_chip_generation_m4_scaled(self) -> None:
        """M4 (gen=4) 应在 baseline 上放大 1.5x。"""
        m4 = _compute_gpu_batch_sizes(24.0, DeviceType.MPS, 4)
        # baseline ocr=16 → 16*1.5=24
        assert m4[0] == 24

    def test_mps_chip_generation_m5_capped_at_15x(self) -> None:
        """M5+ 与 M4 等价（保留 1.5x 上限，避免越界）。"""
        m5 = _compute_gpu_batch_sizes(24.0, DeviceType.MPS, 5)
        m4 = _compute_gpu_batch_sizes(24.0, DeviceType.MPS, 4)
        assert m5 == m4

    def test_mps_chip_generation_does_not_affect_cuda(self) -> None:
        """chip_generation 不应影响 CUDA 路径。"""
        cuda_with_gen = _compute_gpu_batch_sizes(24.0, DeviceType.CUDA, 4)
        cuda_no_gen = _compute_gpu_batch_sizes(24.0, DeviceType.CUDA)
        assert cuda_with_gen == cuda_no_gen


# ============================================================
# MPS 限制策略
# ============================================================
class TestMPSConstraints:
    """验证 Apple Silicon MPS 限制处理。"""

    @patch(
        "negentropy.perceives.pdf.hardware.device_config._check_mlx_vlm_available",
        return_value=True,
    )
    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_mps_formula_enrichment_with_mlx(
        self, mock_hw: Mock, _mock_mlx: Mock
    ) -> None:
        """MPS + mlx_vlm 可用时应保留 formula enrichment。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = DoclingDeviceConfig(
            device="mps",
            device_type=DeviceType.MPS,
            do_formula_enrichment=True,
        )
        _apply_mps_constraints(config)
        assert config.do_formula_enrichment is True
        assert "formula_enrichment" in config.adjustments
        assert "mlx_vlm" in config.adjustments["formula_enrichment"]

    @patch(
        "negentropy.perceives.pdf.hardware.device_config._check_mlx_vlm_available",
        return_value=False,
    )
    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_mps_disables_formula_without_mlx(
        self, mock_hw: Mock, _mock_mlx: Mock
    ) -> None:
        """MPS + mlx_vlm 不可用时应禁用 formula enrichment。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = DoclingDeviceConfig(
            device="mps",
            device_type=DeviceType.MPS,
            do_formula_enrichment=True,
        )
        _apply_mps_constraints(config)
        assert config.do_formula_enrichment is False
        assert "formula_enrichment" in config.adjustments

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_mps_preserves_table_structure(self, mock_hw: Mock) -> None:
        """MPS 不应影响 table structure 配置。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = DoclingDeviceConfig(
            device="mps",
            device_type=DeviceType.MPS,
            do_table_structure=True,
        )
        _apply_mps_constraints(config)
        assert config.do_table_structure is True

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_mps_disables_flash_attention(self, mock_hw: Mock) -> None:
        """MPS 应禁用 Flash Attention 2。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = DoclingDeviceConfig(
            device="mps",
            device_type=DeviceType.MPS,
            use_flash_attention=True,
        )
        _apply_mps_constraints(config)
        assert config.use_flash_attention is False

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_mps_no_adjustment_when_formula_disabled(self, mock_hw: Mock) -> None:
        """formula 已禁用时不应记录 formula 调整。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = DoclingDeviceConfig(
            device="mps",
            device_type=DeviceType.MPS,
            do_formula_enrichment=False,
        )
        _apply_mps_constraints(config)
        assert "formula_enrichment" not in config.adjustments

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_mps_sets_optimized_batch_sizes(self, mock_hw: Mock) -> None:
        """MPS 应根据统一内存设置优化后的 batch sizes。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = DoclingDeviceConfig(device="mps", device_type=DeviceType.MPS)
        _apply_mps_constraints(config)
        assert config.ocr_batch_size > 4, "MPS batch size 应大于默认值 4"
        assert config.layout_batch_size > 4
        assert config.table_batch_size >= 4
        assert "batch_sizes" in config.adjustments

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_mps_batch_size_scales_with_memory(self, mock_hw: Mock) -> None:
        """不同内存大小应产生不同的 batch sizes。"""
        configs = []
        for mem in [6.0, 24.0, 96.0]:
            config = DoclingDeviceConfig(device="mps", device_type=DeviceType.MPS)
            mock_hw.return_value = _mock_hardware_info(mem, DeviceType.MPS)
            _apply_mps_constraints(config)
            configs.append(config)

        assert configs[0].ocr_batch_size <= configs[1].ocr_batch_size
        assert configs[1].ocr_batch_size <= configs[2].ocr_batch_size

    @patch("platform.system", return_value="Darwin")
    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_mps_ocr_engine_set_on_macos(self, mock_hw: Mock, _mock_sys: Mock) -> None:
        """macOS 平台上应设置 mac_native OCR 引擎偏好。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = DoclingDeviceConfig(device="mps", device_type=DeviceType.MPS)
        _apply_mps_constraints(config)
        assert config.ocr_engine == "mac_native"
        assert "ocr_engine" in config.adjustments

    @patch("platform.system", return_value="Linux")
    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_mps_ocr_engine_default_on_linux(
        self, mock_hw: Mock, _mock_sys: Mock
    ) -> None:
        """非 macOS 平台不应设置 mac_native OCR。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = DoclingDeviceConfig(device="mps", device_type=DeviceType.MPS)
        _apply_mps_constraints(config)
        assert config.ocr_engine == "default"


# ============================================================
# CUDA 优化策略
# ============================================================
class TestCUDAOptimizations:
    """验证 NVIDIA CUDA 优化处理。"""

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    @patch(
        "negentropy.perceives.pdf.hardware.device_config._check_flash_attention_available",
        return_value=True,
    )
    def test_cuda_enables_flash_attention(
        self, _mock_fa: object, mock_hw: Mock
    ) -> None:
        """CUDA + flash_attn 已安装时应启用 FA2。"""
        mock_hw.return_value = _mock_hardware_info(16.0, DeviceType.CUDA)
        config = DoclingDeviceConfig(device="cuda", device_type=DeviceType.CUDA)
        _apply_cuda_optimizations(config)
        assert config.use_flash_attention is True
        assert "flash_attention" in config.adjustments

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    @patch(
        "negentropy.perceives.pdf.hardware.device_config._check_flash_attention_available",
        return_value=False,
    )
    def test_cuda_no_flash_attention_when_missing(
        self, _mock_fa: object, mock_hw: Mock
    ) -> None:
        """CUDA + flash_attn 未安装时应跳过 FA2。"""
        mock_hw.return_value = _mock_hardware_info(16.0, DeviceType.CUDA)
        config = DoclingDeviceConfig(device="cuda", device_type=DeviceType.CUDA)
        _apply_cuda_optimizations(config)
        assert config.use_flash_attention is False

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    @patch(
        "negentropy.perceives.pdf.hardware.device_config._check_flash_attention_available",
        return_value=False,
    )
    def test_cuda_preserves_all_features(self, _mock_fa: object, mock_hw: Mock) -> None:
        """CUDA 应保留所有 Docling 功能。"""
        mock_hw.return_value = _mock_hardware_info(16.0, DeviceType.CUDA)
        config = DoclingDeviceConfig(
            device="cuda",
            device_type=DeviceType.CUDA,
            do_formula_enrichment=True,
            do_table_structure=True,
        )
        _apply_cuda_optimizations(config)
        assert config.do_formula_enrichment is True
        assert config.do_table_structure is True

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    @patch(
        "negentropy.perceives.pdf.hardware.device_config._check_flash_attention_available",
        return_value=False,
    )
    def test_cuda_sets_optimized_batch_sizes(
        self, _mock_fa: object, mock_hw: Mock
    ) -> None:
        """CUDA 应根据显存设置优化后的 batch sizes。"""
        mock_hw.return_value = _mock_hardware_info(16.0, DeviceType.CUDA)
        config = DoclingDeviceConfig(device="cuda", device_type=DeviceType.CUDA)
        _apply_cuda_optimizations(config)
        assert config.ocr_batch_size >= 16
        assert "batch_sizes" in config.adjustments


# ============================================================
# XPU 基础优化
# ============================================================
class TestXPUDefaults:
    """验证 Intel XPU 基础优化。"""

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_xpu_disables_flash_attention(self, mock_hw: Mock) -> None:
        """XPU 应禁用 Flash Attention 2。"""
        mock_hw.return_value = _mock_hardware_info(8.0, DeviceType.XPU)
        config = DoclingDeviceConfig(device="xpu", device_type=DeviceType.XPU)
        _apply_xpu_defaults(config)
        assert config.use_flash_attention is False

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    def test_xpu_sets_batch_sizes(self, mock_hw: Mock) -> None:
        """XPU 应设置 batch sizes。"""
        mock_hw.return_value = _mock_hardware_info(16.0, DeviceType.XPU)
        config = DoclingDeviceConfig(device="xpu", device_type=DeviceType.XPU)
        _apply_xpu_defaults(config)
        assert config.ocr_batch_size > 4


# ============================================================
# resolve_device_config 集成逻辑
# ============================================================
class TestResolveDeviceConfig:
    """验证 resolve_device_config 核心入口。"""

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cpu",
    )
    def test_cpu_no_adjustments(self, _mock: object) -> None:
        """CPU 设备应无配置降级。"""
        config = resolve_device_config(device_preference="cpu")
        assert config.device == "cpu"
        assert config.do_formula_enrichment is True
        assert config.use_flash_attention is False
        assert config.ocr_batch_size == 4  # CPU 默认值

    @patch(
        "negentropy.perceives.pdf.hardware.device_config._check_mlx_vlm_available",
        return_value=True,
    )
    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="mps",
    )
    def test_mps_applies_constraints(
        self, _mock_dev: object, mock_hw: Mock, _mock_mlx: Mock
    ) -> None:
        """MPS 设备应自动应用限制。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = resolve_device_config(device_preference="mps", enable_formula=True)
        assert config.device == "mps"
        assert config.device_type == DeviceType.MPS
        # mlx_vlm 可用时 formula enrichment 应保留
        assert config.do_formula_enrichment is True
        assert "formula_enrichment" in config.adjustments
        assert "mlx_vlm" in config.adjustments["formula_enrichment"]
        assert config.ocr_batch_size > 4  # GPU batch size 优化

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cuda",
    )
    @patch(
        "negentropy.perceives.pdf.hardware.device_config._check_flash_attention_available",
        return_value=True,
    )
    def test_cuda_applies_optimizations(
        self, _mock_fa: object, _mock_dev: object, mock_hw: Mock
    ) -> None:
        """CUDA 设备应启用优化。"""
        mock_hw.return_value = _mock_hardware_info(16.0, DeviceType.CUDA)
        config = resolve_device_config(device_preference="cuda")
        assert config.device == "cuda"
        assert config.device_type == DeviceType.CUDA
        assert config.use_flash_attention is True
        assert config.do_formula_enrichment is True
        assert config.ocr_batch_size > 4  # GPU batch size 优化

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cpu",
    )
    def test_explicit_cpu_preference(self, _mock: object) -> None:
        """显式指定 CPU 应跳过 GPU 优化。"""
        config = resolve_device_config(device_preference="cpu")
        assert config.device_type == DeviceType.CPU
        assert config.use_flash_attention is False

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="mps",
    )
    def test_custom_num_threads(self, _mock_dev: object, mock_hw: Mock) -> None:
        """应正确传递自定义线程数。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = resolve_device_config(device_preference="mps", num_threads=8)
        assert config.num_threads == 8

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="xpu",
    )
    def test_xpu_applies_defaults(self, _mock_dev: object, mock_hw: Mock) -> None:
        """XPU 应应用基础优化。"""
        mock_hw.return_value = _mock_hardware_info(16.0, DeviceType.XPU)
        config = resolve_device_config(device_preference="xpu")
        assert config.device == "xpu"
        assert config.do_formula_enrichment is True
        assert config.use_flash_attention is False
        assert config.ocr_batch_size > 4  # GPU batch size 优化

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="mps",
    )
    def test_user_override_batch_size(self, _mock_dev: object, mock_hw: Mock) -> None:
        """用户显式指定 batch size 应覆盖自动推断。"""
        mock_hw.return_value = _mock_hardware_info(24.0, DeviceType.MPS)
        config = resolve_device_config(
            device_preference="mps",
            ocr_batch_size_override=32,
        )
        assert config.ocr_batch_size == 32
        assert "ocr_batch_size_override" in config.adjustments

    @patch("negentropy.perceives.pdf.hardware.detection.get_cached_hardware_info")
    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cuda",
    )
    @patch(
        "negentropy.perceives.pdf.hardware.device_config._check_flash_attention_available",
        return_value=False,
    )
    def test_all_batch_size_overrides(
        self, _mock_fa: object, _mock_dev: object, mock_hw: Mock
    ) -> None:
        """所有 batch size 覆盖应同时生效。"""
        mock_hw.return_value = _mock_hardware_info(16.0, DeviceType.CUDA)
        config = resolve_device_config(
            device_preference="cuda",
            ocr_batch_size_override=8,
            layout_batch_size_override=16,
            table_batch_size_override=4,
        )
        assert config.ocr_batch_size == 8
        assert config.layout_batch_size == 16
        assert config.table_batch_size == 4

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cpu",
    )
    def test_zero_override_keeps_auto(self, _mock: object) -> None:
        """override=0 时不应覆盖（使用自动推断值）。"""
        config = resolve_device_config(
            device_preference="cpu",
            ocr_batch_size_override=0,
        )
        assert config.ocr_batch_size == 4  # CPU 默认值
        assert "ocr_batch_size_override" not in config.adjustments
