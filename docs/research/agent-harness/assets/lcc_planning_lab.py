#!/usr/bin/env python3
"""lcc_planning_lab.py — Learn Claude Code「规划与协调」五章机制确定性原型。

对应精读笔记：docs/research/agent-harness/172-claude-code-planning-coordination.md

原型回答「机制是否自洽」，不回答「模型是否聪明」：材料里的 LLM 决策全部用
确定性 mock 替代。mock 模型的每轮决策是「当轮可见文本」的纯函数——只根据系统
提示 + 消息尾部（VISIBLE_TAIL 条）决定下一步；可见文本里没有的计划信息，它是
真的不知道。这正是五个装置起作用的机理本身。机制→实现单元速查见笔记「动手
实验室」。确定性：无系统随机源；抖动用固定种子 RNG；时间用虚拟时钟（不 sleep）。

用法：--selftest 全部机制+断言；--episode A..E 单机制实景；--experiment 1..5
破坏性实验（每次只拆一个）。
"""
from __future__ import annotations

import argparse
import json
import random
import shutil
import tempfile
from pathlib import Path

# ── 全局参数（对齐材料的教学数字） ──
NAG_THRESHOLD = 3             # site/s05：连续 3 轮未调 todo_write → 注入 reminder
VISIBLE_TAIL = 5              # mock 模型的注意力窗口：只看消息列表尾部 N 条
SUB_TURN_CAP = 30             # site/s06：子代理 30 轮安全上限
DEFAULT_MAX_TOKENS = 8000     # site/s11：默认输出额度
ESCALATED_MAX_TOKENS = 64000  # site/s11：升级额度
MAX_RETRIES = 10              # site/s11：瞬态重试上限
MAX_CONTINUATIONS = 3         # site/s11：续写上限
MAX_CONSECUTIVE_529 = 3       # site/s11：连续 529 到 3 → 切备用模型
BASE_DELAY_MS = 500           # site/s11：退避基数（封顶 32000ms）
FALLBACK_MODEL = "model-backup"
PRIMARY_MODEL = "model-main"
FULL_CHARS = 2000             # ~2000 tokens/skill 全文（按 4 字符≈1 token 折算示意）
SEED = 42

rng = random.Random(SEED)
vclock = 0.0                  # 虚拟时钟（秒），只加不减、不真等

# ── 通用消息工具 ──
def user_msg(text):
    return {"role": "user", "content": [{"type": "text", "text": text}]}

def asst_tool(name, input_):
    return {"role": "assistant", "content": [{"type": "tool_use", "name": name, "input": input_}]}

def tool_result(tid, text):
    return {"role": "user", "content": [{"type": "tool_result", "tool_use_id": tid, "content": text}]}

def asst_text(text):
    return {"role": "assistant", "content": [{"type": "text", "text": text}]}

def text_of(m):
    return " ".join(str(b.get("text") or b.get("content") or f"<{b.get('type')}>")
                    for b in m["content"])

def chars_of(messages):
    return sum(len(text_of(m)) for m in messages)

# ══ M1 TodoWrite：计划外显 + nag reminder ══
def render_todos(todos):
    icon = {"pending": "[ ]", "in_progress": "[>]", "completed": "[x]"}
    lines = ["## Current Tasks"]
    lines += [f"  {icon[t['status']]} {t['content']}" for t in todos]
    return "\n".join(lines)

def run_todo_write(todos):
    """todo_write 的全部产出：存状态 + 渲染文本（经 tool_result 回到模型眼前）。"""
    for t in todos:
        assert t["status"] in ("pending", "in_progress", "completed")
    return render_todos(todos)

def parse_render(render):
    out = []
    for line in render.splitlines():
        line = line.strip()
        if line.startswith(("[ ]", "[>]", "[x]")):
            status = {"[ ]": "pending", "[>]": "in_progress", "[x]": "completed"}[line[:3]]
            out.append({"content": line[4:], "status": status})
    return out

def todo_render_in_tail(messages):
    """尾部 VISIBLE_TAIL 条里最近一次 todo 回显；出了窗口 = 看不见（稀释）。"""
    for m in reversed(messages[-VISIBLE_TAIL:]):
        for b in m["content"]:
            if b.get("type") == "tool_result" and "## Current Tasks" in str(b.get("content", "")):
                return str(b["content"])
    return None

def reminder_in_tail(messages):
    return any("<reminder>Update your todos.</reminder>" in text_of(m)
               for m in messages[-VISIBLE_TAIL:])

def state_from_done(plan, done):
    st = []
    for i, p in enumerate(plan):
        status = "completed" if i < done else ("in_progress" if i == done else "pending")
        st.append({"content": p, "status": status})
    return st

class MockModel:
    """决策 = f(可见文本)。正常模式照最近可见回显干活（两轮一节拍：干活/更新）；
    absorbed 窗口模拟 s05 的「修测试上头」——被模拟的模型行为，是装置要对付的现象本身；
    窗口结束后靠提醒重建计划，否则漂移。私有状态只有 done 计数，不含完整计划——
    计划只存在于可见文本里，这正是装置存在的理由。"""

    def __init__(self, plan, absorb_from=None, absorb_turns=0):
        self.plan, self.done = list(plan), 0
        self.absorb_from, self.absorb_turns = absorb_from, absorb_turns
        self.drifting, self.pending_update, self.planned = False, False, False

    def next_action(self, turn, messages):
        if self.absorb_from is not None and \
                self.absorb_from <= turn < self.absorb_from + self.absorb_turns:
            return ("bash", {"command": f"pytest -k test_step{self.done} --fix-attempt"}, "absorbed")
        if self.drifting:
            return ("bash", {"command": f"re-run formatter on file_{max(self.done - 1, 0)}.py"}, "drift")
        render = todo_render_in_tail(messages)
        if render is None:
            if not self.planned:
                return ("todo_write", {}, "initial plan")
            if reminder_in_tail(messages):
                return ("todo_write", {}, "refresh after reminder")
            self.drifting = True
            return ("bash", {"command": "git status --short (again)"}, "drift")
        items = parse_render(render)
        open_items = [t for t in items if t["status"] != "completed"]
        if not open_items:
            return ("finish", {}, "migration complete: all steps done")
        if self.pending_update:                     # 上一轮刚干完活 → 先更新清单
            return ("todo_write", {}, "update after work")
        target = next((t for t in items if t["status"] == "in_progress"), open_items[0])
        return ("work", {"step": target["content"]}, f"do:{target['content']}")

    def advance(self, kind):
        if kind == "work":
            self.done += 1
            self.pending_update = True
        elif kind == "todo_write":
            self.planned, self.pending_update = True, False

def episode_a(nag_threshold=NAG_THRESHOLD,
              plan=("step1 rename files", "step2 run tests", "step3 write report"),
              absorb_from=5, absorb_turns=3, turn_cap=14, verbose=True):
    """A：三步任务；第 5-7 轮「修测试上头」。nag_threshold=None = 拆掉提醒。"""
    model = MockModel(plan, absorb_from, absorb_turns)
    messages = [user_msg("Migrate the repo: " + " -> ".join(plan))]
    todo_state, rounds_since, reminders, drift_actions, log = None, 0, 0, 0, []
    turn, tid, kind = 0, 0, "start"
    while turn < turn_cap:
        if nag_threshold is not None and rounds_since >= nag_threshold and messages:
            messages.append(user_msg("<reminder>Update your todos.</reminder>"))
            rounds_since, reminders = 0, reminders + 1
            log.append(f"  t{turn + 1} [nag] reminder injected (#{reminders})")
        turn += 1
        kind, inp, tag = model.next_action(turn, messages)
        tid += 1
        if kind == "finish":
            messages.append(asst_text(tag))
            log.append(f"  t{turn} [final] {tag}")
            break
        if kind == "todo_write":
            todo_state = state_from_done(plan, model.done)
            messages.append(asst_tool("todo_write", {"todos": [dict(t) for t in todo_state]}))
            messages.append(tool_result(tid, run_todo_write(todo_state)))
            rounds_since = 0
            log.append(f"  t{turn} [todo_write] {tag} -> done={model.done}")
        else:
            messages.append(asst_tool("bash", inp))
            messages.append(tool_result(tid, f"$ {inp.get('command', inp.get('step', ''))}  ...  ok"))
            rounds_since += 1
            if tag == "drift":
                drift_actions += 1
            log.append(f"  t{turn} [{kind}] {inp.get('command', inp.get('step', ''))} tag={tag}")
        model.advance(kind)
    result = {"turns_used": turn, "steps_completed": model.done, "steps_total": len(plan),
              "reminders": reminders, "drift_actions": drift_actions,
              "messages": len(messages), "chars": chars_of(messages), "finished": kind == "finish",
              "final_todo": render_todos(todo_state) if todo_state else "(none)"}
    if verbose:
        brief = {k: v for k, v in result.items() if k != "final_todo"}
        print(f"[episode A nag={nag_threshold}] " + json.dumps(brief, ensure_ascii=False))
        print("\n".join(log))
    return result, messages, log

# ══ M2 Subagent：过程隔离，只回结论 ══
DENY_LIST = ("rm -rf /", "sudo", "mkfs")

def permission_hook(name, input_):
    """PreToolUse：deny list 检查。子代理同样过这里（上下文隔离 ≠ 权限豁免）。"""
    if name == "bash":
        for p in DENY_LIST:
            if p in input_.get("command", ""):
                return "Permission denied"
    return None

def spawn_subagent(description, files, return_full=False):
    """全新 messages[] → 子循环 → 只回最后文本结论；子代理读 N 份文件（每份
    400 字符），期间试图跑危险命令被 hook 拦下。return_full=True 是 E2。"""
    sub_messages = [user_msg(description)]          # fresh context（site/s06）
    blocked = 0
    for i, f in enumerate(files[:SUB_TURN_CAP]):
        sub_messages += [asst_tool("read_file", {"path": f}),
                         tool_result(100 + i, f"contents of {f}: " + "x" * 400)]
        if i == 0:                                  # 危险命令 → hook 拦截，不跳过
            sub_messages += [asst_tool("bash", {"command": "rm -rf /"}),
                             tool_result(199, permission_hook("bash", {"command": "rm -rf /"}))]
            blocked = 1
    summary = f"Scanned {len(files)} files: testing framework is pytest."
    if return_full:
        return sub_messages, {"blocked": blocked, "sub_messages": len(sub_messages),
                              "sub_chars": chars_of(sub_messages)}
    return summary, {"blocked": blocked, "sub_messages": len(sub_messages),
                     "sub_chars": chars_of(sub_messages)}

def episode_b(mode="subagent", files=("a.py", "b.py", "c.py", "d.py", "e.py", "f.py")):
    """B：主代理找测试框架。direct = 主代理自己读（对照）；subagent = 派子代理。"""
    parent = [user_msg("Find which testing framework this repo uses.")]
    meta = {}
    if mode == "direct":
        for i, f in enumerate(files):
            parent.append(asst_tool("read_file", {"path": f}))
            parent.append(tool_result(i, f"contents of {f}: " + "x" * 400))
        note = "pytest"
    else:
        parent.append(asst_tool("task", {"description": "find testing framework"}))
        note, meta = spawn_subagent("find testing framework", files)
        parent.append(tool_result(0, note))
    parent.append(asst_text("Answer: " + note[:40]))
    res = {"mode": mode, "parent_messages": len(parent), "parent_chars": chars_of(parent),
           "blocked_in_sub": meta.get("blocked", 0),
           "sub_messages": meta.get("sub_messages", 0), "sub_chars": meta.get("sub_chars", 0)}
    print(f"[episode B {mode}] " + json.dumps(res, ensure_ascii=False))
    return res, parent

# ══ M3 Skill 两级加载 ══
SKILLS = {
    "react-style": "Rules for React component conventions.",
    "sql-style":   "Rules for SQL formatting and migrations.",
    "api-design":  "Rules for REST API design.",
    "pdf":         "Rules for processing PDF documents.",
}

def scan_skills(full=False):
    """启动扫描 → 注册表（name/description/content）。full=True 是 E3：全文进系统提示。"""
    return {name: {"description": desc,
                   "content": (name + " full guide: " + "z" * FULL_CHARS) if full else None}
            for name, desc in SKILLS.items()}

def catalog_lines(reg):
    """第一级：目录（name + 一行 description）进 system prompt，每轮常驻。"""
    return "\n".join(f"- {n}: {s['description']}" for n, s in reg.items())

def load_skill(reg, name):
    """第二级：按名查注册表返回全文（经 tool_result 进入当前对话）。"""
    if name not in reg or reg[name]["content"] is None:
        reg.setdefault(name, {})["content"] = name + " full guide: " + "z" * FULL_CHARS
    return reg[name]["content"]

def episode_c(inline_all=False, turns=3):
    """C：任务需要 sql-style。统计每轮输入体量与加载次数（~100 vs ~2000 token 的账）。"""
    reg = scan_skills(full=inline_all)
    system = (f"You are a coding agent.\nSkills available:\n{catalog_lines(reg)}\n"
              "Use load_skill to get full details when needed.")
    if inline_all:                                   # E3：全部全文拼进 system prompt
        system += "\n" + "\n".join(load_skill(reg, n) for n in reg)
    messages = [user_msg("Write a SQL migration for the users table.")]
    loads, per_turn = 0, []
    for t in range(turns):
        per_turn.append(len(system) + chars_of(messages))
        if t == 1 and not inline_all:                # 第二轮决定加载 sql-style
            messages.append(asst_tool("load_skill", {"name": "sql-style"}))
            messages.append(tool_result(t, load_skill(reg, "sql-style")))
            loads += 1
        else:
            messages.append(asst_text("(work with available context)"))
    res = {"system_chars": len(system), "loads": loads,
           "per_turn_input_chars": per_turn, "total_input_chars": sum(per_turn)}
    print(f"[episode C inline_all={inline_all}] " + json.dumps(res, ensure_ascii=False))
    return res

# ══ M4 System Prompt 按真实状态组装 ══
PROMPT_SECTIONS = {"identity": "You are a coding agent. Act, don't explain."}

def update_context(fs):
    """真实状态：工具表 + 记忆文件是否存在且有内容（不看对话关键词）。"""
    return {"enabled_tools": ["bash", "read_file", "write_file"],
            "workspace": "/w", "memories": fs.get("MEMORY.md", "").strip()}

def assemble_system_prompt(context):
    """按 context 拼段：identity/tools/workspace 恒在；memories 有内容才在。"""
    sections = [PROMPT_SECTIONS["identity"],
                "Available tools: " + ", ".join(context["enabled_tools"]) + ".",
                f"Working directory: {context['workspace']}"]
    if context["memories"]:
        sections.append(f"Relevant memories:\n{context['memories']}")
    return "\n\n".join(sections)

_cache = {"key": None, "prompt": None}

def get_system_prompt(context, keyword_mode=False, messages=None):
    """缓存包装：json.dumps 做 key（确定性、可嵌套）。keyword_mode=True 是 E4。"""
    if keyword_mode:                                 # E4：关键词猜测（错误判据）
        hit = any("memory" in text_of(m).lower() for m in (messages or [])[-VISIBLE_TAIL:])
        context = dict(context)
        context["memories"] = context["memories"] or ("(keyword hit)" if hit else "")
    key = json.dumps(context, sort_keys=True, ensure_ascii=False)
    if key == _cache["key"] and _cache["prompt"]:
        return _cache["prompt"], True                # cache hit
    _cache["key"], _cache["prompt"] = key, assemble_system_prompt(context)
    return _cache["prompt"], False

def episode_d(keyword_mode=False):
    """D：无记忆文件 → 三段；写记忆 → memory 段出现；状态不变 → 缓存命中。"""
    fs = {}
    ctx = update_context(fs)
    p1, _ = get_system_prompt(ctx, keyword_mode)
    p2, hit1 = get_system_prompt(ctx, keyword_mode)
    chat = [user_msg("Honestly I have no memory of writing this module."), asst_text("let's look")]
    p3, _ = get_system_prompt(ctx, keyword_mode, chat)   # 无文件，但闲聊提到 memory
    fs["MEMORY.md"] = "- prefer uv over pip"
    p4, _ = get_system_prompt(update_context(fs), keyword_mode)
    res = {"sections_t1": p1.count("\n\n") + 1,
           "has_memory_t1": "Relevant memories" in p1,
           "cache_hit_same_ctx": hit1,
           "keyword_false_positive": "Relevant memories" in p3,
           "has_memory_after_file": "Relevant memories" in p4,
           "prompt_chars": [len(p1), len(p2), len(p3), len(p4)]}
    print(f"[episode D keyword={keyword_mode}] " + json.dumps(res, ensure_ascii=False))
    return res

# ══ M5 Error Recovery：分类有界恢复 ══
def retry_delay(attempt, jitter_rng=None, retry_after_ms=None):
    """指数退避 + 抖动：min(500×2^n, 32000)ms + U(0, 25%)，优先 Retry-After。"""
    if retry_after_ms is not None:                # 服务器返回 Retry-After 时优先采用
        return retry_after_ms / 1000
    base = min(BASE_DELAY_MS * (2 ** attempt), 32000) / 1000
    return base + (jitter_rng or rng).uniform(0, base * 0.25)

def episode_e(script=("529", "529", "429"), untyped=False):
    """E：一次 LLM 调用的恢复链（虚拟时钟）。429/529 → 退避；连续 529×3 → 切
    备用模型；prompt_too_long → reactive compact（保尾部 5 条）一次。untyped=E5。"""
    global vclock
    vclock = 0.0
    state = {"consecutive_529": 0, "model": PRIMARY_MODEL, "switched": False}
    messages = [user_msg("task")] + [user_msg(f"context {i}") for i in range(8)]
    queue, log, compacted, attempts, ok = list(script), [], False, 0, False
    while attempts < MAX_RETRIES:
        attempts += 1
        err = queue.pop(0) if queue else None
        if err is None:
            ok = True
            break
        if err == "prompt_too_long":
            if untyped:
                delay = retry_delay(attempts - 1)
                vclock += delay
                log.append(f"  retry {attempts}: prompt_too_long (as transient) wait {delay:.2f}s")
                continue
            if not compacted:
                messages[:] = [user_msg("[Reactive compact] earlier conversation trimmed.")] + messages[-5:]
                compacted = True
                log.append(f"  prompt_too_long -> reactive compact (keep tail 5, now {len(messages)} msgs)")
                continue
            break                                    # 压缩过仍超限 → 放弃
        if err == "529":
            state["consecutive_529"] += 1
            if state["consecutive_529"] >= MAX_CONSECUTIVE_529:
                state["model"], state["switched"] = FALLBACK_MODEL, True
                state["consecutive_529"] = 0
                log.append(f"  529 x{MAX_CONSECUTIVE_529} -> switch model to {FALLBACK_MODEL}")
        delay = retry_delay(attempts - 1)
        vclock += delay
        log.append(f"  retry {attempts}: {err} wait {delay:.2f}s (clock {vclock:.1f}s)")
    res = {"ok": ok, "attempts": attempts, "model": state["model"], "switched": state["switched"],
           "compacted": compacted, "messages": len(messages), "clock_s": round(vclock, 1)}
    print(f"[episode E script={script} untyped={untyped}] " + json.dumps(res, ensure_ascii=False))
    for l in log:
        print(l)
    return res

def episode_e_tokens():
    """输出截断路径：先升 8K→64K（messages 不变），再续写（有上界 3 次）。"""
    messages = [user_msg("write a huge report")]
    max_tokens, escalated, continuations, log = DEFAULT_MAX_TOKENS, False, 0, []
    for stop in ("max_tokens", "max_tokens", "max_tokens", "max_tokens", "end_turn"):
        if stop != "max_tokens":
            messages.append(asst_text("final answer"))
            log.append("  end_turn: done")
            break
        if not escalated:
            max_tokens, escalated = ESCALATED_MAX_TOKENS, True
            log.append(f"  escalate {DEFAULT_MAX_TOKENS} -> {ESCALATED_MAX_TOKENS} (messages={len(messages)} unchanged)")
            continue
        if continuations < MAX_CONTINUATIONS:
            messages += [asst_text("(partial output)"), user_msg("Output token limit hit. Resume directly.")]
            continuations += 1
            log.append(f"  continuation {continuations}/{MAX_CONTINUATIONS}")
            continue
        log.append("  give up: recovery limit reached")
        break
    res = {"max_tokens": max_tokens, "escalated": escalated, "continuations": continuations,
           "messages": len(messages)}
    print("[episode E-tokens] " + json.dumps(res, ensure_ascii=False))
    for l in log:
        print(l)
    return res

# ══ 破坏性实验（每次只拆一个） ══
def run_experiment(n):
    if n == 1:                                       # 拆 M1 的 reminder 注入
        print("== E1 拆掉 nag reminder（nag_threshold=None） ==")
        base, _, _ = episode_a(verbose=False)
        broken, _, blog = episode_a(nag_threshold=None, verbose=False)
        for tag, r in (("正常", base), ("拆后", broken)):
            print(f"  {tag}：完成 {r['steps_completed']}/{r['steps_total']} 步，提醒 {r['reminders']} 次，"
                  f"漂移动作 {r['drift_actions']} 个，收尾 {r['finished']}")
        print("  教训：提醒是把计划顶回可见区的唯一外力；拆掉后，吸收窗口一过模型就永久漂移。")
        return {"base": base, "broken": broken}
    if n == 2:                                       # 拆 M2 的「只回摘要」
        print("== E2 子代理改回传全部子历史 ==")
        sub_res, _ = episode_b("subagent")
        files = ("a.py", "b.py", "c.py", "d.py", "e.py", "f.py")
        full_history, meta = spawn_subagent("find testing framework", files, return_full=True)
        parent = [user_msg("Find which testing framework this repo uses."),
                  asst_tool("task", {"description": "find"})]
        for m in full_history[1:]:
            parent.append(m)
        ratio = chars_of(parent) / sub_res["parent_chars"]
        print(f"  只回摘要：主对话 {sub_res['parent_messages']} 条 / {sub_res['parent_chars']} 字符；"
              f"回传全部：{len(parent)} 条 / {chars_of(parent)} 字符（约 {ratio:.1f} 倍，"
              f"子历史 {meta['sub_messages']} 条 / {meta['sub_chars']} 字符）")
        print("  教训：只回结论不是锦上添花，是主对话上下文的存亡线。")
        return {"ratio": round(ratio, 1), "full_chars": chars_of(parent)}
    if n == 3:                                       # 拆 M3 的两级加载
        print("== E3 技能全文全量进系统提示 ==")
        tiered = episode_c()
        inlined = episode_c(inline_all=True)
        extra = inlined["total_input_chars"] - tiered["total_input_chars"]
        print(f"  两级加载：system {tiered['system_chars']} 字符 / 3 轮总输入 {tiered['total_input_chars']}；"
              f"全量内联：system {inlined['system_chars']} / 总输入 {inlined['total_input_chars']}"
              f"（多 {extra}，{inlined['total_input_chars'] / tiered['total_input_chars']:.1f} 倍）")
        print("  教训：常驻内容按「每轮」计费；不用的知识进目录，不进正文。")
        return {"extra_chars": extra}
    if n == 4:                                       # 拆 M4 的「真实状态」判据
        print("== E4 组装判据改成关键词猜测 ==")
        good = episode_d()
        bad = episode_d(keyword_mode=True)
        print(f"  真实状态：误注入={good['keyword_false_positive']}，文件出现后注入="
              f"{good['has_memory_after_file']}，缓存命中={good['cache_hit_same_ctx']}")
        print(f"  关键词猜测：同场景误注入={bad['keyword_false_positive']}（真实状态判据为 0）")
        print("  教训：段加载看状态不看话术——对话里「提到」不等于状态成立。")
        return {"good": good, "bad": bad}
    if n == 5:                                       # 拆 M5 的分类恢复
        print("== E5 恢复改一刀切重试（prompt_too_long 也当瞬态） ==")
        ok = episode_e(("prompt_too_long",))
        bad = episode_e(("prompt_too_long",) * MAX_RETRIES, untyped=True)
        print(f"  分类恢复：压缩一次后成功（ok={ok['ok']}，messages={ok['messages']}）")
        print(f"  一刀切：重试 {bad['attempts']} 次全部撞墙（ok={bad['ok']}，白等 {bad['clock_s']}s）")
        print("  教训：超限是容量错误，重试不减小请求规模，只会把时间烧光。")
        return {"ok": ok, "bad": bad}
    raise SystemExit(f"unknown experiment {n}")

# ══ selftest ══
def selftest():
    global vclock
    out = {}
    # A：nag 正常路径（吸收窗口结束后靠提醒恢复）
    a, _, _ = episode_a(verbose=False)
    assert a["finished"] and a["steps_completed"] == 3, a
    assert a["reminders"] == 1 and a["drift_actions"] == 0, a
    out["A"] = a
    # A 变体：阈值 1 与 999（预测题 T5 的实测输入）
    a1, _, _ = episode_a(nag_threshold=1, verbose=False)
    a999, _, _ = episode_a(nag_threshold=999, verbose=False)
    assert a1["steps_completed"] == 3 and a1["reminders"] > a["reminders"], a1
    assert a999["reminders"] == 0 and not a999["finished"], a999
    out["A_thr1"], out["A_thr999"] = a1, a999
    # B：子代理隔离 + hook 不跳过
    b_sub, _ = episode_b("subagent")
    b_dir, _ = episode_b("direct")
    assert b_sub["parent_chars"] < b_dir["parent_chars"] / 5, (b_sub, b_dir)
    assert b_sub["blocked_in_sub"] == 1, "子代理的危险命令应被 hook 拦下"
    out["B_sub"], out["B_direct"] = b_sub, b_dir
    # C：两级加载
    c = episode_c()
    assert c["loads"] == 1 and c["system_chars"] < 2 * FULL_CHARS, c
    out["C"] = c
    # D：组装与缓存（真实状态判据）
    d = episode_d()
    assert d["sections_t1"] == 3 and not d["has_memory_t1"], d
    assert d["cache_hit_same_ctx"] and d["has_memory_after_file"], d
    assert not d["keyword_false_positive"], d
    out["D"] = d
    # E：退避 + 529 切换 + 压缩 + 升级
    e1 = episode_e(("529", "529", "429"))
    assert e1["ok"] and not e1["switched"] and e1["clock_s"] > 3, e1
    e2 = episode_e(("529", "529", "529"))
    assert e2["switched"] and e2["model"] == FALLBACK_MODEL, e2
    e3 = episode_e(("prompt_too_long",))
    assert e3["ok"] and e3["compacted"] and e3["messages"] == 6, e3
    et = episode_e_tokens()
    assert et["escalated"] and et["max_tokens"] == ESCALATED_MAX_TOKENS, et
    assert et["continuations"] == MAX_CONTINUATIONS, et
    out["E_retry"], out["E_switch"], out["E_compact"], out["E_tokens"] = e1, e2, e3, et
    # 破坏实验逐项
    for n in (1, 2, 3, 4, 5):
        run_experiment(n)
    sandbox = Path(tempfile.gettempdir()) / "lcc-plab-sandbox"  # 固定沙箱：不污染调用方 CWD
    shutil.rmtree(sandbox, ignore_errors=True)                  # 每次运行前整体重建
    sandbox.mkdir(parents=True)
    with open(sandbox / "lcc_planning_lab_result.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1, default=str)
    print(f"result -> {sandbox / 'lcc_planning_lab_result.json'}")
    print("\nSELFTEST PASSED ✔")

EPISODES = {"A": episode_a, "B": episode_b, "C": episode_c, "D": episode_d}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--episode", choices=list("ABCDE"))
    ap.add_argument("--experiment", type=int, choices=range(1, 6))
    args = ap.parse_args()
    if args.selftest:
        selftest()
    elif args.episode == "E":
        episode_e()
        episode_e_tokens()
    elif args.episode:
        EPISODES[args.episode]()
    elif args.experiment:
        run_experiment(args.experiment)
    else:
        ap.print_help()
