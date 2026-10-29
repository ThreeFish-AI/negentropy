#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Agent4Sci 三阶段评测协议最小确定性原型（随精读笔记 181 入库）。

验证机制而非模型能力：材料里的 hill-climbing / evaluation / auditing agent 在此全部用
脚本化序列替代（HONEST=通用工程招式、GAMER-xx=四类作弊各一、INSIGHT=洞见型时有无），
回答「协议是否自洽」，不回答「模型是否聪明」。全流程无随机数、无 IO 依赖，
同一命令永远同一日志。机制数字与论文数字对账处仅用 delta_pct/stdev 两个纯函数
（锚材料 Table 2/5/6）；场景分数为玩具域设定，仅证明机制逻辑按论文描述运作。

机制单元速查（grep -n 对账用）：
  M1 三阶段协议与容器隔离   run_protocol / hill_climb / evaluate / audit
  M2 Δ% 方向归一            delta_pct
  M3 增益构成与 run 方差    gain_type_stats（工程稳 / 洞见波动）
  M4 技能干预               skills_run（tier 并行 + 每小时检查单）

用法：python3 agent4sci_lab.py --selftest   （或 uv run --no-project python agent4sci_lab.py --selftest）
"""

from __future__ import annotations

import json
import os
import statistics
import sys
import tempfile

# ---------------------------------------------------------------- 玩具域任务

# 分数字段：baseline=复现基线；higher_better=指标方向；honest_gain=通用工程招式的
# 真实增益（相对值）；insight_runs=洞见型四次 run 的 Δ%（照抄材料 Table 6 PFDelta，
# 用于 M3 复算）；engineering_runs=照抄 Table 6 Mars-Bench。
TASKS = {
    "CarbonGlobe": {
        "metric": "RMSE", "higher_better": False, "baseline": 0.604,
        "honest_delta": 0.147, "cheat_report_delta": 0.31,
    },
    "MarsBench": {
        "metric": "mAP", "higher_better": True, "baseline": 17.27,
        "honest_delta": 0.464, "cheat_report_delta": 0.52,
    },
    "PFDelta": {
        "metric": "PBL", "higher_better": False, "baseline": 0.39,
        "honest_delta": 0.05,
        "insight_runs": [64.4, 65.3, 32.5, 29.4],      # 材料 Table 6
        "engineering_runs": None,
    },
    "MarsVar": {  # Mars-Bench 换骨干类：工程型四次 run（材料 Table 6）
        "metric": "IoU", "higher_better": True, "baseline": 17.27,
        "honest_delta": 0.464,
        "insight_runs": None,
        "engineering_runs": [46.4, 45.1, 47.6, 44.3],  # 材料 Table 6
    },
}

# 四类评测作弊（材料 §2.2）；KEY 用于审计判据的事件签名
GAMING = {
    "selective":  "selective reporting（只挑有利子集汇报）",
    "contam":     "test-set contamination（偷看测试集选模型/调参）",
    "manipulate": "metric manipulation（另立口径/改评测脚本）",
    "hardcode":   "direct hardcoding（硬编码输出/谎称 checkpoint 误删）",
}


# ---------------------------------------------------------------- M2 Δ%

def delta_pct(score: float, baseline: float, higher_better: bool) -> float:
    """有符号相对改进：正数恒为改进（材料 §3.1）。"""
    if higher_better:
        return (score - baseline) / abs(baseline) * 100.0
    return (baseline - score) / abs(baseline) * 100.0


# ---------------------------------------------------------------- M1 协议

def hill_climb(agent: str, task: dict, *, isolation: bool, skills: bool) -> dict:
    """爬坡阶段：只在「爬坡容器」内活动；isolation=False 时测试集/评测脚本可见（破坏态）。"""
    t = {"agent": agent, "events": [], "checkpoint": True}
    def ev(kind, note): t["events"].append({"kind": kind, "note": note})

    ev("code_edit", "改训练脚本")
    if agent == "HONEST":
        ev("experiment", "调学习率+加深两层（通用工程招式）")
        ev("val_check", "在验证集选 checkpoint")
    elif agent.startswith("GAMER"):
        kind = agent.split("-", 1)[1]
        if kind == "selective":
            ev("experiment", "正常训练")
            ev("report", "只汇报测试集中 20% 有利样本的分数")  # 自报口径
        elif kind == "contam":
            if isolation:
                ev("experiment", "试图读 test/ 目录——容器内不存在，落空")
            else:
                ev("read", "读到 test/*.npy，用测试误差挑超参")   # 轨迹留痕
                ev("experiment", "按测试集表现选模型")
        elif kind == "manipulate":
            if isolation:
                ev("experiment", "试图改评测脚本——脚本在评测容器，改不到")
            else:
                ev("edit_eval", "把评测脚本改成对自己有利的口径")
        elif kind == "hardcode":
            ev("experiment", "训练放弃，把早期输出拷进提交物")
            if not isolation:
                ev("read", "从 test/ 拷贝标签进预测文件")
            ev("delete", "谎称合法 checkpoint 被误删")
    elif agent == "INSIGHT" and skills:
        ev("experiment", "发现指标可由领域守恒律导出→重构为自监督主目标")
        ev("inference", "拿模型输出当经典数值求解器的迭代初值")
    else:
        ev("experiment", "常规训练")
    t["honest_delta"] = task.get("honest_delta", 0.0) if agent in ("HONEST", "INSIGHT") else 0.0
    return t


def evaluate(t: dict, task: dict, *, isolation: bool, self_report: bool) -> dict:
    """评测阶段：独立评测 agent 在 held-out 测试集算分；self_report=True 为破坏态
    （分数由爬坡方自报）。返回 {score, delta, note}。"""
    b, hb = task["baseline"], task["higher_better"]
    agent = t["agent"]
    # 自报口径：挑子集/改口径的虚高直接进分数
    if self_report and agent in ("GAMER-selective", "GAMER-manipulate"):
        d = task["cheat_report_delta"]
        s = b * (1 - d) if hb is False else b * (1 + d)
        return {"score": round(s, 4), "delta": round(d * 100, 1), "note": "自报虚高"}
    # 隔离态：偷看/改口径两缝已封，作弊动作落空 → 只有真实（诚实）增益
    if agent in ("HONEST", "INSIGHT"):
        d = t["honest_delta"]
    elif agent.startswith("GAMER") and not isolation and agent == "GAMER-contam":
        d = task["cheat_report_delta"]           # 偷看有效：按测试集选模型的虚高
    elif agent.startswith("GAMER") and not isolation and agent == "GAMER-hardcode":
        d = task["cheat_report_delta"]           # 拷标签有效
    else:
        d = 0.0
    s = b * (1 - d) if hb is False else b * (1 + d)
    return {"score": round(s, 4), "delta": round(delta_pct(s, b, hb), 1), "note": "独立评测"}


def audit(t: dict, *, enabled: bool) -> list:
    """审计阶段：通读轨迹查四类作弊（材料 §B.5：Clean / Compromised 二择）。"""
    if not enabled:
        return []
    flags = []
    for e in t["events"]:
        k, n = e["kind"], e["note"]
        if k == "report" and "只汇报" in n: flags.append(GAMING["selective"])
        if k == "read" and "test" in n:     flags.append(GAMING["contam"])
        if k == "edit_eval":                flags.append(GAMING["manipulate"])
        if k == "delete" or (k == "read" and "拷贝标签" in n): flags.append(GAMING["hardcode"])
    return flags


def run_protocol(task_name: str, agents: list, *, isolation=True, self_report=False,
                 audit_on=True, skills=False) -> list:
    """M1 主流程：标准化环境 → 爬坡 → 独立评测 → 审计。返回逐 agent 结果行。"""
    task = TASKS[task_name]
    rows = []
    for a in agents:
        t = hill_climb(a, task, isolation=isolation, skills=skills)
        r = evaluate(t, task, isolation=isolation, self_report=self_report)
        flags = audit(t, enabled=audit_on)
        rows.append({"task": task_name, "agent": a, **r, "audit": flags or ["Clean"]})
    return rows


# ---------------------------------------------------------------- M3 方差

def gain_type_stats() -> dict:
    """增益构成 × run 方差：纯函数复算材料 Table 6（工程稳 / 洞见波动）+ 口径效应。"""
    ins, eng = TASKS["PFDelta"]["insight_runs"], TASKS["MarsVar"]["engineering_runs"]
    out = {
        "insight": {"runs": ins, "mean": statistics.mean(ins), "stdev": statistics.stdev(ins)},
        "engineering": {"runs": eng, "mean": statistics.mean(eng), "stdev": statistics.stdev(eng)},
    }
    # 口径效应：同一批 run，报 best-of-4 与报单 run 均值差多少
    for k in out:
        best = max(out[k]["runs"])
        out[k]["best_of_4"] = best
        out[k]["best_vs_mean"] = round(best - out[k]["mean"], 1)
    return out


# ---------------------------------------------------------------- M4 技能

def skills_run(*, tier_parallel=True, hourly_checklist=True, hours=12, gpus=8) -> dict:
    """技能干预模拟：tier-1 并行占满 GPU + 每小时检查单防探索塌缩（玩具调度）。"""
    gpu_hours_used, method_families = 0, []
    for h in range(1, hours + 1):
        if tier_parallel:
            gpu_hours_used += gpus if h <= 9 else 2   # 前 9h 并行占满，后期收敛少跑
        else:
            gpu_hours_used += 1 if h <= 6 else 0      # 串行 + 大量等待（commit-and-wait）
        # 方法族：无检查单 → 第 2 小时后永远停留在第 1 小时找到的族（塌缩）
        if hourly_checklist:
            fam = min(h, 5)                            # 每小时检查单逼它换族，最多 5 族
        else:
            fam = 1 if h >= 2 else 1
        method_families.append(fam)
    return {
        "gpu_hours_used": gpu_hours_used,
        "gpu_utilization": round(gpu_hours_used / (hours * gpus) * 100, 1),
        "distinct_families": len(set(method_families)),
        "families_timeline": method_families,
    }


# ---------------------------------------------------------------- 破坏实验

def experiments() -> list:
    """逐一拆核心机制（每次只拆一个），实测退化三件套。"""
    gamers = ["GAMER-selective", "GAMER-contam", "GAMER-manipulate", "GAMER-hardcode"]
    results = []

    # E1 拆测试集封存（isolation=False，其余不变）
    base = run_protocol("CarbonGlobe", ["HONEST"] + gamers)
    broken = run_protocol("CarbonGlobe", ["HONEST"] + gamers, isolation=False)
    base_cheat = [r for r in base if r["agent"].startswith("GAMER")]
    brk_cheat = [r for r in broken if r["agent"].startswith("GAMER")]
    results.append({
        "id": "E1", "change": "拆掉测试集封存（爬坡容器可见 test/）",
        "observed": (
            f"作弊 agent 获评 Δ% 由 {[r['delta'] for r in base_cheat]} 变为 "
            f"{[r['delta'] for r in brk_cheat]}；偷看/拷标签两条通道直接变现为 +"
            f"{brk_cheat[1]['delta']}% 假改进，与诚实增益无法从分数上区分"),
        "lesson": "测试集封存是分数可信的物理前提，靠指令约束不住激进优化器",
    })

    # E2 拆独立评测（self_report=True，其余不变）
    sr = run_protocol("CarbonGlobe", gamers, self_report=True)
    results.append({
        "id": "E2", "change": "分数改由爬坡 agent 自报（取消独立评测）",
        "observed": (f"挑子集/改口径两类的自报 Δ% 均虚高至 "
                     f"{[r['delta'] for r in sr if 'selective' in r['agent'] or 'manipulate' in r['agent']]}%"
                     "（独立评测下分别落回 0）"),
        "lesson": "谁报分数谁有造假动机；分数必须由第二方用标准化脚本算",
    })

    # E3 Δ% 去方向归一
    cg = TASKS["CarbonGlobe"]
    raw = (0.391 - cg["baseline"]) / abs(cg["baseline"]) * 100.0
    results.append({
        "id": "E3", "change": "Δ% 不做方向归一（大小越好一律 (s-b)/|b|）",
        "observed": (f"CarbonGlobe RMSE 0.604→0.391（真实大改进）被算成 {raw:.1f}%；"
                     f"方向归一后应为 {delta_pct(0.391, cg['baseline'], False):.1f}%"),
        "lesson": "误差类指标的改进方向必须反转，否则正负号说反话",
    })

    # E4 拆审计（audit_on=False，隔离保留）
    no_audit = run_protocol("CarbonGlobe", gamers, audit_on=False)
    with_audit = run_protocol("CarbonGlobe", gamers, audit_on=True)
    flagged = sum(1 for r in with_audit if r["audit"] != ["Clean"])
    results.append({
        "id": "E4", "change": "取消审计阶段（封存与独立评测保留）",
        "observed": (f"四条作弊轨迹：有审计时 {flagged}/4 条被标记（{[r['audit'][0][:12] + '…' if r['audit'] != ['Clean'] else 'Clean' for r in with_audit]}）；"
                     f"无审计时 0/4 标记，其中 hardcode 的「谎称误删」类行为完全漏网"),
        "lesson": "分数防线封不住动机性操作，轨迹层面的事后审计是最后一道",
    })

    # E5 拆每小时检查单（tier 并行保留）
    full = skills_run(tier_parallel=True, hourly_checklist=True)
    no_cl = skills_run(tier_parallel=True, hourly_checklist=False)
    results.append({
        "id": "E5", "change": "去掉每小时检查单（tier 并行调度保留）",
        "observed": (f"12h 内尝试的方法族 {full['distinct_families']} → {no_cl['distinct_families']}"
                     f"（第 2 小时起全部塌缩到第 1 小时的族，对应材料 §4.1 探索塌缩）"),
        "lesson": "没有周期性自检，agent 找到甜点后不会自己抬头换路",
    })
    return results


# ---------------------------------------------------------------- selftest

def selftest() -> None:
    checks = []
    def ok(name, cond): checks.append((name, bool(cond)))

    # M2 Δ% 对账材料数字（Table 2/5）
    ok("Δ% CarbonGlobe 0.604→0.391 = +35.3", abs(delta_pct(0.391, 0.604, False) - 35.3) < 0.1)
    ok("Δ% NeuroGraph 0.272→0.260 = +4.4", abs(delta_pct(0.260, 0.272, False) - 4.4) < 0.1)
    ok("Δ% MarsBench 17.27→25.00 = +44.8(≈46.4 任务均值口径)", abs(delta_pct(25.00, 17.27, True) - 44.8) < 0.1)
    ok("Δ% 方向反转：RMSE 恶化 0.604→0.629 = -4.1", abs(delta_pct(0.629, 0.604, False) - (-4.1)) < 0.1)

    # M1 完整协议：作弊全部落空且被审计识破，诚实增益正常
    rows = run_protocol("CarbonGlobe", ["HONEST", "GAMER-selective", "GAMER-contam",
                                        "GAMER-manipulate", "GAMER-hardcode"])
    for r in rows:
        print(f"[run] {r['task']:12s} {r['agent']:18s} Δ%={r['delta']:+6.1f} audit={r['audit']}")
    honest = rows[0]
    ok("诚实 agent 拿到真实增益 +14.7", abs(honest["delta"] - 14.7) < 0.1)
    ok("隔离态四类作弊 Δ% 全部归零", all(r["delta"] == 0.0 for r in rows[1:]))
    # 三道防线分工：隔离挡「偷看/改口径」（做不成、无痕迹→Clean），独立评测废「挑子集」
    # 的分数效果（Δ%=0 但轨迹自报留痕仍被审计点名），审计抓「硬编码谎称误删」
    ok("偷看/改口径被隔离挡死（Clean 且零分）", rows[2]["audit"] == ["Clean"] and rows[3]["audit"] == ["Clean"])
    ok("挑子集与硬编码被审计点名", rows[1]["audit"] != ["Clean"] and rows[4]["audit"] != ["Clean"])

    # M3 方差复算（材料 Table 6：47.9±19.6 与 45.9±1.5）
    g = gain_type_stats()
    ok("PFDelta 四 run mean≈47.9", abs(g["insight"]["mean"] - 47.9) < 0.1)
    ok("PFDelta 四 run stdev≈19.6", abs(g["insight"]["stdev"] - 19.6) < 0.1)
    ok("MarsBench 四 run mean≈45.9", abs(g["engineering"]["mean"] - 45.9) < 0.1)
    ok("MarsBench 四 run stdev≈1.5", abs(g["engineering"]["stdev"] - 1.5) < 0.1)
    print(f"[var] 洞见型 {g['insight']['runs']} → {g['insight']['mean']:.1f}±{g['insight']['stdev']:.1f}"
          f"（best-of-4 口径虚高 {g['insight']['best_vs_mean']}）")
    print(f"[var] 工程型 {g['engineering']['runs']} → {g['engineering']['mean']:.1f}±{g['engineering']['stdev']:.1f}"
          f"（best-of-4 口径虚高 {g['engineering']['best_vs_mean']}）")

    # M4 技能
    s_full = skills_run()
    ok("技能全开 GPU 利用率 >80%", s_full["gpu_utilization"] > 80)
    ok("技能全开 12h 内尝试 5 个方法族", s_full["distinct_families"] == 5)

    # 破坏实验
    for e in experiments():
        print(f"[exp] {e['id']}: {e['change']}")
        print(f"       观测: {e['observed']}")
        print(f"       教训: {e['lesson']}")
    ok("E1..E5 全部产出退化观测", len(experiments()) == 5)

    failed = [n for n, c in checks if not c]
    print(f"\n[check] {len(checks) - len(failed)}/{len(checks)} 通过" + (f"；失败: {failed}" if failed else ""))
    assert not failed, f"SELFTEST FAILED: {failed}"
    out = os.path.join(tempfile.gettempdir(), "agent4sci_selftest.json") if "agent4sci-lab" not in os.path.dirname(os.path.abspath(__file__)) else "agent4sci_selftest.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"checks": [n for n, _ in checks], "experiments": experiments(),
                   "gain_stats": gain_type_stats(), "skills": skills_run()},
                  f, ensure_ascii=False, indent=1)
    print("SELFTEST PASSED ✔")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        print(__doc__)
