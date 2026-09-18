#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Horizon Context 最小原型实验室（guided-learn Phase 4）。

对标 Snowflake Horizon Context 的机制（2026-09-17 全局重评选校准后的 M 集 + 降级保留）：
  M1 语义视图：口径单点 × 查询期重算 —— 五段式声明 + 同义词 + 验证问答 + 可见性 + 结构校验门
                                + agg-before-join / distinct / derived 先聚后除 / 半可加末快照 / USING 消歧
  M2 查询期行列级访问策略 —— 执行层 RBAC/PRIVATE 拒绝（玩具形态）+ IS_AGENT_ACTIVATED 严拒面
  M3 语义级治理执行       —— resolve（检索层过滤=体验）与 compile（执行层拒绝=底线）双层防线
  M4 应答层验证锚定       —— verified query 短路重放 + 引擎重算对账 + 溯源元数据
  M5 端到端列级血缘       —— 引擎执行自动沉淀列级边 + OpenLineage 外部摄取完整事件门
  M6 Agent Identity       —— 会话权限天花板（只减不增）+ agent_type 审计 + 代理严拒面
  M7 分类与标签驱动策略传播 —— 自动分类 + 一次性映射（系统标签→用户标签）+ 新列自动纳入
  降级保留（教学价值不随降级消失）：富化双轨/冲突浮出人工/eval 自纠环（原 M4）、四因子排序（原 M6）

本原型只回答「机制是否自洽」，不回答「模型是否聪明」——材料里的 LLM 角色
（CoCo/Cortex Analyst 生成 SQL）全部用确定性 mock 替代，agent 产出 QueryPlan
结构体而非 SQL 文本（SQL 只作为 verified_queries 的展示数据存在，永不解析）。

确定性纪律：
  - 全文件无随机数、无 datetime.now()；freshness 以 REF_DATE 固定字面量为基准。
  - 任何进入输出/打分的集合一律 list/tuple + sorted()（防 PYTHONHASHSEED 漂移）。
  - 排序 tie-break 显式化：(-score, -authority, -updated.toordinal(), name)。
  - popularity 用 log1p(pop)/log1p(POP_CAP) 有界变换，禁全局 max 归一。
  - 金额全整数；唯一分数 aov 统一 round(x,2)；同一命令永远同一输出。

⚠ golden value 冻结：玩具数据变更后，场景/破坏实验的全部期望值必须重算。
运行：uv run --no-project python horizon_context_lab.py --selftest   （秒级完成）
"""

from __future__ import annotations

import math
import sys
from dataclasses import dataclass, field
from datetime import date

# ---------------------------------------------------------------------------
# 常量与玩具数据（金额整数；月收入 {01:200, 02:150, 03:300}，总 650）
# ---------------------------------------------------------------------------

REF_DATE = date(2026, 9, 12)   # freshness 基准（固定字面量，禁 now()）
POP_CAP = 500                  # popularity 上界（对应官方「500 条生产 SQL」口径）
TOP_K = 2

W_RELEVANCE, W_AUTHORITY, W_POPULARITY, W_FRESHNESS = 0.4, 0.3, 0.2, 0.1


@dataclass
class Table:
    name: str
    columns: tuple            # 列名元组
    pk: tuple                 # 主键列
    rows: list                # 行 = dict（字面量构造，插入序确定）


def _rows(cols, tuples):
    return [dict(zip(cols, t)) for t in tuples]


CUSTOMERS = Table(
    "customers", ("id", "name", "plan"), ("id",),
    _rows(("id", "name", "plan"), [
        ("c1", "Ann", "pro"), ("c2", "Bob", "free"), ("c3", "Cara", "pro"),
        ("c4", "Dan", "free"), ("c5", "Eve", "pro"),
    ]))

ORDERS = Table(
    "orders", ("id", "customer_id", "referrer_id", "month", "total"), ("id",),
    _rows(("id", "customer_id", "referrer_id", "month", "total"), [
        ("o1", "c1", None,  "2026-01", 100),
        ("o2", "c2", "c1",  "2026-01", 40),
        ("o3", "c1", None,  "2026-02", 150),
        ("o4", "c3", "c1",  "2026-01", 60),
        ("o5", "c4", None,  "2026-03", 50),
        ("o6", "c5", "c3",  "2026-03", 250),
    ]))

EVENTS = Table(
    "events", ("id", "order_id"), ("id",),
    _rows(("id", "order_id"), [
        ("e1", "o1"), ("e2", "o1"), ("e3", "o1"),   # o1 × 3 次事件 → fan trap 引信
        ("e4", "o2"), ("e5", "o2"),                  # o2 × 2
        ("e6", "o3"), ("e7", "o4"), ("e8", "o5"), ("e9", "o6"),
    ]))

DAU = Table(
    "daily_active_users", ("activity_date", "active_users"), ("activity_date",),
    _rows(("activity_date", "active_users"), [
        ("2026-01-01", 2), ("2026-01-15", 4), ("2026-01-31", 5),
        ("2026-02-15", 6), ("2026-03-15", 7),
    ]))

MARKETING = Table(
    "marketing_spend", ("month", "channel", "spend"), ("month", "channel"),
    _rows(("month", "channel", "spend"), [
        ("2026-01", "social", 30), ("2026-01", "search", 50),
        ("2026-02", "social", 35), ("2026-02", "search", 55),
        ("2026-03", "social", 40), ("2026-03", "search", 50),
    ]))

TABLES = {t.name: t for t in (CUSTOMERS, ORDERS, EVENTS, DAU, MARKETING)}

PRIVATE_ALLOWED = {"analyst"}          # 同一套 RBAC 对人/BI/agent 生效（M3）


# ---------------------------------------------------------------------------
# M1 · 上下文对象模型（对标 CREATE SEMANTIC VIEW 五段式）
# ---------------------------------------------------------------------------

@dataclass
class Relationship:                     # RELATIONSHIPS：声明式 join（FK → PK/UNIQUE）
    name: str
    from_table: str
    from_cols: tuple
    to_table: str
    to_cols: tuple


@dataclass
class Fact:                             # FACTS：行级量；可 PRIVATE（不可作为查询维度）
    name: str
    table: str
    column: str
    visibility: str = "PUBLIC"


@dataclass
class Dim:
    name: str
    table: str
    column: str


@dataclass
class Metric:                           # METRICS：命名聚合（对标 AS SUM(...) 等）
    name: str
    agg: str                            # 'sum'|'count'|'count_distinct'|'last_snapshot'|'derived'
    table: str
    column: str
    visibility: str = "PUBLIC"
    non_additive_by: tuple = ()         # 对标 NON ADDITIVE BY：排序取末快照而非求和
    derived_from: tuple = ()            # 对标 derived metric：组合其他指标的标量表达式
    synonyms: tuple = ()
    tags: dict = field(default_factory=dict)
    comment: str = ""
    updated: date = date(2026, 8, 15)


@dataclass
class VerifiedQuery:                    # 对标 AI_VERIFIED_QUERIES：人验证过的问答 + 溯源
    question: str
    sql_text: str
    verified_by: str                    # '( purpose = contact )'
    verified_at: str
    result: dict                        # 验证时的结果（短路重放 + 与引擎对账）


@dataclass
class SemanticView:                     # 对标 CREATE SEMANTIC VIEW 的五段式
    name: str
    tables: tuple
    relationships: tuple
    facts: tuple
    dimensions: tuple
    metrics: tuple
    synonyms: dict = field(default_factory=dict)   # 逻辑表同义词（检索用）
    ai_instructions: str = ""           # 对标 AI_SQL_GENERATION：随定义分发的 agent 指令
    tags: dict = field(default_factory=dict)
    verified_queries: tuple = ()


def build_sales_view() -> SemanticView:
    return SemanticView(
        name="sales_sv",
        tables=("customers", "orders", "events"),
        relationships=(
            Relationship("buyer", "orders", ("customer_id",), "customers", ("id",)),
            Relationship("referrer", "orders", ("referrer_id",), "customers", ("id",)),
            Relationship("event_to_order", "events", ("order_id",), "orders", ("id",)),
        ),
        facts=(Fact("plan", "customers", "plan", visibility="PRIVATE"),),
        dimensions=(Dim("month", "orders", "month"),
                    Dim("customer_name", "customers", "name"),
                    Dim("plan", "customers", "plan")),
        metrics=(
            Metric("revenue", "sum", "orders", "total",
                   synonyms=("sales", "毛收入", "营收"),
                   tags={"domain": "finance", "owner": "data-platform"},
                   comment="订单金额总和（governed 金标准）"),
            Metric("order_count", "count", "orders", "id",
                   synonyms=("订单数",), updated=date(2026, 8, 15)),
            Metric("aov", "derived", "orders", "",
                   derived_from=("revenue", "order_count"),
                   synonyms=("客单价", "average order value"),
                   comment="derived：分子分母各自聚合后再相除"),
            Metric("active_customers", "count_distinct", "orders", "customer_id",
                   synonyms=("distinct customers", "活跃客户"),
                   comment="distinct 聚合：join 复制行不影响计数"),
        ),
        ai_instructions=("Aggregate at query grain before joining; "
                         "use relationship 'buyer' unless the question mentions referral."),
        tags={"domain": "sales"},
        verified_queries=(
            VerifiedQuery("revenue by month",
                          "SELECT month, SUM(total) FROM orders GROUP BY month",
                          "( data_governance = data-team@acme.com )", "2026-08-20",
                          {"2026-01": 200, "2026-02": 150, "2026-03": 300}),
        ),
    )


def build_dau_view() -> SemanticView:
    return SemanticView(
        name="dau_sv",
        tables=("daily_active_users",),
        relationships=(),
        facts=(),
        dimensions=(Dim("month", "daily_active_users", "activity_date"),),
        metrics=(
            # 对标：balance NON ADDITIVE BY (year, month, day) AS SUM(balance)
            Metric("active_users_last", "last_snapshot", "daily_active_users", "active_users",
                   non_additive_by=("activity_date",),
                   synonyms=("最新活跃用户",),
                   comment="半可加：按 activity_date 排序取末快照，不求和"),
        ),
        tags={"domain": "growth"},
    )


# ---------------------------------------------------------------------------
# M1 · 结构校验门（对标 How Snowflake validates semantic views）
# ---------------------------------------------------------------------------

def validate_view(view: SemanticView, tables: dict) -> list:
    """返回错误清单（空 = 通过）。规则对应官方 validation-rules 的玩具子集。"""
    errors = []
    pks = {t: set(tables[t].pk) for t in view.tables if t in tables}
    for t in view.tables:
        if t not in tables:
            errors.append(f"unknown table: {t}")
            continue
        cols = tables[t].columns
        for d in view.dimensions:
            if d.table == t and d.column not in cols:
                errors.append(f"dimension {d.name}: no such column {d.table}.{d.column}")
    for rel in view.relationships:
        if rel.from_table not in tables or rel.to_table not in tables:
            errors.append(f"relationship {rel.name}: unknown table")
            continue
        for c in rel.from_cols:
            if c not in tables[rel.from_table].columns:
                errors.append(f"relationship {rel.name}: no such column "
                              f"{rel.from_table}.{c}")
        # FK 必须命中引用表的 PK/UNIQUE —— 非键列上的 join 是行数失控的注册期引信
        for c in rel.to_cols:
            if c not in pks.get(rel.to_table, set()):
                errors.append(f"relationship {rel.name}: referenced column "
                              f"{rel.to_table}.{c} is not PRIMARY KEY/UNIQUE")
    names = [m.name for m in view.metrics] + [d.name for d in view.dimensions]
    dupes = sorted({n for n in names if names.count(n) > 1})
    if dupes:
        errors.append(f"duplicate names: {dupes}")
    if not view.dimensions and not view.metrics:
        errors.append("must define at least one dimension or metric")
    for m in view.metrics:
        if m.agg == "last_snapshot":
            miss = [c for c in m.non_additive_by
                    if c not in tables.get(m.table, Table("", (), (), [])).columns]
            if miss:
                errors.append(f"metric {m.name}: NON ADDITIVE BY unknown columns {miss}")
    return errors


# ---------------------------------------------------------------------------
# M2 + M3 · 确定性查询引擎（含破坏实验开关）
# ---------------------------------------------------------------------------

class AccessDenied(Exception):
    pass


class AmbiguousJoinPath(Exception):
    pass


class ConflictingDefinitionError(Exception):
    pass


def _dim_value(row, dim: Dim, tables: dict, view: SemanticView, via=None):
    """把 basis 行映射到维度值（只走 many-to-one，永不复制行）。"""
    if dim.table == row["_table"]:
        v = row[dim.column]
        if dim.table == "daily_active_users" and dim.name == "month":
            return v[:7]                      # activity_date → 月
        return v
    paths = [r for r in view.relationships
             if r.from_table == row["_table"] and r.to_table == dim.table]
    if not paths:
        raise KeyError(f"no relationship from {row['_table']} to {dim.table}")
    if len(paths) > 1:
        chosen = [r for r in paths if r.name == via]
        if not chosen:
            raise AmbiguousJoinPath(
                f"multiple join paths {[r.name for r in sorted(paths, key=lambda r: r.name)]}; "
                f"specify USING (relationship)")
        paths = chosen
    rel = paths[0]
    key = row[rel.from_cols[0]]
    if key is None:
        return None
    for t in tables[rel.to_table].rows:
        if t[rel.to_cols[0]] == key:
            return t[dim.column]
    return None


def _naive_joined_rows(basis: Table, view: SemanticView, tables: dict):
    """策略 B（D1/D6 破坏路径）：join-then-aggregate。

    把与 basis 直接相连的表全部拼进来（一对多 → 行复制）——o1 被 3 条事件
    复制成 3 行，正是 LLM 在 TPC-DS 上踩的 join 爆炸。basis 列始终覆盖同名列。
    """
    rows = [dict(r, _table=basis.name) for r in basis.rows]
    for rel in view.relationships:
        for fwd, ft, tt, fcol, tcol in (
                (True, rel.from_table, rel.to_table, rel.from_cols[0], rel.to_cols[0]),
                (False, rel.to_table, rel.from_table, rel.to_cols[0], rel.from_cols[0])):
            if ft != basis.name or tt == basis.name:
                continue
            joined = []
            for r in rows:
                hits = [t for t in tables[tt].rows if t[tcol] == r[fcol]]
                for h in (hits or [None]):
                    if h is None:
                        joined.append(r)
                    else:   # basis 列覆盖同名列；_table 始终指向 basis（维度映射的锚）
                        joined.append({**h, **{k: v for k, v in r.items()
                                               if k != "_table"}, "_table": r["_table"]})
            rows = joined
    return rows


def _aggregate(spec_rows, metric: Metric, dim_objs, view, tables,
               via, distinct_safe, last_snapshot):
    """把 basis 行按 (dims...) 聚合。"""
    out = {}
    for row in spec_rows:
        key = tuple(_dim_value(row, d, tables, view, via) for d in dim_objs)
        if any(v is None for v in key):        # 维度值缺失 = 内连接语义：不计入该组
            continue
        out.setdefault(key, []).append(row)
    result = {}
    for key, group in out.items():
        if metric.agg == "sum":
            result[key] = sum(r[metric.column] for r in group)
        elif metric.agg == "count":
            result[key] = len(group)
        elif metric.agg == "count_distinct":
            result[key] = (len({r[metric.column] for r in group}) if distinct_safe
                           else len(group))                    # D2：退化成数行数
        elif metric.agg == "last_snapshot":                    # M2：NON ADDITIVE BY
            if last_snapshot:
                ordered = sorted(group, key=lambda r: tuple(r[c] for c in metric.non_additive_by))
                result[key] = ordered[-1][metric.column]       # 取末快照而非求和
            else:                                              # D3：退化成求和
                result[key] = sum(r[metric.column] for r in group)
        else:
            raise ValueError(metric.agg)
    return result


def _metric(view: SemanticView, name: str) -> Metric:
    return next(m for m in view.metrics if m.name == name)


def compile_query(view: SemanticView, metric_name: str, dims=None, role="analyst",
                  via=None, *, agg_before_join=True, distinct_safe=True,
                  last_snapshot=True, derived_post_agg=True, enforce_rbac=True,
                  tables=TABLES, catalog=None):
    """受治理的查询编译（M2 语义保障 + M3 执行层 RBAC + M4 冲突隔离）。

    破坏实验经关键字开关单独拆除某个机制；dims 用维度名列表（如 ['month']）。
    catalog 传入时对冲突定义抛 ConflictingDefinitionError（目录层契约的执行面）。
    """
    dims = dims or []
    # ---- M4：目录登记了同名冲突定义 → 拒绝执行，等人工裁决 ----
    if catalog is not None:
        if any(e.name == metric_name and e.status == "conflict" for e in catalog.entries):
            raise ConflictingDefinitionError(
                f"{metric_name} has conflicting definitions; adjudication required")
    metric = next((m for m in view.metrics if m.name == metric_name), None)
    if metric is None:
        raise KeyError(f"unknown metric: {metric_name}")
    # ---- M3 执行层防线：PRIVATE 资产在此拒绝（检索层即使泄露也拦得住）----
    if enforce_rbac:
        if metric.visibility == "PRIVATE" and role not in PRIVATE_ALLOWED:
            raise AccessDenied(f"metric {metric_name} is PRIVATE")
        for f in view.facts:
            if f.visibility == "PRIVATE" and f.name in dims and role not in PRIVATE_ALLOWED:
                raise AccessDenied(f"{f.name} is a PRIVATE fact")
    dim_objs = [d for d in view.dimensions if d.name in dims]
    none_safe = lambda k: tuple((x is None, x) for x in k)   # (None,) 与 str 可比

    def _one(m: Metric, dd):
        objs = [d for d in view.dimensions if d.name in dd]
        basis = tables[m.table]
        spec_rows = ([dict(r, _table=basis.name) for r in basis.rows] if agg_before_join
                     else _naive_joined_rows(basis, view, tables))
        return _aggregate(spec_rows, m, objs, view, tables,
                          via, distinct_safe, last_snapshot)

    record_lineage(view, metric, dim_objs)   # 新 M5：引擎执行副产品自动沉淀血缘（derived 展开记底层指标）
    if metric.agg == "derived":
        num_m = _metric(view, metric.derived_from[0])
        den_m = _metric(view, metric.derived_from[1])
        num, den = _one(num_m, dims), _one(den_m, dims)
        if derived_post_agg:             # M2：分子分母各自聚合后再相除
            return {k if k else (): round(num[k] / den[k], 2)
                    for k in sorted(num, key=none_safe)}
        # D7：先在子粒度出比值再无加权平均（average of averages）
        sub = [d.name for d in view.dimensions if d.table == metric.table]
        if not sub:
            return {(): round(num[()] / den[()], 2)}
        snum, sden = _one(num_m, sub), _one(den_m, sub)
        ratios = [snum[k] / sden[k] for k in sorted(snum, key=none_safe)]
        return {(): round(sum(ratios) / len(ratios), 2)}
    result = _one(metric, dims)
    return {k if k else (): result[k] for k in sorted(result, key=none_safe)}


# ---------------------------------------------------------------------------
# M4 + M6 · 目录、信号排序、冲突隔离
# ---------------------------------------------------------------------------

@dataclass
class CatalogEntry:
    name: str
    source: str                    # 'governed' | 'inferred' | 'legacy'
    authority: float               # governed=1.0；从少量查询推断=0.3
    popularity: int                # 使用计数（来自固定「查询日志」字面量）
    updated: date
    synonyms: tuple
    status: str = "ok"             # 'ok' | 'conflict' | 'rejected'
    superseded_by: str = ""        # legacy 条目：已被某 governed 定义取代（不参与冲突检测）
    view: SemanticView = None      # governed 条目：经 view+metric_name 编译
    metric_name: str = ""
    infer_table: str = ""          # 隐式条目的朴素执行规格
    infer_agg: str = ""            # 'sum' | 'count'
    infer_column: str = ""
    infer_dim_col: str = ""
    comment: str = ""


def freshness(updated: date) -> float:
    return 1 - min(1.0, (REF_DATE - updated).days / 730)


def _matches(entry: CatalogEntry, question: str) -> bool:
    """naive 双向子串匹配（确定性，无嵌入）：名称或任一同义词命中即相关。"""
    q = question.lower()
    return any(n.lower() in q or q in n.lower()
               for n in (entry.name,) + tuple(entry.synonyms))


def rank(entry: CatalogEntry, question: str) -> float:
    names = (entry.name,) + tuple(entry.synonyms)
    q = question.lower()
    relevance = 1.0 if any(n.lower() in q or q in n.lower() for n in names) else 0.0
    pop = math.log1p(entry.popularity) / math.log1p(POP_CAP)
    return (W_RELEVANCE * relevance + W_AUTHORITY * entry.authority
            + W_POPULARITY * pop + W_FRESHNESS * freshness(entry.updated))


def entry_definition(e: CatalogEntry) -> str:
    if e.source == "governed" and e.view:
        m = _metric(e.view, e.metric_name)
        return f"{m.agg}({m.table}.{m.column or '/'.join(m.derived_from)})"
    return f"{e.infer_agg}({e.infer_table}.{e.infer_column}) by {e.infer_dim_col or 'total'}"


class Catalog:
    def __init__(self):
        self.entries = []

    def register_view(self, view: SemanticView):
        for m in view.metrics:
            self.entries.append(CatalogEntry(
                name=m.name, source="governed", authority=1.0,
                popularity=5, updated=m.updated, synonyms=m.synonyms,
                view=view, metric_name=m.name, comment=m.comment))

    def register_inferred(self, entry: CatalogEntry):
        self.entries.append(entry)

    def detect_conflicts(self):
        """同名不同定义 → 双双标 conflict（不许机器自己挑，浮出人工裁决）。"""
        by_name = {}
        for e in self.entries:
            if e.superseded_by or e.status == "rejected":
                continue
            by_name.setdefault(e.name, []).append(e)
        conflicted = []
        for name, group in sorted(by_name.items()):
            defs = {entry_definition(e) for e in group}
            if len(defs) > 1:
                for e in group:
                    e.status = "conflict"
                conflicted.append(name)
        return conflicted

    def adjudicate(self, name: str, winner: str):
        for e in self.entries:
            if e.name == name:
                e.status = "ok" if (e.source == winner and not e.superseded_by) else (
                    "rejected" if e.source != winner else e.status)


# ---------------------------------------------------------------------------
# M5 · 检索激活 + mock agent
# ---------------------------------------------------------------------------

@dataclass
class ContextPackage:
    question: str
    entries: list                   # top-k 条目摘要
    instructions: str
    verified_query: VerifiedQuery = None
    tags: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)
    needs_adjudication: bool = False
    conflict_card: list = field(default_factory=list)


def resolve(catalog: Catalog, views, question: str, role: str,
            suggested_dims=None) -> ContextPackage:
    """agent 侧入口：混合匹配 top-k 上下文包（M5）+ 检索层治理（M3 第一层）。"""
    suggested_dims = suggested_dims or []
    visible = [e for e in catalog.entries if e.status != "rejected"]
    scored = sorted(((rank(e, question), e) for e in visible),
                    key=lambda p: (-p[0], -p[1].authority,
                                   -p[1].updated.toordinal(), p[1].name))
    top = scored[:TOP_K]
    pkg = ContextPackage(
        question=question,
        entries=[{"name": e.name, "source": e.source, "score": round(s, 3)}
                 for s, e in top],
        instructions="")
    if not top:
        pkg.warnings.append("no_context_found")
        return pkg
    # ---- 冲突浮出：CONFLICT 卡片，不给数字（M4 的核心纪律）----
    if top[0][1].status == "conflict":
        pkg.needs_adjudication = True
        pkg.conflict_card = [{"name": e.name, "source": e.source,
                              "definition": entry_definition(e)}
                             for e in visible
                             if e.name == top[0][1].name and e.status == "conflict"]
        pkg.warnings.append("conflicting_definitions: human adjudication required")
        return pkg
    best = top[0][1]
    # ---- 检索层治理：PRIVATE 维度建议对无权角色过滤（第二层在 compile）----
    if best.source == "governed" and best.view and role not in PRIVATE_ALLOWED:
        private = sorted({f.name for f in best.view.facts if f.visibility == "PRIVATE"}
                         & set(suggested_dims))
        if private:
            pkg.warnings.append(f"dim_filtered (PRIVATE): {private}")
    if best.source == "governed" and best.view:
        pkg.instructions = best.view.ai_instructions
        pkg.tags = dict(best.view.tags)
        for vq in best.view.verified_queries:
            if vq.question == question:
                pkg.verified_query = vq
    if best.source in ("inferred", "legacy") and not any(
            e.source == "governed" and _matches(e, question) for e in visible):
        pkg.warnings.append("no_governed_coverage")   # C1：治理定义未覆盖该问题域
    return pkg


def infer_compile(entry: CatalogEntry, dims):
    """隐式条目的朴素执行（无语义保障——grain 塌缩就照单全收）。"""
    rows = TABLES[entry.infer_table].rows
    out = {}
    for r in rows:
        col = entry.infer_dim_col
        if col:
            key = r[col][:7] if (col.endswith("date") and dims == ["month"]) else r[col]
        else:
            key = ()
        if entry.infer_agg == "sum":
            out.setdefault(key, 0)
            out[key] += r[entry.infer_column]
        else:
            out.setdefault(key, 0)
            out[key] += 1
    return {k: out[k] for k in sorted(out)}


def mock_agent(catalog: Catalog, pkg: ContextPackage, question: str, role: str,
               views, flags=None):
    """确定性 mock（对标 CoCo/Cortex Analyst）：
    命中 verified query → 短路重放；有 governed 指标 → compile；否则降级。"""
    flags = flags or {}
    if pkg.verified_query and question == pkg.verified_query.question:
        return {"path": "verified_query", "result": pkg.verified_query.result,
                "provenance": {"verified_by": pkg.verified_query.verified_by,
                               "verified_at": pkg.verified_query.verified_at}}
    if pkg.needs_adjudication or not pkg.entries:
        return {"path": "cannot_answer", "warnings": pkg.warnings}
    entry = next(e for e in catalog.entries if e.name == pkg.entries[0]["name"]
                 and e.status != "rejected")
    dims = []
    if "month" in question or "月" in question:
        dims.append("month")
    if "plan" in question:
        dims.append("plan")
    if any(w.startswith("dim_filtered") for w in pkg.warnings):
        dims = []                                    # 检索层已过滤 PRIVATE 维度建议
    if entry.source == "governed":
        view = next(v for v in views if any(m.name == entry.metric_name for m in v.metrics))
        result = compile_query(view, entry.metric_name, dims=dims, role=role, **flags)
    else:
        result = infer_compile(entry, dims)
    return {"path": "compile", "metric": entry.name, "dims": dims,
            "result": result, "warnings": pkg.warnings}


# ---------------------------------------------------------------------------
# M4 · eval 自纠环（金标准问答 → 修正理解 → 重排）
# ---------------------------------------------------------------------------

def eval_loop(catalog: Catalog, views, gold):
    """gold: [{'question','fix_metric','expected'}]。
    错配 → 修正（定义级：补 synonym；信号级：popularity 增减）→ 重排复测。"""
    report = []
    for g in gold:
        before = resolve(catalog, views, g["question"], "analyst")
        top_before = before.entries[0]["name"] if before.entries else None
        got = mock_agent(catalog, before, g["question"], "analyst", views)
        if got.get("result") == g["expected"]:
            report.append({"question": g["question"], "before": top_before,
                           "after": top_before, "fixed": True})
            continue
        # 定义级修复：governed 金标准补上缺失 synonym（最常见的自纠产物）
        for e in catalog.entries:
            if e.source == "governed" and e.metric_name == g["fix_metric"]:
                if g["question"] not in e.synonyms:
                    e.synonyms = tuple(sorted(e.synonyms + (g["question"],)))
                e.popularity = 50
        # 信号级修复：产出错答案的推断条目降 popularity
        for e in catalog.entries:
            if e.source != "governed" and e.name == top_before:
                e.popularity = 120
        after = resolve(catalog, views, g["question"], "analyst")
        top_after = after.entries[0]["name"] if after.entries else None
        got_after = mock_agent(catalog, after, g["question"], "analyst", views)
        report.append({"question": g["question"], "before": top_before,
                       "after": top_after,
                       "fixed": got_after.get("result") == g["expected"]})
    return report


# ---------------------------------------------------------------------------
# 新 M5/M6/M7 · 血缘账本 / 代理身份 / 分类标签（2026-09-17 重评审晋级机制）
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LineageEdge:
    src_table: str
    src_col: str
    dst_table: str
    dst_col: str
    origin: str                     # engine（执行自动沉淀）| external（OpenLineage 摄取）


LINEAGE_LEDGER: list = []           # 内外合流的单一账本（插入幂等去重）


def record_lineage(view: SemanticView, metric: Metric, dim_objs):
    """引擎执行副产品：编译查询时自动沉淀列级依赖边（原生列级血缘，无盲区）。

    derived 指标自身无物理列，展开为分子/分母底层指标各记一条边——
    引擎执行过的任何查询（含派生口径）都可事后溯源。
    """
    base = ([_metric(view, n) for n in metric.derived_from]
            if metric.agg == "derived" else [metric])
    edges = [LineageEdge(m.table, m.column, view.name,
                         f"metric:{m.name}", "engine") for m in base]
    for d in dim_objs:
        edges.append(LineageEdge(d.table, d.column, view.name, f"dim:{d.name}",
                                 "engine"))
    for e in edges:
        if e not in LINEAGE_LEDGER:
            LINEAGE_LEDGER.append(e)


def get_lineage(table=None, column=None):
    """对标 GET_LINEAGE：程序化查询列级上下游（一年保留的投影面）。"""
    return sorted((e for e in LINEAGE_LEDGER
                   if (table is None or e.src_table == table or e.dst_table == table)
                   and (column is None or e.src_col == column or e.dst_col == column)),
                  key=lambda e: (e.src_table, e.src_col, e.dst_table, e.dst_col))


class LineageIngestError(Exception):
    pass


def ingest_external_lineage(event, *, has_ingest_privilege=True, tables=TABLES,
                            strict_resolve=True):
    """对标 External Lineage REST 端点：OpenLineage 事件进门三道闸。

    ①调用方须持账户级 INGEST LINEAGE 权限；②只接受 COMPLETE 事件；
    ③snowflake:// 命名空间引用的对象必须全部可解析——任一不满足，整事件拒绝。
    columnLineage facet 的列级映射并入同一账本（内外单一账本，不分家）。
    """
    if not has_ingest_privilege:
        raise LineageIngestError("caller lacks INGEST LINEAGE privilege")
    if event.get("eventType") != "COMPLETE":
        raise LineageIngestError("only COMPLETE events are accepted")
    for side in ("inputs", "outputs"):
        for ds in event.get(side, []):
            if str(ds.get("namespace", "")).startswith("snowflake://"):
                if strict_resolve and ds["name"].split(".")[-1] not in tables:
                    raise LineageIngestError(
                        f"unresolvable Snowflake object: {ds['name']}")
    n = 0
    for out in event.get("outputs", []):
        dst = out["name"].split(".")[-1]
        fields = (out.get("facets", {}).get("columnLineage", {})
                  .get("fields", {}))
        for dst_col, spec in sorted(fields.items()):
            for inf in spec.get("inputFields", []):
                src_parts = inf["name"].split(".")
                edge = LineageEdge(src_parts[0], src_parts[-1], dst, dst_col,
                                   "external")
                if edge not in LINEAGE_LEDGER:
                    LINEAGE_LEDGER.append(edge)
                n += 1
    return n


# ---- 新 M6 · Agent Identity：代理身份与会话权限天花板 ----

USER_PERMS = {                          # 用户直接权限（统一 RBAC 现状）
    "data_governance": {"use:sales_sv", "select:orders", "select:customers"},
    "intern": {"use:sales_sv"},
}
AGENT_SERVICE_ALLOWED = {"use:sales_sv", "select:orders"}   # 代理服务允许面
AGENT_STRICT_DENY = {"select:customers"}  # IS_AGENT_ACTIVATED：代理会话叠加更严拒绝面


@dataclass
class AgentSession:
    user: str
    agent: str
    perms: frozenset
    agent_type: str = "assistant"       # 对标 QUERY_HISTORY.agent_type 审计列
    ceiling: bool = True                # 天花板会话：判定时实时求值，非冻结快照


QUERY_LOG: list = []                    # 对标 QUERY_HISTORY / ACCESS_HISTORY.agents_info


def agent_session(user, agent="cortex-agent", *, ceiling=True):
    """Restricted Session Scope：会话实际权限 = 用户权限 ∩ 代理允许面（只减不增）。

    天花板会话（ceiling=True）不冻结权限快照——session_allows 每次判定时实时
    重求交，用户权限被回收即刻生效（E2b/D9 的实时性断言即测试此语义）。
    ceiling=False 模拟退化实现：创建时拿用户全量并冻结快照——用户后续回收
    权限不影响既有会话（D9 的越权窗口）。
    """
    base = USER_PERMS[user]
    perms = (base & AGENT_SERVICE_ALLOWED) if ceiling else base
    return AgentSession(user, agent, frozenset(perms), ceiling=ceiling)


def audit_log(session: AgentSession, action: str):
    QUERY_LOG.append({"action": action, "user": session.user,
                      "agent": session.agent, "agent_type": session.agent_type})
    return QUERY_LOG[-1]


def session_allows(session: AgentSession, perm: str) -> bool:
    """代理会话权限判定：天花板 ∩ 代理严拒面（身份语义归 M6，谓词消费面见 M2）。

    天花板会话在判定时实时求值 USER_PERMS[user] ∩ AGENT_SERVICE_ALLOWED——
    权限天花板是查询期语义而非登录期快照（对标 RSS "privileges that are
    revoked ... take effect immediately"，无缓存过期窗口）。
    """
    if session.agent_type and perm in AGENT_STRICT_DENY:
        return False
    if session.ceiling:
        return perm in (USER_PERMS[session.user] & AGENT_SERVICE_ALLOWED)
    return perm in session.perms


# ---- 新 M7 · 分类与标签驱动策略传播 ----

CLASSIFY_HINTS = {                      # 自动分类扫描：列名 → 系统分类标签
    "phone": "CONTACT_INFO", "email": "CONTACT_INFO", "ssn": "CONTACT_INFO",
    "plan": "BUSINESS_INFO",
}
TAG_MAPPING = {"CONTACT_INFO": "pii"}   # 一次性映射：系统标签 → 用户治理标签
                                         #（官方限制：掩码策略不能直接绑定系统标签）
TAG_POLICY = {"pii": "MASK_FULL"}       # 用户标签 → 策略


def classify(table: Table) -> dict:
    """分类扫描：为每列打系统标签（发现 → 标记）。"""
    return {(table.name, c): CLASSIFY_HINTS[c] for c in table.columns
            if c in CLASSIFY_HINTS}


def policy_for(system_tags, table_name, col, mapping=TAG_MAPPING):
    """标记 → 执行：系统标签经一次性映射到用户标签后驱动策略；未映射 = 保护缺口。"""
    tag = system_tags.get((table_name, col))
    user_tag = mapping.get(tag) if tag else None
    policy = TAG_POLICY.get(user_tag) if user_tag else None
    return policy, tag, user_tag


def project_cell(value, table_name, col, system_tags, mapping=TAG_MAPPING):
    """列值出口投影：命中标签绑定策略即脱敏（发现→标记→执行 链条的执行端）。"""
    policy, _, _ = policy_for(system_tags, table_name, col, mapping)
    return "██" if policy == "MASK_FULL" and value is not None else value


# ---------------------------------------------------------------------------
# 装配（governed 视图 + 推断层条目）
# ---------------------------------------------------------------------------

CATALOG = Catalog()
SALES, DAU_SV = build_sales_view(), build_dau_view()
CATALOG.register_view(SALES)
CATALOG.register_view(DAU_SV)
CATALOG.register_inferred(CatalogEntry(          # 从 BI 日志挖出：sum(dau)（grain 塌缩）
    name="active_users", source="inferred", authority=0.3, popularity=200,
    updated=date(2024, 3, 1), synonyms=("月活", "monthly active users", "mau"),
    infer_table="daily_active_users", infer_agg="sum",
    infer_column="active_users", infer_dim_col="activity_date",
    comment="inferred from BI dashboards（日汇总直接相加）"))
CATALOG.register_inferred(CatalogEntry(          # 迁移后遗留的旧 governed 口径
    name="revenue", source="legacy", authority=1.0, popularity=50,
    updated=date(2024, 3, 1), synonyms=("sales", "毛收入"), superseded_by="sales_sv.revenue",
    infer_table="orders", infer_agg="sum", infer_column="total", infer_dim_col="month",
    comment="已被 sales_sv.revenue 取代但未退役（freshness 隔离对照组）"))
CATALOG.register_inferred(CatalogEntry(          # 查询日志挖出：count(events)
    name="active_customers", source="inferred", authority=0.3, popularity=80,
    updated=date(2025, 1, 10), synonyms=("活跃用户",),
    infer_table="events", infer_agg="count", infer_column="id",
    infer_dim_col="", comment="inferred: count(events) —— 数的是事件不是人"))
CATALOG.register_inferred(CatalogEntry(          # 新业务表：只有查询日志挖得出的定义
    name="spend", source="inferred", authority=0.3, popularity=80,
    updated=date(2026, 9, 1), synonyms=("marketing spend", "营销支出"),
    infer_table="marketing_spend", infer_agg="sum", infer_column="spend",
    infer_dim_col="channel", comment="inferred from recent query logs"))
VIEWS = (SALES, DAU_SV)


# ---------------------------------------------------------------------------
# selftest：场景矩阵（A 正常 / B 陷阱 / C 边缘）+ 破坏性实验（D）
# ---------------------------------------------------------------------------

FAILURES = []


def expect(sid, cond, detail):
    mark = "PASS" if cond else "FAIL"
    print(f"  [{mark}] {sid}: {detail}")
    if not cond:
        FAILURES.append(sid)


def scenario_A():
    print("— A 正常路径 —")
    pkg = resolve(CATALOG, VIEWS, "revenue by month", "analyst")
    got = mock_agent(CATALOG, pkg, "revenue by month", "analyst", VIEWS)
    expect("A1", got["path"] == "verified_query"
           and got["result"] == {"2026-01": 200, "2026-02": 150, "2026-03": 300}
           and got["provenance"]["verified_by"] == "( data_governance = data-team@acme.com )"
           and got["provenance"]["verified_at"] == "2026-08-20",
           f"verified 短路重放 + 溯源: {got['path']} {got['result']} "
           f"by {got.get('provenance', {}).get('verified_by')}")
    engine = compile_query(SALES, "revenue", dims=["month"])
    expect("A1b", [engine[k] for k in sorted(engine)] == [200, 150, 300],
           f"引擎重算 == 验证答案（对账一致）: {[engine[k] for k in sorted(engine)]}")
    m = compile_query(SALES, "aov", dims=["month"])
    t = compile_query(SALES, "aov", dims=[])
    expect("A2", [m[k] for k in sorted(m)] == [66.67, 150.0, 150.0] and t == {(): 108.33},
           f"aov derived 先聚后除: 月 {[m[k] for k in sorted(m)]} / 总 {t[()]}")
    ac = compile_query(SALES, "active_customers", dims=["month"])
    fan_sum = compile_query(SALES, "revenue", dims=["month"], agg_before_join=False)
    fan_ac = compile_query(SALES, "active_customers", dims=["month"],
                           agg_before_join=False)
    total_ac = compile_query(SALES, "active_customers", dims=[])
    expect("A3", [ac[k] for k in sorted(ac)] == [3, 1, 2]
           and [fan_sum[k] for k in sorted(fan_sum)] == [440, 150, 300]
           and [fan_ac[k] for k in sorted(fan_ac)] == [3, 1, 2]
           and sum(ac.values()) == 6 and total_ac == {(): 5},
           f"distinct 跨 join 安全: 正常 {[ac[k] for k in sorted(ac)]}；fan-join 下 "
           f"SUM=440 而 distinct 仍 {[fan_ac[k] for k in sorted(fan_ac)]}；"
           f"月格相加 6 ≠ 总体重算 5")
    buyer = compile_query(SALES, "revenue", dims=["customer_name"], via="buyer")
    ref = compile_query(SALES, "revenue", dims=["customer_name"], via="referrer")
    try:
        compile_query(SALES, "revenue", dims=["customer_name"])
        amb = "no-error"
    except AmbiguousJoinPath:
        amb = "AmbiguousJoinPath"
    expect("A4", sorted(buyer.values()) == [40, 50, 60, 250, 250]
           and sorted(ref.values()) == [100, 250]
           and amb == "AmbiguousJoinPath",
           f"USING 消歧: buyer {sorted(buyer.values())}"
           f" / referrer {sorted(ref.values())}"
           f" / 省略 via → {amb}")


def scenario_B():
    print("— B 陷阱路径（引擎保障 vs 朴素 join-then-agg）—")
    correct = compile_query(SALES, "revenue", dims=["month"])
    naive = compile_query(SALES, "revenue", dims=["month"], agg_before_join=False)
    expect("B1", [correct[k] for k in sorted(correct)] == [200, 150, 300]
           and [naive[k] for k in sorted(naive)] == [440, 150, 300],
           "fan trap: 引擎 Jan=200 vs 朴素 Jan=440（o1 的 3 条事件把 $100 变 $300）")
    total = compile_query(SALES, "aov", dims=[])
    avg_of_avg = compile_query(SALES, "aov", dims=[], derived_post_agg=False)
    expect("B2", total == {(): 108.33} and avg_of_avg == {(): 122.22},
           f"average of averages: 先聚后除 {total[()]} vs 月均值的均值 {avg_of_avg[()]}")
    broken = compile_query(SALES, "active_customers", dims=["month"],
                           agg_before_join=False, distinct_safe=False)
    expect("B3", [broken[k] for k in sorted(broken)] == [6, 1, 2],
           f"拆 distinct: 退化为数事件行 {[broken[k] for k in sorted(broken)]}（对照 [3,1,2]）")
    snap = compile_query(DAU_SV, "active_users_last", dims=["month"])
    naive_sum = compile_query(DAU_SV, "active_users_last", dims=["month"],
                              last_snapshot=False)
    expect("B4", [snap[k] for k in sorted(snap)] == [5, 6, 7]
           and [naive_sum[k] for k in sorted(naive_sum)] == [11, 6, 7]
           and compile_query(DAU_SV, "active_users_last", dims=[]) == {(): 7}
           and compile_query(DAU_SV, "active_users_last", dims=[],
                             last_snapshot=False) == {(): 24},
           f"NON ADDITIVE: 末快照 [5,6,7] vs 求和 [11,6,7]；全期 7 vs 24")


def scenario_C():
    print("— C 边缘路径 —")
    pkg = resolve(CATALOG, VIEWS, "marketing spend by channel", "analyst")
    got = mock_agent(CATALOG, pkg, "marketing spend by channel", "analyst", VIEWS)
    covered = sorted({t for v in VIEWS for t in v.tables})
    expect("C1", "no_governed_coverage" in pkg.warnings
           and got["result"] == {"social": 105, "search": 155}
           and pkg.entries[0]["source"] == "inferred",
           f"新表无 SV: inferred 条目胜出 + 警告 {pkg.warnings}；覆盖 "
           f"{len(covered)}/{len(TABLES)} 表")
    pkg2 = resolve(CATALOG, VIEWS, "revenue by plan", "intern", suggested_dims=["plan"])
    got2 = mock_agent(CATALOG, pkg2, "revenue by plan", "intern", VIEWS)
    try:
        compile_query(SALES, "revenue", dims=["plan"], role="intern", via="buyer")
        denied = "no-error"
    except AccessDenied:
        denied = "AccessDenied"
    expect("C2", denied == "AccessDenied"
           and any(w.startswith("dim_filtered") for w in pkg2.warnings)
           and got2["path"] == "compile" and got2["result"] == {(): 650},
           f"RBAC 双层: 检索层对 intern 过滤 plan 建议（{[w for w in pkg2.warnings]}，"
           f"降级总量 {got2['result']}）；直闯执行层 → {denied}（引擎是最后防线）")
    conflicts = CATALOG.detect_conflicts()
    pkg3 = resolve(CATALOG, VIEWS, "活跃用户数", "analyst")
    got3 = mock_agent(CATALOG, pkg3, "活跃用户数", "analyst", VIEWS)
    try:
        compile_query(SALES, "active_customers", dims=["month"], catalog=CATALOG)
        conf = "no-error"
    except ConflictingDefinitionError:
        conf = "ConflictingDefinitionError"
    expect("C3", conflicts == ["active_customers"] and pkg3.needs_adjudication
           and got3["path"] == "cannot_answer" and len(pkg3.conflict_card) == 2
           and conf == "ConflictingDefinitionError",
           f"冲突浮出: CONFLICT 卡片 {[(c['source'], c['definition']) for c in pkg3.conflict_card]}"
           f"（无数值）；agent 拒答；compile → {conf}")
    CATALOG.adjudicate("active_customers", "governed")
    pkg3b = resolve(CATALOG, VIEWS, "活跃客户 by month", "analyst")
    got3b = mock_agent(CATALOG, pkg3b, "活跃客户 by month", "analyst", VIEWS)
    expect("C3b", got3b["path"] == "compile"
           and [got3b["result"][k] for k in sorted(got3b["result"])] == [3, 1, 2],
           f"人工裁决（governed 胜）后恢复: {[got3b['result'][k] for k in sorted(got3b['result'])]}")
    gold = [{"question": "月活", "fix_metric": "active_customers",
             "expected": {("2026-01",): 3, ("2026-02",): 1, ("2026-03",): 2}}]
    cat2 = Catalog()
    sv, dv = build_sales_view(), build_dau_view()
    cat2.register_view(sv)
    cat2.register_view(dv)
    cat2.register_inferred(CatalogEntry(
        name="active_users", source="inferred", authority=0.3, popularity=200,
        updated=date(2024, 3, 1), synonyms=("月活",),
        infer_table="daily_active_users", infer_agg="sum",
        infer_column="active_users", infer_dim_col="activity_date"))
    rep = eval_loop(cat2, (sv, dv), gold)
    expect("C4", rep[0]["before"] == "active_users" and rep[0]["after"] == "active_customers"
           and rep[0]["fixed"],
           f"自纠环: 错配前 top1={rep[0]['before']}（sum(dau)=[11,6,7] 错）→ 补 synonym + "
           f"调信号 → top1={rep[0]['after']}（count_distinct=[3,1,2] 对）")
    pkg5 = resolve(CATALOG, VIEWS, "sales", "analyst")
    expect("C5", pkg5.entries[0]["name"] == "revenue"
           and pkg5.entries[0]["source"] == "governed",
           f"freshness 隔离: 'sales' → governed revenue(fresh="
           f"{freshness(date(2026, 8, 15)):.2f}) 压过 legacy(0.00): "
           f"{[(e['name'], e['source'], e['score']) for e in pkg5.entries]}")


def scenario_E():
    print("— E 重评审晋级机制（血缘账本 / 代理身份 / 分类标签）—")
    # E1 端到端列级血缘：引擎执行自动沉淀 + OpenLineage 外部摄取 + 单一账本
    compile_query(SALES, "revenue", dims=["month"])
    compile_query(SALES, "revenue", dims=["plan"], via="buyer")
    compile_query(SALES, "aov", dims=[])        # derived 同样沉淀：展开为底层指标记边
    engine_edges = get_lineage("orders", "total")
    derived_edges = get_lineage("orders", "id")   # order_count 仅经 aov 展开触达
    ingest_external_lineage({
        "eventType": "COMPLETE",
        "inputs":  [{"namespace": "postgres://etl", "name": "app_db.users"}],
        "outputs": [{"namespace": "snowflake://acme", "name": "analytics.customers",
                     "facets": {"columnLineage": {"fields": {
                         "plan": {"inputFields": [{"name": "app_db.users.tier"}]}}}}}],
    })
    ext_edges = get_lineage("customers", "plan")
    expect("E1", any(e.dst_col == "metric:revenue" and e.origin == "engine"
                     for e in engine_edges)
           and any(e.dst_col == "metric:order_count" and e.origin == "engine"
                   for e in derived_edges)
           and any(e.src_col == "tier" and e.dst_col == "plan"
                   and e.origin == "external" for e in ext_edges),
           f"列级血缘同账本: 引擎沉淀 orders.total→{engine_edges[0].dst_table}."
           f"metric:revenue（derived aov 展开记底层 order_count 边）；OpenLineage 摄取 "
           f"app_db.users.tier→customers.plan（origin 各异、账本唯一）")
    rejected = []
    n_before = len(LINEAGE_LEDGER)
    for bad, kw in (
        ({"eventType": "START", "outputs": []}, {}),                       # 非 COMPLETE
        ({"eventType": "COMPLETE", "outputs": [
            {"namespace": "snowflake://acme", "name": "analytics.no_such"}]}, {}),  # 不可解析
        ({"eventType": "COMPLETE", "outputs": []},
         {"has_ingest_privilege": False}),                                 # 无 INGEST 权限
    ):
        try:
            ingest_external_lineage(bad, **kw)
            rejected.append("accepted")
        except LineageIngestError:
            rejected.append("rejected")
    expect("E1b", rejected == ["rejected"] * 3 and len(LINEAGE_LEDGER) == n_before,
           f"摄取三道闸: 非 COMPLETE / 对象不可解析 / 无 INGEST 权限 → 整事件拒绝"
           f" {rejected}（账本零污染）")
    # E2 Agent Identity：天花板只减不增 + agent_type 审计 + 代理严拒面
    sess = agent_session("data_governance")
    agent_entry = audit_log(sess, "compile: revenue by month")
    expect("E2", sess.perms == frozenset({"use:sales_sv", "select:orders"})
           and sess.perms <= frozenset(USER_PERMS["data_governance"])
           and agent_entry["agent_type"] == "assistant"
           and not session_allows(sess, "select:customers"),
           f"代理身份: 会话权限=用户∩代理面 {sorted(sess.perms)}（只减不增）；"
           f"审计 agent_type=assistant；IS_AGENT_ACTIVATED 下 select:customers"
           f" 被拒（用户本人可查）")
    USER_PERMS["data_governance"].discard("select:orders")
    expect("E2b", not session_allows(sess, "select:orders")
           and session_allows(sess, "use:sales_sv"),
           "天花板实时性: 回收 select:orders 后，既有会话判定即刻失去、其余权限"
           "不受牵连（查询期实时求值，无快照过期窗口）")
    USER_PERMS["data_governance"].add("select:orders")            # 还原
    # E3 分类与标签驱动策略传播：自动分类 + 一次性映射 + 新列自动纳入 + 缺口如实
    base_tags = classify(CUSTOMERS)                 # 漂移前：无敏感列
    drifted = Table("customers", ("id", "name", "plan", "phone", "ssn"), ("id",),
                    [dict(r, phone="13800000000", ssn="X-111")
                     for r in CUSTOMERS.rows])      # schema 漂移：新增 phone/ssn
    drift_tags = classify(drifted)
    phone = project_cell("13800000000", "customers", "phone", drift_tags)
    ssn = project_cell("X-111", "customers", "ssn", drift_tags)
    plan_out = project_cell("pro", "customers", "plan", drift_tags)
    gap_policy, gap_tag, gap_user = policy_for(drift_tags, "customers", "plan")
    expect("E3", ("customers", "phone") not in base_tags
           and phone == "██" and ssn == "██" and plan_out == "pro"
           and gap_policy is None and gap_tag == "BUSINESS_INFO"
           and gap_user is None,
           f"分类标签: 漂移新列 phone/ssn 自动分类→pii→MASK_FULL（无需人工登记）；"
           f"plan→BUSINESS_INFO 未映射=显式缺口（掩码不可直绑系统标签，"
           f"须先配一次性映射）")


def destructive():
    print("— D 破坏性实验（每次只拆一个机制，改动=一个 flag/一行）—")
    naive = compile_query(SALES, "revenue", dims=["month"], agg_before_join=False)
    expect("D1", [naive[k] for k in sorted(naive)] == [440, 150, 300],
           "拆 agg-before-join → Jan 440（对照 200）")
    d2 = compile_query(SALES, "active_customers", dims=["month"],
                       agg_before_join=False, distinct_safe=False)
    expect("D2", [d2[k] for k in sorted(d2)] == [6, 1, 2],
           "拆 distinct 安全 → [6,1,2]（对照 [3,1,2]）")
    d3 = compile_query(DAU_SV, "active_users_last", dims=["month"], last_snapshot=False)
    expect("D3", [d3[k] for k in sorted(d3)] == [11, 6, 7],
           "拆 NON ADDITIVE → [11,6,7]（对照 [5,6,7]）")
    # D4：冲突策略改成 auto_popularity（拿掉「浮出人工」这条线）
    cat = Catalog()
    cat.register_view(build_sales_view())
    cat.register_inferred(CatalogEntry(
        name="active_customers", source="inferred", authority=0.3, popularity=200,
        updated=date(2025, 1, 10), synonyms=("活跃用户",),
        infer_table="events", infer_agg="count", infer_column="id", infer_dim_col=""))
    auto = sorted((e for e in cat.entries if e.name == "active_customers"),
                  key=lambda e: (-e.popularity, e.name))[0]
    months = {"2026-01": 0, "2026-02": 0, "2026-03": 0}
    order_month = {o["id"]: o["month"] for o in ORDERS.rows}
    for r in EVENTS.rows:
        months[order_month[r["order_id"]]] += 1
    expect("D4", auto.source == "inferred"
           and [months[k] for k in sorted(months)] == [6, 1, 2],
           "冲突改 auto_popularity → 推断层(count events) 胜出 [6,1,2]（对照 [3,1,2]）"
           "—— 477 vs 48 事故的玩具版")
    try:
        compile_query(SALES, "revenue", dims=["plan"], role="intern", via="buyer")
        leak = "LEAKED"
    except AccessDenied:
        leak = "blocked"
    d5 = compile_query(SALES, "revenue", dims=["plan"], role="intern", via="buyer",
                       enforce_rbac=False)
    expect("D5", leak == "blocked"
           and [d5[k] for k in sorted(d5)] == [90, 560],
           f"拆 RBAC → intern 按 plan 拿到 [90,560]（泄露发生）；装回 → {leak}")
    bad = SemanticView(
        name="bad_sv", tables=("orders", "customers"),
        relationships=(Relationship("bad", "orders", ("customer_id",),
                                    "customers", ("plan",)),),   # 指向非键列！
        facts=(), dimensions=(Dim("month", "orders", "month"),),
        metrics=(Metric("revenue", "sum", "orders", "total"),))
    errs = validate_view(bad, TABLES)
    expect("D6", bool(errs) and any("not PRIMARY KEY/UNIQUE" in e for e in errs),
           f"拆结构校验（relationship 指向非键列）→ {'; '.join(errs)}"
           f"—— 无门则垃圾定义静默入库（行数失控的注册期引信）")
    d7 = compile_query(SALES, "aov", dims=[], derived_post_agg=False)
    expect("D7", d7 == {(): 122.22}, "拆 derived 先聚后除 → 122.22（对照 108.33）")
    # D8：拆血缘摄取的「对象可解析」闸 → 虚构对象边静默入账本
    n0 = len(LINEAGE_LEDGER)
    ingest_external_lineage(
        {"eventType": "COMPLETE",
         "outputs": [{"namespace": "snowflake://acme", "name": "analytics.ghost",
                      "facets": {"columnLineage": {"fields": {
                          "x": {"inputFields": [{"name": "raw.y"}]}}}}}]},
        strict_resolve=False)
    ghost = [e for e in LINEAGE_LEDGER if e.dst_table == "ghost"]
    expect("D8", len(ghost) == 1 and len(LINEAGE_LEDGER) == n0 + 1,
           f"拆血缘解析闸 → 虚构对象入账（raw.y→ghost.x）——账本与真实数据流"
           f"脱钩，事后对账从此不可信")
    LINEAGE_LEDGER.remove(ghost[0])      # 还原账本，不污染后续
    # D9：拆会话权限天花板 → 用户回收后，快照式旧会话仍持权（两会话均在回收前创建，
    # 唯一差异 = ceiling 快照/实时——对照 D 系列单变量纪律）
    stale = agent_session("data_governance", ceiling=False)     # 全量快照（回收前）
    live = agent_session("data_governance")                     # 天花板会话（回收前）
    USER_PERMS["data_governance"].discard("select:orders")      # 回收时刻
    leaky = session_allows(stale, "select:orders")
    live_ok = session_allows(live, "select:orders")
    USER_PERMS["data_governance"].add("select:orders")          # 还原
    expect("D9", leaky and not live_ok,
           "拆权限天花板（快照冻结）→ 回收后旧会话仍持 select:orders（越权窗口）；"
           "对照：同时创建的天花板会话判定时实时求值，同一时刻立即失去——不存在"
           "「上次办的工牌还能用」的窗口")
    # D10：拆「系统标签→用户标签」一次性映射 → 已分类敏感列明文出楼
    tags = classify(CUSTOMERS)
    leaked = project_cell("13800000000", "customers", "phone", tags, mapping={})
    expect("D10", leaked == "13800000000",
           "拆标签映射（只分类不绑策略）→ phone 已贴系统标签仍明文出楼"
           "——发现→标记→执行 链条断在最后一环")


def main():
    print("=" * 72)
    print("Horizon Context 最小原型实验室 · M1-M7 机制自洽验证")
    print(f"确定性基准: REF_DATE={REF_DATE}  POP_CAP={POP_CAP}  "
          f"排序权重 R/A/P/F = {W_RELEVANCE}/{W_AUTHORITY}/{W_POPULARITY}/{W_FRESHNESS}")
    print("=" * 72)
    errs = validate_view(SALES, TABLES) + validate_view(DAU_SV, TABLES)
    expect("V0", errs == [], f"演示视图结构校验通过（错误清单应为空）: {errs}")
    scenario_A()
    scenario_B()
    scenario_C()
    scenario_E()
    destructive()
    print("=" * 72)
    covered = sorted({t for v in VIEWS for t in v.tables})
    print(f"目录: {len(CATALOG.entries)} 条（governed 视图覆盖 {len(covered)}/{len(TABLES)} 表）")
    if FAILURES:
        print(f"SELFTEST FAILED ✘ ({len(FAILURES)}): {FAILURES}")
        sys.exit(1)
    print("SELFTEST PASSED ✔")


if __name__ == "__main__":
    main()
