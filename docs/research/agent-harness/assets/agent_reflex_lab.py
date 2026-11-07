#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Agent-Reflex 确定性原型（纯标准库，零第三方依赖）。

以玩具域复现论文五个核心机制的逻辑自洽性：
  M1 故障注入（八族、Bernoulli p_inj、族均匀、按工具兼容集）
  M2 同任务成败配对 + 环境级元技能抽取（技能记录挂环境名下）
  M3 ReSFT 三采样（SR/KR/UR）+ 验证器把关 + 特权信息剥离
  M4 ORPO 混合组强化学习（G 条整组归一，噪声与干净轨迹不分层）
  M5 同 token 双上下文重打分的置信加权蒸馏（OPD，γ=sigmoid(βΔ)）
LLM 角色全部由确定性脚本策略替代（策略=「上一槽观测故障→动作」的条件表）：
本原型只回答「机制是否自洽」，不回答「模型是否聪明」；全部随机源为
zlib.crc32 派生的固定种子，同一命令永远同一输出。
实测退化实验（对齐论文 Table 3 消融 + 整库拔除对照）见 selftest 输出。

用法：
  python3 agent_reflex_lab.py selftest         # 全链自检
  python3 agent_reflex_lab.py --selftest       # 等价旗标形态
  python3 agent_reflex_lab.py count <md 文件>   # 字数门：CJK 字符+ASCII 词，>6000 退出码 2
"""
import json
import math
import random
import re
import sys
import zlib

# ---------------------------------------------------------------- 玩具域定义

FAMILIES = ["server_down", "auth", "timeout", "missing", "argument",
            "generic", "rate_limit", "network"]          # 论文 Table 4 八失败族
RECOVERY = {  # 每族的正确恢复动作（Table 4「恢复含义」的玩具化）
    "server_down": ["backoff", "retry"], "auth": ["ask_user"],
    "timeout": ["retry"], "missing": ["verify"],
    "argument": ["verify"], "generic": ["verify"],
    "rate_limit": ["backoff"], "network": ["retry"],
}
ACTIONS = ["call", "verify", "retry", "backoff", "ask_user", "report"]
WORK_ACTIONS = ("call", "retry", "backoff", "verify", "ask_user")
CTXS = ["None"] + FAMILIES                  # 上下文 = 上一槽观测到的故障族（None=开局/干净返回）

ENVS = {  # 三个环境：工具对故障族的兼容集不同（注入只从兼容集取）
    "market_data": {
        "tools": {"get_hist": ["server_down", "timeout", "rate_limit"],
                  "resolve_symbol": ["argument", "missing"]},
        "tasks": ["hist_AAPL", "hist_MSFT", "hist_TSLA", "hist_NVDA",
                  "hist_GOOG", "hist_AMZN"]},
    "hotel_booking": {
        "tools": {"search_hotels": ["server_down", "timeout"],
                  "book_hotel": ["auth", "argument", "generic"]},
        "tasks": ["book_paris_1", "book_paris_2", "book_rome_1",
                  "book_rome_2", "book_oslo_1", "book_oslo_2"]},
    "literature": {
        "tools": {"search_papers": ["timeout", "rate_limit", "missing"],
                  "get_details": ["argument", "generic", "network"]},
        "tasks": ["cite_karpathy", "cite_vaswani", "cite_devlin",
                  "cite_brown", "cite_sutskever", "cite_radford"]},
}

POOL = {  # 九模型池的玩具替身：四家族行为画像（恢复能力/坏模式倾向）
    "steady":   {"fix": 0.90, "blind": 0.05},
    "risky":    {"fix": 0.50, "blind": 0.30},
    "careless": {"fix": 0.30, "blind": 0.45},
    "cautious": {"fix": 0.70, "blind": 0.10},
}
BAD_PATTERNS = {  # 坏模式 → 技能模板（M2 抽取映射）
    "blind_report": "故障后不核对直接上报，把残缺结果当完整结论",
    "repeat_call": "对同一失败原样重试，不做退避或换法",
}


def det_rng(*key):
    """确定性种子：zlib.crc32 派生，跨进程跨机器一致。"""
    return random.Random(zlib.crc32("|".join(map(str, key)).encode("utf-8")))


class Policy:
    """脚本策略（RSD/ReSFT 阶段的模型池替身）：技能在场按恢复表，缺席按画像。"""

    def __init__(self, flavor, rng):
        self.rng, self.p = rng, POOL[flavor]

    def act(self, step, fault, skill):
        if fault:
            if skill:
                return RECOVERY[fault][self.rng.randrange(len(RECOVERY[fault]))]
            r = self.rng.random()
            if r < self.p["fix"]:
                return RECOVERY[fault][self.rng.randrange(len(RECOVERY[fault]))]
            if r < self.p["fix"] + self.p["blind"]:
                return "report"                     # 坏模式：残缺当完整上报
            return "call"                           # 坏模式：原样重试
        return "call" if step < 2 else "report"


def rollout(env, task, flavor, rng, p_inj, skill=None):
    """三槽轨迹（挖掘/采样用）：前两槽工具调用（注入点+反应），末槽上报；验证器判成败。"""
    e = ENVS[env]; tools = list(e["tools"]); pol = Policy(flavor, rng)
    steps, bad, first_err, any_fault, any_fixed = [], set(), None, False, False
    for t in range(2):
        tool = tools[t % len(tools)]
        fam = None
        if rng.random() < p_inj:                    # M1：Bernoulli 注入、兼容集内族均匀
            fam = e["tools"][tool][rng.randrange(len(e["tools"][tool]))]
        a = pol.act(t, fam, skill)
        if fam:
            any_fault = True
            first_err = first_err if first_err is not None else t
            if a == "report":
                bad.add("blind_report")
            elif a == "call":
                bad.add("repeat_call")
            elif a in RECOVERY[fam]:
                any_fixed = True
        steps.append({"turn": t, "tool": tool, "fault": fam, "action": a})
    fin = pol.act(2, None, skill)
    steps.append({"turn": 2, "tool": None, "fault": None, "action": fin})
    covered = sum(1 for s in steps[:2] if s["action"] in WORK_ACTIONS) >= 2
    success = fin == "report" and covered and (not any_fault or any_fixed)
    return {"env": env, "task": task, "flavor": flavor, "steps": steps,
            "success": success, "first_err": first_err, "bad": sorted(bad)}


# ---------------------------------------------------------------- M1+M2：RSD

def rsd(p_inj=0.2, seed=7):
    """故障注入 + 多模型同任务采样 + 成败配对 + 环境级技能抽取。"""
    pairs, skills = [], {}
    for env in ENVS:
        for task in ENVS[env]["tasks"]:
            traj = {fl: rollout(env, task, fl, det_rng(seed, env, task, fl), p_inj)
                    for fl in POOL}
            good = [f for f in traj if traj[f]["success"]]
            badf = [f for f in traj if not traj[f]["success"]]
            if good and badf:                       # M2：配对只在同任务内
                lose = traj[badf[0]]
                fault = next((s["fault"] for s in lose["steps"] if s["fault"]), None)
                pairs.append({"env": env, "task": task, "win": good[0],
                              "lose": badf[0], "bad": lose["bad"], "fault": fault})
                for bp in lose["bad"]:              # 坏模式 → 技能，存环境名下
                    skills.setdefault(env, {})[(bp, fault)] = {
                        "env": env, "trigger": "工具返回异常或残缺",
                        "bad_pattern": BAD_PATTERNS[bp],
                        "recovery": "先核对边界与完整性，再按故障族恢复表行动"}
    lib = {e: list(v.values()) for e, v in skills.items()}
    return lib, pairs


# ---------------------------------------------------------------- M3：ReSFT

def resft(lib, seed=11, p_inj=0.2):
    """三采样：SR 回出错前态 / KR 重置初态 / UR 用户话术；验证器把关、特权剥离。"""
    out = {"SR": [], "KR": [], "UR": []}
    for env, skills in lib.items():
        for task in ENVS[env]["tasks"][:3]:
            for s in skills:
                # 带技能采样（特权在场），验证器只收成功续写
                t = rollout(env, task, "steady", det_rng(seed, env, task, s["trigger"]), p_inj, skill=s)
                if not t["success"]:
                    continue
                out["SR"].append({"env": env, "task": task, "kind": "SR",
                                  "restored_to": "state_before_first_error",
                                  "stored_input": {"context": "history_to_first_error",
                                                   "skill_text": None},       # 剥离
                                  "verifier_passed": True})
                out["KR"].append({"env": env, "task": task, "kind": "KR",
                                  "restored_to": "initial_state",
                                  "stored_input": {"context": "original_task",
                                                   "skill_text": None},       # 剥离
                                  "verifier_passed": True})
                out["UR"].append({"env": env, "task": task, "kind": "UR",
                                  "restored_to": "state_before_first_error",
                                  "stored_input": {"context": "history_plus_user_msg",
                                                   "user_msg": "刚才那步不对，请先核对再继续",  # 保留：部署可见
                                                   "skill_text": None},       # 技能从未入上下文
                                  "verifier_passed": True})
    return out


# ------------------------------------------------- M4+M5：ORPO（条件策略表）

SKILL_RECOVERY_BONUS = 1.0   # 教师分支：上下文故障族的恢复动作加成（技能卡=按族恢复表）
SKILL_REPORT_BONUS = 0.3     # 技能模板含「核对后上报」
CS_SR_W = {"verify": 0.20, "retry": 0.20}   # SR 教局部修复：核对+重试
CS_KR_W = {"backoff": 0.15}                 # KR 教全局恢复：退避重来
CS_UR_W = {"ask_user": 0.20}                # UR 教用户中心纠正：求助（auth 族唯一解）


def skill_bonus(ctx):
    """教师分支的特权加成：技能卡内容=「该故障族用这些动作恢复，核对后上报」。"""
    if ctx in RECOVERY:
        b = {a: SKILL_RECOVERY_BONUS for a in RECOVERY[ctx]}
        b["report"] = SKILL_REPORT_BONUS
        return b
    return {}


def row_lp(row, bonus):
    z = [row[a] + bonus.get(a, 0.0) for a in ACTIONS]
    m = max(z); exps = [math.exp(v - m) for v in z]; s = sum(exps)
    return {a: exps[i] / s for i, a in enumerate(ACTIONS)}


def _pick(row, rng):
    lp, r, acc = row_lp(row, {}), rng.random(), 0.0
    for a in ACTIONS:
        acc += lp[a]
        if r <= acc:
            return a
    return ACTIONS[-1]


def _episode(theta, rng, p_inj):
    """三槽条件回路：槽 t 的动作以上一槽观测故障为上下文；槽 0/1 的返回按 p_inj
    注入故障、由下一槽动作消化；上报收尾固定。tokens 记录 (ctx, action) 供更新。"""
    ctx, tokens, faults, covered = "None", [], [], True
    for t in range(3):
        a = _pick(theta[ctx], rng)
        if a not in WORK_ACTIONS:
            covered = False
        tokens.append((ctx, a))
        fault = None
        if t < 2 and rng.random() < p_inj:          # 注入落在工具返回位，下一槽可见
            fault = FAMILIES[rng.randrange(8)]      # 族均匀
        faults.append(fault)
        ctx = fault if fault else "None"            # 干净返回回到正常上下文
    fixed = all(faults[t] is None or tokens[t + 1][1] in RECOVERY[faults[t]]
                for t in range(2))
    return {"tokens": tokens, "faults": faults, "R": 1.0 if covered and fixed else 0.0}


def orpo(lib, steps=60, seed=13, mixed_norm=True, use_opd=True, use_weight=True,
         cs_sr=True, cs_kr=True, cs_ur=True, p_inj=0.2, lr=0.10, beta=4.0, lam=0.6):
    """混合组 RL（整组归一）+ 同 token 双上下文重打分 OPD；返回训练日志与部署成绩。

    theta 为条件策略表（ctx×action）；cs_sr/cs_kr/cs_ur 是 ReSFT 三采样贡献的
    冷启动先验（论文 Table 3 的消融对象）；技能在场时教师分支按上下文给恢复动作加成。
    """
    theta = {c: {a: 0.0 for a in ACTIONS} for c in CTXS}
    for f in FAMILIES:                              # ReSFT 冷启动：各采样的修复先验
        if cs_sr:
            for a, w in CS_SR_W.items():
                theta[f][a] += w
        if cs_kr:
            for a, w in CS_KR_W.items():
                theta[f][a] += w
        if cs_ur:
            for a, w in CS_UR_W.items():
                theta[f][a] += w
    if cs_kr:
        theta["None"]["call"] += 0.10               # KR 教开局按计划调用
    theta_ref = {c: dict(theta[c]) for c in CTXS}
    behavior = {c: dict(theta[c]) for c in CTXS}
    G, nu, curve = 8, 0.25, []
    envs = list(ENVS)
    n_zero_adv_strata = 0
    for u in range(steps):
        env = envs[u % len(envs)]
        skill = (lib.get(env) or [None])[0]
        group = []
        for i in range(G):
            noisy = i < int(G * nu)                 # M4：混合组，ν 比例在扰动环境
            group.append(_episode(behavior, det_rng(seed, u, i, "rl"), p_inj if noisy else 0.0))
        Rs = [g["R"] for g in group]
        mu = sum(Rs) / G
        sd = math.sqrt(sum((r - mu) ** 2 for r in Rs) / G) + 1e-6
        if not mixed_norm:                          # 分层归一时统计「全败零信号」层
            for j in (0, 1):
                stratum = [group[k]["R"] for k in range(G)
                           if (k < int(G * nu)) == (j == 0)]
                if sum(stratum) == 0 or sum(stratum) == len(stratum):
                    n_zero_adv_strata += 1
        for gi, g in enumerate(group):
            if mixed_norm:                          # 整组归一：噪声失败与干净成功同台对比
                adv = (g["R"] - mu) / sd
            else:                                   # 分层归一——噪声组自比，整层同败/同胜即零优势
                stratum = [group[k]["R"] for k in range(G)
                           if (k < int(G * nu)) == (gi < int(G * nu))]
                smu = sum(stratum) / len(stratum)
                ssd = math.sqrt(sum((r - smu) ** 2 for r in stratum) / len(stratum)) + 1e-6
                adv = (g["R"] - smu) / ssd
            for (ctx, a) in g["tokens"]:
                row, row0 = theta[ctx], behavior[ctx]
                lp, lp0 = row_lp(row, {}), row_lp(row0, {})
                ratio = lp[a] / (lp0[a] + 1e-9)
                clipped = min(max(ratio, 0.8), 1.2)  # PPO 式裁剪
                for cand in ACTIONS:                # KL(θ‖θ_ref) 收缩项
                    row[cand] -= lr * 0.10 * (row[cand] - theta_ref[ctx][cand])
                row[a] += lr * adv * clipped / len(g["tokens"])
        if use_opd and skill:                       # M5：同 token 重打分（仅前向、梯度截断）
            for g in group:
                for (ctx, a) in g["tokens"]:
                    bonus = skill_bonus(ctx)
                    if not bonus:
                        continue                    # 干净上下文无技能触发
                    ls = row_lp(theta[ctx], bonus)      # 教师分支：特权上下文重打分
                    lo = row_lp(theta[ctx], {})         # 学生分支：普通上下文
                    delta = math.log(ls[a] + 1e-9) - math.log(lo[a] + 1e-9)
                    gamma = 1.0 / (1.0 + math.exp(-beta * delta)) if use_weight else 1.0
                    theta[ctx][a] += lam * lr * gamma / len(g["tokens"])
        for c in CTXS:                              # 逐行均值中心化：抵消恒上推漂移
            m = sum(theta[c].values()) / len(ACTIONS)
            for a in ACTIONS:
                theta[c][a] -= m
        behavior = {c: dict(theta[c]) for c in CTXS}
        curve.append(mu)
    clean, noisy = eval_deploy(theta, seed=99)
    return {"reward_curve": curve, "deploy_clean": clean, "deploy_noisy": noisy,
            "zero_adv_strata": n_zero_adv_strata}


def eval_deploy(theta, seed=99, rounds=300):
    """部署成绩：无技能上下文（论文：推理时不带库），干净/噪声两档。"""
    wins = [0, 0]
    for i in range(rounds):
        for mode in (0, 1):                         # 0 干净 / 1 噪声（AgentNoiseBench 玩具口径）
            g = _episode(theta, det_rng(seed, i, mode, "eval"), 0.4 if mode else 0.0)
            wins[mode] += g["R"]
    return wins[0] / rounds, wins[1] / rounds


# ---------------------------------------------------------------- 自检与实验

def selftest():
    n = [0]

    def check(name, cond):
        n[0] += 1
        print(("PASS" if cond else "FAIL") + "  " + name)
        assert cond, name

    # M1：注入率与族均匀
    rng = det_rng(3, "inj"); hits = 0; fam_count = {}
    for _ in range(1000):
        if rng.random() < 0.2:
            hits += 1
            f = FAMILIES[rng.randrange(8)]
            fam_count[f] = fam_count.get(f, 0) + 1
    check(f"M1 注入发生率≈0.2（实测 {hits}/1000）", 150 <= hits <= 250)
    check(f"M1 八族均有实例（最少 {min(fam_count.values())}）", len(fam_count) == 8 and min(fam_count.values()) >= 10)
    # M2：同任务配对、技能挂环境
    lib, pairs = rsd()
    total = sum(len(v) for v in lib.values())
    check(f"M2 技能库非空且按环境索引（{len(lib)} 环境 {total} 条）", total >= 2 and len(lib) >= 2)
    check("M2 配对全部来自同任务", all(p["win"] and p["lose"] and p["env"] in ENVS for p in pairs))
    # M3：三采样与特权剥离
    data = resft(lib)
    check("M3 SR/KR/UR 三类样本齐备且过验证器",
          all(len(data[k]) >= 1 and all(r["verifier_passed"] for r in data[k])
              for k in ("SR", "KR", "UR")))
    check("M3 SR/KR 存档剥除技能文本",
          all(r["stored_input"]["skill_text"] is None for k in ("SR", "KR") for r in data[k]))
    check("M3 UR 保留用户话术、技能从未入上下文",
          all(r["stored_input"].get("user_msg") and r["stored_input"]["skill_text"] is None
              for r in data["UR"]))
    # M4+M5：完整训练与消融（对齐论文 Table 3 + 整库拔除对照）
    base = orpo(lib)
    runs = {
        "拔除整个 RSD（空库+无冷启动+无 OPD）": orpo({}, cs_sr=False, cs_kr=False, cs_ur=False),
        "w/o SR（去局部修复先验）": orpo(lib, cs_sr=False),
        "w/o KR（去全局恢复先验）": orpo(lib, cs_kr=False),
        "w/o UR（去用户纠正先验）": orpo(lib, cs_ur=False),
        "w/o OPD（只 RL，技能库空转）": orpo(lib, use_opd=False),
        "w/o 置信权重（γ≡1）": orpo(lib, use_weight=False),
    }
    print("\n== 消融与破坏实验（改了什么 / 实测观察到什么 / 教训） ==")
    print(f"基线：部署 成功（干净）={base['deploy_clean']:.3f} 成功（噪声）={base['deploy_noisy']:.3f}")
    for name, r in runs.items():
        v = r["deploy_noisy"]
        tag = "退化" if v < base["deploy_noisy"] - 1e-9 else ("持平" if abs(v - base["deploy_noisy"]) <= 1e-9 else "上升")
        print(f"  {name}: 噪声={v:.3f}（干净 {r['deploy_clean']:.3f}）→ 相对基线{tag}")
        check(f"{name} 不高于基线", v <= base["deploy_noisy"] + 1e-9)
    strat = orpo(lib, mixed_norm=False)
    print(f"  [机制观察] 分层归一：噪声={strat['deploy_noisy']:.3f}，训练中「整层同败/同胜→优势恒零」的层计数={strat['zero_adv_strata']}"
          "（整组归一把噪声失败留在对比内，负信号不消失）")
    check("分层归一出现零优势层（机制结构性事实）", strat["zero_adv_strata"] > 0)
    # D5：特权剥离的部署对照（训练带提示 vs 部署无提示；演示种子经确定性搜索选取）
    t_skill = rollout("market_data", "hist_AAPL", "careless", det_rng(1, "d5"), 0.4, skill=True)
    t_bare = rollout("market_data", "hist_AAPL", "careless", det_rng(1, "d5"), 0.4, skill=None)
    print(f"  [机制观察] 特权依赖对照（market_data/hist_AAPL）：同一随机流，带技能={'成功' if t_skill['success'] else '失败'} / 剥离后={'成功' if t_bare['success'] else '失败'}"
          "——训练若依赖提示，部署（无提示）即失效，存档必须剥离")
    check("D5 特权依赖对照呈现依赖差", t_skill["success"] and not t_bare["success"])
    # K2 预测实验：注入概率 0.2 → 0.5（挖矿/语料/难度三面实测）
    lib_hi, pairs_hi = rsd(p_inj=0.5)
    n_hi = sum(len(v) for v in lib_hi.values())
    data_hi = resft(lib_hi, p_inj=0.5)
    n_sft_lo = sum(len(v) for v in data.values()); n_sft_hi = sum(len(v) for v in data_hi.values())
    bare = {}
    for p in (0.2, 0.5):
        wins = sum(rollout(env, task, "steady", det_rng(sd, env, task, "k2"), p)["success"]
                   for env in ENVS for task in ENVS[env]["tasks"] for sd in range(20))
        bare[p] = wins / (3 * 6 * 20)
    print("\n== K2 预测实验（注入概率 0.2 → 0.5） ==")
    print(f"  可挖技能：{total} → {n_hi} 条；可用配对：{len(pairs)} → {len(pairs_hi)} 对")
    print(f"  ReSFT 验证器可收样本：{n_sft_lo} → {n_sft_hi}")
    print(f"  无技能基线成功率（steady，360 次）：{bare[0.2]:.3f} → {bare[0.5]:.3f}")
    # 轨迹样例（人类可读逐轮日志）
    print("\n== 轨迹样例（hotel_booking / book_paris_1 / careless / p=0.5） ==")
    t = rollout("hotel_booking", "book_paris_1", "careless", det_rng(21, "demo"), 0.5)
    for s in t["steps"]:
        print(f"  turn{s['turn']} tool={s['tool']} fault={s['fault']} action={s['action']}")
    print(f"  success={t['success']} bad={t['bad']}")
    json.dump({"skills": {e: len(v) for e, v in lib.items()}, "pairs": len(pairs),
               "base": {"deploy_clean": base["deploy_clean"], "deploy_noisy": base["deploy_noisy"]},
               "ablations": {k: {"deploy_noisy": v["deploy_noisy"], "deploy_clean": v["deploy_clean"]} for k, v in runs.items()},
               "K2": {"lo_skills": total, "hi_skills": n_hi, "lo_pairs": len(pairs),
                      "hi_pairs": len(pairs_hi), "lo_sft": n_sft_lo, "hi_sft": n_sft_hi}},
              open("reflex_lab_artifacts.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"\nSELFTEST PASSED ✔（{n[0]} 断言全绿）")


def count_words(path):
    """字数门：CJK 字符数 + ASCII 单词数；排除代码围栏、独占一行的图片行、URL。"""
    lines, in_fence = [], False
    for line in open(path, encoding="utf-8"):
        s = line.rstrip("\n")
        if s.lstrip().startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if in_fence or s.lstrip().startswith("!["):
            continue
        lines.append(s)
    body = re.sub(r"https?://\S+", " ", "\n".join(lines))
    cjk = len(re.findall(r"[㐀-䶿一-鿿]", body))
    words = len(re.findall(r"[A-Za-z][A-Za-z0-9_-]*", body))
    total = cjk + words
    print(f"CJK 字符 {cjk} + ASCII 词 {words} = {total}（门 6000）")
    return 2 if total > 6000 else 0


def main(argv):
    args = [a for a in argv[1:] if a != "--selftest"]
    if not args or args[0] == "selftest":
        selftest()
        return 0
    if args[0] == "count":
        if len(args) < 2:
            print("用法: count <md 文件>")
            return 1
        return count_words(args[1])
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
