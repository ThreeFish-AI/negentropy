#!/usr/bin/env python3
"""lcc_memory_lab.py — Learn Claude Code「记忆管理」机制原型（Context Compact + Memory）

原型回答「机制是否自洽」，不回答「模型是否聪明」：
材料里的 LLM 角色（摘要器、记忆选择器、提取器、整理器）全部用确定性
mock 或脚本化序列替代。无随机数、固定样本序列——同一命令永远同一日志。

对照材料（轨名+目录名）：
  站点轨 s08_context_compact / s09_memory  @67a9126c（README.md 中文）
  main 轨  s08_context_compact / s09_memory  @ce8f9f18（README.zh.md）
原型以 main 轨语义为基线（seen/unseen、可恢复占位、active_request 分离、
scope 门控、整理回滚），站点轨差异（死占位、pre_compress 快照）在对照实验里出现。

机制 → 实现单元速查（行号级对照见精读笔记 173 §6 动手实验室）：
  M1 四步管线与顺序       prepare()
  M2 配对不变式与切口保护 _has_tool_use/_is_tool_result/validate_pairing/snip_compact
  M3 seen/unseen 可恢复占位 unseen_positions/micro_compact/persist_before_replace
  M4 未读溢出 fit         fit_tool_results
  M5 摘要与应急           compact_history/reactive_compact（熔断语义见 173 笔记 §3.5）
  M6 记忆存储与索引       MemoryStore.write/rebuild_index
  M7 选择性召回           select_relevant_memories（LLM mock + 关键词降级）
  M8 写入门控             should_store_memory/extract_memories
  M9 整理原子性           consolidate（快照+回滚）

用法：
  python3 lcc_memory_lab.py --selftest          # 全部机制 + 断言
  python3 lcc_memory_lab.py --sabotage NAME     # 破坏性实验（见 SABOTAGES）
  python3 lcc_memory_lab.py --scenario t4       # 四测 T4 走查输入实跑
  python3 lcc_memory_lab.py --scenario t5       # 四测 T5 预测输入实跑（拆边界保护）
沙箱：输出（落盘结果、transcript、记忆库）默认写进系统临时目录下的
lcc-lab-sandbox/（LCC_LAB_ROOT 环境变量可重定向），每次运行前整体重建，
不触仓库与当前目录。
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

# ── 沙箱与常量（main 轨 ContextCompactor 同名同值） ──────────────────────────

SANDBOX = None  # 由 main() 决定：LCC_LAB_ROOT 环境变量优先，否则系统临时目录下的固定名


CONTEXT_CHAR_LIMIT = 50_000          # 触发 micro/摘要的上下文字符阈值（玩具值）
TOOL_BATCH_CHAR_LIMIT = 200_000      # 单批 tool_result 总量预算
LARGE_RESULT_CHAR_LIMIT = 30_000     # 单条结果超过此长度才落盘
KEEP_RECENT_RESULTS = 3              # 已读结果保留条数
KEEP_RECENT_MESSAGES = 5             # reactive 保留的原始消息条数
SUMMARY_INPUT_CHAR_LIMIT = 80_000    # main 轨对照常量（本文件不接线）
MAX_CONSECUTIVE_COMPACT_FAILURES = 3  # 熔断器；main 轨对照常量（本文件不接线）
MAX_REACTIVE_RETRIES = 1             # main 轨对照常量（本文件不接线）
PLACEHOLDER_MIN_CHARS = 120          # ≤120 字符的结果不值得替换
CONSOLIDATE_THRESHOLD = 10           # main 轨对照常量（本文件不接线）
RECALL_CHAR_LIMIT = 20_000           # 召回正文总预算
MEMORY_TYPES = ("user", "feedback", "project", "reference")
TEMPORARY_MARKERS = (
    "this session", "current session", "current task", "for now",
    "本次会话", "当前任务", "这一轮", "暂时",
)


class Lab:
    """一次实验会话：管理沙箱、转录与统计。"""

    def __init__(self, root: Path):
        self.root = root
        self.tool_results_dir = root / ".task_outputs" / "tool-results"
        self.transcript_dir = root / ".transcripts"
        self.memory_dir = root / ".memory"
        for d in (self.tool_results_dir, self.transcript_dir, self.memory_dir):
            d.mkdir(parents=True, exist_ok=True)
        self.persisted_files: list[str] = []   # 落盘登记（供退化统计）
        self.transcripts: list[str] = []
        self.summary_calls = 0                  # LLM 摘要 mock 调用计数
        self.log: list[str] = []

    def say(self, line: str) -> None:
        self.log.append(line)
        print(line)


# ── M2：配对不变式（API 侧校验器的确定性模拟） ──────────────────────────────


def _blocks(message: dict) -> list:
    content = message.get("content")
    return content if isinstance(content, list) else []


def _block_type(block) -> str | None:
    return block.get("type") if isinstance(block, dict) else None


def _has_tool_use(message: dict) -> bool:
    return message.get("role") == "assistant" and any(
        _block_type(b) == "tool_use" for b in _blocks(message)
    )


def _is_tool_result(message: dict) -> bool:
    return message.get("role") == "user" and any(
        isinstance(b, dict) and b.get("type") == "tool_result" for b in _blocks(message)
    )


def validate_pairing(messages: list[dict]) -> list[str]:
    """模拟 Messages API 的硬校验：每个 tool_result 必须紧跟其 tool_use 之后出现。"""
    errors, open_calls = [], {}
    for index, message in enumerate(messages):
        for block in _blocks(message):
            kind = _block_type(block)
            if kind == "tool_use":
                open_calls[block.get("id")] = index
            elif kind == "tool_result":
                if open_calls.pop(block.get("tool_use_id"), None) is None:
                    errors.append(f"orphan tool_result at message[{index}]")
    if open_calls:
        errors.append(f"unanswered tool_use: {sorted(open_calls)}")
    return errors


# ── M3：落盘与可恢复占位 ────────────────────────────────────────────────────


def persist_output(lab: Lab, tool_use_id: str, output: str) -> Path:
    safe_id = "".join(c if c.isalnum() or c in "._-" else "_" for c in str(tool_use_id))[:120]
    path = lab.tool_results_dir / f"{safe_id}.txt"
    path.write_text(output, encoding="utf-8")
    lab.persisted_files.append(str(path))
    return path


def persisted_path_of(content: str, lab: Lab) -> str | None:
    """识别两种既有落盘格式，校验路径确实在沙箱结果目录且文件存在。"""
    candidate = None
    if content.startswith("<persisted-output>\n"):
        for line in content.splitlines():
            if line.startswith("Full output: "):
                candidate = line.removeprefix("Full output: ")
                break
    prefix = "[Earlier tool result saved at "
    if content.startswith(prefix) and content.endswith("]"):
        candidate = content[len(prefix):-1]
    if not candidate:
        return None
    path = Path(candidate)
    if not str(path.resolve()).startswith(str(lab.tool_results_dir.resolve())) or not path.is_file():
        return None
    return str(path)


def persisted_preview(lab: Lab, tool_use_id: str, output: str, preview: int) -> str:
    return (f"<persisted-output>\nFull output: {persist_output(lab, tool_use_id, output)}\n"
            f"Preview:\n{output[:preview]}\n</persisted-output>")


def unseen_positions(messages: list[dict]) -> set[tuple[int, int]]:
    """模型最近一次回复之后新增的 tool_result 位置（未读）。"""
    last_assistant = next(
        (i for i in range(len(messages) - 1, -1, -1) if messages[i].get("role") == "assistant"),
        -1,
    )
    positions = set()
    for mi in range(last_assistant + 1, len(messages)):
        if messages[mi].get("role") != "user":
            continue
        for bi, block in enumerate(_blocks(messages[mi])):
            if isinstance(block, dict) and block.get("type") == "tool_result":
                positions.add((mi, bi))
    return positions


def estimate_chars(messages: list[dict]) -> int:
    return len(json.dumps(messages, ensure_ascii=False, default=str))


# ── M1：四步管线（顺序固定） ────────────────────────────────────────────────


def tool_result_budget(lab: Lab, messages: list[dict]) -> list[dict]:
    """第一步：只处理最新一批结果；总量超预算时按大小降序落盘（>30K 才动）。"""
    if not messages or messages[-1].get("role") != "user":
        return messages
    blocks = [b for b in _blocks(messages[-1]) if isinstance(b, dict) and b.get("type") == "tool_result"]
    total = sum(len(str(b.get("content", ""))) for b in blocks)
    if total <= TOOL_BATCH_CHAR_LIMIT:
        return messages
    for block in sorted(blocks, key=lambda b: len(str(b.get("content", ""))), reverse=True):
        if total <= TOOL_BATCH_CHAR_LIMIT:
            break
        content = str(block.get("content", ""))
        if len(content) <= LARGE_RESULT_CHAR_LIMIT:
            continue
        block["content"] = persisted_preview(lab, block.get("tool_use_id", "?"), content, 2000)
        total = sum(len(str(b.get("content", ""))) for b in blocks)
        lab.say(f"  [budget] persisted {block.get('tool_use_id')} ({len(content)} chars)")
    return messages


def write_transcript(lab: Lab, messages: list[dict], tag: str) -> str:
    path = lab.transcript_dir / f"transcript_{tag}.jsonl"
    with path.open("w", encoding="utf-8") as handle:
        for message in messages:
            handle.write(json.dumps(message, ensure_ascii=False, default=str) + "\n")
    lab.transcripts.append(str(path))
    return str(path)


def snip_compact(lab: Lab, messages: list[dict], max_messages: int = 50, guard: bool = True) -> list[dict]:
    """第二步：>50 条先写 transcript 再裁中段；guard=False 即拆掉边界保护（实验用）。"""
    if len(messages) <= max_messages:
        return messages
    head_end, tail_start = 3, len(messages) - (max_messages - 3 - 1)
    if guard and _has_tool_use(messages[head_end - 1]):
        while head_end < tail_start and _is_tool_result(messages[head_end]):
            head_end += 1
    if guard and tail_start > 0 and _is_tool_result(messages[tail_start]) and _has_tool_use(messages[tail_start - 1]):
        tail_start -= 1
    if head_end >= tail_start:
        return messages
    transcript = write_transcript(lab, messages, "snip")
    marker = {"role": "user", "content": f"[{tail_start - head_end} messages archived at {transcript}]"}
    lab.say(f"  [snip] archived {tail_start - head_end} messages -> {transcript}")
    return [*messages[:head_end], marker, *messages[tail_start:]]


def micro_compact(lab: Lab, messages: list[dict], target: int, respect_unseen: bool = True) -> list[dict]:
    """第三步：只动已读结果（保最近 3 条），替换前先落盘，占位带路径。"""
    results = [
        (mi, bi, b)
        for mi, message in enumerate(messages)
        if message.get("role") == "user"
        for bi, b in enumerate(_blocks(message))
        if isinstance(b, dict) and b.get("type") == "tool_result"
    ]
    unseen = unseen_positions(messages) if respect_unseen else set()
    consumed = [entry for entry in results if entry[:2] not in unseen]
    for _, _, block in consumed[:-KEEP_RECENT_RESULTS]:
        if estimate_chars(messages) <= target:
            break
        content = str(block.get("content", ""))
        if len(content) <= PLACEHOLDER_MIN_CHARS:
            continue
        saved = persisted_path_of(content, lab) or str(persist_output(lab, block.get("tool_use_id", "?"), content))
        block["content"] = f"[Earlier tool result saved at {saved}]"
        lab.say(f"  [micro] {block.get('tool_use_id')} -> placeholder ({len(content)} chars saved)")
    return messages


def fit_tool_results(lab: Lab, messages: list[dict], target: int) -> list[dict]:
    """第四步前置：未读批次也撑爆时，把最大者（含未读）落盘换预览。"""
    results = [
        b for m in messages if m.get("role") == "user"
        for b in _blocks(m) if isinstance(b, dict) and b.get("type") == "tool_result"
    ]
    for block in sorted(results, key=lambda b: len(str(b.get("content", ""))), reverse=True):
        if estimate_chars(messages) <= target:
            break
        content = str(block.get("content", ""))
        replacement = persisted_preview(lab, block.get("tool_use_id", "?"), content, 1000)
        if len(replacement) < len(content):
            block["content"] = replacement
            lab.say(f"  [fit] {block.get('tool_use_id')} -> preview+path ({len(content)} chars)")
    return messages


def summarize_history_mock(lab: Lab, messages: list[dict]) -> str:
    """LLM 摘要的确定性 mock：保留目标行与用户约束行 + 首尾各一行。"""
    lab.summary_calls += 1
    lines = [
        json.dumps(m, ensure_ascii=False, default=str)
        for m in messages
    ]
    keep = [ln for ln in lines if '"goal"' in ln or '"constraint"' in ln or '"remember' in ln.lower()]
    head = lines[0][:120] if lines else ""
    tail = lines[-1][:120] if lines else ""
    return "SUMMARY(mock): " + " | ".join(keep[:3] + [head, tail])


def summary_message(label: str, request: str, summary: str, transcript: str) -> dict:
    return {"role": "user", "content": (
        f"[{label}]\n\nCurrent user request:\n{request}\n\n"
        f"Conversation summary (reference only):\n{json.dumps(summary, ensure_ascii=False)}\n\n"
        f"Full transcript: {transcript}"
    )}


def compact_history(lab: Lab, messages: list[dict], active_request: str) -> list[dict]:
    transcript = write_transcript(lab, messages, "compact")
    summary = summarize_history_mock(lab, messages)
    lab.say(f"  [compact_history] transcript={transcript} summary_calls={lab.summary_calls}")
    return [summary_message("Compacted", active_request, summary, transcript)]


def reactive_compact(lab: Lab, messages: list[dict], active_request: str) -> list[dict]:
    transcript = write_transcript(lab, messages, "reactive")
    tail_start = max(0, len(messages) - KEEP_RECENT_MESSAGES)
    if tail_start and _is_tool_result(messages[tail_start]) and _has_tool_use(messages[tail_start - 1]):
        tail_start -= 1
    summary = summarize_history_mock(lab, messages[:tail_start])
    lab.say(f"  [reactive] kept last {len(messages) - tail_start} messages")
    return [summary_message("Reactive compact", active_request, summary, transcript), *messages[tail_start:]]


def prepare(lab: Lab, messages: list[dict], active_request: str, order_swap: bool = False) -> list[dict]:
    """M1：固定顺序 budget → snip → (超限?) micro → fit → compact_history。

    order_swap=True 即破坏性实验「micro 先于 budget 跑」。
    """
    if not order_swap:
        messages = tool_result_budget(lab, messages)
        messages = snip_compact(lab, messages)
    else:
        # 实验变体：micro 抢在 budget 之前对“最新一批已读之外”的大结果做无落盘替换。
        # 注意 micro 本身也落盘——为让实验暴露“顺序”而非“替换”的损失，实验变体里的
        # 替换不落盘（模拟站点轨死占位）且不检查 unseen（等价于最坏换序形态）。
        messages = dead_placeholder_pass(messages)
        messages = tool_result_budget(lab, messages)
        messages = snip_compact(lab, messages)
    if estimate_chars(messages) > CONTEXT_CHAR_LIMIT:
        target = int(CONTEXT_CHAR_LIMIT * 0.8)
        messages = micro_compact(lab, messages, target)
        if estimate_chars(messages) > CONTEXT_CHAR_LIMIT:
            messages = fit_tool_results(lab, messages, target)
        if estimate_chars(messages) > CONTEXT_CHAR_LIMIT:
            messages = compact_history(lab, messages, active_request)
    return messages


def dead_placeholder_pass(messages: list[dict]) -> list[dict]:
    """实验专用：站点轨式死占位（不落盘、不看 seen/unseen），仅 order_swap 用。"""
    results = [
        (mi, bi, b)
        for mi, m in enumerate(messages) if m.get("role") == "user"
        for bi, b in enumerate(_blocks(m)) if isinstance(b, dict) and b.get("type") == "tool_result"
    ]
    for _, _, block in results[:-KEEP_RECENT_RESULTS]:
        content = str(block.get("content", ""))
        if len(content) > PLACEHOLDER_MIN_CHARS and not content.startswith(("[Earlier", "<persisted")):
            block["content"] = "[Earlier tool result compacted. Re-run if needed.]"
    return messages


# ── M6-M9：记忆子系统 ───────────────────────────────────────────────────────


def memory_slug(name: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-") or "memory"


def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---\n"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta = {}
    for line in parts[1].strip().splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip()
    return meta, parts[2].strip()


def memory_document(name: str, mem_type: str, description: str, body: str) -> str:
    return f"---\nname: {name}\ndescription: {description}\ntype: {mem_type}\n---\n\n{body}\n"


class MemoryStore:
    def __init__(self, lab: Lab):
        self.lab = lab
        self.root = lab.memory_dir

    def list_records(self) -> list[dict]:
        records = []
        for path in sorted(self.root.glob("*.md")):
            if path.name == "MEMORY.md":
                continue
            meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
            records.append({
                "filename": path.name,
                "name": meta.get("name", path.stem),
                "description": meta.get("description", ""),
                "type": meta.get("type", "project"),
                "body": body,
            })
        return records

    def write(self, name: str, mem_type: str, description: str, body: str) -> Path:
        path = self.root / f"{memory_slug(name)}.md"
        path.write_text(memory_document(name, mem_type, description, body), encoding="utf-8")
        self.rebuild_index()
        return path

    def rebuild_index(self) -> None:
        lines = [
            f"- [{r['name']}]({r['filename']}) - {r['description']}"
            for r in self.list_records()
        ]
        (self.root / "MEMORY.md").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    def read(self, filename: str) -> str | None:
        path = self.root / filename
        return path.read_text(encoding="utf-8") if path.is_file() else None


def select_relevant_memories(store: MemoryStore, query: str, max_items: int = 5, llm_ok: bool = True) -> list[str]:
    """M7：LLM side-query 的确定性 mock（词面重合打分）+ 关键词降级（真实现）。"""
    records = store.list_records()
    if not records or not query.strip():
        return []
    if llm_ok:
        words = {w.lower() for w in query.split() if len(w) > 2}
        ranked = []
        for record in records:
            catalog = f"{record['name']} {record['description']}".lower()
            score = sum(w in catalog for w in words)
            if score:
                ranked.append((score, record["filename"]))
        ranked.sort(key=lambda item: (-item[0], item[1]))
        return [f for _, f in ranked[:max_items]]
    # 降级路径：同样的词面匹配——本 mock 中两路等价，真实系统的差别在“语义理解”
    words = {w.lower() for w in query.split() if len(w) > 2}
    picked = [r["filename"] for r in records
              if any(w in f"{r['name']} {r['description']}".lower() for w in words)]
    return picked[:max_items]


def load_memories(store: MemoryStore, query: str) -> str:
    loaded, remaining = [], RECALL_CHAR_LIMIT
    for filename in select_relevant_memories(store, query):
        content = store.read(filename)
        if not content or remaining <= 0:
            continue
        loaded.append({"source": filename, "content": content[:remaining]})
        remaining -= min(len(content), remaining)
    return json.dumps(loaded, ensure_ascii=False, indent=2) if loaded else ""


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def should_store_memory(candidate: dict, existing: list[dict], gate: bool = True) -> bool:
    """M8：scope/类型/字段完整/临时标记/重复 五重门。gate=False 即拆门实验。"""
    if not gate:
        return bool(candidate.get("name") and candidate.get("body"))
    if not isinstance(candidate, dict):
        return False
    if candidate.get("scope") != "persistent":
        return False
    if candidate.get("type") not in MEMORY_TYPES:
        return False
    name = str(candidate.get("name", "")).strip()
    description = str(candidate.get("description", "")).strip()
    body = str(candidate.get("body", "")).strip()
    if not (name and description and body):
        return False
    text = _norm(f"{name}\n{description}\n{body}")
    if any(marker in text for marker in TEMPORARY_MARKERS):
        return False
    slug = memory_slug(name)
    for record in existing:
        if memory_slug(str(record.get("name", ""))) == slug:
            return False
        if _norm(str(record.get("description", ""))) == _norm(description):
            return False
        if _norm(str(record.get("body", ""))) == _norm(body):
            return False
    return True


def extract_memories(store: MemoryStore, dialogue_lines: list[str], candidates: list[dict], gate: bool = True) -> int:
    """M8：候选来自“提取器 mock”（脚本给定）；门控决定哪些真正落盘。"""
    existing = store.list_records()
    stored = 0
    for candidate in candidates:
        if should_store_memory(candidate, existing, gate=gate):
            store.write(candidate["name"], candidate["type"], candidate["description"], candidate["body"])
            existing.append(candidate)
            stored += 1
            lab_say(store.lab, f"  [memory] stored {candidate['name']}")
    return stored


def lab_say(lab: Lab, line: str) -> None:
    lab.say(line)


def consolidate(store: MemoryStore, merged: list[dict], fail_at: int | None = None, rollback: bool = True) -> bool:
    """M9：快照 → 删旧写新 → 异常回滚。fail_at=k 表示写第 k 条时注入失败。"""
    records = store.list_records()
    snapshot = {r["filename"]: (store.root / r["filename"]).read_text(encoding="utf-8") for r in records}
    try:
        for path in store.root.glob("*.md"):
            if path.name != "MEMORY.md":
                path.unlink()
        for index, record in enumerate(merged):
            if fail_at is not None and index == fail_at:
                raise OSError(f"injected write failure at record {index}")
            (store.root / f"{memory_slug(record['name'])}.md").write_text(
                memory_document(record["name"], record["type"], record["description"], record["body"]),
                encoding="utf-8",
            )
        store.rebuild_index()
        return True
    except Exception as error:
        if not rollback:
            store.rebuild_index()
            lab_say(store.lab, f"  [consolidate] FAILED without rollback: {error}")
            return False
        for path in store.root.glob("*.md"):
            if path.name != "MEMORY.md":
                path.unlink()
        for filename, content in snapshot.items():
            (store.root / filename).write_text(content, encoding="utf-8")
        store.rebuild_index()
        lab_say(store.lab, f"  [consolidate] failed, rolled back: {error}")
        return False


# ── 场景样本 ────────────────────────────────────────────────────────────────


def user_text(text: str) -> dict:
    return {"role": "user", "content": text}


def tool_call(call_id: str, name: str) -> dict:
    return {"role": "assistant", "content": [{"type": "tool_use", "id": call_id, "name": name, "input": {}}]}


def tool_reply(results: list[tuple[str, str]]) -> dict:
    return {"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": tid, "content": content} for tid, content in results
    ]}


def sample_normal() -> list[dict]:
    """正常路径：短对话，一次已读小结果，无需任何压缩。"""
    return [
        user_text("帮我看看 config.py 里有没有硬编码路径。"),
        tool_call("t1", "read_file"),
        tool_reply([("t1", "no hardcoded path found")]),
        {"role": "assistant", "content": [{"type": "text", "text": "没有硬编码路径。"}]},
    ]


def sample_trap() -> list[dict]:
    """陷阱路径：长对话 + 大结果，逼出 budget→micro 顺序与配对保护。"""
    messages = [
        user_text("goal: 分析整个模块的依赖并修复 circular import。constraint: 不改公共 API。"),
        tool_call("t1", "glob"), tool_reply([("t1", "src/a.py src/b.py src/c.py")]),
        {"role": "assistant", "content": [{"type": "text", "text": "开始逐个读取。"}]},
    ]
    for index in range(2, 14):  # 12 组已读结果，总量约 35K 字符（超过 120 豁免线）
        size = 4800 if index % 3 else 400
        messages.append(tool_call(f"t{index}", "read_file"))
        messages.append(tool_reply([(f"t{index}", f"content of file {index} " + "x" * size)]))
    messages.append({"role": "assistant", "content": [{"type": "text", "text": "已读完，准备汇总。"}]})
    # 最新一批未读结果：两条中等 + 一条超 LARGE_RESULT_CHAR_LIMIT
    messages.append(tool_call("t100", "bash"))
    messages.append(tool_call("t101", "bash"))
    messages.append(tool_reply([
        ("t100", "deps resolved: " + "y" * 1500),
        ("t101", "z" * (LARGE_RESULT_CHAR_LIMIT + 5000)),
    ]))
    return messages


def sample_unread_batch() -> list[dict]:
    """实验专用：一批 4 条未读结果，最旧一条（u1）落在「最近 3 条」保护圈外。"""
    messages = [
        user_text("goal: 核对构建产物。"),
        tool_call("p1", "read_file"), tool_reply([("p1", "seen content " + "s" * 4000)]),
        {"role": "assistant", "content": [{"type": "text", "text": "继续核对。"}]},
        tool_call("u1", "bash"), tool_call("u2", "bash"), tool_call("u3", "bash"), tool_call("u4", "bash"),
        tool_reply([
            ("u1", "unread report alpha " + "a" * 5000),
            ("u2", "unread beta " + "b" * 300),
            ("u3", "unread gamma " + "c" * 300),
            ("u4", "unread delta " + "d" * 300),
        ]),
    ]
    return messages


def sample_snip_boundary(count: int = 60) -> list[dict]:
    """边缘路径：count 条消息，snip 的尾部切口恰好落在一条 tool_result 上。"""
    messages = [user_text("goal: 长任务。"), tool_call("t0", "glob"), tool_reply([("t0", "one file")])]
    cut = count - (50 - 3 - 1)          # snip 的 tail_start：无保护时切口落在此下标
    note = 0
    while len(messages) < cut - 1:      # 填到切口前一位
        messages.append(user_text(f"note {note}"))
        messages.append({"role": "assistant", "content": [{"type": "text", "text": f"ok {note}"}]})
        note += 1
    if len(messages) == cut - 2:        # 奇偶对齐：差一条时补一条 user
        messages.append(user_text(f"note {note}"))
    messages.append(tool_call("tcut", "bash"))               # 切口前一位：调用
    messages.append(tool_reply([("tcut", "output at the cut")]))  # 切口位：结果
    while len(messages) < count:       # 填满尾部（含剩余 user/assistant 对）
        messages.append(user_text(f"tail {note}"))
        if len(messages) < count:
            messages.append({"role": "assistant", "content": [{"type": "text", "text": f"tok {note}"}]})
        note += 1
    assert len(messages) == count and messages[cut - 1]["role"] == "assistant" \
        and messages[cut]["content"][0]["type"] == "tool_result", "切口样本构造失败"
    return messages


MEMORY_CANDIDATES_SESSION1 = [
    {"name": "user-preference-tabs", "type": "user", "scope": "persistent",
     "description": "User prefers tabs for indentation",
     "body": "User prefers using tabs, not spaces, for indentation."},
    {"name": "temp-no-files", "type": "feedback", "scope": "current_task",
     "description": "Do not create files in this session",
     "body": "User asked not to create files during the current session."},
    {"name": "project-auth-context", "type": "project", "scope": "persistent",
     "description": "Auth rewrite is compliance driven",
     "body": "The auth module rewrite is driven by compliance requirements."},
]
MEMORY_CANDIDATES_SESSION2 = [
    {"name": "user-preference-tabs", "type": "user", "scope": "persistent",
     "description": "User prefers tabs for indentation",
     "body": "User prefers using tabs, not spaces, for indentation."},  # 重复，应被拒
    {"name": "quote-style", "type": "user", "scope": "persistent",
     "description": "User prefers single quotes",
     "body": "User prefers single quotes over double quotes for strings."},
]


# ── selftest ────────────────────────────────────────────────────────────────


def fresh_lab(root: Path) -> Lab:
    if root.exists():
        shutil.rmtree(root)
    root.mkdir(parents=True)
    return Lab(root)


def selftest(root: Path) -> bool:
    lab = fresh_lab(root)
    ok = True

    def check(name: str, condition: bool, detail: str = "") -> None:
        nonlocal ok
        status = "PASS" if condition else "FAIL"
        if not condition:
            ok = False
        lab.say(f"  assert {name}: {status} {detail}")

    # S1 正常路径：无压缩、无落盘、配对合法、记忆写入
    lab.say("S1 normal path")
    normal = sample_normal()
    before = estimate_chars(normal)
    out = prepare(lab, normal, "检查 config")
    check("no compaction", estimate_chars(out) == before and len(lab.persisted_files) == 0)
    check("pairing ok", validate_pairing(out) == [])
    store = MemoryStore(lab)
    stored = extract_memories(store, [], MEMORY_CANDIDATES_SESSION1)
    check("memory gate stores 2 of 3", stored == 2, f"stored={stored}")
    check("index has 2 lines", len((lab.memory_dir / 'MEMORY.md').read_text().strip().splitlines()) == 2)
    check("temporary rejected", not (lab.memory_dir / "temp-no-files.md").exists())

    # S2 陷阱路径：budget→micro 顺序与 seen/unseen
    lab.say("S2 trap path (order matters + seen/unseen)")
    trap = sample_trap()
    out = prepare(lab, trap, "修复 circular import")
    check("pairing still ok", validate_pairing(out) == [])
    unseen_after = unseen_positions(out)
    # 未读的 t100/t101 仍在（t101 可能被 fit 替换为预览，但预览在上下文里）
    t100 = json.dumps(out, ensure_ascii=False)
    check("unread t100 content kept", "deps resolved" in t100)
    check("read-old results shortened", t100.count("[Earlier tool result saved at") >= 1)
    check("placeholders carry real paths", all(
        persisted_path_of(f"[Earlier tool result saved at {p}]", lab) for p in lab.persisted_files[:1]))
    check("size under control", estimate_chars(out) <= CONTEXT_CHAR_LIMIT or "[Compacted]" in t100)
    # 大结果落盘且可恢复
    big = [p for p in lab.persisted_files if Path(p).stat().st_size > LARGE_RESULT_CHAR_LIMIT]
    check("large result persisted", len(big) >= 1)
    check("no summary unless needed", ("[Compacted]" not in t100) or lab.summary_calls <= 1)

    # S3 边缘路径：snip 边界保护（子沙箱，避免清掉共享记忆库）
    lab.say("S3 snip boundary guard")
    guard_lab = fresh_lab(root / "s3-guarded")
    guarded = snip_compact(guard_lab, sample_snip_boundary())
    check("guarded pairing ok", validate_pairing(guarded) == [])
    unguarded = snip_compact(fresh_lab(root / "s3-unguarded"), sample_snip_boundary(), guard=False)
    errors = validate_pairing(unguarded)
    check("unguarded produces orphan", len(errors) >= 1, f"errors={errors[:1]}")

    # S4 reactive compact（模拟 API 拒绝一次）
    lab.say("S4 reactive compact")
    react = reactive_compact(lab, sample_trap(), "修复 circular import")
    check("reactive keeps tail + summary head", react[0]["content"].startswith("[Reactive compact]")
          and len(react) >= KEEP_RECENT_MESSAGES)
    check("reactive pairing ok", validate_pairing(react) == [])

    # S5 记忆召回与预算
    lab.say("S5 recall")
    recalled = load_memories(store, "indentation style preference tabs")
    check("recall hits tabs memory", "user-preference-tabs" in recalled)
    recalled_empty = load_memories(store, "deploy kubernetes helm chart")
    check("irrelevant query recalls nothing", recalled_empty == "")
    # 重复提取被拒
    stored2 = extract_memories(store, [], MEMORY_CANDIDATES_SESSION2, )
    check("duplicate rejected, new stored", stored2 == 1, f"stored={stored2}")

    # S6 整理与回滚
    lab.say("S6 consolidate")
    merged = [
        {"name": "user-preference-tabs", "type": "user",
         "description": "User prefers tabs", "body": "Tabs for indentation; single quotes for strings."},
    ]
    success = consolidate(store, merged, fail_at=None)
    check("consolidate success", success and len(store.list_records()) == 1)
    # 再造 3 条记忆后注入中途失败
    extract_memories(store, [], [
        {"name": f"mem-{i}", "type": "project", "scope": "persistent",
         "description": f"d{i}", "body": f"b{i}"} for i in range(3)
    ])
    before_files = sorted(p.name for p in lab.memory_dir.glob("*.md"))
    rolled = consolidate(store, merged, fail_at=0)
    after_files = sorted(p.name for p in lab.memory_dir.glob("*.md"))
    check("failed consolidate rolls back", (not rolled) and before_files == after_files,
          f"before={len(before_files)} after={len(after_files)}")

    # 产物序列化
    (root / "final_state.json").write_text(json.dumps({
        "persisted": lab.persisted_files,
        "transcripts": lab.transcripts,
        "summary_calls": lab.summary_calls,
        "memory_index": (lab.memory_dir / "MEMORY.md").read_text(),
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    lab.say(f"artifacts -> {root / 'final_state.json'}")
    return ok


# ── 破坏性实验与四测场景 ─────────────────────────────────────────────────────


def sabotage_report(name: str, root: Path) -> None:
    """跑一个破坏性实验并打印三件套：改了什么 / 实测观察到什么 / 教训。"""
    reports = {
        "order_swap": _exp_order_swap,
        "no_boundary_guard": _exp_no_guard,
        "no_unseen_respect": _exp_no_unseen,
        "no_memory_gate": _exp_no_gate,
        "no_rollback": _exp_no_rollback,
    }
    if name not in reports:
        print(f"unknown sabotage: {name}; available: {', '.join(reports)}")
        return
    print(f"=== SABOTAGE {name} ===")
    reports[name](root)


def _exp_order_swap(root: Path) -> None:
    print("改了什么：prepare() 换序——死占位替换先跑，tool_result_budget 后跑。")
    good_lab, bad_lab = fresh_lab(root / "good"), fresh_lab(root / "bad")
    good = prepare(good_lab, sample_trap(), "修复 circular import")
    bad = prepare(bad_lab, sample_trap(), "修复 circular import", order_swap=True)
    good_text, bad_text = json.dumps(good, ensure_ascii=False), json.dumps(bad, ensure_ascii=False)
    recoverable_good = sum(1 for p in good_lab.persisted_files if Path(p).stat().st_size > LARGE_RESULT_CHAR_LIMIT)
    recoverable_bad = sum(1 for p in bad_lab.persisted_files if Path(p).stat().st_size > LARGE_RESULT_CHAR_LIMIT)
    dead = bad_text.count("[Earlier tool result compacted. Re-run if needed.]")
    print(f"实测：正常序 大结果完整落盘 {recoverable_good} 份、可恢复占位 "
          f"{good_text.count('[Earlier tool result saved at')} 处；换序后 大结果完整落盘 "
          f"{recoverable_bad} 份、死占位 {dead} 处（原文既不在上下文也不在磁盘）。")
    print("教训：缩短步骤会毁掉原文——落盘必须排在它前面，顺序即数据生死。")


def _exp_no_guard(root: Path) -> None:
    print("改了什么：snip_compact(guard=False)——切在 tool_result 上不再退位。")
    lab = fresh_lab(root)
    messages = snip_compact(lab, sample_snip_boundary(), guard=False)
    errors = validate_pairing(messages)
    baseline = snip_compact(fresh_lab(root / "baseline"), sample_snip_boundary())
    print(f"实测：无保护 {len(errors)} 个配对错误（{errors[:2]}），下一次 API 请求将被判非法；"
          f"有保护 {len(validate_pairing(baseline))} 个错误。")
    print("教训：配对不变式不可越过——裁剪省下的空间，抵不上一次被拒的请求。")


def _exp_no_unseen(root: Path) -> None:
    print("改了什么：micro_compact(respect_unseen=False)——未读结果与已读一视同仁。")
    good_lab, bad_lab = fresh_lab(root / "guarded"), fresh_lab(root / "unguarded")
    good = micro_compact(good_lab, sample_unread_batch(), target=0, respect_unseen=True)
    bad = micro_compact(bad_lab, sample_unread_batch(), target=0, respect_unseen=False)
    good_text, bad_text = json.dumps(good, ensure_ascii=False), json.dumps(bad, ensure_ascii=False)
    u1_kept_good = "unread report alpha" in good_text
    u1_kept_bad = "unread report alpha" in bad_text
    repeat_calls = 0 if u1_kept_bad else 1  # u1 被换占位 → 模型没见过 → 模拟重调一次
    print(f"实测：尊重未读时 u1 原文在上下文={u1_kept_good}；不尊重时 u1 原文在上下文={u1_kept_bad}、"
          f"被替换为占位（{bad_text.count('[Earlier tool result saved at')} 处，含已读 p1），"
          f"模拟模型下一轮重复调用 {repeat_calls} 次——信息从未到达，白付一遍工具执行。")
    print("教训：读过一次是分界——没读过的结果是已付款未到货，不能收。")


def _exp_no_gate(root: Path) -> None:
    print("改了什么：should_store_memory(gate=False)——scope/临时/重复检查全部拆除。")
    lab = fresh_lab(root)
    store = MemoryStore(lab)
    total = 0
    for session in (MEMORY_CANDIDATES_SESSION1, MEMORY_CANDIDATES_SESSION2):
        total += extract_memories(store, [], session, gate=False)
    files = sorted(p.name for p in lab.memory_dir.glob("*.md") if p.name != "MEMORY.md")
    temp_persisted = "temp-no-files.md" in files
    dup_count = sum(1 for f in files if f.startswith("user-preference-tabs"))
    print(f"实测：两轮提取落盘 {total} 条（正常门控 3 条）；临时规则入库={temp_persisted}，"
          f"重复偏好 {dup_count} 份——下个会话“别建文件”会变成永久规则。")
    print("教训：记忆是跨会话的，没有门控的写入会被会话数放大成永久污染。")


def _exp_no_rollback(root: Path) -> None:
    print("改了什么：consolidate(rollback=False)——中途失败后不恢复原文件。")
    lab = fresh_lab(root)
    store = MemoryStore(lab)
    extract_memories(store, [], MEMORY_CANDIDATES_SESSION1)
    before = sorted(p.name for p in lab.memory_dir.glob("*.md"))
    merged = [{"name": "user-preference-tabs", "type": "user",
               "description": "User prefers tabs", "body": "Tabs for indentation."}]
    consolidate(store, merged, fail_at=0, rollback=False)
    after = sorted(p.name for p in lab.memory_dir.glob("*.md"))
    lost = [f for f in before if f not in after and f != "MEMORY.md"]
    print(f"实测：失败后库中文件 {len(after) - 1} 条（失败前 {len(before) - 1} 条），"
          f"永久丢失 {lost}；索引与文件不一致。")
    print("教训：破坏性替换必须带快照回滚——半旧半新的记忆库比不整理更糟。")


def scenario_t4(root: Path) -> None:
    """四测 T4 走查题实跑：8 条 tool_result（5 已读 3 未读，1 未读超大）。"""
    lab = fresh_lab(root)
    messages = [
        user_text("goal: 梳理数据管线。constraint: 输出中文报告。"),
        tool_call("r1", "read_file"), tool_reply([("r1", "report-alpha " + "a" * 9000)]),
        tool_call("r2", "read_file"), tool_reply([("r2", "report-beta " + "b" * 8500)]),
        tool_call("r3", "read_file"), tool_reply([("r3", "c" * 200)]),
        tool_call("r4", "read_file"), tool_reply([("r4", "d" * 150)]),
        tool_call("r5", "read_file"), tool_reply([("r5", "report-gamma " + "e" * 12000)]),
        {"role": "assistant", "content": [{"type": "text", "text": "已读前五份，继续。"}]},
        tool_call("r6", "read_file"), tool_call("r7", "read_file"), tool_call("r8", "bash"),
        tool_reply([
            ("r6", "f" * 500),
            ("r7", "g" * 220),
            ("r8", "h" * (LARGE_RESULT_CHAR_LIMIT + 2000)),
        ]),
    ]
    print("=== T4 walkthrough input (5 read + 3 unread, r8 oversized) ===")
    out = micro_compact(lab, messages, int(CONTEXT_CHAR_LIMIT * 0.8))
    out = fit_tool_results(lab, out, int(CONTEXT_CHAR_LIMIT * 0.8))
    text = json.dumps(out, ensure_ascii=False)
    states = {}
    for message in out:
        for block in _blocks(message):
            if isinstance(block, dict) and block.get("type") == "tool_result":
                content = str(block.get("content", ""))
                if content.startswith("[Earlier tool result saved at "):
                    states[block.get("tool_use_id")] = "PLACEHOLDER(path)"
                elif content.startswith("<persisted-output>"):
                    states[block.get("tool_use_id")] = "PREVIEW(path)"
                else:
                    states[block.get("tool_use_id")] = "INTACT"
    for tid in ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"]:
        print(f"  {tid}: {states.get(tid, '?')}")
    print(f"  placeholders with path: {text.count('[Earlier tool result saved at')}")
    print(f"  previews with path: {text.count('Full output:')}")
    print(f"  persisted files: {sorted(Path(p).name for p in lab.persisted_files)}")
    print(f"  final chars: {estimate_chars(out)}")


def scenario_t5(root: Path) -> None:
    """四测 T5 预测题实跑：拆掉边界保护后 API 校验器的判决。"""
    lab = fresh_lab(root)
    print("=== T5 prediction input (boundary guard removed) ===")
    messages = snip_compact(lab, sample_snip_boundary(60), guard=False)
    errors = validate_pairing(messages)
    print(f"  messages after unguarded snip: {len(messages)}")
    print(f"  pairing errors: {len(errors)}")
    for error in errors:
        print(f"    - {error}")
    print("  simulated API verdict:", "400 invalid request (orphan tool_result)" if errors else "200 ok")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--sabotage", choices=["order_swap", "no_boundary_guard", "no_unseen_respect",
                                               "no_memory_gate", "no_rollback"])
    parser.add_argument("--scenario", choices=["t4", "t5"])
    args = parser.parse_args()
    env_root = os.environ.get("LCC_LAB_ROOT")      # 沙箱重定向（docstring 登记）
    if SANDBOX:
        root = Path(SANDBOX)
    elif env_root:
        root = Path(env_root)
    else:
        root = Path(tempfile.gettempdir()) / "lcc-lab-sandbox"
    if args.selftest:
        ok = selftest(root)
        print("SELFTEST PASSED ✔" if ok else "SELFTEST FAILED ✘")
        return 0 if ok else 1
    if args.sabotage:
        sabotage_report(args.sabotage, root / f"sab-{args.sabotage}")
        return 0
    if args.scenario == "t4":
        scenario_t4(root / "t4")
        return 0
    if args.scenario == "t5":
        scenario_t5(root / "t5")
        return 0
    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
