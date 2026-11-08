#!/usr/bin/env python3
"""Agent 记忆四机制 · 最小确定性原型（纯标准库、无随机数、同一命令永远同一输出）。

声明：只验证「机制逻辑」，不复现 Anthropic《The components of agent memory》的数字，
也不评估模型聪明与否；所有「LLM 角色」（写入器/对账器/导航器/反思器/agent）都是确定性脚本化 mock。

  M1 写入筛选 salience gate   WriteAll vs SalienceWriter     度量: need 命中率 / 条目数 / 期末过期数
  M2 离线对账纠错 dreaming    dream_correct + navigate       度量: 是否到达 / wasted_actions
  M3 并发写与一对象一页       SharedPage vs PerEntity        度量: 事实存活 n/12
  M4 常驻层预算与降级         promote + demote_with_link     度量: 关键条目可见 / 索引行数 / 被截断条目数

运行:
  python3 agent_memory_lab.py --selftest       逐机制日志 + assert，末尾 SELFTEST PASSED ✔
  python3 agent_memory_lab.py --break D1..D4   只打开对应破坏开关，不 assert，末尾一行 BREAK Dn: 正常 vs 破坏
  python3 agent_memory_lab.py --demo|--count F 并排摘要｜笔记字数门（中文字数+英文单词）
"""
import sys
from collections import namedtuple

BREAK = set()   # 破坏开关集合，--break Dn 只放入 "Dn"
QUIET = False


def say(*a):
    if not QUIET:
        print(*a)


# ══════════════ M1 写入筛选（salience gate）══════════════
TURNS, BUDGET = 40, 600          # 一局 40 回合；会话开始的读取预算 600 字符
Obs = namedtuple("Obs", "topic value kind verified")
# hidden 事实 (回合, 主题键, 值, 是否 verified)；同主题后来的 verified 值取代旧真值；shop_hint 先是未验证的猜测
HIDDEN = [(2, "rule_R3", "连败3次换时机", True), (4, "route_plan", "A>B>C", True),
          (6, "shop_hint", "L5有折扣", False), (7, "boss_weak", "fire", True),
          (9, "key_loc", "door(7,2)", True), (14, "shop_hint", "L3有折扣", True),
          (16, "route_plan", "A>C>D", True), (21, "rule_R3", "连败2次换时机", True),
          (27, "save_slot", "slot2", True)]
# need 事件 (回合, 主题键)：该回合开新会话，需要 hidden 事实的当前真值
NEEDS = [(11, "rule_R3"), (11, "boss_weak"), (18, "key_loc"), (18, "shop_hint"), (20, "route_plan"),
         (25, "rule_R3"), (31, "route_plan"), (31, "boss_weak"), (36, "key_loc"), (36, "shop_hint"),
         (36, "rule_R3"), (39, "save_slot")]


def visible(t):  # 每回合屏幕上本来就显示的事实，每回合都漂移
    return {"gold": 100 + 13 * t, "pos": f"({t % 7},{t * 3 % 5})", "hp": 100 - t * 7 % 60}


def observations(t):
    obs = [Obs(k, v, "visible", True) for k, v in visible(t).items()]
    return obs + [Obs(k, v, "hidden", ok) for tt, k, v, ok in HIDDEN if tt == t]


def truth(topic, t):  # 回合 t 的当前真值（hidden 取已 verified 的最新值）
    if topic in visible(t):
        return visible(t)[topic]
    vals = [v for tt, k, v, ok in HIDDEN if k == topic and ok and tt <= t]
    return vals[-1] if vals else None


class Store:  # 笔记库：key -> 条目
    def __init__(self):
        self.e, self.seq = {}, 0

    def put(self, key, turn, o):
        self.seq += 1
        self.e[key] = dict(seq=self.seq, topic=o.topic, value=o.value, text=f"note t{turn:02d} {o.topic} {o.value}")

    def chars(self):
        return sum(len(x["text"]) + 1 for x in self.e.values())

    def load(self, budget):  # 最近写入优先，按预算从新到旧连续读入，预算用尽即止
        out, used = [], 0
        for x in sorted(self.e.values(), key=lambda x: -x["seq"]):
            if used + len(x["text"]) + 1 > budget:
                break
            out.append(x)
            used += len(x["text"]) + 1
        return out


class WriteAll:
    name = "WriteAll"

    def write(self, store, turn, o):  # 每个观测都落一条新条目
        store.put(f"t{turn}:{o.topic}", turn, o)


class SalienceWriter:
    name = "Salience"

    def write(self, store, turn, o):
        if "D1" in BREAK:  # D1：拔掉筛选 = 退化成 WriteAll
            return WriteAll.write(self, store, turn, o)
        if o.kind == "hidden" and o.verified:  # 只写 hidden 且 verified，按主题键覆盖同一条目
            store.put(o.topic, turn, o)


def play(writer):
    st, got = Store(), []
    for t in range(1, TURNS + 1):
        for nt, topic in NEEDS:
            if nt == t:  # 读入预算内且未过期才算命中
                got.append((t, topic, any(x["topic"] == topic and x["value"] == truth(topic, t) for x in st.load(BUDGET))))
        for o in observations(t):
            writer.write(st, t, o)
    stale = sum(x["value"] != truth(x["topic"], TURNS) for x in st.e.values())
    return dict(entries=len(st.e), chars=st.chars(), hits=sum(g[2] for g in got), needs=len(NEEDS), stale=stale, got=got,
                late_hits=sum(g[2] for g in got if g[0] >= 31), late_needs=sum(g[0] >= 31 for g in got))


def m1():
    say("== M1 写入筛选：一局 %d 回合，读取预算 B=%d 字符，need 事件 %d 个" % (TURNS, BUDGET, len(NEEDS)))
    res = {}
    for w in (WriteAll(), SalienceWriter()):
        r = res[w.name] = play(w)
        say(f"  {w.name:9s} 条目={r['entries']:3d} 总字符={r['chars']:4d} need命中={r['hits']}/{r['needs']}"
            f" ({r['hits'] / r['needs']:.0%}) 期末过期条目={r['stale']}")
        say(f"            后期(>=t31)命中={r['late_hits']}/{r['late_needs']}  逐条: " + " ".join(f"t{t}:{k}{'Y' if ok else 'N'}" for t, k, ok in r["got"]))
    return res


# ══════════════ M2 离线对账纠错（dreaming vs transcript）══════════════
WORLD = {"pokecenter_side": "west"}  # 地面真值
TRANSCRIPT = [(1, "gym_door", "locked"), (3, "pokecenter_side", "west"), (9, "gym_door", "open")]  # (step,key,value)
NOTES = [{"key": "pokecenter_side", "value": "east"},   # 错误笔记
         {"key": "gym_door", "value": "open"},          # 正确笔记（transcript 里先 locked 后 open，须取最新）
         {"key": "gym_door", "value": "open"},          # 重复笔记
         {"key": "rival_route", "value": "north"}]      # 无 transcript 证据


def dedupe(notes):
    seen, out = set(), []
    for n in notes:
        if (n["key"], n["value"]) not in seen:
            seen.add((n["key"], n["value"]))
            out.append(dict(n))
    return out


def dream_correct(notes, transcript):
    notes = dedupe(notes)
    if "D2" in BREAK:  # D2：只做去重整理，不再对照 transcript
        return notes
    latest = {k: v for _, k, v in sorted(transcript)}  # 每个键取最新观测
    for n in notes:
        if n["key"] not in latest:
            n["status"] = "unverified"  # 无证据：不删不改
        elif latest[n["key"]] != n["value"]:
            n.update(value=latest[n["key"]], status="verified", corrected_by="transcript")
        else:
            n["status"] = "verified"
    return notes


def navigate(notes, goal="pokecenter_side", max_wasted=3):  # 脚本化导航器：无条件信任笔记
    believed = next((n["value"] for n in notes if n["key"] == goal), None)
    wasted = 0
    while believed != WORLD[goal] and wasted < max_wasted:  # 笔记错 -> 走错路一次，笔记不会自我更新
        wasted += 1
    return dict(reached=believed == WORLD[goal], wasted=wasted)


def fmt_note(n):
    return f"{n['key']}={n['value']}[{n.get('status', '-')}" + (f",corrected_by={n['corrected_by']}" if "corrected_by" in n else "") + "]"


def m2():
    say("== M2 离线对账：4 条笔记（1 错/1 对/1 重复/1 无证据）对照 transcript（pokecenter_side 真值 west）")
    res = {"raw": navigate(NOTES)}
    notes = dream_correct(NOTES, TRANSCRIPT)
    res.update(dream=navigate(notes), notes=notes)
    say("  对账后笔记: " + "; ".join(fmt_note(n) for n in notes))
    for arm in ("raw", "dream"):
        say(f"  navigate({'未对账笔记' if arm == 'raw' else '对账后笔记'}): 到达={res[arm]['reached']} wasted_actions={res[arm]['wasted']}")
    return res


# ══════════════ M3 并发写与一对象一页 ══════════════
CLAUSES = {"C1": ["付款期限为发票日后30日", "违约金为合同额的5%", "争议由上海仲裁委管辖"],
           "C2": ["质保期为交付后24个月", "保密义务持续至合同终止后3年", "单方解约须提前60日书面通知"],
           "C3": ["交付地点为买方仓库", "逾期交付每日罚款0.1%", "知识产权归买方所有"],
           "C4": ["年度服务费按CPI上浮", "数据存储限境内机房", "不可抗力以政府公告为准"]}
ORDER = ["R1", "R2", "W1", "R3", "R4", "W2", "W3", "W4"]            # 固定交错：R=读快照，W=整页写回
ORDER_ALL_READ_FIRST = ["R1", "R2", "R3", "R4", "W1", "W2", "W3", "W4"]  # 补充样本：四人同时起跑
INSTR0 = dict(layout="shared_page", quote="summary")


class SharedPageBuild:
    name = "SharedPage"

    def page(self, cid):  # 所有合同挤在同一页 provisions
        return "provisions"

    def line(self, cid, clause):
        return f"{cid}: {clause}"


class PerEntityBuild:
    name = "PerEntity"

    def page(self, cid):  # 一对象一页
        return f"contract_{cid}"

    def line(self, cid, clause):  # 逐字引用条款
        return f'> "{clause}"'


def run_build(build, order=ORDER):
    wiki, snap = {}, {}
    for op in order:
        cid = f"C{op[1]}"
        if op[0] == "R":  # 读快照取自各自开始时刻
            snap[cid] = list(wiki.get(build.page(cid), []))
        else:  # 改后整页写回：最后写入者胜
            wiki[build.page(cid)] = snap[cid] + [build.line(cid, c) for c in CLAUSES[cid]]
    text = "\n".join(x for pg in wiki.values() for x in pg)
    missing = [(cid, c) for cid, cs in CLAUSES.items() for c in cs if c not in text]
    return dict(survived=12 - len(missing), missing=missing, pages=len(wiki))


def reflect_and_revise(failures):  # 读取评分缺失的事实，输出新指令
    if "D3" in BREAK or not failures:  # D3：反思不生效，指令不变
        return dict(INSTR0)
    if len({cid for cid, _ in failures}) >= 2:  # 缺失横跨多份合同 -> 病灶是共享页的整页覆盖写
        return dict(layout="per_contract", quote="verbatim", text="每合同一页、逐字引条款")
    return dict(INSTR0)


def m3():
    say("== M3 并发写：4 agent x 3 条款 = 12 条事实，交错序列 " + ",".join(ORDER))
    before = run_build(SharedPageBuild())
    say(f"  SharedPage  存活 {before['survived']}/12 页数={before['pages']} 丢失合同={sorted({c for c, _ in before['missing']})}")
    instr = reflect_and_revise(before["missing"])
    say(f"  reflect_and_revise -> layout={instr['layout']} quote={instr['quote']}")
    build = PerEntityBuild() if instr["layout"] == "per_contract" else SharedPageBuild()
    after = run_build(build)
    say(f"  修订后({build.name}) 存活 {after['survived']}/12 页数={after['pages']}")
    return dict(before=before, after=after, instr=instr)


# ══════════════ M4 常驻层预算与降级（injected layer）══════════════
LINES = 20  # 会话开头只载入索引前 20 行，超出静默丢弃
TOPICS = ["map", "items", "battle", "npc", "routes"]


def make_notes():  # 30 条按时间顺序产生的笔记，第 28 条是「关键新规则」
    ns = []
    for i in range(1, 31):
        crit = i == 28
        tp = "rules" if crit else TOPICS[i % 5]
        ns.append(dict(id=i, topic=tp, critical=crit, summary="新规则：存档前必须先回城治疗" if crit else f"{tp} 要点{i}",
                       detail=f"{tp} 第{i}号观察的长细节：路径、数值、触发条件与例外情形均记录于此，篇幅远大于一句话摘要"))
    return ns


def promote(index, n):  # 追加一行完整条目（细节内联）
    index.append(dict(topic=n["topic"], ids=[n["id"]], best=(n["critical"], n["id"], n["summary"]),
                      detail=[f"#{n['id']} {n['summary']}: {n['detail']}"],
                      text=f"- #{n['id']} [{n['topic']}] {n['summary']} | {n['detail']}"))


def demote_with_link(index, pages, lines=LINES):
    """超预算时把索引重写成目录：细节挪到 topic 页，每个 topic 只留一行「摘要+指针」。"""
    if "D4" in BREAK or len(index) <= lines:  # D4：不降级，索引无限追加
        return
    toc = {}
    for ln in index:
        t = toc.setdefault(ln["topic"], dict(topic=ln["topic"], ids=[], best=(False, 0, "")))
        pages.setdefault(ln["topic"], []).extend(ln["detail"])
        t["ids"] += ln["ids"]
        t["best"] = max(t["best"], ln["best"])  # 摘要取关键优先、其次最新
    index[:] = [dict(t, detail=[], text=f"- [{t['topic']}] {len(t['ids'])}条 要点: {t['best'][2]} -> topics/{t['topic']}.md")
                for t in toc.values()]


def measure_index(index, pages, notes):
    loaded, crit = index[:LINES], next(n for n in notes if n["critical"])  # 会话开头只看得到前 LINES 行
    seen_text, covered = "\n".join(l["text"] for l in loaded), {i for l in loaded for i in l["ids"]}
    return dict(visible=crit["summary"] in seen_text, lines=len(index), truncated=sum(n["id"] not in covered for n in notes),
                pointer=f"topics/{crit['topic']}.md" in seen_text, page_has_detail=any(crit["detail"] in d for d in pages.get(crit["topic"], [])))


def m4():
    notes = make_notes()
    say(f"== M4 常驻层：30 条笔记（第 28 条为关键新规则），索引每会话只载入前 {LINES} 行")
    res = {}
    for arm in ("append", "demote"):
        index, pages = [], {}
        for n in notes:
            promote(index, n)
        if arm == "demote":  # 会话结束整理一次
            demote_with_link(index, pages)
        r = res[arm] = measure_index(index, pages, notes)
        say(f"  {'仅追加' if arm == 'append' else '降级后'}: 索引行数={r['lines']:2d} 关键条目可见={r['visible']} 含指针={r['pointer']} "
            f"被截断条目={r['truncated']} topic页含细节={r['page_has_detail']}")
    return res


# ══════════════ 入口 ══════════════
def run_all():
    return dict(m1=m1(), m2=m2(), m3=m3(), m4=m4())


def headline(d, r):  # 每个破坏实验的核心度量
    if d == "D1":
        s = r["m1"]["Salience"]
        return f"SalienceWriter need命中 {s['hits']}/{s['needs']} 条目 {s['entries']} 总字符 {s['chars']} 期末过期 {s['stale']}"
    if d == "D2":
        s = r["m2"]["dream"]
        return f"对账后导航 到达={s['reached']} wasted_actions={s['wasted']}"
    if d == "D3":
        return f"反思修订后存活 {r['m3']['after']['survived']}/12"
    s = r["m4"]["demote"]
    return f"关键条目可见={s['visible']} 索引行数={s['lines']} 被截断条目={s['truncated']}"


def selftest(r):
    wa, sw = r["m1"]["WriteAll"], r["m1"]["Salience"]
    assert sw["hits"] == sw["needs"], "M1: 筛选写入应命中全部 need"
    assert wa["hits"] / wa["needs"] <= 0.6 and wa["late_hits"] <= 1, "M1: WriteAll 总命中 <=60%（实测 58%），后期 <=1/6"
    assert wa["entries"] >= 10 * sw["entries"], "M1: WriteAll 条目数应 >=10x（实测 129 vs 6）"
    assert sw["entries"] == len({k for _, k, _, ok in HIDDEN if ok}) and sw["stale"] == 0 and wa["stale"] >= 0.9 * wa["entries"]
    assert wa["chars"] > BUDGET and sw["chars"] < BUDGET, "M1: 筛选后总量应落在读取预算内"
    raw, dr, ns = r["m2"]["raw"], r["m2"]["dream"], {n["key"]: n for n in r["m2"]["notes"]}
    assert (raw["reached"], raw["wasted"]) == (False, 3) and (dr["reached"], dr["wasted"]) == (True, 0)
    assert ns["pokecenter_side"]["corrected_by"] == "transcript" and ns["pokecenter_side"]["value"] == "west"
    assert ns["gym_door"]["status"] == "verified" and "corrected_by" not in ns["gym_door"]
    assert ns["rival_route"]["status"] == "unverified" and ns["rival_route"]["value"] == "north" and len(r["m2"]["notes"]) == 3
    b, a = r["m3"]["before"], r["m3"]["after"]
    assert b["survived"] == 6 and a["survived"] == 12 and r["m3"]["instr"]["layout"] == "per_contract"
    assert run_build(SharedPageBuild(), ORDER_ALL_READ_FIRST)["survived"] == 3, "M3: 四人同时起跑应只剩最后写入者"
    assert run_build(PerEntityBuild(), ORDER_ALL_READ_FIRST)["survived"] == 12 and reflect_and_revise([]) == INSTR0
    ap, dm = r["m4"]["append"], r["m4"]["demote"]
    assert (ap["lines"], ap["visible"], ap["truncated"]) == (30, False, 10), "M4: 仅追加应 30 行、关键条目被截断、截断 10 条"
    assert dm["lines"] <= LINES and dm["visible"] and dm["pointer"] and dm["page_has_detail"] and dm["truncated"] == 0
    print("SELFTEST PASSED ✔")


def demo(r):
    w, s = r["m1"]["WriteAll"], r["m1"]["Salience"]
    print("== DEMO 四机制并排对比（左=无机制基线，右=有机制）")
    print(f"M1 写入筛选   条目 {w['entries']} -> {s['entries']}；总字符 {w['chars']} -> {s['chars']}；need 命中 {w['hits']}/{w['needs']} -> {s['hits']}/{s['needs']}；期末过期 {w['stale']} -> {s['stale']}")
    print(f"M2 离线对账   到达 {r['m2']['raw']['reached']} -> {r['m2']['dream']['reached']}；wasted_actions {r['m2']['raw']['wasted']} -> {r['m2']['dream']['wasted']}")
    print(f"M3 一对象一页 事实存活 {r['m3']['before']['survived']}/12 -> {r['m3']['after']['survived']}/12（reflect_and_revise 把 SharedPage 换成 PerEntity）")
    a, d = r["m4"]["append"], r["m4"]["demote"]
    print(f"M4 常驻层降级 索引行数 {a['lines']} -> {d['lines']}；关键条目可见 {a['visible']} -> {d['visible']}；被截断条目 {a['truncated']} -> {d['truncated']}")


def count_words(path):  # 字数门：剥 frontmatter 与代码围栏，中文字数 + 英文单词；后者再剥图片/链接目标/URL
    import re
    t = re.sub(r"\A---\n.*?\n---\n", "", open(path, encoding="utf-8").read(), flags=re.S)
    t = re.sub(r"^```.*?^```", "", t, flags=re.S | re.M)

    def n(x):
        return len(re.findall(r"[\u4e00-\u9fff]", x)) + len(re.findall(r"[A-Za-z0-9][A-Za-z0-9_\-\.'’%/+:]*", re.sub(r"[\u4e00-\u9fff]", " ", x)))
    lite = re.sub(r"https?://\S+", "", re.sub(r"\]\([^)]*\)", "]", re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)))
    print(f"字数（全文件口径）{n(t)}；字数（去图片/链接/URL 口径）{n(lite)}")


def main(argv):
    global QUIET
    if "--break" in argv:
        d = argv[argv.index("--break") + 1] if argv.index("--break") + 1 < len(argv) else ""
        if d not in ("D1", "D2", "D3", "D4"):
            sys.exit("用法: --break D1|D2|D3|D4")
        QUIET = True
        normal = run_all()  # 先内部跑一遍正常值
        QUIET = False
        BREAK.add(d)
        print(f"[BREAK {d}] 仅打开该开关，其余机制保持正常；以下为破坏后的逐机制日志")
        broken = run_all()
        print(f"BREAK {d}: 正常 [{headline(d, normal)}] vs 破坏后 [{headline(d, broken)}]")
    elif "--selftest" in argv:
        selftest(run_all())
    elif "--count" in argv:
        count_words(argv[argv.index("--count") + 1])
    elif "--demo" in argv:
        QUIET = True
        demo(run_all())
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
