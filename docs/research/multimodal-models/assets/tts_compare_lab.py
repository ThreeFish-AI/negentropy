#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""TTS 双系统机制对照原型（IndexTTS 2.5 vs Breeze TTS 2）

本原型只验证「机制逻辑按描述自洽」，不验证模型能力：所有"模型"均为确定性
查表/算术替代。同一命令永远同一日志。用法：
    python3 tts_compare_lab.py --selftest
机制单元：
  A dur_control      IndexTTS 时长控制：时长嵌入与位置嵌入共享对照表（W_num=W_sem）
  B grpo             GRPO 后训练：组内相对优势更新
  C cfg              Breeze CFG：无指令 + s×(有指令−无指令) 外推
  D frame_cost       帧率成本：50Hz→25Hz 序列长度减半
  E lang_routing     三种跨语策略：边界/逐 token/指令（同形字「行」消歧）
"""
import argparse
import json
import math
import sys


# ---------- A. 时长控制（共享对照表） ----------
def dur_control(target_t: int, share_tables: bool = True) -> dict:
    """确定性玩具生成器：每步根据 (位置, 剩余) 查表决定是否停。

    share_tables=True：模型把「目标长度 T」与「当前位置 i」查同一张表，
    位置感知精确，在第 T 步停；False：两张表独立学习，位置估计带确定性偏移。
    """
    pos_estimate = {}
    stop_at = None
    for i in range(1, target_t * 2 + 4):  # 给足超出空间
        if share_tables:
            pos_estimate[i] = i  # 共享表：位置=真位置
        else:
            pos_estimate[i] = i - (1 if i > target_t // 2 else 0)  # 独立表：后半程低估一步
        if pos_estimate[i] >= target_t and stop_at is None:
            stop_at = i
    return {"target": target_t, "stop_at": stop_at,
            "token_error_rate": abs(stop_at - target_t) / target_t}


# ---------- B. GRPO 组相对优势 ----------
def grpo_update(candidates: list, use_group_baseline: bool = True) -> dict:
    """candidates: [(id, wer, ss)]，奖励 r = ss - wer。返回更新后选择倾向与下一轮期望。

    组相对：adv = (r - mean)/std → 高于均值的候选被加强；
    绝对奖励（破坏实验）：adv = r 本身 → 组整体差时仍给出大更新，方向被绝对分数带偏。
    下一轮期望 WER 用加强后权重的加权平均模拟（确定性）。
    """
    rs = [ss - wer for _, wer, ss in candidates]
    mean = sum(rs) / len(rs)
    if use_group_baseline:
        std = math.sqrt(sum((r - mean) ** 2 for r in rs) / len(rs)) or 1.0
        advs = [(r - mean) / std for r in rs]
    else:
        advs = [r for r in rs]  # 无基线：绝对值
    weights = [max(0.0, a) + 1e-6 for a in advs]
    tot = sum(weights)
    next_wer = sum(w / tot * c[1] for w, c in zip(weights, candidates))
    return {"advantages": [round(a, 3) for a in advs],
            "next_round_expected_wer": round(next_wer, 3)}


# ---------- C. CFG 外推 ----------
def cfg_extrapolate(uncond, cond, scale: float):
    """向量级玩具：返回 uncond + s*(cond-uncond)。"""
    return [u + scale * (c - u) for u, c in zip(uncond, cond)]


def cfg_demo(scale: float) -> dict:
    base = [0.5, 0.5, 0.5]          # 无指令版（中性）
    instructed = [0.8, 0.5, 0.5]    # 带指令版：只有指令维（第 0 维）被推动
    out = cfg_extrapolate(base, instructed, scale)
    norm = math.sqrt(sum(v * v for v in out))
    axis_share = out[0] / norm      # 指令维在输出中的占比=指令浓度
    return {"scale": scale, "out": [round(v, 3) for v in out],
            "instruction_axis_share": round(axis_share, 3),
            "other_dims_unchanged": out[1:] == base[1:]}


# ---------- D. 帧率成本 ----------
def frame_cost(seconds: float, hz: int) -> dict:
    tokens = int(seconds * hz)
    return {"seconds": seconds, "hz": hz, "ar_steps": tokens,
            "steps_vs_25hz": round(tokens / (seconds * 25), 2)}


# ---------- E. 跨语策略（同形字消歧） ----------
HOMOGRAPH = {"行": {"zh": "xing2 银行", "ja": "kou 行く"}}
def lang_routing(tokens: list, mode: str) -> dict:
    """tokens: [(字, 语种)]。mode ∈ {none, boundary, token_concat, instruction}。

    确定性规则：正确读音需要 (字, 语种) 对齐；none=只有字序列；
    boundary=语种段落级（段内混入他语 token 判错）；
    token_concat=逐 token 语种；instruction=指令前缀给了全句语种（句内混语判错）。
    """
    readings, errors = [], 0
    cur_lang = None
    for i, (ch, lang) in enumerate(tokens):
        if mode == "boundary":
            if i == 0 or tokens[i - 1][1] != lang:
                cur_lang = lang  # 段首对齐
            eff = cur_lang
        elif mode == "token_concat":
            eff = lang
        elif mode == "instruction":
            eff = tokens[0][1]  # 全句按指令语种
        else:
            eff = "zh" if i % 2 == 0 else "ja"  # 无信号：确定性猜测
        want = HOMOGRAPH.get(ch, {}).get(lang, ch)
        got = HOMOGRAPH.get(ch, {}).get(eff, ch)
        if want != got:
            errors += 1
        readings.append(got)
    return {"mode": mode, "errors": errors, "readings": readings}


# ---------- 破坏性实验 ----------
def destructive_experiments() -> list:
    out = []
    # D1 拆共享表
    a1, a2 = dur_control(200, True), dur_control(200, False)
    out.append(("拆时长/位置共享表", f"停点 {a1['stop_at']}→{a2['stop_at']}，token 误差率 "
                 f"{a1['token_error_rate']:.3f}→{a2['token_error_rate']:.3f}",
                 "位置感知一坏，精确停长立刻失准"))
    # D2 拆组基线
    cands = [("a", 8.0, 70), ("b", 5.0, 71), ("c", 7.5, 69), ("d", 6.0, 70)]
    b1 = grpo_update(cands, True)
    b2 = grpo_update(cands, False)
    out.append(("GRPO 去组基线（改绝对奖励）",
                 f"下一轮期望 WER {b1['next_round_expected_wer']}→{b2['next_round_expected_wer']}"
                 f"（绝对奖励把更新权重压向高分候选之外的分布）",
                 "没有组内对照，更新方向由绝对分数带偏"))
    # D3 CFG 倍数归一
    c1, c2 = cfg_demo(4.0), cfg_demo(1.0)
    out.append(("CFG 倍数 4→1",
                 f"指令维占比 {c1["instruction_axis_share"]}→{c2["instruction_axis_share"]}",
                 "不放大差值时输出退回普通条件生成"))
    # D4 帧率不降
    d1, d2 = frame_cost(10, 25), frame_cost(10, 50)
    out.append(("帧率保持 50Hz 不降", f"AR 步数 {d1['ar_steps']}→{d2['ar_steps']}（翻倍）",
                 "序列长度直接吃掉提速空间"))
    # D5 拔掉语言信号
    toks = [("行", "zh"), ("银", "zh"), ("行", "ja")]
    e_none = lang_routing(toks, "none")["errors"]
    e_tok = lang_routing(toks, "token_concat")["errors"]
    out.append(("无任何语言信号", f"同形字误读 {e_tok}→{e_none} 处",
                 "跨语混读必须显式注入语种信号"))
    return out


def selftest() -> int:
    assert dur_control(100, True)["stop_at"] == 100
    assert dur_control(100, True)["token_error_rate"] == 0.0
    g = grpo_update([("a", 8.0, 70), ("b", 5.0, 71), ("c", 7.5, 69), ("d", 6.0, 70)])
    assert g["advantages"][1] > 0 > g["advantages"][0]  # 低 WER 高 SS 得正优势
    assert cfg_demo(4.0)["instruction_axis_share"] > cfg_demo(1.0)["instruction_axis_share"]
    assert frame_cost(10, 50)["ar_steps"] == 2 * frame_cost(10, 25)["ar_steps"]
    assert lang_routing([("行", "zh"), ("行", "ja")], "token_concat")["errors"] == 0
    assert lang_routing([("行", "zh"), ("行", "ja")], "instruction")["errors"] == 1  # 句内混语失准
    for name, obs, lesson in destructive_experiments():
        print(f"[destructive] {name} | 实测：{obs} | 教训：{lesson}")
    result = {
        "dur_control": dur_control(200, True),
        "grpo": grpo_update([("a", 8.0, 70), ("b", 5.0, 71), ("c", 7.5, 69), ("d", 6.0, 70)]),
        "cfg": [cfg_demo(1.0), cfg_demo(4.0)],
        "frame_cost": [frame_cost(10, 25), frame_cost(10, 50)],
        "lang_routing": {m: lang_routing([("行", "zh"), ("银", "zh"), ("行", "ja")], m)
                          for m in ("none", "boundary", "token_concat", "instruction")},
    }
    with open("lab-result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("SELFTEST PASSED ✔")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    sys.exit(selftest() if args.selftest else 0)
