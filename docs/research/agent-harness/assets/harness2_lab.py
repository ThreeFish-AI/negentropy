#!/usr/bin/env python3
"""harness2_lab —— 《Harness 到 Harness²》精读（179）配套最小原型。

机制方向性演示，非复现：LLM 角色全部用确定性 mock（规则/脚本序列）替代，原型只回答
「机制是否自洽、每个组件拆掉会怎么坏」，数字仅锚定材料结论的方向与排序（(mock, 方向性)）。
CLI：demo（基线）/ selftest（全断言）/ break D1..D5（破坏实验）/ count <md>（字数门禁，
剥代码围栏/图片行/URL 后 CJK 字符数 + ASCII 词数）。
"""

from __future__ import annotations

import argparse
import re
import sys
import zlib
from dataclasses import dataclass, field

# 0. 任务域（玩具域，全部确定性）

# harness 独有行为检查清单（对应论文 28 个 harness-exclusive patterns 的 mock）
# context_management 为「不可表达项」：h* 里绕开模型起作用的机制，任何学生动作都
# 习得不了——对应论文局限自述（context 管理类机制进不了学生响应）。
BEHAVIORS = (
    "inspect_before_edit",   # 动手前先检查
    "verify_before_finish",  # 交卷前验证
    "protect_examples",      # 保护已填示例
    "write_literals",        # 写字面值而非公式串
    "reload_output",         # 交卷前重开产物核对
    "bounded_retry",         # 失败换法不硬重试
    "first_person",          # 第一人称完整响应
    "context_management",    # 不可表达项（见上）
)

# 任务 = (标签, 域, 需要的行为集合)。正常 6 / 陷阱 3 / 边缘 3。
TASKS = [
    ("t-normal-1", "sheet", {"inspect_before_edit", "verify_before_finish"}),
    ("t-normal-2", "sheet", {"inspect_before_edit", "protect_examples"}),
    ("t-normal-3", "api", {"bounded_retry", "verify_before_finish"}),
    ("t-normal-4", "api", {"bounded_retry"}),
    ("t-normal-5", "chem", {"write_literals", "verify_before_finish"}),
    ("t-normal-6", "chem", {"write_literals"}),
    # 陷阱：学生基础提议「看起来能过」但缺关键行为 → 无审阅必挂
    ("t-trap-1", "sheet", {"protect_examples", "verify_before_finish"}),
    ("t-trap-2", "api", {"bounded_retry", "first_person"}),
    ("t-trap-3", "chem", {"write_literals", "reload_output"}),
    # 边缘：行为需求恰在门槛上 / 空编辑 / 非法候选
    ("t-edge-1", "sheet", set()),        # 零需求：任何策略都过
    ("t-edge-2", "api", {"bounded_retry"}),
    ("t-edge-3", "chem", {"write_literals", "verify_before_finish"}),
]
TRAIN_TAGS = [t[0] for t in TASKS[:8]]   # 收集/训练用前 8
EVAL_TAGS = [t[0] for t in TASKS[4:]]    # 留出后 8（含重叠外的陷阱/边缘）

def task_of(tag: str):
    for t in TASKS:
        if t[0] == tag:
            return t
    raise KeyError(tag)

def det_noise(tag, salt) -> float:
    """确定性『噪声』：crc32 稳定映射到 [-1,1)（hash() 对 str 跨进程随机，禁用）。"""
    h = zlib.crc32(repr((tag, salt)).encode("utf-8"))
    return (h / 0xFFFFFFFF) * 2.0 - 1.0

# 1. P1 mock：Harness-Zero（审阅门 → 校正轨迹 → counts 自增 mock SFT → 三臂评估）

# 学生基础策略：按任务域给出固定的「自然但不合规」提议序列（缺关键行为）。
BASE_PROPOSALS = {
    "sheet": ["write_formulas_then_finish", "edit_examples_inline", "finish"],
    "api": ["retry_same_call", "answer_without_evidence", "finish"],
    "chem": ["handwrite_answer", "skip_validation", "finish"],
}

# 审阅知识 K：从 h* 组件改写来的规则（动作配方），签名刻意不含任何 gold。
# 规则 = (触发的失配行为, 校正后的合规动作, 习得行为集)
K_RULES = {
    "sheet": [
        ("write_formulas_then_finish", "write_literals_and_verify", {"write_literals", "verify_before_finish"}),
        ("edit_examples_inline", "diff_guard_then_edit", {"inspect_before_edit", "protect_examples"}),
    ],
    "api": [
        ("retry_same_call", "consult_doc_then_call", {"bounded_retry"}),
        ("answer_without_evidence", "readback_then_answer", {"verify_before_finish", "first_person"}),
    ],
    "chem": [
        ("handwrite_answer", "enumerate_validate_write", {"write_literals", "verify_before_finish"}),
        ("skip_validation", "validate_last_write", {"reload_output", "verify_before_finish"}),
    ],
    "finish": [],  # finish 动作由 finish-guard 规则处理
}

# finish-guard：交卷前没有验证记录 → 替换为验证动作（附录 B.2 同构）
FINISH_GUARD = ("finish_without_verify", "run_verification_then_finish", {"verify_before_finish"})

def reviewer_pi_h(context: list[str], proposal: str, domain: str, budget: "ReviewBudget",
                  no_review: bool = False):
    """审阅代理：只依据（可见上下文, 提议, K）给出 pass/replace。

    结构性不可见 gold：本函数无 gold 参数；它只想获得更多证据，
    就必须替换成一条『学生可执行』的检查动作（对应接地约束）。
    """
    if no_review or budget.left <= 0:
        return "pass", proposal
    rules = list(K_RULES.get(domain, [])) + [FINISH_GUARD]
    verified = any("verify" in a or "validate" in a or "readback" in a for a in context)
    bad = proposal in {t for t, _, _ in rules}
    needs_verify = proposal == "finish" and not verified
    if bad or needs_verify:
        if needs_verify:
            replacement = FINISH_GUARD[1]
        else:
            replacement = next(r for t, r, _ in rules if t == proposal)
        budget.left -= 1
        return "replace", replacement
    return "pass", proposal

class ReviewBudget:
    def __init__(self, n: int = 5):
        self.left = n

def collect_trajectory(tag: str, no_review: bool = False):
    """学生在 h 下滚动一轮 + 审阅门 → 返回 (accepted_actions, learned_behaviors)。"""
    _, domain, _need = task_of(tag)
    ctx: list[str] = []
    accepted: list[str] = []
    learned: set[str] = set()
    budget = ReviewBudget()
    for proposal in BASE_PROPOSALS[domain]:
        decision, act = reviewer_pi_h(ctx, proposal, domain, budget, no_review)
        accepted.append(act)
        ctx.append(act)
        for t, r, lb in K_RULES.get(domain, []) + [FINISH_GUARD]:
            if decision == "replace" and act == r:
                learned |= lb
    return accepted, learned

def score_actions(accepted: list[str], tag: str) -> float:
    """评分：完成（未停在非法提议）+ 行为覆盖 + 微小确定性噪声。"""
    _, domain, need = task_of(tag)
    if not accepted:
        return 0.0
    have = set()
    for a in accepted:
        for t, r, lb in K_RULES.get(domain, []) + [FINISH_GUARD]:
            if a == r:
                have |= lb
    cover = len(need & have) / len(need) if need else 1.0
    done = 1.0 if "finish" in accepted or "run_verification_then_finish" in accepted else 0.0
    return round(min(1.0, 0.5 * done + 0.5 * cover + 0.02 * det_noise(tag, 1)), 4)

def mock_sft(train_tags: list[str], no_review: bool = False):
    """counts 自增即 mock SFT：把概率质量搬到校正动作上。

    返回蒸馏后策略：对每个 (域, 可见提议) 取训练中出现次数最多的动作。
    """
    counts: dict[tuple[str, str], dict[str, int]] = {}
    for tag in train_tags:
        accepted, _ = collect_trajectory(tag, no_review)
        _, domain, _ = task_of(tag)
        for proposal, act in zip(BASE_PROPOSALS[domain], accepted):
            counts.setdefault((domain, proposal), {})
            counts[(domain, proposal)][act] = counts[(domain, proposal)].get(act, 0) + 1
    policy = {k: max(v.items(), key=lambda kv: (kv[1], kv[0]))[0] for k, v in counts.items()}
    return policy

def distilled_rollout(tag: str, policy: dict):
    _, domain, _ = task_of(tag)
    accepted = [policy.get((domain, p), p) for p in BASE_PROPOSALS[domain]]
    return accepted

def induced_behaviors(domain: str) -> set[str]:
    """mock h* 在该域可诱导的行为集 = 各规则习得集 ∪ 不可表达项。"""
    out: set[str] = set()
    for _t, _r, lb in K_RULES.get(domain, []):
        out |= lb
    out |= FINISH_GUARD[2]
    out |= {"context_management"}  # h* 有、学生动作无（论文边界）
    return out

def arm_scores(no_review: bool = False, no_sft: bool = False, policy=None):
    """三臂：裸学生 / 学生+h*（外挂全兜底，cap 在外挂层）/ 蒸馏后裸跑。"""
    if policy is None:
        policy = mock_sft(TRAIN_TAGS, no_review)
    out = {"bare": [], "hstar": [], "distilled": []}
    recovery = []
    for tag in EVAL_TAGS:
        _, domain, need = task_of(tag)
        # 裸学生：原样提议（行为缺失、噪声项吃亏）
        base_acts = list(BASE_PROPOSALS[domain])
        out["bare"].append(score_actions(base_acts, tag))
        # h* 外挂：全部行为由外挂强制给出，但外挂不可学走、且对通用域有拖累项
        hstar_acts, _ = collect_trajectory(tag)
        out["hstar"].append(min(1.0, score_actions(hstar_acts, tag) + 0.02 * det_noise(tag, 2)) * 0.93)
        # 蒸馏：策略替换后的裸跑
        dist_acts = distilled_rollout(tag, policy) if not no_sft else base_acts
        out["distilled"].append(score_actions(dist_acts, tag))
        # 行为恢复率（论文口径 mock）：只在该域 h* 可诱导的支撑行为上计
        induced = induced_behaviors(domain)
        have = set()
        for a in dist_acts:
            for t, r, lb in K_RULES.get(domain, []) + [FINISH_GUARD]:
                if a == r:
                    have |= lb
        recovery.append(len(have & induced) / len(induced))
    return {k: round(sum(v) / len(v), 4) for k, v in out.items()}, round(sum(recovery) / len(recovery), 4)

# 2. P2 mock：Harness²（八组件 harness → PPC 对比步 → 并行/串行 → 库反哺）

COMPONENTS = ("systemprompt", "guardrails", "memory", "tool_guidance",
              "skills", "scripts", "subagents", "plugin")

@dataclass
class Harness:
    comps: dict[str, tuple[str, ...]] = field(default_factory=lambda: {c: () for c in COMPONENTS})

    def edit(self, comp: str, lines: tuple[str, ...]):
        self.comps[comp] = self.comps[comp] + lines

    def diff_size(self) -> int:
        return sum(len(v) for v in self.comps.values())

@dataclass
class Library:
    entries: list[tuple[str, tuple[tuple[str, tuple[str, ...]], ...], str]] = field(
        default_factory=list)  # (域, [(组件, 行集)...], 经验)

    def lookup(self, domain: str):
        return [e for e in self.entries if e[0] == domain]

def probe_score(H: Harness, tag: str) -> float:
    """mock 执行分：行为特征匹配任务需求 + 确定性噪声 - 上下文膨胀惩罚。

    惩罚 = 每条不加分的行为行扣一点分（always-on 文本吃上下文预算，论文 H 提示词
    的机制映射）；使「过滤无证据编辑」在 mock 里也有可观测收益。
    """
    _, domain, need = task_of(tag)
    cover, bloat = 0, 0
    for comp, lines in H.comps.items():
        for ln in lines:
            head = ln.split(":")[0]
            if comp == "skills" and head == f"{domain}-workflow":
                cover += 1
            elif f"{comp}:{head}" in ("guardrails:inventory", "plugin:no-empty-deliver",
                                      "plugin:verify-write", "scripts:reopen-check"):
                cover += 1
            else:
                bloat += 1
    return min(1.0, 0.1 + 0.2 * cover - 0.015 * bloat + 0.01 * det_noise(tag, H.diff_size()))

def probe_delta(H_cand: Harness, H_ref: Harness, tag: str, salt: tuple | None = None) -> float:
    """Probe：只返回参考/候选的对比差，不产生对错判断。salt≠None 为偷看 gold 的盲判分。"""
    if salt is not None:
        h = zlib.crc32(repr((tag, salt)).encode("utf-8"))
        return (h / 0xFFFFFFFF) * 2.0 - 1.0  # 与行为无关的『绝对判分』信号
    return probe_score(H_cand, tag) - probe_score(H_ref, tag)

def propose(task_tag: str, H: Harness, lib: Library, variant: int = 0) -> list[tuple[str, tuple[str, ...]]]:
    """Propose：不变式候选（跨域工作方式）+ 领域候选（本域知识），可播种自库。

    variant：第 j 个并行会话/串行轮次的编号——会话间提案分化
    （论文并行 k 组候选独立抽样、串行逐步加深的 mock）。
    """
    _, domain, _ = task_of(task_tag)
    invariant = [
        ("guardrails", ("inventory:清点输入并核对出处",)),
        ("plugin", ("no-empty-deliver:产物为空即拦截",)),
        ("guardrails", ("bloat:未经证据的泛化规则",)),  # 噪声候选：只有对比能拦
    ]
    domain_cand = [
        ("skills", (f"{domain}-workflow:本域流程与坑位",)),
        ("tool_guidance", (f"{domain}-formats:接口/格式约定",)),
    ]
    deep = [("plugin", ("verify-write:写后即验",))] if variant >= 1 else []
    deep += [("scripts", ("reopen-check:重开核对",))] if variant >= 2 else []
    prior = lib.lookup(domain)
    if prior:  # 库播种：拷贝既有条目的全部组件行（选择性改编的 mock：原样拷贝）
        return invariant + deep + [(c, ls) for c, ls in prior[-1][1]]
    return invariant + deep + domain_cand

def compose(H: Harness, cands: list[tuple[str, tuple[str, ...]]], deltas: list[float],
            threshold: float = 0.05, no_gate: bool = False) -> tuple[Harness, list[str]]:
    """Compose：只有 delta≥阈值 的编辑入后继；记录证据。no_gate=全收（D4）。"""
    H2 = Harness(comps={k: v for k, v in H.comps.items()})
    evidence = []
    for (comp, lines), d in zip(cands, deltas):
        if no_gate or d >= threshold:
            H2.edit(comp, lines)
            evidence.append(f"{comp}+{lines[0].split(':')[0]}(Δ{d:+.3f})")
        else:
            evidence.append(f"drop:{comp}(Δ{d:+.3f})")
    if len(H2.comps) != len(COMPONENTS):  # 不变式：八组件结构不得破坏
        raise AssertionError("invariant broken")
    return H2, evidence

def ppc_step(task_tag: str, H: Harness, lib: Library, blind: bool = False,
             no_gate: bool = False, variant: int = 0) -> tuple[Harness, list[str], list[float]]:
    cands = propose(task_tag, H, lib, variant)
    if blind:  # 盲判分：逐候选独立噪声（与行为无关 → 噪声候选也常过门）
        deltas = [probe_delta(_apply(H, c), H, task_tag, salt=("blind", c[0], c[1])) for c in cands]
    else:
        deltas = [probe_delta(_apply(H, c), H, task_tag) for c in cands]
    H2, evidence = compose(H, cands, deltas, no_gate=no_gate)
    return H2, evidence, deltas

def _apply(H: Harness, cand: tuple[str, tuple[str, ...]]) -> Harness:
    H2 = Harness(comps={k: v for k, v in H.comps.items()})
    H2.edit(*cand)
    return H2

def run_stream(no_library: bool = False, k: int = 1, blind: bool = False,
               no_gate: bool = False, tags: list[str] | None = None):
    """一条任务流：每题从同一初始 H0 开始，题后入库（保留门=有正 delta 证据）。"""
    lib = Library()
    first_half, second_half = [], []
    for i, tag in enumerate(tags or EVAL_TAGS):
        H = Harness()  # 每题从 H0 重开（材料规定）
        H2, evidence, deltas = H, [], []
        for r in range(k):  # k=1 单步；k>1 串行链（并行版取多组合最优，见 demo）
            H2, evidence, deltas = ppc_step(tag, H2, lib, blind=blind, no_gate=no_gate, variant=r)
            H = H2
        gain = probe_score(H2, tag) - probe_score(Harness(), tag)
        (first_half if i < len(tags or EVAL_TAGS) // 2 else second_half).append(gain)
        if not no_library and any(d >= 0.05 for d in deltas):  # 经验保留门
            _, domain, _ = task_of(tag)
            # 入库条目 = 本题采纳的领域组件 + 经验增强行（经验让后续提案直接命中要害）
            lib.entries.append((domain, tuple(propose(tag, Harness(), Library())[2:])
                                + (("plugin", ("verify-write:写后即验",)),),
                                "lesson:库播种让后续同域提案直接命中"))
    avg = lambda xs: round(sum(xs) / len(xs), 4) if xs else 0.0
    return {"first_half_gain": avg(first_half), "second_half_gain": avg(second_half),
            "lib_size": len(lib.entries)}

def run_parallel_k(tag: str, k: int = 5, lib: Library | None = None) -> float:
    """并行递归 mock：k 个组合会话各自提案（variant 分化），取执行最优（匿名终选 mock）。"""
    lib = lib or Library()
    H = Harness()
    best = probe_score(H, tag)
    for j in range(k):
        H2, _, _ = ppc_step(tag, H, lib, variant=j)
        best = max(best, probe_score(H2, tag))
    return best

# 3. 破坏实验与 selftest

def experiment(d_id: str) -> dict:
    if d_id == "D1":  # π_H 恒 pass：训练集=学生自身错误
        scores, rec = arm_scores(no_review=True)
        return {"scores": scores, "recovery": rec,
                "expect": "recovery 跌回裸学生档（≈无习得行为）"}
    if d_id == "D2":  # 采集但不 SFT：曝光≠内化
        scores, rec = arm_scores(no_sft=True)
        return {"scores": scores, "recovery": rec,
                "expect": "distilled≈bare（counts 未更新）"}
    if d_id == "D3":  # 探针改绝对判分（偷看 gold）
        full = run_stream(blind=False)
        blind = run_stream(blind=True)
        return {"full": full, "blind": blind,
                "expect": "blind 增益噪声化（与行为无关，可为负）"}
    if d_id == "D4":  # 采纳门失效全收
        ok = run_stream(no_gate=False)
        bad = run_stream(no_gate=True)
        return {"gated": ok, "ungated": bad,
                "expect": "无门时 diff 膨胀、增益回落（熵增）"}
    if d_id == "D5":  # 库永不更新
        full = run_stream(no_library=False)
        nolib = run_stream(no_library=True)
        return {"full": full, "no_library": nolib,
                "expect": "后半程失去跨任务反哺档（second_half 掉头）"}
    raise ValueError(d_id)

def selftest() -> bool:
    ok = True

    def check(cond, msg):
        nonlocal ok
        print(("  PASS " if cond else "  FAIL ") + msg)
        ok = ok and cond

    # P1 三臂排序：bare < hstar < distilled（mock 方向性锚 23.3<41.7<44.3）
    scores, rec = arm_scores()
    print("P1 三臂:", scores, "recovery:", rec)
    check(scores["bare"] < scores["hstar"] < scores["distilled"], "bare<hstar<distilled")
    check(0.5 < rec < 0.95, "蒸馏恢复过半且被不可表达项封顶")
    # D1/D2 退化
    s1, r1 = arm_scores(no_review=True)
    check(r1 < 0.1, "D1 恢复率跌回初值")
    s2, _ = arm_scores(no_sft=True)
    check(abs(s2["distilled"] - s2["bare"]) < 1e-9, "D2 distilled==bare")
    # P2 单步/并行/带库 三档递增
    tag = EVAL_TAGS[-1]
    base = probe_score(Harness(), tag)
    one = run_parallel_k(tag, 1)
    five = run_parallel_k(tag, 5)
    check(base <= one <= five, "单步≤并行 k=5")
    lib = Library()
    lib.entries.append(("chem", (("skills", ("chem-workflow:本域流程与坑位",)),
                                  ("tool_guidance", ("chem-formats:接口/格式约定",))), "lesson"))
    seeded = run_parallel_k(tag, 5, lib)
    check(seeded >= five, "带库播种不劣于空库")
    # 流式：full 后半程 ≥ 前半程（库反哺），no_library 后半程无此档
    full = run_stream()
    nolib = run_stream(no_library=True)
    print("P2 stream:", full, "| nolib:", nolib)
    check(full["second_half_gain"] > full["first_half_gain"], "库反哺抬升后半程")
    check(nolib["second_half_gain"] <= full["second_half_gain"] + 1e-9, "D5 无库失去反哺档")
    # 盲探针（D3）：与行为无关
    b = run_stream(blind=True)
    check(abs(b["second_half_gain"]) < 1.0 and b["lib_size"] >= 0, "盲判分噪声化（不炸即可）")
    # 无门（D4）：diff 膨胀
    H = Harness()
    cands = propose("t-edge-3", H, Library())
    deltas = [-0.5, -0.4, -0.3, -0.2]  # 全负的编辑
    gated, _ = compose(H, cands, deltas)
    ungated, _ = compose(H, cands, deltas, no_gate=True)
    check(gated.diff_size() == 0 and ungated.diff_size() > 0, "负增益编辑：门拦、无门全收")
    # 字数计数自证：中文三个字=5 CJK；abc-def=1 词；URL 与独立图片行已剥
    tmp = "中文三个字 abc-def 12.5 http://x.io/y\n![图](a.png)\n"
    open("/tmp/_wc.md", "w").write("```\ncode\n```\n" + tmp + "\n")
    c = count_words("/tmp/_wc.md")
    check(c == 6, f"count 自证（5 CJK+1 词=6，得 {c}）")
    print("SELFTEST PASSED ✔" if ok else "SELFTEST FAILED ✘")
    return ok

# 4. 字数门禁

def count_words(path: str) -> int:
    text = open(path, encoding="utf-8").read()
    text = re.sub(r"```.*?```", "", text, flags=re.S)          # 代码围栏
    text = re.sub(r"~~~.*?~~~", "", text, flags=re.S)
    text = re.sub(r"^\s*!\[[^\]]*\]\([^)]*\)\s*$", "", text, flags=re.M)  # 图片行
    text = re.sub(r"https?://\S+", "", text)                    # URL
    cjk = len(re.findall(r"[㐀-䶿一-鿿]", text))
    words = len(re.findall(r"[A-Za-z]+(?:[-'’][A-Za-z]+)*", text))
    return cjk + words

# 5. CLI

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("mode", choices=["demo", "selftest", "break", "count"])
    ap.add_argument("rest", nargs="*", help="break: D1..D5；count: <md 路径>")
    args = ap.parse_args(argv)
    if args.mode == "demo":
        print("== P1 三臂（mock, 方向性）==")
        s, r = arm_scores()
        print(f"bare={s['bare']}  hstar={s['hstar']}  distilled={s['distilled']}  recovery={r}")
        print("== P2 递归三档（mock, 方向性）==")
        tag = EVAL_TAGS[-1]
        print(f"base={probe_score(Harness(), tag):.3f}  k1={run_parallel_k(tag,1):.3f}  "
              f"k5={run_parallel_k(tag,5):.3f}")
        print("stream:", run_stream(), " nolib:", run_stream(no_library=True))
        return 0
    if args.mode == "selftest":
        return 0 if selftest() else 1
    if args.mode == "break":
        allok = True
        for d in args.rest:
            out = experiment(d)
            print(f"[{d}]", out["expect"], "->", {k: v for k, v in out.items() if k != "expect"})
            if d == "D1":
                allok &= out["recovery"] < 0.1
            if d == "D2":
                allok &= abs(out["scores"]["distilled"] - out["scores"]["bare"]) < 1e-9
            if d == "D3":
                allok &= out["blind"]["second_half_gain"] < out["full"]["second_half_gain"]
            if d == "D4":
                allok &= (out["ungated"]["first_half_gain"] + out["ungated"]["second_half_gain"]
                          < out["gated"]["first_half_gain"] + out["gated"]["second_half_gain"])
            if d == "D5":
                allok &= out["no_library"]["second_half_gain"] < out["full"]["second_half_gain"] - 1e-6
        print("BREAK OK ✔" if allok else "BREAK DEGRADED（见上）")
        return 0 if allok else 1
    if args.mode == "count":
        n = count_words(args.rest[0])
        print(f"{n}（剥围栏/图片/URL 口径：CJK 字符 + ASCII 词）")
        return 0 if n <= 6000 else 2
    return 0

if __name__ == "__main__":
    sys.exit(main())
