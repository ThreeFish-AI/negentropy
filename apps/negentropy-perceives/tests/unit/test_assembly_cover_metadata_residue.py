"""``_is_running_header_footer`` 对 PDF 封面元数据残留的扩展覆盖单测。

ISSUE-094 R9 D-1b：学术论文封面页常在作者 affiliations 行之后散落以下
两类元数据残片（PyMuPDF 无法依据视觉布局准确归类为页眉/页脚，
而直接抽为正文段落），导致 Markdown 文档头部出现无信息密度的孤立短行：

1. ``§ Github`` / ``§ Code`` / ``§ Project`` — 论文 PDF 中 GitHub 链接图标
   下方的锚文本（``§`` 表示 section-mark 装饰，并非章节符号）。
2. ``SII Context`` / ``MSR Cambridge`` 类 ``<ACRONYM> <ProjectDescriptor>`` —
   论文项目 banner（机构缩写 + 项目修饰词）。

本测试锁定：
- ① 上述两类模式必须被 ``_is_running_header_footer`` 识别为页眉/页脚残留；
- ② 正常正文（章节引用 ``§ 2.1``、人名 / 算法名、含项目描述词的长句）不被误吞。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.stages.pdf.assembly import (
    _is_running_header_footer,
)


class TestCoverMetadataResidueFilter:
    """R9 D-1b：封面元数据残留过滤的精准识别契约。"""

    # --- 必须被过滤的残片 -----------------------------------------------------

    def test_section_mark_link_anchor_github(self) -> None:
        """``§ Github`` — GitHub 图标下方锚文本必须被识别为残留。"""
        assert _is_running_header_footer("§ Github") is True

    def test_section_mark_link_anchor_code(self) -> None:
        """``§ Code`` 同理。"""
        assert _is_running_header_footer("§ Code") is True

    def test_section_mark_link_anchor_project(self) -> None:
        """``§ Project`` 同理。"""
        assert _is_running_header_footer("§ Project") is True

    def test_section_mark_link_anchor_with_trailing_whitespace(self) -> None:
        """``§ Github`` 含前后空白同样过滤。"""
        assert _is_running_header_footer("  §  Github  ") is True

    def test_project_banner_acronym_context(self) -> None:
        """``SII Context`` — 项目 banner 必须被识别为残留。"""
        assert _is_running_header_footer("SII Context") is True

    def test_project_banner_acronym_lab(self) -> None:
        """``MSR Lab`` / ``MIT Lab`` 同理。"""
        assert _is_running_header_footer("MIT Lab") is True
        assert _is_running_header_footer("MSR Cambridge") is False  # 非项目描述词

    def test_project_banner_acronym_engineering(self) -> None:
        """``CSE Engineering`` 类项目 banner 同理。"""
        assert _is_running_header_footer("CSE Engineering") is True

    def test_project_banner_acronym_genai(self) -> None:
        """``SII GenAI`` 类同理。"""
        assert _is_running_header_footer("SII GenAI") is True

    # --- 必须保留的正常内容 ---------------------------------------------------

    def test_keeps_section_reference(self) -> None:
        """``§ 2.1`` 是章节引用，不可过滤。"""
        assert _is_running_header_footer("§ 2.1") is False
        assert _is_running_header_footer("§ 3.1.2") is False

    def test_keeps_section_phrase_with_word(self) -> None:
        """``§ 2.1 Introduction`` 是章节标题引用，不可过滤。"""
        assert _is_running_header_footer("§ 2.1 Introduction") is False

    def test_keeps_legitimate_phrases_acronym_word(self) -> None:
        """``Federated Learning`` / ``Quantum Computing`` 等正常两词短语保留。

        触发判据要求第一词为 2-5 ALL-CAPS 字母（``Federated`` 不满足，``MIT`` 满足）。
        """
        assert _is_running_header_footer("Federated Learning") is False
        assert _is_running_header_footer("Quantum Computing") is False
        # ``MIT Press`` 即便首词为 ALL-CAPS 但 ``Press`` 不在项目描述词白名单
        assert _is_running_header_footer("MIT Press") is False

    def test_keeps_acronym_not_followed_by_project_descriptor(self) -> None:
        """``LLM Reasoning`` / ``GPT Training`` 第二词不在白名单，保留。"""
        assert _is_running_header_footer("LLM Reasoning") is False
        assert _is_running_header_footer("GPT Training") is False

    def test_keeps_section_mark_with_multiple_words(self) -> None:
        """``§ See Section 3`` 是引用句，长于 1 个单词应保留。"""
        assert _is_running_header_footer("§ See Section 3") is False

    def test_keeps_body_paragraph_with_section_mark(self) -> None:
        """正文中含 ``§`` 但长度 > 30 字符的段落不可被误过滤。"""
        body = (
            "This paper extends prior work § Github of the SII team and discusses "
            "context engineering paradigms across four eras."
        )
        assert _is_running_header_footer(body) is False

    def test_keeps_existing_acm_patterns(self) -> None:
        """R5 既有 ACM 页眉模式回归保护（确保扩展未破坏）。"""
        assert (
            _is_running_header_footer("Conference acronym 2025, July 12, City, USA")
            is True
        )
        assert _is_running_header_footer("https://doi.org/10.1234/xyz") is True
        assert (
            _is_running_header_footer("Permission to make digital or hard copies")
            is True
        )
        assert _is_running_header_footer("ACM Reference Format: ...") is True
