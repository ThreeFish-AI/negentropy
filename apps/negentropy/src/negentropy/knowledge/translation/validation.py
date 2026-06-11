"""翻译结果确定性校验 — 代码围栏还原 + 结构完整性报告。

翻译铁律要求代码块逐字节保留；LLM 输出不可全信，本模块提供两级兜底：
- ``restore_fences``：fence 数量一致时按序用源 fence **确定性回写**（漂移即修复）；
  数量不一致 → 不可修复，由调用方判定失败；
- ``structural_report``：标题 / 图片引用 / 链接 URL / 公式计数对比，图片或 URL 缺失
  属于内容丢失（fatal），标题数偏差仅 warning（中英标题结构通常一致，但允许例外）。

注意：结构报告应在 fence 回写**之后**执行——届时两侧 fence 内容相同，对计数的贡献
一致，无需在统计时剔除 fence 内文本。
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

from .splitter import _FENCE_OPEN_RE, _fence_close_matches, _line_body

# 标题行：≤3 缩进 + 1..6 个 # + 空白（ATX heading）。
_HEADING_RE = re.compile(r"^ {0,3}#{1,6}\s")
# Markdown 链接/图片目标：](url) 或 ](<url>)。
_LINK_TARGET_RE = re.compile(r"\]\(\s*(<[^>]*>|[^)\s]+)")
# 裸 URL。
_BARE_URL_RE = re.compile(r"https?://[^\s)\]>'\"]+")


def _iter_fence_spans(text: str) -> list[tuple[int, int]]:
    """返回 fence 块的 ``(start, end)`` 字符偏移区间（含开闭栏行；未闭合延伸到文末）。"""
    spans: list[tuple[int, int]] = []
    offset = 0
    lines = text.splitlines(keepends=True)
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        match = _FENCE_OPEN_RE.match(_line_body(line))
        if not match:
            offset += len(line)
            i += 1
            continue
        fence = match.group(2)
        fence_char, fence_len = fence[0], len(fence)
        start = offset
        offset += len(line)
        i += 1
        while i < n and not _fence_close_matches(lines[i], fence_char, fence_len):
            offset += len(lines[i])
            i += 1
        if i < n:  # 含闭栏行
            offset += len(lines[i])
            i += 1
        spans.append((start, offset))
    return spans


def extract_fences(text: str) -> list[str]:
    """按出现顺序抽取全部 fence 块（含围栏行的精确子串）。"""
    return [text[start:end] for start, end in _iter_fence_spans(text)]


def restore_fences(translated: str, source_fences: list[str]) -> tuple[str, bool]:
    """将译文中的 fence 块按序替换为源 fence（确定性还原）。

    Returns:
        ``(修复后文本, 是否可修复)``：fence 数量一致 → 逐个回写源内容并返回 True；
        数量不一致 → 原样返回译文与 False（内容增删，无法对位修复）。
    """
    spans = _iter_fence_spans(translated)
    if len(spans) != len(source_fences):
        return translated, False
    if not spans:
        return translated, True

    pieces: list[str] = []
    cursor = 0
    for (start, end), source_fence in zip(spans, source_fences, strict=True):
        pieces.append(translated[cursor:start])
        pieces.append(source_fence)
        cursor = end
    pieces.append(translated[cursor:])
    return "".join(pieces), True


def _link_targets(text: str) -> Counter[str]:
    targets: Counter[str] = Counter(m.group(1).strip("<>") for m in _LINK_TARGET_RE.finditer(text))
    targets.update(m.group(0) for m in _BARE_URL_RE.finditer(text))
    return targets


def structural_report(source: str, translated: str) -> dict[str, Any]:
    """结构完整性对比报告（应在 fence 回写后调用）。

    Returns:
        ``fatal``: 图片引用或链接 URL 缺失（内容丢失，硬失败）；
        ``warnings``: 标题数偏差等软问题描述列表。
    """
    headings_src = sum(1 for line in source.splitlines() if _HEADING_RE.match(line))
    headings_dst = sum(1 for line in translated.splitlines() if _HEADING_RE.match(line))
    images_src = source.count("![")
    images_dst = translated.count("![")
    urls_missing = sorted((_link_targets(source) - _link_targets(translated)).elements())

    warnings: list[str] = []
    if headings_src != headings_dst:
        warnings.append(f"heading count drift: source={headings_src} translated={headings_dst}")

    images_missing = max(images_src - images_dst, 0)
    fatal = bool(images_missing or urls_missing)
    return {
        "headings_src": headings_src,
        "headings_dst": headings_dst,
        "images_src": images_src,
        "images_dst": images_dst,
        "images_missing": images_missing,
        "urls_missing": urls_missing,
        "warnings": warnings,
        "fatal": fatal,
    }
