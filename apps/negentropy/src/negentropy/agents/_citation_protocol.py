"""知识与记忆引用规范 — 跨 Agent 共享文本块与 Memory citation 格式化（单一事实源）。

设计目标：
- 6 个内置 Agent（NegentropyEngine + 5 Faculty）的 instruction 常量统一拼接
  ``CITATION_PROTOCOL``，保证「使用 Knowledge Base / Knowledge Graph / Memory 内容
  必须附带引用来源与原文摘录」的规范只有一处权威定义；
- 本模块是**零依赖叶子模块**（仅标准库），agents 层与 engine 层均可安全 import，
  无循环依赖风险；
- ``format_memory_citation`` 为 Memory 类来源提供与 KB ``_format_citation``
  （IEEE 风格，见 ``agents/tools/perception.py``）正交的引用格式 —— Memory 无
  author/title/arXiv id，以 id 短码 + 类型 + 日期标识。

理论依据（与 KB citation 同源）：Self-RAG / Corrective RAG 等工作均强调 retrieval
必须返回 stable citation token，让模型在生成阶段引用以压低幻觉率。
"""

from __future__ import annotations

# 测试与去重检查用的稳定锚点：每个 instruction 中该标题必须恰好出现一次。
CITATION_PROTOCOL_HEADER = "知识与记忆引用规范"

CITATION_PROTOCOL = """
## 知识与记忆引用规范 (Knowledge & Memory Citation Protocol)
当产出使用了知识库 (Knowledge Base)、知识图谱 (Knowledge Graph) 或长期记忆 (Memory)
的内容时，必须保证每条信息可溯源：

1. **行内标号**：在引用具体观点/事实处以 ``[N]`` 标注（N = 工具结果中的 ``citation_id``）。
2. **参考文献节**：回复末尾追加 *## 参考文献* 节，按 ``[N]`` 顺序逐条列出：
   - 该条的 ``formatted_citation`` 字符串；
   - 下一行以 ``> `` 引用块附**原文摘录**（取 ``snippet``/记忆内容的关键句，≤ 100 字）。
3. **Memory 引用格式**：记忆类来源的 citation 形如
   ``[N] Memory <id 前 8 位>, <memory_type>, <YYYY-MM-DD>``，同样必须附原文摘录。
4. **转述不剥离引用**：转述、压缩或汇总携带 ``[N]`` 标注的上游内容
   （其他系部产出、工具结果）时，必须原样保留对应 ``[N]`` 标号与末尾参考文献节，
   严禁在改写中丢弃来源信息。
5. **绝不臆造**：仅使用工具/上游内容实际给出的 ``citation_id`` 与 ``formatted_citation``；
   无来源的论断须显式声明「无来源依据」，严禁编造编号、出处或摘录。
"""


def format_memory_citation(
    memory_id: str | None,
    memory_type: str | None,
    created_at_iso: str | None,
    idx: int,
) -> str:
    """Memory 引用：``[N] Memory <id8>, <memory_type>, <YYYY-MM-DD>``。

    全字段 best-effort：任意字段缺失/异常均降级为占位，不抛异常 —— citation
    格式化绝不能阻断检索主链路。

    Args:
        memory_id: 记忆 UUID 字符串（取前 8 位作短码）。
        memory_type: episodic / semantic / procedural / fact 等。
        created_at_iso: ISO 8601 时间串（仅取日期部分）。
        idx: 1-based 引用序号。
    """
    id8 = (memory_id or "")[:8] or "unknown"
    mtype = memory_type or "episodic"
    date = (created_at_iso or "")[:10]
    if date:
        return f"[{idx}] Memory {id8}, {mtype}, {date}"
    return f"[{idx}] Memory {id8}, {mtype}"


__all__ = [
    "CITATION_PROTOCOL",
    "CITATION_PROTOCOL_HEADER",
    "format_memory_citation",
]
