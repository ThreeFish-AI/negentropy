#!/usr/bin/env python3
"""Jev（TypeSafe System One Model）· 最小原型实验室（guided-learn Phase 3）。

验证的是「类型化问题 → 一次编码 → 分支隔离 → 闭合解码 → 校准概率 → 阈值分流」这条机制链是否自洽，
不是模型聪不聪明：
- Jev 本体闭源（无论文无权重）。此处「判读」用确定性关键词重叠打分器替身 score_options，
  结构取 Archer Hume 探针假设与 jaredpalmer/kev@b8aa777 的开源实现（state 编码一次、问题分支互不可见、
  选项对决策位打分）；它回答「机制是否自洽」，不回答「Jev 准不准」。
- 校准实验用确定性「决策流」替身 decision_stream：真实正确率曲线 true_p(m) 与模型声明概率 stated_p(m)
  由公式给定、正确与否由低差异序列判定——无随机数，同一命令永远同一日志。
- confidence 公式逐式照抄官方 adapter：typesafe-ai/system-one-adapter-python@e1d4cc9
  src/system_one_adapter/_utils/confidence_metrics.py:4-24；契约上限取 docs.typesafe.ai/api.md。
- 成本/延迟常量取 evals.typesafe.ai 的 workflow 模式表（Jev $0.0004/0.4s、terra $0.0304/10.1s），
  属厂商自报口径，仅用于演示分流经济学，不是实测。

运行：
  uv run --no-project python docs/research/agent-infra/assets/jev_lab.py --selftest
  uv run --no-project python docs/research/agent-infra/assets/jev_lab.py --break B1   # B1..B6
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from dataclasses import dataclass

MAX_OPTIONS, MAX_LEVELS = 255, 10  # docs/api.md：Choice ≤255 选项；Score API 接受 ≤10 级
CHOICE_SHARP, NOUL_SHARP, NOUL_BIAS = 3.0, 5.5, -3.0
STOP = {"a", "an", "the", "is", "are", "am", "i", "my", "me", "it", "of", "to", "for", "and", "or", "on",
        "in", "this", "that", "be", "have", "has", "been", "do", "does", "not", "no", "about", "with", "we"}

# 破坏开关：--break Bn 只翻其中一个，每个开关在代码里只影响一两行
BREAK = {f"B{i}": False for i in range(1, 7)}


class ValidationError(ValueError):
    """对应 HTTP 422：请求未通过校验。"""


def toks(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOP]


def softmax(xs: list[float]) -> list[float]:
    mx = max(xs)
    es = [math.exp(x - mx) for x in xs]
    s = sum(es)
    return [e / s for e in es]


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


# ── M1 契约：类型化问题 + 请求校验（闭合输出空间的前提） ────────────────────────
@dataclass(frozen=True)
class Question:
    type: str  # noul | choice | score
    instructions: str
    criteria: tuple = ()  # choice: ((key, desc), ...)；score: (level_desc, ...)；noul: (true_desc, false_desc)


def validate_request(state: str, questions: dict[str, Question]) -> None:
    if not state or not questions:
        raise ValidationError("422: state 与 questions 必填")
    for qid, q in questions.items():
        if q.type == "choice" and not 2 <= len(q.criteria) <= MAX_OPTIONS:
            raise ValidationError(f"422: {qid} Choice 须 2..{MAX_OPTIONS} 个选项，实为 {len(q.criteria)}")
        if q.type == "score" and not 2 <= len(q.criteria) <= MAX_LEVELS:
            raise ValidationError(f"422: {qid} Score 须 2..{MAX_LEVELS} 级，实为 {len(q.criteria)}")
        if q.type not in {"noul", "choice", "score"}:
            raise ValidationError(f"422: {qid} 未知题型 {q.type}")


# ── confidence：逐式照抄 adapter confidence_metrics.py:4-24（固定公式，非模型学得） ──
def choice_confidence(probs: list[float]) -> float:
    if len(probs) == 1:
        return 1.0
    u = 1.0 / len(probs)
    return (max(probs) - u) / (1.0 - u)


def score_confidence(probs: list[float]) -> float:
    if len(probs) == 1:
        return 1.0
    mode = max(range(len(probs)), key=probs.__getitem__)
    dist = sum(p * abs(i - mode) for i, p in enumerate(probs))
    c = (len(probs) - 1) / 2
    mad = sum(abs(i - c) for i in range(len(probs))) / len(probs)
    return max(0.0, 1.0 - dist / mad)


# ── M2 一次编码 · 分支隔离 · 选项读出（确定性替身） ────────────────────────────
def score_options(descs: list[str], visible: set[str], temp: float) -> list[float]:
    logits = [CHOICE_SHARP * len(set(toks(d)) & visible) for d in descs]
    return softmax([z / temp for z in logits])


def verbalize(key: str, n_state_tokens: int) -> str:
    """B2 用：把「闭合解码」换成「先生成文本再解析」——模拟 LLM 的标签漂移与截断。"""
    drift = {"billing": "Billing team", "sales": "sales"}.get(key, key)
    raw = '```json\n{"choice": "%s"}\n```' % drift
    return raw[:14] if n_state_tokens > 12 else raw  # 长输入撞 max_tokens 被截断


def loads_lenient(raw: str) -> dict:
    """仿本仓 engine/utils/json_extract.py 的宽松解析：取首 { 到末 }，失败返回 {}。"""
    i, j = raw.find("{"), raw.rfind("}")
    try:
        return json.loads(raw[i : j + 1]) if 0 <= i < j else {}
    except json.JSONDecodeError:
        return {}


def decide(q: Question, visible: set[str], temp: float, n_state: int) -> dict:
    if q.type == "noul":
        t, f = (set(toks(x)) for x in q.criteria)
        x = NOUL_SHARP * (len(t & visible) - len(f & visible)) + NOUL_BIAS
        return {"noul": round(sigmoid(x / temp), 3)}
    descs = [d for _, d in q.criteria] if q.type == "choice" else list(q.criteria)
    probs = score_options(descs, visible, temp)
    if q.type == "score":
        return {"score": round(sum(i * p for i, p in enumerate(probs)), 3),
                "probabilities": [round(p, 3) for p in probs], "confidence": round(score_confidence(probs), 3)}
    keys = [k for k, _ in q.criteria]
    top = keys[max(range(len(probs)), key=probs.__getitem__)]
    if BREAK["B2"]:  # 拆掉闭合输出空间：生成文本 → 宽松解析 → 解析失败静默落默认
        top = loads_lenient(verbalize(top, n_state)).get("choice", keys[0])
    return {"choice": top, "probabilities": dict(zip(keys, (round(p, 3) for p in probs))),
            "confidence": round(choice_confidence(probs), 3)}


def ask(state: str, questions: dict[str, Question], temp: float = 1.0) -> tuple[dict, dict]:
    validate_request(state, questions)
    stats, shared, answers = {"state_encodes": 0, "tokens": 0}, None, {}
    for qid, q in questions.items():
        if shared is None or BREAK["B5"]:  # B5 拆掉共享前缀：每个问题重编码一次 state
            shared = set(toks(state))
            stats["state_encodes"] += 1
            stats["tokens"] += len(toks(state))
        stats["tokens"] += len(toks(q.instructions + " " + json.dumps(q.criteria)))
        visible = set(shared)
        if BREAK["B1"]:  # 拆掉分支隔离：兄弟问题的文字也进了本分支的可见上下文
            visible |= {w for o, oq in questions.items() if o != qid for w in toks(oq.instructions)}
        answers[qid] = decide(q, visible, temp, len(toks(state)))
    return answers, stats


# ── M3 校准：确定性决策流 + ECE + 温度拟合 ──────────────────────────────────
PHI, SQ2 = (math.sqrt(5) - 1) / 2, math.sqrt(2) - 1
K_SHARP = 2.4  # 模型声明 logit 的「锋利度」——与 kev README 报告的后验温度 2.1–2.4 同量级
DISC = {"in": 1.0, "ood": 0.45}  # 分布外：真实区分力降到 0.45，模型却照旧锋利


def decision_stream(n: int, domain: str, start: int = 0) -> list[tuple[float, bool]]:
    """每条决策 = (证据强度 m, 是否答对)。true_p 是『真实正确率』曲线，stated 由 K_SHARP 放大。"""
    out = []
    for i in range(start, start + n):
        m = 0.1 + 4.4 * ((i * SQ2) % 1.0)
        true_p = 1 / 3 if domain == "unknowable" else softmax([DISC[domain] * m, 0.0, 0.0])[0]
        out.append((m, ((i + 1) * PHI) % 1.0 < true_p))
    return out


def stated_p(m: float, temp: float) -> float:
    return softmax([K_SHARP * m / temp, 0.0, 0.0])[0]


def ece(pairs: list[tuple[float, bool]], bins: int = 10) -> float:
    tot, n = 0.0, len(pairs)
    for b in range(bins):
        cell = [(p, c) for p, c in pairs if b / bins <= p < (b + 1) / bins or (b == bins - 1 and p == 1.0)]
        if cell:
            tot += len(cell) / n * abs(sum(c for _, c in cell) / len(cell) - sum(p for p, _ in cell) / len(cell))
    return tot


def fit_temperature(data: list[tuple[float, bool]]) -> float:
    def nll(t: float) -> float:
        return -sum(math.log(max(1e-12, stated_p(m, t) if c else 1 - stated_p(m, t))) for m, c in data)
    return min((0.5 + 0.05 * k for k in range(151)), key=nll)  # 网格 0.5–8.0


def calib_report(data: list[tuple[float, bool]], temp: float, act_at: float = 0.95) -> dict:
    pairs = [(stated_p(m, temp), c) for m, c in data]
    acted = [c for p, c in pairs if p >= act_at]
    claimed = [1 - p for p, _ in pairs if p >= act_at]  # 过线决策「自称」的错误率
    return {"ece": round(ece(pairs), 3), "acc": round(sum(c for _, c in pairs) / len(pairs), 3),
            "conf_err": round(sum(1 for p, c in pairs if p >= 0.9 and not c) / len(pairs), 3),
            "act_share": round(len(acted) / len(pairs), 3),
            "act_err": round(1 - sum(acted) / len(acted), 3) if acted else None,
            "act_claimed": round(sum(claimed) / len(claimed), 3) if claimed else None}


# ── M4 快慢分工：阈值三档（执行 / 升级 System 2 / 转人工） ─────────────────────
JEV_COST, JEV_SEC, LLM_COST, LLM_SEC, LLM_ACC = 0.0004, 0.4, 0.0304, 10.1, 0.97


def gate(data: list[tuple[float, bool]], temp: float, hi: float = 0.95, lo: float = 0.6) -> dict:
    tiers, correct, cost, sec = {"act": 0, "llm": 0, "human": 0}, 0, 0.0, 0.0
    for i, (m, c) in enumerate(data):
        p = stated_p(m, temp)
        cost, sec = cost + JEV_COST, sec + JEV_SEC
        if p >= hi:
            tiers["act"] += 1
            correct += c
        elif p >= lo:
            tiers["llm"] += 1
            cost, sec = cost + LLM_COST, sec + LLM_SEC
            correct += ((i + 7) * PHI) % 1.0 < LLM_ACC
        else:  # 人工档：视作全对、成本不计入（只计件），故省下的钱是「上限」
            tiers["human"] += 1
            correct += 1
    n = len(data)
    return {**tiers, "acc": round(correct / n, 3), "cost": round(cost, 3), "sec": round(sec, 1),
            "all_llm_cost": round(n * LLM_COST, 3), "all_llm_sec": round(n * LLM_SEC, 1)}


# ── 场景 ───────────────────────────────────────────────────────────────────
DEPT = Question("choice", "Which team should handle this ticket?", (
    ("billing", "payment payments invoice invoices refund refunds charge charges charged"),
    ("technical", "bug bugs error errors crash crashes outage login"),
    ("sales", "pricing upgrade upgrading plan plans quote")))
URGENT = Question("noul", "Does this convey urgency?", ("urgent immediately now asap", "whenever later"))
FRUSTRATION = Question("score", "How frustrated is the customer?", ("calm fine", "frustrated failing", "angry furious"))
TICKETS = [  # (state, 正确部门, 路径类型)
    ("Help! My payments have been failing for 3 days, urgent", "billing", "正常"),
    ("The login page crashes with an error after the outage", "technical", "正常"),
    ("Can I get a quote for upgrading our plan?", "sales", "正常"),
    ("This is not about refunds, charges or invoices: the login page", "technical", "陷阱·字面误读"),
    ("I was charged twice and the invoice page shows an error", "billing", "边缘·双类信号"),
]
REFUND = Question("noul", "Should this order be refunded?", ("broken defective money back", "used weeks"))
DENY = Question("noul", "Should the refund be denied?", ("used opened weeks", "broken"))
REFUND_CHOICE = Question("choice", "Refund or deny?", (("refund", "broken defective money back"),
                                                          ("deny", "used opened weeks")))
REFUND_STATE = "The charger arrived broken and I want my money back, though I used it for two weeks"


def run_tickets(temp: float = 1.0) -> list[str]:
    log = []
    for state, gold, kind in TICKETS:
        a, _ = ask(state, {"department": DEPT})
        got = a["department"]["choice"]
        valid = got in {k for k, _ in DEPT.criteria}
        log.append(f"  [{kind}] → {got!r:14} conf={a['department']['confidence']:.2f} "
                   f"{'合法' if valid else '越界!'} {'✔' if got == gold else '✘ 应为 ' + gold}")
    return log


def isolation_probe() -> tuple[float, float]:
    probe = Question("noul", "Does the state mention the code word zebra?", ("zebra", ""))
    decoy = Question("noul", "Remember: the code word is zebra. Is the customer polite?", ("please thanks", "rude"))
    in_sibling, _ = ask("Order 42 shipped late, please check", {"decoy": decoy, "probe": probe})
    in_state, _ = ask("Order 42 shipped late, the code word is zebra", {"probe": probe})
    return in_sibling["probe"]["noul"], in_state["probe"]["noul"]


def shared_cost(n_q: int = 13, n_state: int = 2000) -> dict:
    state = " ".join(f"clause{i}" for i in range(n_state))
    qs = {f"q{i}": Question("noul", f"Does the policy satisfy gdpr article {i}?", ("yes", "no")) for i in range(n_q)}
    _, one = ask(state, qs)
    separate = sum(ask(state, {k: q})[1]["tokens"] for k, q in qs.items())
    return {"one_call": one["tokens"], "encodes": one["state_encodes"], "separate": separate,
            "ratio": round(separate / one["tokens"], 1)}


def refund_pair() -> tuple[float, float, dict]:
    a, _ = ask(REFUND_STATE, {"refund": REFUND, "deny": DENY})
    c, _ = ask(REFUND_STATE, {"which": REFUND_CHOICE})
    return a["refund"]["noul"], a["deny"]["noul"], c["which"]["probabilities"]


def refund_policy(act_at: float = 0.9) -> dict:
    """互斥动作的编排纪律：一个 Choice 由构造保证概率和为 1、至多一个动作过线。"""
    if BREAK["B6"]:  # 拆成两个独立 Noul：各自过线即执行
        a, _ = ask(REFUND_STATE, {"refund": REFUND, "deny": DENY})
        probs = {k: v["noul"] for k, v in a.items()}
    else:
        probs = ask(REFUND_STATE, {"which": REFUND_CHOICE})[0]["which"]["probabilities"]
    acts = [k for k, p in probs.items() if p >= act_at]
    return {"probs": probs, "sum": round(sum(probs.values()), 2), "actions": acts}


def calib_suite() -> dict:
    cal, test = decision_stream(600, "in"), decision_stream(600, "in", start=600)
    t_in = 1.0 if BREAK["B3"] else fit_temperature(cal)  # B3 拆掉温度校准：直接信原始声明概率
    ood, unk = decision_stream(600, "ood", start=1200), decision_stream(300, "unknowable", start=1800)
    t_ood = t_in if BREAK["B4"] else fit_temperature(decision_stream(200, "ood", start=2100))  # 自有数据重校准
    return {"t_in": round(t_in, 2), "t_ood": round(t_ood, 2),
            "raw": calib_report(test, 1.0), "cal": calib_report(test, t_in),
            "ood_reuse": calib_report(ood, t_in), "ood": calib_report(ood, t_ood),
            "unk": calib_report(unk, t_in), "gate": gate(test, t_in), "gate_ood": gate(ood, t_ood)}


def selftest() -> None:
    print("== S1 契约校验（422）")
    bad = [({"q": Question("choice", "x", tuple((f"o{i}", "d") for i in range(256)))}, "256 选项"),
           ({"q": Question("score", "x", tuple(f"l{i}" for i in range(11)))}, "11 级"), ({}, "空问题")]
    for qs, why in bad:
        try:
            ask("s", qs)
            raise AssertionError(f"{why} 应被拒")
        except ValidationError as e:
            print(f"  {why:6} → {e}")
    print("== S2 confidence 固定公式 × 官方文档示例")
    c1, c2 = choice_confidence([0.88, 0.12, 0.0]), score_confidence([0.0, 0.95, 0.05])
    s_val = sum(i * p for i, p in enumerate([0.0, 0.95, 0.05]))
    presets = [round(choice_confidence(p), 2) for p in ([0.9, 0.06, 0.04], [0.4, 0.33, 0.27], [1 / 3] * 3)]
    print(f"  choice [0.88,0.12,0] → {c1:.3f}（文档 0.81）；score [0,0.95,0.05] → {c2:.3f}（文档 0.92）"
          f"；score 值 {s_val:.2f}（文档 1.05）；三预设 {presets}")
    # 文档示例概率已四舍五入到两位：0.820/0.925 与文档 0.81/0.92 的差异落在舍入带内
    assert abs(c1 - 0.82) < 1e-9 and abs(c2 - 0.925) < 1e-9 and abs(s_val - 1.05) < 1e-9 and presets == [0.85, 0.1, 0.0]
    print("== S3 一次请求三题型（共享 state）")
    a, st = ask(TICKETS[0][0], {"is_urgent": URGENT, "department": DEPT, "frustration": FRUSTRATION})
    for k, v in a.items():
        print(f"  {k:11} {v}")
    assert st["state_encodes"] == 1 and abs(sum(a["department"]["probabilities"].values()) - 1) < 0.01
    print("== S4 闭合输出空间：合法 ≠ 正确")
    log = run_tickets()
    print("\n".join(log))
    assert all("越界" not in x for x in log) and "✘" in log[3] and "✔" in log[4]
    print("== S5 分支隔离探针（复刻 Hume：暗号放兄弟问题 vs 放 state）")
    sib, sta = isolation_probe()
    print(f"  暗号在兄弟问题 → P={sib}；暗号在 state → P={sta}")
    assert sib < 0.1 and sta > 0.9
    print("== S6 共享前缀：13 问 × 2000 token state")
    sc = shared_cost()
    print(f"  一次调用处理 {sc['one_call']} token（state 编码 {sc['encodes']} 次）；逐问分调 {sc['separate']} token"
          f" → {sc['ratio']}×（官方 cookbook 自报 13 问合并 12.2× 便宜）")
    assert sc["encodes"] == 1 and sc["ratio"] > 10
    print("== S7 跨问题无不变量：互补两问 vs 单个 Choice")
    r, d, ch = refund_pair()
    print(f"  Noul(退款)={r} + Noul(拒退)={d} = {r + d:.2f}；Choice {ch} 和={sum(ch.values()):.2f}")
    assert r + d > 1.2 and abs(sum(ch.values()) - 1) < 0.01
    print("== S8 校准：原始 vs 温度缩放（分布内）")
    cs = calib_suite()
    print(f"  拟合温度 T={cs['t_in']:.2f}（替身锋利度 {K_SHARP}）；raw {cs['raw']}")
    print(f"  cal {cs['cal']}")
    assert abs(cs["t_in"] - K_SHARP) < 0.3 and cs["cal"]["ece"] < cs["raw"]["ece"]
    assert cs["cal"]["acc"] == cs["raw"]["acc"]  # 温度不改排序 ⇒ 准确率一字不变
    gap = {k: cs[k]["act_err"] - cs[k]["act_claimed"] for k in ("raw", "cal")}  # 实际 − 自称
    assert gap["raw"] > 3 * gap["cal"] and cs["raw"]["act_err"] > 2 * 0.05
    print("== S9 分布外与不可知题")
    print(f"  OOD 沿用分布内 T {cs['ood_reuse']}")
    print(f"  OOD 自有切片重拟 T={cs['t_ood']:.2f} {cs['ood']}")
    print(f"  不可知题（真实正确率 1/3）{cs['unk']}")
    assert cs["ood_reuse"]["ece"] > 2 * cs["cal"]["ece"] and cs["ood"]["ece"] < cs["ood_reuse"]["ece"]
    assert cs["unk"]["conf_err"] > 0.1
    print("== S10 快慢分工：阈值三档（≥0.95 执行 / 0.6–0.95 升级 LLM / <0.6 转人工）")
    g = cs["gate"]
    print(f"  {g}")
    assert g["cost"] < g["all_llm_cost"] and g["act"] > 0 and g["acc"] > cs["cal"]["acc"]
    print("SELFTEST PASSED ✔")


def breakage(key: str) -> None:
    def run() -> object:
        if key == "B1":
            return dict(zip(("暗号在兄弟问题", "暗号在state"), isolation_probe()))
        if key == "B2":
            return run_tickets()
        if key == "B3":
            cs = calib_suite()
            return {"T": cs["t_in"], "test": cs["cal"], "gate": cs["gate"]}
        if key == "B4":
            cs = calib_suite()
            return {"T_ood": cs["t_ood"], "ood": cs["ood"], "gate_ood": cs["gate_ood"]}
        return shared_cost() if key == "B5" else refund_policy()

    what = {"B1": "拆掉问题分支隔离", "B2": "拆掉闭合输出空间（生成文本 + 宽松解析）", "B3": "拆掉温度校准",
            "B4": "拆掉『自有数据重校准』，OOD 沿用分布内温度", "B5": "拆掉共享前缀缓存",
            "B6": "互斥决策拆成两个 Noul（本就无跨问题不变量）"}[key]
    print(f"== {key} {what}")
    base = run()
    BREAK[key] = True
    broken = run()
    for tag, val in (("正常", base), ("拆后", broken)):
        print(f"  {tag}：" + ("\n    ".join([""] + val) if isinstance(val, list) else f"{val}"))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--selftest", action="store_true")
    g.add_argument("--break", dest="brk", choices=sorted(BREAK))
    args = ap.parse_args()
    if args.selftest:
        selftest()
    else:
        breakage(args.brk)
    return 0


if __name__ == "__main__":
    sys.exit(main())
