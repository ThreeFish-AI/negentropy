#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""omnimodal_embeddings_lab.py — Omnimodal Embeddings 综述精读的确定性原型（纯标准库，无随机数）

对应精读笔记机制章（mock 数据验证机制，不验证真实模型优劣）：
  M1 InfoNCE 对比对齐与 alignment/uniformity 分解（§3 机制一）
  M2 modality gap：锥形初始化与温度如何锁住差距（§4 机制二·桥二）
  M3 组合查询检索：甲=向量相加 / 分数合并 vs 乙=先交互后出向量（§4 机制二·桥三）

用法：
  uv run --no-project python omnimodal_embeddings_lab.py selftest               # 自检（逐轮断言）
  uv run --no-project python omnimodal_embeddings_lab.py demo                   # 跑全部机制并打印指标
  uv run --no-project python omnimodal_embeddings_lab.py break E1|E2|E3|E4|E5   # 破坏性实验（拆一个看退化）
  uv run --no-project python omnimodal_embeddings_lab.py predict red-cube|quiet-town|company
  uv run --no-project python omnimodal_embeddings_lab.py count <md 文件>        # 字数门禁（6000）

确定性声明：全部向量与初值取自固定表格，无任何随机源；同一命令同一输出。
"""
import json
import math
import re
import sys

DIM = 4
TAU_LOW, TAU_HIGH = 0.10, 1.00
LR, STEPS = 0.15, 80


# ---------- 向量工具（纯手写，无第三方依赖） ----------

def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def norm(a):
    return math.sqrt(dot(a, a))


def normalize(a):
    n = norm(a) or 1.0
    return [x / n for x in a]


def add(a, b, ka=1.0, kb=1.0):
    return [ka * x + kb * y for x, y in zip(a, b)]


def cos(a, b):
    return dot(a, b) / ((norm(a) or 1.0) * (norm(b) or 1.0))


def hadamard(a, b):
    return [x * y for x, y in zip(a, b)]


# ---------- M1/M2 数据：四个概念的「文本塔 / 图像塔」初始输出 ----------
# BASE_k 语义基向量；G_T/G_I 是两座塔各自的「锥方向」（模拟深网+激活几何把输出压进窄锥、
# 两塔不同初始化各自落进不同锥）；初始输出 = normalize(BASE_k + CONE_W*G + 固定微扰)。

BASE = [[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0]]
G_T = normalize([1.0, 0.55, 0.30, 0.15])   # 文本锥方向
G_I = normalize([-0.15, 0.30, 0.55, 1.0])  # 图像锥方向
JIT_T = [[0.02, 0.01, 0.0, 0.0], [0.0, 0.02, 0.01, 0.0],
         [0.01, 0.0, 0.02, 0.0], [0.0, 0.01, 0.0, 0.02]]
JIT_I = [[-0.02, -0.01, 0.0, 0.0], [0.0, -0.02, -0.01, 0.0],
         [-0.01, 0.0, -0.02, 0.0], [0.0, -0.01, 0.0, -0.02]]
CONE_W = 0.35


def init_towers():
    t = [add(normalize(add(BASE[k], G_T, 1.0, CONE_W)), JIT_T[k]) for k in range(4)]
    i = [add(normalize(add(BASE[k], G_I, 1.0, CONE_W)), JIT_I[k]) for k in range(4)]
    return t, i


def infonce(t, i, tau, shift=0):
    """批内 InfoNCE（对称双向）：正例 = 同概念（shift=1 时故意错位配对，供 E2）。"""
    loss, n = 0.0, 0
    for a_row, b_row, s in ((t, i, shift), (i, t, -shift)):
        for a in a_row:
            k = (a_row.index(a) + s) % 4
            sims = [cos(a, e) / tau for e in b_row]
            m = max(sims)
            exps = [math.exp(x - m) for x in sims]
            loss += -math.log(math.exp(sims[k] - m) / sum(exps))
            n += 1
    return loss / n


def num_grad(t, i, tau, which, h=1e-5):
    """数值梯度：对 which 塔（'t'/'i'）的每个坐标扰动求损差。"""
    base = infonce(t, i, tau)
    g = [[0.0] * DIM for _ in range(4)]
    for k in range(4):
        for d in range(DIM):
            t2 = [row[:] for row in t]
            i2 = [row[:] for row in i]
            (t2 if which == "t" else i2)[k][d] += h
            g[k][d] = (infonce(t2, i2, tau) - base) / h
    return g


def train(t, i, tau, steps=STEPS, lr=LR, freeze=None, shift=0):
    """两塔输出的梯度下降（确定性）；freeze='t'/'i' 冻结该塔；shift 供 E2 错配正对。"""
    for _ in range(steps):
        for which in ("t", "i"):
            if freeze == which:
                continue
            g = num_grad(t, i, tau, which) if shift == 0 else _shift_grad(t, i, tau, which, shift)
            src = t if which == "t" else i
            for k in range(4):
                for d in range(DIM):
                    src[k][d] -= lr * g[k][d]
                src[k] = normalize(src[k])
    return t, i


def _shift_grad(t, i, tau, which, shift):
    """错配正对下的数值梯度（对 which 塔）。"""
    h = 1e-5
    base = infonce(t, i, tau, shift)
    g = [[0.0] * DIM for _ in range(4)]
    for k in range(4):
        for d in range(DIM):
            t2 = [row[:] for row in t]
            i2 = [row[:] for row in i]
            (t2 if which == "t" else i2)[k][d] += h
            g[k][d] = (infonce(t2, i2, tau, shift) - base) / h
    return g


def alignment(t, i):
    """Wang & Isola alignment：正对期望平方距离（越小越对齐）。"""
    return sum(norm(add(t[k], i[k], 1.0, -1.0)) ** 2 for k in range(4)) / 4


def uniformity(t, i):
    """Wang & Isola uniformity：全体向量对 log-mean-exp 负平方距离（越小越均匀）。"""
    pts = t + i
    s, n = 0.0, 0
    for a in range(len(pts)):
        for b in range(len(pts)):
            if a != b:
                s += math.exp(-2.0 * norm(add(pts[a], pts[b], 1.0, -1.0)) ** 2)
                n += 1
    return math.log(s / n + 1e-12)


def modality_gap(t, i):
    mt = [sum(r[d] for r in t) / 4 for d in range(DIM)]
    mi = [sum(r[d] for r in i) / 4 for d in range(DIM)]
    return norm(add(mt, mi, 1.0, -1.0))


def retrieval_acc(t, i):
    """t_k 最近邻图像是否为 i_k（跨模态检索准确率）。"""
    hit = 0
    for k in range(4):
        near = max(range(4), key=lambda j: cos(t[k], i[j]))
        hit += (near == k)
    return hit / 4


# ---------- M3：组合查询（三案例同构） ----------
# A/B 为两路属性向量；W 为「结合方向」（两路交互才造得出：对应真实模型中跨模态注意力
# 计算出的交叉项）；组合条目 gold = norm(A+B+GW·W)；单条件干扰条目 = 属性加重 + 异向结合小分量。

A_VEC = [1.0, 0.3, 0.0, 0.0]
B_VEC = [0.3, 1.0, 0.0, 0.0]
W_BIND = [0.0, 0.0, 1.0, 0.0]
W_D1 = [0.0, 0.0, 0.0, 1.0]
W_D2 = [0.0, 0.0, 0.0, -1.0]
GW, DW, AW, BW = 0.9, 0.3, 1.3, 0.3   # 结合权重 / 干扰结合权重 / 干扰属性加重

CASES = {
    "red-cube": dict(d1="red-ball", d2="blue-cube", gold="red-cube"),
    "quiet-town": dict(d1="noisy-seaside-town", d2="quiet-mountain-town",
                       gold="quiet-seaside-town"),
    "company": dict(d1="profit-rev-double", d2="loss-rev-decline",
                    gold="loss-rev-double"),
}


def case_vectors(case):
    gold = normalize(add(add(A_VEC, B_VEC, 1.0, 1.0), W_BIND, 1.0, GW))
    c1 = normalize(add(add(A_VEC, B_VEC, AW, BW), W_D1, 1.0, DW))
    c2 = normalize(add(add(A_VEC, B_VEC, BW, AW), W_D2, 1.0, DW))
    return {case["d1"]: c1, case["d2"]: c2, case["gold"]: gold}


def retrieval(case_name, interact=0.8):
    """甲=向量相加查询；分数合并=两路各自打分加权平均；乙=带交互项查询（interact 可拆）。"""
    case = CASES[case_name]
    cands = case_vectors(case)
    q_add = normalize(add(A_VEC, B_VEC, 0.5, 0.5))
    q_int = normalize(add(add(A_VEC, B_VEC, 1.0, 1.0), W_BIND, 1.0, interact))
    scores = {c: dict(add=round(cos(q_add, v), 4),
                      fusion=round(0.5 * cos(A_VEC, v) + 0.5 * cos(B_VEC, v), 4),
                      interact=round(cos(q_int, v), 4)) for c, v in cands.items()}
    return dict(A_vector_add=sorted(cands, key=lambda c: -scores[c]["add"]),
                score_fusion=sorted(cands, key=lambda c: -scores[c]["fusion"]),
                B_interact=sorted(cands, key=lambda c: -scores[c]["interact"]),
                scores=scores, gold=case["gold"])


# ---------- 机制演示 ----------

def demo_m1():
    t, i = init_towers()
    a0, u0, l0 = alignment(t, i), uniformity(t, i), infonce(t, i, TAU_LOW)
    acc0 = retrieval_acc(t, i)
    t, i = train(t, i, TAU_LOW)
    return dict(loss_before=round(l0, 4), loss_after=round(infonce(t, i, TAU_LOW), 4),
                align_before=round(a0, 4), align_after=round(alignment(t, i), 4),
                unif_before=round(u0, 4), unif_after=round(uniformity(t, i), 4),
                acc_before=acc0, acc_after=retrieval_acc(t, i))


def demo_m2():
    t, i = init_towers()
    gap0 = modality_gap(t, i)
    t, i = train(t, i, TAU_LOW)
    gap1 = modality_gap(t, i)
    th2, ih2 = init_towers()
    _, ih2 = train(th2, ih2, TAU_HIGH)
    return dict(gap_init=round(gap0, 4), gap_after_low_tau=round(gap1, 4),
                gap_retained_low=round(gap1 / gap0, 3),
                gap_after_high_tau=round(modality_gap(th2, ih2), 4),
                note="两塔不同锥初始化（锥效应+初始化成因）：低温训练后差距保留约 2/3；"
                     "高温训练几乎拉平。「低温下差距是严格局部最优」的细致结论按 Liang et al. "
                     "2022 归档，本玩具未复现该景观细节")


# ---------- 破坏性实验 ----------

def break_e1():
    """E1 去负例：只剩正对吸引，对齐损失对「全体塌缩」没有任何回复力。"""
    t, i = init_towers()
    for _ in range(60):  # 纯对齐吸引（InfoNCE 退化为拉近正对）
        for k in range(4):
            mid = add(t[k], i[k], 0.5, 0.5)
            t[k] = add(t[k], mid, 0.7, 0.3)
            i[k] = add(i[k], mid, 0.7, 0.3)
    pair = [normalize(add(t[k], i[k], 0.5, 0.5)) for k in range(4)]
    full = [normalize([sum(p[d] for p in pair) / 4 for d in range(DIM)])] * 8
    def align_loss(tt, ii):
        return sum(norm(add(tt[k], ii[k], 1, -1)) ** 2 for k in range(4)) / 4
    return dict(align_pair_collapsed=round(align_loss(t, i), 4),
                align_fully_collapsed=round(align_loss(full[:4], full[4:]), 4),
                unif_pair=round(uniformity(t, i), 4),
                unif_fully=round(uniformity(full[:4], full[4:]), 4),
                note="全塌缩与好解在对齐损失下同分（无回复力）→ 负例的职责就是顶住这一侧")


def break_e2():
    """E2 错配正对：把 text_k 与 image_{k+1} 配对训练——不变性声明错了，训练照常收敛。"""
    t, i = init_towers()
    acc0 = retrieval_acc(t, i)
    t, i = train(t, i, TAU_LOW, shift=1)
    return dict(acc_true_pairs_before=acc0, acc_true_pairs_after=retrieval_acc(t, i),
                loss_after=round(infonce(t, i, TAU_LOW, shift=1), 4),
                note="错配下训练照常收敛、损失照常下降，但真配对检索全错且全程无报警")


def break_e3():
    """E3 冻结图像塔：单侧努力，差距显著大于联合训练。"""
    t, i = init_towers()
    t, i = train(t, i, TAU_LOW, freeze="i")
    tj, ij = init_towers()
    _, _ = train(tj, ij, TAU_LOW)
    return dict(gap_frozen=round(modality_gap(t, i), 4),
                gap_joint=round(modality_gap(tj, ij), 4),
                note="冻结侧不动时差距收不干净（对照联合训练）")


def break_e4():
    """E4 交互项清零：乙退化为系数相加，检不中组合条目。"""
    full = retrieval("red-cube", interact=0.8)
    broken = retrieval("red-cube", interact=0.0)
    return dict(B_top1_full=full["B_interact"][0], B_top1_broken=broken["B_interact"][0],
                gold=full["gold"], A_top1=full["A_vector_add"][0],
                note="交互项拿掉后乙的排序退化为甲式排序，失去组合检索能力")


def break_e5():
    """E5 温度对照：高温度重训，差距收得更小。"""
    r = demo_m2()
    return dict(gap_low_tau=r["gap_after_low_tau"], gap_high_tau=r["gap_after_high_tau"],
                note="温度是差距被锁住的旋钮之一：同一初始化、同一损失，仅温度不同，"
                     "高温下训练把差距几乎收平")


BREAKS = {"E1": break_e1, "E2": break_e2, "E3": break_e3, "E4": break_e4, "E5": break_e5}


# ---------- 自检 ----------

def cmd_selftest():
    checks = []
    m1 = demo_m1()
    checks.append(("M1 损失下降", m1["loss_after"] < m1["loss_before"]))
    checks.append(("M1 对齐改善", m1["align_after"] < m1["align_before"]))
    checks.append(("M1 未塌缩", m1["unif_after"] <= m1["unif_before"] + 0.5))
    checks.append(("M1 检索改善", m1["acc_after"] >= m1["acc_before"]))
    print(f"round1 M1 infonce+align/uniform: {json.dumps(m1, ensure_ascii=False)}")
    m2 = demo_m2()
    checks.append(("M2 低温训练后差距保留过半", m2["gap_retained_low"] > 0.5))
    checks.append(("M2 高温训练差距近乎归零", m2["gap_after_high_tau"] < 0.5 * m2["gap_after_low_tau"]))
    print(f"round2 M2 modality gap: {json.dumps(m2, ensure_ascii=False)}")
    r = retrieval("red-cube")
    checks.append(("M3 乙命中组合条目", r["B_interact"][0] == r["gold"]))
    checks.append(("M3 甲(相加)检不中", r["A_vector_add"][0] != r["gold"]))
    checks.append(("M3 分数合并检不中", r["score_fusion"][0] != r["gold"]))
    print(f"round3 M3 fusion: A_top1={r['A_vector_add'][0]} fusion_top1={r['score_fusion'][0]} "
          f"B_top1={r['B_interact'][0]} gold={r['gold']}")
    e = {k: BREAKS[k]() for k in ("E1", "E2", "E3", "E4", "E5")}
    checks.append(("E1 全塌缩无回复力（同分）", e["E1"]["align_fully_collapsed"] <= 0.0001))
    checks.append(("E1 全塌缩 uniformity 最差（≥-0.1）", e["E1"]["unif_fully"] >= -0.1))
    checks.append(("E2 错配正对→真配对检索归零", e["E2"]["acc_true_pairs_after"] == 0.0))
    checks.append(("E3 冻结塔差距>联合训练差距", e["E3"]["gap_frozen"] > e["E3"]["gap_joint"]))
    checks.append(("E4 交互项清零→乙检不中", e["E4"]["B_top1_broken"] != e["E4"]["gold"]))
    checks.append(("E5 高温差距更小", e["E5"]["gap_high_tau"] < e["E5"]["gap_low_tau"]))
    for idx, name in enumerate(("E1", "E2", "E3", "E4", "E5"), start=4):
        print(f"round{idx} {name}: {json.dumps(e[name], ensure_ascii=False)}")
    for c in CASES:
        rr = retrieval(c)
        checks.append((f"predict:{c} 乙命中", rr["B_interact"][0] == rr["gold"]))
        checks.append((f"predict:{c} 甲未命中", rr["A_vector_add"][0] != rr["gold"]))
        checks.append((f"predict:{c} 分数合并未命中", rr["score_fusion"][0] != rr["gold"]))
    report = dict(m1=m1, m2=m2, m3=r, breaks=e,
                  predicts={c: {k: retrieval(c)[k] for k in
                                ("A_vector_add", "score_fusion", "B_interact", "gold")}
                            for c in CASES})
    with open("omnimodal_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    ok = True
    for name, cond in checks:
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}")
        ok &= cond
    print("SELFTEST PASSED ✔" if ok else "SELFTEST FAILED ✘")
    return ok


def cmd_demo(_=None):
    print("== M1 InfoNCE 对比对齐 ==")
    print(json.dumps(demo_m1(), ensure_ascii=False, indent=1))
    print("== M2 modality gap ==")
    print(json.dumps(demo_m2(), ensure_ascii=False, indent=1))
    print("== M3 组合查询检索（red-cube）==")
    print(json.dumps(retrieval("red-cube"), ensure_ascii=False, indent=1))


def cmd_predict(case):
    r = retrieval(case)
    print(f"case={case} gold={r['gold']}")
    print(f"甲(向量相加)排序: {r['A_vector_add']}")
    print(f"分数合并排序:    {r['score_fusion']}")
    print(f"乙(先交互)排序:  {r['B_interact']}")
    print(f"逐候选得分: {json.dumps(r['scores'], ensure_ascii=False)}")


def cmd_break(name):
    print(json.dumps(BREAKS[name](), ensure_ascii=False, indent=1))


# ---------- 字数门禁（沿用 179/181/250/251 口径） ----------

def count_words(path):
    text = open(path, encoding="utf-8").read()
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    text = re.sub(r"~~~.*?~~~", "", text, flags=re.S)
    text = re.sub(r"^\s*!\[[^\]]*\]\([^)]*\)\s*$", "", text, flags=re.M)
    text = re.sub(r"https?://\S+", "", text)
    cjk = len(re.findall(r"[㐀-䶿一-鿿]", text))
    words = len(re.findall(r"[A-Za-z]+(?:[-'’][A-Za-z]+)*", text))
    return cjk + words


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 0
    cmd = sys.argv[1]
    if cmd == "demo":
        cmd_demo(sys.argv[2] if len(sys.argv) > 2 else None)
    elif cmd == "selftest":
        return 0 if cmd_selftest() else 1
    elif cmd == "break":
        cmd_break(sys.argv[2] if len(sys.argv) > 2 else "E1")
    elif cmd == "predict":
        cmd_predict(sys.argv[2] if len(sys.argv) > 2 else "red-cube")
    elif cmd == "count":
        n = count_words(sys.argv[2])
        print(f"字数（CJK+英文单词）= {n}（门禁 6000）")
        return 0 if n <= 6000 else 2
    else:
        print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main())
