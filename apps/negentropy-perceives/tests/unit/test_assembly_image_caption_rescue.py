"""``_figure_caption_to_inject`` 单元测试。

ISSUE-094 R9 D-6：image_extraction 偶尔未能从 PyMuPDF / Docling
正确关联图片下方的 caption 文本，导致 Markdown ``<img alt="...">`` 退化为
文件名（如 ``alt="fig_p4_2.png"``），同时下方独立段落 ``Figure 3:
Evolutionary process in context engineering`` 仍以纯文本形式存在 ——
视觉上"图旁有 caption"被破坏。

修复策略：当 image element 缺 caption（``image.caption`` 为空 / None）
且文档顺序紧邻下一个 text element 是 ``Figure N:`` / ``Fig. N:`` /
``Table N:`` 形式 caption 时，注入该 caption 到 image，复用既有 2.6 段
的 caption-vs-text 去重移除独立 caption 段落。

锁定不变量：
- ① image 已有 caption → 不再注入（保持 image_extraction 阶段结果）；
- ② next_text 为 None / 空字符串 → 不注入；
- ③ next_text 形如 ``Figure N:`` / ``Fig. N:`` / ``Table N:`` / ``Tab N -`` → 注入；
- ④ next_text 为普通段落（不匹配 caption 模式）→ 不注入；
- ⑤ next_text 含 caption 子串但首尾非 caption 模式 → 不注入（避免误识别）。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.stages.pdf.assembly import (
    _figure_caption_to_inject,
)


class TestFigureCaptionToInject:
    """R9 D-6：邻接段 caption 注入决策契约。"""

    def test_injects_figure_caption(self) -> None:
        """``Figure 3: Evolutionary process`` 形式 caption 必须注入。"""
        out = _figure_caption_to_inject(
            image_has_caption=False,
            next_text_block_text="Figure 3: Evolutionary process in context engineering",
        )
        assert out == "Figure 3: Evolutionary process in context engineering"

    def test_injects_fig_dot_caption(self) -> None:
        """``Fig. 5: ...`` 形式同样命中。"""
        out = _figure_caption_to_inject(
            image_has_caption=False, next_text_block_text="Fig. 5: blah blah"
        )
        assert out == "Fig. 5: blah blah"

    def test_injects_table_caption(self) -> None:
        """``Table 2: ...`` 同理。"""
        out = _figure_caption_to_inject(
            image_has_caption=False, next_text_block_text="Table 2: Results summary"
        )
        assert out == "Table 2: Results summary"

    def test_injects_tab_dash_caption(self) -> None:
        """``Tab 4 - ...`` 同理。"""
        out = _figure_caption_to_inject(
            image_has_caption=False, next_text_block_text="Tab 4 - extra notes"
        )
        assert out == "Tab 4 - extra notes"

    def test_strips_surrounding_whitespace(self) -> None:
        """前后空白被剥离再返回。"""
        out = _figure_caption_to_inject(
            image_has_caption=False,
            next_text_block_text="  Figure 1: cover figure  ",
        )
        assert out == "Figure 1: cover figure"

    # --- 不注入场景 ----------------------------------------------------------

    def test_skips_when_image_already_has_caption(self) -> None:
        """image 已有 caption → 不覆盖（image_extraction 阶段结果优先）。"""
        out = _figure_caption_to_inject(
            image_has_caption=True,
            next_text_block_text="Figure 9: would-be caption",
        )
        assert out is None

    def test_skips_when_next_text_none(self) -> None:
        """没有 next_text → 不注入。"""
        assert (
            _figure_caption_to_inject(
                image_has_caption=False, next_text_block_text=None
            )
            is None
        )

    def test_skips_when_next_text_empty(self) -> None:
        """next_text 为空字符串 / 仅空白 → 不注入。"""
        assert (
            _figure_caption_to_inject(image_has_caption=False, next_text_block_text="")
            is None
        )
        assert (
            _figure_caption_to_inject(
                image_has_caption=False, next_text_block_text="   "
            )
            is None
        )

    def test_skips_normal_paragraph(self) -> None:
        """普通段落（不匹配 caption 模式）→ 不注入。"""
        out = _figure_caption_to_inject(
            image_has_caption=False,
            next_text_block_text=(
                "Karl Marx once wrote that the human essence is the ensemble "
                "of social relations."
            ),
        )
        assert out is None

    def test_skips_paragraph_containing_figure_token_not_at_start(self) -> None:
        """正文中含 ``Figure 1`` 但非首部 → 不注入（避免误识别）。"""
        out = _figure_caption_to_inject(
            image_has_caption=False,
            next_text_block_text=(
                "As illustrated in Figure 1, the architecture has 4 stages."
            ),
        )
        assert out is None

    def test_skips_when_heading_text(self) -> None:
        """``## Section`` 形式 heading 不视为 caption（^# 起手）。"""
        out = _figure_caption_to_inject(
            image_has_caption=False,
            next_text_block_text="## 3 Historical Evolution",
        )
        assert out is None
