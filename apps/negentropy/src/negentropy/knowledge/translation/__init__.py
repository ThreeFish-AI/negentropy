"""Knowledge 文档翻译域 — 确定性切分 / 校验 / 翻译服务。

正交分解：
- ``splitter``: 纯函数 Markdown 段落感知切分（join == 原文不变式）；
- ``validation``: 纯函数代码围栏抽取/回写与结构完整性报告；
- ``service``: DocumentTranslationService —— 编排 InfluenceFaculty（经 invoke_claude_code）
  完成分批翻译，并以服务端确定性校验兜底正确性。
"""

from .service import DocumentTranslationService
from .splitter import split_markdown
from .validation import extract_fences, restore_fences, structural_report

__all__ = [
    "DocumentTranslationService",
    "extract_fences",
    "restore_fences",
    "split_markdown",
    "structural_report",
]
