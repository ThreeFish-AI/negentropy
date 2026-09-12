#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Horizon Context 最小 MCP 服务原型（guided-learn Phase 4 · 平台集成路径）。

用纯标准库实现 MCP stdio 传输（JSON-RPC 2.0 行协议），把主原型的目录/检索/
编译/反馈暴露给任意外部 agent（Claude Code / Claude Desktop / Cursor 添加
custom connector 即可接入）——对标 Horizon Context「经 MCP 对外供外部 agent
受治理数据访问」的激活路径。

四个工具（全部确定性）：
  list_context_objects(role)          目录条目 + 信任信号（RBAC 过滤后）
  resolve_context(question, role)     混合匹配 top-k 上下文包（含 CONFLICT 卡片路径）
  compile_metric(metric, dims, ...)   受治理查询编译（引擎层 RBAC 兜底）
  report_feedback(name, verdict)      行为反馈写回 popularity（Behavioral 闭环）

自测：uv run --no-project python horizon_context_mcp.py --selftest
  进程内走 handle_request 断言全链路 + 真实子进程 stdio 往返冒烟。
真实 agent 客户端连接（手动步骤）：
  Claude Code: claude mcp add horizon-context -- <本文件绝对路径>
  Claude Desktop: Settings → Connectors → Custom connector → 命令指向本文件。
"""

from __future__ import annotations

import json
import subprocess
import sys

from horizon_context_lab import (CATALOG, POP_CAP, PRIVATE_ALLOWED, VIEWS,
                                  AccessDenied, AmbiguousJoinPath,
                                  ConflictingDefinitionError, compile_query,
                                  freshness, resolve)

PROTOCOL = "2025-06-18"
SERVER_INFO = {"name": "horizon-context-lab", "version": "0.1.0"}

TOOLS = [
    {"name": "list_context_objects",
     "description": "List governed + inferred context objects with trust signals "
                    "(authority/popularity/freshness), filtered by role.",
     "inputSchema": {"type": "object",
                     "properties": {"role": {"type": "string",
                                             "enum": ["analyst", "intern"],
                                             "default": "analyst"}}}},
    {"name": "resolve_context",
     "description": "Resolve a natural-language question into a top-k context "
                    "package (definitions, instructions, verified query, warnings).",
     "inputSchema": {"type": "object", "required": ["question"],
                     "properties": {"question": {"type": "string"},
                                    "role": {"type": "string",
                                             "enum": ["analyst", "intern"],
                                             "default": "analyst"}}}},
    {"name": "compile_metric",
     "description": "Compile a governed metric at query grain. Enforces engine-level "
                    "RBAC and join-path disambiguation (via).",
     "inputSchema": {"type": "object", "required": ["metric"],
                     "properties": {"metric": {"type": "string"},
                                    "dims": {"type": "array", "items": {"type": "string"},
                                             "default": []},
                                    "via": {"type": "string"},
                                    "role": {"type": "string",
                                             "enum": ["analyst", "intern"],
                                             "default": "analyst"}}}},
    {"name": "report_feedback",
     "description": "Feed usage signal back: verdict up/down adjusts popularity "
                    "(±50, clamped to [0, POP_CAP]) and re-ranks future resolves.",
     "inputSchema": {"type": "object", "required": ["name", "verdict"],
                     "properties": {"name": {"type": "string"},
                                    "verdict": {"type": "string",
                                                "enum": ["up", "down"]},
                                    "source": {"type": "string"}}}},
]

_FEEDBACK_STEP = 50


def _find_metric_view(metric: str):
    for v in VIEWS:
        if any(m.name == metric for m in v.metrics):
            return v
    return None


def _entry_private(e) -> bool:
    """governed 条目的可见性取自其 backing 指标声明（inferred 无此语义，恒可见）。"""
    if e.source != "governed" or not e.view:
        return False
    metric = next((x for x in e.view.metrics if x.name == e.metric_name), None)
    return metric is not None and metric.visibility == "PRIVATE"


def _t_list_objects(args):
    role = args.get("role", "analyst")
    items = []
    for e in CATALOG.entries:
        if e.status == "rejected":
            continue
        if role not in PRIVATE_ALLOWED and _entry_private(e):  # 检索层 RBAC 过滤
            continue
        items.append({"name": e.name, "source": e.source, "authority": e.authority,
                      "popularity": e.popularity,
                      "freshness": round(freshness(e.updated), 3),
                      "updated": e.updated.isoformat(), "status": e.status,
                      "definition": (e.comment or "")[:60]})
    return {"role": role, "objects": items}


def _t_resolve(args):
    pkg = resolve(CATALOG, VIEWS, args["question"], args.get("role", "analyst"))
    out = {"question": pkg.question, "entries": pkg.entries,
           "instructions": pkg.instructions, "warnings": pkg.warnings,
           "needs_adjudication": pkg.needs_adjudication,
           "conflict_card": pkg.conflict_card}
    if pkg.verified_query:
        out["verified_query"] = {"question": pkg.verified_query.question,
                                 "sql": pkg.verified_query.sql_text,
                                 "verified_by": pkg.verified_query.verified_by,
                                 "verified_at": pkg.verified_query.verified_at}
    return out


def _t_compile(args):
    view = _find_metric_view(args["metric"])
    if view is None:
        raise KeyError(f"unknown metric: {args['metric']}")
    result = compile_query(view, args["metric"], dims=args.get("dims", []),
                           role=args.get("role", "analyst"), via=args.get("via"),
                           catalog=CATALOG)
    return {"metric": args["metric"], "dims": args.get("dims", []),
            "result": {str(k): v for k, v in result.items()}}


def _t_feedback(args):
    delta = _FEEDBACK_STEP if args["verdict"] == "up" else -_FEEDBACK_STEP
    hit = [e for e in CATALOG.entries if e.name == args["name"]
           and (not args.get("source") or e.source == args["source"])]
    if not hit:
        raise KeyError(f"unknown context object: {args['name']}")
    for e in hit:
        e.popularity = max(0, min(POP_CAP, e.popularity + delta))
    return {"name": args["name"], "verdict": args["verdict"],
            "popularity": {e.source: e.popularity for e in hit}}


_TOOL_FUNCS = {"list_context_objects": _t_list_objects,
               "resolve_context": _t_resolve,
               "compile_metric": _t_compile,
               "report_feedback": _t_feedback}


class ToolError(Exception):
    pass


def handle_request(msg: dict):
    """处理单条 JSON-RPC 消息；notification 返回 None。"""
    method = msg.get("method")
    msg_id = msg.get("id")
    is_notification = "id" not in msg

    def reply(result=None, error=None):
        if is_notification:
            return None
        out = {"jsonrpc": "2.0", "id": msg_id}
        if error:
            out["error"] = error
        else:
            out["result"] = result
        return out

    if method == "initialize":
        # 仅回应自身支持版（MCP 版本协商：客户端请求的版本不支持时不回显）
        return reply({"protocolVersion": PROTOCOL, "capabilities": {"tools": {}},
            "serverInfo": SERVER_INFO,
            "instructions": "Governed context layer toy server (Horizon Context lab)."})
    if method in ("notifications/initialized", "notifications/cancelled"):
        return None
    if method == "ping":
        return reply({})
    if method == "tools/list":
        return reply({"tools": TOOLS})
    if method == "tools/call":
        params = msg.get("params", {})
        name = params.get("name")
        if name not in _TOOL_FUNCS:
            return reply(error={"code": -32602, "message": f"unknown tool: {name}"})
        try:
            result = _TOOL_FUNCS[name](params.get("arguments", {}))
        except (AccessDenied, AmbiguousJoinPath, ConflictingDefinitionError,
                KeyError, ValueError) as exc:
            # 工具级失败：MCP 约定 isError 内容返回（治理拒绝走此路径）
            return reply({"content": [{"type": "text", "text": str(exc)}],
                          "isError": True})
        return reply({"content": [{"type": "text",
                                   "text": json.dumps(result, ensure_ascii=False,
                                                      sort_keys=True)}],
                      "isError": False})
    return reply(error={"code": -32601, "message": f"method not found: {method}"})


def serve():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            resp = handle_request(json.loads(line))
        except json.JSONDecodeError as exc:
            resp = {"jsonrpc": "2.0", "id": None,
                    "error": {"code": -32700, "message": f"parse error: {exc}"}}
        if resp is not None:
            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
            sys.stdout.flush()


# ---------------------------------------------------------------------------
# selftest：进程内全链路 + 子进程 stdio 往返
# ---------------------------------------------------------------------------

FAILURES = []


def expect(sid, cond, detail):
    print(f"  [{'PASS' if cond else 'FAIL'}] {sid}: {detail}")
    if not cond:
        FAILURES.append(sid)


def _call(name, arguments):
    resp = handle_request({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                           "params": {"name": name, "arguments": arguments}})
    return resp["result"]


def selftest():
    print("=" * 72)
    print("Horizon Context MCP 服务原型 · stdio JSON-RPC 全链路自测")
    print("=" * 72)
    init = handle_request({"jsonrpc": "2.0", "id": 0, "method": "initialize",
                           "params": {"protocolVersion": "2025-06-18",
                                      "clientInfo": {"name": "selftest"}}})
    expect("T1", init["result"]["protocolVersion"] == "2025-06-18"
           and init["result"]["serverInfo"]["name"] == "horizon-context-lab"
           and handle_request({"jsonrpc": "2.0", "method": "notifications/initialized"})
           is None,
           "initialize 握手回显 + notification 无响应")
    old_ver = handle_request({"jsonrpc": "2.0", "id": 10, "method": "initialize",
                              "params": {"protocolVersion": "2024-11-05"}})
    expect("T1b", old_ver["result"]["protocolVersion"] == PROTOCOL,
           f"不支持版本 → 回应自身支持版 {PROTOCOL}（不回显）")
    lst = handle_request({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    expect("T2", [t["name"] for t in lst["result"]["tools"]] ==
           ["list_context_objects", "resolve_context", "compile_metric",
            "report_feedback"], "tools/list 四工具齐全")
    rev = next(m for m in VIEWS[0].metrics if m.name == "revenue")
    rev.visibility = "PRIVATE"                    # 临时翻转验证下发过滤，finally 还原
    try:
        objs = {role: json.loads(_call("list_context_objects", {"role": role})
                                 ["content"][0]["text"])["objects"]
                for role in ("intern", "analyst")}
    finally:
        rev.visibility = "PUBLIC"
    expect("T2b", "revenue" not in {o["name"] for o in objs["intern"]
                                    if o["source"] == "governed"}
           and any(o["name"] == "revenue" and o["source"] == "governed"
                   for o in objs["analyst"])
           and any(o["name"] == "revenue" and o["source"] == "legacy"
                   for o in objs["intern"]),
           f"list RBAC 过滤: PRIVATE 指标对 intern 不下发（governed revenue 隐藏、"
           f"legacy 同名仍可见）；analyst 全量（intern {len(objs['intern'])} 条 / "
           f"analyst {len(objs['analyst'])} 条）")
    r = _call("resolve_context", {"question": "marketing spend by channel"})
    payload = json.loads(r["content"][0]["text"])
    expect("T3", payload["entries"][0]["name"] == "spend"
           and "no_governed_coverage" in payload["warnings"],
           f"resolve_context: {payload['entries'][0]} + {payload['warnings']}")
    c = _call("compile_metric", {"metric": "revenue", "dims": ["month"]})
    expect("T4", list(json.loads(c["content"][0]["text"])["result"].values()) ==
           [200, 150, 300], "compile_metric: [200,150,300]")
    denied = _call("compile_metric", {"metric": "revenue", "dims": ["plan"],
                                      "via": "buyer", "role": "intern"})
    expect("T5", denied["isError"] and "PRIVATE" in denied["content"][0]["text"],
           f"引擎层 RBAC 经 MCP 仍生效: {denied['content'][0]['text']}")
    before = _call("resolve_context", {"question": "sales"})
    top_before = json.loads(before["content"][0]["text"])["entries"][0]["source"]
    _call("report_feedback", {"name": "revenue", "verdict": "down", "source": "governed"})
    after = _call("resolve_context", {"question": "sales"})
    entries_after = json.loads(after["content"][0]["text"])["entries"]
    expect("T6", top_before == "governed" and entries_after[0]["source"] == "legacy",
           f"行为反馈闭环: feedback down 后 'sales' 解析 {top_before} → "
           f"{entries_after[0]['source']}（popularity 参与排序）")
    _call("report_feedback", {"name": "revenue", "verdict": "up", "source": "governed"})
    restored = json.loads(_call("resolve_context", {"question": "sales"})
                          ["content"][0]["text"])["entries"][0]["source"]
    expect("T6b", restored == "governed", "feedback up 恢复 governed 优先")
    bad = handle_request({"jsonrpc": "2.0", "id": 9, "method": "no/such"})
    expect("T7", bad["error"]["code"] == -32601, "未知方法 → -32601")
    # ---- 子进程 stdio 往返（真实传输路径冒烟）----
    script = "\n".join(json.dumps(m) for m in (
        {"jsonrpc": "2.0", "id": 1, "method": "initialize",
         "params": {"protocolVersion": "2025-06-18"}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
         "params": {"name": "compile_metric",
                    "arguments": {"metric": "active_customers", "dims": ["month"]}}},
    )) + "\n"
    proc = subprocess.run([sys.executable, __file__], input=script,
                          capture_output=True, text=True, timeout=30)
    lines = [l for l in proc.stdout.splitlines() if l.strip()]
    ok = len(lines) == 2 and json.loads(lines[0])["result"]["serverInfo"][
        "name"] == "horizon-context-lab"
    vals = list(json.loads(lines[1])["result"]["content"][0]["text"]
                and json.loads(json.loads(lines[1])["result"]["content"][0]["text"])
                ["result"].values()) if len(lines) == 2 else []
    expect("T8", ok and vals == [3, 1, 2] and proc.returncode == 0,
           f"子进程 stdio 往返: {len(lines)} 响应行, active_customers={vals}")
    print("=" * 72)
    if FAILURES:
        print(f"SELFTEST FAILED ✘ ({len(FAILURES)}): {FAILURES}")
        sys.exit(1)
    print("SELFTEST PASSED ✔")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        serve()
