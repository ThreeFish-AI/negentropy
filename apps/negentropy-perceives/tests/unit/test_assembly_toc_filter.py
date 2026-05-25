"""assembly.py TOC（目录）表格识别与抑制测试。

学术论文 PDF 的目录表常被 docling/pymupdf 提取为列对齐错乱的多列表格
（如 ``| 1 | 1 | 1 | 4 |``、点 leader 长串等）。在 Markdown 中这样的
表格既不便阅读、也不能可靠跳转到对应章节，应识别并降级抑制。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.stages.pdf.assembly import (
    _is_toc_table_text,
)


class TestTocTableDetection:
    """``_is_toc_table_text`` 应识别多种 TOC 表格典型形态。"""

    def test_classic_toc_with_dot_leaders(self) -> None:
        toc = "\n".join(
            [
                "| 1 | 1 | 1 | 4 |",
                "| ---- | ---- | ---- | ---- |",
                "| | 1.1 | The Binding Constraint: Harness over Model........ | 4 |",
                "| | 1.2 | The Practitioner-Research Gap................ | 4 |",
                "| | 2.1 | Evolution of Agent Systems.................. | 5 |",
            ]
        )
        assert _is_toc_table_text(toc)

    def test_toc_with_section_numbers_only(self) -> None:
        toc = "\n".join(
            [
                "| 7.1 | Tracing and Monitoring Platforms...... | 28 |",
                "| 7.2 | Agent-Specific Operations Platforms............ | 29 |",
                "| 7.3 | Cost Tracking and Optimization.............. | 30 |",
            ]
        )
        assert _is_toc_table_text(toc)

    def test_normal_data_table_not_toc(self) -> None:
        table = "\n".join(
            [
                "| Algorithm | Time | Space |",
                "| ----- | ----- | ----- |",
                "| Dijkstra | O(E log V) | O(V) |",
                "| Bellman-Ford | O(VE) | O(V) |",
            ]
        )
        assert not _is_toc_table_text(table)

    def test_small_caption_not_toc(self) -> None:
        text = "| Layer | Description |\n| ----- | ----- |\n| E | Execution |"
        assert not _is_toc_table_text(text)

    def test_empty_string_not_toc(self) -> None:
        assert not _is_toc_table_text("")

    def test_results_table_with_many_dots_not_toc(self) -> None:
        """正文中的数据表即使含一些点也不应被误判为 TOC（需要『点 leader』模式且页码列）。"""
        table = "\n".join(
            [
                "| Metric | Value |",
                "| ----- | ----- |",
                "| Accuracy | 0.95 |",
                "| F1 score | 0.91 |",
            ]
        )
        assert not _is_toc_table_text(table)
