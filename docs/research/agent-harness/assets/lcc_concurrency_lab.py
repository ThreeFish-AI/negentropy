#!/usr/bin/env python3
"""Background Tasks 与 Cron Scheduler 的最小教学原型（纯标准库、确定性）。

机制出自 Learn Claude Code「并发」部分（站点轨 s13/s14 @67a9126c，main 轨
s11/s12 @ce8f9f18 对照），从机制新写：模型用脚本化 mock，只回答机制自洽；
调度用注入时刻序列（虚拟时钟），后台线程用真实线程+join 保证确定。
用法：--selftest 全场景断言；--break <no-minute-dedupe|no-agent-lock|slow-poll|
reuse-tool-use-id|heuristic-only|dateless-marker> 单点破坏性实验（沙箱独立目录）。
"""
import argparse
import json
import sys
import threading
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

# ── 破坏开关（默认全关；--break 只开一个）────────────────────────────
BREAK = None

# ── 机制 1：should_run_background —— 判定权（显式参数优先/仅显式/仅启发式）──
SLOW_KEYWORDS = ("install", "build", "test", "deploy", "compile", "make")

def is_slow_operation(tool_name, tool_input):
    """站点轨启发式兜底：按关键词猜「大概率 >30s」；会误判。"""
    if tool_name != "bash":
        return False
    cmd = tool_input.get("command", "").lower()
    return any(kw in cmd for kw in SLOW_KEYWORDS)

def should_run_background(tool_name, tool_input):
    """站点轨：显式请求优先，启发式兜底。BREAK=heuristic-only 时反向只认关键词。"""
    explicit = tool_input.get("run_in_background") is True
    if BREAK == "heuristic-only":
        return is_slow_operation(tool_name, tool_input)
    if explicit:
        return True
    return is_slow_operation(tool_name, tool_input)

# ── 机制 2：BackgroundManager —— 后台执行与生命周期 ──────────────────
# 命令表：名字 → (输出, 模拟耗时秒, 实际 sleep 秒)。同步执行把模拟耗时累加进
# BLOCKED_SECONDS（衡量「对话被卡住的秒数」），后台执行由 daemon 线程消化，为 0。
COMMANDS = {
    "build all": ("built 42 targets", 120, 0.01),
    "read config": ("[config] mode=fast", 0, 0.0),
    "grep install notes.txt": ("install: mentioned on line 3", 0, 0.0),
    "vendor reindex --slow": ("reindexed 9000 files", 600, 0.01),
}
BLOCKED_SECONDS = 0.0

def run_tool_command(command):
    output, cost, nap = COMMANDS.get(command, (f"(no output) [{command}]", 0, 0.0))
    if nap:
        time.sleep(nap)
    return output, cost

class BackgroundManager:
    """登记任务 → daemon 线程执行 → 完成入 ready 队列；collect 取走并格式化通知。"""

    def __init__(self):
        self.tasks = {}          # bg_id → {tool_use_id, command, status}
        self.results = {}
        self._ready = []
        self._counter = 0
        self._lock = threading.Lock()
        self.threads = []

    def start(self, tool_use_id, command):
        with self._lock:
            self._counter += 1
            bg_id = f"bg_{self._counter:04d}"
            self.tasks[bg_id] = {"tool_use_id": tool_use_id,
                                 "command": command, "status": "running"}
        thread = threading.Thread(target=self._run, args=(bg_id, command), daemon=True)
        with self._lock:
            self.threads.append(thread)
        thread.start()
        return bg_id

    def _run(self, bg_id, command):
        output, _cost = run_tool_command(command)
        with self._lock:
            self.tasks[bg_id]["status"] = "completed"
            self.results[bg_id] = output
            self._ready.append(bg_id)

    def collect(self):
        with self._lock:
            ready = [(i, self.tasks.pop(i), self.results.pop(i, "")) for i in self._ready]
            self._ready.clear()
        notes = []
        for bg_id, task, output in ready:
            if BREAK == "reuse-tool-use-id":
                notes.append({"kind": "tool_result",
                              "tool_use_id": task["tool_use_id"],
                              "content": output})          # 破坏：复用原调用编号
            else:
                notes.append({"kind": "task_notification", "task_id": bg_id,
                              "status": task["status"],
                              "command": task["command"], "summary": output})
        return notes

    def join(self):
        with self._lock:
            threads = list(self.threads)
        for t in threads:
            t.join()

BACKGROUND = BackgroundManager()

def note_to_block(note):
    if note["kind"] == "task_notification":
        return {"type": "text", "text":
                f"<task_notification>\n  <task_id>{note['task_id']}</task_id>\n"
                f"  <status>{note['status']}</status>\n"
                f"  <command>{note['command']}</command>\n"
                f"  <summary>{note['summary']}</summary>\n</task_notification>"}
    return {"type": "tool_result", "tool_use_id": note["tool_use_id"], "content": note["content"]}

# ── 机制 3：agent_loop —— 占位回执 + 通知注入（脚本化模型，确定性）────
def agent_loop(session, scripted_turns):
    """轮次循环：先注入通知 → 取一轮脚本化模型输出 → 分派工具（后台/同步）→ 回填。"""
    for note in BACKGROUND.collect():
        session.append({"role": "user", "content": [note_to_block(note)]})
    for turn in scripted_turns:
        calls = [{"id": c["id"], "name": c["name"], "input": c["input"]}
                 for c in turn["calls"]]
        session.append({"role": "assistant",
                        "content": [{"type": "text", "text": turn.get("say", "")}] +
                                    [{"type": "tool_use", **c} for c in calls]})
        results = []
        for c in calls:
            if should_run_background(c["name"], c["input"]):
                bg_id = BACKGROUND.start(c["id"], c["input"]["command"])
                results.append({"type": "tool_result", "tool_use_id": c["id"],
                                "content": f"[Background task {bg_id} started] "
                                           f"Result will arrive as a notification."})
            else:
                output, cost = run_tool_command(c["input"]["command"])
                global BLOCKED_SECONDS
                BLOCKED_SECONDS += cost
                results.append({"type": "tool_result", "tool_use_id": c["id"], "content": output})
        session.append({"role": "user", "content": results})

# ── 机制 4：cron_matches —— 五段式匹配（DOM/DOW 同时受限取 OR）────────
def _field_matches(field_expr, value):
    if field_expr == "*":
        return True
    if field_expr.startswith("*/"):
        step = int(field_expr[2:])
        return step > 0 and value % step == 0
    if "," in field_expr:
        return any(_field_matches(f.strip(), value)
                   for f in field_expr.split(","))
    if "-" in field_expr:
        lo, hi = field_expr.split("-", 1)
        return int(lo) <= value <= int(hi)
    return value == int(field_expr)

def cron_matches(cron_expr, moment):
    fields = cron_expr.strip().split()
    if len(fields) != 5:
        return False
    minute, hour, dom, month, dow = fields
    dow_val = (moment.weekday() + 1) % 7        # Python 周一=0 → cron 周日=0
    if not (_field_matches(minute, moment.minute)
            and _field_matches(hour, moment.hour)
            and _field_matches(month, moment.month)):
        return False
    dom_ok = _field_matches(dom, moment.day)
    dow_ok = _field_matches(dow, dow_val)
    if dom == "*" and dow == "*":
        return True
    if dom == "*":
        return dow_ok
    if dow == "*":
        return dom_ok
    return dom_ok or dow_ok                    # 两者都受限 → OR（vixie-cron 语义）

# ── 机制 5：CronJob 与 durable 存取 ──────────────────────────────────
@dataclass
class CronJob:
    id: str
    cron: str
    prompt: str
    recurring: bool = True
    durable: bool = False
    pending_delivery: bool = False             # main 轨：已入队未确认（至少一次交付）

class CronStore:
    def __init__(self, root: Path):
        self.jobs = {}
        self.queue = []
        self.lock = threading.Lock()
        self.path = root / ".scheduled_tasks.json"
        self.last_fired = {}

    def schedule(self, cron, prompt, job_id, recurring=True, durable=False):
        job = CronJob(job_id, cron, prompt, recurring, durable)
        with self.lock:
            self.jobs[job_id] = job
            if durable:
                self._save_locked()
        return job

    def _save_locked(self):
        payload = [asdict(j) for j in self.jobs.values() if j.durable]
        self.path.write_text(json.dumps(payload, indent=2))

    def load(self):
        if not self.path.exists():
            return
        for item in json.loads(self.path.read_text()):
            job = CronJob(**item)
            self.jobs[job.id] = job
            if job.pending_delivery:           # 崩溃前已到点未确认 → 重新入队
                self.queue.append(job)

    def poll(self, moment):
        """调度线程一轮：匹配即入队；分钟标记去重；一次性任务触发后删除。"""
        fmt = "%H:%M" if BREAK == "dateless-marker" else "%Y-%m-%d %H:%M"
        marker = moment.strftime(fmt)
        fired = []
        with self.lock:
            for job in list(self.jobs.values()):
                if cron_matches(job.cron, moment):
                    dedupe = (BREAK != "no-minute-dedupe")
                    if dedupe and self.last_fired.get(job.id) == marker:
                        continue
                    self.last_fired[job.id] = marker
                    job.pending_delivery = True
                    if job.durable:
                        self._save_locked()      # main 轨：先落盘「待交付」再入队
                    self.queue.append(job)
                    fired.append(job.id)
                    if not job.recurring:
                        self.jobs.pop(job.id)
                        if job.durable:
                            self._save_locked()
        return fired

    def consume(self):
        with self.lock:
            jobs, self.queue = list(self.queue), []
            return jobs

    def acknowledge(self, jobs):
        with self.lock:
            for job in jobs:
                job.pending_delivery = False
            if any(j.durable for j in jobs):
                self._save_locked()

# ── 机制 6：queue processor —— 空闲锁交付（把「到点了」接到「有空了」）──
AGENT_LOCK = threading.Lock()
DELIVERED = []          # (轮次标签, 注入的 prompt)

def drain_queue(store, session_runner):
    """交付线程一轮：队列有活且持到空闲锁 → 拉起一轮。"""
    if not store.queue:
        return False
    if BREAK == "no-agent-lock" and store.queue:   # 破坏：不持锁硬闯
        jobs = store.consume()
        session_runner("scheduled", [j.prompt for j in jobs])
        store.acknowledge(jobs)
        return True
    if not AGENT_LOCK.acquire(blocking=False):
        return False
    try:
        if not store.queue:
            return False
        jobs = store.consume()
        session_runner("scheduled", [j.prompt for j in jobs])
        store.acknowledge(jobs)
        return True
    finally:
        AGENT_LOCK.release()

# ── 场景与断言 ────────────────────────────────────────────────────────
def sandbox_dir(name):
    """实验沙箱：系统临时目录下独立建区，每次运行前整体重建（不污染脚本所在目录）。"""
    import shutil
    import tempfile
    root = Path(tempfile.gettempdir()) / "lcc-concurrency-sandbox" / name
    shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True)
    return root

def sc_bg_lifecycle():
    session = []
    agent_loop(session, [{"say": "kick off",
                          "calls": [{"id": "tu_1", "name": "bash",
                                     "input": {"command": "build all",
                                               "run_in_background": True}},
                                    {"id": "tu_2", "name": "bash",
                                     "input": {"command": "read config"}}]}])
    BACKGROUND.join()
    assert "[Background task bg_0001 started]" in session[1]["content"][0]["content"]
    assert session[1]["content"][1]["content"] == "[config] mode=fast"
    assert not any("built 42 targets" in str(b) for b in session[1]["content"])
    agent_loop(session, [{"say": "wrap", "calls": []}])
    first = session[2]["content"][0]
    note = first.get("text", first.get("content", ""))
    if BREAK != "reuse-tool-use-id":
        assert "<task_id>bg_0001</task_id>" in note and "built 42 targets" in note
    else:
        assert first["type"] == "tool_result" and first["tool_use_id"] == "tu_1"
    assert BACKGROUND.collect() == []           # 通知只送一次
    dup = count_dup_tool_use_ids(session)
    assert (dup == 0) != (BREAK == "reuse-tool-use-id")
    return {"turn1_placeholder": "bg_0001", "notification_turn": "turn2",
            "dup_tool_use_id": dup}

def count_dup_tool_use_ids(session):
    seen, dup = set(), 0
    for m in session:
        for b in m["content"]:
            if isinstance(b, dict) and b.get("type") == "tool_result":
                dup += b["tool_use_id"] in seen
                seen.add(b["tool_use_id"])
    return dup

def sc_heuristic_misfire():
    wrong = should_run_background("bash", {"command": "grep install notes.txt"})
    right = should_run_background("bash", {"command": "grep install notes.txt",
                                           "run_in_background": False})
    assert wrong is True and right is True, (wrong, right)   # 两路都误判：显式 False 压不住关键词
    return {"keyword_misfire_without_flag": wrong,
            "keyword_misfire_with_explicit_false": right,
            "note": "站点轨：显式 False 压不住关键词兜底 → 仍判后台（误判演示）"}

def sc_explicit_only():
    """显式请求后台的长命令（名字不含关键词）→ 正常进后台、对话零阻塞；
    BREAK=heuristic-only 时判定权只剩关键词 → 该命令被误判为快、同步执行。"""
    verdict = should_run_background(
        "bash", {"command": "vendor reindex --slow",
                 "run_in_background": True})
    session = []
    agent_loop(session, [{"say": "reindex in background, then read config",
                          "calls": [{"id": "tu_r", "name": "bash",
                                     "input": {"command": "vendor reindex --slow",
                                               "run_in_background": True}}]}])
    BACKGROUND.join()
    blocked = round(BLOCKED_SECONDS, 1)
    if BREAK is None:
        assert verdict is True and blocked == 0.0
    elif BREAK == "heuristic-only":
        assert verdict is False and blocked == 600.0
    return {"explicit_bg_verdict": verdict, "blocked_sim_seconds": blocked,
            "note": "heuristic-only：显式请求被关键词否决 → 同步卡 600 模拟秒"
                    if BREAK == "heuristic-only"
                    else "main 轨：仅显式参数；无关键词的长命令照样进后台"}

def sc_cron_or():
    cases = [
        ("0 9 13 * 5", datetime(2026, 10, 13, 9, 0), True),   # 周二但 13 号
        ("0 9 13 * 5", datetime(2026, 10, 14, 9, 0), False),  # 周三 14 号
        ("0 9 13 * 5", datetime(2026, 10, 16, 9, 0), True),   # 周五 16 号
        ("0 9 13 * 5", datetime(2026, 10, 16, 9, 5), False),  # 分钟不匹配
        ("*/2 * * * *", datetime(2026, 10, 13, 9, 2), True),
        ("0 9 * * 1-5", datetime(2026, 10, 11, 9, 0), False), # 周日
        ("0 9 * * 1-5", datetime(2026, 10, 13, 9, 0), True),  # 周二（区间）
    ]
    bad = [(e, str(t)) for e, t, want in cases if cron_matches(e, t) != want]
    assert not bad, bad
    return {"checked": len(cases), "dom_dow_or": "日位与星期位同时受限 → 任一命中即触发（7 例断言全过）"}

def sc_minute_dedupe():
    root = sandbox_dir("dedupe")
    store = CronStore(root)
    store.schedule("*/2 * * * *", "run date", "cron_a")
    start = datetime(2026, 10, 13, 8, 59, 0)
    fires = []
    for t in range(1, 361):                     # 6 分钟窗口、每秒一轮
        moment = start + timedelta(seconds=t)
        fires += store.poll(moment)
    n = len(fires)
    store.schedule("0 9 * * *", "daily", "cron_daily")   # 每日 9:00 任务
    d1 = "cron_daily" in store.poll(datetime(2026, 10, 13, 9, 0))  # 第一天
    d2 = "cron_daily" in store.poll(datetime(2026, 10, 14, 9, 0))  # 第二天同刻
    if BREAK is None:
        assert n == 3 and d1 and d2, (n, d1, d2)
    elif BREAK == "no-minute-dedupe":
        assert n == 180, n
    elif BREAK == "dateless-marker":
        assert d1 and not d2, (d1, d2)  # 标记无日期 → 次日同刻被误判「已触发」而跳过
    return {"window": "6min@1s-tick (*/2 任务)", "enqueue_count": n,
            "daily_job_day2_fires": d2,
            "degradation": "60x（匹配分钟内每秒重复入队）" if n == 180 else "-"}

def sc_slow_poll():
    root = sandbox_dir("slowpoll")
    store = CronStore(root)
    store.schedule("* * * * *", "run date", "cron_b")
    start = datetime(2026, 10, 13, 9, 0, 0)     # 覆盖 9:00-9:04 五个整分钟
    step = 130 if BREAK == "slow-poll" else 1
    fires = []
    t = step
    while t < 300:                             # 覆盖 9:00:00-9:04:59 五个整分钟
        fires += store.poll(start + timedelta(seconds=t))
        t += step
    n = len(fires)
    if BREAK is None:
        assert n == 5, n
    elif BREAK == "slow-poll":
        assert n == 2, n
    return {"window": "5min (每分钟任务)", "tick_step_s": step, "fires": n,
            "degradation": f"漏 {5 - n}/5 个分钟" if step == 130 else "-"}

def sc_queue_delivery():
    root = sandbox_dir("delivery")
    store = CronStore(root)
    store.schedule("*/2 * * * *", "run date", "cron_c", durable=True)
    start = datetime(2026, 10, 13, 8, 59, 0)
    for t in range(1, 61):
        store.poll(start + timedelta(seconds=t))

    def runner(tag, prompts):
        for p in prompts:
            DELIVERED.append((tag, f"[Scheduled] {p}"))

    assert drain_queue(store, runner) is True
    assert store.queue == [] and DELIVERED == [("scheduled", "[Scheduled] run date")]
    assert store.jobs["cron_c"].pending_delivery is False
    return {"delivered_without_user_input": True, "prompts": DELIVERED[:]}

def sc_durable_and_at_least_once():
    root = sandbox_dir("durable")
    store = CronStore(root)
    store.schedule("0 9 * * *", "run tests", "cron_d", durable=True)
    store.schedule("0 9 * * *", "run lint", "cron_e", durable=False)
    store.poll(datetime(2026, 10, 14, 9, 0))     # cron_d 到点入队
    rebooted = CronStore(root)
    rebooted.load()                              # 「进程重启」：只从磁盘恢复
    requeued = [j.id for j in rebooted.queue]
    ids = sorted(rebooted.jobs)
    assert requeued == ["cron_d"], requeued      # 待交付任务重回队列（至少一次）
    assert ids == ["cron_d"], ids                # session-only 不落盘
    return {"after_reboot_jobs": ids, "requeued_pending": requeued,
            "note": "durable 只恢复定义；已到点未确认的任务重新入队补交付一次"}

def sc_one_shot_removal():
    root = sandbox_dir("oneshot")
    store = CronStore(root)
    store.schedule("0 10 * * *", "check build", "cron_f",
                   recurring=False, durable=True)
    store.poll(datetime(2026, 10, 13, 10, 0))
    assert "cron_f" not in store.jobs and store.path.exists()
    after = json.loads(store.path.read_text())
    assert after == [], after
    next_day_fires = store.poll(datetime(2026, 10, 14, 10, 0))  # 次日同刻
    assert next_day_fires == [] and "cron_f" not in store.jobs
    assert sum(1 for j in store.queue if j.id == "cron_f") == 1  # 只入队一次
    return {"one_shot": "触发即删，落盘文件同步清空", "next_day_fires": next_day_fires}

def sc_agent_lock_interleave():
    """无锁交付 vs 持锁交付：两回合并发写同一份会话的穿插计数（确定性交替编排）。"""
    session, gate_u, gate_s = [], threading.Event(), threading.Event()

    def user_turn():
        for i in range(5):
            gate_s.wait(); gate_s.clear()
            session.append(f"U{i+1}"); gate_u.set()

    def scheduled_turn():
        for i in range(5):
            gate_u.wait(); gate_u.clear()
            session.append(f"S{i+1}"); gate_s.set()

    if BREAK == "no-agent-lock":                # 破坏：不持锁，两回合交错写会话
        gate_s.set()
        tu, ts = threading.Thread(target=user_turn), threading.Thread(target=scheduled_turn)
        tu.start(); ts.start(); tu.join(); ts.join()
    else:                                       # 持锁：串行，零穿插
        with AGENT_LOCK:
            session[:] = [f"U{i+1}" for i in range(5)] + [f"S{i+1}" for i in range(5)]
    switches = sum(1 for a, b in zip(session, session[1:]) if a[0] != b[0])
    if BREAK == "no-agent-lock":                # 破坏：两回合逐位交错 → 交替序、9 次切换
        assert "".join(session) == "U1S1U2S2U3S3U4S4U5S5" and switches == 9, (session, switches)
    else:                                       # 持锁：串行 → 用户轮整体在前、仅 1 次切换
        assert "".join(session) == "U1U2U3U4U5S1S2S3S4S5" and switches == 1, (session, switches)
    return {"session_order": "".join(session), "turn_switches": switches}

SCENARIOS = [("bg_lifecycle", sc_bg_lifecycle), ("heuristic_misfire", sc_heuristic_misfire),
             ("explicit_only", sc_explicit_only), ("cron_or", sc_cron_or),
             ("minute_dedupe", sc_minute_dedupe), ("slow_poll", sc_slow_poll),
             ("queue_delivery", sc_queue_delivery),
             ("durable_at_least_once", sc_durable_and_at_least_once),
             ("one_shot_removal", sc_one_shot_removal),
             ("agent_lock_interleave", sc_agent_lock_interleave)]

def main():
    global BREAK
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--break", dest="brk", choices=["no-minute-dedupe", "no-agent-lock", "slow-poll", "reuse-tool-use-id", "heuristic-only", "dateless-marker"])
    args = ap.parse_args()
    BREAK = args.brk
    sandbox_dir("common")
    results = {}
    for name, fn in SCENARIOS:
        results[name] = fn()
        print(f"[scenario] {name}: OK")
    for name, res in results.items():
        print(f"  {name}: {res}")
    if args.selftest:
        print("SELFTEST PASSED ✔")

if __name__ == "__main__":
    main()
