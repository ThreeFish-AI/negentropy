#!/usr/bin/env python3
"""KTP（Knowledge Transfer Probing, arXiv:2610.21459v1）最小原型：纯标准库、确定性。

三层：
  R 复算层：用论文表 1–4 的格子复算平均值、落差、分母粒度与表 4↔表 2 交叉一致性。
  S 评分层：按论文附录 A.3 与仓库 README 描述的口径独立实现两把尺子
           （文字：去 think 块后整串精确匹配；画图：书名等文字按长度给 1/2/3 编辑距离容差）。
  M 示意层：一个玩具「统一模型」，同一份记忆经「画出来 / 说出来」两个出口读取。
           它只演示论文的测量逻辑与观察到的定性模式能被一组最小假设产生，
           不复现论文任何数字；「说出来靠对照表、长文字渲染有小错」都是示意假设，论文未验证。
用法：python3 ktp_lab.py --selftest | --experiment E1..E5 | --judge <标准答案> <回答>
"""
import json
import os
import re
import sys
import tempfile

# ---------------------------------------------------------------- R 复算层
CATS = ["color", "count", "number", "shape", "size", "spatial", "text"]
TABLE1 = {  # 直接迁移：(文字可达性, 画图可达性)，每类 7 格，论文表 1
    "BAGEL": ([14, 14, 0, 10, 24, 0, 0], [20, 42, 4, 58, 60, 0, 36]),
    "GLM-Omni": ([16, 24, 2, 20, 40, 0, 0], [70, 46, 72, 88, 24, 62, 16]),
    "SenseNova-U1": ([20, 32, 0, 20, 68, 0, 0], [32, 34, 88, 98, 98, 0, 78]),
}
TABLE1_AVG = {"BAGEL": (8.86, 31.43), "GLM-Omni": (14.57, 54.00), "SenseNova-U1": (20.00, 61.14)}
FIG3_DELTA_AVG = {"BAGEL": 22.57, "GLM-Omni": 39.43, "SenseNova-U1": 41.14}
TABLE2 = {  # 文字可达性：直接 / 文本对齐 / 交错对齐，论文表 2
    "BAGEL": {"direct": [14, 14, 0, 10, 24, 0, 0], "textual": [4, 28, 0, 24, 52, 0, 0], "interleaved": [12, 32, 0, 20, 56, 0, 0]},
    "GLM-Omni": {"direct": [16, 24, 2, 20, 40, 0, 0], "textual": [16, 20, 0, 12, 40, 0, 0], "interleaved": [24, 20, 0, 64, 40, 40, 0]},
    "SenseNova-U1": {"direct": [20, 32, 0, 20, 68, 0, 0], "textual": [8, 20, 0, 68, 100, 0, 0], "interleaved": [4, 16, 0, 84, 96, 0, 0]},
}
TABLE2_AVG = {"BAGEL": (8.86, 15.43, 17.14), "GLM-Omni": (14.57, 12.57, 26.86), "SenseNova-U1": (20.00, 28.00, 28.57)}
TABLE3_COT = {"BAGEL": [16, 20, 4, 56, 48, 0, 0], "GLM-Omni": [24, 48, 36, 68, 48, 64, 0], "SenseNova-U1": [8, 20, 20, 92, 96, 8, 0]}
TABLE3_AVG = {"BAGEL": (17.14, 20.57), "GLM-Omni": (26.86, 41.14), "SenseNova-U1": (28.57, 34.86)}
TABLE4 = {  # (Pr(T|I), Pr(T|¬I), Δ_assoc)，论文表 4
    ("BAGEL", "textual"): (23.91, 12.40, 11.51), ("BAGEL", "interleaved"): (32.61, 11.63, 20.98),
    ("GLM-Omni", "textual"): (6.90, 18.18, -11.28), ("GLM-Omni", "interleaved"): (31.25, 23.16, 8.09),
    ("SenseNova-U1", "textual"): (46.39, 5.13, 41.26), ("SenseNova-U1", "interleaved"): (44.00, 8.00, 36.00),
}
BASELINE = [16.7, 25.0, 0.0, 20.0, 50.0, 0.0, 0.0]  # 论文表 1 随机猜测行
TEST_N = 175  # 7 类 × 25 个测试实体


def mean2(cells):
    return round(sum(cells) / len(cells), 2)


def granularity(cells):
    """每格是否都是 4 的倍数（25 个实体）/ 2 的倍数（50 个实体）。"""
    if all(c % 4 == 0 for c in cells):
        return "÷25 可得"
    if all(c % 2 == 0 for c in cells):
        return "需 ÷50"
    return "其他"


def decompose_table4(pti, ptni, n=TEST_N):
    """找出 (画对数, 其中答对, 画错数, 其中答对) 的整数解，使两个条件概率四舍五入后与表 4 一致。"""
    sols = []
    for n_i in range(1, n):
        n_ni = n - n_i
        for a in range(n_i + 1):
            if abs(100 * a / n_i - pti) > 0.005:
                continue
            for b in range(n_ni + 1):
                if abs(100 * b / n_ni - ptni) <= 0.005:
                    sols.append((n_i, a, n_ni, b))
    return sols


def recompute_tables():
    out = {}
    for m, (txt, vis) in TABLE1.items():
        out[m] = {"t1_text_avg": mean2(txt), "t1_vis_avg": mean2(vis),
                  "fig3_delta_avg": round(mean2(vis) - mean2(txt), 2),
                  "fig3_delta": [v - t for t, v in zip(txt, vis)]}
        rows = TABLE2[m]
        out[m]["t2_avg"] = tuple(mean2(rows[k]) for k in ("direct", "textual", "interleaved"))
        out[m]["t2_grain"] = {k: granularity(rows[k]) for k in rows}
        out[m]["t3_cot_avg"] = mean2(TABLE3_COT[m])
        out[m]["t2_correct_of_175"] = {k: round(mean2(rows[k]) * TEST_N / 100) for k in ("textual", "interleaved")}
    t4 = {}
    for (m, cond), (pti, ptni, d) in TABLE4.items():
        sols = decompose_table4(pti, ptni)
        target = TABLE2_AVG[m][1 if cond == "textual" else 2]
        hits = [s for s in sols if abs(100 * (s[1] + s[3]) / TEST_N - target) <= 0.005]
        t4[f"{m}/{cond}"] = {"delta_ok": abs(round(pti - ptni, 2) - d) <= 0.01, "solutions": hits, "t4_only": len(sols)}
    out["table4"] = t4
    out["baseline_avg"] = round(sum(BASELINE) / 7, 2)
    return out


# ---------------------------------------------------------------- S 评分层
def strip_think(text):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    if "<think>" in text:
        text = text[: text.index("<think>")]
    return text.strip()


def norm_text(s):
    return re.sub(r"\s+", " ", s.strip().lower().rstrip(".。 ").strip())


def text_correct(response, answer, rule="exact"):
    """文字探针：rule=exact 为论文/仓库口径（整串一致）；contains 为放宽口径（只做对照实验）。"""
    pred, ans = norm_text(strip_think(response)), norm_text(answer)
    if not pred:
        return False
    return pred == ans if rule == "exact" else ans in pred


def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def tolerance(ref):
    return 1 if len(ref) <= 5 else 2 if len(ref) <= 10 else 3


def title_norm(s):
    return " ".join(re.sub(r"[^a-z0-9]+", " ", s.casefold()).split())


def visual_text_ok(observed, reference, tol_on=True):
    """画图探针里书名一类：判官读出的文字与标准答案的编辑距离不超过容差即通过。"""
    o, r = title_norm(observed), title_norm(reference)
    return bool(o) and edit_distance(o, r) <= (tolerance(r) if tol_on else 0)


# ---------------------------------------------------------------- M 示意层
COLORS = ["black", "white", "red", "yellow", "blue", "green"]
SHAPES = ["triangle", "square", "pentagon", "five-pointed star", "circle"]
ADJ = ["Winter", "Paper", "Quiet", "Copper", "Hollow", "Silver", "Distant"]
NOUN = ["Lanterns", "Harbor", "Orchard", "Ferns", "Lightning", "Doves", "Puddles", "Rivers", "Bells", "Tides", "Gardens"]
TOY_CATS = ["color", "count", "shape", "number", "text"]
VIS_RATE = {"color": 7, "count": 6, "shape": 9, "number": 9, "text": 8}  # 每 10 个实体里画得出的个数（玩具设定）
DEFAULT_GUESS = {"color": "blue", "count": "3", "shape": "circle", "number": "61", "text": "The Book"}  # 61 不是任何实体的号码


def toy_value(cat, i):
    if cat == "color":
        return COLORS[i % 6]
    if cat == "count":
        return str(2 + i % 4)
    if cat == "shape":
        return SHAPES[i % 5]
    if cat == "number":
        return str((i * 37 + 11) % 100)  # 37 与 100 互素：50 个实体号码两两不同
    return f"{ADJ[i % 7]} {NOUN[(i * 3) % 11]}"


def make_world():
    """5 类 × 50 个虚构实体；按 (13i mod 50) 的前后两半切成对齐集与测试集（避免与取值的周期对齐）。"""
    return [{"cat": c, "name": f"{c}-{i:02d}", "i": i, "value": toy_value(c, i),
             "split": "align" if (i * 13) % 50 < 25 else "test"} for c in TOY_CATS for i in range(50)]


def render(value, cat):
    """画出来：长文字渲染有一处小错（示意假设，对应论文附录里给书名留编辑距离容差的原因）。"""
    if cat == "text" and len(value) > 10:
        return value[:-2] + value[-1]  # 漏掉倒数第二个字母
    return value


class ToyUMM:
    def __init__(self, leak_caption=False, holistic_reader=False):
        self.visual = {}      # 画图训练写入：实体 -> 画面里的取值（同一份记忆）
        self.caption = {}     # 文字里出现过的取值（信息隔离被破坏时才有）
        self.answers = {}     # 对齐问答样本直接背下的答案
        self.readout = {}     # 对齐学到的「画面 -> 词」对照表
        self.leak_caption, self.holistic_reader = leak_caption, holistic_reader

    def train_t2i(self, world):
        for e in world:
            if (e["i"] * 7) % 10 < VIS_RATE[e["cat"]]:
                self.visual[e["name"]] = render(e["value"], e["cat"])
            if self.leak_caption:
                self.caption[e["name"]] = e["value"]

    def train_alignment(self, world):
        for e in world:
            if e["split"] != "align":
                continue
            self.answers[e["name"]] = e["value"]
            if e["name"] in self.visual:
                self.readout[(e["cat"], self.visual[e["name"]])] = e["value"]

    def draw(self, e):
        return self.visual.get(e["name"])

    def answer_text(self, e):
        if e["name"] in self.caption:
            return self.caption[e["name"]]
        if e["name"] in self.answers:
            return self.answers[e["name"]]
        key = (e["cat"], self.visual.get(e["name"]))
        return self.readout.get(key, DEFAULT_GUESS[e["cat"]])

    def answer_visual_cot(self, e):
        """先画再读：逐字读自己画出的图；holistic_reader=True 时只会整体查表（破坏实验 E5）。"""
        img = self.draw(e)
        if img is None:
            return DEFAULT_GUESS[e["cat"]]
        if self.holistic_reader:
            return self.readout.get((e["cat"], img), DEFAULT_GUESS[e["cat"]])
        return img


def probe(model, world, split="test", rule="exact", tol_on=True, cot=False):
    rows = []
    for e in world:
        if e["split"] != split and split != "all":
            continue
        img = model.draw(e)
        if e["cat"] == "text":
            vis_ok = img is not None and visual_text_ok(img, e["value"], tol_on)
        else:
            vis_ok = img == e["value"]
        ans = model.answer_visual_cot(e) if cot else model.answer_text(e)
        rows.append({"cat": e["cat"], "I": vis_ok, "T": text_correct(ans, e["value"], rule)})
    return rows


def summarize(rows):
    def pct(xs):
        return round(100 * sum(xs) / len(xs), 2) if xs else None
    per = {c: pct([r["T"] for r in rows if r["cat"] == c]) for c in TOY_CATS}
    a_text, a_vis = pct([r["T"] for r in rows]), pct([r["I"] for r in rows])
    ti = [r["T"] for r in rows if r["I"]]
    tni = [r["T"] for r in rows if not r["I"]]
    p_ti, p_tni = pct(ti), pct(tni)
    assoc = round(p_ti - p_tni, 2) if ti and tni else None
    return {"A_text": a_text, "A_vis": a_vis, "gap": round(a_vis - a_text, 2), "per_cat_text": per,
            "Pr(T|I)": p_ti, "Pr(T|~I)": p_tni, "assoc": assoc}


def run_condition(world, align=False, **kw):
    m = ToyUMM(**{k: v for k, v in kw.items() if k in ("leak_caption", "holistic_reader")})
    m.train_t2i(world)
    if align:
        m.train_alignment(world)
    pk = {k: v for k, v in kw.items() if k in ("split", "rule", "tol_on", "cot")}
    return summarize(probe(m, world, **pk))


# ---------------------------------------------------------------- 破坏性实验
EXPERIMENTS = {
    "E1": ("拆信息隔离：画图提示词里写出取值", dict(align=False), dict(align=False, leak_caption=True)),
    "E2": ("拆对齐/测试分离：在对齐实体上考", dict(align=True), dict(align=True, split="align")),
    "E4": ("画图尺子收紧：书名编辑距离容差改为 0", dict(align=True), dict(align=True, tol_on=False)),
    "E5": ("拆逐字读图：先画再读改为整体查表", dict(align=True, cot=True), dict(align=True, cot=True, holistic_reader=True)),
}


SCRIPTED = [  # (标准答案, 模型回答, 人工判定语义是否答对)——自拟样本，用来检验文字尺子
    ("31", "<think>I recall the jersey.</think> 31.", True),
    ("31", "The jersey number is 31.", True),
    ("4", "There are 14 apples.", False),
    ("red", "red.", True),
    ("blue", "blue-green", False),
    ("Ismorune", "Ismorune is larger.", True),
    ("Winter Lanterns", "Winter Lantern", False),
    ("white, black, and yellow from left to right", "white, black and yellow from left to right", True),
]


def ruler_check(rule):
    hits = [text_correct(resp, ans, rule) for ans, resp, _ in SCRIPTED]
    fp = sum(h and not ok for h, (_, _, ok) in zip(hits, SCRIPTED))
    fn = sum(ok and not h for h, (_, _, ok) in zip(hits, SCRIPTED))
    return {"accuracy": round(100 * sum(hits) / len(hits), 2), "false_pos": fp, "false_neg": fn}


def experiment(key, world):
    if key == "E3":
        n, b = ruler_check("exact"), ruler_check("contains")
        print("[E3] 文字尺子放宽：整串一致改为包含即可（8 条自拟回答，人工标注语义对错）")
        for ans, resp, ok in SCRIPTED:
            print(f"[E3]   标准答案 {ans!r} 回答 {resp!r} 语义{'对' if ok else '错'}: "
                  f"exact={text_correct(resp, ans)} contains={text_correct(resp, ans, 'contains')}")
        print(f"[E3] normal(exact): {n}; broken(contains): {b}")
        return n, b
    title, normal_kw, broken_kw = EXPERIMENTS[key]
    n, b = run_condition(world, **normal_kw), run_condition(world, **broken_kw)
    print(f"[{key}] {title}")
    print(f"[{key}] normal: A_text={n['A_text']} A_vis={n['A_vis']} gap={n['gap']} per_cat={n['per_cat_text']}; "
          f"broken: A_text={b['A_text']} A_vis={b['A_vis']} gap={b['gap']} per_cat={b['per_cat_text']}")
    return n, b


# ---------------------------------------------------------------- selftest
def selftest():
    r = recompute_tables()
    for m in TABLE1:
        assert (r[m]["t1_text_avg"], r[m]["t1_vis_avg"]) == TABLE1_AVG[m], m
        assert r[m]["fig3_delta_avg"] == FIG3_DELTA_AVG[m], m
        assert r[m]["t2_avg"] == TABLE2_AVG[m], m
        assert r[m]["t3_cot_avg"] == TABLE3_AVG[m][1], m
        print(f"[R] {m}: 表1 文字/画图均值 {TABLE1_AVG[m]} 复算一致；图3 均值落差 +{FIG3_DELTA_AVG[m]}；"
              f"表2 分母粒度 {r[m]['t2_grain']}；对齐后 175 个测试实体答对数 {r[m]['t2_correct_of_175']}；"
              f"表3 先画再读均值 {r[m]['t3_cot_avg']} 复算一致")
    assert r["GLM-Omni"]["t2_grain"]["direct"] == "需 ÷50"
    assert r["SenseNova-U1"]["t2_correct_of_175"] == {"textual": 49, "interleaved": 50}
    for k, v in r["table4"].items():
        assert v["delta_ok"] and len(v["solutions"]) == 1, k
        print(f"[R] 表4 {k}: Δ_assoc 自洽；仅凭表4 百分比的整数解 {v['t4_only']} 组；与表2 均值联立唯一整数解 "
              f"(画对, 其中答对, 画错, 其中答对) = {v['solutions'][0]}")
    assert r["baseline_avg"] == 15.96
    print(f"[R] 随机基线均值复算 {r['baseline_avg']}（number 一格按论文记 0.0）")

    assert text_correct("<think>recall...</think> red. ", "red")
    assert not text_correct("The number is 31.", "31")
    assert text_correct("The number is 31.", "31", rule="contains")
    assert visual_text_ok("Winter Plantes", "Winter Lanterns") and not visual_text_ok("Winter Plantes", "Winter Lanterns", tol_on=False)
    assert tolerance("abcde") == 1 and tolerance("abcdef") == 2 and tolerance("abcdefghijk") == 3
    assert strip_think("ok <think> unfinished thought") == "ok"
    print("[S] 文字尺子：去 think 块后整串一致；画图尺子：书名容差 1/2/3（长度 ≤5/≤10/>10，逐档断言）")

    world = make_world()
    for c in ("color", "count", "shape"):
        seen = {e["value"] for e in world if e["cat"] == c and e["split"] == "align"}
        unseen = sorted({e["value"] for e in world if e["cat"] == c and e["split"] == "test"} - seen)
        print(f"[M] 玩具 {c}: 测试集里没在对齐集出现过的取值 {unseen}")
    direct = run_condition(world)
    aligned = run_condition(world, align=True)
    cot = run_condition(world, align=True, cot=True)
    for name, s in (("直接迁移", direct), ("对齐后", aligned), ("对齐后+先画再读", cot)):
        print(f"[M] {name}: A_text={s['A_text']} A_vis={s['A_vis']} gap={s['gap']} per_cat={s['per_cat_text']} "
              f"Pr(T|I)={s['Pr(T|I)']} Pr(T|~I)={s['Pr(T|~I)']} Δ_assoc={s['assoc']}")
    assert direct["gap"] > 0 and aligned["A_text"] > direct["A_text"]
    assert aligned["per_cat_text"]["number"] == 0 and aligned["per_cat_text"]["text"] == 0
    assert cot["per_cat_text"]["number"] > 0 and cot["per_cat_text"]["text"] == 0
    for key in ("E1", "E2", "E3", "E4", "E5"):
        experiment(key, world)
    assert ruler_check("exact")["false_pos"] == 0 and ruler_check("contains")["false_pos"] > 0
    out = os.path.join(tempfile.gettempdir(), "ktp_lab_selftest.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"recompute": {k: v for k, v in r.items() if k != "table4"},
                   "toy": {"direct": direct, "aligned": aligned, "cot": cot}}, f, ensure_ascii=False, indent=1)
    print(f"结果已写入 {out}")
    print("SELFTEST PASSED ✔")


def main(argv):
    if argv[:1] == ["--selftest"]:
        selftest()
    elif argv[:1] == ["--experiment"] and len(argv) == 2 and argv[1] in ("E1", "E2", "E3", "E4", "E5"):
        experiment(argv[1], make_world())
    elif argv[:1] == ["--judge"] and len(argv) == 3:
        for rule in ("exact", "contains"):
            print(f"{rule}: {text_correct(argv[2], argv[1], rule)}")
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
