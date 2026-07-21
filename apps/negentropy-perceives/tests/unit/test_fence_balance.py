"""代码围栏平衡与散文误围栏降级单元测试。

锁定 auto_batch 路径「正文被整体代码块化 + 目录截断」根因修复的契约：

- ``fence_normalizer.balance_code_fences``：悬空开围栏在文本块末尾闭合、畸形
  连续开围栏拆分、幂等、无围栏透传、异种围栏字符不误判。
- ``batch_merge.merge_slice_markdowns``：任一切片的悬空开围栏在拼接前被平衡，
  绝不相位错位（phase-shift）邻片，邻片正文/标题不被困入代码块。
- ``formatter._demote_prose_fences`` / ``format_fidelity_safe``：含章节标题 /
  目录点导引线 / CJK 主导 / 图表题注的伪代码围栏被拆栏还原为段落；含中文注释
  的真 Python（多处赋值）不被误降；elixir/visualbasic 等误标语言被抹掉。
"""

from __future__ import annotations

import re

from negentropy.perceives.markdown.fence_normalizer import (
    balance_code_fences,
    count_fence_markers,
)
from negentropy.perceives.markdown.formatter import MarkdownFormatter
from negentropy.perceives.pipeline.batch_merge import (
    merge_slice_markdowns,
)


def _fenced_line_indices(md: str) -> set[int]:
    """返回处于代码围栏内部的行号集合（用于断言正文未被困）。"""
    inside: set[int] = set()
    in_fence = False
    for i, ln in enumerate(md.split("\n")):
        if re.match(r"^\s*(```|~~~)", ln):
            in_fence = not in_fence
            continue
        if in_fence:
            inside.add(i)
    return inside


# ---------------------------------------------------------------------------
# balance_code_fences
# ---------------------------------------------------------------------------


class TestBalanceCodeFences:
    def test_no_fence_passthrough(self) -> None:
        md = "# 标题\n\n正文一段。\n\n另一段。"
        assert balance_code_fences(md) == md

    def test_balanced_unchanged(self) -> None:
        md = "```python\nprint(1)\n```\n\n正文"
        assert balance_code_fences(md) == md
        assert count_fence_markers(md) % 2 == 0

    def test_dangling_open_gets_closed(self) -> None:
        md = "前文\n\n```python\nx = 1\n还有正文没有闭合围栏"
        out = balance_code_fences(md)
        assert count_fence_markers(out) % 2 == 0
        assert out.endswith("```")

    def test_malformed_consecutive_info_opens_split(self) -> None:
        # docling 畸形：两个带 info 的开围栏之间缺裸 ``` 闭合
        md = "```javascript\nfoo()\n```javascript\nbar()\n```"
        out = balance_code_fences(md)
        assert count_fence_markers(out) % 2 == 0
        # 第一块在第二个 info 开围栏前被裸 ``` 闭合
        assert "foo()\n```\n```javascript\nbar()" in out

    def test_idempotent(self) -> None:
        md = "```yaml\nk: v\n```javascript\nz=1\n悬空"
        once = balance_code_fences(md)
        assert balance_code_fences(once) == once

    def test_tilde_fence_supported(self) -> None:
        md = "~~~\ncode\n无闭合"
        out = balance_code_fences(md)
        assert out.endswith("~~~")
        assert count_fence_markers(out) % 2 == 0


# ---------------------------------------------------------------------------
# merge_slice_markdowns —— 切片不泄漏围栏
# ---------------------------------------------------------------------------


class TestMergeDoesNotLeakFences:
    def test_odd_fence_slice_does_not_trap_next_slice(self) -> None:
        # slice0 结尾悬空开围栏；未平衡时会把 slice1 的标题/正文全部困入代码块
        slice0 = "# 第 1 章\n\n```javascript\n{tool:1}\n```javascript\n{tool:2}"
        slice1 = "## 第 2 章\n\n第二章正文。\n\n### 2.1 小节\n\n更多正文。"
        merged = merge_slice_markdowns([slice0, slice1], [(0, 20), (20, 40)])
        # 合并后围栏必平衡
        assert count_fence_markers(merged) % 2 == 0
        # slice1 的标题必须在围栏之外（真标题）
        fenced = _fenced_line_indices(merged)
        lines = merged.split("\n")
        h2 = next(i for i, ln in enumerate(lines) if ln.startswith("## 第 2 章"))
        h3 = next(i for i, ln in enumerate(lines) if ln.startswith("### 2.1"))
        assert h2 not in fenced
        assert h3 not in fenced


# ---------------------------------------------------------------------------
# _demote_prose_fences —— 散文降级 / 真代码保留 / 误标语言抹除
# ---------------------------------------------------------------------------


class TestDemoteProseFences:
    def setup_method(self) -> None:
        self.fmt = MarkdownFormatter()

    def test_section_heading_inside_fence_demoted(self) -> None:
        md = "```yaml\ntool_calls: [x]\n\n### 1.2.5 编排模式\n\n工作流是确定性编排。\n```"
        out = self.fmt._demote_prose_fences(md)
        assert "```" not in out
        assert "### 1.2.5 编排模式" in out

    def test_toc_leader_inside_fence_demoted(self) -> None:
        md = "```text\n全书结构............ 2\n引言 ...... 1\n```"
        out = self.fmt._demote_prose_fences(md)
        assert "```" not in out

    def test_cjk_dominant_prose_demoted(self) -> None:
        md = "```visualbasic\n相比之下，流程驱动的提示词就像一份优秀的员工培训手册。\n它提供了清晰的标准操作流程。\n```"
        out = self.fmt._demote_prose_fences(md)
        assert "```" not in out
        assert "visualbasic" not in out

    def test_real_python_with_chinese_comments_kept(self) -> None:
        md = (
            "```python\n"
            "# 1. 用户提问\n"
            'query = "量子纠缠是什么？"\n'
            "results = retriever.search(query, top_k=3)\n"
            "answer = model.generate(results)\n"
            "```"
        )
        out = self.fmt._demote_prose_fences(md)
        assert out.strip().startswith("```python")
        assert "retriever.search" in out

    def test_implausible_lang_stripped_but_code_kept(self) -> None:
        md = (
            "```elixir\nmessages = [\n  {role: 'user'},\n  {role: 'assistant'},\n]\n```"
        )
        out = self.fmt._demote_prose_fences(md)
        assert "elixir" not in out
        assert out.strip().startswith("```")  # 仍是代码块（裸围栏）
        assert "messages = [" in out

    def test_plausible_json_code_untouched(self) -> None:
        md = '```json\n{\n  "name": "get_weather",\n  "args": {"city": "SF"}\n}\n```'
        out = self.fmt._demote_prose_fences(md)
        assert out == md


# ---------------------------------------------------------------------------
# format_fidelity_safe —— 端到端：balance + demote 协同
# ---------------------------------------------------------------------------


class TestHeadingQuality:
    def setup_method(self) -> None:
        self.fmt = MarkdownFormatter()

    def test_numbered_list_heading_becomes_ordered_list(self) -> None:
        md = "## 1. 核实用户身份 ——调用身份验证 API\n\n## 2. 搜索可用航班"
        out = self.fmt._normalize_heading_quality(md)
        assert "1. 核实用户身份 ——调用身份验证 API" in out
        assert "2. 搜索可用航班" in out
        assert "## 1." not in out and "## 2." not in out

    def test_multilevel_section_number_kept_as_heading(self) -> None:
        md = "##### 1.2.5.1 工作流模式：确定性的编排"
        assert self.fmt._normalize_heading_quality(md) == md

    def test_figure_caption_heading_demoted(self) -> None:
        md = "#### 图 2-4 Agent 每次调用模型时的上下文构成"
        out = self.fmt._normalize_heading_quality(md)
        assert out == "图 2-4 Agent 每次调用模型时的上下文构成"

    def test_prose_sentence_heading_demoted(self) -> None:
        md = "## 2025 年 8 月，我在图灵进行了讲座。讲座的初衷很简单。"
        out = self.fmt._normalize_heading_quality(md)
        assert not out.startswith("#")

    def test_leadin_colon_heading_demoted(self) -> None:
        md = "#### 让我们跟踪 messages 列表在每一轮的变化："
        out = self.fmt._normalize_heading_quality(md)
        assert not out.lstrip().startswith("#")

    def test_running_header_echo_deduped_same_scope(self) -> None:
        md = (
            "### 1.1 现代 Agent = LLM + 上下文 + 工具\n\n"
            "#### 1.1.1 工具\n\n正文\n\n"
            "### 1.1 现代 Agent = LLM + 上下文 + 工具\n\n"  # 页眉回声
            "#### 1.1.4 ReAct 循环\n"
        )
        out = self.fmt._normalize_heading_quality(md)
        assert out.count("### 1.1 现代 Agent = LLM + 上下文 + 工具") == 1

    def test_same_title_different_chapter_scope_kept(self) -> None:
        # 各章共有的「思考题」分处不同章（其间有更浅层的章标题重置作用域），不去重
        md = (
            "## 第 1 章 入门\n\n### 思考题\n\n题目一\n\n"
            "## 第 2 章 进阶\n\n### 思考题\n\n题目二\n"
        )
        out = self.fmt._normalize_heading_quality(md)
        assert out.count("### 思考题") == 2


class TestCodeBlockLeadinExtraction:
    def setup_method(self) -> None:
        self.fmt = MarkdownFormatter()

    def test_leadin_moved_out_when_no_echo(self) -> None:
        md = "```yaml\n以一个查天气的场景为例，四步流程如下：\n\ntools: [1, 2]\n```"
        out = self.fmt._extract_code_block_leadins(md)
        assert out.startswith("以一个查天气的场景为例，四步流程如下：")
        assert "```yaml\ntools: [1, 2]\n```" in out
        assert count_fence_markers(out) % 2 == 0

    def test_leadin_dropped_when_prose_echo_precedes(self) -> None:
        md = (
            "让我们通过伪代码来理解 Agent 轨迹的结构：\n\n"
            "一些中间的乱码回声内容。\n\n"
            "```python\n让我们通过伪代码来理解 Agent 轨迹的结构：\ntrace = build()\n```"
        )
        out = self.fmt._extract_code_block_leadins(md)
        # 回声已在块前 → 块内导语被丢弃，不重复
        assert out.count("让我们通过伪代码来理解 Agent 轨迹的结构：") == 1
        assert "trace = build()" in out

    def test_python_comment_not_extracted(self) -> None:
        md = '```python\n# 例 2: 公司知识库，流程是什么：\nquery = "x"\nrun(query)\n```'
        out = self.fmt._extract_code_block_leadins(md)
        assert out == md  # 注释行保留在代码块内

    def test_no_leadin_untouched(self) -> None:
        md = '```json\n{"a": 1, "b": 2}\n```'
        assert self.fmt._extract_code_block_leadins(md) == md


class TestFidelitySafeFenceIntegrity:
    def test_dangling_fence_and_prose_block_both_repaired(self) -> None:
        fmt = MarkdownFormatter()
        md = (
            "# 深入理解 AI Agent\n\n"
            "```yaml\n"
            "tool_calls: [x]\n\n"
            "#### 1.2.5 编排模式\n\n"
            "工作流是通过预定义的代码路径来编排的系统。\n\n"
            "##### 1.2.5.1 工作流模式\n"  # 无闭合围栏（悬空）
        )
        out = fmt.format_fidelity_safe(md)
        assert count_fence_markers(out) % 2 == 0
        fenced = _fenced_line_indices(out)
        lines = out.split("\n")
        h = next(i for i, ln in enumerate(lines) if "1.2.5.1 工作流模式" in ln)
        assert h not in fenced  # 章节标题不再被困入代码块
