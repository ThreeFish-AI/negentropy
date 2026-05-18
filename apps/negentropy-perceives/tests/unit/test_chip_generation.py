"""Apple Silicon 芯片代次解析单元测试。

覆盖 ``parse_apple_chip_generation`` 在常见与边界 brand_string 上的解析行为；
该解析结果会驱动 ``device_config._compute_gpu_batch_sizes`` 的代次缩放，
出错时会让 M3/M4 退回 baseline，丢失吞吐收益。
"""

from __future__ import annotations

import pytest

from negentropy.perceives.pdf.hardware.detection import parse_apple_chip_generation


@pytest.mark.parametrize(
    "brand,expected",
    [
        ("Apple M1", 1),
        ("Apple M1 Pro", 1),
        ("Apple M1 Max", 1),
        ("Apple M1 Ultra", 1),
        ("Apple M2", 2),
        ("Apple M2 Pro", 2),
        ("Apple M2 Max", 2),
        ("Apple M2 Ultra", 2),
        ("Apple M3", 3),
        ("Apple M3 Pro", 3),
        ("Apple M3 Max", 3),
        ("Apple M4", 4),
        ("Apple M4 Pro", 4),
        ("Apple M4 Max", 4),
        ("Apple M5 Future", 5),  # 未来扩展
        ("apple m2 pro", 2),  # 大小写不敏感
        (" Apple M3 ", 3),  # 容忍前后空格
    ],
)
def test_parse_apple_chip_generation_recognized(brand: str, expected: int) -> None:
    assert parse_apple_chip_generation(brand) == expected


@pytest.mark.parametrize(
    "brand",
    [
        None,
        "",
        "Intel Xeon Gold 6248R",
        "AMD EPYC 7763",
        "Apple",  # 无 M{n} 段
        "Apple M",  # 缺数字
        "Apple Silicon (placeholder)",
        "Mn unknown",
    ],
)
def test_parse_apple_chip_generation_unrecognized(brand) -> None:  # type: ignore[no-untyped-def]
    assert parse_apple_chip_generation(brand) is None


def test_chip_generation_drives_batch_scaling() -> None:
    """端到端：芯片代次解析 → batch 缩放。"""
    from negentropy.perceives.pdf.hardware.detection import DeviceType
    from negentropy.perceives.pdf.hardware.device_config import (
        _compute_gpu_batch_sizes,
    )

    m1 = parse_apple_chip_generation("Apple M1 Pro")
    m4 = parse_apple_chip_generation("Apple M4 Max")
    assert m1 == 1 and m4 == 4

    bs_m1 = _compute_gpu_batch_sizes(24.0, DeviceType.MPS, m1)
    bs_m4 = _compute_gpu_batch_sizes(24.0, DeviceType.MPS, m4)
    # M4 batch 严格大于 M1（缩放 1.5x）
    assert bs_m4[0] > bs_m1[0]
