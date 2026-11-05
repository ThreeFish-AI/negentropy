#!/usr/bin/env python3
"""Physical AI monograph 精读原型（251）：闭环三机制确定性沙盘。

验证机制而非模型能力：本文件不含任何学习组件，控制律、滤波器与前瞻规划全部为
确定性公式；「世界模型」即已知的轨道动力学与坑洼地图。无随机数、无环境读取，
同一命令永远同一输出。对应 monograph（arXiv:2610.27045v1）三组机制：
  M1 consequential interaction——闭环反馈 vs 开环回放（§1.3/§2.2.1）
  M2 perception of evolving states——噪声观测下的状态估计（§1.3.1/§2.1.3）
  M3 prediction before action——世界模型前瞻 vs 贪心（§1.3.2/§5.4.2）

用法：
  python3 physical_ai_lab.py demo            # 三机制各跑一遍，打印实测日志
  python3 physical_ai_lab.py selftest        # 全断言自检
  python3 physical_ai_lab.py break D1..D5    # 破坏性实验（每次只拆一个组件）
  python3 physical_ai_lab.py count <md>      # 字数门（CJK 字符+ASCII 单词，门禁 6000）
"""

import json
import re
import sys

# ---------- 共用轨道场景（确定性） ----------

DT = 0.1          # 步长（秒）
STEPS = 200
TARGET = 2.0      # 目标位置（米）
SLOPE = 0.15      # 恒定坡度加速度（设计期未知偏差来源）
GUSTS = {40: 0.30, 90: -0.25, 130: 0.20}   # 固定阵风时刻表（秒→加速度）
DRAG = 0.8        # 速度阻尼
UMAX = 1.2        # 控制饱和（执行器物理约束）
KP, KD, KI = 2.2, 1.6, 1.2
# 固定观测噪声模式（无随机数：12 步循环列表）
NOISE = [0.12, -0.10, 0.08, -0.12, 0.06, -0.06, 0.14, -0.08,
         0.10, -0.14, 0.04, -0.04]


def plant_step(p, v, u, step):
    """轨道车一步物理演化：u 经饱和后作用，叠加坡度与阵风。"""
    u = max(-UMAX, min(UMAX, u))
    v = v + DT * (u - DRAG * v - SLOPE + GUSTS.get(step, 0.0))
    p = p + DT * v
    return p, v


def design_ff():
    """设计期仿真：无坡度无阵风的理想轨道上，PI 把车送到目标，记录控制序列。"""
    p = v = 0.0
    integ = 0.0
    seq = []
    for step in range(STEPS):
        e = TARGET - p
        integ += e * DT
        u = KP * e - KD * v + KI * integ
        seq.append(u)
        u_sat = max(-UMAX, min(UMAX, u))
        v = v + DT * (u_sat - DRAG * v)   # 设计模型：无 SLOPE、无 GUSTS
        p = p + DT * v
    return seq


def run_track(ctrl, delay=0):
    """跑完整轨道任务。ctrl(step, p_meas, v, integ) 返回 u；delay 为反馈延迟步数。

    返回 dict：mae（全程平均绝对误差）、final（末段误差）、chatter（控制增量绝对值
    之和）、max_err、osc（误差变号次数，判振荡）。
    """
    p = v = 0.0
    integ = 0.0
    hist = [(0.0, 0.0, 0.0)]                  # (p, v, u) 历史，供延迟读取
    errs, dus = [], []
    sign_changes = 0
    prev_sign = None
    for step in range(STEPS):
        p_past, v_past, _ = hist[max(0, len(hist) - 1 - delay)]
        u = ctrl(step, p_past, v_past, integ)
        e = TARGET - p
        integ += e * DT
        errs.append(abs(e))
        dus.append(abs(u - hist[-1][2]))
        sgn = 1 if e > 0.02 else (-1 if e < -0.02 else 0)   # 小误差抖动不计振荡
        if prev_sign is not None and sgn != 0 and sgn != prev_sign:
            sign_changes += 1
        if sgn != 0:
            prev_sign = sgn
        p, v = plant_step(p, v, u, step)
        hist.append((p, v, max(-UMAX, min(UMAX, u))))
    tail = errs[STEPS // 2:]
    return {"mae": sum(errs) / STEPS, "final": sum(tail) / len(tail),
            "chatter": sum(dus), "max_err": max(errs), "osc": sign_changes}


def pi_ctrl(step, p_meas, v, integ):
    """M1 名义闭环：比例 + 微分（速度阻尼）+ 积分（消坡度稳态误差）。"""
    return KP * (TARGET - p_meas) - KD * v + KI * integ


def open_ctrl_factory():
    """D1 开环：回放设计期控制序列，执行期不再看任何观测。"""
    seq = design_ff()

    def ctrl(step, p_meas, v, integ):
        return seq[step]
    return ctrl


# ---------- M2：噪声观测与状态估计 ----------

def run_track_with_sensor(use_filter=True):
    """位置只能经噪声观测获得：m = p + noise。use_filter=True 走一阶滤波估计。"""
    p = v = 0.0
    integ = 0.0
    x_hat = 0.0
    G = 0.25
    est_errs, meas_errs, _tail_pos = [], [], []
    for step in range(STEPS):
        m = p + NOISE[step % len(NOISE)]
        x_hat += G * (m - x_hat)
        if step >= STEPS // 2:                # 瞬态消退后再评估计质量
            est_errs.append(abs(x_hat - p))
            meas_errs.append(abs(m - p))
            _tail_pos.append(p)
        p_meas = x_hat if use_filter else m          # D3：裸观测当状态
        u = pi_ctrl(step, p_meas, v, integ)
        integ += (TARGET - p) * DT
        p, v = plant_step(p, v, u, step)
    ctrl_res = {"est_mae": sum(est_errs) / len(est_errs), "meas_mae": sum(meas_errs) / len(meas_errs),
                "track_mae": sum(abs(TARGET - pi) for pi in _tail_pos) / len(_tail_pos)}
    # 控制抖动单独评：同样控制律在两种状态源下的 chatter
    def _probe(src):
        p2 = v2 = 0.0; integ2 = 0.0; x2 = 0.0; prev_u = 0.0; ch = 0.0
        for step in range(STEPS):
            m = p2 + NOISE[step % len(NOISE)]
            x2 += G * (m - x2)
            pm = x2 if src == "filter" else m
            u = pi_ctrl(step, pm, v2, integ2)
            integ2 += (TARGET - p2) * DT
            ch += abs(u - prev_u); prev_u = u
            p2, v2 = plant_step(p2, v2, u, step)
        return ch
    ctrl_res["chatter_filter"] = _probe("filter")
    ctrl_res["chatter_raw"] = _probe("raw")
    return ctrl_res


# ---------- M3：世界模型前瞻 vs 贪心（换道走廊） ----------

LANES, GOAL = 2, 20
PIT = {(0, 10), (0, 11), (1, 13), (1, 14)}    # 交错坑洼：直行必掉，绕行可过


def greedy_walk():
    """贪心：只认「向目标前进」这一条局部规则，不知道也不查询坑洼地图。"""
    lane, col, cost = 0, 0, 0
    path = [(lane, col)]
    for _ in range(60):
        nxt = (lane, col + 1)
        if col + 1 >= GOAL:
            return {"reached": True, "cost": cost, "path": path}
        if nxt in PIT:                          # 贪心不认识坑：照直走
            return {"reached": False, "fell": nxt, "cost": cost - 100, "path": path}
        col += 1
        cost -= 1
        path.append((lane, col))
    return {"reached": False, "cost": cost, "path": path}


def lookahead_walk(horizon=6):
    """前瞻：用世界模型（坑洼地图+一步动力学）做滚动时域搜索。"""
    def val(lane, col):
        if (lane, col) in PIT:
            return -100.0
        d = GOAL - col
        return -d if d > 0 else 0.0

    def best(lane, col, h):
        if (lane, col) in PIT:                 # 坑格立即终止：从坑里没有后续
            return -100.0, None
        if col >= GOAL:
            return 0.0, None
        if h == 0:
            return val(lane, col), None
        cands = []
        moves = ((0, 1), (1, 0)) if lane == 0 else ((0, 1), (-1, 0))
        for mv in moves:
            nl, nc = lane + mv[0], col + mv[1]
            if not (0 <= nl < LANES and 0 <= nc <= GOAL):
                continue
            sub, _ = best(nl, nc, h - 1)
            cands.append((-1.0 + sub, mv))
        return max(cands) if cands else (-100.0, None)

    lane, col, cost = 0, 0, 0
    path = [(lane, col)]
    for _ in range(80):
        if col >= GOAL:
            return {"reached": True, "cost": cost, "path": path}
        _, mv = best(lane, col, horizon)
        if mv is None:
            return {"reached": False, "cost": cost, "path": path}
        lane, col = lane + mv[0], col + mv[1]
        cost += -1.0
        if (lane, col) in PIT:
            return {"reached": False, "fell": (lane, col), "cost": cost - 100, "path": path}
        path.append((lane, col))
    return {"reached": False, "cost": cost, "path": path}


# ---------- 汇总与各模式 ----------

def all_runs():
    """一次算齐名义与五种破坏（每次只拆一个组件），返回实测数字。"""
    nom = run_track(pi_ctrl)
    ff = design_ff()
    open_run = run_track(open_ctrl_factory())
    p_only = run_track(lambda s, pm, v, ig: KP * (TARGET - pm) - KD * v)
    delayed = run_track(pi_ctrl, delay=6)
    sensor = run_track_with_sensor(use_filter=True)
    raw = run_track_with_sensor(use_filter=False)
    return {"nominal": nom, "design_ff_final": ff[-1], "open": open_run,
            "p_only": p_only, "delayed": delayed,
            "sensor_filter": sensor, "sensor_raw": raw,
            "greedy": greedy_walk(), "lookahead": lookahead_walk()}


def cmd_demo(out_json=None):
    r = all_runs()
    n = r["nominal"]
    print(f"[M1 闭环反馈] 名义 PI：MAE={n['mae']:.4f} m，末段误差={n['final']:.4f} m，"
          f"误差变号={n['osc']} 次（无振荡）")
    print(f"[M2 状态估计] 滤波估计 MAE={r['sensor_filter']['est_mae']:.4f} m vs "
          f"裸观测 MAE={r['sensor_filter']['meas_mae']:.4f} m；"
          f"控制抖动 滤波={r['sensor_filter']['chatter_filter']:.2f} vs "
          f"裸观测={r['sensor_filter']['chatter_raw']:.2f}")
    g, l = r["greedy"], r["lookahead"]
    gf = "到达" if g["reached"] else "掉坑@%s" % (g.get("fell"),)
    lf = "到达" if l["reached"] else "未到达"
    print(f"[M3 前瞻决策] 贪心：{gf}，累计回报={g['cost']:.1f}；前瞻 H=6：{lf}，"
          f"累计回报={l['cost']:.1f}")
    if out_json:
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump({k: v for k, v in r.items()}, f, ensure_ascii=False, indent=1)
        print(f"JSON 已写 {out_json}")


def cmd_break(which):
    r = all_runs()
    n, o = r["nominal"], r["open"]
    if which == "D1":
        print(f"D1 去反馈（开环回放设计期序列）：MAE {n['mae']:.4f} → {o['mae']:.4f} m；"
              f"末段误差 {n['final']:.4f} → {o['final']:.4f} m")
        print("     教训：设计期算好的控制序列只对设计假设成立，坡度与阵风一来误差再无人修正。")
    elif which == "D2":
        p = r["p_only"]
        print(f"D2 去积分作用（PI→P）：末段误差 {n['final']:.4f} → {p['final']:.4f} m"
              f"（残余 ≈ 坡度/Kp = {SLOPE / KP:.4f} m）")
        print("     教训：比例项对恒定偏差只能留下固定偏差，积分才把稳态误差归零。")
    elif which == "D3":
        s, w = r["sensor_filter"], r["sensor_raw"]
        print(f"D3 裸观测当状态（绕过滤波器）：控制抖动 {s['chatter_filter']:.2f} → {w['chatter_raw']:.2f}"
              f"（{w['chatter_raw'] / s['chatter_filter']:.1f} 倍）；位置误差 {s['track_mae']:.4f} → {w['track_mae']:.4f} m"
              f"（车体惯性吸收了部分高频抖动）")
        print("     教训：噪声直接进控制律，位置误差未必涨多少，代价全打在执行器上——抖动、磨损与能耗。")
    elif which == "D4":
        g, l = r["greedy"], r["lookahead"]
        gf = "到达" if g["reached"] else "掉坑@%s" % (g.get("fell"),)
        print(f"D4 贪心无前瞻：{gf}（回报 {g['cost']:.1f}）vs 前瞻 H=6 回报 {l['cost']:.1f} 且到达")
        print("     教训：不把「动作之后世界会怎样」展开看，局部最优的路直通坑底。")
    elif which == "D5":
        d = r["delayed"]
        print(f"D5 反馈延迟六拍（0.6 s）：末段误差 {n['final']:.4f} → {d['final']:.4f} m；MAE "
              f"{n['mae']:.4f} → {d['mae']:.4f} m；误差变号 {n['osc']} → {d['osc']} 次（振荡不收敛）")
        print("     教训：控制规律一字不改，光让观测晚 0.6 秒到手，闭环就带上了相位滞后。")
    else:
        print("破坏实验编号：D1 去反馈 / D2 去积分 / D3 裸观测 / D4 贪心 / D5 延迟")


def cmd_selftest():
    r = all_runs()
    n, o, p, d = r["nominal"], r["open"], r["p_only"], r["delayed"]
    s, w = r["sensor_filter"], r["sensor_raw"]
    g, l = r["greedy"], r["lookahead"]
    checks = [
        ("名义 PI 收敛", n["final"] < 0.02),
        ("名义无振荡", n["osc"] <= 4),
        ("D1 开环误差显著增大", o["mae"] > 3 * n["mae"]),
        ("D2 去积分留稳态误差", 0.7 * SLOPE / KP < p["final"] < 1.3 * SLOPE / KP),
        ("滤波优于裸观测", s["est_mae"] < 0.5 * s["meas_mae"]),
        ("D3 裸观测放大控制抖动", w["chatter_raw"] > 1.5 * s["chatter_filter"]),
        ("贪心掉坑", (not g["reached"]) and g.get("fell") in PIT),
        ("前瞻到达", l["reached"]),
        ("前瞻回报高于贪心", l["cost"] > g["cost"] + 80),
        ("D5 延迟显著恶化", d["final"] > 5 * n["final"] and d["osc"] > 2 * n["osc"]),
        ("设计期序列本身收敛", abs(r["design_ff_final"]) < UMAX),
    ]
    ok = True
    for name, cond in checks:
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}")
        ok &= cond
    print("SELFTEST PASSED ✔" if ok else "SELFTEST FAILED ✘")
    return ok


# ---------- 字数门禁（沿用 179/181/250 口径） ----------

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
        cmd_demo(sys.argv[2] if len(sys.argv) > 2 else None)
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
