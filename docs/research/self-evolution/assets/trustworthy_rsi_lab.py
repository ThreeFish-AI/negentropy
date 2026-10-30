#!/usr/bin/env python3
"""Trustworthy RSI 玩具原型：把论文的形式定义跑起来（纯标准库、完全确定性）。

对应 arXiv:2610.35193v1 的机制映射：
- Eq.(1) h = A(B, E)                     -> learn_policy(bias, experience)
- Eq.(2) h_{t+1} = A_{B_t}(h_t, E_{t+1}) -> 改进环内的策略重学
- Eq.(3) (B_{t+1}, U_{t+1}) = U_t(B_t, h_{t+1}, F_{t+1}) -> improve_once / revise_updater
- S1 诊断 / S2 提案 / S3 评估（改进门 + 约束门 + 保持门）/ S4 实施
- RI：S1–S4 作用于 U 自身；meta 验收走「成对延续」（同起点、双臂冻结 U、同预算、总成本核算）

玩具世界：5 位特征 (a, b, r, s, n)。真概念 = 多数(a,b,r)；r 为罕见特征，只出现在
真实数据里；s 为敏感旗标（s=1 时禁止预测正类——安全约束优先于效用）；n 为与真标签
无关的噪声位，但在「污染代理集」与自生成样本里与正类伪相关（捷径温床）。
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, replace

R = random.Random(20261026)

# ---------------------------------------------------------------- 玩具世界


def true_label(item) -> int:
    a, b, r, _s, _n = item
    return 1 if (a + b + r) >= 2 else 0


def eff_label(item) -> int:
    """有效标签 = 约束感知后的正确行为：s=1 一律判负（安全约束优先于效用）。"""
    return 0 if item[3] == 1 else true_label(item)


def sample(real: bool, rare_rate: float, spurious: float) -> tuple:
    """采样一条数据。real=False 为系统自生成样本：罕见模式消失、n 与标签伪相关。"""
    a, b = R.randint(0, 1), R.randint(0, 1)
    r = R.randint(0, 1) if (real and R.random() < rare_rate) else 0
    s = 1 if R.random() < 0.15 else 0
    y = true_label((a, b, r, 0, 0))
    n = R.randint(0, 1) if (real and R.random() >= spurious) else y
    return (a, b, r, s, n)


def gen_item() -> tuple:
    """系统自生成样本：生成器只信 a（从没学过 b/r），n 与 a 绑定——评估与训练共享同套错误。"""
    a = R.randint(0, 1)
    s = 1 if R.random() < 0.15 else 0
    return (a, R.randint(0, 1), 0, s, a)


def gen_set(k: int) -> list:
    return [(x, x[0]) for x in (gen_item() for _ in range(k))]  # 自报标签 = a


def dataset(real: bool, k: int, rare_rate: float, spurious: float = 0.5):
    xs = [sample(real, rare_rate, spurious) for _ in range(k)]
    return [(x, eff_label(x)) for x in xs]


# ---------------------------------------------------------------- h / B / U


@dataclass(frozen=True)
class Bias:
    """归纳偏置 B：选哪些特征进打分器、阈值偏移量、是否保留真实经验。"""

    features: tuple = ("a", "b", "s")
    threshold: float = 0.0     # 相对「类均值中点」的偏移；负值 = 更容易判正
    retain_real: bool = True


IDX = {"a": 0, "b": 1, "r": 2, "s": 3, "n": 4}


def learn_policy(bias: Bias, experience: list):
    """A(B, E)：在偏置 B 选中的特征上做朴素贝叶斯对数似然比判别。

    B 决定『哪些特征能进判别器』；threshold 是对数先验偏移（负值 = 更容易判正）。
    拉普拉斯平滑保证小样本特征不出无穷权重。
    """
    feats = list(bias.features)
    pos = [(x, y) for x, y in experience if y == 1]
    neg = [(x, y) for x, y in experience if y == 0]
    tables = {}
    for f in feats:
        i = IDX[f]
        p1 = (sum(x[i] for x, _ in pos) + 1) / (len(pos) + 2)
        q1 = (sum(x[i] for x, _ in neg) + 1) / (len(neg) + 2)
        tables[f] = (math.log((1 - p1) / (1 - q1)), math.log(p1 / q1))  # 按特征值索引：[0]=x=0 项, [1]=x=1 项

    def llr(x):
        return sum(tables[f][x[IDX[f]]] for f in feats)

    return lambda x: 1 if llr(x) >= bias.threshold else 0


@dataclass(frozen=True)
class Updater:
    """偏置更新函数 U：怎么根据失败反馈改 B。参数本身就是 RI 的作用对象。"""

    mode: str = "direct"           # direct=按最大失败特征直改（成本 1）；search=枚举择优（成本 k）
    k: int = 4
    margin: float = 0.02           # 改进门：验证集增益下限
    guard_convention: bool = True   # 约束门
    guard_retention: bool = True    # 保持门


def _candidates(diag_feat: str, bias: Bias) -> list:
    pool = [f for f in ("a", "b", "r", "n", "s") if f not in bias.features]
    adds = [replace(bias, features=tuple(dict.fromkeys(bias.features + (f,)))) for f in pool]
    drops = [replace(bias, features=tuple(f for f in bias.features if f != f0))
             for f0 in bias.features if len(bias.features) > 1]
    shifts = [replace(bias, threshold=round(bias.threshold + d, 3)) for d in (-0.1, 0.1)]
    return [bias] + adds + drops + shifts  # 「不改」也在候选里，保证不劣化


def propose(updater: Updater, bias: Bias, diag_feat: str, val: list) -> list:
    """S2：U 生成候选偏置修订。direct 出 1 个；search 出 k 个（在 val 上择优）。"""
    if updater.mode == "direct":
        if diag_feat not in bias.features:
            return [replace(bias, features=tuple(dict.fromkeys(bias.features + (diag_feat,))))]
        return [replace(bias, threshold=round(bias.threshold + d, 3)) for d in (-0.1, 0.1)]
    cands = _candidates(diag_feat, bias)
    scored = sorted(((accuracy(learn_policy(c, val), val), -i, c)
                     for i, c in enumerate(cands)), reverse=True)
    return [c for _s, _i, c in scored[: updater.k]]


def accuracy(h, data: list) -> float:
    return sum(1 for x, y in data if h(x) == y) / len(data)


def violations(h, probe: list) -> int:
    """约束探针：s=1 的条目禁止预测正类（安全约束优先于效用）。"""
    return sum(1 for x, _y in probe if x[3] == 1 and h(x) == 1)


def diagnose(bias: Bias, experience: list) -> str:
    """S1：优先在『偏置尚未覆盖的特征』里找错误聚集（缺什么补什么）；
    都已覆盖时回退到全体特征的最大错误计数（走阈值调整路径）。"""
    h = learn_policy(bias, experience)
    errs = {f: 0 for f in ("a", "b", "r", "n", "s")}
    for x, y in experience:
        if h(x) != y:
            for f in errs:
                if x[IDX[f]] == 1:
                    errs[f] += 1
    missing = {f: c for f, c in errs.items() if f not in bias.features}
    if missing and max(missing.values()) > 0:
        return max(missing, key=missing.get)
    return max(errs, key=errs.get)


# ---------------------------------------------------------------- S1–S4 改进环


def improve_once(updater, bias, experience, val, constraint_probe, retention_probe,
                 gates: dict | None = None) -> tuple:
    """一轮 S1–S4。gates 供破坏实验关掉特定门。返回 (B_{t+1}, 记录)。"""
    gates = gates or {}
    diag = diagnose(bias, experience)                                    # S1
    h0 = learn_policy(bias, experience)
    val0 = accuracy(h0, val)
    cands = propose(updater, bias, diag, val)                            # S2
    best, log = bias, {"diag": diag, "accepted": False,
                       "cost": 1 if updater.mode == "direct" else updater.k}
    for cand in cands:                                                   # S3
        hc = learn_policy(cand, experience)
        if gates.get("improvement", True) and accuracy(hc, val) < val0 + updater.margin:
            continue                                                     # 改进门
        v0 = violations(h0, constraint_probe)
        if gates.get("constraint", updater.guard_convention) and violations(hc, constraint_probe) > v0:
            continue                                                     # 约束门：不得新增违规
        if gates.get("retention", updater.guard_retention) and \
                accuracy(hc, retention_probe) < accuracy(h0, retention_probe) - 0.02:
            continue                                                     # 保持门
        if accuracy(hc, val) > accuracy(learn_policy(best, experience), val):
            best = cand                                                  # S4 实施
    log["accepted"] = best != bias
    return best, log


def run_trajectory(updater, bias, rounds, stream_builder, val, constraint_probe,
                   retention_probe, reporting, gates=None, charge=0.0):
    """多轮轨迹：逐检查点记录真测/保持/违规，联合判据 = 每点全过才算过。"""
    traj, cost = [], charge  # charge：U 一次性发现成本（总成本核算）
    v_base = violations(learn_policy(bias, stream_builder(0)), constraint_probe)
    for t in range(rounds):
        experience = stream_builder(t)
        if not bias.retain_real:  # 模型坍缩：经验被自生成样本替换，罕见模式消失
            experience = dataset(False, len(experience), 0.0)
        bias, log = improve_once(updater, bias, experience, val, constraint_probe,
                                 retention_probe, gates)
        cost += log["cost"]
        h = learn_policy(bias, experience)
        traj.append({"t": t + 1, "true": round(accuracy(h, reporting), 4),
                     "retain": round(accuracy(h, retention_probe), 4),
                     "viol": violations(h, constraint_probe), "cost": cost})
    joint = all(p["true"] >= 0.5 and p["retain"] >= 0.5 and p["viol"] <= v_base for p in traj)
    return {"traj": traj, "joint": joint, "final_true": traj[-1]["true"], "cost": cost}


# ---------------------------------------------------------------- RI：成对延续


def revise_updater(u: Updater, **kw) -> Updater:
    """RI：对 U 自身做一次修订（验收见 paired_continuation）。"""
    return replace(u, **kw)


def paired_continuation(u_old, u_new, start_bias, budget, stream_builder, val,
                        constraint_probe, retention_probe, reporting,
                        discovery_cost: float):
    """成对延续：同起点 (h, B, 持久态) 分两臂，各自冻结 U、同任务流、同总预算。

    总成本核算：新臂把一次性发现成本记入账上；每轮成本 direct=1、search=k，
    两臂轮数 = budget / 每轮成本，同规则记账。
    """
    rounds_old = budget
    rounds_new = max(1, budget // u_new.k)
    arm_old = run_trajectory(u_old, start_bias, rounds_old, stream_builder, val,
                             constraint_probe, retention_probe, reporting)
    arm_new = run_trajectory(u_new, start_bias, rounds_new, stream_builder, val,
                             constraint_probe, retention_probe, reporting,
                             charge=discovery_cost)
    return {"old": arm_old, "new": arm_new,
            "delta_true": round(arm_new["final_true"] - arm_old["final_true"], 4)}


# ---------------------------------------------------------------- selftest + 破坏实验


def build_world():
    # 效用面（验证/报告/保持）：只含常规条目，敏感条目不进效用计量
    val = [(x, y) for x, y in dataset(True, 400, 0.10, spurious=0.0) if x[3] == 0]
    selfgen_val = gen_set(300)  # 同源自报验收集：生成器标签 = a
    reporting = [(x, y) for x, y in dataset(True, 800, 0.20, spurious=0.0) if x[3] == 0]
    retention = [(x, y) for x, y in dataset(True, 200, 0.0, spurious=0.0) if x[3] == 0]
    # 约束面：敏感探针全体 s=1（常规模式），正确行为一律判负
    cprobe = [((a, b, 0, 1, n), 0) for a, b, n in
              ((R.randint(0, 1), R.randint(0, 1), R.randint(0, 1)) for _ in range(600))]

    def stream(t):
        rare = 0.0 if t == 0 else 0.25                     # 第 2 轮起分布移入罕见模式
        return dataset(True, 300, rare, spurious=0.1)

    return val, selfgen_val, reporting, retention, cprobe, stream


def selftest():
    val, selfgen_val, reporting, retention, cprobe, stream = build_world()
    b0, u0 = Bias(), Updater()

    # -- 主路径：三门全开，三轮后真测显著提升、零违规、联合判据通过
    base = accuracy(learn_policy(b0, stream(0)), reporting)
    main = run_trajectory(u0, b0, 3, stream, val, cprobe, retention, reporting)
    assert main["final_true"] > base + 0.04, "主路径应实现真改进"
    assert max(p["viol"] for p in main["traj"]) <= main["traj"][0]["viol"], "约束门不应新增违规"
    assert main["joint"], "主路径应通过联合判据"

    # -- E1 去改进门：在自生成经验上学出的 n 捷径，代理集涨、真集降
    e1_exp = dataset(False, 300, 0.0)                      # 自生成经验（n≡自报标签，无罕见）
    e1_bias = replace(b0, features=("a", "b", "n"))
    h_before, h_after = learn_policy(b0, e1_exp), learn_policy(e1_bias, e1_exp)
    gain_self = accuracy(h_after, selfgen_val) - accuracy(h_before, selfgen_val)
    gain_true = accuracy(h_after, reporting) - accuracy(h_before, reporting)
    assert gain_self > 0.02 and gain_true < -0.05, "E1 应呈现『验收分涨、真测降』"

    # -- E2 去约束门：丢弃 s 特征的候选在效用面上不降，但敏感违规跳升
    e2_bias = Bias(features=("a", "b"))
    h2 = learn_policy(e2_bias, stream(1))
    v_base = violations(learn_policy(b0, stream(1)), cprobe)
    assert violations(h2, cprobe) > v_base + 20, "E2 应出现约束违规跳升"
    assert accuracy(h2, val) >= accuracy(learn_policy(b0, stream(1)), val) - 0.01

    # -- E3 拿缺陷评估器当验收标准反复『改进』：验收分涨，真测掉（拟合评估者的错误世界观）
    e3_exp = stream(2)                                     # 系统仍用真实经验训练
    e3_pre = (round(accuracy(learn_policy(b0, e3_exp), selfgen_val), 4),
              round(accuracy(learn_policy(b0, e3_exp), reporting), 4))
    b3, hist = b0, []
    for _ in range(3):
        cands = _candidates(diagnose(b3, e3_exp), b3)
        b3 = max(cands, key=lambda c: accuracy(learn_policy(c, e3_exp), selfgen_val))
        hist.append((round(accuracy(learn_policy(b3, e3_exp), selfgen_val), 4),
                     round(accuracy(learn_policy(b3, e3_exp), reporting), 4)))
    assert hist[-1][0] > e3_pre[0] and hist[-1][1] < e3_pre[1], "E3 应呈现同源验收过拟合"

    # -- E4 假 meta-improvement：不匹配比较 vs 成对延续 + 总成本
    u_search = revise_updater(u0, mode="search", k=4)
    unmatched_new = run_trajectory(u_search, replace(b0, features=("a", "b", "r")), 3,
                                   stream, val, cprobe, retention, reporting)
    unmatched_old = run_trajectory(u0, b0, 1, stream, val, cprobe, retention, reporting)
    paired = paired_continuation(u0, u_search, b0, budget=8, stream_builder=stream,
                                 val=val, constraint_probe=cprobe,
                                 retention_probe=retention, reporting=reporting,
                                 discovery_cost=4.0)
    assert unmatched_new["final_true"] > unmatched_old["final_true"], "不匹配比较制造假优势"
    assert paired["delta_true"] <= 0.005, "成对延续应揭穿假优势（同预算无真增益）"
    assert paired["new"]["cost"] > paired["old"]["cost"], "新臂成本应更高（含发现成本）"

    # -- E5 RI 无护栏：关掉改进门后激进 U 让轨迹震荡/退化，有护栏主路径更稳
    wild = run_trajectory(u0, b0, 4, stream, selfgen_val, cprobe, retention, reporting,
                          gates={"improvement": False, "constraint": False, "retention": False})
    dips = [wild["traj"][i]["true"] - wild["traj"][i - 1]["true"] for i in range(1, 4)]
    assert wild["final_true"] < main["final_true"], "E5 应呈现改进停摆/退化"
    assert main["final_true"] >= wild["final_true"], "有护栏主路径不应劣于无护栏"

    return {"base": round(base, 4), "main": main, "e1": (round(gain_self, 4), round(gain_true, 4)),
            "e2_viol": (v_base, violations(h2, cprobe)), "e2_val": round(accuracy(h2, val), 4),
            "e3": hist, "e3_pre": e3_pre,
            "e4": (unmatched_new["final_true"], unmatched_old["final_true"], paired),
            "e5": wild}


if __name__ == "__main__":
    out = selftest()
    print("== Trustworthy RSI toy lab：全部断言通过 ==")
    m = out["main"]
    print(f"[主路径] 真测 {out['base']} -> {m['final_true']}，违规不升（"
          f"{[p['viol'] for p in m['traj']]}），联合判据 {'通过' if m['joint'] else '失败'}，3 轮成本 {m['cost']}")
    print(f"[E1 去改进门] 同源验收分 {out['e1'][0]:+.4f} / 真测 {out['e1'][1]:+.4f} —— 假提升")
    print(f"[E2 去约束门] 效用面验证 {out['e2_val']}（不降），敏感违规 "
          f"{out['e2_viol'][0]} -> {out['e2_viol'][1]} 次 —— 约束破")
    h0, h1 = out["e3"][0], out["e3"][-1]
    print(f"[E3 同源过拟合] 验收分 {out['e3_pre'][0]}->{h1[0]} 涨 / 真测 {out['e3_pre'][1]}->{h1[1]} 降")
    un, uo, pr = out["e4"]
    print(f"[E4 假 meta] 不匹配：新 {un} vs 旧 {uo}；成对延续 delta={pr['delta_true']:+.4f}"
          f"（成本 新 {pr['new']['cost']} vs 旧 {pr['old']['cost']}）—— 假优势被揭穿")
    print(f"[E5 无护栏 RI] 轨迹真测 {[p['true'] for p in out['e5']['traj']]}——改进停摆在 "
          f"{out['e5']['final_true']}，主路径 {m['final_true']}")
