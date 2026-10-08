#!/usr/bin/env python3
"""lcc_tooling_lab.py — Learn Claude Code「工具与执行」四机制教学原型（s01–s04）。

本原型验证机制自洽，不验证模型能力：LLM 全部用脚本化序列替代（确定性，
同一命令永远同一日志）。虚拟文件系统在内存中，无真实 shell、无网络。

四机制与材料对应（站点轨 fix 67a9126c 的 s01–s04 code.py）：
  1. agent_loop        s01 主循环：判据可切换（blocks=生产/CC 口径，stop_reason=站点轨教学口径）
  2. TOOL_HANDLERS     s02 工具分发：查表 + safe_path + tool_use_id 配对
  3. 三道闸门          s03 权限：硬拒绝 → 规则匹配 → 用户审批（脚本化答案）
  4. HOOKS 注册表      s04 钩子：UserPromptSubmit/PreToolUse/PostToolUse/Stop
另附 partition_tool_calls（CC 附录的连续块并发分批算法）供 selftest 演示。

运行：python3 lcc_tooling_lab.py --selftest   （实验沙箱在 /tmp 下独立目录，每次运行前重建）
"""

import json
import sys
import tempfile
from pathlib import Path

# ── 虚拟工作区（内存 FS；"/" 即工作区根，".." 之外即越界）────────────────────
WORKDIR = Path("/ws")

DENY_LIST = ["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if=", "> /dev/sda"]
DESTRUCTIVE_KW = ["rm ", "> /etc/", "chmod 777"]
CONCURRENCY_SAFE = {  # 工具/输入 → 是否并发安全（CC 附录口径的教学映射）
    "read_file": True, "write_file": False, "edit_file": False,
    "glob": True, "bash:read": True, "bash:write": False,
}


def bash_kind(command: str) -> str:
    return "bash:write" if any(kw in command for kw in DESTRUCTIVE_KW) else "bash:read"


def is_concurrency_safe(name: str, input_: dict) -> bool:
    if name == "bash":
        return CONCURRENCY_SAFE[bash_kind(input_.get("command", ""))]
    return CONCURRENCY_SAFE.get(name, False)


def partition_tool_calls(calls):
    """CC 附录口径：按原始顺序把连续的并发安全调用切成批；批内并发、批间串行。"""
    batches, current = [], []
    for name, input_ in calls:
        safe = is_concurrency_safe(name, input_)
        if not current:
            current = [(name, input_)]
        elif safe and is_concurrency_safe(*current[-1]):
            current.append((name, input_))          # 并发批内继续累加
        else:                                        # 不安全调用、或前一批是不安全单件
            batches.append(current); current = [(name, input_)]
    if current:
        batches.append(current)
    return batches


# ── 工具实现（操作内存 FS；bash 为 mock 命令集）────────────────────────────
class FS:
    def __init__(self, initial):
        self.files = dict(initial)
        self.outside = {}          # 越界写入落这里（正常应为空）
        self.wiped = False

    def path(self, p: str) -> Path:
        return (WORKDIR / p).resolve()

    def safe_path(self, p: str) -> Path:
        path = self.path(p)
        if not path.is_relative_to(WORKDIR):
            raise ValueError(f"Path escapes workspace: {p}")
        return path

    def read(self, p, limit=None):
        path = self.safe_path(p)
        if path not in self.files:
            return f"Error: file not found: {p}"
        text = self.files[path]
        return text if len(text) < 200 else text[:200] + "..."

    def write(self, p, content):
        path = self.safe_path(p)
        self.files[path] = content
        return f"Wrote {len(content)} bytes to {p}"

    def write_unsafe(self, p, content):   # 供「无权限层」实验：越界也能写
        path = self.path(p)
        target = self.files if path.is_relative_to(WORKDIR) else self.outside
        target[path] = content
        return f"Wrote {len(content)} bytes to {p}"

    def bash(self, command):
        if self.wiped:
            return "(no output)"
        if command.strip() == "rm -rf /":
            n = len(self.files); self.files.clear(); self.wiped = True
            return f"removed {n} files"
        for kw in ("rm ", "cat ", "ls", "echo "):
            if command.startswith(kw) or f" {kw}" in command:
                arg = command.strip().rsplit(" ", 1)[-1]
                if command.strip() == "ls":
                    return "\n".join(sorted(p.name for p in self.files))
                if command.strip().startswith("cat"):
                    return self.read(arg)
                if command.strip().startswith("rm"):
                    key = self.path(arg)
                    if key in self.files:
                        del self.files[key]; return f"removed {arg}"
                    return f"rm: {arg}: No such file"
                if command.strip().startswith("echo"):
                    return "(no output)"
        return f"mock-bash: unsupported command (real run would execute): {command}"


def run_read(fs, path, limit=None):   return fs.read(path)
def run_write(fs, path, content):     return fs.write_unsafe(path, content)
def run_bash(fs, command):            return fs.bash(command)
def run_glob(fs, pattern):
    hits = sorted(p.name for p in fs.files if p.match(pattern))
    return "\n".join(hits) if hits else "(no matches)"


# ── s03 三道闸门 ────────────────────────────────────────────────────────────
def check_deny_list(command):
    for pattern in DENY_LIST:
        if pattern in command:
            return f"Blocked: '{pattern}' is on the deny list"
    return None


def check_rules(tool_name, args, fs):
    if tool_name in ("read_file", "write_file", "edit_file"):
        try:
            fs.safe_path(args.get("path", ""))
        except ValueError:
            return "Access outside workspace"
    if tool_name == "bash":
        if any(kw in args.get("command", "") for kw in DESTRUCTIVE_KW):
            return "Potentially destructive command"
    return None


# ── s04 钩子注册表 ──────────────────────────────────────────────────────────
class Harness:
    """带开关的教学 harness：flag 组合即各破坏性实验的「改动」。

    criterion         blocks（生产/CC：看内容块）| stop_reason（站点轨教学：看字段）
    pairing           True=tool_result 按 tool_use_id 配对；False=同轮内错位绑定
    user_overrides_deny  True=闸门 3 用户放行后不再回查闸门 1（危险）
    permission_hook_on   False=注销 PreToolUse 权限回调（无闸门）
    respect_stop_force   False=忽略 Stop 钩子的续跑指令（收到即退出）
    """

    def __init__(self, fs, answers, criterion="blocks", pairing=True,
                 user_overrides_deny=False, permission_hook_on=True,
                 respect_stop_force=True, max_turns=20):
        self.fs, self.answers = fs, list(answers)
        self.criterion, self.pairing = criterion, pairing
        self.user_overrides_deny = user_overrides_deny
        self.permission_hook_on = permission_hook_on
        self.respect_stop_force = respect_stop_force
        self.max_turns = max_turns
        self.handlers = {"bash": run_bash, "read_file": run_read,
                         "write_file": run_write, "glob": run_glob}
        self.hooks = {"UserPromptSubmit": [], "PreToolUse": [],
                      "PostToolUse": [], "Stop": []}
        self.log, self.stats = [], {"asked": 0, "denied": 0, "executed": 0,
                                    "deny_listed_executed": 0, "stop_continued": 0,
                                    "pairing_errors": 0, "outside_writes": 0}
        self.register("PreToolUse", self._permission_hook)
        self.register("PreToolUse", self._log_hook)
        self.register("PostToolUse", self._large_output_hook)
        self.register("UserPromptSubmit", self._context_inject_hook)
        self.register("Stop", self._verify_hook)
        self._forced_once = False

    def register(self, event, cb):
        self.hooks[event].append(cb)

    def trigger(self, event, *args):
        for cb in self.hooks[event]:
            result = cb(*args)
            if result is not None:
                return result
        return None

    # — 钩子回调 —
    def _context_inject_hook(self, query):
        self.log.append(f"[HOOK] UserPromptSubmit: working in {WORKDIR}")

    def _log_hook(self, name, input_):
        self.log.append(f"[HOOK] {name}({list(input_.values())[:1]})")

    def _large_output_hook(self, name, output):
        if len(str(output)) > 500:
            self.log.append(f"[HOOK] Large output from {name}: {len(str(output))} chars")

    def _permission_hook(self, name, input_):
        """s03 三道闸门，包成 PreToolUse 回调（s04 形态）。"""
        if not self.permission_hook_on:
            return None
        if name == "bash":
            cmd = input_.get("command", "")
            if not self.user_overrides_deny:
                reason = check_deny_list(cmd)          # 闸门 1：硬拒绝
                if reason:
                    self.stats["denied"] += 1
                    return reason
            reason = check_rules(name, input_, self.fs)  # 闸门 2：规则
            if reason:
                decision = self._ask_user(name, input_, reason)  # 闸门 3：审批
                if decision == "deny":
                    self.stats["denied"] += 1
                    return "Permission denied by user"
                return None
            return None
        reason = check_rules(name, input_, self.fs)
        if reason:
            if self._ask_user(name, input_, reason) == "deny":
                self.stats["denied"] += 1
                return "Permission denied by user"
        return None

    def _ask_user(self, name, input_, reason):
        self.stats["asked"] += 1
        answer = self.answers.pop(0) if self.answers else "n"
        self.log.append(f"[ASK] {reason} | {name}({input_}) -> {answer}")
        return "allow" if answer in ("y", "yes") else "deny"

    def _verify_hook(self, messages):
        count = sum(1 for m in messages for b in (m["content"] if isinstance(m["content"], list) else [])
                    if isinstance(b, dict) and b.get("type") == "tool_result")
        self.log.append(f"[HOOK] Stop: session used {count} tool results")
        if not self._forced_once:
            self._forced_once = True
            self.stats["stop_continued"] += 1
            return "还没：请把 data.txt 再读一遍核对"
        return None

    # — 工具执行 —
    def execute(self, call):
        handler = self.handlers.get(call["name"])
        if handler is None:
            return f"Unknown tool: {call['name']}"
        if call["name"] == "bash" and check_deny_list(call["input"].get("command", "")):
            self.stats["deny_listed_executed"] += 1  # 硬拒绝名单命令实际落地（无论路径）
        out = handler(self.fs, **call["input"])
        if call["name"] == "write_file" and ".." in call["input"].get("path", ""):
            if not self.permission_hook_on:
                self.stats["outside_writes"] += 1
        return out

    # — s01 主循环 —
    def agent_loop(self, messages, script):
        transcript, turn = [], 0
        self.trigger("UserPromptSubmit", messages[0]["content"])
        while turn < len(script) and len(transcript) < self.max_turns:
            resp = script[turn]; turn += 1
            messages.append({"role": "assistant", "content": resp["content"]})
            transcript.append({"turn": turn, "blocks": [b["type"] for b in resp["content"]],
                               "stop_reason": resp["stop_reason"]})
            calls = [b for b in resp["content"] if b["type"] == "tool_use"]
            # 循环判据：blocks=看内容块（CC/needsFollowUp）；stop_reason=看字段（教学）
            proceed = bool(calls) if self.criterion == "blocks" \
                else resp["stop_reason"] == "tool_use"
            if not proceed:
                force = None
                if self.respect_stop_force:
                    force = self.trigger("Stop", messages)
                if force:
                    messages.append({"role": "user", "content": force})
                    transcript[-1]["stop_forced"] = True
                    continue
                transcript[-1]["exited"] = True
                return transcript, messages, turn
            results = []
            for call in calls:
                blocked = self.trigger("PreToolUse", call["name"], call["input"])
                if blocked is not None:
                    results.append({"type": "tool_result", "tool_use_id": call["id"],
                                    "content": f"Permission denied. ({blocked})"})
                    continue
                output = self.execute(call)
                self.stats["executed"] += 1
                self.trigger("PostToolUse", call["name"], output)
                results.append({"type": "tool_result", "tool_use_id": call["id"],
                                "content": output})
            if not self.pairing and len(results) > 1:   # 破坏性实验：同轮内旋转错绑
                ids = [r["tool_use_id"] for r in results]
                for r, shifted in zip(results, ids[1:] + ids[:1]):
                    if r["tool_use_id"] != shifted:
                        r["tool_use_id"], self.stats["pairing_errors"] = shifted, \
                            self.stats["pairing_errors"] + 1
            messages.append({"role": "user", "content": results})
        return transcript, messages, turn


# ── 脚本化「模型」（确定性）────────────────────────────────────────────────
def base_script():
    def tu(i, name, **kw): return {"type": "tool_use", "id": f"t{i}", "name": name, "input": kw}
    return [
        {"content": [tu(1, "read_file", path="notes/todo.md"), tu(2, "read_file", path="data.txt")],
         "stop_reason": "tool_use"},                                   # 多工具·正常
        {"content": [tu(3, "write_file", path="data.txt", content="apple\nbanana\ncherry")],
         "stop_reason": "tool_use"},                                   # 正常写
        {"content": [tu(4, "bash", command="sudo rm tmp.log")],
         "stop_reason": "tool_use"},                                   # 硬拒绝（sudo）
        {"content": [tu(5, "bash", command="rm tmp.log")],
         "stop_reason": "tool_use"},                                   # 规则命中→审批 y
        {"content": [tu(6, "write_file", path="../escape.txt", content="leak")],
         "stop_reason": "tool_use"},                                   # 越界写→审批 n
        {"content": [tu(7, "write_file", path="notes/escape.txt", content="ok")],
         "stop_reason": "tool_use"},                                   # 自纠：写回区内
        {"content": [tu(8, "read_file", path="data.txt")],
         "stop_reason": "end_turn"},                                   # 流式滞后轮：块到、字段未到
        {"content": [{"type": "text", "text": "Done."}],
         "stop_reason": "end_turn"},                                   # 首次停→Stop 强制续跑
        {"content": [tu(9, "read_file", path="data.txt")],
         "stop_reason": "tool_use"},                                   # 核对读
        {"content": [{"type": "text", "text": "核对完成。"}],
         "stop_reason": "end_turn"},                                   # 二次停→退出
    ]


INITIAL_FS = {WORKDIR / "data.txt": "apple\nbanana",
              WORKDIR / "notes/todo.md": "- buy milk",
              WORKDIR / "tmp.log": "junk"}


def run_episode(label, answers=None, **flags):
    fs = FS(INITIAL_FS)
    h = Harness(fs, answers=answers or ["y", "n"], **flags)
    transcript, messages, turns = h.agent_loop(
        [{"role": "user", "content": "记账并清理临时文件"}], base_script())
    checks = {
        "data.txt 更新": fs.files.get(WORKDIR / "data.txt") == "apple\nbanana\ncherry",
        "tmp.log 已删": WORKDIR / "tmp.log" not in fs.files,
        "notes/escape.txt 已写": fs.files.get(WORKDIR / "notes/escape.txt") == "ok",
        "越界写入为 0": len(fs.outside) == 0,
        "核对步骤已执行": turns >= 9,
    }
    return {"label": label, "turns": turns, "stats": h.stats, "checks": checks,
            "log": h.log, "transcript": transcript, "fs": fs, "messages": messages}


def show(ep):
    ok = sum(ep["checks"].values())
    print(f"== {ep['label']} ==")
    print(f"turns {ep['turns']}/10 · executed {ep['stats']['executed']} · denied {ep['stats']['denied']}"
          f" · asked {ep['stats']['asked']} · pairing_errors {ep['stats']['pairing_errors']}"
          f" · deny_listed_executed {ep['stats']['deny_listed_executed']}"
          f" · outside_writes {ep['stats']['outside_writes']}"
          f" · stop_continued {ep['stats']['stop_continued']} · checkpoints {ok}/5")


SELFTEST_PATH = Path(tempfile.gettempdir()) / "lcc-tooling-lab-sandbox"


def selftest():
    if SELFTEST_PATH.exists():
        for p in SELFTEST_PATH.iterdir():
            p.unlink()
    else:
        SELFTEST_PATH.mkdir(parents=True)

    # 0) partition_tool_calls（CC 附录算法）
    calls = [("read_file", {}), ("read_file", {}), ("glob", {}), ("bash", {"command": "rm x"}),
             ("read_file", {})]
    batches = partition_tool_calls(calls)
    assert [(len(b), ("bash" in b[0][0])) for b in batches] == [(3, False), (1, True), (1, False)]
    print(f"partition_tool_calls: {[ [n for n, _ in b] for b in batches ]}")

    # 1) 基线全绿
    base = run_episode("基线（四机制齐备）")
    show(base)
    assert base["turns"] == 10
    assert base["stats"] == {"asked": 2, "denied": 2, "executed": 7, "deny_listed_executed": 0,
                            "stop_continued": 1, "pairing_errors": 0, "outside_writes": 0}
    assert all(base["checks"].values())
    for line in base["log"]:
        print("  " + line)

    # 2) 破坏性实验（每次只动一个开关）
    exps = [
        ("实验 1：判据改回 stop_reason 字段（站点轨教学口径）",
         dict(criterion="stop_reason"),
         lambda e: (e["turns"], e["stats"]["executed"])),
        ("实验 2：拔掉 tool_use_id 配对（同轮旋转错绑）",
         dict(pairing=False),
         lambda e: e["stats"]["pairing_errors"]),
        ("实验 3：用户放行压过硬拒绝（闸门 3 短路闸门 1）",
         dict(user_overrides_deny=True, answers=["y", "y", "n"]),
         lambda e: e["stats"]["deny_listed_executed"]),
        ("实验 4：注销 PreToolUse 权限回调（无闸门）",
         dict(permission_hook_on=False),
         lambda e: (e["stats"]["outside_writes"], e["stats"]["asked"])),
        ("实验 5：忽略 Stop 钩子续跑指令",
         dict(respect_stop_force=False),
         lambda e: (e["turns"], e["stats"]["stop_continued"])),
    ]
    results = {}
    for label, flags, metric in exps:
        ep = run_episode(label, **flags)
        show(ep)
        results[label] = metric(ep)

    # 3) 实测退化断言（客观退化数据，非纸面推演）
    e1, e2, e3, e4, e5 = results.values()
    assert e1 == (8, 5), e1            # 退出提前 2 轮；2 个已请求的工具调用被静默丢弃
    assert e2 == 2, e2                  # 双调用轮 2 个结果全部错绑
    assert e3 == 1, e3                  # 硬拒绝命令（sudo …）被执行 1 次
    assert e4 == (1, 0), e4             # 越界写入 1 次；用户被问 0 次（基线 2 次）
    assert e5 == (8, 0), e5             # 核对轮未执行；续跑 0 次
    print("实验退化指标：", {k.split("：")[0]: v for k, v in results.items()})

    (SELFTEST_PATH / "baseline-transcript.json").write_text(
        json.dumps([{k: v for k, v in ep.items() if k in ("turns", "stats", "checks", "transcript")}
                    for ep in [base]], ensure_ascii=False, indent=2))
    print(f"SELFTEST PASSED ✔（沙箱产物：{SELFTEST_PATH}/baseline-transcript.json）")


def t5_scenario():
    """四测 T5 预测题实跑：Stop 钩子第一次返回题面原文，之后返回 None。"""
    fs = FS(INITIAL_FS)
    h = Harness(fs, answers=["y", "n"])
    h.hooks["Stop"] = []                      # 换成题面指定的钩子
    state = {"forced": False}
    def t5_hook(messages):
        count = sum(1 for m in messages for b in (m["content"] if isinstance(m["content"], list) else [])
                    if isinstance(b, dict) and b.get("type") == "tool_result")
        print(f"[HOOK] Stop: session used {count} tool results")
        if not state["forced"]:
            state["forced"] = True
            return "请把刚才创建的文件再读一遍确认"
        return None
    h.register("Stop", t5_hook)
    transcript, messages, turns = h.agent_loop(
        [{"role": "user", "content": "记账并清理临时文件"}], base_script())
    print(f"turns {turns}/10 · stop_continued {h.stats['stop_continued'] + 1}")
    forced = [m for m in messages if m["content"] == "请把刚才创建的文件再读一遍确认"]
    print(f"注入的新消息条数: {len(forced)} · 角色: user")
    print("循环源码改动: 无（改的是 Stop 回调；agent_loop 只认 trigger 的返回值）")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    elif "--t5" in sys.argv:
        t5_scenario()
    else:
        print(__doc__)
