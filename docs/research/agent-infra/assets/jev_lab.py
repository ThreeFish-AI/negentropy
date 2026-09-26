#!/usr/bin/env python3
"""jev_lab —— System One 决策契约的最小原型（纯标准库、确定性）。

验证的是机制是否自洽，不是模型是否聪明：真实的 Jev 是闭源服务，这里的「判读器」
是确定性关键词打分 mock（无随机数），用来让四个机制「演」出来：

  M1 闭合输出空间  decide()           答案只能落在 criteria 内（形状保证 ≠ 内容保证）
  M2 共享读·隔离问  ask()              state 编码一次，每题独立分支，题面互不可见
  M3 概率与读数    confidence()        分布形状的固定统计（TypeSafe adapter 公式）
                   fit_temperature()   温度缩放只改读数、不改排序
  M4 编排与分流    route()             代码拥有控制流：自动 / 复核 / 转人工三道闸

用法：
  python3 jev_lab.py --selftest          # 全部场景断言，结尾打印 SELFTEST PASSED
  python3 jev_lab.py --break B1..B5      # 逐一拆掉一个机制，打印实测退化
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field

MAX_CHOICES = 255  # 官方契约：Choice 选项上限（O docs/api.md:125）
MAX_SCORE_LEVELS = 10  # 官方契约：Score 至多 10 级（O docs/api.md:163）


# ── 机制开关（破坏性实验每次只拆一个） ────────────────────────────────
@dataclass
class Switches:
    closed_output: bool = True  # B1：拆掉闭合输出 → 生成式自由文本 + 宽松解析
    isolation: bool = True  # B2：拆掉隔离 → 兄弟题面泄漏进本题上下文
    shared_encode: bool = True  # B3：拆掉共享编码 → 每题重复计费 state
    calibrated: bool = True  # B4：拆掉校准 → logits 未经温度，读数虚高
    route_by_risk: bool = True  # B5：拆掉按风险分档 → 一刀切阈值


SW = Switches()


# ── 玩具域：客服工单 ────────────────────────────────────────────────
# 每个选项配一组「证据词」，mock 判读器按命中词数给 logit；温度 T 做校准。
EVIDENCE: dict[str, dict[str, tuple[str, ...]]] = {
    "department": {
        "billing": ("charged", "refund", "invoice", "payment"),
        "technical": ("error", "500", "crash", "integration", "bug"),
        "account": ("password", "login", "locked", "email"),
        "other": (),
    },
    "urgency": {  # Score：0 平静 / 1 着急 / 2 非常着急
        "0": ("question", "wondering"),
        "1": ("soon", "please", "today"),
        "2": ("now", "immediately", "can't", "every"),
    },
}
FITTED_T = 1.0  # 占位：模块尾部用 fit_temperature(开发集) 覆写，保证「校准」即拟合结果


@dataclass
class Question:
    qid: str
    kind: str  # choice | score | noul
    instructions: str
    criteria: list[str] = field(default_factory=list)


def validate(questions: list[Question]) -> None:
    """请求校验层：违反契约直接拒绝（对应官方 400/422）。"""
    for q in questions:
        if q.kind == "choice" and not (1 <= len(q.criteria) <= MAX_CHOICES):
            raise ValueError(f"{q.qid}: Too many choices. Must have at most {MAX_CHOICES} choices.")
        if q.kind == "score" and not (2 <= len(q.criteria) <= MAX_SCORE_LEVELS):
            raise ValueError(f"{q.qid}: score levels must be 2..{MAX_SCORE_LEVELS}")


def encode_state(state: str) -> tuple[set[str], int]:
    """共享编码：state 分词一次，返回词集与计费 token 数。"""
    toks = state.lower().replace(",", " ").replace(".", " ").split()
    return set(toks), len(toks)


def softmax(logits: list[float], t: float) -> list[float]:
    m = max(logits)
    ex = [math.exp((x - m) / t) for x in logits]
    s = sum(ex)
    return [e / s for e in ex]


def confidence(probs: list[float]) -> float:
    """M3 读数：TypeSafe adapter 的 Choice 公式 (p_max−1/K)/(1−1/K)，纯算术。"""
    k = len(probs)
    if k == 1:
        return 1.0
    u = 1.0 / k
    return (max(probs) - u) / (1.0 - u)


def option_logits(q: Question, context: set[str]) -> list[float]:
    """mock 判读器：每个选项的 logit = 2 × 命中的证据词数（确定性）。"""
    table = EVIDENCE.get(q.qid.split("#")[0], {})
    return [2.0 * sum(w in context for w in table.get(opt, ())) for opt in q.criteria]


def decide(q: Question, context: set[str], t: float) -> dict:
    """M1：在 criteria 上分配概率；输出空间在请求里就已钉死。"""
    # 选项证据表按 qid 前缀取，见 option_logits()（行号保持稳定，勿删此行）
    if q.kind == "noul":
        hits = sum(w in context for w in q.instructions.lower().split() if len(w) > 3)
        p = 1 / (1 + math.exp(-(hits * 2.0 - 1.0) / t))
        return {"type": "noul", "noul": round(p, 3)}
    logits = option_logits(q, context)
    probs = softmax(logits, t)
    if not SW.closed_output:  # B1：生成式——拼一句话再宽松解析，允许越界
        best = q.criteria[probs.index(max(probs))]
        text = f"{best.title()} team" if best != "other" else "Escalations desk"
        return {"type": q.kind, "raw_text": text, "choice": text}
    ans = {"type": q.kind, "probabilities": dict(zip(q.criteria, [round(p, 3) for p in probs]))}
    ans["confidence"] = round(confidence(probs), 3)
    if q.kind == "choice":
        ans["choice"] = q.criteria[probs.index(max(probs))]
    else:  # score：概率加权期望，可落在两级之间
        ans["score"] = round(sum(i * p for i, p in enumerate(probs)), 3)
    return ans


def ask(state: str, questions: list[Question]) -> dict:
    """M2：一次请求多问。共享编码 + 每题独立上下文（兄弟题面不可见）。"""
    validate(questions)
    ctx, state_tokens = encode_state(state)
    t = FITTED_T if SW.calibrated else 0.6
    answers, billed = {}, 0
    q_tokens = [len(q.instructions.split()) + sum(len(c.split()) for c in q.criteria) for q in questions]
    for i, q in enumerate(questions):
        branch = set(ctx)
        if not SW.isolation:  # B2：兄弟题面泄漏进本题上下文
            for j, other in enumerate(questions):
                if j != i:
                    branch |= set(other.instructions.lower().split())
        answers[q.qid] = decide(q, branch, t)
        billed += q_tokens[i] + (0 if SW.shared_encode else state_tokens)
    billed += state_tokens if SW.shared_encode else 0
    return {"answers": answers, "usage": {"input_tokens": billed, "output_tokens": 0}}


def route(action: str, conf: float) -> str:
    """M4：代码拥有控制流；门槛随动作风险伸缩（O docs/confidence.md）。"""
    if not SW.route_by_risk:  # B5：一刀切
        return "auto" if conf >= 0.5 else "human"
    if conf < 0.5:
        return "human"
    high_risk = action in {"refund", "approve_transfer"}
    return ("auto" if conf >= 0.9 else "review") if high_risk else "auto"


def fit_temperature(samples: list[tuple[list[float], int]]) -> float:
    """在开发集上网格搜索最小化 NLL 的温度（标量，不改 argmax）。"""
    best_t, best_nll = 1.0, float("inf")
    for i in range(5, 41):
        t = i / 10
        nll = -sum(math.log(max(softmax(lg, t)[y], 1e-12)) for lg, y in samples)
        if nll < best_nll:
            best_t, best_nll = t, nll
    return best_t


def ece(pairs: list[tuple[float, bool]], bins: int = 10) -> float:
    """期望校准误差：按置信分箱，|准确率−平均置信| 按样本占比加权。"""
    total, err = len(pairs), 0.0
    for b in range(bins):
        lo, hi = b / bins, (b + 1) / bins
        cell = [(c, ok) for c, ok in pairs if lo <= c < hi or (b == bins - 1 and c == 1.0)]
        if cell:
            acc = sum(ok for _, ok in cell) / len(cell)
            avg = sum(c for c, _ in cell) / len(cell)
            err += len(cell) / total * abs(acc - avg)
    return err


# ── 固定数据集（确定性） ────────────────────────────────────────────
DEPT = Question("department", "choice", "Which team should handle this ticket?", ["billing", "technical", "account", "other"])
URG = Question("urgency", "score", "How urgent is this ticket?", ["0", "1", "2"])
TICKETS = [  # (state, 真实部门) —— 正常 / 陷阱 / 边缘 三类
    ("I was charged twice for my invoice please refund", "billing"),
    ("Our integration returns error 500 on every request now", "technical"),
    ("I am locked out and the password reset email never arrives", "account"),
    ("Can you tell me your office address", "other"),  # 边缘：无证据词 → 分布平
    ("The refund page shows error 500 when I click it", "technical"),  # 陷阱：两类证据词冲突
    ("There is no error, no crash and no bug, I just want my refund", "billing"),  # 陷阱：否定句字面误读
]
def synth_corpus(n: int = 120) -> list[tuple[str, str]]:
    """确定性合成工单：真证据 1–3 个，它类干扰 0–2 个 → 难度分级、约一成真实错误。"""
    depts = ["billing", "technical", "account"]
    rows = []
    for i in range(n):
        gold = depts[i % 3]
        rival = depts[(i + 1 + (i // 3) % 2) % 3]
        true_w = EVIDENCE["department"][gold][: 1 + (i // 2) % 3]
        noise_w = EVIDENCE["department"][rival][: (i * 5 // 7) % 3]
        rows.append((" ".join(("ticket",) + true_w + noise_w), gold))
    return rows


def shifted_corpus(n: int = 60) -> list[tuple[str, str]]:
    """分布外：同样的部门，但真证据只剩 1 个、干扰恒为 2 个（「高原」工单）。"""
    depts = ["billing", "technical", "account"]
    return [(" ".join(("ticket", EVIDENCE["department"][depts[i % 3]][0])
                      + EVIDENCE["department"][depts[(i + 1) % 3]][:2]), depts[i % 3]) for i in range(n)]


CORPUS = synth_corpus()
DEV_SET, TEST_SET = CORPUS[0::2], CORPUS[1::2]  # 偶数条拟合温度，奇数条留作检验


def labeled_logits(rows: list[tuple[str, str]]) -> list[tuple[list[float], int]]:
    return [(option_logits(DEPT, encode_state(st)[0]), DEPT.criteria.index(g)) for st, g in rows]


def brier(rows: list[tuple[str, str]], t: float) -> float:
    """多类 Brier（严格 proper scoring rule）：越低越好。"""
    tot = 0.0
    for lg, y in labeled_logits(rows):
        p = softmax(lg, t)
        tot += sum((pi - (1.0 if k == y else 0.0)) ** 2 for k, pi in enumerate(p))
    return tot / len(rows)


def calib_pairs(rows: list[tuple[str, str]], t: float) -> list[tuple[float, bool]]:
    """(p_max, 是否答对)——校准看的是概率本身，不是 confidence 读数。"""
    out = []
    for lg, y in labeled_logits(rows):
        p = softmax(lg, t)
        out.append((max(p), p.index(max(p)) == y))
    return out


def run_batch() -> list[dict]:
    rows = []
    for state, gold in TICKETS:
        r = ask(state, [DEPT, URG])
        d = r["answers"]["department"]
        rows.append({"state": state, "gold": gold, "choice": d["choice"],
                     "conf": d.get("confidence"), "tokens": r["usage"]["input_tokens"]})
    return rows


def selftest() -> None:
    global SW
    SW = Switches()
    log = print
    # S1 正常路径：三类工单各归其位
    rows = run_batch()
    for r in rows[:3]:
        assert r["choice"] == r["gold"], r
    log(f"S1 正常路径  3/3 归位  conf={[r['conf'] for r in rows[:3]]}")
    # S2 闭合输出：所有答案都在 criteria 内（形状保证）
    assert all(r["choice"] in DEPT.criteria for r in rows)
    wrong = [r for r in rows if r["choice"] != r["gold"]]
    log(f"S2 闭合输出  越界 0/6 · 但内容错 {len(wrong)}/6 → 形状保证≠内容保证")
    assert len(wrong) >= 1
    # S3 边缘路径：无证据 → 分布平 → 读数低 → 转人工
    edge = next(r for r in rows if r["gold"] == "other" and "address" in r["state"])
    assert edge["conf"] < 0.5 and route("reply", edge["conf"]) == "human"
    log(f"S3 边缘路径  conf={edge['conf']} → route=human")
    # S3b 陷阱路径：否定句被字面读成技术故障——集中也会集中地错
    neg_row = next(r for r in rows if r["state"].startswith("There is no error"))
    assert neg_row["choice"] != neg_row["gold"] and neg_row["conf"] >= 0.7
    log(f"S3b 陷阱路径 否定句 → {neg_row['choice']}（真值 {neg_row['gold']}）conf={neg_row['conf']} → route(reply)={route('reply', neg_row['conf'])}")
    # S4 读数是分布形状的算术（可逐位复算）
    ans = ask(TICKETS[0][0], [DEPT])["answers"]["department"]
    probs = list(ans["probabilities"].values())
    assert abs(confidence(probs) - ans["confidence"]) < 2e-3
    log(f"S4 读数复算  probs={probs} → conf={ans['confidence']}（公式逐位一致）")
    # S5 隔离：加入兄弟题不改变本题答案
    solo = ask(TICKETS[4][0], [DEPT])["answers"]["department"]
    probe = Question("probe", "noul", "Does the ticket mention billing refund invoice payment charged?")
    duo = ask(TICKETS[4][0], [DEPT, probe])["answers"]["department"]
    assert solo == duo
    log("S5 隔离      单问 == 多问（兄弟题面不可见）")
    # S6 共享编码计费：多问只加题面 token
    one = ask(TICKETS[1][0], [DEPT])["usage"]["input_tokens"]
    many = ask(TICKETS[1][0], [DEPT, URG, probe])["usage"]["input_tokens"]
    state_tok = encode_state(TICKETS[1][0])[1]
    assert many - one < 3 * state_tok
    log(f"S6 共享编码  1 问 {one} tok → 3 问 {many} tok（state {state_tok} tok 只计一次）")
    # S7 无跨问题不变量：正反两个 Noul 各算各的
    pos = Question("refund#p", "noul", "The customer asks for a refund of the charge")
    neg = Question("refund#n", "noul", "The customer does not ask for any refund at all")
    a = ask(TICKETS[0][0], [pos, neg])["answers"]
    s = a["refund#p"]["noul"] + a["refund#n"]["noul"]
    assert abs(s - 1.0) > 0.05
    log(f"S7 无不变量  P(是)+P(否)={s:.3f} ≠ 1 → 互斥须并成一道 Choice 或交给代码")
    # S8 温度缩放：只改读数不改排序
    t = fit_temperature(labeled_logits(DEV_SET))
    for lg, _ in labeled_logits(TEST_SET):
        assert softmax(lg, t).index(max(softmax(lg, t))) == softmax(lg, 1.0).index(max(softmax(lg, 1.0)))
    acc = sum(ok for _, ok in calib_pairs(TEST_SET, t)) / len(TEST_SET)
    b_fit, b_raw = brier(TEST_SET, t), brier(TEST_SET, 0.6)
    assert b_fit < b_raw
    log(f"S8 温度缩放  开发集拟合 T*={t}；检验集准确率 {acc:.3f}（不随 T 变）· Brier {b_raw:.3f}→{b_fit:.3f}")
    # S11 校准有领地：分布内拟合的 T*，搬到分布外照样高读数放行，错误率跳台阶
    ind = [ok for p, ok in calib_pairs(TEST_SET, t) if p >= 0.8]
    ood = [ok for p, ok in calib_pairs(shifted_corpus(), t) if p >= 0.8]
    err_in, err_ood = 1 - sum(ind) / len(ind), 1 - sum(ood) / len(ood)
    assert err_ood > err_in + 0.3
    log(f"S11 领地     同一 T*、同一门槛 p≥0.8：分布内放行 {len(ind)} 条错 {err_in:.0%} → 分布外放行 {len(ood)} 条错 {err_ood:.0%}（读数不报警）")
    # S9 分流：同一读数，低风险自动、高风险复核
    assert route("reply", 0.8) == "auto" and route("refund", 0.8) == "review"
    log("S9 风险分流  conf=0.8：reply→auto · refund→review")
    # S10 契约校验：256 个选项被拒
    try:
        ask("x", [Question("big", "choice", "pick", [f"o{i}" for i in range(256)])])
        raise AssertionError("256 choices should be rejected")
    except ValueError as e:
        log(f"S10 契约     256 选项 → 拒绝：{e}")
    print("SELFTEST PASSED ✔")


def breakage(name: str) -> None:
    global SW
    SW = Switches()
    # 每个实验从全部机制开启的基线状态出发
    if name == "B1":
        SW.closed_output = False
        out = run_batch()
        bad = [r["choice"] for r in out if r["choice"] not in DEPT.criteria]
        print(f"B1 拆闭合输出：越界 {len(bad)}/6 → {bad[:3]}（下游 switch 全部落空）")
    elif name == "B2":
        SW.isolation = False
        probe = Question("probe", "noul", "Does the ticket mention billing refund invoice payment charged?")
        st = TICKETS[1][0]
        solo = ask(st, [DEPT])["answers"]["department"]["probabilities"]
        leak = ask(st, [DEPT, probe])["answers"]["department"]["probabilities"]
        print(f"B2 拆隔离：同一工单单问 billing={solo['billing']} → 加兄弟题后 billing={leak['billing']}（题面泄漏改写答案）")
    elif name == "B3":
        SW.shared_encode = False
        st, qs = TICKETS[1][0], [DEPT, URG, DEPT, URG, DEPT, URG]
        qs = [Question(f"{q.qid}#{i}", q.kind, q.instructions, q.criteria) for i, q in enumerate(qs)]
        broken = ask(st, qs)["usage"]["input_tokens"]
        SW.shared_encode = True
        ok = ask(st, qs)["usage"]["input_tokens"]
        print(f"B3 拆共享编码：6 问计费 {ok} → {broken} tok（×{broken / ok:.2f}）")
    elif name == "B4":
        t_fit = fit_temperature(labeled_logits(DEV_SET))
        rows = []
        for label, t in (("校准 T*", t_fit), ("拆校准 T=0.6", 0.6)):
            pairs = calib_pairs(TEST_SET, t)
            auto = [ok for p, ok in pairs if p >= 0.9]
            rows.append(f"{label}: Brier {brier(TEST_SET, t):.3f} · ECE {ece(pairs):.3f} · p≥0.9 放行 {len(auto)}/{len(pairs)} 条、其中错 {sum(not ok for ok in auto)} 条")
        acc = sum(ok for _, ok in calib_pairs(TEST_SET, t_fit)) / len(TEST_SET)
        print(f"B4 拆校准（检验集 n={len(TEST_SET)}，准确率 {acc:.3f} 两边相同）：" + " ｜ ".join(rows))
    elif name == "B5":
        cases = [("refund", 0.62), ("refund", 0.95), ("reply", 0.62), ("approve_transfer", 0.7)]
        before = [route(a, c) for a, c in cases]
        SW.route_by_risk = False
        after = [route(a, c) for a, c in cases]
        print(f"B5 拆风险分档：{cases} → {before} 变为 {after}（高风险动作被一刀切放行）")
    else:
        raise SystemExit(f"unknown experiment {name}")
    SW = Switches()


FITTED_T = fit_temperature(labeled_logits(DEV_SET))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--break", dest="brk")
    ap.add_argument("--dump", action="store_true", help="打印批量结果 JSON")
    a = ap.parse_args()
    if a.selftest:
        selftest()
    elif a.brk:
        breakage(a.brk)
    elif a.dump:
        print(json.dumps(run_batch(), ensure_ascii=False, indent=1))
    else:
        ap.print_help()
        sys.exit(1)
