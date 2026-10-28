#!/usr/bin/env python3
"""DSA（Daily Stock Analysis）核心机制原型——纯标准库、确定性。

本原型回答「机制是否自洽」，不回答「模型是否聪明」：材料里的 LLM 角色
（生成模型 / 角色 agent / 策略技能）全部用确定性脚本序列替代。
虚拟时钟以整数 tick 前进（1 tick = 1 秒），无随机数、无真实网络。

复刻的五个机制（对照材料锚点见 run_lab 输出头部）：
  M1 多源回退链 + 熔断 + 冷却（data_provider）
  M2 证据状态八态 + 六块加权质量评分（analysis-context-pack）
  M3 模型路由 + 能力准入 + 多 Key 轮换降级（src/llm）
  M4 策略技能信号资格分选 + 确定性聚合 + 分歧检测（src/agent/skills）
  M5 分歧显式注入 + RiskGuard 只降不升（risk_override）

用法：
  python3 dsa_lab.py --selftest        # 全绿自检 + 破坏性实验
  python3 dsa_lab.py --run S4          # 跑指定场景（预测题答案键用）
  python3 dsa_lab.py --sabotage=no_partition --run S2   # 破坏性实验单跑
"""
import argparse
import json
import sys

# ---------------------------------------------------------------- M1 数据层

# 各场景的取数脚本：source -> [每 tick 次尝试的结果]
# 'ok' 正常 / 'fail' 请求失败 / 'slow' 连接失败（进冷却）
FETCH_SCRIPTS = {
    "S1": {"akshare": ["ok"], "yfinance": ["ok"], "tencent": ["ok"]},
    "S2": {"akshare": ["fail"], "yfinance": ["ok"], "tencent": ["ok"]},
    "S3": {"akshare": ["fail"], "yfinance": ["fail"], "tencent": ["fail"]},
    "S4": {"akshare": ["ok"], "yfinance": ["ok"], "tencent": ["ok"]},
    "S5": {"akshare": ["fail"], "yfinance": ["ok"], "tencent": ["ok"]},
    "E4": {"akshare": ["fail", "fail", "fail", "fail", "fail", "fail", "fail"],
           "yfinance": ["ok"], "tencent": ["ok"]},
}

# 数据源注册表：(源名, 优先级, 支持的市场集合)；指数走固定链不读优先级
SOURCES = [
    ("tencent", 5, {"cn", "cn_index", "hk", "us"}),
    ("akshare", 1, {"cn", "hk", "cn_index"}),
    ("yfinance", 4, {"cn", "hk", "us", "jp", "kr", "tw", "cn_index"}),
]
INDEX_FIXED_CHAIN = ["tencent", "akshare", "yfinance"]  # 指数固定链（镜像材料行为）

BREAKER_FAILS, BREAKER_COOLDOWN = 3, 300      # 3 次失败熔断 300 tick
CONN_COOLDOWN = 15                            # 连接失败冷却 15 tick


class VirtualClock:
    def __init__(self):
        self.now = 0

    def advance(self, n=1):
        self.now += n


class CircuitBreaker:
    """CLOSED -> OPEN(冷却) -> HALF_OPEN(单次探测)。"""

    def __init__(self):
        self.fails, self.open_until = 0, None

    def allow(self, now):
        if self.open_until is None:
            return True
        return now >= self.open_until  # HALF_OPEN 视为放行探测

    def record(self, ok, now):
        if ok:
            self.fails, self.open_until = 0, None
        else:
            self.fails += 1
            if self.fails >= BREAKER_FAILS:
                self.open_until = now + BREAKER_COOLDOWN


class FetchManager:
    def __init__(self, scenario, clock, sabotage=None):
        self.sc, self.clock, self.sab = scenario, clock, sabotage or set()
        self.breakers = {s[0]: CircuitBreaker() for s in SOURCES}
        self.cooldown_until = {}
        self.attempts = 0          # 破坏性实验观测量：总尝试次数
        self.calls = {s[0]: 0 for s in SOURCES}
        self.fallback_from = None

    def _chain(self, market):
        if "single_source" in self.sab:  # E5：回退链只剩最高优先级单源
            return sorted([s for s in SOURCES if s[2] & {market}],
                          key=lambda s: s[1])[:1]
        if market == "cn_index":
            order = {n: i for i, n in enumerate(INDEX_FIXED_CHAIN)}
            return sorted([s for s in SOURCES if s[0] in order],
                          key=lambda s: order[s[0]])
        pool = [s for s in SOURCES if market in s[2]]
        return sorted(pool, key=lambda s: s[1])

    def _try(self, name):
        self.attempts += 1
        self.calls[name] += 1
        script = FETCH_SCRIPTS[self.sc].get(name, ["ok"])
        outcome = script[min(self.calls[name] - 1, len(script) - 1)]
        return {"ok": "ok", "fail": "fail", "slow": "slow"}[outcome]

    def fetch(self, market, block="daily_bars"):
        tried, first_fail = [], None
        for name, _prio, _mk in self._chain(market):
            now = self.clock.now
            br = self.breakers[name]
            if "no_breaker" not in self.sab and not br.allow(now):
                tried.append((name, "skipped_open"))
                continue
            if self.cooldown_until.get(name, -1) > now:
                tried.append((name, "skipped_cooldown"))
                continue
            out = self._try(name)
            if out == "ok":
                br.record(True, now)
                state = "available" if first_fail is None else "fallback"
                if first_fail is not None:
                    self.fallback_from = first_fail
                return {"state": state, "source": name, "tried": tried}
            if out == "slow":
                self.cooldown_until[name] = now + CONN_COOLDOWN
                tried.append((name, "conn_cooldown"))
                first_fail = first_fail or name
                continue
            br.record(False, now)
            tried.append((name, "fail@breaker%d" % br.fails))
            first_fail = first_fail or name
            self.clock.advance(1)
        if market == "cn_index":  # 指数全败：空结果 + 告警，不抛（镜像材料）
            return {"state": "fetch_failed", "source": "", "tried": tried,
                    "warning": "all_index_sources_failed"}
        raise DataFetchError(tried)


class DataFetchError(Exception):
    pass


# ---------------------------------------------------------------- M2 证据包

BLOCKS = [("quote", 25), ("daily_bars", 25), ("technical", 25),
          ("news", 10), ("fundamentals", 10), ("chip", 5)]
STATE_SCORE = {"available": 100, "fallback": 85, "partial": 70, "stale": 60,
               "estimated": 55, "missing": 30, "not_supported": 30,
               "fetch_failed": 25}
CORE_BLOCKS = {"quote", "daily_bars", "technical"}


def build_pack(states):
    """states: {块名: 状态词}；返回 (score, tier, max_confidence)。"""
    if "missing_neutral" in SAB:  # E1：缺数据当中性（满分）处理
        score = sum(STATE_SCORE.get(
            s if s != "missing" else "available", 0) * w for _, (n, w) in
            zip(BLOCKS, BLOCKS) for s in [states.get(n, "missing")]) // 100
    else:
        score = sum(STATE_SCORE.get(states.get(n, "missing"), 0) * w
                    for n, w in BLOCKS) // 100
    tier = ("good" if score >= 85 else "usable" if score >= 70
            else "limited" if score >= 55 else "poor")
    core_degraded = any(states.get(n, "missing") not in ("available", "fallback")
                        for n in CORE_BLOCKS)
    max_conf = "high" if not core_degraded else "low"  # 核心块降级禁高置信
    return score, tier, max_conf


# ---------------------------------------------------------------- M3 路由

CHANNELS = [
    {"name": "gemini", "caps": {"json": True, "tools": False}, "keys": ["g1", "g2"],
     "script": ["ok", "ok"]},
    {"name": "openai", "caps": {"json": True, "tools": True}, "keys": ["o1", "o2"],
     "script": ["429", "ok", "ok"]},
    {"name": "local_cli", "caps": {"json": True, "tools": False}, "keys": ["l1"],
     "script": ["ok"]},
]
FALLBACK_MODELS = ["anthropic/claude-sonnet-4-6", "openai/gpt-5.4-mini"]


class UnsupportedCapability(Exception):
    pass


class Router:
    """能力准入：generate 需 json；agent_tool 需 json+tools。
    回退后端只允许网关型（litellm 等价物）；多 Key 轮换 + 跨模型降级。"""

    def __init__(self, sabotage=None):
        self.sab = sabotage or set()
        self.calls = []

    def route(self, op):
        need = {"generate": {"json"}, "agent_tool": {"json", "tools"}}[op]
        for ch in CHANNELS:
            if need <= set(ch["caps"]):
                if "allow_cli_tool" not in self.sab:
                    return ch
                return ch  # E3 破坏在 RiskGuard，不在此
        raise UnsupportedCapability(op)

    def call(self, op, payload):
        ch = self.route(op)
        for i, key in enumerate(ch["keys"]):
            self.calls.append((ch["name"], key))
            out = ch["script"][min(i, len(ch["script"]) - 1)]
            if out == "ok":
                return {"channel": ch["name"], "key_index": i, "model": "primary"}
        # 全 Key 失败 -> 跨模型降级（记录 degraded）
        return {"channel": ch["name"], "key_index": -1,
                "model": FALLBACK_MODELS[0], "degraded": True}


# ---------------------------------------------------------------- M4 技能

CANONICAL = ["strong_buy", "buy", "hold", "sell", "strong_sell"]
ALIAS = {"strong buy": "strong_buy", "strongbuy": "strong_buy",
         "neutral": "hold", "观望": "hold", "买入": "buy", "卖出": "sell"}
LADDER = ["strong_buy", "buy", "hold", "sell", "strong_sell"]
AGG_THRESH = [(4.5, "strong_buy"), (3.5, "buy"), (2.5, "hold"), (1.5, "sell")]


def valid_signal(raw):
    if raw in CANONICAL:
        return raw
    return ALIAS.get(str(raw).strip().lower())  # None => invalid


# 场景 -> 技能脚本：每个技能 (原始输出, confidence)
SKILL_SCRIPTS = {
    "S1": [("ma_golden_cross", "buy", 0.8), ("bull_trend", "strong_buy", 0.9),
           ("chan_theory", "buy", 0.7)],
    "S2": [("ma_golden_cross", "买入!!加仓", 0.8), ("bull_trend", "buy", 0.9),
           ("emotion_cycle", "strong_sell", 0.75)],
    "S3": [("bull_trend", "buy", 0.9)],
    "S4": [("ma_golden_cross", "buy", 0.8), ("bull_trend", "strong buy", 0.85),
           ("wave_theory", "sell", 0.8), ("hot_theme", "看多!!!", 0.7)],
    "S5": [("ma_golden_cross", "buy", 0.8), ("bull_trend", "buy", 0.85),
           ("volume_breakout", "sell", 0.5), ("hot_theme", "看多!!!", 0.95)],
}


def run_skills(scenario, weight_factors):
    """返回 (valid_opinions, diagnostics)。invalid 一律只进 diagnostics。"""
    valid, diag = [], []
    for name, raw, conf in SKILL_SCRIPTS[scenario]:
        sig = valid_signal(raw)
        if sig is None and "no_partition" not in SAB:
            diag.append({"skill": name, "raw": raw, "reason": "invalid_signal"})
            continue
        eff = sig if sig is not None else "strong_buy"  # E2：拆门后垃圾当 strong_buy
        valid.append({"skill": name, "signal": eff, "confidence": conf,
                      "weight": weight_factors.get(name, 1.0)})
    return valid, diag


def aggregate(valid):
    """确定性聚合：insufficient 规则 + 分歧四类(取三类) + 加权分映射。"""
    if len(valid) <= 1 or sum(o["confidence"] for o in valid) == 0:
        return {"final_signal": "hold", "confidence": 0.0,
                "consensus_level": "insufficient", "conflicts": []}
    bull = [o for o in valid if o["signal"] in ("strong_buy", "buy")]
    bear = [o for o in valid if o["signal"] in ("strong_sell", "sell")]
    conflicts = []
    if bull and bear:
        conflicts.append({"type": "direction_opposition", "severity": "high"})
    confs = [o["confidence"] for o in valid]
    if max(confs) - min(confs) >= 0.3:
        conflicts.append({"type": "spread", "severity": "medium"})
    final_sig = max(valid, key=lambda o: o["confidence"] * o["weight"])
    for o in valid:
        if (o["confidence"] >= 0.75 and o is not final_sig
                and abs(LADDER.index(o["signal"]) -
                        LADDER.index(final_sig["signal"])) >= 2):
            conflicts.append({"type": "high_conf_dissent",
                              "severity": "high" if o["confidence"] >= 0.9 else "medium"})
    aligned = len([o for o in valid
                   if o["signal"] == final_sig["signal"]]) / len(valid)
    if any(c["severity"] == "high" for c in conflicts):
        level = "low"
    elif aligned >= 2 / 3 and not conflicts:
        level = "high"
    else:
        level = "medium"
    wscore = max(o["confidence"] * o["weight"] * 5 for o in valid)
    for th, sig in AGG_THRESH:
        if wscore >= th:
            return {"final_signal": sig,
                    "confidence": round(final_sig["confidence"], 2),
                    "consensus_level": level, "conflicts": conflicts}
    return {"final_signal": "hold", "confidence": round(final_sig["confidence"], 2),
            "consensus_level": level, "conflicts": conflicts}


# ---------------------------------------------------------------- M5 裁决

def disagreement_summary(agg, risk_opinion):
    """三桶 + 冲突摘要；风险角色看多强制压 hold（镜像材料行为）。"""
    buckets = {"bullish": [], "bearish": [], "neutral": []}
    for o in agg.get("_valid", []):
        if o["signal"] in ("strong_buy", "buy"):
            buckets["bullish"].append(o["skill"])
        elif o["signal"] in ("strong_sell", "sell"):
            buckets["bearish"].append(o["skill"])
        else:
            buckets["neutral"].append(o["skill"])
    if risk_opinion == "bullish":
        buckets["bullish"] = [s for s in buckets["bullish"] if s != "risk"]
    return {"buckets": buckets, "conflicts": agg["conflicts"]}


def risk_guard(decision, veto, downgrade, severity_high):
    """只降不升：veto buy 族→hold；downgrade 降一/两档。返回 (final, log)。"""
    if "allow_upgrade" in SAB:  # E3：允许升级（破坏只降不升）
        if downgrade and decision == "hold":
            return "buy", "upgraded hold->buy (SABOTAGED)"
        return decision, "no-op"
    d = LADDER.index(decision)
    if veto and decision in ("buy", "strong_buy"):
        return "hold", "veto %s->hold" % decision
    if downgrade:
        steps = 2 if severity_high else 1
        return LADDER[min(d + steps, 4)], "downgrade %s->%s" % (
            decision, LADDER[min(d + steps, 4)])
    return decision, "no-op"


# ---------------------------------------------------------------- 编排

SCENARIOS = {
    # 场景: (市场, 证据状态覆盖, 风险触发, 期望走向说明)
    "S1": ("cn", {}, {"veto": True}, "正常路径：证据齐全、技能一致、风险否决演示"),
    "S2": ("cn", {"quote": "stale", "technical": "stale", "news": "missing",
                  "fundamentals": "missing", "chip": "fetch_failed"},
     {"downgrade": True, "severity_high": True}, "陷阱路径：缺数据+无效信号+方向冲突"),
    "S3": ("cn_index", {}, {}, "边缘路径：指数全源失败不抛+单技能 insufficient"),
    "S4": ("cn", {"news": "stale"}, {}, "预测题输入：混合信号+1 无效技能"),
    "S5": ("cn", {"quote": "fallback"}, {}, "预测题输入：回退+轻度分歧"),
}
RISK_OPINION = {"S1": "bearish", "S2": "bearish", "S3": "neutral",
                "S4": "neutral", "S5": "bearish"}
WEIGHT_FACTORS = {"S1": {}, "S2": {}, "S3": {}, "S4": {}, "S5": {}}

SAB = set()  # 全局破坏开关（--sabotage 注入）


def run_pipeline(scenario, clock=None):
    global SAB
    clock = clock or VirtualClock()
    market, override, risk_cfg, _desc = SCENARIOS[scenario]
    fm = FetchManager(scenario, clock, SAB)
    log = {"scenario": scenario, "sabotage": sorted(SAB), "steps": []}

    # M1 取数
    if scenario == "S3":
        fetched = fm.fetch("cn_index")
        states = {"quote": "missing", "daily_bars": fetched["state"],
                  "technical": "missing", "news": "missing",
                  "fundamentals": "not_supported", "chip": "not_supported"}
        log["steps"].append(("fetch", fetched))
    else:
        fetched = fm.fetch(market if market != "cn_index" else "cn")
        states = {"quote": "available", "daily_bars": fetched["state"],
                  "technical": "available", "news": "available",
                  "fundamentals": "available", "chip": "available"}
        states.update(override)
        log["steps"].append(("fetch", {k: fetched[k] for k in ("state", "source")}))

    # M2 证据包
    score, tier, max_conf = build_pack(states)
    log["steps"].append(("pack", {"score": score, "tier": tier,
                                  "max_confidence": max_conf}))

    # M3 路由（generate）
    router = Router(SAB)
    try:
        gen = router.call("generate", {"tier": tier})
    except UnsupportedCapability as e:
        gen = {"error": "unsupported:" + str(e)}
    log["steps"].append(("route", gen))

    # M4 技能分选+聚合
    valid, diag = run_skills(scenario, WEIGHT_FACTORS[scenario])
    agg = aggregate(valid)
    agg["_valid"] = valid
    log["steps"].append(("skills", {"valid": [(o["skill"], o["signal"]) for o in valid],
                                    "diagnostics": diag}))
    log["steps"].append(("aggregate", {k: v for k, v in agg.items() if k != "_valid"}))

    # M5 分歧摘要 + 决策 + 风险覆盖
    ds = disagreement_summary(agg, RISK_OPINION[scenario])
    log["steps"].append(("disagreement", ds))
    decision = agg["final_signal"] if scenario != "S1" else "buy"
    final, glog = risk_guard(decision, risk_cfg.get("veto", False),
                             risk_cfg.get("downgrade", False),
                             risk_cfg.get("severity_high", False))
    log["steps"].append(("risk_guard", {"initial": decision, "final": final,
                                        "log": glog}))
    log["attempts"] = fm.attempts
    log["final"] = final
    log["confidence_cap"] = max_conf
    log["consensus_level"] = agg["consensus_level"]
    return log


# ---------------------------------------------------------------- selftest

def check(name, got, want):
    assert got == want, "%s: got %r want %r" % (name, got, want)
    print("  ok %-28s %r" % (name, got))


def selftest():
    global SAB
    print("== 正常基线 ==")
    r1 = run_pipeline("S1")
    check("S1 final", r1["final"], "hold")           # veto buy->hold
    check("S1 tier", r1["steps"][1][1]["tier"], "good")
    r2 = run_pipeline("S2")
    check("S2 tier", r2["steps"][1][1]["tier"], "limited")
    check("S2 conf cap", r2["confidence_cap"], "low")  # 核心块 stale => 禁高置信
    check("S2 invalid->diag", len(r2["steps"][3][1]["diagnostics"]), 1)
    check("S2 consensus", r2["consensus_level"], "low")  # 方向冲突=high 严重度
    check("S2 final", r2["final"], "hold")              # strong_buy 降两档
    r3 = run_pipeline("S3")
    check("S3 index no-raise", r3["steps"][0][1]["state"], "fetch_failed")
    check("S3 warning", r3["steps"][0][1].get("warning"), "all_index_sources_failed")
    check("S3 insufficient", r3["consensus_level"], "insufficient")
    check("S3 final", r3["final"], "hold")
    r4 = run_pipeline("S4")
    check("S4 invalid->diag", len(r4["steps"][3][1]["diagnostics"]), 1)
    check("S4 consensus", r4["consensus_level"], "low")
    r5 = run_pipeline("S5")
    check("S5 fallback state", r5["steps"][0][1]["state"], "fallback")
    check("S5 invalid->diag", len(r5["steps"][3][1]["diagnostics"]), 1)
    check("S5 final", r5["final"], "buy")

    print("== 破坏性实验（各拆一处，真跑记录退化） ==")
    results = []
    SAB = {"missing_neutral"}
    e1 = run_pipeline("S2")
    results.append(("E1 缺数据当中性", "build_pack 把 missing 记满分",
                    "tier %s→%s、分数虚高（数据缺口被隐藏）" % (
                        "limited", e1["steps"][1][1]["tier"]),
                    "状态标注是证据可信度的第一道闸"))
    SAB = {"no_partition"}
    e2 = run_pipeline("S5")
    ok2 = any(o[0] == "hot_theme" and o[1] == "strong_buy"
              for o in e2["steps"][3][1]["valid"])
    results.append(("E2 拆掉信号分选", "invalid 信号直进意见链",
                    "垃圾信号「看多!!!」当 strong_buy 进共识=%r，最终 %s（正常 buy）"
                    % (ok2, e2["final"]),
                    "外延技能必须过资格门，否则污染共识"))
    SAB = {"allow_upgrade"}
    e3 = run_pipeline("S2")
    results.append(("E3 RiskGuard 允许升级", "只降不升改为可升",
                    "正常压到 hold，破坏后保持 %s（激进结论未被压回）" % e3["final"],
                    "最后裁决的保守性只能单向"))
    clock = VirtualClock()
    SAB = set()
    e4b = FetchManager("E4", clock)
    for _ in range(6):
        e4b.fetch("cn")
    SAB = {"no_breaker"}
    e4a = FetchManager("E4", VirtualClock(), {"no_breaker"})
    for _ in range(6):
        e4a.fetch("cn")
    results.append(("E4 拆掉熔断", "不跳过已熔断源",
                    "6 轮取数尝试 %d 次（有熔断 %d 次，坏源被跳过）" % (
                        e4a.attempts, e4b.attempts),
                    "熔断挡的是对坏源的重复无效重试"))
    SAB = {"single_source"}
    try:
        run_pipeline("S2")
        e5 = "no-error"
    except DataFetchError as ex:
        e5 = "DataFetchError(%s)" % [t[0] for t in ex.args[0]]
    results.append(("E5 回退链只剩单源", "砍掉备选源",
                    "全链失败抛 %s（报告无法生成）" % e5,
                    "回退链是可用性的底座"))
    SAB = set()
    print("%-22s | %-18s | %s" % ("实验", "改动", "实测退化"))
    for name, change, deg, _les in results:
        print("%-22s | %-18s | %s" % (name, change, deg))
    print("SELFTEST PASSED ✔")


def main():
    global SAB
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--run", choices=sorted(SCENARIOS))
    ap.add_argument("--sabotage", default="")
    args = ap.parse_args()
    if args.sabotage:
        SAB = set(args.sabotage.split(","))
    if args.selftest:
        selftest()
    elif args.run:
        print(json.dumps(run_pipeline(args.run), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
