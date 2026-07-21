"""``FitzTextExtractor`` 段内自然换行合并单元测试。

根因：PyMuPDF ``get_text("dict")`` 的块级分段是几何驱动（非语义驱动），对本类
排版会把顶到页面右边缘自然换行的同一段落相邻行拆成多个独立 block（每个 block
各自成为一个 ``TextBlock``）。assembly 阶段以 ``"\\n\\n".join`` 拼接 markdown 时，
这些本应连续的行被误判为独立段落（新起一段）——原本一段变成十几段，正文碎片化。

实测（308 页真实书籍）：``_merge_wrapped_paragraphs`` 前 12386 个 TextBlock，
后 5663 个（-54%），去空白归一化字符数完全一致（无内容丢失）；单页最坏案例
28 块 -> 10 块。

本文件锁定 ``_should_merge_wrapped_paragraph`` / ``_join_wrapped_text`` /
``_merge_wrapped_paragraphs`` 三个纯函数的合并契约：句末终结符判定、行距几何
安全网、结构起手守卫、目录点导引线守卫、中西文空格拼接规则。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.models import TextBlock
from negentropy.perceives.pipeline.stages.pdf.text_extraction import (
    FitzTextExtractor,
)

BODY_FONT = 10.0


def _tb(text: str, bbox: tuple[float, float, float, float], block_type="paragraph"):
    return TextBlock(text=text, page_number=0, bbox=bbox, block_type=block_type)


class TestShouldMergeWrappedParagraph:
    def test_merges_natural_line_wrap_continuation(self) -> None:
        # 顶到右边缘自然换行：prev 未以句末标点收尾，行距为单行高量级
        prev = _tb("工具定义（Tool Definitions）是Agent", (72.0, 100.0, 500.0, 112.0))
        cur = _tb("行动能力的基础，没有它无法调用工具。", (72.0, 117.0, 500.0, 129.0))
        assert FitzTextExtractor._should_merge_wrapped_paragraph(prev, cur, BODY_FONT)

    def test_does_not_merge_when_prev_ends_with_sentence_final_punctuation(
        self,
    ) -> None:
        prev = _tb("这是完整的一句话。", (72.0, 100.0, 500.0, 112.0))
        cur = _tb("这是新的一段。", (72.0, 117.0, 500.0, 129.0))
        assert not FitzTextExtractor._should_merge_wrapped_paragraph(
            prev, cur, BODY_FONT
        )

    def test_does_not_merge_across_heading(self) -> None:
        prev = _tb(
            "1.2.5 编排模式：工作流与自主",
            (72.0, 100.0, 500.0, 115.0),
            block_type="heading",
        )
        cur = _tb("工作流是通过预定义的代码路径", (72.0, 130.0, 500.0, 142.0))
        assert not FitzTextExtractor._should_merge_wrapped_paragraph(
            prev, cur, BODY_FONT
        )

    def test_does_not_merge_when_gap_too_large(self) -> None:
        # 大跨度（表格行/代码块/图注等无关内容），非单行高延续
        prev = _tb("无工具定义未终结", (72.0, 100.0, 500.0, 112.0))
        cur = _tb("无推理过程另一行内容", (72.0, 140.0, 500.0, 152.0))
        assert not FitzTextExtractor._should_merge_wrapped_paragraph(
            prev, cur, BODY_FONT
        )

    def test_does_not_merge_into_numbered_list_item(self) -> None:
        prev = _tb("上一段落未以标点收尾", (72.0, 100.0, 500.0, 112.0))
        cur = _tb("1. 核实用户身份——调用验证 API", (72.0, 117.0, 500.0, 129.0))
        assert not FitzTextExtractor._should_merge_wrapped_paragraph(
            prev, cur, BODY_FONT
        )

    def test_does_not_merge_into_figure_caption(self) -> None:
        prev = _tb("上一段落未以标点收尾", (72.0, 100.0, 500.0, 112.0))
        cur = _tb("图 4-3 事件驱动的异步 Agent 架构", (72.0, 117.0, 500.0, 129.0))
        assert not FitzTextExtractor._should_merge_wrapped_paragraph(
            prev, cur, BODY_FONT
        )

    def test_does_not_merge_toc_dot_leader_entries(self) -> None:
        # 印刷版目录：每条目本身不以句末标点收尾，但绝不应跨条目合并
        prev = _tb("全书结构. . . . . . . . . . . . . . 2", (72.0, 100.0, 500.0, 112.0))
        cur = _tb("如何阅读本书. . . . . . . . . . . . 4", (72.0, 117.0, 500.0, 129.0))
        assert not FitzTextExtractor._should_merge_wrapped_paragraph(
            prev, cur, BODY_FONT
        )

    def test_does_not_merge_toc_entry_without_leader_into_dotted_entry(self) -> None:
        prev = _tb("引言 1", (72.0, 100.0, 500.0, 112.0))
        cur = _tb("全书结构. . . . . . . . . . . . 2", (72.0, 117.0, 500.0, 129.0))
        assert not FitzTextExtractor._should_merge_wrapped_paragraph(
            prev, cur, BODY_FONT
        )

    def test_normal_prose_ending_in_bare_number_can_still_merge(self) -> None:
        # 真实散文换行恰好落在数字处（无点导引线）应仍视为延续，不被目录守卫误伤
        prev = _tb("这类问题一共有 3", (72.0, 100.0, 500.0, 112.0))
        cur = _tb("种类型，分别是……", (72.0, 117.0, 500.0, 129.0))
        assert FitzTextExtractor._should_merge_wrapped_paragraph(prev, cur, BODY_FONT)


class TestJoinWrappedText:
    def test_cjk_boundary_no_space(self) -> None:
        # 中途被拆断的复合词：工 + 具 -> 工具（不加空格）
        assert FitzTextExtractor._join_wrapped_text("更多的工", "具") == "更多的工具"

    def test_latin_then_cjk_boundary_gets_space(self) -> None:
        # 本书排版惯例：中西文之间加空格
        assert (
            FitzTextExtractor._join_wrapped_text("是Agent", "行动能力的基础")
            == "是Agent 行动能力的基础"
        )

    def test_cjk_then_latin_boundary_gets_space(self) -> None:
        assert (
            FitzTextExtractor._join_wrapped_text("调用的是", "Agent 框架")
            == "调用的是 Agent 框架"
        )

    def test_latin_then_latin_boundary_gets_space(self) -> None:
        assert (
            FitzTextExtractor._join_wrapped_text("Retrieval-", "Augmented Generation")
            == "Retrieval- Augmented Generation"
        )

    def test_empty_sides_passthrough(self) -> None:
        assert FitzTextExtractor._join_wrapped_text("", "cur") == "cur"
        assert FitzTextExtractor._join_wrapped_text("prev", "") == "prev"


class TestMergeWrappedParagraphs:
    def test_multi_fragment_paragraph_merges_into_one(self) -> None:
        blocks = [
            _tb(
                "1.1 现代 Agent = LLM + 上下文 + 工具",
                (72.0, 60.0, 500.0, 75.0),
                block_type="heading",
            ),
            _tb("工具定义（Tool Definitions）是Agent", (72.0, 100.0, 500.0, 112.0)),
            _tb(
                "行动能力的基础，没有它无法调用任何工具。工具执行结果",
                (72.0, 117.0, 500.0, 129.0),
            ),
            _tb(
                "是 Agent 下一步思考的直接依据，避免重复犯错。",
                (72.0, 134.0, 500.0, 146.0),
            ),
        ]
        merged = FitzTextExtractor._merge_wrapped_paragraphs(blocks, BODY_FONT)
        assert len(merged) == 2
        assert merged[0].block_type == "heading"
        assert merged[1].block_type == "paragraph"
        assert merged[1].text == (
            "工具定义（Tool Definitions）是Agent 行动能力的基础，"
            "没有它无法调用任何工具。工具执行结果是 Agent 下一步思考的"
            "直接依据，避免重复犯错。"
        )

    def test_toc_entries_stay_separate(self) -> None:
        blocks = [
            _tb("引言 1", (72.0, 60.0, 500.0, 72.0)),
            _tb("全书结构. . . . . . . . . . . 2", (72.0, 80.0, 500.0, 92.0)),
            _tb("如何阅读本书. . . . . . . . . 4", (72.0, 100.0, 500.0, 112.0)),
        ]
        merged = FitzTextExtractor._merge_wrapped_paragraphs(blocks, BODY_FONT)
        assert len(merged) == 3

    def test_bbox_union_on_merge(self) -> None:
        blocks = [
            _tb("上一行未终结", (72.0, 100.0, 300.0, 112.0)),
            _tb("续接的下一行。", (80.0, 117.0, 500.0, 129.0)),
        ]
        merged = FitzTextExtractor._merge_wrapped_paragraphs(blocks, BODY_FONT)
        assert len(merged) == 1
        assert merged[0].bbox == (72.0, 100.0, 500.0, 129.0)

    def test_short_list_passthrough(self) -> None:
        assert FitzTextExtractor._merge_wrapped_paragraphs([], BODY_FONT) == []
        single = [_tb("独立段落。", (72.0, 100.0, 500.0, 112.0))]
        assert FitzTextExtractor._merge_wrapped_paragraphs(single, BODY_FONT) == single

    def test_content_preserved_no_loss(self) -> None:
        import re

        blocks = [
            _tb("第一段第一行未终结", (72.0, 60.0, 500.0, 72.0)),
            _tb("第一段第二行终于结束。", (72.0, 80.0, 500.0, 92.0)),
            _tb("第二段独立一句。", (72.0, 100.0, 500.0, 112.0)),
        ]
        merged = FitzTextExtractor._merge_wrapped_paragraphs(blocks, BODY_FONT)
        before = "".join(re.sub(r"\s+", "", b.text) for b in blocks)
        after = "".join(re.sub(r"\s+", "", b.text) for b in merged)
        assert before == after
