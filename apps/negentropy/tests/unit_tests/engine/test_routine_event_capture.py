"""Routine「全过程」动作捕获单测 — stream-json 归一化器（纯函数，无 DB / 无 CLI）。

覆盖 ``_normalize_stream_event`` 对真实 Claude Code CLI stream-json 各形态的防御式解析：
system/init、assistant（文本 + tool_use + thinking + 旧扁平）、user tool_result（字符串 /
text-block 列表）、result、未知 type，以及字段截断与 tool_use↔tool_result 配对。
"""

from __future__ import annotations

from negentropy.engine.claude_code.service import (
    _EVENT_FIELD_CAP,
    ClaudeCodeService,
    _cap,
    _coerce_content,
    _emit_events,
    _normalize_stream_event,
    _tool_title,
)


def _one(raw: dict) -> dict:
    out = _normalize_stream_event(raw)
    assert len(out) == 1, f"expected single event, got {len(out)}"
    return out[0]


def test_system_init_extracts_meta():
    ev = _one(
        {
            "type": "system",
            "subtype": "init",
            "model": "claude-opus",
            "cwd": "/repo",
            "tools": ["Read", "Bash"],
            "permissionMode": "acceptEdits",
            "session_id": "sess-1",
        }
    )
    assert ev["event_type"] == "system"
    assert ev["title"] == "init"
    assert ev["payload"]["model"] == "claude-opus"
    assert ev["payload"]["cwd"] == "/repo"
    assert ev["payload"]["permission_mode"] == "acceptEdits"
    assert ev["payload"]["session_id"] == "sess-1"


def test_system_thinking_tokens_heartbeat_dropped():
    """逐 token 心跳（estimated_tokens_delta=1）不落库——避免数千条淹没转录流。

    回归：一次巡检迭代实测捕获 4703 条 system/thinking_tokens，把真实 96 条 tool_use/tool_result
    埋没并逼近 max_events_per_iter。思考文本已由 assistant/thinking 块捕获，心跳丢弃无信息损失。
    """
    raw = {
        "type": "system",
        "subtype": "thinking_tokens",
        "estimated_tokens": 42,
        "estimated_tokens_delta": 1,
    }
    assert _normalize_stream_event(raw) == []
    # 思考文本仍由 assistant/thinking 块捕获（不受心跳丢弃影响）
    keep = _normalize_stream_event(
        {"type": "assistant", "message": {"content": [{"type": "thinking", "thinking": "推理中"}]}}
    )
    assert keep and keep[0]["title"] == "thinking"


def test_extract_plan_from_askuserquestion_input():
    """clean-path 评审：从 AskUserQuestion 的 questions[].question 提取方案全文（非空）。"""
    tool_input = {
        "questions": [
            {
                "header": "方案审阅",
                "question": "【实施方案】step1 重转 → step2 渲染 → step3 评分 ...",
                "options": [{"label": "批准方案"}, {"label": "需要完善"}],
            }
        ]
    }
    plan = ClaudeCodeService._extract_plan_from_input(tool_input)
    assert "重转" in plan and "评分" in plan
    # ExitPlanMode 形态（plan 字段）亦兼容
    assert ClaudeCodeService._extract_plan_from_input({"plan": "# My plan"}) == "# My plan"
    # 空兜底不抛
    assert isinstance(ClaudeCodeService._extract_plan_from_input({}), str)


def test_assistant_text_and_tool_use_expand_to_multiple():
    out = _normalize_stream_event(
        {
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "text", "text": "我先读取文件"},
                    {"type": "tool_use", "id": "tu_1", "name": "Read", "input": {"file_path": "src/app.py"}},
                ]
            },
        }
    )
    assert len(out) == 2
    assert out[0]["event_type"] == "assistant"
    assert out[0]["payload"]["text"] == "我先读取文件"
    assert out[1]["event_type"] == "tool_use"
    assert out[1]["tool_name"] == "Read"
    assert out[1]["title"] == "Read src/app.py"  # 人读标题
    assert out[1]["payload"]["tool_id"] == "tu_1"
    assert out[1]["payload"]["input"] == {"file_path": "src/app.py"}


def test_tool_use_bash_title_uses_command():
    out = _normalize_stream_event(
        {
            "type": "assistant",
            "message": {
                "content": [{"type": "tool_use", "id": "tu_2", "name": "Bash", "input": {"command": "pytest -q"}}]
            },
        }
    )
    assert out[0]["title"] == "Bash: pytest -q"


def test_tool_title_truncation_cap_is_200():
    """标题截断上限 200：≤200 全保留（含文件名尾部不丢失），>200 才头部截断 + 省略号。"""
    # ≤200 的深层路径：完整保留，文件名尾部可见（旧 80 上限下会被砍掉）
    deep = "/repo/" + "seg/" * 40 + "target.py"  # 6 + 160 + 9 = 175
    assert len(deep) <= 200
    assert _tool_title("Read", {"file_path": deep}) == f"Read {deep}"
    assert _tool_title("Read", {"file_path": deep}).endswith("target.py")

    # >200 的超长路径：参数部分截到 200 + 省略号
    long_path = "/repo/" + "seg/" * 60 + "target.py"  # 6 + 240 + 9 = 255 > 200
    assert len(long_path) > 200
    assert _tool_title("Read", {"file_path": long_path}) == f"Read {long_path[:200]}…"


def test_assistant_thinking_block():
    out = _normalize_stream_event(
        {"type": "assistant", "message": {"content": [{"type": "thinking", "thinking": "推理中"}]}}
    )
    assert len(out) == 1
    assert out[0]["event_type"] == "assistant"
    assert out[0]["title"] == "thinking"
    assert out[0]["payload"]["text"] == "推理中"


def test_assistant_legacy_flat_content_string():
    """历史扁平 content 字符串（无 message.content）仍兜底为一条 assistant 文本。"""
    out = _normalize_stream_event({"type": "assistant", "content": "扁平摘要"})
    assert len(out) == 1
    assert out[0]["event_type"] == "assistant"
    assert out[0]["payload"]["text"] == "扁平摘要"


def test_user_tool_result_string_content():
    out = _normalize_stream_event(
        {
            "type": "user",
            "message": {
                "content": [{"type": "tool_result", "tool_use_id": "tu_1", "content": "文件内容…", "is_error": False}]
            },
        }
    )
    assert len(out) == 1
    assert out[0]["event_type"] == "tool_result"
    assert out[0]["payload"]["tool_use_id"] == "tu_1"
    assert out[0]["payload"]["output"] == "文件内容…"
    assert out[0]["payload"]["is_error"] is False


def test_user_tool_result_text_block_list_content():
    """tool_result.content 为 text-block 列表时需提取并拼接 text。"""
    out = _normalize_stream_event(
        {
            "type": "user",
            "message": {
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": "tu_9",
                        "content": [{"type": "text", "text": "行1"}, {"type": "text", "text": "行2"}],
                        "is_error": True,
                    }
                ]
            },
        }
    )
    assert out[0]["payload"]["output"] == "行1\n行2"
    assert out[0]["payload"]["is_error"] is True


def test_result_event_carries_cost_and_turns():
    ev = _one(
        {
            "type": "result",
            "subtype": "success",
            "result": "完成",
            "total_cost_usd": 0.0123,
            "num_turns": 7,
            "usage": {"input_tokens": 10},
            "is_error": False,
        }
    )
    assert ev["event_type"] == "result"
    assert ev["title"] == "success"
    assert ev["payload"]["result"] == "完成"
    assert ev["payload"]["num_turns"] == 7
    assert ev["cost_usd"] == 0.0123


def test_unknown_type_never_dropped():
    ev = _one({"type": "weird_future_event", "foo": "bar"})
    assert ev["event_type"] == "weird_future_event"
    assert "raw" in ev["payload"]


def test_non_dict_raw_degrades_gracefully():
    out = _normalize_stream_event("not-a-dict")  # type: ignore[arg-type]
    assert len(out) == 1
    assert out[0]["event_type"] == "unknown"


def test_field_truncation_marks_long_text():
    long = "x" * (_EVENT_FIELD_CAP + 500)
    out = _normalize_stream_event({"type": "assistant", "message": {"content": [{"type": "text", "text": long}]}})
    text = out[0]["payload"]["text"]
    assert len(text) < len(long)
    assert "truncated" in text


def test_cap_output_bounded_by_limit():
    """_cap 输出长度须 ≤ limit（标记预算从 head 扣除），保证可安全写入定长列。"""
    out = _cap("y" * 1000, limit=255)
    assert len(out) <= 255
    assert "truncated" in out


def test_cap_passthrough_non_string():
    assert _cap(123) == 123
    assert _cap(None) is None


def test_coerce_content_variants():
    assert _coerce_content("plain") == "plain"
    assert _coerce_content([{"type": "text", "text": "a"}, {"type": "text", "text": "b"}]) == "a\nb"
    assert _coerce_content(None) == ""


async def test_emit_events_assigns_monotonic_seq_and_pairs_tool_use_result():
    """到达顺序定格 seq；tool_use 与其 tool_result 经 tool_use_id 可配对审计。"""
    holder: list[dict] = []
    seen: list[dict] = []

    async def sink(e: dict) -> None:
        seen.append(e)

    # 模拟一轮：init → assistant(tool_use) → user(tool_result) → result
    await _emit_events({"type": "system", "subtype": "init", "session_id": "s"}, holder, sink)
    await _emit_events(
        {
            "type": "assistant",
            "message": {"content": [{"type": "tool_use", "id": "tu_1", "name": "Read", "input": {}}]},
        },
        holder,
        sink,
    )
    await _emit_events(
        {"type": "user", "message": {"content": [{"type": "tool_result", "tool_use_id": "tu_1", "content": "ok"}]}},
        holder,
        sink,
    )
    await _emit_events({"type": "result", "result": "done", "total_cost_usd": 0.01}, holder, sink)

    assert [e["seq"] for e in holder] == [0, 1, 2, 3]  # 单调递增
    assert seen == holder  # sink 收到与持久化一致的事件（含 seq）
    tu = next(e for e in holder if e["event_type"] == "tool_use")
    tr = next(e for e in holder if e["event_type"] == "tool_result")
    assert tu["payload"]["tool_id"] == tr["payload"]["tool_use_id"] == "tu_1"


async def test_emit_events_caps_at_max_with_sentinel():
    """事件数达到 max_events_per_iter 后追加 _truncated 哨兵并停止捕获。"""
    from negentropy.config import settings

    cap = settings.routine.max_events_per_iter
    holder: list[dict] = []
    # 灌入远超上限的 assistant 文本事件
    for i in range(cap + 50):
        await _emit_events(
            {"type": "assistant", "message": {"content": [{"type": "text", "text": f"t{i}"}]}}, holder, None
        )
    assert len(holder) <= cap + 1  # 含一条 _truncated 哨兵
    assert holder[-1]["event_type"] == "_truncated"


async def test_emit_events_sink_exception_suppressed():
    """sink 抛错不得中断捕获（实时是 best-effort）。"""
    holder: list[dict] = []

    async def bad_sink(_e: dict) -> None:
        raise RuntimeError("boom")

    await _emit_events({"type": "result", "result": "x"}, holder, bad_sink)
    assert len(holder) == 1  # 仍正常累积


# ---------------------------------------------------------------------------
# system 非 init 子类型归一化（api_retry / task_started / task_progress 等）
# ---------------------------------------------------------------------------


def test_system_api_retry_uses_system_retry_event_type():
    ev = _one({"type": "system", "subtype": "api_retry", "error": "rate_limited", "attempt": 2, "retry_delay_ms": 500})
    assert ev["event_type"] == "system_retry"
    assert "api_retry" in ev["title"]
    assert ev["payload"]["error"] == "rate_limited"
    assert ev["payload"]["attempt"] == 2


def test_system_task_started_preserves_subtype():
    ev = _one({"type": "system", "subtype": "task_started", "task_id": "t1", "description": "research"})
    assert ev["event_type"] == "system"
    assert ev["title"] == "task_started"


def test_system_task_progress_preserves_subtype():
    ev = _one({"type": "system", "subtype": "task_progress", "task_id": "t1"})
    assert ev["event_type"] == "system"
    assert ev["title"] == "task_progress"


def test_system_no_subtype_defaults_to_unknown():
    ev = _one({"type": "system"})
    assert ev["event_type"] == "system"
    assert ev["title"] == "unknown"


def test_system_init_unchanged_by_new_branch():
    """确保 system/init 走原有结构化路径（payload 含 model/cwd 等），不被新分支吞掉。"""
    ev = _one(
        {
            "type": "system",
            "subtype": "init",
            "model": "claude-opus",
            "cwd": "/repo",
            "tools": ["Read"],
            "permissionMode": "acceptEdits",
            "session_id": "sess-1",
        }
    )
    assert ev["event_type"] == "system"
    assert ev["title"] == "init"
    assert ev["payload"]["model"] == "claude-opus"
    assert "raw" not in ev["payload"]  # init 走结构化路径，不含 raw
