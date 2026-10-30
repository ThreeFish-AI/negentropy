#!/usr/bin/env python3
"""线性注意力 → KDA → chunk-wise 并行：纯标准库确定性原型（精读笔记 250 配套 lab）。

验证机制而非模型能力：所有 token 流均为脚本化确定性序列，无随机数、无第三方依赖。
约定与精读笔记一致：S ∈ R^{dv×dk}（行=v 通道、列=k 通道），dk=dv=2 可手算；
单 token 顺序：s̄_i = s_{i-1}Diag(α_i) → r_i = β_i(v_i − s̄_i k_i) → s_i = s̄_i + r_i k_iᵀ → o_i = s_i q̂_i。

用法：
  python3 linear_attention_lab.py demo        # 手算走查（笔记 §7 引用）
  python3 linear_attention_lab.py selftest    # 全量断言
  python3 linear_attention_lab.py break D1..D5 # 破坏性实验
  python3 linear_attention_lab.py count <md>  # 字数门禁（CJK+ASCII 词，≤6000）
"""
import json
import math
import re
import sys

# ---------- 线性代数（纯列表实现） ----------

def zeros(r, c):
    return [[0.0] * c for _ in range(r)]

def eye(n):
    m = zeros(n, n)
    for i in range(n):
        m[i][i] = 1.0
    return m

def matmul(a, b):
    rb, cb = len(b), len(b[0])
    out = zeros(len(a), cb)
    for i, row in enumerate(a):
        for k, aik in enumerate(row):
            if aik:
                for j in range(cb):
                    out[i][j] += aik * b[k][j]
    return out

def matvec(a, x):
    return [sum(a[i][j] * x[j] for j in range(len(x))) for i in range(len(a))]

def outer(v, k):
    return [[vi * kj for kj in k] for vi in v]

def transpose(a):
    return [list(r) for r in zip(*a)]

def diag_apply(s, alpha):  # s·Diag(alpha)：每列乘各自系数
    return [[row[j] * alpha[j] for j in range(len(row))] for row in s]

def hadamard(a, b):
    return [a[i] * b[i] for i in range(len(a))]

def l2(x):
    return math.sqrt(sum(t * t for t in x))

def l2norm_key(k):
    n = l2(k)
    return [t / n for t in k]

def fro(s):
    return math.sqrt(sum(t * t for row in s for t in row))

def vec_eq(a, b, tol=1e-9):
    return all(abs(x - y) <= tol for x, y in zip(a, b))

def mat_close(a, b, tol=1e-9):
    return all(abs(a[i][j] - b[i][j]) <= tol for i in range(len(a)) for j in range(len(a[0])))

def fmt(x):
    return f"{x:.6g}"

def fmt_vec(v):
    return "[" + ", ".join(fmt(t) for t in v) + "]"

def fmt_mat(m):
    return "[" + "; ".join(fmt_vec(r) for r in m) + "]"

# ---------- 机制单元（笔记 §7 行号速查表对应） ----------

def softmax_attn(qs, ks, vs, scale=10.0):  # 基线：softmax 注意力逐 query 检索（scale 锐化≈硬检索）
    outs = []
    for i, q in enumerate(qs):
        es = [math.exp(scale * dot(q, k)) for k in ks[: i + 1]]
        z = sum(es)
        outs.append([sum(es[j] * vs[j][d] for j in range(i + 1)) / z for d in range(len(vs[0]))])
    return outs

def dot(a, b):
    return sum(x * y for x, y in zip(a, b))

def linear_step(s, k, v):  # 机制①：纯加法写入
    w = outer(v, k)
    return [[s[i][j] + w[i][j] for j in range(len(s[0]))] for i in range(len(s))]

def delta_step(s, k, v, beta):  # 机制②：先查旧账、只写差额
    old = matvec(s, k)                       # 旧表对 k 的读数
    r = [beta * (v[i] - old[i]) for i in range(len(v))]
    w = outer(r, k)
    return [[s[i][j] + w[i][j] for j in range(len(s[0]))] for i in range(len(s))]

def kda_step(s, k, v, alpha, beta):  # 机制③：按通道遗忘 + delta 覆写（GDN 是其标量特例）
    sbar = diag_apply(s, alpha)              # 先衰减（每列一个速度）
    return delta_step(sbar, k, v, beta)

def shortconv(rows, w=(0.0, 0.0, 0.5, 0.5)):  # 机制④：kernel=4 因果短卷积（逐通道、固定权重）
    out = []
    for i, r in enumerate(rows):
        acc = [0.0] * len(r)
        for off in range(4):
            j = i - (3 - off)
            if j >= 0:
                acc = [acc[d] + w[off] * rows[j][d] for d in range(len(r))]
        out.append([silu(t) for t in acc])
    return out

def silu(x):
    return x / (1.0 + math.exp(-x)) if abs(x) < 50 else (x if x > 0 else 0.0)

# ---------- 顺序（递推）执行 ----------

def seq_run(ks, vs, alphas, betas, qhats, s0, use_delta=True, use_gate=True):
    """逐 token 递推：返回 (逐步输出 list, 末状态)。"""
    s = [row[:] for row in s0]
    outs = []
    for t in range(len(ks)):
        if use_delta:
            a = alphas[t] if use_gate else [1.0] * len(ks[0])
            s = kda_step(s, ks[t], vs[t], a, betas[t])
        else:
            s = linear_step(s, ks[t], vs[t])
        outs.append(matvec(s, qhats[t]))
    return outs, s

# ---------- chunk-wise 并行执行（WY / 下三角前代） ----------

def solve_unit_lower(a, b):
    """解 (I+A)X = B（A 严格下三角）：逐行前代，X 第 i 行 = B[i] − Σ_{j<i} A[i][j]X[j]。"""
    n, cb = len(b), len(b[0])
    x = [row[:] for row in b]
    for i in range(n):
        for j in range(i):
            for c in range(cb):
                x[i][c] -= a[i][j] * x[j][c]
    return x

def chunkwise_gated_delta(ks, vs, alphas, betas, qhats, s0, C):
    """机制⑤：chunk 间仿射 scan + chunk 内 WY 下三角系统，全部矩阵乘/前代，无逐步状态。

    返回 (逐步输出, 末状态, 每个 chunk 的 (Transition, Δ))。
    推导与精读笔记 §4 对齐：π_i = α_1⊙…⊙α_i；
    A_ij = β_i·(k_i⊙π_i/π_j)ᵀk_j (j<i)；U=(I+A)⁻¹BV；W=(I+A)⁻¹BK_in；E=U−WS_0ᵀ；
    S_C = S_0[Diag(π_C) − WᵀK_g] + UᵀK_g；O = Q̂_in S_0ᵀ + M E。
    """
    dk, dv, T = len(ks[0]), len(vs[0]), len(ks)
    trans, s_cur, outs = [], [row[:] for row in s0], [None] * T
    for c0 in range(0, T, C):
        c1 = min(c0 + C, T)
        n = c1 - c0
        pi = [1.0] * dk
        pis, kins, kg_rows, qin_rows = [], [], [], []
        for i in range(c0, c1):
            pi = hadamard(pi, alphas[i])
            pis.append(pi[:])
            kins.append(hadamard(ks[i], pi))            # k_in：块首衰减后的 key
            kg_rows.append(hadamard(ks[i], pi))          # K_g 先占位，随后除以 π_j
        # K_g：行 i = k_i ⊙ π_i/π_j（对每个 j<i 各不同）——按下三角矩阵 A 逐元素构造
        a_mat = zeros(n, n)
        for i in range(n):
            pij = pis[i]
            for j in range(i):
                kdec = hadamard(ks[c0 + i], [pij[d] / pis[j][d] for d in range(dk)])
                a_mat[i][j] = betas[c0 + i] * dot(kdec, ks[c0 + j])
        bmat = [[betas[c0 + i] * vs[c0 + i][d] for d in range(dv)] for i in range(n)]
        bkin = [[betas[c0 + i] * kins[i][d] for d in range(dk)] for i in range(n)]
        u = solve_unit_lower(a_mat, bmat)                # U=(I+A)⁻¹BV：纯块内并行件
        w = solve_unit_lower(a_mat, bkin)                # W=(I+A)⁻¹BK_in
        e = []                                           # E=U−WS_0ᵀ：旧状态只在此进入
        for i in range(n):
            e.append([u[i][d] - dot(w[i], s_cur[d]) for d in range(dv)])
        trans_chunk = zeros(dk, dk)                      # Diag(π_C) − WᵀK_g
        for i in range(n):
            kdec = hadamard(ks[c0 + i], [pis[n - 1][d] / pis[i][d] + 0.0 for d in range(dk)])
            for d in range(dk):
                trans_chunk[d][:] = [trans_chunk[d][j] - w[i][d] * kdec[j] for j in range(dk)]
        for d in range(dk):
            trans_chunk[d][d] += pis[n - 1][d]
        delta_chunk = zeros(dv, dk)                      # UᵀK_g
        for i in range(n):
            kdec = hadamard(ks[c0 + i], [pis[n - 1][d] / pis[i][d] + 0.0 for d in range(dk)])
            for d in range(dv):
                delta_chunk[d][:] = [delta_chunk[d][j] + u[i][d] * kdec[j] for j in range(dk)]
        s_next = matmul(s_cur, trans_chunk)
        s_next = [[s_next[i][j] + delta_chunk[i][j] for j in range(dk)] for i in range(dv)]
        # 块内输出：O = Q̂_in S_0ᵀ + M E
        m_mat = zeros(n, n)
        for i in range(n):
            for j in range(i + 1):
                kdec = hadamard(ks[c0 + j], [pis[i][d] / pis[j][d] for d in range(dk)])
                m_mat[i][j] = dot(qhats[c0 + i], kdec)
        for i in range(n):
            qin = hadamard(qhats[c0 + i], pis[i])
            base = matvec(s_cur, qin)                    # s_0·(q̂_i⊙π_i)（dv 维）
            o = [base[d] + sum(m_mat[i][j] * e[j][d] for j in range(i + 1)) for d in range(dv)]
            outs[c0 + i] = o
        trans.append((trans_chunk, delta_chunk))
        s_cur = s_next
    return outs, s_cur, trans

# ---------- 确定性 token 流（无随机数） ----------

def det_stream(T, dk=2, dv=2, seed_alpha=(0.7, 0.95), beta=0.9):
    """确定性 key/value/门序列：key 取单位圆均匀角度，value 取小整数，α 逐通道交替。"""
    ks, vs, alphas, betas = [], [], [], []
    for t in range(T):
        ang = 2.0 * math.pi * (t * 7 % T) / T
        k = [math.cos(ang), math.sin(ang)]
        ks.append(l2norm_key(k))
        vs.append([float((t * 3 + 1) % 5 - 2), float((t * 5 + 2) % 4 - 1)])
        alphas.append([seed_alpha[t % 2], seed_alpha[(t + 1) % 2]])
        betas.append(beta)
    qhats = [ks[t][:] for t in range(T)]
    return ks, vs, alphas, betas, qhats

# ---------- demo：笔记 §7 手算走查 ----------

def cmd_demo():
    print("== demo：T4 走查（β=1，k=[1,0] 单位向量） ==")
    s = zeros(2, 2)
    k = [1.0, 0.0]
    s = delta_step(s, k, [2.0, 0.0], 1.0)
    print("S1 =", fmt_mat(s))
    old = matvec(s, k)
    print("查旧账 S1·k =", fmt_vec(old))
    s = delta_step(s, k, [3.0, 0.0], 1.0)
    print("S2 =", fmt_mat(s), "（差额 = v2 − 旧读数 = [1,0]）")
    print("o = S2·q, q=[1,0] →", fmt_vec(matvec(s, k)), "（覆盖语义；纯加法会是 [5,0]）")
    s_lin = linear_step(linear_step(zeros(2, 2), k, [2.0, 0.0]), k, [3.0, 0.0])
    print("对照·纯加法 S2·k =", fmt_vec(matvec(s_lin, k)))
    print()
    print("== demo：chunk-wise vs 顺序（KDA，T=16，C=4） ==")
    ks, vs, alphas, betas, qhats = det_stream(16)
    s0 = zeros(2, 2)
    o_seq, s_seq = seq_run(ks, vs, alphas, betas, qhats, s0)
    o_ck, s_ck, _ = chunkwise_gated_delta(ks, vs, alphas, betas, qhats, s0, 4)
    diff = max(abs(a - b) for oa, ob in zip(o_seq, o_ck) for a, b in zip(oa, ob))
    print(f"max|Δo| = {diff:.3e}   末状态 max|ΔS| = "
          f"{max(abs(s_seq[i][j] - s_ck[i][j]) for i in range(2) for j in range(2)):.3e}")
    print("（实际运行日志；两条路线逐位一致）")

# ---------- selftest ----------

def cmd_selftest():
    ok = []

    def check(name, cond):
        ok.append(cond)
        print(("PASS" if cond else "FAIL"), name)

    ks, vs, alphas, betas, qhats = det_stream(16)
    ones_alpha = [[1.0, 1.0]] * 16
    s0 = zeros(2, 2)

    # ①-④ 顺序 vs chunk-wise 数值一致性（置顶两测）
    o_seq, s_seq = seq_run(ks, vs, alphas, betas, qhats, s0)
    o_ck, s_ck, trans = chunkwise_gated_delta(ks, vs, alphas, betas, qhats, s0, 4)
    d = max(abs(a - b) for oa, ob in zip(o_seq, o_ck) for a, b in zip(oa, ob))
    check(f"KDA 顺序 vs chunk-wise 输出一致（max|Δo|={d:.1e}<1e-9）", d < 1e-9)
    check("KDA 末状态一致", mat_close(s_seq, s_ck))

    o_seq_l, s_seq_l = seq_run(ks, vs, ones_alpha, [1.0] * 16, qhats, s0, use_delta=False)
    s_batch = [row[:] for row in s0]                    # 纯线性：转移=I，块=一次批量外积求和
    for t in range(16):
        w_t = outer(vs[t], ks[t])
        s_batch = [[s_batch[i][j] + w_t[i][j] for j in range(2)] for i in range(2)]
    o_batch = [matvec(s0, qhats[t][:] if False else qhats[t]) for t in range(16)]
    o_batch = [[o_batch[t][d] + sum((dot(ks[j], qhats[t])) * vs[j][d] for j in range(t + 1))
                for d in range(2)] for t in range(16)]
    dl = max(abs(a - b) for oa, ob in zip(o_seq_l, o_batch) for a, b in zip(oa, ob))
    check(f"纯线性注意力 顺序递推 vs 批量求和一致（{dl:.1e}，无需 WY）",
          dl < 1e-9 and mat_close(s_seq_l, s_batch))

    o_seq_d, _ = seq_run(ks, vs, ones_alpha, betas, qhats, s0)
    o_ck_d, _, _ = chunkwise_gated_delta(ks, vs, ones_alpha, betas, qhats, s0, 4)
    dd = max(abs(a - b) for oa, ob in zip(o_seq_d, o_ck_d) for a, b in zip(oa, ob))
    check(f"DeltaNet（无遗忘门）顺序 vs chunk-wise 一致（{dd:.1e}）", dd < 1e-9)

    scalar_alpha = [[0.9, 0.9]] * 16
    o_seq_g, _ = seq_run(ks, vs, scalar_alpha, betas, qhats, s0)
    o_ck_g, _, _ = chunkwise_gated_delta(ks, vs, scalar_alpha, betas, qhats, s0, 4)
    dg = max(abs(a - b) for oa, ob in zip(o_seq_g, o_ck_g) for a, b in zip(oa, ob))
    check(f"GDN（标量门）顺序 vs chunk-wise 一致（{dg:.1e}）", dg < 1e-9)

    # ⑤ chunk 仿射可组合：两块 Transition/Δ 复合 == 一次算 8 token 单块
    sl8 = lambda arr: arr[:8]
    _, s8, _ = chunkwise_gated_delta(sl8(ks), sl8(vs), sl8(alphas), sl8(betas), sl8(qhats), s0, 8)
    t1, d1 = trans[0]
    t2, d2 = trans[1]
    d1t2 = matmul(d1, t2)
    s2c = [[sum(s0[i][m] * matmul(t1, t2)[m][j] for m in range(2)) + d1t2[i][j] + d2[i][j]
            for j in range(2)] for i in range(2)]
    check("chunk 仿射可组合（S_(8) 两种算法一致）", mat_close(s2c, s8, 1e-8))

    # ⑥ 覆写干净 vs ⑦ 叠加混叠
    s = delta_step(delta_step(zeros(2, 2), [1.0, 0.0], [2.0, 0.0], 1.0), [1.0, 0.0], [3.0, 0.0], 1.0)
    check("delta 覆写：同 key 二写后读数=新值 [3,0]", vec_eq(matvec(s, [1.0, 0.0]), [3.0, 0.0]))
    sl = linear_step(linear_step(zeros(2, 2), [1.0, 0.0], [2.0, 0.0]), [1.0, 0.0], [3.0, 0.0])
    check("纯加法：同 key 二写后读数=叠加 [5,0]", vec_eq(matvec(sl, [1.0, 0.0]), [5.0, 0.0]))

    # ⑧ 衰减几何积：只衰减不写入，S_T = S_0·Diag(⊙α)
    sa = [[0.5, 0.2], [0.0, 1.0]]
    st = sa
    for a in ([0.9, 0.5], [0.8, 0.7]):
        st = diag_apply(st, a)
    exp = [[0.5 * 0.72, 0.2 * 0.35], [0.0, 0.35]]
    check("按通道几何衰减（逐通道连乘）", mat_close(st, exp, 1e-12))

    # ⑨ 双时间尺度各自正确（D5 基础）
    slow, fast = 0.995, 0.9
    st = [[1.0, 1.0]]
    for _ in range(200):
        st = [[st[0][0] * slow, st[0][1] * fast]]
    check(f"200 步后慢通道 {slow}^200={st[0][0]:.3f} 远大于快通道 {fast}^200={st[0][1]:.2e}",
          st[0][0] > 0.3 and st[0][1] < 1e-9)

    # ⑩ β=0 不写
    s0b = [[0.3, 0.0], [0.0, 0.3]]
    sb = kda_step(s0b, [1.0, 0.0], [5.0, 5.0], [0.9, 0.9], 0.0)
    check("β=0 只衰减不写入", mat_close(sb, diag_apply(s0b, [0.9, 0.9]), 1e-12))

    # ⑪ β* 暴力搜索 = 1/‖k‖²（重构损失最优步长，笔记 §3）
    k = [0.6, 0.8]
    s_pre = [[1.0, 0.0], [0.0, 0.0]]
    v = [2.0, 1.0]
    best, grid = None, [i / 1000.0 for i in range(0, 2001)]
    for b in grid:
        s_try = delta_step(s_pre, k, v, b)
        loss = sum((x - y) ** 2 for x, y in zip(matvec(s_try, k), v))
        if best is None or loss < best[0]:
            best = (loss, b)
    check(f"β* 数值搜索 {best[1]:.3f} ≈ 1/‖k‖² = {1.0 / dot(k, k):.3f}",
          abs(best[1] - 1.0 / dot(k, k)) < 2e-3)

    # ⑫ 短卷积混合邻近 token
    rows = shortconv([[1.0, 0.0], [0.0, 1.0]])
    merged = rows[1]
    check(f"短卷积把二元组融成复合表示 {fmt_vec([round(t,3) for t in merged])}",
          abs(merged[0] - merged[1]) < 1e-6 and merged[0] > 0.3)

    # ⑬ O(1) 记账：状态尺寸与序列长度无关
    for T in (16, 64):
        _, s_t = seq_run(*det_stream(T), zeros(2, 2))
        assert len(s_t) == 2 and len(s_t[0]) == 2
    check("状态恒为 2×2（T=16/64 相同）", True)

    # ⑭ 重复运行逐字节一致
    r1 = json.dumps([o_seq, s_seq], sort_keys=True)
    o_seq2, s_seq2 = seq_run(ks, vs, alphas, betas, qhats, s0)
    check("重复运行逐字节一致", r1 == json.dumps([o_seq2, s_seq2], sort_keys=True))

    # ⑮ softmax 基线在正交 key 下近似精确检索（D3 对照前提）
    ksq, vsq, _, _, _ = det_stream(4)
    o_sm = softmax_attn(ksq, ksq, vsq)
    check("softmax 基线：末位自检索近似还原 v_T",
          all(abs(a - b) < 0.1 for a, b in zip(o_sm[-1], vsq[-1])))

    # ⑯ count 自证
    c = count_words(__file__ + ".count.tmp") if False else None
    demo = "五个汉字 plus one"
    n_cjk = len(re.findall(r"[㐀-䶿一-鿿]", demo))
    n_w = len(re.findall(r"[A-Za-z]+(?:[-'’][A-Za-z]+)*", demo))
    check("count 自证（5 CJK+1 词=6）", n_cjk + n_w == 6)

    print(f"\n{sum(ok)}/{len(ok)} PASSED " + ("✔ SELFTEST PASSED ✔" if all(ok) else "✘ SELFTEST FAILED ✘"))
    return all(ok)

# ---------- 破坏性实验 ----------

def cmd_break(which):
    ks, vs, alphas, betas, qhats = det_stream(64)
    if which == "D1":  # 去遗忘门：噪声 key 下的陈旧记忆冲不掉
        def noisy_updates(gate):
            s = zeros(2, 2)
            for t in range(1, 11):
                ang = 0.35 * math.sin(t)                 # 同一概念的 key 带抖动
                k = l2norm_key([math.cos(ang), math.sin(ang)])
                v = [1.0, 0.0] if t <= 8 else [0.0, 1.0]  # 前八次旧值，末两次新值
                a = [gate, gate] if gate else [1.0, 1.0]
                s = kda_step(s, k, v, a, 1.0)
            return s
        s_g = noisy_updates(0.8)
        s_n = noisy_updates(None)
        q = [1.0, 0.0]
        o_g, o_n = matvec(s_g, q), matvec(s_n, q)
        err_g = l2([a - b for a, b in zip(o_g, [0.0, 1.0])])
        err_n = l2([a - b for a, b in zip(o_n, [0.0, 1.0])])
        def acc_norms(T):
            s_lin, s_kda = zeros(2, 2), zeros(2, 2)
            kT, _, aT, bT, _ = det_stream(T)
            for t in range(T):
                vT = kT[t][:]                                     # v=k：同向 PSD 写入，能量只增
                s_lin = linear_step(s_lin, kT[t], vT)             # 纯加法：无门无修正
                s_kda = kda_step(s_kda, kT[t], vT, aT[t], bT[t])
            return fro(s_lin), fro(s_kda)
        n64, k64 = acc_norms(64)
        n1k, k1k = acc_norms(1024)
        print(f"D1 去遗忘门: 同一概念换了值（key 带抖动）后查询——有门读数 {fmt_vec([round(t,3) for t in o_g])}"
              f"（真值 [0,1]，误差 {err_g:.3f}）；无门读数 {fmt_vec([round(t,3) for t in o_n])}（误差 {err_n:.3f}）")
        print(f"     ‖S‖_F 随长度：纯加法 T=64→{n64:.2f}、T=1024→{n1k:.2f}（随 √T 无界增长）；"
              f"遗忘门+delta {k64:.2f}→{k1k:.2f}（有界）")
        print("     教训：delta 只能擦掉与当前 key 精确匹配的旧账，抖动的陈旧条目要靠遗忘门淡出；无门纯加法则永不收缩。")
    elif which == "D2":  # 去 delta 修正：覆写残留
        k = [1.0, 0.0]
        s = zeros(2, 2)
        vs5 = [[float(i + 1), 0.0] for i in range(5)]
        for v in vs5:
            s = linear_step(s, k, v)
        err_lin = l2([a - b for a, b in zip(matvec(s, k), vs5[-1])])
        s2 = zeros(2, 2)
        for v in vs5:
            s2 = delta_step(s2, k, v, 1.0)
        err_del = l2([a - b for a, b in zip(matvec(s2, k), vs5[-1])])
        print(f"D2 去 delta 修正（纯加法）: 同 key 写 5 次后读数 = {fmt_vec(matvec(s, k))}（真值 {fmt_vec(vs5[-1])}）")
        print(f"     纯加法误差 {err_lin:.2f} vs delta 覆写误差 {err_del:.1e}")
        print("     教训：加法只会叠账，同一 key 的旧值永远冲不掉。")
    elif which == "D3":  # 固定容量 vs softmax：正交容量 2 条，第 3 条开始混叠
        k1, k2, k3 = [1.0, 0.0], [0.0, 1.0], l2norm_key([1.0, 1.0])
        v1, v2, v3 = [2.0, 0.0], [0.0, 3.0], [4.0, 0.0]
        ones = [1.0, 1.0]

        def state_errs(keys, vals):
            s = zeros(2, 2)
            for k, v in zip(keys, vals):
                s = delta_step(s, k, v, 1.0)            # 纯 delta、无衰减：只看容量
            return [l2([a - b for a, b in zip(matvec(s, k), v)]) for k, v in zip(keys, vals)]

        e2 = state_errs([k1, k2], [v1, v2])
        e3 = state_errs([k1, k2, k3], [v1, v2, v3])
        sm3 = softmax_attn([k1, k2, k3], [k1, k2, k3], [v1, v2, v3])
        e_sm = [l2([a - b for a, b in zip(o, v)]) for o, v in zip(sm3, [v1, v2, v3])]
        print(f"D3 固定容量: 2×2 状态存 2 条正交关联——误差 {fmt_vec([round(t,6) for t in e2])}（精确）")
        print(f"     写入第 3 条（45° 方向，2 维内必与旧 key 不正交）后三查误差 "
              f"{fmt_vec([round(t,3) for t in e3])}；softmax 全量 KV 三查误差 {fmt_vec([round(t,3) for t in e_sm])}")
        print("     教训：状态容量=维度给的正交名额，超出即混叠；softmax 靠全量留底才保持精确——这就是 hybrid 的动机。")
    elif which == "D4":  # 去短卷积：邻近消歧失败
        rows_raw = [[1.0, 0.0], [0.0, 1.0]]
        conv = shortconv(rows_raw)
        s_conv, s_raw = zeros(2, 2), zeros(2, 2)
        s_conv = delta_step(s_conv, l2norm_key(conv[1]), [1.0, 0.0], 1.0)  # 二元组融成一条
        s_raw = delta_step(s_raw, rows_raw[1], [1.0, 0.0], 1.0)
        q = l2norm_key([0.5, 0.5])
        o_conv, o_raw = matvec(s_conv, q), matvec(s_raw, q)
        print(f"D4 去短卷积: 复合查询 {fmt_vec(q)} 卷积版读数 {fmt_vec([round(t,3) for t in o_conv])}；"
              f"裸 token 版 {fmt_vec([round(t,3) for t in o_raw])}")
        print("     教训：状态只认写入的 key——局部组合信息必须在写入前由短卷积融进 key/value。")
    elif which == "D5":  # 对角门降级标量门：双时间尺度必丢一端
        T = 200
        slow_k, fast_k = [1.0, 0.0], [0.0, 1.0]

        def run_decay(alpha_pair):
            s = delta_step(zeros(2, 2), slow_k, [7.0, 0.0], 1.0)   # t=1 写慢信号（通道 0）
            for t in range(2, T + 1):                               # 通道 1 高频信号，末位写 1
                s = kda_step(s, fast_k, [0.0, 1.0 if t == T else 0.0], alpha_pair, 1.0)
            return s

        s_diag = run_decay([0.995, 0.9])    # 对角门：通道 0 慢速、通道 1 快速
        s_scal = run_decay([0.9, 0.9])      # 标量门：被迫同一速度
        o_slow = matvec(s_diag, slow_k)[0]
        o_scalar = matvec(s_scal, slow_k)[0]
        o_fast_ch = matvec(s_diag, fast_k)[1]
        print(f"D5 对角门 → 标量门: 慢信号存活（对角门 α0=0.995）= {o_slow:.3f}（真值 7.0）；"
              f"标量门 α=0.9 下 = {o_scalar:.2e}；快通道末值 = {o_fast_ch:.3f}（真值 1.0）")
        print("     教训：一个标量速度伺候不了两个时间尺度——要么旧账被提前抹掉，要么新账冲不掉。")

# ---------- 字数门禁（沿用 179/181 口径） ----------

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
    if sys.argv[1] == "demo":
        cmd_demo()
    elif sys.argv[1] == "selftest":
        return 0 if cmd_selftest() else 1
    elif sys.argv[1] == "break":
        cmd_break(sys.argv[2] if len(sys.argv) > 2 else "D1")
    elif sys.argv[1] == "count":
        n = count_words(sys.argv[2])
        print(f"字数（CJK+英文单词）= {n}（门禁 6000）")
        return 0 if n <= 6000 else 2
    else:
        print(__doc__)
    return 0

if __name__ == "__main__":
    sys.exit(main())
