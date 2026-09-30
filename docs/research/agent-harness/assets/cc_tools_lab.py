#!/usr/bin/env python3
"""cc_tools_lab.py — Learn Claude Code「工具与执行」（s01–s04）最小原型（纯标准库）。

配套笔记：docs/research/agent-harness/171-claude-code-tooling-execution.md §8。
对照材料：课程站点 learn.shareai.run/zh/s01–s04（2026-09-30 快照）+
shareAI-lab/learn-claude-code main @ ce8f9f18（MIT）。

它回答「机制是否自洽」，不回答「模型是否聪明」：LLM 角色全部用确定性
脚本化序列（MockModel）替代；bash 在虚拟文件系统（VFS）上模拟执行，
不触碰真实 shell。同一命令永远同一日志（无随机、无时间）。
运行产物写入当前目录 .lab_out/。

层级：s01 循环 → s02 查表分发 → s03 三闸门 → s04 钩子注册表。
用法：--selftest 全场景断言；--exp 1..5 破坏性实验；--pred t4/t5/gates 实跑。
"""
from __future__ import annotations

import json
import sys

WORKDIR = "/workspace"  # 虚拟工作区根

# --------- 虚拟文件系统 ---------
class VFS:
    def __init__(self, files: dict[str, str] | None = None):
        self.files = dict(files or {})

    def resolve(self, path: str) -> str:
        p = path if path.startswith("/") else f"{WORKDIR}/{path}"
        parts: list[str] = []
        for seg in p.split("/"):
            if seg in ("", "."):
                continue
            if seg == "..":
                if parts:
                    parts.pop()
                continue
            parts.append(seg)
        return "/" + "/".join(parts)

    def in_workspace(self, path: str) -> bool:
        return self.resolve(path) == WORKDIR or self.resolve(path).startswith(WORKDIR + "/")

    # ---- 教学版五个工具的 VFS 实现 ----
    def bash(self, command: str) -> str:
        # 只模拟教学场景需要的命令子集（材料即数据：不执行真实 shell）
        tokens = command.split()
        if tokens[:2] == ["rm", "-rf"]:
            target = tokens[2] if len(tokens) > 2 else "/"
            t = self.resolve(target)
            removed = [p for p in list(self.files) if p == t or t == "/" or p.startswith(t + "/")]
            for p in removed:
                del self.files[p]
            return f"removed {len(removed)} entries under {t}"
        if tokens[:1] == ["cat"]:
            f = self.resolve(tokens[1])
            return self.files.get(f, f"cat: {f}: No such file")
        if tokens[:1] == ["ls"]:
            prefix = self.resolve(tokens[1]) if len(tokens) > 1 else WORKDIR
            names = sorted({p.rsplit("/", 1)[-1] for p in self.files if p.startswith(prefix + "/") or p.startswith(prefix)})
            return "\n".join(names) if names else "(empty)"
        if tokens[:1] == ["chmod"]:
            return f"chmod: mode changed ({command})"
        return f"(simulated) {command}"

    def read(self, path: str, limit: int | None = None) -> str:
        f = self.resolve(path)
        if f not in self.files:
            return f"Error: [Errno 2] No such file: {f}"
        lines = self.files[f].splitlines()
        if limit is not None and limit < len(lines):
            lines = lines[:limit] + [f"... ({len(lines) - limit} more lines)"]
        return "\n".join(lines)

    def write(self, path: str, content: str) -> str:
        f = self.resolve(path)
        self.files[f] = content
        return f"Wrote {len(content)} bytes to {path}"

    def edit(self, path: str, old_text: str, new_text: str) -> str:
        f = self.resolve(path)
        if f not in self.files:
            return f"Error: [Errno 2] No such file: {f}"
        if old_text not in self.files[f]:
            return "Error: text not found"
        self.files[f] = self.files[f].replace(old_text, new_text, 1)
        return f"Edited {path}"

    def glob(self, pattern: str) -> str:
        import fnmatch
        suffix = pattern.lstrip("./")
        hits = sorted(p for p in self.files if fnmatch.fnmatch(p.rsplit("/", 1)[-1], suffix) or fnmatch.fnmatch(p, f"{WORKDIR}/{suffix}"))
        return "\n".join(hits) if hits else "(no matches)"


# --------- 确定性 mock 模型 ---------
def text_block(t): return {"type": "text", "text": t}
def tool(name, tid, **inp): return {"type": "tool_use", "id": tid, "name": name, "input": inp}

class MockModel:
    """按脚本逐轮出牌；stop_reason 可为 None 模拟流式迟到。"""
    def __init__(self, turns):
        self.turns = list(turns)
        self.i = 0

    def create(self, **_):
        turn = self.turns[min(self.i, len(self.turns) - 1)]
        self.i += 1
        return turn


# --------- s02：工具定义与查表分发 ---------
TOOLS = [
    {"name": "bash", "description": "Run a shell command."},
    {"name": "read_file", "description": "Read file contents."},
    {"name": "write_file", "description": "Write content to file."},
    {"name": "edit_file", "description": "Replace text in file once."},
    {"name": "glob", "description": "Find files by pattern."},
]

def make_handlers(vfs: VFS) -> dict:
    return {
        "bash": lambda command: vfs.bash(command),
        "read_file": lambda path, limit=None: vfs.read(path, limit),
        "write_file": lambda path, content: vfs.write(path, content),
        "edit_file": lambda path, old_text, new_text: vfs.edit(path, old_text, new_text),
        "glob": lambda pattern: vfs.glob(pattern),
    }


# --------- s03：三闸门 ---------
DENY_LIST = ["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if=", "> /dev/sda"]
RULE_KEYWORDS = ["rm ", "> /etc/", "chmod 777"]

def check_deny_list(command: str):
    for pat in DENY_LIST:
        if pat in command:
            return f"Blocked: '{pat}' is on the deny list"
    return None

def check_rules(tool_name: str, args: dict):
    if tool_name in ("write_file", "edit_file"):
        path = args.get("path", "")
        if not VFS._current.in_workspace(path):
            return "Writing outside workspace"
    if tool_name == "bash":
        if any(kw in args.get("command", "") for kw in RULE_KEYWORDS):
            return "Potentially destructive command"
    return None

def ask_user(reason: str, answers):
    a = answers.pop(0) if answers else "n"
    return f"[ask] {reason} -> user says {'ALLOW' if a == 'y' else 'DENY'}", a

def check_permission(block, answers, log):
    """站点教学版：闸门1 硬拒绝 -> 闸门2 规则 -> 闸门3 问用户。"""
    if block["name"] == "bash":
        reason = check_deny_list(block["input"].get("command", ""))
        if reason:
            log.append(f"GATE1 DENY  {reason}")
            return False
    reason = check_rules(block["name"], block["input"])
    if reason:
        msg, a = ask_user(reason, answers)
        log.append(f"GATE2->3 {msg}")
        if a != "y":
            return False
    return True


# --------- s04：钩子注册表 ---------
def make_hooks():
    return {"UserPromptSubmit": [], "PreToolUse": [], "PostToolUse": [], "Stop": []}

def register_hook(hooks, event, cb):
    hooks[event].append(cb)

def trigger_hooks(hooks, event, *args):
    for cb in hooks[event]:
        result = cb(*args)
        if result is not None:      # 非 None -> hook 说"停"（PreToolUse 阻止 / Stop 续跑）
            return result
    return None


# --------- s04 完整引擎（教学正本） ---------
def run_agent(vfs: VFS, model: MockModel, answers, log, hooks=None, messages=None,
              use_content_signal=True, hard_index=False, stop_hook_active_guard=True):
    """s04 版引擎。use_content_signal=False 改回 s01 判据；hard_index 硬索引（实验2）；
    stop_hook_active_guard 关掉 Stop 防循环标志（实验5）。"""
    hooks = hooks if hooks is not None else default_hooks(answers, log)
    handlers = make_handlers(vfs)
    messages = messages if messages is not None else []
    stop_hook_active = False
    turns = 0
    while True:
        turns += 1
        if turns > 50:
            log.append("!! turn cap 50 hit (runaway)")
            return messages
        resp = model.create(messages=messages, tools=TOOLS)
        messages.append({"role": "assistant", "content": resp["content"]})
        log.append(f"TURN {turns} stop_reason={resp['stop_reason']!r} blocks={[b['type'] for b in resp['content']]}")
        tool_calls = [b for b in resp["content"] if b["type"] == "tool_use"]
        want_more = bool(tool_calls) if use_content_signal else resp["stop_reason"] == "tool_use"
        if not want_more:
            force = trigger_hooks(hooks, "Stop", messages)
            if force and not (stop_hook_active and stop_hook_active_guard):
                log.append(f"STOP-HOOK force-continue{'' if not stop_hook_active else ' (guard: once)'}")
                messages.append({"role": "user", "content": force if isinstance(force, str) else str(force)})
                stop_hook_active = True
                continue
            if force and stop_hook_active and stop_hook_active_guard:
                log.append("STOP-HOOK force-continue blocked by stopHookActive guard -> real stop")
            log.append(f"STOP turns={turns}")
            return messages
        results = []
        for block in tool_calls:
            blocked = trigger_hooks(hooks, "PreToolUse", block)
            if blocked:
                results.append({"type": "tool_result", "tool_use_id": block["id"], "content": str(blocked)})
                continue
            if hard_index:
                output = handlers[block["name"]](**block["input"])      # 实验2：硬索引
            else:
                h = handlers.get(block["name"])
                output = h(**block["input"]) if h else f"Unknown: {block['name']}"
            trigger_hooks(hooks, "PostToolUse", block, output)
            results.append({"type": "tool_result", "tool_use_id": block["id"], "content": output})
        messages.append({"role": "user", "content": results})


def default_hooks(answers, log):
    hooks = make_hooks()

    def context_inject_hook(query):
        log.append("HOOK UserPromptSubmit: working in /workspace")
        return None

    def permission_hook(block):
        ok = check_permission(block, answers, log)
        return None if ok else "Permission denied."

    def log_hook(block):
        log.append(f"HOOK PreToolUse log: {block['name']}(...)")
        return None

    def large_output_hook(block, output):
        if len(str(output)) > 100000:
            log.append(f"HOOK PostToolUse: large output from {block['name']} ({len(str(output))} chars)")
        return None

    def summary_hook(messages):
        n = sum(1 for m in messages if isinstance(m.get("content"), list)
                for b in m["content"] if isinstance(b, dict) and b.get("type") == "tool_result")
        log.append(f"HOOK Stop: session used {n} tool calls")
        return None

    register_hook(hooks, "UserPromptSubmit", context_inject_hook)
    register_hook(hooks, "PreToolUse", permission_hook)
    register_hook(hooks, "PreToolUse", log_hook)
    register_hook(hooks, "PostToolUse", large_output_hook)
    register_hook(hooks, "Stop", summary_hook)
    return hooks


# --------- 场景与 selftest ---------
VFS._current = None  # type: ignore[assignment]

def scenario(log, answers=("y", "n", "y")):
    vfs = VFS({"/workspace/README.md": "nano claude-code-like agent harness\n",
               "/workspace/scratch/notes/a.txt": "old note",
               "/workspace/scratch/notes/b.txt": "older note"})
    VFS._current = vfs
    model = MockModel([
        {"content": [tool("write_file", "t1", path="report/summary.txt", content="quarter summary"),
                     tool("read_file", "t2", path="README.md")], "stop_reason": "tool_use"},
        {"content": [tool("bash", "t3", command="rm -rf ./scratch/notes"),
                     tool("bash", "t4", command="sudo ls /")], "stop_reason": "tool_use"},
        {"content": [text_block("整理完成：报告已写、README 已读、草稿已清、提权命令被拒。")],
         "stop_reason": "end_turn"},
    ])
    return vfs, model, list(answers)


def selftest():
    log: list[str] = []
    vfs, model, answers = scenario(log)
    messages = [{"role": "user", "content": "帮我整理工作区：写季度摘要、读 README、清掉 scratch 草稿。"}]
    run_agent(vfs, model, answers, log, messages=messages)
    out = "\n".join(log)
    print(out)
    import os; os.makedirs(".lab_out", exist_ok=True)
    # 断言：正常路径（写/读放行）、陷阱路径（sudo 拒绝）、边缘路径（rm 规则命中问用户且 y）
    assert any("GATE2->3" in l and "ALLOW" in l for l in log), "规则命中应问用户"
    assert any("GATE1 DENY" in l and "sudo" in l for l in log), "sudo 应被硬拒绝"
    assert "/workspace/report/summary.txt" in vfs.files, "工作区内写文件应执行"
    assert not any(p.startswith("/workspace/scratch/notes") for p in vfs.files), "用户同意后 rm 应执行"
    # 消息数组形态：user(问题) -> assistant -> user(tool_result) -> ... -> assistant(text)
    assert messages[0]["role"] == "user"
    kinds = [m["role"] for m in messages]
    assert kinds.count("assistant") == 3 and "user" in kinds
    tr = [b for m in messages if isinstance(m.get("content"), list) for b in m["content"]
          if isinstance(b, dict) and b.get("type") == "tool_result"]
    assert len(tr) == 4, f"应产生 4 条 tool_result，实际 {len(tr)}"
    denied = [b for b in tr if "Permission denied" in str(b["content"])]
    assert len(denied) == 1, "sudo 请求应得到被拒结果"
    assert any("STOP turns=3" in l for l in log), "三轮后正常停止"
    assert any("session used 4 tool calls" in l for l in log), "Stop 统计应为 4"
    # 确定性：再跑一遍日志一致
    log2: list[str] = []
    vfs2, model2, answers2 = scenario(log2)
    run_agent(vfs2, model2, answers2, log2, messages=[{"role": "user", "content": "帮我整理工作区：写季度摘要、读 README、清掉 scratch 草稿。"}])
    assert log2 == log, "两次运行日志应完全一致（确定性）"
    with open(".lab_out/messages.json", "w") as f:
        json.dump(messages, f, ensure_ascii=False, indent=1)
    print("SELFTEST PASSED ✔")


# --------- 破坏性实验 ---------
def exp1():
    """续轮判据分岔：流式 stop_reason 迟到（None）时，教学版判据提前退出。"""
    print("== 实验1：stop_reason 迟到时，两版判据的分岔 ==")
    for label, flag in (("s01 教学判据(只看 stop_reason)", False), ("生产判据(看内容块)", True)):
        log: list[str] = []
        vfs = VFS({"/workspace/todo.txt": "1\n2\n"})
        VFS._current = vfs
        model = MockModel([
            {"content": [tool("bash", "a", command="cat todo.txt")], "stop_reason": None},   # 流式：块已到、标记未到
            {"content": [tool("bash", "b", command="ls")], "stop_reason": None},
            {"content": [text_block("done")], "stop_reason": "end_turn"},
        ])
        msgs = run_agent(vfs, model, [], log, use_content_signal=flag)
        executed = sum(1 for m in msgs if isinstance(m.get("content"), list)
                       for b in m["content"] if isinstance(b, dict) and b.get("type") == "tool_result")
        print(f"[{label}] 实际执行工具数={executed}，消息数={len(msgs)}，日志尾: {log[-1]}")
        print(f"  逐轮: {'; '.join(log[:6])}")
    print("教训：用迟到的信号当判据，循环在第一轮就提前退出，任务半途而废。\n")


def exp2():
    """删 dispatch 表项 + 硬索引：KeyError 崩溃形态。"""
    print("== 实验2：TOOL_HANDLERS 拿掉 edit_file 且用硬索引 ==")
    log: list[str] = []
    vfs = VFS({"/workspace/draft.md": "v1"})
    VFS._current = vfs
    model = MockModel([
        {"content": [tool("edit_file", "e1", path="draft.md", old_text="v1", new_text="v2")], "stop_reason": "tool_use"},
        {"content": [text_block("done")], "stop_reason": "end_turn"},
    ])
    import sys
    M = sys.modules[__name__]
    orig = M.make_handlers
    M.make_handlers = lambda v: {k: f for k, f in orig(v).items() if k != "edit_file"}
    try:
        run_agent(vfs, model, [], log, hard_index=True)
    except KeyError as e:
        print(f"实测崩溃：KeyError: {e}（整轮 tool_result 未生成，对话中断在半途）")
    finally:
        M.make_handlers = orig
    print("对照：.get 软查表只会得到 'Unknown: edit_file' 并回喂模型自纠。")
    print("教训：查表的失败形态由取值方式决定——硬索引把「未知工具」升级成「整个程序停摆」。\n")


def exp3():
    """闸门顺序颠倒（规则先行、问用户 yes）：毁灭命令被放行。"""
    print("== 实验3：三闸门调序（规则→问用户 在前，硬拒绝殿后） ==")
    global check_permission
    orig = check_permission

    def reversed_gates(block, answers, log):
        reason = check_rules(block["name"], block["input"])          # 闸门2 提前
        if reason:
            msg, a = ask_user(reason, answers)
            log.append(f"GATE(reversed) {msg}")
            if a != "y":
                return False
            return True                                               # 用户同意即执行，不再看拒绝表
        if block["name"] == "bash":
            reason = check_deny_list(block["input"].get("command", ""))
            if reason:
                log.append(f"GATE1(reversed,too-late) {reason}")
                return False
        return True

    check_permission = reversed_gates
    log: list[str] = []
    vfs = VFS({"/workspace/a.txt": "x", "/workspace/b.txt": "y", "/workspace/c.txt": "z",
               "/etc/hosts": "127.0.0.1 localhost"})
    VFS._current = vfs
    before = len(vfs.files)
    model = MockModel([
        {"content": [tool("bash", "d1", command="rm -rf /")], "stop_reason": "tool_use"},
        {"content": [text_block("cleaned")], "stop_reason": "end_turn"},
    ])
    msgs = run_agent(vfs, model, ["y"], log)                          # 用户顺手按了 y
    check_permission = orig
    after = len(vfs.files)
    print(f"实测：命令含删除词->先问用户->用户按 y->执行。VFS 文件数 {before} -> {after}（{'全部被删' if after == 0 else '部分保留'}）")
    print(f"  日志: {'; '.join(log[:5])}")
    print("教训：硬拒绝必须最先——把它放到问用户之后，「永远不行」就被降级成「用户一句 y 就行」。\n")


def exp4():
    """hook 返回值语义反转：None 被当阻止。"""
    print("== 实验4：trigger_hooks 把 None 当'阻止' ==")
    def inverted_trigger(hooks, event, *args):
        for cb in hooks[event]:
            result = cb(*args)
            if result is None:
                return "BLOCKED-by-inverted-semantics"
        return None

    global trigger_hooks_ref
    log: list[str] = []
    vfs = VFS({"/workspace/x.txt": "1"})
    VFS._current = vfs
    model = MockModel([
        {"content": [tool("read_file", "r1", path="x.txt")], "stop_reason": "tool_use"},
        {"content": [text_block("done")], "stop_reason": "end_turn"},
    ])
    hooks = default_hooks([], log)
    import sys
    M = sys.modules[__name__]
    orig = M.trigger_hooks
    M.trigger_hooks = inverted_trigger
    try:
        msgs = run_agent(vfs, model, [], log, hooks=hooks)
    finally:
        M.trigger_hooks = orig
    blocked = sum(1 for m in msgs if isinstance(m.get("content"), list) for b in m["content"]
                  if isinstance(b, dict) and b.get("type") == "tool_result" and "BLOCKED" in str(b["content"]))
    print(f"实测：{blocked} 个工具请求全部被拦（本应放行的日常读取也进不来），消息数={len(msgs)}（Stop 钩子同样被反转语义劫持而无限续跑，直到 50 轮封顶）。")
    print("教训：'非 None 才喊停'是钩子的契约——语义反转后没有任何工具能执行，Agent 空转。\n")


def exp5():
    """拿掉 stopHookActive 防循环：报错式 Stop 钩子让循环永续。"""
    print("== 实验5：Stop 钩子总是要求续跑（模拟 stop hook 报错自纠循环） ==")
    for label, guard in (("无 stopHookActive 防护", False), ("有 stopHookActive 防护", True)):
        log: list[str] = []
        vfs = VFS({})
        VFS._current = vfs
        model = MockModel([
            {"content": [text_block("interim answer")], "stop_reason": "end_turn"},
        ] * 30)
        hooks = default_hooks([], log)
        hooks["Stop"] = [lambda messages: "stop hook errored; please self-correct"]  # 永远喊续
        msgs = run_agent(vfs, model, [], log, hooks=hooks, stop_hook_active_guard=guard)
        print(f"[{label}] 实际轮数={len(msgs)}（日志尾: {log[-1]}）")
    print("教训：续跑标志是停机权的最后一道闸——没有它，一个总在报错的 Stop 钩子让 Agent 永不停机。\n")


# --------- 预测题实跑 ---------
def pred_t4():
    """T4 同构走查：write_file(工作区内) + bash(rm -rf ./scratch/notes)。"""
    print("== T4 走查实跑 ==")
    log: list[str] = []
    vfs = VFS({"/workspace/scratch/notes/one.txt": "1", "/workspace/scratch/notes/two.txt": "2"})
    VFS._current = vfs
    model = MockModel([
        {"content": [tool("write_file", "w1", path="report/summary.txt", content="Q3 summary"),
                     tool("bash", "b1", command="rm -rf ./scratch/notes")], "stop_reason": "tool_use"},
        {"content": [text_block("done")], "stop_reason": "end_turn"},
    ])
    msgs = run_agent(vfs, model, ["y"], log)
    print("\n".join(log))
    print(f"VFS 终态: {sorted(vfs.files)}")
    return log


def pred_t5():
    """T5 预测：拒绝表删掉 sudo 后，sudo chmod 777 走哪条路。"""
    print("== T5 预测实跑（DENY_LIST 先删 sudo） ==")
    global DENY_LIST
    orig = list(DENY_LIST)
    DENY_LIST = [d for d in DENY_LIST if d != "sudo"]
    log: list[str] = []
    vfs = VFS({})
    VFS._current = vfs
    model = MockModel([
        {"content": [tool("bash", "c1", command="sudo chmod 777 /var/run/app")], "stop_reason": "tool_use"},
        {"content": [text_block("done")], "stop_reason": "end_turn"},
    ])
    msgs = run_agent(vfs, model, ["n"], log)  # 用户这次按 n
    DENY_LIST = orig
    print("\n".join(log))
    tr = [b for m in msgs if isinstance(m.get("content"), list) for b in m["content"]
          if isinstance(b, dict) and b.get("type") == "tool_result"]
    print(f"tool_result: {tr[0]['content']!r}")
    return log


def pred_gates():
    """§5 分路表五条命令逐条过闸（教学版三闸门语义实测）。"""
    print("== §5 分路表五条命令逐条过闸 ==")
    vfs = VFS({"/workspace/README.md": "x", "/tmp/cache": "y", "/workspace/tmp/build-cache": "z", "/etc/hosts": "h"})
    VFS._current = vfs
    for command in ["rm -rf /", "rm -rf /tmp/cache", "rm -rf ./tmp/build-cache", "sudo ls", "cat /etc/hosts"]:
        log: list[str] = []
        block = {"type": "tool_use", "id": "g", "name": "bash", "input": {"command": command}}
        ok = check_permission(block, ["y"], log)
        verdict = "拒绝" if not ok else ("问用户" if any("ask" in l for l in log) else "放行")
        gates = "; ".join(log) or "(三档均未命中)"
        print(f"{command!r:34} -> {verdict}   [{gates}]")


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "--selftest":
        selftest()
    elif cmd == "--exp":
        {"1": exp1, "2": exp2, "3": exp3, "4": exp4, "5": exp5}[sys.argv[2]]()
    elif cmd == "--pred":
        {"t4": pred_t4, "t5": pred_t5, "gates": pred_gates}[sys.argv[2].lower()]()
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
