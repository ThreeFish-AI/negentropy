"""算法/伪代码块检测与格式化工具。

基于文本启发式评分机制，检测 PDF/Web 内容中的算法伪代码块，
并将其包装为 Markdown 代码围栏，保留行结构与特殊字符。
"""

import re
from dataclasses import dataclass, field
from typing import List

# ---------------------------------------------------------------------------
# 检测常量
# ---------------------------------------------------------------------------

# 算法标题模式：Algorithm 1, Listing 2, Procedure 3 等
ALGO_HEADER_RE = re.compile(
    r"^(?:Algorithm|Procedure|Function|Subroutine|Listing)\s+\d+",
    re.IGNORECASE,
)

# 结构化头部行：Require/Ensure/Input/Output
STRUCTURED_HEADER_RE = re.compile(
    r"^(?:Require|Ensure|Input|Output|Precondition|Postcondition)\s*:",
    re.IGNORECASE | re.MULTILINE,
)

# 编号伪代码行：1: xxx 或 10: xxx（注意区分正文中的 "1. Introduction"）
NUMBERED_LINE_RE = re.compile(r"^\s*\d+\s*:\s+\S")

# 伪代码关键字行级匹配
KEYWORD_LINE_RE = re.compile(
    r"(?:^|\s)(?:"
    r"if\b|then\b|else\b|"
    r"end\s+(?:if|for|while|function|procedure|loop)\b|"
    r"for\s+(?:each|all)?\b|while\b|\bdo\b|"
    r"repeat\b|until\b|"
    r"return\b|function\b|procedure\b|begin\b|call\b"
    r")",
    re.IGNORECASE,
)

# 伪代码中常见的 Unicode 特殊字符
SPECIAL_CHARS_RE = re.compile(r"[←→≠≤≥∅▷◃∈∉∀∃⊂⊃∪∩∧∨≜≝≐⊕⊗]")

# 评分阈值
_SCORE_THRESHOLD = 5
# 独立块（无 Algorithm/Listing 标题）需要更高阈值，避免普通段落误判
_STANDALONE_SCORE_THRESHOLD = 7


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------


@dataclass
class AlgorithmBlock:
    """表示一个检测到的算法/伪代码区域。"""

    title: str
    content: str
    start_idx: int
    end_idx: int
    confidence: float = 0.0
    detection_signals: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# 核心 API
# ---------------------------------------------------------------------------


def is_algorithm_block(text: str) -> bool:
    """判断一段文本是否为算法/伪代码块。

    使用多信号评分机制，综合判断文本块是否为算法伪代码。

    Args:
        text: 待检测的文本块（保留原始换行符）。

    Returns:
        True 表示该文本块高概率为算法/伪代码。
    """
    if not text or not text.strip():
        return False

    score = _compute_algorithm_score(text)
    return score >= _SCORE_THRESHOLD


def detect_algorithm_regions(text: str) -> List[AlgorithmBlock]:
    """在多段落文本中扫描算法/伪代码区域。

    用于跨 block 场景：算法标题和内容可能被拆分到多个段落中。

    Args:
        text: 以 ``\\n\\n`` 分隔的完整文档文本。

    Returns:
        检测到的 AlgorithmBlock 列表（不重叠）。
    """
    paragraphs = text.split("\n\n")
    regions: List[AlgorithmBlock] = []

    i = 0
    while i < len(paragraphs):
        para = paragraphs[i].strip()
        if not para:
            i += 1
            continue

        # 检测算法标题段
        if ALGO_HEADER_RE.match(para):
            title = para.split("\n")[0].strip()
            collected = [para]
            j = i + 1

            # 向后收集属于同一算法的段落
            while j < len(paragraphs):
                next_para = paragraphs[j].strip()
                if not next_para:
                    j += 1
                    continue

                # 遇到新的算法标题或明显的章节标题则停止
                if ALGO_HEADER_RE.match(next_para):
                    break
                if re.match(r"^#{1,6}\s", next_para):
                    break
                if re.match(
                    r"^\d+(\.\d+)*\s+[A-Z]", next_para
                ) and not NUMBERED_LINE_RE.match(next_para):
                    break

                # 结构化头部段落（Require/Ensure/Input/Output）直接收集，
                # 因为它们作为独立段落时评分可能偏低（短行惩罚），
                # 但在算法标题后出现时是明确的算法组成部分
                if STRUCTURED_HEADER_RE.match(next_para):
                    collected.append(next_para)
                    j += 1
                    continue

                # 检查后续段落是否看起来像算法内容
                para_score = _compute_algorithm_score(next_para)
                if para_score >= 3:
                    collected.append(next_para)
                    j += 1
                else:
                    break

            merged_content = "\n\n".join(collected)
            regions.append(
                AlgorithmBlock(
                    title=title,
                    content=merged_content,
                    start_idx=i,
                    end_idx=j,
                    confidence=min(1.0, _compute_algorithm_score(merged_content) / 15),
                )
            )
            i = j
        elif _compute_algorithm_score(para) >= _STANDALONE_SCORE_THRESHOLD:
            # 独立的算法块（无显式标题但有足够信号）
            # 使用更高阈值，因为缺少标题的算法块需要更强的内部信号
            title_line = para.split("\n")[0].strip()
            regions.append(
                AlgorithmBlock(
                    title=title_line,
                    content=para,
                    start_idx=i,
                    end_idx=i + 1,
                    confidence=min(1.0, _compute_algorithm_score(para) / 15),
                )
            )
            i += 1
        else:
            i += 1

    return regions


def wrap_as_code_fence(content: str, label: str = "algorithm") -> str:
    """将算法内容包装为 Markdown 代码围栏。

    Args:
        content: 算法文本（保留换行和缩进）。
        label: 代码围栏的语言标签。

    Returns:
        包装后的 Markdown 代码围栏字符串。
    """
    # 清理每行尾部空白，但保留行结构
    lines = content.split("\n")
    cleaned = "\n".join(line.rstrip() for line in lines)
    return f"```{label}\n{cleaned}\n```"


# ---------------------------------------------------------------------------
# 内部评分逻辑
# ---------------------------------------------------------------------------


def _compute_algorithm_score(text: str) -> int:
    """计算文本的算法块评分。"""
    lines = [line for line in text.split("\n") if line.strip()]
    if not lines:
        return 0

    score = 0

    # 信号 1: Algorithm/Listing/Procedure N 标题 (+5)
    if ALGO_HEADER_RE.match(text.strip()):
        score += 5

    # 信号 2: Require/Ensure/Input/Output 结构化头部 (+3)
    if STRUCTURED_HEADER_RE.search(text):
        score += 3

    # 信号 3: 编号伪代码行 (每行 +1, 上限 +5)
    numbered_count = sum(1 for line in lines if NUMBERED_LINE_RE.match(line.strip()))
    score += min(numbered_count, 5)

    # 信号 4: 伪代码关键字行 (每行 +1, 上限 +5)
    keyword_count = sum(1 for line in lines if KEYWORD_LINE_RE.search(line))
    score += min(keyword_count, 5)

    # 信号 5: Unicode 特殊字符 ≥ 2 个 (+2)
    special_chars = SPECIAL_CHARS_RE.findall(text)
    if len(special_chars) >= 2:
        score += 2

    # 惩罚 0: Markdown 表格内容（含 | --- | 分隔行）直接排除
    if re.search(r"^\|[\s-]+\|", text, re.MULTILINE):
        return 0

    # 惩罚 1: 平均行长 > 120 字符（更像正文） (-3)
    avg_line_len = sum(len(line) for line in lines) / len(lines)
    if avg_line_len > 120:
        score -= 3

    # 惩罚 2: 行数 < 3 且无标题 (-2)
    if len(lines) < 3 and not ALGO_HEADER_RE.match(text.strip()):
        score -= 2

    # 惩罚 3: 无结构化信号时削减得分
    # 正文中 if/for/return 等英文高频词会产生关键字误匹配，
    # 若缺乏标题、编号行、Require/Ensure、特殊字符等结构化信号，
    # 则该文本更可能是普通段落而非伪代码
    has_structural_signal = (
        ALGO_HEADER_RE.match(text.strip())
        or STRUCTURED_HEADER_RE.search(text)
        or numbered_count >= 2
        or len(special_chars) >= 2
    )
    if not has_structural_signal:
        score -= 2

    return score
