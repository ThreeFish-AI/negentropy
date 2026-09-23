#!/usr/bin/env python3
"""dream_rsi_lab — Dream-RSI 最小可运行原型（学习用途，标准库实现）.

复现 arXiv:2609.14858《Dream-RSI: Recursive Self-Improvement through Evolving
Worlds》的六个核心机制：

  1. 发现树 DiscoveryTree：节点 = workspace 快照 + 分数 + 唯一 primary parent；
  2. 共享决策接口 select_batch(𝒯, W)：{root} ∪ 已见叶子中选批次，在线/离线同一接口；
  3. 在线推演 online_rollout：策略驱动脚本化生成-评估，产出新树并入历史；
  4. 重放模拟器 replay：确定性转移——非根节点返回唯一记录子节点，根返回最早
     创建的未揭示子节点；只读已存记录，零执行成本；
  5. 重放目标 V = max s − β₁·N + β₂·N/max(1,k)（质量-成本-并行度三分量）；
  6. 策略改进与选择：policy-development（脚本化修订）+ argmax 选择，
     候选集包含当前策略 ⇒ V* ≥ V⁰ 防回退下界。

玩具域：配方工坊（五个方向的确定性「市场评分」轨迹）。discovery agent 为
脚本化 mock（按分支轨迹出分），policy-development agent 为脚本化修订——
真实系统中两者是 LLM，本原型验证的是**机制**而非模型能力。

运行：uv run --no-project python dream_rsi_lab.py --selftest
破坏性实验：uv run --no-project python dream_rsi_lab.py --break D1 （D1..D5）
"""

from __future__ import annotations

import argparse
import json

# ───────────────────────────── 世界设定（玩具域） ─────────────────────────────
# 每个分支是一条预录的「市场评分」轨迹：scores[depth] 是该方向第 depth 次尝试的分数。
# note 标注编辑类型。分支结构刻意覆盖五类形态：稳定改进 / 陷阱 / 后期爆发 / 平台 / 快速突破。
BRANCHES: list[dict] = [
    {"name": "A-深耕香料", "scores": [0.55, 0.70, 0.80],
     "notes": ["初始", "正收益", "稳定突破"]},
    {"name": "B-猛攻火候", "scores": [0.40, 0.35],
     "notes": ["初始", "陷阱方向"]},
    {"name": "C-换食材",   "scores": [0.50, 0.62, 0.90],
     "notes": ["初始", "浅层平平", "后期爆发"]},
    {"name": "E-融合菜",   "scores": [0.60, 0.92],
     "notes": ["初始", "快速突破"]},
    {"name": "D-摆盘",     "scores": [0.52, 0.53],
     "notes": ["初始", "中性平台"]},
]

W = 3          # 并行 worker 数（每轮批次上限）
K1 = 5         # 在线推演轮数上限
K2 = 5         # 重放轮数上限
BETA1 = 0.03   # 执行成本惩罚 β₁
BETA2 = 0.12   # 并行度奖励 β₂
SATURATE_DECAY = 0.01  # 分支轨迹耗尽后的饱和衰减（模拟「再挖也无增益」）
STRONG = 0.62  # adaptive 策略认定「值得集中火力」的分支分数线


# ───────────────────────────── 机制 1：发现树 ─────────────────────────────
class Node:
    """一个生成-评估尝试：workspace 快照 + 分数 + 唯一 primary parent."""

    __slots__ = ("nid", "parent", "branch", "depth", "score", "note", "created")

    def __init__(self, nid: int, parent: int | None, branch: int, depth: int,
                 score: float, note: str, created: int):
        self.nid, self.parent, self.branch, self.depth = nid, parent, branch, depth
        self.score, self.note, self.created = score, note, created


class DiscoveryTree:
    """发现树：root 代表初始 workspace；children 记录 parent→child 边（按创建序）."""

    def __init__(self):
        self.nodes: dict[int, Node] = {}
        self.children: dict[int, list[int]] = {}
        self._next = 0
        self.root = self._add(parent=None, branch=-1, depth=0, score=0.0,
                              note="初始workspace")

    def _add(self, parent, branch, depth, score, note) -> Node:
        nid = self._next
        self._next += 1
        self.nodes[nid] = Node(nid, parent, branch, depth, score, note, created=nid)
        self.children[nid] = []
        if parent is not None:
            self.children[parent].append(nid)
        return self.nodes[nid]

    def leaves(self, view: set[int]) -> list[int]:
        """当前已见集合 view 内的叶子（无已见子节点的非根节点）."""
        return [nid for nid in view
                if nid != self.root.nid and not any(c in view for c in self.children[nid])]

    def eligible(self, view: set[int]) -> list[int]:
        """决策接口的可选节点集 A(𝒯) = {root} ∪ 已见叶子."""
        return [self.root.nid] + self.leaves(view)

    def root_next(self, view: set[int]) -> int | None:
        """重放时选根：返回最早创建的未揭示 root 子节点（开一条已录分支）."""
        for c in self.children[self.root.nid]:      # children 按创建序排列
            if c not in view:
                return c
        return None


# ───────────────── 机制 2：在线生成器（脚本化 mock discovery agent） ─────────────────
class World:
    """mock discovery agent + evaluator：按分支轨迹确定性出分.

    真实系统中同一 workspace 的生成是随机的（同一起点可能产出不同结果）；
    此处用固定轨迹把这种随机性「冻结」进脚本，保证实验可复现.
    """

    def __init__(self):
        self.opened: list[int] = []   # 已开分支（按开序）

    def attempt(self, tree: DiscoveryTree, v: int) -> Node | None:
        """从节点 v 的 workspace 出发生成新候选并评分，挂为 v 的子节点."""
        if v == tree.root.nid:                     # 开新分支
            if len(self.opened) >= len(BRANCHES):
                return None                        # 方向池耗尽
            b = len(self.opened)
            self.opened.append(b)
            return tree._add(v, b, 0, BRANCHES[b]["scores"][0], BRANCHES[b]["notes"][0])
        node = tree.nodes[v]                       # 分支内精炼
        b, d = node.branch, node.depth
        traj = BRANCHES[b]["scores"]
        if d + 1 < len(traj):
            return tree._add(v, b, d + 1, traj[d + 1], BRANCHES[b]["notes"][d + 1])
        return tree._add(v, b, d + 1, round(traj[-1] - SATURATE_DECAY, 4), "饱和")


# ─────────────────────── 机制 3+4：在线推演 / 离线重放 ───────────────────────
def online_rollout(policy, tree: DiscoveryTree, world: World, log: list[str]) -> None:
    """在线推演：随机转移（此处脚本化），新节点挂树、结果不可撤销."""
    view = {tree.root.nid}
    for k in range(1, K1 + 1):
        batch = policy.select_batch(tree, view)
        if not batch:
            log.append(f"  [online r{k}] {policy.name} 选空批次 → 停止")
            break
        new = [c for v in batch if (c := world.attempt(tree, v)) is not None]
        for c in new:
            view.add(c.nid)
        desc = ", ".join(f"#{c.nid}({c.note} s={c.score:.2f})" for c in new)
        log.append(f"  [online r{k}] {policy.name} batch={{{','.join(map(str, batch))}}} → {desc}")


def best_descendant(tree: DiscoveryTree, v: int) -> int | None:
    """v 的已记录后代中分数最高者（跳读用——正常重放禁止）."""
    best, stack = None, list(tree.children[v])
    while stack:
        u = stack.pop()
        if best is None or tree.nodes[u].score > tree.nodes[best].score:
            best = u
        stack.extend(tree.children[u])
    return best


def replay(policy, tree: DiscoveryTree, log: list[str] | None = None,
           cheat: bool = False) -> dict:
    """离线重放：确定性转移，只读已存记录，零执行成本.

    cheat=True 为破坏性实验 D4 的越权开关：非根节点不再返回其唯一记录子节点，
    而是直接跳读该分支分数最高的记录后代——假装策略的下一次探测就能一步命中
    历史上多轮才摸到的最好结果（违反「按记录的 parent–child 序遍历」约束）.
    """
    view = {tree.root.nid}
    k = 0
    for _ in range(K2):
        batch = policy.select_batch(tree, view)
        if not batch:
            break
        k += 1
        for v in batch:
            if v == tree.root.nid:
                c = tree.root_next(view)
                if c is not None:
                    view.add(c)
            elif cheat:
                u = best_descendant(tree, v)      # 越权：跳读最优后代
                if u is not None and u not in view:
                    view.add(u)
            else:
                for c in tree.children[v]:        # 非根 → 唯一记录子节点
                    if c not in view:
                        view.add(c)
                        break
        if not cheat and view >= set(tree.nodes):
            break
    scores = [tree.nodes[n].score for n in view if n != tree.root.nid]
    n = len(scores)
    best = max(scores) if scores else 0.0
    v_score = best - BETA1 * n + BETA2 * n / max(1, k)
    if log is not None:
        log.append(f"  [replay] {policy.name}: N={n} rounds={k} max={best:.2f} V={v_score:.4f}")
    return {"policy": policy.name, "N": n, "k": k, "max": best, "V": v_score}


# ───────────────────────────── 探索策略池 ─────────────────────────────
class Policy:
    name = "base"

    def select_batch(self, tree: DiscoveryTree, view: set[int]) -> list[int]:
        raise NotImplementedError


class ParallelRefinePolicy(Policy):
    """论文初始策略 parallel refining：开满 W 个分支，之后所有叶子满批精炼."""
    name = "π1-parallel_refine"

    def select_batch(self, tree, view):
        elig = tree.eligible(view)
        roots_seen = [n for n in view if n != tree.root.nid and tree.nodes[n].depth == 0]
        if len(roots_seen) < W and tree.root.nid in elig:   # 先铺满 W 个方向
            return [tree.root.nid] + [n for n in elig if n != tree.root.nid][:W - 1]
        return [n for n in elig if n != tree.root.nid][:W]  # 全叶子满批精炼


class SerialDepthPolicy(Policy):
    """每轮单节点（批次=1），死磕当前最深方向——并行度最低的对照."""
    name = "π-serial_depth"

    def select_batch(self, tree, view):
        leaves = tree.leaves(view)
        if not leaves:
            return [tree.root.nid]
        return [max(leaves, key=lambda n: tree.nodes[n].depth)]


class StopEarlyPolicy(Policy):
    """开一个分支浅尝即止：N 极小，几乎不花预算."""
    name = "π-stop_early"

    def select_batch(self, tree, view):
        nonroot = [n for n in view if n != tree.root.nid]
        if not nonroot:
            return [tree.root.nid]
        if len(nonroot) >= 2:
            return []                                        # 两层就停
        return [nonroot[0]]


class RevealAllPolicy(Policy):
    """满批全展开直到轮数上限：max 分不低但 N 巨大——成本失控对照."""
    name = "π-reveal_all"

    def select_batch(self, tree, view):
        return tree.eligible(view)[:W]


class AdaptivePolicy(Policy):
    """脚本化「学到的策略」：动态组合批次（exploit 强方向 + explore 未证方向 + 开新根），
    弱/饱和分支早停——即论文附录 B.2 要求的 dynamic portfolio 批次规则."""
    name = "π*-adaptive"

    def _states(self, tree, view) -> dict[int, dict]:
        by_branch: dict[int, list[Node]] = {}
        for n in view:
            if n != tree.root.nid:
                by_branch.setdefault(tree.nodes[n].branch, []).append(tree.nodes[n])
        st = {}
        for b, nodes in by_branch.items():
            st[b] = {"best": max(nd.score for nd in nodes),
                     "first": nodes[0].score,
                     "n": len(nodes),
                     "saturated": any(nd.note == "饱和" for nd in nodes),
                     "leaf": max(nodes, key=lambda nd: nd.depth).nid}
        return st

    def select_batch(self, tree, view):
        st = self._states(tree, view)
        weak = {b for b, s in st.items()
                if s["first"] < 0.45 or (s["n"] >= 2 and s["best"] < 0.55) or s["saturated"]}
        alive = {b: s for b, s in st.items() if b not in weak}
        strong = {b: s for b, s in alive.items() if s["best"] >= STRONG}
        batch: list[int] = []
        if strong:                                           # exploit：最强方向
            b = max(strong, key=lambda x: strong[x]["best"])
            batch.append(st[b]["leaf"])
        probe = {b: s for b, s in alive.items() if b not in strong}
        if probe and len(batch) < W:                         # explore：未证方向
            b = max(probe, key=lambda x: probe[x]["best"])
            batch.append(st[b]["leaf"])
        if len(batch) < W:                                   # 新方向
            batch.append(tree.root.nid)
        return batch[:W]


# ───────────────── 机制 6：策略改进（脚本化 mock）与选择 ─────────────────
def develop_versions(current: Policy, tree: DiscoveryTree) -> list[Policy]:
    """mock policy-development agent：看重放反馈修订策略代码（此处按规则产出）."""
    return [current, AdaptivePolicy()]


def select_policy(versions, tree, log, include_current=True):
    """评估各版本平均重放分并 argmax；候选含当前策略 ⇒ V* ≥ V⁰."""
    pool = versions if include_current else versions[1:]
    results = [replay(p, tree, log) for p in pool]
    best = max(zip(pool, results), key=lambda pr: pr[1]["V"])
    return best[0], results


# ───────────────────────────── 主循环（两轮递归） ─────────────────────────────
def dream_loop(log: list[str], break_mode: str | None = None) -> dict:
    policy = ParallelRefinePolicy()

    # 外层 t=1：初始策略上线
    log.append("── 外层 t=1：π1 上线探索 ──")
    t1 = DiscoveryTree()
    online_rollout(policy, t1, World(), log)

    # 离线做梦：评估当前 + 修订版本
    log.append("── 离线做梦：在 T1 上重放评估策略版本 ──")
    versions = develop_versions(policy, t1)
    if break_mode == "D1":                                   # 拔掉候选包含保证
        versions = [StopEarlyPolicy(), SerialDepthPolicy()]  # 且修订版全面更差
        winner, results = select_policy(versions, t1, log, include_current=False)
    else:
        winner, results = select_policy(versions, t1, log)

    # 外层 t=2：胜出策略上线
    log.append(f"── 外层 t=2：胜出策略 {winner.name} 上线探索 ──")
    t2 = DiscoveryTree()
    online_rollout(winner, t2, World(), log)

    v_current = replay(policy, t1)["V"]
    return {
        "t1": t1, "t2": t2,
        "t1_best": max(n.score for n in t1.nodes.values() if n.nid != t1.root.nid),
        "t2_best": max(n.score for n in t2.nodes.values() if n.nid != t2.root.nid),
        "t2_probes": len(t2.nodes) - 1,
        "winner": winner.name,
        "offline": results,
        "winner_V": max(r["V"] for r in results),
        "guarantee_holds": max(r["V"] for r in results) >= v_current,
    }


# ───────────────────────────── 破坏性实验 ─────────────────────────────
def run_break(mode: str) -> None:
    """每拆一个机制，真跑并逐字记录退化."""
    if mode == "D1":  # 拔掉候选包含保证
        log: list[str] = []
        r = dream_loop(log, break_mode="D1")
        print("\n".join(log))
        v_pi1 = replay(ParallelRefinePolicy(), r["t1"])["V"]
        print(f"\n[D1] 改动：argmax 候选池强制排除当前策略 π1（且修订版全面更差）")
        print(f"[D1] 观察：被迫选中 {r['winner']}（V={r['winner_V']:.4f}），"
              f"而 π1 重放分 V={v_pi1:.4f} 本应兜底——V*≥V⁰ 下界失守，下轮上线即退化。")
        print(f"[D1] 教训：候选包含保证是零成本的防回退保险——elitism 的最小形态。")

    elif mode == "D2":  # 拔掉并行度奖励 β₂
        global BETA2
        t1 = DiscoveryTree()
        online_rollout(ParallelRefinePolicy(), t1, World(), [])
        la: list[str] = []
        lb: list[str] = []
        with_b2 = [replay(p, t1, la) for p in (ParallelRefinePolicy(), SerialDepthPolicy())]
        BETA2 = 0.0
        without_b2 = [replay(p, t1, lb) for p in (ParallelRefinePolicy(), SerialDepthPolicy())]
        BETA2 = 0.12
        print("\n".join(la + lb))
        w_par, w_ser = with_b2[0]["V"] > with_b2[1]["V"], without_b2[0]["V"] > without_b2[1]["V"]
        print(f"\n[D2] 改动：β₂ = 0.12 → 0（重放目标只剩 质量−成本）")
        print(f"[D2] 观察：V(parallel) {with_b2[0]['V']:.4f}→{without_b2[0]['V']:.4f}，"
              f"V(serial) {with_b2[1]['V']:.4f}→{without_b2[1]['V']:.4f}；"
              f"排名 {('parallel>serial' if w_par else 'serial≥parallel')}"
              f" → {('parallel>serial' if w_ser else 'serial≥parallel')}——"
              f"满批策略每轮平均执行数≈W、串行≈1，拔掉 β₂ 后墙钟效率被系统性低估。")
        print(f"[D2] 教训：并行度奖励是 V 里唯一反映「批次即省墙钟」的项。")

    elif mode == "D3":  # 拔掉成本惩罚 β₁
        global BETA1
        t1 = DiscoveryTree()
        online_rollout(ParallelRefinePolicy(), t1, World(), [])
        lc: list[str] = []
        BETA1 = 0.0
        rs = [replay(p, t1, lc) for p in (AdaptivePolicy(), RevealAllPolicy())]
        BETA1 = 0.03
        winner = max(rs, key=lambda x: x["V"])
        print("\n".join(lc))
        print(f"\n[D3] 改动：β₁ = 0.03 → 0（重放目标不再惩罚执行数 N）")
        print(f"[D3] 观察：胜者 = {winner['policy']}（N={winner['N']}）；"
              f"reveal_all N={rs[1]['N']} 远大却不再被罚，铺张扩张被误判为优。")
        print(f"[D3] 教训：成本惩罚是 V 里唯一约束预算的项，拔掉后目标退化为只看 max 分。")

    elif mode == "D4":  # 重放越权（幻觉转移）
        t1 = DiscoveryTree()
        online_rollout(ParallelRefinePolicy(), t1, World(), [])
        ld: list[str] = []
        le: list[str] = []
        r_honest = replay(StopEarlyPolicy(), t1, ld)
        r_cheat = replay(StopEarlyPolicy(), t1, le, cheat=True)
        r_adaptive = replay(AdaptivePolicy(), t1, [])
        print("\n".join(ld + le))
        print(f"\n[D4] 改动：重放转移越权——不返回记录子节点，而直接跳读该分支分数最高的记录后代")
        flip = r_cheat["V"] > r_adaptive["V"] > r_honest["V"]
        print(f"[D4] 观察：honest V(stop_early)={r_honest['V']:.4f}（max={r_honest['max']:.2f}，"
              f"按序揭示只到 A1）；cheat V={r_cheat['V']:.4f}（max={r_cheat['max']:.2f}，"
              f"一步「跳中」历史上多轮才摸到的 A2）——"
              f"{'反超 V(adaptive)=' + format(r_adaptive['V'], '.4f') + '，排名反转：最弱的浅尝策略被误判为最优' if flip else '未反超 V(adaptive)=' + format(r_adaptive['V'], '.4f') + '，但评估分已虚高 ' + format(r_cheat['V'] - r_honest['V'], '.4f')}。")
        print(f"[D4] 教训：重放的价值恰在 grounded——评估必须对「策略真实会花的探测成本」负责。")

    elif mode == "D5":  # 语义引导替代重放（对应论文 §5.1）
        class GuidedPolicy(Policy):
            name = "π-guided(只推A方向)"

            def select_batch(self, tree, view):
                nonroot = [n for n in view if n != tree.root.nid]
                if not nonroot:
                    return [tree.root.nid]
                return [max(nonroot, key=lambda n: tree.nodes[n].depth)]

        lf: list[str] = []
        t_g = DiscoveryTree()
        online_rollout(GuidedPolicy(), t_g, World(), lf)
        best_g = max(n.score for n in t_g.nodes.values() if n.nid != t_g.root.nid)
        r = dream_loop([])
        print("\n".join(lf))
        print(f"\n[D5] 改动：不改进策略代码，改为把历史摘要成方向性洞见注入（「深耕香料最有前途」）")
        print(f"[D5] 观察：引导版终局 max={best_g:.2f}（被锁死在分支 A）；"
              f"重放改进版 t=2 终局 max={r['t2_best']:.2f}（可达 E 分支 0.92）。")
        print(f"[D5] 教训：强语义归纳偏置 over-constrain 搜索空间——论文 §5.1 实证在此复现。")
    else:
        raise SystemExit(f"未知破坏模式 {mode}（可选 D1..D5）")


# ───────────────────────────── selftest ─────────────────────────────
def selftest() -> None:
    log: list[str] = []

    # 1) 在线推演：π1 产出的树结构正确（parallel_refine 开满 W 个分支）
    t1 = DiscoveryTree()
    online_rollout(ParallelRefinePolicy(), t1, World(), log)
    root_children = t1.children[t1.root.nid]
    assert len(root_children) == W, f"π1 应开满 {W} 个分支，实际 {len(root_children)}"
    scores_r1 = [t1.nodes[c].score for c in root_children]
    assert scores_r1 == [0.55, 0.40, 0.50], f"首轮分支分数应取轨迹首值，实际 {scores_r1}"

    # 2) 重放确定性：同一策略同一树，两次重放结果逐位一致
    r1 = replay(AdaptivePolicy(), t1)
    r2 = replay(AdaptivePolicy(), t1)
    assert r1 == r2, "重放必须确定性"

    # 3) 转移规则：根→最早创建未揭示子节点；非根→唯一记录子节点
    view = {t1.root.nid}
    c_first = t1.root_next(view)
    assert c_first == root_children[0], "根应返回最早创建的未揭示子节点"
    view.add(c_first)
    assert len([c for c in t1.children[c_first] if c not in view]) <= 1, \
        "非根节点的记录子节点唯一"

    # 4) V 排序：adaptive 应优于初始策略与浅尝策略（构造世界中）
    rs = {p.name: replay(p, t1)["V"] for p in
          (ParallelRefinePolicy(), AdaptivePolicy(), StopEarlyPolicy(), SerialDepthPolicy())}
    assert rs["π*-adaptive"] > rs["π1-parallel_refine"], f"adaptive 应胜初始策略：{rs}"
    assert rs["π*-adaptive"] > rs["π-stop_early"], f"adaptive 应胜浅尝策略：{rs}"

    # 5) 完整两轮递归：胜出策略上线后 t=2 优于 t=1；候选包含保证成立
    finals = dream_loop(log)
    assert finals["winner"] == "π*-adaptive", f"离线应选出 adaptive，实际 {finals['winner']}"
    assert finals["t2_best"] > finals["t1_best"], \
        f"策略改进应带来更优发现：{finals['t1_best']} → {finals['t2_best']}"
    assert finals["guarantee_holds"], "V*≥V⁰ 候选包含保证应成立"

    # 6) 表示层完整：最终树可序列化落盘
    dump = {str(n): {"parent": nd.parent,
                     "branch": BRANCHES[nd.branch]["name"] if nd.branch >= 0 else "root",
                     "depth": nd.depth, "score": nd.score, "note": nd.note}
            for n, nd in finals["t2"].nodes.items()}
    assert json.dumps(dump) and len(dump) == len(finals["t2"].nodes)

    print("\n".join(log))
    print("\n── 策略重放分对比（T1 上）──")
    for name, v in rs.items():
        print(f"  {name:<22} V={v:.4f}")
    print(f"\nt=1 终局 max={finals['t1_best']:.2f} → t=2 终局 max={finals['t2_best']:.2f}"
          f"（探测数 {len(finals['t1'].nodes) - 1} → {finals['t2_probes']}）")
    print("SELFTEST PASSED ✔")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Dream-RSI 最小原型")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--break", dest="break_mode", choices=["D1", "D2", "D3", "D4", "D5"])
    args = ap.parse_args()
    if args.break_mode:
        run_break(args.break_mode)
    elif args.selftest:
        selftest()
    else:
        ap.print_help()
