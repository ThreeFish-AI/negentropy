"""``MarkdownFormatter`` 表格 caption 重复去重单元测试。

R10-D20 沉淀：Agentic AI Survey 中 ``Table N ...`` caption 在 markdown 中
连续重复 2 次（PyMuPDF 把 caption 抽为正文段、table_extraction 又把 caption
内嵌为表格头部，二者均经 assembly 写入 markdown），形成视觉上的 ``Table 1 ...
\\n\\nTable 1 ...\\n\\n| ... |`` 结构。共 5 处（Table 1/2/3/5/8）。
"""

from __future__ import annotations

from negentropy.perceives.markdown.formatter import MarkdownFormatter


class TestTableCaptionDedupe:
    """``MarkdownFormatter`` 应去除紧邻重复的 ``Table N ...`` caption。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_adjacent_duplicate_table_caption_deduped(self) -> None:
        """连续两行相同的 ``Table 1 Summary ...`` caption 应仅保留一份。"""
        md = (
            "Table 1 Summary of prior surveys on Agentic AI\n\n"
            "Table 1 Summary of prior surveys on Agentic AI\n\n"
            "| References | Focus |\n"
            "| ---------- | ----- |\n"
            "| Plaat | Agentic LLMs |\n"
        )
        result = self.formatter.format(md)
        assert result.count("Table 1 Summary of prior surveys on Agentic AI") == 1

    def test_different_table_captions_preserved(self) -> None:
        """不同表格的不同 caption 应各保留一份。"""
        md = (
            "Table 1 Summary of prior surveys\n\n"
            "| a | b |\n| --- | --- |\n| 1 | 2 |\n\n"
            "Table 2 Mapping human functions\n\n"
            "| c | d |\n| --- | --- |\n| 3 | 4 |\n"
        )
        result = self.formatter.format(md)
        assert "Table 1 Summary of prior surveys" in result
        assert "Table 2 Mapping human functions" in result

    def test_non_adjacent_duplicate_table_caption_preserved(self) -> None:
        """跨段落非相邻重复的 caption 不强制去重（``Table 5 (continued)`` 等
        延续性 caption 合法地出现在不同位置）。
        """
        md = (
            "Table 5 (continued)\n\n"
            "| a | b |\n| --- | --- |\n| 1 | 2 |\n\n"
            "Some other paragraph here that is sufficiently long.\n\n"
            "Table 5 (continued)\n\n"
            "| c | d |\n| --- | --- |\n| 3 | 4 |\n"
        )
        result = self.formatter.format(md)
        assert result.count("Table 5 (continued)") == 2
