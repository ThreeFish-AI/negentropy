#!/usr/bin/env python3
"""PowerContext 核心机制确定性原型（纯标准库）。

对 OceanBase PowerContext（v1.4.1）五个核心契约做最小可执行模拟，供精读笔记《PowerContext
精读与通俗拆解》动手实验室引用。原型只证明机制逻辑按文档描述运作，不宣称复现材料中的评测数字。

五个机制（编号供笔记 §5 引用）：
  M1 不可变 Revision 寻址：FAMILY/ARTIFACT_ID@REVISION，替换不改 ID，精确引用读历史快照
  M2 Candidate 评审收件箱 + expected_version 乐观锁：pending 不进召回，篡改后旧决定不静默生效
  M3 PreparedContext 字节预算 + 召回充分性闸门：产出永不超 max_bytes，ready/empty 二值，两轮有界扩展
  M4 Handoff 四步循环 + hint 全有或全无：放不下整段提示即 empty，从不截断
  M5 Topic Memory 增量提炼：新 Source 增量并入主题，不整场重建

CLI：
  selftest        全部机制断言（退出码 0/1）
  demo            打印一段端到端演示日志
  break D1..D5    破坏性实验：去掉对应守卫，输出客观退化指标
  count <md>      字数门（CJK 字符 + 英文单词，剥代码围栏/图片行/URL；>5000 退出码 2）
"""

from __future__ import annotations

import argparse
import re
import sys

# ---------------------------------------------------------------- 公共小件

STRONG_MATCH = 0.70   # RFC 1560：余弦相关度强匹配阈值
HINT_DEFAULT_BYTES = 2000  # Handoff hint 默认预算（UTF-8 字节），max_bytes 1..4000


def check(cond: bool, msg: str, sink: list) -> None:
    sink.append((bool(cond), msg))


def _tokens(s: str) -> set:
    """确定性分词：英文按单词、中文逐字（模拟语义粒度，仅保序供分选）。"""
    return set(re.findall(r"[a-z]+", s.lower())) | set(re.findall(r"[一-鿿]", s))


def relevance(query: str, text: str) -> float:
    """确定性相关度：词元重合的 F1（模拟向量余弦，仅保序供分选）。"""
    q, t = _tokens(query), _tokens(text)
    if not q or not t:
        return 0.0
    inter = len(q & t)
    if inter == 0:
        return 0.0
    prec, rec = inter / len(t), inter / len(q)
    return 2 * prec * rec / (prec + rec)


def nbytes(s: str) -> int:
    return len(s.encode("utf-8"))


def cut_utf8(s: str, budget: int) -> str:
    """按 UTF-8 字节预算截断（D4 反例用；正例从不截断）。"""
    return s.encode("utf-8")[:max(0, budget)].decode("utf-8", errors="ignore")

# ---------------------------------------------------------------- M1 Revision 寻址


class ArtifactStore:
    """FAMILY -> {artifact_id: [revision...]}；每条 revision 不可变。"""

    def __init__(self):
        self._fam: dict[str, dict[str, list[dict]]] = {}

    def create(self, family: str, aid: str, content: str, lineage=()) -> str:
        revs = self._fam.setdefault(family, {}).setdefault(aid, [])
        revs.append({"revision": len(revs) + 1, "content": content, "lineage": list(lineage)})
        return self.ref(family, aid, revs[-1]["revision"])

    def replace(self, family: str, aid: str, content: str, lineage=()) -> str:
        """替换 = 追加新 Revision，Artifact ID 不变，历史不覆盖。"""
        return self.create(family, aid, content, lineage)

    @staticmethod
    def ref(family: str, aid: str, rev: int) -> str:
        return f"{family}/{aid}@{rev}"

    def resolve(self, ref: str) -> dict:
        family, rest = ref.split("/", 1)
        aid, rev = rest.rsplit("@", 1)
        return self._fam[family][aid][int(rev) - 1]

    def head(self, family: str, aid: str) -> dict:
        return self._fam[family][aid][-1]

    def history_len(self, family: str, aid: str) -> int:
        return len(self._fam[family][aid])


class MutableStore(ArtifactStore):
    """D1 反例：替换即覆盖，无历史。"""

    def replace(self, family: str, aid: str, content: str, lineage=()) -> str:
        revs = self._fam[family][aid]
        revs[-1] = {"revision": 1, "content": content, "lineage": list(lineage)}
        return self.ref(family, aid, 1)

# ---------------------------------------------------------------- M2 Candidate 评审


class ReviewInbox:
    """pending 候选 -> 评审（expected_version 乐观锁）-> 不可变 Revision 或拒绝。"""

    def __init__(self, store: ArtifactStore):
        self.store = store
        self.candidates: dict[str, dict] = {}
        self.decisions: list[dict] = []

    def submit(self, family: str, aid: str, proposal: str, lineage=()) -> str:
        cid = f"cand-{family}-{aid}-{len(self.decisions) + 1}"
        self.candidates[cid] = {"family": family, "aid": aid, "proposal": proposal,
                                "version": 1, "lineage": list(lineage), "state": "pending"}
        return cid

    def tamper(self, cid: str, new_proposal: str) -> None:
        """他方写入者改动了提案：version 前进。"""
        c = self.candidates[cid]
        c["proposal"], c["version"] = new_proposal, c["version"] + 1

    def review(self, cid: str, approve: bool, expected_version: int, reason="") -> dict:
        c = self.candidates[cid]
        if c["state"] != "pending":
            return {"ok": False, "error": "already-decided"}
        if c["version"] != expected_version:
            return {"ok": False, "error": "version-conflict",
                    "current_version": c["version"]}
        c["state"] = "approved" if approve else "rejected"
        result = None
        if approve:
            ref = self.store.create(c["family"], c["aid"], c["proposal"], c["lineage"])
            result = ref
        self.decisions.append({"cid": cid, "approve": approve, "reason": reason,
                               "result_artifact": result, "final": True})
        return {"ok": True, "result_artifact": result, "final": True}


class NoReviewPipeline:
    """D2 反例：生成结果不经评审直接入库进召回。"""

    def __init__(self, store: ArtifactStore):
        self.store = store

    def generate(self, family: str, aid: str, proposal: str, lineage=()) -> str:
        return self.store.create(family, aid, proposal, lineage)

# ---------------------------------------------------------------- M3 PreparedContext


class MemoryIndex:
    """active Memory + approved Experience；仅这两类参与普通召回。"""

    def __init__(self):
        self.entries: list[dict] = []  # {"kind","text","admission"}

    def add_active_memory(self, text: str) -> None:
        self.entries.append({"kind": "memory", "text": text, "admission": 1.0})

    def add_approved_experience(self, text: str) -> None:
        self.entries.append({"kind": "experience", "text": text, "admission": 1.0})

    def add_leaked_pending(self, text: str) -> None:
        self.entries.append({"kind": "pending-experience", "text": text, "admission": 1.0})

    def search(self, query: str, floor: float) -> list[dict]:
        scored = [{"kind": e["kind"], "text": e["text"],
                   "rel": relevance(query, e["text"])} for e in self.entries]
        return sorted((h for h in scored if h["rel"] >= floor),
                      key=lambda h: -h["rel"])


def _fit(cands: list[dict], budget: int) -> tuple[list[dict], int]:
    """按相关度装包，单条放不下整条丢弃（不截断）；返回（入选, 总字节）。"""
    picked, used = [], 0
    for h in cands:
        b = nbytes(h["text"])
        if used + b <= budget:
            picked.append(h)
            used += b
    return picked, used


def prepare_context(query: str, index: MemoryIndex, max_bytes: int,
                    gate: bool = True, truncate: bool = False) -> dict:
    """共享字节预算 + 召回充分性闸门（RFC 1560：第 0 轮探测，≤2 轮降准入扩展）。

    truncate=True 是 D4 反例：放不下时截断单条凑预算。
    """
    floor = 0.50
    rounds = 0
    while True:
        cands = index.search(query, floor)
        top = cands[0]["rel"] if cands else 0.0
        if not gate or top >= STRONG_MATCH or rounds == 2:
            break
        floor = max(0.10, floor - 0.20)   # 有界扩展：降准入下限，不破预算
        rounds += 1
    if truncate:
        picked, used, dropped = [], 0, 0
        for h in cands:
            b = nbytes(h["text"])
            take = h["text"] if used + b <= max_bytes else cut_utf8(h["text"], max_bytes - used)
            if take:
                picked.append({**h, "text": take})
                used += nbytes(take)
            if take != h["text"]:
                dropped += 1
        status = "ready" if picked else "empty"
        return {"status": status, "content": picked, "content_bytes": used,
                "rounds": rounds, "truncated": dropped}
    picked, used = _fit(cands, max_bytes)
    return {"status": "ready" if picked else "empty",
            "content": picked if picked else None, "content_bytes": used,
            "rounds": rounds, "truncated": 0}


class UnboundedRecall:
    """D3 反例：无预算，命中全返回。"""

    @staticmethod
    def recall(query: str, index: MemoryIndex) -> dict:
        cands = index.search(query, 0.10)
        blob = "\n".join(h["text"] for h in cands)
        return {"status": "ready", "content": cands, "content_bytes": nbytes(blob)}

# ---------------------------------------------------------------- M4 Handoff


def handoff_cycle(store: ArtifactStore, contract: str, progress: str,
                  next_steps: str, commit: bool) -> dict:
    """Work Contract -> Prepared Handoff（临时）-> 可选 commit -> 回执/结果。"""
    prepared = {"goal": contract, "verified_progress": progress,
                "next_steps": next_steps, "state": "prepared"}   # 临时值，非长期
    out = {"prepared": prepared, "committed_ref": None}
    if commit:   # 仅里程碑才提交，生成持久 Revision
        out["committed_ref"] = store.create("handoff", "work-1",
                                            f"{contract}|{progress}|{next_steps}")
    return out


def handoff_hint(committed_text: str, max_bytes: int = HINT_DEFAULT_BYTES,
                 truncate: bool = False) -> dict:
    """提示渲染为不可信历史定位信息：全有或全无，从不截断（truncate=True 为 D5 反例）。"""
    if nbytes(committed_text) <= max_bytes:
        return {"status": "ready", "content": committed_text,
                "content_bytes": nbytes(committed_text)}
    if truncate:
        cut = committed_text.encode("utf-8")[:max_bytes].decode("utf-8", errors="ignore")
        return {"status": "ready", "content": cut, "content_bytes": nbytes(cut),
                "note": "反例：截断"}
    return {"status": "empty", "content": None, "content_bytes": 0}

# ---------------------------------------------------------------- M5 Topic Memory


def topic_distill(topic_text: str, new_source: str, incremental: bool = True) -> tuple[str, list[str]]:
    """增量提炼：把新 Source 中主题尚未覆盖的行并入；返回（新主题文本, 本次并入行）。

    incremental=False 为「整场重建」反例：只保留最新 Source 的内容。
    """
    cur = [l for l in topic_text.splitlines() if l.strip()]
    fresh = [l for l in new_source.splitlines() if l.strip()]
    if not incremental:
        return "\n".join(fresh), fresh
    have = {l.strip() for l in cur}
    merged_in = [l for l in fresh if l.strip() not in have]
    return "\n".join(cur + merged_in), merged_in

# ---------------------------------------------------------------- 演示与实验


def demo() -> None:
    store = ArtifactStore()
    inbox = ReviewInbox(store)
    idx = MemoryIndex()

    r1 = store.create("atomic-memory", "db-choice", "决定：Aurora 项目用 uv 管理 Python 依赖")
    r2 = store.replace("atomic-memory", "db-choice", "决定：依赖管理用 uv，配置用 .env")
    print(f"[M1] {r1} -> 内容仍可精确读取: {store.resolve(r1)['content'][:12]}…")
    print(f"[M1] {r2} 替换后历史长度 {store.history_len('atomic-memory', 'db-choice')}，ID 不变")

    cid = inbox.submit("experience", "uv-pin", "场景：依赖漂移；动作：uv.lock 钉版；结果：构建可复现")
    inbox.tamper(cid, "场景：依赖漂移；动作：直接 pip 装最新；结果：构建可复现")  # 他方改提案
    out = inbox.review(cid, approve=True, expected_version=1)
    print(f"[M2] 评审时提案已被改（version=2）：按 expected_version=1 提交 -> {out}")
    out2 = inbox.review(cid, approve=True, expected_version=2)
    print(f"[M2] 按当前 version=2 重交 -> {out2}")

    idx.add_active_memory("决定：Aurora 项目用 uv 管理 Python 依赖，配置用 .env")
    idx.add_active_memory("约束：第一阶段只在一台 Linux 服务器运行，Mac 走 SSH 隧道")
    idx.add_approved_experience("经验：先复述约束再动代码，可减少返工")
    pc = prepare_context("Aurora 的依赖和部署约束是什么", idx, max_bytes=200)
    print(f"[M3] PreparedContext: status={pc['status']} bytes={pc['content_bytes']}/{200} "
          f"rounds={pc['rounds']} 条数={len(pc['content'] or [])}")

    cyc = handoff_cycle(store, "完成 Aurora 验收", "依赖决定已保存", "接入 Claude Code",
                        commit=True)
    hint = handoff_hint(store.resolve(cyc["committed_ref"])["content"])
    print(f"[M4] 交接已提交 {cyc['committed_ref']}；hint(2000B) -> {hint['status']}, "
          f"{hint['content_bytes']}B")

    topic = ""
    for src in ["决定：用 uv 管理依赖", "约束：只用 Linux 服务器", "更新：Mac 通过 SSH 访问"]:
        topic, m = topic_distill(topic, src)
    print(f"[M5] Topic 三次增量后 {len(topic.splitlines())} 行，无一行丢失")


def experiment(which: str) -> dict:
    if which == "D1":  # 覆盖式替换：评审引用失锚
        good, bad = ArtifactStore(), MutableStore()
        for s in (good, bad):
            s.create("experience", "e1", "经验A：跑测试再提交")
            s.replace("experience", "e1", "经验A'：跑测试+lint 再提交")
        return {"expect": "无历史 vs 有历史",
                "immutable_history": good.history_len("experience", "e1"),
                "mutable_history": bad.history_len("experience", "e1"),
                "immutable_old_ref_readable": good.resolve("experience/e1@1")["content"] == "经验A：跑测试再提交",
                "mutable_old_ref_readable": False}

    if which == "D2":  # 跳过评审：未批准内容直接进召回
        store = ArtifactStore()
        idx_clean, idx_dirty = MemoryIndex(), MemoryIndex()
        ReviewInbox(store)  # 有门：pending 停在收件箱
        inbox = ReviewInbox(store)
        cid = inbox.submit("experience", "x", "经验：删除测试文件可提速")
        NoReviewPipeline(store).generate("experience", "x", "经验：删除测试文件可提速")
        idx_clean.add_approved_experience("已批准经验：跑测试再提交")
        idx_dirty.add_leaked_pending("未批准提案：删除测试文件可提速")  # 无门直入索引
        q = "如何提速"
        clean_hit = any("删除" in h["text"] for h in idx_clean.search(q, 0.05))
        dirty_hit = any("删除" in h["text"] for h in idx_dirty.search(q, 0.05))
        return {"expect": "无门时未批准内容可被召回", "inbox_still_pending": inbox.candidates[cid]["state"] == "pending",
                "gated_recall_polluted": clean_hit, "ungated_recall_polluted": dirty_hit}

    if which == "D3":  # 无预算：召回体积无界
        idx = MemoryIndex()
        for i in range(50):
            idx.add_active_memory(f"第{i}条约束：环境变量 PC_{i} 必须设置为 x{i}")
        bounded = prepare_context("约束有哪些", idx, max_bytes=512)
        unbounded = UnboundedRecall.recall("约束有哪些", idx)
        return {"expect": "有界 vs 无界字节", "bounded_bytes": bounded["content_bytes"],
                "unbounded_bytes": unbounded["content_bytes"],
                "bounded_within_budget": bounded["content_bytes"] <= 512}

    if which == "D4":  # 截断凑预算：语义破坏
        idx = MemoryIndex()
        idx.add_active_memory("阻塞：上游 API 限流未解除前，禁止压测；需先申请白名单")
        pc_trunc = prepare_context("当前阻塞", idx, max_bytes=40, truncate=True)
        pc_honest = prepare_context("当前阻塞", idx, max_bytes=40)
        trunc_text = pc_trunc["content"][0]["text"] if pc_trunc["content"] else ""
        return {"expect": "截断丢掉关键限定", "truncated_text": trunc_text,
                "truncated_keeps_ban": "禁止" in trunc_text and "白名单" in trunc_text,
                "honest_status": pc_honest["status"]}

    if which == "D5":  # 整场重建：旧事实丢失
        topic = ""
        for src in ["决定：用 uv 管理依赖", "约束：只用 Linux 服务器"]:
            topic, _ = topic_distill(topic, src)
        rebuilt, _ = topic_distill(topic, "更新：Mac 通过 SSH 访问", incremental=False)
        return {"expect": "重建丢早期事实", "incremental_keeps": "uv" in topic and "Linux" in topic,
                "rebuild_keeps": "uv" in rebuilt and "Linux" in rebuilt,
                "rebuild_text": rebuilt}

    raise SystemExit(f"未知实验 {which}")

# ---------------------------------------------------------------- selftest


def selftest() -> bool:
    ok: list[tuple[bool, str]] = []

    # M1
    store = ArtifactStore()
    r1 = store.create("atomic-memory", "d1", "v1")
    r2 = store.replace("atomic-memory", "d1", "v2")
    check(r1 != r2 and store.resolve(r1)["content"] == "v1", "M1 精确引用返回历史快照", ok)
    check(store.history_len("atomic-memory", "d1") == 2, "M1 替换追加 Revision", ok)
    check(store.head("atomic-memory", "d1")["content"] == "v2", "M1 head 前进", ok)

    # M2
    inbox = ReviewInbox(store)
    cid = inbox.submit("experience", "e1", "p1")
    check(cid in inbox.candidates and inbox.candidates[cid]["state"] == "pending", "M2 候选 pending", ok)
    inbox.tamper(cid, "p1-被改")
    out = inbox.review(cid, True, expected_version=1)
    check(out["ok"] is False and out["error"] == "version-conflict", "M2 乐观锁拒旧决定", ok)
    out2 = inbox.review(cid, True, expected_version=2)
    check(out2["ok"] and out2["final"], "M2 按当前版本提交为终态", ok)
    out3 = inbox.review(cid, True, expected_version=2)
    check(out3["ok"] is False, "M2 终态不可重复决策", ok)

    # M3
    idx = MemoryIndex()
    idx.add_active_memory("决定：uv 管依赖，配置 .env")
    idx.add_active_memory("约束：仅 Linux 服务器")
    pc = prepare_context("依赖怎么管", idx, max_bytes=64)
    check(pc["status"] == "ready" and pc["content_bytes"] <= 64, "M3 预算硬顶", ok)
    tight = prepare_context("依赖怎么管", idx, max_bytes=4)
    check(tight["status"] == "empty" and tight["content"] is None, "M3 放不下即 empty", ok)
    weak = MemoryIndex()
    weak.add_active_memory("Aurora uv 依赖决定")     # 与 query 弱相关
    g = prepare_context("数据库选型", weak, max_bytes=200, gate=True)
    check(g["rounds"] <= 2, "M3 扩展至多两轮", ok)
    check(g["content_bytes"] <= 200, "M3 扩展不破预算", ok)

    # M4
    cyc = handoff_cycle(store, "目标", "进展", "下一步", commit=False)
    check(cyc["committed_ref"] is None and cyc["prepared"]["state"] == "prepared", "M4 未提交仅临时值", ok)
    cyc2 = handoff_cycle(store, "目标", "进展", "下一步", commit=True)
    txt = store.resolve(cyc2["committed_ref"])["content"]
    big = handoff_hint(txt, max_bytes=8)
    check(big["status"] == "empty" and big["content"] is None, "M4 超限从不截断", ok)
    fit = handoff_hint(txt, max_bytes=4000)
    check(fit["status"] == "ready" and fit["content"] == txt, "M4 放得下整段返回", ok)

    # M5
    topic = ""
    for s in ["决定：用 uv", "约束：Linux", "更新：SSH"]:
        topic, _ = topic_distill(topic, s)
    check(all(k in topic for k in ("uv", "Linux", "SSH")), "M5 增量不丢事实", ok)

    # D1..D5 退化方向
    check(experiment("D1")["immutable_history"] == 2 and experiment("D1")["mutable_history"] == 1,
          "D1 覆盖式替换丢历史", ok)
    check(experiment("D2")["ungated_recall_polluted"] and not experiment("D2")["gated_recall_polluted"],
          "D2 无门污染召回", ok)
    d3 = experiment("D3")
    check(d3["bounded_bytes"] <= 512 < d3["unbounded_bytes"], "D3 无预算体积无界", ok)
    d4 = experiment("D4")
    check(d4["honest_status"] == "empty" and not d4["truncated_keeps_ban"], "D4 截断破坏语义", ok)
    check(experiment("D5")["incremental_keeps"] and not experiment("D5")["rebuild_keeps"],
          "D5 整场重建丢旧事实", ok)

    # 字数计数自证：中文三个字=5 CJK；abc-def=1 词；URL 与独立图片行已剥
    tmp = "中文三个字 abc-def 12.5 http://x.io/y\n![图](a.png)\n"
    open("/tmp/_wc_pc.md", "w").write("```\ncode\n```\n" + tmp + "\n")
    c = count_words("/tmp/_wc_pc.md")
    check(c == 6, f"count 自证（5 CJK+1 词=6，得 {c}）", ok)

    for good, msg in ok:
        print(("  ok " if good else "  FAIL ") + msg)
    passed = all(g for g, _ in ok)
    print("SELFTEST PASSED ✔" if passed else "SELFTEST FAILED ✘")
    return passed

# ---------------------------------------------------------------- 字数门禁


def count_words(path: str) -> int:
    text = open(path, encoding="utf-8").read()
    text = re.sub(r"```.*?```", "", text, flags=re.S)          # 代码围栏
    text = re.sub(r"~~~.*?~~~", "", text, flags=re.S)
    text = re.sub(r"^\s*!\[[^\]]*\]\([^)]*\)\s*$", "", text, flags=re.M)  # 图片行
    text = re.sub(r"https?://\S+", "", text)                    # URL
    cjk = len(re.findall(r"[㐀-䶿一-鿿]", text))
    words = len(re.findall(r"[A-Za-z]+(?:[-'’][A-Za-z]+)*", text))
    return cjk + words

# ---------------------------------------------------------------- CLI


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("mode", choices=["demo", "selftest", "break", "count"])
    ap.add_argument("rest", nargs="*", help="break: D1..D5；count: <md 路径>")
    args = ap.parse_args(argv)
    if args.mode == "demo":
        demo()
        return 0
    if args.mode == "selftest":
        return 0 if selftest() else 1
    if args.mode == "break":
        allok = True
        for d in args.rest:
            out = experiment(d)
            print(f"[{d}]", out.pop("expect"), "->", out)
            if d == "D1":
                allok &= out["immutable_old_ref_readable"] and not out["mutable_old_ref_readable"]
            if d == "D2":
                allok &= out["ungated_recall_polluted"] and not out["gated_recall_polluted"]
            if d == "D3":
                allok &= out["bounded_within_budget"] and out["unbounded_bytes"] > 512
            if d == "D4":
                allok &= out["honest_status"] == "empty" and not out["truncated_keeps_ban"]
            if d == "D5":
                allok &= out["incremental_keeps"] and not out["rebuild_keeps"]
        print("BREAK EXPECTATIONS ✔" if allok else "BREAK EXPECTATIONS ✘")
        return 0 if allok else 1
    if args.mode == "count":
        n = count_words(args.rest[0])
        print(f"字数（CJK+英文单词）= {n}（门 5000）")
        return 0 if n <= 5000 else 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
