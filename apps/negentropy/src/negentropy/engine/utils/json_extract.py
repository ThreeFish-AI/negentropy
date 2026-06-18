"""LLM JSON 输出鲁棒解析 — 剥离 markdown 代码围栏后再 ``json.loads``（ISSUE-127）。

动机：部分模型即便指定 ``response_format={"type":"json_object"}`` 仍把 JSON 包在 markdown
代码围栏里（实测 ``anthropic/claude-sonnet-4-6`` 经代理恒返回 ```json\\n{...}\\n``` ）。
``json.loads`` 见前导反引号即抛 ``Expecting value: line 1 column 1``。弱模型（gpt-5-nano）返回裸
JSON 故历史未暴露——但凡切换到会围栏的强模型（Judge/PlanReviewer/记忆提取），解析全线失败、
评审/评分/提取静默退化。本工具统一在 ``json.loads`` 前剥离围栏与首尾噪声，单点收敛。

参考：OpenAI/Anthropic 结构化输出实践——消费方不应假定模型严格裸 JSON，须容忍 ```fence```。
"""

from __future__ import annotations

import json
import re
from typing import Any

# 匹配 ```json ... ``` 或 ``` ... ``` 围栏，提取其中内容（非贪婪，跨行）。
_FENCE_RE = re.compile(r"```(?:json|JSON)?\s*\n?(.*?)\n?```", re.DOTALL)


def strip_code_fence(content: str | None) -> str:
    """剥离 markdown 代码围栏，返回其中的 JSON 文本（无围栏则原样去首尾空白）。

    - ```json\\n{...}\\n``` / ```\\n{...}\\n``` → ``{...}``
    - 无围栏 → ``content.strip()``
    - None/空 → ``""``
    """
    if not content:
        return ""
    text = content.strip()
    m = _FENCE_RE.search(text)
    if m:
        return m.group(1).strip()
    return text


def loads_lenient(content: str | None, *, default: Any | None = None) -> Any:
    """容错 ``json.loads``：先剥围栏；失败再尝试截取首个 ``{...}`` / ``[...]`` 子串。

    解析彻底失败时返回 ``default``（默认 ``{}``），由调用方按既有字段缺省逻辑兜底。
    """
    if default is None:
        default = {}
    stripped = strip_code_fence(content)
    if not stripped:
        return default
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        # 兜底：截取首个平衡的 JSON 对象/数组子串（容忍模型前后夹带散文）。
        for opener, closer in (("{", "}"), ("[", "]")):
            start = stripped.find(opener)
            end = stripped.rfind(closer)
            if start != -1 and end > start:
                try:
                    return json.loads(stripped[start : end + 1])
                except json.JSONDecodeError:
                    continue
        return default


__all__ = ["strip_code_fence", "loads_lenient"]
