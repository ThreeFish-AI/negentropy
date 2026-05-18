"""设备感知的 Docling 配置策略模块。

根据运行时检测到的硬件设备（MPS/CUDA/CPU/XPU）自动调整 Docling
管道配置，处理各平台已知限制并启用对应优化。

Design Pattern: Strategy Pattern — 将设备特定的配置决策封装为独立策略

已知平台限制（Docling 2.12.0+）:
    - MPS: Formula enrichment 不兼容，启用时整个管道回退 CPU
    - MPS: TableFormer 被禁用，Docling 内部透明回退 CPU
    - CUDA: 支持 Flash Attention 2 加速
    - MPS/XPU: 不支持 Flash Attention 2

Batch Size 自适应策略:
    根据设备类型和可用显存推断 ocr/layout/table batch size，
    GPU 批处理可显著提升吞吐量（从默认 4 提升至 8-64）。
    MPS 采用保守策略（统一内存共享），CUDA 可更激进（专用显存）。

References:
    [1] Docling GPU 支持文档, https://docling-project.github.io/docling/usage/gpu/
    [2] Docling AcceleratorDevice 源码, https://github.com/docling-project/docling/blob/main/docling/datamodel/accelerator_options.py
    [3] MPS + Formula Enrichment 不兼容讨论, https://github.com/docling-project/docling/discussions/2505
    [4] SmolDocling-MLX Apple Silicon 加速, https://docling-project.github.io/docling/usage/vision_models/
"""

import logging
import platform
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

from .detection import DeviceType, get_device_for_docling

logger = logging.getLogger(__name__)


@dataclass
class DoclingDeviceConfig:
    """设备感知的 Docling 配置参数集。

    封装了特定设备下 Docling 管道应使用的所有配置参数，
    包括加速选项、功能降级、批处理吞吐和设备特定优化。
    """

    device: str  # Docling AcceleratorDevice 值
    num_threads: int = 4
    do_formula_enrichment: bool = True
    do_table_structure: bool = True
    table_mode: str = "accurate"
    use_flash_attention: bool = False
    device_type: DeviceType = DeviceType.CPU
    adjustments: Dict[str, str] = field(default_factory=dict)

    # Batch size — GPU 批处理吞吐优化（Docling 默认值均为 4）
    ocr_batch_size: int = 4
    layout_batch_size: int = 4
    table_batch_size: int = 4

    # OCR 引擎偏好
    ocr_engine: str = "default"  # "default" | "mac_native"

    @property
    def cache_key_segment(self) -> str:
        """生成用于 converter 缓存键的设备段。"""
        return (
            f"dev={self.device}|threads={self.num_threads}"
            f"|fa2={self.use_flash_attention}"
            f"|batch={self.ocr_batch_size},{self.layout_batch_size},{self.table_batch_size}"
            f"|ocr_eng={self.ocr_engine}"
        )


def resolve_device_config(
    device_preference: Optional[str] = None,
    num_threads: int = 4,
    enable_formula: bool = True,
    enable_table: bool = True,
    table_mode: str = "accurate",
    *,
    ocr_batch_size_override: int = 0,
    layout_batch_size_override: int = 0,
    table_batch_size_override: int = 0,
) -> DoclingDeviceConfig:
    """根据硬件环境解析最优 Docling 配置。

    此函数是设备适配的核心入口：
    1. 解析设备偏好（auto 时自动检测）
    2. 根据设备类型应用已知限制的降级策略
    3. 启用设备特定优化（如 CUDA Flash Attention 2、GPU batch size）
    4. 应用用户显式覆盖（batch size override > 0 时优先）
    5. 记录所有调整决策用于可观测性

    Args:
        device_preference: 设备偏好 ('auto', 'cpu', 'cuda', 'mps', 'xpu')
        num_threads: CPU 推理线程数
        enable_formula: 是否请求公式提取
        enable_table: 是否请求表格提取
        table_mode: TableFormer 模式 ('accurate', 'fast')
        ocr_batch_size_override: OCR batch size 显式覆盖（0=自动推断）
        layout_batch_size_override: Layout batch size 显式覆盖（0=自动推断）
        table_batch_size_override: Table batch size 显式覆盖（0=自动推断）

    Returns:
        设备适配后的完整配置
    """
    device_str = get_device_for_docling(device_preference)

    try:
        device_type = DeviceType(device_str)
    except ValueError:
        device_type = DeviceType.CPU

    config = DoclingDeviceConfig(
        device=device_str,
        device_type=device_type,
        num_threads=num_threads,
        do_formula_enrichment=enable_formula,
        do_table_structure=enable_table,
        table_mode=table_mode,
    )

    if device_type == DeviceType.MPS:
        _apply_mps_constraints(config)
    elif device_type == DeviceType.CUDA:
        _apply_cuda_optimizations(config)
    elif device_type == DeviceType.XPU:
        _apply_xpu_defaults(config)

    # 用户显式覆盖 batch size（优先于自动推断）
    if ocr_batch_size_override > 0:
        config.ocr_batch_size = ocr_batch_size_override
        config.adjustments["ocr_batch_size_override"] = (
            f"用户显式指定 ocr_batch_size={ocr_batch_size_override}"
        )
    if layout_batch_size_override > 0:
        config.layout_batch_size = layout_batch_size_override
        config.adjustments["layout_batch_size_override"] = (
            f"用户显式指定 layout_batch_size={layout_batch_size_override}"
        )
    if table_batch_size_override > 0:
        config.table_batch_size = table_batch_size_override
        config.adjustments["table_batch_size_override"] = (
            f"用户显式指定 table_batch_size={table_batch_size_override}"
        )

    if config.adjustments:
        for key, reason in config.adjustments.items():
            logger.info("Docling 配置调整 [%s]: %s — %s", device_str, key, reason)
    else:
        logger.info("Docling 设备配置: %s (无降级调整)", device_str)

    return config


# ---------------------------------------------------------------------------
# 平台策略函数
# ---------------------------------------------------------------------------


def _apply_mps_constraints(config: DoclingDeviceConfig) -> None:
    """应用 Apple Silicon MPS 的已知限制与优化。

    MPS 限制（Docling 2.12.0+ 官方文档）：
    - Formula enrichment: 与 MPS 不兼容，启用时整个管道回退 CPU
    - TableFormer: MPS 上被禁用，Docling 内部透明回退 CPU（无需干预）
    - Flash Attention 2: 仅 CUDA 支持

    MPS 优化：
    - Batch size: 根据统一内存大小自适应调优（保守策略）
    - OCR 引擎: macOS 上偏好 OcrMacOptions（Apple Vision Framework）

    策略: 主动禁用 formula enrichment 以避免 Docling 将整个管道回退到 CPU。
    公式通过 Markdown 正则提取补偿（已有 ``_extract_formulas`` 实现）。
    """
    if config.do_formula_enrichment:
        # 优先检测 MLX VLM 可用性：若已安装，保留 formula enrichment，
        # 由 DoclingEngine 层使用 granite_docling + MLX 承载；
        # 否则主动禁用以避免 CodeFormulaV2 回退 CPU。
        if _check_mlx_vlm_available():
            config.adjustments["formula_enrichment"] = (
                "MPS + mlx_vlm 可用，formula enrichment 保留；"
                "将由 DoclingEngine 使用 granite_docling + MLX 承载"
            )
        else:
            config.do_formula_enrichment = False
            config.adjustments["formula_enrichment"] = (
                "MPS 与 formula enrichment 不兼容且 mlx_vlm 未安装，"
                "已禁用以保持 GPU 加速；公式将通过 Markdown 正则提取替代"
            )

    config.use_flash_attention = False

    # Batch size 优化
    from .detection import get_cached_hardware_info

    hw_info = get_cached_hardware_info()
    ocr_bs, layout_bs, table_bs = _compute_gpu_batch_sizes(
        hw_info.memory_gb, config.device_type, hw_info.chip_generation
    )
    config.ocr_batch_size = ocr_bs
    config.layout_batch_size = layout_bs
    config.table_batch_size = table_bs
    gen_tag = f"M{hw_info.chip_generation}" if hw_info.chip_generation else "M?"
    config.adjustments["batch_sizes"] = (
        f"MPS batch size 优化: ocr={ocr_bs}, layout={layout_bs}, "
        f"table={table_bs} (基于 {hw_info.memory_gb:.1f}GB 统一内存, {gen_tag})"
        if hw_info.memory_gb
        else f"MPS batch size: ocr={ocr_bs}, layout={layout_bs}, "
        f"table={table_bs} ({gen_tag}, 内存未知)"
    )

    # macOS 原生 OCR 引擎偏好
    if platform.system() == "Darwin":
        config.ocr_engine = "mac_native"
        config.adjustments["ocr_engine"] = (
            "macOS 检测到，偏好 OcrMacOptions (Apple Vision Framework)"
        )


def _apply_cuda_optimizations(config: DoclingDeviceConfig) -> None:
    """应用 NVIDIA CUDA 特定优化。

    CUDA 优化：
    - Flash Attention 2: 显著提升 Transformer 推理性能（需安装 flash-attn）
    - Batch size: 根据专用显存大小自适应调优（可更激进）
    - 所有 Docling 功能均完全支持
    """
    config.use_flash_attention = _check_flash_attention_available()
    if config.use_flash_attention:
        config.adjustments["flash_attention"] = "Flash Attention 2 已启用"

    # Batch size 优化
    from .detection import get_cached_hardware_info

    hw_info = get_cached_hardware_info()
    ocr_bs, layout_bs, table_bs = _compute_gpu_batch_sizes(
        hw_info.memory_gb, config.device_type
    )
    config.ocr_batch_size = ocr_bs
    config.layout_batch_size = layout_bs
    config.table_batch_size = table_bs
    config.adjustments["batch_sizes"] = (
        f"CUDA batch size 优化: ocr={ocr_bs}, layout={layout_bs}, "
        f"table={table_bs} (基于 {hw_info.memory_gb:.1f}GB 显存)"
        if hw_info.memory_gb
        else f"CUDA batch size: ocr={ocr_bs}, layout={layout_bs}, table={table_bs} (显存未知)"
    )


def _apply_xpu_defaults(config: DoclingDeviceConfig) -> None:
    """应用 Intel XPU 基础优化。

    XPU 优化：
    - Flash Attention 2: 不支持
    - Batch size: 根据显存自适应调优
    """
    config.use_flash_attention = False

    from .detection import get_cached_hardware_info

    hw_info = get_cached_hardware_info()
    ocr_bs, layout_bs, table_bs = _compute_gpu_batch_sizes(
        hw_info.memory_gb, config.device_type
    )
    config.ocr_batch_size = ocr_bs
    config.layout_batch_size = layout_bs
    config.table_batch_size = table_bs
    if hw_info.memory_gb:
        config.adjustments["batch_sizes"] = (
            f"XPU batch size: ocr={ocr_bs}, layout={layout_bs}, "
            f"table={table_bs} (基于 {hw_info.memory_gb:.1f}GB 显存)"
        )


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _compute_gpu_batch_sizes(
    memory_gb: Optional[float],
    device_type: DeviceType,
    chip_generation: Optional[int] = None,
) -> Tuple[int, int, int]:
    """根据 GPU 显存与 Apple Silicon 芯片代次推断最优 batch size。

    Batch size 推断策略（循证基准）：

    MPS（Apple Silicon 统一内存 — 保守策略）：
        由于 MPS 与 CPU 共享统一内存，实际可用 GPU 显存低于
        物理内存的 75% 估算值，因此使用更保守的映射关系。
        - < 12GB:  batch = 8  (M1/M2 8GB 基础型号)
        - 12-24GB: batch = 12 (M2 16GB / M3 Pro)
        - 24-48GB: batch = 16 (M2 Pro 32GB / M3 Max)
        - > 48GB:  batch = 32 (M2/M3 Ultra 128GB+)

        在同等内存下按芯片代次缩放（Apple Neural Engine + GPU
        逐代提升、带宽与 fp16 throughput 显著增长）：
        - M1/M2: × 1.0 （baseline）
        - M3:    × 1.25
        - M4:    × 1.5
        - M5+:   保留 × 1.5（未来扩展，避免越界）

    CUDA（NVIDIA 专用显存 — 可更激进）：
        - < 8GB:   batch = 8  (GTX 1060, RTX 3050)
        - 8-12GB:  batch = 16 (RTX 3060, RTX 4060)
        - 12-24GB: batch = 32 (RTX 3080, RTX 4070 Ti)
        - > 24GB:  batch = 64 (A100, RTX 4090)

    table_batch_size 使用 ``max(4, batch // 2)`` — TableFormer 模型
    单样本显存占用较大，更保守以避免 OOM。

    References:
        [1] Docling GPU 文档推荐 batch_size 上限 64,
            https://docling-project.github.io/docling/usage/gpu/
        [2] Apple Silicon 代次性能基准（M1/M2/M3/M4 GPU & ANE 对比）。

    Args:
        memory_gb: GPU 可用显存（GB），None 表示未知
        device_type: 设备类型
        chip_generation: Apple Silicon 芯片代次（1/2/3/4），仅 MPS 时生效

    Returns:
        (ocr_batch_size, layout_batch_size, table_batch_size)
    """
    if not device_type.is_gpu:
        return (4, 4, 4)

    if memory_gb is None:
        # GPU 但无法获取显存信息 → 安全默认值
        return (8, 8, 4)

    if device_type == DeviceType.MPS:
        if memory_gb >= 48:
            batch = 32
        elif memory_gb >= 24:
            batch = 16
        elif memory_gb >= 12:
            batch = 12
        else:
            batch = 8
        # Apple 芯片代次缩放（保守取整，最低保留 baseline）
        scale = _apple_chip_batch_scale(chip_generation)
        if scale != 1.0:
            batch = max(batch, int(round(batch * scale)))
    elif device_type == DeviceType.CUDA:
        if memory_gb >= 24:
            batch = 64
        elif memory_gb >= 12:
            batch = 32
        elif memory_gb >= 8:
            batch = 16
        else:
            batch = 8
    else:
        # XPU 等其他 GPU 类型，使用中等策略
        if memory_gb >= 16:
            batch = 16
        elif memory_gb >= 8:
            batch = 12
        else:
            batch = 8

    table_batch = max(4, batch // 2)
    return (batch, batch, table_batch)


def _apple_chip_batch_scale(chip_generation: Optional[int]) -> float:
    """Apple Silicon 芯片代次对应的 batch size 缩放系数。

    M1/M2 保持 baseline，M3 起每代 GPU/ANE/带宽显著提升，
    在统一内存允许时可适度提高 batch 提升吞吐。

    Returns:
        缩放系数（M1/M2: 1.0；M3: 1.25；M4+: 1.5）
    """
    if chip_generation is None or chip_generation <= 2:
        return 1.0
    if chip_generation == 3:
        return 1.25
    # M4 及以上代次（含未来 M5+）：1.5x
    return 1.5


def _check_flash_attention_available() -> bool:
    """检测 Flash Attention 2 是否可用。"""
    try:
        import flash_attn  # noqa: F401

        return True
    except ImportError:
        return False


def _check_mlx_vlm_available() -> bool:
    """检测 mlx-vlm 是否已安装（Apple Silicon MLX 视觉语言模型）。"""
    try:
        from importlib.util import find_spec

        return find_spec("mlx_vlm") is not None
    except (ImportError, ValueError):
        return False
