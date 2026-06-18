"""Tests for ``negentropy doctor`` —— 纯逻辑检查项 + run_doctor 退出码聚合。

DB 相关检查项（database / pgvector / uuid-ossp / alembic / ollama）在 CI 集成测试中
对真实 pgvector Postgres 验证；此处覆盖 env/config 驱动的检查项与 run_doctor 的
退出码聚合逻辑，不触达 DB（run_doctor 用桩替换 _CHECKS 绕开 DB）。
"""

from __future__ import annotations

import asyncio

from negentropy.cli_doctor import CheckResult, check_embedding, check_llm_key, run_doctor

_LLM_KEYS = ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY")


def test_llm_key_pass_when_any_key_set(monkeypatch):
    for k in _LLM_KEYS:
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    r = check_llm_key()
    assert r.status == "PASS"
    assert "OPENAI_API_KEY" in r.detail


def test_llm_key_fail_when_no_key(monkeypatch):
    for k in _LLM_KEYS:
        monkeypatch.delenv(k, raising=False)
    r = check_llm_key()
    assert r.status == "FAIL"
    # 修复指引须同时提及填 Key 与 Ollama 备选
    assert "OPENAI_API_KEY" in r.detail
    assert "Ollama" in r.detail


def test_embedding_pass_when_gemini_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test")
    assert check_embedding().status == "PASS"


def test_embedding_warn_when_no_gemini_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    r = check_embedding()
    assert r.status == "WARN"
    assert "关键词" in r.detail  # 降级说明


def _stub(result: CheckResult):
    async def _fn() -> CheckResult:
        return result

    return _fn


def test_run_doctor_exit_nonzero_on_fail(monkeypatch):
    """任一 FAIL → 退出码 1。"""
    from negentropy import cli_doctor

    monkeypatch.setattr(
        cli_doctor,
        "_CHECKS",
        (
            _stub(CheckResult("a", "PASS", "")),
            _stub(CheckResult("b", "FAIL", "")),
        ),
    )
    assert asyncio.run(run_doctor()) == 1


def test_run_doctor_exit_zero_when_only_pass_warn(monkeypatch):
    """无 FAIL（PASS + WARN）→ 退出码 0。"""
    from negentropy import cli_doctor

    monkeypatch.setattr(
        cli_doctor,
        "_CHECKS",
        (
            _stub(CheckResult("a", "PASS", "")),
            _stub(CheckResult("b", "WARN", "")),
        ),
    )
    assert asyncio.run(run_doctor()) == 0
