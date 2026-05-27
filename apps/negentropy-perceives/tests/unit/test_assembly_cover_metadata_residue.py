"""``_is_running_header_footer`` 对 PDF 封面元数据残留的扩展覆盖单测。

ISSUE-094 R9 D-1b：学术论文封面页常在作者 affiliations 行之后散落以下
两类元数据残片（PyMuPDF 无法依据视觉布局准确归类为页眉/页脚，
而直接抽为正文段落），导致 Markdown 文档头部出现无信息密度的孤立短行：

1. ``§ Github`` / ``§ Code`` / ``§ Project`` — 论文 PDF 中 GitHub 链接图标
   下方的锚文本（``§`` 表示 section-mark 装饰，并非章节符号）。该类残片
   通过 ``_RUNNING_HEADER_FOOTER_PATTERNS`` 全页生效（不限封面）。
2. ``SII Context`` / ``MIT Lab`` 类 ``<ACRONYM> <ProjectDescriptor>`` —
   论文项目 banner。该类残片通过 ``_COVER_BANNER_PATTERNS`` **仅在
   封面页（page_number == 0）生效**，避免正文短句被静默吞噬。

R9 round 4 收紧（代码评审反馈）：
- 描述词白名单剔除 ``Research/Group/Center/Engineering/AI/ML/NLP`` 等通用词；
- 项目 banner 仅在 ``page_number == 0`` 触发；
- 正文 / 后续页面的 ``AI Research`` / ``NLP Lab`` / ``MIT Research``
  / ``GPT Lab`` / ``ETH Institute`` 等合法短句不再被过滤。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.stages.pdf.assembly import (
    _is_running_header_footer,
)


class TestCoverMetadataResidueFilter:
    """R9 D-1b：封面元数据残留过滤的精准识别契约。"""

    # --- 全页生效模式（``§ Github`` 等链接锚） ------------------------------

    def test_section_mark_link_anchor_github(self) -> None:
        """``§ Github`` — GitHub 图标下方锚文本必须被识别为残留（全页生效）。"""
        assert _is_running_header_footer("§ Github") is True
        assert _is_running_header_footer("§ Github", page_number=0) is True
        assert _is_running_header_footer("§ Github", page_number=3) is True

    def test_section_mark_link_anchor_code(self) -> None:
        """``§ Code`` 同理。"""
        assert _is_running_header_footer("§ Code", page_number=0) is True

    def test_section_mark_link_anchor_project(self) -> None:
        """``§ Project`` 同理。"""
        assert _is_running_header_footer("§ Project", page_number=0) is True

    def test_section_mark_link_anchor_with_trailing_whitespace(self) -> None:
        """``§ Github`` 含前后空白同样过滤。"""
        assert _is_running_header_footer("  §  Github  ", page_number=0) is True

    # --- 封面专属模式（仅 page_number == 0 生效） ----------------------------

    def test_project_banner_acronym_context_on_cover(self) -> None:
        """``SII Context`` —— 在封面（page_number=0）必须被识别为残留。"""
        assert _is_running_header_footer("SII Context", page_number=0) is True

    def test_project_banner_acronym_lab_on_cover(self) -> None:
        """``MIT Lab`` —— 在封面（page_number=0）必须被识别为残留。"""
        assert _is_running_header_footer("MIT Lab", page_number=0) is True

    def test_project_banner_acronym_genai_on_cover(self) -> None:
        """``SII GenAI`` —— 在封面（page_number=0）必须被识别为残留。"""
        assert _is_running_header_footer("SII GenAI", page_number=0) is True

    def test_project_banner_descriptor_not_in_whitelist(self) -> None:
        """``MSR Cambridge`` —— Cambridge 不在描述词白名单，保留。"""
        assert _is_running_header_footer("MSR Cambridge", page_number=0) is False

    # --- 关键回归：封面 banner 在正文页不可被误吞 ----------------------------

    def test_project_banner_kept_on_body_page(self) -> None:
        """``MIT Lab`` 出现在正文页（page > 0）必须保留 —— 是合法的研究组引用。"""
        assert _is_running_header_footer("MIT Lab", page_number=5) is False

    def test_project_banner_kept_when_page_unknown(self) -> None:
        """``SII Context`` 在 ``page_number`` 缺省（None）时保留。

        旧接口签名向后兼容路径；只有在调用方显式声明 ``page_number == 0``
        时才施加 cover banner 模式。
        """
        assert _is_running_header_footer("SII Context") is False

    # --- 关键回归：评审反馈的合法短句不可被过滤 ------------------------------

    def test_keeps_ai_research_on_body_page(self) -> None:
        """``AI Research`` —— 通用学科描述，正文页面常见标题/引用，必须保留。"""
        assert _is_running_header_footer("AI Research", page_number=2) is False
        # 即便在封面页：``Research`` 已从白名单移除，也不再误判
        assert _is_running_header_footer("AI Research", page_number=0) is False

    def test_keeps_ml_engineering_on_body_page(self) -> None:
        """``ML Engineering`` —— 章节/职位/小标题常见短句，必须保留。"""
        assert _is_running_header_footer("ML Engineering", page_number=3) is False
        assert _is_running_header_footer("ML Engineering", page_number=0) is False

    def test_keeps_nlp_lab_on_body_page(self) -> None:
        """``NLP Lab`` —— 正文页面合法研究组引用，不可被封面 banner 模式误吞。"""
        assert _is_running_header_footer("NLP Lab", page_number=4) is False

    def test_keeps_mit_research_anywhere(self) -> None:
        """``MIT Research`` —— ``Research`` 已踢出白名单，全页保留。"""
        assert _is_running_header_footer("MIT Research", page_number=0) is False
        assert _is_running_header_footer("MIT Research", page_number=7) is False

    def test_keeps_llm_research_anywhere(self) -> None:
        """``LLM Research`` —— 同上。"""
        assert _is_running_header_footer("LLM Research", page_number=0) is False
        assert _is_running_header_footer("LLM Research", page_number=5) is False

    def test_keeps_gpt_lab_on_body_page(self) -> None:
        """``GPT Lab`` —— 正文页面合法研究组引用，不可被封面 banner 误吞。"""
        assert _is_running_header_footer("GPT Lab", page_number=4) is False

    def test_keeps_eth_institute_on_body_page(self) -> None:
        """``ETH Institute`` —— 正文页面合法机构引用，不可被封面 banner 误吞。"""
        assert _is_running_header_footer("ETH Institute", page_number=2) is False

    # --- 既有：正常正文绝对不可被过滤 ----------------------------------------

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
        assert _is_running_header_footer("Federated Learning", page_number=0) is False
        assert _is_running_header_footer("Quantum Computing", page_number=0) is False
        # ``MIT Press`` 即便首词为 ALL-CAPS 但 ``Press`` 不在项目描述词白名单
        assert _is_running_header_footer("MIT Press", page_number=0) is False

    def test_keeps_acronym_not_followed_by_project_descriptor(self) -> None:
        """``LLM Reasoning`` / ``GPT Training`` 第二词不在白名单，保留。"""
        assert _is_running_header_footer("LLM Reasoning", page_number=0) is False
        assert _is_running_header_footer("GPT Training", page_number=0) is False

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
