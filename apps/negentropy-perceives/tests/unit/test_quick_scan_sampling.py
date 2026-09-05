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


class TestTableCaptionIndicator:
    """``Table N:`` caption 级表格指示器的判别精度测试。

    quick_scan 用该模式补齐 native find_tables (ruling-line 策略) 与 pipe-line
    启发式双双漏报的 **空白对齐无框线表格** (如附录配置表)。要求: 行首起手 +
    紧跟 ``:``/``.``, 命中真实 caption 而不误伤句中引用 ("Table 1 shows...")。
    """

    import re as _re

    _CAP_RE = _re.compile(r"^\s*Table\s+S?\d+\s*[:.]", _re.IGNORECASE | _re.MULTILINE)

    def _count(self, text: str) -> int:
        return len(self._CAP_RE.findall(text))

    def test_matches_appendix_table_captions(self) -> None:
        """附录表格页的多个 caption 应被命中。"""
        text = (
            "Table 8: Key configuration fields in OPENDEV.\n"
            "model str LLM model identifier\n"
            "Table 9: Implementation constants in OPENDEV.\n"
        )
        assert self._count(text) == 2

    def test_matches_supplementary_table(self) -> None:
        """``Table S2.`` 补充材料编号亦命中。"""
        assert self._count("Table S2. Supplementary results\n") == 1

    def test_ignores_inline_reference(self) -> None:
        """句中引用 (非行首起手 / 无紧跟标点) 不误命中。"""
        text = (
            "As shown in Table 1 the results are consistent, and Table 2 confirms.\n"
            "We refer to Table 3 for details.\n"
        )
        assert self._count(text) == 0

    def test_ignores_prose_without_tables(self) -> None:
        """普通正文无 caption → 0 命中。"""
        text = "The rapid advancement of large language models has catalyzed change.\n"
        assert self._count(text) == 0
