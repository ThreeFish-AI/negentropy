#!/usr/bin/env python3
"""planning_control_lab.py — 教学式编码 Agent「规划与协调」五机制的最小确定性原型。

验证机制自洽而非模型能力：LLM 角色全部用脚本化 mock 序列替代（每轮响应预先编排，
无网络、无随机数、不 sleep——退避延迟只计算并记录）。对应课程站点「规划与协调」
部分五节（s05 todo+nag / s06 subagent / s07 skill 两级加载 / s10 prompt 组装 /
s11 错误分类恢复）；课程 code.py 需 API key，本原型以同构机制独立验证逻辑自洽。

用法：
  python3 planning_control_lab.py --selftest          # 全部场景断言 + 逐轮日志
  python3 planning_control_lab.py --experiment D1     # 破坏性实验 D1..D5（单拆一个机制）
  python3 planning_control_lab.py --t4                # 看会预测题 T4 新输入实跑
"""
import argparse, json, shutil, sys
from pathlib import Path

# ══ mock LLM（脚本化响应；Text/ToolUse 块用纯 dict 表示） ══

class MockLLM:
    """按脚本逐轮返回响应；脚本项若是 Exception 实例则抛出（模拟 API 错误）。"""
    def __init__(self, script):
        self.script = list(script); self.calls = 0
    def messages_create(self, **kw):
        self.calls += 1
        if not self.script:
            raise RuntimeError("script exhausted")
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

def text(s):  return {"type": "text", "text": s}
def tool(name, **inp): return {"type": "tool_use", "name": name, "input": inp, "id": f"tu{n()}"}
_C = [0]
def n():
    _C[0] += 1; return _C[0]

class RateLimitError(Exception): pass
class OverloadedError(Exception): pass
class PromptTooLongError(Exception): pass

# ══ hooks（s04 最小形：PreToolUse 拒绝清单） ══

DENY_LIST = ["rm -rf /", "sudo", "shutdown"]
HOOKS = {"PreToolUse": []}

def trigger_hooks(event, block):
    for cb in HOOKS[event]:
        r = cb(block)
        if r is not None:
            return r
    return None

def permission_hook(block):
    if block["name"] == "bash":
        for p in DENY_LIST:
            if p in block["input"].get("command", ""):
                return "Permission denied"
    return None

HOOKS["PreToolUse"].append(permission_hook)

# ══ M1 todo_write + nag（s05） ══

CURRENT_TODOS = []

def normalize_todos(todos):
    if isinstance(todos, str):
        try: todos = json.loads(todos)
        except json.JSONDecodeError: return None, "Error: todos must be a list"
    if not isinstance(todos, list): return None, "Error: todos must be a list"
    for i, t in enumerate(todos):
        if not isinstance(t, dict) or "content" not in t or "status" not in t:
            return None, f"Error: todos[{i}] missing 'content' or 'status'"
        if t["status"] not in ("pending", "in_progress", "completed"):
            return None, f"Error: todos[{i}] has invalid status"
    return todos, None

def run_todo_write(todos):
    global CURRENT_TODOS
    todos, err = normalize_todos(todos)
    if err: return err
    CURRENT_TODOS = todos
    return f"Updated {len(CURRENT_TODOS)} tasks"

def agent_loop_m1(llm, messages, log, reset_on_update=True):
    """s05 循环：rounds_since_todo >= 3 时注入 <reminder>；调 todo_write 即清零。"""
    rounds = 0; reminders = 0
    while True:
        if rounds >= 3 and messages:
            messages.append({"role": "user", "content": "<reminder>Update your todos.</reminder>"})
            rounds = 0; reminders += 1
            log.append(f"  [nag] reminder #{reminders} injected (rounds_since_todo hit 3)")
        resp = llm.messages_create(messages=messages)
        messages.append({"role": "assistant", "content": resp["content"]})
        if resp["stop_reason"] != "tool_use":
            return reminders
        rounds += 1
        results = []
        for b in resp["content"]:
            if b["type"] != "tool_use": continue
            blocked = trigger_hooks("PreToolUse", b)
            out = blocked if blocked else run_tool(b)
            if b["name"] == "todo_write" and reset_on_update:
                rounds = 0
            results.append({"type": "tool_result", "tool_use_id": b["id"], "content": out})
        messages.append({"role": "user", "content": results})

# ══ M2 subagent（s06） ══

SUB_TOOLS = {"bash", "read_file", "write_file", "edit_file", "glob"}  # 无 task/todo_write/load_skill

def extract_text(content):
    if not isinstance(content, list): return str(content)
    return "\n".join(b.get("text", "") for b in content if b.get("type") == "text")

def run_tool(b):
    table = {"bash": lambda command: f"$ {command} -> ok",
             "read_file": lambda path: f"[content of {path}]",
             "write_file": lambda path, content: f"Wrote {len(content)} bytes to {path}",
             "edit_file": lambda path, old_text, new_text: f"Edited {path}",
             "glob": lambda pattern: "a.py\nb.py",
             "todo_write": run_todo_write}
    h = table.get(b["name"])
    return h(**b["input"]) if h else f"Unknown: {b['name']}"

def spawn_subagent(llm, description, log, fresh=True, max_turns=30):
    """全新 messages[]，只回传最后一条文本；hooks 照跑；无 task 防递归。"""
    log.append("  [Subagent spawned]")
    msgs = [] if not fresh else [{"role": "user", "content": description}]
    if not fresh:  # 破坏实验 D2：与父共享同一列表（隔离拆除）
        msgs = description
    for _ in range(max_turns):
        resp = llm.messages_create(messages=msgs)
        msgs.append({"role": "assistant", "content": resp["content"]})
        if resp["stop_reason"] != "tool_use":
            break
        results = []
        for b in resp["content"]:
            if b["type"] != "tool_use": continue
            blocked = trigger_hooks("PreToolUse", b)
            out = blocked if blocked else run_tool(b)
            log.append(f"  [sub] {b['name']}: {str(out)[:60]}")
            results.append({"type": "tool_result", "tool_use_id": b["id"], "content": out})
        msgs.append({"role": "user", "content": results})
    result = extract_text(msgs[-1]["content"])
    if not result:  # 30 轮撞限于 tool_use：向前找最后一条 assistant 文本
        for m in reversed(msgs):
            if m["role"] == "assistant" and extract_text(m["content"]):
                result = extract_text(m["content"]); break
        result = result or "Subagent stopped after 30 turns without final answer."
    log.append("  [Subagent done]")
    return result

# ══ M3 skill 两级加载（s07；frontmatter 解析为 stdlib 最小实现） ══

def parse_frontmatter(raw):
    if not raw.startswith("---"): return {}, raw
    parts = raw.split("---", 2)
    if len(parts) < 3: return {}, raw
    meta = {}
    for line in parts[1].strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, parts[2].strip()

def scan_skills(skills_dir: Path):
    registry = {}
    if not skills_dir.exists(): return registry
    for d in sorted(skills_dir.iterdir()):
        if not d.is_dir(): continue
        manifest = d / "SKILL.md"
        if manifest.exists():
            raw = manifest.read_text(encoding="utf-8")
            meta, _ = parse_frontmatter(raw)
            name = meta.get("name", d.name)
            desc = meta.get("description", raw.split("\n")[0].lstrip("#").strip())
            registry[name] = {"name": name, "description": desc, "content": raw}
    return registry

def list_skills(registry):
    return "\n".join(f"- **{s['name']}**: {s['description']}" for s in registry.values())

def build_system(workdir, registry):
    return (f"You are a coding agent at {workdir}. "
            f"Skills available:\n{list_skills(registry)}\n"
            "Use load_skill to get full details when needed.")

def load_skill(registry, name):
    s = registry.get(name)
    return s["content"] if s else f"Skill not found: {name}"

# ══ M4 prompt 组装 + 缓存（s10） ══

PROMPT_SECTIONS = {"identity": "You are a coding agent. Act, don't explain."}

def assemble_system_prompt(context, sections=PROMPT_SECTIONS):
    parts = [sections["identity"]]
    tools = ", ".join(context.get("enabled_tools", []))
    if tools: parts.append(f"Available tools: {tools}.")
    parts.append(f"Working directory: {context.get('workspace', '?')}")
    if context.get("memories"):
        parts.append(f"Relevant memories:\n{context['memories']}")
    return "\n\n".join(parts)

class PromptCache:
    def __init__(self): self.key = None; self.prompt = None; self.hits = 0; self.assembles = 0
    def get(self, context):
        k = json.dumps(context, sort_keys=True, ensure_ascii=False, default=str)
        if k == self.key and self.prompt is not None:
            self.hits += 1; return self.prompt
        self.key = k; self.assembles += 1
        self.prompt = assemble_system_prompt(context)
        return self.prompt

# ══ M5 错误分类恢复（s11；延迟只计算不 sleep，抖动取固定序列保确定性） ══

ESCALATED_MAX_TOKENS, DEFAULT_MAX_TOKENS = 64000, 8000
MAX_CONTINUATIONS, MAX_RETRIES, BASE_DELAY_MS, MAX_529 = 3, 10, 500, 3
JITTER_FRACS = [0.125, 0.0, 0.25, 0.10, 0.05, 0.20, 0.15, 0.0, 0.25, 0.10]
CONTINUATION = "Output token limit hit. Resume directly — no apology, no recap."

def retry_delay(attempt, retry_after=None, ji=0):
    if retry_after: return float(retry_after)
    base = min(BASE_DELAY_MS * (2 ** attempt), 32000) / 1000
    return base + base * JITTER_FRACS[ji % len(JITTER_FRACS)]

class RecoveryState:
    def __init__(self, primary="primary-model", fallback=None):
        self.has_escalated = False; self.continuations = 0; self.consecutive_529 = 0
        self.has_compacted = False; self.current_model = primary
        self.fallback = fallback

def with_retry(fn, state, log, max_retries=MAX_RETRIES):
    for attempt in range(max_retries):
        try:
            r = fn(); state.consecutive_529 = 0; return r
        except Exception as e:
            name = type(e).__name__; msg = str(e).lower()
            if "ratelimit" in name.lower() or "429" in msg or "overloaded" in name.lower() or "529" in msg:
                if "overloaded" in name.lower() or "529" in msg:
                    state.consecutive_529 += 1
                    if state.consecutive_529 >= MAX_529 and state.fallback:
                        state.current_model = state.fallback; state.consecutive_529 = 0
                        log.append(f"  [529 x{MAX_529}] switching to {state.fallback}")
                d = retry_delay(attempt, ji=attempt)
                code = "529" if ("overloaded" in name.lower() or "529" in msg) else "429"
                log.append(f"  [{code} {name}] retry {attempt+1}/{max_retries}, wait {d:.2f}s")
                continue
            raise
    raise RuntimeError(f"Max retries ({max_retries}) exceeded")

def reactive_compact(messages):
    tail = messages[-5:]
    return [{"role": "user", "content": "[Reactive compact] Earlier conversation trimmed. "
            "Continue from where you left off."}, *tail]

def recovering_loop(llm, messages, log, state=None):
    state = state or RecoveryState()
    max_tokens = DEFAULT_MAX_TOKENS; loops = 0
    while True:
        loops += 1
        if loops > 12: log.append("  [guard] loop guard tripped (experiment)"); return "GUARD"
        try:
            resp = with_retry(lambda: llm.messages_create(max_tokens=max_tokens), state, log)
        except PromptTooLongError:
            if not state.has_compacted:
                messages[:] = reactive_compact(messages); state.has_compacted = True
                log.append("  [reactive compact] trimmed to last 5 messages"); continue
            log.append("  [unrecoverable] still too long after compact"); return "EXIT_TOO_LONG"
        except Exception as e:
            log.append(f"  [unrecoverable] {type(e).__name__}: {e}"); return "EXIT_RETRIES"
        if resp.get("stop_reason") == "max_tokens":
            if not state.has_escalated:
                max_tokens = ESCALATED_MAX_TOKENS; state.has_escalated = True
                log.append(f"  [max_tokens] escalating {DEFAULT_MAX_TOKENS} -> {ESCALATED_MAX_TOKENS}")
                continue
            messages.append({"role": "assistant", "content": [text("…half output…")]})
            if state.continuations < MAX_CONTINUATIONS:
                messages.append({"role": "user", "content": CONTINUATION})
                state.continuations += 1
                log.append(f"  [max_tokens] continuation {state.continuations}/{MAX_CONTINUATIONS}")
                continue
            log.append("  [max_tokens] recovery limit reached"); return "EXIT_TRUNCATED"
        messages.append({"role": "assistant", "content": resp["content"]})
        if resp["stop_reason"] != "tool_use": return "DONE"

# ══ 场景与断言（selftest） ══

def scenario_m1_normal(log, tmp):
    llm = MockLLM([
        {"stop_reason": "tool_use", "content": [tool("todo_write", todos=[{"content": "a", "status": "in_progress"}])]},
        {"stop_reason": "tool_use", "content": [tool("bash", command="ls")]},
        {"stop_reason": "end_turn", "content": [text("done")]},
    ])
    r = agent_loop_m1(llm, [{"role": "user", "content": "task"}], log)
    assert r == 0 and llm.calls == 3, (r, llm.calls)
    log.append("M1 normal: 0 reminders, todo updated once — PASS")

def scenario_m1_nag(log, tmp):
    script = [{"stop_reason": "tool_use", "content": [tool("bash", command="ls")]} for _ in range(3)]
    script.append({"stop_reason": "end_turn", "content": [text("done")]})
    msgs = [{"role": "user", "content": "task"}]
    r = agent_loop_m1(MockLLM(script), msgs, log)
    assert r == 1 and any("<reminder>" in str(m) for m in msgs), (r, len(msgs))
    log.append("M1 trap: 3 rounds no todo -> 1 <reminder> injected as user message — PASS")

def scenario_m1_invalid(log, tmp):
    out = run_todo_write([{"content": "x", "status": "done???"}])
    assert out.startswith("Error: todos[0] has invalid status"), out
    log.append(f"M1 edge: invalid status rejected -> {out} — PASS")

def scenario_m2_normal(log, tmp):
    llm = MockLLM([
        {"stop_reason": "tool_use", "content": [tool("read_file", path="a.py")]},
        {"stop_reason": "end_turn", "content": [text("Uses pytest.")]},
    ])
    parent = [{"role": "user", "content": "find test framework"}]
    summary = spawn_subagent(llm, "find test framework", log)
    parent.append({"role": "user", "content": summary})
    assert summary == "Uses pytest." and len(parent) == 2
    log.append("M2 normal: subtask 2 rounds, mainline grew by 1 summary message only — PASS")

def scenario_m2_cap(log, tmp):
    script = [{"stop_reason": "tool_use", "content": [tool("bash", command="ls")]} for _ in range(30)]
    script.append({"stop_reason": "tool_use", "content": [tool("bash", command="ls")]} )  # 撞限于 tool_use
    llm = MockLLM(script)
    r = spawn_subagent(llm, "huge task", log)
    assert r == "Subagent stopped after 30 turns without final answer.", r
    log.append("M2 trap: 30-turn cap mid-tool_use -> fallback sentence, no crash — PASS")

def scenario_m2_hook(log, tmp):
    llm = MockLLM([
        {"stop_reason": "tool_use", "content": [tool("bash", command="sudo rm x")]},
        {"stop_reason": "end_turn", "content": [text("blocked, gave up politely")]},
    ])
    r = spawn_subagent(llm, "danger", log)
    assert any("Permission denied" in l for l in log) and "blocked" in r
    log.append("M2 edge: deny-list hook still enforced inside subagent — PASS")

def scenario_m3(log, tmp: Path):
    sk = tmp / "skills"
    (sk / "sql-style").mkdir(parents=True)
    (sk / "sql-style" / "SKILL.md").write_text(
        "---\nname: sql-style\ndescription: SQL conventions\n---\nAlways use uppercase keywords.", encoding="utf-8")
    (sk / "react").mkdir()
    (sk / "react" / "SKILL.md").write_text(
        "---\nname: react\ndescription: React rules\n---\nUse function components.", encoding="utf-8")
    reg = scan_skills(sk)
    assert set(reg) == {"sql-style", "react"}
    sysprompt = build_system("/w", reg)
    assert "sql-style" in sysprompt and "React rules" in sysprompt
    assert "uppercase keywords" in load_skill(reg, "sql-style")
    assert load_skill(reg, "nope") == "Skill not found: nope"
    log.append(f"M3 normal: catalog in system ({len(sysprompt)} chars), full text on demand — PASS")

def scenario_m3_collision(log, tmp: Path):
    sk = tmp / "skills2"
    (sk / "a-style").mkdir(parents=True)
    (sk / "a-style" / "SKILL.md").write_text("---\nname: shared-name\ndescription: first\n---\nAAA", encoding="utf-8")
    (sk / "b-style").mkdir()
    (sk / "b-style" / "SKILL.md").write_text("---\nname: shared-name\ndescription: second\n---\nBBB", encoding="utf-8")
    reg = scan_skills(sk)
    assert len(reg) == 1 and reg["shared-name"]["content"].endswith("BBB")
    log.append("M3 trap: duplicate frontmatter name -> later dir silently wins (registry keyed by name) — PASS")

def scenario_m3_badfm(log, tmp: Path):
    sk = tmp / "skills3"
    (sk / "weird").mkdir(parents=True)
    (sk / "weird" / "SKILL.md").write_text("# First line is the description\nbody", encoding="utf-8")
    reg = scan_skills(sk)
    assert reg["weird"]["description"].startswith("First line")
    log.append("M3 edge: missing frontmatter -> dir name + first-line description fallback — PASS")

def scenario_m4(log, tmp):
    c = PromptCache()
    ctx1 = {"enabled_tools": ["bash", "read_file"], "workspace": "/w", "memories": ""}
    p1 = c.get(ctx1); p2 = c.get(dict(ctx1))
    assert c.hits == 1 and c.assembles == 1 and p1 == p2 and "Relevant memories" not in p1
    ctx2 = dict(ctx1, memories="- [tab](t.md) — use tabs")
    p3 = c.get(ctx2)
    assert c.assembles == 2 and "Relevant memories" in p3
    log.append("M4 normal+trap: same context -> cache hit; memory file appears -> reassembled with memory section — PASS")

def scenario_m5_429(log, tmp):
    llm = MockLLM([RateLimitError("429"), RateLimitError("429"),
                   {"stop_reason": "end_turn", "content": [text("ok")]}, Exception("stop")])
    r = recovering_loop(llm, [{"role": "user", "content": "q"}], log)
    assert r == "DONE" and sum(1 for l in log if "429" in l and "wait" in l) == 2
    log.append("M5 normal: two 429s -> two backoffs (0.56s, 1.00s computed) then success — PASS")

def scenario_m5_529_fallback(log, tmp):
    llm = MockLLM([OverloadedError("529")] * 3 + [{"stop_reason": "end_turn", "content": [text("ok")]}, Exception("stop")])
    st = RecoveryState(fallback="backup-model")
    r = recovering_loop(llm, [{"role": "user", "content": "q"}], log, st)
    assert r == "DONE" and st.current_model == "backup-model"
    log.append("M5 trap: 3 consecutive 529 -> fallback model switch — PASS")

def scenario_m5_compact(log, tmp):
    llm = MockLLM([PromptTooLongError("prompt is too long"),
                   {"stop_reason": "end_turn", "content": [text("ok")]}, Exception("stop")])
    msgs = [{"role": "user", "content": f"m{i}"} for i in range(12)]
    r = recovering_loop(llm, msgs, log)
    assert r == "DONE" and len(msgs) == 7 and msgs[0]["content"].startswith("[Reactive compact]")
    log.append("M5 edge: 12 msgs too long -> one reactive compact (1 header + 5 tail = 6) -> retry success — PASS")

def scenario_m5_truncation(log, tmp):
    half = {"stop_reason": "max_tokens", "content": [text("half…")]}
    llm = MockLLM([half, {"stop_reason": "max_tokens", "content": [text("half2…")]},
                   {"stop_reason": "max_tokens", "content": [text("half3…")]},
                   {"stop_reason": "max_tokens", "content": [text("half4…")]},
                   {"stop_reason": "max_tokens", "content": [text("half5…")]}, Exception("stop")])
    r = recovering_loop(llm, [{"role": "user", "content": "q"}], log)
    assert r == "EXIT_TRUNCATED"
    assert sum(1 for l in log if "escalating" in l) == 1 and sum(1 for l in log if "continuation" in l) == 3
    log.append("M5 truncation: 1 escalation (no append) then 3 continuations, then bounded exit — PASS")

SCENARIOS = [scenario_m1_normal, scenario_m1_nag, scenario_m1_invalid,
             scenario_m2_normal, scenario_m2_cap, scenario_m2_hook,
             scenario_m3, scenario_m3_collision, scenario_m3_badfm,
             scenario_m4, scenario_m5_429, scenario_m5_529_fallback,
             scenario_m5_compact, scenario_m5_truncation]

# ══ 破坏性实验（一次只拆一个，真跑记退化） ══

def experiment_D1(log):
    """拆 M1：去掉「调 todo_write 即清零」——模型明明更新了计划仍被连番误提醒。"""
    script = [{"stop_reason": "tool_use", "content": [tool("todo_write", todos=[{"content": "a", "status": "in_progress"}])]}]
    script += [{"stop_reason": "tool_use", "content": [tool("bash", command="ls")]} for _ in range(2)]
    script.append({"stop_reason": "end_turn", "content": [text("done")]})
    base = agent_loop_m1(MockLLM(list(script)), [{"role": "user", "content": "task"}], log, reset_on_update=True)
    broken = agent_loop_m1(MockLLM(list(script)), [{"role": "user", "content": "task"}], log, reset_on_update=False)
    return base, broken

def experiment_D2(log):
    """拆 M2：子代理与父共享同一消息列表——中间过程全部泄入主线。"""
    sub_script = [{"stop_reason": "tool_use", "content": [tool("read_file", path=f"f{i}.py")]} for i in range(8)]
    sub_script.append({"stop_reason": "end_turn", "content": [text("summary: uses flask")]})
    normal_parent = [{"role": "user", "content": "find framework"}]
    normal_parent.append({"role": "user", "content": spawn_subagent(MockLLM(list(sub_script)), "find framework", [])})
    parent = [{"role": "user", "content": "find framework"}]
    summary = spawn_subagent(MockLLM(list(sub_script)), parent, log, fresh=False)
    parent.append({"role": "user", "content": summary})
    log.append(f"  [D2] mainline messages: start=1 normal={len(normal_parent)} broken={len(parent)}")
    return len(parent)

def experiment_D3(log, tmp: Path):
    """拆 M3：两级并一级——技能全文全塞 system prompt，量出放大倍数。
    独立沙箱 skills_d3/：不依赖 selftest 遗留状态，同一命令永远同一结果。"""
    sk = tmp / "skills_d3"; (sk / "sql-style").mkdir(parents=True, exist_ok=True)
    (sk / "sql-style" / "SKILL.md").write_text(
        "---\nname: sql-style\ndescription: SQL conventions\n---\n" + "K" * 5800, encoding="utf-8")
    reg = scan_skills(sk)
    tier2 = len(build_system("/w", reg))
    tier1 = len(build_system("/w", reg)) + sum(len(s["content"]) for s in reg.values())
    log.append(f"  [D3] system prompt chars: normal={tier2} broken={tier1} ratio={tier1 / tier2:.1f}x")
    return tier2, tier1

def experiment_D4(log):
    """拆 M4：缓存键掺入不稳定成分（模拟 non-deterministic key）——永不命中。"""
    base = PromptCache()
    for _ in range(5):  # 正常：同一 context 连续 5 次
        base.get({"enabled_tools": ["bash"], "workspace": "/w", "memories": ""})
    c = PromptCache()
    for i in range(5):  # 拆后：每轮 context 掺入易变成分 -> key 永不稳定 -> 永不命中
        c.get({"enabled_tools": ["bash"], "workspace": f"/w#{i}", "memories": ""})
    log.append(f"  [D4] normal: assembles={base.assembles} hits={base.hits}; broken: assembles={c.assembles} hits={c.hits}")
    return c.assembles, c.hits

def experiment_D5(log):
    """拆 M5：reactive compact 不记账——超限后反复压缩直到循环守卫兜底。"""
    llm = MockLLM([PromptTooLongError("too long")] * 8 + [Exception("stop")])
    msgs = [{"role": "user", "content": f"m{i}"} for i in range(12)]
    class NoAccount(RecoveryState):  # has_compacted 永远 False
        @property
        def has_compacted(self): return False
        @has_compacted.setter
        def has_compacted(self, v): pass
    st = NoAccount()
    r = recovering_loop(llm, msgs, log, st)
    compacts = sum(1 for l in log if "reactive compact" in l)
    nlog = []  # 正常路径对照：同样 8 次超限，记账生效
    r0 = recovering_loop(MockLLM([PromptTooLongError("too long")] * 8 + [Exception("stop")]),
                         [{"role": "user", "content": f"m{i}"} for i in range(12)], nlog)
    log.append(f"  [D5] normal: result={r0} compacts={sum(1 for l in nlog if 'reactive compact' in l)}")
    return r, compacts

# ══ T4 预测题新输入实跑（日志只留 lab，不回灌笔记） ══

def t4_runs(log, tmp: Path):
    sk = tmp / "skills"
    (sk / "vault").mkdir(parents=True, exist_ok=True)
    (sk / "vault" / "SKILL.md").write_text(
        "---\nname: vault\ndescription: secrets area\n---\nSECRET-CONTENT", encoding="utf-8")
    (sk / "renamed").mkdir(exist_ok=True)
    (sk / "renamed" / "SKILL.md").write_text(
        "---\nname: pretty-name\ndescription: declared name differs from dir\n---\nBODY", encoding="utf-8")
    (tmp / "outside-secret.txt").write_text("TOP-SECRET", encoding="utf-8")
    def raw_load(name):  # 无注册表的变体：把名字当相对路径直接读文件
        p = (sk / name).resolve()
        return p.read_text(encoding="utf-8") if p.exists() else f"Skill not found: {name}"
    traversal = raw_load("../outside-secret.txt")
    log.append(f"[T4-a] raw_load('../outside-secret.txt') -> {traversal!r}（读到了技能目录之外的文件）")
    reg = scan_skills(sk)
    log.append(f"[T4-b] catalog 按声明名宣传 pretty-name；raw_load('pretty-name') -> {raw_load('pretty-name')!r}（目录里没有叫这个名字的文件，按名拼路径对不上）")
    (sk / "late").mkdir(exist_ok=True)
    (sk / "late" / "SKILL.md").write_text(
        "---\nname: late\ndescription: added after startup\n---\nL", encoding="utf-8")
    log.append(f"[T4-c] runtime-added skill visible in old registry? {'late' in reg}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--experiment", choices=["D1", "D2", "D3", "D4", "D5"])
    ap.add_argument("--t4", action="store_true")
    args = ap.parse_args()
    # 每次运行重建一次性沙箱（.lab_out/ 已被仓库 .gitignore 忽略）：结果不依赖残留状态
    tmp = Path(__file__).parent / ".lab_out" / "planning_control_lab"
    shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir(parents=True)
    log = []
    if args.selftest:
        for sc in SCENARIOS:
            sc(log, tmp)
        print("\n".join(log)); print("SELFTEST PASSED ✔")
        return 0
    if args.experiment:
        import importlib
        fn = {"D1": experiment_D1, "D2": experiment_D2, "D3": experiment_D3,
              "D4": experiment_D4, "D5": experiment_D5}[args.experiment]
        out = fn(log, tmp) if fn.__code__.co_argcount == 2 else fn(log)
        print("\n".join(log)); print(f"[{args.experiment}] result: {out}")
        return 0
    if args.t4:
        t4_runs(log, tmp); print("\n".join(log)); return 0
    ap.print_help(); return 1

if __name__ == "__main__":
    sys.exit(main())
