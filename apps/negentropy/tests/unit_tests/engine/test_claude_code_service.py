"""ClaudeCodeService 执行层健壮性单测 — 复现并锁定历史故障的回归。

覆盖：
- ``_iter_json_events``：单行 >64KiB 不再触发 asyncio LimitOverrunError
  （历史故障「Separator is found, but chunk is longer than limit」根因）；
- system/init 事件早捕获 session_id；
- ``invoke`` 超时仍回带 session_id（打断死亡螺旋）；
- ``effective_permission_mode`` 别名归一。
"""

from __future__ import annotations

import asyncio
import json

import pytest

from negentropy.engine.claude_code.models import ClaudeCodeConfig
from negentropy.engine.claude_code.service import (
    ERROR_KIND_CONTEXT_EXHAUSTED,
    ClaudeCodeService,
    _classify_result_error,
)

pytestmark = pytest.mark.asyncio


class _FakeStream:
    """模拟 asyncio StreamReader：按 read(n) 分块吐出预置字节，最后 EOF。"""

    def __init__(self, data: bytes, chunk: int = 65536) -> None:
        self._data = data
        self._chunk = chunk
        self._pos = 0

    async def read(self, n: int = -1) -> bytes:
        if self._pos >= len(self._data):
            return b""
        size = self._chunk if n is None or n < 0 else min(n, self._chunk)
        out = self._data[self._pos : self._pos + size]
        self._pos += len(out)
        return out


async def _collect(stream) -> list[dict]:
    return [ev async for ev in ClaudeCodeService._iter_json_events(stream, None)]


async def test_iter_json_events_survives_oversized_line():
    """单行 stream-json 远超 64KiB（默认 readline 上限）时仍能完整解析，不抛异常。"""
    big_payload = "x" * (2 * 1024 * 1024)  # 2 MiB 单行
    line1 = json.dumps({"type": "system", "subtype": "init", "session_id": "sess-1"})
    line2 = json.dumps({"type": "assistant", "content": big_payload})
    line3 = json.dumps({"type": "result", "result": "done", "session_id": "sess-1", "num_turns": 3})
    raw = (line1 + "\n" + line2 + "\n" + line3 + "\n").encode("utf-8")

    events = await _collect(_FakeStream(raw))

    assert [e["type"] for e in events] == ["system", "assistant", "result"]
    assert len(events[1]["content"]) == 2 * 1024 * 1024
    assert events[2]["num_turns"] == 3


async def test_iter_json_events_flushes_trailing_line_without_newline():
    raw = json.dumps({"type": "result", "result": "ok"}).encode("utf-8")  # 无结尾换行
    events = await _collect(_FakeStream(raw))
    assert events == [{"type": "result", "result": "ok"}]


async def test_iter_json_events_skips_blank_and_malformed():
    raw = b'\n  \nnot-json\n{"type":"result","result":"ok"}\n'
    events = await _collect(_FakeStream(raw))
    assert events == [{"type": "result", "result": "ok"}]


async def test_invoke_timeout_returns_partial_session_id(monkeypatch):
    """CLI 协程已从 init 捕获 session 后超时 → invoke 仍回带 session_id（防死亡螺旋）。"""

    async def _slow_cli(prompt, config, abort_event, session_holder=None, events_holder=None, on_event=None):
        if session_holder is not None:
            session_holder["session_id"] = "sess-from-init"
        await asyncio.sleep(5)  # 永不在超时窗口内返回
        raise AssertionError("should not reach")

    monkeypatch.setattr(ClaudeCodeService, "_check_sdk", classmethod(lambda cls: False))
    monkeypatch.setattr(ClaudeCodeService, "_invoke_cli", staticmethod(_slow_cli))

    result = await ClaudeCodeService.invoke("p", ClaudeCodeConfig(timeout_seconds=0.05))

    assert result.status == "timeout"
    assert result.session_id == "sess-from-init"


async def test_effective_permission_mode_normalizes_aliases():
    assert ClaudeCodeConfig(permission_mode="auto").effective_permission_mode() == "default"
    assert ClaudeCodeConfig(permission_mode="ask").effective_permission_mode() == "default"
    assert ClaudeCodeConfig(permission_mode="plan").effective_permission_mode() == "plan"
    assert ClaudeCodeConfig(permission_mode="acceptEdits").effective_permission_mode() == "acceptEdits"
    assert ClaudeCodeConfig(permission_mode="bogus").effective_permission_mode() == "default"


async def test_default_timeout_is_routine_appropriate():
    # 默认超时已自 300s 抬高，避免深度任务空转超时。
    assert ClaudeCodeConfig().timeout_seconds >= 900.0


# ---------------------------------------------------------------------------
# 子进程凭证注入（修复 Routine 529→401 鉴权失败的回归锁定）
# ---------------------------------------------------------------------------


async def test_build_subprocess_env_console_api_key_uses_x_api_key(monkeypatch):
    """Console API Key（sk-ant-api…）→ ANTHROPIC_API_KEY（x-api-key），且清除 Bearer 两键。"""
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:3392")
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "stale-bearer")  # 应被清除
    env = ClaudeCodeService._build_subprocess_env("sk-ant-api03-deadbeef-key")
    # sk-ant-api 前缀 → 走 Console API Key 分支
    assert env["ANTHROPIC_API_KEY"] == "sk-ant-api03-deadbeef-key"
    assert "ANTHROPIC_AUTH_TOKEN" not in env
    assert "CLAUDE_CODE_OAUTH_TOKEN" not in env
    # base_url 始终保留
    assert env["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:3392"


async def test_build_subprocess_env_oauth_subscription_token_uses_bearer(monkeypatch):
    """订阅 OAuth 令牌（sk-ant-oat…，setup-token 生成）→ Bearer 两键，清 x-api-key。

    回归锁定：sk-ant-oat… 与 sk-ant-api… 同享 sk-ant- 前缀但认证头不同——
    OAuth 令牌须走 ANTHROPIC_AUTH_TOKEN（Bearer），绝不可误判为 x-api-key。
    """
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:3392")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "0f12ec02e91345bb82d14a91b9bea8ca")  # 网关 key，应被清除
    env = ClaudeCodeService._build_subprocess_env("sk-ant-oat01-deadbeef-token")
    assert env["ANTHROPIC_AUTH_TOKEN"] == "sk-ant-oat01-deadbeef-token"
    assert env["CLAUDE_CODE_OAUTH_TOKEN"] == "sk-ant-oat01-deadbeef-token"
    assert "ANTHROPIC_API_KEY" not in env  # 网关 key 被清除，消除优先级歧义
    assert env["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:3392"


async def test_build_subprocess_env_plain_oauth_token_uses_bearer(monkeypatch):
    """普通（非 sk-ant-）OAuth 令牌 → ANTHROPIC_AUTH_TOKEN + CLAUDE_CODE_OAUTH_TOKEN，清 API Key。"""
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:3392")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "0f12ec02e91345bb82d14a91b9bea8ca")
    env = ClaudeCodeService._build_subprocess_env("oauth-subscription-token-xyz")
    assert env["ANTHROPIC_AUTH_TOKEN"] == "oauth-subscription-token-xyz"
    assert env["CLAUDE_CODE_OAUTH_TOKEN"] == "oauth-subscription-token-xyz"
    assert "ANTHROPIC_API_KEY" not in env  # 网关 key 被清除，消除优先级歧义
    assert env["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:3392"


async def test_build_subprocess_env_none_is_pure_inheritance(monkeypatch):
    """无凭证 → 纯继承副本，不增删任何凭证键（等价不传 env=）。"""
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:3392")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    env = ClaudeCodeService._build_subprocess_env(None)
    assert env["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:3392"
    assert "ANTHROPIC_API_KEY" not in env
    assert "ANTHROPIC_AUTH_TOKEN" not in env


async def test_build_subprocess_env_does_not_mutate_os_environ(monkeypatch):
    """构建环境绝不就地修改 os.environ（并发隔离安全）。"""
    import os

    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    ClaudeCodeService._build_subprocess_env("oauth-token-abc")
    assert "ANTHROPIC_AUTH_TOKEN" not in os.environ
    assert "CLAUDE_CODE_OAUTH_TOKEN" not in os.environ


async def test_invoke_cli_passes_credential_env_and_survives_reconstruction(monkeypatch):
    """端到端锁定：_invoke_cli 重建 config 后仍保留 credential，并把它注入子进程 env=。

    回归点：service.py 在 463 行用 resolved CLI 路径重建 ClaudeCodeConfig；若漏传
    credential，注入字段会被静默丢弃 → 退回 401。本测试 mock create_subprocess_exec 抓 env=。
    """
    captured: dict = {}

    class _FakeProc:
        def __init__(self) -> None:
            self.stdout = _FakeStream(b"")  # 立即 EOF
            self.stderr = _FakeStream(b"")
            self.returncode = 0

        def terminate(self) -> None:  # noqa: D401
            pass

        async def wait(self) -> int:
            return 0

    async def _fake_exec(*args, **kwargs):
        captured["args"] = args
        captured["env"] = kwargs.get("env")
        return _FakeProc()

    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:3392")
    monkeypatch.setattr(ClaudeCodeService, "_check_sdk", classmethod(lambda cls: False))
    monkeypatch.setattr("negentropy.engine.claude_code.service.shutil.which", lambda p: "/usr/bin/claude")
    monkeypatch.setattr("negentropy.engine.claude_code.service.asyncio.create_subprocess_exec", _fake_exec)

    cfg = ClaudeCodeConfig(cli_path="claude", cwd=None, max_turns=1, credential="oauth-token-from-ui")
    await ClaudeCodeService.invoke("ping", cfg)

    env = captured["env"]
    assert env is not None, "必须向子进程传入 env="
    assert env["ANTHROPIC_AUTH_TOKEN"] == "oauth-token-from-ui"
    assert env["CLAUDE_CODE_OAUTH_TOKEN"] == "oauth-token-from-ui"
    assert env["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:3392"


async def test_config_repr_omits_credential_secret():
    """secret 绝不出现在 repr（防日志 / traceback 泄露）。"""
    cfg = ClaudeCodeConfig(credential="super-secret-oauth-token")
    assert "super-secret-oauth-token" not in repr(cfg)


# ---------------------------------------------------------------------------
# 交互模式（--input-format stream-json）死锁回归锁定
#
# 根因（实测）：stream-json 输入模式下 CLI **忽略** -p <prompt> 命令行取值，改从 stdin 读
# 首条 user 消息作为任务输入；且产出 result 后**不自行退出**，保持 stdin 打开等待更多输入。
# 旧实现既不经 stdin 投喂 prompt、也不在 result 后闭合 stdin → CLI 永久阻塞（0 turns 挂起，
# 占满并发槽位、阻塞所有后续 dispatch，直至外层超时或被 kill）。
# 修复：① 启动后即经 stdin 投喂初始 user prompt；② reader 见 result 即 put(None) 闭合 stdin。
# ---------------------------------------------------------------------------


async def test_build_stdin_user_prompt_is_user_message_with_newline():
    """初始 prompt 须封装为 stream-json ``user`` 消息且以换行结尾（CLI 按行解析 stdin）。"""
    line = ClaudeCodeService._build_stdin_user_prompt("请创建 hello.py")
    assert line.endswith("\n")
    msg = json.loads(line)
    assert msg["type"] == "user"
    assert msg["message"]["role"] == "user"
    assert msg["message"]["content"] == "请创建 hello.py"


async def test_build_stdin_user_prompt_preserves_unicode():
    """非 ASCII prompt 不转义（ensure_ascii=False），保证 CLI 收到原文。"""
    line = ClaudeCodeService._build_stdin_user_prompt("中文目标 🚀")
    assert "中文目标 🚀" in line


class _DuplexFakeProc:
    """模拟交互式 claude 子进程：record stdin 写入；stdout 在 stdin 收到首条 user 消息后吐事件。

    复刻真实 CLI 关键行为：(1) prompt 经 stdin 抵达后才开始产出事件；(2) 产出 result 后不
    自行退出（returncode 维持 None），直到 stdin 被关闭（close 调用）才置 returncode=0 + stdout EOF。
    """

    def __init__(self, events: list[dict]) -> None:
        self._events = events
        self.returncode: int | None = None
        self._stdin_got_prompt = asyncio.Event()
        self._stdin_closed = asyncio.Event()
        self.stdin = self._Stdin(self)
        self.stdout = self._Stdout(self)
        self.stderr = _FakeStream(b"")
        self.terminated = False

    class _Stdin:
        def __init__(self, proc: _DuplexFakeProc) -> None:
            self._proc = proc
            self.writes: list[str] = []

        def write(self, data: bytes) -> None:
            text = data.decode("utf-8")
            self.writes.append(text)
            # 首条 user 消息（初始 prompt）抵达 → 解锁 stdout 事件吐出
            self._proc._stdin_got_prompt.set()

        async def drain(self) -> None:
            return None

        def close(self) -> None:
            self._proc._stdin_closed.set()
            # stdin 关闭 → CLI 干净退出
            self._proc.returncode = 0

        async def wait_closed(self) -> None:
            return None

    class _Stdout:
        def __init__(self, proc: _DuplexFakeProc) -> None:
            self._proc = proc
            self._idx = 0
            self._buf = b""

        async def read(self, n: int = -1) -> bytes:
            # 阻塞直到初始 prompt 抵达（复刻「-p 被忽略、须经 stdin」语义）
            if self._idx == 0 and not self._buf:
                await self._proc._stdin_got_prompt.wait()
            if self._buf:
                out, self._buf = self._buf, b""
                return out
            if self._idx < len(self._proc._events):
                line = (json.dumps(self._proc._events[self._idx]) + "\n").encode("utf-8")
                self._idx += 1
                size = len(line) if n is None or n < 0 else min(n, len(line))
                out, self._buf = line[:size], line[size:]
                return out
            # 事件耗尽后：阻塞直到 stdin 关闭才 EOF（复刻 result 后不自退、等 stdin 闭合）
            await self._proc._stdin_closed.wait()
            return b""

    def terminate(self) -> None:
        self.terminated = True
        if self.returncode is None:
            self.returncode = 0

    async def wait(self) -> int:
        return self.returncode or 0


async def test_interactive_feeds_prompt_via_stdin_and_closes_on_result(monkeypatch):
    """端到端锁定交互模式死锁修复：

    - 初始 prompt 经 stdin 投喂（writes[0] 为 user 消息且含 prompt 原文）；
    - 收到 result 事件后主动闭合 stdin，进程干净退出（status=success，非超时/143）；
    - session_id / cost / turns 正确回带。
    """
    events = [
        {"type": "system", "subtype": "init", "session_id": "sess-int-1"},
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "已创建 hello.py"}]}},
        {
            "type": "result",
            "subtype": "success",
            "result": "done",
            "session_id": "sess-int-1",
            "num_turns": 2,
            "total_cost_usd": 0.42,
        },
    ]
    proc = _DuplexFakeProc(events)

    async def _fake_exec(*args, **kwargs):
        return proc

    monkeypatch.setattr(ClaudeCodeService, "_check_sdk", classmethod(lambda cls: False))
    monkeypatch.setattr("negentropy.engine.claude_code.service.shutil.which", lambda p: "/usr/bin/claude")
    monkeypatch.setattr("negentropy.engine.claude_code.service.asyncio.create_subprocess_exec", _fake_exec)

    cfg = ClaudeCodeConfig(
        cli_path="claude",
        cwd=None,
        max_turns=5,
        timeout_seconds=10.0,
        interactive=True,
        auto_answer_context={"goal": "g", "acceptance_criteria": "ac"},
    )
    result = await ClaudeCodeService.invoke("请创建 hello.py 输出 Hello World", cfg)

    # 初始 prompt 必经 stdin 投喂（首条写入为 user 消息且含 prompt 原文）
    assert proc.stdin.writes, "必须经 stdin 投喂初始 prompt"
    first = json.loads(proc.stdin.writes[0])
    assert first["type"] == "user"
    assert "请创建 hello.py" in first["message"]["content"]
    # result 后闭合 stdin → 进程干净退出，非超时/SIGTERM
    assert result.status == "success", f"应成功退出，实际 {result.status}（error={result.error}）"
    assert result.session_id == "sess-int-1"
    assert result.turn_count == 2
    assert result.cost_usd == 0.42


# ---------------------------------------------------------------------------
# 上下文窗口耗尽错误识别（_classify_result_error）—— 死亡螺旋根因修复回归锁定
#
# 根因（实测 a83d9c94 seq=4）：CC resume 已满会话时输出 result 事件
#   {type:result, subtype:"success", is_error:true,
#    result:"API Error: The model has reached its context window limit."} + exit 1。
# 注意 subtype 为误导性的 "success"，故识别**必须**以 is_error + 文本为准，不能依赖 subtype。
# ---------------------------------------------------------------------------


# 实测真实事件（seq=4）：subtype 误导为 "success"，凭 is_error + 文本识别。
_REAL_CONTEXT_LIMIT_EVENT = {
    "type": "result",
    "subtype": "success",
    "is_error": True,
    "result": "API Error: The model has reached its context window limit.",
    "num_turns": 1,
}


async def test_classify_real_context_limit_event_from_seq4():
    """复刻 a83d9c94 seq=4 的真实失败 result 事件 → 识别为 context_exhausted（文本信号）。"""
    assert _classify_result_error(_REAL_CONTEXT_LIMIT_EVENT, 1) == ERROR_KIND_CONTEXT_EXHAUSTED


async def test_classify_text_markers_case_insensitive():
    """覆盖各文本 marker 变体 + 大小写无关。"""
    for text in [
        "the model has reached its CONTEXT WINDOW limit",
        "Prompt is too long",
        "request exceeds the maximum context length",
        "Context limit reached",
        "maximum context exceeded",
    ]:
        evt = {"type": "result", "is_error": True, "result": text}
        assert _classify_result_error(evt, 1) == ERROR_KIND_CONTEXT_EXHAUSTED, text


async def test_classify_subtype_signal_independent_of_text():
    """结构信号独立生效：subtype 命中已知上下文错误码，即便正文无 marker 亦判定。"""
    evt = {"type": "result", "is_error": True, "subtype": "error_max_context", "result": "<opaque>"}
    assert _classify_result_error(evt, 1) == ERROR_KIND_CONTEXT_EXHAUSTED


async def test_classify_plain_error_is_not_context_exhausted():
    """普通执行失败（无 marker、subtype 非上下文类）→ None（不误判）。"""
    evt = {"type": "result", "is_error": True, "subtype": "error_during_execution", "result": "file not found"}
    assert _classify_result_error(evt, 1) is None


async def test_classify_returncode_zero_is_none():
    """退出码 0（成功路径）→ 恒 None，绝不误伤——即便正文恰含 marker 字样。"""
    evt = {"type": "result", "is_error": False, "result": "we tuned the context window size"}
    assert _classify_result_error(evt, 0) is None


async def test_classify_false_positive_guard_on_success_text():
    """防误判：正文含 'context window limit' 但 returncode=0（任务产出提及）→ None。"""
    evt = {"type": "result", "is_error": False, "result": "the context window limit is 1M tokens"}
    assert _classify_result_error(evt, 0) is None


async def test_classify_missing_result_event_is_none():
    """result 事件缺席（仅 exit 非 0）→ None（不臆断错误类型）。"""
    assert _classify_result_error(None, 1) is None


async def test_classify_non_string_result_payload():
    """result 为非字符串（对象）时序列化后匹配，不抛错。"""
    evt = {"type": "result", "is_error": True, "result": {"error": "reached its context window limit"}}
    assert _classify_result_error(evt, 1) == ERROR_KIND_CONTEXT_EXHAUSTED


# ---------------------------------------------------------------------------
# 上下文压缩：CLAUDE_AUTOCOMPACT_PCT_OVERRIDE 环境变量注入（Layer 1 — 预防）
# ---------------------------------------------------------------------------


async def test_build_subprocess_env_injects_autocompact_threshold(monkeypatch):
    """compact_threshold_pct 非空时注入 CLAUDE_AUTOCOMPACT_PCT_OVERRIDE。"""
    monkeypatch.delenv("CLAUDE_AUTOCOMPACT_PCT_OVERRIDE", raising=False)
    env = ClaudeCodeService._build_subprocess_env(None, compact_threshold_pct=70)
    assert env.get("CLAUDE_AUTOCOMPACT_PCT_OVERRIDE") == "70"


async def test_build_subprocess_env_skips_autocompact_when_none(monkeypatch):
    """compact_threshold_pct=None 时不注入环境变量（使用 CLI 默认值）。"""
    monkeypatch.delenv("CLAUDE_AUTOCOMPACT_PCT_OVERRIDE", raising=False)
    env = ClaudeCodeService._build_subprocess_env(None, compact_threshold_pct=None)
    assert "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE" not in env


async def test_build_subprocess_env_autocompact_coexists_with_credential(monkeypatch):
    """compact_threshold_pct 与凭证注入互不干扰。"""
    monkeypatch.delenv("CLAUDE_AUTOCOMPACT_PCT_OVERRIDE", raising=False)
    env = ClaudeCodeService._build_subprocess_env("sk-ant-api03-testkey", compact_threshold_pct=50)
    assert env["ANTHROPIC_API_KEY"] == "sk-ant-api03-testkey"
    assert env["CLAUDE_AUTOCOMPACT_PCT_OVERRIDE"] == "50"


# ---------------------------------------------------------------------------
# compact_boundary 事件归一化（审计增强）
# ---------------------------------------------------------------------------


def _normalize(raw: dict) -> list[dict]:
    """便利包装：调用 _normalize_stream_event 并返回结果。"""
    from negentropy.engine.claude_code.service import _normalize_stream_event

    return _normalize_stream_event(raw)


def test_normalize_compact_boundary_event():
    """CC auto-compact 触发时的 compact_boundary 事件被正确归一化为 system_compact。"""
    raw = {
        "type": "system",
        "subtype": "compact_boundary",
        "compact_metadata": {"trigger": "auto", "pre_tokens": 150000},
    }
    events = _normalize(raw)
    assert len(events) == 1
    evt = events[0]
    assert evt["event_type"] == "system_compact"
    assert evt["title"] == "context compact (auto)"
    assert evt["payload"]["trigger"] == "auto"
    assert evt["payload"]["pre_tokens"] == 150000


def test_normalize_compact_boundary_manual_trigger():
    """手动 /compact 触发的 compact_boundary 事件。"""
    raw = {
        "type": "system",
        "subtype": "compact_boundary",
        "compact_metadata": {"trigger": "manual"},
    }
    events = _normalize(raw)
    assert events[0]["title"] == "context compact (manual)"


def test_normalize_compact_boundary_without_metadata():
    """compact_boundary 事件缺少 compact_metadata 时不报错。"""
    raw = {"type": "system", "subtype": "compact_boundary"}
    events = _normalize(raw)
    assert len(events) == 1
    assert events[0]["event_type"] == "system_compact"
    assert events[0]["payload"]["trigger"] is None


def test_normalize_system_other_not_affected_by_compact():
    """非 compact_boundary 的 system/* 事件仍走原有 catch-all 路径。"""
    raw = {"type": "system", "subtype": "task_started"}
    events = _normalize(raw)
    assert len(events) == 1
    assert events[0]["event_type"] == "system"
    assert events[0]["title"] == "task_started"


class _FakeProcWithEvents:
    """模拟非交互 claude 子进程：吐预置 stream-json 事件后 EOF，returncode 可控。"""

    def __init__(self, events: list[dict], returncode: int = 1) -> None:
        raw = ("".join(json.dumps(e) + "\n" for e in events)).encode("utf-8")
        self.stdout = _FakeStream(raw)
        self.stderr = _FakeStream(b"")
        self.returncode = returncode

    def terminate(self) -> None:
        pass

    async def wait(self) -> int:
        return self.returncode


async def test_invoke_cli_tags_error_kind_on_context_limit(monkeypatch):
    """端到端锁定：非交互 CLI 路径遇上下文耗尽 result 事件（exit 1）→ result.error_kind 被打上标签。

    这是死亡螺旋根因修复的核心回归：原实现仅靠 exit code 判 error、丢弃 result 的 is_error，
    无法区分"可自愈的上下文耗尽"与普通失败。"""
    events = [
        {"type": "system", "subtype": "init", "session_id": "sess-full"},
        _REAL_CONTEXT_LIMIT_EVENT,
    ]

    async def _fake_exec(*args, **kwargs):
        return _FakeProcWithEvents(events, returncode=1)

    monkeypatch.setattr(ClaudeCodeService, "_check_sdk", classmethod(lambda cls: False))
    monkeypatch.setattr("negentropy.engine.claude_code.service.shutil.which", lambda p: "/usr/bin/claude")
    monkeypatch.setattr("negentropy.engine.claude_code.service.asyncio.create_subprocess_exec", _fake_exec)

    cfg = ClaudeCodeConfig(cli_path="claude", cwd=None, max_turns=1, timeout_seconds=10.0)
    result = await ClaudeCodeService.invoke("继续推进", cfg)

    assert result.status == "error"
    assert result.error_kind == ERROR_KIND_CONTEXT_EXHAUSTED
    # session_id 仍从 init 回带（供审计；策略层会据 error_kind 决定不续接）
    assert result.session_id == "sess-full"


async def test_invoke_cli_no_error_kind_on_success(monkeypatch):
    """回归锁：正常成功（exit 0）→ error_kind 恒 None，不误标。"""
    events = [
        {"type": "system", "subtype": "init", "session_id": "sess-ok"},
        {"type": "result", "subtype": "success", "result": "done", "num_turns": 3, "total_cost_usd": 0.5},
    ]

    async def _fake_exec(*args, **kwargs):
        return _FakeProcWithEvents(events, returncode=0)

    monkeypatch.setattr(ClaudeCodeService, "_check_sdk", classmethod(lambda cls: False))
    monkeypatch.setattr("negentropy.engine.claude_code.service.shutil.which", lambda p: "/usr/bin/claude")
    monkeypatch.setattr("negentropy.engine.claude_code.service.asyncio.create_subprocess_exec", _fake_exec)

    cfg = ClaudeCodeConfig(cli_path="claude", cwd=None, max_turns=1, timeout_seconds=10.0)
    result = await ClaudeCodeService.invoke("ping", cfg)

    assert result.status == "success"
    assert result.error_kind is None


# ---------------------------------------------------------------------------
# _build_cli_args：mcp_config / disallowed_tools 传递回归锁定
# ---------------------------------------------------------------------------


async def test_build_cli_args_includes_mcp_config():
    """mcp_config 非 None 时注入 --mcp-config，封装为 {"mcpServers": {...}} JSON string。"""
    mcp = {"my-server": {"type": "stdio", "command": "npx", "args": ["-y", "some-mcp"]}}
    config = ClaudeCodeConfig(mcp_config=mcp)
    args = ClaudeCodeService._build_cli_args("hello", config)
    assert "--mcp-config" in args
    idx = args.index("--mcp-config")
    payload = json.loads(args[idx + 1])
    assert "mcpServers" in payload
    assert "my-server" in payload["mcpServers"]


async def test_build_cli_args_omits_mcp_config_when_none():
    """mcp_config 为 None 时不注入 --mcp-config。"""
    config = ClaudeCodeConfig(mcp_config=None)
    args = ClaudeCodeService._build_cli_args("hello", config)
    assert "--mcp-config" not in args


async def test_build_cli_args_includes_disallowed_tools():
    """disallowed_tools 非 None 时注入 --disallowed-tools。"""
    config = ClaudeCodeConfig(disallowed_tools=["Task", "WebSearch"])
    args = ClaudeCodeService._build_cli_args("hello", config)
    assert "--disallowed-tools" in args
    idx = args.index("--disallowed-tools")
    assert "Task" in args[idx + 1]
    assert "WebSearch" in args[idx + 1]


async def test_build_cli_args_omits_disallowed_tools_when_none():
    """disallowed_tools 为 None 时不注入 --disallowed-tools。"""
    config = ClaudeCodeConfig(disallowed_tools=None)
    args = ClaudeCodeService._build_cli_args("hello", config)
    assert "--disallowed-tools" not in args
