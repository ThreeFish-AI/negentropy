"""Markdown 格式化管线：将原始 Markdown 内容增强为高质量输出。"""

from __future__ import annotations

import html
import logging
import os
import re
import unicodedata
import uuid
from enum import Enum, auto
from typing import TYPE_CHECKING, Dict, List, Optional, Tuple

if TYPE_CHECKING:
    from .html_preprocessor import ImgDimensionRegistry, VideoRegistry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 行类型分类：用于段落间距归一化
# ---------------------------------------------------------------------------


class _LineType(Enum):
    """Markdown 行级元素类型。"""

    EMPTY = auto()
    HEADING = auto()
    LIST_ITEM = auto()
    TABLE_ROW = auto()
    BLOCKQUOTE = auto()
    CODE_FENCE = auto()
    HR = auto()
    CODEBLOCK_PLACEHOLDER = auto()
    PLAIN_TEXT = auto()


_LINE_PATTERNS: List[Tuple[re.Pattern, _LineType]] = [
    (re.compile(r"^\s*$"), _LineType.EMPTY),
    (re.compile(r"^#{1,6}\s"), _LineType.HEADING),
    (re.compile(r"^\s*[-*+]\s"), _LineType.LIST_ITEM),
    (re.compile(r"^\s*\d+\.\s"), _LineType.LIST_ITEM),
    (re.compile(r"^\s*\|.*\|\s*$"), _LineType.TABLE_ROW),
    (re.compile(r"^\s*>"), _LineType.BLOCKQUOTE),
    (re.compile(r"^```"), _LineType.CODE_FENCE),
    (re.compile(r"^---+\s*$|^\*\*\*+\s*$|^___+\s*$"), _LineType.HR),
    (re.compile(r"^%%CODEBLOCK_"), _LineType.CODEBLOCK_PLACEHOLDER),
]

# 同构序列：这些行类型相邻时保持单个 \n
_HOMOGENEOUS_PAIRS = frozenset(
    {
        (_LineType.LIST_ITEM, _LineType.LIST_ITEM),
        (_LineType.TABLE_ROW, _LineType.TABLE_ROW),
        (_LineType.BLOCKQUOTE, _LineType.BLOCKQUOTE),
    }
)


# 运行页眉/页脚剥离：PDF 每页顶部/底部的 running header（如文档短标题）会被文本
# 抽取引擎逐页当作文体保留，在 Markdown 中形成同一短独立行重复数十次的噪声。
# ``_strip_running_headers`` 仅剥离「单行 + 简短 + 逐字完全相同 + 出现 ≥
# ``_RUNNING_HEADER_MIN_REPEAT`` 次」的行；阈值刻意远高于正常正文短行的复现次数
# （实测正文短行最高复现 2 次），从而零误伤。
_RUNNING_HEADER_MIN_REPEAT = 6
_RUNNING_HEADER_MAX_LEN = 80


# 伪代码块降级：抽取引擎（docling 等）偶把带边框的自然语言横幅（版权 / 关键词 /
# 署名横幅，形如 ``© Keywords: … © Github: …``）误判为 YAML / 代码块。此类内容
# 不含任何真实代码特征，且常含 ``©`` / ``®`` / ``™`` 商标版权符——后者在真实源码
# 与 YAML 中几乎不出现。``_demote_non_code_fences`` 仅当围栏块「含商标符且无任一
# 强代码信号」时剥离围栏还原为普通段落；判定刻意保守，对真代码 / 真 YAML 零误伤。
_NON_CODE_FENCE_TRIGGER = re.compile(r"[©®™]")
_NON_CODE_FENCE_CODE_SIGNALS = (
    re.compile(r"[{}]"),  # 花括号（绝大多数编程语言）
    re.compile(r";"),  # 分号（C 系 / SQL / JS 语句终止）
    re.compile(r"->|=>|::"),  # 箭头 / 作用域解析
    re.compile(r"==|!=|<=|>="),  # 比较运算符
    re.compile(r"""["'][^"'\n]{1,80}["']"""),  # 引号字符串
    re.compile(r"(?<!:)//|/\*|\*/"),  # C 系注释（排除 URL ``https://`` 的 ``//``）
)


# 跨行断字复合词守护：``([a-z]+)- ([a-z]+)`` 合并规则（行 910 附近）默认把所有
# ``word- word`` 当软断字合并为 ``wordword``，对 ``sur- vey→survey`` 正确，但对
# 语义复合词跨行（``high- level`` 源 ``high-level``）误并为 ``highlevel``。当连字符
# 左侧为下列「几乎只作复合词前缀、极少是某单词软断字碎片」的完整词时，保留连字符
# → ``high-level``。刻意排除 over/per/pro/con/com/dis/pre/re/for/out/off 等「既可
# 独立成词又常作软断字碎片」（performance/process/former/overall/react）的高频词，
# 避免把 ``per- formance`` 误留为 ``per-formance``。
_COMPOUND_HYPHEN_PREFIXES = frozenset(
    {
        # 体量 / 位置
        "high",
        "low",
        "mid",
        "long",
        "short",
        "deep",
        "wide",
        "near",
        "far",
        "top",
        "full",
        "half",
        "thin",
        "thick",
        "front",
        "back",
        "side",
        "end",
        # 真伪 / 开闭
        "real",
        "open",
        "closed",
        "fake",
        "true",
        # 动作
        "pull",
        "push",
        # 技术语义
        "repository",
        "state",
        "agent",
        "code",
        "model",
        "multi",
        "cross",
        "inter",
        "intra",
        "self",
        "single",
        "double",
        "triple",
        "fine",
        "gross",
        "net",
        "large",
        # 程度 / 性状
        "well",
        "ill",
        "hard",
        "soft",
        "hot",
        "cold",
        "fast",
        "slow",
        "stale",
        "clean",
        "dirty",
        "dry",
        "wet",
        "raw",
    }
)


# R10-D19 守护词表：em-dash 风格 ``word - connector ...`` 中的常见 RHS 连接词。
# Why: D19 的 ``word - word`` 合并对学术 PDF 表格 cell / Reference 内的跨行断字
# （``Scalabil - ity`` → ``Scalability``）有效，但对正文中的 em-dash 风格
# （``data - or what was left - was deleted``）会误吞分隔符。RHS 词若命中此表，
# 视为 em-dash 连接词，保留 ``  - `` 原貌；否则按断字处理合并。
# 涵盖：连词 / 冠词 / 关系代词 / be-have-do 助动词 / 情态动词 / 介词 / 人称代词 /
# 物主代词 / 常见副词 / 从属连词 / 否定词 / 转折词 / 拉丁缩写 (i.e. / e.g.)。
_EM_DASH_RHS_CONNECTORS = frozenset(
    {
        # 连词
        "or",
        "and",
        "but",
        "so",
        "if",
        "as",
        "yet",
        "nor",
        # 冠词
        "a",
        "an",
        "the",
        # 关系代词 / 疑问词
        "that",
        "which",
        "who",
        "whom",
        "whose",
        "where",
        "when",
        "why",
        "how",
        # be / have / do
        "is",
        "was",
        "are",
        "were",
        "be",
        "been",
        "being",
        "has",
        "have",
        "had",
        "having",
        "do",
        "does",
        "did",
        "doing",
        # 情态动词
        "will",
        "would",
        "shall",
        "should",
        "can",
        "could",
        "may",
        "might",
        "must",
        # 介词
        "to",
        "in",
        "on",
        "at",
        "by",
        "of",
        "for",
        "with",
        "from",
        "into",
        "onto",
        "about",
        "after",
        "before",
        "between",
        "through",
        # 人称代词 / 物主代词
        "i",
        "it",
        "he",
        "she",
        "we",
        "they",
        "you",
        "its",
        "his",
        "her",
        "our",
        "their",
        "your",
        # 副词
        "just",
        "only",
        "even",
        "also",
        "still",
        "rather",
        "perhaps",
        # 从属连词 / 转折
        "like",
        "than",
        "then",
        "since",
        "while",
        "until",
        "unless",
        "though",
        "because",
        "although",
        "despite",
        "except",
        "namely",
        "however",
        "moreover",
        "furthermore",
        "instead",
        # 否定
        "not",
        "no",
    }
)
# 拉丁缩写需带尾点匹配，单独保存
_EM_DASH_RHS_LATIN_ABBR = frozenset({"i.e.", "e.g.", "cf.", "viz."})


def _classify_line(line: str) -> _LineType:
    """将 Markdown 行分类为对应的块级元素类型。"""
    for pattern, line_type in _LINE_PATTERNS:
        if pattern.match(line):
            return line_type
    return _LineType.PLAIN_TEXT


# 间隔修饰符号 → 对应的组合变音字符（U+0300 系列）映射。
# PyMuPDF 把 ``Pokémon`` 这类含组合变音字符的词在 PDF 中拆为
# ``base + 独立间隔符号 + 后续字母``，``" ".join`` 拼回 ``Pok ´ emon``
# 形态。下表覆盖学术文献中最常见的几种组合：
#   ´  (U+00B4 ACUTE)              → U+0301 COMBINING ACUTE        (é, á, í, ó, ú)
#   ˋ  (U+02CB MODIFIER LETTER GRAVE) → U+0300 COMBINING GRAVE     (è, à)
#   ˆ  (U+02C6 CIRCUMFLEX)         → U+0302 COMBINING CIRCUMFLEX   (ê, â)
#   ¨  (U+00A8 DIAERESIS)          → U+0308 COMBINING DIAERESIS    (ä, ö, ü)
#   ˜  (U+02DC SMALL TILDE)        → U+0303 COMBINING TILDE        (ã, õ, ñ)
#   ˇ  (U+02C7 CARON)              → U+030C COMBINING CARON        (š, č, ž)
#
# **不收录** U+0060 ASCII BACKTICK：它与 Markdown inline code 定界符
# ```code``` 冲突，```getline``` 在 typography 管线中会被错误拼合
# 为 ``g̀etline`` 形态，破坏 webpage / PDF 流中常见的 inline-code 引用。
# PDF 真实的 grave-accent 间隔符通常编码为 U+02CB（``ˋ``），与 ASCII backtick
# 视觉相似但 codepoint 不同，可以安全收录。
_DIACRITIC_MAP: Dict[str, str] = {
    "´": "́",
    "ˋ": "̀",
    "ˆ": "̂",
    "¨": "̈",
    "˜": "̃",
    "ˇ": "̌",
}

_SPLIT_DIACRITIC_RE = re.compile(
    r"([A-Za-z])\s*(["
    + "".join(re.escape(c) for c in _DIACRITIC_MAP)
    + r"])\s*([A-Za-z])"
)


def _rejoin_split_diacritics(text: str) -> str:
    """组合 PDF 提取拆解的间隔变音符号回到预组合 Unicode 字符。

    匹配 ``<letter><space>?<spacing-diacritic><space>?<letter>`` 形态，
    在 PDF 中变音符号视觉上落在 **后续字母** 上（``Pok ´ emon`` =
    ``Pok`` + ``é`` + ``mon``；``Westh ¨ außer`` = ``Westh`` + ``ä`` +
    ``ußer``），因此把组合字符贴到 next_char，通过
    ``unicodedata.normalize("NFC", ...)`` 收敛为预组合 codepoint。
    """
    if not text:
        return text

    def _replace(match: re.Match) -> str:
        prev_char, diacritic, next_char = match.group(1), match.group(2), match.group(3)
        combining = _DIACRITIC_MAP.get(diacritic)
        if combining is None:
            return match.group(0)
        # 修饰符视觉上落在 **后续字母** 上：``Pok ´ emon`` = ``Pok`` + (e + ́)
        # + ``mon``；``Westh ¨ außer`` = ``Westh`` + (a + ̈) + ``ußer``。
        composed = unicodedata.normalize("NFC", f"{next_char}{combining}")
        return f"{prev_char}{composed}"

    # 用 while 循环处理形如 ``Pok ´ emo n`` 这种已被拆成多段的极端情况
    # （罕见但成本极低）。每次替换可能合并相邻片段，进而暴露下一处匹配。
    prev = None
    while prev != text:
        prev = text
        text = _SPLIT_DIACRITIC_RE.sub(_replace, text)
    return text


def _is_list_continuation(line: str) -> bool:
    """判断行是否为列表项的缩进续行（非新列表标记的缩进文本）。"""
    if not line or not line[0].isspace():
        return False
    stripped = line.lstrip()
    # 本身是新列表标记则不算续行
    if re.match(r"^[-*+]\s", stripped) or re.match(r"^\d+\.\s", stripped):
        return False
    return True


# Default formatting options
DEFAULT_FORMATTING_OPTIONS: Dict[str, bool] = {
    "format_tables": True,
    "enhance_images": True,
    "optimize_links": True,
    "format_lists": True,
    "format_headings": True,
    "apply_typography": True,
    "smart_quotes": True,
    "em_dashes": True,
    "fix_spacing": True,
    # 保留源 HTML <img> 的 width/height 尺寸到最终 Markdown（输出为内嵌 HTML）。
    # 默认开启；关闭后所有图片走标准 ![alt](src) 形式（旧行为）。
    "preserve_image_dimensions": True,
}

# 响应式样式：在保留源尺寸的同时允许窄屏自适应（W3C 推荐 pattern）。
_IMG_RESPONSIVE_STYLE = "max-width:100%;height:auto;"


def _strip_orphan_styles(markdown_content: str) -> str:
    """清除孤立的 ``style="..."`` 属性，但保留 ``<img>`` 标签内的 style。

    ``_image_to_markdown`` 输出的 ``style="max-width:100%;height:auto;"`` 是
    PDF→Markdown 图片响应式的核心契约，不可被防御性 cleanup 误删。
    实现方式：先将 ``<img ...>`` 替换为占位符，执行清除，再还原。
    """
    _IMG_TAG_RE = re.compile(r"<img\b[^>]*/?>")
    img_tags: list[str] = []

    def _protect(match: re.Match) -> str:
        img_tags.append(match.group(0))
        return f"%%_IMGTAG_{len(img_tags) - 1}%%"

    text = _IMG_TAG_RE.sub(_protect, markdown_content)
    text = re.sub(r'\s+style="[^"]*"', "", text)
    for i, tag in enumerate(img_tags):
        text = text.replace(f"%%_IMGTAG_{i}%%", tag)
    return text


class MarkdownFormatter:
    """Markdown formatting pipeline for enhancing raw Markdown output."""

    def __init__(self, options: Optional[Dict[str, bool]] = None) -> None:
        self.options = dict(DEFAULT_FORMATTING_OPTIONS)
        if options:
            self.options.update(options)

    def format(
        self,
        markdown_content: str,
        *,
        img_registry: Optional["ImgDimensionRegistry"] = None,
        video_registry: Optional["VideoRegistry"] = None,
    ) -> str:
        """
        Apply the full formatting pipeline to Markdown content.

        Args:
            markdown_content: Raw Markdown content
            img_registry: 由 ``preprocess_html`` 填充的图片尺寸登记簿。若提供
                且 ``preserve_image_dimensions`` 开关开启，则在管线末尾把
                sentinel 占位符还原为内嵌 HTML ``<img>`` 标签。

        Returns:
            Enhanced and cleaned up Markdown content
        """
        try:
            # Code block language detection and structural fixes must run
            # BEFORE protection, because they operate on actual ``` fence
            # markers.  After protection all fences become %%CODEBLOCK_…%%
            # placeholders and none of the regex patterns can match.
            markdown_content = self._format_code_blocks(markdown_content)

            # 保护代码块内容不被格式化 pass 修改
            markdown_content, protected = self._protect_code_blocks(markdown_content)
            # 保护块级数学公式 ``$$..$$`` 不被任何排版 / 段落 / 去重 pass 修改。
            # 必须紧邻 ``_protect_code_blocks`` 之后执行，确保管线全程仅处理
            # 占位符而非真实 LaTeX 内容。
            markdown_content, math_protected = self._protect_math_blocks(
                markdown_content
            )

            if self.options.get("format_tables", True):
                markdown_content = self._format_tables(markdown_content)

            if self.options.get("enhance_images", True):
                markdown_content = self._format_images(markdown_content)

            if self.options.get("optimize_links", True):
                markdown_content = self._format_links(markdown_content)

            if self.options.get("format_lists", True):
                markdown_content = self._format_lists(markdown_content)

            if self.options.get("format_headings", True):
                markdown_content = self._format_headings(markdown_content)

            markdown_content = self._format_quotes(markdown_content)

            if self.options.get("apply_typography", True):
                markdown_content = self._apply_typography_fixes(markdown_content)

            if self.options.get("fix_spacing", True):
                markdown_content = self._normalize_paragraph_breaks(markdown_content)

            # 剥离逐字高频重复的运行页眉/页脚独立行（如 PDF 短标题每页残留）
            markdown_content = self._strip_running_headers(markdown_content)

            # 近似段落去重（跨引擎内容重复）
            markdown_content = self._deduplicate_approximate_paragraphs(
                markdown_content
            )

            markdown_content = self._basic_cleanup(markdown_content)

            # 清洗损坏的数学公式块：截断重复模式、移除空公式
            markdown_content = self._cleanup_math_blocks(markdown_content)

            # 还原带尺寸的图片：必须在 _basic_cleanup 之后执行，否则其中的
            # `style="..."` 会被 cleanup 第二段 re.sub 误清除。
            if (
                img_registry is not None
                and self.options.get("preserve_image_dimensions", True)
                and img_registry.placeholders
            ):
                markdown_content = self._restore_image_placeholders(
                    markdown_content, img_registry
                )

            # 还原 <video> 占位符为内嵌 HTML：必须在 _basic_cleanup 之后，
            # 否则 sentinel 文本可能被 cleanup pass 误转义。
            if video_registry is not None and video_registry.placeholders:
                markdown_content = self._restore_video_placeholders(
                    markdown_content, video_registry
                )

            # 还原块级数学公式占位符（须在 _cleanup_math_blocks 之后，
            # 这样数学块整体仍由本管线统一治理，但 LaTeX 主体内容不被修改）
            markdown_content = self._restore_math_blocks(
                markdown_content, math_protected
            )

            # 还原被保护的代码块
            markdown_content = self._restore_code_blocks(markdown_content, protected)

            return markdown_content

        except Exception as e:
            logger.warning(f"Error post-processing Markdown: {str(e)}")
            return markdown_content

    def format_fidelity_safe(self, markdown_content: str) -> str:
        """仅运行「内容保全型」保真 pass，跳过可能误删正文的 pass。

        与全量 :meth:`format` 的区别：**不跑** ``_deduplicate_approximate_paragraphs``
        （近似段落去重）与 ``_apply_typography_fixes`` 等会改写/删除正文的 pass。
        引擎/批处理路径（auto_batch 合并产物）的正文（如参考文献）条目结构高度
        相似（共享 ``arXiv`` / ``Proceedings`` / 年份等词），全量 format 的 Jaccard
        去重会把后续条目误判为近似重复而删除（实测删去参考 [477]/[478] 标题）。

        仅保留两类定点修复，二者均不删除合法正文：
        - ``_format_code_blocks``：降级伪代码块（含 ``_demote_non_code_fences``）；
        - ``_strip_running_headers``：剥离逐字高频 / 与标题同文的运行页眉独立行。

        用于 :mod:`ops.pdf` 各返回路径对最终 markdown 的轻量后处理。
        """
        try:
            markdown_content = self._format_code_blocks(markdown_content)
            markdown_content = self._strip_running_headers(markdown_content)
            markdown_content = self._strip_orphan_lang_labels(markdown_content)
            return markdown_content
        except Exception as e:
            logger.warning(f"Error in fidelity-safe formatting: {str(e)}")
            return markdown_content

    def _strip_orphan_lang_labels(self, markdown_content: str) -> str:
        """移除 fence 外孤立的纯语言字面行（如独立成段的 ``python``）。

        抽取引擎（docling 等）偶把代码块的 lang 名字面作为独立文本行输出、
        或在围栏修复后遗留裸 lang 行，表现为 fenced code 块之后紧跟一至多行
        仅含语言名（``python`` / ``fortran`` / ``json`` 等）的孤立段落，破坏
        排版。本 pass 先用占位符保护所有 fenced 代码块（含其 ``​```lang``
        info string 行），再删除正文中"整行仅为已知语言名"的孤立行，最后还原
        代码块，确保不误删围栏 info string 与真实代码内容。
        """
        protected: Dict[str, str] = {}

        def _protect(match: re.Match) -> str:
            key = f"%%ORPHANLANG_{len(protected)}%%"
            protected[key] = match.group(0)
            return key

        # 保护所有 fenced 代码块整体（含首行 ```lang 与内容）
        text = re.sub(
            r"^```[^\n]*\n.*?^```[ \t]*$",
            _protect,
            markdown_content,
            flags=re.MULTILINE | re.DOTALL,
        )
        # 删除 fence 外整行仅为已知代码语言名的孤立行（大小写不敏感）。
        # 仅收录歧义性低的编程语言名，排除 "text" 等常见英文单词避免误删正文。
        _lang_names = (
            "python|fortran|algorithm|javascript|typescript|java|kotlin|"
            "golang|rust|ruby|php|perl|scala|swift|cpp|csharp|matlab|"
            "yaml|toml|dockerfile|makefile|graphql|protobuf"
        )
        text = re.sub(
            rf"(?im)^[ \t]*(?:{_lang_names})[ \t]*$\n?",
            "",
            text,
        )
        for key, block in protected.items():
            text = text.replace(key, block)
        return text

    def _protect_code_blocks(self, markdown_content: str) -> Tuple[str, Dict[str, str]]:
        """提取所有 fenced 代码块并替换为占位符，防止格式化管线修改其内容。

        包括两类：
        1. 带语言标签的代码块（```python, ```algorithm）— 保留原始 fence
        2. 未标注语言的纯 fence 代码块（``` ... ```）— 同样保护其内容，
           避免 ``_apply_typography_fixes`` 把 ``--`` 误改为 em-dash、
           智能引号替换等典型 typography 操作破坏代码语义。

        ``_format_code_blocks`` 自身处理"未标注语言的语言检测"工作，但保护
        机制要确保在 typography 之前所有 fenced block 都成为占位符。
        """
        protected: Dict[str, str] = {}

        def _replacer(match: re.Match) -> str:
            placeholder = f"%%CODEBLOCK_{uuid.uuid4().hex[:12]}%%"
            protected[placeholder] = match.group(0)
            return placeholder

        # 匹配所有 fenced 代码块：```<可选语言>\n...\n```
        # 已标注语言 (```python) 与未标注 (```\n) 都纳入保护
        result = re.sub(
            r"^```[^\n]*\n.*?^```\s*$",
            _replacer,
            markdown_content,
            flags=re.MULTILINE | re.DOTALL,
        )
        return result, protected

    def _restore_code_blocks(
        self, markdown_content: str, protected: Dict[str, str]
    ) -> str:
        """将占位符还原为原始代码块内容。"""
        for placeholder, original in protected.items():
            markdown_content = markdown_content.replace(placeholder, original)
        return markdown_content

    def _protect_math_blocks(self, markdown_content: str) -> Tuple[str, Dict[str, str]]:
        """提取块级数学公式 ``$$..$$`` 并替换为占位符，防止格式化管线
        在公式内部插入空行 / 跨段去重 / 排版替换破坏 LaTeX 完整性。

        典型回归（Context Engineering 2.0 论文 5.3 节）：
          1. ``_normalize_paragraph_breaks`` 把 ``$$``/``<latex>``/``$$``
             三个相邻 PLAIN_TEXT 行之间各插入空行，把单一公式拆为 3 段；
          2. ``_deduplicate_approximate_paragraphs`` 然后按段 Jaccard 比对，
             因公式正文段（已脱离 ``$$`` 包裹）与上一公式正文 token 高度
             重叠（``M``/``f``/``c``/``\\theta`` 等共享），整段被误删。

        保护策略：在 format() 入口把每个完整的 ``$$\\n..$$`` 块替换为
        ``%%MATHBLOCK_<uuid>%%`` 占位符，整个管线视其为不可破坏的原子单元；
        管线末尾再统一还原。同步避免 ``_apply_typography_fixes`` 等步骤
        破坏 LaTeX 内部空格 / em-dash / smart quotes。
        """
        protected: Dict[str, str] = {}

        def _replacer(match: re.Match) -> str:
            placeholder = f"%%MATHBLOCK_{uuid.uuid4().hex[:12]}%%"
            protected[placeholder] = match.group(0)
            return placeholder

        # 匹配独占两行的 ``$$`` 定界符之间的块级公式
        # （行首到行尾的 ``$$``，中间允许 ``\s*``，含多行 LaTeX）
        result = re.sub(
            r"^\$\$[^\S\n]*\n[\s\S]*?\n^\$\$[^\S\n]*$",
            _replacer,
            markdown_content,
            flags=re.MULTILINE,
        )
        return result, protected

    def _restore_math_blocks(
        self, markdown_content: str, protected: Dict[str, str]
    ) -> str:
        """将占位符还原为原始 ``$$..$$`` 数学块内容。"""
        for placeholder, original in protected.items():
            markdown_content = markdown_content.replace(placeholder, original)
        return markdown_content

    def _format_tables(self, markdown_content: str) -> str:
        """Format and align Markdown tables."""
        try:
            lines = markdown_content.split("\n")
            formatted_lines = []

            for i, line in enumerate(lines):
                if (
                    "|" in line
                    and line.strip().startswith("|")
                    and line.strip().endswith("|")
                ):
                    cells = [cell.strip() for cell in line.split("|")[1:-1]]

                    if i + 1 < len(lines) and re.match(
                        r"^\s*\|[\s\-:]+\|\s*$", lines[i + 1]
                    ):
                        formatted_line = "| " + " | ".join(cells) + " |"
                        formatted_lines.append(formatted_line)
                    elif re.match(r"^\s*\|[\s\-:]+\|\s*$", line):
                        separator_cells = []
                        for cell in cells:
                            if ":" in cell:
                                if cell.startswith(":") and cell.endswith(":"):
                                    separator_cells.append(":---:")
                                elif cell.endswith(":"):
                                    separator_cells.append("---:")
                                else:
                                    separator_cells.append(":---")
                            else:
                                separator_cells.append("---")
                        formatted_line = "| " + " | ".join(separator_cells) + " |"
                        formatted_lines.append(formatted_line)
                    else:
                        formatted_line = "| " + " | ".join(cells) + " |"
                        formatted_lines.append(formatted_line)
                else:
                    formatted_lines.append(line)

            return "\n".join(formatted_lines)
        except Exception as e:
            logger.warning(f"Error formatting tables: {str(e)}")
            return markdown_content

    def _format_images(self, markdown_content: str) -> str:
        """Enhance image formatting with better alt text."""
        try:

            def improve_image_alt(match):
                alt_text = match.group(1)
                image_url = match.group(2)

                if not alt_text or alt_text in ["", "image", "img", "photo", "picture"]:
                    filename = os.path.basename(image_url).split(".")[0]
                    alt_text = filename.replace("-", " ").replace("_", " ").title()

                return f"![{alt_text}]({image_url})"

            markdown_content = re.sub(
                r"!\[(.*?)\]\((.*?)\)", improve_image_alt, markdown_content
            )

            # Add proper spacing around images
            markdown_content = re.sub(r"(!\[.*?\]\(.*?\))", r"\n\1\n", markdown_content)

            # Caption 去重：当 ``![alt](url)`` 紧跟一个内容与 alt 文本相同的
            # 段落（HTML <figcaption> 经 MarkItDown 输出为独立段落），
            # 删除该重复段落避免 UI 渲染时 figcaption 与正文段同时出现。
            markdown_content = self._dedupe_image_caption(markdown_content)

            return markdown_content
        except Exception as e:
            logger.warning(f"Error formatting images: {str(e)}")
            return markdown_content

    @staticmethod
    def _dedupe_image_caption(markdown_content: str) -> str:
        """删除紧跟在 ``![alt](url)`` 后内容与 alt 完全相同的段落。

        匹配模式（按行）：
            ![<alt>](<url>)\n\n<text>\n
        当 ``<text>`` 去前后空格后与 ``<alt>`` 去前后空格后相同，则删除
        ``<text>`` 行（保留图片行与其后空行）。UI 渲染时 ``DocumentImage``
        会用 alt 作为 figcaption；若 markdown 里又写一遍同样的段落，
        figcaption 会重复出现。

        注意：仅匹配紧邻图片行的下一非空段落，并要求严格相等（去空格 +
        casefold），避免误删与 alt 局部相似的正文段。
        """
        lines = markdown_content.split("\n")
        img_re = re.compile(r"^\s*!\[(.*?)\]\(.*?\)\s*$")
        result: List[str] = []
        i = 0
        while i < len(lines):
            line = lines[i]
            m = img_re.match(line)
            if not m:
                result.append(line)
                i += 1
                continue
            alt = m.group(1).strip()
            result.append(line)
            i += 1
            # 跳过紧随其后的空行
            blanks_start = i
            while i < len(lines) and lines[i].strip() == "":
                i += 1
            if i < len(lines) and alt:
                next_text = lines[i].strip()
                if next_text and next_text.casefold() == alt.casefold():
                    # 跳过该重复段（不写入 result），同时把前置空行也只保留一个
                    if blanks_start < len(lines):
                        # 保留单个空行作为段落分隔
                        result.append("")
                    i += 1
                    # 跳过段落后的空行（保留一个）
                    while i < len(lines) and lines[i].strip() == "":
                        i += 1
                    continue
            # 普通情况：把空行原样追加
            for k in range(blanks_start, i):
                result.append(lines[k])
        return "\n".join(result)

    def _format_links(self, markdown_content: str) -> str:
        """Optimize link formatting."""
        try:
            markdown_content = re.sub(
                r"\[([^\]]+)\]\s*\(\s*([^\s\)]+)\s*\)", r"[\1](\2)", markdown_content
            )

            markdown_content = re.sub(
                r"\[([^\]]+)\]\s*\n\s*\(([^\)]+)\)", r"[\1](\2)", markdown_content
            )

            return markdown_content
        except Exception as e:
            logger.warning(f"Error formatting links: {str(e)}")
            return markdown_content

    def _demote_non_code_fences(self, markdown_content: str) -> str:
        """剥离实为自然语言横幅的伪代码块围栏，还原为普通段落。

        抽取引擎（docling 等）偶把带边框的自然语言横幅（版权 / 关键词 / 署名
        横幅，形如 ``© Keywords: … © Github: <url>``）误判为 YAML / 代码块。
        此类内容不含任何真实代码特征（无花括号 / 分号 / 箭头 / 比较运算符 /
        引号字符串 / C 系注释），且常含 ``©`` / ``®`` / ``™`` 商标版权符——后者
        在真实源码与 YAML 中几乎不出现。

        本 pass 对满足「含商标符 ``©/®/™`` 且无任一强代码信号」的围栏块剥离
        围栏、还原为普通段落；其余围栏块原样保留。判定刻意保守，避免误降级
        真代码 / 真 YAML（真 YAML 不含商标符）。
        """

        def _is_code_like(content: str) -> bool:
            return any(pat.search(content) for pat in _NON_CODE_FENCE_CODE_SIGNALS)

        def _demote(m: re.Match) -> str:
            content = m.group(1)
            if _NON_CODE_FENCE_TRIGGER.search(content) and not _is_code_like(content):
                return content.strip("\n")
            return m.group(0)

        return re.sub(
            r"^```[^\n]*\n(.*?)^```\s*$",
            _demote,
            markdown_content,
            flags=re.MULTILINE | re.DOTALL,
        )

    def _format_code_blocks(self, markdown_content: str) -> str:
        """Enhance code block formatting with language detection.

        IMPORTANT: Must be called BEFORE ``_protect_code_blocks`` in the
        ``format()`` pipeline.  All operations (consecutive-fence fix,
        FORTRAN label correction, language detection, blank-line padding)
        require actual ````` fence markers to be present in the text.
        After protection all fences become ``%%CODEBLOCK_…%%`` placeholders
        and none of the regex patterns here can match.
        """
        try:
            # 先把实为自然语言横幅（含 ©/®/™ 且无代码特征）的伪代码块降级为普通段落
            markdown_content = self._demote_non_code_fences(markdown_content)

            # 修复连续的代码围栏标记：```LANG\n``` filename → ```\n filename
            markdown_content = re.sub(
                r"^```(\w*)\n```[ \t]*(\S.*?)$",
                r"```\n\2",
                markdown_content,
                flags=re.MULTILINE,
            )

            # 将 FORTRAN 标签中非 FORTRAN 代码的内容改为纯代码块
            # （Docling 常将伪代码/配置文件误标为 FORTRAN）
            def _fix_fortran_label(m: re.Match) -> str:
                content = m.group(1)
                # 真正的 FORTRAN 特征：PROGRAM/FORTRAN/SUBROUTINE/COMMON
                fortran_signals = [
                    "PROGRAM ",
                    "FORTRAN",
                    "SUBROUTINE ",
                    "COMMON ",
                    "DIMENSION ",
                    "IMPLICIT ",
                ]
                if any(s in content.upper() for s in fortran_signals):
                    return m.group(0)
                return f"```\n{content}\n```"

            markdown_content = re.sub(
                r"^```FORTRAN\n(.*?)^```",
                _fix_fortran_label,
                markdown_content,
                flags=re.MULTILINE | re.DOTALL,
            )

            code_patterns = {
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?def\s+\w+(?:(?!```).)*?)^\1```": r"\1```python\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?function\s+\w+(?:(?!```).)*?)^\1```": r"\1```javascript\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?class\s+\w+(?:(?!```).)*?)^\1```": r"\1```python\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?import\s+(?:(?!```).)*?)^\1```": r"\1```python\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?<\?php(?:(?!```).)*?)^\1```": r"\1```php\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?<html(?:(?!```).)*?)^\1```": r"\1```html\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?SELECT\s+(?:(?!```).)*?)^\1```": r"\1```sql\n\2\1```",
            }

            for pattern, replacement in code_patterns.items():
                markdown_content = re.sub(
                    pattern,
                    replacement,
                    markdown_content,
                    flags=re.DOTALL | re.IGNORECASE,
                )

            markdown_content = re.sub(
                r"(```[a-z]*\n.*?\n```)", r"\n\1\n", markdown_content, flags=re.DOTALL
            )

            return markdown_content
        except Exception as e:
            logger.warning(f"Error formatting code blocks: {str(e)}")
            return markdown_content

    def _format_quotes(self, markdown_content: str) -> str:
        """Improve blockquote formatting."""
        try:
            markdown_content = re.sub(
                r"^(\s*)>\s*(.+)$", r"\1> \2", markdown_content, flags=re.MULTILINE
            )

            markdown_content = re.sub(
                r"(^>.+$)", r"\n\1\n", markdown_content, flags=re.MULTILINE
            )

            return markdown_content
        except Exception as e:
            logger.warning(f"Error formatting quotes: {str(e)}")
            return markdown_content

    # PDF 中常见的 Unicode 项目符号 → markdown 列表前缀。覆盖 R9 教材
    # 实测出现的 ●（实心圆）/ ○（空心圆）/ ■（实心方）/ □（空心方）/ ▪（小实心方）/
    # ▫（小空心方）/ ◦（小空心圆）/ ▶ ›（箭头型分隔）/ ☐（todo）等。
    _UNICODE_BULLET_RE = re.compile(
        r"^([ \t]*)"
        # bullet 符号本身，允许跟随 ZWJ/ZWSP/non-break space 等零宽与不可见空白
        r"([●○■□▪▫◦▶▷›▸▹·•‣])[​‌‍ ⁠﻿]*"
        # 至少一个常规空白或 tab 分隔（防误吃合法字符序列起首的 ●）
        r"[ \t]+"
        r"(.+)$",
        re.MULTILINE,
    )

    def _normalize_unicode_bullets(self, markdown_content: str) -> str:
        """把 PDF 抽取出的 Unicode 项目符号统一为 markdown ``- `` 列表前缀。

        覆盖 R9 教材中常见的 ``●​`` 等组合（实心圆 + 零宽 joiner）。修复后下游
        :meth:`_format_lists` 的 ``[-\\*\\+]`` 规则会进一步统一为 ``- ``。
        """
        return self._UNICODE_BULLET_RE.sub(r"\1- \3", markdown_content)

    def _format_lists(self, markdown_content: str) -> str:
        """Improve list formatting and nesting."""
        try:
            # R9 修复：把 PDF 中常见的 Unicode 项目符号（``● ■ ▪ ◦ ▶ ›`` 等）
            # 归一化为标准 markdown ``- ``，并清理 zero-width joiner / space
            # 残留。PDF 教材常用 ``●​`` 作为子项符号（U+25CF + U+200B），
            # 如果不规范化，下游 react-markdown 不会把它当作 list item 渲染，
            # 而是塞到段落里造成视觉破坏（R9 量化签名 list_bullet_residue=877）。
            markdown_content = self._normalize_unicode_bullets(markdown_content)

            lines = markdown_content.split("\n")
            formatted_lines = []

            for line in lines:
                line = re.sub(r"^(\s*)([-\*\+])\s*(.+)$", r"\1- \3", line)
                # 仅当行不构成"章节编号 + 标题文本"模式时才视为有序列表项
                # 规范化。原始 ``^(\d+)[\.\)]\s*(.+)$`` 会把 ``3.1.1 Foo`` /
                # ``3.1 Foo`` 解析为 ``\1='3', \3='1.1 Foo'`` / ``\3='1 Foo'``，
                # 输出 ``3. 1.1 Foo`` / ``3. 1 Foo`` 强行拆裂章节编号，破坏
                # ``FitzTextExtractor`` 复合编号合并的成果。
                # 守卫覆盖两种情形：
                #   (a) ``\d+\.\d`` 起手 — 三段及以上复合编号（``3.1.1``）；
                #   (b) ``\d+(?:\.\d+)*\s+[A-Z]`` — 两段编号 + 大写起始标题
                #       （``3.1 Introduction``、``5.3 Memory``），自然语言列表项
                #       内容不会以"数字 + 单空格 + 大写词"的形态紧贴在前缀后。
                line = re.sub(
                    r"^(\s*)(\d+)[\.\)]\s*"
                    r"(?!\d+\.\d)"
                    r"(?!\d+(?:\.\d+)*\s+[A-Z])"
                    r"(.+)$",
                    r"\1\2. \3",
                    line,
                )
                formatted_lines.append(line)

            markdown_content = "\n".join(formatted_lines)
            markdown_content = re.sub(r"\n[-*+]\s*\n(?=\n)", "\n", markdown_content)

            return markdown_content
        except Exception as e:
            logger.warning(f"Error formatting lists: {str(e)}")
            return markdown_content

    def _format_headings(self, markdown_content: str) -> str:
        """Improve heading formatting and hierarchy."""
        try:
            lines = markdown_content.split("\n")
            formatted_lines = []

            for i, line in enumerate(lines):
                if re.match(r"^#{1,6}\s", line):
                    heading = line.strip()

                    if (
                        i > 0
                        and lines[i - 1].strip() != ""
                        and not re.match(r"^#{1,6}\s", lines[i - 1])
                    ):
                        formatted_lines.append("")

                    formatted_lines.append(heading)

                    if i < len(lines) - 1 and lines[i + 1].strip() != "":
                        formatted_lines.append("")
                else:
                    formatted_lines.append(line)

            return "\n".join(formatted_lines)
        except Exception as e:
            logger.warning(f"Error formatting headings: {str(e)}")
            return markdown_content

    def _apply_typography_fixes(self, markdown_content: str) -> str:
        """Apply typography improvements.

        使用 extract-process-restore 模式保护 LaTeX 数学内容，
        防止排版修正破坏公式中的空格和标点。
        """
        try:
            from ..pdf.math_formula import protect_math_content

            def _typography_inner(text: str) -> str:
                # \u8d1f\u5411\u65ad\u8a00\u6269\u5c55\uff1a``<!--`` / ``-->`` \u7b49 HTML \u6ce8\u91ca\u5b9a\u754c\u7b26\u4e2d\u7684 ``--``
                # \u4e0d\u8f6c\u4e3a em-dash\uff08lookbehind \u589e ``!``\u3001lookahead \u589e ``>``\uff09\u3002
                # code block / LaTeX \u5df2\u7531 protect \u6d41\u7a0b\u4fdd\u62a4\uff0cHTML \u6ce8\u91ca\u6b64\u524d\u6f0f\u7f51\uff0c
                # \u81f4 ``<!-- orphan images ... -->`` \u88ab\u7834\u574f\u4e3a\u53ef\u89c1\u5783\u573e ``<!\u2014 \u2026 \u2014>``\u3002
                text = re.sub(r"(?<![!\-])\-\-(?![\->])", "\u2014", text)

                # \u5f15\u7528\u7f16\u53f7\u7a7a\u683c\u538b\u7f29\uff1a"[ 103 ]" \u2192 "[103]"\uff0c"[ 95, 99, 105 ]" \u2192 "[95, 99, 105]"
                text = re.sub(r"\[\s+(\d+(?:\s*,\s*\d+)*)\s+\]", r"[\1]", text)

                # \u91cd\u7ec4 PDF \u62c6\u89e3\u7684\u7ec4\u5408\u53d8\u97f3\u7b26\u53f7\uff1a``Pok \u00b4 emon`` / ``Baltru \u02c7 saitis``
                # / ``Westh \u00a8 au\u00dfer`` / ``Perdig \u02dc ao`` \u7b49\u3002PyMuPDF \u628a
                # ``Pok\u00e9mon`` \u8fd9\u7c7b\u542b\u7ec4\u5408\u53d8\u97f3\u5b57\u7b26\u7684\u8bcd\u62c6\u4e3a ``base + \u72ec\u7acb\u95f4\u9694\u7b26\u53f7
                # + \u540e\u7eed\u5b57\u6bcd``\uff0c``" ".join`` \u62fc\u63a5\u4e3a ``Pok \u00b4 emon``\u3002\u8fd9\u91cc\u8bc6\u522b
                # ``<letter><space>?<diacritic><space>?<letter>`` \u6a21\u5f0f\uff0c
                # \u7528\u5bf9\u5e94\u7684\u7ec4\u5408\u53d8\u97f3\u7b26\u53f7\uff08U+0300 \u7cfb\u5217\uff09\u62fc\u5408\uff0c\u5e76\u901a\u8fc7
                # ``unicodedata.normalize("NFC", ...)`` \u6536\u655b\u4e3a\u9884\u7ec4\u5408 codepoint\u3002
                text = _rejoin_split_diacritics(text)

                # \u8de8\u884c\u65ad\u5b57\u5408\u5e76\uff1aPyMuPDF \u6587\u672c\u63d0\u53d6\u5e38\u6b8b\u7559 `word-\nword`\uff0cassembly \u9636\u6bb5
                # \u628a `\n` \u6298\u53e0\u4e3a\u7a7a\u683c\u540e\u53d8\u6210 `word- word`\u3002\u4ec5\u5339\u914d\u4e24\u4fa7\u5747\u4e3a ASCII \u5c0f\u5199
                # \u5b57\u6bcd + \u4e2d\u95f4\u7a7a\u683c\u7684\u5f62\u6001\uff0c\u907f\u5f00\u590d\u5408\u8bcd (state-of-the-art \u65e0\u7a7a\u683c)\u3001
                # \u6570\u5b57\u8303\u56f4 (20- 30)\u3001\u4e13\u6709\u7f29\u5199\u8fb9\u754c (X- Ray \u5927\u5199) \u7b49\u3002
                #
                # R10-D21 \u590d\u5408\u94fe\u5b88\u62a4\uff1a``Reasoning-acting-\ninteracting`` \u7c7b\u590d\u5408\u94fe
                # \u5728 PyMuPDF \u884c\u6298\u53e0\u540e\u53d8\u6210 ``Reasoning-acting- interacting``\uff0c
                # \u82e5\u76f4\u63a5\u547d\u4e2d ``g- i`` \u5408\u5e76\u89c4\u5219\u4f1a\u5f97\u5230 ``actinginteracting`` \u89c6\u89c9\u7834\u574f\u3002
                # \u901a\u8fc7 ``(?<![a-zA-Z]-)`` \u5b88\u62a4\uff1a\u5339\u914d\u524d\u7f00 ``[a-z]+`` \u8d77\u59cb\u4f4d\u7f6e\u7684\u524d
                # 2 \u5b57\u7b26\u82e5\u5df2\u662f ``<letter>-``\uff08\u5373\u4f4d\u4e8e\u65e2\u6709 hyphen \u94fe\u4e2d\uff09\uff0c\u8df3\u8fc7\u5408\u5e76\uff1b
                # \u4ec5\u5bf9\u72ec\u7acb\u5355\u8bcd\u7684 wrap-hyphen \u5b9e\u65bd\u5408\u5e76\u3002
                #
                # \u590d\u5408\u8bcd\u5b88\u62a4\uff1a\u8fde\u5b57\u7b26\u5de6\u4fa7\u82e5\u4e3a\u5b8c\u6574\u5355\u8bcd\uff08\u89c1
                # ``_COMPOUND_HYPHEN_PREFIXES``\uff09\uff0c\u5c5e\u8bed\u4e49\u8fde\u5b57\u7b26\u8de8\u884c\uff0c\u4fdd\u7559\u4e3a
                # ``high-level``\uff1b\u5426\u5219\u89c6\u4e3a\u884c\u5c3e\u8f6f\u65ad\u5b57\uff08``sur- vey``\uff09\u5408\u5e76\u4e3a ``survey``\u3002
                def _merge_wrap_hyphen(m: re.Match) -> str:
                    left, right = m.group(1), m.group(2)
                    if left in _COMPOUND_HYPHEN_PREFIXES:
                        return f"{left}-{right}"
                    return f"{left}{right}"

                text = re.sub(
                    r"\b(?<![a-zA-Z]-)([a-z]+)- ([a-z]+)\b",
                    _merge_wrap_hyphen,
                    text,
                )
                # R10-D21 \u7eed\uff1a\u590d\u5408\u94fe wrap \u7a7a\u683c\u6536\u5c3e\u3002\u547d\u4e2d\u5b88\u62a4\u540e\u4fdd\u7559\u7684 ``acting- interacting``
                # \u4ecd\u542b\u4e00\u4e2a\u591a\u4f59\u7a7a\u683c\uff0c\u9700\u628a ``<lowercase>-<space>+<lowercase>`` \u4e2d\u7684\u7a7a\u683c
                # \u6536\u7d27\u4e3a\u96f6\uff0c\u628a ``acting- interacting`` \u53d8\u6210 ``acting-interacting``\u3002
                # \u4e0e\u5355\u5b57\u6bcd ``a - b``\uff08\u524d\u5bfc\u7a7a\u683c\u975e lowercase\uff09\u3001 ``LLM-based`` \u5927\u5199\u8fb9\u754c
                # \uff08\u524d\u5bfc M \u5927\u5199\uff09\u3001 ``30-50`` \u6570\u5b57\uff08\u524d\u5bfc\u975e lowercase\uff09\u5747\u4e92\u65a5\u3002
                #
                # \u6536\u7a84\u7a7a\u767d\u96c6\u4e3a ``[ \t]+``\uff1a\u907f\u514d ``\s+`` \u547d\u4e2d ``\n`` \u4ece\u800c\u628a\u884c/\u6bb5\u843d
                # \u8fb9\u754c\u541e\u6389\uff08\u5982\u6bb5\u5c3e ``word-`` + \u6bb5\u9996 lowercase \u8de8\u6bb5\u5408\u5e76\uff09\uff0c\u7834\u574f
                # markdown \u6bb5\u843d\u7ed3\u6784\u3002
                text = re.sub(r"(?<=[a-z])-[ \t]+(?=[a-z]{2})", "-", text)

                # R10-D22\uff1aLatin-1 \u91cd\u97f3\u5b57\u7b26\u7684 UTF-8 \u2192 CP1252 \u53cc\u7f16\u7801 mojibake \u8fd8\u539f\u3002
                # \u539f ``\u00ed`` UTF-8 ``\\xc3\\xad`` \u88ab CP1252 \u89e3\u4e3a ``\u00c3 + U+00AD``\uff0c
                # \u518d\u4ee5 UTF-8 \u7f16\u7801\u4e3a 4 \u5b57\u8282\u5e8f\u5217\uff1b\u7c7b\u4f3c\u8986\u76d6 \u00e1/\u00e9/\u00f3/\u00fa/\u00f1/\u00fc/\u00f6/\u00e4/\u00e7 \u7b49
                # \u897f\u3001\u8461\u3001\u6cd5\u3001\u5fb7\u8bed\u91cd\u97f3\u5b57\u7b26\u3002\u5fc5\u987b\u5728\u4e0b\u65b9 D13 U+00AD \u5904\u7406**\u4e4b\u524d**
                # \u5b8c\u6210\u8bc6\u522b \u2014\u2014 D13 \u4f1a\u628a ``\u00c3 + \u00ad + guez`` \u7684 U+00AD \u4e0e\u540e\u7a7a\u767d\u4e00\u5e76
                # \u5265\u79bb\uff08``\u00ad`` \u540e\u662f\u5c0f\u5199 ``g`` \u89e6\u53d1\uff09\uff0c\u5bfc\u81f4 ``Rodr\u00c3guez`` \u5b64\u7acb \u00c3 \u6b8b\u7559\u3002
                _latin1_mojibake_map = (
                    (
                        "\u00c3\u00ad",
                        "\u00ed",
                    ),  # \u00c3 + U+00AD \u2192 \u00ed (Rodr\u00edguez)
                    ("\u00c3\u00a9", "\u00e9"),  # \u2192 \u00e9 (P\u00e9rez)
                    ("\u00c3\u00a1", "\u00e1"),  # \u2192 \u00e1 (S\u00e1nchez)
                    ("\u00c3\u00b3", "\u00f3"),  # \u2192 \u00f3
                    ("\u00c3\u00ba", "\u00fa"),  # \u2192 \u00fa
                    ("\u00c3\u00b1", "\u00f1"),  # \u2192 \u00f1 (Mu\u00f1oz)
                    ("\u00c3\u00bc", "\u00fc"),  # \u2192 \u00fc
                    ("\u00c3\u00b6", "\u00f6"),  # \u2192 \u00f6
                    ("\u00c3\u00a4", "\u00e4"),  # \u2192 \u00e4
                    ("\u00c3\u00a7", "\u00e7"),  # \u2192 \u00e7
                )
                for moji, fixed in _latin1_mojibake_map:
                    text = text.replace(moji, fixed)

                # R10-D13\uff1a\u8f6f\u8fde\u5b57\u7b26 U+00AD \u8de8\u884c\u65ad\u5b57\u5408\u5e76\u3002PyMuPDF \u5728\u6392\u7248\u65ad\u5b57\u5904
                # \u4fdd\u7559 U+00AD\uff08\u4e0d\u53ef\u89c1\u5b57\u95f4\u63d0\u793a\u7b26\uff09\uff0cspan \u62fc\u63a5\u540e\u5f62\u6210
                # ``advance\u00ad ment``\uff08U+00AD + \u53ef\u9009\u7a7a\u767d + \u540e\u7eed\u5c0f\u5199\u8bcd\uff09\u3002
                # \u8be5\u6a21\u5f0f\u5728 PDF \u89c6\u89c9\u5c42\u5e76\u975e\u771f\u5b9e\u8fde\u5b57\u7b26\uff0c\u9700\u5c06 U+00AD \u4e0e\u5176\u540e\u7a7a\u767d
                # \u4e00\u5e76\u5220\u9664\uff0c\u6062\u590d\u5b8c\u6574\u8bcd\uff1b\u540c\u6837\u9650\u5b9a\u540e\u7eed\u4e3a ASCII \u5c0f\u5199\u4ee5\u907f\u514d\u8bef\u541e
                # \u5927\u5199\u4e13\u6709\u540d\u8bcd\u8fb9\u754c\u4e0e\u6570\u5b57\u3002
                text = re.sub(r"\u00ad[ \t]*(?=[a-z])", "", text)

                # R10-D14\uff1a\u53cd\u5411 ``word -word`` \u6a21\u5f0f\uff08\u524d\u7a7a\u683c + ASCII \u8fde\u5b57\u7b26 + \u5c0f\u5199\uff09\u3002
                # \u8be5\u6a21\u5f0f\u51fa\u73b0\u5728 figure caption / \u8868\u683c\u6807\u9898\u7b49\u62bd\u53d6\u8def\u5f84\u4e0a \u2014\u2014 \u90e8\u5206
                # caption \u6536\u96c6\u5668\u628a U+00AD \u5f52\u4e00\u5316\u4e3a ASCII ``-`` \u4f46\u672a\u540c\u65f6\u5408\u5e76\u65ad\u5b57\uff0c
                # \u5f62\u6210 ``retrofit -ting`` / ``or -chestration``\u3002\u5224\u5b9a\u6761\u4ef6\u4e0e\u524d
                # \u4e00\u89c4\u5219\u540c\u6e90\uff08\u8981\u6c42\u524d ASCII \u5b57\u6bcd + \u5355\u7a7a\u683c + \u5355 ``-`` + ASCII \u5c0f\u5199\uff09\uff0c
                # \u4e0e em-dash \u98ce\u683c ``A - B``\uff08\u4e24\u4fa7\u5747\u7a7a\u683c\uff09\u3001\u590d\u5408\u8bcd ``X-Y`` \u4e92\u65a5\u3002
                text = re.sub(r"(?<=[a-zA-Z]) -(?=[a-z])", "", text)

                # R10-D19\uff1a\u4e24\u4fa7\u5747\u7a7a\u683c\u7684\u65ad\u5b57 ``per - formance`` \u2014\u2014 \u8868\u683c cell \u5185
                # \u62bd\u53d6\u8def\u5f84\u7684\u6700\u5e38\u89c1 hyphenation \u6b8b\u7559\u3002\u4e24\u4fa7\u5747\u8981\u6c42 2+ \u5b57\u6bcd\uff08\u907f\u514d
                # \u8bef\u541e\u6570\u5b66 ``a - b`` \u5355\u5b57\u6bcd\uff09\uff0c\u53f3\u4fa7\u8981\u6c42\u5c0f\u5199\u8d77\u9996\uff08\u907f\u514d\u8bef\u541e em-dash
                # \u98ce\u683c ``Section A - Section B``\uff09\u3002Springer \u671f\u520a References /
                # Table cells \u9ad8\u9891\u51fa\u73b0 ``Scalabil - ity`` / ``gov - ernance`` /
                # ``sym - bolic`` / ``Mo - zolevskyi`` \u7b49\u6a21\u5f0f\u3002
                #
                # \u5b88\u62a4\uff1a\u53f3\u4fa7\u82e5\u662f\u5e38\u89c1 em-dash \u8fde\u63a5\u8bcd\uff08``or`` / ``and`` / ``the`` /
                # ``which`` / ``i.e.`` \u7b49\uff0c\u8be6\u89c1 ``_EM_DASH_RHS_CONNECTORS`` \u4e0e
                # ``_EM_DASH_RHS_LATIN_ABBR``\uff09\uff0c\u4fdd\u7559 ` - ` \u539f\u8c8c\u4ee5\u907f\u514d\u8bef\u541e\u6b63\u6587
                # em-dash\uff08``data - or what was left - was deleted``\uff09\u3002
                def _collapse_bothside_wrap(match: re.Match) -> str:
                    rhs = match.group(1).lower()
                    if rhs in _EM_DASH_RHS_CONNECTORS or rhs in _EM_DASH_RHS_LATIN_ABBR:
                        return match.group(0)
                    return match.group(1)

                # 拉丁缩写以 ``.`` 结尾且后续常跟 ``,`` / ``;``，``\b`` 无法在
                # 双非字符位置成立，故拉丁缩写分支不带 ``\b``；普通词分支带 ``\b``
                # 以严格限定单词边界。
                text = re.sub(
                    r"(?<=[a-zA-Z]{2}) - ((?:i\.e|e\.g|cf|viz)\.|[a-z]+\b)",
                    _collapse_bothside_wrap,
                    text,
                )

                # \u9632\u5fa1\u515c\u5e95\uff1a\u6e05\u9664\u4efb\u4f55\u6b8b\u7559 U+00AD\uff08\u4e0d\u53ef\u89c1\u5b57\u7b26\u4e0d\u5e94\u8fdb\u5165 markdown\uff09
                text = text.replace("\u00ad", "")

                # R10-D17\uff1a\u96f6\u5bbd\u7a7a\u683c U+200B \u6e05\u9664\u3002Springer Nature \u7b49\u671f\u520a\u5728\u5f15\u7528 URL
                # \u6bcf\u5b57\u7b26\u4e4b\u95f4\u6ce8\u5165 U+200B \u4f5c\u4e3a\u8f6f\u6362\u884c hint\uff0c\u7834\u574f\u6587\u672c\u62f7\u8d1d / \u5168\u6587\u68c0\u7d22 /
                # URL \u53ef\u70b9\u51fb\u6027\u3002U+200B \u5728 markdown \u4e2d\u65e0\u610f\u4e49\u4e14\u4e0d\u53ef\u89c1\uff0c\u5168\u5c40\u6e05\u9664\u3002
                # \u4ec5\u6e05\u9664 U+200B \u5355\u4e00\u5b57\u7b26\uff1b\u4fdd\u7559 U+200D ZWJ\uff08emoji / \u5370\u5ea6\u8bed\u8fde\u5199\uff09\u3002
                text = text.replace("\u200b", "")

                # R10-D18\uff1aUTF-8 \u2192 CP1252 \u53cc\u7f16\u7801 mojibake \u8fd8\u539f\u3002PDF \u4e2d em-dash
                # ``\u2014`` (U+2014, UTF-8 ``E2 80 94``) \u5728\u67d0\u4e9b PyMuPDF \u62bd\u53d6\u8def\u5f84\u4e0a
                # \u4f1a\u88ab CP1252 \u89e3\u7801\u4e3a ``\u00e2 \u20ac "`` (U+00E2 U+20AC U+201D) \u4e09\u5b57\u7b26\u5e8f\u5217
                # \u518d\u4ee5 UTF-8 \u91cd\u65b0\u7f16\u7801\uff0c\u6700\u7ec8\u5728 markdown \u4e2d\u663e\u793a\u4e3a ``\u00e2\u20ac"``\u3002\u540c\u7c7b
                # \u5931\u771f\u8986\u76d6 en-dash / \u5355 / \u53cc\u5f15\u53f7 / \u7701\u7565\u53f7\u3002\u56fa\u5b9a 6 \u6a21\u5f0f\u66ff\u6362\uff0c
                # \u4e0d\u4f9d\u8d56\u5916\u90e8\u5e93\uff08ftfy \u5f53\u524d\u4ec5\u4e3a docling \u4f20\u9012\u4f9d\u8d56\uff0c\u907f\u514d\u786c\u7ed1\u5b9a\uff09\u3002
                _mojibake_map = (
                    ("\u00e2\u20ac\u201d", "\u2014"),  # \u2014 em-dash
                    ("\u00e2\u20ac\u201c", "\u2013"),  # \u2013 en-dash
                    ("\u00e2\u20ac\u2122", "\u2019"),  # \u2019 right single quote
                    ("\u00e2\u20ac\u0153", "\u201c"),  # \u201c left double quote
                    ("\u00e2\u20ac\u009d", "\u201d"),  # \u201d right double quote
                    ("\u00e2\u20ac\u00a6", "\u2026"),  # \u2026 ellipsis
                )
                for moji, fixed in _mojibake_map:
                    text = text.replace(moji, fixed)

                # R10-D23：闭括号前空格归一 ``(2025 )`` → ``(2025)``。
                # PyMuPDF 抽取 ``(2025\n)`` 后 ``\n`` 折叠为空格形成 ``(2025 )``，
                # Agentic AI Survey 表格 / References / 正文累计 112 处。仅去除
                # ``)`` 紧前的单空格，且要求 ``)`` 紧前是非空白字符（避免 ``(  )``
                # 空括号被破坏 —— 这类极少见且本身就是噪声）。
                text = re.sub(r"(\S) \)", r"\1)", text)

                # R10-D24：开括号后空格归一 ``( 2008)`` → ``(2008)``。
                # 与 D23 对称的镜像 case：``Harden (\n2008)`` 折叠后形成
                # ``Harden ( 2008)``，Agentic AI Survey 累计 3 处。要求 ``(``
                # 紧后是非空白，避免破坏空括号噪声。
                text = re.sub(r"\( (\S)", r"(\1", text)

                lines = text.split("\n")
                fixed_lines = []
                for line in lines:
                    line = re.sub(r" {2,}", " ", line)
                    fixed_lines.append(line)
                text = "\n".join(fixed_lines)

                text = re.sub(r"[^\S\n]+([.!?:;,])", r"\1", text)
                text = re.sub(r"([.!?])[^\S\n]*([A-Z])", r"\1 \2", text)

                return text

            return protect_math_content(markdown_content, _typography_inner)
        except Exception as e:
            logger.warning(f"Error applying typography fixes: {str(e)}")
            return markdown_content

    def _normalize_paragraph_breaks(self, markdown_content: str) -> str:
        """归一化段落间距：确保块级元素间以 ``\\n\\n`` 分隔。

        Web 页面依赖 CSS 控制段内折行，因此 MarkItDown 产出的连续纯文本行
        代表独立段落，应以 ``\\n\\n`` 分隔。同构序列（列表项、表格行、引用行）
        内部保持单个 ``\\n``，代码块内容完全不修改。
        """
        lines = markdown_content.split("\n")
        if len(lines) <= 1:
            return markdown_content

        result: List[str] = [lines[0]]
        inside_code_fence = lines[0].strip().startswith("```")

        for i in range(1, len(lines)):
            prev_line = lines[i - 1]
            curr_line = lines[i]
            curr_stripped = curr_line.strip()

            # 代码围栏状态切换
            if curr_stripped.startswith("```"):
                if inside_code_fence:
                    # 关闭代码围栏
                    result.append(curr_line)
                    inside_code_fence = False
                    continue
                else:
                    # 打开代码围栏：确保前方有空行
                    prev_type = _classify_line(prev_line)
                    if (
                        prev_type != _LineType.EMPTY
                        and result
                        and result[-1].strip() != ""
                    ):
                        result.append("")
                    inside_code_fence = True
                    result.append(curr_line)
                    continue

            # 代码块内部：原样保留
            if inside_code_fence:
                result.append(curr_line)
                continue

            prev_type = _classify_line(prev_line)
            curr_type = _classify_line(curr_line)

            # 空行直接追加，无需插入
            if prev_type == _LineType.EMPTY or curr_type == _LineType.EMPTY:
                result.append(curr_line)
                continue

            # 列表项缩进续行：保持紧凑
            if prev_type == _LineType.LIST_ITEM and _is_list_continuation(curr_line):
                result.append(curr_line)
                continue

            # 列表续行后紧跟新列表项：属于同一列表，保持紧凑
            if _is_list_continuation(prev_line) and curr_type == _LineType.LIST_ITEM:
                result.append(curr_line)
                continue

            # 同构序列：保持单个 \n
            if (prev_type, curr_type) in _HOMOGENEOUS_PAIRS:
                result.append(curr_line)
                continue

            # 其他情况：确保 \n\n 分隔（仅在前一行非空时插入空行）
            if result and result[-1].strip() != "":
                result.append("")
            result.append(curr_line)

        return "\n".join(result)

    def _deduplicate_approximate_paragraphs(self, markdown_content: str) -> str:
        """移除跨引擎的近似重复段落。

        当文本提取引擎和 Docling 引擎同时提取同一段内容时，
        可能产生格式不同但语义相同的重复段落。
        策略：对每个段落提取纯文字指纹（去空白/标点/Markdown 标记），
        若两个段落指纹的 Jaccard 相似度 > 0.6 且长度相近，移除后者。

        **排除项**：块级数学公式 ``$$..$$`` 不参与近似去重比较。同章节的多条
        相邻公式（如 ``M_s = f_short(...)`` 与 ``M_l = f_long(...)``）共享大量
        同名变量与运算符令牌（``M``、``f``、``c``、``\\theta``、``\\in`` …），
        清洗 Markdown 标记后 Jaccard 极易越过 0.6 阈值致后者被误判为重复。
        正文段落的跨引擎重复仍照常去重。
        """
        paragraphs = re.split(r"\n{2,}", markdown_content)
        if len(paragraphs) < 2:
            return markdown_content

        _math_block_re = re.compile(r"^\s*\$\$[\s\S]+\$\$\s*$")

        def _is_math_block(text: str) -> bool:
            """识别完全由 ``$$..$$`` 包裹的块级公式段落。"""
            return bool(_math_block_re.match(text))

        def _fingerprint(text: str) -> set[str]:
            """提取段落的词级指纹集合。"""
            clean = re.sub(r"[#*`\[\]()!|>{}\\]", " ", text)
            clean = re.sub(r"\s+", " ", clean).lower()
            words = clean.split()
            return set(words)

        kept: List[str] = []
        seen_fingerprints: List[set[str]] = []

        # R10-D20：caption 行（``Table N ...`` / ``Figure N ...`` / ``Fig. N ...``
        # / ``Algorithm N ...``）的精确相邻去重。PyMuPDF 把 caption 抽为正文段、
        # table_extraction 又把同样 caption 内嵌为表头部，二者经 assembly 写入
        # markdown 后形成「caption / caption / table」三段结构。caption 通常少于
        # 15 词，会被下方主体 Jaccard 去重的长度守卫绕过，故在主流程前插入紧邻
        # 重复 caption 检查 —— 仅对相邻位置（kept 末尾即上一保留段）做精确相等比对，
        # 不影响跨段落非相邻的合法重复（如 ``Table 5 (continued)``）。
        _caption_re = re.compile(
            r"^(?:Table|Figure|Fig\.|Tab\.|Algorithm|Algo\.)\s+\d+\b",
            re.IGNORECASE,
        )

        def _is_caption(text: str) -> bool:
            return bool(_caption_re.match(text.strip()))

        # 参考文献条目：``[N] 作者. 标题. …``。学术 PDF 的 References 条目结构高度
        # 相似（共享 ``arXiv`` / ``Proceedings`` / 年份 / 人名 / ``pages`` 等词），
        # Jaccard 极易越过 0.6 阈值，把后续条目误判为重复而删除（实测参考 [477] 被吞）。
        # 参考条目由唯一编号 ``[N]`` 标识、语义独立，一律豁免去重。
        _reference_re = re.compile(r"^\[\d+\]")

        def _is_reference_entry(text: str) -> bool:
            return bool(_reference_re.match(text.strip()))

        for para in paragraphs:
            # 块级公式段落始终保留，不参与 Jaccard 相似度比较，
            # 也不污染后续段落的对比基线。
            if _is_math_block(para):
                kept.append(para)
                continue
            # 图片段落（HTML ``<img>``）结构性关键，绝不作为近似重复被删除：
            # 其 alt 文本与独立文本 caption 段高度重合（Jaccard 易 > 0.6），当文本
            # caption 段排在 <img> 之前时，<img> 段会被误判为"跨引擎重复段"删除，
            # 致整张图从 Markdown 消失（实测 Fig 15/16 因此丢失）。始终保留 <img> 段；
            # 仍把其指纹加入 seen，使后续冗余文本 caption 段被正常去重。
            if "<img" in para:
                kept.append(para)
                seen_fingerprints.append(_fingerprint(para))
                continue
            # 参考文献条目（[N] 起首）唯一编号、语义独立，绝不参与近似去重
            if _is_reference_entry(para):
                kept.append(para)
                continue
            # caption 精确相邻去重：仅当上一保留段为相同 caption 时跳过
            if _is_caption(para) and kept and kept[-1].strip() == para.strip():
                continue
            fp = _fingerprint(para)
            if len(fp) < 15:
                kept.append(para)
                seen_fingerprints.append(fp)
                continue
            is_dup = False
            for existing_fp in seen_fingerprints:
                if not existing_fp:
                    continue
                intersection = len(fp & existing_fp)
                union = len(fp | existing_fp)
                if union == 0:
                    continue
                jaccard = intersection / union
                if jaccard > 0.6:
                    len_ratio = min(len(fp), len(existing_fp)) / max(
                        len(fp), len(existing_fp), 1
                    )
                    if len_ratio > 0.5:
                        is_dup = True
                        break
            if is_dup:
                continue
            kept.append(para)
            seen_fingerprints.append(fp)

        return "\n\n".join(kept)

    def _strip_running_headers(self, markdown_content: str) -> str:
        """移除逐字高频重复的运行页眉/页脚独立行。

        PDF 每页的 running header（如短标题 "Code as Agent Harness"）会被文本
        抽取引擎当作文体逐页保留，在 Markdown 中形成同一短行重复数十次的噪声。
        此 pass 剥离满足全部条件的行：单行、简短（≤ ``_RUNNING_HEADER_MAX_LEN``）、
        逐字完全相同、出现 ≥ ``_RUNNING_HEADER_MIN_REPEAT`` 次。

        保守性：仅作用于 ``\\n{2,}`` 切分后的单行短段，要求逐字相等且复现次数
        远高于正常文档中任何合法短行（实测正文短行最高复现 2 次），故对正文零
        误伤；带 ``#`` 前缀的标题字符串与裸页眉不同，亦不受影响。代码块 / 数学
        块在管线中先于此 pass 被替换为占位符（``%%CODEBLOCK_…%%`` / ``$$…$$``），
        故不会误删块内同名行。
        """
        paragraphs = re.split(r"\n{2,}", markdown_content)
        if len(paragraphs) < _RUNNING_HEADER_MIN_REPEAT:
            return markdown_content

        counts: Dict[str, int] = {}
        for para in paragraphs:
            s = para.strip()
            if not s or "\n" in s or len(s) > _RUNNING_HEADER_MAX_LEN:
                continue
            # 跳过结构化行：标题 / 已保护占位符 / HTML 标签 / 代码围栏 / 表格行
            if s.startswith(("#", "%%", "<", "```", "|")):
                continue
            counts[s] = counts.get(s, 0) + 1

        headers = {
            text for text, n in counts.items() if n >= _RUNNING_HEADER_MIN_REPEAT
        }
        # 补捉分片(batch)格式化后的残余页眉：auto_batch 逐片格式化已剥离片中
        # 大量页眉，合并后全文档残留的少量同文页眉 count 可能 < 阈值而漏网。
        # 「与文档 H1 标题同文的裸独立行」几乎必为运行页眉（带 ``#`` 前缀的真正
        # 标题字符串不同，不会被剥离），零误伤地把这类残余一并移除。
        _title_match = re.search(r"^#\s+(.+)$", markdown_content, re.MULTILINE)
        if _title_match:
            _title = _title_match.group(1).strip()
            if _title and "\n" not in _title and len(_title) <= _RUNNING_HEADER_MAX_LEN:
                headers.add(_title)
        if not headers:
            return markdown_content

        kept = [p for p in paragraphs if p.strip() not in headers]
        return "\n\n".join(kept)

    def _basic_cleanup(self, markdown_content: str) -> str:
        """Apply basic cleanup operations."""
        try:
            lines = []
            for line in markdown_content.split("\n"):
                cleaned_line = line.rstrip()
                lines.append(cleaned_line)

            markdown_content = "\n".join(lines)
            markdown_content = re.sub(r"\n{3,}", "\n\n", markdown_content)

            # 清除泄漏的原始 HTML 标签（防御性后处理）
            markdown_content = re.sub(
                r"</?(table|tbody|thead|tfoot|tr|td|th)\b[^>]*>", "", markdown_content
            )
            markdown_content = re.sub(
                r"</?(div|span|svg|path|use|g|video|audio|picture|source|iframe|embed|object)\b[^>]*>",
                "",
                markdown_content,
            )
            # 清除孤立的 HTML 属性（但保留 <img> 标签内的 style，
            # 因其承载 _image_to_markdown 输出的响应式样式）
            markdown_content = re.sub(r'\s+class="[^"]*"', "", markdown_content)
            markdown_content = _strip_orphan_styles(markdown_content)
            markdown_content = re.sub(r'\s+aria-\w+="[^"]*"', "", markdown_content)

            markdown_content = markdown_content.strip()

            return markdown_content

        except Exception as e:
            logger.warning(f"Error in basic cleanup: {str(e)}")
            return markdown_content

    def _cleanup_math_blocks(self, markdown_content: str) -> str:
        """清洗损坏的数学公式块。

        处理残留问题：
        - 空公式块 ``$$\\n$$`` 移除
        - 单行过长的公式行截断（超过 2000 字符的行可能是重复模式残留）
        - ``\\quad`` 连续出现超过 4 次截断
        """
        try:
            # 移除空公式块
            markdown_content = re.sub(r"\$\$\s*\$\$", "", markdown_content)

            # 处理块级公式中的超长行
            def _truncate_long_formula_line(match: re.Match) -> str:
                content = match.group(1)
                if len(content) > 2000:
                    # 截断到 1500 字符，在最近的 , 或 } 处断开
                    truncated = content[:1500]
                    last_sep = max(
                        truncated.rfind(","),
                        truncated.rfind("}"),
                        truncated.rfind("]"),
                    )
                    if last_sep > 500:
                        truncated = truncated[: last_sep + 1]
                    logger.debug(
                        "公式块超长截断: %d → %d 字符",
                        len(content),
                        len(truncated),
                    )
                    return f"$${truncated}\n$$"
                return match.group(0)

            markdown_content = re.sub(
                r"\$\$\n(.*?)\n\$\$",
                _truncate_long_formula_line,
                markdown_content,
                flags=re.DOTALL,
            )

            return markdown_content

        except Exception as e:
            logger.warning(f"Error cleaning up math blocks: {str(e)}")
            return markdown_content

    def _restore_image_placeholders(
        self,
        markdown_content: str,
        registry: "ImgDimensionRegistry",
    ) -> str:
        """将 ``preprocess_html`` 注入的 sentinel 占位符还原为内嵌 HTML ``<img>``。

        生成模板：
            ``<img src="…" alt="…"[ title="…"][ width="X"][ height="Y"] style="max-width:100%;height:auto;" />``

        - 仅在尺寸非空时输出 ``width``/``height``
        - 仅在 ``title`` 非空时输出 ``title``
        - ``src``/``alt``/``title`` 均经 ``html.escape(quote=True)`` 实体化，
          防止源 HTML 中的特殊字符破坏 Markdown 后续渲染
        - ``style`` 始终输出，保证窄屏自适应
        """
        if not registry.placeholders:
            return markdown_content

        try:
            for sentinel, meta in registry.placeholders.items():
                src = html.escape(meta.get("src") or "", quote=True)
                alt = html.escape(meta.get("alt") or "", quote=True)
                title = meta.get("title") or ""
                width = meta.get("width")
                height = meta.get("height")

                parts: List[str] = [f'<img src="{src}"', f'alt="{alt}"']
                if title:
                    parts.append(f'title="{html.escape(title, quote=True)}"')
                if width:
                    parts.append(f'width="{width}"')
                if height:
                    parts.append(f'height="{height}"')
                parts.append(f'style="{_IMG_RESPONSIVE_STYLE}"')
                img_tag = " ".join(parts) + " />"

                markdown_content = markdown_content.replace(sentinel, img_tag)

            # 防御：登记簿与输出失配（如管线中途丢失/裂变 sentinel）时，
            # 既要避免裸 sentinel 泄漏给用户，也要在日志中暴露以便定位回归。
            from .html_preprocessor import SENTINEL_RE

            orphans = SENTINEL_RE.findall(markdown_content)
            if orphans:
                logger.warning(
                    "Detected %d orphan image sentinel(s) after restore; stripping.",
                    len(orphans),
                )
                markdown_content = SENTINEL_RE.sub("", markdown_content)

            return markdown_content
        except Exception as e:
            logger.warning(f"Error restoring image placeholders: {str(e)}")
            return markdown_content

    def _restore_video_placeholders(
        self,
        markdown_content: str,
        registry: "VideoRegistry",
    ) -> str:
        """将 ``preprocess_html`` 注入的 video sentinel 还原为内嵌 HTML ``<video>``。

        sentinel 在 MarkdownConverter 进入 MarkItDown 之前替换 ``<video>`` 标签，
        以避免 MarkItDown 把 HTML5 video 静默丢弃。此处将 sentinel 一一替换回
        登记簿中保存的原始 HTML 字符串；前端 ``rehype-raw + rehype-sanitize``
        会把它解析为可播放的 ``<video>`` 节点。
        """
        if not registry.placeholders:
            return markdown_content

        try:
            for sentinel, html_str in registry.placeholders.items():
                markdown_content = markdown_content.replace(sentinel, html_str)

            # 防御：登记簿与输出失配时清理孤儿 sentinel
            from .html_preprocessor import VIDEO_SENTINEL_RE

            orphans = VIDEO_SENTINEL_RE.findall(markdown_content)
            if orphans:
                logger.warning(
                    "Detected %d orphan video sentinel(s) after restore; stripping.",
                    len(orphans),
                )
                markdown_content = VIDEO_SENTINEL_RE.sub("", markdown_content)

            return markdown_content
        except Exception as e:
            logger.warning(f"Error restoring video placeholders: {str(e)}")
            return markdown_content


def markdown_to_text(markdown_content: str) -> str:
    """Convert markdown to plain text by removing formatting."""
    try:
        text = re.sub(r"!\[.*?\]\(.*?\)", "", markdown_content)  # Images
        text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)  # Links
        text = re.sub(r"[*_]{1,2}([^*_]+)[*_]{1,2}", r"\1", text)  # Bold/italic
        text = re.sub(r"`([^`]+)`", r"\1", text)  # Inline code
        text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)  # Headers
        text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)  # Blockquotes
        text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)  # Lists
        text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)  # Numbered lists

        return text.strip()
    except Exception as e:
        logger.warning(f"Error converting markdown to text: {str(e)}")
        return markdown_content
