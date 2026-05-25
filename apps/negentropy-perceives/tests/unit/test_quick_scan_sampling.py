"""quick_scan 分散采样策略单元测试。

学术论文的数学公式 / 代码 / 表格常出现在方法、实验或附录章节，
连续扫描前 N 页（例如前 10 页）容易漏掉中后段。本套测试为
``_compute_scan_page_indices`` 设定边界。
"""

from negentropy.perceives.pipeline.stages.pdf.quick_scan import (
    _compute_scan_page_indices,
)


class TestQuickScanSampling:
    """测试 quick_scan 的页码采样策略。"""

    def test_small_doc_scans_all(self) -> None:
        """文档总页数 ≤ 采样窗口时全量扫描。"""
        indices = _compute_scan_page_indices(start=0, end=5, max_scan=15)
        assert indices == [0, 1, 2, 3, 4]

    def test_medium_doc_scans_all(self) -> None:
        """中等文档（10 页）全量扫描。"""
        indices = _compute_scan_page_indices(start=0, end=10, max_scan=15)
        assert indices == list(range(10))

    def test_large_doc_scans_distributed(self) -> None:
        """71 页文档分散采样 first 5 + middle 5 + last 5。"""
        indices = _compute_scan_page_indices(start=0, end=71, max_scan=15)
        assert len(indices) == 15
        # 前 5 页
        assert all(i in indices for i in range(5))
        # 末 5 页
        assert all(i in indices for i in range(66, 71))
        # 中段覆盖（包含 page 16/18/47/62 中至少一组邻近页）
        middle = [i for i in indices if 5 <= i <= 65]
        assert len(middle) == 5
        # 应分布在中段而非聚集首部
        assert max(middle) >= 30

    def test_page_range_respected(self) -> None:
        """指定 page_range 时只在区间内采样。"""
        indices = _compute_scan_page_indices(start=10, end=20, max_scan=15)
        assert all(10 <= i < 20 for i in indices)
        assert len(indices) == 10

    def test_no_duplicate_indices(self) -> None:
        """采样不应重复页码。"""
        indices = _compute_scan_page_indices(start=0, end=30, max_scan=15)
        assert len(indices) == len(set(indices))

    def test_zero_pages(self) -> None:
        """空范围返回空列表。"""
        indices = _compute_scan_page_indices(start=5, end=5, max_scan=15)
        assert indices == []
