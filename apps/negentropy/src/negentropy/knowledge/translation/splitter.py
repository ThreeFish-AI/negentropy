"""Markdown 翻译切分器 — 段落感知、代码围栏原子、零丢失。

设计目标（对应翻译需求的"按字符长度和段落切分，段落尽可能不被切开，不丢失内容"）：
- **精确切片**：所有块均为原文的精确子串（含换行），任意切分结果满足不变式
  ``"".join(chunks) == text``，违例即抛错（绝不静默丢字）；
- **原子块**：fenced code（```/~~~，未闭合延伸到 EOF）、文首 front-matter、连续表格行
  永不被切开；
- **段落边界**：普通文本按空行分段，贪心打包至 ``max_chars``；超长普通段落按行边界降级
  二切，超长原子块整体放行为超限 chunk（由翻译铁律保证逐字节保留）。

与 ``knowledge/ingestion/chunking.py``（面向检索、允许改写）正交：本模块面向翻译回写，
任何字符的增删都是缺陷。
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# 默认单块字符上限：与 doc-translator 批次经验值（≈6000 字/批）对齐。
DEFAULT_MAX_CHARS = 6000

# fenced code 开栏：≤3 缩进 + ≥3 个 ` 或 ~（CommonMark spec）。
_FENCE_OPEN_RE = re.compile(r"^( {0,3})(`{3,}|~{3,})(.*)$")
# 表格行：行首（≤3 缩进）以管道符开头。
_TABLE_ROW_RE = re.compile(r"^ {0,3}\|")


@dataclass(frozen=True)
class Block:
    """原文精确切片块。``kind``: front_matter | code | table | text | blank。"""

    text: str
    kind: str

    @property
    def atomic(self) -> bool:
        return self.kind in ("front_matter", "code", "table")


def _line_body(line: str) -> str:
    """去掉行尾换行符（兼容 \\n / \\r\\n），保留其余内容。"""
    return line.rstrip("\r\n")


def _fence_close_matches(line: str, fence_char: str, fence_len: int) -> bool:
    """闭栏：同字符、长度 ≥ 开栏、≤3 缩进、其后仅空白（CommonMark closing fence）。"""
    body = _line_body(line)
    stripped = body.lstrip(" ")
    if len(body) - len(stripped) > 3:
        return False
    run = 0
    for ch in stripped:
        if ch == fence_char:
            run += 1
        else:
            break
    return run >= fence_len and not stripped[run:].strip()


def scan_blocks(text: str) -> list[Block]:
    """行级状态机：把 Markdown 扫描为有序块流，满足 ``"".join(b.text) == text``。"""
    if not text:
        return []

    lines = text.splitlines(keepends=True)
    blocks: list[Block] = []
    i = 0
    n = len(lines)

    def _consume_blank_run(start: int) -> int:
        j = start
        while j < n and not _line_body(lines[j]).strip():
            j += 1
        return j

    # 文首 front-matter：``---`` 开栏，``---`` / ``...`` 闭栏；未闭合则不视为 front-matter。
    if _line_body(lines[0]).strip() == "---":
        j = 1
        while j < n and _line_body(lines[j]).strip() not in ("---", "..."):
            j += 1
        if j < n:
            end = _consume_blank_run(j + 1)
            blocks.append(Block("".join(lines[:end]), "front_matter"))
            i = end

    while i < n:
        body = _line_body(lines[i])

        # 空行段（块间分隔，非原子）
        if not body.strip():
            end = _consume_blank_run(i)
            blocks.append(Block("".join(lines[i:end]), "blank"))
            i = end
            continue

        # fenced code（未闭合延伸到 EOF）
        fence_match = _FENCE_OPEN_RE.match(body)
        if fence_match:
            fence = fence_match.group(2)
            fence_char, fence_len = fence[0], len(fence)
            j = i + 1
            while j < n and not _fence_close_matches(lines[j], fence_char, fence_len):
                j += 1
            j = min(j + 1, n)  # 含闭栏行；未闭合时 j == n
            end = _consume_blank_run(j)
            blocks.append(Block("".join(lines[i:end]), "code"))
            i = end
            continue

        # 表格：连续管道行成组
        if _TABLE_ROW_RE.match(body):
            j = i
            while j < n and _TABLE_ROW_RE.match(_line_body(lines[j])):
                j += 1
            end = _consume_blank_run(j)
            blocks.append(Block("".join(lines[i:end]), "table"))
            i = end
            continue

        # 普通段落：连续非空行（遇 fence 开栏 / 表格行提前停止），随后吸收空行
        j = i
        while j < n:
            jbody = _line_body(lines[j])
            if not jbody.strip() or _FENCE_OPEN_RE.match(jbody) or _TABLE_ROW_RE.match(jbody):
                break
            j += 1
        end = _consume_blank_run(j)
        blocks.append(Block("".join(lines[i:end]), "text"))
        i = end

    joined = "".join(b.text for b in blocks)
    if joined != text:  # pragma: no cover - 状态机自洽校验，理论不可达
        raise ValueError("scan_blocks invariant violated: joined blocks != original text")
    return blocks


def _split_oversize_text(text: str, max_chars: int) -> list[str]:
    """超长普通段落降级：按行边界二切；单行超限时整行放行（不破坏行内语义）。"""
    pieces: list[str] = []
    current: list[str] = []
    current_len = 0
    for line in text.splitlines(keepends=True):
        if current and current_len + len(line) > max_chars:
            pieces.append("".join(current))
            current, current_len = [], 0
        current.append(line)
        current_len += len(line)
    if current:
        pieces.append("".join(current))
    return pieces


def split_markdown(text: str, max_chars: int = DEFAULT_MAX_CHARS) -> list[str]:
    """段落感知切分：贪心打包块至 ``max_chars``，保证 ``"".join(chunks) == text``。

    - 原子块（code / front-matter / table）永不切开，超限时独占一个超限 chunk；
    - 普通段落超限时按行边界降级二切；
    - 空 ``text`` 返回 ``[]``。
    """
    if max_chars <= 0:
        raise ValueError("max_chars must be positive")
    if not text:
        return []

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    def _flush() -> None:
        nonlocal current, current_len
        if current:
            chunks.append("".join(current))
            current, current_len = [], 0

    for block in scan_blocks(text):
        piece_list = (
            [block.text]
            if block.atomic or len(block.text) <= max_chars
            else _split_oversize_text(block.text, max_chars)
        )
        for piece in piece_list:
            if current and current_len + len(piece) > max_chars:
                _flush()
            current.append(piece)
            current_len += len(piece)
            if current_len > max_chars:  # 超限原子块独占 chunk
                _flush()
    _flush()

    if "".join(chunks) != text:
        raise ValueError("split_markdown invariant violated: joined chunks != original text")
    return chunks
