"""``FitzTextExtractor`` 结构识别（页眉页脚过滤 + heading 分级）单元测试。

R10-D15/D16 沉淀：Agentic AI Survey (Springer Nature 期刊) PDF 包含两类
此前样本未触发的结构性失真：

- D15 页眉页脚泄漏：Springer 期刊页脚 ``11 Page 2 of 37`` / 反向 ``Page 3 of 37 11`` /
  作者运行头 ``M. Abou Ali et al.`` / 双数字页码 ``1 3`` 等模式被 PyMuPDF
  抽取为正文短段落，``_is_header_footer`` 的位置启发式因 ``20 <= text_len``
  下界过滤掉了所有 < 20 字符的运行头，导致泄漏。
- D16 误判 heading：列表项 ``1. A novel dual-paradigm taxonomy We introduce
  and employ a new framework (Fig. 2 )`` 被 ``_detect_heading`` 提升为 ``##``，
  破坏 TOC 与文档大纲；句子型正文被错升的根因是 ``len > 100`` 的长度阈值
  对学术句子型号召过于宽松。
"""

from __future__ import annotations

import pytest

from negentropy.perceives.pipeline.stages.pdf.text_extraction import (
    FitzTextExtractor,
)


class TestHeaderFooterFilter:
    """``_is_header_footer`` 应正确识别期刊页眉页脚而不误伤短标题。"""

    # bbox 与 page_height 的占位值（页脚区域）— 这些模式应通过纯文本即可判定，
    # 不依赖位置。
    BBOX_BODY = (50.0, 300.0, 400.0, 320.0)  # 正文居中
    PAGE_H = 800.0

    @pytest.mark.parametrize(
        "text",
        [
            "11 Page 2 of 37",  # Springer 期刊页脚（issue + page of total）
            "Page 3 of 37 11",  # 反向变体
            "1 3",  # 双数字运行页码（双栏期刊常见）
            "M. Abou Ali et al.",  # 作者运行头（First Author surname + et al.）
            "Smith and Jones et al.",  # 多作者运行头变体
        ],
    )
    def test_journal_running_headers_filtered(self, text: str) -> None:
        """期刊运行头 / 页脚不论位置都应过滤。"""
        assert FitzTextExtractor._is_header_footer(text, self.BBOX_BODY, self.PAGE_H)

    @pytest.mark.parametrize(
        "text",
        [
            "Introduction",  # 短标题应保留
            "Conclusion",
            "Methods",
            "1 Background",  # 编号短标题
            "2.1 Symbolic AI",  # 子节标题
            "Body paragraph starting with normal text.",  # 短正文段
        ],
    )
    def test_legitimate_short_text_not_filtered(self, text: str) -> None:
        """合法短标题 / 短段落不应被误判为页眉页脚。"""
        assert not FitzTextExtractor._is_header_footer(
            text, self.BBOX_BODY, self.PAGE_H
        )


class TestHeadingClassification:
    """``_detect_heading`` 不应把句子型正文升级为 heading。"""

    # 学术论文典型字号：body 10pt，h2/h3 11-13pt
    BODY_FONT = 10.0
    HEADING_FONT = 12.0

    @pytest.mark.parametrize(
        "text",
        [
            # R10-D16：编号开头但内含完整句子（含 "We" 作者代词 + 动词 "introduce"），
            # 应被识别为列表项 / 正文，而非 heading
            "1. A novel dual-paradigm taxonomy We introduce and employ a new framework",
            # 编号开头 + 不定式列表项（"To identify, classify, and synthesize ..."）
            "1. To identify, classify, and synthesize literature based on the dual paradigm",
            # 编号开头 + 含图表引用 + 显著主谓结构
            "2. We provide a comprehensive analysis of the agentic landscape (Fig. 2)",
        ],
    )
    def test_sentence_like_numbered_not_heading(self, text: str) -> None:
        """编号开头但句子结构明显的文本不应被升级为 heading。"""
        result = FitzTextExtractor._detect_heading(
            text, self.HEADING_FONT, self.BODY_FONT
        )
        assert result is None, f"unexpected heading level {result} for: {text!r}"

    @pytest.mark.parametrize(
        "text,expected_level",
        [
            # 真正的 numbered headings：短、名词性短语、无主谓结构
            ("1 Introduction", 1),
            ("2 Theoretical framework: a dual-paradigm taxonomy for Agentic AI", 1),
            ("2.1 Core principles of autonomy and agency", 2),
            ("2.2.1 Markov decision processes (MDPs)", 3),
            ("3 Methodology", 1),
            ("4 Findings: a paradigm-aware analysis of the Agentic AI landscape", 1),
        ],
    )
    def test_legitimate_numbered_headings_classified(
        self, text: str, expected_level: int
    ) -> None:
        """合法 numbered headings 应正确分级。"""
        result = FitzTextExtractor._detect_heading(
            text, self.HEADING_FONT, self.BODY_FONT
        )
        assert result == expected_level, (
            f"expected h{expected_level} for {text!r}, got {result}"
        )

    def test_sentence_like_non_numbered_not_heading(self) -> None:
        """非编号路径下，含作者代词 + 多词正文的句子（``Our analysis of the
        complete corpus reveals three significant patterns:``）即使字号较大
        也不应被升级为 heading —— 常见于章节小节的 lead-in 句。
        """
        text = "Our analysis of the complete corpus reveals three significant patterns:"
        result = FitzTextExtractor._detect_heading(
            text, self.HEADING_FONT, self.BODY_FONT
        )
        assert result is None, f"sentence lead-in misclassified as heading h{result}"

    def test_legitimate_short_pronoun_heading_preserved(self) -> None:
        """合法的"我方"风格短标题（如 ``Our methodology`` / ``Our approach``）
        应保留 —— 仅句子结构（pronoun + 多词正文）才被过滤。
        """
        for short in ("Our Method", "Our Approach", "Our Framework"):
            r = FitzTextExtractor._detect_heading(
                short, self.HEADING_FONT, self.BODY_FONT
            )
            # 短的 pronoun 起首 noun phrase 应被字号守卫接受为 heading
            # （非编号路径，依赖 size_ratio 推断级别）
            assert r is not None, f"short pronoun heading {short!r} dropped"

    # ---- R10-D25：编号 list-item label + 句子型 body 边界 ----

    def test_label_body_with_capital_hyphen_comma_not_heading(self) -> None:
        """编号 list-item label + 句子型 body 折叠到同一文本块的产物
        ``1. Paradigm specialization by domain High-stakes, regulated domains``
        包含 ``[a-z]+\\s+[A-Z][\\w-]+,`` 信号（lowercase + Capital-hyphen + 逗号），
        在学术 heading 中几乎不出现，应识别为列表项而非 heading。
        """
        text = (
            "1. Paradigm specialization by domain High-stakes, regulated domains "
            "like Healthcare"
        )
        result = FitzTextExtractor._detect_heading(
            text, self.HEADING_FONT, self.BODY_FONT
        )
        assert result is None, f"label+body list-item misclassified as h{result}"

    def test_legitimate_heading_with_capital_compound_preserved(self) -> None:
        """合法 heading 含 Capital 复合词但无逗号（``Deep Learning Models for
        Reinforcement Learning Applications``）应保留为 heading。"""
        text = "5 Deep Learning Models for Reinforcement Learning Applications"
        result = FitzTextExtractor._detect_heading(
            text, self.HEADING_FONT, self.BODY_FONT
        )
        assert result == 1, f"legitimate heading dropped: got {result!r}"

    def test_legitimate_heading_with_colon_subtitle_preserved(self) -> None:
        """合法 heading 含 colon subtitle（D25 length/colon 守卫）应保留。"""
        text = "4 Findings: a paradigm-aware analysis of the Agentic AI landscape"
        result = FitzTextExtractor._detect_heading(
            text, self.HEADING_FONT, self.BODY_FONT
        )
        assert result == 1

    def test_short_numbered_heading_with_one_capital_preserved(self) -> None:
        """长度 < 50 的短编号 heading 即使含 Capital 词也不应触发 D25。"""
        text = "2 Theoretical framework for Agentic AI"
        result = FitzTextExtractor._detect_heading(
            text, self.HEADING_FONT, self.BODY_FONT
        )
        assert result == 1

    def test_legitimate_compound_no_comma_preserved(self) -> None:
        """含 hyphen 的 Capital 复合词但无逗号（``Cross-functional analysis``）
        应保留为合法 heading。"""
        text = "3 Cross-functional analysis of LLM systems and frameworks"
        result = FitzTextExtractor._detect_heading(
            text, self.HEADING_FONT, self.BODY_FONT
        )
        assert result == 1
