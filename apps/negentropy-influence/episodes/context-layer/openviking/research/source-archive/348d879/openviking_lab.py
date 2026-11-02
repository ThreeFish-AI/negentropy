#!/usr/bin/env python3
"""OpenViking · 最小原型实验室（guided-learn Phase 3）。

验证的是「目录级分层 + 目录递归检索 + 推车预算 + 新鲜度冒泡 + 会话两阶段提交」机制是否自洽，
不验证模型聪不聪明：
- 材料里的三个 LLM 角色全部用确定性替身：编目员（摘要取首句、导览拼接子项）、专家（rerank =
  查询二元组覆盖率，识别「已废弃」降权）、记忆提炼（正则规则；重试时措辞按 attempt 漂移，模拟
  LLM 非确定性）。
- 向量用「汉字二元组哈希到 DIMS 维 + 余弦」替身：维度刻意小 ⇒ 哈希碰撞 ⇒ 便宜但模糊。
- token 估算：汉字 1.5/字、其余 0.25/字（同上游 token_estimation 的量级口径）。
- clean-room 自写：上游 AGPL-3.0，本文件不含上游代码；常量取自钉点代码实值，玩具域缩放处单独注明。
- 无随机数、无网络、纯标准库；存储是内存字典，不写盘。

信源：volcengine/OpenViking@14a7b81（2026-09-23）。

运行：
  uv run --no-project python docs/research/cognitive-context/assets/openviking_lab.py --selftest
  uv run --no-project python docs/research/cognitive-context/assets/openviking_lab.py --break B1   # B1..B6
"""

from __future__ import annotations

import argparse
import hashlib
import heapq
import math
import re
import sys
import zlib

ABSTRACT_MAX, OVERVIEW_MAX = 256, 4000  # L0/L1 字符软上限（parser_config.py:715/718）
SAMPLE_LIMIT, REFRESH_RATIO = 32, 0.10  # 大目录采样上限 / 父级刷新比例（parser_config.py:709/712）
GLOBAL_TOPK, BATCH, CONV_ROUNDS = 10, 4, 3  # hierarchical_retriever.py:58/59/56
THRESHOLD, ALPHA = 0.1, 1.0  # rerank_config.py:46（严格 >）；retrieval_config.py:19
PREFETCH_TOPN = 5  # 记忆提炼预取相似旧卡（memory_config.py）
BUDGET_TOKENS = 120  # 推车预算；上游默认 1600（params.py:32），玩具文档短故按比例缩小
DIMS = 64  # 替身向量维度

# 破坏开关：--break Bn 只翻其中一个，每个开关在代码里只影响一两行
BREAK = {k: False for k in ("B1", "B2", "B3", "B4", "B5", "B6")}
SCOPES = ("resources", "user", "agent")
SENT_END = "。；！？"


# ── U1 寻址：URI 结构推导类型、确定性记录 ID ───────────────────────────────────
def parse(uri: str) -> list[str]:
    if not uri.startswith("viking://"):
        raise ValueError(f"not a viking uri: {uri}")
    parts = [p for p in uri[len("viking://") :].split("/") if p]
    if parts and parts[0] not in SCOPES:
        raise ValueError(f"unknown scope: {parts[0]}")
    return parts


def context_type(uri: str) -> str:
    p = parse(uri)
    if p[:1] == ["user"] and len(p) >= 3 and p[2] == "memories":
        return "memory"
    if p[:2] == ["agent", "skills"] or (p[:1] == ["user"] and len(p) >= 3 and p[2] == "skills"):
        return "skill"
    return "resource"  # 按结构不按关键字：viking://resources/memories/x 仍是 resource


def record_id(account: str, uri: str, level: int) -> str:
    seed = uri + ("/.abstract.md", "/.overview.md", "")[level]
    return hashlib.md5(f"{account}:{seed}".encode()).hexdigest()


def parent(uri: str) -> str:
    return uri.rsplit("/", 1)[0]


def depth(uri: str) -> int:
    return len(parse(uri))


# ── 替身：向量、专家、token ─────────────────────────────────────────────────
def grams(text: str) -> list[str]:
    t = re.sub(r"[\s，。；：、！？（）()《》“”\"'.,:;#\-]+", "", text.lower())
    return [t[i : i + 2] for i in range(len(t) - 1)]


def embed(text: str) -> list[float]:
    v = [0.0] * DIMS
    for g in grams(text):
        v[zlib.crc32(g.encode()) % DIMS] += 1.0
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def cos(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


STOP = set(grams("是什么怎么要注意的了吗呢哪些如何"))


def expert(query: str, text: str) -> float:
    """rerank 替身：查询二元组被覆盖的比例；读得懂「已废弃」（精判能力，向量没有）。"""
    q = set(grams(query)) - STOP
    if not q or not text:
        return 0.0
    s = len(q & set(grams(text))) / len(q)
    if "已废弃" in text and "废弃" not in query:
        s *= 0.3
    return round(s, 4)


def est_tokens(text: str) -> int:
    return math.ceil(sum(1.5 if "一" <= ch <= "鿿" else 0.25 for ch in text))


def first_sentence(text: str) -> str:
    m = re.search(f"[{SENT_END}]", text)
    return text[: m.end()] if m else text


def cut(text: str, limit: int) -> str:
    """软上限：截到上限内最后一个句末；首句本身超长则整句保留（semantic_processor 同语义）。"""
    if len(text) <= limit:
        return text
    ends = [i + 1 for i, ch in enumerate(text[:limit]) if ch in SENT_END]
    return text[: ends[-1]] if ends else first_sentence(text)


# ── 存储 + U3 编目员（自底向上）+ 新鲜度冒泡 ─────────────────────────────────
class Viking:
    def __init__(self, account: str = "acme") -> None:
        self.account = account
        self.files: dict[str, str] = {}
        self.side: dict[str, dict] = {}  # 目录 → {L0, L1, total, pending}
        self.index: dict[str, dict] = {}  # 记录 id → {uri, level, vec, abstract}
        self.log: list[str] = []
        self.llm_calls = 0

    def dirs(self) -> set[str]:
        out = set()
        for f in self.files:
            d = parent(f)
            while d.startswith("viking://") and d != "viking://":
                out.add(d)
                d = parent(d)
        return out

    def children(self, d: str) -> list[str]:
        kids = {f for f in self.files if parent(f) == d} | {x for x in self.dirs() if parent(x) == d}
        return sorted(kids)

    def _index(self, uri: str, level: int, body: str, abstract: str) -> None:
        self.index[record_id(self.account, uri, level)] = dict(uri=uri, level=level, vec=embed(body), abstract=abstract)

    def put(self, uri: str, body: str) -> None:
        self.files[uri] = body
        self.llm_calls += 1  # 文件摘要：每个文件 1 次 LLM
        self._index(uri, 2, body, first_sentence(body))

    def summarize_dir(self, d: str) -> bool:
        """写 L1（1 次 LLM）并从 L1 首段裁出 L0（0 次 LLM）；返回 L0 是否变化。"""
        kids = self.children(d)
        n = len(kids)
        sample = kids if n <= SAMPLE_LIMIT else [kids[(i * (n - 1)) // (SAMPLE_LIMIT - 1)] for i in range(SAMPLE_LIMIT)]
        entries = [first_sentence(self.files[k]) if k in self.files else self.side.get(k, {}).get("L0", "") for k in sample]
        brief = "；".join(e.rstrip(SENT_END) for e in entries if e) + "。"
        l1 = cut(f"# {d.rsplit('/', 1)[-1]}\n{brief}\n## 导航\n" + "\n".join(f"### {k.rsplit('/', 1)[-1]}" for k in sample), OVERVIEW_MAX)
        l0 = cut(brief, ABSTRACT_MAX)  # L0 = L1 里 H1 之后、第一个 ## 之前那一段
        old = self.side.get(d, {}).get("L0")
        self.side[d] = dict(L0=l0, L1=l1, total=n, pending=0)
        self.llm_calls += 1
        if BREAK["B1"] and d.endswith("/policies/refund"):  # B1：该书架的标签与导览没写出来
            del self.side[d]
            return True
        self._index(d, 0, l0, l0)
        self._index(d, 1, l1, l1)
        return old != l0

    def ingest(self) -> None:
        for d in sorted(self.dirs(), key=depth, reverse=True):  # 最深的书架先编
            self.summarize_dir(d)

    def update(self, uri: str, body: str) -> None:
        """增量：文件变 → 所在目录重编 → L0 变了才上报父级（≤32 立即刷，否则攒到 10%）。"""
        self.put(uri, body)
        d = parent(uri)
        changed = self.summarize_dir(d)
        while changed and depth(d) > 1 and not BREAK["B4"]:  # B4：关掉冒泡
            p = parent(d)
            s = self.side.setdefault(p, dict(L0="", L1="", total=len(self.children(p)), pending=0))
            s["total"] = len(self.children(p))
            if s["total"] <= SAMPLE_LIMIT:
                self.log.append(f"REFRESH_NOW  {p}  (total={s['total']} ≤ {SAMPLE_LIMIT})")
            else:
                s["pending"] += 1
                ratio = s["pending"] / s["total"]
                if ratio < REFRESH_RATIO:
                    self.log.append(f"MARK_PENDING {p}  ({s['pending']}/{s['total']}={ratio:.3f})")
                    return
                self.log.append(f"REFRESH_NOW  {p}  ({s['pending']}/{s['total']}={ratio:.3f} ≥ {REFRESH_RATIO})")
            changed, d = self.summarize_dir(p), p


# ── U4 检索：find 平铺（默认档）/ search 目录递归（需 rerank）──────────────────
def find(vk: Viking, q: str, limit: int = 3, levels=(2,)) -> tuple[list[tuple[float, str]], int]:
    qv = embed(q)
    hits = sorted(((cos(qv, r["vec"]), r["uri"]) for r in vk.index.values() if r["level"] in levels), reverse=True)
    best: dict[str, float] = {}
    for s, u in hits[: max(limit, GLOBAL_TOPK)]:
        best[u] = max(best.get(u, 0.0), s)
    return sorted(((s, u) for u, s in best.items()), reverse=True)[:limit], 0


def search(vk: Viking, q: str, limit: int = 3, rerank: bool = True) -> tuple[list[tuple[float, str]], dict]:
    if not rerank:  # 没配 rerank ⇒ 退化为平铺（开箱部署即如此）
        res, _ = find(vk, q, limit)
        return res, dict(mode="QUICK", expanded=0, rerank_calls=0, tokens=0)
    qv, stats = embed(q), dict(mode="THINKING", expanded=0, rerank_calls=1, tokens=0)
    recs = list(vk.index.values())
    dir_hits = sorted((r for r in recs if r["level"] in (0, 1)), key=lambda r: -cos(qv, r["vec"]))[: max(limit, GLOBAL_TOPK)]
    starts: dict[str, float] = {}
    for r in dir_hits:  # 同一目录 L0/L1 两条记录去重：按向量名次首次出现者胜
        stats["tokens"] += est_tokens(r["abstract"])
        starts.setdefault(r["uri"], expert(q, r["abstract"]))
    starts.setdefault("viking://resources", 0.0)  # 默认根以 0 分补进
    heap = [(-s, u) for u, s in starts.items()]  # 起点入堆不过阈
    heapq.heapify(heap)
    pool: dict[str, float] = {}
    seen: set[str] = set()
    alpha = 0.0 if BREAK["B5"] else ALPHA  # B5：父分完全遗传
    rounds = 1 if BREAK["B2"] else CONV_ROUNDS  # B2：收敛刹车一轮就停
    prev_top, prev_size, same, stall = None, -1, 0, 0
    while heap:
        batch = []
        while heap and len(batch) < BATCH:
            s, u = heapq.heappop(heap)
            if u not in seen:
                seen.add(u)
                batch.append((-s, u))
        for p_score, d in batch:
            stats["expanded"] += 1
            stats["rerank_calls"] += 1
            kids = [r for r in recs if r["uri"] == d or parent(r["uri"]) == d]
            kids = sorted(kids, key=lambda r: -cos(qv, r["vec"]))[: max(2 * limit, 20)]  # 向量预选
            for r in kids:
                stats["tokens"] += est_tokens(r["abstract"])
                s = expert(q, r["abstract"])
                f = alpha * s + (1 - alpha) * p_score if p_score else s
                if not f > THRESHOLD:  # 唯一剪枝
                    continue
                if r["level"] == 2:
                    pool[r["uri"]] = max(pool.get(r["uri"], 0.0), f)
                elif r["uri"] not in seen and r["uri"] != d:
                    heapq.heappush(heap, (-f, r["uri"]))
        top = tuple(sorted(pool, key=lambda u: -pool[u])[:limit])
        if top == prev_top and len(top) >= limit:
            same += 1
            if same >= rounds:
                break
        elif len(pool) == prev_size:
            stall += 1
            if stall >= rounds:
                break
        else:
            same = stall = 0
        prev_top, prev_size = top, len(pool)
    return sorted(((s, u) for u, s in pool.items()), reverse=True)[:limit], stats


# ── U6 借阅推车：先广后深、装不下降档不截断 ────────────────────────────────────
def assemble(vk: Viking, hits: list[tuple[float, str]], budget: int = BUDGET_TOKENS) -> list[tuple[str, str, int]]:
    tiers = {u: [("uri", 1), ("abstract", est_tokens(first_sentence(vk.files[u]))), ("full", est_tokens(vk.files[u]))] for _, u in hits}
    cap, used, plan = max(1, budget // max(1, len(hits)) * 2), 0, {}
    for _, u in hits:  # 下限轮：起点 abstract，放不下就降到 uri
        name, cost = next((t for t in tiers[u][1::-1] if t[1] <= cap and used + t[1] <= budget), tiers[u][0])
        plan[u], used = (name, cost), used + cost
    for _, u in hits:  # 加深轮：按分数顺序升到 full
        full = tiers[u][2][1]
        if used - plan[u][1] + full <= budget:
            used += full - plan[u][1]
            plan[u] = ("full", full)
    return [(u, *plan[u]) for _, u in hits]


# ── U5 会话两阶段提交 + 身份去重 + 提交点 ─────────────────────────────────────
TOPICS = {"咖啡": ("咖啡", "美式", "拿铁"), "饮品": ("饮品", "茶")}


def extract(msgs: list[str], date: str, attempt: int) -> list[dict]:
    """记忆提炼替身。真实 LLM 重跑时措辞会变：事件名按 attempt 漂移，以此模拟非确定性。"""
    out = []
    for m in msgs:
        if pm := re.search(r"我(?:现在)?(?:喜欢|改喝|改成|的\S{0,4}偏好是)(.+?)(?:[，。]|$)", m):
            topic = next(t for t, ws in TOPICS.items() if any(w in m for w in ws))
            out.append(dict(type="preferences", key=topic, content=pm.group(1).rstrip("，。的了")))
        if em := re.search(r"今天(.+?)(?:[，。]|$)", m):
            out.append(dict(type="events", key=(em.group(1), f"{em.group(1)}（复述）")[attempt % 2], content=em.group(1)))
    return out


class Session:
    def __init__(self, vk: Viking, user: str) -> None:
        self.vk, self.user, self.archives, self.queue = vk, user, {}, []

    def commit(self, sid: str, msgs: list[str], date: str) -> None:  # 第一阶段：同步归档 + 入队
        self.archives[sid] = dict(messages=list(msgs), date=date, done=False, attempts=0)
        self.queue.append(sid)

    def uri_for(self, c: dict, sid: str) -> str:
        base = f"viking://user/{self.user}/memories"
        name = f"{c['key']}_{sid}" if BREAK["B3"] else c["key"]  # B3：身份不再由字段决定
        return f"{base}/preferences/{self.user}/{name}.md" if c["type"] == "preferences" else f"{base}/events/{self_date(c)}/{name}.md"

    def process(self, sid: str) -> dict:  # 第二阶段：异步提炼（可被重投）
        a = self.archives[sid]
        if a["done"] and not BREAK["B6"]:  # 「已整理」章在：幂等跳过
            return dict(skipped=True)
        prefetch, _ = find(self.vk, " ".join(a["messages"]), PREFETCH_TOPN, levels=(2,))
        diff = dict(adds=[], updates=[])
        self.vk.llm_calls += 1
        for c in extract(a["messages"], a["date"], a["attempts"]):
            c["date"] = a["date"]
            u = self.uri_for(c, sid)
            if u in self.vk.files:
                diff["updates"].append(dict(uri=u, before=self.vk.files[u], after=c["content"]))
            else:
                diff["adds"].append(u)
            self.vk.put(u, c["content"])
        a["attempts"] += 1
        a["diff"], a["done"] = diff, True  # memory_diff 只记不撤；.done 最后写
        return dict(skipped=False, prefetch=[x[1] for x in prefetch], **diff)


def self_date(c: dict) -> str:
    return c["date"].replace("-", "/")


# ── 玩具图书馆 ───────────────────────────────────────────────────────────────
def build() -> Viking:
    vk, R = Viking(), "viking://resources"
    docs = {
        "handbook/laptop.md": "新员工领取笔记本电脑要先在 IT 服务台登记工号。领取后当天完成磁盘加密。",
        "handbook/vpn.md": "远程办公必须连接公司 VPN。VPN 客户端在内网门户下载。",
        "policies/refund/refund-flow.md": "现行客户退款审批流程：客服在工单系统发起退款审批，财务三个工作日内原路退回。审批通过后系统自动通知客户。",
        "policies/refund/refund-fail.md": "退款失败最常见的原因是银行卡已注销或支付渠道超时，需改为线下打款。线下打款走对公转账。",
        "policies/expense/travel.md": "差旅报销需在出差结束后十五天内提交，附酒店与交通发票。",
        "engineering/oncall/handover.md": "值班交接在每周一上午十点进行，交接清单放在值班手册。",
        "engineering/database/backup.md": "数据库每天凌晨两点全量备份，备份保留三十天。",
        "engineering/database/postgres/upgrade.md": "PostgreSQL 大版本升级要先在预发环境演练 pg_upgrade，并确认扩展兼容。",
    }
    for i in range(1, 13):  # 已废弃的旧流程：措辞与现行流程高度重合
        docs[f"archive/legacy-refund/v{i:02d}.md"] = f"旧版客户退款审批流程第{i}版（已废弃）：客户退款由客服审批流程后交财务退款审批。"
    for i in range(1, 13):  # 已废弃的值班告警巡检：一 Shelf 一册，挤占全局起点名额
        docs[f"ops-alarms/h{i:02d}/check.md"] = "历史值班告警渠道巡检：短信通道检查记录归档。已废弃。"
    for i in range(1, 41):  # 宽分区：40 个客户书架，演示 10% 刷新比例
        docs[f"customers/c{i:02d}/profile.md"] = f"客户 c{i:02d} 的合同在第{i % 12 + 1}月续约。"
    for rel, body in docs.items():
        vk.put(f"{R}/{rel}", body)
    vk.ingest()
    return vk


QUERIES = [  # （路径类别, 问题, 标准答案）
    ("正常", "新员工怎么领取笔记本电脑", "viking://resources/handbook/laptop.md"),
    ("陷阱", "客户退款审批流程是什么", "viking://resources/policies/refund/refund-flow.md"),
    ("陷阱", "退款失败的原因", "viking://resources/policies/refund/refund-fail.md"),
    ("深层", "PostgreSQL 大版本升级要注意什么", "viking://resources/engineering/database/postgres/upgrade.md"),
]


def recall(vk: Viking, rerank: bool, queries=QUERIES) -> tuple[float, list[str], dict]:
    hit, lines, cost = 0, [], dict(expanded=0, rerank_calls=0, tokens=0)
    for kind, q, gold in queries:
        res, st = search(vk, q, 3, rerank=rerank)
        ok = gold in [u for _, u in res]
        hit += ok
        for k in cost:
            cost[k] += st[k]
        lines.append(f"  [{kind}] {'✔' if ok else '✘'} {q} → {[u.rsplit('/', 2)[-2] + '/' + u.rsplit('/', 1)[-1] for _, u in res]}")
    return hit / len(queries), lines, cost


# ── selftest 与破坏实验 ──────────────────────────────────────────────────────
def scenario_memory(vk: Viking) -> tuple[Session, list[dict]]:
    s = Session(vk, "alice")
    s.commit("s1", ["我喜欢喝美式咖啡。", "今天上线了支付服务 v2。"], "2026-09-01")
    s.commit("s2", ["我现在改喝拿铁了，不喝美式。"], "2026-09-08")
    s.commit("s3", ["我的咖啡偏好是拿铁。"], "2026-09-15")
    return s, [s.process(sid) for sid in list(s.queue)]


def mem_cards(vk: Viking, kind: str) -> dict[str, str]:
    return {u: b for u, b in vk.files.items() if f"/memories/{kind}/" in u}


def selftest() -> None:
    print("── S1 寻址：类型由 URI 结构推导")
    assert context_type("viking://user/alice/memories/profile.md") == "memory"
    assert context_type("viking://agent/skills/pdf/SKILL.md") == "skill"
    assert context_type("viking://resources/memories/x.md") == "resource"
    assert record_id("acme", "viking://resources/a", 0) != record_id("acme", "viking://resources/a", 1)
    try:
        parse("viking://secret/x")
        raise AssertionError("未知 scope 应被拒")
    except ValueError:
        pass
    print("  ✔ memory/skill/resource 推导正确；L0/L1 记录 ID 不撞；未知 scope 被拒")

    vk = build()
    print(f"── S2 编目：{len(vk.files)} 本书、{len(vk.side)} 个书架，LLM 调用 {vk.llm_calls} 次（文件 1 次 + 目录 1 次，L0 零次）")
    for d, s in vk.side.items():
        assert len(s["L0"]) <= ABSTRACT_MAX and len(s["L1"]) <= OVERVIEW_MAX and s["L0"].rstrip("。") in s["L1"]
    assert not any(d in vk.files for d in vk.side), "文件不应有 sidecar"
    print(f"  ✔ 每个书架 L0≤{ABSTRACT_MAX}、L1≤{OVERVIEW_MAX}，L0 是 L1 首段；样例 L0：{vk.side['viking://resources/policies/refund']['L0']}")

    print("── S3 检索：默认档（无 rerank = 平铺）vs 豪华档（search + rerank = 目录递归）")
    r_q, lq, _ = recall(vk, rerank=False)
    r_t, lt, ct = recall(vk, rerank=True)
    print(f"  QUICK   recall@3 = {r_q:.2f}", *lq, sep="\n")
    print(f"  THINKING recall@3 = {r_t:.2f}  （展开 {ct['expanded']} 个书架、专家 {ct['rerank_calls']} 次、读 {ct['tokens']} token）", *lt, sep="\n")
    assert r_t > r_q and r_t == 1.0

    print("── S4 借阅推车：先每样一份薄的，再按分数换厚的")
    hits, _ = search(vk, "退款失败的原因", 3)
    plan = assemble(vk, hits)
    for u, tier, tok in plan:
        print(f"  {tier:8s} {tok:3d} tok  {u.rsplit('/', 1)[-1]}")
    assert sum(t for *_, t in plan) <= BUDGET_TOKENS and plan[0][1] == "full"

    print("── S5 新鲜度冒泡：标签变了才上报；宽分区攒够一成才重印")
    vk.update("viking://resources/engineering/oncall/feishu.md", "值班告警改用飞书机器人推送，不再用短信。")
    for i in (1, 2, 3, 4):
        vk.update(f"viking://resources/customers/c{i:02d}/profile.md", f"客户 c{i:02d} 已提前续约并升级到旗舰版。")
    print(*("  " + x for x in vk.log), sep="\n")
    assert [x.split()[0] for x in vk.log if "customers " in x + " "][:4] == ["MARK_PENDING"] * 3 + ["REFRESH_NOW"]
    res, _ = search(vk, "值班告警改用飞书", 3)
    assert "viking://resources/engineering/oncall/feishu.md" in [u for _, u in res]
    print("  ✔ 新书上架后能被逐架巡查找到")

    print("── S6 会话两阶段提交：同一主题永远是同一张卡")
    calls0 = vk.llm_calls
    s, outs = scenario_memory(vk)
    prefs, events = mem_cards(vk, "preferences"), mem_cards(vk, "events")
    print(f"  偏好卡 {len(prefs)} 张：{prefs}；事件卡 {len(events)} 张；memory_diff[s2].updates = {outs[1]['updates']}")
    assert len(prefs) == 1 and "拿铁" in next(iter(prefs.values())) and len(events) == 1

    print("── S7 提交点：队列重投同一条消息（至少一次投递）")
    again = s.process("s1")
    print(f"  重投 s1 → {again}；LLM 调用 {vk.llm_calls - calls0} 次不变；事件卡仍 {len(mem_cards(vk, 'events'))} 张")
    assert again == dict(skipped=True) and len(mem_cards(vk, "events")) == 1
    print("SELFTEST PASSED ✔")


def breakage(key: str) -> None:
    BREAK[key] = True
    vk = build()
    print(f"== {key} 实测 ==")
    if key in ("B1", "B5"):
        r_q, _, _ = recall(vk, rerank=False)
        r_t, lt, ct = recall(vk, rerank=True)
        print(f"QUICK recall@3={r_q:.2f}；THINKING recall@3={r_t:.2f}（展开 {ct['expanded']}、读 {ct['tokens']} token）", *lt, sep="\n")
    if key == "B2":
        r_t, lt, ct = recall(vk, rerank=True)
        BREAK[key] = False
        _, _, cn = recall(build(), rerank=True)
        print(f"THINKING recall@3={r_t:.2f}（展开 {ct['expanded']} 个书架 vs 正常 {cn['expanded']}）", *lt, sep="\n")
        print("教训：玩具域里全局起点能直达深层书架，收敛刹车收紧到 1 轮只省成本、不伤召回；只有当首批全部空手（香味弱、须多跳路由）时，1 轮刹车才会把还没轮到的书架拦在门外。")
    if key == "B4":
        vk.update("viking://resources/engineering/oncall/feishu.md", "值班告警改用飞书机器人推送，不再用短信。")
        res, _ = search(vk, "值班告警改用飞书", 3)
        print(f"oncall 书架自身 L0（本层直接重编，仍是新的）：{'飞书' in vk.side['viking://resources/engineering/oncall']['L0']}")
        print(f"祖先书架 engineering / resources 的 L0 含「飞书」：{'飞书' in vk.side['viking://resources/engineering']['L0']} / {'飞书' in vk.side['viking://resources']['L0']}")
        print(f"从 viking://resources 逐层浏览（读 L0）看到的顶层标签：{vk.side['viking://resources']['L0'][:80]}…")
        print(f"THINKING 全局检索兜底仍在（oncall 自己的 L0 可直达）：{[u.rsplit('/', 1)[-1] for _, u in res]}")
        print("教训：冒泡喂的是「祖先标签」——直接检索有起点直达兜底，但靠 ls/abstract 逐层浏览的 Agent 会拿到过期地图，看不到这个分区里发生了什么。")
    if key in ("B3", "B6"):
        s, _ = scenario_memory(vk)
        if key == "B6":
            s.process("s1")
        prefs, events = mem_cards(vk, "preferences"), mem_cards(vk, "events")
        print(f"偏好卡 {len(prefs)} 张：{list(prefs.values())}")
        print(f"事件卡 {len(events)} 张：{[u.rsplit('/', 1)[-1] for u in events]}；LLM 调用累计 {vk.llm_calls}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--selftest", action="store_true")
    g.add_argument("--break", dest="brk", choices=sorted(BREAK))
    a = ap.parse_args()
    selftest() if a.selftest else breakage(a.brk)
    return 0


if __name__ == "__main__":
    sys.exit(main())
