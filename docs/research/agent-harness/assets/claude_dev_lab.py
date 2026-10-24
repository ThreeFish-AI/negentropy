#!/usr/bin/env python3
"""claude.dev 全站精读 · 最小原型实验室（guided-learn Phase 3）

验证机制而非模型能力：材料中的模型角色（agent/评审器/分类器）一律以确定性
脚本替代，本原型回答「机制是否自洽」，不回答「模型是否聪明」。无随机数、
固定 episode 序列——同一命令永远同一日志。

机制清单（对应精读笔记章）：
  M1 prefix_cache      前缀缓存分层与击穿（重发经济学）
  M2 daily_brief       书签续读 + 送达确认记账（自动化可靠性）
  M3 budget_guard      每 run 美元硬预算与 budget_reached 暂停（护栏）
  M4 review_gate       风险分层审批 0/1/2 人 + agent 批准不算数（评审防线）
  M5 hook_chain        mods 三态返回：observe / rewrite / answer（扩展面）

运行：uv run --no-project python claude_dev_lab.py --selftest
      （无 uv 时：python3 claude_dev_lab.py --selftest）
"""

import json
import sys
import tempfile

# ---------------------------------------------------------------------------
# M1 · 前缀缓存分层与击穿（S15/S7/S29）
# 牌价口径：Opus 5.5，每百万 token——输入 $4.00 / 缓存读 $0.20（0.05x）/
# 5 分钟缓存写 $5.00（1.25x）。token 数为示意规模（S7 实测口径同构）。
# ---------------------------------------------------------------------------

PRICES = {"in": 4.00, "read": 0.20, "write5m": 5.00}  # $/MTok


def common_prefix_len(a: str, b: str) -> int:
    n = min(len(a), len(b))
    i = 0
    while i < n and a[i] == b[i]:
        i += 1
    return i


def simulate_session(turns, label, mutate=None, switch_model_at=None, verbose=True):
    """按四层前缀模拟逐轮计费。segments: [system_tools, claude_md, env, messages]。

    mutate(t) -> str：可选，第 t 轮对系统层注入的动态内容（如时间戳）。
    switch_model_at：该轮起切换模型（缓存按模型隔离，整段重建）。
    返回 (total_cost, lines)；成本单位美元，token 量纲为 MTok 份额。
    """
    cache = {}  # model -> 已缓存前缀（字符串）
    total = 0.0
    lines = []
    messages = ""
    system = "SYSTEM+TOOLS(fixed)"
    for t in range(1, turns + 1):
        model = "opus55b" if (switch_model_at and t >= switch_model_at) else "opus55a"
        sys_layer = system + (mutate(t) if mutate else "")
        prefix = sys_layer + "|CLAUDE.md|" + "|ENV|" + messages
        hit = common_prefix_len(cache.get(model, ""), prefix)
        new = len(prefix) - hit
        cost = len(prefix[:hit]) / 1e6 * PRICES["read"] + (new / 1e6 * PRICES["write5m"] if new else 0.0)
        total += cost
        lines.append(f"[{label}] turn{t} model={model} prefix={len(prefix)} hit={hit} new={new} cost=${cost:.2f}")
        cache[model] = prefix
        messages += f" m{t}" + "x" * 400  # 每轮新增约 400 字符对话
    return total, lines


def m1_prefix_cache():
    out = []
    T = 12
    base, base_lines = simulate_session(T, "A-稳定分层")
    ts, ts_lines = simulate_session(T, "B-系统层注入每轮变化的时间戳", mutate=lambda t: f"|NOW=10-23:{t:02d}:0{t}")
    tool, tool_lines = simulate_session(T, "C-第8轮改工具定义", mutate=lambda t: "|TOOLS-v2" if t >= 8 else "")
    sw, sw_lines = simulate_session(T, "D-第8轮换模型", switch_model_at=8)
    out += base_lines + ts_lines + tool_lines + sw_lines
    out.append(
        f"[M1 汇总] {T} 轮总成本：稳定分层 ${base:.2f} | 时间戳击穿 ${ts:.2f}（{ts/base:.1f}x）| "
        f"中途改工具 ${tool:.2f}（{tool/base:.1f}x）| 中途换模型 ${sw:.2f}（{sw/base:.1f}x）"
    )
    # 断言：每轮扰动最致命；一次性扰动显著抬升；换模型（缓存按模型隔离）比同位改工具更贵
    assert ts > 3 * base and tool > 1.2 * base and sw > tool and sw > 1.2 * base, "M1 击穿效应量级不符"
    return base, ts, tool, sw, out


# ---------------------------------------------------------------------------
# M2 · 书签续读 + 送达确认记账（S2 daily-brief 参考实现）
# episode 固定 6 天。delivery: "ok"|"not_ok"|"uncertain"；landed: 该次发帖
# 的客观事实（uncertain 日也可能实际已送达）。书签语义：只在确认送达后前移。
# ---------------------------------------------------------------------------

EPISODE = [
    {"day": 1, "sources": {"slack": [("i1", "PR#101 ready")], "github": [("g1", "PR#55 merged")]}, "delivery": "ok", "landed": True},
    {"day": 2, "sources": {"slack": None, "github": [("g2", "PR#57 merged")]}, "delivery": "ok", "landed": True},          # slack 源不可读
    {"day": 3, "sources": {"slack": [("i2", "PR#102 ready")], "github": []}, "delivery": "not_ok", "landed": False},       # 发帖失败
    {"day": 4, "sources": {"slack": [("i3", "PR#103 ready")], "github": [("g3", "PR#58 merged")]}, "delivery": "uncertain", "landed": True},  # 结果不明但实际已送达
    {"day": 5, "sources": {"slack": [("i2", "PR#102 still waiting"), ("i3", "PR#103 ready")], "github": [("g3", "PR#58 merged")]}, "delivery": "ok", "landed": True},
    {"day": 6, "sources": {"slack": [], "github": []}, "delivery": "ok", "landed": True},
]


class DailyBriefBot:
    def __init__(self, confirm_delivery=True):
        self.confirm = confirm_delivery
        self.bookmarks = {"slack": "", "github": ""}   # 最新「已确认送达」边界
        self.ledger = {}                               # id -> reported(bool)
        self.actual = {}                               # id -> 客观送达次数（对账用）
        self.lines = []

    def run_day(self, d):
        log = self.lines.append
        unreadable, fresh = [], {}
        for src, items in d["sources"].items():
            if items is None:                          # 失败读三规则：书签不动、显式点名
                unreadable.append(src)
                continue
            mark = self.bookmarks[src]
            fresh[src] = [it for it in items if it[0] > mark]
        sent = [it for items in fresh.values() for it in items]
        if d["landed"]:
            for iid, _ in sent:                       # 客观事实：读者确实收到了，与策略无关
                self.actual[iid] = self.actual.get(iid, 0) + 1
        # —— 送达确认闸门（只冻结机器人自己的状态，不改变现实）——
        if d["delivery"] == "uncertain" and self.confirm:
            log(f"D{d['day']} delivery=uncertain → 标 maybe_posted，冻结书签与台账（明日重读重发，可能重复）")
            return
        for src, items in fresh.items():
            for iid, _ in items:
                if not self.confirm or d["delivery"] == "ok":
                    self.ledger[iid] = True            # 不确认：一律记账；确认：仅送达成功记账
        if d["delivery"] == "ok" or not self.confirm:
            for src, items in fresh.items():           # 确认送达（或不确认地「认为送达」）才前移书签
                self.bookmarks[src] = max((i[0] for i in d["sources"][src]), default=self.bookmarks[src])
        tag = f" unreadable={unreadable}" if unreadable else ""
        log(f"D{d['day']} delivery={d['delivery']} sent={[i for i, _ in sent]}{tag}")

    def report(self):
        """对账：台账 vs 客观送达事实。"""
        lost = [iid for iid in self.ledger if self.actual.get(iid, 0) == 0]
        dups = [iid for iid, n in self.actual.items() if n >= 2]
        return lost, dups


def m2_daily_brief():
    out = []
    confirm = DailyBriefBot(confirm_delivery=True)
    for d in EPISODE:
        confirm.run_day(d)
    out += confirm.lines
    noconfirm = DailyBriefBot(confirm_delivery=False)
    for d in EPISODE:
        noconfirm.run_day(d)
    c_lost, c_dups = confirm.report()
    n_lost, n_dups = noconfirm.report()
    out.append(f"[M2 汇总] 确认记账：客观丢失 {c_lost}、重复 {c_dups}（不确定日冻结 → 次日重发的既定代价）")
    out.append(f"[M2 汇总] 不确认记账：客观丢失 {n_lost}（失败日记账 → 永不再报）、重复 {n_dups}")
    assert not c_lost, "确认策略不应丢条目"
    assert len(c_dups) >= 1, "不确定日冻结的代价=可能重复"
    assert len(n_lost) >= 1, "不确认策略应出现「记了没发→永不再报」"
    return out


# ---------------------------------------------------------------------------
# M3 · 每 run 美元硬预算与 budget_reached 暂停（G2 官方语义）
# ---------------------------------------------------------------------------

ACTIONS = [0.9, 1.4, 1.7, 1.3, 1.1, 0.8, 1.5]  # 每 step 牌价成本（美元）


def m3_budget_guard():
    out = []

    def run(budget):
        spent, steps, stopped, state = 0.0, 0, None, "idle"
        for i, c in enumerate(ACTIONS, 1):
            if budget is not None and spent + c > budget:   # 在模型请求之间执法
                stopped, state = f"budget_reached(step{i}, spent=${spent:.2f})", "paused"
                break
            spent += c
            steps = i
        return spent, steps, stopped, state

    ok_spent, ok_steps, _, ok_state = run(9.99)
    low_spent, low_steps, low_stop, low_state = run(3.0)
    none_spent, none_steps, _, none_state = run(None)
    out.append(f"[M3] 上限$9.99：跑完 {ok_steps}/{len(ACTIONS)} 步 共${ok_spent:.2f} 终态={ok_state}")
    out.append(f"[M3] 上限$3.00：{low_stop} 仅 {low_steps} 步 终态={low_state}（表现为「简报安静了」）")
    out.append(f"[M3] 无上限：跑完 {none_steps} 步 共${none_spent:.2f}（超 $3.00 上限 {none_spent/3.0:.1f}x）终态={none_state}")
    assert ok_state == "idle" and low_state == "paused" and none_spent > 3.0 * 2
    return out


# ---------------------------------------------------------------------------
# M4 · 风险分层审批（S1：变更定档而非作者听讲述；agent 批准不算数；绑定 commit）
# ---------------------------------------------------------------------------

CHANGES = [
    {"id": "c1", "paths": ["README.md"], "risk": "low"},
    {"id": "c2", "paths": ["src/api.py"], "risk": "medium"},
    {"id": "c3", "paths": ["billing/charge.py"], "risk": "high"},
]
REQUIRED = {"low": 0, "medium": 1, "high": 2}


def m4_review_gate():
    out = []

    def gate(change, approvals, agent_counts=False, new_commit=False):
        return m4_gate(change, approvals, agent_counts, new_commit)

    # 低风险：零审批即合并
    need, got, merged = gate(CHANGES[0], approvals=[])
    out.append(f"[M4] c1(low) 需{need}人：零审批 → merge={merged}")
    assert merged
    # 中风险：agent 批准不算数，一笔人工才放行
    need, got, merged = gate(CHANGES[1], approvals=[{"by": "agent"}, {"by": "agent"}])
    out.append(f"[M4] c2(medium) 需{need}人：两笔 agent 批准 → 计人工{got}人 merge={merged}")
    assert not merged, "agent 批准计入人工名额即失守"
    need, got, merged = gate(CHANGES[1], approvals=[{"by": "human"}])
    out.append(f"[M4] c2(medium) 一笔人工批准 → merge={merged}")
    assert merged
    # 高风险：两笔人工批准放行；新 commit 作废批准
    need, got, merged = gate(CHANGES[2], approvals=[{"by": "agent"}, {"by": "agent"}, {"by": "agent"}])
    out.append(f"[M4] c3(high) 需{need}人：三笔 agent 批准 → 计人工{got}人 merge={merged}")
    assert not merged
    need, got, merged = gate(CHANGES[2], approvals=[{"by": "human"}, {"by": "human"}])
    out.append(f"[M4] c3(high) 同一 commit 两笔人工批准 → merge={merged}")
    assert merged
    need, got, merged = gate(CHANGES[2], approvals=[{"by": "human"}, {"by": "human"}], new_commit=True)
    out.append(f"[M4] c3(high) 批准后 agent 又推新 commit → 批准作废 计人工{got}人 merge={merged}")
    assert not merged
    return out


# ---------------------------------------------------------------------------
# M5 · mods hook 链三态（S4：observe=next(e) / rewrite=改后传 / answer=就地终结）
# ---------------------------------------------------------------------------

def m5_hook_chain():
    out = []
    HOST_LOG = []

    def token_weather(e):        # 观察者：读用量画 band，放行
        HOST_LOG.append(f"weather:band({e.get('ctx_pct')}%)")
        return ("next", e)

    def blast_radius(e):         # 危险命令拦截：answer（除非 proceed 放行）
        if e.get("cmd", "").startswith("rm -rf") and not e.get("proceed"):
            HOST_LOG.append(f"blast:panel(dry-run {e.get('cmd')}) → Cancel")
            return ("answer", {"deny": "risky command held for review"})
        return ("next", e)

    def replay_theater(e):       # 记录编辑供回放，放行
        if e["type"] == "edit":
            HOST_LOG.append(f"replay:record({e['path']})")
        return ("next", e)

    def chain(event, mods, broken_rewrite=False):
        e = event
        for mod in mods:
            action, payload = mod(e)
            if action == "answer":
                HOST_LOG.append(f"host:never-sees({event.get('cmd', event.get('path'))})")
                return payload                       # 就地终结，链条与宿主都不再处理
            if action == "rewrite":
                e = payload
                if broken_rewrite:
                    return None                      # 破坏态：改写后不传给下一个
        HOST_LOG.append(f"host:exec({e.get('cmd', e.get('path'))})")
        return e

    mods = [token_weather, blast_radius, replay_theater]
    r1 = chain({"type": "bash", "cmd": "ls -la", "ctx_pct": 18}, mods)
    r2 = chain({"type": "bash", "cmd": "rm -rf build", "ctx_pct": 81}, mods)
    r3 = chain({"type": "bash", "cmd": "rm -rf build", "ctx_pct": 81, "proceed": True}, mods)
    r4 = chain({"type": "edit", "path": "src/a.ts", "ctx_pct": 40}, mods)
    out += HOST_LOG
    assert r1 is not None and r2 == {"deny": "risky command held for review"} and r4 is not None
    out.append("[M5 汇总] observe(ls)→宿主执行；answer(rm -rf)→宿主收不到；proceed→next 放行；edit→观察记录后执行")

    HOST_LOG.clear()
    r5 = chain({"type": "edit", "path": "src/b.ts", "ctx_pct": 60},
               [lambda e: ("rewrite", {**e, "path": "src/final.ts"}), replay_theater],
               broken_rewrite=True)
    out.append(f"[M5 破坏] rewrite 后不传 next：宿主与后续 mod 均不可见 → 返回 {r5}，HOST_LOG={HOST_LOG}")
    assert r5 is None and not HOST_LOG, "rewrite 短路必须让宿主失明"
    return out


# ---------------------------------------------------------------------------
# 破坏性实验（每次只拆一个组件，真跑记录退化）
# ---------------------------------------------------------------------------

def destructive_experiments():
    out = ["", "===== 破坏性实验（实测） ====="]

    # E1：拿掉「送达确认后才记账」
    out.append("[E1 改动] DailyBriefBot.confirm_delivery=False（发完就记账，不确认）")
    bot = DailyBriefBot(confirm_delivery=False)
    for d in EPISODE:
        bot.run_day(d)
    lost, dups = bot.report()
    out.append(f"[E1 实测] 客观丢失 {lost}、重复 {dups}")
    out.append("[E1 教训] 记账与实发脱钩后，失败日的条目被标已报、永不再报（静默丢内容）。")

    # E2：系统层注入每轮变化的时间戳（S15 踩坑实录）
    out.append("[E2 改动] 系统层注入 NOW=HH:MM:SS 时间戳（其余三层不动）")
    base, ts, _, _, _ = m1_prefix_cache()
    out.append(f"[E2 实测] 12 轮总成本 ${base:.2f} → ${ts:.2f}（{ts/base:.1f}x）")
    out.append("[E2 教训] 最顶层一变，其后全部按全价重算——随时变的信息必须走消息注入，不能进缓存前缀。")

    # E3：agent 批准计入人工名额
    out.append("[E3 改动] gate(agent_counts=True)：把 agent 批准当人算")
    c3 = CHANGES[2]
    need, got, merged = m4_gate(c3, [{"by": "agent"}, {"by": "agent"}], agent_counts=True)
    out.append(f"[E3 实测] {c3['id']}({c3['risk']}) 需{need}人，两笔 agent 批准计{got}人 merge={merged}")
    out.append("[E3 教训] 高风险变更在零人类批准下合并——agent 批准必须永远不计人工名额。")

    # E4：拿掉预算
    out.append("[E4 改动] run(budget=None)：无人值守会话不设上限")
    spent, steps, _, _ = m3_run(None)
    out.append(f"[E4 实测] 跑完 {steps} 步共 ${spent:.2f}，为 $3.00 上限的 {spent/3.0:.1f}x")
    out.append("[E4 教训] 无人在场的会话没有感知超支的人，硬预算是唯一的自动闸门。")
    return out


def m4_gate(change, approvals, agent_counts=False, new_commit=False):
    need = REQUIRED[change["risk"]]
    if new_commit:
        approvals = []
    humans = [a for a in approvals if a["by"] == "human" or (agent_counts and a["by"] == "agent")]
    return need, len(humans), len(humans) >= need


def m3_run(budget):
    spent, steps = 0.0, 0
    for i, c in enumerate(ACTIONS, 1):
        if budget is not None and spent + c > budget:
            return spent, steps, f"budget_reached(step{i})", "paused"
        spent += c
        steps = i
    return spent, steps, None, "idle"


# ---------------------------------------------------------------------------
# selftest
# ---------------------------------------------------------------------------

def selftest():
    lines = ["===== claude.dev lab · selftest ====="]
    base, ts, tool, sw, m1_lines = m1_prefix_cache()
    lines += m1_lines
    lines.append("")
    lines += m2_daily_brief()
    lines.append("")
    lines += m3_budget_guard()
    lines.append("")
    lines += m4_review_gate()
    lines.append("")
    lines += m5_hook_chain()
    lines.append("")
    lines += destructive_experiments()
    lines.append("")
    base2, ts2, tool2, sw2, _ = m1_prefix_cache()  # 确定性：两次运行同值
    assert (base, ts, tool, sw) == (base2, ts2, tool2, sw2), "M1 非确定性"
    lines.append("[确定性] M1 两次运行结果一致 ✔")

    results = {
        "m1_cache": {"base": round(base, 2), "timestamp": round(ts, 2), "tool_change": round(tool, 2), "model_switch": round(sw, 2)},
        "m2_brief": "confirm=0 丢失/0 重复；no-confirm≥1 丢失",
        "m3_budget": "cap 命中→paused(budget_reached)；无上限→2x+ 超支",
        "m4_review": "agent 批准不计人工；新 commit 作废批准",
        "m5_hooks": "observe/rewrite/answer 三态；answer 短路宿主",
    }
    import os
    out_path = os.path.join(tempfile.gettempdir(), "claude_dev_lab_results.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    print("\n".join(lines))
    print("\nSELFTEST PASSED ✔")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        print(__doc__)
