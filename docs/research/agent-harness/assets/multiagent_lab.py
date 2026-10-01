#!/usr/bin/env python3
"""multiagent_lab —— learn-claude-code「多 Agent 平台」7 节机制的最小确定性原型。

声明：本原型只验证机制自洽，不验证模型能力——材料里的 LLM 角色（Lead/队友）
全部用确定性脚本序列替代；无随机数、无真实时间依赖（时间用步进计数器代替），
同一命令永远同一日志。运行：
    python3 multiagent_lab.py --selftest            # 全场景自检（秒级）
    python3 multiagent_lab.py --break B1|B2|B2v|B3|B4|B5   # 破坏性实验（每次只拆一个）
    python3 multiagent_lab.py --demo t5race         # 交错窗口演示（认领竞态）
"""

import json
import sys

# ── 破坏开关（破坏性实验用；默认全关 = 完整机制） ─────────────────────────
BREAK = None  # "B1" 拆依赖检查 | "B2" 拆无主守卫 | "B2v" 拆待办状态守卫
              # "B3" 拆信箱消费语义 | "B4" 拆回执校验 | "B5" 拆空闲超时

_tick = 0          # 步进时钟（代替 time.sleep/timeout 的确定性替身）
_task_seq = 0
_req_seq = 0


def tick(n=1):
    global _tick
    _tick += n
    return _tick


# ── 任务板（s12/s18：状态落盘 + blockedBy 依赖 + worktree 绑定） ────────────
TASKS = {}         # id -> dict（对应 .tasks/{id}.json）


def create_task(subject, description="", blockedBy=None):
    global _task_seq
    _task_seq += 1
    t = {"id": f"task_{_task_seq:04d}", "subject": subject,
         "description": description, "status": "pending", "owner": None,
         "blockedBy": list(blockedBy or []), "worktree": None}
    TASKS[t["id"]] = t                       # save_task：写盘的内存替身
    return t


def can_start(task_id):
    if BREAK == "B1":
        return True                          # B1：依赖检查改放行
    t = TASKS[task_id]
    for dep in t["blockedBy"]:
        if dep not in TASKS:                 # 缺失依赖 = 被阻塞（fail-closed）
            return False
        if TASKS[dep]["status"] != "completed":
            return False
    return True


def claim_task(task_id, owner):
    t = TASKS[task_id]
    if BREAK != "B2v" and t["status"] != "pending":
        return f"拒：{task_id} 状态为 {t['status']}"
    if BREAK != "B2" and t["owner"]:
        return f"拒：{task_id} 已被 {t['owner']} 占用"
    if not can_start(task_id):
        blocked = [d for d in t["blockedBy"]
                   if d not in TASKS or TASKS[d]["status"] != "completed"]
        return f"拒：被阻塞 {blocked}"
    t["owner"], t["status"] = owner, "in_progress"
    return f"认领 {task_id}（{t['subject']}）"


def complete_task(task_id):
    t = TASKS[task_id]
    if t["status"] != "in_progress":
        return f"拒：{task_id} 非 in_progress"
    t["status"] = "completed"
    unblocked = [x["subject"] for x in TASKS.values()
                 if x["status"] == "pending" and x["blockedBy"]
                 and can_start(x["id"])]
    msg = f"完成 {task_id}"
    if unblocked:
        msg += "，解锁：" + "、".join(unblocked)
    return msg


# ── 信箱（s15：追加一行 + 消费式读 + 非消费探测） ─────────────────────────
MAILBOXES = {}     # agent -> [msg, ...]（对应 .mailboxes/{agent}.jsonl）


def send(from_agent, to_agent, content, msg_type="message", metadata=None):
    MAILBOXES.setdefault(to_agent, []).append(
        {"from": from_agent, "to": to_agent, "content": content,
         "type": msg_type, "metadata": metadata or {}})


def read_inbox(agent):
    if BREAK == "B3":
        return list(MAILBOXES.get(agent, []))   # B3：读后不删（共享读）
    return MAILBOXES.pop(agent, [])             # 消费式：读走即清箱


def peek(agent):
    return bool(MAILBOXES.get(agent))


# ── 协议（s16：request_id 关联 + 类型校验 + 已决跳过） ─────────────────────
PENDING = {}       # request_id -> ProtocolState


def new_request_id():
    global _req_seq
    _req_seq += 1
    return f"req_{_req_seq:06d}"


def request(sender, target, ptype, payload=""):
    rid = new_request_id()
    PENDING[rid] = {"type": ptype, "sender": sender, "target": target,
                    "status": "pending", "payload": payload}
    send(sender, target, payload or f"[{ptype}]", f"{ptype}_request",
         {"request_id": rid})
    return rid


def match_response(response_type, request_id, approve):
    st = PENDING.get(request_id)
    if not st:
        return f"忽略：未知单号 {request_id}"
    if BREAK != "B4":
        if st["type"] == "shutdown" and response_type != "shutdown_response":
            return "忽略：类型不匹配"
        if st["type"] == "plan_approval" and response_type != "plan_approval_response":
            return "忽略：类型不匹配"
        if st["status"] != "pending":
            return f"忽略：单子已 {st['status']}"
    st["status"] = "approved" if approve else "rejected"
    return f"销账 {request_id} → {st['status']}"


# ── 自取（s17：先信箱后看板；60s/5s=12 步超时） ───────────────────────────
IDLE_POLL_INTERVAL, IDLE_TIMEOUT = 5, 60
POLL_STEPS = IDLE_TIMEOUT // IDLE_POLL_INTERVAL   # 12


def scan_unclaimed():
    return [t for t in (TASKS[i] for i in sorted(TASKS))
            if t["status"] == "pending" and not t["owner"]
            and can_start(t["id"])]


def idle_poll(name, inject, wt_ctx=None):
    """一个空闲步：先信箱（关机立即回执退出），后看板（认领第一个）。
    返回 'work' / 'shutdown' / 'timeout'。"""
    steps = POLL_STEPS if BREAK != "B5" else POLL_STEPS * 10  # B5：超时没了（演示 120 步截断）
    for _ in range(steps):
        tick(IDLE_POLL_INTERVAL)
        inbox = read_inbox(name)
        for m in inbox:
            if m["type"] == "shutdown_request":
                rid = m["metadata"]["request_id"]
                send(name, "lead", "收尾关机。", "shutdown_response",
                     {"request_id": rid, "approve": True})
                return "shutdown"
        if inbox:
            inject(name, inbox)
            return "work"
        unclaimed = scan_unclaimed()
        if unclaimed:
            t = unclaimed[0]
            r = claim_task(t["id"], name)
            if "认领" in r:
                if t.get("worktree") and wt_ctx is not None:
                    wt_ctx["path"] = t["worktree"]        # s20：自动认领也进屋
                inject(name, [{"type": "auto_claim", "task": t["id"]}])
                return "work"
    return "timeout"


# ── worktree（s18：目录注册表 + 绑定 + 拒删 + 事件审计） ───────────────────
WORKTREES = {}     # name -> {"changes": int, "commits": int}
EVENTS = []


def create_worktree(name, task_id=""):
    if name in WORKTREES:
        return f"拒：{name} 已存在"
    WORKTREES[name] = {"changes": 0, "commits": 0}
    if task_id:
        TASKS[task_id]["worktree"] = name        # 绑定只写字段，状态仍 pending
    EVENTS.append(("create", name, task_id))
    return f"建 {name}"


def remove_worktree(name, discard_changes=False):
    wt = WORKTREES.get(name)
    if not discard_changes and (wt["changes"] or wt["commits"]):
        return f"拒：{name} 有 {wt['changes']} 改动 {wt['commits']} 提交"
    del WORKTREES[name]
    EVENTS.append(("remove", name, ""))
    return f"删 {name}"


# ── MCP（s19：注册表 + 每轮重建 + 前缀命名） ─────────────────────────────
import re
_DISALLOWED = re.compile(r'[^a-zA-Z0-9_-]')
MCP_CLIENTS = {}


def normalize(name):
    return _DISALLOWED.sub('_', name)


def connect_mcp(server_name, tools):
    if server_name in MCP_CLIENTS:
        return f"拒：{server_name} 已连接"
    MCP_CLIENTS[server_name] = tools           # tools: {原名: handler}
    return f"连上 {server_name}，发现 {len(tools)} 个工具"


def assemble_tool_pool(builtin):
    pool = dict(builtin)
    for srv, tools in MCP_CLIENTS.items():
        for raw, fn in tools.items():
            pool[f"mcp__{normalize(srv)}__{normalize(raw)}"] = fn
    return pool


# ── 权限门 + 计划门（s20：PreToolUse 拦截 / waiting_plan 停步） ─────────────
DENY = ("rm -rf /", "sudo")


def permission_gate(tool, args):
    if tool == "bash":
        for p in DENY:
            if p in args.get("command", ""):
                return f"权限拒绝：'{p}' 在黑名单"
    return None


class Teammate:
    """脚本化队友：tool_step 按 waiting_plan 与权限门执行一步。"""

    def __init__(self, name, role):
        self.name, self.role = name, role
        self.wt_ctx = {"path": None}
        self.waiting_plan = None

    def tool_step(self, tool, args, pool):
        if self.waiting_plan:
            return "停：计划待批，工具步被冻结"
        blocked = permission_gate(tool, args)
        if blocked:
            return blocked
        if tool == "submit_plan":
            rid = request(self.name, "lead", "plan_approval", args["plan"])
            self.waiting_plan = rid
            return f"已交计划（{rid}），等待批复"
        if tool == "claim_task":
            r = claim_task(args["task_id"], self.name)
            if "认领" in r:
                t = TASKS[args["task_id"]]
                self.wt_ctx["path"] = t.get("worktree")
            return r
        if tool == "complete_task":
            r = complete_task(args["task_id"])
            self.wt_ctx["path"] = None
            return r
        return pool.get(tool, lambda **a: f"未知工具 {tool}")(**args)

    def drain_inbox(self, inject):
        """收信：协议回执先处理，普通消息注入。"""
        for m in read_inbox(self.name):
            if m["type"] == "plan_approval_response":
                rid = m["metadata"]["request_id"]
                if rid == self.waiting_plan:
                    self.waiting_plan = None
                inject(self.name, [m])
            elif m["type"] == "shutdown_request":
                send(self.name, "lead", "收尾关机。", "shutdown_response",
                     {"request_id": m["metadata"]["request_id"], "approve": True})
                return "shutdown"
        return "work"


LOG = []


def log(msg):
    LOG.append(f"[t{_tick:03d}] {msg}")


def inject(who, msgs):
    for m in msgs:
        log(f"{who} 收到注入 {m.get('type', 'auto_claim')}:{str(m)[:60]}")


# ── selftest：正常 / 陷阱 / 边缘三路样本 ─────────────────────────────────
def selftest():
    ok = []

    def check(label, got, want):
        assert want in got, f"{label}: 期望含『{want}』，实得『{got}』"
        ok.append(label)

    # 场景 1 · 正常路径：四任务两队友，自取+解锁
    P = create_task("铺底座"); Q = create_task("砌墙", blockedBy=[P["id"]])
    R = create_task("装灯", blockedBy=[P["id"]]); S = create_task("验收")
    alice, bob = Teammate("alice", "工"), Teammate("bob", "工")
    check("alice 自取 P", idle_poll("alice", inject, alice.wt_ctx), "work")
    check("P in_progress", TASKS[P["id"]]["status"], "in_progress")
    check("alice 完成 P 解锁 Q/R",
          alice.tool_step("complete_task", {"task_id": P["id"]}, {}), "砌墙")
    check("bob 自取 Q", idle_poll("bob", inject, bob.wt_ctx), "work")
    check("bob 自取 R（Q 领走后）", idle_poll("bob", inject, bob.wt_ctx), "work")
    check("S 仍可取", idle_poll("alice", inject, alice.wt_ctx), "work")
    assert TASKS[P["id"]]["status"] == "completed"
    assert all(TASKS[t]["status"] == "in_progress" and TASKS[t]["owner"]
               for t in (Q["id"], R["id"], S["id"]))

    # 场景 2 · 陷阱路径：三道守卫各得其所
    T = create_task("封顶"); W = create_task("吊顶", blockedBy=[T["id"]])
    check("依赖未齐拒领", claim_task(W["id"], "carol"), "拒：被阻塞")
    check("首认领成功", claim_task(T["id"], "carol"), "认领")
    check("状态闸拒再领", claim_task(T["id"], "dave"), "状态为 in_progress")
    X = create_task("遗留单")           # 模拟「状态回退 pending 但 owner 未清」
    X["status"], X["owner"] = "pending", "zed"
    check("无主闸拒占坑", claim_task(X["id"], "dave"), "占用")

    # 场景 3 · 边缘路径：协议三验证
    rid = request("lead", "alice", "shutdown")
    check("关机回执销账",
          match_response("shutdown_response", rid, True), "approved")
    check("重复回执忽略",
          match_response("shutdown_response", rid, False), "忽略")
    rid2 = request("bob", "lead", "plan_approval", "先做 X 再做 Y")
    check("类型不匹配忽略",
          match_response("shutdown_response", rid2, True), "忽略")
    check("计划批复销账",
          match_response("plan_approval_response", rid2, True), "approved")

    # 场景 4 · 计划门（s20 真门）
    U = create_task("刷漆")
    carol = Teammate("carol", "工")
    pool = {}
    check("交计划冻结", carol.tool_step(
        "submit_plan", {"plan": "先底漆后面漆"}, pool), "等待批复")
    check("冻结中工具停", carol.tool_step(
        "bash", {"command": "ls"}, pool), "停：计划待批")
    send("lead", "carol", "同意", "plan_approval_response",
         {"request_id": carol.waiting_plan, "approve": True})
    check("批复后恢复", carol.drain_inbox(inject), "work")
    check("恢复后可干活", carol.tool_step(
        "bash", {"command": "ls"}, pool), "未知工具")
    check("领 U 开工", carol.tool_step(
        "claim_task", {"task_id": U["id"]}, pool), "认领")
    check("完工 U 收单", carol.tool_step(
        "complete_task", {"task_id": U["id"]}, pool), "完成")

    # 场景 5 · 权限门（s20 PreToolUse）
    check("黑名单拦截", carol.tool_step(
        "bash", {"command": "sudo reboot"}, pool), "权限拒绝")

    # 场景 6 · 信箱消费语义
    send("lead", "dave", "你好", "message")
    send("lead", "dave", "再来", "message")
    check("探测有信", str(peek("dave")), "True")
    first = read_inbox("dave")
    check("一次取走两条", str(len(first)), "2")
    check("二读为空", str(len(read_inbox("dave"))), "0")

    # 场景 7 · worktree 绑定与拒删
    V = create_task("改电路")
    check("建屋并绑定", create_worktree("electric", V["id"]), "建 electric")
    check("绑定不改状态", TASKS[V["id"]]["status"], "pending")
    wt = {"path": None}
    check("auto 领 V 进屋", idle_poll("erin", inject, wt), "work")
    check("认领即切目录", str(wt["path"]), "electric")
    WORKTREES["electric"]["changes"] = 2
    check("有改动拒删", remove_worktree("electric"), "拒")
    check("强删成功", remove_worktree("electric", discard_changes=True), "删")

    # 场景 8 · MCP 命名与重建
    check("连 docs", connect_mcp("docs", {"search": lambda q: f"命中:{q}"}),
          "发现 1 个工具")
    check("连 deploy", connect_mcp("deploy", {"search": lambda q: f"部署:{q}"}),
          "发现 1 个工具")
    pool2 = assemble_tool_pool({"bash": lambda command: f"跑:{command}"})
    assert "mcp__docs__search" in pool2 and "mcp__deploy__search" in pool2
    check("前缀防撞调用", pool2["mcp__docs__search"](q="loop"), "命中:loop")
    check("坏名规范化", normalize("my tools!"), "my_tools_")

    print("\n".join(LOG))
    print(f"\nSELFTEST PASSED ✔（{len(ok)} 项断言全绿）")
    return json.dumps({"tasks": TASKS, "events": EVENTS,
                       "pending": PENDING}, ensure_ascii=False, indent=2)


# ── 破坏性实验（每次只拆一个；输出三件套） ────────────────────────────────
def run_break():
    global BREAK
    BREAK = sys.argv[2] if len(sys.argv) > 2 else None
    if BREAK == "B1":      # 拆依赖 fail-closed
        A = create_task("打地基"); B = create_task("盖楼", blockedBy=[A["id"]])
        r = claim_task(B["id"], "alice")
        print(f"[B1] 改动：can_start 恒真（依赖检查放行）\n"
              f"[B1] 实测：被阻塞任务『盖楼』在『打地基』pending 时认领结果 = {r}\n"
              f"[B1] 教训：fail-closed 没了，依赖乱序直接开工")
    elif BREAK == "B2":    # 拆无主守卫（用基线同款边缘样本：pending+有主）
        A = create_task("遗留单")
        A["status"], A["owner"] = "pending", "zed"
        r = claim_task(A["id"], "dave")
        print(f"[B2] 改动：claim 跳过 owner 检查\n"
              f"[B2] 实测：zed 占着的 pending 任务被 dave 认领结果 = {r}；"
              f"终态 owner={A['owner']}\n"
              f"[B2] 教训：无主守卫没了，占坑被顶、后写覆盖前写")
    elif BREAK == "B2v":   # 拆待办状态守卫（基线同款边缘：completed+无主）
        A = create_task("已收尾任务")
        A["status"], A["owner"] = "completed", None
        r = claim_task(A["id"], "bob")
        print(f"[B2v] 改动：claim 跳过 pending 检查\n"
              f"[B2v] 实测：已完成且无人占的任务被再认领 = {r}；"
              f"终态 status={A['status']}\n"
              f"[B2v] 教训：状态闸没了，完成品被重开、活儿重做")
    elif BREAK == "B3":    # 拆消费语义
        send("alice", "lead", "干完报告 A", "result")
        send("alice", "lead", "干完报告 B", "result")
        got1 = read_inbox("lead")
        got2 = read_inbox("lead")
        n1 = len([m for m in got1 if m["content"] == "干完报告 A"])
        n2 = len([m for m in got2 if m["content"] == "干完报告 A"])
        print(f"[B3] 改动：read_inbox 读后不删\n"
              f"[B3] 实测：第一读 {len(got1)} 条（A 出现 {n1} 次）；"
              f"第二读仍 {len(got2)} 条、『干完报告 A』再现 {n2} 次"
              f"（同批消息被二次注入）\n"
              f"[B3] 教训：不消费就重复注入，同一条结果被当新消息反复处理")
    elif BREAK == "B4":    # 拆回执校验
        rid = request("bob", "lead", "plan_approval", "计划X")
        r1 = match_response("shutdown_response", rid, True)
        r2 = match_response("plan_approval_response", rid, True)
        r3 = match_response("plan_approval_response", rid, False)
        print(f"[B4] 改动：match_response 不验类型、不看已决\n"
              f"[B4] 实测：关机类回执对计划单 = {r1}；正确回执 = {r2}；"
              f"重复否决回执 = {r3}；终态 = {PENDING[rid]['status']}\n"
              f"[B4] 教训：错类回执销错单、重复回执翻烧饼")
    elif BREAK == "B5":    # 拆空闲超时
        Z = create_task("占板任务"); claim_task(Z["id"], "zed")  # 两单皆有主，板上真空
        A = create_task("已领"); claim_task(A["id"], "zed")
        result = idle_poll("zed2", inject)
        print(f"[B5] 改动：idle 轮询无超时上限（演示在第 120 步截断，防不可终止）\n"
              f"[B5] 实测：板上无可领任务时 idle_poll 返回 = {result}；"
              f"步进时钟走到 t={_tick}（基线 12 步/t=60 即 timeout 收工，拆掉后多转 10 倍仍不停）\n"
              f"[B5] 教训：没有超时纪律，空闲代理永不收工、白转到底")
    else:
        print("用法：--break B1|B2|B2v|B3|B4|B5"); sys.exit(2)


def demo_race():
    """预测题 T5 实跑：真实认领码是『读盘→检查→写盘』三步两窗口，
    交错时两个认领者都基于旧盘通过检查。确定性演示该窗口。"""
    A = create_task("板上唯一可领任务")
    # 与课程 claim_task 同构的分解：检查（读旧盘）与写盘分离
    def check_pass():
        return A["status"] == "pending" and not A["owner"] and can_start(A["id"])
    c1, c2 = check_pass(), check_pass()      # 交错：两人都在任一方写盘前检查
    A.update(owner="alice", status="in_progress")   # alice 落笔
    w1 = f"alice 检查通过={c1}，落笔 owner=alice"
    A.update(owner="bob", status="in_progress")     # bob 也基于同一旧盘落笔
    w2 = f"bob   检查通过={c2}（读到的仍是旧盘），落笔 owner=bob"
    print(f"[T5race] 实测：{w1}；{w2}；终态 owner={A['owner']}\n"
          f"[T5race] 根源：检查与写盘是两步，中间没有锁——"
          f"两人都在对方落笔前通过了检查（课程自认无文件锁，同型窗口）")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        out = selftest()
        del out  # 原型只打印日志，不在仓库内落盘产物
    elif "--demo" in sys.argv and "t5race" in sys.argv:
        demo_race()
    else:
        run_break()
