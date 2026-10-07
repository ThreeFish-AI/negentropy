#!/usr/bin/env python3
"""lcc_multiagent_lab — Learn Claude Code「多 Agent 平台」教学机制的最小确定性原型。

原型回答「机制是否自洽」，不回答「模型是否聪明」：课程中的 LLM（Lead 与队友）
全部换成脚本化的确定性响应序列；无随机数、无 sleep、无网络。同一命令永远同一日志。

机制单元（与精读笔记行号速查对应）：
  1. TaskStore 任务板  2. MessageBus 消费式收件箱  3. Protocol 请求-响应协议
  4. Autonomy 空闲自认领（原子开关）  5. ToolPool 外部工具池（发现-命名-组装）

直接运行即全量自检；沙箱每次在独立临时目录重建。
"""
import json
import shutil
import sys
import tempfile  # 沙箱根：每次运行独立重建
from dataclasses import asdict, dataclass
from pathlib import Path

def log(msg: str) -> None:
    print(msg)

# ── 机制 1：TaskStore（任务板）──

@dataclass
class Task:
    id: str
    subject: str
    status: str            # pending | in_progress | completed
    owner: str | None
    blockedBy: list[str]

class TaskStore:
    """每任务一个 JSON 文件；依赖全部 completed 才能认领；完成时扫描解锁。"""

    def __init__(self, root: Path):
        self.root = root / ".tasks"
        self.root.mkdir(parents=True, exist_ok=True)
        self._seq = 0
        self.missing_is_blocked = True   # E1 可拆：missing 依赖视为 blocked

    def _path(self, task_id: str) -> Path:
        return self.root / f"{task_id}.json"

    def create(self, subject: str) -> Task:
        self._seq += 1
        task = Task(f"task_{self._seq:03d}", subject, "pending", None, [])
        self._path(task.id).write_text(json.dumps(asdict(task), indent=2))
        log(f"  [create] {task.id}: {task.subject}")
        return task

    def load(self, task_id: str) -> Task:
        return Task(**json.loads(self._path(task_id).read_text()))

    def save(self, task: Task) -> None:
        self._path(task.id).write_text(json.dumps(asdict(task), indent=2))

    def list(self) -> list[Task]:
        return [self.load(p.stem) for p in sorted(self.root.glob("task_*.json"))]

    def can_start(self, task: Task) -> bool:
        """依赖全部 completed；missing 依赖视为 blocked（E1 拆开关）。"""
        for dep in task.blockedBy:
            if not self._path(dep).exists():
                if self.missing_is_blocked:
                    return False
                continue  # E1：missing 被忽略
            if self.load(dep).status != "completed":
                return False
        return True

    def claim(self, task_id: str, owner: str, check_owner: bool = True) -> str:
        task = self.load(task_id)
        if task.status != "pending":
            return f"Task {task_id} is {task.status}, cannot claim"
        if check_owner and task.owner is not None:
            return f"Task {task_id} already owned by {task.owner}"
        if not self.can_start(task):
            blocked = [d for d in task.blockedBy if not self._path(d).exists() or self.load(d).status != "completed"]
            return f"Blocked by: {blocked}"
        task.owner, task.status = owner, "in_progress"
        self.save(task)
        log(f"  [claim] {task_id} → in_progress (owner: {owner})")
        return f"Claimed {task_id} ({task.subject})"

    def complete(self, task_id: str) -> str:
        task = self.load(task_id)
        if task.status != "in_progress":
            return f"Task {task_id} is {task.status}, cannot complete"
        task.status = "completed"
        self.save(task)
        unblocked = [t.subject for t in self.list() if t.status == "pending" and t.blockedBy and self.can_start(t)]
        log(f"  [complete] {task_id} ✓" + (f" → unblocked: {unblocked}" if unblocked else ""))
        return f"Completed {task_id} ({task.subject})" + (
            f"\nUnblocked: {', '.join(unblocked)}" if unblocked else "")

    def scan_unclaimed(self) -> list[Task]:
        return [t for t in self.list() if t.status == "pending" and t.owner is None and self.can_start(t)]

# ── 机制 2：MessageBus（消费式收件箱）──

class MessageBus:
    """每个 Agent 一个 .jsonl 收件箱；读取即消费（读完删除文件）。"""

    def __init__(self, root: Path):
        self.dir = root / ".mailboxes"
        self.dir.mkdir(parents=True, exist_ok=True)

    def _path(self, agent: str) -> Path:
        return self.dir / f"{agent}.jsonl"

    def send(self, from_agent: str, to_agent: str, content: str,
             msg_type: str = "message", metadata: dict | None = None) -> None:
        msg = {"from": from_agent, "to": to_agent, "content": content, "type": msg_type, "metadata": metadata or {}}
        with self._path(to_agent).open("a") as fh:
            fh.write(json.dumps(msg) + "\n")
        log(f"  [bus] {from_agent} → {to_agent} ({msg_type}) {content[:40]}")

    def read_inbox(self, agent: str) -> list[dict]:
        inbox = self._path(agent)
        if not inbox.exists():
            return []
        msgs = [json.loads(x) for x in inbox.read_text().splitlines() if x.strip()]
        inbox.unlink()  # 消费式：读完即删
        return msgs

# ── 机制 3：Protocol（请求-响应协议 + 统一消费入口）──

@dataclass
class ProtocolState:
    request_id: str
    type: str          # shutdown | plan_approval
    sender: str
    target: str
    status: str        # pending | approved | rejected
    payload: str

class Protocol:
    """登记表 + match_response 三重校验（编号 / 类型 / 状态防重）。"""

    def __init__(self, bus: MessageBus):
        self.bus = bus
        self.pending: dict[str, ProtocolState] = {}
        self._n = 0
        self.mutations = 0          # 状态被改写的次数（防重实验的观测量）
        self.type_check = True      # E2 可拆
        self.status_check = True    # S2 预测题可拆

    def new_request_id(self) -> str:
        self._n += 1
        return f"req_{self._n:06d}"

    def match_response(self, response_type: str, request_id: str,
                       approve: bool) -> str:
        state = self.pending.get(request_id)
        if not state:
            log(f"  [protocol] unknown request_id: {request_id} → ignored")
            return "ignored:unknown_id"
        if self.type_check:
            expected = f"{state.type}_response"
            if response_type != expected:
                log(f"  [protocol] type mismatch ({response_type} vs {expected}) → ignored")
                return "ignored:type_mismatch"
        if self.status_check and state.status != "pending":
            log(f"  [protocol] {request_id} already {state.status} → ignored")
            return "ignored:duplicate"
        state.status = "approved" if approve else "rejected"
        self.mutations += 1
        log(f"  [protocol] {request_id} → {state.status}")
        return state.status

    def request_shutdown(self, teammate: str) -> str:
        rid = self.new_request_id()
        self.pending[rid] = ProtocolState(rid, "shutdown", "lead", teammate, "pending", "")
        self.bus.send("lead", teammate, "Please shut down gracefully.", "shutdown_request", {"request_id": rid})
        return rid

    def submit_plan(self, teammate: str, plan: str) -> str:
        rid = self.new_request_id()
        self.pending[rid] = ProtocolState(rid, "plan_approval", teammate, "lead", "pending", plan)
        self.bus.send(teammate, "lead", plan, "plan_approval_request", {"request_id": rid})
        return rid

    def consume_lead_inbox(self, route_protocol: bool = True) -> list[dict]:
        """统一消费入口：先路由协议响应（对号改状态），再把消息交还调用方。"""
        msgs = self.bus.read_inbox("lead")
        if route_protocol:
            for msg in msgs:
                meta = msg.get("metadata", {})
                if meta.get("request_id") and msg.get("type", "").endswith("_response"):
                    self.match_response(msg["type"], meta["request_id"], meta.get("approve", False))
        return msgs

# ── 机制 4：Autonomy（空闲轮询 + 自认领，含原子性开关）──

class Teammate:
    """脚本化队友：WORK 一轮做一步；IDLE 先收件箱后看板；SHUTDOWN 走握手。
    script：任务 subject → 动作列表；("work", 输出) 完成之，("stall",) 本轮不完成。"""

    def __init__(self, name: str, bus: MessageBus, protocol: Protocol,
                 store: TaskStore, script: dict[str, list[tuple]]):
        self.name, self.bus, self.protocol, self.store = name, bus, protocol, store
        self.script = script
        self.state = "WORK"
        self.current: Task | None = None

    def work_turn(self) -> str:
        if self.current is None:
            return "IDLE"
        step = self.script.get(self.current.subject, [("work", "done")]).pop(0)
        if step[0] == "stall":
            log(f"  [{self.name}] stalls on {self.current.id}")
            return "WORK"            # 不完成，保持 in_progress
        log(f"  [{self.name}] works on {self.current.id}: {step[1]}")
        self.store.complete(self.current.id)
        self.bus.send(self.name, "lead",
                      f"{self.current.subject} done: {step[1]}", "result")
        self.current = None
        return "IDLE"

    def idle_turn(self) -> str:
        inbox = self.bus.read_inbox(self.name)
        for msg in inbox:
            if msg.get("type") == "shutdown_request":
                rid = msg["metadata"]["request_id"]
                self.bus.send(self.name, "lead", "Shutting down gracefully.", "shutdown_response", {"request_id": rid, "approve": True})
                self.state = "SHUTDOWN"
                return "SHUTDOWN"
        if inbox:
            return "WORK"  # 非协议消息注入上下文，回到工作
        unclaimed = self.store.scan_unclaimed()
        if unclaimed:
            result = self.store.claim(unclaimed[0].id, self.name)
            if result.startswith("Claimed"):
                self.current = self.store.load(unclaimed[0].id)
                return "WORK"
            log(f"  [{self.name}] claim failed: {result}")
        return "IDLE"

    def step(self) -> str:
        if self.state == "WORK":
            self.state = self.work_turn()
        elif self.state == "IDLE":
            self.state = self.idle_turn()
        return self.state

def simulate_concurrent_claims(store: TaskStore, task_id: str, a: str, b: str,
                               atomic: bool) -> dict:
    """并发认领模拟：无锁时两队友各自「读取→检查→写入」交错执行（TOCTOU）。"""
    log(f"  [race] {a} vs {b} on {task_id} (atomic={atomic})")
    reads = {who: store.load(task_id) for who in (a, b)}  # 两执行者先读快照
    results = {}
    for who in (a, b):
        snap = store.load(task_id) if atomic else reads[who]
        if snap.status != "pending" or snap.owner is not None:
            results[who] = f"rejected: {snap.status}/{snap.owner}"
            continue
        fresh = store.load(task_id)
        fresh.owner, fresh.status = who, "in_progress"
        store.save(fresh)                      # 无锁时第二次写覆盖第一次
        results[who] = "claimed"
        log(f"  [race] {who} wrote owner={who}")
    final = store.load(task_id)
    return {"results": results, "final_owner": final.owner, "final_status": final.status}

# ── 机制 5：ToolPool（外部工具池：发现-命名-组装）──

def normalize_mcp_name(name: str) -> str:
    """材料规则：非 [a-zA-Z0-9_-] 一律替换为下划线。"""
    return "".join(ch if ch.isalnum() or ch in "_-" else "_" for ch in name)

class MCPClient:
    def __init__(self, name: str, tools: dict[str, str]):
        self.name, self.tools = name, tools  # tools: raw_name -> 模板文本

    def call(self, tool: str, args: dict) -> str:
        return (f"MCP error: unknown tool '{tool}'" if tool not in self.tools
                else self.tools[tool].format(**args))

MOCK_SERVERS = {"docs": {"search": "[docs] results for {query}", "get_version": "[docs] v2.1"},
                "deploy": {"check": "[deploy] {service}: running", "trigger": "[deploy] triggered {service}"}}

class ToolPool:
    def __init__(self):
        self.builtin = {"bash", "read_file", "write_file"}
        self.connected: dict[str, MCPClient] = {}

    def connect(self, name: str) -> str:
        if name in self.connected:
            return f"MCP server '{name}' already connected"
        if name not in MOCK_SERVERS:
            return f"Unknown server '{name}'"
        self.connected[name] = MCPClient(name, MOCK_SERVERS[name])
        discovered = ", ".join(MOCK_SERVERS[name])
        log(f"  [mcp] connected {name} → discovered: {discovered}")
        return f"Connected '{name}'. Tools: {discovered}"  # 发现=tools/list

    def assemble(self) -> tuple[set[str], dict[str, tuple[str, str]]]:
        names, handlers = set(self.builtin), {}
        for server, client in self.connected.items():
            for raw in client.tools:
                full = f"mcp__{normalize_mcp_name(server)}__{normalize_mcp_name(raw)}"
                names.add(full)
                handlers[full] = (server, raw)
        return names, handlers

    def call(self, pool_names: set[str], handlers: dict, full_name: str, args: dict) -> str:
        if full_name not in pool_names:
            return f"Unknown tool: {full_name}"
        server, raw = handlers[full_name]
        return self.connected[server].call(raw, args)

# ── 场景与破坏性实验 ──

def fresh_world(sandbox: Path):
    bus = MessageBus(sandbox)
    return TaskStore(sandbox), bus, Protocol(bus)

def build_board(store: TaskStore) -> dict[str, Task]:
    """四任务两依赖：draft ∥ art → layout → publish；外加坏依赖任务 ghost。"""
    draft = store.create("draft")
    art = store.create("art")
    layout = store.create("layout")
    publish = store.create("publish")
    ghost = store.create("ghost")            # 陷阱：依赖不存在的编号
    for target, deps in [(layout.id, [draft.id, art.id]), (publish.id, [layout.id])]:
        task = store.load(target)
        task.blockedBy = deps
        store.save(task)
        log(f"  [dep] {target} blockedBy {deps}")
    g = store.load(ghost.id)
    g.blockedBy = ["task_999"]
    store.save(g)
    log("  [dep] ghost blockedBy [task_999]（不存在的依赖）")
    return {"draft": draft, "art": art, "layout": layout, "publish": publish, "ghost": ghost}

SCRIPT = {"draft": [("work", "outline+prose")], "art": [("work", "hero image")],
          "layout": [("work", "two-column")], "publish": [("work", "v1 online")]}

def scenario_normal(sandbox: Path) -> dict:
    """正常路径：两队友自认领跑完整条链，最后关机握手。"""
    log("== 场景 A：正常路径（自认领 + 解锁 + 关机握手）==")
    store, bus, protocol = fresh_world(sandbox)
    build_board(store)
    mates = [Teammate(n, bus, protocol, store, {k: list(v) for k, v in SCRIPT.items()})
             for n in ("w1", "w2")]
    for round_no in range(1, 13):
        for mate in mates:
            if mate.state != "SHUTDOWN":
                log(f" round {round_no} · {mate.name} [{mate.state}]")
                mate.step()  # 确定性轮转：无线程、无 sleep
        if all(m.state == "SHUTDOWN" for m in mates):
            break
        if all(m.state == "IDLE" for m in mates) and not store.scan_unclaimed():
            log("  [lead] 看板已空且队友空闲 → 请求关机")
            for mate in mates:
                protocol.request_shutdown(mate.name)
    msgs = protocol.consume_lead_inbox()
    return {"final": {t.subject: t.status for t in store.list()},
            "results": sum(1 for m in msgs if m["type"] == "result"), "mutations": protocol.mutations}

def scenario_edge(sandbox: Path) -> dict:
    """边缘路径：计划审批 + 同名工具命名空间。"""
    log("== 场景 C：边缘路径（审批协议 + 工具命名空间）==")
    store, bus, protocol = fresh_world(sandbox)
    build_board(store)
    rid = protocol.submit_plan("w1", "refactor in three steps")
    protocol.consume_lead_inbox()
    bus.send("w1", "lead", "", "plan_approval_response", {"request_id": rid, "approve": True})
    protocol.consume_lead_inbox()
    pool = ToolPool()
    pool.connect("deploy")
    names, handlers = pool.assemble()
    probe = "mcp__deploy__check"
    out = pool.call(names, handlers, probe, {"service": "web"})
    log(f"  [tool] {probe} → {out}")
    fake = normalize_mcp_name("inv-checker/search.user")
    log(f"  [tool] normalize('inv-checker/search.user') → {fake}")
    return {"plan_state": protocol.pending[rid].status, "tool_ok": out.startswith("[deploy]"), "normalized": fake}

def exp1_missing_dep(sandbox: Path) -> dict:
    log("== 场景 B + E1：陷阱路径 & 拆「missing 依赖视为 blocked」==")
    store, _, _ = fresh_world(sandbox)
    board = build_board(store)
    base = store.claim(board["ghost"].id, "w1")   # 基线：被拒
    store.missing_is_blocked = False              # 拆：missing 改为忽略
    after = store.claim(board["ghost"].id, "w1")
    log(f"  [E1] 基线 → {base}")
    log(f"  [E1] 拆后 → {after}")
    return {"baseline_blocked": base.startswith("Blocked"), "after_allowed": after.startswith("Claimed")}

def exp2_type_check(sandbox: Path) -> dict:
    log("== E2：拆 match_response 的类型校验（张冠李戴的关机回复）==")
    store, bus, protocol = fresh_world(sandbox)
    protocol.pending["req_000123"] = ProtocolState("req_000123", "plan_approval", "w1", "lead", "pending", "plan X")
    baseline = protocol.match_response("shutdown_response", "req_000123", True)
    baseline_state = protocol.pending["req_000123"].status
    protocol.type_check = False                   # 拆：类型校验
    hit = protocol.match_response("shutdown_response", "req_000123", True)
    state = protocol.pending["req_000123"].status
    log(f"  [E2] 基线（类型校验在）→ {baseline}，plan 仍 {baseline_state}")
    log(f"  [E2] 拆后 → {hit}，plan 变成 {state}")
    return {"baseline": baseline, "after_hit": hit, "plan_state": state}

def exp3_dual_inbox(sandbox: Path) -> dict:
    log("== E3：拆统一消费入口（工具直读收件箱，不再路由协议）==")
    store, bus, protocol = fresh_world(sandbox)
    rid = protocol.request_shutdown("w1")
    bus.send("w1", "lead", "", "shutdown_response", {"request_id": rid, "approve": True})
    msgs = protocol.consume_lead_inbox(route_protocol=False)  # 拆：不路由
    state_after = protocol.pending[rid].status
    second = protocol.consume_lead_inbox(route_protocol=True)
    log(f"  [E3] 工具读走 {len(msgs)} 条后，{rid} 状态 = {state_after}；再读只剩 {len(second)} 条")
    return {"state": state_after, "second_read": len(second), "stuck": state_after == "pending"}

def exp4_owner_check(sandbox: Path) -> dict:
    log("== E4：拆认领的 owner 检查 + 无锁并发（TOCTOU）==")
    store, _, _ = fresh_world(sandbox)
    board = build_board(store)
    broken = simulate_concurrent_claims(store, board["draft"].id, "w1", "w2", atomic=False)
    store2, _, _ = fresh_world(sandbox)
    fixed = simulate_concurrent_claims(store2, build_board(store2)["draft"].id, "w1", "w2", atomic=True)
    return {"broken": broken, "fixed": fixed}

def exp5_pool_rebuild(sandbox: Path) -> dict:
    log("== E5：拆「连接后重建工具池」（沿用旧池调用新工具）==")
    pool = ToolPool()
    names_before, handlers_before = pool.assemble()   # 旧池（连接前）
    pool.connect("docs")
    probe = "mcp__docs__search"
    stale = pool.call(names_before, handlers_before, probe, {"query": "loop"})
    names_after, handlers_after = pool.assemble()     # 重建
    fresh = pool.call(names_after, handlers_after, probe, {"query": "loop"})
    log(f"  [E5] 不重建 → {stale}；重建后 → {fresh}")
    return {"stale_miss": stale.startswith("Unknown tool"), "fresh_ok": fresh.startswith("[docs]")}

# ── selftest ──

def selftest(sandbox_root: Path) -> int:
    def sandbox(tag: str) -> Path:
        p = sandbox_root / tag
        shutil.rmtree(p, ignore_errors=True)
        p.mkdir(parents=True)
        return p
    failures = 0

    def check(name: str, cond: bool) -> None:
        nonlocal failures
        log(f"  ASSERT {name}: {'PASS' if cond else 'FAIL'}")
        if not cond:
            failures += 1

    a = scenario_normal(sandbox("A"))
    four = {k: v for k, v in a["final"].items() if k != "ghost"}  # ghost 是陷阱样本
    check("A1 四个真实任务全部完成", all(v == "completed" for v in four.values()))
    check("A1b 坏依赖任务保持 pending", a["final"].get("ghost") == "pending")
    check("A2 两队友各回报 result", a["results"] == 4)
    check("A3 关机握手状态改写 2 次", a["mutations"] == 2)

    c = scenario_edge(sandbox("C"))
    check("C1 计划审批 approve 生效", c["plan_state"] == "approved")
    check("C2 MCP 工具按全名可调", c["tool_ok"])
    check("C3 非法字符归一", c["normalized"] == "inv-checker_search_user")

    e1 = exp1_missing_dep(sandbox("E1"))
    check("E1 基线：坏依赖被挡", e1["baseline_blocked"])
    check("E1 拆后：坏依赖被放行（退化）", e1["after_allowed"])

    e2 = exp2_type_check(sandbox("E2"))
    check("E2 基线：类型不符被拒（plan 仍 pending）", e2["baseline"].startswith("ignored"))
    check("E2 拆后：shutdown 回复误批了计划（退化）", e2["plan_state"] == "approved")

    e3 = exp3_dual_inbox(sandbox("E3"))
    check("E3 拆后：协议状态卡 pending（退化）", e3["stuck"])
    check("E3 消息已丢失：二读为 0", e3["second_read"] == 0)

    e4 = exp4_owner_check(sandbox("E4"))
    check("E4 无锁：双方都以为认领成功（退化）", all(
        e4["broken"]["results"][w] == "claimed" for w in ("w1", "w2")))
    check("E4 无锁：终值 owner=后写者", e4["broken"]["final_owner"] == "w2")
    check("E4 有锁：仅一人成功", e4["fixed"]["results"]["w1"] == "claimed"
          and e4["fixed"]["results"]["w2"].startswith("rejected"))

    e5 = exp5_pool_rebuild(sandbox("E5"))
    check("E5 不重建：新工具调不到（退化）", e5["stale_miss"])
    check("E5 重建后：可调", e5["fresh_ok"])

    dump = sandbox("A") / "final_tasks.json"
    dump.write_text(json.dumps({t.id: asdict(t) for t in TaskStore(sandbox("A")).list()}, indent=2))
    log(f"  [serialize] {dump}")

    if failures:
        print(f"SELFTEST FAILED ✗ ({failures} failures)")
        return 1
    print("SELFTEST PASSED ✔")
    return 0
if __name__ == "__main__":
    _root = Path(tempfile.mkdtemp(prefix="lcc-multiagent-"))
    print(f"sandbox: {_root}")
    sys.exit(selftest(_root))
