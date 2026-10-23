#!/usr/bin/env python3
"""pg_lab — Procedural Graph 最小可运行原型（学习用途，标准库实现）.

复现 arXiv:2609.09153《Procedural Graphs: Self-Evolving Execution Structures for
LLM Agents》的五个核心机制：

  1. attributed triplet 数据结构：G=(V,R,E,Φ)，边带 condition / guidance / pitfalls；
  2. Match 定位 + h-hop 邻域抽取（在线消费的不是全图，是局部连通子图）；
  3. guidance prompt 组装（locate → extract → generate 三步的文本面）；
  4. refiner 编辑集（add / delete / revise_attributes，先删后加对齐论文 PrepareCandidate）；
  5. 验证门（候选 ≥ 缓存分才接受，**平局也接受**）+ 拒绝记忆（负证据阻断重提）
     + 结构校验（无环 / 每节点可达终端；失败不跑验证 rollout）。

玩具域：数据交付（fetch → validate → fix → submit / abort）。
solver 为确定性 mock（按图行走 + 遵守观察），refiner 为脚本化提案——真实系统中两者是
LLM，本原型验证的是**机制**而非模型能力。

运行：uv run --no-project python pg_lab.py --selftest
"""

from __future__ import annotations

import argparse
import copy
import json
from dataclasses import dataclass, field

RELATIONS = ("LEADS_TO", "TRIGGERS", "PROVIDES_INPUT_FOR", "CONVERGES_TO")
TERM_TOOLS = ("submit_report", "abort_run")  # 终端动作：执行即回合结束


# =============================================================================
# 1) 表示层：attributed triplet
# =============================================================================


@dataclass
class Edge:
    """(procedure, relation, procedure) 三元组 + Φ 边属性。"""

    source: str
    relation: str
    target: str
    condition: str = ""   # 何时走这条边
    guidance: str = ""    # 怎么走
    pitfalls: str = ""    # 别踩什么坑

    def signature(self) -> str:
        return f"{self.source}={self.relation}=>{self.target}"


@dataclass
class Graph:
    nodes: list[str]
    node_desc: dict[str, str]
    edges: list[Edge]

    def outgoing(self, node: str) -> list[Edge]:
        return [e for e in self.edges if e.source == node]

    def to_json(self) -> str:
        return json.dumps(
            {
                "nodes": self.nodes,
                "node_desc": self.node_desc,
                "edges": [
                    {
                        "source": e.source,
                        "relation": e.relation,
                        "target": e.target,
                        "condition": e.condition,
                        "guidance": e.guidance,
                        "pitfalls": e.pitfalls,
                    }
                    for e in self.edges
                ],
            },
            ensure_ascii=False,
            indent=2,
        )

    @staticmethod
    def from_json(raw: str) -> "Graph":
        data = json.loads(raw)
        return Graph(
            nodes=data["nodes"],
            node_desc=data["node_desc"],
            edges=[Edge(**e) for e in data["edges"]],
        )


def baseline_graph() -> Graph:
    """最小骨架（论文 Mode 4/5 的 scratch 初始化：Start→…→End）。"""
    return Graph(
        nodes=["Start", "fetch_data", "submit_report"],
        node_desc={
            "Start": "回合起点",
            "fetch_data": "从数据源取数",
            "submit_report": "提交最终报告",
            "validate_data": "校验 schema 与完整性",
            "fix_format": "修复校验发现的 issues",
            "abort_run": "空源时终止本回合",
        },
        edges=[
            Edge("Start", "LEADS_TO", "fetch_data", guidance="先取数"),
            Edge(
                "fetch_data",
                "LEADS_TO",
                "submit_report",
                guidance="取数后直接提交",
                pitfalls="未校验的数据可能带 issues",
            ),
        ],
    )


# =============================================================================
# 2) 在线消费：Match 定位 + h-hop 邻域
# =============================================================================


def match(last_action: str | None, graph: Graph) -> str | None:
    """Match：最近一次动作精确匹配到节点；首个决策步定位于 Start。"""
    if last_action is None:
        return "Start"
    return last_action if last_action in graph.nodes else None


def neighborhood(graph: Graph, node: str, h: int = 2) -> list[tuple[int, Edge]]:
    """N_h(u)：从 u 出发、沿出边最多 h 跳的连通子图（含跳数标注）。"""
    result: list[tuple[int, Edge]] = []
    frontier, seen = {node}, {node}
    for hop in range(1, h + 1):
        nxt: set[str] = set()
        for n in frontier:
            for e in graph.outgoing(n):
                result.append((hop, e))
                if e.target not in seen:
                    seen.add(e.target)
                    nxt.add(e.target)
        if not nxt:
            break
        frontier = nxt
    return result


def build_guidance_prompt(
    graph: Graph,
    active: str,
    hop_edges: list[tuple[int, Edge]],
    query: str,
    window: list[str],
) -> str:
    """guidance LLM (Ψ) 的输入：定位节点 + 邻域子图 + 轨迹窗口 + 任务。"""
    lines = [f"[Active Node] {active} — {graph.node_desc.get(active, '')}", "[Subgraph]"]
    for hop, e in hop_edges:
        lines.append(f"  hop{hop}: ({e.source}) -{e.relation}-> ({e.target})")
        if e.condition:
            lines.append(f"      condition: {e.condition}")
        if e.guidance:
            lines.append(f"      guidance : {e.guidance}")
        if e.pitfalls:
            lines.append(f"      pitfalls : {e.pitfalls}")
    lines.append(f"[Recent Trajectory w=3] {' -> '.join(window[-3:]) or '(start)'}")
    lines.append(f"[Task] {query}")
    lines.append("请把上述子图翻译成「下一步情境指导 g_t」：一句话点明当前目标与须避免的错误。")
    return "\n".join(lines)


def generate_guidance(active: str, hop_edges: list[tuple[int, Edge]]) -> str:
    """demo 版 Ψ：确定性地把邻域翻译成 g_t（真实系统由 guidance LLM 生成）。"""
    outs = [e for hop, e in hop_edges if hop == 1 and e.source == active]
    if not outs:
        return "无可用转移，回合结束。"
    parts = [f"当前位于 {active}；可行动作：" + " / ".join(e.target for e in outs)]
    for e in outs:
        if e.pitfalls:
            parts.append(f"切勿：{e.pitfalls}")
    return "；".join(parts) + "。"


# =============================================================================
# 3) 模拟环境与 mock solver（按图行走 + 遵守观察）
# =============================================================================


@dataclass(frozen=True)
class Episode:
    eid: str
    kind: str  # clean | dirty | unavailable


def tool_effect(action: str, ep: Episode) -> dict:
    """环境观察：论文里的 o_t。"""
    if action == "fetch_data":
        return {"empty": ep.kind == "unavailable"}
    if action == "validate_data":
        return {"issues": ep.kind == "dirty"}
    if action == "fix_format":
        return {"fixed": True}
    return {}


def choose_target(outs: list[Edge], prefer: list[str]) -> str | None:
    for t in prefer:
        for e in outs:
            if e.target == t:
                return e.target
    return outs[0].target if outs else None


def run_episode(graph: Graph, ep: Episode, max_steps: int = 8) -> tuple[bool, list[str]]:
    """mock solver：Match 定位 → 读邻域 → 选下一动作（软遵循图结构）。"""
    steps: list[str] = []
    obs: dict = {}
    current = match(None, graph)
    for _ in range(max_steps):
        outs = graph.outgoing(current)  # solver 实际只看到 neighborhood 的子集
        if current == "Start":
            nxt = choose_target(outs, ["fetch_data"])
        elif current == "fetch_data":
            nxt = choose_target(outs, ["abort_run"] if obs.get("empty") else ["validate_data", "submit_report"])
        elif current == "validate_data":
            nxt = choose_target(outs, ["fix_format"] if obs.get("issues") else ["submit_report"])
        elif current == "fix_format":
            nxt = choose_target(outs, ["submit_report"])
        else:
            nxt = choose_target(outs, [])
        if nxt is None:
            return False, steps  # 卡死（无出边且非终端）
        steps.append(nxt)
        if nxt in TERM_TOOLS:
            ok = (
                nxt == "abort_run"
                and ep.kind == "unavailable"
                and bool(obs.get("empty"))
            ) or (
                nxt == "submit_report"
                and ep.kind != "unavailable"
                and "fetch_data" in steps
                and (ep.kind == "clean" or "fix_format" in steps)
            )
            return ok, steps
        obs = tool_effect(nxt, ep)
        current = nxt  # Match(a_t)：下一轮定位到刚执行的动作
    return False, steps


def evaluate(graph: Graph, episodes: list[Episode]) -> float:
    """S_val(G)：验证集平均分（demo 为二元成功率的均值）。"""
    return sum(1.0 for ep in episodes if run_episode(graph, ep)[0]) / len(episodes)


# =============================================================================
# 4) 离线进化：结构校验 / 编辑集 / 验证门 / 拒绝记忆
# =============================================================================


def structural_check(graph: Graph) -> list[str]:
    """结构校验：无环、每节点可达零出度终端、边端点存在、relation 合法。"""
    diags: list[str] = []
    node_set = set(graph.nodes)
    for e in graph.edges:
        if e.relation not in RELATIONS:
            diags.append(f"非法 relation: {e.signature()}")
        if e.source not in node_set or e.target not in node_set:
            diags.append(f"边端点缺失: {e.signature()}")

    # 有向无环（三色 DFS）
    color = {n: 0 for n in graph.nodes}
    adj: dict[str, list[str]] = {n: [] for n in graph.nodes}
    for e in graph.edges:
        adj[e.source].append(e.target)

    def has_cycle(u: str) -> bool:
        color[u] = 1
        for v in adj[u]:
            if color[v] == 1 or (color[v] == 0 and has_cycle(v)):
                return True
        color[u] = 2
        return False

    if any(color[n] == 0 and has_cycle(n) for n in graph.nodes):
        diags.append("存在环（cycle policy=disallow）")

    # 可达终端：终端=零出度节点；反向 BFS 求能到达终端的节点集
    rev: dict[str, list[str]] = {n: [] for n in graph.nodes}
    for e in graph.edges:
        rev[e.target].append(e.source)
    terminals = [n for n in graph.nodes if not adj[n]]
    reach, stack = set(terminals), list(terminals)
    while stack:
        u = stack.pop()
        for p in rev[u]:
            if p not in reach:
                reach.add(p)
                stack.append(p)
    for n in graph.nodes:
        if n not in reach:
            diags.append(f"节点 {n} 不可达任何终端")
    return diags


def apply_edits(graph: Graph, edits: dict) -> Graph:
    """对副本应用编辑集：先删后加（对齐论文 PrepareCandidate 语义）。

    delete_edges 按 (source, target) 删除该端点对之间全部边（无视 relation），
    需保留的边通过 add_edges 重新加回——与论文 Appendix B.5 一致。
    """
    g = copy.deepcopy(graph)
    for sig in edits.get("delete_edges", []):
        s, t = sig.split("=>")
        g.edges = [e for e in g.edges if not (e.source == s and e.target == t)]
    for n, desc in edits.get("add_nodes", {}).items():
        if n not in g.nodes:
            g.nodes.append(n)
        g.node_desc.setdefault(n, desc)
    for e in edits.get("add_edges", []):
        g.edges.append(Edge(**e))
    for r in edits.get("revise_attributes", []):
        for e in g.edges:
            if e.source == r["source"] and e.target == r["target"]:
                for k in ("condition", "guidance", "pitfalls"):
                    if k in r:
                        setattr(e, k, r[k])
    return g


@dataclass
class Proposal:
    round_no: int
    signature: str          # 编辑集签名：拒绝记忆的匹配键
    rationale: str          # 对比 train 成败得出的“动机”（真实系统由 refiner LLM 产出）
    edits: dict
    blocked_by: str | None = None  # 首选编辑被拒绝记忆阻断时记录


def scripted_refiner(round_no: int, rejections: list[dict]) -> Proposal | None:
    """脚本化提案序列。R3 演示拒绝记忆：首选编辑命中负证据 → 改提次选。"""
    rejected_sigs = {r["signature"] for r in rejections}

    if round_no == 1:
        return Proposal(1, "add-validation-branch", "train 失败样本全部死于『未校验即提交』", {
            "add_nodes": {"validate_data": "校验 schema 与完整性", "fix_format": "修复校验发现的 issues"},
            "add_edges": [
                {"source": "fetch_data", "relation": "TRIGGERS", "target": "validate_data",
                 "condition": "数据已取回", "guidance": "先校验 schema 与完整性",
                 "pitfalls": "跳过校验直接提交是失败主因"},
                {"source": "validate_data", "relation": "TRIGGERS", "target": "fix_format",
                 "condition": "发现 issues", "guidance": "修复后重新进入提交流程"},
                {"source": "validate_data", "relation": "LEADS_TO", "target": "submit_report",
                 "condition": "无 issues", "guidance": "校验干净即可提交", "pitfalls": "issues 未修复时严禁提交"},
                {"source": "fix_format", "relation": "LEADS_TO", "target": "submit_report",
                 "condition": "修复完成"},
            ],
        })
    if round_no == 2:
        return Proposal(2, "shortcut-fetch-to-submit",
                        "clean train 样本上 3 步可缩为 2 步，期望降本（训练集过拟合提案）", {
            "delete_edges": ["fetch_data=>validate_data", "validate_data=>fix_format",
                             "validate_data=>submit_report", "fix_format=>submit_report"],
            "add_edges": [{"source": "fetch_data", "relation": "LEADS_TO",
                           "target": "submit_report", "guidance": "取数后直接提交"}],
        })
    if round_no == 3:
        if "shortcut-fetch-to-submit" in rejected_sigs:
            return Proposal(3, "add-abort-branch",
                            "train 的 unavailable 样本死于空源仍提交；首选『删校验』编辑已被拒绝记忆阻断，改提次选", {
                "add_nodes": {"abort_run": "空源时终止本回合"},
                "add_edges": [{"source": "fetch_data", "relation": "TRIGGERS", "target": "abort_run",
                               "condition": "source 为空", "guidance": "空源时终止而非提交空报告",
                               "pitfalls": "对空数据提交会直接失败"}],
            }, blocked_by="shortcut-fetch-to-submit")
        return Proposal(3, "shortcut-fetch-to-submit", "重复提案（未设阻断时）", {})
    if round_no == 4:
        return Proposal(4, "revise-validate-submit-pitfalls",
                        "属性级修订：把『issues 未修复不得提交』从隐含经验写成显式 pitfalls", {
            "revise_attributes": [{"source": "validate_data", "target": "submit_report",
                                   "pitfalls": "发现 issues 后严禁直接提交，必须先走 fix_format"}],
        })
    if round_no == 5:
        return Proposal(5, "cycle-recheck", "期望提交后回到取数做复查（结构非法提案）", {
            "add_edges": [{"source": "submit_report", "relation": "LEADS_TO", "target": "fetch_data"}],
        })
    return None


def evolve(initial: Graph, val_episodes: list[Episode], rounds: int = 5) -> dict:
    """四步循环：诊断 rollout（demo 由提案叙事替代）→ 变异 → 验证门 → 拒绝记忆。"""
    retained = initial
    cached = evaluate(retained, val_episodes)
    rejections: list[dict] = []
    history: list[dict] = []

    log(f"Round 0 基线：S_val={cached:.2f}（初始图 {len(initial.edges)} 条边）")

    for k in range(1, rounds + 1):
        prop = scripted_refiner(k, rejections)
        if prop is None:
            break
        if prop.blocked_by:
            log(f"Round {k} 拒绝记忆命中：首选编辑 [{prop.blocked_by}] 是已知失败编辑 → 改提 [{prop.signature}]")

        candidate = apply_edits(retained, prop.edits)
        diags = structural_check(candidate)
        if diags:  # 结构失败：不跑验证 rollout，直接入拒绝记忆（论文 Algorithm 1 L11-13）
            log(f"Round {k} REJECT(结构性) [{prop.signature}]：{diags[0]}；验证 rollout 跳过")
            rejections.append({"signature": prop.signature, "reason": "structural", "diags": diags})
            history.append({"round": k, "decision": "reject_structural", "score": cached})
            continue

        score = evaluate(candidate, val_episodes)
        if score >= cached:  # 平局也接受（论文式(5)：>= 而非 >）
            decision = "accept" if score > cached else "accept_tie"
            log(f"Round {k} {'ACCEPT(平局)' if score == cached else 'ACCEPT'} [{prop.signature}]："
                f"S_val {cached:.2f} → {score:.2f}（{prop.rationale}）")
            retained, cached = candidate, score
        else:
            log(f"Round {k} REJECT [{prop.signature}]：S_val {score:.2f} < 缓存 {cached:.2f}"
                f"（训练集动机未泛化到验证集）→ 写入拒绝记忆")
            rejections.append({"signature": prop.signature, "reason": "validation",
                               "val_score": score, "cached": cached})
        history.append({"round": k, "decision": decision if score >= cached else "reject",
                        "score": score})

    return {"graph": retained, "cached": cached, "rejections": rejections, "history": history}


TRAIN = [
    Episode("t1", "clean"), Episode("t2", "clean"),
    Episode("t3", "dirty"), Episode("t4", "dirty"), Episode("t5", "unavailable"),
]
VAL = [
    Episode("v1", "clean"), Episode("v2", "clean"), Episode("v3", "clean"), Episode("v4", "clean"),
    Episode("v5", "dirty"), Episode("v6", "dirty"), Episode("v7", "dirty"), Episode("v8", "dirty"),
    Episode("v9", "unavailable"), Episode("v10", "unavailable"),
]


def log(msg: str) -> None:
    print(f"  {msg}")


# =============================================================================
# selftest
# =============================================================================


def selftest() -> int:
    print("== ① 表示层：三元组 + JSON 序列化 roundtrip ==")
    g0 = baseline_graph()
    rt = Graph.from_json(g0.to_json())
    assert rt.to_json() == g0.to_json(), "JSON roundtrip 失败"
    log(f"OK：{len(g0.nodes)} 节点 / {len(g0.edges)} 三元组，roundtrip 一致")

    print("== ② 在线消费：Match + 2-hop 邻域 + guidance 组装 ==")
    g1 = apply_edits(baseline_graph(), scripted_refiner(1, []).edits)
    assert match(None, g1) == "Start" and match("validate_data", g1) == "validate_data"
    assert match("nonexistent", g1) is None
    hop_edges = neighborhood(g1, "validate_data", h=2)
    hop1_targets = {e.target for hop, e in hop_edges if hop == 1 and e.source == "validate_data"}
    assert hop1_targets == {"fix_format", "submit_report"}, hop1_targets
    prompt = build_guidance_prompt(g1, "validate_data", hop_edges,
                                   "交付本月经营数据报告", ["fetch_data", "validate_data"])
    for kw in ("condition:", "guidance :", "pitfalls :", "[Active Node] validate_data"):
        assert kw in prompt, f"guidance prompt 缺 {kw}"
    log("OK：定位/邻域/提示组装均含 condition·guidance·pitfalls 三属性")
    print("-- demo g_t（Ψ 的确定性翻译）--")
    log(generate_guidance("validate_data", hop_edges))

    print("== ③ 模拟环境：baseline 图在三类样本上的行为 ==")
    ok, steps = run_episode(g0, Episode("d1", "dirty"))
    assert not ok and steps == ["fetch_data", "submit_report"], steps
    log(f"dirty 样本：baseline {' -> '.join(steps)} → 失败（未校验即提交）")

    print("== ④ 自进化五轮：验证门 + 拒绝记忆 + 结构校验 ==")
    result = evolve(baseline_graph(), VAL, rounds=5)
    h = {row["round"]: row for row in result["history"]}
    assert h[1]["decision"] == "accept"          # R1 接受（0.4 → 0.8）
    assert h[2]["decision"] == "reject"          # R2 拒绝（0.4 < 0.8）
    assert any(r["signature"] == "shortcut-fetch-to-submit" for r in result["rejections"])
    assert h[3]["decision"] == "accept"          # R3 拒绝记忆阻断后改提（0.8 → 1.0）
    assert h[4]["decision"] == "accept_tie"      # R4 平局接受（1.0 == 1.0）
    assert h[5]["decision"] == "reject_structural"  # R5 环编辑：不跑验证直接拒绝
    assert result["cached"] == 1.0
    log("OK：R1 接受 / R2 拒绝入拒绝记忆 / R3 负证据阻断改提 / R4 平局接受 / R5 结构性拒绝")
    log(f"最终图：{len(result['graph'].nodes)} 节点 / {len(result['graph'].edges)} 三元组 / 拒绝记忆 {len(result['rejections'])} 条")

    with open("final_graph.json", "w", encoding="utf-8") as f:
        f.write(result["graph"].to_json())
    log("最终图已序列化至 final_graph.json")
    print("\nSELFTEST PASSED ✔")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Procedural Graph 最小原型")
    ap.add_argument("--selftest", action="store_true", help="运行机制自测")
    args = ap.parse_args()
    if args.selftest:
        raise SystemExit(selftest())
    evolve(baseline_graph(), VAL)
