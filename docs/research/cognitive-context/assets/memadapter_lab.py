#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MemAdapter 最小原型（纯标准库、确定性仿真）。

原型回答「机制是否自洽」，不回答「模型是否聪明」：论文中的 LLM 角色
（反事实归纳 / 反思 / 证据推理）全部用确定性脚本函数替代
（F_prop / F_use / F_cmp / F_reflect / R_EBR，对应论文附录 G 的 Alg.1–3）。
同一命令永远同一日志；场景与选项均为玩具域虚构，数字不复现论文。

用法：
  python3 memadapter_lab.py --selftest        # 9 场景 × 四变体 + 断言
  python3 memadapter_lab.py --break stage1    # E1：跳过反事实归纳（指令退化为按相关性放行）
  python3 memadapter_lab.py --break stage2    # E2：边界卡不经任务校准直接下发
  python3 memadapter_lab.py --break verify    # E3：关闭支撑轨迹核验
  python3 memadapter_lab.py --break joint     # E4：反思不联合考察记忆集
  python3 memadapter_lab.py --predict T4|T4a|T4b  # 预测题答案键实跑
"""
import sys

# ---------------------------------------------------------------- 玩具域数据
# 记忆：kind ∈ {preference 偏好, belief 信念, identity 身份, state 状态(有时效)}
# aspect：同 aspect 的多条记忆存在新旧更新关系（ts 越大越新）
MEMORIES = {
    "m1": {"text": "用户喜欢科幻小说", "domain": "reading", "kind": "preference",
           "aspect": "gift_style", "ts": 10, "option": "sci-fi-book"},
    "m2": {"text": "用户曾说流感疫苗没用", "domain": "health", "kind": "belief",
           "aspect": "vaccine_view", "ts": 5, "option": "skip"},
    "m3": {"text": "用户偏爱 Northstar 云备份", "domain": "cloud", "kind": "preference",
           "aspect": "backup_choice", "ts": 6, "option": "northstar"},
    "m4": {"text": "用户此前使用 A 协作工具", "domain": "tooling", "kind": "state",
           "aspect": "collab_tool", "ts": 3, "option": "toolA"},
    "m5": {"text": "用户上月改用 B 协作工具", "domain": "tooling", "kind": "state",
           "aspect": "collab_tool", "ts": 9, "option": "toolB"},
    "m6": {"text": "用户婚姻状况：已婚", "domain": "privacy", "kind": "identity",
           "aspect": "marital", "ts": 2, "option": None},
    "m7": {"text": "用户是心脏病专家", "domain": "health", "kind": "identity",
           "aspect": "expertise", "ts": 4, "option": None},
    "m8": {"text": "用户爱吃辣", "domain": "food", "kind": "preference",
           "aspect": "dinner_style", "ts": 7, "option": "spicy"},
    "m9": {"text": "用户爱看纪录片", "domain": "movie", "kind": "preference",
           "aspect": "movie_taste", "ts": 8, "option": "docu"},
    "m10": {"text": "用户偏爱 Nexa 牌汽车", "domain": "auto", "kind": "preference",
            "aspect": "car_brand", "ts": 5, "option": "nexa"},
}

# 任务类型（论文式(1) t_ij 的离散化）：
#   objective 客观事实判断 / decision 证据决策 / explain 讲解 /
#   personalization 个性化选择 / chat 闲聊
# 场景：cls ∈ normal 正常路径 / trap 陷阱路径 / edge 边缘路径
SCENARIOS = [
    {"id": "S1", "cls": "normal", "task": "personalization", "query": "选一件500元内生日礼物",
     "domain": "reading", "evidence": [], "gold": "sci-fi-book",
     "mems": ["m1"], "why": "偏好可正当决定礼物选择"},
    {"id": "S2", "cls": "trap", "task": "objective", "query": "今年是否建议接种流感疫苗（按指南）",
     "domain": "health", "evidence": ["指南：建议接种"], "gold": "vaccinate",
     "mems": ["m2"], "why": "个人信念不得推翻指南结论"},
    {"id": "S3", "cls": "trap", "task": "decision", "query": "为冷存储视频项目选云备份服务",
     "domain": "cloud", "evidence": ["成本与恢复演练证据支持 pine"], "gold": "pine",
     "mems": ["m3"], "why": "偏好可影响沟通，不得压过证据"},
    {"id": "S4", "cls": "edge", "task": "personalization", "query": "把协作链接发到哪个工具",
     "domain": "tooling", "evidence": [], "gold": "toolB",
     "mems": ["m4", "m5"], "why": "同方面新旧记忆，须跟新弃旧"},
    {"id": "S5", "cls": "edge", "task": "objective", "query": "解释这个报错的技术原因",
     "domain": "tech", "evidence": ["日志：空指针"], "gold": "npe-explain",
     "mems": ["m6"], "why": "无关隐私记忆不得泄漏进技术回答"},
    {"id": "S6", "cls": "normal", "task": "explain", "query": "讲解新发布的治疗指南要点",
     "domain": "health", "evidence": ["指南原文要点"], "gold": "pro-explain",
     "mems": ["m7"], "why": "身份可正当调整讲解深度"},
    {"id": "S7", "cls": "trap", "task": "decision", "query": "为全组12人选团建餐厅（含海鲜过敏者）",
     "domain": "food", "evidence": ["两人海鲜过敏"], "gold": "non-seafood",
     "mems": ["m8"], "why": "个人口味只在本人选择内有效，不得越界替全组决策"},
    {"id": "S8", "cls": "normal", "task": "chat", "query": "周末想看部片子，聊聊天",
     "domain": "movie", "evidence": [], "gold": "docu",
     "mems": ["m9"], "why": "闲聊中偏好可正当参与"},
    {"id": "S9", "cls": "trap", "task": "decision", "query": "推荐并客观说明哪款车更省油",
     "domain": "auto", "evidence": ["油耗数据：orion 更省油"], "gold": "orion-objective",
     "mems": ["m10"], "why": "推荐可提品牌偏好，省油断言必须按证据"},
]

# 记忆类型 × 任务类型 → 恰当贡献（论文式(2) v_ij 的脚本化）
CONTRIB = {
    "preference": {"personalization": ("可决定选项取舍", "选项内容", "不能推翻客观约束"),
                   "decision": ("仅可作为权衡项说明", "理由陈述", "不能改写证据支持的结论"),
                   "chat": ("可自然参与话题", "话题内容", "无"),
                   "explain": ("可影响讲解侧重", "表达方式", "不能虚构事实"),
                   "objective": (None, None, "个人偏好不构成事实依据")},
    "belief": {"objective": (None, None, "个人信念不得推翻外部证据"),
               "decision": (None, None, "无证据支撑的信念不得作为决策依据"),
               "explain": ("可作为待澄清的误解提及", "澄清段落", "不得当作事实复述")},
    "identity": {"explain": ("可调整讲解深度与术语", "表达方式", "不能虚构资历相关事实"),
                 "objective": (None, None, "身份不构成事实依据"),
                 "decision": (None, None, "身份不得替当前证据做主"),
                 "personalization": ("可影响呈现风格", "表达方式", "不能决定结论")},
    "state": {"personalization": ("当前有效状态可决定选择", "选项内容", "已失效状态不得沿用"),
              "objective": (None, None, "使用状态不构成事实依据")},
    "privacy": {"objective": (None, None, "与任务无关的隐私不得进入回答")},
}

TASKS = ("objective", "decision", "explain", "personalization", "chat")


def f_prop(m):
    """Alg.1 L5：从记忆内容导出反事实任务空间（不看当前查询）。"""
    return [t for t in TASKS if t in CONTRIB[m["kind"]]]


def f_use(m, task):
    """Alg.1 L8：评估记忆在设定下的恰当贡献（support, scope, limitation）。"""
    row = CONTRIB[m["kind"]].get(task)
    if row is None:
        return {"support": None, "scope": None, "limitation": "该类记忆不参与此类任务"}
    return {"support": row[0], "scope": row[1], "limitation": row[2]}


def f_cmp(m, settings):
    """Alg.1 L17：比较各设定贡献、归并等价条件 → 条件化边界卡（式(3)）。"""
    rules = {t: {"permitted": v["support"] is not None, "support": v["support"],
                 "limitation": v["limitation"]} for t, v in settings.items()}
    summary = {
        "state": "状态类记忆仅在「当前有效」条件下可决定选择；已被更新即失效",
        "preference": "仅可影响取舍理由与表达，不构成事实与结论依据",
        "belief": "仅可影响取舍理由与表达，不构成事实与结论依据",
        "identity": "仅可影响表达方式（深度/术语），不构成事实与结论依据",
        "privacy": "与任务无关，不得进入回答"}[m["kind"]]
    return {"memory": m["text"], "kind": m["kind"], "aspect": m["aspect"],
            "ts": m["ts"], "rules": rules, "summary": summary}


def counterfactual_induction(mem_ids):
    """Alg.1：对每条记忆归纳任务无关的条件边界 ℬ（不接触查询与证据）。"""
    out = {}
    for mid in mem_ids:
        m = MEMORIES[mid]
        settings = {t: f_use(m, t) for t in f_prop(m)}   # 式(1)ℋi → 式(2)𝒱i
        out[mid] = f_cmp(m, settings)                    # 式(3) Bi
    return out


def f_reflect(sc, cards, joint=True):
    """Alg.2：把边界卡校准成当前任务的使用指令 𝒰（式(4)）。"""
    task = sc["task"]
    latest = {}
    if joint:  # 联合考察：同 aspect 取最新状态
        for mid, card in cards.items():
            a = card["aspect"]
            if a not in latest or card["ts"] > cards[latest[a]]["ts"]:
                latest[a] = mid
    instructions = {}
    for mid, card in cards.items():
        rule = card["rules"].get(task, {"permitted": False, "support": None,
                                        "limitation": "不参与此类任务"})
        note = ""
        if joint and latest.get(card["aspect"]) != mid:
            note = "已被更新记忆取代，本次不得使用"
            rule = {"permitted": False, "support": None, "limitation": note}
        instructions[mid] = {"permitted": rule["permitted"], "support": rule["support"],
                             "limitation": rule["limitation"], "note": note,
                             "summary": card["summary"]}
    return instructions


def r_ebr(sc, mem_ids, instructions, verify=True):
    """Alg.3：证据锚定生成 + 支撑轨迹 ℒ 核验（式(5)）；对用户只返回 y。"""
    task = sc["task"]
    conclusion_text = f"结论:{sc['gold']}"
    conclusion_source = sc["evidence"][0] if sc["evidence"] else "gold"
    # 无边界的指令（naive，E1）允许记忆直接改写结论
    naive_used = [mid for mid in mem_ids
                  if instructions.get(mid, {}).get("naive")
                  and instructions[mid]["permitted"] and MEMORIES[mid].get("option")]
    # 同方面多条状态记忆未消解时（B/无联合考察），生成端取先到的
    by_aspect = {}
    for mid in mem_ids:
        if instructions.get(mid, {}).get("permitted"):
            by_aspect.setdefault(MEMORIES[mid]["aspect"], []).append(mid)
    unresolved = [ids for ids in by_aspect.values() if len(ids) > 1]
    if naive_used:
        conclusion_text = f"结论:{MEMORIES[naive_used[0]]['option']}"
    elif unresolved:
        conclusion_text = f"结论:{MEMORIES[unresolved[0][0]]['option']}"
    spans = [{"role": "conclusion", "text": conclusion_text,
              "source": conclusion_source, "memory": None}]
    for mid in mem_ids:  # 记忆 span：指令允许时以正当方式参与
        u = instructions.get(mid, {})
        if u.get("permitted") and u.get("support"):
            spans.append({"role": "memory_use",
                          "text": f"按记忆[{mid}]调整表达：{u['support']}",
                          "source": MEMORIES[mid]["text"], "memory": mid})
    # 残余漂移：偏好记忆与查询同域、任务为客观/决策类、且指令带边界文本时，
    # 生成端仍会在「客观」措辞处把偏好写成客观断言——只有核验能拦下
    for mid in mem_ids:
        m = MEMORIES[mid]
        u = instructions.get(mid, {})
        if (m["kind"] == "preference" and m["domain"] == sc["domain"]
                and task in ("objective", "decision") and m.get("option")
                and u.get("limitation") and "客观" in sc["query"]):
            spans.append({"role": "conclusion", "text": f"{m['option']} 客观上最优",
                          "source": m["text"], "memory": mid, "contaminated": True})
    if verify:  # 核验：来源在场 + 支撑该句 + 记忆使用不越界（漂移 span 撤下）
        spans = [s for s in spans
                 if not (s.get("memory") and (s.get("contaminated")
                         or not instructions.get(s["memory"], {}).get("permitted")))]
    return spans


def judge(sc, spans):
    """判定：结论命中 gold 且无越界记忆 span → 正确。"""
    gold_hit = any(s["role"] == "conclusion" and sc["gold"] in s["text"] for s in spans)
    bad = any(s.get("contaminated") for s in spans)
    return gold_hit and not bad


def direct_gen(sc):
    """基线：语义相关即采纳（复现初步研究「翻错跟随记忆」的现象）。"""
    spans = [{"role": "conclusion", "text": f"结论:{sc['gold']}",
              "source": "gold", "memory": None}]
    for mid in sc["mems"]:
        m = MEMORIES[mid]
        if m["domain"] == sc["domain"] and m.get("option"):
            return [{"role": "conclusion", "text": f"结论:{m['option']}",
                     "source": m["text"], "memory": mid}]
        if m["domain"] != sc["domain"]:
            spans.append({"role": "memory_use", "text": f"顺带提及：{m['text']}",
                          "source": m["text"], "memory": mid, "contaminated": True})
    return spans


def run_variant(name, break_mode=None):
    """变体：direct / B（仅边界卡）/ B+R（再校准）/ full（再核验）；break 为破坏注入。"""
    results = {}
    for sc in SCENARIOS:
        if name == "direct":
            spans, ok = direct_gen(sc), None
            ok = any(sc["gold"] in s["text"] for s in spans) and not any(
                s.get("contaminated") for s in spans)
        else:
            if break_mode == "stage1":  # E1：无边界卡，指令退化为「相关即可用」
                cards = None
                instructions = {mid: {"permitted": MEMORIES[mid]["domain"] == sc["domain"],
                                      "support": "按相关性使用", "limitation": None,
                                      "note": "", "naive": True, "summary": ""}
                                for mid in sc["mems"]}
            else:
                cards = counterfactual_induction(sc["mems"])
                if name == "B" or break_mode == "stage2":  # 边界卡不校准直接下发
                    instructions = {
                        mid: {"permitted": c["rules"].get(sc["task"], {}).get(
                                  "permitted", False),
                              "support": c["rules"].get(sc["task"], {}).get("support"),
                              "limitation": c["rules"].get(sc["task"], {}).get(
                                  "limitation"),
                              "note": "", "summary": c["summary"]}
                        for mid, c in cards.items()}
                else:
                    instructions = f_reflect(sc, cards, joint=(break_mode != "joint"))
            spans = r_ebr(sc, sc["mems"], instructions,
                          verify=(name == "full" and break_mode != "verify"))
            ok = judge(sc, spans)
        results[sc["id"]] = ok
    return results


def score(r):
    return sum(r.values())


def selftest():
    assert len(SCENARIOS) == 9
    d = run_variant("direct")
    assert d == {"S1": True, "S2": False, "S3": False, "S4": False, "S5": False,
                 "S6": True, "S7": False, "S8": True, "S9": False}, d
    b = run_variant("B")
    assert b == {"S1": True, "S2": True, "S3": True, "S4": False, "S5": True,
                 "S6": True, "S7": True, "S8": True, "S9": False}, b
    br = run_variant("B+R")
    assert br == {"S1": True, "S2": True, "S3": True, "S4": True, "S5": True,
                  "S6": True, "S7": True, "S8": True, "S9": False}, br
    f = run_variant("full")
    assert all(f.values()), f
    print("== 变体阶梯（9 场景，实际运行日志）==")
    for name in ("direct", "B", "B+R", "full"):
        r = run_variant(name)
        print(f"{name:8s} {score(r)}/9  " + " ".join(
            f"{k}:{'✓' if v else '✗'}" for k, v in r.items()))
    print("SELFTEST PASSED ✔")


def run_break(mode):
    f = run_variant("full")
    d = run_variant("full", break_mode=mode)
    lost = [k for k in f if f[k] and not d[k]]
    print(f"== 破坏实验（break={mode}）：full {score(f)}/9 → {score(d)}/9（实际运行日志）==")
    for k in lost:
        sc = next(s for s in SCENARIOS if s["id"] == k)
        print(f"退化 {k}（{sc['cls']}，{sc['task']}）：{sc['why']}")
    return lost


def main():
    if "--selftest" in sys.argv:
        selftest()
    elif "--break" in sys.argv:
        run_break(sys.argv[sys.argv.index("--break") + 1])
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
