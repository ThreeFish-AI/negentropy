"""代码围栏平衡归一。

保证 Markdown ``` / ~~~ 代码围栏在**单个文本块内严格配对且以闭合收尾**，
从根本上杜绝「悬空开围栏泄漏到相邻文本」这一 auto_batch 合并失真源。

背景（实证）：docling 代码增强对「API 请求/响应」等示例偶产出畸形围栏序列——
一串带 info-string 的开围栏（``` ```javascript ```）缺配对裸 ``` 闭合，使单个
切片净奇数个围栏标记、结尾遗留悬空开围栏。auto_batch 逐切片原样拼接后，该悬空
开围栏会**相位错位（phase-shift）其后所有内容的围栏配对**，把大段正文与标题误
困入代码块（渲染为等宽字面文本），并使依「真实标题」生成的 Wiki 目录在首个围栏
处截断。

本模块为**纯函数**（无 IO / 无状态），供 ``pipeline.batch_merge`` 在切片拼接前
逐切片平衡，及 ``markdown.formatter.format_fidelity_safe`` 作为全局安全网调用。
"""

from __future__ import annotations

import re

# 围栏行：行首可选缩进 + ≥3 个反引号或波浪号 + 可选 info-string。
# 注意 info-string 捕获要求以非空白字符起手，避免把「``` ``」这类误判。
_FENCE_LINE_RE = re.compile(
    r"^(?P<indent>[ \t]*)(?P<ticks>`{3,}|~{3,})[ \t]*(?P<info>\S.*)?$"
)


def balance_code_fences(markdown: str) -> str:
    """平衡 Markdown 代码围栏，保证严格配对且结尾闭合。

    状态机逐行扫描围栏标记，处理三类情形：

    1. **未开 → 开围栏行**：进入 fence（记录围栏字符与缩进）。
    2. **已开 → 同字符裸围栏行**（无 info-string）：闭合当前块。
    3. **已开 → 同字符带 info-string 围栏行**（``` ```lang```）：判定为
       docling 畸形「未闭合即开新块」，**先补裸 ``` 闭合当前块，再以该行开新块**，
       从而把被错误粘连的两个代码块拆开，且总数保持偶。

    扫描结束若仍处于开状态（奇数个围栏），在文本末尾补一行裸围栏闭合，确保该
    文本块绝不把围栏泄漏给后续拼接内容。

    幂等：对已平衡的文本再次调用不产生变化（无 info-fence-while-open、无悬空开）。

    Args:
        markdown: 单个文本块（切片或整篇）的 markdown。

    Returns:
        围栏严格配对、以闭合收尾的 markdown。无围栏时原样返回。
    """
    if not markdown or ("```" not in markdown and "~~~" not in markdown):
        return markdown

    lines = markdown.split("\n")
    out: list[str] = []
    open_char: str | None = None  # '`' 或 '~'，None 表示当前不在围栏内
    open_indent = ""

    for line in lines:
        m = _FENCE_LINE_RE.match(line)
        if not m:
            out.append(line)
            continue

        ticks = m.group("ticks")
        info = (m.group("info") or "").strip()
        char = ticks[0]

        if open_char is None:
            # 情形 1：开围栏
            open_char = char
            open_indent = m.group("indent")
            out.append(line)
        elif char != open_char:
            # 异种围栏字符（如 ```-块内出现 ~~~）视为块内正文，原样保留
            out.append(line)
        elif not info:
            # 情形 2：同字符裸围栏 → 闭合当前块
            out.append(line)
            open_char = None
        else:
            # 情形 3：同字符带 info-string 且当前已开 → 畸形，先闭合再开新块
            out.append(f"{open_indent}{open_char * 3}")
            out.append(line)
            open_indent = m.group("indent")
            # open_char 不变（新块继续开着）

    if open_char is not None:
        # 悬空开围栏 → 末尾补闭合
        out.append(f"{open_indent}{open_char * 3}")

    return "\n".join(out)


def count_fence_markers(markdown: str) -> int:
    """统计文本中的围栏标记行数（用于测试/诊断断言奇偶平衡）。"""
    if not markdown:
        return 0
    return sum(1 for line in markdown.split("\n") if _FENCE_LINE_RE.match(line))
