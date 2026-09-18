#!/usr/bin/env python3
"""cc_harness_lab.py —— Learn Claude Code 五层 harness 的最小可运行原型。

它回答的问题是「机制是否自洽」，不回答「模型是否聪明」：材料中由 LLM 承担的角色
（决定调什么工具、写摘要）全部替换为**确定性脚本**，因此同一条命令永远给出同一份
日志，实验可复现。

对照的一手材料：shareAI-lab/learn-claude-code @ f9e8b280（MIT）的
s01_agent_loop / s03_permission / s08_context_compact / s16_workflow_runtime。

用法：
    uv run --no-project python cc_harness_lab.py --selftest     # 全绿自证
    uv run --no-project python cc_harness_lab.py --break D2     # 单项破坏性实验
    uv run --no-project python cc_harness_lab.py --break all    # D1..D6 全跑
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

LAB = Path(__file__).resolve().parent / ".lab_out"

# ── 破坏性实验开关：默认全部为「完好」，每个实验只翻转其中一个 ──────────────────
@dataclass
class Switches:
    trust_stop_reason: bool = False   # D1 循环判据退回「信停止标记」
    compact_order_swapped: bool = False  # D2 micro-compact 抢在落盘之前
    pair_protection: bool = True      # D3 裁剪时保护 tool_use/tool_result 配对
    gate_order_correct: bool = True   # D4 硬拒绝表先于人工审批
    pipeline_has_barrier: bool = False  # D5 无屏障管道改成有屏障并行
    unseen_guard: bool = True         # D6 保护「模型还没看过」的结果不被压成占位符


SW = Switches()


# ── 0. 确定性 mock 模型 ────────────────────────────────────────────────────────
@dataclass
class Block:
    type: str
    name: str = ""
    input: dict = field(default_factory=dict)
    id: str = ""
    text: str = ""


@dataclass
class Response:
    content: list
    stop_reason: str


def scripted_model(turn: int) -> Response:
    """脚本化的模型回合。第 2 回合刻意模拟流式下的已知失真：内容块里**确实有**
    tool_use，stop_reason 却报 end_turn —— 这正是生产版不信任停止标记的原因。"""
    if turn == 0:
        return Response([Block("tool_use", "bash", {"command": "ls data"}, "t1")], "tool_use")
    if turn == 1:
        return Response([Block("tool_use", "bash", {"command": "rm -rf /"}, "t2")], "tool_use")
    if turn == 2:
        # 内容块里**确实有** tool_use，stop_reason 却报 end_turn
        return Response([Block("tool_use", "bash", {"command": "cat report"}, "t3")], "end_turn")
    if turn == 3:
        return Response([Block("text", text="完成。")], "end_turn")
    return Response([Block("text", text="(idle)")], "end_turn")


# ── 1. 执行层：一个循环 + 字典分发 + 三闸门 + 四事件 ──────────────────────────
TOOL_HANDLERS = {
    "bash": lambda command, **_: f"[bash] {command} -> ok",
    "read_file": lambda path, **_: f"[read] {path}",
}

DENY_LIST = ["rm -rf /", "sudo", "mkfs", "dd if="]
HOOKS: dict[str, list] = {"PreToolUse": [], "PostToolUse": [], "Stop": []}
TRACE: list[str] = []


def check_deny_list(command: str) -> str | None:
    for pattern in DENY_LIST:
        if pattern in command:
            return f"命中硬拒绝表：{pattern}"
    return None


def ask_user(_tool: str, _args: dict, reason: str, auto_yes: bool = True) -> str:
    """无人值守回放：把「用户点了同意」固定为 yes，用来暴露闸门顺序错误的后果。"""
    TRACE.append(f"ask_user({reason}) -> {'allow' if auto_yes else 'deny'}")
    return "allow" if auto_yes else "deny"


def check_permission(block: Block) -> bool:
    """三闸门。正确顺序：硬拒绝表 → 规则 → 人工审批。"""
    command = block.input.get("command", "")
    if SW.gate_order_correct:
        reason = check_deny_list(command)
        if reason:
            TRACE.append(f"blocked:{reason}")
            return False
        if "rm " in command:
            return ask_user(block.name, block.input, "疑似破坏性命令") == "allow"
        return True
    # D4：人工审批被提到最前，硬拒绝表沦为「用户没点同意时才生效」
    if "rm" in command:
        if ask_user(block.name, block.input, "疑似破坏性命令") == "allow":
            return True
    reason = check_deny_list(command)
    if reason:
        TRACE.append(f"blocked:{reason}")
        return False
    return True


def trigger_hooks(event: str, payload) -> str | None:
    for hook in HOOKS[event]:
        verdict = hook(payload)
        if verdict is not None:
            return verdict
    return None


def agent_loop(max_turns: int = 6) -> list:
    """s01 的循环骨架。判据是**内容块里有没有 tool_use**，不是 stop_reason。"""
    messages: list = []
    for turn in range(max_turns):
        response = scripted_model(turn)
        messages.append({"role": "assistant", "content": response.content})

        if SW.trust_stop_reason:
            has_work = response.stop_reason == "tool_use"       # D1
        else:
            has_work = any(b.type == "tool_use" for b in response.content)

        if not has_work:
            if trigger_hooks("Stop", messages) is None:
                return messages
            continue

        results = []
        for block in (b for b in response.content if b.type == "tool_use"):
            if trigger_hooks("PreToolUse", block) is not None:
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": "[denied by hook]"})
                continue
            output = TOOL_HANDLERS[block.name](**block.input)
            TRACE.append(f"ran:{block.input.get('command', block.name)}")
            results.append({"type": "tool_result", "tool_use_id": block.id,
                            "content": output})
        messages.append({"role": "user", "content": results})
    return messages


def permission_hook(block: Block) -> str | None:
    return None if check_permission(block) else "deny"


# ── 2. 记忆层：四级腾位，顺序不可换 ───────────────────────────────────────────
LARGE_RESULT_CHARS = 300      # 超过即落盘（材料同名常量按比例缩小）
BATCH_BUDGET_CHARS = 400
KEEP_RECENT_RESULTS = 2


def unseen_tool_result_positions(messages: list) -> set:
    """模型还没看过的结果（最后一条 assistant 之后新增的），不许被压成占位符。"""
    last_assistant = next((i for i in range(len(messages) - 1, -1, -1)
                           if messages[i].get("role") == "assistant"), -1)
    return {(mi, bi) for mi in range(last_assistant + 1, len(messages))
            if isinstance(messages[mi].get("content"), list)
            for bi, b in enumerate(messages[mi]["content"])
            if isinstance(b, dict) and b.get("type") == "tool_result"}


class Compactor:
    def __init__(self, root: Path):
        self.dir = root / "tool-results"
        self.dir.mkdir(parents=True, exist_ok=True)

    def persist_large_output(self, tool_use_id: str, output: str) -> str:
        if len(output) <= LARGE_RESULT_CHARS:
            return output
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", str(tool_use_id))[:60] or "unknown"
        path = self.dir / f"{safe}.txt"
        if not path.exists():
            path.write_text(output, encoding="utf-8")
        return f"<persisted-output>\nFull output: {path}\nPreview:\n{output[:40]}\n</persisted-output>"

    def tool_result_budget(self, messages: list) -> list:
        """第一级：把超大结果搬到磁盘，正文只留一个带路径的指针。"""
        if not messages or messages[-1].get("role") != "user":
            return messages
        blocks = [b for b in messages[-1]["content"]
                  if isinstance(b, dict) and b.get("type") == "tool_result"]
        total = sum(len(str(b.get("content", ""))) for b in blocks)
        for block in sorted(blocks, key=lambda b: len(str(b["content"])), reverse=True):
            if total <= BATCH_BUDGET_CHARS:
                break
            block["content"] = self.persist_large_output(block["tool_use_id"], str(block["content"]))
            total = sum(len(str(b.get("content", ""))) for b in blocks)
        return messages

    def micro_compact(self, messages: list) -> list:
        """第三级：已被模型看过的旧结果压成一行。**它只能保住已经落盘的那些**——
        指针是从第一级写下的 `Full output:` 行里捞出来的。"""
        entries = [(mi, bi, b) for mi, m in enumerate(messages)
                   if m.get("role") == "user" and isinstance(m.get("content"), list)
                   for bi, b in enumerate(m["content"])
                   if isinstance(b, dict) and b.get("type") == "tool_result"]
        unseen = unseen_tool_result_positions(messages) if SW.unseen_guard else set()
        consumed = [e for e in entries if e[:2] not in unseen]
        for _, _, block in consumed[:-KEEP_RECENT_RESULTS] if len(consumed) > KEEP_RECENT_RESULTS else []:
            content = str(block.get("content", ""))
            if len(content) <= 120:
                continue
            saved = next((line.removeprefix("Full output: ") for line in content.splitlines()
                          if line.startswith("Full output: ")), None)
            block["content"] = (f"[Earlier tool result saved at {saved}]" if saved
                                else "[Earlier tool result omitted.]")
        return messages

    @staticmethod
    def has_tool_use(message: dict) -> bool:
        return message.get("role") == "assistant" and any(
            getattr(b, "type", None) == "tool_use" for b in message.get("content", []))

    @staticmethod
    def is_tool_result(message: dict) -> bool:
        content = message.get("content")
        return message.get("role") == "user" and isinstance(content, list) and any(
            isinstance(b, dict) and b.get("type") == "tool_result" for b in content)

    def snip_compact(self, messages: list, max_messages: int = 6) -> list:
        """第二级：掐中段。硬约束——绝不能把 assistant(tool_use) 与紧随其后的
        user(tool_result) 拆散。"""
        if len(messages) <= max_messages:
            return messages
        head_end, tail_start = 2, len(messages) - (max_messages - 2)
        if SW.pair_protection:
            if self.has_tool_use(messages[head_end - 1]):
                while head_end < tail_start and self.is_tool_result(messages[head_end]):
                    head_end += 1
            if (tail_start > 0 and self.is_tool_result(messages[tail_start])
                    and self.has_tool_use(messages[tail_start - 1])):
                tail_start -= 1
        if head_end >= tail_start:
            return messages
        marker = {"role": "user", "content": f"[{tail_start - head_end} messages archived]"}
        return [*messages[:head_end], marker, *messages[tail_start:]]

    def prepare(self, messages: list) -> list:
        """固定管线。SW.compact_order_swapped 把三级提到一级之前。"""
        if SW.compact_order_swapped:
            return self.tool_result_budget(self.snip_compact(self.micro_compact(messages)))
        return self.micro_compact(self.snip_compact(self.tool_result_budget(messages)))


def pairs_intact(messages: list) -> bool:
    """结构校验：每个 assistant(tool_use) 之后必须紧跟它的 tool_result。"""
    for index, message in enumerate(messages):
        if Compactor.has_tool_use(message):
            nxt = messages[index + 1] if index + 1 < len(messages) else None
            if nxt is None or not Compactor.is_tool_result(nxt):
                return False
    return True


# ── 3. 时机层：后台任务 + 有屏障并行 vs 无屏障管道 ────────────────────────────
def background_notification(task_id: str, status: str, summary: str) -> dict:
    """后台完成事件不能复用 tool_use_id（一个 tool_use 只许有一个 tool_result），
    因此以独立的 XML 块随下一轮 user 消息浮现。"""
    return {"type": "text", "text":
            f"<task_notification><task_id>{task_id}</task_id>"
            f"<status>{status}</status><summary>{summary[:40]}</summary></task_notification>"}


def run_parallel(items: list, durations: dict) -> float:
    """有屏障：本阶段全部完成，才允许任何一项进入下一阶段。"""
    stages = len(next(iter(durations.values())))
    return sum(max(durations[item][stage] for item in items) for stage in range(stages))


def run_pipeline(items: list, durations: dict) -> float:
    """无屏障：每项独立走完自己的链路，A 可以在第 3 段而 B 还在第 1 段。"""
    return max(sum(durations[item]) for item in items)


def makespan(items: list, durations: dict) -> float:
    """简化前提：并发槽位数 ≥ 条目数，因此差异只来自屏障而非资源竞争。"""
    runner = run_parallel if SW.pipeline_has_barrier else run_pipeline
    return runner(items, durations)


# ── 4. 自证与破坏性实验 ───────────────────────────────────────────────────────
ITEMS = ["A", "B", "C"]
DURATIONS = {"A": (3.0, 1.0), "B": (1.0, 3.0), "C": (1.0, 1.0)}


def replay_turns(compactor: Compactor) -> list:
    """逐轮回放：每追加一批 tool_result 就跑一次压缩管线——真实 harness 正是
    每次 LLM 调用前都走同一条管线，而不是最后统一收拾一次。"""
    big = "X" * 500
    messages: list = [{"role": "user", "content": "开始"}]
    for index, command in enumerate(("ls", "cat big", "tail log"), start=1):
        tool_id = f"a{index}"
        messages.append({"role": "assistant",
                         "content": [Block("tool_use", "bash", {"command": command}, tool_id)]})
        messages.append({"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": tool_id, "content": big}]})
        messages = compactor.prepare(messages)

    # 最后一轮：模型一次发出三个工具调用，三份大结果**同一轮**到达。
    # 这是顺序纪律唯一真正吃紧的时刻——此前每批都各自在本轮落了盘。
    batch_ids = ("b1", "b2", "b3")
    messages.append({"role": "assistant", "content": [
        Block("tool_use", "bash", {"command": f"dump {i}"}, i) for i in batch_ids]})
    messages.append({"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": i, "content": big} for i in batch_ids]})
    return compactor.prepare(messages)


def reset(root: Path) -> Compactor:
    TRACE.clear()
    HOOKS["PreToolUse"] = [permission_hook]
    HOOKS["PostToolUse"], HOOKS["Stop"] = [], []
    if root.exists():
        shutil.rmtree(root)
    return Compactor(root)


def probe(root: Path) -> dict:
    """跑一遍三层，返回可断言的观测量。"""
    compactor = reset(root)
    agent_loop()
    messages = replay_turns(compactor)
    persisted = sorted(p.name for p in (root / "tool-results").glob("*.txt"))
    # 区分两种「变成占位符」：原文从未落盘（真·永久丢失） vs 已落盘但指针被抹掉
    omitted_ids = [b["tool_use_id"] for m in messages if isinstance(m.get("content"), list)
                   for b in m["content"] if isinstance(b, dict)
                   and str(b.get("content", "")) == "[Earlier tool result omitted.]"]
    on_disk = set(persisted)
    lost_forever = sum(1 for i in omitted_ids if f"{i}.txt" not in on_disk)
    pointer_lost = sum(1 for i in omitted_ids if f"{i}.txt" in on_disk)
    return {
        "ran_deny_listed": any("rm -rf /" in line for line in TRACE if line.startswith("ran:")),
        "ran_first_tool": any(line == "ran:ls data" for line in TRACE),
        "ran_late_tool": any(line == "ran:cat report" for line in TRACE),
        "persisted_files": persisted,
        "lost_forever": lost_forever,
        "pointer_lost": pointer_lost,
        "pairs_intact": pairs_intact(messages),
        "makespan": makespan(ITEMS, DURATIONS),
        "notify_reuses_id": "tool_use_id" in json.dumps(
            background_notification("bg_0001", "completed", "构建完成")),
    }


EXPERIMENTS = {
    "D1": ("循环判据退回「信 stop_reason」", {"trust_stop_reason": True}),
    "D2": ("压缩顺序调换：micro-compact 抢在落盘之前", {"compact_order_swapped": True}),
    "D3": ("关掉 tool_use/tool_result 配对保护", {"pair_protection": False}),
    "D4": ("权限闸门顺序倒置：人工审批先于硬拒绝表", {"gate_order_correct": False}),
    "D5": ("无屏障管道改成有屏障并行", {"pipeline_has_barrier": True}),
    "D6": ("两道保险同时失效：顺序调换 + 拔掉 unseen 守卫",
           {"compact_order_swapped": True, "unseen_guard": False}),
}


def selftest() -> int:
    base = probe(LAB)
    print("== 完好基线 ==")
    for key, value in base.items():
        print(f"  {key:18} = {value}")
    assert base["ran_first_tool"], "第一轮工具必须真的跑起来"
    assert base["ran_late_tool"], "停止标记失真的那一轮，工具仍必须被执行"
    assert not base["ran_deny_listed"], "硬拒绝表上的命令绝不能被执行"
    assert base["persisted_files"] == ["a1.txt", "a2.txt", "a3.txt", "b1.txt", "b2.txt", "b3.txt"], \
        f"六个超大结果都应落盘，实得 {base['persisted_files']}"
    assert base["lost_forever"] == 0, "完好路径不应出现原文永久丢失"
    assert base["pairs_intact"], "裁剪后配对必须完整"
    assert base["makespan"] == 4.0, f"无屏障管道应为 4.0，实得 {base['makespan']}"
    assert not base["notify_reuses_id"], "后台完成通知不得复用工具回执编号"
    print("\nSELFTEST PASSED ✔")
    return 0


def run_break(name: str) -> None:
    label, changes = EXPERIMENTS[name]
    base = probe(LAB / "base")
    for field_name, value in changes.items():
        setattr(SW, field_name, value)
    try:
        broken = probe(LAB / name)
    finally:
        for field_name in changes:
            setattr(SW, field_name, getattr(Switches(), field_name))
    print(f"\n== {name} · {label} ==")
    print("  改动：" + "；".join(f"Switches.{k} = {v}" for k, v in changes.items()))
    for key in base:
        if base[key] != broken[key]:
            print(f"  退化：{key}  {base[key]}  →  {broken[key]}")
    if all(base[k] == broken[k] for k in base):
        print("  （无可观测差异）")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--break", dest="brk", help="D1..D6 或 all")
    args = parser.parse_args()
    if args.brk:
        names = list(EXPERIMENTS) if args.brk == "all" else [args.brk]
        for name in names:
            run_break(name)
        return 0
    return selftest()


if __name__ == "__main__":
    sys.exit(main())
