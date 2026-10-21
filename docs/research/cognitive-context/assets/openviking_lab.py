#!/usr/bin/env python3
"""OpenViking · 最小原型实验室 v2（guided-learn Phase 3 · 换代重写版）。

验证的是「目录级分层 + 全局召回单遍精排 + 六域配额装配 + 新鲜度冒泡 + 会话两阶段提交 +
User/Peer 归属」机制是否自洽，不验证模型聪不聪明：
- 材料里的 LLM 角色全部用确定性替身：编目员（摘要取首句、导览拼接子项）、精排（rerank =
  查询二元组覆盖率，识别「已废弃」降权）、记忆提炼（正则规则；重试时措辞按 attempt 漂移，
  模拟 LLM 非确定性）。
- 向量用「汉字二元组哈希到 DIMS 维 + 余弦」替身：维度刻意小 ⇒ 哈希碰撞 ⇒ 便宜但模糊。
- token 估算：汉字 1.5/字、其余 0.25/字（同上游 token_estimation 的量级口径）。
- clean-room 自写：上游 AGPL-3.0，本文件不含上游代码；常量取自钉点代码实值，玩具域缩放处单独注明。
- 无随机数、无网络、纯标准库；存储是内存字典，不写盘。

与 v1（钉点 14a7b81）的差异：检索相按上游 #5450 重写——目录递归/父分传播/收敛刹车已在上游删除，
本版实现「一次全局召回（精排可用时池 = 2×limit）→ URI 去重 → 单遍精排（读 abstract）→ 阈值后置」；
装配改为 context 模式六域配额（用不满的名额由其他类别补足，v0.5.0 语义）；
新增 User/Peer 归属场景；破坏实验 B2（收敛刹车）与 B5（α 父分）随机制删除退役，
新增 B7（候选池 2×→1×）与 B1 重铸（拔 abstract → 精排致盲）。

信源：volcengine/OpenViking@6227af51（2026-10-21，v0.5.1.1）。

运行：
  uv run --no-project python docs/research/cognitive-context/assets/openviking_lab.py --selftest
  uv run --no-project python docs/research/cognitive-context/assets/openviking_lab.py --break B1   # B1,B3,B4,B6,B7
"""

from __future__ import annotations

import argparse
import hashlib
import math
import re
import sys
import zlib

ABSTRACT_MAX, OVERVIEW_MAX = 256, 4000  # L0/L1 字符软上限（parser_config.py:715/718）
SAMPLE_LIMIT, REFRESH_RATIO = 32, 0.10  # 大目录采样上限 / 父级刷新比例（parser_config.py:709）
POOL_MULT = 2  # 精排候选池 = limit × 2（hierarchical_retriever.py:72/209，仅精排可用时扩池）
THRESHOLD = 0.1  # rerank 阈值（rerank_config.py:46，严格 >；精排之后才应用）
QUOTA_CHAT = {"events": 3, "entities": 3, "preferences": 1, "experiences": 1, "resources": 1, "skills": 1}  # context 模式 chat 预设
PEER_PENALTY = {"events": 0.1, "entities": 0.1}  # 跨 peer 检索降权（其余类别 0.02；ovcli peer_scope）
PREFETCH_TOPN = 5  # 记忆提炼预取相似旧卡（memory_config.py）
BUDGET_TOKENS = 120  # context 装配预算；上游默认 1600（params.py:34），玩具文档短故按比例缩小
DIMS = 64  # 替身向量维度

# 破坏开关：--break Bn 只翻其中一个，每个开关在代码里只影响一两行
BREAK = {k: False for k in ("B1", "B3", "B4", "B6", "B7")}
SCOPES = ("resources", "user", "agent")
SENT_END = "。；！？"


# ── U1 寻址：URI 结构推导类型/归属、确定性记录 ID ─────────────────────────────
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
    if p[:1] == ["user"] and len(p) >= 5 and p[2] == "peers" and p[4] == "memories":  # peer 记忆子树
        return "memory"
    if p[:2] == ["agent", "skills"] or (p[:1] == ["user"] and len(p) >= 3 and p[2] == "skills") or (
        p[:1] == ["user"] and len(p) >= 5 and p[2] == "peers" and p[4] == "skills"
    ):
        return "skill"
    return "resource"  # 按结构不按关键字：viking://resources/memories/x 仍是 resource


def owner_and_peer(uri: str) -> tuple[str, str]:
    """归属拆分：数据属主（user）与交互对象（peer；无 peer 返回空串）。"""
    p = parse(uri)
    if p[:1] == ["user"] and len(p) >= 3:
        if len(p) >= 5 and p[2] == "peers":
            return p[1], p[3]
        return p[1], ""
    return "", ""


def record_id(account: str, uri: str, level: int) -> str:
    seed = uri + ("/.abstract.md", "/.overview.md", "")[level]
    return hashlib.md5(f"{account}:{seed}".encode()).hexdigest()


def parent(uri: str) -> str:
    return uri.rsplit("/", 1)[0]


def depth(uri: str) -> int:
    return len(parse(uri))


# ── 替身：向量、精排、token ─────────────────────────────────────────────────
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
    """精排替身：查询二元组被候选摘要覆盖的比例；读得懂「已废弃」（精判能力，向量没有）。"""
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
        self._index(d, 0, l0, l0)
        self._index(d, 1, l1, l1)
        return old != l0

    def ingest(self) -> None:
        for d in sorted(self.dirs(), key=depth, reverse=True):  # 最深的目录先编
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


# ── U4 检索：一次全局召回 → URI 去重 → 可选单遍精排 → 阈值后置 ────────────────
def find(vk: Viking, q: str, limit: int = 3, levels=(2,), keep=None) -> tuple[list[tuple[float, str]], dict]:
    """QUICK：纯平铺向量召回（find 恒 QUICK；无精排时 search 也走这里）。"""
    qv = embed(q)
    hits = sorted(((cos(qv, r["vec"]), r["uri"]) for r in vk.index.values() if r["level"] in levels and (not keep or keep(r))), reverse=True)
    best: dict[str, float] = {}
    for s, u in hits[:limit]:
        best[u] = max(best.get(u, 0.0), s)
    return sorted(((s, u) for u, s in best.items()), reverse=True)[:limit], dict(mode="QUICK", pool=len(best), rerank_calls=0, tokens=0)


def search(vk: Viking, q: str, limit: int = 3, rerank: bool = True, keep=None, actor_peer: str | None = None) -> tuple[list[tuple[float, str]], dict]:
    """现行两档：无精排 = 平铺；有精排 = 全局召回 2×limit → URI 去重保最高向量分 →
    单遍精排（读 abstract）→ 分数门槛在精排之后应用 → 截取 limit。"""
    if not rerank:  # 没配精排 ⇒ 退化为平铺（开箱部署即如此：mode=None → QUICK）
        return find(vk, q, limit, keep=keep)
    mult = 1 if BREAK["B7"] else POOL_MULT  # B7：候选池 2× → 1×
    qv = embed(q)
    recs = [r for r in vk.index.values() if (not keep or keep(r))]
    hits = sorted(recs, key=lambda r: -cos(qv, r["vec"]))[: limit * mult]
    pool: dict[str, dict] = {}  # URI 去重：同 URI 多层记录保向量分最高者
    for r in hits:
        if r["uri"] not in pool:
            pool[r["uri"]] = r
    stats = dict(mode="THINKING", pool=len(pool), rerank_calls=1, tokens=0)
    scored = []
    for u, r in pool.items():
        abstract = r["abstract"]
        if BREAK["B1"] and "/policies/refund" in u:  # B1：该子树的摘要没写出来 → 精排读不到
            abstract = ""
        stats["tokens"] += est_tokens(abstract)
        s = expert(q, abstract)
        if actor_peer is not None:  # 读宽：非当前 peer 的结果按类别降权（写窄读宽）
            _, p = owner_and_peer(u)
            if p and p != actor_peer:
                s *= PEER_PENALTY.get(context_type(u), 0.02)
        scored.append((round(s, 4), u))
    scored = [(s, u) for s, u in scored if s > THRESHOLD]  # 阈值后置：向量分低的可能被精排救回
    scored.sort(reverse=True)
    return scored[:limit], stats


# ── U8 context 装配：六域配额 + 先薄后厚、降档不截断 + 空位补足 ───────────────
def assemble_context(vk: Viking, per_domain: dict[str, list[tuple[float, str]]], budget: int = BUDGET_TOKENS) -> list[tuple[str, str, str, int]]:
    """per_domain：意图分析产出的各域命中。配额先作上限，用不满的名额由其他域最佳结果补足（v0.5.0）。"""
    picked: list[tuple[float, str]] = []
    taken: set[str] = set()
    for dom, quota in QUOTA_CHAT.items():
        fresh = [(s, u) for s, u in per_domain.get(dom, []) if u not in taken]
        for s, u in sorted(fresh, reverse=True)[:quota]:
            picked.append((s, u))
            taken.add(u)
    rest = sorted(((s, u) for dom, hits in per_domain.items() for s, u in hits if u not in taken), reverse=True)
    picked += rest[: sum(QUOTA_CHAT.values()) - len(picked)]  # 空位补足
    tiers = {u: [("uri", 1), ("abstract", est_tokens(first_sentence(vk.files.get(u, "")) or vk.side.get(u, {}).get("L0", ""))), ("full", est_tokens(vk.files.get(u, "") or vk.side.get(u, {}).get("L1", "")))] for _, u in picked}  # 目录记录无 L2 正文，full 档回落 L1
    cap, used, plan = max(1, budget // max(1, len(picked)) * 2), 0, {}
    for _, u in picked:  # 下限轮：起点 abstract，放不下就降到 uri
        name, cost = next((t for t in tiers[u][1::-1] if t[1] <= cap and used + t[1] <= budget), tiers[u][0])
        plan[u], used = (name, cost), used + cost
    for s, u in sorted(picked, reverse=True):  # 加深轮：按分数顺序升到 full
        full = tiers[u][2][1]
        if used - plan[u][1] + full <= budget:
            used += full - plan[u][1]
            plan[u] = ("full", full)
    return [(dom_of(u), u, *plan[u]) for _, u in sorted(picked, reverse=True)]


def dom_of(uri: str) -> str:
    t = context_type(uri)
    if t != "memory":
        return t
    p = parse(uri)
    seg = p[5] if p[2:3] == ["peers"] else (p[3] if len(p) > 3 else "")
    return {"preferences": "preferences", "events": "events", "entities": "entities"}.get(seg, "experiences")


# ── U5 会话两阶段提交 + 身份去重 + 提交点 + peer 归属 ─────────────────────────
TOPICS = {"咖啡": ("咖啡", "美式", "拿铁"), "饮品": ("饮品", "茶"), "花生过敏": ("花生", "过敏")}


def extract(msgs: list[str], date: str, attempt: int) -> list[dict]:
    """记忆提炼替身。真实 LLM 重跑时措辞会变：事件名按 attempt 漂移，以此模拟非确定性。"""
    out = []
    for m in msgs:
        if am := re.search(r"我对(.{1,6}?)过敏", m):  # 过敏事实：内容=过敏原（身份键=「过敏」主题）
            out.append(dict(type="preferences", key="过敏", content=f"{am.group(1)}过敏"))
        elif pm := re.search(r"我(?:现在)?(?:喜欢|改喝|改成|的\S{0,4}偏好是)(.+?)(?:[，。]|$)", m):
            topic = next(t for t, ws in TOPICS.items() if any(w in m for w in ws))
            out.append(dict(type="preferences", key=topic, content=f"{topic}偏好是{pm.group(1).rstrip('，。的了')}"))
        if em := re.search(r"今天(.+?)(?:[，。]|$)", m):
            out.append(dict(type="events", key=(em.group(1), f"{em.group(1)}（复述）")[attempt % 2], content=em.group(1)))
    return out


class Session:
    def __init__(self, vk: Viking, user: str, peer: str = "") -> None:
        self.vk, self.user, self.peer, self.archives, self.queue = vk, user, peer, {}, []

    def commit(self, sid: str, msgs: list[str], date: str) -> None:  # 第一阶段：同步归档 + 入队
        self.archives[sid] = dict(messages=list(msgs), date=date, done=False, attempts=0)
        self.queue.append(sid)

    def uri_for(self, c: dict, sid: str) -> str:
        seg = f"peers/{self.peer}/" if self.peer else ""  # 写窄：peer 交互落 peer 子树
        base = f"viking://user/{self.user}/{seg}memories"
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


# ── 玩具语料 ─────────────────────────────────────────────────────────────────
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
    for i in range(1, 4):  # 已废弃旧流程×3：措辞复读现行标题（向量按题面像；精排读得出「已废弃」）；目录 sidecar 再放大成两条记录
        docs[f"archive/v{i:02d}.md"] = f"旧版客户退款审批流程第{i}版（已废弃）：客户退款由客服审批流程后交财务退款审批。"
    for i in range(1, 13):  # 噪声语料：挤占召回池名额
        docs[f"ops-alarms/h{i:02d}/check.md"] = "历史值班告警渠道巡检：短信通道检查记录归档。已废弃。"
    for i in range(1, 41):  # 宽分区：40 个客户书架，演示 10% 刷新比例
        docs[f"customers/c{i:02d}/profile.md"] = f"客户 c{i:02d} 的合同在第{i % 12 + 1}月续约。"
    for rel, body in docs.items():
        vk.put(f"{R}/{rel}", body)
    vk.put("viking://agent/skills/refund-op/SKILL.md", "技能：工单分类处置。按失败原因归类并记录处理结果。")
    vk.ingest()
    return vk


QUERIES = [  # （路径类别, 问题, 标准答案）
    ("正常", "新员工怎么领取笔记本电脑", "viking://resources/handbook/laptop.md"),
    ("陷阱", "客户退款审批流程是什么", "viking://resources/policies/refund/refund-flow.md"),
    ("陷阱", "退款失败的原因", "viking://resources/policies/refund/refund-fail.md"),
    ("深层", "PostgreSQL 大版本升级要注意什么", "viking://resources/engineering/database/postgres/upgrade.md"),
]


def recall(vk: Viking, rerank: bool, queries=QUERIES) -> tuple[float, list[str], dict]:
    hit, lines, cost = 0, [], dict(pool=0, rerank_calls=0, tokens=0)
    for kind, q, gold in queries:
        res, st = search(vk, q, 3, rerank=rerank)
        ok = gold in [u for _, u in res] or parent(gold) in [u for _, u in res]  # 目录命中=可走到的入口
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


def scenario_peers(vk: Viking) -> dict[str, list[str]]:
    """写窄：两位终端客户的过敏事实各落各的 peer 子树。"""
    out = {}
    for peer, msg in (("customer-alice", "我对花生过敏，帮我记住。"), ("customer-bob", "我对花生过敏。")):
        s = Session(vk, "support-bot", peer=peer)
        s.commit(f"p-{peer}", [msg], "2026-10-20")
        s.process(f"p-{peer}")
        out[peer] = [u for u in vk.files if f"/peers/{peer}/" in u]
    return out


def mem_cards(vk: Viking, kind: str) -> dict[str, str]:
    return {u: b for u, b in vk.files.items() if f"/memories/{kind}/" in u}


def selftest() -> None:
    print("── S1 寻址：类型/归属由 URI 结构推导")
    assert context_type("viking://user/alice/memories/profile.md") == "memory"
    assert context_type("viking://user/support-bot/peers/customer-alice/memories/preferences/x.md") == "memory"
    assert context_type("viking://agent/skills/pdf/SKILL.md") == "skill"
    assert context_type("viking://resources/memories/x.md") == "resource"
    assert owner_and_peer("viking://user/support-bot/peers/customer-alice/memories/a.md") == ("support-bot", "customer-alice")
    assert record_id("acme", "viking://resources/a", 0) != record_id("acme", "viking://resources/a", 1)
    try:
        parse("viking://secret/x")
        raise AssertionError("未知 scope 应被拒")
    except ValueError:
        pass
    print("  ✔ memory/skill/resource 推导正确；peer 子树是一等 memory；属主与 peer 拆分正确")

    vk = build()
    print(f"── S2 编目：{len(vk.files)} 份文档、{len(vk.side)} 个目录，LLM 调用 {vk.llm_calls} 次（文件 1 次 + 目录 1 次，L0 零次）")
    for d, s in vk.side.items():
        assert len(s["L0"]) <= ABSTRACT_MAX and len(s["L1"]) <= OVERVIEW_MAX and s["L0"].rstrip("。") in s["L1"]
    assert not any(d in vk.files for d in vk.side), "文件不应有 sidecar"
    print(f"  ✔ 每个目录 L0≤{ABSTRACT_MAX}、L1≤{OVERVIEW_MAX}，L0 是 L1 首段；样例 L0：{vk.side['viking://resources/policies/refund']['L0']}")

    print("── S3 检索：无精排 = 平铺 vs 有精排 = 全局召回 2×limit + 单遍精排 + 阈值后置")
    r_q, lq, _ = recall(vk, rerank=False)
    r_t, lt, ct = recall(vk, rerank=True)
    print(f"  QUICK   recall@3 = {r_q:.2f}", *lq, sep="\n")
    print(f"  THINKING recall@3 = {r_t:.2f}  （候选池合计 {ct['pool']} 条、精排 {ct['rerank_calls']} 次/查询、读 {ct['tokens']} token）", *lt, sep="\n")
    assert r_t > r_q and r_t == 1.0

    print("── S4 新鲜度冒泡：标签变了才上报；宽分区攒够一成才重印")
    vk.update("viking://resources/engineering/oncall/feishu.md", "值班告警改用飞书机器人推送，不再用短信。")
    for i in (1, 2, 3, 4):
        vk.update(f"viking://resources/customers/c{i:02d}/profile.md", f"客户 c{i:02d} 已提前续约并升级到旗舰版。")
    print(*("  " + x for x in vk.log), sep="\n")
    assert [x.split()[0] for x in vk.log if "customers " in x + " "][:4] == ["MARK_PENDING"] * 3 + ["REFRESH_NOW"]
    res, _ = search(vk, "值班告警改用飞书", 3)
    assert "viking://resources/engineering/oncall/feishu.md" in [u for _, u in res]
    print("  ✔ 新书上架后能被全局召回直接找到")

    print("── S5 会话两阶段提交：同一主题永远是同一张卡")
    calls0 = vk.llm_calls
    s, outs = scenario_memory(vk)
    prefs, events = mem_cards(vk, "preferences"), mem_cards(vk, "events")
    print(f"  偏好卡 {len(prefs)} 张：{prefs}；事件卡 {len(events)} 张；memory_diff[s2].updates = {outs[1]['updates']}")
    assert len(prefs) == 1 and "拿铁" in next(iter(prefs.values())) and len(events) == 1

    print("── S6 提交点：队列重投同一条消息（至少一次投递）")
    again = s.process("s1")
    print(f"  重投 s1 → {again}；LLM 调用 {vk.llm_calls - calls0} 次不变；事件卡仍 {len(mem_cards(vk, 'events'))} 张")
    assert again == dict(skipped=True) and len(mem_cards(vk, "events")) == 1

    print("── S7 User/Peer：写窄（各落各的 peer 子树）读宽（跨 peer 降权 + 来源随行）")
    cards = scenario_peers(vk)
    for peer, us in cards.items():
        print(f"  {peer}：{[u.rsplit('/', 1)[-1] for u in us]}（属主 support-bot）")
    assert len(cards["customer-alice"]) == 1 and len(cards["customer-bob"]) == 1 and cards["customer-alice"] != cards["customer-bob"]
    wide, _ = search(vk, "花生过敏", 5, keep=lambda r: "/peers/" in r["uri"])
    wide_disp = [(u.split("/peers/")[1].split("/")[0], round(sc, 3)) for sc, u in wide]
    narrow, _ = search(vk, "花生过敏", 5, keep=lambda r: "/peers/" in r["uri"], actor_peer="customer-alice")
    narrow_disp = [(u.split("/peers/")[1].split("/")[0], round(sc, 3)) for sc, u in narrow]
    print(f"  读宽（peer_scope=all）：{wide_disp}")
    print(f"  actor_peer=alice：{narrow_disp}")
    assert len(wide) == 2 and narrow and all(p == "customer-alice" for p, _ in narrow_disp)
    alice_uri = cards["customer-alice"][0]
    score_in = lambda res: next(s for s, u in res if u == alice_uri)
    assert score_in(wide) == score_in(narrow), "降权不改变当前 peer 自己的分数"

    print("── S8 context 装配：六域配额先作上限，空位由其他类别补足；先薄后厚降档不截断")
    per_dom = {
        "preferences": search(vk, "咖啡偏好", 2, keep=lambda r: "/memories/" in r["uri"])[0],  # 卡正文含「咖啡偏好是…」故可召回
        "events": [],  # 本查询无事件命中：配额空位将由其他类别补足
        "resources": search(vk, "退款失败的原因", 3, keep=lambda r: r["uri"].startswith("viking://resources/"))[0],
        "skills": search(vk, "工单分类处置", 2, keep=lambda r: "/skills/" in r["uri"])[0],
    }
    plan = assemble_context(vk, per_dom)
    for dom, u, tier, tok in plan:
        print(f"  [{dom:12s}] {tier:8s} {tok:3d} tok  {u.rsplit('/', 1)[-1]}")
    assert sum(t for *_, t in plan) <= BUDGET_TOKENS
    doms = [d for d, *_ in plan]
    assert "events" not in doms and len(doms) >= 3, "空配额被补足、多类别共存"
    print("SELFTEST PASSED ✔")


def breakage(key: str) -> None:
    BREAK[key] = True
    vk = build()
    print(f"== {key} 实测 ==")
    if key in ("B1", "B7"):
        r_q, _, _ = recall(vk, rerank=False)
        r_t, lt, ct = recall(vk, rerank=True)
        print(f"QUICK recall@3={r_q:.2f}；THINKING recall@3={r_t:.2f}（池 {ct['pool']}、精排读 {ct['tokens']} token）", *lt, sep="\n")
        BREAK[key] = False
        _, _, cn = recall(build(), rerank=True)
        print(f"（正常对照：THINKING recall@3=1.00，池 {cn['pool']}、读 {cn['tokens']} token）")
    if key == "B4":
        vk.update("viking://resources/engineering/oncall/feishu.md", "值班告警改用飞书机器人推送，不再用短信。")
        res, _ = search(vk, "值班告警改用飞书", 3)
        print(f"oncall 目录自身 L0（本层直接重编，仍是新的）：{'飞书' in vk.side['viking://resources/engineering/oncall']['L0']}")
        print(f"祖先目录 engineering / resources 的 L0 含「飞书」：{'飞书' in vk.side['viking://resources/engineering']['L0']} / {'飞书' in vk.side['viking://resources']['L0']}")
        print(f"从 viking://resources 逐层浏览（读 L0）看到的顶层标签：{vk.side['viking://resources']['L0'][:80]}…")
        print(f"全局检索兜底仍在（oncall 自己的 L0 可被召回）：{[u.rsplit('/', 1)[-1] for _, u in res]}")
        print("教训：冒泡喂的是「祖先标签」——全局检索有起点直达兜底，但靠 ls/abstract 逐层浏览的 Agent 会拿到过期地图。")
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
