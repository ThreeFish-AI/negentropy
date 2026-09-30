#!/usr/bin/env python3
"""cc_async_scheduling_lab — Learn Claude Code s13(后台任务)+s14(cron 调度) 机制的确定性最小原型.

纯标准库、单文件、无随机数；真实线程被替换为「脚本化完成时刻 + 伪时钟逐秒推进」，
配对/去重/队列/锁协议等机制逻辑与教学版逐条对应。本原型回答「机制是否自洽」，
不回答真实线程调度细节，也不回答模型是否聪明（模型角色由脚本序列替代）。

用法: python3 cc_async_scheduling_lab.py --selftest
"""
import json
import sys
import tempfile
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path


SLOW_KEYWORDS = ["install", "build", "test", "deploy", "compile", "docker build",
                 "pip install", "npm install", "cargo build", "pytest", "make"]
BG_TIMEOUT = 120  # 教学版 run_bash 超时（前台后台共用同一执行器——材料事实）

# ── s13: 分派与后台任务 ─────────────────────────────────────────────

def is_slow_operation(tool_name, tool_input):
    if tool_name != "bash":
        return False
    cmd = tool_input.get("command", "").lower()
    return any(kw in cmd for kw in SLOW_KEYWORDS)

def should_run_background(tool_name, tool_input, exp="none"):
    """显式 run_in_background 优先；未指定走启发式。返回 (决定, 依据)。"""
    if tool_input.get("run_in_background"):
        return True, "explicit"
    if exp == "e5":  # 破坏：拔掉启发式兜底
        return False, "sync"
    if is_slow_operation(tool_name, tool_input):
        return True, "heuristic"
    return False, "sync"

class BackgroundTasks:
    """bg_id → {command,status,start,duration}；tick 由伪时钟驱动（替代线程）。"""

    def __init__(self):
        self.tasks, self.results, self.counter = {}, {}, 0

    def start(self, tool_use_id, command, duration_s, now_s):
        self.counter += 1
        bg_id = f"bg_{self.counter:04d}"
        self.tasks[bg_id] = {"tool_use_id": tool_use_id, "command": command,
                             "status": "running", "start": now_s, "duration": duration_s}
        return bg_id

    def tick(self, now_s):
        for bg_id, t in list(self.tasks.items()):
            if t["status"] == "running" and now_s - t["start"] >= min(t["duration"], BG_TIMEOUT):
                t["status"] = "completed"
                if t["duration"] > BG_TIMEOUT:  # 后台路径复用执行器超时
                    self.results[bg_id] = "Error: Timeout (120s)"
                else:  # 冗长构建日志：演示通知摘要 200 字截断
                    self.results[bg_id] = f"ok: {t['command']} ({t['duration']}s)" + "[log]" * 120

    def collect(self):
        notifications = []
        for bg_id, t in list(self.tasks.items()):
            if t["status"] == "completed":
                out = self.results.pop(bg_id)
                self.tasks.pop(bg_id)
                notifications.append(
                    f"<task_notification>\n  <task_id>{bg_id}</task_id>\n"
                    f"  <status>completed</status>\n  <command>{t['command']}</command>\n"
                    f"  <summary>{out[:200]}</summary>\n</task_notification>")
        return notifications

# ── s14: cron 匹配 / 校验 / 调度 ────────────────────────────────────

@dataclass
class CronJob:
    id: str
    cron: str
    prompt: str
    recurring: bool = True
    durable: bool = True

class PoisonCronJob:
    """e1 用：访问 cron 即抛错，模拟坏任务（不改生产代码路径）。"""

    def __init__(self, job_id="poison", prompt="x"):
        self.id, self.prompt, self.recurring, self.durable = job_id, prompt, True, False

    @property
    def cron(self):
        raise ValueError("corrupted job entry")

def _field_matches(fld, value):
    if fld == "*":
        return True
    if fld.startswith("*/"):
        step = int(fld[2:])
        return step > 0 and value % step == 0
    if "," in fld:
        return any(_field_matches(x.strip(), value) for x in fld.split(","))
    if "-" in fld:
        lo, hi = fld.split("-", 1)
        return int(lo) <= value <= int(hi)
    return value == int(fld)

def cron_matches(expr, dt, exp="none"):
    fields = expr.strip().split()
    if len(fields) != 5:
        return False
    minute, hour, dom, month, dow = fields
    dow_val = (dt.weekday() + 1) % 7  # Python Monday=0 → cron Sunday=0
    if not (_field_matches(minute, dt.minute) and _field_matches(hour, dt.hour)
            and _field_matches(month, dt.month)):
        return False
    dom_ok, dow_ok = _field_matches(dom, dt.day), _field_matches(dow, dow_val)
    if exp == "e3" and dom != "*" and dow != "*":  # 破坏：同约束 OR 改 AND
        return dom_ok and dow_ok
    if dom == "*" and dow == "*":
        return True
    if dom == "*":
        return dow_ok
    if dow == "*":
        return dom_ok
    return dom_ok or dow_ok

BOUNDS = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 6)]

def validate_cron(expr):
    fields = expr.strip().split()
    if len(fields) != 5:
        return f"Expected 5 fields, got {len(fields)}"
    names = ["minute", "hour", "day-of-month", "month", "day-of-week"]
    for fld, (lo, hi), name in zip(fields, BOUNDS, names):
        if fld == "*":
            continue
        for part in fld.split(","):
            if part.startswith("*/"):  # 步进（材料 _validate_cron_field 同款）
                step = part[2:]
                if not step.isdigit() or int(step) <= 0:
                    return f"{name}: Invalid step: {part}"
                continue
            if "-" in part:
                a, b = part.split("-", 1)
                if not (a.isdigit() and b.isdigit()):
                    return f"{name}: Invalid range: {part}"
                if not (lo <= int(a) <= hi and lo <= int(b) <= hi):
                    return f"{name}: Range {part} out of bounds [{lo}-{hi}]"
            elif not part.isdigit() or not (lo <= int(part) <= hi):
                return f"{name}: Invalid field: {part}"
    return None

class CronScheduler:
    """判时线程 + 队列（生产端）。dead=True 模拟调度线程被杀死（e1）。"""

    def __init__(self, durable_path, exp="none"):
        self.jobs, self.queue, self.last_fired = {}, [], {}
        self.dead, self.errors, self.exp = False, [], exp
        self.path = Path(durable_path)

    def register(self, job):
        err = None if isinstance(job, PoisonCronJob) else validate_cron(job.cron)
        if err:
            return f"Error: {err}"
        self.jobs[job.id] = job
        if job.durable:
            self.save()
        return f"Scheduled {job.id}"

    def save(self):
        durable = [asdict(j) for j in self.jobs.values()
                   if j.durable and not isinstance(j, PoisonCronJob)]
        self.path.write_text(json.dumps(durable, indent=2))

    def load(self):
        if not self.path.exists():
            return 0
        n = 0
        for j in json.loads(self.path.read_text()):
            job = CronJob(**j)
            if validate_cron(job.cron):
                continue  # 跳过非法表达式，防拖垮启动
            self.jobs[job.id] = job
            n += 1
        return n

    def step(self, dt):
        if self.dead:
            return
        marker = dt.strftime("%H:%M") if self.exp == "e2" else dt.strftime("%Y-%m-%d %H:%M")
        for job in list(self.jobs.values()):
            try:
                if cron_matches(job.cron, dt, self.exp):
                    if self.last_fired.get(job.id) != marker:
                        self.queue.append(job)
                        self.last_fired[job.id] = marker
                    if not job.recurring:
                        self.jobs.pop(job.id, None)
                        if job.durable:
                            self.save()
            except Exception as e:  # 单 job 异常隔离（e1 拆除后上抛致死）
                if self.exp == "e1":
                    self.dead = True
                    raise
                self.errors.append(f"{job.id}: {e}")

class QueueProcessor:
    """交付端：队列有活且 Agent 空闲才注入；抢不到锁=忙=让行。"""

    def __init__(self, sched, transcript, exp="none"):
        self.sched, self.log, self.exp = sched, transcript, exp
        self.walk_aways = 0

    def step(self, dt, agent_busy):
        if not self.sched.queue:
            return
        if agent_busy and self.exp != "e4":  # e4 破坏：无视忙锁硬注入
            self.walk_aways += 1
            return
        if agent_busy:
            self.log.append((dt, "system", "bad-inject", "injected WHILE busy (lock ignored)"))
        for job in self.sched.queue:
            self.log.append((dt, "user", "scheduled", f"[Scheduled] {job.prompt}"))
        self.sched.queue.clear()

# ── 仿真驱动 ────────────────────────────────────────────────────────

def run_simulation(exp="none", verbose=True):
    sched = CronScheduler(Path(tempfile.gettempdir()) / ".cc_async_demo.json", exp)
    proc = QueueProcessor(sched, transcript := [], exp)
    bg = BackgroundTasks()
    base = datetime(2026, 9, 28, 8, 59, 30)  # 周一
    metrics = {"exp": exp}

    # — s13 分派四例（含显式 false 挡不住启发式的怪癖）—
    calls = [("bash", {"command": "pip install torch"}, 600),
             ("bash", {"command": "cat notes.txt"}, 1),
             ("bash", {"command": "cargo build --release",
                       "run_in_background": False}, 50),
             ("bash", {"command": "git status",
                       "run_in_background": True}, 1)]
    decisions, placeholders = [], []
    for name, inp, dur in calls:
        go, why = should_run_background(name, inp, exp)
        decisions.append(why)
        if go:
            placeholders.append(bg.start(f"tu_{len(placeholders)}", inp["command"], dur, 0))
        else:
            transcript.append((base, "user", "tool_result", f"ok: {inp['command']} (1s)"))
    metrics["decisions"] = decisions
    metrics["turn_block_s"] = 600 if decisions[0] == "sync" else 0  # e5 度量
    if verbose:
        print("dispatch:", decisions)

    for s in range(1, 131):  # 伪时钟推 130s：后台完成/超时
        bg.tick(s)
    notes = bg.collect()
    pip_notes = [n for n in notes if "pip" in n]
    cargo_notes = [n for n in notes if "cargo" in n]
    metrics["pip_note"] = pip_notes[0] if pip_notes else "(no bg task — sync path)"
    metrics["cargo_note"] = cargo_notes[0] if cargo_notes else "(no bg task — sync path)"
    metrics["cargo_summary_len"] = (len(cargo_notes[0].split("<summary>")[1].split("</summary>")[0])
                                    if cargo_notes else -1)
    if verbose:
        print("pip 通知末行:", metrics["pip_note"].splitlines()[-2].strip())
        print("cargo 摘要长度(截断于200):", metrics["cargo_summary_len"])

    # — s14 注册 + 毒任务 + 双日推进 —
    sched.register(CronJob("cron_000001", "*/2 * * * *", "run date"))
    sched.register(CronJob("cron_000002", "0 9 * * *", "morning tests"))
    sched.register(CronJob("cron_000003", "0 9 * * *", "one-shot report", recurring=False))
    sched.jobs["poison"] = PoisonCronJob()
    state = {"busy_until": None, "day1": 0, "day2": 0, "inj_busy": False}

    def advance(start, end):
        now = start
        while now <= end:
            try:
                sched.step(now)
            except Exception:  # e1：调度线程死亡，仿真继续观察下游
                pass
            busy = state["busy_until"] is not None and now < state["busy_until"]
            before = len(transcript)
            proc.step(now, busy)
            for row in transcript[before:]:
                if busy and row[2] in ("scheduled", "bad-inject"):
                    state["inj_busy"] = True
                if "morning tests" in row[3]:
                    state["day1" if now.day == 28 else "day2"] += 1
            now += timedelta(seconds=1)

    state["busy_until"] = base + timedelta(seconds=35)  # 8:59:30..9:00:05 忙（脚本长回合）
    advance(base, base + timedelta(seconds=40))
    advance(datetime(2026, 9, 29, 8, 59, 0), datetime(2026, 9, 29, 9, 0, 30))
    metrics.update(day1_fires=state["day1"], day2_fires=state["day2"],
                   walk_aways=proc.walk_aways, scheduler_dead=sched.dead,
                   injected_while_busy=state["inj_busy"], poison_errors=len(sched.errors),
                   oneshot_gone="cron_000003" not in sched.jobs)
    metrics["durable_reloaded"] = sched.load()
    if verbose:
        print(f"day1={state['day1']} day2={state['day2']} walk_aways={proc.walk_aways} "
              f"dead={sched.dead} inj_busy={state['inj_busy']} "
              f"poison_errs={len(sched.errors)} oneshot_gone={metrics['oneshot_gone']} "
              f"durable_reload={metrics['durable_reloaded']}")
    return sched, transcript, metrics

# ── selftest 与破坏性实验 ───────────────────────────────────────────

def expect(cond, msg):
    if not cond:
        print(f"ASSERT FAIL: {msg}")
        sys.exit(1)

def report(eid, what, observed, lesson):
    print(f"[{eid}] 改了什么: {what}\n     实测: {observed}\n     教训: {lesson}")

def selftest():
    print("== cron 语义单测 ==")
    mon9 = datetime(2026, 9, 28, 9, 0)
    expect(cron_matches("0 9 * * 1-5", mon9), "weekday match")
    expect(not cron_matches("0 9 * * 1-5", datetime(2026, 10, 4, 9, 0)), "sunday no")
    expect(cron_matches("0 9 1 * 1", mon9), "DOM/DOW OR: dow hits")
    expect(not cron_matches("30 8 * * *", mon9), "minute and-gate")
    expect("minute" in validate_cron("61 * * * *"), "minute bounds")
    expect("Expected 5 fields" in validate_cron("* * * *"), "field count")
    expect("hour" in validate_cron("0 25 * * *"), "hour bounds")
    print("cron unit: OK")

    print("== 基线仿真 ==")
    _, _, m = run_simulation("none")
    expect(m["decisions"] == ["heuristic", "sync", "heuristic", "explicit"],
           f"dispatch {m['decisions']}")
    expect("Error: Timeout (120s)" in m["pip_note"], "bg reuses 120s timeout")
    expect("bg_0001" in m["pip_note"] and "pip install torch" in m["pip_note"],
           "notification identity")
    expect(m["cargo_summary_len"] == 200, f"summary truncation {m['cargo_summary_len']}")
    expect(m["day1_fires"] == 1 and m["day2_fires"] == 1, "date-aware marker fires both days")
    expect(m["walk_aways"] > 0, "processor yields while busy")
    expect(not m["injected_while_busy"], "no mid-turn injection")
    expect(m["scheduler_dead"] is False and m["poison_errors"] >= 1, "poison isolated")
    expect(m["oneshot_gone"], "one-shot removed after fire")
    expect(m["durable_reloaded"] >= 2, "durable reload")
    print("baseline: OK")

    print("== 破坏性实验（三件套，base→broken）==")
    _, _, b = run_simulation("none", verbose=False)

    _, _, x = run_simulation("e1", verbose=False)
    expect(x["scheduler_dead"] and x["day1_fires"] + x["day2_fires"] == 0, "e1 degrade")
    report("e1", "拆除单 job 异常隔离（毒任务异常直接上抛）",
           f"dead={b['scheduler_dead']}→{x['scheduler_dead']}; "
           f"fires={b['day1_fires'] + b['day2_fires']}→{x['day1_fires'] + x['day2_fires']}; "
           f"poison_errs={b['poison_errors']}→{x['poison_errors']}",
           "一条坏任务若不被隔离，杀死的是整个调度线程——全部定时静默停摆")

    _, _, x = run_simulation("e2", verbose=False)
    expect(x["day2_fires"] == 0, "e2 degrade")
    report("e2", "minute_marker 去掉日期（只记 时:分）",
           f"day1={b['day1_fires']}→{x['day1_fires']}; day2={b['day2_fires']}→{x['day2_fires']}",
           "去重记号不带日期，第二天同分钟被昨日记录挡住，每日任务变成只跑一天")

    base_or = cron_matches("0 9 1 * 1", mon9)
    broken_or = cron_matches("0 9 1 * 1", mon9, "e3")
    expect(base_or and not broken_or, "e3 degrade")
    report("e3", "DOM/DOW 同约束时 OR 改 AND",
           f"'0 9 1 * 1'@周一(日≠1,星期=一): {base_or}→{broken_or}",
           "同约束 OR 是 Unix cron 五十年语义，按直觉改成 AND 会静默漏触发")

    _, _, x = run_simulation("e4", verbose=False)
    expect(x["injected_while_busy"] and x["walk_aways"] == 0, "e4 degrade")
    report("e4", "交付线程无视忙锁硬注入",
           f"inj_busy={b['injected_while_busy']}→{x['injected_while_busy']}; "
           f"walk_aways={b['walk_aways']}→{x['walk_aways']}",
           "无视忙锁硬注入=打断进行中的回合，单写者不变量被破坏")

    _, _, x = run_simulation("e5", verbose=False)
    expect(x["turn_block_s"] == 600 and x["decisions"][0] == "sync", "e5 degrade")
    report("e5", "拔掉启发式兜底（未显式请求一律同步）",
           f"pip 分派={'heuristic' if b['decisions'][0] == 'heuristic' else '?'}→"
           f"{x['decisions'][0]}; 主循环阻塞={b['turn_block_s']}s→{x['turn_block_s']}s",
           "没有启发式兜底，模型忘说『丢后台』时主循环原地干等全程烧 token")

    print("SELFTEST PASSED ✔")

if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        print(__doc__)
